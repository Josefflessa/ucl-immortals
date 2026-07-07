import { describe, it, expect } from 'vitest';
import { settleBet, buildKnockoutMatchKey } from '../lib/bets';
import { getActiveKnockoutMatches } from '../lib/gameEngine';

// ---- verbatim copies of the server functions (server/handlers.ts) ----
function knockoutWatchStatus(room: any): { allWatched: boolean; waiting: string[] } {
  const bracket = room.knockoutBracket;
  if (!bracket) return { allWatched: true, waiting: [] };
  const roundKey = bracket.currentRound === 'quarters' ? 'quarterFinals' : bracket.currentRound === 'semis' ? 'semiFinals' : bracket.currentRound;
  const currentMatches: any[] = bracket.currentRound === 'final'
    ? (bracket.final ? [bracket.final] : [])
    : (bracket as any)[roundKey] || [];
  const humanIdsInRound = room.players
    .filter((p: any) => p.connected && currentMatches.some((m: any) => m.homeTeamId === p.id || m.awayTeamId === p.id))
    .map((p: any) => p.id);
  const allWatched = humanIdsInRound.every((id: string) => room.watchedKnockoutLegPlayers.includes(id));
  const waiting = room.players
    .filter((p: any) => humanIdsInRound.includes(p.id) && !room.watchedKnockoutLegPlayers.includes(p.id))
    .map((p: any) => p.name);
  return { allWatched, waiting };
}

function creditKnockoutLegIfAllWatched(room: any): void {
  if (!room.knockoutBracket) return;
  if (!knockoutWatchStatus(room).allWatched) return;
  room.players.forEach((p: any) => {
    if (p.pendingMatchPoints != null) { p.points += p.pendingMatchPoints; p.pendingMatchPoints = undefined; }
    p.bets = p.bets.map((b: any) => {
      if (b.settled && !b.revealed && b.matchKey.startsWith('K')) {
        p.points += b.payout ?? 0;
        return { ...b, revealed: true };
      }
      return b;
    });
  });
}

// verbatim settle loop from play_knockout_round
function settleLeg(room: any, legPlayed: number) {
  const ties = getActiveKnockoutMatches(room.knockoutBracket) as any[];
  room.players.forEach((p: any) => {
    p.bets = p.bets.map((b: any) => {
      if (b.revealed || b.settled || !b.matchKey.startsWith('K')) return b;
      const [id, legStr] = b.matchKey.slice(1).split(':');
      if (Number(legStr) !== legPlayed) return b;
      const tie = ties.find((t: any) => t.id === id);
      const legRes = tie ? (legPlayed === 2 ? tie.leg2 : (tie.leg1 ?? tie.result)) : undefined;
      if (!legRes) return b;
      const r = settleBet(b, legRes);
      return { ...b, settled: true, won: r.won, tier: r.tier, payout: r.payout };
    });
  });
}

describe('online KO reveal (server logic repro)', () => {
  it('reveals ida after all watch ida, volta after all watch volta', () => {
    const room: any = {
      knockoutBracket: {
        playoffs: [{ id: 't', homeTeamId: 'me', awayTeamId: 'bot', played: false }],
        round16: [], quarterFinals: [], semiFinals: [], final: null,
        currentRound: 'playoffs', currentLeg: 1,
      },
      watchedKnockoutLegPlayers: [],
      players: [
        { id: 'me', name: 'Me', connected: true, points: 500, bets: [
          { matchKey: 'Kt:1', homeGoals: 2, awayGoals: 0, stake: 40 },
          { matchKey: 'Kt:2', homeGoals: 1, awayGoals: 1, stake: 20 },
        ] },
      ],
    };

    // ---- IDA ----
    const legPlayedIda = room.knockoutBracket.currentLeg; // 1
    room.knockoutBracket.playoffs[0].leg1 = { homeTeamId: 'me', awayTeamId: 'bot', homeGoals: 2, awayGoals: 0, events: [] };
    room.knockoutBracket.currentLeg = 2; // playActiveKnockoutLeg bump
    room.watchedKnockoutLegPlayers = [];
    settleLeg(room, legPlayedIda);
    console.log('after settle ida:', JSON.stringify(room.players[0].bets));

    // player watches ida
    room.watchedKnockoutLegPlayers.push('me');
    creditKnockoutLegIfAllWatched(room);
    const idaBet1 = room.players[0].bets.find((b: any) => b.matchKey === 'Kt:1');
    console.log('ida bet after watch:', JSON.stringify(idaBet1), 'watchStatus=', knockoutWatchStatus(room));
    expect(idaBet1.settled).toBe(true);
    expect(idaBet1.revealed).toBe(true);

    // ---- VOLTA ----
    const legPlayedVolta = room.knockoutBracket.currentLeg; // 2
    room.knockoutBracket.playoffs[0].leg2 = { homeTeamId: 'bot', awayTeamId: 'me', homeGoals: 1, awayGoals: 1, events: [] };
    room.knockoutBracket.playoffs[0].result = { homeTeamId: 'me', awayTeamId: 'bot', homeGoals: 3, awayGoals: 1, winner: 'me', events: [] };
    room.knockoutBracket.playoffs[0].played = true;
    room.watchedKnockoutLegPlayers = [];
    settleLeg(room, legPlayedVolta);
    console.log('after settle volta:', JSON.stringify(room.players[0].bets));

    room.watchedKnockoutLegPlayers.push('me');
    creditKnockoutLegIfAllWatched(room);
    const voltaBet = room.players[0].bets.find((b: any) => b.matchKey === 'Kt:2');
    console.log('volta bet after watch:', JSON.stringify(voltaBet));
    expect(voltaBet.settled).toBe(true);
    expect(voltaBet.revealed).toBe(true);
  });
});
