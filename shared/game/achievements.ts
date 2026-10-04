// UCL Immortals — account achievements.
// Career goals evaluated from the competitions an account completed. They are
// permanent facts of the history (never rankings that move), so a tier, once
// reached, is never lost. Defined once here and evaluated by the server.

import { isCompetitionFinishStage, isRankedDifficulty, type CompetitionFinishStage } from './competitionRanking';

/** Bumped whenever definitions or the evaluation change, to re-evaluate accounts. */
export const ACHIEVEMENTS_VERSION = 2;

export const ACHIEVEMENT_TIERS = ['bronze', 'silver', 'gold', 'legendary'] as const;
export type AchievementTier = (typeof ACHIEVEMENT_TIERS)[number];
export const ACHIEVEMENT_TIER_LABELS: Record<AchievementTier, string> = {
  bronze: 'Bronze',
  silver: 'Prata',
  gold: 'Ouro',
  legendary: 'Lendário',
};

/** One completed competition, as the history stores it. */
export interface CareerCompetition {
  difficultyId: string;
  mode: 'solo' | 'online';
  finishStage: CompetitionFinishStage | null;
  champion: boolean;
  wins: number;
  draws: number;
  losses: number;
  /** Matches played; 0 when not recorded (wins + draws + losses is used then). */
  games: number;
  goals: number;
  goalsAgainst: number;
  /** Human players in the room (online); null when it was not recorded. */
  humanPlayers: number | null;
  coachId: string | null;
  crestId: string | null;
  completedAt: number;
  rankingPoints: number;
  /** Best single player of the campaign in each record category (0 = none). */
  topPlayerGoals: number;
  topPlayerAssists: number;
  topKeeperSaves: number;
  topPlayerOverall: number;
}

/** A title "conceding few goals" (Muralha) allows at most this many. */
export const MURALHA_MAX_GOALS_AGAINST = 10;
/** Arena Lotada: an online room with at least this many human players. */
export const ARENA_MIN_HUMAN_PLAYERS = 3;
/** Days are counted in Brasília time (UTC-3). */
const DAY_OFFSET_MS = 3 * 60 * 60 * 1000;

export interface CareerMetrics {
  competitions: number;
  titles: number;
  semifinalOrBetter: number;
  careerGoals: number;
  careerWins: number;
  titleDifficulties: number;
  immortalTitles: number;
  bestTitleStreak: number;
  unbeatenTitles: number;
  bestCompetitionGoals: number;
  tightTitles: number;
  onlineTitles: number;
  crowdedOnlineTitles: number;
  finals: number;
  runnerUps: number;
  legendaryTitles: number;
  perfectTitles: number;
  titleCoaches: number;
  titleCrests: number;
  bestCompetitionWins: number;
  bestGoalDifference: number;
  bestPlayerGoals: number;
  bestPlayerAssists: number;
  bestKeeperSaves: number;
  bestPlayerOverall: number;
  qualified: number;
  bestQualifiedStreak: number;
  matchesPlayed: number;
  rankingPoints: number;
  loyalCrest: number;
  loyalCoach: number;
  difficultiesPlayed: number;
  activeDays: number;
  immortalCompetitions: number;
  immortalSemifinals: number;
  goldOrAboveTitles: number;
  hardCompetitions: number;
  onlineCompetitions: number;
  onlineSemifinals: number;
  onlineUnbeatenTitles: number;
}

/** Who drives a "most with one X" metric (the coach or crest id). */
export type CareerDetails = Partial<Record<keyof CareerMetrics, string>>;

const SEMIFINAL_OR_BETTER = new Set<CompetitionFinishStage>(['champion', 'runnerUp', 'semifinalist']);

const count = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
};

/** Largest group; ties go to the one reached most recently (iteration order). */
function mostUsed(counts: Map<string, number>): { id: string | null; total: number } {
  let best: { id: string | null; total: number } = { id: null, total: 0 };
  counts.forEach((total, id) => { if (total >= best.total) best = { id, total }; });
  return best;
}

