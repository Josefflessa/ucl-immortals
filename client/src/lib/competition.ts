// Competition formats shared by solo mode, online rooms and the server.
//
// The old game only had one format (league + knockout) and persisted two
// fields: leagueRounds and qualifiedTeams. Those fields intentionally remain
// part of the public shape so old rooms/saves keep working.

export const COMPETITION_TEAM_COUNT = 36;
export const MAX_BOT_TEAMS = COMPETITION_TEAM_COUNT - 1;
export const MAX_ONLINE_PLAYERS = 8;
export const MIN_COMPETITION_TEAMS = 4;
export const MAX_COMPETITION_TEAMS = COMPETITION_TEAM_COUNT;
export const MIN_LEAGUE_ROUNDS = 1;
export const MAX_LEAGUE_ROUNDS = COMPETITION_TEAM_COUNT - 1;
export const MIN_QUALIFIED_TEAMS = 16;
export const MAX_QUALIFIED_TEAMS = 24;
export const MIN_REINFORCEMENT_OPTIONS = 3;
export const MAX_REINFORCEMENT_OPTIONS = 6;
export const MAX_POINTS_PER_RULE = 1000;
// The betting bank is a game rule, not a tournament customization.
export const FIXED_BET_ROUND_CAP = 200;
// Kept exported for old imports and saved-format compatibility.
export const MIN_BET_ROUND_CAP = 0;
export const MAX_BET_ROUND_CAP = 10000;

export type CompetitionFormatId = 'league' | 'league_knockout' | 'groups_knockout' | 'knockout';
export type ReinforcementMode = 'off' | 'round' | 'stage';

export interface CompetitionMatchSettings {
  injuriesEnabled: boolean;
  cardsEnabled: boolean;
  betRoundCap: number;
}

export const DEFAULT_MATCH_SETTINGS: CompetitionMatchSettings = {
  injuriesEnabled: true,
  cardsEnabled: true,
  betRoundCap: FIXED_BET_ROUND_CAP,
};

/** Credits awarded to the player's shop balance after a completed match. */
export interface CompetitionPointsConfig {
  win: number;
  draw: number;
  loss: number;
  goalDifference: number;
  goal: number;
  cleanSheet: number;
}

export interface CompetitionRewardsConfig {
  reinforcement: ReinforcementMode;
  reinforcementUntilRound: number | null;
  reinforcementOptions: number;
  pointsEnabled: boolean;
  knockoutPointsEnabled: boolean;
  points: CompetitionPointsConfig;
}

export interface CompetitionFormat {
  id: CompetitionFormatId;
  teamCount: number;
  // Legacy-compatible league settings.
  leagueRounds: number;
  qualifiedTeams: number;
  // Group settings. They are zero when the selected preset does not use groups.
  groupCount: number;
  teamsPerGroup: number;
  groupRounds: number;
  qualifiedPerGroup: number;
  knockoutLegs: 1 | 2;
  finalSingleLeg: boolean;
  matchSettings: CompetitionMatchSettings;
  rewards: CompetitionRewardsConfig;
}

export interface CompetitionFormatPreset {
  id: CompetitionFormatId;
  name: string;
  shortDescription: string;
  description: string;
  icon: string;
  format: CompetitionFormat;
}

export const DEFAULT_POINTS_CONFIG: CompetitionPointsConfig = {
  // Valores atuais: vitória/empate/derrota + saldo positivo + gols + SG.
  win: 100,
  draw: 45,
  loss: 15,
  goalDifference: 12,
  goal: 3,
  cleanSheet: 20,
};

export const DEFAULT_REWARDS_CONFIG: CompetitionRewardsConfig = {
  reinforcement: 'round',
  reinforcementUntilRound: 8,
  reinforcementOptions: 6,
  pointsEnabled: true,
  knockoutPointsEnabled: true,
  points: { ...DEFAULT_POINTS_CONFIG },
};

