// UCL Immortals — the sticker album (accounts only): its pages, its stickers, the packs that
// fill it, the album level of each player and its economy. Pure rules shared by the server (which
// is the only one to grant, open, sell or buy anything) and the client (which draws the album).
// Design: docs/design/features/album.md

import { EVENT_UNIQUE_CARDS, PLAYERS, STORE_UNIQUE_CARDS, UNIQUE_CARDS, type Player, type Rarity } from './gameData';
import { CREST_CATALOG, clubIdForName, getCrest } from './crests';
import { RANKED_DIFFICULTY_IDS, type RankedDifficultyId } from './competitionRanking';
import { clubRewardKeys } from './clubRewards';

export { clubOfRewardKey, clubRewardKeys, isClubRewardKey } from './clubRewards';

// ── Stickers and pages ──────────────────────────────────────────────────────

/** A club with at least this many cards has a page of its own (and its rewards). */
export const CLUB_PAGE_MIN_CARDS = 10;
/** A region's shared page needs at least this many cards; fewer join the world's page. */
export const MIN_SHARED_PAGE = 5;

export type AlbumRegionId = 'england' | 'spain' | 'italy' | 'germany' | 'france' | 'brazil' | 'world';

export const ALBUM_REGIONS: readonly { id: AlbumRegionId; name: string; flag: string }[] = [
  { id: 'england', name: 'Inglaterra', flag: '🇬🇧' },
  { id: 'spain', name: 'Espanha', flag: '🇪🇸' },
  { id: 'italy', name: 'Itália', flag: '🇮🇹' },
  { id: 'germany', name: 'Alemanha', flag: '🇩🇪' },
  { id: 'france', name: 'França', flag: '🇫🇷' },
  { id: 'brazil', name: 'Brasil', flag: '🇧🇷' },
  { id: 'world', name: 'Resto do Mundo', flag: '🌍' },
];

/** The crest catalogue's league groups, by the region they belong to in the album. */
const REGION_BY_LEAGUE: Record<string, AlbumRegionId> = {
  'Premier League': 'england',
  'La Liga': 'spain',
  'Serie A': 'italy',
  'Bundesliga': 'germany',
  'Ligue 1': 'france',
  'Brasil': 'brazil',
};

export interface AlbumSticker {
  /** The card's id. */
  id: string;
  /** Its number in the album (1-based, in album order). */
  number: number;
  rarity: Rarity;
  clubId: string;
  /** Null for event/store exclusives, which live outside the country and club pages. */
  pageId: string | null;
}

export interface AlbumPage {
  /** `club:<clubId>` for a club's own page, `region:<regionId>` for a region's shared one. */
  id: string;
  kind: 'club' | 'region';
  regionId: AlbumRegionId;
  /** The club (own page) or null (shared page). */
  clubId: string | null;
  title: string;
  /** Its stickers' card ids, in album order. */
  stickers: string[];
}

export interface AlbumCatalog {
  pages: AlbumPage[];
  stickers: Map<string, AlbumSticker>;
  pageById: Map<string, AlbumPage>;
  /** Card ids per rarity (the pools the packs draw from). */
  byRarity: Map<Rarity, string[]>;
  total: number;
}

const RARITY_ORDER: Record<Rarity, number> = { unique: 0, immortal: 1, legendary: 2, gold: 3, silver: 4, bronze: 5 };

/** Every card the album collects: the regular cards and the Únicas (not the event-only ones). */
export function albumCards(): Player[] {
  return [...PLAYERS, ...UNIQUE_CARDS];
}

function regionOfClub(clubId: string): AlbumRegionId {
  const group = CREST_CATALOG.find(g => g.crests.some(c => c.id === clubId));
  if (!group) return 'world';
  const league = Object.keys(REGION_BY_LEAGUE).find(name => group.league.startsWith(name));
  return league ? REGION_BY_LEAGUE[league] : 'world';
}

/** Album order inside a page: rarest first, then the best, then by name. */
function stickerOrder(a: Player, b: Player): number {
  return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity] || b.overall - a.overall || a.shortName.localeCompare(b.shortName);
}

