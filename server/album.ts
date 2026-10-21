// Server side of the sticker album (rules: shared/game/album.ts). The server alone grants,
// opens, sells and buys: packs come from the stored competition history (each finished
// competition once) and from completed pages; stickers are drawn here.
// Every change is written in one batch, so a failure never leaves half an operation behind.

import {
  albumCatalog,
  campaignGrant,
  CLUB_PAGE_RECOMPLETE,
  clubRewardKeys,
  DAILY_BANNER_PITY_LIMIT,
  DAILY_BANNER_ODDS,
  DAILY_BANNER_PRICE,
  MAX_BULK_ITEM_OPEN,
  MAX_COPIES,
  levelForCopies,
  pageBonusSnapshotForOwnedCards,
  parseItemKey,
  regionPageReward,
  rollItem,
  SELL_VALUE,
  SHOP_PACK_PRICE,
  WEEKLY_BANNER_PITY_LIMIT,
  WEEKLY_BANNER_ODDS,
  WEEKLY_BANNER_PRICE,
  type AlbumItemKey,
  type AlbumLevel,
  type AlbumPageBonus,
  type AlbumPackTier,
  type DailyBannerOffer,
  type DailyBannerRotations,
  type WeeklyBannerOffer,
  type WeeklyBannerRotations,
} from '../shared/game/album.js';
import { PLAYERS, STORE_UNIQUE_CARDS, type Rarity } from '../shared/game/gameData.js';
import { AVATAR_FRAME_BY_KEY } from '../shared/game/events.js';
import { PROFILE_COVER_BY_KEY } from '../shared/profileCovers.js';
import { NAME_STYLE_BY_KEY } from '../shared/game/nameStyles.js';
import { loadOwnedEventCards } from './events.js';
import {
  competitionCoinReward,
  isCompetitionFinishStage,
  isRankedDifficulty,
  isWeekendCompetitionCoinBonusActive,
  WEEKEND_COMPETITION_COIN_MULTIPLIER,
} from '../shared/game/competitionRanking.js';

export type GrantSource = 'campaign' | 'page' | 'shop' | 'achievement';
export interface ItemGrant {
  key: AlbumItemKey;
  source: GrantSource;
  competitionId?: string;
  pageId?: string;
  coinsAwarded?: number;
  achievementId?: string;
  achievementLevel?: number;
}

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
  /** Misses tracked independently per banner; kept across daily rotations. */
  bannerPity: { daily: number; weekly: number };
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

const DAY_MS = 24 * 60 * 60 * 1000;
const BANNER_RARITIES: readonly Rarity[] = ['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique'];
const DAILY_FEATURED_COUNTS: Partial<Record<Rarity, number>> = { gold: 4, legendary: 4, immortal: 1 };
const FEATURED_LEGENDARY_COUNT = 4;
const FEATURED_IMMORTAL_COUNT = 4;
const FEATURED_UNIQUE_COUNT = 1;

function seededRandom(seedText: string): () => number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < seedText.length; index++) {
    hash = Math.imul(hash ^ seedText.charCodeAt(index), 0x01000193);
  }
  let state = hash | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Each banner gets its own stable daily shuffle; one banner never filters the other. */
