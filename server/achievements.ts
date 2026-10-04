// Server side of account achievements: evaluation from the stored history,
// persistence of the reached levels, rarity among players and the profile
// showcase (mural). The history is the only source: nothing the browser sends
// can grant an achievement.

import {
  ACHIEVEMENTS,
  ACHIEVEMENTS_VERSION,
  ACHIEVEMENT_BY_ID,
  careerFinishStage,
  evaluateAchievements,
  sanitizeShowcase,
  showcaseKey,
  SHOWCASE_MAX_ITEMS,
  type AchievementLevel,
  type CareerCompetition,
  type ShowcaseItem,
} from '../shared/game/achievements.js';
import { RANKED_DIFFICULTY_IDS } from '../shared/game/competitionRanking.js';

export interface AchievementState {
  id: string;
  level: AchievementLevel;
  progress: number;
  /** Coach or crest id driving the progress (Parceria Duradoura, Fiel ao Escudo). */
  detail: string | null;
  unlockedAt: number | null;
}

export interface AchievementUnlock {
  id: string;
  level: AchievementLevel;
}

/** Share of players (in percent) holding each level: index 0 = Bronze or better. */
export interface AchievementRarity {
  players: number;
  percentByAchievement: Record<string, [number, number, number, number]>;
}

interface CareerRow {
  difficulty_id: string;
  mode: string;
  finish_stage: string | null;
  champion: number;
  coach_id: string | null;
  crest_id: string | null;
  completed_at: number;
  competition_points: number;
  wins: unknown;
  draws: unknown;
  losses: unknown;
  games: unknown;
  goals: unknown;
  goals_against: unknown;
  human_players: unknown;
  top_goals: unknown;
  top_assists: unknown;
  top_saves: unknown;
  top_overall: unknown;
}

const toNumber = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

/** Completed competitions of an account, oldest first, as the evaluation needs them. */
export async function loadCareer(db: D1Database, userId: string): Promise<CareerCompetition[]> {
  // The best player of each record category comes from the campaign's own
  // record rows (one per category per competition).
  const rows = await db.prepare(`SELECT h.difficulty_id, h.mode, h.finish_stage, h.champion, h.coach_id, h.crest_id,
      h.completed_at, h.competition_points,
      CASE WHEN json_valid(h.report_json) THEN json_extract(h.report_json, '$.wins') END AS wins,
      CASE WHEN json_valid(h.report_json) THEN json_extract(h.report_json, '$.draws') END AS draws,
      CASE WHEN json_valid(h.report_json) THEN json_extract(h.report_json, '$.losses') END AS losses,
      CASE WHEN json_valid(h.report_json) THEN json_extract(h.report_json, '$.games') END AS games,
      CASE WHEN json_valid(h.report_json) THEN json_extract(h.report_json, '$.goals') END AS goals,
      CASE WHEN json_valid(h.report_json) THEN json_extract(h.report_json, '$.goalsAgainst') END AS goals_against,
      CASE WHEN json_valid(h.report_json) THEN json_extract(h.report_json, '$.humanPlayers') END AS human_players,
      MAX(CASE WHEN r.category = 'goals' THEN r.value END) AS top_goals,
      MAX(CASE WHEN r.category = 'assists' THEN r.value END) AS top_assists,
      MAX(CASE WHEN r.category = 'saves' THEN r.value END) AS top_saves,
      MAX(CASE WHEN r.category = 'effective_overall' THEN r.value END) AS top_overall
    FROM competition_history h
    LEFT JOIN competition_records r ON r.competition_id = h.id
    WHERE h.user_id = ?
    GROUP BY h.id
    ORDER BY h.completed_at ASC, h.id ASC`).bind(userId).all<CareerRow>();
  return rows.results.map(row => ({
    difficultyId: String(row.difficulty_id),
    mode: row.mode === 'online' ? 'online' : 'solo',
    finishStage: careerFinishStage(row.finish_stage),
    champion: Number(row.champion) === 1,
    wins: toNumber(row.wins),
    draws: toNumber(row.draws),
    losses: toNumber(row.losses),
    games: toNumber(row.games),
    goals: toNumber(row.goals),
    goalsAgainst: toNumber(row.goals_against),
    humanPlayers: row.human_players == null ? null : toNumber(row.human_players),
    coachId: row.coach_id ?? null,
    crestId: row.crest_id ?? null,
    completedAt: toNumber(row.completed_at),
    rankingPoints: toNumber(row.competition_points),
    topPlayerGoals: toNumber(row.top_goals),
    topPlayerAssists: toNumber(row.top_assists),
    topKeeperSaves: toNumber(row.top_saves),
    topPlayerOverall: toNumber(row.top_overall),
  }));
}

