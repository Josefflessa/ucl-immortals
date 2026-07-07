import { describe, it, expect } from 'vitest';
import { gameReducer } from './GameContext';
import { buildKnockoutMatchKey } from '../lib/bets';
import { getActiveKnockoutMatches } from '../lib/gameEngine';

function evalBadge(state: any) {
  const kb = state.knockoutBracket;
  const matches = getActiveKnockoutMatches(kb) as any[];
  const round = kb.currentRound, currentLeg = kb.currentLeg;
  const isFinal = round === 'final';
  const allPlayed = matches.length > 0 && matches.every((m: any) => m.played);
  const idaPlayed = !isFinal && currentLeg === 2 && !allPlayed;
  const humanPlayersInBracket = state.onlinePlayers.filter((p: any) => p.connected && matches.some((m: any) => m.homeTeamId === p.id || m.awayTeamId === p.id));
  const allPlayersWatched = humanPlayersInBracket.length === 0 || humanPlayersInBracket.every((p: any) => state.onlineWatchedPlayers.includes(p.id));
  const bets = state.bets ?? [];
  const betFor = (k: string) => bets.find((b: any) => b.matchKey === k);
  const isPlayerTeam = (id: string) => state.onlinePlayers.some((p: any) => p.id === id && p.socketId === state.socketId);
  const m = matches[0];
  const hasPlayer = isPlayerTeam(m.homeTeamId) || isPlayerTeam(m.awayTeamId);
  const twoLeg = !m.isSingleLeg && round !== 'final';
  const l1 = m.leg1, l2 = m.leg2, watched = state.watchedKnockoutMatches;
  const hideMyScore = state.mode !== 'online' && hasPlayer && (twoLeg
    ? (!!l2 && !watched.includes(`${m.id}_l2`)) || (!!l1 && !watched.includes(`${m.id}_l1`))
    : (m.played && !!m.result && !watched.includes(m.id)));
  const hideAllScores = state.mode === 'online' && !allPlayersWatched && (allPlayed || idaPlayed);
  const hideScore = hideAllScores || hideMyScore;
  const badge = (b: any, w: string) => { if (!b || !b.settled) return null; if (hideScore || !b.revealed) return `EM_ANDAMENTO(${w})`; return b.won ? `WON(${w})` : `LOST(${w})`; };
  return { hideScore, hideMyScore, hideAllScores, ida: badge(betFor(buildKnockoutMatchKey(m.id, 1)), 'ida'), volta: badge(betFor(buildKnockoutMatchKey(m.id, 2)), 'volta') };
}

// A RESOLVED tie, server says all watched + bets revealed. But the client just
// reconnected/refreshed → watchedKnockoutMatches (LOCAL) was reset to [].
describe('KO badge after reconnect/refresh (local watchedKnockoutMatches lost)', () => {
  const room: any = {
    code: 'ROOM', phase: 'knockout', hostId: 'me', difficulty: 'normal',
    botTeams: [], leagueFixtures: [], leagueStandings: [], leagueResults: [], leagueRound: 1,
    watchedRoundPlayers: [], watchedKnockoutLegPlayers: ['me'], readyPlayers: [], market: [],
    players: [{ id: 'me', name: 'Me', socketId: 'sock-me', connected: true, points: 700, bets: [
      { matchKey: 'Kt:1', homeGoals: 2, awayGoals: 0, stake: 40, settled: true, revealed: true, won: true, tier: 'exact', payout: 100 },
      { matchKey: 'Kt:2', homeGoals: 1, awayGoals: 1, stake: 20, settled: true, revealed: true, won: true, tier: 'exact', payout: 50 },
    ], team: { id: 'me', name: 'Me', players: [] } }],
    knockoutBracket: {
      playoffs: [{ id: 't', homeTeamId: 'me', awayTeamId: 'bot_x', played: true,
        leg1: { homeGoals: 2, awayGoals: 0 }, leg2: { homeGoals: 1, awayGoals: 1 },
        result: { homeGoals: 3, awayGoals: 1, winner: 'me' } }],
      round16: [], quarterFinals: [], semiFinals: [], final: null, currentRound: 'playoffs', currentLeg: 2,
    },
  };

  it('LEAGUE-style server-synced gate would show; knockout local gate hides', () => {
    // Fresh client (simulate refresh) → INIT_ONLINE then SET_ONLINE_STATE.
    let cs: any = gameReducer({} as any, { type: 'INIT_ONLINE', socketId: 'sock-me', roomCode: 'ROOM', isHost: true } as any);
    cs.watchedKnockoutMatches = []; // reset by refresh/initialState
    cs = gameReducer(cs, { type: 'SET_ONLINE_STATE', roomState: JSON.parse(JSON.stringify(room)), socketId: 'sock-me' } as any);
    const r = evalBadge(cs);
    console.log('AFTER REFRESH:', JSON.stringify(r), 'watchedLocal=', cs.watchedKnockoutMatches, 'onlineWatched=', cs.onlineWatchedPlayers);
    // The bug: bets are revealed server-side, everyone watched, but badge is hidden.
    expect(r.ida).toBe('WON(ida)'); // <-- will FAIL if the local-only gate pins it
  });
});
