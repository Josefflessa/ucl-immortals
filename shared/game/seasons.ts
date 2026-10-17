// UCL Immortals — ranking seasons.
// A season is a one-month window of the score ranking and of the public records.
// Season 0 counts every competition completed before it closes, so the
// history that existed before seasons keeps counting. From then on each season
// runs for one month, from the 17th at 00:00 to the next month's 17th (São Paulo).
// When a season closes the server pays its top 10 once (server/seasons.ts).

import type { AlbumPackTier } from './album';

/** São Paulo has no daylight saving time: 00:00 there is 03:00 UTC. */
const SAO_PAULO_OFFSET_HOURS = 3;
const SEASON_DAY = 17;
/** Season 0 closes on 17/11/2026 at 00:00 (São Paulo). */
const SEASON_ZERO_END = Date.UTC(2026, 10, SEASON_DAY, SAO_PAULO_OFFSET_HOURS);

export interface SeasonTheme {
  /** Frame for the top 3 (shared/game/events.ts AVATAR_FRAMES). */
  frameKey: string;
  /** Profile cover for the top 2 (shared/profileCovers.ts). */
  coverKey: string;
  /** Exclusive Única for the champion (shared/game/players/uniqueCards.ts). */
  cardId: string;
}

/** Art and exclusive rewards of each season. A season without a theme pays coins and packs only. */
export const SEASON_THEMES: Readonly<Record<number, SeasonTheme>> = {
  0: { frameKey: 'genese', coverKey: 'cover-season-0', cardId: 'lampard_unico' },
};

export interface SeasonBounds {
  season: number;
  /** Inclusive start, in ms. Season 0 starts at 0 (all earlier history). */
  start: number;
  /** Exclusive end, in ms. */
  end: number;
}

function seasonEnd(season: number): number {
  return Date.UTC(2026, 10 + season, SEASON_DAY, SAO_PAULO_OFFSET_HOURS);
}

export function seasonBounds(season: number): SeasonBounds {
  const n = Math.max(0, Math.floor(season));
  return { season: n, start: n === 0 ? 0 : seasonEnd(n - 1), end: n === 0 ? SEASON_ZERO_END : seasonEnd(n) };
}

/** The season a timestamp belongs to. */
export function seasonAt(timeMs: number): number {
  if (timeMs < SEASON_ZERO_END) return 0;
  let season = 1;
  while (seasonEnd(season) <= timeMs) season += 1;
  return season;
}

export function currentSeason(now = Date.now()): number {
  return seasonAt(now);
}

/** Seasons that can be browsed: from the current one back to season 0. */
export function browsableSeasons(now = Date.now()): number[] {
  return Array.from({ length: currentSeason(now) + 1 }, (_, i) => currentSeason(now) - i);
}

export function seasonLabel(season: number): string {
  return `Temporada ${season}`;
}

export function isValidSeason(value: unknown, now = Date.now()): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= currentSeason(now);
}

export const SEASON_PRIZE_POSITIONS = 10;

export interface SeasonPrize {
  coins: number;
  packs: Partial<Record<AlbumPackTier, number>>;
  frame: boolean;
  cover: boolean;
  card: boolean;
}

const PRIZES: readonly SeasonPrize[] = [
  { coins: 3000, packs: { immortal: 2 }, frame: true, cover: true, card: true },
  { coins: 2000, packs: { immortal: 1, legendary: 1 }, frame: true, cover: true, card: false },
  { coins: 1500, packs: { legendary: 2 }, frame: true, cover: false, card: false },
  { coins: 1000, packs: { legendary: 1 }, frame: false, cover: false, card: false },
  { coins: 1000, packs: { legendary: 1 }, frame: false, cover: false, card: false },
];
const LOWER_PRIZE: SeasonPrize = { coins: 500, packs: { gold: 2 }, frame: false, cover: false, card: false };

/** Prize for a final position (1-based) in the score ranking, or null outside the top 10. */
export function seasonPrize(position: number): SeasonPrize | null {
  if (!Number.isInteger(position) || position < 1 || position > SEASON_PRIZE_POSITIONS) return null;
  return PRIZES[position - 1] ?? LOWER_PRIZE;
}