/** Builds the album from a card list (the real one by default). Deterministic: same cards, same album. */
export function buildAlbumCatalog(cards: readonly Player[] = albumCards()): AlbumCatalog {
  const byClub = new Map<string, Player[]>();
  for (const card of cards) {
    const clubId = card.clubId ?? clubIdForName(card.club) ?? 'unknown';
    const list = byClub.get(clubId) ?? [];
    list.push(card);
    byClub.set(clubId, list);
  }
  const pages: AlbumPage[] = [];
  // A region whose small clubs add up to only a handful of cards sends them to the world page.
  const leftovers: [string, Player[]][] = [];
  for (const region of ALBUM_REGIONS) {
    const clubs = Array.from(byClub.entries()).filter(([clubId]) => regionOfClub(clubId) === region.id);
    // Own pages: the biggest clubs first.
    const own = clubs.filter(([, list]) => list.length >= CLUB_PAGE_MIN_CARDS)
      .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    for (const [clubId, list] of own) {
      pages.push({
        id: `club:${clubId}`, kind: 'club', regionId: region.id, clubId,
        title: getCrest(clubId)?.name ?? clubId,
        stickers: [...list].sort(stickerOrder).map(card => card.id),
      });
    }
    // The region's smaller clubs share one page, grouped by club (by name).
    let small = clubs.filter(([, list]) => list.length < CLUB_PAGE_MIN_CARDS);
    if (region.id !== 'world' && small.reduce((n, [, list]) => n + list.length, 0) < MIN_SHARED_PAGE) {
      leftovers.push(...small);
      continue;
    }
    if (region.id === 'world') small = [...small, ...leftovers];
    small.sort((a, b) => (getCrest(a[0])?.name ?? a[0]).localeCompare(getCrest(b[0])?.name ?? b[0]));
    if (small.length > 0) {
      pages.push({
        id: `region:${region.id}`, kind: 'region', regionId: region.id, clubId: null,
        title: region.id === 'world' ? 'Outros clubes do mundo' : `Outros clubes — ${region.name}`,
        stickers: small.flatMap(([, list]) => [...list].sort(stickerOrder).map(card => card.id)),
      });
    }
  }
  const stickers = new Map<string, AlbumSticker>();
  const byRarity = new Map<Rarity, string[]>();
  const cardById = new Map(cards.map(card => [card.id, card]));
  let number = 0;
  for (const page of pages) {
    for (const id of page.stickers) {
      const card = cardById.get(id)!;
      number++;
      stickers.set(id, { id, number, rarity: card.rarity, clubId: card.clubId ?? clubIdForName(card.club) ?? 'unknown', pageId: page.id });
      const pool = byRarity.get(card.rarity) ?? [];
      pool.push(id);
      byRarity.set(card.rarity, pool);
    }
  }
  return { pages, stickers, pageById: new Map(pages.map(page => [page.id, page])), byRarity, total: number };
}

let cached: AlbumCatalog | null = null;
/** The album of the current card catalogue (built once). */
export function albumCatalog(): AlbumCatalog {
  if (!cached) {
    cached = buildAlbumCatalog();
    let number = cached.total;
    for (const card of [...EVENT_UNIQUE_CARDS, ...STORE_UNIQUE_CARDS]) {
      number++;
      cached.stickers.set(card.id, {
        id: card.id,
        number,
        rarity: card.rarity,
        clubId: card.clubId ?? clubIdForName(card.club) ?? 'unknown',
        pageId: null,
      });
    }
  }
  return cached;
}

// ── Album levels (★1–★5) ────────────────────────────────────────────────────

/** Copies of a player that reach each level (★1 is the first copy). */
export const LEVEL_COPIES = [1, 2, 4, 7, 10] as const;
export const MAX_ALBUM_LEVEL = 5;
export const MAX_COPIES = LEVEL_COPIES[LEVEL_COPIES.length - 1];

export type AlbumLevel = 1 | 2 | 3 | 4 | 5;

/** Bonus each card receives while its album page is complete for a competition. */
export const ALBUM_PAGE_COMPLETION_BONUS = 3 as const;
export type AlbumPageBonus = typeof ALBUM_PAGE_COMPLETION_BONUS;

/** Snapshot the page-completion bonus from the cards an account currently owns. */
export function pageBonusSnapshotForOwnedCards(ownedCardIds: ReadonlySet<string>): Partial<Record<string, AlbumPageBonus>> {
  const snapshot: Partial<Record<string, AlbumPageBonus>> = {};
  for (const page of albumCatalog().pages) {
    if (page.stickers.length > 0 && page.stickers.every(cardId => ownedCardIds.has(cardId))) {
      for (const cardId of page.stickers) snapshot[cardId] = ALBUM_PAGE_COMPLETION_BONUS;
    }
  }
  return snapshot;
}

