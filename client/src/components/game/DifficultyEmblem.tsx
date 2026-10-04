// UCL Immortals — difficulty emblem.
// One crest that evolves across the five difficulties (public/difficulty); all
// share the same canvas scale, so higher tiers read wider and richer.

import { cn } from '../../lib/utils';

const DIFFICULTY_KEYS = new Set(['bronze', 'silver', 'gold', 'legendary', 'immortal']);

export default function DifficultyEmblem({ difficulty, size = 40, className }: {
  difficulty: string | null | undefined;
  size?: number;
  className?: string;
}) {
  if (!difficulty || !DIFFICULTY_KEYS.has(difficulty)) return null;
  return (
    <img
      src={`/difficulty/${difficulty}.webp`}
      alt=""
      aria-hidden="true"
      draggable={false}
      width={size}
      height={size}
      className={cn('pointer-events-none shrink-0 select-none', className)}
      style={{ width: size, height: size }}
    />
  );
}
