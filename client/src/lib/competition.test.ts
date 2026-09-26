import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMPETITION_FORMAT,
  COMPETITION_FORMAT_PRESETS,
  MAX_POINTS_PER_RULE,
  MAX_REINFORCEMENT_OPTIONS,
  MIN_REINFORCEMENT_OPTIONS,
  MAX_LEAGUE_ROUNDS,
  competitionFormatSummary,
  normalizeCompetitionFormat,
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

  it('exposes valid presets and keeps legacy rooms compatible', () => {
    for (const preset of Object.values(COMPETITION_FORMAT_PRESETS)) {
      expect(validateCompetitionFormat(preset.format)).toBeNull();
      expect(competitionFormatSummary(preset.format)).toBeTruthy();
    }
    const legacy = normalizeCompetitionFormat({ leagueRounds: 5, qualifiedTeams: 20 });
    expect(legacy.id).toBe('league_knockout');
    expect(legacy.leagueRounds).toBe(5);
    expect(legacy.qualifiedTeams).toBe(20);
  });

  it('rejects values outside the safe limits and invalid phase relationships', () => {
    const format = normalizeCompetitionFormat(DEFAULT_COMPETITION_FORMAT);
    format.rewards.points.win = MAX_POINTS_PER_RULE + 1;
    expect(validateCompetitionFormat(format)).toContain(`0 e ${MAX_POINTS_PER_RULE}`);

    format.rewards.points.win = 100;
    format.rewards.reinforcementOptions = MIN_REINFORCEMENT_OPTIONS - 1;
    expect(validateCompetitionFormat(format)).toContain(`${MIN_REINFORCEMENT_OPTIONS} e ${MAX_REINFORCEMENT_OPTIONS}`);

    format.rewards.reinforcementOptions = 6;
    format.rewards.reinforcementUntilRound = format.leagueRounds + 1;
    expect(validateCompetitionFormat(format)).toContain('janela de recrutamento');

    const incomplete = { ...format, rewards: undefined };
    expect(validateCompetitionFormat(incomplete)).toBe('Defina as recompensas da competição.');
  });

  it('requires enough teams for the league plus knockout preset', () => {
    const format = normalizeCompetitionFormat(COMPETITION_FORMAT_PRESETS.league_knockout.format);
    format.teamCount = 12;
    expect(validateCompetitionFormat(format)).toContain('pelo menos 16 times');
  });

  it('only allows reward timings that the selected format can actually execute', () => {
    const league = normalizeCompetitionFormat(COMPETITION_FORMAT_PRESETS.league.format);
    league.rewards.reinforcement = 'stage';
    expect(validateCompetitionFormat(league)).toContain('por rodada');

    const knockout = normalizeCompetitionFormat(COMPETITION_FORMAT_PRESETS.knockout.format);
    knockout.rewards.reinforcement = 'round';
    expect(validateCompetitionFormat(knockout)).toContain('por fase');
  });
});
