/**
 * Dev only: the match harness can play a chosen lance (`#partida?lance=kind/variant/finish`),
 * to check a rare play end to end (narration against the pitch) without waiting for it.
 * In production builds this always returns undefined.
 */
import type { MatchEvent, PlayKind } from '@shared/game/engine/teamModel';
import { epicFinishesFor, finishesFor, PLAY_VARIANTS, type FinishStyle, type Outcome, type PlayVariant } from '@shared/game/playVariants';

export interface ForcedLance { kind: PlayKind; variant: PlayVariant; finish: FinishStyle; outcome: Outcome }

const GOALS: readonly string[] = ['low', 'high', 'chip', 'postin', 'deflect', 'fumble', 'panenka', 'rebound'];
const SAVES: readonly string[] = ['parry', 'catch', 'tip', 'feet', 'double'];

export function forcedLance(): ForcedLance | null {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null;
  const match = window.location.hash.match(/[?&]lance=([a-z_]+)\/([a-z]+)\/([a-z]+)/);
  if (!match) return null;
  const [, kind, variant, finish] = match as unknown as [string, PlayKind, PlayVariant, FinishStyle];
  if (!(PLAY_VARIANTS[kind] as readonly string[] | undefined)?.includes(variant)) return null;
  const outcome: Outcome = GOALS.includes(finish) ? 'goal' : SAVES.includes(finish) ? 'save' : 'miss';
  if (![...finishesFor(kind, variant, outcome), ...epicFinishesFor(kind, variant, outcome)].includes(finish)) return null;
  return { kind, variant, finish, outcome };
}

/** The forced variant and finish for this event, when it is the forced lance's kind and outcome. */
export function forcedPlayFor(event: MatchEvent, outcome: Outcome): { variant: PlayVariant; finish: FinishStyle } | undefined {
  const lance = forcedLance();
  if (!lance || event.play?.kind !== lance.kind || outcome !== lance.outcome) return undefined;
  return { variant: lance.variant, finish: lance.finish };
}
