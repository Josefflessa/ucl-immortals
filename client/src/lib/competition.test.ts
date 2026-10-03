import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMPETITION_FORMAT,
  COMPETITION_FORMAT_PRESETS,
  MAX_POINTS_PER_RULE,
  MAX_REINFORCEMENT_OPTIONS,
  MIN_REINFORCEMENT_OPTIONS,
  competitionFormatSummary,
  normalizeCompetitionFormat,
  validateCompetitionFormat,
} from './competition';

// League + knockout format with only the league length / qualifiers changed.
const leagueKnockout = (leagueRounds: number, qualifiedTeams: number) => ({
  ...DEFAULT_COMPETITION_FORMAT,
  leagueRounds,
  qualifiedTeams,
  rewards: { ...DEFAULT_COMPETITION_FORMAT.rewards, reinforcementUntilRound: Math.max(1, Math.floor(leagueRounds)) },
});

describe('competition format validation', () => {
  it('accepts the default format and free valid integer values', () => {
    expect(validateCompetitionFormat(DEFAULT_COMPETITION_FORMAT)).toBeNull();
    expect(validateCompetitionFormat(leagueKnockout(3, 19))).toBeNull();
    expect(validateCompetitionFormat(leagueKnockout(35, 16))).toBeNull();
  });

  it('rejects fractions, missing values and formats that cannot feed the 16-team knockout', () => {
    expect(validateCompetitionFormat(leagueKnockout(3.5, 20))).not.toBeNull();
    expect(validateCompetitionFormat(leagueKnockout(0, 20))).not.toBeNull();
    expect(validateCompetitionFormat(leagueKnockout(36, 20))).not.toBeNull();
    expect(validateCompetitionFormat(leagueKnockout(8, 15))).not.toBeNull();
    expect(validateCompetitionFormat(leagueKnockout(8, 25))).not.toBeNull();
    expect(validateCompetitionFormat({ leagueRounds: 5, qualifiedTeams: 20 })).not.toBeNull();
  });

  it('exposes valid presets', () => {
    for (const preset of Object.values(COMPETITION_FORMAT_PRESETS)) {
      expect(validateCompetitionFormat(preset.format)).toBeNull();
      expect(competitionFormatSummary(preset.format)).toBeTruthy();
    }
    expect(COMPETITION_FORMAT_PRESETS.league.format.leagueLegs).toBe(2);
    expect(COMPETITION_FORMAT_PRESETS.league.format.leagueRounds).toBe(38);
    expect(competitionFormatSummary(COMPETITION_FORMAT_PRESETS.league.format)).toContain('ida e volta');
    expect(COMPETITION_FORMAT_PRESETS.league_knockout.format.rewards.reinforcement).toBe('round_and_stage');
    expect(COMPETITION_FORMAT_PRESETS.groups_knockout.format.rewards.reinforcement).toBe('round_and_stage');
    expect(COMPETITION_FORMAT_PRESETS.knockout.format.rewards.reinforcement).toBe('stage');
  });

  it('keeps points league rounds tied to the selected leg format', () => {
    const league = normalizeCompetitionFormat(COMPETITION_FORMAT_PRESETS.league.format);
    expect(league.leagueRounds).toBe(38);
    expect(validateCompetitionFormat(league)).toBeNull();

    league.leagueLegs = 1;
    league.leagueRounds = 19;
    league.rewards.reinforcementUntilRound = 19;
    expect(validateCompetitionFormat(league)).toBeNull();

    league.leagueLegs = 2;
    league.leagueRounds = 19;
    expect(validateCompetitionFormat(league)).toContain('exatamente 38');
  });

  it('keeps reward rules fixed to the selected preset', () => {
    const preset = COMPETITION_FORMAT_PRESETS.league_knockout.format;
    const customized = {
      ...preset,
      rewards: {
        ...preset.rewards,
        reinforcement: 'off' as const,
        pointsEnabled: false,
        points: { ...preset.rewards.points, win: 0 },
      },
    };

    const normalized = normalizeCompetitionFormat(customized);
    expect(normalized.rewards).toEqual(preset.rewards);
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
