// UCL Immortals — event frame (or a completed club's frame) drawn around a profile avatar.
// The frame art is a transparent ring a bit larger than the avatar, so it sits
// outside the avatar's own circle without covering the portrait.

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { AVATAR_FRAME_BY_KEY } from '@shared/game/events';
import { clubOfRewardKey } from '@shared/game/clubRewards';
import { ClubFrameRing, COMPACT_FRAME_SCALE, CompactClubFrameRing } from './ClubRewards';
import { cn } from '../../lib/utils';

/** Frame image size relative to the avatar it surrounds. */
export const FRAME_SCALE = 1.4;

export function FrameImage({ frameKey, className }: { frameKey: string; className?: string }) {
  const clubId = clubOfRewardKey(frameKey);
  if (clubId) return <ClubFrameRing clubId={clubId} className={className} />;
  const frame = AVATAR_FRAME_BY_KEY.get(frameKey);
  if (!frame) return null;
  return <img src={frame.image} alt="" aria-hidden="true" draggable={false} className={cn('pointer-events-none select-none', className)} />;
}

/** Wraps an avatar; with a known frame key, the frame is layered over it. `compact` is for small
 *  avatars inside tight spots (the home screen's profile pill): a club's frame is then only its band. */
export default function FramedAvatar({ frameKey, children, className, compact = false }: {
  frameKey?: string | null;
  children: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  const clubId = frameKey ? clubOfRewardKey(frameKey) : null;
  const frame = frameKey && !clubId ? AVATAR_FRAME_BY_KEY.get(frameKey) : undefined;
  if (!clubId && !frame) return <>{children}</>;
  const scale = clubId && compact ? COMPACT_FRAME_SCALE : FRAME_SCALE;
  const offset = `${((scale - 1) / 2) * -100}%`;
  const ringStyle = { left: offset, top: offset, width: `${scale * 100}%`, height: `${scale * 100}%` };
  return (
    <FrameRoom className={className} scale={scale} compact={compact}>
      {children}
      {clubId
        ? (compact
          ? <CompactClubFrameRing clubId={clubId} className="absolute z-[1]" style={ringStyle} />
          : <ClubFrameRing clubId={clubId} className="absolute z-[1]" style={ringStyle} />)
        : <img src={frame!.image} alt="" aria-hidden="true" draggable={false} className="pointer-events-none absolute z-[1] max-w-none select-none" style={ringStyle} />}
    </FrameRoom>
  );
}

/** The framed avatar's box. The ring reaches (FRAME_SCALE - 1) / 2 of the avatar beyond it on
 *  each side, so the box keeps that much room around it: nothing next to it (a name, a button)
 *  runs into the ring, whatever the avatar's size on that screen. */
function FrameRoom({ className, children, scale, compact }: { className?: string; children: ReactNode; scale: number; compact: boolean }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setSize(element.offsetWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const reach = Math.round(size * ((scale - 1) / 2));
  return (
    <span ref={ref} className={cn('relative inline-flex w-fit shrink-0', className)} style={{ marginInline: reach, marginBottom: compact ? 0 : Math.round(reach * 0.8) }}>
      {children}
    </span>
  );
}
