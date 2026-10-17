// Ranking seasons on the server: the season window applied to the score ranking
// and records, and the one-time payment of each closed season's top 10.
// Rules and calendar live in shared/game/seasons.ts.

import type { RankedDifficultyId } from '../shared/game/competitionRanking.js';
import {
  currentSeason, isValidSeason, seasonBounds, seasonPrize, SEASON_PRIZE_POSITIONS, SEASON_THEMES,
  type SeasonBounds, type SeasonPrize,
} from '../shared/game/seasons.js';

/** `?season=N` (default: the current season). */
export function seasonFromUrl(url: URL, now = Date.now()): { bounds: SeasonBounds; invalid: boolean } {
  const raw = url.searchParams.get('season');
  if (raw === null || raw === '') return { bounds: seasonBounds(currentSeason(now)), invalid: false };
  const season = Number(raw);
  return isValidSeason(season, now)
    ? { bounds: seasonBounds(season), invalid: false }
    : { bounds: seasonBounds(currentSeason(now)), invalid: true };
}

/** Per-account totals of one season. Binds: start, end[, difficulty]. */
export function scoreTotalsSql(difficulty: RankedDifficultyId | null): string {
  return `SELECT user_id,
        SUM(competition_points) AS points,
        SUM(CASE WHEN competition_points > 0 THEN 1 ELSE 0 END) AS scored_competitions,
        SUM(champion) AS titles
      FROM competition_history
      WHERE completed_at >= ? AND completed_at < ?${difficulty ? ' AND difficulty_id = ?' : ''}
      GROUP BY user_id`;
}

export function scoreTotalsBinds(bounds: SeasonBounds, difficulty: RankedDifficultyId | null): unknown[] {
  return [bounds.start, bounds.end, ...(difficulty ? [difficulty] : [])];
}

/** Ranking order shared by the leaderboard, the viewer's position and the season payment. */
export const SCORE_RANKING_ORDER = 'totals.points DESC, totals.titles DESC, totals.scored_competitions DESC, LOWER(p.username) ASC';

const FINALIZE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
let lastFinalizeCheck = 0;

function seasonSource(season: number): string {
  return `season-${season}`;
}

/** Grants of one prize, all guarded by the reward row still being unclaimed (one transaction with the claim). */
function grantStatements(db: D1Database, season: number, userId: string, prize: SeasonPrize, now: number): D1PreparedStatement[] {
  const unclaimed = 'EXISTS (SELECT 1 FROM season_rewards WHERE season = ? AND user_id = ? AND claimed_at IS NULL)';
  const theme = SEASON_THEMES[season];
  const source = seasonSource(season);
  const statements: D1PreparedStatement[] = [];
  if (prize.coins > 0) {
    statements.push(db.prepare(`INSERT INTO user_album (user_id, coins, created_at, updated_at)
      SELECT ?, ?, ?, ? WHERE ${unclaimed}
      ON CONFLICT(user_id) DO UPDATE SET coins = user_album.coins + excluded.coins, updated_at = excluded.updated_at`)
      .bind(userId, prize.coins, now, now, season, userId));
  }
  for (const [tier, quantity] of Object.entries(prize.packs)) {
    if (!quantity) continue;
    statements.push(db.prepare(`INSERT INTO user_inventory (user_id, item_key, quantity, updated_at)
      SELECT ?, ?, ?, ? WHERE ${unclaimed}
      ON CONFLICT(user_id, item_key) DO UPDATE SET quantity = user_inventory.quantity + excluded.quantity, updated_at = excluded.updated_at`)
      .bind(userId, `pack:${tier}`, quantity, now, season, userId));
  }
  if (theme && prize.frame) {
    statements.push(db.prepare('INSERT OR IGNORE INTO user_frames (user_id, frame_key, event_id, unlocked_at) VALUES (?, ?, ?, ?)')
      .bind(userId, theme.frameKey, source, now));
  }
  if (theme && prize.cover) {
    statements.push(db.prepare('INSERT OR IGNORE INTO user_covers (user_id, cover_key, source, unlocked_at) VALUES (?, ?, ?, ?)')
      .bind(userId, theme.coverKey, source, now));
  }
  if (theme && prize.card) {
    statements.push(db.prepare('INSERT OR IGNORE INTO user_event_cards (user_id, card_id, event_id, unlocked_at) VALUES (?, ?, ?, ?)')
      .bind(userId, theme.cardId, source, now));
  }
  // Last: once claimed, every guarded grant above becomes a no-op on a retry.
  statements.push(db.prepare('UPDATE season_rewards SET claimed_at = ? WHERE season = ? AND user_id = ? AND claimed_at IS NULL')
    .bind(now, season, userId));
  return statements;
}

