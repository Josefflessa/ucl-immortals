import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMPETITION_FORMAT,
  MAX_LEAGUE_ROUNDS,
  validateCompetitionFormat,
} from './competition';

describe('competition format validation', () => {
  it('accepts the default format and free valid integer values', () => {
    expect(validateCompetitionFormat(DEFAULT_COMPETITION_FORMAT)).toBeNull();
    expect(validateCompetitionFormat({ leagueRounds: 3, qualifiedTeams: 19 })).toBeNull();
    expect(validateCompetitionFormat({ leagueRounds: MAX_LEAGUE_ROUNDS, qualifiedTeams: 16 })).toBeNull();
  });

  it('rejects fractions, missing values and formats that cannot feed the 16-team knockout', () => {
    expect(validateCompetitionFormat({ leagueRounds: 3.5, qualifiedTeams: 20 })).not.toBeNull();
    expect(validateCompetitionFormat({ leagueRounds: 0, qualifiedTeams: 20 })).not.toBeNull();
    expect(validateCompetitionFormat({ leagueRounds: 36, qualifiedTeams: 20 })).not.toBeNull();
    expect(validateCompetitionFormat({ leagueRounds: 8, qualifiedTeams: 15 })).not.toBeNull();
    expect(validateCompetitionFormat({ leagueRounds: 8, qualifiedTeams: 25 })).not.toBeNull();
  });
});
