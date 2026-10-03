// Competition formats shared by solo mode, online rooms and the server.

const COMPETITION_TEAM_COUNT = 36;
export const MAX_BOT_TEAMS = COMPETITION_TEAM_COUNT - 1;
export const MAX_ONLINE_PLAYERS = 8;
export const MIN_COMPETITION_TEAMS = 4;
export const MAX_COMPETITION_TEAMS = COMPETITION_TEAM_COUNT;
export const MIN_QUALIFIED_TEAMS = 16;
const MAX_QUALIFIED_TEAMS = 24;
export const MIN_REINFORCEMENT_OPTIONS = 3;
export const MAX_REINFORCEMENT_OPTIONS = 6;
export const MAX_POINTS_PER_RULE = 1000;
// The betting bank is a game rule, not a tournament customization.
// Teto fixo de stake total por rodada/partida nos palpites (+ bônus da Central de Palpites).
export const FIXED_BET_ROUND_CAP = 200;

export type CompetitionFormatId = 'league' | 'league_knockout' | 'groups_knockout' | 'knockout';
type ReinforcementMode = 'off' | 'round' | 'stage' | 'round_and_stage';
export type LeagueLegs = 1 | 2;

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
  leagueRounds: number;
  // Only used by the standalone points league. Other formats keep one leg.
  leagueLegs: LeagueLegs;
  qualifiedTeams: number;
  // Group settings. They are zero when the selected preset does not use groups.
  groupCount: number;
  teamsPerGroup: number;
  groupRounds: number;
  qualifiedPerGroup: number;
  knockoutLegs: 1 | 2;
  finalSingleLeg: boolean;
  rewards: CompetitionRewardsConfig;
}

interface CompetitionFormatPreset {
  id: CompetitionFormatId;
  name: string;
  shortDescription: string;
  description: string;
  icon: string;
  format: CompetitionFormat;
}

const DEFAULT_POINTS_CONFIG: CompetitionPointsConfig = {
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
  leagueRounds: 38,
  leagueLegs: 2,
  qualifiedTeams: 0,
  groupCount: 0,
  teamsPerGroup: 0,
  groupRounds: 0,
  qualifiedPerGroup: 0,
  knockoutLegs: 1,
  finalSingleLeg: true,
  rewards: { ...DEFAULT_REWARDS_CONFIG, reinforcementUntilRound: 38, knockoutPointsEnabled: false },
};

const LEAGUE_KNOCKOUT_DEFAULT: CompetitionFormat = {
  id: 'league_knockout',
  teamCount: COMPETITION_TEAM_COUNT,
  leagueRounds: 8,
  leagueLegs: 1,
  qualifiedTeams: 24,
  groupCount: 0,
  teamsPerGroup: 0,
  groupRounds: 0,
  qualifiedPerGroup: 0,
  knockoutLegs: 2,
  finalSingleLeg: true,
  rewards: { ...DEFAULT_REWARDS_CONFIG, reinforcement: 'round_and_stage' },
};

const GROUPS_KNOCKOUT_DEFAULT: CompetitionFormat = {
  id: 'groups_knockout',
  teamCount: 32,
  leagueRounds: 3,
  leagueLegs: 1,
  qualifiedTeams: 16,
  groupCount: 8,
  teamsPerGroup: 4,
  groupRounds: 3,
  qualifiedPerGroup: 2,
  knockoutLegs: 2,
  finalSingleLeg: true,
  rewards: { ...DEFAULT_REWARDS_CONFIG, reinforcement: 'round_and_stage', reinforcementUntilRound: 3 },
};

const KNOCKOUT_DEFAULT: CompetitionFormat = {
  id: 'knockout',
  teamCount: 16,
  leagueRounds: 0,
  leagueLegs: 1,
  qualifiedTeams: 16,
  groupCount: 0,
  teamsPerGroup: 0,
  groupRounds: 0,
  qualifiedPerGroup: 0,
  knockoutLegs: 1,
  finalSingleLeg: true,
  rewards: { ...DEFAULT_REWARDS_CONFIG, reinforcement: 'stage', reinforcementUntilRound: null },
};