function selectFeaturedCards(pool: readonly string[], count: number, seed: string): string[] {
  const shuffled = [...pool].sort();
  const rand = seededRandom(seed);
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rand() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function featuredPlayerCards(rarity: Rarity, count: number, dayStart: string, bannerId: 'banner-1' | 'banner-2'): string[] {
  const pool = PLAYERS.filter(card => card.rarity === rarity).map(card => card.id);
  return selectFeaturedCards(pool, count, `${bannerId}:${dayStart}:${rarity}`);
}

function dailyFeaturedCards(dayStart: string): Record<Rarity, string[]> {
  const cards: Record<Rarity, string[]> = {
    bronze: [],
    silver: [],
    gold: [],
    legendary: [],
    immortal: [],
    unique: [],
  };
  for (const [rarity, count] of Object.entries(DAILY_FEATURED_COUNTS) as [Rarity, number][]) {
    cards[rarity] = featuredPlayerCards(rarity, count, dayStart, 'banner-1');
  }
  return cards;
}

/** Stable São Paulo day id and deterministic Banner 2 lineup, shared by all accounts. */
export function weeklyBannerOffer(now = Date.now()): WeeklyBannerOffer {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const localDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const dayStart = localDate.toISOString().slice(0, 10);
  const cards = {} as Record<Rarity, string[]>;
  const odds = { ...WEEKLY_BANNER_ODDS };
  if (STORE_UNIQUE_CARDS.length < FEATURED_UNIQUE_COUNT) {
    // Do not advertise or charge for an exclusive slot until its authored card exists.
    odds.unique = 0;
    odds.gold += WEEKLY_BANNER_ODDS.unique;
  }
  for (const rarity of BANNER_RARITIES) {
    if (rarity === 'unique') {
      const uniquePool = [...STORE_UNIQUE_CARDS].sort((a, b) => a.id.localeCompare(b.id));
      const count = Math.min(FEATURED_UNIQUE_COUNT, uniquePool.length);
      cards.unique = selectFeaturedCards(uniquePool.map(card => card.id), count, `banner-2:${dayStart}:unique`);
      continue;
    }
    if (rarity !== 'legendary' && rarity !== 'immortal') {
      cards[rarity] = [];
      continue;
    }
    const featuredCount = rarity === 'legendary' ? FEATURED_LEGENDARY_COUNT : FEATURED_IMMORTAL_COUNT;
    cards[rarity] = featuredPlayerCards(rarity, featuredCount, dayStart, 'banner-2');
  }
  return {
    dayStart,
    // São Paulo's daily reset is midnight (UTC−3).
    endsAt: localDate.getTime() + DAY_MS + 3 * 60 * 60 * 1000,
    price: WEEKLY_BANNER_PRICE,
    odds,
    cards,
  };
}

/** Current Banner 2 offer and a read-only preview of tomorrow's São Paulo rotation. */
export function weeklyBannerRotations(now = Date.now()): WeeklyBannerRotations {
  return {
    current: weeklyBannerOffer(now),
    next: weeklyBannerOffer(now + DAY_MS),
  };
}

/** Stable daily lineup, shared by all accounts and reset at midnight in São Paulo. */
export function dailyBannerOffer(now = Date.now()): DailyBannerOffer {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(now));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const localDate = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const dayStart = localDate.toISOString().slice(0, 10);
  const cards = dailyFeaturedCards(dayStart);

  return {
    dayStart,
    // São Paulo's daily reset is midnight (UTC−3).
    endsAt: localDate.getTime() + DAY_MS + 3 * 60 * 60 * 1000,
    price: DAILY_BANNER_PRICE,
    odds: DAILY_BANNER_ODDS,
    cards,
  };
}

