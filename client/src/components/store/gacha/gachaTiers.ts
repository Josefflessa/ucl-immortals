/**
 * What each rarity looks and feels like in the banner reveal: its colour, how long the
 * summoning charges, how big the burst is. The better the card, the longer the wait and the
 * louder the show, which is what makes a good pull feel earned. Pure data and helpers.
 */

import type { Rarity } from '@shared/game/gameData';

export interface GachaTier {
  rank: number;
  label: string;
  /** Main colour of the orb, the rays and the label. */
  color: string;
  /** Second colour the rays blend into (iridescent for the top tiers). */
  accent: string;
  /** How long the summoning circle charges before the burst (ms). */
  chargeMs: number;
  /** Pause on the face-down card before it flips, in the multi-draw (ms). */
  suspenseMs: number;
  /** Light rays behind the card (0 = none). */
  rays: number;
  /** Expanding shockwave rings at the burst. */
  shockwaves: number;
  /** Particles flung out at the burst. */
  particles: number;
  /** The screen shakes at the burst. */
  shake: boolean;
}

export const TIERS: Record<Rarity, GachaTier> = {
  bronze:    { rank: 0, label: 'Bronze',   color: '#CD7F32', accent: '#8C5A2B', chargeMs: 1300, suspenseMs: 0,    rays: 0,   shockwaves: 0, particles: 10, shake: false },
  silver:    { rank: 1, label: 'Prata',    color: '#C3C8D8', accent: '#7F8AA8', chargeMs: 1500, suspenseMs: 0,    rays: 0,   shockwaves: 0, particles: 14, shake: false },
  gold:      { rank: 2, label: 'Ouro',     color: '#F2C94C', accent: '#C9A84C', chargeMs: 1900, suspenseMs: 0,    rays: 0.3, shockwaves: 1, particles: 22, shake: false },
  legendary: { rank: 3, label: 'Lendária', color: '#FF9F1C', accent: '#FF5A1F', chargeMs: 2500, suspenseMs: 900,  rays: 0.5, shockwaves: 1, particles: 34, shake: false },
  immortal:  { rank: 4, label: 'Imortal',  color: '#FFD84A', accent: '#B06BFF', chargeMs: 3000, suspenseMs: 1400, rays: 0.7, shockwaves: 2, particles: 48, shake: true },
  unique:    { rank: 5, label: 'Única',    color: '#FFF1C2', accent: '#6BE6FF', chargeMs: 3300, suspenseMs: 1600, rays: 0.8, shockwaves: 2, particles: 56, shake: true },
};

export const tierOf = (rarity: Rarity): GachaTier => TIERS[rarity] ?? TIERS.bronze;

/** The best draw of a batch (the first one on a tie): its tier sets the colour of the whole charge. */
export function bestDraw<T extends { rarity: Rarity }>(draws: readonly T[]): T | undefined {
  let best: T | undefined;
  for (const draw of draws) if (!best || tierOf(draw.rarity).rank > tierOf(best.rarity).rank) best = draw;
  return best;
}

/**
 * The order cards are flipped in the multi-draw: from the weakest to the best, so the big
 * moment comes last. Equal rarities keep their original order.
 */
export function flipOrder(rarities: readonly Rarity[]): number[] {
  return rarities.map((_, index) => index).sort((a, b) => tierOf(rarities[a]).rank - tierOf(rarities[b]).rank || a - b);
}

/** Room under each card for its name and rarity (8 + 36) plus the gap to the next row (20). */
const LABEL_ROW = 66;
const GAP = 12;
/** Room above the first row for the NEW / REPEATED tags that sit on the cards' top edge. */
const TOP_ROOM = 14;
/** Side padding of the card area. */
const SIDE_ROOM = 32;

/**
 * Cards per row and card scale for `count` cards in a `width` x `height` area (card base size
 * 200x324): the number of columns that makes the cards biggest while all of them fit.
 */
export function gridLayout(count: number, width: number, height: number, fit = true): { columns: number; scale: number } {
  // Not fitting the height (the phone summary scrolls): the biggest cards the width allows, 2 or 3 per row.
  if (!fit && count > 1) {
    const columns = count <= 2 ? 2 : 3;
    return { columns, scale: Math.max(0.3, Math.min(0.72, (width - SIDE_ROOM - GAP * (columns - 1)) / columns / 200)) };
  }
  const range = width >= 720 ? [3, 4, 5, 6, 7, 8, 9, 10] : [2, 3, 4, 5];
  const candidates = count <= 1 ? [1] : [...range.filter(columns => columns <= count), ...(count < range[0] ? [count] : [])];
  let best = { columns: candidates[0], scale: 0 };
  for (const columns of candidates) {
    const rows = Math.ceil(count / columns);
    const byWidth = (width - SIDE_ROOM - GAP * (columns - 1)) / columns / 200;
    const byHeight = (height - TOP_ROOM - rows * LABEL_ROW) / rows / 324;
    const scale = Math.min(0.72, byWidth, byHeight);
    if (scale > best.scale + 0.001) best = { columns, scale };
  }
  return { columns: best.columns, scale: Math.max(0.3, best.scale) };
}

/** Deterministic pseudo-random numbers (so the particles are the same on every render). */
export function seeded(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}
