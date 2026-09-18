import { describe, expect, it } from 'vitest';
import { getOnlineKnockoutParticipantIds, getOnlineLeagueParticipantIds, getReadinessStatus, isOnlineHumanMatch, knockoutLegWasPlayed, sortMatchesForOnlineDisplay } from './onlineReadiness';

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

  it('accepts the watched first leg after the bracket pointer moves to the return leg', () => {
    const tie = {
      homeTeamId: 'a',
      awayTeamId: 'bot',
      leg1: { homeGoals: 1, awayGoals: 0 },
      isSingleLeg: false,
    };

    expect(knockoutLegWasPlayed(tie, 'playoffs', 2, 1)).toBe(true);
    expect(knockoutLegWasPlayed(tie, 'playoffs', 2)).toBe(true);
    expect(knockoutLegWasPlayed(tie, 'playoffs', 2, 2)).toBe(false);
  });

  it('handles the completed return leg and single-leg final correctly', () => {
    expect(knockoutLegWasPlayed({ leg1: {}, leg2: {}, isSingleLeg: false }, 'round16', 2, 2)).toBe(true);
    expect(knockoutLegWasPlayed({ played: true, result: {} }, 'final', 1)).toBe(true);
  });

  it('puts the local and other human matches before bot-only matches, stably', () => {
    const matches = [
      { id: 'bot-a', homeTeamId: 'bot-1', awayTeamId: 'bot-2' },
      { id: 'other-human', homeTeamId: 'human-b', awayTeamId: 'bot-3' },
      { id: 'local', homeTeamId: 'local', awayTeamId: 'bot-4' },
      { id: 'bot-b', homeTeamId: 'bot-5', awayTeamId: 'bot-6' },
      { id: 'human-v-human', homeTeamId: 'human-c', awayTeamId: 'human-d' },
    ];

    expect(sortMatchesForOnlineDisplay(matches, new Set(['local', 'human-b', 'human-c', 'human-d']), 'local').map(match => match.id))
      .toEqual(['local', 'other-human', 'human-v-human', 'bot-a', 'bot-b']);
    expect(isOnlineHumanMatch(matches[1], new Set(['human-b']))).toBe(true);
    expect(isOnlineHumanMatch(matches[0], new Set(['human-b']))).toBe(false);
  });
});
