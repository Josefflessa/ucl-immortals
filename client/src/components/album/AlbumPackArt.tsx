// The album's own packets and envelopes (not the game's card packs): one artwork per tier, in
// client/public/album (cut from generated sheets, background removed). A packet's crimped top
// strip (ALBUM_PACK_TEAR_AT of its height) is the flap torn off when it is opened.
import type { CSSProperties } from 'react';
import type { AlbumItemKind, AlbumPackTier } from '@shared/game/album';
import { cn } from '../../lib/utils';

/** Width / height of a packet's artwork. */
export const ALBUM_PACK_ASPECT = 0.595;
/** Width / height of an envelope's artwork. */
export const ALBUM_ENVELOPE_ASPECT = 1.27;
/** The crimped top strip, in % of the packet's height: the flap torn off. */
export const ALBUM_PACK_TEAR_AT = 8;

export function albumItemImage(kind: AlbumItemKind, tier: AlbumPackTier): string {
  return `/album/${kind}-${tier}.webp`;
}

export default function AlbumPackArt({ kind = 'pack', tier, className, style }: { kind?: AlbumItemKind; tier: AlbumPackTier; className?: string; style?: CSSProperties }) {
  return (
    <img
      src={albumItemImage(kind, tier)}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      className={cn('pointer-events-none select-none', kind === 'pack' ? 'object-fill' : 'object-contain', className)}
      style={style}
    />
  );
}