const LEAGUE_DEFAULT: CompetitionFormat = {
  id: 'league',
  teamCount: 20,
  leagueRounds: 19,
  qualifiedTeams: 0,
  groupCount: 0,
  teamsPerGroup: 0,
  groupRounds: 0,
  qualifiedPerGroup: 0,
  knockoutLegs: 1,
  finalSingleLeg: true,
  matchSettings: { ...DEFAULT_MATCH_SETTINGS },
  rewards: { ...DEFAULT_REWARDS_CONFIG, reinforcementUntilRound: 19, knockoutPointsEnabled: false },
};

const LEAGUE_KNOCKOUT_DEFAULT: CompetitionFormat = {
  id: 'league_knockout',
  teamCount: COMPETITION_TEAM_COUNT,
  leagueRounds: 8,
  qualifiedTeams: 24,
  groupCount: 0,
  teamsPerGroup: 0,
  groupRounds: 0,
  qualifiedPerGroup: 0,
  knockoutLegs: 2,
  finalSingleLeg: true,
  matchSettings: { ...DEFAULT_MATCH_SETTINGS },
  rewards: { ...DEFAULT_REWARDS_CONFIG },
};

const GROUPS_KNOCKOUT_DEFAULT: CompetitionFormat = {
  id: 'groups_knockout',
  teamCount: 32,
  leagueRounds: 3,
  qualifiedTeams: 16,
  groupCount: 8,
  teamsPerGroup: 4,
  groupRounds: 3,
  qualifiedPerGroup: 2,
  knockoutLegs: 2,
  finalSingleLeg: true,
  matchSettings: { ...DEFAULT_MATCH_SETTINGS },
  rewards: { ...DEFAULT_REWARDS_CONFIG, reinforcementUntilRound: 3 },
};

const KNOCKOUT_DEFAULT: CompetitionFormat = {
  id: 'knockout',
  teamCount: 16,
  leagueRounds: 0,
  qualifiedTeams: 16,
  groupCount: 0,
  teamsPerGroup: 0,
  groupRounds: 0,
  qualifiedPerGroup: 0,
  knockoutLegs: 1,
  finalSingleLeg: true,
  matchSettings: { ...DEFAULT_MATCH_SETTINGS },
  rewards: { ...DEFAULT_REWARDS_CONFIG, reinforcement: 'off', reinforcementUntilRound: null },
};

export const DEFAULT_COMPETITION_FORMAT: CompetitionFormat = LEAGUE_KNOCKOUT_DEFAULT;

export const COMPETITION_FORMAT_PRESETS: Record<CompetitionFormatId, CompetitionFormatPreset> = {
  league: {
    id: 'league', name: 'Pontos corridos', shortDescription: 'Todos contra todos até a última rodada.',
    description: 'Uma liga completa, decidida pela tabela. Não existe mata-mata.', icon: '🏟️', format: LEAGUE_DEFAULT,
  },
  league_knockout: {
    id: 'league_knockout', name: 'Liga + mata-mata', shortDescription: 'A experiência atual do UCL Immortals.',
    description: 'Fase de liga, playoff quando necessário, oitavas, quartas, semis e final.', icon: '🏆', format: LEAGUE_KNOCKOUT_DEFAULT,
  },
  groups_knockout: {
    id: 'groups_knockout', name: 'Grupos + mata-mata', shortDescription: 'Grupos de quatro no estilo Copa do Mundo.',
    description: 'Times divididos em grupos, com classificados avançando para o mata-mata.', icon: '🌐', format: GROUPS_KNOCKOUT_DEFAULT,
  },
  knockout: {
    id: 'knockout', name: 'Mata-mata direto', shortDescription: 'Eliminação desde a primeira partida.',
    description: 'Sem tabela de liga: cada confronto vale a permanência no torneio.', icon: '⚔️', format: KNOCKOUT_DEFAULT,
  },
};

export function cloneCompetitionFormat(format: CompetitionFormat): CompetitionFormat {
  return {
    ...format,
    matchSettings: normalizeMatchSettings(format.matchSettings),
    rewards: { ...format.rewards, points: { ...format.rewards.points } },
  };
}

export function createCompetitionFormat(id: CompetitionFormatId): CompetitionFormat {
  return cloneCompetitionFormat(COMPETITION_FORMAT_PRESETS[id].format);
}

