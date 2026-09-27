import { describe, expect, it } from 'vitest';
import { createGameRuntime, registerSocketHandlers, runWithGameRuntime, type RoomState } from './handlers';
import type { RealtimeEventHandler, RealtimeServer, RealtimeSocket } from './realtime';
import type { Player } from '../client/src/lib/gameData';
import type { PlayerCard, Team } from '../client/src/lib/gameEngine';
import type { RoomPlayer } from '../client/src/contexts/GameContext';
import { createCompetitionFormat } from '../client/src/lib/competition';

// ── Minimal fake transport, mirroring the harness in game-runtime.test.ts ──
class FakeServer implements RealtimeServer {
  private connectionHandler: ((socket: RealtimeSocket) => void) | undefined;
  readonly sockets = {
    adapter: { rooms: new Map<string, Set<string>>() },
    sockets: new Map<string, RealtimeSocket>(),
  };

  on(_event: 'connection', handler: (socket: RealtimeSocket) => void): void {
    this.connectionHandler = handler;
  }

  to(roomCode: string) {
    return {
      emit: (event: string, payload?: unknown) => {
        Array.from(this.sockets.adapter.rooms.get(roomCode) ?? []).forEach((socketId) => {
          this.sockets.sockets.get(socketId)?.emit(event, payload);
        });
      },
    };
  }

  connect(socket: FakeSocket): void {
    this.sockets.sockets.set(socket.id, socket);
    this.connectionHandler?.(socket);
  }

  join(socketId: string, roomCode: string): void {
    const members = this.sockets.adapter.rooms.get(roomCode) ?? new Set<string>();
    members.add(socketId);
    this.sockets.adapter.rooms.set(roomCode, members);
  }

  leave(socketId: string, roomCode: string): void {
    const members = this.sockets.adapter.rooms.get(roomCode);
    members?.delete(socketId);
    if (members?.size === 0) this.sockets.adapter.rooms.delete(roomCode);
  }
}

class FakeSocket implements RealtimeSocket {
  readonly sent: Array<{ event: string; payload?: unknown }> = [];
  private readonly handlers = new Map<string, RealtimeEventHandler>();

  constructor(readonly id: string, private readonly server: FakeServer) {}

  on(event: string, handler: RealtimeEventHandler): void {
    this.handlers.set(event, handler);
  }

  emit(event: string, payload?: unknown): void {
    this.sent.push({ event, payload });
  }

  join(roomCode: string): void {
    this.server.join(this.id, roomCode);
  }

  leave(roomCode: string): void {
    this.server.leave(this.id, roomCode);
  }

  receive(event: string, payload?: unknown): void {
    this.handlers.get(event)?.(payload);
  }
}

// ── Minimal valid Player/Team/Room fixtures — the trade handlers only ever
// read `.id`, bench position (index ≥ 11) and credits, so the rest of the
// attributes just need to satisfy the type. ──
function fakePlayer(id: string, overrides: Partial<Player> = {}): PlayerCard {
  return {
    id, shortName: id, fullName: id, position: 'CM', nation: 'Brasil', club: 'Clube',
    season: '2024/25', rarity: 'gold', overall: 80,
    pace: 80, shooting: 80, passing: 80, dribbling: 80, defending: 80, physical: 80, composure: 80, vision: 80,
    traits: [], chemistryScore: 0, isOOP: false,
    ...overrides,
  };
}

function fakeTeam(id: string, benchIds: string[]): Team {
  const starters = Array.from({ length: 11 }, (_, i) => fakePlayer(`${id}_st${i}`));
  const bench = benchIds.map(benchId => fakePlayer(benchId));
  return {
    id, name: id, coachId: 'guardiola', formationId: '4-3-3', playStyle: 'balanced',
    players: [...starters, ...bench], totalChemistry: 0, isBot: false, credits: 500,
  };
}