/** Career metrics from completed competitions in completion order (oldest first). */
export function summarizeCareer(competitions: readonly CareerCompetition[]): { metrics: CareerMetrics; details: CareerDetails } {
  const titleDifficulties = new Set<string>();
  const titleCoaches = new Set<string>();
  const titleCrests = new Set<string>();
  const difficulties = new Set<string>();
  const days = new Set<string>();
  const coachUse = new Map<string, number>();
  const crestUse = new Map<string, number>();
  let titleStreak = 0;
  let qualifiedStreak = 0;
  const m: CareerMetrics = {
    competitions: competitions.length, titles: 0, semifinalOrBetter: 0, careerGoals: 0, careerWins: 0,
    titleDifficulties: 0, immortalTitles: 0, bestTitleStreak: 0, unbeatenTitles: 0, bestCompetitionGoals: 0,
    tightTitles: 0, onlineTitles: 0, crowdedOnlineTitles: 0, finals: 0, runnerUps: 0, legendaryTitles: 0,
    perfectTitles: 0, titleCoaches: 0, titleCrests: 0, bestCompetitionWins: 0, bestGoalDifference: 0,
    bestPlayerGoals: 0, bestPlayerAssists: 0, bestKeeperSaves: 0, bestPlayerOverall: 0, qualified: 0,
    bestQualifiedStreak: 0, matchesPlayed: 0, rankingPoints: 0, loyalCrest: 0, loyalCoach: 0,
    difficultiesPlayed: 0, activeDays: 0, immortalCompetitions: 0, immortalSemifinals: 0,
    goldOrAboveTitles: 0, hardCompetitions: 0, onlineCompetitions: 0, onlineSemifinals: 0, onlineUnbeatenTitles: 0,
  };

  for (const c of competitions) {
    const champion = c.champion || c.finishStage === 'champion';
    const wins = count(c.wins);
    const draws = count(c.draws);
    const losses = count(c.losses);
    const goals = count(c.goals);
    const goalsAgainst = count(c.goalsAgainst);
    const semifinal = champion || (!!c.finishStage && SEMIFINAL_OR_BETTER.has(c.finishStage));
    const qualified = champion || (!!c.finishStage && c.finishStage !== 'leaguePhase');
    const online = c.mode === 'online';
    const immortal = c.difficultyId === 'immortal';

    m.careerGoals += goals;
    m.careerWins += wins;
    m.matchesPlayed += count(c.games) || wins + draws + losses;
    m.rankingPoints += count(c.rankingPoints);
    m.bestCompetitionGoals = Math.max(m.bestCompetitionGoals, goals);
    m.bestCompetitionWins = Math.max(m.bestCompetitionWins, wins);
    m.bestGoalDifference = Math.max(m.bestGoalDifference, goals - goalsAgainst);
    m.bestPlayerGoals = Math.max(m.bestPlayerGoals, count(c.topPlayerGoals));
    m.bestPlayerAssists = Math.max(m.bestPlayerAssists, count(c.topPlayerAssists));
    m.bestKeeperSaves = Math.max(m.bestKeeperSaves, count(c.topKeeperSaves));
    m.bestPlayerOverall = Math.max(m.bestPlayerOverall, count(c.topPlayerOverall));
    if (semifinal) m.semifinalOrBetter += 1;
    if (champion || c.finishStage === 'runnerUp') m.finals += 1;
    if (c.finishStage === 'runnerUp' && !champion) m.runnerUps += 1;
    if (qualified) m.qualified += 1;
    qualifiedStreak = qualified ? qualifiedStreak + 1 : 0;
    m.bestQualifiedStreak = Math.max(m.bestQualifiedStreak, qualifiedStreak);
    titleStreak = champion ? titleStreak + 1 : 0;
    m.bestTitleStreak = Math.max(m.bestTitleStreak, titleStreak);
    if (isRankedDifficulty(c.difficultyId)) difficulties.add(c.difficultyId);
    if (c.coachId) coachUse.set(c.coachId, (coachUse.get(c.coachId) ?? 0) + 1);
    if (c.crestId) crestUse.set(c.crestId, (crestUse.get(c.crestId) ?? 0) + 1);
    if (Number.isFinite(c.completedAt) && c.completedAt > 0) days.add(new Date(c.completedAt - DAY_OFFSET_MS).toISOString().slice(0, 10));
    if (immortal) {
      m.immortalCompetitions += 1;
      if (semifinal) m.immortalSemifinals += 1;
    }
    if (c.difficultyId === 'legendary' || immortal) m.hardCompetitions += 1;
    if (online) {
      m.onlineCompetitions += 1;
      if (semifinal) m.onlineSemifinals += 1;
    }

    if (!champion) continue;
    m.titles += 1;
    if (isRankedDifficulty(c.difficultyId)) titleDifficulties.add(c.difficultyId);
    if (immortal) m.immortalTitles += 1;
    if (c.difficultyId === 'legendary') m.legendaryTitles += 1;
    if (c.difficultyId === 'gold' || c.difficultyId === 'legendary' || immortal) m.goldOrAboveTitles += 1;
    if (losses === 0) m.unbeatenTitles += 1;
    if (losses === 0 && draws === 0 && wins > 0) m.perfectTitles += 1;
    if (goalsAgainst <= MURALHA_MAX_GOALS_AGAINST) m.tightTitles += 1;
    if (c.coachId) titleCoaches.add(c.coachId);
    if (c.crestId) titleCrests.add(c.crestId);
    if (online) {
      m.onlineTitles += 1;
      if (losses === 0) m.onlineUnbeatenTitles += 1;
      if ((c.humanPlayers ?? 0) >= ARENA_MIN_HUMAN_PLAYERS) m.crowdedOnlineTitles += 1;
    }
  }

  m.titleDifficulties = titleDifficulties.size;
  m.titleCoaches = titleCoaches.size;
  m.titleCrests = titleCrests.size;
  m.difficultiesPlayed = difficulties.size;
  m.activeDays = days.size;
  const loyalCoach = mostUsed(coachUse);
  const loyalCrest = mostUsed(crestUse);
  m.loyalCoach = loyalCoach.total;
  m.loyalCrest = loyalCrest.total;
  const details: CareerDetails = {};
  if (loyalCoach.id) details.loyalCoach = loyalCoach.id;
  if (loyalCrest.id) details.loyalCrest = loyalCrest.id;
  return { metrics: m, details };
}

