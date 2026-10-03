import { describe, expect, it } from 'vitest';
import { COMPETITION_RANKING_POINTS, competitionRankingPoints } from './competitionRanking';

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
