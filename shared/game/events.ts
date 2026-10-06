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

/** One option of a choice event: pick it once, then complete its objectives to unlock its card. */
export interface EventChoice {
  key: string;
  /** Club shown on the option. */
  label: string;
  /** Event Única unlocked by completing the objectives (EVENT_UNIQUE_CARDS). */
  cardId: string;
  crestId: string;
  objectives: readonly EventObjective[];
}

export interface GameEvent {
  id: string;
  name: string;
  description: string;
  /** Window in ms since epoch: [startsAt, endsAt). */
  startsAt: number;
  endsAt: number;
  /** Frame reward of a regular event. */
  frameKey?: string;
  /** Regular event: everyone has these objectives. */
  objectives: readonly EventObjective[];
  /** Choice event: the account picks one option (for good) and gets its objectives and card. */
  choices?: readonly EventChoice[];
}

const SEMIFINAL_OR_BETTER = new Set<CompetitionFinishStage>(['semifinalist', 'runnerUp', 'champion']);
const GOLD_OR_ABOVE = new Set(['gold', 'legendary', 'immortal']);
const LEGENDARY_OR_ABOVE = new Set(['legendary', 'immortal']);

const isChampion = (c: CareerCompetition) => c.champion || c.finishStage === 'champion';
const goldOrAbove = (c: CareerCompetition) => GOLD_OR_ABOVE.has(c.difficultyId);
const withCrest = (crestId: string) => (c: CareerCompetition) => c.crestId === crestId;
/** The same final challenge for every club: a title with its crest on Ouro or above. */
const clubTitle = (crestId: string, club: string): EventObjective => ({
  id: 'title',
  label: `Seja campeão com o escudo do ${club} no Ouro ou acima`,
  target: 1,
  counts: c => withCrest(crestId)(c) && goldOrAbove(c) && isChampion(c),
});
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
  {
    id: 'classicos-sp-2026',
    name: 'Clássicos de São Paulo',
    description: 'Escolha o seu clube e cumpra as missões até 30 de novembro para liberar a Carta Única dele no seu Pacote Único. A escolha é definitiva.',
    startsAt: brasiliaMidnight(2026, 11, 1),
    endsAt: brasiliaMidnight(2026, 12, 1),
    objectives: [],
    choices: [
      {
        key: 'corinthians', label: 'Corinthians', cardId: 'emerson_sheik_unico', crestId: 'corinthians',
        objectives: [
          { id: 'crest', label: 'Conclua 3 competições com o escudo do Corinthians', target: 3, counts: withCrest('corinthians') },
          { id: 'goals', label: 'Marque 40 gols numa competição no Ouro ou acima', target: 1, counts: c => goldOrAbove(c) && c.goals >= 40 },
          clubTitle('corinthians', 'Corinthians'),
        ],
      },
      {
        key: 'palmeiras', label: 'Palmeiras', cardId: 'gustavo_gomez_unico', crestId: 'palmeiras',
        objectives: [
          { id: 'crest', label: 'Conclua 3 competições com o escudo do Palmeiras', target: 3, counts: withCrest('palmeiras') },
          { id: 'defense', label: 'Termine uma competição sofrendo no máximo 10 gols no Ouro ou acima', target: 1, counts: c => goldOrAbove(c) && c.wins + c.draws + c.losses > 0 && c.goalsAgainst <= 10 },
          clubTitle('palmeiras', 'Palmeiras'),
        ],
      },
      {
        key: 'sao-paulo', label: 'São Paulo', cardId: 'luis_fabiano_unico', crestId: 'sao-paulo',
        objectives: [
          { id: 'crest', label: 'Conclua 3 competições com o escudo do São Paulo', target: 3, counts: withCrest('sao-paulo') },
          { id: 'scorer', label: 'Tenha um jogador com 18 gols numa competição no Ouro ou acima', target: 1, counts: c => goldOrAbove(c) && c.topPlayerGoals >= 18 },
          clubTitle('sao-paulo', 'São Paulo'),
        ],
      },
      {
        key: 'santos', label: 'Santos', cardId: 'ganso_unico', crestId: 'santos',
        objectives: [
          { id: 'crest', label: 'Conclua 3 competições com o escudo do Santos', target: 3, counts: withCrest('santos') },
          { id: 'assists', label: 'Tenha um jogador com 10 assistências numa competição no Ouro ou acima', target: 1, counts: c => goldOrAbove(c) && c.topPlayerAssists >= 10 },
          clubTitle('santos', 'Santos'),
        ],
      },
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

/** The objectives an account works on: the event's own, or those of its chosen option. */
export function eventObjectivesFor(event: GameEvent, choiceKey?: string | null): readonly EventObjective[] {
  if (!event.choices) return event.objectives;
  return event.choices.find(choice => choice.key === choiceKey)?.objectives ?? [];
}

/**
 * Progress of each objective, counting only competitions completed inside the window.
 * A choice event without a choice yet has nothing to complete.
 */
export function evaluateGameEvent(event: GameEvent, career: readonly CareerCompetition[], choiceKey?: string | null): { objectives: EventObjectiveProgress[]; completed: boolean } {
  const inWindow = career.filter(c => c.completedAt >= event.startsAt && c.completedAt < event.endsAt);
  const list = eventObjectivesFor(event, choiceKey);
  if (list.length === 0) return { objectives: [], completed: false };
  const objectives = list.map(objective => {
    const progress = inWindow.filter(objective.counts).length;
    return { id: objective.id, label: objective.label, progress, target: objective.target, done: progress >= objective.target };
  });
  return { objectives, completed: objectives.every(objective => objective.done) };
}