/** Current daily offer and a read-only preview of tomorrow's São Paulo rotation. */
export function dailyBannerRotations(now = Date.now()): DailyBannerRotations {
  return {
    current: dailyBannerOffer(now),
    next: dailyBannerOffer(now + DAY_MS),
  };
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
 * envelope of its difficulty, a pack for a title, and coins based on finish stage and difficulty.
 * The ledger prevents repeat grants.
 */
export async function syncCampaignGrants(db: D1Database, userId: string, albumCreatedAt: number, now = Date.now()): Promise<ItemGrant[]> {
  const pending = await db.prepare(`SELECT h.id, h.difficulty_id, h.champion, h.finish_stage, h.completed_at FROM competition_history h
      LEFT JOIN album_competition_grants g ON g.competition_id = h.id
      WHERE h.user_id = ? AND h.completed_at >= ? AND g.competition_id IS NULL
      ORDER BY h.completed_at ASC, h.id ASC`).bind(userId, albumCreatedAt).all<{ id: string; difficulty_id: string; champion: number; finish_stage: string | null; completed_at: number }>();
  if (pending.results.length === 0) return [];
  const statements: Statement[] = [];
  const ledgerStatementIndexes: number[] = [];
  const grantsByCompetition: ItemGrant[][] = [];
  for (const row of pending.results) {
    if (!isRankedDifficulty(row.difficulty_id)) {
      ledgerStatementIndexes.push(statements.length);
      statements.push(db.prepare('INSERT OR IGNORE INTO album_competition_grants (competition_id, user_id, granted_at, coins_awarded) VALUES (?, ?, ?, 0)').bind(row.id, userId, now));
      grantsByCompetition.push([]);
      continue;
    }
    const tier = row.difficulty_id as AlbumPackTier;
    const champion = row.champion === 1;
    const finishStage = isCompetitionFinishStage(row.finish_stage) ? row.finish_stage : champion ? 'champion' : 'leaguePhase';
    const baseCoinsAwarded = competitionCoinReward(finishStage, tier);
    const coinsAwarded = isWeekendCompetitionCoinBonusActive(row.completed_at)
      ? baseCoinsAwarded * WEEKEND_COMPETITION_COIN_MULTIPLIER
      : baseCoinsAwarded;
    const competitionGrants = campaignGrant(tier, champion).map((key, index): ItemGrant => ({
      key,
      source: 'campaign',
      competitionId: row.id,
      ...(index === 0 ? { coinsAwarded } : {}),
    }));
    ledgerStatementIndexes.push(statements.length);
    statements.push(db.prepare('INSERT OR IGNORE INTO album_competition_grants (competition_id, user_id, granted_at, coins_awarded) VALUES (?, ?, ?, ?)').bind(row.id, userId, now, coinsAwarded));
    // Insert the matching inventory rewards only when this call claimed the ledger row.
    // `changes()` observes the preceding INSERT OR IGNORE inside this D1 batch, so a retry
    // cannot duplicate either the coins (credited by the trigger) or the inventory items.
    for (const key of competitionGrants.map(grant => grant.key)) {
      statements.push(db.prepare(`INSERT INTO user_inventory (user_id, item_key, quantity, updated_at)
        SELECT ?, ?, 1, ? WHERE changes() = 1
        ON CONFLICT(user_id, item_key) DO UPDATE SET quantity = user_inventory.quantity + 1, updated_at = excluded.updated_at`)
        .bind(userId, key, now));
    }
    grantsByCompetition.push(competitionGrants);
  }
  const results = await db.batch(statements);
  return grantsByCompetition.flatMap((grants, index) => (results[ledgerStatementIndexes[index]]?.meta?.changes ?? 0) > 0 ? grants : []);
}

async function loadStickers(db: D1Database, userId: string): Promise<Map<string, { copies: number; spare: number }>> {
  const rows = await db.prepare('SELECT card_id, copies, spare FROM user_stickers WHERE user_id = ?').bind(userId).all<{ card_id: string; copies: number; spare: number }>();
  const catalog = albumCatalog();
  // Cards that left the catalogue are kept in the table but not shown.
  return new Map(rows.results.filter(r => catalog.stickers.has(r.card_id)).map(r => [r.card_id, { copies: r.copies, spare: r.spare }]));
}

/** Load authoritative competition levels for several accounts in one D1 query. */
export async function loadAlbumLevelSnapshots(
  db: D1Database,
  userIds: readonly (string | undefined)[],
): Promise<Map<string, Partial<Record<string, AlbumLevel>>>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0)));
  const snapshots = new Map<string, Partial<Record<string, AlbumLevel>>>();
  ids.forEach(id => snapshots.set(id, {}));
  if (ids.length === 0) return snapshots;

  const placeholders = ids.map(() => '?').join(', ');
  const rows = await db.prepare(
    `SELECT user_id, card_id, copies FROM user_stickers WHERE user_id IN (${placeholders}) AND copies > 0`,
  ).bind(...ids).all<{ user_id: string; card_id: string; copies: number }>();
  const catalogue = albumCatalog().stickers;
  for (const row of rows.results) {
    if (!catalogue.has(row.card_id)) continue;
    const level = levelForCopies(row.copies);
    if (level !== 0) snapshots.get(row.user_id)![row.card_id] = level;
  }
  return snapshots;
}

/** Load authoritative complete-page bonuses for several accounts in one D1 query. */
export async function loadAlbumPageBonusSnapshots(
  db: D1Database,
  userIds: readonly (string | undefined)[],
): Promise<Map<string, Partial<Record<string, AlbumPageBonus>>>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0)));
  const snapshots = new Map<string, Partial<Record<string, AlbumPageBonus>>>();
  ids.forEach(id => snapshots.set(id, {}));
  if (ids.length === 0) return snapshots;

  const placeholders = ids.map(() => '?').join(', ');
  const rows = await db.prepare(
    `SELECT user_id, card_id FROM user_stickers WHERE user_id IN (${placeholders}) AND copies > 0`,
  ).bind(...ids).all<{ user_id: string; card_id: string }>();
  const knownCardIds = albumCatalog().stickers;
  const ownedByUser = new Map(ids.map(id => [id, new Set<string>()]));
  for (const row of rows.results) {
    if (knownCardIds.has(row.card_id)) ownedByUser.get(row.user_id)?.add(row.card_id);
  }
  for (const id of ids) {
    snapshots.set(id, pageBonusSnapshotForOwnedCards(ownedByUser.get(id) ?? new Set()));
  }
  return snapshots;
}

