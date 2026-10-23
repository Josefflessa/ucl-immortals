/**
 * The red card as a play of its own: the foul, the whistle, the referee running in, the card and
 * the walk to the tunnel. Scripted in the frame of the fouled team (it attacks towards x = 105)
 * and mirrored when it plays the other way, like the dangers. The clock is fixed so the
 * narration's three stages line up with it:
 *   stage 1 (0 .. BUILDUP)   the move that ends in the foul;
 *   stage 2 (.. ARRIVAL)     the foul, the whistle, the referee in the middle of the players;
 *   stage 3 (.. END)         the card, the protest and the walk off.
 */
import type { MatchEvent } from '../engine/teamModel';
import { redLabelOf, type RedKind, type RedVariant } from '../redCards';
import { seededRandom } from '../random';
import { BALL_SLOT, mirrorPoint, otherSide, PITCH_LENGTH, PITCH_WIDTH, PLAYERS_PER_SIDE, roleOfSlot, shapeFor, sideOfTeam, slotBase, slotOfPlayer, type Point, type PitchSides, type Side } from './geometry';
import { CUT_MS, CUT_SNAP_MS, MAX_PLAYER_SPEED, SPEED } from './motion';
import { createPositionBuffer, EASE_LINEAR, EASE_OUT, EASE_ROLL, EASE_SMOOTH, mirrorBuffer, mirrorTimeline, TimelineBuilder, type Ease, type Key, type Timeline } from './timeline';
import type { Beat, CastEntry, DangerTiming, PitchView, Touch } from './plays';

/** The fixed clock of the scene (ms from its start). */
export const RED_BUILDUP_MS = 2150;
export const RED_CONTACT_MS = 2400;
const ARRIVAL0 = 4000;
// The scene ends on the card: a still moment to take it in, no walk off.
const END0 = 5250;
export const RED_ARRIVAL_MS = ARRIVAL0;
export const RED_END_MS = END0;
/** In a fade entry the players appear in place and hold while the picture fades in. */
const ENTRY_FADE_MS = 450;
const FOOT = 0.7;

export const RED_TIMING: DangerTiming = {
  leadMs: 0,
  strikeMs: RED_ARRIVAL_MS - RED_BUILDUP_MS,
  aftermathMs: RED_END_MS - RED_ARRIVAL_MS,
  buildUpMs: RED_BUILDUP_MS,
  contactMs: RED_CONTACT_MS,
  arrivalMs: RED_ARRIVAL_MS,
  endMs: RED_END_MS,
  decisiveMs: 0,
};

export interface RedCardInput {
  sides: PitchSides;
  /** The red card event. */
  event: MatchEvent;
  /** The player who was fouled, when the engine's foul says so. */
  victimId?: string;
  kind: RedKind;
  variant: RedVariant;
  prev: Float32Array;
  sentOff: ReadonlySet<number>;
  entry: 'fade' | 'cut';
  seed: number;
}

