import { memo, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { buildPlayerPhotoSources } from './PlayerCard';

export interface PlayerPortraitProps {
  playerId: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  lowRes?: boolean;
  /** Foto explícita da carta, usada antes do catálogo local e dos fallbacks. */
  photoUrl?: string;
  fallback?: ReactNode;
}

/**
 * One resilient portrait loader for compact lists and the live match field.
 * Local portraits are always attempted first; a failed asset walks the same
 * local/SoFIFA chain used by the full card instead of leaving a broken image.
 */
export function PlayerPortrait({
  playerId,
  alt = '',
  className,
  style,
  loading = 'eager',
  fetchPriority,
  lowRes = true,
  photoUrl,
  fallback,
}: PlayerPortraitProps) {
  const sources = useMemo(
    () => buildPlayerPhotoSources(playerId, lowRes, photoUrl),
    [playerId, lowRes, photoUrl],
  );
  const [sourceIndex, setSourceIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  // A list row/field slot can be reused for another card without being
  // unmounted. Never carry the previous player's failed fallback into it.
  useEffect(() => {
    setSourceIndex(0);
    setFailed(false);
  }, [playerId, lowRes, photoUrl]);

  const url = sources[sourceIndex] ?? null;
  const handleError = () => {
    if (sourceIndex < sources.length - 1) {
      setSourceIndex(index => index + 1);
    } else {
      setFailed(true);
    }
  };

  if (!url || failed) return <>{fallback ?? null}</>;

  return (
    <img
      key={`${playerId}:${url}`}
      src={url}
      alt={alt}
      className={className}
      style={style}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding="async"
      referrerPolicy="no-referrer"
      draggable={false}
      onError={handleError}
    />
  );
}

/**
 * Warms the browser cache for the two starting XIs before the match field is
 * painted. The cleanup prevents late image callbacks after leaving the match.
 */
export function preloadPlayerPhotos(playerIds: string[], lowRes = true): () => void {
  if (typeof Image === 'undefined') return () => undefined;

  let active = true;
  const images: HTMLImageElement[] = [];
  const uniqueIds = Array.from(new Set(playerIds));

  uniqueIds.forEach(playerId => {
    const sources = buildPlayerPhotoSources(playerId, lowRes);
    if (sources.length === 0) return;

    const image = new Image();
    images.push(image);
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    let index = 0;
    const tryNext = () => {
      if (!active || index >= sources.length) return;
      image.src = sources[index++];
    };
    image.onerror = tryNext;
    tryNext();
  });

  return () => {
    active = false;
    images.forEach(image => {
      image.onload = null;
      image.onerror = null;
    });
  };
}

// Memoized: dozens of these render per screen (squad rows, the live field, the
// draft board) and are pure given their props — no reason to redraw one whose
// own playerId/photoUrl/style didn't change just because a parent re-rendered.
export default memo(PlayerPortrait);