function fakeRoomPlayer(id: string, socketId: string, team: Team, points: number): RoomPlayer {
  return {
    socketId, connected: true, id, name: id, coachId: 'guardiola', formationId: '4-3-3',
    draftedPlayers: [], vetoesLeft: 4, captain: null, penaltyTaker: null, freeKickTaker: null,
    team, ready: false, points,
  } as unknown as RoomPlayer;
}

function fakeRoom(playerA: RoomPlayer, playerB: RoomPlayer): RoomState {
  return {
    code: 'ABCD', stateRevision: 1, phase: 'league', difficulty: 'gold',
    competitionFormat: createCompetitionFormat('league_knockout'),
    hostId: playerA.id, players: [playerA, playerB], botTeams: [],
    leagueFixtures: [], leagueStandings: [], leagueResults: [], leagueRound: 1,
    knockoutBracket: null, champion: null,
    watchedRoundPlayers: [], watchedKnockoutLegPlayers: [], watchedLeagueRound: null, watchedKnockoutLegKey: null,
    readyPlayers: [], discipline: {}, market: [], trades: [],
    draftState: { round: 1, timerKey: 0, turnIndex: 0, draftOrder: [], alreadyDraftedIds: [], history: [], currentOptionsByPlayer: {} },
  } as unknown as RoomState;
}

interface Harness {
  runtime: ReturnType<typeof createGameRuntime>;
  server: FakeServer;
  alice: FakeSocket; // fromPlayer (proposer)
  bruno: FakeSocket; // toPlayer (target)
}

function setup(): Harness {
  const runtime = createGameRuntime({ roomCode: 'ABCD' });
  const server = new FakeServer();
  const alice = new FakeSocket('socket-alice', server);
  const bruno = new FakeSocket('socket-bruno', server);
  registerSocketHandlers(server);
  runWithGameRuntime(runtime, () => { server.connect(alice); server.connect(bruno); alice.join('ABCD'); bruno.join('ABCD'); });

  const teamA = fakeTeam('teamA', ['a_bench0', 'a_bench1']);
  const teamB = fakeTeam('teamB', ['b_bench0']);
  const roomAlice = fakeRoomPlayer('alice', alice.id, teamA, 100);
  const roomBruno = fakeRoomPlayer('bruno', bruno.id, teamB, 100);
  runtime.rooms.set('ABCD', fakeRoom(roomAlice, roomBruno));

  return { runtime, server, alice, bruno };
}

function benchIds(runtime: Harness['runtime'], playerId: string): string[] {
  return runtime.rooms.get('ABCD')!.players.find(p => p.id === playerId)!.team!.players.slice(11).map(p => p.id);
}