export async function loadAlbumState(db: D1Database, userId: string): Promise<AlbumState> {
  const [album, inventory, stickers, pages] = await Promise.all([
    db.prepare('SELECT coins, daily_banner_pity, weekly_banner_pity FROM user_album WHERE user_id = ?').bind(userId).first<{ coins: number; daily_banner_pity: number; weekly_banner_pity: number }>(),
    db.prepare('SELECT item_key, quantity FROM user_inventory WHERE user_id = ? AND quantity > 0').bind(userId).all<{ item_key: string; quantity: number }>(),
    loadStickers(db, userId),
    db.prepare('SELECT page_id, completions FROM user_album_pages WHERE user_id = ?').bind(userId).all<{ page_id: string; completions: number }>(),
  ]);
  return {
    coins: album?.coins ?? 0,
    bannerPity: { daily: album?.daily_banner_pity ?? 0, weekly: album?.weekly_banner_pity ?? 0 },
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

function stickerUpserts(db: D1Database, userId: string, cardIds: readonly string[], now: number): Statement[] {
  // Keep each SQL statement under D1's bound-parameter limit without a query per sticker.
  const chunkSize = 24;
  const statements: Statement[] = [];
  for (let start = 0; start < cardIds.length; start += chunkSize) {
    const chunk = cardIds.slice(start, start + chunkSize);
    const values = chunk.map(() => '(?, ?, 1, 0, ?, ?)').join(', ');
    const bindings = chunk.flatMap(cardId => [userId, cardId, now, now]);
    statements.push(db.prepare(`INSERT INTO user_stickers (user_id, card_id, copies, spare, first_at, updated_at) VALUES ${values}
      ON CONFLICT(user_id, card_id) DO UPDATE SET spare = user_stickers.spare + 1, updated_at = excluded.updated_at`)
      .bind(...bindings));
  }
  return statements;
}

export interface OpenResult {
  item: AlbumItemKey;
  /** In the order drawn; `isNew`: it took its place in the album (else a spare copy). */
  cards: { id: string; isNew: boolean }[];
  pageRewards: PageReward[];
}

/** Opens one or more packs or envelopes from the inventory in one atomic batch. */
export async function openItems(db: D1Database, userId: string, itemKey: string, quantity: number, rand: () => number = secureRandom, now = Date.now()): Promise<OpenResult | { error: string }> {
  if (!parseItemKey(itemKey)) return { error: 'invalid_item' };
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_BULK_ITEM_OPEN) return { error: 'invalid_quantity' };
  const key = itemKey as AlbumItemKey;
  // Reserve the whole batch atomically, so another tab cannot spend part of it.
  const taken = await db.prepare('UPDATE user_inventory SET quantity = quantity - ?, updated_at = ? WHERE user_id = ? AND item_key = ? AND quantity >= ?')
    .bind(quantity, now, userId, key, quantity).run();
  if ((taken.meta?.changes ?? 0) === 0) return { error: quantity === 1 ? 'item_not_owned' : 'not_enough_items' };
  try {
    const drawn = Array.from({ length: quantity }, () => rollItem(key, rand)).flat();
    return { item: key, ...(await placeStickers(db, userId, drawn, now)) };
  } catch (error) {
    // Give the items back: the draw was not stored.
    await db.prepare('UPDATE user_inventory SET quantity = quantity + ?, updated_at = ? WHERE user_id = ? AND item_key = ?').bind(quantity, now, userId, key).run();
    throw error;
  }
}

/** Opens one pack or envelope from the inventory. */
export async function openItem(db: D1Database, userId: string, itemKey: string, rand: () => number = secureRandom, now = Date.now()): Promise<OpenResult | { error: string }> {
  return openItems(db, userId, itemKey, 1, rand, now);
}

/** Places drawn stickers in the album (a new one, or a spare copy of one it has) and grants what
 *  the pages they complete unlock. Stickers only come from packs and envelopes. */
export async function placeStickers(db: D1Database, userId: string, drawn: readonly string[], now = Date.now(), extraStatements: readonly Statement[] = []): Promise<Omit<OpenResult, 'item'>> {
  const stickers = await loadStickers(db, userId);
  const owned = new Set(stickers.keys());
  const cards = drawn.map(id => {
    const isNew = !owned.has(id);
    owned.add(id);
    return { id, isNew };
  });
  const pages = await pageRewards(db, userId, cards.filter(c => c.isNew).map(c => c.id), owned, now);
  await db.batch([...stickerUpserts(db, userId, drawn, now), ...pages.statements, ...extraStatements]);
  return { cards, pageRewards: pages.rewards };
}

interface BannerDrawResult {
  card: { id: string; isNew: boolean };
  rarity: Rarity;
  dayStart: string;
  price: number;
  pageRewards: PageReward[];
  pityTriggered: boolean;
}

export interface BannerBatchDrawResult {
  cards: Array<{ card: { id: string; isNew: boolean }; rarity: Rarity; pityTriggered: boolean }>;
  dayStart: string;
  price: number;
  pageRewards: PageReward[];
}

type BannerKind = 'daily' | 'weekly';
const BANNER_PITY: Record<BannerKind, {
  counter: 'daily_banner_pity' | 'weekly_banner_pity';
  lockToken: 'daily_banner_lock_token' | 'weekly_banner_lock_token';
  lockUntil: 'daily_banner_lock_until' | 'weekly_banner_lock_until';
  limit: number;
  guaranteedRarities: readonly Rarity[];
}> = {
  daily: {
    counter: 'daily_banner_pity', lockToken: 'daily_banner_lock_token', lockUntil: 'daily_banner_lock_until',
    limit: DAILY_BANNER_PITY_LIMIT, guaranteedRarities: ['legendary', 'immortal'],
  },
  weekly: {
    counter: 'weekly_banner_pity', lockToken: 'weekly_banner_lock_token', lockUntil: 'weekly_banner_lock_until',
    limit: WEEKLY_BANNER_PITY_LIMIT, guaranteedRarities: ['unique'],
  },
};

/** Weighted draw; when pity is due, renormalize only over its guaranteed rarity group. */
function rollBannerRarity(odds: Readonly<Record<Rarity, number>>, rand: () => number, guaranteed?: readonly Rarity[]): Rarity {
  const eligible = BANNER_RARITIES.filter(rarity => odds[rarity] > 0 && (!guaranteed || guaranteed.includes(rarity)));
  const total = eligible.reduce((sum, rarity) => sum + odds[rarity], 0);
  let roll = rand() * total;
  for (const rarity of eligible) {
    roll -= odds[rarity];
    if (roll < 0) return rarity;
  }
  return eligible[eligible.length - 1] ?? 'bronze';
}

/** A short-lived per-account lock makes the pity counter and draw order safe across tabs/retries. */
async function acquireBannerLock(db: D1Database, userId: string, kind: BannerKind, now: number): Promise<string | null> {
  const settings = BANNER_PITY[kind];
  const token = crypto.randomUUID();
  const result = await db.prepare(`UPDATE user_album SET ${settings.lockToken} = ?, ${settings.lockUntil} = ?
    WHERE user_id = ? AND (${settings.lockUntil} IS NULL OR ${settings.lockUntil} <= ?)`)
    .bind(token, now + 120_000, userId, now).run();
  return (result.meta?.changes ?? 0) > 0 ? token : null;
}

async function releaseBannerLock(db: D1Database, userId: string, kind: BannerKind, token: string): Promise<void> {
  const settings = BANNER_PITY[kind];
  await db.prepare(`UPDATE user_album SET ${settings.lockToken} = NULL, ${settings.lockUntil} = NULL
    WHERE user_id = ? AND ${settings.lockToken} = ?`).bind(userId, token).run();
}

async function buyBannerDraws(
  db: D1Database,
  userId: string,
  kind: BannerKind,
  offer: DailyBannerOffer | WeeklyBannerOffer,
  quantity: number,
  now: number,
  rand: () => number,
): Promise<BannerBatchDrawResult | { error: string }> {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) return { error: 'invalid_quantity' };
  const settings = BANNER_PITY[kind];
  const lockToken = await acquireBannerLock(db, userId, kind, now);
  if (!lockToken) return { error: 'banner_purchase_in_progress' };
  let charged = false;
  try {
    const pityRow = await db.prepare(`SELECT ${settings.counter} AS misses FROM user_album WHERE user_id = ?`)
      .bind(userId).first<{ misses: number }>();
    let misses = pityRow?.misses ?? 0;
    const targetAvailable = kind !== 'weekly' || offer.cards.unique.length > 0;
    const draws: Array<{ id: string; rarity: Rarity; pityTriggered: boolean }> = [];
    for (let index = 0; index < quantity; index++) {
      const pityTriggered = targetAvailable && misses >= settings.limit - 1;
      const rarity = rollBannerRarity(offer.odds, rand, pityTriggered ? settings.guaranteedRarities : undefined);
      const pool = rarity === 'bronze' || rarity === 'silver' || rarity === 'gold'
        ? PLAYERS.filter(card => card.rarity === rarity).map(card => card.id)
        : offer.cards[rarity];
      if (!pool.length) return { error: 'banner_unavailable' };
      const id = pool[Math.floor(rand() * pool.length)];
      draws.push({ id, rarity, pityTriggered });
      if (targetAvailable) misses = settings.guaranteedRarities.includes(rarity) ? 0 : misses + 1;
    }

    const totalPrice = offer.price * quantity;
    if (!(await spendCoins(db, userId, totalPrice, now))) return { error: 'not_enough_coins' };
    charged = true;
    const pityUpdate = db.prepare(`UPDATE user_album SET ${settings.counter} = ?, updated_at = ?
      WHERE user_id = ? AND ${settings.lockToken} = ?`).bind(misses, now, userId, lockToken);
    const extra: Statement[] = [pityUpdate];
    for (const draw of draws) {
      if (draw.rarity === 'unique' && kind === 'weekly') extra.push(db.prepare(
        'INSERT OR IGNORE INTO user_event_cards (user_id, card_id, event_id, unlocked_at) VALUES (?, ?, ?, ?)',
      ).bind(userId, draw.id, `banner-2-${offer.dayStart}`, now));
    }
    const result = await placeStickers(db, userId, draws.map(draw => draw.id), now, extra);
    charged = false;
    return {
      cards: result.cards.map((card, index) => ({ ...draws[index], card })),
      dayStart: offer.dayStart,
      price: totalPrice,
      pageRewards: result.pageRewards,
    };
  } catch (error) {
    if (charged) await db.prepare('UPDATE user_album SET coins = coins + ?, updated_at = ? WHERE user_id = ?').bind(offer.price * quantity, now, userId).run();
    throw error;
  } finally {
    try { await releaseBannerLock(db, userId, kind, lockToken); } catch (error) {
      console.error(`[album] failed to release ${kind} banner lock:`, error);
    }
  }
}

