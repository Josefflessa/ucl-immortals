// UCL Immortals — estrutura base dos Projetos do Clube.
//
// Esta primeira etapa define o contrato de dados, a ordem editorial e a
// normalização dos níveis. Os efeitos de gameplay entram por projeto e usam
// fórmulas puras para manter solo e online alinhados.

export const CLUB_PROJECT_LEVELS = 5;

export const CLUB_PROJECT_UPGRADE_COSTS = {
  2: 150,
  3: 250,
  4: 350,
  5: 450,
} as const;

export const CLUB_PROJECT_ORDER = [
  'recruitment',
  'analysis',
  'betting',
  'medical',
  'training',
  'stadium',
  'supporters',
] as const;

export type ClubProjectId = typeof CLUB_PROJECT_ORDER[number];

export interface ClubProjectsState {
  levels: Record<ClubProjectId, number>;
}

export interface ClubProjectDefinition {
  id: ClubProjectId;
  icon: string;
  title: string;
  color: string;
  description: string;
  foundation: string;
  nextStep: string;
  levelEffects?: readonly string[];
}

export type RecruitmentEventKind = 'round' | 'stage';

export interface RecruitmentOfferMeta {
  eventKind: RecruitmentEventKind;
  eventNumber: number;
  projectLevel: number;
  baseOptions: number;
  selectionLimit: number;
  selectionsMade: number;
  freeRerolls: number;
  rerollsUsed: number;
  minimumOverall: number;
}

export interface RecruitmentOfferConfig {
  optionCount: number;
  selectionLimit: number;
  freeRerolls: number;
  minimumOverall: number;
}

/** Number of free physiotherapy uses granted at the start of each competition. */
export function medicalFreeTreatmentsPerCompetition(level: number): number {
  return validLevel(level) >= 1 ? 1 : 0;
}

export function medicalPhysioCost(level: number): number {
  const safeLevel = validLevel(level);
  if (safeLevel >= 3) return 50;
  if (safeLevel === 2) return 100;
  return 150;
}

/** Number of matches every new injury lasts at this Medical Department level. */
export function medicalInjuryDuration(level: number): number {
  const safeLevel = validLevel(level);
  if (safeLevel >= 3) return 1;
  return safeLevel >= 2 ? 2 : 3;
}

// Kept as a compatibility alias for older imports. The value is now an exact
// duration, not merely an upper bound.
export const medicalMaxInjuryDuration = medicalInjuryDuration;

export function medicalReturnBoost(level: number): number {
  const safeLevel = validLevel(level);
  if (safeLevel >= 5) return 10;
  if (safeLevel >= 4) return 5;
  return 0;
}

/** Extra stake room supplied by the Central de Palpites. Zero keeps the competition cap unchanged. */
export function bettingStakeCapBonus(level: number): number {
  const safeLevel = validLevel(level);
  if (safeLevel >= 4) return 100;
  if (safeLevel >= 2) return 50;
  return 0;
}

/** One losing ticket per betting scope can recover part of its stake. */
export function bettingLossRefundPercent(level: number): number {
  const safeLevel = validLevel(level);
  if (safeLevel >= 4) return 50;
  if (safeLevel >= 3) return 25;
  return 0;
}

export const TRAINING_BASE_COST = 100;
export const TRAINING_STANDARD_STEP = 50;
export const TRAINING_REDUCED_STEP = 25;
export const TRAINING_BASE_BOOST = 3;

/** Calculates the escalating training cost for one player. */
export function trainingCostForProject(level: number, trainCount: number): number {
  const safeLevel = validLevel(level);
  const safeCount = Math.max(0, Math.floor(Number.isFinite(trainCount) ? trainCount : 0));
  const baseCost = safeLevel >= 2 ? 50 : TRAINING_BASE_COST;
  const step = safeLevel >= 5 ? TRAINING_REDUCED_STEP : TRAINING_STANDARD_STEP;
  return baseCost + step * safeCount;
}

export function trainingBoostForProject(level: number, firstTrainingForPlayer: boolean): number {
  const safeLevel = validLevel(level);
  if (safeLevel >= 4) return TRAINING_BASE_BOOST + 1;
  if (safeLevel >= 3 && firstTrainingForPlayer) return TRAINING_BASE_BOOST + 1;
  return TRAINING_BASE_BOOST;
}

