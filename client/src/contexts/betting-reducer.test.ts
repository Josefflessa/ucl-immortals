import { describe, it, expect } from 'vitest';
import { gameReducer } from './GameContext';
import type { GameState, GameAction } from './GameContext';

// Estado mínimo só com os campos que o betting toca.
const base = (over: Partial<GameState> = {}): GameState => ({
  ...({} as GameState),
  playerTeam: { id: 'me', players: [] } as any,
  botTeams: [] as any,
  points: 500,
  leagueRound: 1,
  leagueFixtures: [] as any,
  bets: [],
  ...over,
});

describe('PLACE_BET / CANCEL_BET (escrow)', () => {
  it('debita o stake ao apostar e guarda o bet', () => {
    const s = gameReducer(base(), { type: 'PLACE_BET', matchKey: 'L1:a-b', homeGoals: 2, awayGoals: 1, stake: 100 });
    expect(s.points).toBe(400);
    expect(s.bets).toHaveLength(1);
    expect(s.bets[0]).toMatchObject({ matchKey: 'L1:a-b', homeGoals: 2, awayGoals: 1, stake: 100 });
  });
  it('editar o mesmo jogo ajusta o escrow pela diferença', () => {
    let s = gameReducer(base(), { type: 'PLACE_BET', matchKey: 'L1:a-b', homeGoals: 2, awayGoals: 1, stake: 100 });
    s = gameReducer(s, { type: 'PLACE_BET', matchKey: 'L1:a-b', homeGoals: 0, awayGoals: 0, stake: 150 });
    expect(s.points).toBe(500 - 150);
    expect(s.bets).toHaveLength(1);
    expect(s.bets[0]).toMatchObject({ homeGoals: 0, awayGoals: 0, stake: 150 });
  });
  it('rejeita aposta que estoura o teto da rodada', () => {
    let s = gameReducer(base({ points: 999 }), { type: 'PLACE_BET', matchKey: 'L1:a-b', homeGoals: 1, awayGoals: 0, stake: 150 });
    s = gameReducer(s, { type: 'PLACE_BET', matchKey: 'L1:c-d', homeGoals: 1, awayGoals: 0, stake: 100 }); // 250 > 200
    expect(s.bets).toHaveLength(1); // segundo rejeitado
    expect(s.points).toBe(999 - 150);
  });
  it('rejeita aposta sem saldo', () => {
    const s = gameReducer(base({ points: 50 }), { type: 'PLACE_BET', matchKey: 'L1:a-b', homeGoals: 1, awayGoals: 0, stake: 100 });
    expect(s.bets).toHaveLength(0);
    expect(s.points).toBe(50);
  });
  it('cancelar devolve o escrow e remove o bet', () => {
    let s = gameReducer(base(), { type: 'PLACE_BET', matchKey: 'L1:a-b', homeGoals: 2, awayGoals: 1, stake: 100 });
    s = gameReducer(s, { type: 'CANCEL_BET', matchKey: 'L1:a-b' });
    expect(s.points).toBe(500);
    expect(s.bets).toHaveLength(0);
  });
});

describe('FINISH_LEAGUE_MATCH liquida e credita os palpites', () => {
  const mkResult = (homeTeamId: string, awayTeamId: string, hg: number, ag: number): any =>
    ({ homeTeamId, awayTeamId, homeGoals: hg, awayGoals: ag, events: [], playerStats: {} });

  it('credita o payout de palpites certos e liquida os demais, marcando revealed', () => {
    const state = base({
      points: 300,
      leagueRound: 1,
      playerTeam: { id: 'me', players: [] } as any,
      botTeams: [{ id: 'b', players: [] }, { id: 'c', players: [] }, { id: 'd', players: [] }] as any,
      leagueFixtures: [
        { round: 1, homeTeamId: 'me', awayTeamId: 'b', played: false },
        // c-d já jogado com placar conhecido → o reducer NÃO re-simula (times mínimos não têm formação).
        { round: 1, homeTeamId: 'c', awayTeamId: 'd', played: true, result: mkResult('c', 'd', 1, 0) },
      ] as any,
      bets: [
        { matchKey: 'L1:me-b', homeGoals: 2, awayGoals: 1, stake: 100 }, // jogo do player dá 2-1 → exact
        { matchKey: 'L1:c-d', homeGoals: 0, awayGoals: 0, stake: 40 },   // deu 1-0 → miss (perde 40)
      ],
    });
    const finished = gameReducer(state, { type: 'FINISH_LEAGUE_MATCH', result: mkResult('me', 'b', 2, 1) } as GameAction);
    const meBet = finished.bets.find(b => b.matchKey === 'L1:me-b')!;
    expect(meBet.settled).toBe(true);
    expect(meBet.revealed).toBe(true);
    expect(meBet.tier).toBe('exact');
    // 300 (start) + pontos da partida do 'me' (>=15) + payout do palpite exato (250).
    expect(finished.points).toBeGreaterThanOrEqual(300 + 250);
    const cdBet = finished.bets.find(b => b.matchKey === 'L1:c-d')!;
    expect(cdBet.settled).toBe(true);
    expect(cdBet.revealed).toBe(true);
    expect(cdBet.tier).toBe('miss');
    expect(cdBet.payout).toBe(0);
  });
});

describe('FINISH_KNOCKOUT_MATCH liquida palpites de perna (solo)', () => {
  it('credita palpite certo da perna e marca revealed', () => {
    const bracket: any = {
      playoffs: [{ id: 't', homeTeamId: 'me', awayTeamId: 'b', leg1: { homeTeamId: 'me', awayTeamId: 'b', homeGoals: 2, awayGoals: 0, events: [], playerStats: {} } }],
      round16: [], quarterFinals: [], semiFinals: [], final: null, currentRound: 'playoffs', currentLeg: 1,
    };
    const state = base({ points: 100, playerTeam: { id: 'me', players: [] } as any, knockoutBracket: bracket,
      bets: [{ matchKey: 'Kt:1', homeGoals: 2, awayGoals: 0, stake: 40 }] });
    const finished = gameReducer(state, { type: 'FINISH_KNOCKOUT_MATCH', result: { homeTeamId: 'me', awayTeamId: 'b', homeGoals: 2, awayGoals: 0, events: [], playerStats: {} } } as any);
    const b = finished.bets.find(x => x.matchKey === 'Kt:1')!;
    expect(b.revealed).toBe(true);
    expect(b.tier).toBe('exact');
    expect(finished.points).toBeGreaterThanOrEqual(100 + Math.round(40 * 2.5));
  });
});
