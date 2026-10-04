// UCL Immortals — event frame drawn around a profile avatar.
// The frame art is a transparent ring a bit larger than the avatar, so it sits
// outside the avatar's own circle without covering the portrait.

import type { ReactNode } from 'react';
import { AVATAR_FRAME_BY_KEY } from '@shared/game/events';
import { cn } from '../../lib/utils';

/** Frame image size relative to the avatar it surrounds. */
export const FRAME_SCALE = 1.4;
const FRAME_OFFSET = `${((FRAME_SCALE - 1) / 2) * -100}%`;

export function FrameImage({ frameKey, className }: { frameKey: string; className?: string }) {
  const frame = AVATAR_FRAME_BY_KEY.get(frameKey);
  if (!frame) return null;
  return <img src={frame.image} alt="" aria-hidden="true" draggable={false} className={cn('pointer-events-none select-none', className)} />;
}

/** Wraps an avatar; with a known frame key, the frame is layered over it. */
export default function FramedAvatar({ frameKey, children, className }: {
  frameKey?: string | null;
  children: ReactNode;
  className?: string;
}) {
  const frame = frameKey ? AVATAR_FRAME_BY_KEY.get(frameKey) : undefined;
  if (!frame) return <>{children}</>;
  return (
    <span className={cn('relative inline-flex w-fit shrink-0', className)}>
      {children}
      <img
        src={frame.image}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="pointer-events-none absolute z-[1] max-w-none select-none"
        style={{ left: FRAME_OFFSET, top: FRAME_OFFSET, width: `${FRAME_SCALE * 100}%`, height: `${FRAME_SCALE * 100}%` }}
      />
    </span>
  );
}
