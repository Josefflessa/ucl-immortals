// Server side of account events: progress from the stored history and the
// avatar frames they unlock. As with achievements, the history is the only
// source, so nothing the browser sends can grant a frame.

import {
  AVATAR_FRAME_BY_KEY,
  evaluateGameEvent,
  GAME_EVENTS,
  gameEventStatus,
  type EventObjectiveProgress,
  type GameEventStatus,
} from '../shared/game/events.js';
import { loadCareer } from './achievements.js';

export interface FrameUnlock {
  frameKey: string;
  eventId: string;
}

export interface GameEventState {
  id: string;
  name: string;
  description: string;
  startsAt: number;
  endsAt: number;
  status: GameEventStatus;
  frameKey: string;
  objectives: EventObjectiveProgress[];
  completed: boolean;
  frameUnlocked: boolean;
}

export async function loadOwnedFrames(db: D1Database, userId: string): Promise<string[]> {
  const rows = await db.prepare('SELECT frame_key FROM user_frames WHERE user_id = ? ORDER BY unlocked_at').bind(userId).all<{ frame_key: string }>();
  return rows.results.map(row => row.frame_key).filter(key => AVATAR_FRAME_BY_KEY.has(key));
}

/**
 * Evaluates every started event and grants the frames whose objectives are all
 * done. Only competitions inside each window count, so checking after the end
 * still rewards what was achieved in time. Returns the frames unlocked now.
 */
export async function syncEventRewards(db: D1Database, userId: string, now = Date.now()): Promise<{ states: GameEventState[]; unlocked: FrameUnlock[] }> {
  const started = GAME_EVENTS.filter(event => event.startsAt <= now);
  const owned = new Set(await loadOwnedFrames(db, userId));
  const career = started.length > 0 ? await loadCareer(db, userId) : [];
  const unlocked: FrameUnlock[] = [];
  const states: GameEventState[] = GAME_EVENTS.map(event => {
    const status = gameEventStatus(event, now);
    const evaluation = status === 'upcoming'
      ? { objectives: event.objectives.map(o => ({ id: o.id, label: o.label, progress: 0, target: o.target, done: false })), completed: false }
      : evaluateGameEvent(event, career);
    if (evaluation.completed && !owned.has(event.frameKey)) {
      unlocked.push({ frameKey: event.frameKey, eventId: event.id });
      owned.add(event.frameKey);
    }
    return {
      id: event.id,
      name: event.name,
      description: event.description,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      status,
      frameKey: event.frameKey,
      ...evaluation,
      frameUnlocked: owned.has(event.frameKey),
    };
  });
  if (unlocked.length > 0) {
    await db.batch(unlocked.map(unlock => db.prepare(
      'INSERT OR IGNORE INTO user_frames (user_id, frame_key, event_id, unlocked_at) VALUES (?, ?, ?, ?)',
    ).bind(userId, unlock.frameKey, unlock.eventId, now)));
  }
  return { states, unlocked };
}