export async function loadAchievements(db: D1Database, userId: string): Promise<AchievementState[]> {
  const rows = await db.prepare(`SELECT achievement_id, level, progress, detail, unlocked_at
    FROM user_achievements WHERE user_id = ?`).bind(userId).all<{
      achievement_id: string;
      level: number;
      progress: number;
      detail: string | null;
      unlocked_at: number | null;
    }>();
  const stored = new Map(rows.results.map(row => [row.achievement_id, row]));
  return ACHIEVEMENTS.map(definition => {
    const row = stored.get(definition.id);
    const level = Math.max(0, Math.min(4, Number(row?.level ?? 0))) as AchievementLevel;
    return {
      id: definition.id,
      level,
      progress: Number(row?.progress ?? 0),
      detail: row?.detail ?? null,
      unlockedAt: level > 0 && row?.unlocked_at != null ? Number(row.unlocked_at) : null,
    };
  });
}

/**
 * Re-evaluates an account from its whole history and stores the result.
 * Levels never go down (an achievement is a permanent fact). Returns the levels
 * that went up in this call.
 */
export async function syncAchievements(db: D1Database, userId: string, now = Date.now()): Promise<AchievementUnlock[]> {
  const [career, current] = await Promise.all([loadCareer(db, userId), loadAchievements(db, userId)]);
  const previous = new Map(current.map(state => [state.id, state]));
  const unlocks: AchievementUnlock[] = [];
  const statements = evaluateAchievements(career).flatMap(result => {
    const before = previous.get(result.id);
    const level = Math.max(before?.level ?? 0, result.level) as AchievementLevel;
    const leveledUp = level > (before?.level ?? 0);
    if (leveledUp) unlocks.push({ id: result.id, level });
    if (!leveledUp && before && before.progress === result.progress && before.detail === result.detail) return [];
    return [db.prepare(`INSERT INTO user_achievements (user_id, achievement_id, level, progress, detail, unlocked_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, achievement_id) DO UPDATE SET
        level = MAX(user_achievements.level, excluded.level),
        progress = excluded.progress,
        detail = excluded.detail,
        unlocked_at = CASE WHEN excluded.level > user_achievements.level THEN excluded.unlocked_at ELSE user_achievements.unlocked_at END,
        updated_at = excluded.updated_at`)
      .bind(userId, result.id, level, result.progress, result.detail, leveledUp ? now : before?.unlockedAt ?? null, now)];
  });
  statements.push(db.prepare(`INSERT INTO profile_stats (user_id, updated_at, achievements_version) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET achievements_version = excluded.achievements_version`)
    .bind(userId, now, ACHIEVEMENTS_VERSION));
  await db.batch(statements);
  return unlocks;
}

/** Evaluates an account that was never evaluated with the current definitions. */
export async function ensureAchievementsCurrent(db: D1Database, userId: string): Promise<void> {
  const row = await db.prepare('SELECT achievements_version FROM profile_stats WHERE user_id = ?')
    .bind(userId).first<{ achievements_version: number }>();
  if (Number(row?.achievements_version ?? 0) >= ACHIEVEMENTS_VERSION) return;
  await syncAchievements(db, userId);
}

