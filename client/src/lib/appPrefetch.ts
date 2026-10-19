/**
 * Warms what the account screens will need, in the background and in order of value, so that
 * opening the store (and what is in it) shows everything at once instead of loading in front of
 * the player: first the data (the banners' rotations), then the small art, then the photos of the
 * banners' featured cards, and last the big profile covers (only on a good connection).
 * Everything goes through idle time and a few requests at a time, so it never competes with
 * what the player is doing; the screens read the same caches, so a visit costs nothing.
 */

import { AVATAR_FRAMES } from '@shared/game/events';
import { CREST_CATALOG } from '@shared/game/crests';
import { COACHES } from '@shared/game/gameData';
import { PROFILE_COVER_PRESETS } from '@shared/profileCovers';
import { albumCard } from '../components/album/albumData';
import { loadDailyRotations } from '../components/store/DailyBannerShop';
import { loadWeeklyRotations } from '../components/store/WeeklyBannerShop';
import { preloadCardAssets, warmImages } from './cardPreload';
import { NATION_CODES, cardTexture } from '../components/game/PlayerCard';
import { TRAIT_KEYS } from '../components/game/TraitIcon';
import { flagUrl } from './flags';

const PACK_ART = ['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique'].map(name => `/packs/${name}.webp`);
const ALBUM_ART = ['pack', 'envelope'].flatMap(kind => ['bronze', 'silver', 'gold', 'legendary', 'immortal'].map(tier => `/album/${kind}-${tier}.webp`));
const SHOP_ART = ['coach', 'playerPacks', 'removeVariant', 'scout', 'turbinar'].map(name => `/shop/${name}.webp`);

const DIFFICULTY_ART = ['bronze', 'silver', 'gold', 'legendary', 'immortal'].map(name => `/difficulty/${name}.webp`);
const TACTIC_ART = ['balanced', 'possession', 'counter', 'high_press', 'defensive', 'all_out_attack'].map(name => `/tactics/${name}.webp`);
const ROLE_ART = ['captain', 'freeKick', 'penalty'].map(name => `/roles/${name}.webp`);
const CARD_FRAME_ART = ['/cards/card-frame.webp', ...[2, 3, 4, 5].map(level => `/cards/album-level-${level}.webp`)];
const RARITIES = ['bronze', 'silver', 'gold', 'legendary', 'immortal'];

/** Saving data or a slow connection: leave the heavy art for when it is asked for. */
function lightConnection(): boolean {
  const connection = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  return !!connection && (!!connection.saveData || (connection.effectiveType !== undefined && connection.effectiveType !== '4g'));
}

/** The cards an offer features (today's and the next rotation's). */
function featuredCardIds(rotations: { current?: { cards: Record<string, string[]> } | null; next?: { cards: Record<string, string[]> } | null } | undefined): string[] {
  if (!rotations) return [];
  return [rotations.current, rotations.next].flatMap(offer => (offer ? Object.values(offer.cards).flat() : []));
}

/** Starts warming the account screens; the returned function stops it (sign-out, unmount). */
export function warmAccountScreens(): () => void {
  let cancelled = false;
  const isCancelled = () => cancelled;
  let stopCards: (() => void) | undefined;

  const run = async () => {
    // 1. Data: the same cached loaders the banner screens use.
    const [daily, weekly] = await Promise.allSettled([loadDailyRotations(), loadWeeklyRotations()]);
    if (cancelled) return;
    // 2. Small art (a few hundred KB in all).
    await warmImages([...PACK_ART, ...ALBUM_ART, ...SHOP_ART, ...AVATAR_FRAMES.map(frame => frame.image)], isCancelled);
    if (cancelled) return;
    // 3. The featured cards of both banners: photo, flag and crest.
    const ids = new Set([
      ...featuredCardIds(daily.status === 'fulfilled' ? daily.value as never : undefined),
      ...featuredCardIds(weekly.status === 'fulfilled' ? weekly.value as never : undefined),
    ]);
    const players = Array.from(ids).flatMap(id => { const card = albumCard(id); return card ? [card] : []; });
    stopCards = preloadCardAssets(players);
    // 4. The profile covers are the heavy part (about 3 MB): only on a good connection.
    if (!lightConnection()) await warmImages(PROFILE_COVER_PRESETS.map(cover => cover.src), isCancelled);
  };

  // Wait for the first screen to settle and for idle time, and for the tab to be visible.
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  const timer = setTimeout(() => {
    const start = () => { if (!cancelled) void run().catch(() => undefined); };
    if (idle) idle(start, { timeout: 4000 }); else start();
  }, 1800);

  return () => { cancelled = true; clearTimeout(timer); stopCards?.(); };
}

/**
 * Warms the art of the game itself (the solo flow and the cards), for everyone, signed in or not:
 * the first screens (difficulty, crest, coach, formation, draft) have the small art on hand before
 * the player gets there, instead of showing it piece by piece. Small files first, then the card
 * textures, then every club crest (about 1 MB, local). Idle time only, a few requests at a time.
 */
export function warmGameArt(): () => void {
  let cancelled = false;
  const isCancelled = () => cancelled;
  const run = async () => {
    const flags = Array.from(new Set([...Object.values(NATION_CODES), 'un', 'gb-sct'])).map(flagUrl);
    const traits = Array.from(TRAIT_KEYS, key => `/traits/${key}.webp`);
    await warmImages([...DIFFICULTY_ART, ...TACTIC_ART, ...ROLE_ART, ...flags, ...COACHES.flatMap(coach => (coach.photoUrl ? [coach.photoUrl] : []))], isCancelled);
    if (cancelled) return;
    // The crest screen comes right after the difficulty one: every crest next, then the card art.
    if (!lightConnection()) await warmImages(CREST_CATALOG.flatMap(group => group.crests.map(crest => crest.url)), isCancelled);
    if (cancelled) return;
    await warmImages([...CARD_FRAME_ART, ...RARITIES.map(rarity => cardTexture(rarity, 0)), ...traits], isCancelled);
  };
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  const timer = setTimeout(() => {
    const start = () => { if (!cancelled) void run().catch(() => undefined); };
    if (idle) idle(start, { timeout: 3000 }); else start();
  }, 600);
  return () => { cancelled = true; clearTimeout(timer); };
}