export const CLUB_PROJECT_DEFINITIONS: readonly ClubProjectDefinition[] = [
  {
    id: 'recruitment',
    icon: '🧭',
    title: 'CENTRO DE RECRUTAMENTO',
    color: '#4ADE80',
    description: 'Amplia as opções, contratações e a qualidade das ofertas recebidas após as partidas.',
    foundation: 'Nível 1: quantidade normal de opções e contratações da competição.',
    nextStep: 'Nível 2: +2 opções em cada recrutamento.',
    levelEffects: [
      'Quantidade normal de opções e contratações da competição.',
      '+2 opções em cada recrutamento.',
      'Permite contratar 2 jogadores por recrutamento.',
      '1 reroll gratuito por recrutamento.',
      'Somente jogadores de overall 88+ nas ofertas.',
    ],
  },
  {
    id: 'analysis',
    icon: '🔎',
    title: 'NÚCLEO DE ANÁLISE',
    color: '#60A5FA',
    description: 'Aumenta o bônus recebido quando sua formação leva vantagem sobre a adversária.',
    foundation: 'Quando sua formação leva vantagem, você recebe um bônus leve durante a partida.',
    nextStep: 'Próximo nível: aumenta em 50% os bônus da tática escolhida.',
    levelEffects: [
      'Vantagem de formação: bônus leve durante a partida.',
      'Aumenta em 50% cada bônus de atributo da tática escolhida.',
      'Vantagem de formação: bônus claro durante a partida.',
      'Aumenta novamente em 50% cada bônus de atributo da tática escolhida.',
      'Vantagem de formação: bônus forte durante a partida.',
    ],
  },
  {
    id: 'betting',
    icon: '🎯',
    title: 'CENTRAL DE PALPITES',
    color: '#F472B6',
    description: 'Administra o risco e melhora os retornos das apostas da competição.',
    foundation: 'Regras normais de palpites.',
    nextStep: 'Nível 2: +50 créditos no limite de banca por rodada ou confronto.',
    levelEffects: [
      'Regras normais de palpites.',
      '+50 créditos no limite de banca por rodada ou confronto.',
      'Cada aposta perdida devolve 25% do valor apostado.',
      '+50 créditos adicionais no limite, totalizando +100; a devolução sobe para 50%.',
      'Apostas vencedoras recebem +0,25× no multiplicador final.',
    ],
  },
  {
    id: 'medical',
    icon: '🏥',
    title: 'DEPARTAMENTO MÉDICO',
    color: '#22D3EE',
    description: 'Recupera jogadores lesionados e reduz o impacto das ausências.',
    foundation: 'Nível 1: 1 uso gratuito de Fisioterapia por competição.',
    nextStep: 'Nível 2: usos pagos de Fisioterapia por 100 créditos e lesões com duração fixa de 2 partidas.',
    levelEffects: [
      '1 uso gratuito de Fisioterapia por competição.',
      'O preço da Fisioterapia passa a ser 100 créditos; novas lesões duram 2 partidas.',
      'O preço da Fisioterapia passa a ser 50 créditos; novas lesões duram 1 partida.',
      'Ao voltar de uma lesão, o jogador recebe +5 em todos os atributos. O bônus acumula.',
      'Ao voltar de uma lesão, o jogador recebe +10 em todos os atributos. O bônus acumula.',
    ],
  },
  {
    id: 'training',
    icon: '💪',
    title: 'CENTRO DE TREINAMENTO',
    color: '#FBBF24',
    description: 'Concentra os treinos permanentes dos jogadores e melhora sua eficiência a cada nível.',
    foundation: 'Cada treino concede +3 no atributo escolhido. O primeiro treino custa 100 créditos; cada treino seguinte no mesmo jogador custa 50 créditos a mais.',
    nextStep: 'Nível 2: o primeiro treino de cada jogador passa a custar 50 créditos.',
    levelEffects: [
      'Cada treino concede +3 no atributo escolhido. O primeiro treino custa 100 créditos; cada treino seguinte no mesmo jogador custa 50 créditos a mais.',
      'O primeiro treino de cada jogador passa a custar 50 créditos.',
      'O primeiro treino de cada jogador passa a conceder +4 no atributo escolhido.',
      'Todos os treinos passam a conceder +4 no atributo escolhido.',
      'Cada treino adicional no mesmo jogador acrescenta 25 créditos ao custo, em vez de 50.',
    ],
  },
  {
    id: 'stadium',
    icon: '🏟️',
    title: 'ESTÁDIO',
    color: '#F0D77A',
    description: 'Aumenta a força do mando de campo nas partidas em casa.',
    foundation: 'Nível 1: +3 em todos os atributos dos 11 titulares mandantes.',
    nextStep: 'Nível 2: +5 em todos os atributos dos 11 titulares mandantes.',
    levelEffects: [
      '+3 em todos os atributos dos 11 titulares mandantes.',
      '+5 em todos os atributos dos 11 titulares mandantes.',
      '+7 em todos os atributos dos 11 titulares mandantes.',
      '+9 em todos os atributos dos 11 titulares mandantes.',
      '+11 em todos os atributos dos 11 titulares mandantes.',
    ],
  },
  {
    id: 'supporters',
    icon: '📣',
    title: 'TORCIDA',
    color: '#FB7185',
    description: 'Aumenta os créditos recebidos conforme o mando da partida.',
    foundation: 'Nível 1: recompensa da partida calculada pelas regras normais.',
    nextStep: 'Nível 2: +10% em casa e +5% fora sobre os créditos da partida.',
    levelEffects: [
      'Recompensa da partida calculada pelas regras normais.',
      '+10% em casa e +5% fora sobre os créditos-base da partida.',
      '+20% em casa e +10% fora sobre os créditos-base da partida.',
      '+30% em casa e +15% fora sobre os créditos-base da partida.',
      '+40% em casa e +20% fora sobre os créditos-base da partida.',
    ],
  },
] as const;

