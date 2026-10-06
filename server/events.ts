// Server side of account events: progress from the stored history and the
// rewards they unlock (avatar frames, event Únicas). As with achievements, the
// history is the only source, so nothing the browser sends can grant a reward.

import {
  AVATAR_FRAME_BY_KEY,
  evaluateGameEvent,
  eventObjectivesFor,
  GAME_EVENT_BY_ID,
  GAME_EVENTS,
  gameEventStatus,
  type EventObjectiveProgress,
  type GameEventStatus,
} from '../shared/game/events.js';
import { EVENT_UNIQUE_CARDS } from '../shared/game/gameData.js';
import { loadCareer } from './achievements.js';

export interface FrameUnlock {
  frameKey: string;
  eventId: string;
}

export interface EventCardUnlock {
  cardId: string;
  eventId: string;
}

export interface EventChoiceState {
  key: string;
  label: string;
  cardId: string;
  crestId: string;
  /** Goals of this option, so the player can compare before choosing. */
  objectives: string[];
}

export interface GameEventState {
  id: string;
  name: string;
  description: string;
  startsAt: number;
  endsAt: number;
  status: GameEventStatus;
  frameKey: string | null;
  /** Choice events: the options and the one this account picked. */
  choices: EventChoiceState[] | null;
  chosenKey: string | null;
  objectives: EventObjectiveProgress[];
  completed: boolean;
  frameUnlocked: boolean;
  cardUnlocked: boolean;
}

const EVENT_CARD_IDS = new Set(EVENT_UNIQUE_CARDS.map(card => card.id));

export async function loadOwnedFrames(db: D1Database, userId: string): Promise<string[]> {
  const rows = await db.prepare('SELECT frame_key FROM user_frames WHERE user_id = ? ORDER BY unlocked_at').bind(userId).all<{ frame_key: string }>();
  return rows.results.map(row => row.frame_key).filter(key => AVATAR_FRAME_BY_KEY.has(key));
}

/** Event Únicas this account unlocked: they join its Pacote Único pool. */
export async function loadOwnedEventCards(db: D1Database, userId: string): Promise<string[]> {
  const rows = await db.prepare('SELECT card_id FROM user_event_cards WHERE user_id = ? ORDER BY unlocked_at').bind(userId).all<{ card_id: string }>();
  return rows.results.map(row => row.card_id).filter(id => EVENT_CARD_IDS.has(id));
}

async function loadChoices(db: D1Database, userId: string): Promise<Map<string, string>> {
  const rows = await db.prepare('SELECT event_id, choice_key FROM user_event_choices WHERE user_id = ?').bind(userId).all<{ event_id: string; choice_key: string }>();
  return new Map(rows.results.map(row => [row.event_id, row.choice_key]));
}

/**
 * Records the account's option in a choice event. The choice is for good: it
 * can only be made once, while the event is running.
 */
export async function chooseEventOption(db: D1Database, userId: string, eventId: string, choiceKey: unknown, now = Date.now()): Promise<{ ok: true } | { error: string }> {
  const event = GAME_EVENT_BY_ID.get(eventId);
  if (!event?.choices) return { error: 'event_not_found' };
  if (gameEventStatus(event, now) !== 'active') return { error: 'event_not_active' };
  if (typeof choiceKey !== 'string' || !event.choices.some(choice => choice.key === choiceKey)) return { error: 'invalid_choice' };
  const result = await db.prepare('INSERT OR IGNORE INTO user_event_choices (user_id, event_id, choice_key, chosen_at) VALUES (?, ?, ?, ?)')
    .bind(userId, eventId, choiceKey, now).run();
  if ((result.meta?.changes ?? 0) === 0) return { error: 'already_chosen' };
  return { ok: true };
}

/**
 * Evaluates every started event and grants the rewards whose objectives are
 * all done. Only competitions inside each window count, so checking after the
 * end still rewards what was achieved in time. Returns what was unlocked now.
 */
export async function syncEventRewards(db: D1Database, userId: string, now = Date.now()): Promise<{ states: GameEventState[]; unlocked: FrameUnlock[]; cardsUnlocked: EventCardUnlock[] }> {
  const started = GAME_EVENTS.filter(event => event.startsAt <= now);
  const [ownedFrameList, ownedCardList, choices] = await Promise.all([
    loadOwnedFrames(db, userId),
    loadOwnedEventCards(db, userId),
    loadChoices(db, userId),
  ]);
  const ownedFrames = new Set(ownedFrameList);
  const ownedCards = new Set(ownedCardList);
  const career = started.length > 0 ? await loadCareer(db, userId) : [];
  const unlocked: FrameUnlock[] = [];
  const cardsUnlocked: EventCardUnlock[] = [];
  const states: GameEventState[] = GAME_EVENTS.map(event => {
    const status = gameEventStatus(event, now);
    const chosenKey = event.choices ? choices.get(event.id) ?? null : null;
    const chosen = event.choices?.find(choice => choice.key === chosenKey) ?? null;
    const evaluation = status === 'upcoming'
      ? { objectives: eventObjectivesFor(event, chosenKey).map(o => ({ id: o.id, label: o.label, progress: 0, target: o.target, done: false })), completed: false }
      : evaluateGameEvent(event, career, chosenKey);
    if (evaluation.completed && event.frameKey && !ownedFrames.has(event.frameKey)) {
      unlocked.push({ frameKey: event.frameKey, eventId: event.id });
      ownedFrames.add(event.frameKey);
    }
    if (evaluation.completed && chosen && !ownedCards.has(chosen.cardId)) {
      cardsUnlocked.push({ cardId: chosen.cardId, eventId: event.id });
      ownedCards.add(chosen.cardId);
    }
    return {
      id: event.id,
      name: event.name,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status,
      frameKey: event.frameKey ?? null,
      choices: event.choices?.map(choice => ({ key: choice.key, label: choice.label, cardId: choice.cardId, crestId: choice.crestId, objectives: choice.objectives.map(o => o.label) })) ?? null,
      chosenKey,
      ...evaluation,
      frameUnlocked: !!event.frameKey && ownedFrames.has(event.frameKey),
      cardUnlocked: !!chosen && ownedCards.has(chosen.cardId),
    };
  });
  const writes = [
    ...unlocked.map(unlock => db.prepare(
      'INSERT OR IGNORE INTO user_frames (user_id, frame_key, event_id, unlocked_at) VALUES (?, ?, ?, ?)',
    ).bind(userId, unlock.frameKey, unlock.eventId, now)),
    ...cardsUnlocked.map(unlock => db.prepare(
      'INSERT OR IGNORE INTO user_event_cards (user_id, card_id, event_id, unlocked_at) VALUES (?, ?, ?, ?)',
    ).bind(userId, unlock.cardId, unlock.eventId, now)),
  ];
  if (writes.length > 0) await db.batch(writes);
  return { states, unlocked, cardsUnlocked };
}