describe('trocas online (trade_propose / cancel / reject / accept)', () => {
  it('propõe, e a proposta aparece em room.trades pros dois lados', () => {
    const { runtime, alice } = setup();
    runWithGameRuntime(runtime, () => alice.receive('trade_propose', {
      roomCode: 'ABCD', toPlayerId: 'bruno', offeredPlayerId: 'a_bench0', requestedPlayerId: 'b_bench0', creditsDelta: 0,
    }));

    const room = runtime.rooms.get('ABCD')!;
    expect(room.trades).toHaveLength(1);
    expect(room.trades[0]).toMatchObject({
      fromPlayerId: 'alice', toPlayerId: 'bruno', creditsDelta: 0,
    });
    expect(room.trades[0].offeredPlayer.id).toBe('a_bench0');
    expect(room.trades[0].requestedPlayer.id).toBe('b_bench0');
  });

  it('recusa propor com um jogador titular (índice < 11) de qualquer lado', () => {
    const { runtime, alice } = setup();
    runWithGameRuntime(runtime, () => alice.receive('trade_propose', {
      roomCode: 'ABCD', toPlayerId: 'bruno', offeredPlayerId: 'teamA_st0', requestedPlayerId: 'b_bench0', creditsDelta: 0,
    }));
    expect(runtime.rooms.get('ABCD')!.trades).toHaveLength(0);
  });

  it('recusa propor mais créditos do que o proponente tem', () => {
    const { runtime, alice } = setup();
    runWithGameRuntime(runtime, () => alice.receive('trade_propose', {
      roomCode: 'ABCD', toPlayerId: 'bruno', offeredPlayerId: 'a_bench0', requestedPlayerId: 'b_bench0', creditsDelta: 9999,
    }));
    expect(runtime.rooms.get('ABCD')!.trades).toHaveLength(0);
    expect(alice.sent.some(m => m.event === 'action_error')).toBe(true);
  });

  it('cancela — só quem propôs pode, e o jogador não é removido do banco', () => {
    const { runtime, alice, bruno } = setup();
    runWithGameRuntime(runtime, () => alice.receive('trade_propose', {
      roomCode: 'ABCD', toPlayerId: 'bruno', offeredPlayerId: 'a_bench0', requestedPlayerId: 'b_bench0', creditsDelta: 0,
    }));
    const tradeId = runtime.rooms.get('ABCD')!.trades[0].id;

    // O alvo (bruno) NÃO pode cancelar a proposta de outra pessoa.
    runWithGameRuntime(runtime, () => bruno.receive('trade_cancel', { roomCode: 'ABCD', tradeId }));
    expect(runtime.rooms.get('ABCD')!.trades).toHaveLength(1);

    runWithGameRuntime(runtime, () => alice.receive('trade_cancel', { roomCode: 'ABCD', tradeId }));
    expect(runtime.rooms.get('ABCD')!.trades).toHaveLength(0);
    expect(benchIds(runtime, 'alice')).toContain('a_bench0');
  });

  it('recusar (reject) só pode ser feito por quem recebeu, e some da lista sem trocar nada', () => {
    const { runtime, alice, bruno } = setup();
    runWithGameRuntime(runtime, () => alice.receive('trade_propose', {
      roomCode: 'ABCD', toPlayerId: 'bruno', offeredPlayerId: 'a_bench0', requestedPlayerId: 'b_bench0', creditsDelta: 0,
    }));
    const tradeId = runtime.rooms.get('ABCD')!.trades[0].id;

    runWithGameRuntime(runtime, () => alice.receive('trade_reject', { roomCode: 'ABCD', tradeId }));
    expect(runtime.rooms.get('ABCD')!.trades).toHaveLength(1); // proponente não pode recusar a própria proposta

    runWithGameRuntime(runtime, () => bruno.receive('trade_reject', { roomCode: 'ABCD', tradeId }));
    expect(runtime.rooms.get('ABCD')!.trades).toHaveLength(0);
    expect(benchIds(runtime, 'alice')).toEqual(['a_bench0', 'a_bench1']);
    expect(benchIds(runtime, 'bruno')).toEqual(['b_bench0']);
  });

  it('aceitar troca 1-por-1 sem créditos: troca os jogadores dos dois lados atomicamente', () => {
    const { runtime, alice, bruno } = setup();
    runWithGameRuntime(runtime, () => alice.receive('trade_propose', {
      roomCode: 'ABCD', toPlayerId: 'bruno', offeredPlayerId: 'a_bench0', requestedPlayerId: 'b_bench0', creditsDelta: 0,
    }));
    const tradeId = runtime.rooms.get('ABCD')!.trades[0].id;

    runWithGameRuntime(runtime, () => bruno.receive('trade_accept', { roomCode: 'ABCD', tradeId }));

    const room = runtime.rooms.get('ABCD')!;
    expect(room.trades).toHaveLength(0);
    expect(benchIds(runtime, 'alice')).toEqual(['a_bench1', 'b_bench0']);
    expect(benchIds(runtime, 'bruno')).toEqual(['a_bench0']);
    expect(room.players.find(p => p.id === 'alice')!.points).toBe(100);
    expect(room.players.find(p => p.id === 'bruno')!.points).toBe(100);
  });

  it('aceitar troca com créditos positivos: proponente paga o alvo', () => {
    const { runtime, alice, bruno } = setup();
    runWithGameRuntime(runtime, () => alice.receive('trade_propose', {
      roomCode: 'ABCD', toPlayerId: 'bruno', offeredPlayerId: 'a_bench0', requestedPlayerId: 'b_bench0', creditsDelta: 30,
    }));
    const tradeId = runtime.rooms.get('ABCD')!.trades[0].id;
    runWithGameRuntime(runtime, () => bruno.receive('trade_accept', { roomCode: 'ABCD', tradeId }));

    const room = runtime.rooms.get('ABCD')!;
    expect(room.players.find(p => p.id === 'alice')!.points).toBe(70);
    expect(room.players.find(p => p.id === 'bruno')!.points).toBe(130);
  });

  it('aceitar troca com créditos negativos: proponente pede créditos do alvo', () => {
    const { runtime, alice, bruno } = setup();
    runWithGameRuntime(runtime, () => alice.receive('trade_propose', {
      roomCode: 'ABCD', toPlayerId: 'bruno', offeredPlayerId: 'a_bench0', requestedPlayerId: 'b_bench0', creditsDelta: -25,
    }));
    const tradeId = runtime.rooms.get('ABCD')!.trades[0].id;
    runWithGameRuntime(runtime, () => bruno.receive('trade_accept', { roomCode: 'ABCD', tradeId }));

    const room = runtime.rooms.get('ABCD')!;
    expect(room.players.find(p => p.id === 'alice')!.points).toBe(125);
    expect(room.players.find(p => p.id === 'bruno')!.points).toBe(75);
  });

  it('rejeita o aceite se o alvo não tem créditos suficientes pra pagar a parte pedida', () => {
    const { runtime, alice, bruno } = setup();
    runWithGameRuntime(runtime, () => alice.receive('trade_propose', {
      roomCode: 'ABCD', toPlayerId: 'bruno', offeredPlayerId: 'a_bench0', requestedPlayerId: 'b_bench0', creditsDelta: -500,
    }));
    const tradeId = runtime.rooms.get('ABCD')!.trades[0].id;
    runWithGameRuntime(runtime, () => bruno.receive('trade_accept', { roomCode: 'ABCD', tradeId }));

    const room = runtime.rooms.get('ABCD')!;
    // Proposta continua pendente (não foi consumida) e nada trocou de dono.
    expect(room.trades).toHaveLength(1);
    expect(benchIds(runtime, 'alice')).toEqual(['a_bench0', 'a_bench1']);
    expect(bruno.sent.some(m => m.event === 'action_error')).toBe(true);
  });

  it('ao aceitar uma troca, invalida qualquer OUTRA proposta pendente que envolva os mesmos dois jogadores', () => {
    const { runtime, alice, bruno } = setup();
    runWithGameRuntime(runtime, () => alice.receive('trade_propose', {
      roomCode: 'ABCD', toPlayerId: 'bruno', offeredPlayerId: 'a_bench0', requestedPlayerId: 'b_bench0', creditsDelta: 0,
    }));
    // Uma segunda proposta (de bruno pra alice) mirando o MESMO par de jogadores.
    runWithGameRuntime(runtime, () => bruno.receive('trade_propose', {
      roomCode: 'ABCD', toPlayerId: 'alice', offeredPlayerId: 'b_bench0', requestedPlayerId: 'a_bench1', creditsDelta: 0,
    }));
    expect(runtime.rooms.get('ABCD')!.trades).toHaveLength(2);

    const firstTradeId = runtime.rooms.get('ABCD')!.trades[0].id;
    runWithGameRuntime(runtime, () => bruno.receive('trade_accept', { roomCode: 'ABCD', tradeId: firstTradeId }));

    // A segunda proposta referenciava b_bench0 (agora com alice), então fica inválida e é removida.
    expect(runtime.rooms.get('ABCD')!.trades).toHaveLength(0);
  });
});