export type AchievementCategory = 'titles' | 'campaign' | 'career' | 'difficulty' | 'online';
export const ACHIEVEMENT_CATEGORY_LABELS: Record<AchievementCategory, string> = {
  titles: 'Títulos',
  campaign: 'Campanha',
  career: 'Carreira',
  difficulty: 'Dificuldade',
  online: 'Online',
};

/** What the progress detail refers to (shown as "com <name>"). */
export type AchievementDetailKind = 'coach' | 'crest';

export interface AchievementDefinition {
  id: string;
  name: string;
  category: AchievementCategory;
  metric: keyof CareerMetrics;
  /** Value needed for Bronze, Prata, Ouro and Lendário (strictly increasing). */
  thresholds: readonly [number, number, number, number];
  /** Goal for a tier threshold (handles the singular). */
  goal: (n: string, one: boolean) => string;
  detail?: AchievementDetailKind;
}

const times = (n: string, one: boolean, text: string) => (one ? text : `${text} ${n} vezes`);

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  // Títulos
  { id: 'trophy_collector', name: 'Colecionador de Taças', category: 'titles', metric: 'titles', thresholds: [1, 5, 15, 50], goal: (n, one) => times(n, one, 'Seja campeão') },
  { id: 'finalist', name: 'Finalista', category: 'titles', metric: 'finals', thresholds: [3, 10, 30, 80], goal: n => `Chegue à final ${n} vezes` },
  { id: 'persistent_runner_up', name: 'Vice Persistente', category: 'titles', metric: 'runnerUps', thresholds: [1, 5, 15, 40], goal: (n, one) => (one ? 'Seja vice-campeão' : `Seja vice-campeão ${n} vezes`) },
  { id: 'dynasty', name: 'Hegemonia', category: 'titles', metric: 'bestTitleStreak', thresholds: [2, 3, 5, 8], goal: n => `Seja campeão em ${n} competições seguidas` },
  { id: 'ladder', name: 'Escalada', category: 'titles', metric: 'titleDifficulties', thresholds: [2, 3, 4, 5], goal: n => `Seja campeão em ${n} dificuldades diferentes` },
  { id: 'perfect_campaign', name: 'Campanha Perfeita', category: 'titles', metric: 'perfectTitles', thresholds: [1, 2, 5, 10], goal: (n, one) => times(n, one, 'Seja campeão vencendo todos os jogos') },
  { id: 'winning_coach', name: 'Técnico Vencedor', category: 'titles', metric: 'titleCoaches', thresholds: [2, 4, 7, 10], goal: n => `Seja campeão com ${n} técnicos diferentes` },
  { id: 'crest_collector', name: 'Colecionador de Escudos', category: 'titles', metric: 'titleCrests', thresholds: [2, 5, 10, 20], goal: n => `Seja campeão com ${n} escudos diferentes` },
  // Campanha
  { id: 'unbeaten', name: 'Invicto', category: 'campaign', metric: 'unbeatenTitles', thresholds: [1, 3, 10, 20], goal: (n, one) => times(n, one, 'Seja campeão sem perder um jogo') },
  { id: 'iron_wall', name: 'Muralha', category: 'campaign', metric: 'tightTitles', thresholds: [1, 3, 10, 20], goal: (n, one) => times(n, one, `Seja campeão sofrendo no máximo ${MURALHA_MAX_GOALS_AGAINST} gols`) },
  { id: 'firepower', name: 'Ataque Devastador', category: 'campaign', metric: 'bestCompetitionGoals', thresholds: [30, 40, 50, 65], goal: n => `Marque ${n} gols numa única competição` },
  { id: 'steamroller', name: 'Rolo Compressor', category: 'campaign', metric: 'bestCompetitionWins', thresholds: [10, 12, 14, 16], goal: n => `Vença ${n} jogos numa única competição` },
  { id: 'goal_difference', name: 'Saldo Arrasador', category: 'campaign', metric: 'bestGoalDifference', thresholds: [20, 30, 40, 55], goal: n => `Termine uma competição com saldo de +${n} gols` },
  { id: 'top_scorer', name: 'Artilheiro', category: 'campaign', metric: 'bestPlayerGoals', thresholds: [10, 15, 20, 30], goal: n => `Tenha um jogador com ${n} gols numa competição` },
  { id: 'maestro', name: 'Maestro', category: 'campaign', metric: 'bestPlayerAssists', thresholds: [8, 12, 16, 22], goal: n => `Tenha um jogador com ${n} assistências numa competição` },
  { id: 'brick_keeper', name: 'Paredão', category: 'campaign', metric: 'bestKeeperSaves', thresholds: [25, 40, 55, 75], goal: n => `Tenha um goleiro com ${n} defesas numa competição` },
  { id: 'galactic_squad', name: 'Elenco Galáctico', category: 'campaign', metric: 'bestPlayerOverall', thresholds: [100, 115, 130, 150], goal: n => `Tenha um jogador com geral efetivo ${n}` },
  { id: 'qualified', name: 'Classificado', category: 'campaign', metric: 'qualified', thresholds: [5, 25, 80, 200], goal: n => `Passe da fase de liga ${n} vezes` },
  { id: 'consistency', name: 'Regularidade', category: 'campaign', metric: 'bestQualifiedStreak', thresholds: [3, 5, 10, 20], goal: n => `Passe da fase de liga em ${n} competições seguidas` },
  // Carreira
  { id: 'contender', name: 'Sempre na Briga', category: 'career', metric: 'semifinalOrBetter', thresholds: [3, 15, 50, 150], goal: n => `Chegue à semifinal ou além ${n} vezes` },
  { id: 'veteran', name: 'Veterano', category: 'career', metric: 'competitions', thresholds: [5, 25, 100, 300], goal: n => `Conclua ${n} competições` },
  { id: 'marathoner', name: 'Maratonista', category: 'career', metric: 'matchesPlayed', thresholds: [50, 250, 1000, 3000], goal: n => `Dispute ${n} partidas` },
  { id: 'born_winner', name: 'Vencedor Nato', category: 'career', metric: 'careerWins', thresholds: [25, 150, 600, 1500], goal: n => `Vença ${n} partidas` },
  { id: 'goal_machine', name: 'Máquina de Gols', category: 'career', metric: 'careerGoals', thresholds: [100, 500, 2000, 5000], goal: n => `Marque ${n} gols na carreira` },
  { id: 'point_scorer', name: 'Pontuador', category: 'career', metric: 'rankingPoints', thresholds: [100, 500, 2000, 6000], goal: n => `Some ${n} pontos de ranking` },
  { id: 'loyal_crest', name: 'Fiel ao Escudo', category: 'career', metric: 'loyalCrest', thresholds: [5, 15, 40, 100], goal: n => `Conclua ${n} competições com o mesmo escudo`, detail: 'crest' },
  { id: 'lasting_partnership', name: 'Parceria Duradoura', category: 'career', metric: 'loyalCoach', thresholds: [5, 15, 40, 100], goal: n => `Conclua ${n} competições com o mesmo técnico`, detail: 'coach' },
  { id: 'explorer', name: 'Explorador', category: 'career', metric: 'difficultiesPlayed', thresholds: [2, 3, 4, 5], goal: n => `Jogue em ${n} dificuldades diferentes` },
  { id: 'regular', name: 'Frequentador', category: 'career', metric: 'activeDays', thresholds: [3, 10, 30, 100], goal: n => `Conclua competições em ${n} dias diferentes` },
  // Dificuldade
  { id: 'immortal_legend', name: 'Lenda Imortal', category: 'difficulty', metric: 'immortalTitles', thresholds: [1, 3, 10, 25], goal: (n, one) => (one ? 'Seja campeão no Imortal' : `Seja campeão ${n} vezes no Imortal`) },
  { id: 'legendary_legend', name: 'Lenda do Lendário', category: 'difficulty', metric: 'legendaryTitles', thresholds: [1, 3, 10, 25], goal: (n, one) => (one ? 'Seja campeão no Lendário' : `Seja campeão ${n} vezes no Lendário`) },
  { id: 'immortal_challenge', name: 'Desafio Imortal', category: 'difficulty', metric: 'immortalCompetitions', thresholds: [1, 10, 40, 100], goal: (n, one) => (one ? 'Conclua uma competição no Imortal' : `Conclua ${n} competições no Imortal`) },
  { id: 'immortal_giant', name: 'Gigante do Imortal', category: 'difficulty', metric: 'immortalSemifinals', thresholds: [1, 5, 15, 40], goal: (n, one) => (one ? 'Chegue à semifinal ou além no Imortal' : `Chegue à semifinal ou além ${n} vezes no Imortal`) },
  { id: 'level_up', name: 'Subindo de Nível', category: 'difficulty', metric: 'goldOrAboveTitles', thresholds: [1, 5, 15, 40], goal: (n, one) => (one ? 'Seja campeão no Ouro ou acima' : `Seja campeão ${n} vezes no Ouro ou acima`) },
  { id: 'fearless', name: 'Sem Medo', category: 'difficulty', metric: 'hardCompetitions', thresholds: [5, 20, 60, 150], goal: n => `Conclua ${n} competições no Lendário ou Imortal` },
  // Online
  { id: 'room_king', name: 'Rei da Sala', category: 'online', metric: 'onlineTitles', thresholds: [1, 5, 15, 40], goal: (n, one) => (one ? 'Seja campeão no online' : `Seja campeão ${n} vezes no online`) },
  { id: 'packed_arena', name: 'Arena Lotada', category: 'online', metric: 'crowdedOnlineTitles', thresholds: [1, 3, 10, 25], goal: (n, one) => times(n, one, `Seja campeão online numa sala com ${ARENA_MIN_HUMAN_PLAYERS}+ jogadores`) },
  { id: 'multiplayer', name: 'Multiplayer', category: 'online', metric: 'onlineCompetitions', thresholds: [1, 10, 40, 100], goal: (n, one) => (one ? 'Conclua uma competição online' : `Conclua ${n} competições online`) },
  { id: 'online_contender', name: 'Competidor Online', category: 'online', metric: 'onlineSemifinals', thresholds: [1, 5, 15, 40], goal: (n, one) => (one ? 'Chegue à semifinal ou além no online' : `Chegue à semifinal ou além ${n} vezes no online`) },
  { id: 'online_unbeaten', name: 'Invicto Online', category: 'online', metric: 'onlineUnbeatenTitles', thresholds: [1, 3, 8, 20], goal: (n, one) => times(n, one, 'Seja campeão online sem perder um jogo') },
];