/** Buys several cards from Banner 2 as one locked, all-or-nothing draw. */
export async function buyWeeklyBannerCards(db: D1Database, userId: string, quantity: number, now = Date.now(), rand = secureRandom): Promise<BannerBatchDrawResult | { error: string }> {
  return buyBannerDraws(db, userId, 'weekly', weeklyBannerOffer(now), quantity, now, rand);
}

/** Buys several cards from Banner 1 as one locked, all-or-nothing draw. */
export async function buyDailyBannerCards(db: D1Database, userId: string, quantity: number, now = Date.now(), rand = secureRandom): Promise<BannerBatchDrawResult | { error: string }> {
  return buyBannerDraws(db, userId, 'daily', dailyBannerOffer(now), quantity, now, rand);
}

/** Buys one card from the current rotating Banner 2 and adds it directly to the album. */
export async function buyWeeklyBannerCard(db: D1Database, userId: string, now = Date.now(), rand = secureRandom): Promise<BannerDrawResult | { error: string }> {
  const result = await buyWeeklyBannerCards(db, userId, 1, now, rand);
  if ('error' in result) return result;
  const draw = result.cards[0];
  return { card: draw.card, rarity: draw.rarity, pityTriggered: draw.pityTriggered, dayStart: result.dayStart, price: result.price, pageRewards: result.pageRewards };
}