/** Freezes the final top 10 of a closed season. Nothing is paid here: each account claims its prize. */
async function finalizeSeason(db: D1Database, season: number, now: number): Promise<void> {
  const bounds = seasonBounds(season);
  const rows = await db.prepare(`WITH totals AS (${scoreTotalsSql(null)})
    SELECT totals.user_id, totals.points
    FROM totals
    JOIN profiles p ON p.user_id = totals.user_id
    WHERE p.visibility = 'public' AND totals.points > 0
    ORDER BY ${SCORE_RANKING_ORDER}
    LIMIT ${SEASON_PRIZE_POSITIONS}`).bind(...scoreTotalsBinds(bounds, null)).all<{ user_id: string; points: number }>();
  const statements = rows.results.flatMap((row, index) => {
    const prize = seasonPrize(index + 1);
    return prize ? [db.prepare(`INSERT OR IGNORE INTO season_rewards (season, user_id, position, points, coins, granted_at)
      VALUES (?, ?, ?, ?, ?, ?)`).bind(season, row.user_id, index + 1, Number(row.points), prize.coins, now)] : [];
  });
  statements.push(db.prepare('INSERT OR IGNORE INTO season_finalizations (season, finalized_at) VALUES (?, ?)').bind(season, now));
  // One transaction: the season's standings are frozen all at once.
  await db.batch(statements);
}

/** Claims the viewer's prize of a closed season. Idempotent: a second claim changes nothing. */
export async function claimSeasonReward(db: D1Database, userId: string, season: number, now = Date.now()): Promise<SeasonRewardRow | null> {
  await finalizeEndedSeasons(db, now, true);
  const reward = await loadSeasonReward(db, userId, season);
  if (!reward) return null;
  if (reward.claimed_at === null) {
    const prize = seasonPrize(reward.position);
    if (prize) await db.batch(grantStatements(db, season, userId, prize, now));
  }
  return loadSeasonReward(db, userId, season);
}

/**
 * Freezes the standings of every closed season not frozen yet. Called lazily from ranking and
 * account requests (at most once every few minutes per isolate); the guarded
 * grants make concurrent calls safe.
 */
export async function finalizeEndedSeasons(db: D1Database, now = Date.now(), force = false): Promise<void> {
  if (!force && now - lastFinalizeCheck < FINALIZE_CHECK_INTERVAL_MS) return;
  lastFinalizeCheck = now;
  const closed = currentSeason(now);
  if (closed === 0) return;
  const done = await db.prepare('SELECT season FROM season_finalizations').all<{ season: number }>()
    .catch(error => { console.error('season_finalize_failed', error); lastFinalizeCheck = 0; return null; });
  if (!done) return;
  const paid = new Set(done.results.map(row => Number(row.season)));
  for (let season = 0; season < closed; season += 1) {
    if (paid.has(season)) continue;
    try {
      await finalizeSeason(db, season, now);
    } catch (error) {
      // Never break the ranking or login because of a payment; retry on the next check.
      console.error('season_finalize_failed', season, error);
      lastFinalizeCheck = 0;
      return;
    }
  }
}

export interface SeasonRewardRow {
  season: number;
  position: number;
  points: number;
  coins: number;
  granted_at: number;
  /** null while the prize waits to be claimed. */
  claimed_at: number | null;
}

/** The viewer's prize for one season, once it closed and they finished in the top 10. */
export async function loadSeasonReward(db: D1Database, userId: string, season: number): Promise<SeasonRewardRow | null> {
  const row = await db.prepare('SELECT season, position, points, coins, granted_at, claimed_at FROM season_rewards WHERE season = ? AND user_id = ?')
    .bind(season, userId).first<SeasonRewardRow>();
  return row ? { ...row, season: Number(row.season), position: Number(row.position), points: Number(row.points), coins: Number(row.coins), granted_at: Number(row.granted_at), claimed_at: row.claimed_at == null ? null : Number(row.claimed_at) } : null;
}