export const ACHIEVEMENT_BY_ID = new Map(ACHIEVEMENTS.map(achievement => [achievement.id, achievement]));

export function achievementGoalText(definition: AchievementDefinition, tierIndex: number): string {
  const threshold = definition.thresholds[Math.max(0, Math.min(3, tierIndex))];
  return definition.goal(threshold.toLocaleString('pt-BR'), threshold === 1);
}

/** 0 = locked, 1..4 = Bronze..Lendário. */
export type AchievementLevel = 0 | 1 | 2 | 3 | 4;

export interface AchievementProgress {
  id: string;
  level: AchievementLevel;
  progress: number;
  /** Coach or crest id driving the progress, for achievements with a detail. */
  detail: string | null;
}

export function levelFor(definition: AchievementDefinition, value: number): AchievementLevel {
  let level = 0;
  definition.thresholds.forEach((threshold, index) => { if (value >= threshold) level = index + 1; });
  return level as AchievementLevel;
}

export function evaluateAchievements(competitions: readonly CareerCompetition[]): AchievementProgress[] {
  const { metrics, details } = summarizeCareer(competitions);
  return ACHIEVEMENTS.map(definition => {
    const progress = metrics[definition.metric];
    return {
      id: definition.id,
      level: levelFor(definition, progress),
      progress,
      detail: definition.detail ? details[definition.metric] ?? null : null,
    };
  });
}