/** Buys one card from the current daily banner and adds it directly to the album. */
export async function buyDailyBannerCard(db: D1Database, userId: string, now = Date.now(), rand = secureRandom): Promise<BannerDrawResult | { error: string }> {
  const result = await buyDailyBannerCards(db, userId, 1, now, rand);
  if ('error' in result) return result;
  const draw = result.cards[0];
  return { card: draw.card, rarity: draw.rarity, pityTriggered: draw.pityTriggered, dayStart: result.dayStart, price: result.price, pageRewards: result.pageRewards };
}

/** Applies one spare copy of a card to it (its album level goes up at 2, 4, 7 and 10 copies). */
export async function applyCopy(db: D1Database, userId: string, cardId: string, quantity = 1, now = Date.now()): Promise<{ ok: true } | { error: string }> {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_COPIES) return { error: 'invalid_quantity' };
  const result = await db.prepare('UPDATE user_stickers SET copies = copies + ?, spare = spare - ?, updated_at = ? WHERE user_id = ? AND card_id = ? AND spare >= ? AND copies + ? <= ?')
    .bind(quantity, quantity, now, userId, cardId, quantity, quantity, MAX_COPIES).run();
  if ((result.meta?.changes ?? 0) === 0) {
    const row = await db.prepare('SELECT copies, spare FROM user_stickers WHERE user_id = ? AND card_id = ?').bind(userId, cardId).first<{ copies: number; spare: number }>();
    if (!row || row.spare <= 0) return { error: 'no_spare_copy' };
    return { error: 'max_level' };
  }
  return { ok: true };
}

/** Sells spare copies of a card for the account's shared store coins. */
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

