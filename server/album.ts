// Server side of the sticker album (rules: shared/game/album.ts). The server alone grants,
// opens, sells and buys: packs come from the stored competition history (each finished
// competition once) and from completed pages; stickers are drawn here.
// Every change is written in one batch, so a failure never leaves half an operation behind.

import {
  albumCatalog,
  campaignGrant,
  CLUB_PAGE_RECOMPLETE,
  clubRewardKeys,
  MAX_COPIES,
  parseItemKey,
  regionPageReward,
  rollItem,
  SELL_VALUE,
  SHOP_PACK_PRICE,
  type AlbumItemKey,
  type AlbumPackTier,
} from '../shared/game/album.js';
import { isRankedDifficulty } from '../shared/game/competitionRanking.js';

export type GrantSource = 'campaign' | 'page' | 'shop';
export interface ItemGrant { key: AlbumItemKey; source: GrantSource; competitionId?: string; pageId?: string }

/** A page completed by the last operation and what it unlocked. */
export interface PageReward {
  pageId: string;
  /** First completion of a club's own page: its profile frame and cover. */
  frameKey: string | null;
  coverKey: string | null;
  items: AlbumItemKey[];
  recompleted: boolean;
}

export interface AlbumState {
  coins: number;
  inventory: Record<string, number>;
  /** [cardId, copies applied, spare copies]. */
  stickers: [string, number, number][];
  /** Pages completed (at their current size or before). */
  completedPages: string[];
  /** Number of times each page has been completed, used to explain repeat rewards. */
  pageCompletionCounts: Record<string, number>;
}

interface Row { [key: string]: unknown }

type Statement = D1PreparedStatement;

/** A fair 0 ≤ x < 1 from the platform's cryptographic generator. */
export function secureRandom(): number {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return buffer[0] / 4294967296;
}

function addItemStatement(db: D1Database, userId: string, key: AlbumItemKey, quantity: number, now: number): Statement {
  return db.prepare(`INSERT INTO user_inventory (user_id, item_key, quantity, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, item_key) DO UPDATE SET quantity = user_inventory.quantity + excluded.quantity, updated_at = excluded.updated_at`)
    .bind(userId, key, quantity, now);
}

/** Items grouped by key, for one inventory statement each. */
function countItems(items: readonly AlbumItemKey[]): Map<AlbumItemKey, number> {
  const counts = new Map<AlbumItemKey, number>();
  for (const key of items) counts.set(key, (counts.get(key) ?? 0) + 1);
  return counts;
}

function addItemsStatements(db: D1Database, userId: string, items: readonly AlbumItemKey[], now: number): Statement[] {
  return Array.from(countItems(items).entries()).map(([key, quantity]) => addItemStatement(db, userId, key, quantity, now));
}

/**
 * Creates the account's album row the first time it is needed. The timestamp marks when campaign
 * rewards start for this account; opening the album never gives a welcome pack.
 */
export async function ensureAlbum(db: D1Database, userId: string, now = Date.now()): Promise<number> {
  await db.prepare(`INSERT INTO user_album (user_id, coins, created_at, updated_at) VALUES (?, 0, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      created_at = MIN(user_album.created_at, excluded.created_at),
      updated_at = MAX(user_album.updated_at, excluded.updated_at)`)
    .bind(userId, now, now).run();
  const row = await db.prepare('SELECT created_at FROM user_album WHERE user_id = ?').bind(userId).first<{ created_at: number }>();
  return row?.created_at ?? now;
}

/**
 * Grants every unclaimed competition saved since this account's album was initialized: an
 * envelope of its difficulty, a pack for a title, and a second pack for the first title at that
 * difficulty. The ledger prevents repeat grants.
 */
