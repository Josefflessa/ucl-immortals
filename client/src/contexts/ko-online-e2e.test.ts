import { describe, it, expect } from 'vitest';
import { gameReducer } from './GameContext';
import { settleBet, buildKnockoutMatchKey } from '../lib/bets';
import { getActiveKnockoutMatches } from '../lib/gameEngine';

// ---- server functions (verbatim) ----
function knockoutWatchStatus(room: any) {
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
  return { allWatched, waiting: [] };
}
function creditKnockoutLegIfAllWatched(room: any) {
  if (!room.knockoutBracket) return;
  if (!knockoutWatchStatus(room).allWatched) return;
  room.players.forEach((p: any) => {
    if (p.pendingMatchPoints != null) { p.points += p.pendingMatchPoints; p.pendingMatchPoints = undefined; }
    p.bets = p.bets.map((b: any) => {
      if (b.settled && !b.revealed && b.matchKey.startsWith('K')) { p.points += b.payout ?? 0; return { ...b, revealed: true }; }
      return b;
    });
  });
}
function serverSettleLeg(room: any, legPlayed: number) {
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

// ---- client display replica (KnockoutTiesTab) ----
function evalBadge(state: any) {
  const kb = state.knockoutBracket;
  const matches = getActiveKnockoutMatches(kb) as any[];
  const round = kb.currentRound, currentLeg = kb.currentLeg;
  const isFinal = round === 'final';
  const allPlayed = matches.length > 0 && matches.every((m: any) => m.played);
  const idaPlayed = !isFinal && currentLeg === 2 && !allPlayed;
  const humanPlayersInBracket = state.onlinePlayers.filter((p: any) => matches.some((m: any) => m.homeTeamId === p.id || m.awayTeamId === p.id));
  const allPlayersWatched = humanPlayersInBracket.length === 0 || humanPlayersInBracket.every((p: any) => state.onlineWatchedPlayers.includes(p.id));
  const bets = state.bets ?? [];
  const betFor = (k: string) => bets.find((b: any) => b.matchKey === k);
  const isPlayerTeam = (id: string) => state.onlinePlayers.some((p: any) => p.id === id && p.socketId === state.socketId);
  const m = matches[0];
  const hasPlayer = isPlayerTeam(m.homeTeamId) || isPlayerTeam(m.awayTeamId);
  const twoLeg = !m.isSingleLeg && round !== 'final';
  const l1 = m.leg1, l2 = m.leg2, watched = state.watchedKnockoutMatches;
  const hideMyScore = hasPlayer && (twoLeg
    ? (!!l2 && !watched.includes(`${m.id}_l2`)) || (!!l1 && !watched.includes(`${m.id}_l1`))
    : (m.played && !!m.result && !watched.includes(m.id)));
  const hideAllScores = state.mode === 'online' && !allPlayersWatched && (allPlayed || idaPlayed);
  const hideScore = hideAllScores || hideMyScore;
  const badge = (b: any, w: string) => { if (!b || !b.settled) return null; if (hideScore || !b.revealed) return `EM_ANDAMENTO(${w})`; return b.won ? `WON(${w})` : `LOST(${w})`; };
  return { hideScore, ida: badge(betFor(buildKnockoutMatchKey(m.id, 1)), 'ida'), volta: badge(betFor(buildKnockoutMatchKey(m.id, 2)), 'volta') };
}

// Simulate a broadcast: server room -> client SET_ONLINE_STATE.
function broadcast(clientState: any, room: any, socketId: string) {
  return gameReducer(clientState, { type: 'SET_ONLINE_STATE', roomState: JSON.parse(JSON.stringify(room)), socketId } as any);
}

describe('online KO end-to-end (1 human vs bot, real reducer + server logic)', () => {
  it('ida then volta reveal + display', () => {
    const SOCK = 'sock-me';
    const room: any = {
      code: 'ROOM', phase: 'knockout', hostId: 'me', difficulty: 'normal',
      botTeams: [], leagueFixtures: [], leagueStandings: [], leagueResults: [], leagueRound: 1,
      watchedRoundPlayers: [], watchedKnockoutLegPlayers: [], readyPlayers: [], market: [],
      players: [{ id: 'me', name: 'Me', socketId: SOCK, connected: true, points: 500, bets: [
        { matchKey: 'Kt:1', homeGoals: 2, awayGoals: 0, stake: 40 },
        { matchKey: 'Kt:2', homeGoals: 1, awayGoals: 1, stake: 20 },
      ], team: { id: 'me', name: 'Me', players: [] } }],
      knockoutBracket: {
        playoffs: [{ id: 't', homeTeamId: 'me', awayTeamId: 'bot_x', played: false }],
        round16: [], quarterFinals: [], semiFinals: [], final: null, currentRound: 'playoffs', currentLeg: 1,
      },
    };

    // client boots into online
    let cs: any = gameReducer({} as any, { type: 'INIT_ONLINE', socketId: SOCK, roomCode: 'ROOM', isHost: true } as any);
    cs.watchedKnockoutMatches = []; cs.leagueRound = 1;
    cs = broadcast(cs, room, SOCK);

    // ===== HOST PLAYS IDA =====
    const legIda = room.knockoutBracket.currentLeg; // 1
    room.knockoutBracket.playoffs[0].leg1 = { homeTeamId: 'me', awayTeamId: 'bot_x', homeGoals: 2, awayGoals: 0, events: [] };
    room.knockoutBracket.currentLeg = 2;
    room.watchedKnockoutLegPlayers = [];
    serverSettleLeg(room, legIda);
    cs = broadcast(cs, room, SOCK);

    // client auto-opens ida (WATCH) then finishes
    const teamA = { id: 'me', players: [] } as any, teamB = { id: 'bot_x', players: [] } as any;
    cs = gameReducer(cs, { type: 'WATCH_ONLINE_MATCH', teams: [teamA, teamB], result: room.knockoutBracket.playoffs[0].leg1, knockout: { matchId: 't', round: 'playoffs', leg: 1 } } as any);
    cs = gameReducer(cs, { type: 'FINISH_KNOCKOUT_MATCH', result: room.knockoutBracket.playoffs[0].leg1 } as any);
    // notify server (player_match_watched knockout)
    if (!room.watchedKnockoutLegPlayers.includes('me')) room.watchedKnockoutLegPlayers.push('me');
    creditKnockoutLegIfAllWatched(room);
    cs = broadcast(cs, room, SOCK);

    let r = evalBadge(cs);
    console.log('IDA WINDOW:', JSON.stringify(r), 'watchedLocal=', cs.watchedKnockoutMatches, 'onlineWatched=', cs.onlineWatchedPlayers, 'bets=', JSON.stringify(cs.bets));
    expect(r.ida).toBe('WON(ida)');

    // ===== HOST PLAYS VOLTA =====
    const legVolta = room.knockoutBracket.currentLeg; // 2
    room.knockoutBracket.playoffs[0].leg2 = { homeTeamId: 'bot_x', awayTeamId: 'me', homeGoals: 1, awayGoals: 1, events: [] };
    room.knockoutBracket.playoffs[0].result = { homeTeamId: 'me', awayTeamId: 'bot_x', homeGoals: 3, awayGoals: 1, winner: 'me', events: [] };
    room.knockoutBracket.playoffs[0].played = true;
    room.watchedKnockoutLegPlayers = [];
    serverSettleLeg(room, legVolta);
    cs = broadcast(cs, room, SOCK);

    cs = gameReducer(cs, { type: 'WATCH_ONLINE_MATCH', teams: [teamB, teamA], result: room.knockoutBracket.playoffs[0].leg2, knockout: { matchId: 't', round: 'playoffs', leg: 2 } } as any);
    cs = gameReducer(cs, { type: 'FINISH_KNOCKOUT_MATCH', result: room.knockoutBracket.playoffs[0].leg2 } as any);
    if (!room.watchedKnockoutLegPlayers.includes('me')) room.watchedKnockoutLegPlayers.push('me');
    creditKnockoutLegIfAllWatched(room);
    cs = broadcast(cs, room, SOCK);

    r = evalBadge(cs);
    console.log('VOLTA WINDOW:', JSON.stringify(r), 'watchedLocal=', cs.watchedKnockoutMatches, 'onlineWatched=', cs.onlineWatchedPlayers, 'bets=', JSON.stringify(cs.bets));
    expect(r.ida).toBe('WON(ida)');
    expect(r.volta).toBe('WON(volta)');
  });
});