/** Rarity among players evaluated with the current definitions who completed a competition. */
export async function achievementRarity(db: D1Database): Promise<AchievementRarity> {
  const [playersRow, holders] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS players FROM profile_stats
      WHERE achievements_version = ? AND competitions_completed > 0`).bind(ACHIEVEMENTS_VERSION).first<{ players: number }>(),
    db.prepare(`SELECT ua.achievement_id, ua.level, COUNT(*) AS holders
      FROM user_achievements ua
      JOIN profile_stats s ON s.user_id = ua.user_id
      WHERE s.achievements_version = ? AND s.competitions_completed > 0 AND ua.level > 0
      GROUP BY ua.achievement_id, ua.level`).bind(ACHIEVEMENTS_VERSION).all<{ achievement_id: string; level: number; holders: number }>(),
  ]);
  const players = Number(playersRow?.players ?? 0);
  const exact = new Map<string, number[]>();
  for (const row of holders.results) {
    const levels = exact.get(row.achievement_id) ?? [0, 0, 0, 0, 0];
    levels[Math.max(0, Math.min(4, Number(row.level)))] += Number(row.holders);
    exact.set(row.achievement_id, levels);
  }
  const percentByAchievement: AchievementRarity['percentByAchievement'] = {};
  for (const definition of ACHIEVEMENTS) {
    const levels = exact.get(definition.id) ?? [0, 0, 0, 0, 0];
    // "Has Bronze" includes everyone at Prata or above, and so on.
    const atLeast = [1, 2, 3, 4].map(level => levels.slice(level).reduce((sum, value) => sum + value, 0));
    percentByAchievement[definition.id] = atLeast.map(holdersAtLeast => (players > 0
      ? Math.round((holdersAtLeast / players) * 1000) / 10
      : 0)) as [number, number, number, number];
  }
  return { players, percentByAchievement };
}

export async function loadShowcase(db: D1Database, userId: string): Promise<ShowcaseItem[]> {
  const row = await db.prepare('SELECT showcase_json FROM profiles WHERE user_id = ?').bind(userId).first<{ showcase_json: string | null }>();
  try {
    return sanitizeShowcase(JSON.parse(String(row?.showcase_json ?? '[]'))) ?? [];
  } catch {
    return [];
  }
}

/**
 * Stores a new showcase after checking the player really holds every pinned
 * item: an unlocked achievement or a verified record on that difficulty.
 */
export async function saveShowcase(db: D1Database, userId: string, raw: unknown): Promise<{ items: ShowcaseItem[] } | { error: string }> {
  const items = sanitizeShowcase(raw);
  if (!items) return { error: 'invalid_showcase' };
  const achievements = new Map((await loadAchievements(db, userId)).map(state => [state.id, state.level]));
  const recordKeys = new Set((await db.prepare(`SELECT DISTINCT difficulty_id, category FROM competition_records
    WHERE user_id = ? AND verified = 1`).bind(userId).all<{ difficulty_id: string; category: string }>())
    .results.map(row => `r:${row.difficulty_id}:${row.category}`));
  for (const item of items) {
    const owned = item.type === 'achievement'
      ? (achievements.get(item.id) ?? 0) > 0
      : recordKeys.has(showcaseKey(item));
    if (!owned) return { error: 'showcase_item_not_owned' };
  }
  await db.prepare('UPDATE profiles SET showcase_json = ?, updated_at = ? WHERE user_id = ?')
    .bind(JSON.stringify(items), Date.now(), userId).run();
  return { items };
}

/**
 * The mural actually shown: the player's own pick, or — while they have not
 * chosen anything — their highest and rarest achievements, then the records of
 * the hardest difficulty they hold records on.
 */
export function automaticShowcase(
  achievements: AchievementState[],
  rarity: AchievementRarity,
  recordKeys: Array<{ difficultyId: string; category: string }>,
): ShowcaseItem[] {
  const unlocked = achievements
    .filter(state => state.level > 0)
    .sort((a, b) => b.level - a.level
      || (rarity.percentByAchievement[a.id]?.[a.level - 1] ?? 100) - (rarity.percentByAchievement[b.id]?.[b.level - 1] ?? 100)
      || ACHIEVEMENTS.findIndex(d => d.id === a.id) - ACHIEVEMENTS.findIndex(d => d.id === b.id));
  const items: ShowcaseItem[] = unlocked.slice(0, SHOWCASE_MAX_ITEMS).map(state => ({ type: 'achievement', id: state.id }));
  const hardest = [...RANKED_DIFFICULTY_IDS].reverse().find(id => recordKeys.some(record => record.difficultyId === id));
  if (hardest) {
    for (const record of recordKeys.filter(record => record.difficultyId === hardest)) {
      if (items.length >= SHOWCASE_MAX_ITEMS) break;
      const item = sanitizeShowcase([{ type: 'record', difficultyId: record.difficultyId, category: record.category }]);
      if (item?.[0]) items.push(item[0]);
    }
  }
  return items;
}

export function isKnownAchievement(id: string): boolean {
  return ACHIEVEMENT_BY_ID.has(id);
}
