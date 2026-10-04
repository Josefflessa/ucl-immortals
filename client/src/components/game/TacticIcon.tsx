// UCL Immortals — tactic icon.
// Each tactic has its own "tactics board" plate artwork (public/tactics). At
// small, inline sizes the plate's frame would eat the space, so the icon zooms
// into the board and shows just its central symbol.

import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';

const TACTIC_IDS = new Set(['balanced', 'possession', 'counter', 'high_press', 'defensive', 'all_out_attack']);

/** Below this size the icon shows the board's symbol only (no frame). */
const SYMBOL_ONLY_MAX = 22;

export default function TacticIcon({ tactic, fallback, size = 20, className, style }: {
  tactic: string | null | undefined;
  /** Shown for an unknown tactic id. */
  fallback?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  if (!tactic || !TACTIC_IDS.has(tactic)) {
    return <span aria-hidden="true" className={className} style={style}>{fallback}</span>;
  }
  const symbolOnly = size <= SYMBOL_ONLY_MAX;
  const art = symbolOnly ? Math.round(size * 1.7) : size;
  return (
    <span
      aria-hidden="true"
      className={cn('relative inline-flex shrink-0 items-center justify-center', symbolOnly && 'overflow-hidden rounded-md', className)}
      style={{ width: size, height: size, ...style }}
    >
      <img
        src={`/tactics/${tactic}.webp`}
        alt=""
        draggable={false}
        loading="lazy"
        decoding="async"
        className="pointer-events-none max-w-none select-none"
        style={{ width: art, height: art }}
      />
    </span>
  );
}