export async function syncCampaignGrants(db: D1Database, userId: string, albumCreatedAt: number, now = Date.now()): Promise<ItemGrant[]> {
  const pending = await db.prepare(`SELECT h.id, h.difficulty_id, h.champion, h.completed_at FROM competition_history h
      LEFT JOIN album_competition_grants g ON g.competition_id = h.id
      WHERE h.user_id = ? AND h.completed_at >= ? AND g.competition_id IS NULL
      ORDER BY h.completed_at ASC, h.id ASC`).bind(userId, albumCreatedAt).all<{ id: string; difficulty_id: string; champion: number; completed_at: number }>();
  if (pending.results.length === 0) return [];
  // Titles before each competition, per difficulty (the first title there is worth an extra pack).
  const titles = await db.prepare('SELECT difficulty_id, completed_at FROM competition_history WHERE user_id = ? AND champion = 1')
    .bind(userId).all<{ difficulty_id: string; completed_at: number }>();
  const grants: ItemGrant[] = [];
  const statements: Statement[] = [];
  for (const row of pending.results) {
    statements.push(db.prepare('INSERT OR IGNORE INTO album_competition_grants (competition_id, user_id, granted_at) VALUES (?, ?, ?)').bind(row.id, userId, now));
    if (!isRankedDifficulty(row.difficulty_id)) continue;
    const tier = row.difficulty_id as AlbumPackTier;
    const champion = row.champion === 1;
    const firstTitle = champion && !titles.results.some(t => t.difficulty_id === row.difficulty_id && t.completed_at < row.completed_at);
    for (const key of campaignGrant(tier, champion, firstTitle)) grants.push({ key, source: 'campaign', competitionId: row.id });
  }
  statements.push(...addItemsStatements(db, userId, grants.map(g => g.key), now));
  await db.batch(statements);
  return grants;
}

async function loadStickers(db: D1Database, userId: string): Promise<Map<string, { copies: number; spare: number }>> {
  const rows = await db.prepare('SELECT card_id, copies, spare FROM user_stickers WHERE user_id = ?').bind(userId).all<{ card_id: string; copies: number; spare: number }>();
  const catalog = albumCatalog();
  // Cards that left the catalogue are kept in the table but not shown.
  return new Map(rows.results.filter(r => catalog.stickers.has(r.card_id)).map(r => [r.card_id, { copies: r.copies, spare: r.spare }]));
}

export async function loadAlbumState(db: D1Database, userId: string): Promise<AlbumState> {
  const [album, inventory, stickers, pages] = await Promise.all([
    db.prepare('SELECT coins FROM user_album WHERE user_id = ?').bind(userId).first<{ coins: number }>(),
    db.prepare('SELECT item_key, quantity FROM user_inventory WHERE user_id = ? AND quantity > 0').bind(userId).all<{ item_key: string; quantity: number }>(),
    loadStickers(db, userId),
    db.prepare('SELECT page_id, completions FROM user_album_pages WHERE user_id = ?').bind(userId).all<{ page_id: string; completions: number }>(),
  ]);
  return {
    coins: album?.coins ?? 0,
    inventory: Object.fromEntries(inventory.results.filter(r => parseItemKey(r.item_key)).map(r => [r.item_key, r.quantity])),
    stickers: Array.from(stickers.entries()).map(([id, s]) => [id, s.copies, s.spare]),
    completedPages: pages.results.map(r => r.page_id),
    pageCompletionCounts: Object.fromEntries(pages.results.map(r => [r.page_id, r.completions])),
  };
}

/** Everything the album screen needs, after granting any eligible campaign packs. */
export async function syncAlbum(db: D1Database, userId: string, now = Date.now()): Promise<{ state: AlbumState; grants: ItemGrant[] }> {
  const albumCreatedAt = await ensureAlbum(db, userId, now);
  const campaign = await syncCampaignGrants(db, userId, albumCreatedAt, now);
  return { state: await loadAlbumState(db, userId), grants: campaign };
}

/**
 * Checks the pages the given cards belong to and rewards those just completed: a club's own page
 * gives its profile frame and cover the first time (and a pack whenever it grew and is completed
 * again); a region's page gives packs. Returns the statements to write and what they grant.
 */