export function isCompetitionFormatId(value: unknown): value is CompetitionFormatId {
  return value === 'league' || value === 'league_knockout' || value === 'groups_knockout' || value === 'knockout';
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

function isPowerOfTwo(value: number): boolean {
  return value > 0 && (value & (value - 1)) === 0;
}

function validateRewards(rewards: unknown, maxReinforcementWindow: number): string | null {
  if (!rewards || typeof rewards !== 'object') return 'Defina as recompensas da competição.';
  const value = rewards as Partial<CompetitionRewardsConfig>;
  if (value.reinforcement !== 'off' && value.reinforcement !== 'round' && value.reinforcement !== 'stage') return 'Escolha quando as ofertas de recrutamento serão oferecidas.';
  if (!isInteger(value.reinforcementOptions) || value.reinforcementOptions < MIN_REINFORCEMENT_OPTIONS || value.reinforcementOptions > MAX_REINFORCEMENT_OPTIONS) return `As opções de recrutamento devem ficar entre ${MIN_REINFORCEMENT_OPTIONS} e ${MAX_REINFORCEMENT_OPTIONS}.`;
  if (value.reinforcement !== 'off' && value.reinforcementUntilRound !== null && (!isInteger(value.reinforcementUntilRound) || value.reinforcementUntilRound < 1 || value.reinforcementUntilRound > maxReinforcementWindow)) return `A janela de recrutamento deve ficar entre 1 e ${maxReinforcementWindow}.`;
  if (typeof value.pointsEnabled !== 'boolean' || typeof value.knockoutPointsEnabled !== 'boolean') return 'Defina se os créditos da loja estarão ativos nas fases.';
  if (!value.points || typeof value.points !== 'object') return 'Defina os créditos da partida.';
  for (const key of ['win', 'draw', 'loss', 'goalDifference', 'goal', 'cleanSheet'] as const) {
    if (!isInteger(value.points[key]) || value.points[key] < 0 || value.points[key] > MAX_POINTS_PER_RULE) return `Cada regra de créditos deve ficar entre 0 e ${MAX_POINTS_PER_RULE}.`;
  }
  return null;
}

/** Safe defaults keep rooms/saves created before match settings were introduced playable. */
export function normalizeMatchSettings(input: unknown): CompetitionMatchSettings {
  if (!input || typeof input !== 'object') return { ...DEFAULT_MATCH_SETTINGS };
  const value = input as Partial<CompetitionMatchSettings>;
  return {
    injuriesEnabled: value.injuriesEnabled !== false,
    cardsEnabled: value.cardsEnabled !== false,
    // Older rooms may still carry a custom value; normalize it to the fixed
    // game rule so the old setting cannot silently change the economy.
    betRoundCap: FIXED_BET_ROUND_CAP,
  };
}

/** Maximum useful value for the reinforcement window in the selected format. */
export function reinforcementWindowLimit(format: CompetitionFormat, mode?: ReinforcementMode): number {
  const effectiveMode = mode ?? format.rewards?.reinforcement ?? 'off';
  if (effectiveMode === 'round') {
    if (format.id === 'groups_knockout') return Math.max(1, format.groupRounds);
    if (format.id === 'league' || format.id === 'league_knockout') return Math.max(1, format.leagueRounds);
  }
  if (effectiveMode === 'stage') {
    if (format.id === 'knockout') return Math.max(1, Math.round(Math.log2(format.teamCount)) - 1);
    // The final does not offer a post-stage reinforcement. The useful
    // stages are therefore playoff, R16, QF and SF at most.
    if (format.id === 'league_knockout' || format.id === 'groups_knockout') return 4;
    return 1;
  }
  return 1;
}

/** Returns a user-facing validation message, or null when the format is valid. */
export function validateCompetitionFormat(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Defina o formato da competição.';

  // Rooms/saves from before the preset system only contain these two fields.
  if (!('id' in value)) {
    const legacy = value as { leagueRounds?: unknown; qualifiedTeams?: unknown };
    if (!isInteger(legacy.leagueRounds)) return 'O número de rodadas deve ser um número inteiro.';
    if (legacy.leagueRounds < MIN_LEAGUE_ROUNDS || legacy.leagueRounds > MAX_LEAGUE_ROUNDS) return `O número de rodadas deve ficar entre ${MIN_LEAGUE_ROUNDS} e ${MAX_LEAGUE_ROUNDS}.`;
    if (!isInteger(legacy.qualifiedTeams)) return 'O número de classificados deve ser um número inteiro.';
    if (legacy.qualifiedTeams < MIN_QUALIFIED_TEAMS || legacy.qualifiedTeams > MAX_QUALIFIED_TEAMS) return `O número de classificados deve ficar entre ${MIN_QUALIFIED_TEAMS} e ${MAX_QUALIFIED_TEAMS}.`;
    return null;
  }

  const format = value as Partial<CompetitionFormat>;
  if (!isCompetitionFormatId(format.id)) return 'Escolha um formato de competição válido.';
  if (!isInteger(format.teamCount) || format.teamCount < MIN_COMPETITION_TEAMS || format.teamCount > MAX_COMPETITION_TEAMS) return `O torneio deve ter entre ${MIN_COMPETITION_TEAMS} e ${MAX_COMPETITION_TEAMS} times.`;
  if (format.id === 'league' || format.id === 'league_knockout') {
    if (!isInteger(format.leagueRounds) || format.leagueRounds < 1 || format.leagueRounds > format.teamCount - 1) return `A liga deve ter entre 1 e ${format.teamCount - 1} rodadas.`;
  }
  if (format.id === 'league_knockout') {
    if (format.teamCount < MIN_QUALIFIED_TEAMS) return `Este formato precisa de pelo menos ${MIN_QUALIFIED_TEAMS} times para formar as oitavas.`;
    if (!isInteger(format.qualifiedTeams) || format.qualifiedTeams < MIN_QUALIFIED_TEAMS || format.qualifiedTeams > MAX_QUALIFIED_TEAMS || format.qualifiedTeams > format.teamCount) return `O número de classificados deve ficar entre ${MIN_QUALIFIED_TEAMS} e ${Math.min(MAX_QUALIFIED_TEAMS, format.teamCount)}.`;
  }
  if (format.id === 'groups_knockout') {
    if (!isInteger(format.groupCount) || format.groupCount < 2 || format.groupCount > 12) return 'Escolha entre 2 e 12 grupos.';
    if (!isInteger(format.teamsPerGroup) || format.teamsPerGroup < 2 || format.teamsPerGroup > 8) return 'Cada grupo deve ter entre 2 e 8 times.';
    if (format.teamCount !== format.groupCount * format.teamsPerGroup) return 'O total de times precisa fechar exatamente os grupos.';
    if (!isInteger(format.groupRounds) || format.groupRounds < 1 || format.groupRounds > format.teamsPerGroup - 1) return `A fase de grupos deve ter entre 1 e ${format.teamsPerGroup - 1} rodadas.`;
    if (!isInteger(format.qualifiedPerGroup) || format.qualifiedPerGroup < 1 || format.qualifiedPerGroup > format.teamsPerGroup) return 'Defina quantos times passam por grupo.';
    if (format.groupCount * format.qualifiedPerGroup !== 16) return 'Este formato precisa classificar exatamente 16 times para o mata-mata.';
  }
  if (format.id === 'knockout' && (!isPowerOfTwo(format.teamCount) || format.teamCount > 16)) return 'O mata-mata direto deve ter 4, 8 ou 16 times.';
  if (format.knockoutLegs !== 1 && format.knockoutLegs !== 2) return 'Escolha se os confrontos terão uma ou duas partidas.';
  if (typeof format.finalSingleLeg !== 'boolean') return 'Defina o formato da final.';
  if (format.matchSettings !== undefined) {
    const settings = format.matchSettings as Partial<CompetitionMatchSettings>;
    if (typeof settings.injuriesEnabled !== 'boolean' || typeof settings.cardsEnabled !== 'boolean') return 'Defina se lesões e cartões estarão ativos.';
  }
  if (format.id === 'league' && format.rewards?.reinforcement === 'stage') return 'Pontos corridos aceita recrutamento por rodada, não por fase.';
  if (format.id === 'knockout' && format.rewards?.reinforcement === 'round') return 'O mata-mata direto aceita recrutamento por fase, não por rodada.';
  const rewardsError = validateRewards(format.rewards, reinforcementWindowLimit(format as CompetitionFormat));
  if (rewardsError) return rewardsError;
  return null;
}

/** Safe boundary for old saves/rooms and defensive calls from the game engine. */
export function normalizeCompetitionFormat(value: unknown): CompetitionFormat {
  if (value && typeof value === 'object' && !('id' in value)) {
    const legacy = value as { leagueRounds?: number; qualifiedTeams?: number };
    if (validateCompetitionFormat(value) === null) {
      return cloneCompetitionFormat({ ...DEFAULT_COMPETITION_FORMAT, leagueRounds: legacy.leagueRounds!, qualifiedTeams: legacy.qualifiedTeams!, rewards: { ...DEFAULT_COMPETITION_FORMAT.rewards, reinforcementUntilRound: legacy.leagueRounds! } });
    }
  }
  if (validateCompetitionFormat(value) !== null) return cloneCompetitionFormat(DEFAULT_COMPETITION_FORMAT);
  const format = value as CompetitionFormat;
  return cloneCompetitionFormat({ ...format, matchSettings: normalizeMatchSettings(format.matchSettings) });
}

export function directQualifiersFor(format: CompetitionFormat): number {
  if (format.id !== 'league_knockout') return 0;
  return Math.max(0, 32 - format.qualifiedTeams);
}

export function playoffTeamsFor(format: CompetitionFormat): number {
  if (format.id !== 'league_knockout') return 0;
  return Math.max(0, format.qualifiedTeams - 16);
}

export function competitionFormatSummary(format: CompetitionFormat): string {
  const normalized = normalizeCompetitionFormat(format);
  if (normalized.id === 'league') return `${normalized.teamCount} times · ${normalized.leagueRounds} rodadas · campeão pela tabela`;
  const finalMode = normalized.finalSingleLeg ? 'final em jogo único' : 'final ida e volta';
  if (normalized.id === 'groups_knockout') return `${normalized.groupCount} grupos de ${normalized.teamsPerGroup} · ${normalized.groupRounds} rodadas · ${normalized.groupCount * normalized.qualifiedPerGroup} classificados · ${finalMode}`;
  if (normalized.id === 'knockout') return `${normalized.teamCount} times · mata-mata direto · ${normalized.knockoutLegs === 2 ? 'ida e volta' : 'jogo único'} · ${finalMode}`;
  const direct = directQualifiersFor(normalized);
  const playoffs = playoffTeamsFor(normalized);
  return playoffs > 0 ? `${normalized.leagueRounds} rodadas · ${normalized.qualifiedTeams} classificados · ${direct} diretos + ${playoffs * 2} no playoff (${playoffs} ${playoffs === 1 ? 'confronto' : 'confrontos'}) · ${finalMode}` : `${normalized.leagueRounds} rodadas · ${normalized.qualifiedTeams} classificados direto às oitavas · ${finalMode}`;
}

export function competitionRewardSummary(format: CompetitionFormat): string {
  const normalized = normalizeCompetitionFormat(format);
  const rewards = normalized.rewards;
  const roundName = normalized.id === 'groups_knockout' ? 'rodada de grupos' : normalized.id === 'knockout' ? 'fase' : 'rodada da liga';
  const reinforcement = rewards.reinforcement === 'off' ? 'sem recrutamento automático' : rewards.reinforcement === 'round' ? `1 oferta a cada ${roundName} até a ${rewards.reinforcementUntilRound ?? 'última'}` : '1 oferta ao concluir cada fase eliminatória até o limite escolhido';
  return `${reinforcement} · ${rewards.pointsEnabled ? 'créditos da loja ativos' : 'créditos da loja desligados'}`;
}