/** The level reached with this many copies applied (0 = not in the album yet). */
export function levelForCopies(copies: number): AlbumLevel | 0 {
  let level = 0;
  LEVEL_COPIES.forEach((need, i) => { if (copies >= need) level = i + 1; });
  return level as AlbumLevel | 0;
}

/** Copies still needed for the next level (null at the top). */
export function copiesToNextLevel(copies: number): number | null {
  const next = LEVEL_COPIES.find(need => need > copies);
  return next === undefined ? null : next - copies;
}

// ── Packs ───────────────────────────────────────────────────────────────────

export type AlbumPackTier = RankedDifficultyId;
export const ALBUM_PACK_TIERS: readonly AlbumPackTier[] = RANKED_DIFFICULTY_IDS;

export type AlbumItemKind = 'pack' | 'envelope';
/** Inventory item keys: `pack:<tier>` (5 stickers) and `envelope:<tier>` (2). */
export type AlbumItemKey = `${AlbumItemKind}:${AlbumPackTier}`;

export const PACK_SIZE = 5;
export const ENVELOPE_SIZE = 2;

export const ALBUM_TIER_META: Record<AlbumPackTier, { label: string; color: string }> = {
  bronze: { label: 'Bronze', color: '#CD7F32' },
  silver: { label: 'Prata', color: '#A8A8B8' },
  gold: { label: 'Ouro', color: '#C9A84C' },
  legendary: { label: 'Lendário', color: '#FF8C00' },
  immortal: { label: 'Imortal', color: '#FFD700' },
};

/** Chance of each rarity for every sticker of a tier's pack or envelope (weights). */
export const TIER_ODDS: Record<AlbumPackTier, Partial<Record<Rarity, number>>> = {
  bronze: { bronze: 62, silver: 32, gold: 6 },
  silver: { bronze: 25, silver: 52, gold: 21, legendary: 2 },
  gold: { silver: 34, gold: 52, legendary: 12.9, immortal: 1, unique: 0.1 },
  legendary: { gold: 60, legendary: 35.5, immortal: 4, unique: 0.5 },
  immortal: { gold: 32, legendary: 54.5, immortal: 12, unique: 1.5 },
};

/** A full pack guarantees one sticker of at least this rarity (envelopes guarantee nothing). */
export const TIER_GUARANTEE: Record<AlbumPackTier, Rarity | null> = {
  bronze: null,
  silver: 'silver',
  gold: 'gold',
  legendary: 'legendary',
  immortal: 'immortal',
};

const RARITY_RANK: Record<Rarity, number> = { bronze: 0, silver: 1, gold: 2, legendary: 3, immortal: 4, unique: 5 };

export function parseItemKey(key: string): { kind: AlbumItemKind; tier: AlbumPackTier } | null {
  const [kind, tier] = key.split(':');
  if ((kind !== 'pack' && kind !== 'envelope') || !(ALBUM_PACK_TIERS as readonly string[]).includes(tier)) return null;
  return { kind, tier: tier as AlbumPackTier };
}

function pickWeighted<T extends string>(weights: Partial<Record<T, number>>, rand: () => number): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  for (const [key, weight] of entries) { roll -= weight; if (roll < 0) return key; }
  return entries[entries.length - 1][0];
}

/**
 * The stickers in one pack or envelope (card ids), drawn with `rand` (0 ≤ x < 1). A rarity with
 * no card in the catalogue falls back to the nearest one below it.
 */
export function rollItem(key: AlbumItemKey, rand: () => number, catalog: AlbumCatalog = albumCatalog()): string[] {
  const item = parseItemKey(key);
  if (!item) return [];
  const size = item.kind === 'pack' ? PACK_SIZE : ENVELOPE_SIZE;
  const odds = TIER_ODDS[item.tier];
  const rarities: Rarity[] = Array.from({ length: size }, () => pickWeighted(odds, rand));
  const floor = item.kind === 'pack' ? TIER_GUARANTEE[item.tier] : null;
  if (floor && !rarities.some(r => RARITY_RANK[r] >= RARITY_RANK[floor])) rarities[size - 1] = floor;
  return rarities.map(rarity => {
    let pool = catalog.byRarity.get(rarity);
    for (let rank = RARITY_RANK[rarity]; (!pool || pool.length === 0) && rank > 0; rank--) {
      const lower = (Object.keys(RARITY_RANK) as Rarity[]).find(r => RARITY_RANK[r] === rank - 1)!;
      pool = catalog.byRarity.get(lower);
    }
    if (!pool || pool.length === 0) throw new Error('album catalogue is empty');
    return pool[Math.floor(rand() * pool.length)];
  });
}