async function pageRewards(db: D1Database, userId: string, cardIds: readonly string[], owned: ReadonlySet<string>, now: number): Promise<{ statements: Statement[]; rewards: PageReward[] }> {
  const catalog = albumCatalog();
  const pageIds = new Set(cardIds.map(id => catalog.stickers.get(id)?.pageId).filter((id): id is string => !!id));
  if (pageIds.size === 0) return { statements: [], rewards: [] };
  const done = await db.prepare('SELECT page_id, completed_size FROM user_album_pages WHERE user_id = ?').bind(userId).all<{ page_id: string; completed_size: number }>();
  const previous = new Map(done.results.map(r => [r.page_id, r.completed_size]));
  const statements: Statement[] = [];
  const rewards: PageReward[] = [];
  for (const pageId of Array.from(pageIds)) {
    const page = catalog.pageById.get(pageId)!;
    if (!page.stickers.every(id => owned.has(id))) continue;
    const size = page.stickers.length;
    const before = previous.get(pageId);
    if (before !== undefined && before >= size) continue; // already rewarded at this size
    const recompleted = before !== undefined;
    let frameKey: string | null = null;
    let coverKey: string | null = null;
    let items: AlbumItemKey[];
    if (page.kind === 'club') {
      items = recompleted ? [...CLUB_PAGE_RECOMPLETE] : [];
      if (!recompleted) {
        ({ frameKey, coverKey } = clubRewardKeys(page.clubId!));
        statements.push(
          db.prepare('INSERT OR IGNORE INTO user_frames (user_id, frame_key, event_id, unlocked_at) VALUES (?, ?, ?, ?)').bind(userId, frameKey, 'album', now),
          db.prepare('INSERT OR IGNORE INTO user_covers (user_id, cover_key, source, unlocked_at) VALUES (?, ?, ?, ?)').bind(userId, coverKey, 'album', now),
        );
      }
    } else {
      items = regionPageReward(size, recompleted);
    }
    statements.push(...addItemsStatements(db, userId, items, now));
    statements.push(db.prepare(`INSERT INTO user_album_pages (user_id, page_id, completed_size, completions, completed_at) VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(user_id, page_id) DO UPDATE SET completed_size = excluded.completed_size, completions = user_album_pages.completions + 1, completed_at = excluded.completed_at`)
      .bind(userId, pageId, size, now));
    rewards.push({ pageId, frameKey, coverKey, items, recompleted });
  }
  return { statements, rewards };
}

/** Re-checks page rewards after a new card arrives through a friend trade. */
export async function syncAlbumPagesForCards(db: D1Database, userId: string, cardIds: readonly string[], now = Date.now()): Promise<PageReward[]> {
  const owned = new Set((await loadStickers(db, userId)).keys());
  const { statements, rewards } = await pageRewards(db, userId, cardIds, owned, now);
  if (statements.length > 0) await db.batch(statements);
  return rewards;
}

function stickerUpsert(db: D1Database, userId: string, cardId: string, now: number): Statement {
  // New: the first copy is applied. Already in the album: one more spare copy.
  return db.prepare(`INSERT INTO user_stickers (user_id, card_id, copies, spare, first_at, updated_at) VALUES (?, ?, 1, 0, ?, ?)
    ON CONFLICT(user_id, card_id) DO UPDATE SET spare = user_stickers.spare + 1, updated_at = excluded.updated_at`)
    .bind(userId, cardId, now, now);
}

export interface OpenResult {
  item: AlbumItemKey;
  /** In the order drawn; `isNew`: it took its place in the album (else a spare copy). */
  cards: { id: string; isNew: boolean }[];
  pageRewards: PageReward[];
}

/** Opens one pack or envelope from the inventory. */
export async function openItem(db: D1Database, userId: string, itemKey: string, rand: () => number = secureRandom, now = Date.now()): Promise<OpenResult | { error: string }> {
  if (!parseItemKey(itemKey)) return { error: 'invalid_item' };
  const key = itemKey as AlbumItemKey;
  // Take it out of the inventory first: two opens of the last one cannot both succeed.
  const taken = await db.prepare('UPDATE user_inventory SET quantity = quantity - 1, updated_at = ? WHERE user_id = ? AND item_key = ? AND quantity > 0')
    .bind(now, userId, key).run();
  if ((taken.meta?.changes ?? 0) === 0) return { error: 'item_not_owned' };
  try {
    return { item: key, ...(await placeStickers(db, userId, rollItem(key, rand), now)) };
  } catch (error) {
    // Give the item back: the draw was not stored.
    await db.prepare('UPDATE user_inventory SET quantity = quantity + 1, updated_at = ? WHERE user_id = ? AND item_key = ?').bind(now, userId, key).run();
    throw error;
  }
}

/** Places drawn stickers in the album (a new one, or a spare copy of one it has) and grants what
 *  the pages they complete unlock. Stickers only come from packs and envelopes. */
export async function placeStickers(db: D1Database, userId: string, drawn: readonly string[], now = Date.now()): Promise<Omit<OpenResult, 'item'>> {
  const stickers = await loadStickers(db, userId);
  const owned = new Set(stickers.keys());
  const cards = drawn.map(id => {
    const isNew = !owned.has(id);
    owned.add(id);
    return { id, isNew };
  });
  const pages = await pageRewards(db, userId, cards.filter(c => c.isNew).map(c => c.id), owned, now);
  await db.batch([...drawn.map(id => stickerUpsert(db, userId, id, now)), ...pages.statements]);
  return { cards, pageRewards: pages.rewards };
}

