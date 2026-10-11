/**
 * Discipline and fitness marks drawn in code: a booking card and an injury. Emoji cards
 * (🟨🟥🩹) look different on every system and shrink to specks;
 * these stay crisp at any size and sit on the text line like a glyph (1em by default).
 */
import { Bandage } from 'lucide-react';

interface IconProps {
  /** CSS size of the glyph (its height); 1em follows the surrounding text. */
  size?: string | number;
  className?: string;
  title?: string;
}

const glyph = (size: string | number) => ({
  display: 'inline-block',
  width: size,
  height: size,
  verticalAlign: '-0.15em',
  flexShrink: 0,
});

/** A booking card, tilted like one held up by the referee; `count` 2 fans out two yellows. */
export function CardIcon({ color, count = 1, size = '1em', className, title }: IconProps & { color: 'yellow' | 'red'; count?: 1 | 2 }) {
  const fill = color === 'yellow' ? '#FACC15' : '#EF4444';
  const edge = color === 'yellow' ? '#A16207' : '#7F1D1D';
  // The card fills the glyph's height (a referee's card is tall and narrow), so it reads at text size.
  const card = (dx: number, rotate: number) => (
    <g transform={`translate(${dx} 0) rotate(${rotate} 12 12)`}>
      <rect x="5.5" y="1.5" width="13" height="21" rx="2.2" fill={fill} stroke={edge} strokeWidth="1" />
      <rect x="7.3" y="3.3" width="2.8" height="17.4" rx="1.3" fill="#fff" opacity="0.3" />
    </g>
  );
  return (
    <svg viewBox="0 0 24 24" style={{ ...glyph(size), overflow: 'visible' }} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {count === 2 ? <>{card(-3.5, -12)}{card(3.5, 8)}</> : card(0, 8)}
    </svg>
  );
}

/** An injury: a bandage, in amber. */
export function InjuryIcon({ size = '1em', className, title }: IconProps) {
  return (
    <span style={{ ...glyph(size), color: '#F59E0B', lineHeight: 0 }} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} title={title}>
      <Bandage width="100%" height="100%" strokeWidth={2.4} />
    </span>
  );
}
