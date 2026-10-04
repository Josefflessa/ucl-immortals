// UCL Immortals — time-limited account events.
// An event has a window and a few objectives counted from the competitions an
// account completes inside that window. Completing every objective unlocks the
// event's avatar frame for good. Progress is derived from competition_history on
// the server (see server/events.ts), so the browser can never grant a frame.

import type { CareerCompetition } from './achievements';
import type { CompetitionFinishStage } from './competitionRanking';

export interface AvatarFrame {
  key: string;
  name: string;
  /** Transparent ring drawn over the avatar (public/frames). */
  image: string;
  /** Accent used around the frame in the UI. */
  color: string;
}

export const AVATAR_FRAMES: readonly AvatarFrame[] = [
  { key: 'noite-dos-imortais', name: 'Noite dos Imortais', image: '/frames/noite-dos-imortais.webp', color: '#A855F7' },
];

export const AVATAR_FRAME_BY_KEY = new Map(AVATAR_FRAMES.map(frame => [frame.key, frame]));

export function isAvatarFrameKey(key: unknown): key is string {
  return typeof key === 'string' && AVATAR_FRAME_BY_KEY.has(key);
}

export interface EventObjective {
  id: string;
  /** Goal shown to the player, already with the target number. */
  label: string;
  target: number;
  counts: (competition: CareerCompetition) => boolean;
}

export interface GameEvent {
  id: string;
  name: string;
  description: string;
  /** Window in ms since epoch: [startsAt, endsAt). */
  startsAt: number;
  endsAt: number;
  frameKey: string;
  objectives: readonly EventObjective[];
}

const SEMIFINAL_OR_BETTER = new Set<CompetitionFinishStage>(['semifinalist', 'runnerUp', 'champion']);
const GOLD_OR_ABOVE = new Set(['gold', 'legendary', 'immortal']);
const LEGENDARY_OR_ABOVE = new Set(['legendary', 'immortal']);

const isChampion = (c: CareerCompetition) => c.champion || c.finishStage === 'champion';
const reachedSemifinal = (c: CareerCompetition) => isChampion(c) || (c.finishStage !== null && SEMIFINAL_OR_BETTER.has(c.finishStage));

/** Midnight in Brasília (UTC−3) of the given day. */
const brasiliaMidnight = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day, 3);

export const GAME_EVENTS: readonly GameEvent[] = [
  {
    id: 'noite-dos-imortais-2026',
    name: 'Noite dos Imortais',
    description: 'Complete os três desafios até 31 de outubro e ganhe a moldura exclusiva para a sua foto de perfil.',
    startsAt: brasiliaMidnight(2026, 10, 4),
    endsAt: brasiliaMidnight(2026, 11, 1),
    frameKey: 'noite-dos-imortais',
    objectives: [
      { id: 'competitions', label: 'Conclua 5 competições', target: 5, counts: () => true },
      { id: 'semifinals', label: 'Chegue à semifinal 3 vezes no Ouro ou acima', target: 3, counts: c => GOLD_OR_ABOVE.has(c.difficultyId) && reachedSemifinal(c) },
      { id: 'title', label: 'Seja campeão no Lendário ou Imortal', target: 1, counts: c => LEGENDARY_OR_ABOVE.has(c.difficultyId) && isChampion(c) },
    ],
  },
];

export const GAME_EVENT_BY_ID = new Map(GAME_EVENTS.map(event => [event.id, event]));

export type GameEventStatus = 'upcoming' | 'active' | 'ended';

export function gameEventStatus(event: GameEvent, now: number): GameEventStatus {
  if (now < event.startsAt) return 'upcoming';
  return now < event.endsAt ? 'active' : 'ended';
}

export interface EventObjectiveProgress {
  id: string;
  label: string;
  progress: number;
  target: number;
  done: boolean;
}

/** Progress of each objective, counting only competitions completed inside the window. */
export function evaluateGameEvent(event: GameEvent, career: readonly CareerCompetition[]): { objectives: EventObjectiveProgress[]; completed: boolean } {
  const inWindow = career.filter(c => c.completedAt >= event.startsAt && c.completedAt < event.endsAt);
  const objectives = event.objectives.map(objective => {
    const progress = inWindow.filter(objective.counts).length;
    return { id: objective.id, label: objective.label, progress, target: objective.target, done: progress >= objective.target };
  });
  return { objectives, completed: objectives.every(objective => objective.done) };
}