export interface RedCardTimeline {
  timeline: Timeline;
  /** The referee's path (a track like the players'), already mirrored to the side that plays. */
  referee: Key[];
  /** The camera's path: centre x, y and zoom (as z). */
  camera: Key[];
  cast: CastEntry[];
  beats: Beat[];
  touches: Touch[];
  /** Where the camera looks in each stage. */
  focus: [PitchView, PitchView, PitchView];
  timing: DangerTiming;
  fouledSide: Side;
  offenderSlot: number;
  victimSlot: number;
  kind: RedKind;
  variant: RedVariant;
  /** Who was fouled (a card id), for the narration. */
  victimId?: string;
  offenderId?: string;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const unit = (a: Point, b: Point): Point => {
  const d = dist(a, b);
  return d < 1e-6 ? { x: 1, y: 0 } : { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
};
function toward(a: Point, b: Point, max: number): Point {
  const d = dist(a, b);
  return d <= max ? { x: b.x, y: b.y } : { x: a.x + ((b.x - a.x) * max) / d, y: a.y + ((b.y - a.y) * max) / d };
}

/** The scripting kit: speed-limited runs, a ball that follows a carrier, the referee's own track. */
class Scene {
  readonly b: TimelineBuilder;
  readonly beats: Beat[] = [];
  readonly touches: Touch[] = [];
  readonly ref: Key[];
  /** The camera's path: x, y of its centre and, as z, its zoom. */
  readonly cam: Key[] = [];

  constructor(start: Float32Array, refStart: Point) {
    this.b = new TimelineBuilder(start);
    this.ref = [{ t: 0, x: refStart.x, y: refStart.y, z: 0, ease: EASE_SMOOTH, arc: 0 }];
  }

  /** Where he starts: his first key (the layout) moves to the scene's own starting spot. */
  place(slot: number, x: number, y: number): void {
    const first = this.b.track(slot)[0] as Key;
    first.x = x;
    first.y = y;
  }

  where(slot: number, t?: number): Point {
    const p = this.b.at(slot, t ?? this.b.lastTime(slot));
    return { x: p.x, y: p.y };
  }

  /** Arrives at (x, y) at time t, or as near as the speed allows. Returns where he gets. */
  run(slot: number, t: number, x: number, y: number, speed: number = SPEED.sprint, ease: Ease = EASE_LINEAR): Point {
    const lastT = this.b.lastTime(slot);
    const from = this.where(slot, lastT);
    const reach = toward(from, { x, y }, (speed * Math.max(1, t - lastT)) / 1000);
    this.b.key(slot, Math.max(t, lastT + 1), reach.x, reach.y, 0, ease);
    return reach;
  }

  /** Stands where he is until t. */
  stay(slot: number, t: number): void {
    const p = this.where(slot);
    this.b.key(slot, Math.max(t, this.b.lastTime(slot) + 1), p.x, p.y, 0, EASE_LINEAR);
  }

  /** A hop in place (a jump for a header, a leap into a challenge), landing at t + ms/2. */
  hop(slot: number, t: number, height: number, ms = 440): void {
    const from = Math.max(this.b.lastTime(slot) + 1, t - ms / 2);
    const p = this.where(slot, from);
    this.b.key(slot, from, p.x, p.y, 0, EASE_LINEAR);
    this.b.key(slot, from + ms, p.x, p.y, 0, EASE_SMOOTH, height);
  }

  ball(t: number, x: number, y: number, z = 0, ease: Ease = EASE_LINEAR, arc = 0): void {
    this.b.key(BALL_SLOT, Math.max(t, this.b.lastTime(BALL_SLOT) + 1), x, y, z, ease, arc);
  }

  /** The ball at a carrier's feet, a little ahead of him, from t0 to t1. */
  carry(slot: number, t0: number, t1: number): void {
    for (let t = t0; t <= t1 + 1; t += 100) {
      const at = Math.min(t, t1);
      const p = this.where(slot, at);
      const q = this.where(slot, Math.min(at + 120, t1 + 120));
      const dir = unit(p, q);
      this.ball(at, p.x + dir.x * FOOT, p.y + dir.y * FOOT);
    }
    this.touches.push({ t: t0, slot });
  }

  beat(t: number, kind: Beat['kind'], x: number, y: number, extra: Partial<Beat> = {}): void {
    this.beats.push({ t, kind, x, y, ...extra });
  }

  /** A slide into a challenge, ending at `at` at time t, the glide after it and the rise. Returns where he stops. */
  slide(slot: number, t: number, at: Point, downMs = 700): Point {
    const from = this.where(slot);
    const dir = unit(from, at);
    const launchAt = Math.max(t - 260, this.b.lastTime(slot) + 1);
    const launch = this.run(slot, launchAt, at.x - dir.x * 2.2, at.y - dir.y * 2.2, SPEED.sprint);
    const meet = toward(launch, at, (9.4 * (t - launchAt)) / 1000);
    this.b.key(slot, t, meet.x, meet.y, 0, EASE_LINEAR);
    const rest = { x: meet.x + dir.x * 1, y: meet.y + dir.y * 1 };
    this.b.key(slot, t + 300, rest.x, rest.y, 0, EASE_OUT);
    this.b.key(slot, t + 300 + downMs, rest.x, rest.y, 0, EASE_LINEAR);
    const up = t + 300 + downMs + 320;
    this.b.key(slot, up, rest.x + dir.x * 0.3, rest.y + dir.y * 0.3, 0, EASE_SMOOTH);
    this.beat(launchAt, 'tackle', rest.x, rest.y, { fx: launch.x, fy: launch.y, slot, ms: t - launchAt + 300 + downMs + 120 });
    return rest;
  }

  /** A lunge: he darts the last stretch at the target at time t and brakes. */
  lunge(slot: number, t: number, at: Point): Point {
    const from = this.where(slot);
    const dir = unit(from, at);
    const setAt = Math.max(t - 200, this.b.lastTime(slot) + 1);
    const set = this.run(slot, setAt, at.x - dir.x * 1.6, at.y - dir.y * 1.6, SPEED.run);
    const reach = toward(set, at, (9.4 * (t - setAt)) / 1000);
    this.b.key(slot, t, reach.x, reach.y, 0, EASE_LINEAR);
    const stop = { x: reach.x + dir.x * 0.6, y: reach.y + dir.y * 0.6 };
    this.b.key(slot, t + 260, stop.x, stop.y, 0, EASE_OUT);
    this.beat(setAt, 'lunge', stop.x, stop.y, { fx: set.x, fy: set.y, slot, ms: t - setAt + 340 });
    return stop;
  }

  /**
   * He goes down, pushed on by `dx, dy`: carried on in the air ('dive') or crumpling on the spot
   * ('down'), and stays there for `ms`, then gets up. Either way the body tips over (a `fall`).
   */
  fall(slot: number, t: number, how: 'dive' | 'down', ms: number, dx: number, dy: number): void {
    const p = this.where(slot, t);
    this.b.hold(slot, t);
    const slideMs = how === 'dive' ? 520 : 420;
    this.b.key(slot, t + slideMs, p.x + dx, p.y + dy, 0, EASE_OUT, how === 'dive' ? 0.35 : 0);
    this.b.key(slot, t + ms, p.x + dx, p.y + dy, 0, EASE_LINEAR);
    this.b.key(slot, t + ms + 600, p.x + dx * 1.1, p.y + dy * 1.1, 0, EASE_SMOOTH);
    this.beat(t, 'fall', p.x, p.y, { slot, ms });
  }

  /** A hand on the shirt: a line pulled tight between two players. */
  tug(a: number, b: number, t: number, ms: number): void {
    const p = this.where(a, t);
    this.beat(t, 'tug', p.x, p.y, { slot: a, slot2: b, ms });
  }

  /** The referee: arrives at (x, y) at time t, or as near as a quick run allows. */
  refGo(t: number, x: number, y: number, speed = 7): Point {
    const last = this.ref[this.ref.length - 1];
    const reach = toward(last, { x, y }, (speed * Math.max(1, t - last.t)) / 1000);
    this.ref.push({ t: Math.max(t, last.t + 1), x: reach.x, y: reach.y, z: 0, ease: EASE_LINEAR, arc: 0 });
    return reach;
  }

  /** The camera looks at (x, y) with this zoom from time t on, easing there. */
  camGo(t: number, x: number, y: number, zoom: number): void {
    const last = this.cam[this.cam.length - 1];
    // Linear between keys: the pitch's camera spring smooths the corners, and a steady glide
    // never slows down at every key the way an eased one does.
    this.cam.push({ t: last ? Math.max(t, last.t + 1) : Math.max(1, t), x, y, z: zoom, ease: EASE_LINEAR, arc: 0 });
  }

  refWhere(): Point {
    const last = this.ref[this.ref.length - 1];
    return { x: last.x, y: last.y };
  }

  refTime(): number {
    return this.ref[this.ref.length - 1].t;
  }
}

/** Points on a ring around `c`, evenly spaced from angle a0. */
function ring(c: Point, n: number, r: number, a0: number): Point[] {
  return Array.from({ length: n }, (_, i) => {
    const a = a0 + (i * 2 * Math.PI) / n;
    return { x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r };
  });
}

interface Ctx {
  sc: Scene;
  rng: () => number;
  S: Point;
  ys: 1 | -1;
  V: number;
  O: number;
  /** The fouled team's other live outfield players, nearest to the spot first. */
  vMates: number[];
  oMates: number[];
  /** The offender's keeper (-1 if none). */
  gk: number;
  /** A third player used as the one who plays the ball in (a cross, a long pass). */
  server: number;
  /** The foul, in ms. */
  C: number;
  E: number;
  /** Where the referee is when it happens. */
  refAtFoul: Point;
}

const C = RED_CONTACT_MS;
const A = ARRIVAL0;

function spotFor(kind: RedKind, variant: RedVariant, rng: () => number, ys: number): Point {
  const r = rng();
  switch (kind) {
    case 'tackle': return { x: 50 + r * 18, y: 34 + ys * (4 + rng() * 14) };
    case 'lastman': return { x: 79 + r * 7, y: 34 + ys * (1 + rng() * 9) };
    case 'handball': return variant === 'line' ? { x: 103.2, y: 34 + ys * 2.6 } : { x: 93.6, y: 34 + ys * 3.2 };
    case 'secondyellow': return { x: 46 + r * 24, y: 34 + ys * (18 + rng() * 6) };
    case 'elbow': return variant === 'aerial' ? { x: 56 + r * 12, y: 34 + ys * (4 + rng() * 10) } : { x: 92 + r * 3.5, y: 34 + ys * (3 + rng() * 6) };
    case 'brawl': return { x: 52 + r * 18, y: 34 + ys * (3 + rng() * 9) };
  }
}

/** The fouled player's run-up, so that he is at the spot at the foul. */
function runStart(S: Point, speed: number): Point {
  return { x: S.x - (speed * (C - ENTRY_FADE_MS)) / 1000, y: S.y };
}

// ── The moves that end in a foul (each one sets the stage-1 build-up and the contact at C) ──

function tackleMove(c: Ctx, variant: 'behind' | 'twofoot' | 'highboot' | 'late'): void {
  const { sc, S, ys, V, O, E } = c;
  const late = variant === 'late';
  const vs = 7;
  const v0 = runStart(S, vs);
  // The fouled player runs on with the ball, a straight line to the spot.
  sc.place(V, v0.x, v0.y);
  sc.run(V, E, v0.x, v0.y);
  if (variant !== 'highboot') sc.b.key(V, C, S.x, S.y, 0, EASE_LINEAR);
  if (variant !== 'highboot') sc.carry(V, E, late ? C - 500 : C - 100);
  if (variant === 'behind' || late) {
    // The chaser comes from behind and slides in.
    const o0 = { x: v0.x - 4, y: v0.y + ys * 2.4 };
    sc.place(O, o0.x, o0.y);
    sc.run(O, E, o0.x, o0.y);
    sc.run(O, C - 280, S.x - 2.4, S.y + ys * 0.5, 9.4);
    sc.slide(O, C, { x: S.x + (late ? 0 : 0.3), y: S.y }, 450);
    sc.fall(V, C, 'dive', 1100, 1.6, -ys * 0.4);
    // He pushed the ball on before the late arrival: it is gone when the legs go.
    if (late) {
      sc.ball(C - 500, S.x - 3 + FOOT, S.y);
      sc.ball(C + 1000, S.x + 6, S.y - ys * 1.6, 0, EASE_ROLL);
    } else {
      sc.ball(C, S.x + 0.8, S.y);
      sc.ball(C + 1000, S.x + 7, S.y - ys * 2, 0, EASE_ROLL);
    }
  } else if (variant === 'twofoot') {
    // A dart in from the side, both feet off the ground.
    const o0 = { x: S.x - 7, y: S.y + ys * 11 };
    sc.place(O, o0.x, o0.y);
    sc.run(O, E, o0.x, o0.y);
    sc.run(O, C - 220, S.x - 1.4, S.y + ys * 1.6, 9);
    sc.hop(O, C, 0.7, 440);
    sc.beat(C - 240, 'lunge', S.x, S.y + ys * 0.8, { fx: S.x - 1.4, fy: S.y + ys * 1.6, slot: O, ms: 480 });
    sc.fall(V, C, 'dive', 1100, 1.2, -ys * 1.5);
    sc.ball(C, S.x + 0.8, S.y);
    sc.ball(C + 1000, S.x + 6, S.y - ys * 3, 0, EASE_ROLL);
  } else {
    // A bouncing ball, and a boot into the chest of the one who goes up for it.
    const o0 = { x: S.x - 6, y: S.y + ys * 10 };
    sc.place(O, o0.x, o0.y);
    sc.run(O, E, o0.x, o0.y);
    sc.run(O, C - 200, S.x - 1.2, S.y + ys * 1.5, 9);
    sc.hop(O, C, 0.85, 440);
    sc.b.key(V, C - 260, S.x - 1.7, S.y, 0, EASE_LINEAR);
    sc.hop(V, C, 0.5, 440);
    sc.fall(V, C + 230, 'down', 1100, 0.8, -ys * 0.6);
    // The ball drops in over his head just before.
    sc.place(BALL_SLOT, S.x - 13, S.y - ys * 2);
    sc.ball(C - 160, S.x - 0.2, S.y, 1.1, EASE_SMOOTH, 3.4);
    sc.ball(C + 1000, S.x + 5, S.y - ys * 3, 0, EASE_ROLL, 0.5);
  }
}

function lastManMove(c: Ctx, variant: 'pull' | 'clip' | 'bodycheck'): void {
  const { sc, S, ys, V, O, E, gk } = c;
  const vs = 7;
  const v0 = runStart(S, vs);
  sc.place(V, v0.x, v0.y);
  sc.run(V, E, v0.x, v0.y);
  // The last man starts level and a little wide, and is dragged into the chase.
  const o0 = { x: v0.x - 4, y: v0.y + ys * (variant === 'bodycheck' ? 3.8 : 2.8) };
  sc.place(O, o0.x, o0.y);
  sc.run(O, E, o0.x, o0.y);
  if (variant === 'pull') {
    sc.b.key(V, C - 400, S.x - 2.9, S.y, 0, EASE_LINEAR);
    sc.b.key(V, C, S.x, S.y, 0, EASE_LINEAR);
    sc.run(O, C - 140, S.x - 1.5, S.y + ys * 0.9, 9.2);
    sc.run(O, C, S.x - 0.9, S.y + ys * 0.8, 9);
    sc.tug(O, V, C - 500, 800);
    sc.fall(V, C, 'down', 1100, 1.4, 0);
    sc.carry(V, E, C - 80);
    sc.ball(C, S.x + 0.8, S.y);
    sc.ball(C + 1000, S.x + 8, S.y + ys * 0.8, 0, EASE_ROLL);
  } else if (variant === 'clip') {
    sc.b.key(V, C, S.x, S.y, 0, EASE_LINEAR);
    sc.run(O, C - 300, S.x - 2.2, S.y + ys * 1.2, 9.2);
    sc.lunge(O, C, { x: S.x - 0.2, y: S.y + ys * 0.3 });
    sc.fall(V, C, 'dive', 1100, 2.1, 0.2 * ys);
    sc.carry(V, E, C - 80);
    sc.ball(C, S.x + 0.8, S.y);
    sc.ball(C + 1000, S.x + 9, S.y + ys * 0.4, 0, EASE_ROLL);
  } else {
    sc.b.key(V, C, S.x, S.y, 0, EASE_LINEAR);
    sc.run(O, C - 260, S.x - 0.6, S.y + ys * 2.4, 9.2);
    sc.lunge(O, C, { x: S.x + 0.2, y: S.y + ys * 0.5 });
    sc.fall(V, C, 'dive', 1100, 0.6, -ys * 2.4);
    sc.carry(V, E, C - 80);
    sc.ball(C, S.x + 0.8, S.y);
    sc.ball(C + 1000, S.x + 8, S.y - ys * 1.2, 0, EASE_ROLL);
  }
  // The keeper comes off his line and stops short, hands on head.
  if (gk >= 0) {
    sc.run(gk, C, 97.6, 34 + (S.y - 34) * 0.3, 6);
    sc.run(gk, C + 1000, 96.2, 34 + (S.y - 34) * 0.4, 2);
  }
}

/** The area is busy on a cross or a shot: team-mates of each side take their places before the move. */
function crowdBox(c: Ctx, attackers: Point[], defenders: Point[]): void {
  const place = (slots: number[], spots: Point[]) => spots.forEach((p, i) => { if (slots[i] !== undefined) c.sc.place(slots[i], p.x, p.y); });
  place(c.vMates, attackers);
  place(c.oMates, defenders);
}

function handballLine(c: Ctx): void {
  const { sc, S, ys, V, O, server, gk, E } = c;
  // A cross from the byline, a header at goal, an arm on the line.
  const wingY = ys > 0 ? 1.4 : PITCH_WIDTH - 1.4;
  const x0 = { x: 102.4, y: wingY };
  crowdBox(c, [{ x: 93.6, y: 34 + ys * 6.6 }, { x: 96.2, y: 34 - ys * 10 }, { x: 92, y: 34 - ys * 4.6 }],
    [{ x: 101, y: 34 + ys * 7 }, { x: 99.2, y: 34 - ys * 7 }, { x: 98.2, y: 34 + ys * 3.6 }, { x: 101.6, y: 34 - ys * 11 }]);
  if (server >= 0) {
    sc.place(server, x0.x, x0.y);
    sc.run(server, E + 40, x0.x, x0.y);
  }
  const head = { x: 97.4, y: 34 - ys * 2.6 };
  sc.place(V, head.x - 1.6, head.y - ys * 0.6);
  sc.run(V, C - 650, head.x, head.y, 4);
  sc.hop(V, C - 330, 0.8, 520);
  sc.place(O, S.x - 0.3, S.y);
  sc.b.key(O, C - 330, S.x - 0.3, S.y, 0, EASE_LINEAR);
  sc.b.key(O, C, S.x + 0.1, S.y, 0, EASE_LINEAR);
  sc.hop(O, C + 40, 0.5, 440);
  // The ball: at the cross-taker's feet, lofted to the header, then fast to the goal.
  sc.place(BALL_SLOT, x0.x - 0.4, x0.y);
  sc.ball(E + 40, x0.x - 0.4, x0.y);
  sc.ball(C - 330, head.x, head.y, 1.9, EASE_SMOOTH, 4);
  sc.ball(C, S.x + 0.2, S.y - ys * 0.2, 1.3, EASE_LINEAR);
  sc.ball(C + 700, 101.6, 34 - ys * 8, 0.3, EASE_ROLL, 1.1);
  sc.touches.push({ t: E + 40, slot: server >= 0 ? server : V });
  // The keeper, beaten, dives the other way.
  if (gk >= 0) {
    sc.place(gk, 103, 34 + ys * 0.8);
    sc.b.key(gk, C - 330, 103, 34 + ys * 0.8, 0, EASE_LINEAR);
    sc.b.key(gk, C + 270, 103.1, 34 - ys * 2.6, 0, EASE_SMOOTH, 0.4);
    sc.beat(C - 330, 'dive', 103, 34, { slot: gk, ms: 900 });
    sc.b.key(gk, C + 900, 103.1, 34 - ys * 2.6, 0, EASE_LINEAR);
  }
}

function handballBlock(c: Ctx): void {
  const { sc, S, ys, V, O, gk, E } = c;
  // A shot from the edge of the area, a defender who throws himself at it with his arm out.
  const shot = { x: 87.6, y: 34 - ys * 3 };
  crowdBox(c, [{ x: 89.6, y: 34 + ys * 11 }, { x: 91.2, y: 34 - ys * 10 }, { x: 89.2, y: 34 + ys * 2.4 }],
    [{ x: 94.6, y: 34 + ys * 7.4 }, { x: 96.4, y: 34 - ys * 8.6 }, { x: 97.4, y: 34 + ys * 0.4 }, { x: 99.6, y: 34 + ys * 12 }]);
  const v0 = { x: shot.x - 5.8 * ((C - 360 - E) / 1000), y: shot.y - ys * 1.2 };
  sc.place(V, v0.x, v0.y);
  sc.run(V, E, v0.x, v0.y);
  sc.b.key(V, C - 360, shot.x, shot.y, 0, EASE_LINEAR);
  sc.carry(V, E, C - 360);
  sc.b.key(BALL_SLOT, C - 340, shot.x + FOOT, shot.y);
  sc.ball(C, S.x + 0.1, S.y, 1.2, EASE_LINEAR);
  sc.ball(C + 800, 90.5, 34 - ys * 8, 0.3, EASE_ROLL, 1.4);
  sc.place(O, S.x + 0.6, S.y - ys * 1.4);
  sc.b.key(O, C - 360, S.x + 0.6, S.y - ys * 1.4, 0, EASE_LINEAR);
  sc.b.key(O, C, S.x, S.y, 0, EASE_LINEAR);
  sc.hop(O, C, 0.6, 460);
  if (gk >= 0) {
    sc.place(gk, 102.4, 34 + ys * 0.6);
    sc.b.key(gk, C - 300, 101.4, 34 + ys * 1.6, 0, EASE_LINEAR);
    sc.b.key(gk, C + 600, 101.4, 34 + ys * 1.6, 0, EASE_LINEAR);
  }
}

function secondYellowShirt(c: Ctx): void {
  const { sc, S, ys, V, O, E } = c;
  // A break down the wing, a hand on the shirt, a trip: the second foul of the night.
  const vs = 6.8;
  const v0 = runStart(S, vs);
  sc.place(V, v0.x, v0.y);
  sc.run(V, E, v0.x, v0.y);
  const o0 = { x: v0.x - 3.6, y: v0.y - ys * 2.8 };
  sc.place(O, o0.x, o0.y);
  sc.run(O, E, o0.x, o0.y);
  sc.b.key(V, C - 350, S.x - 2.4, S.y, 0, EASE_LINEAR);
  sc.b.key(V, C, S.x, S.y, 0, EASE_LINEAR);
  sc.run(O, C - 120, S.x - 1.3, S.y - ys * 0.9, 9.2);
  sc.run(O, C, S.x - 0.8, S.y - ys * 0.8, 9);
  sc.tug(O, V, C - 500, 800);
  sc.fall(V, C, 'down', 1100, 1.3, ys * 0.5);
  sc.carry(V, E, C - 80);
  sc.ball(C, S.x + 0.8, S.y);
  sc.ball(C + 1000, S.x + 8, S.y + ys * 0.6, 0, EASE_ROLL);
}

function elbowAerial(c: Ctx): void {
  const { sc, S, ys, V, O, server, E } = c;
  // A long ball, two players going up for it, an elbow in the air.
  const kick = { x: S.x - 25, y: S.y - ys * 4 };
  if (server >= 0) {
    sc.place(server, kick.x, kick.y);
    sc.run(server, E + 450, kick.x, kick.y);
  }
  sc.place(BALL_SLOT, kick.x + 0.6, kick.y);
  sc.ball(E + 450, kick.x + 0.6, kick.y);
  sc.ball(C - 60, S.x, S.y, 1.5, EASE_SMOOTH, 7);
  sc.touches.push({ t: E + 450, slot: server >= 0 ? server : V });
  const v0 = { x: S.x - 4, y: S.y - ys * 3 };
  const o0 = { x: S.x + 2.4, y: S.y + ys * 2.6 };
  sc.place(V, v0.x, v0.y);
  sc.run(V, C - 500, S.x - 0.6, S.y - ys * 0.7, 4.5);
  sc.hop(V, C, 0.85, 520);
  sc.place(O, o0.x, o0.y);
  sc.run(O, C - 500, S.x + 0.6, S.y + ys * 0.7, 4.5);
  sc.hop(O, C, 0.85, 520);
  sc.fall(V, C + 270, 'down', 1100, -0.9, -ys * 0.4);
  sc.ball(C + 1000, S.x + 5, S.y + ys * 1.8, 0, EASE_ROLL, 1.4);
}

function elbowBlind(c: Ctx): void {
  const { sc, S, ys, V, O, server, gk, E } = c;
  // A cross comes in for the two of them; off the ball, the marker's elbow finds the striker's face.
  const wing = { x: 99, y: ys > 0 ? 3 : PITCH_WIDTH - 3 };
  crowdBox(c, [{ x: 92, y: 34 + ys * 10 }, { x: 95.6, y: 34 - ys * 9 }, { x: 90.6, y: 34 - ys * 3.6 }],
    [{ x: 97.4, y: 34 + ys * 6.6 }, { x: 99.2, y: 34 - ys * 5.6 }, { x: 96.6, y: 34 - ys * 12 }, { x: 98.8, y: 34 + ys * 1.2 }]);
  if (server >= 0) {
    sc.place(server, wing.x, wing.y);
    sc.run(server, E + 450, wing.x, wing.y);
  }
  // The ball is crossed to where they are, comes down among them and stops (the play is dead).
  sc.place(BALL_SLOT, wing.x - 0.5, wing.y);
  sc.ball(E + 450, wing.x - 0.5, wing.y);
  sc.ball(C + 300, S.x + 1.2, S.y, 0, EASE_SMOOTH, 5.5);
  sc.ball(C + 1100, S.x + 3.4, S.y - ys * 1.4, 0, EASE_ROLL);
  sc.touches.push({ t: E + 450, slot: server >= 0 ? server : V });
  const v0 = { x: S.x - 8, y: S.y - ys * 2.6 };
  sc.place(V, v0.x, v0.y);
  sc.run(V, C, S.x, S.y, 4.2);
  const o0 = { x: v0.x - 1.2, y: v0.y + ys * 2.4 };
  sc.place(O, o0.x, o0.y);
  sc.run(O, C - 200, S.x - 0.9, S.y + ys * 1.9, 4.4);
  sc.lunge(O, C, { x: S.x - 0.3, y: S.y + ys * 0.6 });
  sc.fall(V, C + 80, 'down', 1100, 0.3, -ys * 0.9);
  // The keeper watches it come, on his line.
  if (gk >= 0) {
    sc.place(gk, 103.4, 34 + ys * 0.4);
    sc.b.key(gk, C, 102.4, 34 + ys * 1.2, 0, EASE_SMOOTH);
  }
}

function brawlMove(c: Ctx, variant: 'shove' | 'melee'): void {
  const { sc, S, ys, V, O } = c;
  // A dispute off the ball: faces, hands, a shove.
  const v0 = { x: S.x - 4, y: S.y - ys * 4 };
  const o0 = { x: S.x + 4.2, y: S.y + ys * 3 };
  sc.place(V, v0.x, v0.y);
  sc.place(O, o0.x, o0.y);
  sc.run(V, C - 600, S.x - 1.4, S.y - ys * 0.7, 4.4);
  sc.run(O, C - 600, S.x + 1.2, S.y + ys * 0.7, 4.4);
  sc.run(V, C, S.x - 0.8, S.y - ys * 0.4, 1.6);
  sc.run(O, C - 220, S.x + 1.8, S.y + ys * 0.7, 1.6);
  // The shove: he goes in with both hands and the other is pushed back, stumbling.
  sc.lunge(O, C, { x: S.x - 0.1, y: S.y - ys * 0.05 });
  sc.fall(V, C + 60, 'down', variant === 'melee' ? 600 : 800, -1.7, -ys * 0.8);
  sc.place(BALL_SLOT, v0.x + 0.7, v0.y);
}

// ── What follows a foul: the whistle, the crowd, the referee, the card, the walk off ──

/** Is he one of the team-mates the aftermath sends somewhere? */
function c_isBusy(c: Ctx, slot: number): boolean {
  return c.vMates.slice(0, 3).includes(slot) || c.oMates.slice(0, 3).includes(slot);
}

function aftermath(c: Ctx, kind: RedKind, spots: { V: Point; O: Point }): void {
  const { sc, S, ys, V, O } = c;
  const brawl = kind === 'brawl';
  const second = kind === 'secondyellow';
  // He gets to his place a moment before the foul, and the whistle blows just after it.
  sc.refGo(C, c.refAtFoul.x, c.refAtFoul.y, 8);
  sc.beat(C + 120, 'whistle', S.x, S.y);

  // The offender backs away from the fouled player, arms out; the referee ends up between them.
  const awayDir = unit(spots.V, spots.O);
  const oBack = { x: clamp(spots.V.x + awayDir.x * 4.8, 2, PITCH_LENGTH - 2), y: clamp(spots.V.y + awayDir.y * 4.8, 2, PITCH_WIDTH - 2) };
  sc.run(O, Math.max(sc.b.lastTime(O) + 250, C + 1250), oBack.x, oBack.y, 2.6);
  spots.O = oBack;

  // The fouled player's team-mates run to him from the far side; the offender's go to the referee.
  const vTeam = c.vMates.slice(0, brawl ? 3 : 1);
  const oTeam = c.oMates.slice(0, brawl ? 3 : 1);
  const fan = (center: Point, dir: Point, n: number, r: number): Point[] => {
    const base = Math.atan2(dir.y, dir.x);
    return Array.from({ length: n }, (_, i) => {
      const a = base + (n === 1 ? 0 : ((i / (n - 1)) - 0.5) * 2.1);
      return { x: clamp(center.x + Math.cos(a) * r, 2, PITCH_LENGTH - 2), y: clamp(center.y + Math.sin(a) * r, 2, PITCH_WIDTH - 2) };
    });
  };
  const aroundV = fan(spots.V, { x: -awayDir.x, y: -awayDir.y }, vTeam.length, brawl ? 4.4 : 5.4);
  vTeam.forEach((slot, i) => sc.run(slot, C + 450 + i * 100, aroundV[i].x, aroundV[i].y, SPEED.sprint));
  const aroundO = fan(spots.O, awayDir, oTeam.length, brawl ? 4.4 : 5.8);
  oTeam.forEach((slot, i) => sc.run(slot, C + 600 + i * 120, aroundO[i].x, aroundO[i].y, SPEED.sprint));

  // The referee: a quick run to the spot, a look at the fouled player, then to the offender.
  const refStand = (p: Point, from: Point, gap: number): Point => {
    const d = unit(p, from);
    return { x: p.x + d.x * gap, y: p.y + d.y * gap };
  };
  const refNow = sc.refWhere();
  sc.refGo(C + 120, refNow.x + 0.6, refNow.y, 4);
  const near = refStand(spots.V, sc.refWhere(), 3.4);
  sc.refGo(C + 950, near.x, near.y, 8.8);
  const cardAt = second ? A - 350 : A + 60;
  // The referee stops by the offender where he really is when the card comes out.
  const toO = refStand(sc.where(O, cardAt), near, 2);
  sc.refGo(Math.max(sc.refTime() + 150, cardAt - 300), toO.x, toO.y, 7);
  const hold = sc.refWhere();
  sc.refGo(cardAt, hold.x, hold.y, 1);
  if (second) {
    sc.beat(cardAt, 'card', hold.x, hold.y, { slot: O, ms: 900, card: 'yellow', label: 'SEGUNDO AMARELO' });
    sc.beat(A + 250, 'card', hold.x, hold.y, { slot: O, ms: Math.max(900, END0 - (A + 250)), card: 'red', label: 'PELO 2º AMARELO' });
  } else {
    sc.beat(cardAt, 'card', hold.x, hold.y, { slot: O, ms: Math.max(900, END0 - cardAt), card: 'red' });
  }
  const redAt = second ? A + 250 : cardAt;

  // The camera: with the move (ahead of the runner), tight on the foul, on the referee and the card,
  // then still on the card.
  const chase = kind === 'tackle' || kind === 'lastman' || kind === 'secondyellow';
  const vAt = (t: number) => sc.where(V, t);
  if (chase) {
    for (let t = 0; t < C - 300; t += 300) sc.camGo(t, clamp(vAt(t).x + 4, 22, 86), 34 + (vAt(t).y - 34) * 0.55, 1.4);
  } else {
    sc.camGo(0, clamp(S.x - 5, 22, 86), 34 + (S.y - 34) * 0.8, 1.6);
  }
  const mid = { x: (spots.V.x + S.x) / 2, y: (spots.V.y + S.y) / 2 };
  sc.camGo(C + 400, clamp(mid.x, 20, 90), mid.y, 2.05);
  const oCard = sc.where(O, redAt);
  sc.camGo(redAt - 500, clamp((hold.x + oCard.x) / 2, 20, 90), (hold.y + oCard.y) / 2, 2.0);
  const still = { x: clamp((hold.x + oCard.x) / 2, 20, 90), y: (hold.y + oCard.y) / 2 };
  sc.camGo(redAt + 200, still.x, still.y, 2.15);
  sc.camGo(END0, still.x, still.y, 2.15);
}

/** A broadcast cut: everyone starts where the last picture had them and is re-placed while it is dark. */
function cutEntry(timeline: Timeline, prev: Float32Array, sentOff: ReadonlySet<number>): void {
  for (let s = 0; s <= BALL_SLOT; s++) {
    if (sentOff.has(s)) continue;
    const track = timeline.tracks[s];
    const target = track[0];
    const rest = track.filter(k => k.t > CUT_SNAP_MS);
    const from = { x: prev[s * 3], y: prev[s * 3 + 1], z: prev[s * 3 + 2] };
    track.length = 0;
    track.push(
      { t: 0, ...from, ease: EASE_SMOOTH, arc: 0 },
      { t: CUT_SNAP_MS - 1, ...from, ease: EASE_LINEAR, arc: 0 },
      { t: CUT_SNAP_MS, x: target.x, y: target.y, z: target.z, ease: EASE_LINEAR, arc: 0 },
      ...rest,
    );
  }
}

// ── Layout ──

function frameLayout(sides: PitchSides, fouled: Side, S: Point, sentOff: ReadonlySet<number>, kind: RedKind): Float32Array {
  const out = createPositionBuffer();
  const off = otherSide(fouled);
  const place = (frameSide: Side, realSide: Side, targetMean: number) => {
    const formationId = sides[realSide].formationId;
    const base = shapeFor(frameSide, formationId, { advance: 0, widthScale: 0.92 });
    const slots = base.map((_, i) => slotBase(realSide) + i).filter(s => roleOfSlot(sides, s) !== 'GK');
    const mean0 = slots.reduce((sum, s) => sum + base[s - slotBase(realSide)].x, 0) / Math.max(1, slots.length);
    const advance = frameSide === 'left' ? targetMean - mean0 : mean0 - targetMean;
    shapeFor(frameSide, formationId, { advance, widthScale: 0.92 }).forEach((p, i) => {
      const slot = slotBase(realSide) + i;
      out[slot * 3] = p.x;
      out[slot * 3 + 1] = p.y;
    });
  };
  // The last man is the last: every other defender has been left behind and the attackers are up.
  // Anywhere else the defenders stand between the ball and their goal.
  const lastMan = kind === 'lastman';
  place('left', fouled, clamp(lastMan ? S.x + 3 : S.x - 8, 30, 92));
  place('right', off, clamp(lastMan ? S.x - 13 : S.x + 9, 30, 98));
  // Whoever was sent off before stays off the pitch.
  sentOff.forEach(slot => { out[slot * 3] = -6; out[slot * 3 + 1] = -6; });
  return out;
}

/** Pushes the players that are not part of the scene out of each other's way and the scene's. */
function spreadOut(out: Float32Array, free: number[], fixed: Point[], minDist: number): void {
  for (let pass = 0; pass < 6; pass++) {
    for (const a of free) {
      const p = { x: out[a * 3], y: out[a * 3 + 1] };
      const others: Point[] = [...fixed];
      for (const b of free) if (b !== a) others.push({ x: out[b * 3], y: out[b * 3 + 1] });
      for (const q of others) {
        const d = dist(p, q);
        if (d < minDist) {
          const dir = d < 1e-4 ? { x: 1, y: 0 } : { x: (p.x - q.x) / d, y: (p.y - q.y) / d };
          p.x += dir.x * (minDist - d) * 0.5;
          p.y += dir.y * (minDist - d) * 0.5;
        }
      }
      out[a * 3] = clamp(p.x, 1.5, PITCH_LENGTH - 1.5);
      out[a * 3 + 1] = clamp(p.y, 1.5, PITCH_WIDTH - 1.5);
    }
  }
}

const VICTIM_ROLES: Record<RedKind, readonly string[]> = {
  tackle: ['CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CDM', 'ST'],
  lastman: ['ST', 'CF', 'LW', 'RW', 'CAM'],
  handball: ['ST', 'CF', 'CAM', 'LW', 'RW'],
  secondyellow: ['LW', 'RW', 'LM', 'RM', 'CAM', 'ST'],
  elbow: ['ST', 'CF', 'CAM', 'CM'],
  brawl: ['CM', 'CAM', 'ST', 'LM', 'RM'],
};

const SERVER_ROLES = ['LB', 'RB', 'LM', 'RM', 'LW', 'RW', 'CM', 'CDM', 'CB'];

export function buildRedCardTimeline(input: RedCardInput): RedCardTimeline {
  const { sides, event, kind, variant, sentOff } = input;
  const offSide = sideOfTeam(sides, event.teamId) ?? 'left';
  const fouled = otherSide(offSide);
  const mirror = fouled === 'right';
  const rng = seededRandom(input.seed);
  const live = (side: Side) => Array.from({ length: PLAYERS_PER_SIDE }, (_, i) => slotBase(side) + i).filter(s => !sentOff.has(s));
  const liveOff = live(offSide);
  const liveFouled = live(fouled);

  // Who: the offender, and the one he fouled (the engine's foul, or a fitting player).
  let O = slotOfPlayer(sides, event.playerId, event.teamId);
  if (O < 0 || !liveOff.includes(O)) O = liveOff.find(s => roleOfSlot(sides, s) !== 'GK') ?? liveOff[0];
  let V = slotOfPlayer(sides, input.victimId, sides[fouled].teamId);
  if (V < 0 || !liveFouled.includes(V) || roleOfSlot(sides, V) === 'GK') {
    const roles = VICTIM_ROLES[kind];
    V = -1;
    for (const role of roles) {
      const hit = liveFouled.filter(s => roleOfSlot(sides, s) === role);
      if (hit.length) { V = hit[Math.floor(rng() * hit.length)]; break; }
    }
    if (V < 0) V = liveFouled.find(s => roleOfSlot(sides, s) !== 'GK') ?? liveFouled[0];
  }
  const gk = liveOff.find(s => roleOfSlot(sides, s) === 'GK') ?? -1;

  const ys: 1 | -1 = rng() < 0.5 ? -1 : 1;
  const S = spotFor(kind, variant, rng, ys);
  const entryMs = input.entry === 'cut' ? CUT_MS : ENTRY_FADE_MS;

  // The server (cross, long ball): a team-mate of the fouled player, in a fitting role.
  const pickServer = (): number => {
    const mates = liveFouled.filter(s => s !== V && roleOfSlot(sides, s) !== 'GK');
    for (const role of SERVER_ROLES) {
      const hit = mates.filter(s => roleOfSlot(sides, s) === role);
      if (hit.length) return hit[Math.floor(rng() * hit.length)];
    }
    return mates[0] ?? -1;
  };
  const needsServer = (kind === 'handball' && variant === 'line') || kind === 'elbow';
  const server = needsServer ? pickServer() : -1;

  // The layout of everyone else, in the scene's frame.
  const layout = frameLayout(sides, fouled, S, sentOff, kind);
  const nearest = (side: Side, exclude: number[]): number[] => live(side)
    .filter(s => !exclude.includes(s) && roleOfSlot(sides, s) !== 'GK')
    .sort((a, b) => dist({ x: layout[a * 3], y: layout[a * 3 + 1] }, S) - dist({ x: layout[b * 3], y: layout[b * 3 + 1] }, S));
  const vMates = nearest(fouled, [V, server]);
  const oMates = nearest(offSide, [O]);

  // The referee keeps up with the play from a few metres behind and to the side, and is
  // there when it happens (he waits where he is when the move is a set piece).
  const refAtFoul: Point = { x: clamp(S.x - 9, 4, 101), y: clamp(S.y - ys * 15, 3, 65) };
  const refKeepsUp = kind === 'tackle' || kind === 'lastman' || kind === 'secondyellow';
  const refStart: Point = refKeepsUp ? { x: Math.max(3, refAtFoul.x - 5.5 * ((C - entryMs) / 1000)), y: refAtFoul.y } : refAtFoul;

  // Players the scene does not script start from the layout, pushed clear of the actors.
  const scripted = new Set<number>([V, O, ...(server >= 0 ? [server] : []), ...(gk >= 0 && (kind === 'lastman' || kind === 'handball' || (kind === 'elbow' && variant === 'blind')) ? [gk] : [])]);
  const free = Array.from({ length: 2 * PLAYERS_PER_SIDE }, (_, s) => s).filter(s => !sentOff.has(s) && !scripted.has(s));
  const lastManBehind = (): void => {
    if (kind !== 'lastman') return;
    const runUp = 0.5 * 7 * ((C - ENTRY_FADE_MS) / 1000);
    for (const slot of liveOff) {
      if (slot === O || slot === gk) continue;
      layout[slot * 3] = Math.min(layout[slot * 3], S.x - 4 - runUp);
    }
  };
  lastManBehind();
  spreadOut(layout, free, [S], 3.2);
  lastManBehind();

  const scene = new Scene(layout, refStart);
  const ctx: Ctx = { sc: scene, rng, S, ys, V, O, vMates, oMates, gk, server, C, E: entryMs, refAtFoul };
  if (kind === 'tackle') tackleMove(ctx, variant as 'behind' | 'twofoot' | 'highboot');
  else if (kind === 'lastman') lastManMove(ctx, variant as 'pull' | 'clip' | 'bodycheck');
  else if (kind === 'handball') (variant === 'line' ? handballLine : handballBlock)(ctx);
  else if (kind === 'secondyellow') (variant === 'late' ? tackleMove(ctx, 'late') : secondYellowShirt(ctx));
  else if (kind === 'elbow') (variant === 'aerial' ? elbowAerial : elbowBlind)(ctx);
  else brawlMove(ctx, variant as 'shove' | 'melee');
  // What the foul is, said on the pitch: its icon and caption pop up where it happens.
  const label = redLabelOf(kind, variant);
  scene.beat(C, 'contact', S.x, S.y, { icon: label.icon, label: label.text, ms: 1600 });

  // The rest of the pitch moves with the play (the whole shape follows the run), so nothing stands still.
  const chase = kind === 'tackle' || kind === 'lastman' || kind === 'secondyellow';
  const shift = chase ? Math.max(0, 0.5 * (S.x - scene.where(V, 0).x)) : 1.8;
  for (const slot of free) {
    const p = scene.where(slot);
    scene.run(slot, C, clamp(p.x + shift, 2, PITCH_LENGTH - 2), p.y, 4.6);
  }
  const spots = { V: scene.where(V, C + 600), O: scene.where(O, C + 600) };
  aftermath(ctx, kind, spots);
  // Whoever has no part in the aftermath keeps moving towards the spot until the card, then holds.
  for (const slot of free) {
    if (c_isBusy(ctx, slot)) continue;
    const p = scene.where(slot);
    const d = unit(p, S);
    scene.run(slot, ARRIVAL0 + 80, clamp(p.x + d.x * 2.2, 2, PITCH_LENGTH - 2), clamp(p.y + d.y * 2.2, 2, PITCH_WIDTH - 2), 3, EASE_LINEAR);
  }

  // The ball sits where the move left it until the end.
  const ballEnd = scene.where(BALL_SLOT);
  scene.ball(END0, ballEnd.x, ballEnd.y);

  // The ball waits where its first key puts it.
  const ballTrack = scene.b.track(BALL_SLOT) as Key[];
  if (ballTrack.length > 1) { ballTrack[0].x = ballTrack[1].x; ballTrack[0].y = ballTrack[1].y; ballTrack[0].z = ballTrack[1].z; }
  let timeline = scene.b.build(END0);
  if (input.entry === 'cut') cutEntry(timeline, input.prev, sentOff);
  let referee = scene.ref;
  let camera = scene.cam;
  let beats = [...scene.beats].sort((a, b) => a.t - b.t);
  const viewAt = (p: Point, zoom: number): PitchView => ({ x: clamp(p.x, 14, PITCH_LENGTH - 14), y: clamp(p.y, 16, PITCH_WIDTH - 16), zoom });
  let focus: [PitchView, PitchView, PitchView] = [
    viewAt({ x: (spots.V.x + S.x) / 2 - 3, y: S.y }, 1.9),
    viewAt({ x: S.x + 1, y: S.y }, 2.3),
    viewAt({ x: (spots.O.x + S.x) / 2, y: (spots.O.y + S.y) / 2 }, 2.5),
  ];
  if (mirror) {
    timeline = mirrorTimeline(timeline);
    referee = referee.map(k => ({ ...k, x: PITCH_LENGTH - k.x, y: PITCH_WIDTH - k.y }));
    camera = camera.map(k => ({ ...k, x: PITCH_LENGTH - k.x, y: PITCH_WIDTH - k.y }));
    beats = beats.map(beat => (beat.kind === 'cut' ? beat : {
      ...beat, ...mirrorPoint(beat),
      ...(beat.fx !== undefined && beat.fy !== undefined ? { fx: PITCH_LENGTH - beat.fx, fy: PITCH_WIDTH - beat.fy } : {}),
    }));
    focus = focus.map(f => ({ ...mirrorPoint(f), zoom: f.zoom })) as [PitchView, PitchView, PitchView];
  }
  const cast: CastEntry[] = [{ slot: O, role: 'defender' }, { slot: V, role: 'finisher' }];
  if ((kind === 'lastman' || (kind === 'handball' && variant === 'line')) && gk >= 0) cast.push({ slot: gk, role: 'goalkeeper' });
  const idOf = (slot: number) => sides[slot < PLAYERS_PER_SIDE ? 'left' : 'right'].playerIds[slot % PLAYERS_PER_SIDE];
  return {
    timeline, referee, camera, cast, beats, touches: [...scene.touches].sort((a, b) => a.t - b.t), focus, timing: RED_TIMING, fouledSide: fouled,
    offenderSlot: O, victimSlot: V, kind, variant, victimId: idOf(V), offenderId: idOf(O),
  };
}
