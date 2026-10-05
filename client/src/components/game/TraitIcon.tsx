// UCL Immortals — special trait icon.
// The special traits have their own medallion artwork (public/traits). At
// chip sizes the round frame would eat the space, so small icons zoom into the
// medallion and show just its central symbol.

import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';

const TRAIT_KEYS = new Set([
  'inForm', 'lobo', 'coringa', 'nomade', 'pilar', 'martir', 'idolo', 'decimoHomem', 'pipoqueiro',
  'noe', 'forasteiro', 'colecionador', 'estribado', 'todosPorUm', 'capitaoNato', 'magnata', 'fragil',
  'prodigio', 'resiliente', 'goleador', 'garcom', 'arrogante', 'mercenario', 'padrinho', 'lapidador',
  'apostador', 'agregador', 'pechincheiro', 'midiatico',
]);
/** Effects named after the trait that grants them. */
const TRAIT_ALIASES: Record<string, string> = { lapidado: 'lapidador' };

export function hasTraitArt(key: string | null | undefined): boolean {
  return !!key && (TRAIT_KEYS.has(key) || key in TRAIT_ALIASES);
}

/** Below this size the icon shows the medallion's symbol only (no frame). */
const SYMBOL_ONLY_MAX = 22;

export default function TraitIcon({ trait, fallback, size = 18, className, style }: {
  trait: string | null | undefined;
  /** Shown when the trait has no artwork (an emoji or any other icon). */
  fallback?: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const key = trait ? TRAIT_ALIASES[trait] ?? trait : null;
  if (!key || !TRAIT_KEYS.has(key)) {
    return <span aria-hidden="true" className={className} style={style}>{fallback}</span>;
  }
  const symbolOnly = size <= SYMBOL_ONLY_MAX;
  const art = symbolOnly ? Math.round(size * 1.55) : size;
  return (
    <span
      aria-hidden="true"
      className={cn('relative inline-flex shrink-0 items-center justify-center', symbolOnly && 'overflow-hidden rounded-full', className)}
      style={{ width: size, height: size, ...style }}
    >
      <img
        src={`/traits/${key}.webp`}
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