/** Sells a selection of spare cards atomically: either every selected quantity is sold, or none. */
export async function sellCopiesBatch(
  db: D1Database,
  userId: string,
  sales: readonly { cardId: string; quantity: number }[],
  now = Date.now(),
): Promise<{ coins: number; copies: number } | { error: string }> {
  if (sales.length < 1 || sales.length > 100) return { error: 'invalid_quantity' };
  const seen = new Set<string>();
  let coins = 0;
  let copies = 0;
  for (const sale of sales) {
    const sticker = albumCatalog().stickers.get(sale.cardId);
    if (!sticker) return { error: 'invalid_card' };
    if (seen.has(sale.cardId) || !Number.isSafeInteger(sale.quantity) || sale.quantity < 1 || sale.quantity > 999) return { error: 'invalid_quantity' };
    seen.add(sale.cardId);
    copies += sale.quantity;
    coins += SELL_VALUE[sticker.rarity] * sale.quantity;
  }

  const placeholders = sales.map(() => '?').join(', ');
  const casePairs = sales.map(() => 'WHEN ? THEN ?').join(' ');
  const availability = sales.map(() => '(card_id = ? AND spare >= ?)').join(' OR ');
  const update = db.prepare(`UPDATE user_stickers
    SET spare = spare - CASE card_id ${casePairs} ELSE 0 END, updated_at = ?
    WHERE user_id = ? AND card_id IN (${placeholders})
      AND (SELECT COUNT(*) FROM user_stickers WHERE user_id = ? AND (${availability})) = ?`)
    .bind(
      ...sales.flatMap(({ cardId, quantity }) => [cardId, quantity]),
      now,
      userId,
      ...sales.map(({ cardId }) => cardId),
      userId,
      ...sales.flatMap(({ cardId, quantity }) => [cardId, quantity]),
      sales.length,
    );
  const credit = db.prepare(`UPDATE user_album SET coins = coins + ?, updated_at = ?
    WHERE user_id = ? AND changes() = ?`).bind(coins, now, userId, sales.length);
  const [updated, credited] = await db.batch([update, credit]);
  if ((updated.meta?.changes ?? 0) !== sales.length) return { error: 'no_spare_copy' };
  if ((credited.meta?.changes ?? 0) !== 1) return { error: 'operation_failed' };
  return { coins, copies };
}

async function spendCoins(db: D1Database, userId: string, price: number, now: number): Promise<boolean> {
  const paid = await db.prepare('UPDATE user_album SET coins = coins - ?, updated_at = ? WHERE user_id = ? AND coins >= ?').bind(price, now, userId, price).run();
  return (paid.meta?.changes ?? 0) > 0;
}

/** Buys a pack from the album shop (Bronze, Prata or Ouro). It goes to the inventory. */
export async function buyPack(db: D1Database, userId: string, tier: string, quantity = 1, now = Date.now()): Promise<{ item: AlbumItemKey; quantity: number } | { error: string }> {
  const price = (SHOP_PACK_PRICE as Record<string, number | undefined>)[tier];
  if (!price) return { error: 'not_for_sale' };
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 10) return { error: 'invalid_quantity' };
  const key = `pack:${tier}` as AlbumItemKey;
  const totalPrice = price * quantity;
  const [debit, grant] = await db.batch([
    db.prepare('UPDATE user_album SET coins = coins - ?, updated_at = ? WHERE user_id = ? AND coins >= ?').bind(totalPrice, now, userId, totalPrice),
    db.prepare(`INSERT INTO user_inventory (user_id, item_key, quantity, updated_at)
      SELECT ?, ?, ?, ? WHERE changes() = 1
      ON CONFLICT(user_id, item_key) DO UPDATE SET quantity = user_inventory.quantity + excluded.quantity, updated_at = excluded.updated_at`)
      .bind(userId, key, quantity, now),
  ]);
  if ((debit.meta?.changes ?? 0) === 0) return { error: 'not_enough_coins' };
  if ((grant.meta?.changes ?? 0) !== 1) return { error: 'operation_failed' };
  return { item: key, quantity };
}

/** Buys a profile frame with account coins. Event and album frames are never sold here. */
export async function buyAvatarFrame(db: D1Database, userId: string, frameKey: string, now = Date.now()): Promise<{ frameKey: string; price: number } | { error: string }> {
  const frame = AVATAR_FRAME_BY_KEY.get(frameKey);
  const price = frame?.shopPrice;
  if (!frame || price === undefined) return { error: 'not_for_sale' };

  // The conditional debit and grant share one D1 batch transaction. The unique
  // user_frames key prevents a repeat purchase from charging the same frame twice.
  const [debit, grant] = await db.batch([
    db.prepare(`UPDATE user_album SET coins = coins - ?, updated_at = ?
      WHERE user_id = ? AND coins >= ?
        AND NOT EXISTS (SELECT 1 FROM user_frames WHERE user_id = ? AND frame_key = ?)`)
      .bind(price, now, userId, price, userId, frameKey),
    db.prepare(`INSERT INTO user_frames (user_id, frame_key, event_id, unlocked_at)
      SELECT ?, ?, 'shop', ? WHERE changes() = 1
      ON CONFLICT(user_id, frame_key) DO NOTHING`)
      .bind(userId, frameKey, now),
  ]);

  if ((debit.meta?.changes ?? 0) === 1 && (grant.meta?.changes ?? 0) === 1) return { frameKey, price };
  const owned = await db.prepare('SELECT 1 AS owned FROM user_frames WHERE user_id = ? AND frame_key = ?')
    .bind(userId, frameKey).first<{ owned: number }>();
  return owned ? { error: 'already_owned' } : { error: 'not_enough_coins' };
}