export type SupportersVenue = 'home' | 'away' | 'neutral';

/** Flat home advantage supplied by the Stadium project: +3, +5, +7, +9, +11. */
export function stadiumHomeBonus(level: number): number {
  return 3 + (validLevel(level) - 1) * 2;
}

/** Extra credit percentage supplied by the Supporters project. Neutral matches get no bonus. */
export function supportersBonusPercent(level: number, venue: SupportersVenue): number {
  if (venue === 'neutral') return 0;
  return (validLevel(level) - 1) * (venue === 'home' ? 10 : 5);
}

export interface ClubRewardBreakdown {
  base: number;
  supportersBonus: number;
  supportersPercent: number;
  supportersVenue: SupportersVenue;
  magnataBonus: number;
  magnataPercent: number;
  total: number;
}

/**
 * Applies match-credit modifiers independently to the same base reward. This
 * prevents Torcida and Magnata from multiplying one another and keeps solo and
 * online rewards on one deterministic formula.
 */
export function calculateClubReward(
  base: number,
  supportersLevel: number,
  venue: SupportersVenue,
  magnataActive: boolean,
): ClubRewardBreakdown {
  const safeBase = Math.max(0, Math.floor(Number.isFinite(base) ? base : 0));
  const supportersPercent = supportersBonusPercent(supportersLevel, venue);
  const supportersBonus = Math.round(safeBase * supportersPercent / 100);
  const magnataPercent = magnataActive ? 50 : 0;
  const magnataBonus = Math.round(safeBase * magnataPercent / 100);
  return {
    base: safeBase,
    supportersBonus,
    supportersPercent,
    supportersVenue: venue,
    magnataBonus,
    magnataPercent,
    total: safeBase + supportersBonus + magnataBonus,
  };
}

/**
 * Resolves the offer generated by the competition together with the current
 * Recruitment Centre level. The competition controls when an offer exists and
 * its base option count; the project only improves that offer.
 */
export function getRecruitmentOfferConfig(
  baseOptions: number,
  projectLevel: number,
  _eventNumber: number,
): RecruitmentOfferConfig {
  const level = validLevel(projectLevel);
  const safeBaseOptions = Math.max(1, Math.floor(baseOptions));
  // The levels are cumulative: every improvement stays active when the next
  // one is purchased. The cap protects the room from an accidentally oversized
  // competition setting while still allowing the normal six-card offer to
  // grow to eight cards at level 2+.
  const optionBonus = level >= 2 ? 2 : 0;
  const optionCap = 10;

  return {
    optionCount: Math.min(optionCap, safeBaseOptions + optionBonus),
    selectionLimit: level >= 3 ? 2 : 1,
    freeRerolls: level >= 4 ? 1 : 0,
    minimumOverall: level >= 5 ? 88 : 0,
  };
}

