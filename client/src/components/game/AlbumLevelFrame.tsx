// UCL Immortals — the album level of a player's card (★2–★5): the metalwork that grows OUTSIDE
// the shield (public/cards/album-level-N.webp, cut from the approved sheet with only what lies
// beyond the original border). The card keeps its own border and interior untouched.
//
// Coloured like the card's ring (rarity, special trait, Única, dual): the artwork is a mask
// filled with the ring's metal gradient, and its own shading is laid back over it, so a Bronze
// card's frame stays bronze at every level.
import type { CSSProperties } from 'react';
import { ringGradient } from './CardShield';

export type AlbumLevel = 1 | 2 | 3 | 4 | 5;

/** Where the shield sits in each cut (fractions of the shield): the layer is placed so the
 *  shield in the artwork lands exactly on the card. Measured by the cutting script. */
const PLACEMENT: Record<2 | 3 | 4 | 5, { left: number; top: number; width: number; height: number }> = {
  2: { left: 0.0208, top: 0.0177, width: 1.0415, height: 1.0453 },
  3: { left: 0.0243, top: 0.0904, width: 1.0456, height: 1.1526 },
  4: { left: 0.0816, top: 0.0905, width: 1.1571, height: 1.1549 },
  5: { left: 0.079, top: 0.1185, width: 1.155, height: 1.1847 },
};

export default function AlbumLevelFrame({ level, color, compact = false }: {
  level?: AlbumLevel;
  color: string;
  /** The small card (grids, the pitch): its fine lines are thickened a touch so they still read. */
  compact?: boolean;
}) {
  if (!level || level < 2) return null;
  const p = PLACEMENT[level as 2 | 3 | 4 | 5];
  const url = `/cards/album-level-${level}.webp`;
  const box: CSSProperties = {
    position: 'absolute',
    left: `${-p.left * 100}%`,
    top: `${-p.top * 100}%`,
    width: `${p.width * 100}%`,
    height: `${p.height * 100}%`,
    pointerEvents: 'none',
    zIndex: 0,
  };
  const mask: CSSProperties = {
    WebkitMaskImage: `url(${url})`,
    maskImage: `url(${url})`,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
  };
  return (
    <div aria-hidden="true" style={box}>
      {/* The metal, in the card's colour. */}
      <div key={`metal-${url}`} style={{ position: 'absolute', inset: 0, ...mask, background: ringGradient(color), filter: compact ? `drop-shadow(0 0 0.6px ${color}) drop-shadow(0 0 0.4px ${color})` : undefined }} />
      {/* Its relief (bevels, highlights) from the artwork itself, laid over the colour. */}
      <img
        key={`relief-${url}`}
        src={url}
        alt=""
        draggable={false}
        loading="eager"
        fetchPriority="high"
        decoding="sync"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill', filter: 'grayscale(1) contrast(1.15)', mixBlendMode: 'overlay', opacity: 0.85 }}
      />
    </div>
  );
}