/** Applies one spare copy of a card to it (its album level goes up at 2, 4, 7 and 10 copies). */
export async function applyCopy(db: D1Database, userId: string, cardId: string, now = Date.now()): Promise<{ ok: true } | { error: string }> {
  const result = await db.prepare('UPDATE user_stickers SET copies = copies + 1, spare = spare - 1, updated_at = ? WHERE user_id = ? AND card_id = ? AND spare > 0 AND copies < ?')
    .bind(now, userId, cardId, MAX_COPIES).run();
  if ((result.meta?.changes ?? 0) === 0) {
    const row = await db.prepare('SELECT copies, spare FROM user_stickers WHERE user_id = ? AND card_id = ?').bind(userId, cardId).first<{ copies: number; spare: number }>();
    if (!row || row.spare <= 0) return { error: 'no_spare_copy' };
    return { error: 'max_level' };
  }
  return { ok: true };
}

/** Sells spare copies of a card for album coins. */
export async function sellCopies(db: D1Database, userId: string, cardId: string, quantity: number, now = Date.now()): Promise<{ coins: number } | { error: string }> {
  const sticker = albumCatalog().stickers.get(cardId);
  if (!sticker) return { error: 'invalid_card' };
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999) return { error: 'invalid_quantity' };
  const earned = SELL_VALUE[sticker.rarity] * quantity;
  const taken = await db.prepare('UPDATE user_stickers SET spare = spare - ?, updated_at = ? WHERE user_id = ? AND card_id = ? AND spare >= ?')
    .bind(quantity, now, userId, cardId, quantity).run();
  if ((taken.meta?.changes ?? 0) === 0) return { error: 'no_spare_copy' };
  try {
    await db.prepare('UPDATE user_album SET coins = coins + ?, updated_at = ? WHERE user_id = ?').bind(earned, now, userId).run();
  } catch (error) {
    await db.prepare('UPDATE user_stickers SET spare = spare + ?, updated_at = ? WHERE user_id = ? AND card_id = ?').bind(quantity, now, userId, cardId).run();
    throw error;
  }
  return { coins: earned };
}

async function spendCoins(db: D1Database, userId: string, price: number, now: number): Promise<boolean> {
  const paid = await db.prepare('UPDATE user_album SET coins = coins - ?, updated_at = ? WHERE user_id = ? AND coins >= ?').bind(price, now, userId, price).run();
  return (paid.meta?.changes ?? 0) > 0;
}

/** Buys a pack from the album shop (Bronze, Prata or Ouro). It goes to the inventory. */
export async function buyPack(db: D1Database, userId: string, tier: string, now = Date.now()): Promise<{ item: AlbumItemKey } | { error: string }> {
  const price = (SHOP_PACK_PRICE as Record<string, number | undefined>)[tier];
  if (!price) return { error: 'not_for_sale' };
  if (!(await spendCoins(db, userId, price, now))) return { error: 'not_enough_coins' };
  const key = `pack:${tier}` as AlbumItemKey;
  try {
    await addItemStatement(db, userId, key, 1, now).run();
  } catch (error) {
    await db.prepare('UPDATE user_album SET coins = coins + ?, updated_at = ? WHERE user_id = ?').bind(price, now, userId).run();
    throw error;
  }
  return { item: key };
}


/** The album in a profile: how much of it is filled and which pages are complete. */
export async function albumSummary(db: D1Database, userId: string): Promise<{ owned: number; total: number; completedPages: number; clubsCompleted: string[] } | null> {
  const album = await db.prepare('SELECT 1 AS ok FROM user_album WHERE user_id = ?').bind(userId).first<Row>();
  if (!album) return null;
  const catalog = albumCatalog();
  const [stickers, pages] = await Promise.all([
    loadStickers(db, userId),
    db.prepare('SELECT page_id FROM user_album_pages WHERE user_id = ?').bind(userId).all<{ page_id: string }>(),
  ]);
  const completed = pages.results.map(r => r.page_id).filter(id => catalog.pageById.has(id));
  return {
    owned: stickers.size,
    total: catalog.total,
    completedPages: completed.length,
    clubsCompleted: completed.filter(id => id.startsWith('club:')).map(id => id.slice(5)),
  };
}

/** Club frames and covers this account unlocked (the profile accepts them as its own). */
export async function loadOwnedCovers(db: D1Database, userId: string): Promise<string[]> {
  const rows = await db.prepare('SELECT cover_key FROM user_covers WHERE user_id = ? ORDER BY unlocked_at').bind(userId).all<{ cover_key: string }>();
  return rows.results.map(r => r.cover_key);
}
