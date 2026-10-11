// Client helpers for the album: the cards behind the stickers, page progress and the
// labels of the album's items. The rules themselves live in @shared/game/album.
import {
  ALBUM_REGIONS,
  ALBUM_TIER_META,
  albumCards,
  albumCatalog,
  levelForCopies,
  parseItemKey,
  type AlbumItemKey,
  type AlbumPage,
  type AlbumPackTier,
  type AlbumRegionId,
} from '@shared/game/album';
import type { Player, Rarity } from '@shared/game/gameData';
import type { AlbumState } from '../../contexts/AlbumContext';

export const CATALOG = albumCatalog();

const CARD_BY_ID = new Map<string, Player>(albumCards().map(card => [card.id, card]));

export function albumCard(id: string): Player | undefined {
  return CARD_BY_ID.get(id);
}

export const RARITY_LABEL: Record<Rarity, string> = {
  bronze: 'Bronze', silver: 'Prata', gold: 'Ouro', legendary: 'Lendária', immortal: 'Imortal', unique: 'Única',
};

/** Regions in album order, each with its pages (only regions that have any). */
export const REGIONS: { id: AlbumRegionId; name: string; pages: AlbumPage[] }[] = ALBUM_REGIONS
  .map(region => ({ id: region.id, name: region.name, pages: CATALOG.pages.filter(page => page.regionId === region.id) }))
  .filter(region => region.pages.length > 0);

export interface PageProgress { owned: number; total: number; complete: boolean }

export function pageProgress(page: AlbumPage, album: AlbumState | null): PageProgress {
  const owned = album ? page.stickers.reduce((n, id) => n + (album.stickers.has(id) ? 1 : 0), 0) : 0;
  return { owned, total: page.stickers.length, complete: owned === page.stickers.length };
}

export function albumProgress(album: AlbumState | null): { owned: number; total: number; pages: number } {
  let owned = 0;
  album?.stickers.forEach((_, id) => { if (CATALOG.stickers.has(id)) owned++; });
  const pages = album ? CATALOG.pages.filter(page => pageProgress(page, album).complete).length : 0;
  return { owned, total: CATALOG.total, pages };
}

/** The album level of an owned sticker (1–5), or 0 when missing. */
export function stickerLevel(album: AlbumState | null, cardId: string): number {
  const sticker = album?.stickers.get(cardId);
  return sticker ? levelForCopies(sticker.copies) : 0;
}

export function itemTier(key: AlbumItemKey): AlbumPackTier {
  return parseItemKey(key)!.tier;
}

export function itemLabel(key: AlbumItemKey): string {
  const parsed = parseItemKey(key)!;
  const tier = ALBUM_TIER_META[parsed.tier].label;
  return parsed.kind === 'pack' ? `Pacote ${tier}` : `Envelope ${tier}`;
}

export function itemColor(key: AlbumItemKey): string {
  return ALBUM_TIER_META[itemTier(key)].color;
}

/** Inventory items in a stable order: packs before envelopes, rarest tier first. */
export function sortedItems(inventory: AlbumState['inventory']): [AlbumItemKey, number][] {
  const tierRank = (key: AlbumItemKey) => ['immortal', 'legendary', 'gold', 'silver', 'bronze'].indexOf(itemTier(key));
  return (Object.entries(inventory) as [AlbumItemKey, number][])
    .filter(([key, quantity]) => quantity > 0 && parseItemKey(key))
    .sort(([a], [b]) => (a.startsWith('pack') ? 0 : 1) - (b.startsWith('pack') ? 0 : 1) || tierRank(a) - tierRank(b));
}

/** Groups repeated keys: ['pack:gold', 'pack:gold'] → [['pack:gold', 2]]. */
export function groupKeys(keys: readonly AlbumItemKey[]): [AlbumItemKey, number][] {
  const counts = new Map<AlbumItemKey, number>();
  keys.forEach(key => counts.set(key, (counts.get(key) ?? 0) + 1));
  return Array.from(counts.entries());
}
