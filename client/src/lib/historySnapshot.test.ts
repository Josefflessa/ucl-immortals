import { describe, expect, it } from 'vitest';
import { getCompetitionHistorySnapshot } from './historySnapshot';

const validReport = {
  historySnapshot: {
    version: 1,
    playerTeam: {
      id: 'team-1',
      name: 'Clube',
      coachId: 'coach-1',
      formationId: '4-3-3',
      playStyle: 'balanced',
      players: Array.from({ length: 11 }, (_, index) => ({
        id: `player-${index}`,
        shortName: `Jogador ${index}`,
        position: 'CM',
        overall: 80,
        rarity: 'gold',
      })),
    },
    matches: [{ homeTeamId: 'team-1', awayTeamId: 'team-2', homeGoals: 2, awayGoals: 1, winner: 'team-1' }],
    championId: 'team-1',
    championName: 'Clube',
    formatId: 'league_knockout',
    finalResult: null,
    playStyle: 'balanced',
    report: { historicalRecreations: [] },
    leaders: { topScorer: null, topRating: null, topAssister: null },
  },
} satisfies Record<string, unknown>;

describe('competition history snapshots', () => {
  it('accepts a complete snapshot for the archived end-of-season report', () => {
    expect(getCompetitionHistorySnapshot(validReport)?.playerTeam.id).toBe('team-1');
  });

  it('rejects legacy or incomplete history data instead of rendering it as a full report', () => {
    expect(getCompetitionHistorySnapshot({})).toBeNull();
    expect(getCompetitionHistorySnapshot({ historySnapshot: { ...validReport.historySnapshot, version: 2 } })).toBeNull();
    expect(getCompetitionHistorySnapshot({ historySnapshot: { ...validReport.historySnapshot, matches: [{ winner: 'team-1' }] } })).toBeNull();
  });
});
