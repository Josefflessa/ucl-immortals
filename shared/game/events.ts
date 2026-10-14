// UCL Immortals — time-limited account events.
// An event has a window and a few objectives counted from the competitions an
// account completes inside that window. Completing every objective unlocks its
// configured account reward. Progress is derived from competition_history on the
// server (see server/events.ts), so the browser can never grant a reward.

import type { CareerCompetition } from './achievements';
import { isClubRewardKey } from './clubRewards';
import type { CompetitionFinishStage } from './competitionRanking';

export interface AvatarFrame {
  key: string;
  name: string;
  /** Transparent ring drawn over the avatar (public/frames). */
  image: string;
  /** Accent used around the frame in the UI. */
  color: string;
  /** Account coins required to buy this frame in the profile shop. Absent for event rewards. */
  shopPrice?: number;
}

export const AVATAR_FRAMES: readonly AvatarFrame[] = [
  { key: 'noite-dos-imortais', name: 'Noite dos Imortais', image: '/frames/noite-dos-imortais.webp', color: '#A855F7' },
  { key: 'brasa-eterna', name: 'Brasa Eterna', image: '/frames/brasa-eterna.webp', color: '#FF642E', shopPrice: 300 },
  { key: 'constelacao', name: 'Constelação', image: '/frames/constelacao.webp', color: '#65A7FF', shopPrice: 300 },
  { key: 'nucleo-cibernetico', name: 'Núcleo Cibernético', image: '/frames/nucleo-cibernetico.webp', color: '#A855F7', shopPrice: 300 },
  { key: 'mare-celeste', name: 'Maré Celeste', image: '/frames/mare-celeste.webp', color: '#32C7E9', shopPrice: 300 },
];

export const AVATAR_FRAME_BY_KEY = new Map(AVATAR_FRAMES.map(frame => [frame.key, frame]));

/** A registered profile frame, or a club frame from the album (drawn in code). */
export function isAvatarFrameKey(key: unknown): key is string {
  return typeof key === 'string' && (AVATAR_FRAME_BY_KEY.has(key) || isClubRewardKey(key));
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
  /** Reward picked after completing the objectives: one of these name styles (nameStyles.ts). */
  rewardNameStyles?: readonly string[];
  /** Regular event whose reward is an event Única (EVENT_UNIQUE_CARDS), unlocked for every account that completes it. */
  rewardCardId?: string;
  /** National-team crest permanently unlocked by completing the event. */
  rewardCrestId?: string;
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
/** Every version of Neymar in the game (regular cards and Únicas), by card id. */
export const NEYMAR_CARD_IDS: ReadonlySet<string> = new Set([
  'neymar', 'neymar_psg', 'neymar_santos', 'neymar_al_hilal_2023_24', 'neymar_unico', 'neymar_barca_unico',
]);
/** A version of Neymar started the final (champions only: the final is the last match they played). */
const neymarStartedFinal = (c: CareerCompetition) => c.finalStarterIds.some(id => NEYMAR_CARD_IDS.has(id));
const reachedSemifinal = (c: CareerCompetition) => isChampion(c) || (c.finishStage !== null && SEMIFINAL_OR_BETTER.has(c.finishStage));

/** Midnight in Brasília (UTC−3) of the given day. */
const brasiliaMidnight = (year: number, month: number, day: number) => Date.UTC(year, month - 1, day, 3);

export const GAME_EVENTS: readonly GameEvent[] = [
  {
    id: 'noite-dos-imortais-2026',
    name: 'Noite dos Imortais',
    description: 'Complete os três desafios e ganhe a moldura exclusiva para a sua foto de perfil.',
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
    id: 'estilo-de-craque-2026',
    name: 'Estilo de Craque',
    description: 'Conclua 5 competições e escolha um estilo para o seu nome: a fonte e o efeito com que ele aparece no perfil, no ranking e para os amigos. A escolha é definitiva.',
    startsAt: brasiliaMidnight(2026, 10, 5),
    endsAt: brasiliaMidnight(2026, 11, 1),
    objectives: [
      { id: 'competitions', label: 'Conclua 5 competições', target: 5, counts: () => true },
    ],
    rewardNameStyles: ['lendario', 'arcade', 'assombrado', 'neon', 'pirata'],
  },
  {
    id: 'neymar-2026',
    name: 'O Príncipe',
    description: 'Seja campeão 4 vezes no Ouro ou acima com alguma versão do Neymar como titular na final e ganhe a Carta Única do Neymar no Barcelona para o seu Pacote Único.',
    startsAt: brasiliaMidnight(2026, 10, 11),
    endsAt: brasiliaMidnight(2026, 11, 1),
    rewardCardId: 'neymar_barca_unico',
    objectives: [
      { id: 'titles', label: 'Seja campeão 4 vezes no Ouro ou acima com o Neymar titular na final', target: 4, counts: c => goldOrAbove(c) && isChampion(c) && neymarStartedFinal(c) },
    ],
  },
  {
    id: 'aranha-negra-2026',
    name: 'A Aranha Negra',
    description: 'Conquiste 4 competições no Ouro ou acima sofrendo no máximo 5 gols em cada uma e desbloqueie a Carta Única do Yashin.',
    startsAt: brasiliaMidnight(2026, 10, 14),
    endsAt: brasiliaMidnight(2026, 11, 1),
    rewardCardId: 'yashin_unico',
    objectives: [
      { id: 'titulos-com-defesa', label: 'Seja campeão 4 vezes no Ouro ou acima sofrendo no máximo 5 gols em cada competição', target: 4, counts: c => goldOrAbove(c) && isChampion(c) && c.goalsAgainst <= 5 },
    ],
  },
  {
    id: 'classicos-sp-2026',
    name: 'Clássicos de São Paulo',
    description: 'Escolha o seu clube e cumpra as missões para liberar a Carta Única dele no seu Pacote Único. A escolha é definitiva.',
    startsAt: brasiliaMidnight(2026, 10, 12),
    endsAt: brasiliaMidnight(2026, 11, 1),
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
  {
    id: 'brasil-em-campo-2026',
    name: 'Brasil em Campo',
    description: 'Vença quatro competições no Ouro ou acima com pelo menos seis jogadores brasileiros titulares e desbloqueie o escudo da Seleção Brasileira para usar nas competições.',
    startsAt: brasiliaMidnight(2026, 10, 15),
    endsAt: brasiliaMidnight(2026, 11, 1),
    rewardCrestId: 'brazil',
    objectives: [
      { id: 'titles', label: 'Seja campeão 4 vezes no Ouro ou acima com pelo menos 6 brasileiros titulares na final', target: 4, counts: c => goldOrAbove(c) && isChampion(c) && (c.finalBrazilianStarterCount ?? 0) >= 6 },
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
