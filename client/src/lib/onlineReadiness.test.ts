import { describe, expect, it } from 'vitest';
import { getOnlineKnockoutParticipantIds, getOnlineLeagueParticipantIds, getReadinessStatus } from './onlineReadiness';

const team = {};

describe('online readiness participants', () => {
  it('excludes byes and disconnected players from a league round', () => {
    const players = [
      { id: 'a', connected: true, team },
      { id: 'b', connected: true, team },
      { id: 'c', connected: false, team },
    ];
    const fixtures = [
      { round: 1, homeTeamId: 'a', awayTeamId: 'bot' },
      { round: 1, homeTeamId: 'bot2', awayTeamId: 'c' },
    ];

    expect(getOnlineLeagueParticipantIds(players, fixtures, 1)).toEqual(['a']);
  });

  it('includes only connected humans in active knockout ties', () => {
    const players = [
      { id: 'a', connected: true, team },
      { id: 'b', connected: true, team },
      { id: 'direct', connected: true, team },
      { id: 'offline', connected: false, team },
    ];

    expect(getOnlineKnockoutParticipantIds(players, [
      { homeTeamId: 'a', awayTeamId: 'bot' },
      { homeTeamId: 'b', awayTeamId: 'offline' },
    ])).toEqual(['a', 'b']);
  });

  it('counts only active participants even if stale ready ids are present', () => {
    expect(getReadinessStatus(['a', 'direct', 'offline'], ['a', 'b'])).toEqual({
      readyCount: 1,
      total: 2,
      allReady: false,
    });
    expect(getReadinessStatus([], [])).toEqual({ readyCount: 0, total: 0, allReady: true });
  });
});

