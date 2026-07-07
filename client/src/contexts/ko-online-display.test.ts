import { describe, it, expect } from 'vitest';
import { buildKnockoutMatchKey } from '../lib/bets';
import { getActiveKnockoutMatches } from '../lib/gameEngine';

// Faithful replica of KnockoutTiesTab display logic (online).
function evalTab(state: any) {
  const knockoutBracket = state.knockoutBracket;
  const matches = getActiveKnockoutMatches(knockoutBracket) as any[];
  const round = knockoutBracket.currentRound;
  const currentLeg = knockoutBracket.currentLeg;
  const isFinal = round === 'final';
  const allPlayed = matches.length > 0 && matches.every((m: any) => m.played);
  const idaPlayed = !isFinal && currentLeg === 2 && !allPlayed;

  const humanPlayersInBracket = state.onlinePlayers.filter((p: any) => p.connected && matches.some((m: any) => m.homeTeamId === p.id || m.awayTeamId === p.id));
  const allPlayersWatched = humanPlayersInBracket.length === 0 ||
    humanPlayersInBracket.every((p: any) => state.onlineWatchedPlayers.includes(p.id));

  const bets = state.bets ?? [];
  const betFor = (k: string) => bets.find((b: any) => b.matchKey === k);
  const isPlayerTeam = (teamId: string) => state.onlinePlayers.some((p: any) => p.id === teamId && p.socketId === state.socketId);

  const out: any[] = [];
  for (const match of matches) {
    const hasPlayer = isPlayerTeam(match.homeTeamId) || isPlayerTeam(match.awayTeamId);
    const twoLeg = !match.isSingleLeg && round !== 'final';
    const l1 = match.leg1, l2 = match.leg2;
    const watched = state.watchedKnockoutMatches;
    const hideMyScore = state.mode !== 'online' && hasPlayer && (
      twoLeg
        ? (!!l2 && !watched.includes(`${match.id}_l2`)) || (!!l1 && !watched.includes(`${match.id}_l1`))
        : (match.played && !!match.result && !watched.includes(match.id))
    );
    const hideAllScores = state.mode === 'online' && !allPlayersWatched && (allPlayed || idaPlayed);
    const hideScore = hideAllScores || hideMyScore;

    const badge = (b: any, word: string) => {
      if (!b || !b.settled) return null;
      if (hideScore || !b.revealed) return `EM_ANDAMENTO(${word})`;
      return b.won ? `WON(${word})` : `LOST(${word})`;
    };
    out.push({
      id: match.id, hideScore, allPlayersWatched, idaPlayed, allPlayed,
      ida: badge(betFor(buildKnockoutMatchKey(match.id, 1)), 'ida'),
      volta: badge(betFor(buildKnockoutMatchKey(match.id, 2)), 'volta'),
    });
  }
  return out;
}

describe('online KO display — resolved tie, everyone watched, before advance', () => {
  it('shows both badges', () => {
    const state = {
      mode: 'online',
      socketId: 'sock-me',
      watchedKnockoutMatches: ['t_l1', 't_l2'],
      onlineWatchedPlayers: ['me'], // server watchedKnockoutLegPlayers = all humans in round
      onlinePlayers: [{ id: 'me', socketId: 'sock-me', connected: true, team: { id: 'me' } }, { id: 'bot', socketId: null, team: { id: 'bot' } }],
      knockoutBracket: {
        playoffs: [{ id: 't', homeTeamId: 'me', awayTeamId: 'bot', played: true,
          leg1: { homeGoals: 2, awayGoals: 0 }, leg2: { homeGoals: 1, awayGoals: 1 },
          result: { homeGoals: 3, awayGoals: 1, winner: 'me' } }],
        round16: [], quarterFinals: [], semiFinals: [], final: null,
        currentRound: 'playoffs', currentLeg: 2,
      },
      bets: [
        { matchKey: 'Kt:1', homeGoals: 2, awayGoals: 0, stake: 40, settled: true, revealed: true, won: true, tier: 'exact', payout: 100 },
        { matchKey: 'Kt:2', homeGoals: 1, awayGoals: 1, stake: 20, settled: true, revealed: true, won: true, tier: 'exact', payout: 50 },
      ],
    };
    const r = evalTab(state);
    console.log('RESOLVED:', JSON.stringify(r));
    expect(r[0].ida).toBe('WON(ida)');
    expect(r[0].volta).toBe('WON(volta)');
  });

  it('BOT opponent: onlinePlayers has only humans → what if bracket teamId != player.id', () => {
    // Simulate a realistic online room where the tie is human-vs-bot and the human watched.
    const state = {
      mode: 'online',
      socketId: 'sock-me',
      watchedKnockoutMatches: ['t_l1', 't_l2'],
      onlineWatchedPlayers: ['me'],
      onlinePlayers: [{ id: 'me', socketId: 'sock-me', connected: true, team: { id: 'me' } }],
      knockoutBracket: {
        playoffs: [{ id: 't', homeTeamId: 'me', awayTeamId: 'bot_x', played: true,
          leg1: { homeGoals: 2, awayGoals: 0 }, leg2: { homeGoals: 1, awayGoals: 1 },
          result: { homeGoals: 3, awayGoals: 1, winner: 'me' } }],
        round16: [], quarterFinals: [], semiFinals: [], final: null,
        currentRound: 'playoffs', currentLeg: 2,
      },
      bets: [
        { matchKey: 'Kt:1', homeGoals: 2, awayGoals: 0, stake: 40, settled: true, revealed: true, won: true, tier: 'exact', payout: 100 },
        { matchKey: 'Kt:2', homeGoals: 1, awayGoals: 1, stake: 20, settled: true, revealed: true, won: true, tier: 'exact', payout: 50 },
      ],
    };
    const r = evalTab(state);
    console.log('BOT-OPP:', JSON.stringify(r));
    expect(r[0].ida).toBe('WON(ida)');
  });
});
