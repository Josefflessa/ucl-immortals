// UCL Immortals — Player face avatar with robust photo fallback
// Lists (scorers, squad rows, swap candidates) used a raw <img> with no error
// handling, so a missing SoFIFA asset (404) showed a broken image. This walks the
// same multi-version fallback chain as the card and lands on a placeholder.

import { useState } from 'react';
import { SOFIFA_MAPPING, getBasePlayerId } from './PlayerCard';
import { getRarityColor } from '../../lib/gameData';

interface PlayerAvatarProps {
  playerId: string;
  rarity?: string;
  size?: number;          // px (width = height)
  rounded?: string;       // tailwind radius class
  ring?: boolean;         // show rarity-colored ring
  fallback?: React.ReactNode;
}

export default function PlayerAvatar({
  playerId,
  rarity,
  size = 40,
  rounded = 'rounded-lg',
  ring = true,
  fallback,
}: PlayerAvatarProps) {
  const m = SOFIFA_MAPPING[getBasePlayerId(playerId)];
  const urls: string[] = [];
  if (m) {
    const padded = String(m.id).padStart(6, '0');
    const prefix = `https://cdn.sofifa.net/players/${padded.slice(0, 3)}/${padded.slice(3, 6)}`;
    urls.push(`${prefix}/${m.ver}_120.png`);
    if (m.ver > 23) urls.push(`${prefix}/23_120.png`);
    if (m.ver > 22) urls.push(`${prefix}/22_120.png`);
    urls.push(`${prefix}/${m.ver}_360.png`);
  }

  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);
  const url = urls[idx] ?? null;
  const color = rarity ? getRarityColor(rarity as Parameters<typeof getRarityColor>[0]) : '#2A2A3A';

  const handleError = () => {
    if (idx < urls.length - 1) setIdx(i => i + 1);
    else setFailed(true);
  };

  return (
    <div
      className={`overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#10101d] ${rounded}`}
      style={{ width: size, height: size, border: ring ? `1.5px solid ${color}` : undefined }}
    >
      {url && !failed ? (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={handleError}
          className="w-full h-full object-cover"
          style={{ objectPosition: 'center top', scale: '1.2' }}
        />
      ) : (
        fallback ?? <span className="text-sm font-bold" style={{ color }}>⚽</span>
      )}
    </div>
  );
}
