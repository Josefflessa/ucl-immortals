import { describe, it, expect } from 'vitest';
import { gameReducer } from './GameContext';
import { initialState } from './game/state';

/**
 * The replay auto-opens only while the local watch markers say the current
 * round/leg was not watched yet. A marker taken from a PREVIOUS round/leg (or
 * from another room) must never pre-mark the next one, otherwise "jogar rodada"
 * skips straight to the post-match modals and the room waits forever.
 */
const me = { id: 'player_0', name: 'Me', socketId: 'sock-me', connected: true, points: 0, bets: [], team: { id: 'player_0', name: 'Me', players: [] } };
const rival = { id: 'player_1', name: 'Rival', socketId: 'sock-rival', connected: true, points: 0, bets: [], team: { id: 'player_1', name: 'Rival', players: [] } };

function leagueRoom(overrides: Record<string, unknown>) {
  return {
    code: 'ROOM', phase: 'league', hostId: 'player_0', difficulty: 'immortal',
    botTeams: [], leagueStandings: [], leagueRound: 1,
    leagueFixtures: [
      { round: 1, homeTeamId: 'player_0', awayTeamId: 'player_1', played: true, result: { homeGoals: 1, awayGoals: 0 } },
      { round: 2, homeTeamId: 'player_1', awayTeamId: 'player_0', played: false },
    ],
    watchedRoundPlayers: [], watchedKnockoutLegPlayers: [], readyPlayers: [], market: [],
    players: [me, rival],
    ...overrides,
  };
}

function sync(state: any, room: any) {
  return gameReducer(state, { type: 'SET_ONLINE_STATE', roomState: JSON.parse(JSON.stringify(room)), socketId: 'sock-me' } as any);
}

function online() {
  return gameReducer({ ...initialState } as any, { type: 'INIT_ONLINE', socketId: 'sock-me', roomCode: 'ROOM', isHost: true } as any);
}

describe('online watch gate', () => {
  it('a watched league round does not pre-mark the next round', () => {
    let s = online();
    // Round 1 played and watched by both players.
    s = sync(s, leagueRoom({ leagueRound: 1, watchedLeagueRound: 1, watchedRoundPlayers: ['player_0', 'player_1'] }));
    expect(s.lastWatchedRound).toBe(1);
    // Host advances: round 2 not played yet, server list still holds round 1 viewers.
    s = sync(s, leagueRoom({ leagueRound: 2, watchedLeagueRound: 1, watchedRoundPlayers: ['player_0', 'player_1'] }));
    expect(s.lastWatchedRound).toBe(1);
  });

  it('a watched knockout leg from the previous round does not pre-mark the next round', () => {
    let s = online();
    const bracket = {
      playoffs: [], quarterFinals: [], semiFinals: [], final: null,
      round16: [{ id: 'r16_0', homeTeamId: 'player_0', awayTeamId: 'bot_a', played: false }],
      currentRound: 'round16', currentLeg: 1,
    };
    s = sync(s, leagueRoom({
      phase: 'knockout', knockoutBracket: bracket,
      watchedKnockoutLegPlayers: ['player_0'], watchedKnockoutLegKey: { round: 'playoffs', leg: 2 },
    }));
    expect(s.watchedKnockoutMatches).not.toContain('r16_0_l2');
  });

  it('entering another room clears the previous watch markers', () => {
    let s: any = { ...online(), lastWatchedRound: 6, watchedKnockoutMatches: ['r16_0_l1'], matchCreditsModalPending: true };
    s = gameReducer(s, { type: 'INIT_ONLINE', socketId: 'sock-me', roomCode: 'OTHER', isHost: true } as any);
    expect(s.lastWatchedRound).toBe(0);
    expect(s.watchedKnockoutMatches).toEqual([]);
    expect(s.matchCreditsModalPending).toBe(false);
  });
});
