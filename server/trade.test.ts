import { describe, expect, it } from 'vitest';
import { createGameRuntime, registerSocketHandlers, runWithGameRuntime, type RoomState } from './handlers';
import type { RealtimeEventHandler, RealtimeServer, RealtimeSocket } from './realtime';
import type { Player } from '../shared/game/gameData';
import type { PlayerCard, Team } from '../shared/game/gameEngine';
import type { RoomPlayer } from '../client/src/contexts/GameContext';
import { createCompetitionFormat } from '../shared/game/competition';

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
  alice: FakeSocket; // host (quem convida)
  bruno: FakeSocket; // guest (quem é convidado)
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

function invite(h: Harness): string {
  runWithGameRuntime(h.runtime, () => h.alice.receive('trade_invite', { roomCode: 'ABCD', toPlayerId: 'bruno' }));
  return h.runtime.rooms.get('ABCD')!.trades[0].id;
}

function inviteAndNegotiate(h: Harness): string {
  const tradeId = invite(h);
  runWithGameRuntime(h.runtime, () => h.bruno.receive('trade_accept_invite', { roomCode: 'ABCD', tradeId }));
  return tradeId;
}

describe('convite de troca (trade_invite / trade_leave / trade_accept_invite)', () => {
  it('convida, e a sessão aparece pendente pros dois lados', () => {
    const h = setup();
    const tradeId = invite(h);
    const session = h.runtime.rooms.get('ABCD')!.trades.find(t => t.id === tradeId)!;
    expect(session).toMatchObject({ hostId: 'alice', guestId: 'bruno', status: 'invite' });
  });

  it('recusa convidar quem já está em outra sessão (convite ou negociação)', () => {
    const h = setup();
    invite(h); // alice ↔ bruno já ocupados
    const teamC = fakeTeam('teamC', ['c_bench0']);
    const roomCarla = fakeRoomPlayer('carla', 'socket-carla', teamC, 100);
    h.runtime.rooms.get('ABCD')!.players.push(roomCarla);
    const carla = new FakeSocket('socket-carla', h.server);
    registerSocketHandlers(h.server);
    runWithGameRuntime(h.runtime, () => { h.server.connect(carla); carla.join('ABCD'); });

    runWithGameRuntime(h.runtime, () => carla.receive('trade_invite', { roomCode: 'ABCD', toPlayerId: 'alice' }));
    expect(h.runtime.rooms.get('ABCD')!.trades).toHaveLength(1); // não criou uma segunda sessão
    expect(carla.sent.some(m => m.event === 'action_error')).toBe(true);
  });

  it('sair (trade_leave) cancela um convite pendente — só quem está nele pode', () => {
    const h = setup();
    const tradeId = invite(h);
    const teamC = fakeTeam('teamC', ['c_bench0']);
    const roomCarla = fakeRoomPlayer('carla', 'socket-carla', teamC, 100);
    h.runtime.rooms.get('ABCD')!.players.push(roomCarla);
    const carla = new FakeSocket('socket-carla', h.server);
    runWithGameRuntime(h.runtime, () => h.server.connect(carla));

    runWithGameRuntime(h.runtime, () => carla.receive('trade_leave', { roomCode: 'ABCD', tradeId }));
    expect(h.runtime.rooms.get('ABCD')!.trades).toHaveLength(1); // carla não faz parte dessa sessão

    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_leave', { roomCode: 'ABCD', tradeId }));
    expect(h.runtime.rooms.get('ABCD')!.trades).toHaveLength(0);
  });

  it('só o convidado pode aceitar o convite, e isso abre a negociação', () => {
    const h = setup();
    const tradeId = invite(h);
    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_accept_invite', { roomCode: 'ABCD', tradeId }));
    expect(h.runtime.rooms.get('ABCD')!.trades[0].status).toBe('invite'); // proponente não pode aceitar a própria

    runWithGameRuntime(h.runtime, () => h.bruno.receive('trade_accept_invite', { roomCode: 'ABCD', tradeId }));
    expect(h.runtime.rooms.get('ABCD')!.trades[0].status).toBe('negotiating');
  });

  it('abrir a negociação invalida o "Estou pronto" da rodada dos dois lados', () => {
    const h = setup();
    const tradeId = invite(h);
    h.runtime.rooms.get('ABCD')!.readyPlayers = ['alice', 'bruno'];

    runWithGameRuntime(h.runtime, () => h.bruno.receive('trade_accept_invite', { roomCode: 'ABCD', tradeId }));

    expect(h.runtime.rooms.get('ABCD')!.readyPlayers).toEqual([]);
  });
});

