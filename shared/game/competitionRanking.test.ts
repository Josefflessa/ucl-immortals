import { describe, expect, it } from 'vitest';
import {
  COMPETITION_FINISH_STAGES,
  COMPETITION_RANKING_POINTS,
  competitionFinishStage,
  competitionRankingPoints,
  competitionStagePoints,
  finishStageFromLegacyPoints,
  RANKED_DIFFICULTY_IDS,
} from './competitionRanking';

function match(homeTeamId: string, awayTeamId: string, winner: string) {
  return { homeTeamId, awayTeamId, played: true, result: { winner } };
}

describe('competitionRankingPoints', () => {
  it('awards exactly one score for the final campaign finish', () => {
    const bracket = {
      round16: [match('team', 'rival', 'team')],
      quarterFinals: [match('team', 'rival', 'team')],
      semiFinals: [match('team', 'rival', 'team')],
      final: match('team', 'rival', 'team'),
    };

    expect(competitionRankingPoints('team', 'team', bracket)).toBe(COMPETITION_RANKING_POINTS.champion);
    expect(competitionRankingPoints('rival', 'team', { final: match('team', 'rival', 'team') })).toBe(COMPETITION_RANKING_POINTS.runnerUp);
  });

  it.each([
    ['semiFinals', 'semifinalist'],
    ['quarterFinals', 'quarterfinalist'],
    ['round16', 'roundOf16'],
    ['playoffs', 'playoff'],
  ] as const)('scores a team eliminated in %s', (stage, scoreKey) => {
    const points = COMPETITION_RANKING_POINTS[scoreKey];
    const bracket = { [stage]: [match('team', 'rival', 'rival')] };
    expect(competitionRankingPoints('team', 'champion', bracket)).toBe(points);
  });

  it('scores league-phase elimination and uses the furthest round reached', () => {
    expect(competitionRankingPoints('team', 'champion')).toBe(COMPETITION_RANKING_POINTS.leaguePhase);
    expect(competitionRankingPoints('team', 'champion', {
      round16: [match('team', 'rival', 'team')],
      semiFinals: [match('team', 'rival', 'rival')],
    })).toBe(COMPETITION_RANKING_POINTS.semifinalist);
  });
});

describe('points by difficulty', () => {
  it('matches the published table (stage x weight, rounded half up, at least 1)', () => {
    const table = Object.fromEntries(RANKED_DIFFICULTY_IDS.map(id => [id, COMPETITION_FINISH_STAGES.map(stage => competitionStagePoints(stage, id))]));
    expect(table).toEqual({
      bronze: [10, 8, 6, 4, 3, 2, 1],
      silver: [25, 20, 15, 10, 6, 4, 1],
      gold: [45, 36, 27, 18, 11, 7, 2],
      legendary: [70, 56, 42, 28, 18, 11, 4],
      immortal: [100, 80, 60, 40, 25, 15, 5],
    });
  });

  it('never makes an easier difficulty worth more for the same stage', () => {
    for (const stage of COMPETITION_FINISH_STAGES) {
      const points = RANKED_DIFFICULTY_IDS.map(id => competitionStagePoints(stage, id));
      expect([...points].sort((a, b) => a - b)).toEqual(points);
    }
    // A Bronze title is worth less than a quarter-final on Imortal.
    expect(competitionStagePoints('champion', 'bronze')).toBeLessThan(competitionStagePoints('quarterfinalist', 'immortal'));
  });

  it('keeps Imortal identical to the previous table and scores through the stage', () => {
    for (const stage of COMPETITION_FINISH_STAGES) expect(competitionStagePoints(stage, 'immortal')).toBe(COMPETITION_RANKING_POINTS[stage]);
    expect(competitionFinishStage('team', 'team')).toBe('champion');
    expect(competitionRankingPoints('team', 'team', null, 'gold')).toBe(45);
  });

  it('recovers the stage of campaigns saved with the full table', () => {
    expect(finishStageFromLegacyPoints(60)).toBe('semifinalist');
    expect(finishStageFromLegacyPoints(0, 1)).toBe('champion');
    expect(finishStageFromLegacyPoints(0)).toBeNull();
    expect(finishStageFromLegacyPoints(33)).toBeNull();
  });
});