// ── Account coins (shared across the store, separate from match/campaign credits) ──

/** Coins for selling one spare copy, by the card's rarity. */
export const SELL_VALUE: Record<Rarity, number> = { bronze: 8, silver: 15, gold: 30, legendary: 75, immortal: 180, unique: 300 };

/** A specific missing sticker in the shop: four times what a copy sells for. */


/** Account-store prices. Premium tiers cost more and remain available as competition rewards. */
export const SHOP_PACK_PRICE: Partial<Record<AlbumPackTier, number>> = {
  bronze: 60,
  silver: 120,
  gold: 250,
  legendary: 400,
  immortal: 700,
};

/** One card from the rotating weekly banner. Rates sum to 100%. */
export const WEEKLY_BANNER_PRICE = 50;
export const WEEKLY_BANNER_ODDS: Readonly<Record<Rarity, number>> = {
  bronze: 34,
  silver: 30,
  gold: 20,
  legendary: 10,
  immortal: 4,
  unique: 2,
};

/** A cheaper daily draw with lower odds for the premium rarities. */
export const DAILY_BANNER_PRICE = 25;
export const DAILY_BANNER_ODDS: Readonly<Record<Rarity, number>> = {
  bronze: 46,
  silver: 31,
  gold: 15,
  legendary: 6,
  immortal: 2,
  unique: 0,
};

/** After this many misses, Banner 1 guarantees a Lendária or better on the next draw. */
export const DAILY_BANNER_PITY_LIMIT = 15;
/** After this many misses, Banner 2 guarantees an Única on the next draw. */
export const WEEKLY_BANNER_PITY_LIMIT = 40;

export interface DailyBannerOffer {
  dayStart: string;
  endsAt: number;
  price: number;
  odds: Readonly<Record<Rarity, number>>;
  /** Four Gold, four Legendary and one Immortal card featured for this São Paulo day. */
  cards: Record<Rarity, string[]>;
}

export interface DailyBannerRotations {
  current: DailyBannerOffer;
  next: DailyBannerOffer;
}

export interface WeeklyBannerOffer {
  dayStart: string;
  endsAt: number;
  price: number;
  odds: Readonly<Record<Rarity, number>>;
  /** Banner 2 highlights: normal-catalogue Lendárias/Imortais plus the authored banner Única. */
  cards: Record<Rarity, string[]>;
}

export interface WeeklyBannerRotations {
  current: WeeklyBannerOffer;
  next: WeeklyBannerOffer;
}

// ── Grants ──────────────────────────────────────────────────────────────────

/** What one finished campaign at a difficulty is worth. */
export function campaignGrant(tier: AlbumPackTier, champion: boolean): AlbumItemKey[] {
  const items: AlbumItemKey[] = [`envelope:${tier}`];
  if (champion) items.push(`pack:${tier}`);
  return items;
}

/** Base reward for a shared page with fewer than 30 cards. */
export const REGION_PAGE_REWARD: AlbumItemKey[] = ['pack:gold'];
/** A club's own page completed again after new cards joined it (its frame and cover are kept). */
export const CLUB_PAGE_RECOMPLETE: AlbumItemKey[] = ['pack:gold'];
/** Shared pages scale their first reward by size; later completions always award Gold. */
export const REGION_PAGE_LEGENDARY_THRESHOLD = 30;
export const REGION_PAGE_IMMORTAL_THRESHOLD = 50;
export function regionPageReward(pageSize: number, recompleted: boolean): AlbumItemKey[] {
  if (recompleted) return [...CLUB_PAGE_RECOMPLETE];
  if (pageSize >= REGION_PAGE_IMMORTAL_THRESHOLD) return ['pack:immortal'];
  if (pageSize >= REGION_PAGE_LEGENDARY_THRESHOLD) return ['pack:legendary'];
  return [...REGION_PAGE_REWARD];
}

