// UCL Immortals — <Crest> : small, memoized, lazy-loaded club badge.
// Renders the Wikimedia crest for a given crestId; if the id is unknown OR the image fails
// to load, it falls back to a colored initials badge so nothing ever shows a broken image.
import { memo, useState } from 'react';
import { getCrest } from '../../lib/crests';

interface CrestProps {
  crestId?: string | null;
  /** Fallback label when there is no crest (e.g. the team name) — first letters are shown. */
  name?: string;
  size?: number;
  className?: string;
}

// Deterministic accent color from a string (stable per team, no flicker).
function hueFrom(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h}, 45%, 42%)`;
}

function initialsOf(s: string): string {
  const words = s.replace(/[^\wÀ-ÿ ]/g, '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '⚽';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function CrestImpl({ crestId, name, size = 24, className }: CrestProps) {
  const [failed, setFailed] = useState(false);
  const crest = getCrest(crestId);

  if (crest && !failed) {
    return (
      <img
        src={crest.url}
        alt={crest.name}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={className}
        style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
      />
    );
  }

  // Fallback: initials badge (from crest name, provided name, or a ball).
  const label = crest?.name ?? name ?? '';
  return (
    <div
      className={className}
      style={{
        width: size, height: size, flexShrink: 0, borderRadius: '50%',
        background: label ? hueFrom(label) : '#2A2A3A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontWeight: 900, fontSize: Math.max(8, size * 0.4),
        fontFamily: 'Rajdhani, sans-serif', lineHeight: 1,
      }}
      title={label}
    >
      {label ? initialsOf(label) : '⚽'}
    </div>
  );
}

const Crest = memo(CrestImpl);
export default Crest;
