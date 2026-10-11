// UCL Immortals — the rewards for completing a club in the album, drawn in code from the club's
// two colours (shared/game/clubColors) and its crest, so every club with players gets its own
// without any artwork: a profile frame (a metal ring in its colours with the crest in a medallion)
// and a profile background (bold brush strokes in its colours, its crest large and faded).
import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { getCrest } from '@shared/game/crests';
import { clubColors } from '@shared/game/clubColors';
import { cn } from '../../lib/utils';

/** Relative luminance (0 black – 1 white) of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A club colour that reads on the dark ground: near-black becomes graphite. */
function onDark(hex: string): string {
  return luminance(hex) < 0.03 ? '#4A5160' : hex;
}

const GOLD = ['#F7E7A6', '#C9A84C', '#6E5418'];

/** The profile frame alone: a ring in the club's colours, gold hairlines, Art Deco caps and the
 *  crest on top. It fills its box, which is FRAME_SCALE (1.4×) the avatar it surrounds. */
export function ClubFrameRing({ clubId, className, style }: { clubId: string; className?: string; style?: CSSProperties }) {
  const crest = getCrest(clubId);
  const { primary, secondary } = clubColors(clubId);
  const main = onDark(primary);
  const second = onDark(secondary);
  const id = `cf-${clubId}`;
  return (
    <span aria-hidden="true" className={cn('pointer-events-none relative block', className)} style={style}>
      <svg viewBox="0 0 140 140" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id={`${id}-metal`} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor={`color-mix(in srgb, ${main} 50%, #fff)`} />
            <stop offset="0.35" stopColor={main} />
            <stop offset="0.7" stopColor={`color-mix(in srgb, ${main} 70%, #000)`} />
            <stop offset="1" stopColor={`color-mix(in srgb, ${main} 45%, #000)`} />
          </linearGradient>
          <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={GOLD[0]} /><stop offset="0.5" stopColor={GOLD[1]} /><stop offset="1" stopColor={GOLD[2]} />
          </linearGradient>
        </defs>
        {/* The band: the club colour in metal, knurled, between gold hairlines, with a secondary-colour fillet. */}
        <circle cx="70" cy="70" r="66" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.3" />
        <circle cx="70" cy="70" r="61" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="8.5" />
        <circle cx="70" cy="70" r="61" fill="none" stroke={`color-mix(in srgb, ${main} 40%, #000)`} strokeWidth="6" strokeDasharray="0.9 3.1" opacity="0.45" />
        <circle cx="70" cy="70" r="55.4" fill="none" stroke={second} strokeWidth="2.6" />
        <circle cx="70" cy="70" r="53.4" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.2" />
        {/* Art Deco caps at 3 and 9 o'clock: a stepped gold point over the band. */}
        {[0, 180].map(a => (
          <g key={a} transform={`rotate(${a} 70 70)`}>
            <path d="M131 70 L139 64.5 L139 75.5 Z" fill={`url(#${id}-gold)`} stroke={GOLD[2]} strokeWidth="0.6" />
            <rect x="126.5" y="66.5" width="4.5" height="7" fill={`url(#${id}-gold)`} stroke={GOLD[2]} strokeWidth="0.6" />
          </g>
        ))}
        {/* A faceted diamond at the bottom (as on the cards' album frames). */}
        <path d="M70 128 L76 134 L70 141 L64 134 Z" fill={`url(#${id}-gold)`} stroke={GOLD[2]} strokeWidth="0.7" />
        <path d="M70 128 L70 141 M64 134 L76 134" stroke="#FFF6D0" strokeWidth="0.5" opacity="0.6" />
        {/* The crest's medallion at the top, with short gold wings along the band. */}
        <path d="M44 9.5 L54 6.5 L54 12.5 Z M96 9.5 L86 6.5 L86 12.5 Z" fill={`url(#${id}-gold)`} stroke={GOLD[2]} strokeWidth="0.5" />
        <circle cx="70" cy="7" r="15.5" fill={`url(#${id}-gold)`} stroke={GOLD[2]} strokeWidth="0.8" />
        {/* An ivory disc: crests are drawn for a light ground, so even a black one reads. */}
        <radialGradient id={`${id}-ivory`} cx="0.4" cy="0.35" r="0.75">
          <stop offset="0" stopColor="#FFFDF4" /><stop offset="1" stopColor="#E4DCC4" />
        </radialGradient>
        <circle cx="70" cy="7" r="12.8" fill={`url(#${id}-ivory)`} stroke={second} strokeWidth="1.4" />
      </svg>
      {crest && (
        <img src={crest.url} alt="" referrerPolicy="no-referrer" draggable={false}
          className="pointer-events-none absolute object-contain"
          style={{ width: '13.57%', height: '13.57%', left: '43.21%', top: '-1.79%' }} />
      )}
    </span>
  );
}

/** The frame for small avatars (a header pill, a list row): only the band in the club's colours
 *  between its gold hairlines, without the caps, the diamond or the crest's medallion, which
 *  would not fit there. It fills its box, COMPACT_FRAME_SCALE (1.22×) the avatar it surrounds. */
export const COMPACT_FRAME_SCALE = 1.22;

