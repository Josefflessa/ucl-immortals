// Competition format shared by solo mode, the online client and the authoritative server.
//
// The league has 36 teams. A team can therefore play at most 35 different league
// opponents once before the knockout stage. The knockout path always resolves to a
// 16-team Round of 16: the configured qualified teams are split into direct places
// and playoff places when necessary.

export const COMPETITION_TEAM_COUNT = 36;
export const MIN_LEAGUE_ROUNDS = 1;
export const MAX_LEAGUE_ROUNDS = COMPETITION_TEAM_COUNT - 1;
export const MIN_QUALIFIED_TEAMS = 16;
export const MAX_QUALIFIED_TEAMS = 24;

export interface CompetitionFormat {
  leagueRounds: number;
  qualifiedTeams: number;
}

export const DEFAULT_COMPETITION_FORMAT: CompetitionFormat = {
  leagueRounds: 8,
  qualifiedTeams: 24,
};

/** Returns a user-facing validation message, or null when the format is valid. */
export function validateCompetitionFormat(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return 'Defina o formato da competição.';
  }

  const format = value as Partial<CompetitionFormat>;
  if (!Number.isInteger(format.leagueRounds)) {
    return 'O número de rodadas deve ser um número inteiro.';
  }
  if (format.leagueRounds! < MIN_LEAGUE_ROUNDS || format.leagueRounds! > MAX_LEAGUE_ROUNDS) {
    return `O número de rodadas deve ficar entre ${MIN_LEAGUE_ROUNDS} e ${MAX_LEAGUE_ROUNDS}.`;
  }
  if (!Number.isInteger(format.qualifiedTeams)) {
    return 'O número de classificados deve ser um número inteiro.';
  }
  if (format.qualifiedTeams! < MIN_QUALIFIED_TEAMS || format.qualifiedTeams! > MAX_QUALIFIED_TEAMS) {
    return `O número de classificados deve ficar entre ${MIN_QUALIFIED_TEAMS} e ${MAX_QUALIFIED_TEAMS}.`;
  }

  return null;
}

/** Safe boundary for old saves/rooms and defensive calls from the game engine. */
export function normalizeCompetitionFormat(value: unknown): CompetitionFormat {
  return validateCompetitionFormat(value) === null
    ? { ...(value as CompetitionFormat) }
    : { ...DEFAULT_COMPETITION_FORMAT };
}

export function directQualifiersFor(format: CompetitionFormat): number {
  return 32 - format.qualifiedTeams;
}

export function playoffTeamsFor(format: CompetitionFormat): number {
  return Math.max(0, format.qualifiedTeams - 16);
}

export function competitionFormatSummary(format: CompetitionFormat): string {
  const direct = directQualifiersFor(format);
  const playoffs = playoffTeamsFor(format);
  return playoffs > 0
    ? `${format.leagueRounds} rodadas · ${format.qualifiedTeams} classificados · ${direct} diretos + ${playoffs * 2} no playoff (${playoffs} ${playoffs === 1 ? 'confronto' : 'confrontos'})`
    : `${format.leagueRounds} rodadas · ${format.qualifiedTeams} classificados direto às oitavas`;
}
