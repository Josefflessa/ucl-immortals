// UCL Immortals — Player face avatar with robust photo fallback
// Lists (scorers, squad rows, swap candidates) used a raw <img> with no error
// handling, so a missing SoFIFA asset (404) showed a broken image. This walks the
// same multi-version fallback chain as the card and lands on a placeholder.

import PlayerPortrait from './PlayerPortrait';
import { buildPlayerPhotoSources } from './PlayerCard';
import { getRarityColor } from '../../lib/gameData';

interface PlayerAvatarProps {
  playerId: string;
  photoUrl?: string;
  rarity?: string;
  size?: number;          // px (width = height)
  rounded?: string;       // tailwind radius class
  ring?: boolean;         // show rarity-colored ring
  fallback?: React.ReactNode;
}

export default function PlayerAvatar({
  playerId,
  photoUrl,
  rarity,
  size = 40,
  rounded = 'rounded-lg',
  ring = true,
  fallback,
}: PlayerAvatarProps) {
  const urls = buildPlayerPhotoSources(playerId, true, photoUrl);
  const isUnique = urls[0]?.startsWith('/players/unico/') ?? false;

  const color = rarity ? getRarityColor(rarity as Parameters<typeof getRarityColor>[0]) : '#2A2A3A';

  return (
    <div
      onContextMenu={event => event.preventDefault()}
      className={`overflow-hidden flex-shrink-0 flex items-center justify-center bg-[#10101d] ${rounded}`}
      style={{ width: size, height: size, border: ring ? `1.5px solid ${color}` : undefined }}
    >
      <PlayerPortrait
        playerId={playerId}
        photoUrl={photoUrl}
        alt=""
        lowRes
        loading={isUnique ? 'eager' : 'lazy'}
        className="w-full h-full object-cover"
        style={{ objectPosition: 'center top', scale: '1.2' }}
        fallback={
          fallback ?? <span className="text-sm font-bold" style={{ color }}>⚽</span>
        }
      />
    </div>
  );
}