export function CompactClubFrameRing({ clubId, className, style }: { clubId: string; className?: string; style?: CSSProperties }) {
  const { primary, secondary } = clubColors(clubId);
  const main = onDark(primary);
  const second = onDark(secondary);
  const id = `ccf-${clubId}`;
  return (
    <span aria-hidden="true" className={cn('pointer-events-none relative block', className)} style={style}>
      <svg viewBox="0 0 122 122" className="absolute inset-0 size-full overflow-visible">
        <defs>
          <linearGradient id={`${id}-metal`} x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0" stopColor={`color-mix(in srgb, ${main} 50%, #fff)`} />
            <stop offset="0.35" stopColor={main} />
            <stop offset="0.7" stopColor={`color-mix(in srgb, ${main} 70%, #000)`} />
            <stop offset="1" stopColor={`color-mix(in srgb, ${main} 45%, #000)`} />
          </linearGradient>
          <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={GOLD[0]} /><stop offset="0.5" stopColor={GOLD[1]} /><stop offset="1" stopColor={GOLD[2]} />
          </linearGradient>
        </defs>
        <circle cx="61" cy="61" r="59.6" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="2" />
        <circle cx="61" cy="61" r="55.6" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="6.5" />
        <circle cx="61" cy="61" r="51.4" fill="none" stroke={second} strokeWidth="2.4" />
        <circle cx="61" cy="61" r="49.8" fill="none" stroke={`url(#${id}-gold)`} strokeWidth="1.4" />
      </svg>
    </span>
  );
}

/** An avatar inside its club frame (the avatar keeps its own size). */
export function ClubFrame({ clubId, children, className }: { clubId: string; children: ReactNode; className?: string }) {
  return (
    <span className={cn('relative inline-flex w-fit shrink-0', className)}>
      {children}
      <ClubFrameRing clubId={clubId} className="absolute z-[1]" style={{ left: '-20%', top: '-20%', width: '140%', height: '140%' }} />
    </span>
  );
}

/** Profile background: the club's colours in bold dry-brush strokes over a dark ground (the same
 *  composition for every club: only the colours and the crest change), crest faded on the right. */
export function ClubCover({ clubId, className, children }: { clubId: string; className?: string; children?: ReactNode }) {
  const crest = getCrest(clubId);
  const { primary, secondary } = clubColors(clubId);
  const main = onDark(primary);
  const second = onDark(secondary);
  const id = `cc-${clubId}`;
  // A tall, narrow cover (a phone) gives the crest more of its width, so it stays as large.
  const ref = useRef<HTMLElement | null>(null);
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setNarrow(element.offsetWidth < element.offsetHeight * 2.2);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <section ref={ref} className={cn('relative isolate overflow-hidden', className)}>
      <svg className="absolute inset-0 -z-10 size-full" viewBox="0 0 800 260" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <defs>
          {/* Ragged edges and bristle streaks: a stroke painted with a dry brush. */}
          <filter id={`${id}-brush`} x="-10%" y="-40%" width="120%" height="180%">
            <feTurbulence type="fractalNoise" baseFrequency="0.008 0.03" numOctaves="4" seed="7" result="edge" />
            <feDisplacementMap in="SourceGraphic" in2="edge" scale="46" xChannelSelector="R" yChannelSelector="G" result="ragged" />
            <feTurbulence type="fractalNoise" baseFrequency="0.0025 0.06" numOctaves="3" seed="3" result="bristle" />
            <feColorMatrix in="bristle" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.35" result="streaks" />
            <feComposite in="ragged" in2="streaks" operator="in" />
          </filter>
          <linearGradient id={`${id}-fade`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#070910" stopOpacity="0" />
            <stop offset="0.55" stopColor="#070910" stopOpacity="0.45" />
            <stop offset="1" stopColor="#070910" stopOpacity="0.92" />
          </linearGradient>
        </defs>
        <rect width="800" height="260" fill="#0C0D16" />
        <g filter={`url(#${id}-brush)`} opacity="0.95">
          <path d="M-40 210 C 160 150 330 120 520 40 S 760 -20 860 -40" stroke={main} strokeWidth="120" fill="none" strokeLinecap="round" />
          <path d="M-60 300 C 180 250 380 210 600 130 S 800 70 880 60" stroke={second} strokeWidth="58" fill="none" strokeLinecap="round" opacity="0.9" />
          <path d="M120 60 C 300 30 420 10 600 -30" stroke={`color-mix(in srgb, ${main} 60%, #fff)`} strokeWidth="26" fill="none" strokeLinecap="round" opacity="0.55" />
        </g>
        <rect width="800" height="260" fill={`url(#${id}-fade)`} />
      </svg>
      {crest && (
        <img src={crest.url} alt="" referrerPolicy="no-referrer" draggable={false}
          className="pointer-events-none absolute -z-10 object-contain"
          style={{
            // Large, tilted and cut by the edge, blended into the strokes and dissolving towards the content.
            right: narrow ? '-22%' : '-9%', top: narrow ? '-12%' : '-32%', width: narrow ? '100%' : '56%', height: narrow ? '125%' : '165%',
            transform: 'rotate(-9deg)', opacity: 0.5,
            // A faint light rim, so a dark crest (Juventus, Botafogo) still shows on the dark ground.
            filter: 'drop-shadow(0 0 1.5px rgba(255,255,255,.55)) drop-shadow(0 0 10px rgba(255,255,255,.12))',
            WebkitMaskImage: narrow ? 'linear-gradient(to left, #000 60%, transparent 100%)' : 'linear-gradient(to left, #000 35%, transparent 92%)',
            maskImage: narrow ? 'linear-gradient(to left, #000 60%, transparent 100%)' : 'linear-gradient(to left, #000 35%, transparent 92%)',
          }} />
      )}
      {children}
    </section>
  );
}
