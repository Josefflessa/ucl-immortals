/** A penalty-shootout kick on the right-hand goal: walk-up, run-up, the shot at
 * 1.9 s (the narration's reveal) and the walk back. */
import { seededRandom } from '../random';
import { BALL_SLOT, GOAL_Y_MAX, GOAL_Y_MIN, PLAYERS_PER_SIDE, SIDES, slotBase, type PitchSides } from './geometry';
import type { Beat, CastEntry, PitchView, Touch } from './plays';
import { CUT_SNAP_MS } from './motion';
import { createPositionBuffer, EASE_LINEAR, EASE_OUT, EASE_SMOOTH, TimelineBuilder, type Timeline } from './timeline';

export const SHOOTOUT_BUILDUP_MS = 1900;
export const SHOOTOUT_HOLD_MS = 1700;
export const SHOOTOUT_KICK_MS = SHOOTOUT_BUILDUP_MS + SHOOTOUT_HOLD_MS;
/** The kick, just before the reveal: the ball flies in slow motion until 1.9 s. */
export const SHOOTOUT_CONTACT_MS = 1500;

export type ShootoutMiss = 'save' | 'miss';
/** Same rule the screen narration uses, so the picture and the words agree. */
export function shootoutMissKind(kickIndex: number): ShootoutMiss {
  return kickIndex % 2 === 0 ? 'save' : 'miss';
}

/** Both teams lined up at the centre circle, the ball on the spot. */
export function shootoutLineup(sides: PitchSides): Float32Array {
  const out = createPositionBuffer();
  for (const side of SIDES) {
    const base = slotBase(side);
    for (let i = 1; i < PLAYERS_PER_SIDE; i++) {
      out[(base + i) * 3] = side === 'left' ? 51.4 : 53.6;
      out[(base + i) * 3 + 1] = 25.6 + (i - 1) * 1.85;
    }
    // Keepers (formation slot 0) wait beside the area until it is their turn.
    out[base * 3] = 86;
    out[base * 3 + 1] = side === 'left' ? 12 : 56;
  }
  out[BALL_SLOT * 3] = 94;
  out[BALL_SLOT * 3 + 1] = 34;
  void sides;
  return out;
}

export interface ShootoutKickInput {
  sides: PitchSides;
  prev: Float32Array;
  takerSlot: number;
  goalkeeperSlot: number;
  isGoal: boolean;
  kickIndex: number;
  seed: number;
}

export function buildShootoutKick(input: ShootoutKickInput): { timeline: Timeline; cast: CastEntry[]; beats: Beat[]; focus: PitchView; strikeFocus: PitchView; touches: Touch[] } {
  const rng = seededRandom(input.seed);
  const b = new TimelineBuilder(input.prev);
  const { takerSlot: taker, goalkeeperSlot: gk } = input;
  // Each kick opens with a quick cut: the taker is already at the spot, the keeper on his line.
  const layout = shootoutLineup(input.sides);
  layout[taker * 3] = 91.3; layout[taker * 3 + 1] = 34.4;
  layout[gk * 3] = 104.7; layout[gk * 3 + 1] = 34;
  for (let s = 0; s <= BALL_SLOT; s++) {
    const p = b.at(s, CUT_SNAP_MS - 1);
    b.key(s, CUT_SNAP_MS - 1, p.x, p.y, p.z, EASE_LINEAR);
    b.key(s, CUT_SNAP_MS, layout[s * 3], layout[s * 3 + 1], 0, EASE_LINEAR);
  }
  const beats: Beat[] = [{ t: 0, kind: 'cut', x: 0, y: 0 }];
  b.key(taker, 1000, 91.3, 34.4, 0, EASE_LINEAR);
  b.key(taker, 1480, 93.5, 34, 0, EASE_LINEAR);
  b.key(BALL_SLOT, SHOOTOUT_CONTACT_MS, 94, 34, 0, EASE_LINEAR);
  // The keeper bounces on his line and only goes as the ball is struck.
  b.key(gk, 1600, 104.7, 34, 0, EASE_LINEAR);
  beats.push({ t: SHOOTOUT_CONTACT_MS, kind: 'strike', x: 94, y: 34, flightMs: SHOOTOUT_BUILDUP_MS - SHOOTOUT_CONTACT_MS });
  beats.push({ t: SHOOTOUT_BUILDUP_MS, kind: 'normal', x: 105, y: 34 });

  const left = rng() < 0.5;
  const goalY = left ? GOAL_Y_MIN + 1.3 : GOAL_Y_MAX - 1.3;
  const T = SHOOTOUT_BUILDUP_MS;
  if (input.isGoal) {
    const z = 0.2 + rng() * 1.6;
    b.key(BALL_SLOT, T, 105.4, goalY, z, EASE_LINEAR, 0.3);
    b.key(BALL_SLOT, T + 250, 106.8, goalY, Math.max(0.15, z - 0.4), EASE_OUT);
    const wrongWay = rng() < 0.6;
    const diveY = wrongWay ? 68 - goalY : goalY + (goalY < 34 ? 1.8 : -1.8);
    b.key(gk, T + 60, 104.3, diveY, 0.5, EASE_LINEAR);
    beats.push({ t: T, kind: 'net', x: 105, y: goalY });
  } else if (shootoutMissKind(input.kickIndex) === 'save') {
    b.key(BALL_SLOT, T, 104.2, goalY, 0.8, EASE_LINEAR, 0.3);
    b.key(gk, T, 104.2, goalY, 0.5, EASE_LINEAR);
    b.key(BALL_SLOT, T + 600, 107, goalY < 34 ? 25 : 43, 0.3, EASE_OUT, 1);
    beats.push({ t: T, kind: 'save', x: 104.2, y: goalY });
  } else {
    const over = rng() < 0.5;
    const y = over ? 34 + (rng() - 0.5) * 4 : left ? GOAL_Y_MIN - 1.2 : GOAL_Y_MAX + 1.2;
    const z = over ? 3.2 : 0.6;
    b.key(BALL_SLOT, T, 106, y, z, EASE_LINEAR, 0.4);
    b.key(BALL_SLOT, T + 500, 111, y, z * 0.6, EASE_OUT);
    if (over) b.key(BALL_SLOT, T + 1100, 111.5, y, 0.1, EASE_OUT);
    b.key(gk, T + 60, 104.3, goalY, 0.5, EASE_LINEAR);
    beats.push({ t: T, kind: 'out', x: 105, y });
  }
  b.key(gk, SHOOTOUT_KICK_MS, 104.7, 34, 0, EASE_SMOOTH);
  b.key(taker, SHOOTOUT_KICK_MS, 90, 34 + (rng() - 0.5) * 4, 0, EASE_SMOOTH);
  return {
    timeline: b.build(SHOOTOUT_KICK_MS),
    cast: [{ slot: taker, role: 'finisher' }, { slot: gk, role: 'goalkeeper' }],
    beats,
    focus: { x: 97, y: 34, zoom: 1.6 },
    strikeFocus: { x: 105 - (111 / 2.6) * 0.25, y: 34, zoom: 2.6 },
    // The taker strikes; the keeper touches it only when he saves.
    touches: [{ t: SHOOTOUT_CONTACT_MS, slot: taker }, ...(!input.isGoal && shootoutMissKind(input.kickIndex) === 'save' ? [{ t: T, slot: gk }] : [])],
  };
}
