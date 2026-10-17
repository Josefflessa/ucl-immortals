// UCL Immortals — an account's avatar (photo on its background colour) with its frame.
// Shared by lists that show other players: the online lobby, rankings, friends.

import { getProfileAvatarBackground } from '@shared/profileAppearance';
import { resolveProfileAvatarImage } from '../../lib/profileAvatars';
import { cn } from '../../lib/utils';
import FramedAvatar from './AvatarFrame';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)?.[0]}` : parts[0]?.slice(0, 2) ?? '?').toUpperCase();
}

function showFallback(event: { currentTarget: HTMLImageElement }) {
  event.currentTarget.style.display = 'none';
  const fallback = event.currentTarget.previousElementSibling as HTMLElement | null;
  if (fallback) fallback.hidden = false;
}

export default function AccountAvatar({ name, avatarKey, avatarUrl, backgroundKey, frameKey, sizeClassName = 'size-12' }: {
  name: string;
  avatarKey: string;
  avatarUrl?: string | null;
  backgroundKey: string;
  frameKey?: string | null;
  /** Tailwind size of the round photo (the frame is drawn around it). */
  sizeClassName?: string;
}) {
  const image = avatarUrl || resolveProfileAvatarImage(avatarKey);
  return (
    <FramedAvatar frameKey={frameKey}>
      <div
        role="img"
        aria-label={`Foto de ${name}`}
        className={cn('relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--ui-line-strong)] font-bold text-[var(--ui-text)]', sizeClassName)}
        style={{ backgroundColor: getProfileAvatarBackground(backgroundKey).color }}
      >
        <span aria-hidden="true" hidden={!!image}>{initials(name)}</span>
        {image ? <img key={image} src={image} alt="" loading="lazy" className={cn('absolute inset-0 size-full', avatarUrl ? 'object-cover' : 'object-contain')} onError={showFallback} /> : null}
      </div>
    </FramedAvatar>
  );
}