export function tierForLevel(level: number): AchievementTier | null {
  return level >= 1 && level <= 4 ? ACHIEVEMENT_TIERS[level - 1] : null;
}

/** Rarity wording for "N% of players have it". */
export function rarityLabel(percent: number): 'Comum' | 'Incomum' | 'Rara' | 'Épica' | 'Lendária' {
  if (percent >= 50) return 'Comum';
  if (percent >= 20) return 'Incomum';
  if (percent >= 5) return 'Rara';
  if (percent >= 1) return 'Épica';
  return 'Lendária';
}

// ── Showcase (mural) ──
export const SHOWCASE_MAX_ITEMS = 6;
export const RECORD_CATEGORIES = ['goals', 'assists', 'saves', 'effective_overall'] as const;
export type RecordCategory = (typeof RECORD_CATEGORIES)[number];
export type ShowcaseItem =
  | { type: 'achievement'; id: string }
  | { type: 'record'; difficultyId: string; category: RecordCategory };

/** Validates a client-sent showcase: known items, no duplicates, bounded size. */
export function sanitizeShowcase(raw: unknown): ShowcaseItem[] | null {
  if (!Array.isArray(raw) || raw.length > SHOWCASE_MAX_ITEMS) return null;
  const items: ShowcaseItem[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') return null;
    const item = entry as Record<string, unknown>;
    let normalized: ShowcaseItem;
    if (item.type === 'achievement' && typeof item.id === 'string' && ACHIEVEMENT_BY_ID.has(item.id)) {
      normalized = { type: 'achievement', id: item.id };
    } else if (item.type === 'record'
      && isRankedDifficulty(item.difficultyId)
      && (RECORD_CATEGORIES as readonly unknown[]).includes(item.category)) {
      normalized = { type: 'record', difficultyId: item.difficultyId, category: item.category as RecordCategory };
    } else {
      return null;
    }
    const key = showcaseKey(normalized);
    if (seen.has(key)) return null;
    seen.add(key);
    items.push(normalized);
  }
  return items;
}

export function showcaseKey(item: ShowcaseItem): string {
  return item.type === 'achievement' ? `a:${item.id}` : `r:${item.difficultyId}:${item.category}`;
}

/** Normalizes a stored finish stage for career evaluation. */
export function careerFinishStage(value: unknown): CompetitionFinishStage | null {
  return isCompetitionFinishStage(value) ? value : null;
}
