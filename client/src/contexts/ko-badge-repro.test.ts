import { describe, it, expect } from 'vitest';
import { gameReducer } from './GameContext';
import type { GameState } from './GameContext';
import { buildKnockoutMatchKey } from '../lib/bets';

const base = (over: Partial<GameState> = {}): GameState => ({
  ...({} as GameState),
  mode: 'solo' as any,
  playerTeam: { id: 'me', players: [] } as any,
  botTeams: [] as any,
  points: 500,
  leagueRound: 1,
  leagueFixtures: [] as any,
  watchedKnockoutMatches: [],
  bets: [],
  ...over,
});

// Replica EXACT badge/hide logic from KnockoutTiesTab.tsx for a given match+state.
function evalBadges(state: GameState, match: any, round: string, currentLeg: number) {
  const bets = state.bets ?? [];
  const betFor = (k: string) => bets.find(b => b.matchKey === k);
  const hasPlayer = match.homeTeamId === state.playerTeam!.id || match.awayTeamId === state.playerTeam!.id;
  const twoLeg = !match.isSingleLeg && round !== 'final';
  const l1 = match.leg1, l2 = match.leg2;
  const watched = state.watchedKnockoutMatches;
  const hideMyScore = hasPlayer && (
    twoLeg
      ? (!!l2 && !watched.includes(`${match.id}_l2`)) || (!!l1 && !watched.includes(`${match.id}_l1`))
      : (match.played && !!match.result && !watched.includes(match.id))
  );
  const hideAllScores = (state as any).mode === 'online';
  const hideScore = hideAllScores || hideMyScore;

  const badge = (b: any, word: string) => {
    if (!b || !b.settled) return null;
    if (hideScore || !b.revealed) return `EM_ANDAMENTO(${word})`;
    return b.won ? `WON(${word})` : `LOST(${word})`;
  };
  return {
    hideScore,
    ida: badge(betFor(buildKnockoutMatchKey(match.id, 1)), 'ida'),
    volta: badge(betFor(buildKnockoutMatchKey(match.id, 2)), 'volta'),
  };
}

describe('KO badge repro (solo two-leg)', () => {
  it('shows result badges after watching ida then volta', () => {
    const mkRes = (h: number, a: number): any => ({ homeTeamId: 'me', awayTeamId: 'b', homeGoals: h, awayGoals: a, events: [], playerStats: {} });
    // Bet on ida (Kt:1) 2-0 and volta (Kt:2) — note volta mando is inverted (b home).
    let state = base({
      knockoutBracket: {
        playoffs: [{ id: 't', homeTeamId: 'me', awayTeamId: 'b', played: false, currentLeg: 1 }],
        round16: [], quarterFinals: [], semiFinals: [], final: null, currentRound: 'playoffs', currentLeg: 1,
      } as any,
      bets: [
        { matchKey: 'Kt:1', homeGoals: 2, awayGoals: 0, stake: 40 },
        { matchKey: 'Kt:2', homeGoals: 1, awayGoals: 1, stake: 20 },
      ],
    });

    // --- IDA played: bracket gets leg1, currentLeg -> 2 ---
    (state.knockoutBracket as any).playoffs[0].leg1 = mkRes(2, 0);
    (state.knockoutBracket as any).currentLeg = 2;

    // Player watches ida (auto-open), then finishes.
    const teamA: any = { id: 'me', players: [] }, teamB: any = { id: 'b', players: [] };
    state = gameReducer(state, { type: 'WATCH_ONLINE_MATCH', teams: [teamA, teamB], result: mkRes(2, 0), knockout: { matchId: 't', round: 'playoffs', leg: 1 } } as any);
    state = gameReducer(state, { type: 'FINISH_KNOCKOUT_MATCH', result: mkRes(2, 0) } as any);

    let r = evalBadges(state, (state.knockoutBracket as any).playoffs[0], 'playoffs', 2);
    console.log('AFTER IDA:', JSON.stringify(r), 'watched=', state.watchedKnockoutMatches, 'bets=', JSON.stringify(state.bets));
    expect(r.ida).toBe('WON(ida)');

    // --- VOLTA played: leg2 set, tie resolves ---
    const leg2: any = { homeTeamId: 'b', awayTeamId: 'me', homeGoals: 1, awayGoals: 1, events: [], playerStats: {} };
    (state.knockoutBracket as any).playoffs[0].leg2 = leg2;
    (state.knockoutBracket as any).playoffs[0].result = { homeTeamId: 'me', awayTeamId: 'b', homeGoals: 3, awayGoals: 1, winner: 'me', events: [] };
    (state.knockoutBracket as any).playoffs[0].played = true;

    state = gameReducer(state, { type: 'WATCH_ONLINE_MATCH', teams: [teamB, teamA], result: leg2, knockout: { matchId: 't', round: 'playoffs', leg: 2 } } as any);
    state = gameReducer(state, { type: 'FINISH_KNOCKOUT_MATCH', result: leg2 } as any);

    r = evalBadges(state, (state.knockoutBracket as any).playoffs[0], 'playoffs', 2);
    console.log('AFTER VOLTA:', JSON.stringify(r), 'watched=', state.watchedKnockoutMatches, 'bets=', JSON.stringify(state.bets));
    expect(r.ida).not.toContain('EM_ANDAMENTO');
    expect(r.volta).not.toContain('EM_ANDAMENTO');
  });
});