describe('negociação de troca (trade_select / trade_ready)', () => {
  it('cada lado escolhe um jogador do PRÓPRIO banco; titular (índice < 11) é recusado', () => {
    const h = setup();
    const tradeId = inviteAndNegotiate(h);
    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_select', {
      roomCode: 'ABCD', tradeId, playerIds: ['teamA_st0'], creditsDelta: 0,
    }));
    expect(h.runtime.rooms.get('ABCD')!.trades[0].host.playerIds).toEqual([]);

    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_select', {
      roomCode: 'ABCD', tradeId, playerIds: ['a_bench0'], creditsDelta: 20,
    }));
    const session = h.runtime.rooms.get('ABCD')!.trades[0];
    expect(session.host).toMatchObject({ playerIds: ['a_bench0'], creditsDelta: 20, ready: false });
  });

  it('marcar Pronto exige uma escolha válida primeiro', () => {
    const h = setup();
    const tradeId = inviteAndNegotiate(h);
    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_ready', { roomCode: 'ABCD', tradeId }));
    expect(h.runtime.rooms.get('ABCD')!.trades[0].host.ready).toBe(false);
    expect(h.alice.sent.some(m => m.event === 'action_error')).toBe(true);
  });

  it('mudar a escolha de um lado reseta o Pronto dos DOIS', () => {
    const h = setup();
    const tradeId = inviteAndNegotiate(h);
    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_select', { roomCode: 'ABCD', tradeId, playerIds: ['a_bench0'], creditsDelta: 0 }));
    runWithGameRuntime(h.runtime, () => h.bruno.receive('trade_select', { roomCode: 'ABCD', tradeId, playerIds: ['b_bench0'], creditsDelta: 0 }));
    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_ready', { roomCode: 'ABCD', tradeId }));
    expect(h.runtime.rooms.get('ABCD')!.trades[0].host.ready).toBe(true);

    runWithGameRuntime(h.runtime, () => h.bruno.receive('trade_select', { roomCode: 'ABCD', tradeId, playerIds: ['b_bench0'], creditsDelta: 15 }));
    const session = h.runtime.rooms.get('ABCD')!.trades[0];
    expect(session.host.ready).toBe(false);
    expect(session.guest.ready).toBe(false);
  });

  it('quando os dois marcam Pronto, executa a troca atomicamente (jogadores + créditos)', () => {
    const h = setup();
    const tradeId = inviteAndNegotiate(h);
    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_select', { roomCode: 'ABCD', tradeId, playerIds: ['a_bench0'], creditsDelta: 30 }));
    runWithGameRuntime(h.runtime, () => h.bruno.receive('trade_select', { roomCode: 'ABCD', tradeId, playerIds: ['b_bench0'], creditsDelta: 0 }));
    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_ready', { roomCode: 'ABCD', tradeId }));
    runWithGameRuntime(h.runtime, () => h.bruno.receive('trade_ready', { roomCode: 'ABCD', tradeId }));

    const room = h.runtime.rooms.get('ABCD')!;
    expect(room.trades).toHaveLength(0);
    expect(benchIds(h.runtime, 'alice')).toEqual(['a_bench1', 'b_bench0']);
    expect(benchIds(h.runtime, 'bruno')).toEqual(['a_bench0']);
    // Alice ofereceu +30 créditos junto do jogador: ela paga, bruno recebe.
    expect(room.players.find(p => p.id === 'alice')!.points).toBe(70);
    expect(room.players.find(p => p.id === 'bruno')!.points).toBe(130);
  });

  it('permite trocar dois jogadores por dois jogadores na mesma oferta', () => {
    const h = setup();
    const room = h.runtime.rooms.get('ABCD')!;
    room.players.find(p => p.id === 'bruno')!.team!.players.push(fakePlayer('b_bench1'));
    const tradeId = inviteAndNegotiate(h);

    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_select', {
      roomCode: 'ABCD', tradeId, playerIds: ['a_bench0', 'a_bench1'], creditsDelta: 20,
    }));
    runWithGameRuntime(h.runtime, () => h.bruno.receive('trade_select', {
      roomCode: 'ABCD', tradeId, playerIds: ['b_bench0', 'b_bench1'], creditsDelta: 0,
    }));
    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_ready', { roomCode: 'ABCD', tradeId }));
    runWithGameRuntime(h.runtime, () => h.bruno.receive('trade_ready', { roomCode: 'ABCD', tradeId }));

    expect(room.trades).toHaveLength(0);
    expect(benchIds(h.runtime, 'alice')).toEqual(['b_bench0', 'b_bench1']);
    expect(benchIds(h.runtime, 'bruno')).toEqual(['a_bench0', 'a_bench1']);
    expect(room.players.find(p => p.id === 'alice')!.points).toBe(80);
    expect(room.players.find(p => p.id === 'bruno')!.points).toBe(120);
  });

  it('rejeita a execução se um dos dois não tem mais créditos suficientes, e destrava o Pronto pro outro tentar de novo', () => {
    const h = setup();
    const tradeId = inviteAndNegotiate(h);
    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_select', { roomCode: 'ABCD', tradeId, playerIds: ['a_bench0'], creditsDelta: 500 }));
    runWithGameRuntime(h.runtime, () => h.bruno.receive('trade_select', { roomCode: 'ABCD', tradeId, playerIds: ['b_bench0'], creditsDelta: 0 }));
    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_ready', { roomCode: 'ABCD', tradeId }));
    runWithGameRuntime(h.runtime, () => h.bruno.receive('trade_ready', { roomCode: 'ABCD', tradeId }));

    const room = h.runtime.rooms.get('ABCD')!;
    expect(room.trades).toHaveLength(1); // a sessão não foi consumida
    expect(room.trades[0].host.ready).toBe(false);
    expect(room.trades[0].guest.ready).toBe(false);
    expect(benchIds(h.runtime, 'alice')).toEqual(['a_bench0', 'a_bench1']); // nada trocou de dono
    expect(h.bruno.sent.some(m => m.event === 'action_error')).toBe(true);
  });

  it('sair da negociação a qualquer momento encerra a sessão sem trocar nada', () => {
    const h = setup();
    const tradeId = inviteAndNegotiate(h);
    runWithGameRuntime(h.runtime, () => h.alice.receive('trade_select', { roomCode: 'ABCD', tradeId, playerIds: ['a_bench0'], creditsDelta: 0 }));
    runWithGameRuntime(h.runtime, () => h.bruno.receive('trade_leave', { roomCode: 'ABCD', tradeId }));

    const room = h.runtime.rooms.get('ABCD')!;
    expect(room.trades).toHaveLength(0);
    expect(benchIds(h.runtime, 'alice')).toEqual(['a_bench0', 'a_bench1']);
    expect(benchIds(h.runtime, 'bruno')).toEqual(['b_bench0']);
  });
});
