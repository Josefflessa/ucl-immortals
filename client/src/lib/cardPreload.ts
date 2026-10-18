/**
 * Warms the images a player card needs (photo, flag, club crest) before the card is shown, so
 * a goal's card or a line-up does not pop in piece by piece. Photos have a chain of fallbacks
 * (local webp, png, then the CDN): each source is tried in the card's own order and the first
 * that loads stops the chain, so the card later hits the browser cache on its first try.
 * Work is spread over a few at a time and only starts when the browser is idle.
 */

import { crestIdForClub, getCrest } from '@shared/game/crests';
import type { Player } from '@shared/game/gameData';
import { getEvolutionLevel } from '@shared/game/gameEngine';
import { FRAME_URL } from '../components/game/CardShield';
import { buildPlayerPhotoSources, cardTexture, getFlagUrl, UNIQUE_STYLE } from '../components/game/PlayerCard';

const CONCURRENCY = 4;
const requested = new Set<string>();
/** Kept alive so the decoded images are not collected before the cards use them. */
const alive: HTMLImageElement[] = [];
const cardArtworkLoads = new Map<string, Promise<void>>();

function preloadDecodedImage(url: string): Promise<void> {
  const existing = cardArtworkLoads.get(url);
  if (existing) return existing;

  const pending = new Promise<void>(resolve => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => {
      alive.push(image);
      const decoded = image.decode?.();
      if (decoded) void decoded.catch(() => undefined).then(resolve);
      else resolve();
    };
    image.onerror = () => resolve();
    image.src = url;
  });
  cardArtworkLoads.set(url, pending);
  return pending;
}

/** Waits for the frame, texture and album trim used by compact recruitment cards to decode. */
export function preloadPlayerCardArtwork(players: readonly Player[]): Promise<void> {
  const urls = new Set<string>([FRAME_URL]);
  for (const player of players) {
    const unique = UNIQUE_STYLE[player.id];
    urls.add(unique?.texture ?? cardTexture(player.rarity, getEvolutionLevel(player), player.specialization));
    if (unique?.render) urls.add(unique.render);
    if ((player.competitionAlbumLevel ?? 0) >= 2) urls.add(`/cards/album-level-${player.competitionAlbumLevel}.webp`);
  }
  return Promise.all(Array.from(urls, preloadDecodedImage)).then(() => undefined);
}

function load(url: string): Promise<boolean> {
  return new Promise(resolve => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => { alive.push(image); void image.decode?.().catch(() => undefined); resolve(true); };
    image.onerror = () => resolve(false);
    image.src = url;
  });
}

async function firstThatLoads(urls: readonly string[]): Promise<void> {
  for (const url of urls) {
    if (requested.has(url)) return;
    requested.add(url);
    if (await load(url)) return;
  }
}

/** Warms plain images (art that a screen will show) with the same idle, few-at-a-time pacing. */
export function warmImages(urls: readonly string[], isCancelled: () => boolean = () => false): Promise<void> {
  const queue = urls.filter(url => !requested.has(url));
  const worker = async () => {
    for (let url = queue.shift(); url !== undefined && !isCancelled(); url = queue.shift()) {
      if (requested.has(url)) continue;
      requested.add(url);
      await load(url);
    }
  };
  return Promise.all(Array.from({ length: CONCURRENCY }, worker)).then(() => undefined);
}

/** The jobs for one player: its photo (with the fallback chain), its flag and its club crest. */
export function cardAssetJobs(player: Player): Array<() => Promise<void>> {
  const jobs: Array<() => Promise<void>> = [];
  const photos = buildPlayerPhotoSources(player.id, false, player.photoUrl);
  if (photos.length > 0) jobs.push(() => firstThatLoads(photos));
  const flag = getFlagUrl(player.nation);
  if (flag) jobs.push(() => firstThatLoads([flag]));
  const crestId = crestIdForClub(player.club);
  const crest = crestId ? getCrest(crestId) : null;
  if (crest?.url) jobs.push(() => firstThatLoads([crest.url]));
  return jobs;
}

/** Starts warming the cards of these players (safe to call again with the same players). */
export function preloadCardAssets(players: readonly Player[]): () => void {
  const queue = players.flatMap(cardAssetJobs);
  let cancelled = false;
  const worker = async () => {
    for (let job = queue.shift(); job && !cancelled; job = queue.shift()) await job().catch(() => undefined);
  };
  const start = () => { for (let i = 0; i < CONCURRENCY; i++) void worker(); };
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(start, { timeout: 800 }); else setTimeout(start, 200);
  return () => { cancelled = true; };
}