/** Buys a profile cover with account coins. Free presets and album rewards are not sold here. */
export async function buyProfileCover(db: D1Database, userId: string, coverKey: string, now = Date.now()): Promise<{ coverKey: string; price: number } | { error: string }> {
  const cover = PROFILE_COVER_BY_KEY.get(coverKey);
  const price = cover?.shopPrice;
  if (!cover || price === undefined) return { error: 'not_for_sale' };

  const [debit, grant] = await db.batch([
    db.prepare(`UPDATE user_album SET coins = coins - ?, updated_at = ?
      WHERE user_id = ? AND coins >= ?
        AND NOT EXISTS (SELECT 1 FROM user_covers WHERE user_id = ? AND cover_key = ?)`)
      .bind(price, now, userId, price, userId, coverKey),
    db.prepare(`INSERT INTO user_covers (user_id, cover_key, source, unlocked_at)
      SELECT ?, ?, 'shop', ? WHERE changes() = 1
      ON CONFLICT(user_id, cover_key) DO NOTHING`)
      .bind(userId, coverKey, now),
  ]);

  if ((debit.meta?.changes ?? 0) === 1 && (grant.meta?.changes ?? 0) === 1) return { coverKey, price };
  const owned = await db.prepare('SELECT 1 AS owned FROM user_covers WHERE user_id = ? AND cover_key = ?')
    .bind(userId, coverKey).first<{ owned: number }>();
  return owned ? { error: 'already_owned' } : { error: 'not_enough_coins' };
}

/** Buys a profile name font with account coins. Event-reward styles are never sold here. */
export async function buyNameStyle(db: D1Database, userId: string, styleKey: string, now = Date.now()): Promise<{ styleKey: string; price: number } | { error: string }> {
  const style = NAME_STYLE_BY_KEY.get(styleKey);
  const price = style?.shopPrice;
  if (!style || price === undefined) return { error: 'not_for_sale' };

  const [debit, grant] = await db.batch([
    db.prepare(`UPDATE user_album SET coins = coins - ?, updated_at = ?
      WHERE user_id = ? AND coins >= ?
        AND NOT EXISTS (SELECT 1 FROM user_name_styles WHERE user_id = ? AND style_key = ?)`)
      .bind(price, now, userId, price, userId, styleKey),
    db.prepare(`INSERT INTO user_name_styles (user_id, style_key, event_id, unlocked_at)
      SELECT ?, ?, 'shop', ? WHERE changes() = 1
      ON CONFLICT(user_id, style_key) DO NOTHING`)
      .bind(userId, styleKey, now),
  ]);

  if ((debit.meta?.changes ?? 0) === 1 && (grant.meta?.changes ?? 0) === 1) return { styleKey, price };
  const owned = await db.prepare('SELECT 1 AS owned FROM user_name_styles WHERE user_id = ? AND style_key = ?')
    .bind(userId, styleKey).first<{ owned: number }>();
  return owned ? { error: 'already_owned' } : { error: 'not_enough_coins' };
}


/** The album in a profile: how much of it is filled and which pages are complete. */
export async function albumSummary(db: D1Database, userId: string): Promise<{ owned: number; total: number; completedPages: number; clubsCompleted: string[] } | null> {
  const album = await db.prepare('SELECT 1 AS ok FROM user_album WHERE user_id = ?').bind(userId).first<Row>();
  if (!album) return null;
  const catalog = albumCatalog();
  const [stickers, pages, eventCards] = await Promise.all([
    loadStickers(db, userId),
    db.prepare('SELECT page_id FROM user_album_pages WHERE user_id = ?').bind(userId).all<{ page_id: string }>(),
    loadOwnedEventCards(db, userId),
  ]);
  const completed = pages.results.map(r => r.page_id).filter(id => catalog.pageById.has(id));
  const ownedIds = new Set([...stickers.keys(), ...eventCards]);
  return {
    owned: Array.from(ownedIds).filter(id => catalog.stickers.has(id)).length,
    total: catalog.stickers.size,
    completedPages: completed.length,
    clubsCompleted: completed.filter(id => id.startsWith('club:')).map(id => id.slice(5)),
  };
}

/** Club frames and covers this account unlocked (the profile accepts them as its own). */
export async function loadOwnedCovers(db: D1Database, userId: string): Promise<string[]> {
  const rows = await db.prepare('SELECT cover_key FROM user_covers WHERE user_id = ? ORDER BY unlocked_at').bind(userId).all<{ cover_key: string }>();
  return rows.results.map(r => r.cover_key);
}