export function createRecruitmentOfferMeta(
  eventKind: RecruitmentEventKind,
  eventNumber: number,
  projectLevel: number,
  baseOptions: number,
  selectionLimit: number,
  freeRerolls = 0,
  minimumOverall = 0,
): RecruitmentOfferMeta {
  return {
    eventKind,
    eventNumber: Math.max(1, Math.floor(eventNumber)),
    projectLevel: validLevel(projectLevel),
    baseOptions: Math.max(1, Math.floor(baseOptions)),
    selectionLimit: Math.max(1, Math.floor(selectionLimit)),
    selectionsMade: 0,
    freeRerolls: Math.max(0, Math.floor(freeRerolls)),
    rerollsUsed: 0,
    minimumOverall: Math.max(0, Math.floor(minimumOverall)),
  };
}

export function createInitialClubProjects(): ClubProjectsState {
  return {
    levels: {
      recruitment: 1,
      analysis: 1,
      betting: 1,
      medical: 1,
      training: 1,
      stadium: 1,
      supporters: 1,
    },
  };
}

function validLevel(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(1, Math.min(CLUB_PROJECT_LEVELS, Math.floor(value)))
    : 1;
}

/**
 * Normalizes old/local/online state at the boundary. Missing projects are
 * intentionally treated as level 1 so existing campaigns remain playable.
 */
export function normalizeClubProjects(input: unknown): ClubProjectsState {
  const fallback = createInitialClubProjects();
  if (!input || typeof input !== 'object') return fallback;

  const rawLevels = (input as { levels?: unknown }).levels;
  if (!rawLevels || typeof rawLevels !== 'object') return fallback;

  const source = rawLevels as Partial<Record<ClubProjectId, unknown>> & { stadiumSupporters?: unknown };
  // Older saves used one combined project. Carry its progress into both new
  // modules so separating the UI never silently removes an investment.
  const legacyStadiumSupporters = validLevel(source.stadiumSupporters);
  return {
    levels: {
      recruitment: validLevel(source.recruitment),
      analysis: validLevel(source.analysis),
      betting: validLevel(source.betting),
      medical: validLevel(source.medical),
      training: validLevel(source.training),
      stadium: validLevel(source.stadium ?? legacyStadiumSupporters),
      supporters: validLevel(source.supporters ?? legacyStadiumSupporters),
    },
  };
}

export function projectLevel(projects: ClubProjectsState | undefined, id: ClubProjectId): number {
  return normalizeClubProjects(projects).levels[id];
}

export function projectUpgradeCost(nextLevel: number): number | null {
  if (nextLevel < 2 || nextLevel > CLUB_PROJECT_LEVELS) return null;
  return CLUB_PROJECT_UPGRADE_COSTS[nextLevel as keyof typeof CLUB_PROJECT_UPGRADE_COSTS] ?? null;
}

export interface ClubProjectUpgradeResult {
  projects: ClubProjectsState;
  cost: number;
  fromLevel: number;
  toLevel: number;
  remainingCredits: number;
}

/**
 * Shared, pure purchase rule for solo and online. Keeping the balance check
 * here prevents the client and the authoritative server from drifting apart.
 */
export function purchaseClubProjectUpgrade(
  input: ClubProjectsState | undefined,
  id: ClubProjectId,
  credits: number,
): ClubProjectUpgradeResult | null {
  const projects = normalizeClubProjects(input);
  const fromLevel = projects.levels[id];
  const toLevel = fromLevel + 1;
  const cost = projectUpgradeCost(toLevel);
  const safeCredits = Number.isFinite(credits) ? Math.max(0, Math.floor(credits)) : 0;
  if (!cost || safeCredits < cost) return null;

  return {
    projects: { levels: { ...projects.levels, [id]: toLevel } },
    cost,
    fromLevel,
    toLevel,
    remainingCredits: safeCredits - cost,
  };
}