export const DEFAULT_COMPETITION_FORMAT: CompetitionFormat = LEAGUE_KNOCKOUT_DEFAULT;

export const COMPETITION_FORMAT_PRESETS: Record<CompetitionFormatId, CompetitionFormatPreset> = {
  league: {
    id: 'league', name: 'Pontos corridos', shortDescription: 'Todos contra todos em ida e volta.',
    description: 'Uma liga completa, decidida pela tabela, com mando de campo invertido no returno. Não existe mata-mata.', icon: '🏟️', format: LEAGUE_DEFAULT,
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

function cloneCompetitionFormat(format: CompetitionFormat): CompetitionFormat {
  return {
    ...format,
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
  if (value.reinforcement !== 'off' && value.reinforcement !== 'round' && value.reinforcement !== 'stage' && value.reinforcement !== 'round_and_stage') return 'Escolha quando as ofertas de recrutamento serão oferecidas.';
  if (!isInteger(value.reinforcementOptions) || value.reinforcementOptions < MIN_REINFORCEMENT_OPTIONS || value.reinforcementOptions > MAX_REINFORCEMENT_OPTIONS) return `As opções de recrutamento devem ficar entre ${MIN_REINFORCEMENT_OPTIONS} e ${MAX_REINFORCEMENT_OPTIONS}.`;
  if (value.reinforcement !== 'off' && value.reinforcementUntilRound !== null && (!isInteger(value.reinforcementUntilRound) || value.reinforcementUntilRound < 1 || value.reinforcementUntilRound > maxReinforcementWindow)) return `A janela de recrutamento deve ficar entre 1 e ${maxReinforcementWindow}.`;
  if (typeof value.pointsEnabled !== 'boolean' || typeof value.knockoutPointsEnabled !== 'boolean') return 'Defina se os créditos da loja estarão ativos nas fases.';
  if (!value.points || typeof value.points !== 'object') return 'Defina os créditos da partida.';
  for (const key of ['win', 'draw', 'loss', 'goalDifference', 'goal', 'cleanSheet'] as const) {
    if (!isInteger(value.points[key]) || value.points[key] < 0 || value.points[key] > MAX_POINTS_PER_RULE) return `Cada regra de créditos deve ficar entre 0 e ${MAX_POINTS_PER_RULE}.`;
  }
  return null;
}

/** Maximum useful value for the reinforcement window in the selected format. */
function reinforcementWindowLimit(format: CompetitionFormat, mode?: ReinforcementMode): number {
  const effectiveMode = mode ?? format.rewards?.reinforcement ?? 'off';
  if (effectiveMode === 'round' || effectiveMode === 'round_and_stage') {
    if (format.id === 'groups_knockout') return Math.max(1, format.groupRounds);
    if (format.id === 'league' || format.id === 'league_knockout') return Math.max(1, format.leagueRounds);
  }
  if (effectiveMode === 'stage' || effectiveMode === 'round_and_stage') {
    if (format.id === 'knockout') return Math.max(1, Math.round(Math.log2(format.teamCount)) - 1);
    // The final does not offer a post-stage reinforcement. The useful
    // stages are therefore playoff, R16, QF and SF at most.
    if (format.id === 'league_knockout' || format.id === 'groups_knockout') return 4;
    return 1;
  }
  return 1;
}

/**
 * Rewards are fixed per preset (the competition screen does not expose them);
 * only the reinforcement window adapts to the chosen format size.
 */
function standardRulesForFormat(format: CompetitionFormat): Pick<CompetitionFormat, 'rewards'> {
  const preset = COMPETITION_FORMAT_PRESETS[format.id].format;
  const reinforcement = preset.rewards.reinforcement;
  const windowLimit = reinforcementWindowLimit(format, reinforcement);

  return {
    rewards: {
      ...preset.rewards,
      reinforcementUntilRound: reinforcement === 'off'
        ? null
        : Math.min(preset.rewards.reinforcementUntilRound ?? windowLimit, windowLimit),
      points: { ...preset.rewards.points },
    },
  };
}

/** Returns a user-facing validation message, or null when the format is valid. */
export function validateCompetitionFormat(value: unknown): string | null {
  if (!value || typeof value !== 'object') return 'Defina o formato da competição.';

  const format = value as Partial<CompetitionFormat>;
  if (!isCompetitionFormatId(format.id)) return 'Escolha um formato de competição válido.';
  if (!isInteger(format.teamCount) || format.teamCount < MIN_COMPETITION_TEAMS || format.teamCount > MAX_COMPETITION_TEAMS) return `O torneio deve ter entre ${MIN_COMPETITION_TEAMS} e ${MAX_COMPETITION_TEAMS} times.`;
  if (format.id === 'league' || format.id === 'league_knockout') {
    if (format.id === 'league' && format.leagueLegs !== 1 && format.leagueLegs !== 2) return 'Escolha se os pontos corridos terão turno único ou ida e volta.';
    const leagueLegs = format.id === 'league' ? format.leagueLegs as LeagueLegs : 1;
    const maxRounds = leagueLegs * (format.teamCount - 1);
    if (!isInteger(format.leagueRounds) || format.leagueRounds < 1 || format.leagueRounds > maxRounds) return `A liga deve ter entre 1 e ${maxRounds} rodadas.`;
    if (format.id === 'league' && format.leagueRounds !== maxRounds) return `A liga deve ter exatamente ${maxRounds} rodadas nesse formato.`;
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
  if (format.id === 'league' && (format.rewards?.reinforcement === 'stage' || format.rewards?.reinforcement === 'round_and_stage')) return 'Pontos corridos aceita recrutamento por rodada, não por fase.';
  if (format.id === 'knockout' && (format.rewards?.reinforcement === 'round' || format.rewards?.reinforcement === 'round_and_stage')) return 'O mata-mata direto aceita recrutamento por fase, não por rodada.';
  const rewardsError = validateRewards(format.rewards, reinforcementWindowLimit(format as CompetitionFormat));
  if (rewardsError) return rewardsError;
  return null;
}

/** Safe boundary for client/network input and defensive calls from the game engine. */
export function normalizeCompetitionFormat(value: unknown): CompetitionFormat {
  if (validateCompetitionFormat(value) !== null) return cloneCompetitionFormat(DEFAULT_COMPETITION_FORMAT);
  const format = value as CompetitionFormat;
  return cloneCompetitionFormat({ ...format, ...standardRulesForFormat(format) });
}

function directQualifiersFor(format: CompetitionFormat): number {
  if (format.id !== 'league_knockout') return 0;
  return Math.max(0, 32 - format.qualifiedTeams);
}

function playoffTeamsFor(format: CompetitionFormat): number {
  if (format.id !== 'league_knockout') return 0;
  return Math.max(0, format.qualifiedTeams - 16);
}

export function competitionFormatSummary(format: CompetitionFormat): string {
  const normalized = normalizeCompetitionFormat(format);
  if (normalized.id === 'league') return `${normalized.teamCount} times · ${normalized.leagueLegs === 2 ? 'ida e volta' : 'turno único'} · ${normalized.leagueRounds} rodadas · campeão pela tabela`;
  const finalMode = normalized.finalSingleLeg ? 'final em jogo único' : 'final ida e volta';
  if (normalized.id === 'groups_knockout') return `${normalized.groupCount} grupos de ${normalized.teamsPerGroup} · ${normalized.groupRounds} rodadas · ${normalized.groupCount * normalized.qualifiedPerGroup} classificados · ${finalMode}`;
  if (normalized.id === 'knockout') return `${normalized.teamCount} times · mata-mata direto · ${normalized.knockoutLegs === 2 ? 'ida e volta' : 'jogo único'} · ${finalMode}`;
  const direct = directQualifiersFor(normalized);
  const playoffs = playoffTeamsFor(normalized);
  return playoffs > 0 ? `${normalized.leagueRounds} rodadas · ${normalized.qualifiedTeams} classificados · ${direct} diretos + ${playoffs * 2} no playoff (${playoffs} ${playoffs === 1 ? 'confronto' : 'confrontos'}) · ${finalMode}` : `${normalized.leagueRounds} rodadas · ${normalized.qualifiedTeams} classificados direto às oitavas · ${finalMode}`;
}
