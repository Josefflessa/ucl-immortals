/**
 * Choreography of a danger, timed to the three narration beats:
 *  - stage 1: the build-up, ending with the finisher arriving;
 *  - stage 2: the strike at CONTACT_MS, then the ball until it reaches its target;
 *  - stage 3: the outcome and the aftermath at normal speed.
 * The narration picks the variant (how the play unfolds) and the finish (how it
 * ends); this file plays exactly those. Every run is capped at a real top speed,
 * so nobody teleports, and only players who really take part are featured.
 * Scripted in the attacker's frame (attacking towards x = 105) and mirrored when
 * the right team attacks.
 */
import type { MatchEvent, PlayKind, PlayShot } from '../engine/teamModel';
import { finishFor, isEpic, variantFor, type FinishStyle, type PlayVariant } from '../playVariants';
import { seededRandom } from '../random';
import {
  BALL_SLOT, GOAL_HEIGHT, GOAL_Y_MAX, GOAL_Y_MIN, PITCH_LENGTH, PITCH_WIDTH, PLAYERS_PER_SIDE, mirrorPoint, otherSide, roleOfSlot, shapeFor, slotBase,
  type PitchSides, type Point, type Side,
} from './geometry';
import { resolveDangerActors } from './actors';
import { BALL_SPEED, CUT_MS, CUT_SNAP_MS, MAX_PLAYER_SPEED, SPEED } from './motion';
import { createPositionBuffer, EASE_LINEAR, EASE_OUT, EASE_ROLL, EASE_SMOOTH, mirrorBuffer, mirrorTimeline, sampleTrack, TimelineBuilder, type Ease, type Key, type Timeline } from './timeline';

/** The narration's stages 2 (the strike) and 3 (the outcome). */
export const STAGE_MS = 1500;
/** The lead-in at the start of stage 1: where the ball comes from. */
export const LEAD_MS = 1000;
/** Stage 1, the build-up: the lead-in, then the decisive move. */
export const BUILDUP_MS = STAGE_MS + LEAD_MS;
/** The strike, just after stage 2 opens with the line that describes it. */
export const CONTACT_MS = BUILDUP_MS + 150;
export const SHOT_ARRIVAL_MS = BUILDUP_MS + STAGE_MS;
export const DANGER_MS = SHOT_ARRIVAL_MS + STAGE_MS;
/** In a fade entry, everyone (ball included) appears in place and holds while fading in. */
export const FADE_ENTRY_MS = 450;
/** When the decisive move starts, after the entry and the lead-in. */
export const DECISIVE_MS = FADE_ENTRY_MS + LEAD_MS;

/**
 * The clock of one danger (real ms from its start). Each play sizes its lead, flight, and
 * aftermath from its movement and finish. The pitch, narration, and camera all share it.
 */
export interface DangerTiming {
  /** The lead-in: where the ball comes from, before the decisive move. */
  leadMs: number;
  /** Stage 2: from its start to the ball reaching its target. */
  strikeMs: number;
  /** Stage 3: outcome and aftermath after the ball arrives. */
  aftermathMs: number;
  /** Stage 1: the lead-in, then the decisive move. */
  buildUpMs: number;
  contactMs: number;
  arrivalMs: number;
  endMs: number;
  /** When the decisive move starts (after the entry and the lead-in). */
  decisiveMs: number;
}

/** Stage 2's line needs this long on screen; a short flight opens it before the strike. */
const STRIKE_READ_MS = 1350;
/** Stage 1's decisive line keeps at least this long before stage 2 replaces it. */
const BUILDUP_READ_MS = 900;

/**
 * `flightMs` is the ball's flight, from the strike to its target. `decisiveScale` stretches
 * the decisive move (from its start to the strike): 1 is its scripted pace, 1.3 takes 30%
 * longer. Stage 2 opens 150 ms before the strike, or earlier when the flight is too short
 * to read its line (the narrator calling the strike as it is shaped).
 */
export function dangerTiming(leadMs = LEAD_MS, flightMs = STAGE_MS - 150, entryMs = FADE_ENTRY_MS, aftermathMs = STAGE_MS, decisiveScale = 1): DangerTiming {
  const decisiveMs = entryMs + leadMs;
  // The decisive script runs from the entry to the strike at CONTACT_MS - LEAD_MS (S_CONTACT,
  // not yet defined when DEFAULT_TIMING is built).
  const contactMs = Math.round(decisiveMs + (CONTACT_MS - LEAD_MS - entryMs) * decisiveScale);
  const early = Math.max(150, Math.min(STRIKE_READ_MS - flightMs, contactMs - decisiveMs - BUILDUP_READ_MS));
  const buildUpMs = contactMs - early;
  const arrivalMs = contactMs + flightMs;
  return { leadMs, strikeMs: arrivalMs - buildUpMs, aftermathMs, buildUpMs, contactMs, arrivalMs, endMs: arrivalMs + aftermathMs, decisiveMs };
}

/** A strike's average pace to its target, m/s, by how it is struck. */
const STRIKE_SPEED: Record<PlayShot, number> = { header: 13, one_on_one: 17, normal: 21, first_time: 22, long_range: 25 };
/** The ball must clear the full goal line before the score is shown, then settle in the net. */
const GOAL_NET_ENTRY_X = PITCH_LENGTH + 1.5;
const GOAL_NET_SETTLE_X = PITCH_LENGTH + 1.8;

/** A parry kicks away from the keeper, then settles in the box for the attacker to chase. */
const REBOUND_BALL_TRAVEL_MS = 500;
/** The attacker takes one short touch into the follow-up strike, without stopping over the ball. */
const REBOUND_CONTROL_MS = 80;
/** A close-range follow-up should not inherit the much longer first-shot flight. */
const REBOUND_SECOND_SHOT_MS = 420;
const REBOUND_REACTION_MS = 60;
const REBOUND_CHASE_BUFFER_MS = 120;
const REBOUND_RUN_TARGET: Point = { x: 97.8, y: 34 };
const DOUBLE_SAVE_OUT_MS = 420;

interface ReboundRunner {
  /** Last scripted position before he can commit to the loose ball. */
  position: Point;
  /** Time after contact until that position is reached. */
  readyDelayMs: number;
}

/** The same sprint budget is used by timing and choreography. */
function reboundRunnerArrivalMs(runner: ReboundRunner, target: Point): number {
  return runner.readyDelayMs + REBOUND_REACTION_MS
    + Math.hypot(target.x - runner.position.x, target.y - runner.position.y) / SPEED.sprint * 1000
    + REBOUND_CHASE_BUFFER_MS;
}

/** The same save animation is used for a rebound goal and for the first half of a double save. */
function parryIntoBox(k: Kit, at: number, contact: Point): { point: Point; landsAt: number } {
  const side = contact.y < 34 ? -1 : 1;
  const point = {
    x: contact.x - 5,
    // Send the ball diagonally into a side channel. That makes the keeper's touch read as a
    // parry the attacker has to chase, instead of a straight pass to his feet.
    y: Math.max(25, Math.min(43, contact.y + side * 2.4)),
  };
  const bounceAt = at + 220;
  const bounce = { x: contact.x - 2.8, y: contact.y + side * 1.8 };
  const landsAt = at + REBOUND_BALL_TRAVEL_MS;
  // The parry keeps one continuous pace into the skip, then rolls away toward the shooter.
  // Matching the roll easing on both legs avoids the old speed jump at the bounce.
  k.ball(bounceAt, bounce.x, bounce.y, 0.9, EASE_ROLL, 0.25);
  k.ball(landsAt, point.x, point.y, 0.1, EASE_ROLL);
  return { point, landsAt };
}

/** How long the first strike needs to reach its target at a real ball's pace. */
function shotTravelMs(shot: Shot, finish: FinishStyle): number {
  const goal = { x: GOAL_NET_ENTRY_X, y: 34 };
  const dist = shot.via
    ? Math.hypot(shot.via.x - shot.x, shot.via.y - shot.y) + Math.hypot(goal.x - shot.via.x, goal.y - shot.via.y)
    : Math.hypot(goal.x - shot.x, goal.y - shot.y);
  const speed = finish === 'panenka' ? 10 : finish === 'chip' ? 12 : finish === 'scuffed' ? 11 : STRIKE_SPEED[shot.shot];
  const floor = finish === 'blocked' ? 900 : finish === 'deflect' ? 900 : 520;
  // A fumble reaches the keeper 400 ms before it squirms over the line; a shot in off the
  // post hits it 160 ms before.
  const after = finish === 'fumble' ? 400 : finish === 'postin' ? 160 : 0;
  // Spread at the shooter's feet, the keeper meets it half way.
  let flight = Math.max(floor, ((finish === 'spread' ? dist * 0.5 : dist) / speed) * 1000 + after);
  // Blocked a few metres out (up to ~0.65 s), then deflected on out for a corner, slower.
  if (finish === 'blocked') flight = Math.max(flight, 650 + (Math.max(0, dist - 4) / 18) * 1000);
  return Math.round(flight);
}

/**
 * Time the whole goal rebound in separate physical phases. The keeper meets the first shot
 * just before it reaches goal; the parry travels, the attacker sprints, controls and shoots.
 */
function strikeFlightMs(shot: Shot, finish: FinishStyle, runner?: ReboundRunner): number {
  const flight = shotTravelMs(shot, finish);
  if (finish === 'rebound') {
    const firstSaveAt = Math.max(400, flight - 100);
    const runnerArrival = reboundRunnerArrivalMs(runner ?? { position: { x: shot.x, y: shot.y }, readyDelayMs: 0 }, shot.reboundTarget ?? REBOUND_RUN_TARGET);
    const receiveAt = Math.max(firstSaveAt + REBOUND_BALL_TRAVEL_MS, runnerArrival);
    return Math.round(receiveAt + REBOUND_CONTROL_MS + REBOUND_SECOND_SHOT_MS);
  }
  return flight;
}
/** The most the decisive move is ever stretched: past it, a play reads as a slow buildup. */
const MAX_DECISIVE_STRETCH = 2;
/**
 * The most the decisive move is stretched for the attackers' runs. Many runs are meant to
 * go as far as a sprint takes them (the shot is struck from wherever the run ends), so a
 * shortfall only earns the play a little more time.
 */
const MAX_RUN_STRETCH = 1.3;
/** The fastest a ball travels before the strike (a driven pass or cross), m/s on average. */
export const MAX_PASS_SPEED = 24;
export const DEFAULT_TIMING: DangerTiming = dangerTiming();

/** When a narration stage (1-3) starts and how long it lasts. */
export function stageStartMs(stage: number, timing: DangerTiming = DEFAULT_TIMING): number {
  return stage <= 1 ? 0 : stage === 2 ? timing.buildUpMs : timing.arrivalMs;
}
export function stageLengthMs(stage: number, timing: DangerTiming = DEFAULT_TIMING): number {
  return stage <= 1 ? timing.buildUpMs : stage === 2 ? timing.strikeMs : timing.aftermathMs;
}
// The decisive move is scripted on its own clock (the strike always at S_CONTACT) and played
// leadMs later; when the ball arrives and the play ends depend on the play (Kit.sArrival/sEnd).
const S_CONTACT = CONTACT_MS - LEAD_MS;

export type DangerOutcome = 'goal' | 'save' | 'miss';
export type CastRole = 'finisher' | 'creator' | 'defender' | 'goalkeeper';
export interface CastEntry { slot: number; role: CastRole }
/** 'flip': a bicycle kick (upside down in the air); 'dive': a diving header (flat, head first). */
export type BeatKind = 'net' | 'save' | 'post' | 'block' | 'tackle' | 'lunge' | 'flip' | 'dive' | 'out' | 'cut' | 'strike' | 'normal';
/**
 * A moment of the play. A sliding tackle or a lunge also names who makes it (`slot`), for how
 * long it shows (`ms`) and its line on the grass, from (`fx`, `fy`) to (`x`, `y`).
 */
export interface Beat {
  t: number;
  kind: BeatKind;
  x: number;
  y: number;
  slot?: number;
  ms?: number;
  /** Time from a strike contact to its arrival; rebound strikes have a shorter flight. */
  flightMs?: number;
  fx?: number;
  fy?: number;
}
/** Someone playing the ball (a pass, a carry, a header, a strike, a save...), at time t. */
export interface Touch { t: number; slot: number }

/** Where the camera looks: the centre of the play and how far it can zoom in. */
export interface PitchView extends Point { zoom: number }

export interface DangerInput {
  sides: PitchSides;
  attackSide: Side;
  event: MatchEvent;
  outcome: DangerOutcome;
  prev: Float32Array;
  sentOff: ReadonlySet<number>;
  /**
   * How the players come in. 'fade': they were off screen (the radio view of open
   * play) and appear already in place. 'cut': a quick dark cut re-places everyone.
   */
  entry: 'fade' | 'cut';
  /** How the play unfolds, as the narration tells it (picked from the seed when absent). */
  variant?: PlayVariant;
  /** How it ends (low, top corner, parry, blocked...), as the narration tells it. */
  finish?: FinishStyle;
  /** Lead-ins this match has shown lately: they weigh less in the draw. */
  recentLeads?: readonly LeadPattern[];
  seed: number;
}

export interface DangerTimeline {
  timeline: Timeline;
  cast: CastEntry[];
  beats: Beat[];
  /** The build-up: everything the ball and the cast do. */
  focus: PitchView;
  /** From the strike on: the shot and the goal, close up. */
  strikeFocus: PitchView;
  attackSide: Side;
  entry: 'fade' | 'cut';
  variant: PlayVariant;
  finish: FinishStyle;
  /** How the ball reached the decisive move (for the narration's first line). */
  lead: LeadIn;
  /** Every touch of the ball, in time order: who is on the ball, for the pitch to show. */
  touches: Touch[];
  /** This play's clock (the narration's stages follow it). */
  timing: DangerTiming;
  /** One of the rare, memorable plays. */
  epic: boolean;
}

export const DANGER_KINDS: readonly PlayKind[] = [
  'cross', 'through', 'dribble', 'longrange', 'counter',
  'corner', 'freekick', 'penalty',
  'own_goal', 'blunder', 'deflected', 'screamer', 'woodwork',
];

const FOOT = 0.8;
const MAX_ZOOM = 2.2;

/** Frames everything the ball and the cast do in the decisive part of the play. */
export function viewOfPlay(timeline: Timeline, slots: number[], timing: DangerTiming = DEFAULT_TIMING, includeAftermath = false): PitchView {
  const VIEW_FROM_MS = timing.decisiveMs + 150;
  const VIEW_TO_MS = includeAftermath ? timing.endMs : timing.arrivalMs + 600;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const slot of [BALL_SLOT, ...slots]) {
    for (const k of timeline.tracks[slot]) {
      if (k.t < VIEW_FROM_MS || k.t > VIEW_TO_MS) continue;
      const x = Math.min(107, Math.max(-2, k.x));
      const y = Math.min(70, Math.max(-2, k.y));
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return { x: 52.5, y: 34, zoom: 1 };
  const zoom = Math.min(MAX_ZOOM, Math.max(1, Math.min(111 / (maxX - minX + 13), 73 / (maxY - minY + 10))));
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, zoom };
}

/**
 * Close-up on a shot and the goal it is aimed at (attacker's frame), framed like a
 * broadcast: the goal line three quarters across, the shooter in view on the left
 * and the whole net, with grass behind it, on the right.
 */
export function viewOfStrike(shot: Point): PitchView {
  const GOAL_AT = 0.75;
  const minY = Math.min(shot.y, GOAL_Y_MIN) - 4;
  const maxY = Math.max(shot.y, GOAL_Y_MAX) + 4;
  // Wide enough that the shooter (with a margin) fits left of the goal line.
  const zoomForShot = (111 * GOAL_AT) / Math.max(1, 105 - shot.x + 5);
  const zoom = Math.min(2.6, Math.max(1.4, Math.min(zoomForShot, 73 / (maxY - minY))));
  const width = 111 / zoom;
  return { x: 105 - width * (GOAL_AT - 0.5), y: (minY + maxY) / 2, zoom };
}

/** From a towards b, at most `max` metres. */
function toward(a: Point, b: Point, max: number): Point {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  return d <= max ? { x: b.x, y: b.y } : { x: a.x + ((b.x - a.x) * max) / d, y: a.y + ((b.y - a.y) * max) / d };
}

// ── The scripting kit: speed-limited runs and a ball that follows the players. ──

class Kit {
  readonly b: TimelineBuilder;
  readonly scripted = new Set<number>();
  readonly jumped = new Set<number>();
  /** Players who had the ball at their feet. */
  readonly onBall = new Set<number>();
  /** Off-ball runs rebuilt to flow (a key every 100 ms): moved by bending, see flowOffBall. */
  readonly flowing = new Set<number>();
  /** Every touch and every ball key (real time), to glue the carries afterwards. */
  private readonly touches: { slot: number; t: number }[] = [];
  /** Touches placed once the runs are scripted (real time). */
  private readonly deferred: { slot: number; t: number }[] = [];
  private readonly ballTimes: number[] = [];
  readonly beats: Beat[] = [];
  /** Start of the play proper (after the cut or the fade-in), in the script's time. */
  t0 = 0;
  /**
   * Script time → real time. The scripts are written on a fixed clock (the lead-in from t0,
   * the decisive move from t0 to the strike at S_CONTACT); each play then runs them at its
   * own pace: the lead-in and the decisive move are stretched as much as they need (a cross
   * flies at a real cross's speed, a runner gets to his spot), never squeezed. After the
   * strike, time is not stretched (that is the strike stage's own clock). The
   * post-processing passes (glue, strike burst, settle) work in real time.
   */
  private clock: (t: number) => number = t => t;
  private unclock: (real: number) => number = real => real;
  /** While set, the kit's times are real times (the post-processing passes). */
  private raw = false;
  /** How far attacking runs fell short of their spot (needed / possible distance), per phase. */
  readonly shortfall = { lead: 1, decisive: 1 };
  /** The attackers whose runs are measured for shortfall in the current phase. */
  watched: ReadonlySet<number> = new Set();
  private phase: 'lead' | 'decisive' = 'lead';
  /** Real time at which the play proper starts (end of the cut or the fade-in). */
  start = 0;

  /** The ball's arrival and the end of the play, in the decisive move's script time. */
  readonly sArrival: number;
  readonly sEnd: number;

  constructor(start: Float32Array, readonly rng: () => number, readonly tm: DangerTiming = DEFAULT_TIMING) {
    this.b = new TimelineBuilder(start);
    // After the strike the script and the real clock run at the same pace.
    this.sArrival = S_CONTACT + (tm.arrivalMs - tm.contactMs);
    this.sEnd = S_CONTACT + (tm.endMs - tm.contactMs);
  }

  real(t: number): number { return this.raw ? t : this.clock(t); }
  script(real: number): number { return this.raw ? real : this.unclock(real); }
  /** Real milliseconds between two script times. */
  span(from: number, to: number): number { return this.real(to) - this.real(from); }

  /** The lead-in's clock: script time from t0 stretched by `scale`. */
  setLeadClock(t0: number, scale: number): void {
    this.phase = 'lead';
    this.clock = t => (t <= t0 ? t : t0 + (t - t0) * scale);
    this.unclock = real => (real <= t0 ? real : t0 + (real - t0) / scale);
  }

  /**
   * The decisive move's clock: its script starts again at t0, at real time `realStart`,
   * stretched evenly up to the strike at real time `contact`; after it, unstretched.
   */
  setDecisiveClock(t0: number, realStart: number, contact: number): void {
    this.phase = 'decisive';
    const scale = (contact - realStart) / (S_CONTACT - t0);
    this.clock = t => (t <= t0 ? realStart - (t0 - t) : t <= S_CONTACT ? realStart + (t - t0) * scale : contact + (t - S_CONTACT));
    this.unclock = real => (real <= realStart ? t0 - (realStart - real) : real <= contact ? t0 + (real - realStart) / scale : S_CONTACT + (real - contact));
  }

  at(slot: number, t: number) {
    return this.b.at(slot, this.real(t));
  }

  /** The time of a slot's last key, in the script's time. */
  lastTime(slot: number): number {
    return this.script(this.b.lastTime(slot));
  }

  /** Players who had the ball at their feet at or after real time t. */
  touchersSince(t: number): number[] {
    return Array.from(new Set(this.touches.filter(x => x.t >= t).map(x => x.slot)));
  }

  /**
   * Moves a player by (dx, dy) at real time t with a single key, only if neither of the
   * two segments it creates goes past maxSpeed (worked out from the eases' peak factors).
   * Tries the full step, then half. Returns whether it moved him.
   */
  nudge(slot: number, t: number, dx: number, dy: number, maxSpeed = 9.6, hold = 0): boolean {
    const peak = (ease: Ease) => (ease === EASE_SMOOTH ? 1.5 : ease === EASE_OUT ? 2 : ease === EASE_ROLL ? 1.4 : 1);
    const { prev, next } = this.b.around(slot, t);
    // A densely keyed run (an off-ball run made to flow): the keys around t bend instead.
    if (this.flowing.has(slot)) return this.bend(slot, t, dx, dy, maxSpeed, peak, hold);
    if (!prev || !next || next.t - t < 120 || t - prev.t < 120) return false;
    const p = this.b.at(slot, t);
    for (const share of [1, 0.6, 0.35]) {
      const x = p.x + dx * share;
      const y = p.y + dy * share;
      const v1 = Math.hypot(x - prev.x, y - prev.y) / ((t - prev.t) / 1000);
      const v2 = (Math.hypot(next.x - x, next.y - y) / ((next.t - t) / 1000)) * peak(next.ease);
      if (v1 <= maxSpeed && v2 <= maxSpeed) {
        this.b.key(slot, t, x, y, p.z, EASE_LINEAR);
        return true;
      }
    }
    // A gentler detour: out of the line and back over a longer window, every leg checked.
    for (const w of [250, 400]) {
      if (t - prev.t < w + 60 || next.t - t < w + 60) continue;
      const a = this.b.at(slot, t - w);
      const b = this.b.at(slot, t + w);
      const m = { x: p.x + dx, y: p.y + dy };
      const legs = [
        Math.hypot(a.x - prev.x, a.y - prev.y) / ((t - w - prev.t) / 1000),
        Math.hypot(m.x - a.x, m.y - a.y) / (w / 1000),
        Math.hypot(b.x - m.x, b.y - m.y) / (w / 1000),
        (Math.hypot(next.x - b.x, next.y - b.y) / ((next.t - t - w) / 1000)) * peak(next.ease),
      ];
      if (legs.every(v => v <= maxSpeed)) {
        this.b.key(slot, t - w, a.x, a.y, a.z, EASE_LINEAR);
        this.b.key(slot, t, m.x, m.y, p.z, EASE_LINEAR);
        this.b.key(slot, t + w, b.x, b.y, b.z, EASE_LINEAR);
        return true;
      }
    }
    return false;
  }

  /**
   * Moves a densely keyed player by (dx, dy) at real time t: the keys bend by a smooth bump
   * (full within `hold` ms of t, easing to nothing over the next 350 ms), only if no
   * segment it touches goes past maxSpeed. Tries the full step, then less.
   */
  private bend(slot: number, t: number, dx: number, dy: number, maxSpeed: number, peak: (ease: Ease) => number, hold: number): boolean {
    const W = 350;
    const track = this.b.track(slot);
    const weight = (key: Key) => {
      const u = Math.max(0, Math.abs(key.t - t) - hold) / W;
      return u < 1 ? 0.5 * (1 + Math.cos(Math.PI * u)) : 0;
    };
    for (const share of [1, 0.6, 0.35]) {
      const moved = track.map(key => ({ x: key.x + dx * share * weight(key), y: key.y + dy * share * weight(key) }));
      let fits = true;
      for (let i = 1; i < track.length && fits; i++) {
        if (weight(track[i]) === 0 && weight(track[i - 1]) === 0) continue;
        const v = (Math.hypot(moved[i].x - moved[i - 1].x, moved[i].y - moved[i - 1].y) / ((track[i].t - track[i - 1].t) / 1000)) * peak(track[i].ease);
        if (v > maxSpeed) fits = false;
      }
      if (!fits) continue;
      track.forEach((key, i) => { key.x = moved[i].x; key.y = moved[i].y; });
      return true;
    }
    return false;
  }

  /** Whether a slot has keys strictly between two script times. */
  hasKeys(slot: number, from: number, to: number): boolean {
    return this.b.keysBetween(slot, this.real(from), this.real(to)) > 0;
  }

  /** A plain key at script time t (a gentle reposition, no speed check). */
  keyAt(slot: number, t: number, x: number, y: number): void {
    this.b.key(slot, this.real(t), x, y, 0, EASE_SMOOTH);
  }

  /** Replaces a scripted continuation after t while keeping the player's actual position. */
  replaceFuture(slot: number, t: number): Point {
    const real = this.real(t);
    const p = this.b.at(slot, real);
    this.b.dropAfter(slot, real);
    this.b.key(slot, real, p.x, p.y, p.z, EASE_LINEAR);
    return p;
  }

  /** Someone plays the ball at script time t without it being at his feet (a header, a strike, a save). */
  touch(slot: number, t: number): void {
    if (slot >= 0) this.touches.push({ slot, t: this.real(t) });
  }

  /** Every touch so far, in time order (real time). */
  touchLog(): Touch[] {
    return [...this.touches].sort((a, b) => a.t - b.t);
  }

  deferFeet(slot: number, t: number): void {
    this.deferred.push({ slot, t: this.real(t) });
  }

  /** Runs towards (x, y), arriving at t if it can; otherwise as far as its top speed allows. */
  run(slot: number, t: number, x: number, y: number, opts: { speed?: number; ease?: Ease; z?: number } = {}): Point {
    const ease = opts.ease ?? EASE_LINEAR;
    const speed = (opts.speed ?? SPEED.sprint) / (ease === EASE_SMOOTH ? 1.5 : ease === EASE_OUT ? 2 : 1);
    const real = this.real(t);
    const last = this.b.lastTime(slot);
    const from = this.b.at(slot, last);
    const reach = (speed * Math.max(0, real - last)) / 1000;
    const d = Math.hypot(x - from.x, y - from.y);
    const k = d > reach && d > 0 ? reach / d : 1;
    // An attacker who cannot get to his spot in time: the play needs more time.
    // (Only before the strike, which is when the clock can stretch; a short reach for a
    // step is not a run that falls short.)
    if (k < 1 && !this.raw && this.watched.has(slot) && reach > 0 && d - reach > 1 && (this.phase === 'lead' || t <= S_CONTACT)) {
      this.shortfall[this.phase] = Math.max(this.shortfall[this.phase], d / reach);
    }
    const p = { x: from.x + (x - from.x) * k, y: from.y + (y - from.y) * k };
    this.b.key(slot, real, p.x, p.y, opts.z ?? 0, ease);
    this.scripted.add(slot);
    return p;
  }

  ball(t: number, x: number, y: number, z = 0, ease: Ease = EASE_LINEAR, arc = 0): void {
    const real = this.real(t);
    // A pass along the ground rolls: struck firmly, it slows on the way (never past the
    // speed limit: only for passes up to 30 m/s on average).
    if (ease === EASE_LINEAR && arc === 0 && z === 0) {
      const last = this.b.lastTime(BALL_SLOT);
      const from = this.b.at(BALL_SLOT, last);
      const avg = Math.hypot(x - from.x, y - from.y) / Math.max(0.001, (real - last) / 1000);
      if (real > last && from.z < 0.05 && avg > 6 && avg < 30) ease = EASE_ROLL;
    }
    this.b.key(BALL_SLOT, real, x, y, z, ease, arc);
    this.ballTimes.push(real);
  }

  /** The ball at the player's feet at time t. */
  feet(slot: number, t: number, z = 0, arc = 0): Point {
    const real = this.real(t);
    const p = this.at(slot, t);

    // Some scripts key a pass at the runner's feet, then record his next touch a beat
    // later. If the ball is already there, possession began at that earlier contact;
    // waiting for this feet() call lets the ball's roll curve run past him first.
    let arrival = -Infinity;
    for (const ballTime of this.ballTimes) {
      if (ballTime < real - 1 && ballTime > arrival) arrival = ballTime;
    }
    if (real - arrival <= 300) {
      const ball = this.b.at(BALL_SLOT, arrival);
      const receiver = this.b.at(slot, arrival);
      const gap = Math.hypot(ball.x - receiver.x - FOOT, ball.y - receiver.y - 0.3);
      let previousTouch: { slot: number; t: number } | undefined;
      for (const touch of this.touches) {
        if (touch.t <= arrival && (!previousTouch || touch.t > previousTouch.t)) previousTouch = touch;
      }
      if (ball.z < 0.9 && gap <= 1.25 && previousTouch?.slot !== slot) {
        const { prev, next } = this.b.around(slot, arrival);
        const receiverEase = prev?.t === arrival ? prev.ease : next?.ease ?? EASE_LINEAR;
        this.b.key(BALL_SLOT, arrival, receiver.x + FOOT, receiver.y + 0.3, 0, receiverEase);
        this.touches.push({ slot, t: arrival });
      }
    }

    // A controlled ball must share the receiver's movement curve. `ball()` adds the
    // faster EASE_ROLL curve to ordinary ground passes, which can put it ahead of a runner.
    const { prev, next } = this.b.around(slot, real);
    const ease = prev?.t === real ? prev.ease : next?.ease ?? EASE_LINEAR;
    this.b.key(BALL_SLOT, real, p.x + FOOT, p.y + 0.3, z, ease, arc);
    this.ballTimes.push(real);
    this.onBall.add(slot);
    this.touches.push({ slot, t: real });
    return { x: p.x + FOOT, y: p.y + 0.3 };
  }

  jump(slot: number, peak: number, height = 0.8): void {
    const real = this.real(peak);
    const a = this.b.at(slot, real - 180);
    const m = this.b.at(slot, real);
    const z = this.b.at(slot, real + 180);
    this.b.key(slot, real - 180, a.x, a.y, 0, EASE_LINEAR);
    // Linear on purpose: the peak may land on a run's arrival key, and an ease-out there would double its speed.
    this.b.key(slot, real, m.x, m.y, height, EASE_LINEAR);
    // Landing mid-run (his run goes on after it): at his running pace, no speed-up.
    this.b.key(slot, real + 180, z.x, z.y, 0, this.b.lastTime(slot) > real + 180 ? EASE_LINEAR : EASE_SMOOTH);
    this.scripted.add(slot);
    this.jumped.add(slot);
  }

  /**
   * A sliding tackle, meeting the ball's line at `at` at script time t: a sprint to where he
   * leaves his feet, 2.2 m short; a slide along the grass through that point, slowing to a
   * stop a metre past it; a moment on the ground; and up. If `attacker` is given he hops
   * over the slide (a miss). Returns the script time he is back on his feet.
   */
  slideTackle(slot: number, t: number, at: Point, attacker = -1, downMs = 550): number {
    const real = this.real(t);
    const from = this.b.at(slot, Math.max(this.b.lastTime(slot), real - 600));
    let dx = at.x - from.x, dy = at.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.3) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
    const SLIDE = 2.2, GLIDE = 1, LAUNCH_MS = 260, GLIDE_MS = 300;
    const launchAt = Math.max(t - LAUNCH_MS, this.lastTime(slot));
    const launch = launchAt > this.lastTime(slot) ? this.run(slot, launchAt, at.x - dx * SLIDE, at.y - dy * SLIDE, { speed: SPEED.sprint }) : from;
    // Through the ball's line (as far as he gets from wherever he could launch), then gliding to a stop.
    const meet = toward(launch, at, (9.4 * this.span(launchAt, t)) / 1000);
    this.b.key(slot, real, meet.x, meet.y, 0, EASE_LINEAR);
    const rest = { x: meet.x + dx * GLIDE, y: meet.y + dy * GLIDE };
    this.b.key(slot, real + GLIDE_MS, rest.x, rest.y, 0, EASE_OUT);
    this.b.key(slot, real + GLIDE_MS + downMs, rest.x, rest.y, 0, EASE_LINEAR);
    const up = real + GLIDE_MS + downMs + 320;
    this.b.key(slot, up, rest.x + dx * 0.3, rest.y + dy * 0.3, 0, EASE_SMOOTH);
    if (attacker >= 0) this.jump(attacker, t, 0.55);
    this.scripted.add(slot);
    this.jumped.add(slot);
    this.beats.push({ t: this.real(launchAt), kind: 'tackle', x: rest.x, y: rest.y, fx: launch.x, fy: launch.y, slot, ms: this.span(launchAt, t) + GLIDE_MS + downMs + 120 });
    return this.script(up);
  }

  /**
   * A lunge (o bote): standing, he darts the last 1.6 m at the ball, reaching `at` at script
   * time t, then brakes over 0.7 m (unless he wins it and carries on: `brake` false).
   * Returns where he stops (or meets the ball).
   */
  lunge(slot: number, t: number, at: Point, brake = true): Point {
    const real = this.real(t);
    const from = this.b.at(slot, Math.max(this.b.lastTime(slot), real - 500));
    let dx = at.x - from.x, dy = at.y - from.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.3) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
    const DART_MS = 200, BRAKE = 0.7, BRAKE_MS = 260;
    // Already close: he darts from where he is.
    const DART = Math.min(1.6, len);
    // Never before what is already scripted for him (a later start makes a shorter dart).
    const setAt = Math.max(t - DART_MS, this.lastTime(slot));
    const set = setAt > this.lastTime(slot) ? this.run(slot, setAt, at.x - dx * DART, at.y - dy * DART, { speed: SPEED.run }) : from;
    const reach = toward(set, at, (9.4 * this.span(setAt, t)) / 1000);
    this.b.key(slot, real, reach.x, reach.y, 0, EASE_LINEAR);
    const stop = brake ? { x: reach.x + dx * BRAKE, y: reach.y + dy * BRAKE } : reach;
    if (brake) this.b.key(slot, real + BRAKE_MS, stop.x, stop.y, 0, EASE_OUT);
    this.scripted.add(slot);
    this.beats.push({ t: this.real(setAt), kind: 'lunge', x: stop.x, y: stop.y, fx: set.x, fy: set.y, slot, ms: this.span(setAt, t) + (brake ? BRAKE_MS : 120) + 80 });
    return stop;
  }

  /** A body shape for the pitch to draw (a bicycle kick, a diving header) from script time t. */
  pose(slot: number, t: number, kind: 'flip' | 'dive', ms: number): void {
    const p = this.at(slot, t);
    this.beats.push({ t: this.real(t), kind, x: p.x, y: p.y, slot, ms });
  }

  /** A beat at script time t. */
  beat(t: number, kind: BeatKind, x: number, y: number, flightMs?: number): void {
    this.beats.push({ t: this.real(t), kind, x, y, ...(flightMs === undefined ? {} : { flightMs }) });
  }

  // ── Post-processing, in real time. ──

  /**
   * A carry: between two touches by the same player (and nothing else happening to the
   * ball), the ball stays at his feet, a little ahead in the direction he runs. Without
   * this it would float in a straight line between the touches, looking loose, like a pass.
   */
  glueCarries(): void {
    this.raw = true;
    for (const d of this.deferred.splice(0)) this.feet(d.slot, d.t);
    this.raw = false;
    this.recordArrivals();
    const touches = [...this.touches].sort((a, b) => a.t - b.t);
    for (let i = 0; i + 1 < touches.length; i++) {
      const a = touches[i];
      const b = touches[i + 1];
      if (a.slot !== b.slot || b.t - a.t < 200) continue;
      if (this.ballTimes.some(t => t > a.t + 1 && t < b.t - 1)) continue;
      for (let t = a.t + 120; t < b.t - 70; t += 120) {
        const p = this.b.at(a.slot, t);
        const q = this.b.at(a.slot, t + 60);
        let dx = q.x - p.x;
        let dy = q.y - p.y;
        const len = Math.hypot(dx, dy);
        if (len < 0.05) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
        // Steadily ahead of him (the stride rhythm of the touches is drawn by the pitch).
        this.b.key(BALL_SLOT, t, p.x + dx * 0.7, p.y + dy * 0.7 + 0.15, 0, EASE_LINEAR);
      }
    }
  }

  /**
   * A pass keyed to arrive at a player's feet (before the strike) is his touch from that
   * moment, even when his script only records one as he plays it on later: he has the ball
   * from there (the pitch lights him and keeps it at his feet, the glue carries it).
   */
  private recordArrivals(): void {
    const ball = this.b.track(BALL_SLOT);
    for (let i = 1; i < ball.length; i++) {
      const k = ball[i];
      const prev = ball[i - 1];
      if (k.t >= this.tm.contactMs - 20 || k.z > 0.6 || Math.hypot(k.x - prev.x, k.y - prev.y) < 2) continue;
      // Exactly at his feet (where the scripts place a ball he takes: in front of him, either
      // way he faces), not merely beside him: a marker at his shoulder is not on the ball.
      let near = -1;
      let best = 0.4;
      for (let s = 0; s < BALL_SLOT; s++) {
        const p = this.b.at(s, k.t);
        for (const fx of [FOOT, -FOOT, -0.6]) {
          const gap = Math.hypot(p.x + fx - k.x, p.y + 0.3 - k.y);
          if (gap < best) { best = gap; near = s; }
        }
      }
      if (near >= 0 && !this.touches.some(x => x.slot === near && Math.abs(x.t - k.t) <= 200)) this.touches.push({ slot: near, t: k.t });
    }
  }

  /**
   * Nobody stops dead (real time): a player whose script ends mid-run carries on and slows
   * to a halt (an ease-out over the distance he would cover at half his speed, so his speed
   * is continuous). The finisher follows through after the strike.
   */
  settleRuns(until: number, skip: ReadonlySet<number>): void {
    for (let s = 0; s < BALL_SLOT; s++) {
      if (skip.has(s)) continue;
      const last = this.b.lastTime(s);
      // Only real runs: not a player who has merely been placed (by the cut or the fade-in).
      if (last <= this.start + 40 || last > until - 400) continue;
      const p = this.b.at(s, last);
      if (p.z > 0.05) continue; // in the air (a dive, a jump): it lands where it is
      const q = this.b.at(s, last - 40);
      const vx = (p.x - q.x) / 0.04;
      const vy = (p.y - q.y) / 0.04;
      if (Math.hypot(vx, vy) < 1) continue;
      const T = 0.4;
      this.b.key(s, last + T * 1000, p.x + vx * T * 0.5, p.y + vy * T * 0.5, 0, EASE_OUT);
    }
  }

  /** The broadcast cut (real time): everyone (and the ball) re-placed while the picture is dark. */
  snapAll(layout: Float32Array, sentOff: ReadonlySet<number>): void {
    for (let s = 0; s <= BALL_SLOT; s++) {
      if (s < BALL_SLOT && sentOff.has(s)) continue;
      const p = this.b.at(s, CUT_SNAP_MS - 1);
      this.b.key(s, CUT_SNAP_MS - 1, p.x, p.y, p.z, EASE_LINEAR);
      this.b.key(s, CUT_SNAP_MS, layout[s * 3], layout[s * 3 + 1], layout[s * 3 + 2], EASE_LINEAR);
    }
  }
}

/** The build-up scripts; the luck plays reuse them (an own goal is a cross, a deflection a long shot...). */
type Base = 'cross' | 'through' | 'dribble' | 'longrange' | 'counter' | 'corner' | 'freekick' | 'penalty' | 'screamer';

function scriptOf(kind: PlayKind, variant: PlayVariant): { base: Base; variant: string } {
  switch (kind) {
    // A short corner swung in, and a defender heads it into his own net.
    case 'own_goal': return variant === 'corner' ? { base: 'corner', variant: 'short' } : { base: 'cross', variant: variant === 'clearance' ? 'driven' : variant };
    case 'blunder':
      if (variant === 'longshot') return { base: 'longrange', variant: 'layoff' };
      if (variant === 'header') return { base: 'cross', variant: 'byline' };
      if (variant === 'freekick') return { base: 'freekick', variant: 'curl' };
      return { base: 'dribble', variant: 'single' };
    case 'deflected':
      if (variant === 'dribble') return { base: 'dribble', variant: 'single' };
      // Off the wall, or a corner played to the edge of the box and struck through the crowd.
      if (variant === 'freekick') return { base: 'freekick', variant: 'power' };
      if (variant === 'edge') return { base: 'corner', variant: 'edge' };
      return { base: 'longrange', variant: 'layoff' };
    case 'woodwork':
      if (variant === 'curler') return { base: 'dribble', variant: 'cutinside' };
      if (variant === 'header') return { base: 'cross', variant: 'byline' };
      // Through on goal, dinked over the keeper coming out.
      if (variant === 'chip') return { base: 'through', variant: 'chip' };
      return { base: 'longrange', variant };
    default: return { base: kind as Base, variant };
  }
}

/** A second attacker some variants need (the winger in an overlap, the short corner taker...). */
function helperRoles(base: Base, variant: string): string[] | null {
  if (base === 'cross' && variant === 'overlap') return ['LW', 'RW', 'LM', 'RM', 'CAM', 'CM'];
  if (base === 'corner' && variant === 'short') return ['CM', 'CAM', 'LM', 'RM', 'CDM'];
  if (base === 'corner' && variant === 'flick') return ['CB', 'ST', 'CF', 'CDM'];
  if (base === 'counter' && (variant === 'twoonone' || variant === 'threevtwo')) return ['LW', 'RW', 'ST', 'CF', 'CAM'];
  if (base === 'through' && variant === 'dummy') return ['ST', 'CF', 'CAM', 'LW', 'RW', 'CM'];
  if (base === 'longrange' && variant === 'knockdown') return ['CB', 'CDM', 'CM', 'LB', 'RB'];
  if (base === 'corner' && variant === 'backpost') return ['CB', 'ST', 'CF', 'CDM'];
  if (base === 'freekick' && variant === 'routine') return ['CM', 'CAM', 'CDM', 'LM', 'RM'];
  if (base === 'freekick' && variant === 'dummyrun') return ['CAM', 'CM', 'LW', 'RW', 'ST', 'CF'];
  if (base === 'cross' && variant === 'firsttime') return ['CM', 'CAM', 'CDM', 'LM', 'RM', 'LW', 'RW'];
  if (base === 'cross' && variant === 'farknock') return ['ST', 'CF', 'CB', 'CAM', 'CM'];
  if (base === 'through' && variant === 'thirdman') return ['CDM', 'CM', 'CAM', 'LM', 'RM'];
  if (base === 'corner' && variant === 'decoy') return ['CB', 'ST', 'CF', 'CDM', 'CM'];
  return null;
}

interface Ctx {
  kind: PlayKind;
  base: Base;
  /** The script's variant (the narrated one, or what it reuses). */
  variant: string;
  outcome: DangerOutcome;
  finish: FinishStyle;
  sides: PitchSides;
  sentOff: ReadonlySet<number>;
  wing: 1 | -1;
  /** Touchline y on the chosen wing. */
  W: number;
  finisher: number;
  creator: number;
  defender: number;
  gk: number;
  /** A second attacker in the move, or -1. */
  helper: number;
  /** A second defender in the move, or -1. */
  second: number;
  /** A goal with an assist: the assist provider (the creator) plays the last pass. */
  assisted: boolean;
  atkBase: number;
  defBase: number;
  atkLive: number[];
  defLive: number[];
  /** Defenders in the free-kick wall. */
  wall: number[];
  /** Free kick spot, penalty spot or corner flag. */
  spot: Point;
}

interface Shot {
  x: number; y: number; z: number;
  shot: PlayShot;
  /** Sideways bend of a curled shot, in metres, and its height half way. */
  curve?: number;
  curveZ?: number;
  /** Derived by the save choreography so rebound timing follows the actual loose-ball spot. */
  reboundTarget?: Point;
  /** Which corner it is struck at (near or far from the shooter's side). */
  aim?: 'near' | 'far';
  /** Where the keeper sets himself (off his line when one on one). */
  keeperAt?: Point;
  /**
   * A point the ball passes half way (an Olympic corner bending in from the flag): the
   * flight bends through it instead of the sideways `curve`.
   */
  via?: Point & { z: number };
  /** How high the flight rises above a straight line (metres): a lob from far out. */
  arc?: number;
}

// ── Where each play starts. ──

type SupportMode = 'open' | 'box' | 'penalty' | 'wall';
interface Setup { creator?: Point; finisher?: Point; defender?: Point; helper?: Point; /** A second defender in the move. */ second?: Point; ball: Point; mode: SupportMode }

/**
 * A free kick dinked over the wall: the line from the ball to the middle of the goal, and
 * the side of the wall the runner peels off (towards the far post).
 */
function chipLine(c: Ctx): { dir: Point; side: 1 | -1 } {
  const len = Math.hypot(105 - c.spot.x, 34 - c.spot.y) || 1;
  return { dir: { x: (105 - c.spot.x) / len, y: (34 - c.spot.y) / len }, side: c.spot.y < 34 ? 1 : -1 };
}

function setupFor(c: Ctx, rng: () => number): Setup {
  const y = (offset: number) => 34 + c.wing * offset;
  const at = (p: Point): Point => ({ x: p.x + FOOT, y: p.y + 0.3 });
  switch (c.base) {
    case 'cross': {
      if (c.variant === 'lowfar') {
        const creator = { x: 84, y: c.W };
        return { creator, finisher: { x: 88, y: y(-8) }, defender: { x: 87, y: y(-6) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'bicycle') {
        return { creator: { x: 74, y: c.W }, finisher: { x: 93.5, y: y(-1) }, defender: { x: 94.8, y: y(-2) }, ball: at({ x: 74, y: c.W }), mode: 'open' };
      }
      if (c.variant === 'diving') {
        const creator = { x: 83, y: c.W };
        return { creator, finisher: { x: 88, y: y(-1) }, defender: { x: 89.5, y: y(-2.5) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'backheel') {
        const creator = { x: 92, y: c.W };
        // Near the six-yard box, he comes away from goal to meet the pull-back (back to goal).
        return { creator, finisher: { x: 95.5, y: y(3.5) }, defender: { x: 95.2, y: y(0.6) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'cutback') {
        const creator = { x: 92, y: c.W };
        return { creator, finisher: { x: 82, y: y(2) }, defender: { x: 86, y: y(4) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'deep') {
        // From deep on the flank, some 40 metres out, a few metres in from the touchline.
        const creator = { x: 66, y: c.W - c.wing * 4 };
        return { creator, finisher: { x: 85.5, y: y(-1) }, defender: { x: 87, y: y(0) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'farknock') {
        // The target man waits at the far post; the finisher lurks around the penalty spot.
        const creator = { x: 82, y: c.W };
        return { creator, helper: { x: 95.5, y: y(-6) }, finisher: { x: 90.5, y: y(1.5) }, defender: { x: 92, y: y(2.5) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'firsttime') {
        // The winger and a team-mate in the half-space, a few metres apart, for the one-two.
        const creator = { x: 79, y: c.W - c.wing * 1 };
        return { creator, helper: { x: 80.5, y: y(21.5) }, finisher: { x: 85, y: y(-4) }, defender: { x: 87, y: y(-3) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'scorpion') {
        // In the six-yard box, facing goal: the cross will come in a little behind him.
        const creator = { x: 76, y: c.W };
        // (His marker goal-side of him, so he is onside as it is crossed.)
        return { creator, finisher: { x: 92.8, y: y(-0.5) }, defender: { x: 94.2, y: y(-2) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'overlap') {
        const helper = { x: 81, y: y(21) };
        return { creator: { x: 78, y: y(26) }, helper, finisher: { x: 85, y: y(-4) }, defender: { x: 87, y: y(-3) }, ball: at(helper), mode: 'open' };
      }
      const creator = { x: c.variant === 'driven' ? 83 : 74, y: c.W };
      // A volley at the far post: the finisher is already lurking there.
      if (c.variant === 'volley') return { creator, finisher: { x: 90, y: y(-3) }, defender: { x: 91, y: y(-1.5) }, ball: at(creator), mode: 'open' };
      return { creator, finisher: { x: 85, y: y(-5) }, defender: { x: 87, y: y(-4) }, ball: at(creator), mode: 'open' };
    }
    case 'through': {
      const cy = c.variant === 'lofted' ? 34 + (rng() - 0.5) * 8 : 34 + (rng() - 0.5) * 14;
      const py = 34 + (rng() - 0.5) * 10;
      // The marker starts on the side away from where the pass will come from.
      const passY = c.variant === 'channel' ? 34 + c.wing * 17 : cy;
      const away = py >= passY ? 1 : -1;
      // In a one-two the finisher starts higher: he drops off, then spins in behind.
      const creator = { x: c.variant === 'onetwo' ? 74 : 69, y: cy };
      if (c.variant === 'roundkeeper') return { creator, finisher: { x: 89, y: py }, defender: { x: 90.5, y: py + 1.5 }, ball: at(creator), mode: 'open' };
      if (c.variant === 'heelpass') {
        // Back to goal on the edge of the area, he flicks it on for the runner coming past him.
        const back = { x: 84.5, y: cy };
        return { creator: back, finisher: { x: 82, y: py }, defender: { x: 87, y: py + away * 1.5 }, ball: at(back), mode: 'open' };
      }
      if (c.variant === 'dummy') {
        // The pass runs along a line through a team-mate (who lets it go) to the finisher.
        const lineAt = (x: number) => cy + ((py - cy) * (x - 69)) / (92 - 69);
        return { creator, helper: { x: 80.5, y: lineAt(80.5) }, finisher: { x: 81.5, y: py + away * -2.6 }, defender: { x: 85.5, y: py + away * 1.5 }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'thirdman') {
        // The ball starts with a midfielder; the target, back to goal, waits on the edge of the
        // area; the third man is a few metres behind him and off to one side.
        const helper = { x: 73, y: cy };
        const target = { x: 83.5, y: cy + c.wing * 1.5 };
        return { helper, creator: target, finisher: { x: 81.5, y: py - c.wing * 4 }, defender: { x: 85.5, y: py - c.wing * 4 + away * 1.5 }, ball: at(helper), mode: 'open' };
      }
      if (c.variant === 'blindside') {
        // Out wide on the full-back's shoulder (the full-back inside him, goal-side).
        const pc = { x: 70, y: 34 + c.wing * 4 };
        return { creator: pc, finisher: { x: 82.5, y: y(15.5) }, defender: { x: 84.6, y: y(13.6) }, ball: at(pc), mode: 'open' };
      }
      if (c.variant === 'scoop') {
        // On the edge of the box with the ball; the finisher level with the last man.
        const pc = { x: 78.5, y: cy };
        return { creator: pc, finisher: { x: 84.5, y: py }, defender: { x: 86.2, y: py + away * 1.3 }, ball: at(pc), mode: 'open' };
      }
      return { creator, finisher: { x: c.variant === 'onetwo' ? 87 : 83, y: py }, defender: { x: c.variant === 'onetwo' ? 88.5 : 85, y: py + away * 1.5 }, ball: at(creator), mode: 'open' };
    }
    case 'dribble': {
      if (c.variant === 'cutinside') {
        const finisher = { x: 83, y: y(17) };
        return { finisher, defender: { x: 86.6, y: y(16.5) }, ball: at(finisher), mode: 'open' };
      }
      if (c.variant === 'hurdle') {
        const finisher = { x: 82, y: y(8) };
        return { finisher, defender: { x: 88.5, y: y(6) }, ball: at(finisher), mode: 'open' };
      }
      if (c.variant === 'solo') {
        const finisher = { x: 80, y: y(5) };
        return { finisher, defender: { x: 83.5, y: y(3.5) }, ball: at(finisher), mode: 'open' };
      }
      if (c.variant === 'slalom') {
        // He arrives here at full tilt from his own half (the long lead-in).
        const finisher = { x: 81.5, y: y(4) };
        return { finisher, defender: { x: 86.8, y: y(2.6) }, ball: at(finisher), mode: 'open' };
      }
      if (c.variant === 'roulette') {
        const finisher = { x: 81.5, y: y(5) };
        return { finisher, defender: { x: 86, y: y(4.6) }, ball: at(finisher), mode: 'open' };
      }
      if (c.variant === 'stepover') {
        const finisher = { x: 82, y: y(8) };
        return { finisher, defender: { x: 86.4, y: y(7.6) }, ball: at(finisher), mode: 'open' };
      }
      if (c.variant === 'cruyff') {
        // Wide in the box, heading for the byline; the defender goal-side, between him and the cross.
        const finisher = { x: 89.5, y: y(16) };
        return { finisher, defender: { x: 94, y: y(13.4) }, ball: at(finisher), mode: 'open' };
      }
      if (c.variant === 'rabona') {
        // Wide of the area; the defender goal-side and outside him, showing him inside.
        const finisher = { x: 84, y: y(12.5) };
        return { finisher, defender: { x: 90.5, y: y(14.6) }, ball: at(finisher), mode: 'open' };
      }
      const y0 = y(6 + rng() * 6);
      const finisher = { x: 81, y: y0 };
      return { finisher, defender: { x: c.variant === 'nutmeg' ? 85.2 : 86.5, y: y0 }, second: c.variant === 'double' ? { x: 92.4, y: y0 - c.wing * 2 } : undefined, ball: at(finisher), mode: 'open' };
    }
    case 'longrange': {
      if (c.variant === 'carryshot') {
        const finisher = { x: 64, y: y(2 + rng() * 4) };
        return { finisher, defender: { x: 81, y: finisher.y + c.wing * 1.5 }, ball: at(finisher), mode: 'open' };
      }
      if (c.variant === 'knockdown') {
        const helper = { x: 66, y: y(1) };
        return { helper, creator: { x: 84.5, y: y(1) }, finisher: { x: 79, y: y(6) }, defender: { x: 85.6, y: y(0.2) }, ball: at(helper), mode: 'open' };
      }
      if (c.variant === 'halfway') {
        // Just inside the opponents' half, the keeper caught off his line.
        const finisher = { x: 54, y: y(rng() * 6) };
        return { finisher, defender: { x: 60, y: finisher.y + c.wing * 6 }, ball: at(finisher), mode: 'open' };
      }
      if (c.variant === 'square') {
        const creator = { x: 85, y: y(-7) };
        return { creator, finisher: { x: 79, y: y(6) }, defender: { x: 84, y: y(2.5) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'chest') {
        // A lofted ball from midfield to the finisher, waiting outside the area.
        const creator = { x: 67, y: y(-5) };
        return { creator, finisher: { x: 79, y: y(3) }, defender: { x: 84.5, y: y(2) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'turn') {
        // Back to goal outside the box, the defender tight on his back.
        const creator = { x: 69, y: y(1.5) };
        return { creator, finisher: { x: 80.5, y: y(3) }, defender: { x: 82.6, y: y(3.3) }, ball: at(creator), mode: 'open' };
      }
      const fy = y(3 + rng() * 5);
      const creator = { x: 83, y: fy - c.wing * 7 };
      return { creator, finisher: { x: 76, y: fy }, defender: { x: 86, y: fy }, ball: at(creator), mode: 'open' };
    }
    case 'counter': {
      if (c.variant === 'threevtwo') {
        const creator = { x: 70, y: y(0) };
        return { creator, finisher: { x: 79, y: y(10) }, helper: { x: 79, y: y(-10) }, defender: { x: 82, y: y(2) }, second: { x: 84, y: y(-5) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'overlap') {
        const creator = { x: 76, y: y(4) };
        return { creator, finisher: { x: 79, y: y(11.5) }, defender: { x: 82.5, y: y(5) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'twoonone') {
        const creator = { x: 74, y: y(1) };
        return { creator, finisher: { x: 78, y: y(10) }, helper: { x: 76, y: y(-9) }, defender: { x: 81, y: y(1) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'breakaway' || c.variant === 'recovery') {
        const finisher = { x: 81, y: y(3) };
        return { finisher, defender: c.variant === 'recovery' ? { x: 82, y: y(6) } : { x: 77.5, y: y(5.5) }, ball: at(finisher), mode: 'open' };
      }
      if (c.variant === 'carry') {
        const creator = { x: 70, y: y(6) };
        return { creator, finisher: { x: 79, y: y(11) }, defender: { x: 75, y: y(9) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'switch') {
        // The ball on one side, the finisher alone on the far flank, the full-back coming across.
        const creator = { x: 74, y: y(-3) };
        return { creator, finisher: { x: 81, y: y(17) }, defender: { x: 85.5, y: y(13) }, ball: at(creator), mode: 'open' };
      }
      if (c.variant === 'cutback') {
        // The winger already clear down the flank, his marker chasing from behind and inside.
        const creator = { x: 90, y: y(19) };
        return { creator, finisher: { x: 80.5, y: y(3.5) }, defender: { x: 84.5, y: y(17) }, ball: at(creator), mode: 'open' };
      }
      const creator = { x: 68, y: y(6) };
      return { creator, finisher: { x: 81, y: y(14) }, defender: { x: 78, y: y(11) }, ball: at(creator), mode: 'open' };
    }
    case 'screamer': {
      if (c.variant === 'volley') {
        const creator = { x: 86, y: y(-8) };
        return { creator, finisher: { x: 73.5, y: y(2) }, defender: { x: 84, y: y(5) }, ball: at(creator), mode: 'open' };
      }
      const fy = y(rng() * 8);
      const finisher = { x: 72, y: fy };
      return { finisher, defender: { x: 80, y: fy + c.wing * 3 }, ball: at(finisher), mode: 'open' };
    }
    case 'corner': {
      const top = c.spot.y < 34;
      const flagSpot = { x: 104.6, y: top ? 0.2 : 67.8 };
      if (c.variant === 'short') {
        // The marker starts on the side he will mark him from, so their runs never cross.
        const fy = 34 + (rng() - 0.5) * 6;
        return { helper: flagSpot, creator: { x: 99.5, y: top ? 9 : 59 }, finisher: { x: 93, y: fy }, defender: { x: 94.2, y: fy + (top ? 1.6 : -1.6) }, ball: c.spot, mode: 'box' };
      }
      if (c.variant === 'edge') {
        return { creator: flagSpot, finisher: { x: 85.5, y: 34 + (top ? -4 : 4) }, defender: { x: 94, y: 35 }, ball: c.spot, mode: 'box' };
      }
      if (c.variant === 'flick') {
        return { creator: flagSpot, helper: { x: 96.5, y: top ? 30 : 38 }, finisher: { x: 94, y: top ? 36 : 32 }, defender: { x: 95, y: top ? 37 : 31 }, ball: c.spot, mode: 'box' };
      }
      if (c.variant === 'backpost') {
        return { creator: flagSpot, helper: { x: 96.8, y: top ? 39 : 29 }, finisher: { x: 94, y: top ? 33 : 35 }, defender: { x: 94.8, y: top ? 31.8 : 36.2 }, ball: c.spot, mode: 'box' };
      }
      if (c.variant === 'nearpower') {
        return { creator: flagSpot, finisher: { x: 95.5, y: top ? 30.5 : 37.5 }, defender: { x: 96.6, y: top ? 31.8 : 36.2 }, ball: c.spot, mode: 'box' };
      }
      if (c.variant === 'olimpico') {
        // The finisher takes it himself.
        return { finisher: flagSpot, defender: { x: 98, y: top ? 31.5 : 36.5 }, ball: c.spot, mode: 'box' };
      }
      if (c.variant === 'decoy') {
        // The finisher on the far side of the box, his marker on him; the screener between them and the spot.
        return { creator: flagSpot, helper: { x: 93.8, y: top ? 36.2 : 31.8 }, finisher: { x: 91.6, y: top ? 38.6 : 29.4 }, defender: { x: 92.2, y: top ? 39.6 : 28.4 }, ball: c.spot, mode: 'box' };
      }
      if (c.variant === 'late') {
        // He waits on the edge of the area, away from the crowd; a defender minds the penalty spot.
        return { creator: flagSpot, finisher: { x: 86.5, y: 34 + (top ? 2.5 : -2.5) }, defender: { x: 93, y: 34 + (top ? 4 : -4) }, ball: c.spot, mode: 'box' };
      }
      return { creator: flagSpot, finisher: { x: 93, y: 34 + (rng() - 0.5) * 8 }, defender: { x: 94, y: 35 }, ball: c.spot, mode: 'box' };
    }
    case 'freekick':
      if (c.variant === 'routine') {
        // A team-mate on the ball rolls it a few metres aside for him to run onto.
        return { helper: { x: c.spot.x - 0.6, y: c.spot.y }, finisher: { x: c.spot.x - 3.2, y: c.spot.y + c.wing * 3.4 }, ball: c.spot, mode: 'wall' };
      }
      if (c.variant === 'flank') {
        // Out wide: the creator crosses it into the box.
        const top = c.spot.y < 34;
        return { creator: { x: c.spot.x - 0.8, y: c.spot.y }, finisher: { x: 92.5, y: top ? 36 : 32 }, defender: { x: 93.6, y: top ? 34.8 : 33.2 }, ball: c.spot, mode: 'wall' };
      }
      if (c.variant === 'dummyrun') {
        // Two over the ball: the one who runs over it on one side, the one who strikes it on the other.
        return { helper: { x: c.spot.x - 2.6, y: c.spot.y + c.wing * 1.3 }, finisher: { x: c.spot.x - 2.8, y: c.spot.y - c.wing * 1.0 }, ball: c.spot, mode: 'wall' };
      }
      if (c.variant === 'chipped') {
        // The taker on the ball; the finisher level with the end of the wall, his marker goal-side.
        const { dir, side } = chipLine(c);
        const centre = { x: c.spot.x + dir.x * 9.15, y: c.spot.y + dir.y * 9.15 };
        const fin = { x: centre.x - dir.y * side * 2.8 - dir.x * 0.4, y: centre.y + dir.x * side * 2.8 - dir.y * 0.4 };
        return { creator: { x: c.spot.x - 0.8, y: c.spot.y }, finisher: fin, defender: { x: fin.x + dir.x * 1.2, y: fin.y + dir.y * 1.2 }, ball: c.spot, mode: 'wall' };
      }
      return { finisher: { x: c.spot.x - 2.5, y: c.spot.y - c.wing * 0.8 }, ball: c.spot, mode: 'wall' };
    case 'penalty':
      return { finisher: { x: c.variant === 'power' ? 89.6 : 91, y: 34 + c.wing * 0.6 }, ball: c.spot, mode: 'penalty' };
  }
}

/** Everyone's position when the play starts: the cast as set up, the rest in shape. */
function startLayout(c: Ctx, setup: Setup, start: Float32Array, rng: () => number): Float32Array {
  const out = Float32Array.from(start);
  const set = (slot: number, p: Point) => { out[slot * 3] = p.x; out[slot * 3 + 1] = p.y; out[slot * 3 + 2] = 0; };
  const cast = new Set([c.finisher, c.gk, ...(setup.second && c.second >= 0 ? [c.second] : []), ...(setup.mode === 'penalty' ? [] : [c.defender]), ...(setup.creator ? [c.creator] : []), ...(setup.helper && c.helper >= 0 ? [c.helper] : [])]);
  const isKeeper = (s: number) => roleOfSlot(c.sides, s) === 'GK';
  const atkFree = c.atkLive.filter(s => !cast.has(s));
  const defFree = c.defLive.filter(s => !cast.has(s));
  // On a counter the defenders were caught upfield; otherwise they sit in their block.
  const counter = c.base === 'counter';
  const atkShape = shapeFor('left', c.sides[sideOf(c.atkBase)].formationId, { advance: setup.mode === 'open' ? (counter ? 18 : 30) : 20, widthScale: 1.05 });
  const defShape = shapeFor('right', c.sides[sideOf(c.defBase)].formationId, { advance: counter ? 16 : -4, widthScale: counter ? 0.95 : 0.8 });
  const ballY = setup.ball.y;

  if (setup.mode === 'penalty') {
    const all = [...atkFree, ...defFree].filter(s => !isKeeper(s));
    const edge = Math.ceil(all.length * 0.6);
    all.forEach((s, i) => {
      if (i < edge) set(s, { x: 86.6 - (i % 2) * 2.2 - rng() * 0.8, y: 17 + (i * 34) / Math.max(1, edge - 1) });
      else {
        const j = i - edge;
        set(s, { x: 91 + (j >> 1) * 3.2 + rng(), y: j % 2 === 0 ? 11 - rng() : 57 + rng() });
      }
    });
    atkFree.filter(isKeeper).forEach(s => set(s, { x: 28, y: 34 }));
  } else {
    const inBox: number[] = [];
    if (setup.mode === 'box' || setup.mode === 'wall') {
      const spots = setup.mode === 'box'
        ? [{ x: 95, y: 30 }, { x: 96, y: 38 }, { x: 92, y: 34 }, { x: 98, y: 35.5 }]
        : [{ x: 93, y: 30 }, { x: 94, y: 37 }, { x: 91, y: 34 }];
      const priority = ['CB', 'ST', 'CF', 'CDM', 'CM'];
      const rank = (s: number) => { const i = priority.indexOf(roleOfSlot(c.sides, s)); return i < 0 ? priority.length : i; };
      atkFree.filter(s => !isKeeper(s)).sort((a, b) => rank(a) - rank(b)).slice(0, spots.length).forEach((s, i) => {
        set(s, { x: spots[i].x + (rng() - 0.5) * 2, y: spots[i].y + (rng() - 0.5) * 2 });
        inBox.push(s);
      });
    }
    for (const s of atkFree) if (!inBox.includes(s)) set(s, atkShape[s - c.atkBase]);
    let markers = defFree.filter(s => !isKeeper(s));
    if (setup.mode === 'wall') {
      const len = Math.hypot(105 - c.spot.x, 34 - c.spot.y);
      const dir = { x: (105 - c.spot.x) / len, y: (34 - c.spot.y) / len };
      const centre = { x: c.spot.x + dir.x * 9.15, y: c.spot.y + dir.y * 9.15 };
      // Out wide, a two-man wall; in front of goal, four.
      c.wall = markers.slice(0, c.variant === 'flank' ? 2 : 4);
      c.wall.forEach((s, i) => {
        const off = (i - (c.wall.length - 1) / 2) * 0.9;
        set(s, { x: centre.x - dir.y * off, y: centre.y + dir.x * off });
      });
      markers = markers.filter(s => !c.wall.includes(s));
    }
    inBox.forEach((attacker, i) => {
      const m = markers[i];
      if (m !== undefined) set(m, { x: out[attacker * 3] + 1, y: out[attacker * 3 + 1] + 0.6 });
    });
    const marked = new Set([...c.wall, ...markers.slice(0, inBox.length)]);
    for (const s of defFree) {
      if (marked.has(s)) continue;
      const p = defShape[s - c.defBase];
      // The block shifts towards the ball.
      set(s, { x: p.x, y: p.y + (ballY - 34) * 0.25 });
    }
  }
  if (setup.second && c.second >= 0) set(c.second, setup.second);
  if (setup.creator) set(c.creator, setup.creator);
  if (setup.helper && c.helper >= 0) set(c.helper, setup.helper);
  if (setup.finisher) set(c.finisher, setup.finisher);
  if (setup.defender) set(c.defender, setup.defender);
  else if (setup.mode !== 'penalty' && !c.wall.includes(c.defender)) set(c.defender, { x: 95, y: 34 + c.wing * 3 });
  // From the halfway line he sees the keeper well off his line, sweeping behind the defence.
  set(c.gk, c.base === 'penalty' ? { x: 104.6, y: 34 } : c.variant === 'halfway' ? { x: 92.5, y: 34 + (ballY - 34) * 0.12 } : { x: 103.6, y: 34 + (ballY - 34) * 0.2 });
  // On a counter the last two defenders are still goal-side of the finisher (no offside).
  if (c.base === 'counter') {
    const fx = out[c.finisher * 3];
    c.defLive.filter(s => !isKeeper(s) && !cast.has(s))
      .sort((a, b) => out[b * 3] - out[a * 3])
      .slice(0, 2)
      .forEach((s, i) => { if (out[s * 3] < fx + 3) out[s * 3] = Math.min(101, fx + 3 + i * 1.2); });
  }
  // Nobody on top of anyone (the wall and the cast stay as they are; a keeper off his line counts too).
  spreadOut(out, [...c.atkLive, ...c.defLive].filter(s => !isKeeper(s) || (c.variant === 'halfway' && s === c.gk)), new Set(c.wall.concat(Array.from(cast))), 1.2);
  out[BALL_SLOT * 3] = setup.ball.x;
  out[BALL_SLOT * 3 + 1] = setup.ball.y;
  out[BALL_SLOT * 3 + 2] = 0;
  return out;
}

const sideOf = (base: number): Side => (base === 0 ? 'left' : 'right');

/** Pushes apart anyone closer than minGap (pairs where both are fixed stay as they are). */
function spreadOut(layout: Float32Array, movable: number[], fixed: ReadonlySet<number>, minGap: number): void {
  for (let iteration = 0; iteration < 8; iteration++) {
    for (let i = 0; i < movable.length; i++) {
      for (let j = i + 1; j < movable.length; j++) {
        const a = movable[i], b = movable[j];
        if (fixed.has(a) && fixed.has(b)) continue;
        let dx = layout[b * 3] - layout[a * 3];
        let dy = layout[b * 3 + 1] - layout[a * 3 + 1];
        const d = Math.hypot(dx, dy);
        if (d >= minGap) continue;
        if (d < 0.01) { dx = 0; dy = 1; } else { dx /= d; dy /= d; }
        const push = minGap - d;
        const wa = fixed.has(a) ? 0 : fixed.has(b) ? 1 : 0.5;
        layout[a * 3] -= dx * push * wa; layout[a * 3 + 1] -= dy * push * wa;
        layout[b * 3] += dx * push * (1 - wa); layout[b * 3 + 1] += dy * push * (1 - wa);
      }
    }
  }
}

// ── Build-ups: from the start to the strike. Each returns the shot. ──

/** A defender who is free to join the play (not the keeper, the marker or the wall). */
function spareDefender(k: Kit, c: Ctx, near: Point): number {
  let best = -1;
  let bestD = Infinity;
  for (const s of c.defLive) {
    if (s === c.gk || s === c.defender || c.wall.includes(s) || k.scripted.has(s) || roleOfSlot(c.sides, s) === 'GK') continue;
    const p = k.at(s, k.t0);
    const d = Math.hypot(p.x - near.x, p.y - near.y);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

/**
 * The finisher's first touch of a solo run. With an assist, the run starts from the
 * creator's pass (he receives it a moment later, on the move).
 */
function takeTheBall(k: Kit, c: Ctx, at = k.t0 + 80): void {
  if (!c.assisted) { k.feet(c.finisher, at); return; }
  k.feet(c.creator, k.t0 + 40);
  k.deferFeet(c.finisher, k.t0 + 300);
}

/** The marker closes the shooter down from the side, never standing in the line of the shot. */
function closeDown(k: Kit, c: Ctx, shooter: Point, t: number): void {
  const out = shooter.y >= 34 ? 1 : -1;
  k.run(c.defender, t, shooter.x + 2.6, shooter.y + out * 2.2, { speed: SPEED.run });
}

/** The finisher and his marker attack the cross; returns where they meet it. */
function attackTheCross(k: Kit, c: Ctx, H: Point, arrive: number): Point {
  const finFrom = k.at(c.finisher, k.lastTime(c.finisher));
  const defFrom = k.at(c.defender, k.lastTime(c.defender));
  const fin = k.run(c.finisher, arrive, H.x - 0.6, H.y);
  // Marking the finisher where he really gets to: shoulder to shoulder, half a step behind,
  // so the header (always forward) goes past him. On the shoulder he is already on: going
  // round to the other one would take him through the finisher.
  const gap = defFrom.y - finFrom.y;
  const side = Math.abs(gap) > 0.3 ? Math.sign(gap) : H.y < 34 ? -1 : 1;
  const def = k.run(c.defender, arrive, fin.x - 0.9, fin.y + side * 1.1);
  k.jump(c.finisher, S_CONTACT);
  k.jump(c.defender, S_CONTACT);
  return c.kind === 'own_goal' ? def : fin;
}

function crossTarget(k: Kit, c: Ctx): Point {
  const near = k.rng() < 0.5;
  return { x: near ? 96.5 : 98.5, y: near ? (c.W < 34 ? 31.5 : 36.5) : (c.W < 34 ? 37.5 : 30.5) };
}

// Cross: from the byline, early, pulled back, after an overlap, or driven low.
function cross(k: Kit, c: Ctx): Shot {
  const own = c.kind === 'own_goal';
  const wide = c.creator;
  const y = (offset: number) => 34 + c.wing * offset;
  if (c.variant === 'cutback') {
    // To the byline, then pulled back towards the penalty spot.
    k.run(wide, 1020, 101.5, c.W - c.wing * 4, { speed: SPEED.sprint });
    k.feet(wide, Math.max(k.t0 + 80, 700));
    k.feet(wide, 1020);
    const C = { x: 91.5, y: y(3) };
    if (own) {
      // The defender slides across to cut it out and turns it into his own net.
      k.run(c.finisher, 1620, C.x - 1.8, C.y + c.wing * 0.4, { speed: SPEED.sprint });
      const d = k.run(c.defender, 1600, C.x + 0.4, C.y, { speed: SPEED.sprint });
      k.ball(1600, d.x - 0.2, d.y, 0.1);
      return { x: d.x - 0.2, y: d.y, z: 0.1, shot: 'normal' };
    }
    const fin = k.run(c.finisher, 1600, C.x - 0.6, C.y, { speed: SPEED.sprint });
    k.ball(1600, fin.x + FOOT, fin.y + 0.3);
    // The marker comes from behind, on the far side: neither across the pull-back nor in
    // front of the shot.
    k.run(c.defender, 1620, fin.x - 1.2, fin.y - c.wing * 1.4, { speed: SPEED.sprint });
    k.feet(c.finisher, 1620);
    const shooter = k.at(c.finisher, 1620);
    return { x: shooter.x + FOOT, y: shooter.y + 0.3, z: 0.2, shot: 'first_time' };
  }
  if (c.variant === 'volley') {
    // Crossed from the wing to the far post, hit on the volley before it lands.
    k.run(wide, 760, 85, c.W - c.wing * 1.2, { speed: SPEED.run });
    k.feet(wide, Math.max(k.t0 + 100, 600));
    k.feet(wide, 760);
    const F = { x: 97.5, y: c.W < 34 ? 37.5 : 30.5 };
    const fin = k.run(c.finisher, 1600, F.x - 0.7, F.y, { speed: SPEED.sprint });
    k.run(c.defender, 1600, fin.x - 0.7, fin.y + (c.W < 34 ? -1.6 : 1.6), { speed: SPEED.sprint });
    k.ball(1600, fin.x + 0.6, fin.y, 0.8, EASE_LINEAR, 4.5);
    return { x: fin.x + 0.6, y: fin.y, z: 0.8, shot: 'first_time' };
  }
  if (c.variant === 'driven') {
    // Low and hard across the six-yard box, met at the near post.
    k.run(wide, 1000, 88, c.W - c.wing * 2.5, { speed: SPEED.run });
    k.feet(wide, Math.max(k.t0 + 80, 650));
    k.feet(wide, 1000);
    const N = { x: 96.5, y: c.W < 34 ? 31.5 : 36.5 };
    const toWing = c.W < 34 ? -1 : 1;
    if (own) {
      // The defender stretches to clear and turns it in.
      k.run(c.finisher, 1600, N.x - 2, N.y - toWing * 1.4, { speed: SPEED.sprint });
      const d = k.run(c.defender, 1600, N.x + 0.6, N.y, { speed: SPEED.sprint });
      k.ball(1600, d.x - 0.3, d.y, 0.3, EASE_LINEAR, 0.3);
      return { x: d.x - 0.3, y: d.y, z: 0.3, shot: 'normal' };
    }
    const fin = k.run(c.finisher, 1600, N.x - 0.6, N.y, { speed: SPEED.sprint });
    k.run(c.defender, 1600, fin.x - 0.6, fin.y + toWing * 1.4, { speed: SPEED.sprint });
    k.ball(1600, fin.x + FOOT, fin.y, 0.3, EASE_LINEAR, 0.3);
    return { x: fin.x + FOOT, y: fin.y, z: 0.3, shot: 'first_time', aim: 'far' };
  }
  if (c.variant === 'overlap') {
    // The winger cuts inside and slips the full-back in on the overlap; he crosses first time.
    const h = c.helper;
    k.feet(h, k.t0 + 80);
    k.run(h, 720, 82, y(18), { speed: SPEED.run });
    k.feet(h, 720);
    k.run(h, 1500, 88, y(12), { speed: SPEED.run });
    const cr = k.run(wide, 980, 84, y(26.5), { speed: SPEED.sprint });
    k.ball(980, cr.x + FOOT, cr.y + 0.3);
    k.feet(wide, 980);
    k.run(wide, 1300, 86.5, y(26.5), { speed: SPEED.run });
    const H = { x: 96, y: y(2) };
    const meet = attackTheCross(k, c, H, 1600);
    // The overlap player is the one who supplies the cross; record his actual contact.
    k.ball(1600, meet.x + 0.4, meet.y, 1.9, EASE_LINEAR, 4);
    return { x: meet.x + 0.4, y: meet.y, z: 1.9, shot: 'header' };
  }
  if (c.variant === 'lowfar') {
    // Low and hard across the six-yard box, past everyone, to the far post.
    const p = k.at(wide, k.t0);
    k.feet(wide, k.t0 + 80);
    k.run(wide, 640, p.x + 1.2, c.W - c.wing * 1.2, { speed: SPEED.run });
    k.feet(wide, 640);
    const F = { x: 98.2, y: c.W < 34 ? 38.5 : 29.5 };
    const fin = k.run(c.finisher, 1600, F.x - 0.6, F.y, { speed: SPEED.sprint });
    // His marker is caught a step behind him, on the far side (never across the ball's path).
    const away = c.W < 34 ? 1 : -1;
    k.run(c.defender, 1600, fin.x - 1.3, fin.y + away * 1.2, { speed: SPEED.sprint });
    k.ball(1600, fin.x + FOOT, fin.y + 0.2);
    return { x: fin.x + FOOT, y: fin.y + 0.2, z: 0.15, shot: 'first_time', aim: 'near' };
  }
  if (c.variant === 'bicycle') {
    // Crossed a little behind him: back to goal, he goes up and over it.
    k.run(wide, 760, 85, c.W - c.wing * 1.2, { speed: SPEED.run });
    k.feet(wide, Math.max(k.t0 + 100, 600));
    k.feet(wide, 760);
    const start = k.at(c.finisher, k.t0);
    // He drifts out a step to meet it, facing the crosser (back to goal).
    const fin = k.run(c.finisher, 1600, start.x - 1.1, start.y + c.wing * 0.6, { speed: SPEED.jog });
    k.run(c.defender, 1600, fin.x + 0.5, fin.y - c.wing * 1.5, { speed: SPEED.run });
    const B = { x: fin.x + 0.2, y: fin.y, z: 1.7 };
    k.ball(1600, B.x, B.y, B.z, EASE_LINEAR, 3.5);
    k.jump(c.finisher, S_CONTACT, 1.1);
    k.jump(c.defender, S_CONTACT - 40, 0.35);
    k.pose(c.finisher, S_CONTACT - 240, 'flip', 620);
    return { x: B.x, y: B.y, z: B.z, shot: 'first_time' };
  }
  if (c.variant === 'diving') {
    // Low and hard at waist height; he throws himself at it head first.
    k.run(wide, 900, 87, c.W - c.wing * 1.5, { speed: SPEED.run });
    k.feet(wide, Math.max(k.t0 + 80, 600));
    k.feet(wide, 900);
    const D = { x: 95.5, y: y(-1.5) };
    const fin = k.run(c.finisher, 1600, D.x - 0.9, D.y, { speed: SPEED.sprint });
    // His marker is a step behind, on the far side from the cross.
    k.run(c.defender, 1600, fin.x - 1.1, fin.y - c.wing * 1.3, { speed: SPEED.sprint });
    k.ball(1600, fin.x + 0.9, fin.y, 0.55, EASE_LINEAR, 0.4);
    // Through the air and onto the grass beyond where he met it.
    k.run(c.finisher, 1850, fin.x + 1.6, fin.y, { speed: SPEED.sprint });
    k.jump(c.finisher, S_CONTACT, 0.35);
    k.pose(c.finisher, S_CONTACT - 160, 'dive', 700);
    return { x: fin.x + 0.9, y: fin.y, z: 0.55, shot: 'header' };
  }
  if (c.variant === 'backheel') {
    // Pulled back from the byline; coming away from goal, back to it, he flicks it in with his heel.
    k.run(wide, 950, 101.5, c.W - c.wing * 4, { speed: SPEED.sprint });
    k.feet(wide, Math.max(k.t0 + 80, 650));
    k.feet(wide, 950);
    const fin = k.run(c.finisher, 1600, 93.4, y(2), { speed: SPEED.run });
    k.run(c.defender, 1600, fin.x + 0.6, fin.y - c.wing * 1.6, { speed: SPEED.run });
    const B = { x: fin.x + 0.7, y: fin.y + 0.2 };
    k.ball(1600, B.x, B.y, 0.05);
    return { x: B.x, y: B.y, z: 0.15, shot: 'first_time' };
  }
  if (c.variant === 'scorpion') {
    // Crossed in behind him at waist height: he throws himself forward and, falling, flicks
    // it over his own back with his heels (o escorpião).
    k.run(wide, 760, 84, c.W - c.wing * 1.2, { speed: SPEED.run });
    k.feet(wide, Math.max(k.t0 + 100, 600));
    k.feet(wide, 760);
    const start = k.at(c.finisher, k.t0);
    // Drifting towards goal as it is crossed: the ball arrives a stride behind him.
    const fin = k.run(c.finisher, 1600, start.x + 0.8, start.y, { speed: SPEED.jog });
    // His marker, beside him, can only watch it go over.
    k.run(c.defender, 1600, fin.x - 0.3, fin.y - c.wing * 1.7, { speed: SPEED.jog });
    const B = { x: fin.x - 0.7, y: fin.y, z: 1.0 };
    k.ball(1600, B.x, B.y, B.z, EASE_LINEAR, 2.8);
    // Head first towards goal, heels up over his back, then down on the grass.
    k.run(c.finisher, 1900, fin.x + 1.4, fin.y, { speed: SPEED.sprint });
    k.jump(c.finisher, S_CONTACT, 0.45);
    k.pose(c.finisher, S_CONTACT - 180, 'dive', 680);
    return { x: B.x, y: B.y, z: B.z, shot: 'first_time' };
  }
  if (c.variant === 'deep') {
    // From deep on the flank, without breaking stride, a long curling ball over everyone to
    // the far side of the six-yard box (the Beckham cross).
    const p = k.at(wide, k.t0);
    k.feet(wide, k.t0 + 80);
    k.run(wide, 620, p.x + 2.4, p.y, { speed: SPEED.run });
    k.feet(wide, 620);
    const H = { x: 96, y: y(-2.5) };
    const meet = attackTheCross(k, c, H, 1600);
    const from = k.at(BALL_SLOT, 620);
    // It bends away from the keeper, out and then in, dropping on the finisher's head.
    const mid = { x: (from.x + meet.x) / 2 - 1.5, y: (from.y + meet.y) / 2 + c.wing * 1.8 };
    const d1 = Math.hypot(mid.x - from.x, mid.y - from.y), d2 = Math.hypot(meet.x + 0.4 - mid.x, meet.y - mid.y);
    k.ball(Math.round(620 + (980 * d1) / (d1 + d2)), mid.x, mid.y, 5.2);
    k.ball(1600, meet.x + 0.4, meet.y, 1.9, EASE_LINEAR, 1.2);
    return { x: meet.x + 0.4, y: meet.y, z: 1.9, shot: 'header' };
  }
  if (c.variant === 'farknock') {
    // Crossed long to the far post, where the target man rises and heads it back across the
    // six-yard box; the finisher, arriving, hits it first time.
    k.run(wide, 560, 84.5, c.W - c.wing * 1.2, { speed: SPEED.run });
    k.feet(wide, Math.max(k.t0 + 40, 480));
    k.feet(wide, 560);
    const F = { x: 97.6, y: y(-5.5) };
    const h = k.run(c.helper, 1400, F.x - 0.5, F.y, { speed: SPEED.sprint });
    k.jump(c.helper, 1400);
    k.ball(1400, h.x + 0.3, h.y, 2.2, EASE_LINEAR, 4.2);
    k.touch(c.helper, 1400);
    // The far-post defender goes up with him, a fraction late.
    const tall = spareDefender(k, c, F);
    if (tall >= 0) {
      k.run(tall, 1400, h.x - 0.8, h.y - c.wing * 0.9, { speed: SPEED.run });
      k.jump(tall, 1400, 0.55);
    }
    const M = { x: 95, y: y(0.5) };
    const fin = k.run(c.finisher, 1600, M.x - 0.7, M.y, { speed: SPEED.sprint });
    // His marker is a step behind him, on the side the cross came from.
    k.run(c.defender, 1600, fin.x - 1.2, fin.y + c.wing * 1.3, { speed: SPEED.sprint });
    k.ball(1600, fin.x + 0.6, fin.y, 0.5, EASE_LINEAR, 0.7);
    return { x: fin.x + 0.6, y: fin.y, z: 0.5, shot: 'first_time' };
  }
  if (c.variant === 'firsttime') {
    // A one-two on the wing: inside to the team-mate in the half-space, straight back into
    // his stride, and crossed first time, before the full-back can get to him.
    const h = c.helper;
    const p = k.at(wide, k.t0);
    k.feet(wide, k.t0 + 40);
    k.run(wide, 520, p.x + 1.2, p.y, { speed: SPEED.run });
    k.feet(wide, 520);
    const hp = k.at(h, k.t0);
    const hh = k.run(h, 720, hp.x + 0.8, hp.y, { speed: SPEED.jog });
    k.ball(720, hh.x + FOOT, hh.y + 0.3);
    k.touch(h, 720);
    const cr = k.run(wide, 940, 84.5, c.W - c.wing * 1.5, { speed: SPEED.sprint });
    k.ball(940, cr.x + FOOT, cr.y + 0.3);
    k.touch(wide, 940);
    k.run(wide, 1500, cr.x + 3, cr.y, { speed: SPEED.run });
    k.run(h, 1600, hh.x + 5.5, hh.y + (34 - hh.y) * 0.25, { speed: SPEED.run });
    const H = crossTarget(k, c);
    const meet = attackTheCross(k, c, H, 1600);
    k.ball(1600, meet.x + 0.4, meet.y, 1.9, EASE_LINEAR, 3.2);
    return { x: meet.x + 0.4, y: meet.y, z: 1.9, shot: own ? 'normal' : 'header' };
  }
  const H = c.variant === 'trivela' ? { x: 97.8, y: c.W < 34 ? 37 : 31 } : crossTarget(k, c);
  if (c.variant === 'trivela') {
    // Whipped in with the outside of the foot from deep and wide: it bends in towards the far post.
    k.run(wide, 760, 80, c.W - c.wing * 1.5, { speed: SPEED.run });
    k.feet(wide, Math.max(k.t0 + 100, 600));
    k.feet(wide, 760);
    const meet = attackTheCross(k, c, H, 1600);
    const from = k.at(BALL_SLOT, 760);
    // Bending: half way it is out towards the penalty spot, then curls in (the bend point
    // timed by distance, so both halves fly at the same pace).
    const mid = { x: (from.x + meet.x) / 2 - 2.6, y: (from.y + meet.y) / 2 };
    const d1 = Math.hypot(mid.x - from.x, mid.y - from.y), d2 = Math.hypot(meet.x + 0.4 - mid.x, meet.y - mid.y);
    k.ball(Math.round(760 + (840 * d1) / (d1 + d2)), mid.x, mid.y, 3.4);
    k.ball(1600, meet.x + 0.4, meet.y, 1.9, EASE_LINEAR, 0.8);
    return { x: meet.x + 0.4, y: meet.y, z: 1.9, shot: 'header' };
  }
  if (c.variant === 'early') {
    // Whipped in early from the touchline, before the full-back can close.
    k.feet(wide, Math.max(k.t0 + 80, 560));
    k.run(c.defender, 900, 90, H.y + (H.y < 34 ? -3 : 3), { speed: SPEED.run });
    const meet = attackTheCross(k, c, H, 1600);
    k.ball(1600, meet.x + 0.4, meet.y, 1.9, EASE_LINEAR, 5.5);
    return { x: meet.x + 0.4, y: meet.y, z: 1.9, shot: own ? 'normal' : 'header' };
  }
  k.run(wide, 760, 85, c.W - c.wing * 1.2, { speed: SPEED.run });
  k.feet(wide, Math.max(k.t0 + 100, 600));
  k.feet(wide, 760);
  const meet = attackTheCross(k, c, H, 1600);
  k.ball(1600, meet.x + 0.4, meet.y, 1.9, EASE_LINEAR, 4);
  return { x: meet.x + 0.4, y: meet.y, z: 1.9, shot: own ? 'normal' : 'header' };
}

// Through ball: straight, a one-two, from the channel, lofted, or split between two centre-backs.
function through(k: Kit, c: Ctx): Shot {
  // He receives in line with where he starts (a little either way): the marker's side was
  // chosen from that same line.
  const P = { x: 92, y: k.at(c.finisher, k.t0).y + (k.rng() - 0.5) * 3 };
  // Behind the full-back: in from the flank, towards the near side of the goal.
  if (c.variant === 'blindside') { P.x = 90.5; P.y = 34 + c.wing * 9; }
  if (c.variant === 'scoop') {
    // On the edge of the area he dinks it over the defence; the finisher, holding the line
    // until it is struck, runs on to it and volleys before it lands.
    const cr = k.at(c.creator, k.t0);
    k.feet(c.creator, k.t0 + 80);
    k.run(c.creator, 900, cr.x + 2.2, cr.y, { speed: SPEED.run });
    k.feet(c.creator, 900);
    const f0 = k.at(c.finisher, k.t0);
    const V = { x: 92, y: f0.y + (34 - f0.y) * 0.2 };
    k.run(c.finisher, 900, f0.x + 0.6, f0.y, { speed: SPEED.jog });
    const fin = k.run(c.finisher, 1620, V.x - 0.7, V.y, { speed: SPEED.sprint });
    k.ball(1620, fin.x + 0.6, fin.y, 0.7, EASE_LINEAR, 3.4);
    // The defender watches it go over his head and turns, a stride behind.
    const d0 = k.at(c.defender, k.t0);
    k.run(c.defender, 1080, d0.x + 0.3, d0.y, { speed: SPEED.jog });
    k.jump(c.defender, 1080, 0.3);
    const side = d0.y >= fin.y ? 1 : -1;
    k.run(c.defender, 1620, fin.x - 1.5, fin.y + side * 1.4, { speed: SPEED.sprint });
    return { x: fin.x + 0.6, y: fin.y, z: 0.7, shot: 'first_time' };
  }
  if (c.variant === 'roundkeeper') {
    // Through on goal, the keeper rushes out and is taken round.
    const R = { x: 92.5, y: P.y };
    const side = P.y >= 34 ? -1 : 1;
    k.feet(c.creator, Math.max(k.t0 + 60, 520));
    k.feet(c.creator, 600);
    const fin = k.run(c.finisher, 1150, R.x - 0.6, R.y, { speed: SPEED.sprint });
    k.ball(1150, fin.x + FOOT, fin.y + 0.3);
    k.run(c.gk, 1450, 96.8, R.y + 0.3, { speed: SPEED.sprint });
    k.run(c.gk, 1560, 96.6, R.y + 0.4, { speed: SPEED.jog, z: 0.3 }); // goes down at his feet
    k.run(c.finisher, 1450, 95.2, R.y + side * 1.4, { speed: SPEED.sprint });
    k.feet(c.finisher, 1450);
    const sh = k.run(c.finisher, 1620, 96.6, R.y + side * 2.6, { speed: SPEED.sprint });
    k.feet(c.finisher, 1620);
    const far = R.y >= k.at(c.creator, 600).y ? 1 : -1;
    k.run(c.defender, 1300, R.x - 3, R.y + far * 2, { speed: SPEED.run });
    k.run(c.defender, 1620, R.x - 1, R.y + far * 2.6, { speed: SPEED.run });
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.1, shot: 'one_on_one', keeperAt: k.at(c.gk, 1560) };
  }
  if (c.variant === 'onetwo') {
    // One-two: the finisher lays it back and spins in behind.
    const start = k.at(c.finisher, k.t0);
    const drop = k.run(c.finisher, 840, start.x - 2.5, start.y, { speed: SPEED.run });
    k.feet(c.creator, Math.max(k.t0 + 60, 500));
    k.ball(840, drop.x - FOOT, drop.y + 0.3);
    k.touch(c.finisher, 840); // laid back first time: his touch, too
    const from = k.at(c.creator, k.t0);
    const up = k.run(c.creator, 1080, from.x + 6, from.y + (34 - from.y) * 0.2, { speed: SPEED.run });
    k.ball(1080, up.x + FOOT, up.y + 0.3);
    const fin = k.run(c.finisher, 1440, P.x - 0.6, P.y);
    k.ball(1440, fin.x + FOOT, fin.y + 0.3);
  } else if (c.variant === 'heelpass') {
    // Back to goal, he holds his marker off, then flicks it on with his heel into the runner's path.
    const cr = k.at(c.creator, k.t0);
    k.feet(c.creator, k.t0 + 80);
    k.run(c.creator, 760, cr.x - 1.1, cr.y, { speed: SPEED.jog }); // backing in, facing his own goal
    k.feet(c.creator, 760);
    const fin = k.run(c.finisher, 1250, P.x - 1.5 - 0.6, P.y);
    k.ball(1250, fin.x + FOOT, fin.y + 0.3);
  } else if (c.variant === 'dummy') {
    // The pass runs through a team-mate, who steps over it (a dummy), to the finisher behind.
    k.feet(c.creator, Math.max(k.t0 + 100, 650));
    k.feet(c.creator, 760);
    const fin = k.run(c.finisher, 1300, 89 - 0.6, P.y);
    k.ball(1300, fin.x + FOOT, fin.y + 0.3);
    const h = k.at(c.helper, k.t0);
    const from = k.at(BALL_SLOT, 760);
    const to = { x: fin.x + FOOT, y: fin.y + 0.3 };
    const u = Math.max(0.1, Math.min(0.9, (h.x - from.x) / Math.max(1, to.x - from.x)));
    const over = Math.round(760 + u * (1300 - 760));
    // On the ball's line as it comes (a small shuffle), legs apart, a little hop over it.
    k.run(c.helper, over - 120, h.x, from.y + (to.y - from.y) * u + 0.35, { speed: SPEED.jog });
    k.jump(c.helper, over, 0.2);
    k.run(c.helper, 1700, h.x + 4, h.y + (34 - h.y) * 0.2, { speed: SPEED.run });
  } else if (c.variant === 'thirdman') {
    // The third man: in to the target, back to goal on the edge of the area, who lays it first
    // time round the corner for the runner who set off as the first pass was played.
    const hp = k.at(c.helper, k.t0);
    k.feet(c.helper, k.t0 + 60);
    k.run(c.helper, 600, hp.x + 1, hp.y, { speed: SPEED.jog });
    k.feet(c.helper, 600);
    const tp = k.at(c.creator, k.t0);
    // He comes short to meet it, facing his own goal, his marker on his back.
    const lay = k.run(c.creator, 980, tp.x - 1.2, tp.y, { speed: SPEED.jog });
    k.ball(980, lay.x - 0.6, lay.y + 0.3);
    k.touch(c.creator, 980);
    const back = spareDefender(k, c, tp);
    if (back >= 0) k.run(back, 980, lay.x + 1.2, lay.y + 0.4, { speed: SPEED.run });
    const fin = k.run(c.finisher, 1350, P.x - 0.6, P.y);
    k.ball(1350, fin.x + FOOT, fin.y + 0.3);
    k.run(c.helper, 1700, hp.x + 7, hp.y, { speed: SPEED.run });
    k.run(c.creator, 1650, lay.x + 2.5, lay.y + (34 - lay.y) * 0.3, { speed: SPEED.jog });
  } else if (c.variant === 'blindside') {
    // Out wide, he checks a step towards the ball to drag the full-back with him, then darts
    // in behind him on his blind side; the pass is slid into his path.
    k.feet(c.creator, Math.max(k.t0 + 100, 700));
    k.feet(c.creator, 820);
    const fs = k.at(c.finisher, k.t0);
    k.run(c.finisher, 820, fs.x + 0.8, fs.y + c.wing * 0.3, { speed: SPEED.jog });
    // Round the outside of him first, then in.
    k.run(c.finisher, 1080, fs.x + 2.8, fs.y - c.wing * 0.1, { speed: SPEED.sprint });
    const fin = k.run(c.finisher, 1350, P.x - 0.6, P.y);
    k.ball(1350, fin.x + FOOT, fin.y + 0.3);
    // The full-back, watching the ball, turns too late.
    const d0 = k.at(c.defender, k.t0);
    k.run(c.defender, 1000, d0.x + 0.4, d0.y + c.wing * 0.6, { speed: SPEED.jog }); // follows him outside
  } else {
    if (c.variant === 'channel') k.run(c.creator, 700, 72, 34 + c.wing * 17, { speed: SPEED.run }); // into the channel
    if (c.variant === 'split') {
      // The two centre-backs hold a line with a gap between them, either side of the pass's
      // path (it comes from the creator, so the gap is where that line crosses theirs).
      const second = spareDefender(k, c, { x: 86, y: P.y });
      const from = k.at(c.creator, 800);
      const lineY = from.y + ((P.y - from.y) * (86 - from.x)) / Math.max(1, P.x - from.x);
      const away = P.y >= from.y ? 1 : -1;
      k.run(c.defender, 900, 86, lineY + away * 2.4, { speed: SPEED.run });
      if (second >= 0) {
        k.run(second, 900, 86, lineY - away * 2.4, { speed: SPEED.run });
        k.run(second, 1500, P.x - 4, P.y - away * 2.2, { speed: SPEED.run });
        k.run(second, 1620, P.x - 2.5, P.y - away * 2.6, { speed: SPEED.run });
      }
    }
    k.feet(c.creator, Math.max(k.t0 + 100, 700));
    k.feet(c.creator, 800);
    const fin = k.run(c.finisher, 1350, P.x - 0.6, P.y);
    // Lofted over the back line, or played along the ground.
    if (c.variant === 'lofted') k.ball(1350, fin.x + FOOT, fin.y + 0.3, 0.3, EASE_LINEAR, 5);
    else k.ball(1350, fin.x + FOOT, fin.y + 0.3);
  }
  // The marker is on the far side from where the pass comes, so it never runs through him.
  const passFrom = k.at(c.creator, 800).y;
  const farSide = P.y >= passFrom ? 1 : -1;
  if (c.variant === 'blindside') {
    // The full-back chases him in from the flank, behind and outside him (never across the pass).
    const f = k.at(c.finisher, 1350);
    k.run(c.defender, 1350, f.x - 2.8, f.y + farSide * 2.4, { speed: SPEED.run });
  } else k.run(c.defender, 1350, P.x - 3, P.y + farSide * 1.8, { speed: SPEED.run });
  const S = { x: 96, y: 34 + (P.y - 34) * 0.5 };
  const shooter = k.run(c.finisher, 1620, S.x - FOOT, S.y, { speed: SPEED.run });
  k.feet(c.finisher, 1500);
  k.feet(c.finisher, 1620);
  if (c.variant === 'blindside') {
    // Chasing him in from the flank: right behind him, along his run (never across it).
    const len = Math.hypot(shooter.x - P.x, shooter.y - P.y) || 1;
    const dx = (shooter.x - P.x) / len, dy = (shooter.y - P.y) / len;
    // A step behind him and to the flank side of his run, then pulling up as he shoots.
    const n = farSide === 1 ? { x: -dy, y: dx } : { x: dy, y: -dx };
    const end = { x: shooter.x - dx * 2.4 + n.x * 1.4, y: shooter.y - dy * 2.4 + n.y * 1.4 };
    k.run(c.defender, 1620, end.x, end.y, { speed: SPEED.run });
    k.run(c.defender, 1950, end.x + dx * 0.6, end.y + dy * 0.6, { speed: SPEED.jog, ease: EASE_OUT });
  } else k.run(c.defender, 1620, shooter.x - 2.5, shooter.y + farSide * 1.4, { speed: SPEED.run });
  // A dink over the keeper rushing out (it comes down on the woodwork).
  if (c.variant === 'chip') return { x: shooter.x + FOOT, y: shooter.y + 0.3, z: 0.2, shot: 'one_on_one', arc: 3.4, keeperAt: { x: 100.6, y: 34 + (shooter.y - 34) * 0.5 } };
  return { x: shooter.x + FOOT, y: shooter.y + 0.3, z: 0.2, shot: 'one_on_one', keeperAt: { x: 102.2, y: 34 + (shooter.y - 34) * 0.4 } };
}

// Dribble: past one defender, past two, cutting inside onto the strong foot, or a solo burst.
function dribble(k: Kit, c: Ctx): Shot {
  const y = (offset: number) => 34 + c.wing * offset;
  if (c.variant === 'cutinside') {
    // Shapes to go outside, cuts back in and curls it towards the far post.
    takeTheBall(k, c);
    k.run(c.finisher, 900, 86.5, y(17.8), { speed: SPEED.sprint });
    k.feet(c.finisher, 900);
    k.run(c.defender, 900, 87.3, y(17.6), { speed: SPEED.run });
    k.lunge(c.defender, 1200, { x: 88, y: y(18.4) }); // sold the wrong way
    k.run(c.defender, 1620, 89.2, y(17.4), { speed: SPEED.jog });
    k.run(c.finisher, 1300, 89, y(15.2), { speed: SPEED.sprint });
    k.feet(c.finisher, 1100);
    k.feet(c.finisher, 1300);
    const sh = k.run(c.finisher, 1620, 91, y(13), { speed: SPEED.sprint });
    k.feet(c.finisher, 1460);
    k.feet(c.finisher, 1620);
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'normal', aim: 'far', curve: -c.wing * 1.4, curveZ: 0.9 };
  }
  if (c.variant === 'elastico') {
    // Shows him the outside, snaps it back inside: the defender bites the wrong way.
    const start = k.at(c.finisher, k.t0);
    takeTheBall(k, c, k.t0 + 100);
    k.run(c.finisher, 950, 84.4, start.y + c.wing * 0.8, { speed: SPEED.run });
    k.feet(c.finisher, 700);
    k.feet(c.finisher, 950);
    // Out a step with the outside of the foot, then straight back across him.
    const out = k.at(c.finisher, 950);
    k.ball(1030, out.x + 0.9, out.y + c.wing * 0.7);
    k.lunge(c.defender, 1060, { x: out.x + 1.5, y: out.y + c.wing * 1.0 });
    k.run(c.finisher, 1300, 87.6, start.y - c.wing * 2.0, { speed: SPEED.sprint });
    k.feet(c.finisher, 1130);
    k.feet(c.finisher, 1300);
    const sh = k.run(c.finisher, 1620, 90.6, start.y - c.wing * 2.8, { speed: SPEED.sprint });
    k.feet(c.finisher, 1460);
    k.feet(c.finisher, 1620);
    k.run(c.defender, 1620, 87.2, start.y + c.wing * 0.6, { speed: SPEED.run }); // turns, beaten
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'normal' };
  }
  if (c.variant === 'chapeu') {
    // Flicks it over the defender's head, runs round him and volleys it as it drops.
    const start = k.at(c.finisher, k.t0);
    takeTheBall(k, c, k.t0 + 100);
    k.run(c.finisher, 950, 84.2, start.y, { speed: SPEED.run });
    k.feet(c.finisher, 750);
    k.feet(c.finisher, 950);
    const V = { x: 89.4, y: start.y - c.wing * 0.6 };
    k.ball(1620, V.x, V.y, 0.75, EASE_LINEAR, 2.6);
    k.run(c.finisher, 1320, 87, start.y + c.wing * 1.5, { speed: SPEED.sprint }); // round him, outside
    k.run(c.finisher, 1620, V.x - FOOT, V.y - 0.3, { speed: SPEED.sprint });
    // The defender watches it go over his head, then turns to chase.
    const d = k.at(c.defender, k.t0);
    k.run(c.defender, 1100, d.x - 0.2, d.y, { speed: SPEED.jog });
    k.jump(c.defender, 1100, 0.35);
    k.run(c.defender, 1620, d.x + 0.4, d.y - c.wing * 1.5, { speed: SPEED.run });
    return { x: V.x, y: V.y, z: 0.75, shot: 'first_time' };
  }
  if (c.variant === 'slalom') {
    // Arriving at full tilt from his own half: shapes outside, the defender lunges, and he
    // cuts inside past him.
    const start = k.at(c.finisher, k.t0);
    k.feet(c.finisher, k.t0 + 60);
    k.run(c.finisher, 820, 84.3, 34 + c.wing * 5, { speed: SPEED.sprint });
    k.feet(c.finisher, 820);
    k.lunge(c.defender, 960, { x: 84.9, y: 34 + c.wing * 5 });
    k.run(c.finisher, 1220, 87.3, 34 + c.wing * 2.8, { speed: SPEED.sprint });
    k.feet(c.finisher, 1040);
    k.feet(c.finisher, 1220);
    const sh = k.run(c.finisher, 1620, 90, 34 + c.wing * 2, { speed: SPEED.sprint });
    k.feet(c.finisher, 1420);
    k.feet(c.finisher, 1620);
    void start;
    k.run(c.defender, 1620, 87.6, 34 + c.wing * 4.6, { speed: SPEED.run }); // back on his feet, chasing
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'one_on_one', keeperAt: { x: 101.5, y: 34 + (sh.y - 34) * 0.4 } };
  }
  if (c.variant === 'solo') {
    // Knocks it past his man and bursts clear, one on one.
    takeTheBall(k, c);
    k.run(c.finisher, 900, 84, y(6.5), { speed: SPEED.sprint });
    k.feet(c.finisher, 900);
    k.lunge(c.defender, 900, { x: 84.6, y: y(5.6) }); // at the ball as it is knocked past him
    k.run(c.defender, 1620, 88.4, y(6.4), { speed: SPEED.sprint });
    const sh = k.run(c.finisher, 1620, 92.5, y(3.2), { speed: SPEED.sprint });
    k.feet(c.finisher, 1250);
    k.feet(c.finisher, 1620);
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'one_on_one', keeperAt: { x: 102, y: 34 + (sh.y - 34) * 0.4 } };
  }
  if (c.variant === 'nutmeg') {
    // Slipped through the defender's legs; the attacker goes round him and picks it up.
    const start = k.at(c.finisher, k.t0);
    takeTheBall(k, c);
    k.run(c.finisher, 850, 83.8, start.y, { speed: SPEED.run });
    k.feet(c.finisher, 850);
    k.ball(1050, 86.8, start.y + 0.1);
    k.run(c.finisher, 1000, 85.2, start.y - c.wing * 1.4, { speed: SPEED.sprint });
    k.run(c.defender, 900, 85.2, start.y, { speed: SPEED.jog });
    k.run(c.defender, 1150, 85, start.y + c.wing * 0.4, { speed: SPEED.jog }); // turns too late
    k.run(c.finisher, 1150, 87.2, start.y - c.wing * 0.2, { speed: SPEED.sprint });
    k.feet(c.finisher, 1150);
    k.run(c.defender, 1620, 87.5, start.y + c.wing * 1.6, { speed: SPEED.run });
    const sh = k.run(c.finisher, 1620, 91.5, 34 + c.wing * 4, { speed: SPEED.sprint });
    k.feet(c.finisher, 1450);
    k.feet(c.finisher, 1620);
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'normal' };
  }
  if (c.variant === 'hurdle') {
    // The defender slides in; the attacker pokes it past him, hops over and carries on.
    const start = k.at(c.finisher, k.t0);
    takeTheBall(k, c);
    const a = k.run(c.finisher, 1000, 86, start.y - c.wing * 1.2, { speed: SPEED.run });
    k.feet(c.finisher, 900);
    k.ball(1000, a.x + 1.8, a.y + 0.3);
    k.run(c.finisher, 1250, 89, start.y - c.wing * 0.8, { speed: SPEED.run });
    k.feet(c.finisher, 1250);
    // After his run is set, so the hop over the slide follows it.
    const up = k.slideTackle(c.defender, 1000, { x: a.x + 0.4, y: a.y - c.wing * 0.8 }, c.finisher);
    k.run(c.defender, Math.max(1900, up + 450), 89.5, start.y + c.wing * 1.5, { speed: SPEED.jog }); // back up, too late
    const shooter = k.run(c.finisher, 1620, 92.5, 34 + c.wing * 4, { speed: SPEED.run });
    k.feet(c.finisher, 1450);
    k.feet(c.finisher, 1620);
    return { x: shooter.x + FOOT, y: shooter.y + 0.3, z: 0.2, shot: 'normal' };
  }
  if (c.variant === 'roulette') {
    // He runs at him, stops on the ball and spins over it (the roulette, Zidane's turn): the
    // defender's lunge meets only air and he comes out on the other side.
    const start = k.at(c.finisher, k.t0);
    takeTheBall(k, c, k.t0 + 100);
    const a = k.run(c.finisher, 900, 84.3, start.y, { speed: SPEED.run });
    k.feet(c.finisher, 700);
    k.feet(c.finisher, 900);
    // The spin: round in a tight arc towards the middle, his back to the defender halfway round.
    const s = -c.wing;
    k.run(c.finisher, 1010, a.x + 0.35, a.y + s * 0.75, { speed: SPEED.run });
    k.feet(c.finisher, 1010);
    k.run(c.finisher, 1120, a.x + 1.05, a.y + s * 1.25, { speed: SPEED.run });
    k.feet(c.finisher, 1120);
    k.lunge(c.defender, 1040, { x: a.x + 1.3, y: a.y + c.wing * 0.15 }); // into where the ball was
    k.run(c.finisher, 1330, 88.6, a.y + s * 1.6, { speed: SPEED.sprint });
    k.feet(c.finisher, 1330);
    const sh = k.run(c.finisher, 1620, 91.3, 34 + c.wing * 2.4, { speed: SPEED.sprint });
    k.feet(c.finisher, 1480);
    k.feet(c.finisher, 1620);
    k.run(c.defender, 1620, 87.8, a.y + c.wing * 0.9, { speed: SPEED.jog }); // turns, beaten
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'normal' };
  }
  if (c.variant === 'stepover') {
    // He slows in front of him and rolls his feet over the ball (pedaladas): three times, the
    // defender swaying with each; then he explodes past him on the outside.
    const start = k.at(c.finisher, k.t0);
    takeTheBall(k, c, k.t0 + 60);
    const a = k.run(c.finisher, 700, 84, start.y, { speed: SPEED.run });
    k.feet(c.finisher, 700);
    // The ball stays put while his feet go round it, a half-step each way.
    const ball = { x: a.x + FOOT, y: a.y + 0.3 };
    const d0 = k.at(c.defender, k.t0);
    for (let i = 0; i < 3; i++) {
      const t = 780 + i * 100;
      const lean = i % 2 === 0 ? 1 : -1;
      k.run(c.finisher, t, a.x + 0.08 * (i + 1), a.y + lean * 0.4, { speed: SPEED.run });
      k.run(c.defender, t + 60, d0.x - 0.4 - 0.1 * i, d0.y + lean * 0.3, { speed: SPEED.run });
    }
    k.ball(780, ball.x, ball.y);
    k.ball(980, ball.x + 0.05, ball.y);
    k.touch(c.finisher, 980);
    // The burst: past him on the outside, then in towards goal.
    const out = c.wing;
    k.run(c.finisher, 1180, a.x + 1.5, a.y + out * 1.5, { speed: SPEED.sprint });
    k.feet(c.finisher, 1180);
    k.run(c.finisher, 1400, a.x + 3.5, a.y + out * 1.1, { speed: SPEED.sprint });
    k.feet(c.finisher, 1400);
    const sh = k.run(c.finisher, 1620, a.x + 5.4, a.y - out * 0.2, { speed: SPEED.sprint });
    k.feet(c.finisher, 1620);
    k.run(c.defender, 1400, d0.x - 0.3, d0.y + out * 0.9, { speed: SPEED.jog }); // turns, too late
    k.run(c.defender, 1620, sh.x - 2.2, sh.y + out * 1.9, { speed: SPEED.run });
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'normal' };
  }
  if (c.variant === 'cruyff') {
    // Heading for the byline he shapes to cross; the defender slides in to block it, and he
    // drags the ball back behind his standing leg (the Cruyff turn) and turns inside.
    const y = (offset: number) => 34 + c.wing * offset;
    takeTheBall(k, c);
    const a = k.run(c.finisher, 1000, 94.4, y(16.4), { speed: SPEED.sprint });
    k.feet(c.finisher, 760);
    k.feet(c.finisher, 1000);
    k.run(c.defender, 1000, 96.6, y(15), { speed: SPEED.run });
    // Behind his standing leg and away: the ball goes back the way he came, then inside.
    k.ball(1130, a.x - 0.5, a.y - c.wing * 0.3);
    k.run(c.finisher, 1180, a.x - 0.5, a.y - c.wing * 0.7, { speed: SPEED.run });
    k.feet(c.finisher, 1180);
    const up = k.slideTackle(c.defender, 1150, { x: a.x + 1.4, y: a.y + c.wing * 0.4 });
    k.run(c.finisher, 1400, 93.6, y(13), { speed: SPEED.sprint });
    k.feet(c.finisher, 1400);
    const sh = k.run(c.finisher, 1620, 95, y(10.6), { speed: SPEED.sprint });
    k.feet(c.finisher, 1620);
    k.run(c.defender, Math.max(2200, up + 500), a.x + 1.6, y(14.8), { speed: SPEED.jog }); // up, too late
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'normal', aim: 'near' };
  }
  if (c.variant === 'rabona') {
    // Shown inside, onto his weaker foot, he wraps his good one round the back of his standing
    // leg (a rabona) and bends it towards the far post.
    const y = (offset: number) => 34 + c.wing * offset;
    takeTheBall(k, c, k.t0 + 100);
    k.run(c.finisher, 900, 87.2, y(13), { speed: SPEED.run });
    k.feet(c.finisher, 700);
    k.feet(c.finisher, 900);
    k.run(c.defender, 900, 92, y(14.2), { speed: SPEED.run }); // shows him inside
    k.run(c.finisher, 1250, 89.4, y(12.8), { speed: SPEED.run });
    k.feet(c.finisher, 1080);
    k.feet(c.finisher, 1250);
    // He steps in to block the near post... the ball goes round the back of the standing leg.
    k.lunge(c.defender, 1420, { x: 92.6, y: y(13.9) });
    const sh = k.run(c.finisher, 1620, 90.8, y(12.6), { speed: SPEED.jog });
    k.feet(c.finisher, 1450);
    k.feet(c.finisher, 1620);
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'normal', aim: 'far', curve: -c.wing * 1.3, curveZ: 1.1 };
  }
  const start = k.at(c.finisher, k.t0);
  takeTheBall(k, c, k.t0 + 100);
  k.run(c.finisher, 900, 85, start.y - c.wing * 2.5, { speed: SPEED.sprint });
  k.feet(c.finisher, 900);
  k.run(c.finisher, 1300, 88.6, start.y + c.wing, { speed: SPEED.sprint });
  k.feet(c.finisher, 1100);
  k.feet(c.finisher, 1300);
  k.run(c.defender, 900, 87, start.y - c.wing * 2, { speed: SPEED.run });
  k.lunge(c.defender, 1150, { x: 87.8, y: start.y - c.wing }); // goes for it the way he shaped
  k.run(c.defender, 1620, 88.2, start.y - c.wing * 3, { speed: SPEED.jog });
  if (c.variant === 'double') {
    // A second defender steps across and is beaten too.
    const second = c.second;
    if (second >= 0) {
      k.run(second, 1250, 92.3, start.y + c.wing * 0.5, { speed: SPEED.run });
      k.lunge(second, 1420, { x: 92.6, y: start.y + c.wing * 1.8 });
      k.run(second, 1700, 91.6, start.y + c.wing * 3, { speed: SPEED.jog });
    }
  }
  const shooter = k.run(c.finisher, 1620, 92, 34 + c.wing * 4, { speed: SPEED.sprint });
  k.feet(c.finisher, 1460);
  k.feet(c.finisher, 1620);
  return { x: shooter.x + FOOT, y: shooter.y + 0.3, z: 0.2, shot: 'normal' };
}

/** The defence heads a ball out; it drops to the finisher, who hits it on the volley. */
function volleyFromClearance(k: Kit, c: Ctx, step: number): Shot {
  const setup = k.at(c.finisher, k.t0);
  k.feet(c.creator, k.t0 + 60);
  const header = spareDefender(k, c, { x: 94, y: 34 });
  const hy = 34 + (setup.y - 34) * 0.4;
  if (header >= 0) {
    const h = k.run(header, 820, 93.5, hy, { speed: SPEED.run });
    k.jump(header, 820);
    k.ball(820, h.x - 0.3, h.y, 2.1, EASE_LINEAR, 2);
    k.touch(header, 820);
  } else {
    k.ball(820, 93, hy, 2.1, EASE_LINEAR, 2);
  }
  const f = k.run(c.finisher, 1600, setup.x + step, setup.y, { speed: SPEED.jog });
  k.ball(1600, f.x + FOOT, f.y + 0.3, 0.6, EASE_LINEAR, 4.5);
  closeDown(k, c, f, 1620);
  return { x: f.x + FOOT, y: f.y + 0.3, z: 0.6, shot: 'long_range' };
}

// Long range: set up by a lay-off, struck from a half-cleared ball, or after a square pass.
function longrange(k: Kit, c: Ctx): Shot {
  const y = (offset: number) => 34 + c.wing * offset;
  if (c.variant === 'clearance') return volleyFromClearance(k, c, 2.5);
  if (c.variant === 'carryshot') {
    // He carries it from deep through the middle, the defence backing off, and lets fly.
    const start = k.at(c.finisher, k.t0);
    k.feet(c.finisher, k.t0 + 60);
    const sh = k.run(c.finisher, 1620, start.x + 11, start.y + (34 - start.y) * 0.15, { speed: SPEED.sprint });
    for (const t of [720, 980, 1240, 1480, 1620]) k.feet(c.finisher, t);
    closeDown(k, c, sh, 1620);
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'long_range' };
  }
  if (c.variant === 'knockdown') {
    // Hit up to the target man on the edge of the box, who nods it down for the finisher.
    k.feet(c.helper, k.t0 + 60);
    const cp = k.at(c.creator, k.t0);
    const head = k.run(c.creator, 1080, cp.x - 0.6, cp.y, { speed: SPEED.jog });
    k.ball(1080, head.x - 0.2, head.y, 2.1, EASE_LINEAR, 4.5);
    k.touch(c.creator, 1080);
    k.jump(c.creator, 1080, 0.5);
    k.run(c.defender, 1080, head.x + 0.8, head.y + c.wing * 0.5, { speed: SPEED.jog });
    k.jump(c.defender, 1080, 0.45);
    k.run(c.helper, 1700, k.at(c.helper, k.t0).x + 5, k.at(c.helper, k.t0).y, { speed: SPEED.run });
    const f = k.run(c.finisher, 1600, 81, y(4.4), { speed: SPEED.run });
    k.ball(1620, f.x + FOOT, f.y + 0.3, 0.5, EASE_LINEAR, 1.2);
    closeDown(k, c, f, 1620);
    return { x: f.x + FOOT, y: f.y + 0.3, z: 0.5, shot: 'long_range' };
  }
  if (c.variant === 'halfway') {
    // Two touches to set it, a look up at the keeper off his line, and he goes for it: a lob
    // from the halfway line, high over the keeper scrambling back.
    const start = k.at(c.finisher, k.t0);
    k.feet(c.finisher, k.t0 + 80);
    const sh = k.run(c.finisher, 1620, start.x + 3.5, start.y, { speed: SPEED.jog });
    k.feet(c.finisher, 1150);
    k.feet(c.finisher, 1620);
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'long_range', arc: 6.5, keeperAt: k.at(c.gk, k.t0) };
  }
  if (c.variant === 'chest') {
    // A lofted ball from midfield: he kills it on his chest outside the area and, before it
    // touches the grass, volleys it.
    const cp = k.at(c.creator, k.t0);
    k.feet(c.creator, k.t0 + 80);
    k.run(c.creator, 700, cp.x + 1.5, cp.y, { speed: SPEED.jog });
    k.feet(c.creator, 700);
    const f0 = k.at(c.finisher, k.t0);
    const f = k.run(c.finisher, 1240, f0.x + 1.2, f0.y, { speed: SPEED.jog });
    k.ball(1240, f.x + 0.45, f.y, 1.3, EASE_LINEAR, 5.5);
    k.touch(c.finisher, 1240);
    // Off his chest it drops in front of him; he steps on to it.
    k.ball(1480, f.x + 1.5, f.y + 0.15, 0.9, EASE_OUT);
    const v = k.run(c.finisher, 1620, f.x + 1.1, f.y, { speed: SPEED.jog });
    k.ball(1620, v.x + FOOT, v.y + 0.25, 0.55);
    closeDown(k, c, v, 1620);
    return { x: v.x + FOOT, y: v.y + 0.25, z: 0.55, shot: 'long_range' };
  }
  if (c.variant === 'turn') {
    // Back to goal with the defender tight behind him: he takes the pass on the half-turn,
    // rolls him and shoots before he can recover.
    const cp = k.at(c.creator, k.t0);
    k.feet(c.creator, k.t0 + 80);
    k.run(c.creator, 760, cp.x + 1.5, cp.y, { speed: SPEED.jog });
    k.feet(c.creator, 760);
    const f0 = k.at(c.finisher, k.t0);
    // He comes short to meet it, facing his own goal.
    const f = k.run(c.finisher, 1080, f0.x - 1.2, f0.y, { speed: SPEED.run });
    k.ball(1080, f.x - 0.6, f.y + 0.3);
    k.touch(c.finisher, 1080);
    k.run(c.defender, 1080, f.x + 1, f.y + 0.3, { speed: SPEED.run }); // right on his back
    // Rolls round him on the outside and opens his body to the goal.
    const away = -c.wing;
    k.run(c.finisher, 1300, f.x + 0.5, f.y + away * 1.3, { speed: SPEED.run });
    k.feet(c.finisher, 1300);
    k.lunge(c.defender, 1280, { x: f.x + 0.5, y: f.y + away * 0.2 }); // reaches for it, too late
    const sh = k.run(c.finisher, 1620, f.x + 2.8, f.y + away * 1.9, { speed: SPEED.run });
    k.feet(c.finisher, 1460);
    k.feet(c.finisher, 1620);
    k.run(c.defender, 1700, f.x + 1.6, f.y - away * 0.6, { speed: SPEED.jog });
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'long_range' };
  }
  if (c.variant === 'square') {
    // Worked across the edge of the box to the finisher arriving.
    k.feet(c.creator, k.t0 + 80);
    k.run(c.creator, 900, 86.5, y(-4), { speed: SPEED.run });
    k.feet(c.creator, 900);
    const f = k.run(c.finisher, 1350, 82, y(3.2), { speed: SPEED.run });
    k.ball(1350, f.x + FOOT, f.y + 0.3);
    const sh = k.run(c.finisher, 1620, 83.4, y(2.6), { speed: SPEED.jog });
    k.feet(c.finisher, 1620);
    closeDown(k, c, sh, 1620);
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'long_range' };
  }
  const setup = k.at(c.finisher, k.t0);
  k.feet(c.creator, Math.max(k.t0 + 100, 700));
  k.feet(c.creator, 850);
  const f = k.run(c.finisher, 1150, setup.x + 1.5, setup.y, { speed: SPEED.jog });
  k.ball(1150, f.x + FOOT, f.y + 0.3);
  const shooter = k.run(c.finisher, 1620, f.x + 3, f.y, { speed: SPEED.jog });
  k.feet(c.finisher, 1400);
  k.feet(c.finisher, 1620);
  closeDown(k, c, shooter, 1620);
  // With the outside of the foot: it starts out wide of the far post and bends back in.
  if (c.variant === 'outside') return { x: shooter.x + FOOT, y: shooter.y + 0.3, z: 0.2, shot: 'long_range', aim: 'far', curve: c.wing * 1.9, curveZ: 1.2 };
  return { x: shooter.x + FOOT, y: shooter.y + 0.3, z: 0.2, shot: 'long_range' };
}

// Counter: a ball over the top, a carry and a square pass, a two-on-one, or a breakaway.
function counter(k: Kit, c: Ctx): Shot {
  const y = (offset: number) => 34 + c.wing * offset;
  if (c.variant === 'switch') {
    // Won back on one side, switched at once to the other: the winger, all alone on the far
    // flank, takes it in his stride, cuts inside the full-back and bends it at the far post.
    const cp = k.at(c.creator, k.t0);
    k.feet(c.creator, k.t0 + 80);
    k.run(c.creator, 560, cp.x + 1.5, cp.y, { speed: SPEED.run });
    k.feet(c.creator, 560);
    const R = { x: 86, y: y(16) };
    const fin = k.run(c.finisher, 1250, R.x - 0.6, R.y, { speed: SPEED.sprint });
    k.ball(1250, fin.x + FOOT, fin.y + 0.3, 0.2, EASE_LINEAR, 4.5);
    k.feet(c.finisher, 1250);
    // The full-back comes across to meet him, goal-side; he is gone inside him.
    k.run(c.defender, 1250, R.x + 2.4, R.y - c.wing * 1.6, { speed: SPEED.sprint });
    k.run(c.finisher, 1450, R.x + 1.8, y(13), { speed: SPEED.sprint });
    k.feet(c.finisher, 1450);
    const sh = k.run(c.finisher, 1620, R.x + 3.4, y(11.2), { speed: SPEED.sprint });
    k.feet(c.finisher, 1620);
    k.lunge(c.defender, 1380, { x: R.x + 1.6, y: y(15.2) }); // bites on the outside
    k.run(c.defender, 1800, sh.x - 1.8, sh.y + c.wing * 2.2, { speed: SPEED.jog });
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'normal', aim: 'far', curve: -c.wing * 1.3, curveZ: 0.9 };
  }
  if (c.variant === 'cutback') {
    // Clear down the flank at full speed, he gets to the edge of the six-yard box and pulls
    // it back for the finisher arriving at the penalty spot.
    k.feet(c.creator, k.t0 + 60);
    const w = k.run(c.creator, 1140, 96.2, y(16), { speed: SPEED.sprint });
    for (const t of [700, 940]) k.feet(c.creator, t);
    k.feet(c.creator, 1140);
    k.run(c.defender, 1140, w.x - 2.2, w.y - c.wing * 0.6, { speed: SPEED.sprint }); // chasing, a step behind
    const fin = k.run(c.finisher, 1560, 92.2, y(2.4), { speed: SPEED.sprint });
    k.ball(1560, fin.x + FOOT, fin.y + 0.3);
    k.run(c.defender, 1620, w.x - 0.4, y(13.2), { speed: SPEED.run }); // too late to cut it out
    const sh = k.run(c.finisher, 1620, fin.x + 0.5, fin.y, { speed: SPEED.run });
    k.feet(c.finisher, 1620);
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'first_time' };
  }
  if (c.variant === 'threevtwo') {
    // Three on two: the carrier draws a defender, the decoy takes the other away, and it is
    // switched to the runner on the far side, who hits it first time.
    k.feet(c.creator, k.t0 + 80);
    const carry = k.run(c.creator, 1100, 76.5, y(0.5), { speed: SPEED.sprint });
    k.feet(c.creator, 800);
    k.feet(c.creator, 1100);
    k.run(c.helper, 1620, 90, y(-8.5), { speed: SPEED.sprint }); // the decoy run
    const fin = k.run(c.finisher, 1520, 87.5, y(8.5), { speed: SPEED.sprint });
    k.ball(1520, fin.x + FOOT, fin.y + 0.3);
    k.run(c.defender, 1100, carry.x + 2.2, carry.y - c.wing * 0.8, { speed: SPEED.sprint }); // steps up to the ball, on the decoy's side (out of the switch)
    k.run(c.defender, 1620, fin.x - 3.5, fin.y - c.wing * 2.5, { speed: SPEED.sprint }); // turns, too late
    if (c.second >= 0) k.run(c.second, 1620, 88, y(-6.3), { speed: SPEED.sprint }); // goes with the decoy
    const sh = k.run(c.finisher, 1620, fin.x + 0.7, fin.y - c.wing * 0.3, { speed: SPEED.run });
    k.feet(c.finisher, 1620);
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'first_time' };
  }
  if (c.variant === 'overlap') {
    // He carries it inside; the finisher bursts past him on the outside and is played in.
    k.feet(c.creator, k.t0 + 80);
    const carry = k.run(c.creator, 1000, 80, y(2.5), { speed: SPEED.run });
    k.feet(c.creator, 760);
    k.feet(c.creator, 1000);
    const fin = k.run(c.finisher, 1330, 87.8, y(10), { speed: SPEED.sprint });
    k.ball(1330, fin.x + FOOT, fin.y + 0.3);
    k.run(c.defender, 1000, carry.x + 2.4, carry.y + c.wing * 0.4, { speed: SPEED.run }); // drawn to the ball
    const sh = k.run(c.finisher, 1620, 91.2, y(8), { speed: SPEED.sprint });
    k.feet(c.finisher, 1480);
    k.feet(c.finisher, 1620);
    k.run(c.defender, 1620, sh.x - 3, sh.y - c.wing * 1.6, { speed: SPEED.sprint }); // turns and chases
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'one_on_one', aim: 'far', keeperAt: { x: 102.3, y: 34 + (sh.y - 34) * 0.35 } };
  }
  if (c.variant === 'carry') {
    // The creator carries it at pace and squares it for the finisher.
    const from = k.at(c.creator, k.t0);
    k.feet(c.creator, k.t0 + 80);
    const carry = k.run(c.creator, 1250, from.x + 8, from.y + (34 - from.y) * 0.3, { speed: SPEED.sprint });
    k.feet(c.creator, 900);
    k.feet(c.creator, 1250);
    const fin = k.run(c.finisher, 1560, 89, y(5.5), { speed: SPEED.sprint });
    k.ball(1560, fin.x + FOOT, fin.y + 0.3);
    k.run(c.defender, 1250, carry.x + 2, carry.y - c.wing * 1.2, { speed: SPEED.sprint });
    k.run(c.defender, 1620, fin.x - 3, fin.y - c.wing * 2, { speed: SPEED.sprint });
    k.run(c.finisher, 1620, fin.x + 0.6, fin.y, { speed: SPEED.run });
    k.feet(c.finisher, 1620);
    const shooter = k.at(c.finisher, 1620);
    return { x: shooter.x + FOOT, y: shooter.y + 0.3, z: 0.2, shot: 'first_time' };
  }
  if (c.variant === 'twoonone') {
    // Two against one: the last defender commits to the ball and the pass goes past him.
    k.feet(c.creator, k.t0 + 80);
    k.run(c.creator, 1250, 81, y(1.5), { speed: SPEED.sprint });
    k.feet(c.creator, 900);
    k.feet(c.creator, 1250);
    k.run(c.helper, 1250, 84, y(-8), { speed: SPEED.sprint });
    k.run(c.helper, 1620, 89, y(-7), { speed: SPEED.sprint });
    k.run(c.defender, 1100, 84, y(-0.5), { speed: SPEED.run });
    k.run(c.defender, 1250, 83, y(-1.2), { speed: SPEED.sprint });
    const fin = k.run(c.finisher, 1560, 89, y(8), { speed: SPEED.sprint });
    k.ball(1560, fin.x + FOOT, fin.y + 0.3);
    k.run(c.defender, 1620, 85, y(0.5), { speed: SPEED.sprint });
    const sh = k.run(c.finisher, 1620, fin.x + 0.6, fin.y - c.wing * 0.2, { speed: SPEED.run });
    k.feet(c.finisher, 1620);
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'first_time' };
  }
  if (c.variant === 'recovery') {
    // Racing back, the defender throws in a sliding tackle from the side; he is skipped past.
    k.feet(c.finisher, k.t0 + 80);
    k.run(c.finisher, 900, 85, y(2.5), { speed: SPEED.sprint });
    k.feet(c.finisher, 900);
    const a = k.run(c.finisher, 1250, 88, y(2), { speed: SPEED.sprint });
    k.ball(1250, a.x + 1.6, a.y + 0.3);
    k.run(c.defender, 900, 85.6, y(4.8), { speed: SPEED.sprint });
    const sh = k.run(c.finisher, 1620, 91.3, y(1.5), { speed: SPEED.sprint });
    // After his run is set, so the hop over the slide follows it.
    const up = k.slideTackle(c.defender, 1250, { x: a.x + 0.3, y: a.y + c.wing * 0.9 }, c.finisher, 500);
    // Back up and chasing, a step outside and behind him (never in his tracks).
    k.run(c.defender, Math.max(2100, up + 450), a.x + 1, y(5.2), { speed: SPEED.jog });
    k.feet(c.finisher, 1450);
    k.feet(c.finisher, 1620);
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'one_on_one', keeperAt: { x: 101.5, y: 34 + (sh.y - 34) * 0.4 } };
  }
  if (c.variant === 'breakaway') {
    // Clear through on his own, the defender chasing from behind; the keeper comes out.
    k.feet(c.finisher, k.t0 + 80);
    k.run(c.finisher, 900, 85, y(2.5), { speed: SPEED.sprint });
    k.feet(c.finisher, 900);
    k.run(c.finisher, 1300, 88.5, y(2), { speed: SPEED.sprint });
    k.feet(c.finisher, 1300);
    const sh = k.run(c.finisher, 1620, 91.3, y(1.5), { speed: SPEED.sprint });
    k.feet(c.finisher, 1620);
    k.run(c.defender, 900, 81, y(4.2), { speed: SPEED.sprint });
    k.run(c.defender, 1300, 84.5, y(3.4), { speed: SPEED.sprint });
    k.run(c.defender, 1620, 87.6, y(3.2), { speed: SPEED.sprint });
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'one_on_one', keeperAt: { x: 101, y: 34 + (sh.y - 34) * 0.4 } };
  }
  const tPass = Math.max(k.t0 + 100, 500);
  k.feet(c.creator, tPass);
  const fin = k.run(c.finisher, 1050, 87, y(10));
  k.ball(1050, fin.x + FOOT, fin.y + 0.3, 0.3, EASE_LINEAR, 2);
  k.run(c.defender, 1050, fin.x - 4, fin.y - c.wing * 3, { speed: SPEED.sprint });
  const shooter = k.run(c.finisher, 1620, 92, y(5));
  k.feet(c.finisher, 1400);
  k.feet(c.finisher, 1620);
  k.run(c.defender, 1620, shooter.x - 2.5, shooter.y - c.wing * 1.5, { speed: SPEED.sprint });
  return { x: shooter.x + FOOT, y: shooter.y + 0.3, z: 0.2, shot: 'one_on_one', keeperAt: { x: 102, y: 34 + (shooter.y - 34) * 0.4 } };
}

// Corner: to the near post, the far post, played short, or flicked on at the near post.
function corner(k: Kit, c: Ctx): Shot {
  const flag = c.spot;
  const top = flag.y < 34;
  if (c.variant === 'olimpico') {
    // He takes it himself and bends it straight at goal, curling in at the near post.
    k.run(c.finisher, 1250, 103.2, top ? 1.7 : 66.3, { speed: SPEED.jog }); // a short run-up
    k.run(c.finisher, 1620, flag.x - 0.5, flag.y + (top ? 0.3 : -0.3), { speed: SPEED.run });
    k.ball(1620, flag.x, flag.y);
    const nearPost = top ? GOAL_Y_MIN : GOAL_Y_MAX;
    return {
      x: flag.x, y: flag.y, z: 0.1, shot: 'normal', aim: 'near',
      via: { x: 100.4, y: (flag.y + nearPost) / 2, z: 2.8 },
      keeperAt: { x: 104.2, y: nearPost + (top ? 1.8 : -1.8) },
    };
  }
  if (c.variant === 'nearpower') {
    // Driven low and hard to the near post, where the finisher darts across his marker.
    k.run(c.creator, 760, 103.6, top ? 1.4 : 66.6, { speed: SPEED.jog });
    k.ball(800, flag.x, flag.y);
    k.touch(c.creator, 800);
    const N = { x: 98.4, y: top ? 30.8 : 37.2 };
    const fin = k.run(c.finisher, 1600, N.x - 0.6, N.y, { speed: SPEED.sprint });
    // His marker is a step behind him, on the inside (never across the ball's path).
    k.run(c.defender, 1600, fin.x - 0.9, fin.y + (top ? 1.1 : -1.1), { speed: SPEED.sprint });
    k.ball(1600, fin.x + 0.7, fin.y, 0.15);
    return { x: fin.x + 0.7, y: fin.y, z: 0.2, shot: 'first_time', aim: 'far' };
  }
  if (c.variant === 'backpost') {
    // To the back post, where the target man heads it back across into the middle.
    k.ball(500, flag.x, flag.y);
    k.touch(c.creator, 500);
    const B = { x: 98.8, y: top ? 37.5 : 30.5 };
    const h = k.run(c.helper, 1380, B.x - 0.5, B.y, { speed: SPEED.sprint });
    k.jump(c.helper, 1380);
    k.ball(1380, h.x + 0.3, h.y, 2.2, EASE_LINEAR, 1.2);
    k.touch(c.helper, 1380);
    const M = { x: 96, y: top ? 33.8 : 34.2 };
    const fin = k.run(c.finisher, 1600, M.x - 0.6, M.y);
    k.run(c.defender, 1600, M.x - 1.6, M.y + (top ? -1.3 : 1.3));
    k.ball(1600, fin.x + 0.4, fin.y, 1.8, EASE_LINEAR, 0.5);
    k.jump(c.finisher, S_CONTACT);
    k.jump(c.defender, S_CONTACT);
    return { x: fin.x + 0.4, y: fin.y, z: 1.8, shot: 'header' };
  }
  if (c.variant === 'short') {
    // Played short to the creator, who crosses first time.
    k.ball(650, flag.x, flag.y);
    k.touch(c.helper, 650);
    const cr = k.run(c.creator, 900, 100, top ? 9.5 : 58.5, { speed: SPEED.jog });
    k.ball(900, cr.x + 0.3, cr.y + (top ? -0.3 : 0.3));
    k.run(c.helper, 900, 103.4, top ? 3 : 65, { speed: SPEED.jog });
    k.feet(c.creator, 950);
    const H = { x: 96.5, y: 34 + (top ? 2.5 : -2.5) };
    const meet = attackTheCross(k, c, H, 1600);
    k.ball(1600, meet.x + 0.4, meet.y, 1.9, EASE_LINEAR, 3.5);
    return { x: meet.x + 0.4, y: meet.y, z: 1.9, shot: 'header' };
  }
  if (c.variant === 'edge') {
    // Played low to the edge of the box and hit first time.
    k.run(c.creator, 760, 103.6, top ? 1.4 : 66.6, { speed: SPEED.jog });
    k.ball(800, flag.x, flag.y);
    k.touch(c.creator, 800);
    const E = { x: 89, y: 34 + (top ? -4 : 4) };
    const fin = k.run(c.finisher, 1560, E.x - 0.7, E.y, { speed: SPEED.run });
    k.ball(1560, fin.x + 0.6, fin.y);
    k.run(c.defender, 1620, fin.x + 2.6, fin.y + (top ? -2.2 : 2.2), { speed: SPEED.run });
    k.feet(c.finisher, 1620);
    const sh = k.at(c.finisher, 1620);
    return { x: sh.x + FOOT, y: sh.y + 0.3, z: 0.2, shot: 'long_range' };
  }
  if (c.variant === 'flick') {
    // Flicked on at the near post to the finisher arriving at the far post.
    k.run(c.creator, 620, 103.6, top ? 1.4 : 66.6, { speed: SPEED.jog });
    k.ball(620, flag.x, flag.y);
    k.touch(c.creator, 620);
    const N = { x: 99.2, y: top ? 31 : 37 };
    const F = { x: 98.6, y: top ? 37.5 : 30.5 };
    const h = k.run(c.helper, 1300, N.x - 0.5, N.y, { speed: SPEED.sprint });
    k.jump(c.helper, 1300);
    k.ball(1300, h.x + 0.3, h.y, 2.2, EASE_LINEAR, 1);
    k.touch(c.helper, 1300);
    const fin = k.run(c.finisher, 1600, F.x - 0.6, F.y);
    k.run(c.defender, 1600, F.x - 1.8, F.y + (top ? 1.3 : -1.3));
    k.ball(1600, fin.x + 0.4, fin.y, 1.6, EASE_LINEAR, 0.6);
    k.jump(c.finisher, S_CONTACT);
    k.jump(c.defender, S_CONTACT);
    return { x: fin.x + 0.4, y: fin.y, z: 1.6, shot: 'header' };
  }
  if (c.variant === 'decoy') {
    // Rehearsed on the training ground: a team-mate steps into the marker's path (o bloqueio)
    // and the finisher, curling round it, arrives unmarked at the penalty spot.
    k.run(c.creator, 760, 103.6, top ? 1.4 : 66.6, { speed: SPEED.jog });
    k.ball(800, flag.x, flag.y);
    k.touch(c.creator, 800);
    const M = { x: 95, y: top ? 34.8 : 33.2 };
    const f0 = k.at(c.finisher, k.t0);
    // Round the back of the screen, then in to the spot.
    k.run(c.finisher, 1150, f0.x + 1.6, top ? 37.4 : 30.6, { speed: SPEED.run });
    const fin = k.run(c.finisher, 1600, M.x - 0.6, M.y, { speed: SPEED.sprint });
    const h0 = k.at(c.helper, k.t0);
    const screen = k.run(c.helper, 1080, h0.x - 0.6, top ? 38.6 : 29.4, { speed: SPEED.run });
    k.run(c.helper, 1600, screen.x - 0.2, screen.y, { speed: SPEED.jog });
    // The marker follows him... and runs into the screen.
    k.run(c.defender, 1120, screen.x - 0.2, top ? 39.5 : 28.5, { speed: SPEED.run });
    // Round it, free again, too late.
    k.run(c.defender, 1350, screen.x - 1.2, top ? 38.4 : 29.6, { speed: SPEED.run });
    k.run(c.defender, 1600, fin.x - 1.6, top ? 36.6 : 31.4, { speed: SPEED.run });
    k.ball(1200, 101.5, top ? 18 : 50, 4.6, EASE_LINEAR, 1.6);
    k.ball(1600, fin.x + 0.4, fin.y, 2);
    k.jump(c.finisher, S_CONTACT);
    return { x: fin.x + 0.4, y: fin.y, z: 2, shot: 'header' };
  }
  if (c.variant === 'late') {
    // Aimed at the penalty spot, where a late runner from the edge of the area meets it at
    // full speed, ahead of the defender minding the zone.
    k.run(c.creator, 760, 103.6, top ? 1.4 : 66.6, { speed: SPEED.jog });
    k.ball(800, flag.x, flag.y);
    k.touch(c.creator, 800);
    const L = { x: 94, y: top ? 33.4 : 34.6 };
    const f0 = k.at(c.finisher, k.t0);
    k.run(c.finisher, 900, f0.x - 0.6, f0.y, { speed: SPEED.jog }); // waits, out of the crowd
    const fin = k.run(c.finisher, 1600, L.x - 0.6, L.y, { speed: SPEED.sprint });
    // The zonal defender is drawn to the ball's flight and caught under it, a step behind.
    k.run(c.defender, 1600, fin.x - 1, fin.y + (top ? -1.3 : 1.3), { speed: SPEED.run });
    k.ball(1200, 101, top ? 17 : 51, 4.8, EASE_LINEAR, 1.6);
    k.ball(1600, fin.x + 0.4, fin.y, 2);
    k.jump(c.finisher, S_CONTACT, 0.9);
    k.jump(c.defender, S_CONTACT + 40, 0.5);
    return { x: fin.x + 0.4, y: fin.y, z: 2, shot: 'header' };
  }
  const nearPost = c.variant === 'near';
  const nearY = top ? 31 : 37;
  const H = nearPost ? { x: 99.2, y: nearY } : { x: 97 - k.rng() * 0.6, y: 34 + (top ? 3 : -3) + (k.rng() - 0.5) };
  k.run(c.creator, 750, 103.6, top ? 1.4 : 66.6, { speed: SPEED.jog });
  k.ball(750, flag.x, flag.y);
  k.touch(c.creator, 750);
  const fin = k.run(c.finisher, 1600, H.x - 0.6, H.y);
  k.run(c.defender, 1600, H.x - 0.1, H.y + (H.y < 34 ? -1.3 : 1.3));
  if (nearPost) k.ball(1150, 103, top ? 17 : 51, 2.6, EASE_LINEAR, 0.8);
  else k.ball(1150, 101.8, top ? 17 : 51, 4.5, EASE_LINEAR, 1.6);
  k.ball(1600, fin.x + 0.4, fin.y, 2);
  k.jump(c.finisher, S_CONTACT);
  k.jump(c.defender, S_CONTACT);
  return { x: fin.x + 0.4, y: fin.y, z: 2, shot: 'header' };
}

/** The wall holds its line, then jumps as the ball (struck from `from`) reaches it. */
function wallJumps(k: Kit, c: Ctx, from: Point): void {
  const toWall = (9.15 / Math.hypot(105 - from.x, 34 - from.y)) * (k.sArrival - S_CONTACT);
  for (const s of c.wall) {
    const p = k.at(s, k.t0);
    k.run(s, 1600, p.x, p.y, { speed: SPEED.jog });
    k.jump(s, Math.round(S_CONTACT + toWall), 0.6);
  }
}

// Free kick: curled over the wall, struck with power, or low under the jumping wall.
function freekick(k: Kit, c: Ctx): Shot {
  const top = c.spot.y < 34;
  if (c.variant === 'flank') {
    // Out wide: a short run-up and it is whipped into the box, over the two-man wall.
    const p = k.at(c.creator, k.t0);
    k.run(c.creator, 700, p.x - 1.4, p.y, { speed: SPEED.jog });
    k.run(c.creator, 950, c.spot.x - 0.6, c.spot.y, { speed: SPEED.run });
    k.ball(950, c.spot.x, c.spot.y);
    k.touch(c.creator, 950);
    for (const s of c.wall) k.jump(s, 1060, 0.5);
    const H = { x: 96.2, y: top ? 35.5 : 32.5 };
    const meet = attackTheCross(k, c, H, 1600);
    k.ball(1600, meet.x + 0.4, meet.y, 1.9, EASE_LINEAR, 4);
    return { x: meet.x + 0.4, y: meet.y, z: 1.9, shot: 'header' };
  }
  if (c.variant === 'dummyrun') {
    // Two over the ball: the first runs up and steps over it, the wall flinches, and the
    // second, a moment later, bends it over.
    const h0 = k.at(c.helper, k.t0);
    k.run(c.helper, 1150, h0.x, h0.y, { speed: SPEED.jog });
    k.run(c.helper, 1400, c.spot.x - 0.3, c.spot.y + c.wing * 0.4, { speed: SPEED.run });
    k.jump(c.helper, 1400, 0.22);
    // On past it, out to the side, out of the way of the strike.
    k.run(c.helper, 1700, c.spot.x + 1.2, c.spot.y + c.wing * 2.8, { speed: SPEED.run });
    const f0 = k.at(c.finisher, k.t0);
    k.run(c.finisher, 1300, f0.x, f0.y, { speed: SPEED.jog });
    k.run(c.finisher, 1620, c.spot.x - 0.6, c.spot.y, { speed: SPEED.run });
    k.ball(1620, c.spot.x, c.spot.y);
    // The wall twitches as the first one shapes to shoot, then jumps for real.
    for (const s of c.wall) k.jump(s, 1400, 0.15);
    wallJumps(k, c, c.spot);
    return { x: c.spot.x, y: c.spot.y, z: 0.1, shot: 'normal', curve: -c.wing * 2, curveZ: 2.6 };
  }
  if (c.variant === 'chipped') {
    // No shot: the taker dinks it over the wall for the finisher, who has peeled off the end
    // of it, to volley on the run.
    const { dir, side } = chipLine(c);
    const cr = k.at(c.creator, k.t0);
    k.run(c.creator, 900, cr.x - 1.2, cr.y, { speed: SPEED.jog });
    k.run(c.creator, 1150, c.spot.x - 0.6, c.spot.y, { speed: SPEED.run });
    k.ball(1150, c.spot.x, c.spot.y);
    k.touch(c.creator, 1150);
    const V = { x: c.spot.x + dir.x * 14.5 - dir.y * side * 1.6, y: c.spot.y + dir.y * 14.5 + dir.x * side * 1.6 };
    const f0 = k.at(c.finisher, k.t0);
    k.run(c.finisher, 1000, f0.x, f0.y, { speed: SPEED.jog });
    // Inside his marker first (who is goal-side of him), then on to where it drops.
    k.run(c.finisher, 1250, c.spot.x + dir.x * 10.2 - dir.y * side * 1.3, c.spot.y + dir.y * 10.2 + dir.x * side * 1.3, { speed: SPEED.sprint });
    const fin = k.run(c.finisher, 1620, V.x - 0.7, V.y, { speed: SPEED.sprint });
    k.ball(1620, fin.x + 0.6, fin.y, 0.7, EASE_LINEAR, 3.4);
    // His marker turns with him, a stride behind; the wall goes up as the ball goes over.
    const d0 = k.at(c.defender, k.t0);
    k.run(c.defender, 1000, d0.x, d0.y, { speed: SPEED.jog });
    k.run(c.defender, 1620, fin.x - 1.3, fin.y + side * 1.3, { speed: SPEED.sprint });
    for (const s of c.wall) k.jump(s, 1300, 0.5);
    return { x: fin.x + 0.6, y: fin.y, z: 0.7, shot: 'first_time' };
  }
  if (c.variant === 'routine') {
    // Rolled a few yards aside by the team-mate on the ball; the finisher runs on and hits it.
    const h = k.at(c.helper, k.t0);
    k.run(c.helper, 1180, h.x, h.y, { speed: SPEED.jog });
    k.ball(1180, c.spot.x, c.spot.y);
    k.touch(c.helper, 1180);
    k.run(c.helper, 1900, h.x - 1.2, h.y - c.wing * 1.6, { speed: SPEED.jog });
    const R = { x: c.spot.x + 0.5, y: c.spot.y + c.wing * 2.8 };
    const f = k.at(c.finisher, k.t0);
    k.run(c.finisher, 1200, f.x, f.y, { speed: SPEED.jog });
    k.run(c.finisher, 1620, R.x - FOOT, R.y - 0.3, { speed: SPEED.sprint });
    wallJumps(k, c, R);
    return { x: R.x, y: R.y, z: 0.1, shot: 'normal', curve: -c.wing * 0.6, curveZ: 2.5 };
  }
  const runUp = k.at(c.finisher, k.t0);
  const power = c.variant === 'power' || c.variant === 'distance';
  k.run(c.finisher, power ? 1050 : 1150, runUp.x - (power ? 1.5 : 0), runUp.y, { speed: SPEED.jog });
  k.run(c.finisher, 1620, c.spot.x - 0.6, c.spot.y, { speed: SPEED.run });
  k.ball(1620, c.spot.x, c.spot.y);
  wallJumps(k, c, c.spot);
  if (c.variant === 'under') return { x: c.spot.x, y: c.spot.y, z: 0.1, shot: 'normal', curve: 0, curveZ: 0.15 };
  // From 35 metres: struck hard, rising over the wall and dipping late.
  if (c.variant === 'distance') return { x: c.spot.x, y: c.spot.y, z: 0.1, shot: 'normal', curve: -c.wing * 1.1, curveZ: 3.4 };
  if (power) return { x: c.spot.x, y: c.spot.y, z: 0.1, shot: 'normal', curve: -c.wing * 0.5, curveZ: 2.5 };
  return { x: c.spot.x, y: c.spot.y, z: 0.1, shot: 'normal', curve: -c.wing * 2.2, curveZ: 2.6 };
}

function penalty(k: Kit, c: Ctx): Shot {
  const p = k.at(c.finisher, k.t0);
  k.run(c.finisher, 1100, p.x, p.y, { speed: SPEED.jog });
  if (c.variant === 'stutter') {
    // Paradinha: a stutter in the run-up, then the strike.
    k.run(c.finisher, 1300, 92.6, 34.1, { speed: SPEED.jog });
    k.run(c.finisher, 1480, 92.7, 34.05, { speed: SPEED.jog });
  }
  if (c.variant === 'panenka') k.run(c.finisher, 1620, 93.4, 34, { speed: SPEED.jog });
  else k.run(c.finisher, 1620, 93.4, 34, { speed: c.variant === 'power' ? SPEED.sprint : SPEED.run });
  k.ball(1620, 94, 34);
  return { x: 94, y: 34, z: 0.1, shot: 'normal', keeperAt: { x: 104.6, y: 34 } };
}

function screamer(k: Kit, c: Ctx): Shot {
  if (c.variant === 'volley') return volleyFromClearance(k, c, 1.5);
  const start = k.at(c.finisher, k.t0);
  k.feet(c.finisher, k.t0 + 100);
  const shooter = k.run(c.finisher, 1620, start.x + 4, start.y, { speed: SPEED.jog });
  k.feet(c.finisher, 1200);
  k.feet(c.finisher, 1620);
  closeDown(k, c, shooter, 1620);
  return { x: shooter.x + FOOT, y: shooter.y + 0.3, z: 0.2, shot: 'long_range' };
}

const SCRIPTS: Record<Base, (k: Kit, c: Ctx) => Shot> = { cross, through, dribble, longrange, counter, corner, freekick, penalty, screamer };

// ── The strike, the keeper and the outcome. ──

/** The defender who can best get a body to P by time t (a block or a deflection); the marker first. */
function interceptor(k: Kit, c: Ctx, P: Point, t: number): number {
  // A direct free kick is blocked by the wall; anything else (a free kick crossed in) by whoever is near.
  const direct = c.base === 'freekick' && c.variant !== 'flank';
  const pool = direct && c.wall.length ? c.wall : c.defLive.filter(s => s !== c.gk && roleOfSlot(c.sides, s) !== 'GK');
  let best = c.defender;
  let bestGap = Infinity;
  for (const s of pool) {
    const last = c.wall.includes(s) ? t : k.lastTime(s);
    if (last > t) continue;
    const from = k.at(s, last);
    // A block comes from in front (between the ball and the goal), not from someone chasing.
    const behind = from.x < P.x - 1 ? 8 : 0;
    const gap = Math.hypot(from.x - P.x, from.y - P.y) - (SPEED.sprint * k.span(last, t)) / 1000 - (s === c.defender ? 1.5 : 0) + behind;
    if (gap < bestGap) { bestGap = gap; best = s; }
  }
  return best;
}

/** Position and realistic recovery time for the attacker following a shot. */
function reboundRunnerState(k: Kit, slot: number): ReboundRunner {
  const contactReal = k.real(S_CONTACT);
  let readyReal = contactReal + (k.jumped.has(slot) ? 180 : 0);
  // A diving or bicycle finish needs time to complete its body animation before the recovery run.
  for (const beat of k.beats) {
    if (beat.slot === slot && (beat.kind === 'dive' || beat.kind === 'flip')) {
      readyReal = Math.max(readyReal, beat.t + (beat.ms ?? 0));
    }
  }
  const readyAt = Math.max(S_CONTACT, k.script(readyReal));
  const position = k.at(slot, readyAt);
  return { position, readyDelayMs: readyAt - S_CONTACT };
}

/** Sprints for a rebound at the first physically reachable moment, then waits in control. */
function sprintToRebound(k: Kit, slot: number, target: Point, runner: ReboundRunner, receiveAt: number): Point {
  const readyAt = S_CONTACT + runner.readyDelayMs;
  const from = k.replaceFuture(slot, readyAt);
  const departAt = readyAt + REBOUND_REACTION_MS;
  if (departAt > readyAt) k.keyAt(slot, departAt, from.x, from.y);
  const runMs = Math.hypot(target.x - from.x, target.y - from.y) / SPEED.sprint * 1000;
  const arriveAt = departAt + runMs;
  const runUntil = Math.min(receiveAt, arriveAt);
  const reached = k.run(slot, runUntil, target.x, target.y, { speed: SPEED.sprint });
  if (runUntil < receiveAt) k.keyAt(slot, receiveAt, reached.x, reached.y);
  return reached;
}

/** Plays the strike and its outcome; returns the slot the ball touched on the way (or -1). */
function finishShot(k: Kit, c: Ctx, s: Shot, runner: ReboundRunner): number {
  const A = k.sArrival;
  const f = c.finish;
  k.ball(S_CONTACT, s.x, s.y, s.z);
  k.touch(c.kind === 'own_goal' ? c.defender : c.finisher, S_CONTACT);
  k.beat(S_CONTACT, 'strike', s.x, s.y, A - S_CONTACT);
  k.beat(A, 'normal', 105, 34);
  // Near or far corner, inside the posts.
  const nearPost = s.y < 34 ? GOAL_Y_MIN : GOAL_Y_MAX;
  const farPost = s.y < 34 ? GOAL_Y_MAX : GOAL_Y_MIN;
  const post = (s.aim ? s.aim === 'far' : k.rng() < 0.55) ? farPost : nearPost;
  const inward = post < 34 ? 1 : -1;
  // A penalty down the middle; one tucked right into the corner.
  const spotKick = c.base === 'penalty';
  const goalY = spotKick && c.variant === 'center' ? 34 + (k.rng() - 0.5) * 1.2 : post + inward * (spotKick && c.variant === 'corner' ? 1 : 1.3);
  // Ordinary strikes follow their authored start and target heights. A generic sine arc on
  // the final key was applied only after the opening burst, making a flat shot suddenly rise
  // near the keeper and dip again. Lobs and dipping shots add their own explicit trajectory.
  const arc = s.arc ?? 0;
  const sprint = { speed: SPEED.sprint };

  // The keeper sets himself, facing the shot.
  // (Spreading himself at the shooter's feet, he is already rushing out as it is struck.)
  const setTo = f === 'spread' ? { x: Math.min(101.5, Math.max(s.x + 3.2, 99.5)), y: s.y + (34 - s.y) * 0.45 } : s.keeperAt ?? { x: 103.8, y: 34 + (s.y - 34) * 0.25 };
  // (He reads it early and sets off from his line before the strike.)
  if (f === 'spread') k.run(c.gk, S_CONTACT - 420, 103.6, 34 + (s.y - 34) * 0.2, { speed: SPEED.run, ease: EASE_SMOOTH });
  k.run(c.gk, S_CONTACT, setTo.x, setTo.y, { speed: f === 'spread' ? SPEED.sprint : SPEED.run, ease: EASE_SMOOTH });
  let set = k.at(c.gk, S_CONTACT);
  if (c.variant === 'halfway') {
    // Caught off his line: he turns and sprints back towards his goal as the ball flies.
    set = { ...k.run(c.gk, A - 450, 103.4, 34 + (goalY - 34) * 0.35, sprint), z: 0 };
  }

  // Something in the way: a block, a deflection, or the keeper's hands.
  let from = { t: S_CONTACT, x: s.x, y: s.y };
  let touched = -1;
  const touch = (slot: number, t: number, dist: number, z: number) => {
    const len = Math.hypot(105 - s.x, goalY - s.y) || 1;
    const P = { x: s.x + ((105 - s.x) / len) * dist, y: s.y + ((goalY - s.y) / len) * dist };
    const p = c.wall.includes(slot) ? k.at(slot, t) : k.run(slot, t, P.x + 0.3, P.y, sprint);
    k.ball(t, p.x - 0.3, p.y, z, EASE_LINEAR, 0.2);
    k.touch(slot, t);
    from = { t, x: p.x - 0.3, y: p.y };
    touched = slot;
    return p;
  };
  const viaPoint = (dist: number): Point => {
    const len = Math.hypot(105 - s.x, goalY - s.y) || 1;
    return { x: s.x + ((105 - s.x) / len) * dist, y: s.y + ((goalY - s.y) / len) * dist };
  };
  const strikeDist = Math.hypot(105 - s.x, goalY - s.y);
  if (f === 'blocked') {
    const dist = c.base === 'freekick' ? 9.15 : Math.min(5, Math.max(2.5, strikeDist * 0.25));
    const P = viaPoint(dist);
    const blocker = interceptor(k, c, P, S_CONTACT + 320);
    // A blocker still on his way meets it a little further on: late enough that the ball
    // gets to where he really is at a strike's pace.
    let tB = S_CONTACT + 320;
    if (!c.wall.includes(blocker)) {
      const last = k.lastTime(blocker);
      const from = k.at(blocker, last);
      for (; tB < S_CONTACT + 650; tB += 30) {
        const gap = Math.hypot(P.x - from.x, P.y - from.y);
        const share = gap > 0 ? Math.min(1, (SPEED.sprint * Math.max(0, k.span(last, tB))) / 1000 / gap) : 1;
        const meet = { x: from.x + (P.x - from.x) * share, y: from.y + (P.y - from.y) * share };
        if (Math.hypot(meet.x - s.x, meet.y - s.y) / (k.span(S_CONTACT, tB) / 1000) <= 26) break;
      }
    }
    const p = touch(blocker, tB, dist, c.base === 'freekick' ? 1.5 : 0.5);
    k.beat(tB, 'block', p.x, p.y);
  } else if (f === 'deflect' && c.kind === 'deflected') {
    // A free kick off the wall; anything else off a body a few metres out.
    const dist = c.base === 'freekick' ? 9.15 : Math.min(8, Math.max(4, strikeDist * 0.35));
    touch(interceptor(k, c, viaPoint(dist), S_CONTACT + 420), S_CONTACT + 420, dist, 0.7);
  } else if (f === 'fumble') {
    // Straight at the keeper, who lets it squirm through.
    const t = A - 400;
    const gy = set.y + (goalY - set.y) * 0.3;
    k.run(c.gk, t, 103.6, gy, { speed: SPEED.run, ease: EASE_OUT, z: 0.2 });
    k.ball(t, 103.9, gy, 0.25, EASE_LINEAR, arc);
    k.touch(c.gk, t);
    from = { t, x: 103.9, y: gy };
    touched = c.gk;
  }
  const curveTo = (x: number, y: number, z: number, targetAt = A) => {
    if (touched >= 0) return;
    const startZ = k.at(BALL_SLOT, from.t).z;
    const start = { x: from.x, y: from.y, z: startZ };
    const end = { x, y, z };
    let through: { x: number; y: number; z: number } | null = null;
    let progress = 0.5;
    let dipping = false;
    if (s.via) {
      through = s.via;
    } else if (c.kind === 'screamer' && c.variant === 'dipping') {
      // Keep the folha-seca's late drop, but make it one continuous bend rather than
      // changing direction at a single high waypoint.
      progress = 0.68;
      dipping = true;
      through = {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
        z: 4.1,
      };
    } else if (s.curve !== undefined) {
      through = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2 + s.curve,
        z: s.curveZ ?? 2.4,
      };
    }
    if (!through) return;

    // Fit a cubic through the authored bend. Sampling it into short linear segments keeps
    // the rendered path smooth and avoids a visible kink at the old halfway key.
    const linearAt = (a: number, b: number, u: number) => a + (b - a) * u;
    const cubicAt = (a: number, b: number, c: number, d: number, u: number) => {
      const v = 1 - u;
      return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d;
    };
    let c1 = start;
    let c2 = end;
    if (!dipping) {
      const divisor = 3 * progress * (1 - progress);
      const offset = {
        x: (through.x - linearAt(start.x, end.x, progress)) / divisor,
        y: (through.y - linearAt(start.y, end.y, progress)) / divisor,
        z: (through.z - linearAt(start.z, end.z, progress)) / divisor,
      };
      c1 = {
        x: start.x + (end.x - start.x) / 3 + offset.x,
        y: start.y + (end.y - start.y) / 3 + offset.y,
        z: start.z + (end.z - start.z) / 3 + offset.z,
      };
      c2 = {
        x: start.x + (end.x - start.x) * 2 / 3 + offset.x,
        y: start.y + (end.y - start.y) * 2 / 3 + offset.y,
        z: start.z + (end.z - start.z) * 2 / 3 + offset.z,
      };
    }
    const duration = targetAt - from.t;
    const segments = Math.max(6, Math.min(16, Math.round(duration / 90)));
    const sampleTimes = new Set(Array.from({ length: segments - 1 }, (_, i) => (i + 1) / segments));
    sampleTimes.add(progress);
    for (const u of Array.from(sampleTimes).sort((a, b) => a - b)) {
      const t = from.t + duration * u;
      let sample: { x: number; y: number; z: number };
      if (dipping) {
        const phase = u <= progress ? u / progress : (u - progress) / (1 - progress);
        const eased = phase * phase * (3 - 2 * phase);
        sample = {
          x: linearAt(start.x, end.x, u),
          y: linearAt(start.y, end.y, u),
          z: u <= progress
            ? start.z + (through.z - start.z) * eased
            : through.z + (end.z - through.z) * eased,
        };
      } else {
        sample = {
          x: cubicAt(start.x, c1.x, c2.x, end.x, u),
          y: cubicAt(start.y, c1.y, c2.y, end.y, u),
          z: cubicAt(start.z, c1.z, c2.z, end.z, u),
        };
      }
      k.b.key(BALL_SLOT, k.real(t), sample.x, sample.y, sample.z, EASE_LINEAR);
    }
  };
  const shotArc = (s.curve !== undefined || s.via) && touched < 0 ? 0 : arc;

  if (c.outcome === 'goal') {
    let end = { x: GOAL_NET_ENTRY_X, y: goalY, z: s.shot === 'header' ? 0.4 : 0.25 };
    // Beaten: a fraction behind the ball, or (a penalty) the wrong way altogether.
    let dive: { t: number; y: number; z: number } | null = c.base === 'penalty'
      ? { t: A + 60, y: 34 + inward * 3.4, z: 0.45 }
      : { t: A + 120, y: goalY - inward * 1.6, z: 0.35 };
    let endArc = shotArc;
    switch (f) {
      case 'high':
        // Height projects toward smaller y. Leave room for the enlarged airborne ball to
        // clear the post stroke instead of visually sitting on the frame.
        end = { x: GOAL_NET_ENTRY_X, y: post + inward * 2.4, z: 2.05 };
        dive = { t: A + 100, y: end.y - inward * 1.3, z: 0.95 };
        break;
      case 'chip':
        // He rushes out; the ball goes up and over him.
        k.run(c.gk, A - 450, Math.min(set.x, 101.5), 34 + (s.y - 34) * 0.5, { speed: SPEED.sprint, ease: EASE_SMOOTH });
        k.jump(c.gk, A - 280, 0.7);
        end = { x: GOAL_NET_ENTRY_X, y: 34 + (goalY - 34) * 0.5, z: 1.4 };
        endArc = 3.2;
        dive = null;
        break;
      case 'postin': {
        // Off the inside of the post and in.
        const hit = { x: 105, y: post + inward * 0.15, z: s.shot === 'header' ? 1.5 : 0.9 };
        curveTo(hit.x, hit.y, hit.z, A - 160);
        k.ball(A - 160, hit.x, hit.y, hit.z, EASE_LINEAR, shotArc);
        k.beat(A - 160, 'post', 105, post);
        end = { x: GOAL_NET_ENTRY_X, y: post + inward * 2.4, z: 0.5 };
        endArc = 0;
        dive = { t: A + 40, y: post + inward * 1.7, z: 0.6 };
        break;
      }
      case 'deflect': {
        // Off a body and the keeper is wrong-footed.
        const other = 34 - (goalY - 34);
        if (touched >= 0) {
          end = { x: GOAL_NET_ENTRY_X, y: other, z: 0.4 };
          dive = { t: A + 150, y: set.y + (goalY - set.y) * 0.9, z: 0.4 };
        } else {
          dive = { t: A + 150, y: other, z: 0.4 };
        }
        endArc = 0.3;
        break;
      }
      case 'rebound': {
        // Parried into the six-yard box; the finisher follows in and scores while the keeper is down.
        const firstFlight = shotTravelMs(s, c.finish);
        const A1 = S_CONTACT + Math.max(400, Math.round(firstFlight - 100));
        // The ball meets him on the shooter-facing side; his center stays goal-side of it.
        const T1 = { x: Math.min(103.6, set.x + 0.3), y: set.y + Math.max(-2.5, Math.min(2.5, goalY - set.y)) };
        const keeperAtSave = { x: T1.x + 0.85, y: T1.y };
        k.ball(A1, T1.x, T1.y, 0.6, EASE_LINEAR, shotArc);
        k.run(c.gk, A1 - 380, set.x, set.y, { speed: SPEED.jog });
        k.run(c.gk, A1, keeperAtSave.x, keeperAtSave.y, { speed: SPEED.sprint, z: 0.5 });
        k.run(c.gk, A1 + 260, T1.x, T1.y, { speed: SPEED.jog }); // on the ground
        k.run(c.gk, A + 250, T1.x - 0.2, T1.y, { speed: SPEED.jog, z: 0.1 });
        k.beat(A1, 'save', T1.x, T1.y);
        k.touch(c.gk, A1);
        // It drops ahead of the finisher while he sprints in during the first shot's flight.
        const parry = parryIntoBox(k, A1, T1);
        const target = { x: parry.point.x - 0.7, y: parry.point.y };
        s.reboundTarget = target;
        const receiveAt = Math.max(parry.landsAt, S_CONTACT + reboundRunnerArrivalMs(runner, target));
        const f = sprintToRebound(k, c.finisher, target, runner, receiveAt);
        k.ball(receiveAt, f.x + FOOT, f.y + 0.3, 0.2);
        k.touch(c.finisher, receiveAt);
        // Give him a brief, visible touch to settle the rebound before striking it again.
        const strikeAt = receiveAt + REBOUND_CONTROL_MS;
        const follow = k.run(c.finisher, strikeAt, f.x + 0.35, f.y, { speed: SPEED.run });
        k.ball(strikeAt, follow.x + FOOT, follow.y + 0.3, 0.2);
        k.touch(c.finisher, strikeAt);
        k.beat(strikeAt, 'strike', follow.x + FOOT, follow.y + 0.3, A - strikeAt);
        end = { x: GOAL_NET_ENTRY_X, y: T1.y < 34 ? GOAL_Y_MAX - 1.5 : GOAL_Y_MIN + 1.5, z: 0.4 };
        endArc = 0.3;
        dive = null;
        break;
      }
      case 'fumble':
        end = { x: GOAL_NET_ENTRY_X, y: from.y + (from.y < 34 ? -0.4 : 0.4), z: 0.12 };
        endArc = 0;
        dive = null;
        k.run(c.gk, A + 400, 104.4, end.y, { speed: SPEED.jog, ease: EASE_SMOOTH }); // turns and watches it in
        break;
      case 'nutmeg': {
        // He comes out and spreads himself; it goes through his legs and in.
        end = { x: GOAL_NET_ENTRY_X, y: 34 + (goalY - 34) * 0.4, z: 0.12 };
        const u = Math.min(0.75, Math.max(0.4, (Math.min(102.6, set.x) - s.x) / (end.x - s.x)));
        const K = { x: s.x + (end.x - s.x) * u, y: s.y + (end.y - s.y) * u };
        const tK = Math.round(S_CONTACT + (A - S_CONTACT) * u);
        k.run(c.gk, tK - 160, K.x + 0.4, K.y, { speed: SPEED.sprint });
        k.run(c.gk, tK, K.x + 0.2, K.y, { speed: SPEED.run, z: 0.15 }); // down, legs apart
        k.run(c.gk, A + 400, K.x + 0.5, K.y + 0.3, { speed: SPEED.jog }); // turns to see it go in
        k.ball(tK, K.x + 0.2, K.y, 0.04);
        endArc = 0;
        dive = null;
        break;
      }
      case 'barin': {
        // Off the underside of the bar and straight down over the line.
        const hitY = 34 + (goalY - 34) * 0.55;
        end = { x: GOAL_NET_ENTRY_X, y: hitY, z: GOAL_HEIGHT - 0.06 };
        k.beat(A, 'post', 105, hitY);
        dive = { t: A + 80, y: hitY + (set.y < hitY ? -0.9 : 0.9), z: 0.9 };
        break;
      }
      case 'bounce': {
        // It bounces just in front of him and skids up over his arm.
        end = { x: GOAL_NET_ENTRY_X, y: goalY, z: 0.55 };
        const bx = Math.max(s.x + 3, 101.6);
        const u = (bx - s.x) / (end.x - s.x);
        k.ball(Math.round(A - (A - S_CONTACT) * (1 - u)), bx, s.y + (end.y - s.y) * u, 0, EASE_LINEAR, shotArc);
        endArc = 0.25;
        // Down low for it, and it comes up over him.
        dive = { t: A + 40, y: goalY - inward * 1.2, z: 0.2 };
        break;
      }
      case 'middle': {
        // Down the middle, firmly, as he dives to one side.
        const side = k.rng() < 0.5 ? -1 : 1;
        k.run(c.gk, A - 420, set.x, set.y, { speed: SPEED.jog });
        k.run(c.gk, A - 40, 104.3, 34 + side * 3, { speed: SPEED.sprint, z: 0.5 });
        k.run(c.gk, A + 300, 104.3, 34 + side * 3.3, { speed: SPEED.jog, ease: EASE_OUT });
        end = { x: GOAL_NET_ENTRY_X, y: 34 - side * 0.3, z: 1.1 };
        endArc = 0.4;
        dive = null;
        break;
      }
      case 'panenka': {
        // The keeper commits to a side; the ball is dinked down the middle.
        const side = k.rng() < 0.5 ? -1 : 1;
        k.run(c.gk, A - 650, set.x, set.y, { speed: SPEED.jog });
        k.run(c.gk, A - 250, 104.3, 34 + side * 3.2, { speed: SPEED.sprint, z: 0.5 });
        k.run(c.gk, A + 200, 104.3, 34 + side * 3.4, { speed: SPEED.jog, ease: EASE_OUT });
        end = { x: GOAL_NET_ENTRY_X, y: 34 - side * 0.5, z: 1.3 };
        endArc = 2.4;
        dive = null;
        break;
      }
    }
    if (f !== 'postin' && f !== 'rebound' && f !== 'bounce') curveTo(end.x, end.y, end.z);
    // Rounded keeper: he stays down; nobody dives.
    if (c.variant === 'roundkeeper') dive = null;
    k.ball(A, end.x, end.y, end.z, EASE_LINEAR, endArc);
    if (f === 'barin') {
      // Down off the bar, over the line, and up into the roof of the net.
      k.ball(A + 260, GOAL_NET_ENTRY_X + 0.2, end.y, 0.1, EASE_LINEAR);
      k.ball(A + 520, GOAL_NET_SETTLE_X, end.y, 0.35, EASE_OUT);
    } else {
      // Into the back of the net, where it drops.
      k.ball(A + 260, GOAL_NET_SETTLE_X, end.y + (f === 'postin' ? inward * 0.4 : 0), 0.1, EASE_OUT);
    }
    if (dive) {
      // Beaten: he holds his ground, reads it late and dives a fraction behind the ball.
      k.run(c.gk, A - 300, set.x, set.y, { speed: SPEED.jog });
      k.run(c.gk, dive.t, Math.max(set.x, 104.2), dive.y, { speed: SPEED.sprint, z: dive.z });
    }
    k.beat(A, 'net', 105, end.y);
  } else if (c.outcome === 'save') {
    // A save goes where the keeper can get to from his set position in the last 0.42 s.
    const reach = SPEED.sprint * 0.4;
    let T = {
      x: Math.min(103.6, set.x + 0.3),
      y: Math.min(GOAL_Y_MAX - 0.6, Math.max(GOAL_Y_MIN + 0.6, set.y + Math.max(-reach, Math.min(reach, goalY - set.y)))),
    };
    // Point blank: it hits him almost where he stands.
    if (f === 'reflex') T = { x: Math.min(103.6, set.x + 0.2), y: set.y + Math.max(-0.7, Math.min(0.7, goalY - set.y)) };
    if (f === 'tip' || f === 'onehand') {
      const post = goalY < 34 ? GOAL_Y_MIN : GOAL_Y_MAX;
      T = {
        x: Math.min(103.6, set.x + 0.3),
        y: post < 34 ? post + 1.9 : post + 0.25,
      };
    }
    // Out to meet him, spread wide, half way to the shooter.
    if (f === 'spread') {
      const u = 0.5;
      T = { x: Math.max(s.x + 2.5, s.x + (105 - s.x) * u), y: s.y + (goalY - s.y) * u };
      k.run(c.gk, A - 220, T.x + 0.85, T.y, { speed: SPEED.sprint });
    }
    // Keep him behind the contact point in the attack frame, where increasing x points at
    // goal. Give him the time the actual diagonal run needs, instead of forcing every save
    // into an arbitrary last 0.42 s; if a corner is unreachable, move the contact point to
    // the edge of his real reach so his hands and the ball meet there.
    const keeperAtSave = { x: Math.min(104.65, T.x + 0.85), y: T.y };
    const keeperReadyAt = Math.max(S_CONTACT, k.lastTime(c.gk));
    const keeperAvailableMs = Math.max(0, A - keeperReadyAt);
    const keeperReach = SPEED.sprint * keeperAvailableMs / 1000;
    const keeperDx = keeperAtSave.x - set.x;
    const keeperDy = T.y - set.y;
    const keeperDistance = Math.hypot(keeperDx, keeperDy);
    if (f !== 'spread' && keeperDistance > keeperReach && keeperReach > Math.abs(keeperDx)) {
      const reachableDy = Math.sqrt(keeperReach * keeperReach - keeperDx * keeperDx);
      T.y = Math.max(set.y - reachableDy, Math.min(set.y + reachableDy, T.y));
      keeperAtSave.y = T.y;
    }
    const z = f === 'tip' ? 2.2 : f === 'onehand' ? 1.9 : f === 'feet' || f === 'spread' ? 0.3 : f === 'catch' || f === 'reflex' ? 1.1 : 0.8;
    curveTo(T.x, T.y, z);
    k.ball(A, T.x, T.y, z, EASE_LINEAR, shotArc);
    if (f !== 'spread') {
      const runMs = Math.hypot(keeperAtSave.x - set.x, keeperAtSave.y - set.y) / SPEED.sprint * 1000 + 40;
      k.run(c.gk, Math.max(keeperReadyAt, A - Math.min(keeperAvailableMs, runMs)), set.x, set.y, { speed: SPEED.jog });
    }
    k.run(c.gk, A, keeperAtSave.x, keeperAtSave.y, { speed: SPEED.sprint, z: f === 'tip' || f === 'onehand' ? 0.9 : f === 'feet' ? 0.1 : f === 'spread' ? 0.2 : f === 'reflex' ? 0.15 : f === 'catch' ? 0.35 : 0.5 });
    const away = T.y < 34 ? -1 : 1;
    if (f === 'onehand') {
      // At full stretch, the top hand: round the post for a corner.
      const outY = away < 0 ? GOAL_Y_MIN - 1.8 : GOAL_Y_MAX + 1.8;
      k.ball(A + 450, 106.6, outY, 1, EASE_OUT);
      k.ball(A + 900, 108.6, outY + away * 0.8, 0.1, EASE_OUT);
      k.beat(A + 350, 'out', 105, outY);
      k.run(c.gk, A + 500, T.x - 0.2, T.y + away * 0.4, { speed: SPEED.jog, ease: EASE_OUT });
    } else if (f === 'reflex') {
      // Off his body, straight up in the air; he gathers it as it comes down.
      k.ball(A + 420, T.x - 1.3, T.y, 3.4, EASE_OUT);
      k.ball(A + 880, T.x - 0.8, T.y, 1.5, EASE_LINEAR);
      k.run(c.gk, A + 880, T.x - 0.8 - 0.4, T.y, { speed: SPEED.run, z: 0.45 });
      k.touch(c.gk, A + 880);
      k.run(c.gk, A + 1250, T.x - 1.4, T.y, { speed: SPEED.jog, ease: EASE_OUT });
      k.ball(A + 1250, T.x - 1.4 + 0.5, T.y, 1.1);
    } else if (f === 'spread') {
      // Off his body and away into the box; he is down.
      const side = T.y < 34 ? -1 : 1;
      k.ball(A + 450, T.x - 2.5, T.y + side * 4, 0.3, EASE_OUT, 0.8);
      k.run(c.gk, A + 500, T.x + 0.1, T.y, { speed: SPEED.jog, z: 0.1 });
    } else if (f === 'tip') {
      // Fingertips over the crossbar.
      const tipY = T.y + away;
      k.ball(A + 450, 107.5, tipY, 3.4, EASE_OUT);
      k.ball(A + 850, 109.8, tipY + away * 0.8, 1.7, EASE_LINEAR);
      k.ball(A + 1250, 111.5, tipY + away * 1.5, 0.1, EASE_OUT);
      k.beat(A + 300, 'out', 105, T.y);
    } else if (f === 'parry') {
      k.ball(A + 600, 107, T.y < 34 ? 24 : 44, 0.3, EASE_OUT, 1);
      k.beat(A + 500, 'out', 105, T.y < 34 ? 24 : 44);
    } else if (f === 'double') {
      // Parried out in front; the finisher follows in and shoots again; the keeper, back up,
      // throws himself the other way and saves that too, out for a corner.
      const parry = parryIntoBox(k, A, T);
      const target = { x: parry.point.x - 0.7, y: parry.point.y };
      s.reboundTarget = target;
      const receiveAt = Math.max(parry.landsAt, S_CONTACT + reboundRunnerArrivalMs(runner, target));
      const strikeAt = receiveAt + REBOUND_CONTROL_MS;
      const secondFlight = REBOUND_SECOND_SHOT_MS;
      const secondSaveAt = strikeAt + secondFlight;
      const f = sprintToRebound(k, c.finisher, target, runner, receiveAt);
      k.ball(receiveAt, f.x + FOOT, f.y + 0.3, 0.2);
      k.touch(c.finisher, receiveAt);
      const f2 = k.run(c.finisher, strikeAt, f.x + 0.35, f.y, { speed: SPEED.run });
      k.ball(strikeAt, f2.x + FOOT, f2.y + 0.3, 0.2);
      k.touch(c.finisher, strikeAt);
      k.beat(strikeAt, 'strike', f2.x + FOOT, f2.y + 0.3, secondFlight);
      const toward = T.y < 34 ? 1 : -1;
      const T2 = { x: 103.6, y: Math.min(GOAL_Y_MAX - 0.8, Math.max(GOAL_Y_MIN + 0.8, T.y + toward * 5)) };
      k.ball(secondSaveAt, T2.x, T2.y, 0.5, EASE_LINEAR, 0.3);
      k.run(c.gk, A + 260, T.x - 0.2, T.y, { speed: SPEED.jog, z: 0.1 }); // down, then straight back up
      k.run(c.gk, secondSaveAt, T2.x + 0.85, T2.y, { speed: SPEED.sprint, z: 0.45 });
      k.beat(secondSaveAt, 'save', T2.x, T2.y);
      k.touch(c.gk, secondSaveAt);
      k.beat(secondSaveAt, 'normal', T2.x, T2.y);
      const outAt = secondSaveAt + DOUBLE_SAVE_OUT_MS;
      const outY = T2.y < 34 ? GOAL_Y_MIN - 6 : GOAL_Y_MAX + 6;
      k.ball(outAt, 107, outY, 0.3, EASE_OUT, 1);
      k.beat(outAt - 100, 'out', 105, outY);
      k.run(c.gk, outAt + 50, T2.x - 0.3, T2.y, { speed: SPEED.jog, ease: EASE_OUT });
    } else if (f === 'feet') {
      // Off his leg and back out into the box.
      k.ball(A + 500, T.x - 6, T.y + away * 5, 0.2, EASE_OUT, 0.6);
      k.run(c.gk, A + 600, T.x - 0.3, T.y, { speed: SPEED.jog, ease: EASE_OUT });
    } else {
      // Held: the keeper gathers it and gets up with the ball.
      k.ball(A + 300, T.x - 0.4, T.y, 0.6, EASE_OUT);
      k.run(c.gk, A + 300, T.x + 0.4, T.y, { speed: SPEED.jog, ease: EASE_OUT });
      k.run(c.gk, A + 1200, 101.5, 34 + (T.y - 34) * 0.4, { speed: SPEED.jog, ease: EASE_SMOOTH });
      k.ball(A + 1200, 101.5 - 0.6, 34 + (T.y - 34) * 0.4, 1.1);
    }
    k.beat(A, 'save', T.x, T.y);
    k.touch(c.gk, A);
  } else if (f === 'sidenet') {
    // From the angle, into the side netting: for a moment the crowd thinks it is in.
    const side = nearPost < 34 ? -1 : 1;
    const T = { x: 105.5, y: nearPost + side * 0.35 };
    curveTo(T.x, T.y, 0.7);
    k.ball(A, T.x, T.y, 0.7, EASE_LINEAR, shotArc);
    k.ball(A + 250, 106.5, T.y + side * 0.15, 0.4, EASE_OUT);
    k.ball(A + 700, 106.7, T.y + side * 0.2, 0, EASE_OUT);
    k.run(c.gk, A - 300, set.x, set.y, { speed: SPEED.jog });
    k.run(c.gk, A + 60, Math.max(set.x, 104.2), nearPost - side * 1.1, { speed: SPEED.sprint, z: 0.35 });
    k.beat(A, 'net', 105, nearPost - side * 0.3);
  } else if (f === 'scuffed') {
    // Mishit: it rolls, slowly, wide of the post.
    const side = goalY < 34 ? -1 : 1;
    const T = { x: 105.6, y: (goalY < 34 ? GOAL_Y_MIN : GOAL_Y_MAX) + side * 2.2 };
    k.ball(A, T.x, T.y, 0, EASE_LINEAR);
    k.ball(A + 600, 107.2, T.y + side * 0.4, 0, EASE_OUT);
    k.run(c.gk, A, Math.max(set.x, 103.9), set.y + (T.y - set.y) * 0.3, { speed: SPEED.jog, ease: EASE_SMOOTH });
    k.beat(A, 'out', 105, T.y);
  } else if (f === 'barline') {
    // Off the underside of the bar, down onto the line... and back out, where the keeper,
    // back on his feet, smothers it.
    const hitY = 34 + (goalY - 34) * 0.45;
    const back = hitY < 34 ? 1 : -1;
    curveTo(105, hitY, GOAL_HEIGHT);
    k.ball(A, 105, hitY, GOAL_HEIGHT, EASE_LINEAR, shotArc);
    k.beat(A, 'post', 105, hitY);
    k.ball(A + 260, 104.75, hitY + back * 0.2, 0, EASE_LINEAR);
    k.ball(A + 700, 102.2, hitY + back * 0.8, 1.5, EASE_LINEAR);
    k.ball(A + 1050, 101.6, hitY + back * 1, 0.8, EASE_LINEAR);
    k.run(c.gk, A - 300, set.x, set.y, { speed: SPEED.jog });
    k.run(c.gk, A + 80, Math.max(set.x, 104.2), hitY + (set.y < hitY ? -0.8 : 0.8), { speed: SPEED.sprint, z: 0.9 });
    k.run(c.gk, A + 600, 103.2, hitY + back * 0.6, { speed: SPEED.jog });
    k.run(c.gk, A + 1050, 101.6 + 0.4, hitY + back * 1, { speed: SPEED.run, z: 0.3 });
    k.touch(c.gk, A + 1050);
    k.run(c.gk, A + 1300, 101.8, hitY + back * 1, { speed: SPEED.jog, ease: EASE_OUT });
    k.ball(A + 1300, 101.8 - 0.5, hitY + back * 1, 0.9);
  } else if (f === 'posts') {
    // Off the inside of one post, along the line, off the other post and out.
    const other = post === GOAL_Y_MIN ? GOAL_Y_MAX : GOAL_Y_MIN;
    const back = other < 34 ? -1 : 1;
    curveTo(105, post, 0.6);
    k.ball(A, 104.9, post + inward * 0.2, 0.6, EASE_LINEAR, shotArc);
    k.beat(A, 'post', 105, post);
    k.ball(A + 480, 104.85, other - inward * 0.25, 0.25, EASE_LINEAR);
    k.beat(A + 480, 'post', 105, other);
    k.ball(A + 950, 107, other + back * 1.6, 0.1, EASE_OUT);
    k.beat(A + 850, 'out', 105, other + back * 1.6);
    // Beaten at the near post, he can only watch it run along the line.
    k.run(c.gk, A - 300, set.x, set.y, { speed: SPEED.jog });
    k.run(c.gk, A + 80, Math.max(set.x, 104.2), post + inward * 1.2, { speed: SPEED.sprint, z: 0.4 });
    k.run(c.gk, A + 700, 103.8, post + inward * 2.2, { speed: SPEED.jog, ease: EASE_OUT });
  } else if (f === 'post' || f === 'bar') {
    // The post, or the crossbar.
    const bar = f === 'bar';
    const hitY = bar ? 34 + (goalY - 34) * 0.4 : post;
    curveTo(105, hitY, bar ? GOAL_HEIGHT : 1.3);
    k.ball(A, 105, hitY, bar ? GOAL_HEIGHT : 1.3, EASE_LINEAR, shotArc);
    k.ball(A + 500, 97, hitY + (hitY < 34 ? -4 : 4), bar ? 0.2 : 0.4, EASE_OUT, bar ? 1.6 : 0.8);
    k.run(c.gk, A - 300, set.x, set.y, { speed: SPEED.jog });
    k.run(c.gk, A + 60, Math.max(set.x, 104.2), 34 + (hitY - 34) * 0.6, { speed: SPEED.sprint, z: bar ? 0.8 : 0.4 });
    k.beat(A, 'post', 105, hitY);
  } else if (f === 'cleared') {
    // Past the keeper, but a defender on the line hooks it away for a corner.
    const lineY = goalY + (goalY < 34 ? 0.6 : -0.6);
    const linePoint = { x: 104.82, y: lineY };
    const saver = interceptor(k, c, linePoint, A);
    // Give him most of the ball's flight to get across, then finish the run on the line.
    const approachAt = Math.max(A - 700, Math.min(A, k.lastTime(saver)));
    k.run(saver, approachAt, linePoint.x, linePoint.y, { speed: SPEED.sprint });
    const p = k.run(saver, A, linePoint.x, linePoint.y, { speed: SPEED.sprint, z: 0.3 });
    curveTo(p.x, p.y, 0.4);
    k.ball(A, p.x - 0.12, p.y, 0.4, EASE_LINEAR, shotArc);
    const side = lineY < 34 ? -1 : 1;
    k.ball(A + 550, 106, side < 0 ? GOAL_Y_MIN - 5 : GOAL_Y_MAX + 5, 1.2, EASE_OUT, 1.5);
    // The keeper was already beaten.
    k.run(c.gk, A - 350, set.x, set.y, { speed: SPEED.jog });
    k.run(c.gk, A - 80, Math.max(set.x, 104.2), set.y + (goalY - set.y) * 0.45, { speed: SPEED.sprint, z: 0.4 });
    k.beat(A, 'block', p.x, p.y);
    k.touch(saver, A);
    k.beat(A + 550, 'out', 105, side < 0 ? GOAL_Y_MIN - 5 : GOAL_Y_MAX + 5);
    touched = saver;
  } else if (f === 'blocked') {
    // Off the defender (or the wall) and out for a corner.
    const side = goalY < 34 ? -1 : 1;
    const out = { x: 105.8, y: side < 0 ? GOAL_Y_MIN - 3 - k.rng() * 3 : GOAL_Y_MAX + 3 + k.rng() * 3 };
    k.ball(A, out.x, out.y, 0.6, EASE_LINEAR, 2.2);
    k.ball(A + 450, 109, out.y + side * 1.2, 0.1, EASE_OUT);
    k.run(c.gk, A, Math.max(set.x, 103.8), set.y + (out.y - set.y) * 0.15, { speed: SPEED.jog, ease: EASE_SMOOTH });
    k.beat(A, 'out', 105, out.y);
  } else {
    const over = f === 'over';
    const T = over ? { x: 106, y: 34 + (k.rng() - 0.5) * 5 } : { x: 106, y: goalY < 34 ? GOAL_Y_MIN - 1.4 : GOAL_Y_MAX + 1.4 };
    const z = over ? 3.1 : 0.6;
    const outY = T.y + (T.y - s.y) * 0.15;
    curveTo(T.x, T.y, z);
    k.ball(A, T.x, T.y, z, EASE_LINEAR, shotArc);
    k.ball(A + 500, 110, outY, z * 0.6, EASE_OUT);
    if (over) k.ball(A + 1150, 111.5, outY, 0.1, EASE_OUT);
    k.run(c.gk, A, Math.max(set.x, 104), 34 + (T.y - 34) * 0.25, { speed: SPEED.run, ease: EASE_SMOOTH });
    k.beat(A, 'out', 105, T.y);
  }
  return touched;
}

// ── Everyone else: where they go, so the picture always makes sense. ──

/** Distance from p to the segment a-b. */
function toSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy || 1;
  const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + dx * u), p.y - (a.y + dy * u));
}

/**
 * The players outside the script: defenders drop goal-side of the ball and squeeze
 * towards it (on a counter they sprint back), attackers push up into the box or in
 * support, and nobody wanders into the line of the shot. At a set piece they jostle.
 */
function support(k: Kit, c: Ctx, shot: Shot, skip: Set<number>): void {
  const A = k.sArrival;
  const goal = k.at(BALL_SLOT, A);
  const isKeeper = (s: number) => roleOfSlot(c.sides, s) === 'GK';
  const setPiece = c.base === 'corner' || c.base === 'freekick' || c.base === 'penalty';
  const counter = c.base === 'counter';
  const ballAt = [k.at(BALL_SLOT, 1500), k.at(BALL_SLOT, S_CONTACT)];
  // Out of the shooting lane, and on the same side of it as where the player comes from
  // (so the run between two clear spots never cuts across the shot).
  const dx = goal.x - shot.x, dy = goal.y - shot.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const sideOfLane = (p: Point) => ((p.x - shot.x) * nx + (p.y - shot.y) * ny >= 0 ? 1 : -1);
  const clear = (p: Point, from: Point): Point => {
    const u = ((p.x - shot.x) * dx + (p.y - shot.y) * dy) / (len * len);
    if (u < -0.05 || u > 1.05) return p;
    const want = sideOfLane(from);
    const signed = (p.x - shot.x) * nx + (p.y - shot.y) * ny;
    if (signed * want >= 2.4) return p;
    const shift = want * 2.4 - signed;
    return { x: p.x + nx * shift, y: p.y + ny * shift };
  };
  const free = (s: number) => !skip.has(s) && !k.scripted.has(s) && !c.wall.includes(s) && !c.sentOff.has(s) && !isKeeper(s);
  const startOf = (s: number) => k.at(s, Math.max(k.t0, 1));
  const gap = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const atkFree = c.atkLive.filter(free);
  const defFree = c.defLive.filter(free);

  // Every support run goes through here: to where the player can really get to by t, out of
  // the shot, and at least 1.4 m from anyone else's spot at that moment (trying spots around
  // the one he wanted), so nobody ends up on top of anyone.
  const taken = new Map<number, Point[]>();
  // The players with a part in the play are already there.
  for (const t of [1500, S_CONTACT - 60, A]) {
    const spots: Point[] = [];
    for (const s of [...c.atkLive, ...c.defLive]) if (!free(s) && !isKeeper(s)) spots.push(k.at(s, t));
    taken.set(t, spots);
  }
  const OFFSETS: readonly (readonly [number, number])[] = [[0, 0], [0, 1.5], [0, -1.5], [-1.5, 0], [0, 3], [0, -3], [-3, 0], [-1.5, 1.5], [-1.5, -1.5]];
  const go = (s: number, t: number, wanted: Point, speed: number, ease: Ease = EASE_SMOOTH): Point => {
    const last = k.lastTime(s);
    const from = k.at(s, last);
    const reach = ((speed / (ease === EASE_SMOOTH ? 1.5 : 1)) * Math.max(0, k.span(last, t))) / 1000;
    const reachable = (q: Point) => {
      const d = gap(from, q);
      return d > reach ? { x: from.x + ((q.x - from.x) * reach) / d, y: from.y + ((q.y - from.y) * reach) / d } : q;
    };
    const others = (taken.get(t) ?? []).concat(t !== A ? [] : []);
    // The first spot 1.4 m clear of everyone; failing that, the reachable one farthest from them.
    let spot: Point | null = null;
    let fallback = wanted;
    let fallbackRoom = -1;
    for (const [ox, oy] of OFFSETS) {
      const candidate = clear(reachable(clear({ x: wanted.x + ox, y: wanted.y + oy }, from)), from);
      const room = others.length ? Math.min(...others.map(o => gap(o, candidate))) : Infinity;
      if (room >= 1.4) { spot = candidate; break; }
      if (room > fallbackRoom) { fallbackRoom = room; fallback = candidate; }
    }
    const target = spot ?? fallback;
    const p = k.run(s, t, target.x, target.y, { speed, ease });
    taken.set(t, others.concat([p]));
    return p;
  };

  // A run to a spot by t (out of the shot, spaced), then holding there until the ball has
  // arrived, so nothing carries him into its way.
  const runClear = (s: number, t: number, target: Point, speed: number): Point => {
    const p = go(s, t, target, speed, EASE_LINEAR);
    go(s, A, p, SPEED.jog);
    return p;
  };
  // An attacker in support: into the box if already high up; otherwise up behind the play.
  const supportRun = (s: number) => {
    const p = startOf(s);
    const high = p.x > 72;
    const t1 = go(s, 1500, high ? { x: Math.min(p.x + 4, 95), y: p.y + (34 - p.y) * 0.18 } : { x: p.x + 5, y: p.y }, SPEED.run);
    go(s, A, high ? { x: Math.min(t1.x + 3, 97.5), y: t1.y + (34 - t1.y) * 0.15 } : { x: t1.x + 4, y: t1.y + (ballAt[1].y - t1.y) * 0.1 }, SPEED.run);
  };
  // A defender holding the line: goal-side of the ball, squeezing towards it.
  const holdLine = (s: number) => {
    let last: Point = startOf(s);
    ballAt.forEach((b, i) => {
      const t = i === 0 ? 1500 : A;
      last = go(s, t, {
        x: Math.min(101, Math.max(last.x + (counter ? 7 : 0.5), b.x + 3)),
        y: last.y + (b.y - last.y) * 0.22 + (34 - last.y) * 0.08,
      }, counter ? SPEED.sprint : SPEED.run);
    });
  };

  if (setPiece) {
    // Jostling for position, edging towards where the ball will drop.
    for (const s of [...atkFree, ...defFree]) {
      const p = startOf(s);
      const b = ballAt[1];
      const a1 = go(s, 1500, { x: p.x + (b.x - p.x) * 0.05 + (k.rng() - 0.5) * 0.8, y: p.y + (b.y - p.y) * 0.05 + (k.rng() - 0.5) * 0.8 }, SPEED.jog);
      go(s, A, { x: a1.x + (b.x - a1.x) * 0.08, y: a1.y + (b.y - a1.y) * 0.08 }, SPEED.jog);
    }
    if (c.base !== 'penalty') keeperFollows(k, c);
    return;
  }

  // ── The attack: runs with a purpose. ──
  const used = new Set<number>();
  const runs: { s: number; target: Point }[] = [];
  const aerial = shot.shot === 'header';
  const ballTop = ballAt[1].y < 34;
  const byDepth = [...atkFree].sort((a, b) => startOf(b).x - startOf(a).x);
  // A cross: the near post and the far post are attacked. Otherwise one makes a diagonal
  // run across the line, to the far side of the box, pulling a defender with him.
  const boxTargets: Point[] = aerial
    ? [{ x: 97.2, y: ballTop ? 30.5 : 37.5 }, { x: 98, y: ballTop ? 39.5 : 28.5 }]
    : [{ x: 94.5, y: 34 + (shot.y < 34 ? 6.5 : -6.5) }];
  boxTargets.forEach((target, i) => {
    const s = byDepth[i];
    if (s === undefined || startOf(s).x < 62) return;
    runs.push({ s, target: runClear(s, S_CONTACT - 60, target, SPEED.sprint) });
    used.add(s);
  });
  // One arrives at the edge of the box, for a second ball.
  const edge = byDepth.find(s => !used.has(s) && startOf(s).x > 55);
  if (edge !== undefined) {
    const from = startOf(edge);
    go(edge, A, { x: 86.5, y: 34 + (from.y - 34) * 0.4 }, SPEED.run);
    used.add(edge);
  }
  for (const s of atkFree) if (!used.has(s)) supportRun(s);

  // ── The defence: track the runners, press the ball, hold the line. ──
  const dUsed = new Set<number>();
  for (const r of runs) {
    // Only a defender already goal-side of him can track him (one chasing from behind on a
    // counter is racing back, not marking).
    const d = defFree.filter(s => !dUsed.has(s) && startOf(s).x >= startOf(r.s).x - 1).sort((a, b) => gap(startOf(a), startOf(r.s)) - gap(startOf(b), startOf(r.s)))[0];
    if (d === undefined) break;
    // Goal-side of him, a little inside.
    runClear(d, S_CONTACT - 60, { x: Math.min(103, r.target.x + 1.1), y: r.target.y + (r.target.y < 34 ? 0.7 : -0.7) }, SPEED.sprint);
    dUsed.add(d);
  }
  const carrier = ballAt[0];
  const presser = defFree.filter(s => !dUsed.has(s)).sort((a, b) => gap(startOf(a), carrier) - gap(startOf(b), carrier))[0];
  if (presser !== undefined && gap(startOf(presser), carrier) < 18) {
    const p1 = go(presser, 1500, { x: carrier.x + 2.4, y: carrier.y + (34 - carrier.y) * 0.1 }, SPEED.sprint);
    go(presser, A, { x: ballAt[1].x + 2.8, y: ballAt[1].y + (34 - ballAt[1].y) * 0.15 }, SPEED.run);
    void p1;
    dUsed.add(presser);
  }
  for (const s of defFree) if (!dUsed.has(s)) holdLine(s);
  keeperFollows(k, c);
}

/**
 * The keeper follows the ball through the build-up, on the line between it and the
 * middle of his goal: a little off his line while it is far, back on it as it comes close.
 * Only when nothing else moves him before the strike (a one-on-one rush is scripted).
 */
function keeperFollows(k: Kit, c: Ctx): void {
  const gk = c.gk;
  if (k.hasKeys(gk, k.t0 + 1, S_CONTACT - 1)) return;
  let prev: Point = k.at(gk, k.t0);
  for (let t = k.t0 + 300; t <= S_CONTACT - 450; t += 300) {
    const b = k.at(BALL_SLOT, t);
    const ang = Math.atan2(b.y - 34, b.x - 105);
    const out = Math.min(1.8, Math.max(0.6, (105 - b.x) * 0.06));
    let p = { x: Math.min(104.4, 105 + Math.cos(ang) * out), y: Math.min(36.5, Math.max(31.5, 34 + Math.sin(ang) * out * 1.6)) };
    // A few steps at most between two looks.
    const step = gap2(prev, p);
    const reach = (SPEED.run / 1.5) * 0.3;
    if (step > reach) p = { x: prev.x + ((p.x - prev.x) * reach) / step, y: prev.y + ((p.y - prev.y) * reach) / step };
    k.keyAt(gk, t, p.x, p.y);
    prev = p;
  }
}

const gap2 = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Passes along the ground are not played through an opponent by accident: a defender who
 * would stand right in a fast pass (before the strike) takes half a step aside, if he can
 * within his top speed. Real time.
 */
function clearPassingLanes(k: Kit, c: Ctx, exempt: ReadonlySet<number>, from = k.start + 60, to = k.tm.contactMs - 40, players: number[] = c.defLive, maxZ = 1.2, minSpeed = 9): void {
  for (const s of players) {
    if (exempt.has(s) || roleOfSlot(c.sides, s) === 'GK') continue;
    for (let t = from; t < to; t += 20) {
      const ball = k.b.at(BALL_SLOT, t);
      if (ball.z > maxZ || k.b.at(s, t).z > 0.05) continue;
      const next = k.b.at(BALL_SLOT, t + 20);
      const speed = Math.hypot(next.x - ball.x, next.y - ball.y) / 0.02;
      if (speed < minSpeed) continue;
      const p = k.b.at(s, t);
      const g = Math.hypot(p.x - ball.x, p.y - ball.y);
      if (g >= 0.9) continue;
      // Sideways from the pass, on his own side of it.
      let nx = -(next.y - ball.y), ny = next.x - ball.x;
      const nl = Math.hypot(nx, ny) || 1;
      nx /= nl; ny /= nl;
      if ((p.x - ball.x) * nx + (p.y - ball.y) * ny < 0) { nx = -nx; ny = -ny; }
      const need = 1.3 - Math.abs((p.x - ball.x) * nx + (p.y - ball.y) * ny);
      // At that moment, or just around it (a key right there leaves no room for a step).
      for (const dt of [0, 80, -80, 160]) if (k.nudge(s, t + dt, nx * need, ny * need)) break;
      t += 300;
    }
  }
}

/**
 * Nobody stays on top of anyone: when two players would be closer than 0.7 m for a
 * quarter of a second or more, the one without a part in the play (or, between two
 * such, either) steps away at the middle of that moment, within his top speed. Real time.
 */
function separatePlayers(k: Kit, c: Ctx, keepAlways: ReadonlySet<number>, keepUntil: ReadonlyMap<number, number> = new Map()): void {
  // Who may not be moved at time t: the players with a part in the play, and those with a
  // part only in the lead-in until it is over.
  const keepAt = (s: number, t: number) => keepAlways.has(s) || (keepUntil.get(s) ?? -1) >= t;
  const all = [...c.atkLive, ...c.defLive].filter(s => roleOfSlot(c.sides, s) !== 'GK' || (c.variant === 'halfway' && s === c.gk));
  const STEP = 40;
  const from = k.start + STEP;
  const steps = Math.floor((k.tm.endMs - from) / STEP) + 1;
  // Positions sampled once per player (x, y, grounded), resampled only for whoever moves.
  const xs = new Float32Array(BALL_SLOT * steps);
  const ys = new Float32Array(BALL_SLOT * steps);
  const ground = new Uint8Array(BALL_SLOT * steps);
  // How many times each player has been resampled (moved): a pair checked since neither of
  // them moved would give the same answer again, so it is skipped.
  const version = new Uint16Array(BALL_SLOT);
  const checked = new Map<number, number>();
  const point = new Float32Array(3);
  const sample = (s: number) => {
    const track = k.b.track(s) as Key[];
    for (let i = 0; i < steps; i++) {
      sampleTrack(track, from + i * STEP, point, 0);
      xs[s * steps + i] = point[0]; ys[s * steps + i] = point[1]; ground[s * steps + i] = point[2] < 0.05 ? 1 : 0;
    }
    version[s]++;
  };
  for (const s of all) sample(s);
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i], b = all[j];
        if (keepAlways.has(a) && keepAlways.has(b)) continue;
        const pair = a * 32 + b;
        const stamp = version[a] * 65536 + version[b];
        if (checked.get(pair) === stamp) continue;
        checked.set(pair, stamp);
        let start = -1;
        for (let n = 0; n < steps; n++) {
          const ia = a * steps + n, ib = b * steps + n;
          const dx = xs[ia] - xs[ib], dy = ys[ia] - ys[ib];
          const close = ground[ia] && ground[ib] && dx * dx + dy * dy < 0.49;
          const last = n === steps - 1;
          if (close && start < 0) start = n;
          if ((!close || last) && start >= 0) {
            if ((n - start) * STEP >= 240) {
              const mid = Math.round(from + ((start + n) / 2) * STEP);
              const first = from + start * STEP;
              // A lead-in participant is protected only briefly after his last touch. If two
              // runners overlap through that grace period, resolve it at the midpoint once
              // the protection expires instead of skipping the whole collision window.
              if (keepAt(a, mid) && keepAt(b, mid)) { start = -1; continue; }
              // One of them steps aside; if he cannot (his speed), the other one does.
              const movers = keepAt(a, mid) ? [b] : keepAt(b, mid) ? [a] : [a, b];
              moving: for (const mover of movers) {
                const other = mover === a ? b : a;
                const pm = k.b.at(mover, mid), po = k.b.at(other, mid);
                let dx = pm.x - po.x, dy = pm.y - po.y;
                const d = Math.hypot(dx, dy);
                if (d < 0.01) { dx = 0; dy = 1; } else { dx /= d; dy /= d; }
                const need = 1.3 - d;
                for (const shift of [0, 120, -120, 240]) {
                  const ok = k.nudge(mover, mid + shift, dx * need, dy * need, 9.6, ((n - start) * STEP) / 2);
                  if (ok) { sample(mover); break moving; }
                }
              }
            }
            start = -1;
          }
        }
      }
    }
  }
}

/** After the outcome: the scorer (on an own goal, the attacker) wheels away with his team-mates; everyone else settles. */
function aftermath(k: Kit, c: Ctx, scorer: number): void {
  const A = k.sArrival;
  if (c.outcome === 'goal') {
    // A few strides away towards the nearer touchline, arms out; the two closest team-mates join him.
    const heroAt = k.at(scorer, A);
    const away = heroAt.y < 34 ? -1 : 1;
    // (Never off the pitch: after an Olympic goal he starts right by the flag.)
    const spot = { x: Math.min(100, heroAt.x - 1), y: Math.min(65, Math.max(3, heroAt.y + away * 6)) };
    k.run(scorer, A + 300, heroAt.x, heroAt.y, { speed: SPEED.jog });
    k.run(scorer, k.sEnd, spot.x, spot.y, { speed: SPEED.run, ease: EASE_SMOOTH });
    c.atkLive
      .filter(s => s !== scorer && roleOfSlot(c.sides, s) !== 'GK')
      .map(s => ({ s, d: Math.hypot(k.at(s, A).x - heroAt.x, k.at(s, A).y - heroAt.y) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .forEach(({ s }, i) => k.run(s, k.sEnd, spot.x - 1.6 - i * 0.6, spot.y - away * (1.2 + i * 1.4), { speed: SPEED.run, ease: EASE_SMOOTH }));
  }
  for (let s = 0; s < BALL_SLOT; s++) {
    if (c.sentOff.has(s) || k.lastTime(s) >= k.sEnd) continue;
    const p = k.at(s, k.lastTime(s));
    k.run(s, k.sEnd, p.x + (52.5 - p.x) * 0.04, p.y, { speed: SPEED.jog, ease: EASE_SMOOTH });
  }
}

/**
 * Off the ball, players move like footballers, not from mark to mark: each run flows
 * through the spots the scripts gave it without stopping at every one (its speed smoothed
 * over ~0.4 s, never above what it was), and once the shot is struck they ease off and
 * watch it, stopped by the time it is halfway (nobody sets off as the camera closes in).
 * Real time; rebuilt with a key every 100 ms up to the shot's arrival.
 */
function flowOffBall(k: Kit, skip: ReadonlySet<number>, sentOff: ReadonlySet<number>): void {
  const from = k.start;
  const until = k.tm.arrivalMs;
  const react = k.tm.contactMs + 120;
  const EASE_OFF_MS = 650;
  const STEP = 50;
  const SIGMA = 200 / STEP;
  const n = Math.round((until - from) / STEP);
  const radius = Math.ceil(SIGMA * 3);
  const kernel = Array.from({ length: radius * 2 + 1 }, (_, i) => Math.exp(-((i - radius) ** 2) / (2 * SIGMA * SIGMA)));
  const xs = new Float64Array(n + 1);
  const ys = new Float64Array(n + 1);
  const arc = new Float64Array(n + 1);
  const v = new Float64Array(n);
  for (let s = 0; s < BALL_SLOT; s++) {
    if (skip.has(s) || sentOff.has(s) || k.b.lastTime(s) <= from + 1) continue;
    let airborne = false;
    for (let i = 0; i <= n; i++) {
      const p = k.b.at(s, from + i * STEP);
      xs[i] = p.x; ys[i] = p.y;
      if (p.z > 0.05) airborne = true;
      arc[i] = i === 0 ? 0 : arc[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    }
    if (airborne || arc[n] < 0.3) continue;
    for (let i = 0; i < n; i++) v[i] = arc[i + 1] - arc[i];
    // Smoothed speed (standing still before the play), easing off after the strike.
    const L = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) {
      let sum = 0, wsum = 0;
      for (let j = -radius; j <= radius; j++) {
        const w = kernel[j + radius];
        wsum += w;
        if (i + j >= 0 && i + j < n) sum += v[i + j] * w;
      }
      const t = from + (i + 0.5) * STEP;
      const u = Math.min(1, Math.max(0, (t - react) / EASE_OFF_MS));
      // Resampling a smooth run can otherwise amplify its peak when the path is rebuilt
      // into 100 ms linear segments. Keep the smoothed stride within the pitch speed cap.
      const pace = Math.min(sum / wsum, MAX_PLAYER_SPEED * STEP / 1000);
      L[i + 1] = Math.min(arc[n], L[i] + pace * (1 - u * u * (3 - 2 * u)));
    }
    // Back onto the run's own path, by distance along it.
    let j = 0;
    const along = (d: number): Point => {
      while (j < n && arc[j + 1] < d) j++;
      const seg = arc[j + 1] - arc[j];
      const f = seg > 1e-6 ? (d - arc[j]) / seg : 0;
      return { x: xs[j] + (xs[j + 1] - xs[j]) * f, y: ys[j] + (ys[j + 1] - ys[j]) * f };
    };
    k.b.dropAfter(s, from);
    k.flowing.add(s);
    for (let t = from + 100; t <= until; t += 100) {
      const i = Math.min(n, Math.round((t - from) / STEP));
      const p = along(L[i]);
      k.b.key(s, t, p.x, p.y, 0, EASE_LINEAR);
    }
    if ((until - from) % 100 !== 0) { const p = along(L[n]); k.b.key(s, until, p.x, p.y, 0, EASE_LINEAR); }
  }
}

/** Whether a player really takes part: on the ball, or challenging within a stride of it. */
/**
 * The fastest the ball travels from one key to the next over the given real-time window
 * (m/s along the ground, averaged over each leg: a rolled pass starts quicker and slows).
 * Legs under 60 ms are a foot's touch, not a pass.
 */
export function peakBallSpeed(timeline: Timeline, from: number, to: number): number {
  const track = timeline.tracks[BALL_SLOT];
  let peak = 0;
  for (let i = 1; i < track.length; i++) {
    const a = track[i - 1];
    const b = track[i];
    if (b.t <= from || a.t >= to || b.t - a.t < 60) continue;
    peak = Math.max(peak, Math.hypot(b.x - a.x, b.y - a.y) / ((b.t - a.t) / 1000));
  }
  return peak;
}

/**
 * The stretch a decisive move built at `scale` asks for: enough for the ball to travel at a
 * real pass's speed and, up to MAX_RUN_STRETCH in all, for the attackers to get to their spots.
 */
function decisiveStretch(k: Kit, tm: DangerTiming, scale: number): number {
  const ball = peakBallSpeed(k.b.build(tm.contactMs), tm.decisiveMs, tm.contactMs - 30) / MAX_PASS_SPEED;
  return Math.max(scale, scale * ball, Math.min(MAX_RUN_STRETCH, scale * k.shortfall.decisive));
}

function takesPart(k: Kit, slot: number, from: number, to: number, reach: number): boolean {
  if (k.jumped.has(slot) || k.onBall.has(slot)) return true;
  if (!k.scripted.has(slot)) return false;
  for (let t = from; t <= to; t += 20) {
    const b = k.at(BALL_SLOT, t);
    if (b.z > 2.6) continue;
    const p = k.at(slot, t);
    if (Math.hypot(b.x - p.x, b.y - p.y) < reach) return true;
  }
  return false;
}

// ── The lead-in: where the ball comes from, while the whole team moves. ──

export type LeadPattern = 'carry' | 'pass' | 'switch' | 'combo' | 'wall' | 'recovery' | 'settle' | 'slalom' | 'tikitaka'
  | 'throwin' | 'interception' | 'longball' | 'beat' | 'pivot';
/**
 * How the ball reached the decisive move, for the narration (player ids). A long lead-in
 * also has its moments (`steps`, real ms from the start of the danger), each with the man
 * beaten there if any, for the lines read out along the way.
 */
export interface LeadIn {
  pattern: LeadPattern; ownerId?: string; passerId?: string; secondId?: string; loserId?: string;
  steps?: { at: number; beatenId?: string }[];
}

const LEAD_WEIGHTS: Partial<Record<Base, Partial<Record<LeadPattern, number>>>> = {
  cross: { carry: 2, pass: 3, switch: 2, combo: 2, wall: 1, throwin: 1.5, longball: 1, pivot: 1 },
  through: { pass: 3, combo: 3, wall: 2, carry: 1, recovery: 1, interception: 1.5, longball: 1.5, pivot: 1.5, beat: 1 },
  dribble: { pass: 3, carry: 2, recovery: 2, beat: 2, interception: 1, throwin: 1 },
  longrange: { pass: 3, combo: 2, carry: 1, pivot: 1.5, beat: 1, throwin: 1 },
  counter: { recovery: 4, carry: 1, interception: 3, longball: 1.5 },
  screamer: { pass: 2, carry: 2, combo: 1, beat: 1, pivot: 1 },
};

interface LeadPlan {
  pattern: LeadPattern;
  /** Minimum real time this lead needs for its runs and touches to breathe. */
  durationMs: number;
  /** Everyone's position when the play appears (a few strides before the decisive move). */
  layout: Float32Array;
  ball: Point;
  actors: { owner: number; passer: number; second: number; loser: number };
  /** Scripts the lead-in between real times from and to. */
  perform: (k: Kit, from: number, to: number) => void;
  /** A long lead-in's moments for the narration (ms after it starts; who is beaten there). */
  steps?: { at: number; beaten?: number }[];
}

function planLead(c: Ctx, setup: Setup, decisive: Float32Array, rng: () => number, recent: readonly LeadPattern[] = []): LeadPlan {
  const at = (s: number): Point => ({ x: decisive[s * 3], y: decisive[s * 3 + 1] });
  const pacedMs = (distance: number, speed: number, buffer = 180) => Math.ceil(distance / speed * 1000) + buffer;
  const layout = Float32Array.from(decisive);
  const clampX = (x: number) => Math.min(103, Math.max(2, x));
  const clampY = (y: number) => Math.min(66, Math.max(2, y));
  const place = (s: number, p: Point) => { layout[s * 3] = clampX(p.x); layout[s * 3 + 1] = clampY(p.y); };
  const isKeeper = (s: number) => roleOfSlot(c.sides, s) === 'GK';
  const setPiece = c.base === 'corner' || c.base === 'freekick' || c.base === 'penalty';
  const counter = c.base === 'counter';
  const cast = new Set([c.finisher, c.creator, c.defender, c.gk, c.helper, c.second].filter(s => s >= 0));

  // The team a few strides before: the attack moving up, the defence dropping (on a
  // counter it was caught upfield and sprints back). At a set piece, a short settle.
  for (const s of c.atkLive) {
    if (isKeeper(s)) continue;
    const back = setPiece ? 1.5 + rng() * 1.5 : cast.has(s) ? 3 : 4 + rng() * 2.5;
    place(s, { x: at(s).x - back, y: at(s).y + (rng() - 0.5) * 1.5 });
  }
  for (const s of c.defLive) {
    if (isKeeper(s) || c.wall.includes(s)) continue;
    const back = setPiece ? 1.5 + rng() * 1.5 : counter ? 9 : cast.has(s) ? 2 : 3 + rng() * 1.5;
    place(s, { x: at(s).x - back, y: at(s).y + (rng() - 0.5) * 1.5 });
  }

  // Nobody on top of anyone when the play appears either.
  spreadOut(layout, [...c.atkLive, ...c.defLive].filter(s => !isKeeper(s) || (c.variant === 'halfway' && s === c.gk)), new Set(c.wall.concat(Array.from(cast))), 1.4);

  // Who has the ball when the decisive move starts.
  let owner = -1;
  for (const s of [c.creator, c.finisher, c.helper]) {
    if (s < 0) continue;
    if (Math.hypot(at(s).x + FOOT - setup.ball.x, at(s).y + 0.3 - setup.ball.y) < 0.6) { owner = s; break; }
  }
  const generic = (k: Kit, from: number, to: number, skip: Set<number>) => {
    for (let s = 0; s < BALL_SLOT; s++) {
      if (skip.has(s) || c.sentOff.has(s)) continue;
      const p = at(s);
      const sprintBack = counter && c.defLive.includes(s);
      k.run(s, to, p.x, p.y, { speed: cast.has(s) || sprintBack ? SPEED.sprint : SPEED.run });
    }
    void from;
  };
  const none = { owner, passer: -1, second: -1, loser: -1 };
  const spares0 = c.atkLive.filter(s => !isKeeper(s) && !cast.has(s));
  const defSpares0 = c.defLive.filter(s => !isKeeper(s) && !cast.has(s) && !c.wall.includes(s));
  const nearestIn = (pool: number[], q: Point, not: number[] = []) => pool
    .filter(s => !not.includes(s))
    .sort((a, b) => Math.hypot(layout[a * 3] - q.x, layout[a * 3 + 1] - q.y) - Math.hypot(layout[b * 3] - q.x, layout[b * 3 + 1] - q.y))[0];
  // The long lead-ins of the epics: everyone further back, the move covering half the pitch.
  const pushBack = (atk: number, def: number) => {
    for (const s of c.atkLive) if (!isKeeper(s) && s !== owner) place(s, { x: layout[s * 3] - atk, y: layout[s * 3 + 1] });
    for (const s of c.defLive) if (!isKeeper(s)) place(s, { x: layout[s * 3] - def, y: layout[s * 3 + 1] });
  };

  if (c.variant === 'slalom' && owner === c.finisher && defSpares0.length >= 2) {
    // From his own half: he carries it some 33 m, past one man who lunges and over another's
    // sliding tackle, and arrives at the decisive move at full tilt.
    const Lo = at(owner);
    const side = c.wing;
    const S0 = { x: Lo.x - 33, y: Lo.y + (34 - Lo.y) * 0.25 };
    const W1 = { x: S0.x + 11.5, y: S0.y - side * 2.4 };
    const W2 = { x: S0.x + 23, y: S0.y + side * 1.8 };
    pushBack(16, 13);
    place(owner, S0);
    const first = nearestIn(defSpares0, W1);
    const second = nearestIn(defSpares0, W2, [first]);
    place(first, { x: W1.x + 4.5, y: W1.y + side * 1.4 });
    place(second, { x: W2.x + 5.5, y: W2.y - side * 2.2 });
    spreadOut(layout, [...c.atkLive, ...c.defLive].filter(s => !isKeeper(s)), new Set([owner, first, second]), 1.4);
    const firstLeg = Math.hypot(W1.x - S0.x, W1.y - S0.y);
    const secondLeg = Math.hypot(W2.x - W1.x, W2.y - W1.y);
    const finalLeg = Math.hypot(Lo.x - W2.x, Lo.y - W2.y);
    const t1At = Math.max(1450, pacedMs(firstLeg, SPEED.sprint, 260));
    const t2At = t1At + Math.max(1450, pacedMs(secondLeg, SPEED.sprint, 260));
    // Ten controlled touches at a natural stride cadence, plus enough room to finish the run.
    const durationMs = Math.max(t2At + pacedMs(finalLeg, SPEED.sprint, 260), 60 + 9 * 500 + 250);
    return {
      pattern: 'slalom', durationMs, layout, ball: { x: clampX(S0.x) + FOOT, y: clampY(S0.y) + 0.3 }, actors: { ...none, passer: first, second },
      perform: (k, from, to) => {
        generic(k, from, to, new Set([owner, first, second]));
        const t1 = from + t1At, t2 = from + t2At;
        k.feet(owner, from + 60);
        k.run(owner, t1, W1.x, W1.y, { speed: SPEED.sprint });
        k.run(owner, t2, W2.x, W2.y, { speed: SPEED.sprint });
        k.run(owner, to, Lo.x, Lo.y, { speed: SPEED.sprint });
        for (const t of Array.from({ length: 10 }, (_, i) => from + 60 + i * 500).concat(to)) k.feet(owner, t);
        // The first steps in and lunges as he swerves past; the second slides in and he hops it.
        k.lunge(first, t1, { x: W1.x + 0.7, y: W1.y + side * 1.0 });
        k.run(first, to, W1.x + 7, W1.y + side * 2.5, { speed: SPEED.run });
        const up = k.slideTackle(second, t2, { x: W2.x + 0.4, y: W2.y - side * 1.0 }, owner, 420);
        k.run(second, Math.max(to, up + 300), W2.x + 6, W2.y - side * 3, { speed: SPEED.run });
      },
      steps: [{ at: t1At, beaten: first }, { at: t2At, beaten: second }],
    };
  }

  if (c.variant === 'tikitaka' && owner === c.creator && spares0.length >= 4) {
    // Seven passes between four team-mates moving up from midfield, the pressers always a
    // step late, until it reaches the creator for the decisive pass.
    const Lo = at(owner);
    const side = c.wing;
    const ring = spares0.slice().sort((a, b) => Math.hypot(at(a).x - Lo.x, at(a).y - Lo.y) - Math.hypot(at(b).x - Lo.x, at(b).y - Lo.y)).slice(0, 4);
    // Zig-zagging up the pitch; the last one is the creator, a stride short of his place.
    const points = Array.from({ length: 8 }, (_, i) => i === 7 ? { x: Lo.x - 1.5, y: Lo.y } : ({
      x: Lo.x - 21 + i * (19 / 7),
      y: clampY(Lo.y + (34 - Lo.y) * 0.3 + (i % 2 === 0 ? -side * 5.5 : side * 6.5) + (i % 4 < 2 ? 0 : side * 1.5)),
    }));
    const longestPass = Math.max(...points.slice(0, 7).map((p, i) => Math.hypot(points[i + 1].x - p.x, points[i + 1].y - p.y)));
    const STEP = Math.max(650, pacedMs(longestPass, BALL_SPEED.pass, 160));
    const durationMs = 60 + 7 * STEP + 250;
    const who = [ring[0], ring[1], ring[2], ring[3], ring[0], ring[1], ring[2], owner];
    pushBack(10, 6);
    // Each starts where he first receives it (the creator further back, coming to it).
    for (let i = 6; i >= 0; i--) place(who[i], points[i]);
    place(owner, { x: points[7].x - 5, y: points[7].y });
    const pressers = defSpares0.slice().sort((a, b) => Math.hypot(at(a).x - points[3].x, at(a).y - points[3].y) - Math.hypot(at(b).x - points[3].x, at(b).y - points[3].y)).slice(0, 2);
    pressers.forEach((s, i) => place(s, { x: points[2 + i * 3].x + 7, y: points[2 + i * 3].y + side * (i ? -3 : 3) }));
    spreadOut(layout, [...c.atkLive, ...c.defLive].filter(s => !isKeeper(s)), new Set([...who, ...pressers]), 1.4);
    return {
      pattern: 'tikitaka', durationMs, layout, ball: { x: clampX(points[0].x) + FOOT, y: clampY(points[0].y) + 0.3 }, actors: { ...none, passer: ring[0], second: ring[1] },
      perform: (k, from, to) => {
        generic(k, from, to, new Set([...who, ...pressers]));
        const t = (i: number) => from + 60 + i * STEP;
        for (let i = 0; i < 8; i++) {
          const s = who[i];
          if (i > 0) k.run(s, t(i), points[i].x - 0.6, points[i].y, { speed: SPEED.run });
          k.feet(s, t(i));
        }
        // After his last touch each moves on to his place in the attack.
        const lastTouch = new Map(who.map((s, i) => [s, i] as [number, number]));
        lastTouch.forEach((i, s) => {
          if (s === owner) return;
          const depart = Math.max(to, t(i) + 900);
          const here = k.at(s, depart);
          // Pin the player through the final pass. Support movement is added after this
          // lead-in and will then take over from the held position at its own pace.
          k.run(s, depart, here.x, here.y, { speed: SPEED.run });
        });
        k.run(owner, to, Lo.x, Lo.y, { speed: SPEED.run });
        k.feet(owner, to);
        // The pressers chase each pass and arrive a moment after it has gone.
        pressers.forEach((s, j) => {
          for (let i = 1 + j; i < 7; i += 2) k.run(s, t(i) + 280, points[i].x + 1.8, points[i].y + side * (j ? -1.6 : 1.6), { speed: SPEED.sprint });
          k.run(s, to + 400, at(s).x, at(s).y, { speed: SPEED.run });
        });
      },
      steps: [{ at: 60 + 3 * STEP }, { at: 60 + 6 * STEP }],
    };
  }

  if (setPiece || owner < 0) {
    // The taker walks to the flag (an Olympic goal: the finisher takes it himself).
    const taker = c.variant === 'olimpico' ? c.finisher : c.creator;
    if (c.base === 'corner' && taker >= 0) place(taker, { x: 101.8, y: c.spot.y < 34 ? 3 : 65 });
    return { pattern: 'settle', durationMs: setPiece ? 900 : LEAD_MS, layout, ball: setup.ball, actors: none, perform: (k, from, to) => generic(k, from, to, new Set()) };
  }

  const weights = LEAD_WEIGHTS[c.base] ?? { pass: 1, carry: 1 };
  const spares = c.atkLive.filter(s => !isKeeper(s) && !cast.has(s));
  const defSpares = c.defLive.filter(s => !isKeeper(s) && !cast.has(s) && !c.wall.includes(s));
  const Lo = at(owner);
  // A throw-in needs the touchline close by, and room behind him along it.
  const touchlineGap = Lo.y < 34 ? Lo.y : PITCH_WIDTH - Lo.y;
  const available = (Object.keys(weights) as LeadPattern[]).filter(p =>
    (!['pass', 'switch', 'wall', 'longball', 'throwin'].includes(p) || spares.length > 0) &&
    (p !== 'combo' && p !== 'pivot' || spares.length > 1) &&
    (!['recovery', 'interception', 'beat'].includes(p) || defSpares.length > 0) &&
    (p !== 'throwin' || (touchlineGap <= 18 && Lo.x - 7 >= 8)));
  // The last lead-in played is a tenth as likely, the ones before it a third (still possible, just rarer).
  const weightOf = (p: LeadPattern) => (weights[p] ?? 0) * (recent[recent.length - 1] === p ? 0.1 : recent.includes(p) ? 0.3 : 1);
  const total = available.reduce((sum, p) => sum + weightOf(p), 0);
  let draw = rng() * total;
  const pattern = available.find(p => (draw -= weightOf(p)) < 0) ?? 'carry';

  const side = rng() < 0.5 ? -1 : 1;
  const nearest = (pool: number[], q: Point, not: number[] = []) => pool
    .filter(s => !not.includes(s))
    .sort((a, b) => Math.hypot(at(a).x - q.x, at(a).y - q.y) - Math.hypot(at(b).x - q.x, at(b).y - q.y))[0];
  const toInside = (34 - Lo.y);

  switch (pattern) {
    case 'carry': {
      // He brings it forward himself.
      const s0 = { x: Lo.x - 6.5, y: Lo.y + toInside * 0.12 };
      const durationMs = Math.max(LEAD_MS, pacedMs(Math.hypot(Lo.x - s0.x, Lo.y - s0.y), SPEED.run));
      place(owner, s0);
      return {
        pattern, durationMs, layout, ball: { x: clampX(s0.x) + FOOT, y: clampY(s0.y) + 0.3 }, actors: none,
        perform: (k, from, to) => {
          generic(k, from, to, new Set([owner]));
          k.feet(owner, from + 60);
          k.run(owner, to, Lo.x, Lo.y, { speed: SPEED.run });
          k.feet(owner, to);
        },
      };
    }
    case 'pass':
    case 'switch':
    case 'longball': {
      // A team-mate plays it to him: along the ground from behind, a long ball across, or
      // lofted from deep, over the midfield (he comes on to it).
      const switching = pattern === 'switch';
      const long = pattern === 'longball';
      let Q = switching
        ? { x: Lo.x - 10, y: Math.min(60, Math.max(8, 68 - Lo.y)) }
        : long
          ? { x: Math.max(6, Lo.x - 30), y: Lo.y + toInside * 0.5 }
          : { x: Lo.x - 13, y: Lo.y + toInside * 0.5 + side * 4 };
      const reachMax = switching ? 30 : long ? 32 : 16;
      const d = Math.hypot(Q.x - Lo.x, Q.y - Lo.y);
      if (d > reachMax) Q = { x: Lo.x + ((Q.x - Lo.x) * reachMax) / d, y: Lo.y + ((Q.y - Lo.y) * reachMax) / d };
      const passer = nearest(spares, Q);
      const kickDelay = switching ? 360 : 420;
      const passMs = pacedMs(Math.hypot(Q.x - Lo.x, Q.y - Lo.y), switching || long ? BALL_SPEED.long : BALL_SPEED.pass, 180);
      const durationMs = Math.max(LEAD_MS, kickDelay + passMs, pacedMs(long ? 5 : 3.5, SPEED.run));
      place(passer, Q);
      place(owner, { x: Lo.x - (long ? 5 : 3.5), y: Lo.y });
      return {
        pattern, durationMs, layout, ball: { x: clampX(Q.x) + FOOT, y: clampY(Q.y) + 0.3 }, actors: { ...none, passer },
        perform: (k, from, to) => {
          generic(k, from, to, new Set([owner, passer]));
          const kick = from + kickDelay;
          k.feet(passer, from + 60);
          k.run(passer, kick, Q.x + 1.5, Q.y, { speed: SPEED.jog });
          k.feet(passer, kick);
          k.run(owner, to, Lo.x, Lo.y, { speed: SPEED.run });
          // `feet()` writes the exact receiving touch at the same timestamp. Keep the
          // authored loft on that endpoint so the pass doesn't flatten out mid-flight.
          k.feet(owner, to, 0, switching ? 3.5 : long ? 6 : 0);
          k.run(passer, to + 500, at(passer).x, at(passer).y, { speed: SPEED.run });
        },
      };
    }
    case 'combo': {
      // Two team-mates work it to him with a pass each.
      const Q1 = { x: Lo.x - 15, y: Lo.y + toInside * 0.6 };
      const Q2 = { x: Lo.x - 8, y: Lo.y + toInside * 0.3 + side * 5 };
      const first = nearest(spares, Q1);
      const second = nearest(spares, Q2, [first]);
      const firstPassMs = pacedMs(Math.hypot(Q2.x - Q1.x, Q2.y - Q1.y), BALL_SPEED.pass, 160);
      const secondPassMs = pacedMs(Math.hypot(Lo.x - Q2.x, Lo.y - Q2.y), BALL_SPEED.pass, 200);
      const secondAt = 60 + Math.max(460, firstPassMs);
      const durationMs = Math.max(LEAD_MS, secondAt + secondPassMs);
      place(first, Q1);
      place(second, Q2);
      place(owner, { x: Lo.x - 3.5, y: Lo.y });
      return {
        pattern, durationMs, layout, ball: { x: clampX(Q1.x) + FOOT, y: clampY(Q1.y) + 0.3 }, actors: { ...none, passer: first, second },
        perform: (k, from, to) => {
          generic(k, from, to, new Set([owner, first, second]));
          k.feet(first, from + 60);
          k.run(second, from + secondAt, Q2.x + 1.5, Q2.y, { speed: SPEED.run });
          k.feet(second, from + secondAt);
          k.run(owner, to, Lo.x, Lo.y, { speed: SPEED.run });
          k.feet(owner, to);
          k.run(first, to, at(first).x, at(first).y, { speed: SPEED.run });
          k.run(second, to + 500, at(second).x, at(second).y, { speed: SPEED.run });
        },
      };
    }
    case 'wall': {
      // A one-two: he plays it in to a team-mate and runs on to the return.
      const Q = { x: Lo.x - 1.5, y: Lo.y + Math.sign(toInside || 1) * 5 };
      const partner = nearest(spares, Q);
      const s0 = { x: Lo.x - 6, y: Lo.y };
      const partnerAt = Math.max(560, pacedMs(Math.hypot(Q.x + 0.8 - (s0.x + 1.6), Q.y - s0.y), BALL_SPEED.pass, 240));
      const returnMs = pacedMs(Math.hypot(Lo.x - Q.x, Lo.y - Q.y), BALL_SPEED.pass, 200);
      const durationMs = Math.max(LEAD_MS, partnerAt + returnMs);
      place(partner, Q);
      place(owner, s0);
      return {
        pattern, durationMs, layout, ball: { x: clampX(s0.x) + FOOT, y: clampY(s0.y) + 0.3 }, actors: { ...none, passer: partner },
        perform: (k, from, to) => {
          generic(k, from, to, new Set([owner, partner]));
          k.feet(owner, from + 60);
          k.run(owner, from + 260, s0.x + 1.6, s0.y, { speed: SPEED.run });
          k.feet(owner, from + 260);
          k.run(partner, from + partnerAt, Q.x + 0.8, Q.y, { speed: SPEED.jog });
          k.feet(partner, from + partnerAt);
          k.run(owner, to, Lo.x, Lo.y, { speed: SPEED.run });
          k.feet(owner, to);
          k.run(partner, to + 500, at(partner).x, at(partner).y, { speed: SPEED.run });
        },
      };
    }
    case 'recovery': {
      // The ball is won from an opponent and the attack starts.
      const Q = { x: Lo.x - 2.5, y: Lo.y + side * 2.5 };
      const loser = nearest(defSpares, Q);
      const ownerToBall = Math.hypot(Lo.x - (Q.x - 2.2), Lo.y - (Q.y + 0.2));
      const durationMs = Math.max(LEAD_MS, 450 + pacedMs(ownerToBall, SPEED.sprint, 220));
      place(loser, Q);
      place(owner, { x: Q.x - 2.4, y: Q.y - side * 1.6 });
      return {
        pattern, durationMs, layout, ball: { x: clampX(Q.x) - 0.6, y: clampY(Q.y) + 0.3 }, actors: { ...none, loser },
        perform: (k, from, to) => {
          generic(k, from, to, new Set([owner, loser]));
          // He has it, takes a touch back towards his own goal, and is robbed: a lunge (o
          // bote) that pokes it off his foot.
          const lose = from + 450;
          k.touch(loser, from + 40);
          k.run(loser, lose, Q.x - 1.2, Q.y, { speed: SPEED.jog });
          k.ball(lose, Q.x - 1.9, Q.y + 0.3);
          k.lunge(owner, lose, { x: Q.x - 2.2, y: Q.y + 0.2 }, false);
          k.feet(owner, lose + 40);
          k.run(owner, to, Lo.x, Lo.y, { speed: SPEED.sprint });
          k.feet(owner, to);
          // Beaten, he turns away on his own side (out of the path of the man who robbed him).
          k.run(loser, to, Q.x - 0.5, Q.y + side * 2, { speed: SPEED.jog });
        },
      };
    }
    case 'throwin': {
      // The ball went out by the touchline: a team-mate lifts it over his head and throws it
      // in to him, coming towards it.
      const lineY = Lo.y < 34 ? 0.5 : PITCH_WIDTH - 0.5;
      const T = { x: Lo.x - 7, y: lineY };
      const thrower = nearest(spares, T);
      const ball = { x: T.x + 0.3, y: lineY };
      const throwAt = 560;
      const durationMs = Math.max(LEAD_MS, throwAt + pacedMs(Math.hypot(Lo.x - ball.x, Lo.y - ball.y), 13, 180));
      // On the line itself (place() keeps everyone a couple of metres inside).
      layout[thrower * 3] = clampX(T.x);
      layout[thrower * 3 + 1] = lineY;
      place(owner, { x: Lo.x - 2.5, y: Lo.y });
      return {
        pattern, durationMs, layout, ball, actors: { ...none, passer: thrower },
        perform: (k, from, to) => {
          generic(k, from, to, new Set([owner, thrower]));
          k.run(thrower, from + throwAt, layout[thrower * 3], lineY, { speed: SPEED.jog });
          k.ball(from + 260, ball.x, ball.y, 2.1, EASE_SMOOTH);
          k.ball(from + throwAt, ball.x, ball.y, 2.1);
          k.touch(thrower, from + throwAt);
          k.run(owner, to, Lo.x, Lo.y, { speed: SPEED.run });
          // Preserve the throw's loft through the receiver's touch; a plain feet() key at the
          // same time would replace this arc and flatten the last part of the flight.
          k.feet(owner, to, 0, 1.2);
          k.run(thrower, to + 700, at(thrower).x, at(thrower).y, { speed: SPEED.run });
        },
      };
    }
    case 'interception': {
      // The defence tries to play out; he reads the pass, steps in and cuts it out.
      const Q = { x: Lo.x - 5, y: Lo.y + side * 2 };
      const A0 = { x: Q.x + 6, y: Q.y - side * 4.5 };
      const B = { x: Q.x - 6, y: Q.y + side * 4.5 };
      const loser = nearest(defSpares, A0);
      const target = defSpares.length > 1 ? nearest(defSpares, B, [loser]) : -1;
      const kickAt = 380;
      const cutAt = kickAt + Math.ceil((Math.hypot(Q.x - A0.x, Q.y - A0.y) / 15) * 1000);
      const durationMs = Math.max(LEAD_MS, cutAt + pacedMs(Math.hypot(Lo.x - Q.x, Lo.y - Q.y), SPEED.run, 220));
      place(loser, A0);
      if (target >= 0) place(target, B);
      place(owner, { x: Q.x - 1.8, y: Q.y + side * 2.2 });
      const ball = { x: clampX(A0.x) - 0.6, y: clampY(A0.y) };
      return {
        pattern, durationMs, layout, ball, actors: { ...none, loser },
        perform: (k, from, to) => {
          generic(k, from, to, new Set([owner, loser, target]));
          k.touch(loser, from + 40);
          k.run(loser, from + kickAt, layout[loser * 3], layout[loser * 3 + 1], { speed: SPEED.jog });
          k.ball(from + kickAt, ball.x, ball.y);
          k.touch(loser, from + kickAt);
          k.run(owner, from + cutAt, Q.x - FOOT, Q.y - 0.3, { speed: SPEED.sprint });
          k.feet(owner, from + cutAt);
          k.run(owner, to, Lo.x, Lo.y, { speed: SPEED.run });
          k.feet(owner, to);
          // The man it was meant for comes to meet it, too late; the passer turns to chase.
          if (target >= 0) {
            k.run(target, from + cutAt, B.x + 1.5, B.y - side * 0.8, { speed: SPEED.jog });
            k.run(target, to + 400, at(target).x, at(target).y, { speed: SPEED.run });
          }
          k.run(loser, to, A0.x - 2.5, A0.y + side * 1.5, { speed: SPEED.run });
        },
      };
    }
    case 'beat': {
      // In midfield, a presser steps in and lunges; he swerves past him and is away.
      const s0 = { x: Lo.x - 10, y: Lo.y + toInside * 0.15 };
      const W = { x: s0.x + 4.5, y: s0.y - side * 1.6 };
      const presser = nearest(defSpares, { x: W.x + 2, y: W.y });
      const beatAt = Math.max(650, pacedMs(Math.hypot(W.x - s0.x, W.y - s0.y), SPEED.run, 200));
      const durationMs = Math.max(LEAD_MS, beatAt + pacedMs(Math.hypot(Lo.x - W.x, Lo.y - W.y), SPEED.sprint, 220));
      place(owner, s0);
      place(presser, { x: W.x + 3.2, y: W.y + side * 0.8 });
      return {
        pattern, durationMs, layout, ball: { x: clampX(s0.x) + FOOT, y: clampY(s0.y) + 0.3 }, actors: { ...none, loser: presser },
        perform: (k, from, to) => {
          generic(k, from, to, new Set([owner, presser]));
          const t1 = from + beatAt;
          k.feet(owner, from + 60);
          k.run(owner, t1, W.x, W.y, { speed: SPEED.run });
          k.feet(owner, Math.round((from + 60 + t1) / 2));
          k.feet(owner, t1);
          k.lunge(presser, t1, { x: W.x + 0.7, y: W.y + side * 1.0 });
          k.run(owner, to, Lo.x, Lo.y, { speed: SPEED.sprint });
          k.feet(owner, Math.round((t1 + to) / 2));
          k.feet(owner, to);
          k.run(presser, to, W.x + 5, W.y + side * 2.5, { speed: SPEED.run });
        },
      };
    }
    case 'pivot': {
      // Played up to a team-mate with his back to goal, who lays it off first time for him,
      // arriving from behind.
      const P0 = { x: Lo.x - 13, y: Lo.y + toInside * 0.4 };
      const V = { x: Lo.x + 3, y: Lo.y + toInside * 0.25 + side * 1.2 };
      const passer = nearest(spares, P0);
      const pivot = nearest(spares, V, [passer]);
      const kickAt = 320;
      const layAt = kickAt + pacedMs(Math.hypot(V.x - P0.x, V.y - P0.y), BALL_SPEED.pass, 120);
      const durationMs = Math.max(LEAD_MS, layAt + pacedMs(Math.hypot(Lo.x - V.x, Lo.y - V.y), BALL_SPEED.pass, 200));
      place(passer, P0);
      place(pivot, V);
      place(owner, { x: Lo.x - 6, y: Lo.y - side * 1.2 });
      return {
        pattern, durationMs, layout, ball: { x: clampX(P0.x) + FOOT, y: clampY(P0.y) + 0.3 }, actors: { ...none, passer, second: pivot },
        perform: (k, from, to) => {
          generic(k, from, to, new Set([owner, passer, pivot]));
          k.feet(passer, from + 60);
          k.run(passer, from + kickAt, P0.x + 1, P0.y, { speed: SPEED.jog });
          k.feet(passer, from + kickAt);
          // Back to goal: he takes it on his back foot and plays it straight back.
          k.run(pivot, from + layAt, layout[pivot * 3] - 0.4, layout[pivot * 3 + 1], { speed: SPEED.jog });
          const v = k.at(pivot, from + layAt);
          k.ball(from + layAt, v.x - 0.6, v.y);
          k.touch(pivot, from + layAt);
          k.run(owner, to, Lo.x, Lo.y, { speed: SPEED.run });
          const p = k.at(owner, to);
          k.ball(to, p.x + FOOT, p.y + 0.3);
          k.feet(owner, to);
          k.run(passer, to + 500, at(passer).x, at(passer).y, { speed: SPEED.run });
          k.run(pivot, to + 700, at(pivot).x, at(pivot).y, { speed: SPEED.run });
        },
      };
    }
  }
  return { pattern: 'settle', durationMs: LEAD_MS, layout, ball: setup.ball, actors: none, perform: (k, from, to) => generic(k, from, to, new Set()) };
}

// ── Entry point. ──

function liveSlots(base: number, sentOff: ReadonlySet<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < PLAYERS_PER_SIDE; i++) if (!sentOff.has(base + i)) out.push(base + i);
  return out;
}

function pickByRole(sides: PitchSides, live: number[], roles: string[], exclude: number[]): number {
  for (const role of roles) {
    const s = live.find(slot => !exclude.includes(slot) && roleOfSlot(sides, slot) === role);
    if (s !== undefined) return s;
  }
  return live.find(s => !exclude.includes(s) && roleOfSlot(sides, s) !== 'GK') ?? live[0];
}

export function buildDangerTimeline(input: DangerInput): DangerTimeline {
  const { sides, attackSide, event, outcome, sentOff } = input;
  const mirror = attackSide === 'right';
  const start = createPositionBuffer();
  if (mirror) mirrorBuffer(input.prev, start); else start.set(input.prev);

  const defendSide = otherSide(attackSide);
  const atkBase = slotBase(attackSide);
  const defBase = slotBase(defendSide);
  const atkLive = liveSlots(atkBase, sentOff);
  const defLive = liveSlots(defBase, sentOff);
  const kind: PlayKind = event.play?.kind ?? (outcome === 'goal' && !event.playerId ? 'own_goal' : 'through');
  // A recorded stream: the decisive move may be built twice (see below), drawing the same numbers.
  const draw = seededRandom(input.seed);
  const tape: number[] = [];
  let tapePos = 0;
  const rng = () => { if (tapePos === tape.length) tape.push(draw()); return tape[tapePos++]; };
  const assisted = outcome === 'goal' && !!event.assisterId;
  const variant = input.variant ?? variantFor(kind, rng(), outcome, assisted);
  const finish = input.finish ?? finishFor(kind, variant, outcome, rng());
  const script = scriptOf(kind, variant);
  const actors = resolveDangerActors({ sides, attackSide, event, outcome, sentOff });
  const { finisher, creator, defender, goalkeeper: gk } = actors;
  const helperList = helperRoles(script.base, script.variant);
  const helper = helperList && atkLive.length > 3 ? pickByRole(sides, atkLive.filter(s => roleOfSlot(sides, s) !== 'GK'), helperList, [finisher, creator]) : -1;

  const creatorY = start[creator * 3 + 1];
  const wing: 1 | -1 = script.base === 'cross' ? (creatorY >= 34 ? 1 : -1) : (rng() < 0.5 ? -1 : 1);
  const W = wing < 0 ? 5 : 63;
  const spot: Point = script.base === 'corner'
    ? { x: 104.2, y: W < 34 ? 0.6 : 67.4 }
    : script.base === 'penalty'
      ? { x: 94, y: 34 }
      : script.variant === 'distance'
        ? { x: 68.5 + rng() * 2.5, y: 34 + wing * rng() * 7 } // some 35 m out
        : script.variant === 'flank'
          ? { x: 84 + rng() * 4, y: 34 + wing * (21 + rng() * 5) } // out wide, to be crossed
          : { x: 79 + rng() * 4, y: 34 + wing * (4 + rng() * 8) };
  const c: Ctx = {
    kind, base: script.base, variant: script.variant, outcome, finish, sides, sentOff, wing, W,
    finisher, creator, defender, gk, helper, second: -1, assisted, atkBase, defBase, atkLive, defLive, wall: [], spot,
  };

  const setup = setupFor(c, rng);
  // An assisted dribble starts with the pass: the creator, a few metres back and inside, has the ball.
  if (c.assisted && c.base === 'dribble' && setup.finisher && !setup.creator) {
    setup.creator = { x: setup.finisher.x - 7, y: setup.finisher.y - c.wing * 3 };
    setup.ball = { x: setup.creator.x + FOOT, y: setup.creator.y + 0.3 };
  }
  // A helper the setup does not use is not part of the play.
  if (!setup.helper) c.helper = -1;
  // An assisted flick-on: the assist goes to the flick, so the assist provider flicks and a
  // team-mate takes the corner.
  if (c.assisted && c.base === 'corner' && (c.variant === 'flick' || c.variant === 'backpost') && c.helper >= 0) {
    [c.creator, c.helper] = [c.helper, c.creator];
  }
  if (setup.second) c.second = pickByRole(sides, defLive.filter(s => s !== gk && roleOfSlot(sides, s) !== 'GK'), ['CB', 'CDM', 'LB', 'RB'], [defender]);
  const decisive = startLayout(c, setup, start, rng);
  const lead = planLead(c, setup, decisive, rng, input.recentLeads);
  // Give each lead enough clock for its actual distances and touches. The shot and
  // aftermath clocks are sized from the play too, then shared by narration and pitch.
  const epic = isEpic(kind, variant, finish);
  const leadMs = Math.max(LEAD_MS, lead.durationMs);
  const shotOrigin = { x: decisive[finisher * 3] + FOOT, y: decisive[finisher * 3 + 1] + 0.3 };
  const shotDistance = Math.hypot(105 - shotOrigin.x, 34 - shotOrigin.y);
  const scorer = kind === 'own_goal' ? defender : finisher;
  const hero = { x: decisive[scorer * 3], y: decisive[scorer * 3 + 1] };
  const celebrationAway = hero.y < 34 ? -1 : 1;
  const celebration = { x: Math.min(100, hero.x - 1), y: Math.min(65, Math.max(3, hero.y + celebrationAway * 6)) };
  const celebrationMs = 300 + Math.ceil(Math.hypot(celebration.x - hero.x, celebration.y - hero.y) / (SPEED.run / 1.5) * 1000) + 250;
  const finishBeat = finish === 'barline' ? 450 : finish === 'rebound' || finish === 'double' || finish === 'posts' ? 250 : 0;
  // A double save includes the run during the first shot, the loose-ball travel, control,
  // another strike and the second save. Budget only the part that remains after the first save.
  const runnerDistance = Math.hypot(REBOUND_RUN_TARGET.x - shotOrigin.x, REBOUND_RUN_TARGET.y - shotOrigin.y);
  const quickestFirstSaveMs = Math.max(400, Math.max(520, (shotDistance / STRIKE_SPEED.long_range) * 1000) - 100);
  const runnerArrivalMs = REBOUND_REACTION_MS + runnerDistance / SPEED.sprint * 1000 + REBOUND_CHASE_BUFFER_MS;
  const doubleRecoveryMs = finish === 'double'
    ? Math.max(REBOUND_BALL_TRAVEL_MS, runnerArrivalMs - quickestFirstSaveMs)
      + REBOUND_CONTROL_MS + REBOUND_SECOND_SHOT_MS + DOUBLE_SAVE_OUT_MS + 250
    : 0;
  const aftermathMs = outcome === 'goal'
    ? Math.max(STAGE_MS, celebrationMs)
    : Math.max(1200, 1100 + Math.ceil(shotDistance * 14) + finishBeat, doubleRecoveryMs);
  const entryMs = input.entry === 'cut' ? CUT_MS : FADE_ENTRY_MS;
  // The decisive move is built at its scripted pace first. If a ball would travel faster
  // than a real one or an attacker cannot reach his spot, it is built again with its clock
  // stretched just enough (the same draws, so the same play), never past MAX_DECISIVE_STRETCH.
  const replayFrom = tapePos;
  // A longer clock lets the runs go further, which moves the passes, so it is measured again.
  // The probes only script the move up to the strike; the play is then built once, in full.
  // The probes also find the strike (where from, how), which sets the ball's flight.
  let scale = 1;
  let flightMs = STAGE_MS - 150;
  let probed = -1;
  for (let attempt = 0; attempt < 4; attempt++) {
    const probe = assemble(scale, flightMs, false);
    tapePos = replayFrom;
    probed = scale;
    flightMs = strikeFlightMs(probe.shot, finish, probe.runner);
    if (scale >= MAX_DECISIVE_STRETCH) break;
    const need = decisiveStretch(probe.k, probe.timing, scale);
    if (need <= scale * 1.02) break;
    scale = Math.min(MAX_DECISIVE_STRETCH, need);
  }
  if (probed !== scale) {
    const probe = assemble(scale, flightMs, false);
    flightMs = strikeFlightMs(probe.shot, finish, probe.runner);
    tapePos = replayFrom;
  }
  return assemble(scale, flightMs, true).danger!;

  function assemble(decisiveScale: number, flight: number, full: boolean): { k: Kit; timing: DangerTiming; shot: Shot; runner: ReboundRunner; danger?: DangerTimeline } {
  const timing = dangerTiming(leadMs, flight, entryMs, aftermathMs, decisiveScale);
  const k = new Kit(start, rng, timing);
  const layout = lead.layout;
  layout[BALL_SLOT * 3] = lead.ball.x;
  layout[BALL_SLOT * 3 + 1] = lead.ball.y;
  layout[BALL_SLOT * 3 + 2] = 0;

  if (input.entry === 'cut') {
    k.snapAll(layout, sentOff);
    k.t0 = CUT_MS;
    k.beats.push({ t: 0, kind: 'cut', x: 0, y: 0 });
  } else {
    // The players appear in place, holding while they fade in.
    for (let s = 0; s < BALL_SLOT; s++) {
      if (sentOff.has(s)) continue;
      k.b.key(s, 1, layout[s * 3], layout[s * 3 + 1], 0, EASE_LINEAR);
      k.b.key(s, FADE_ENTRY_MS, layout[s * 3], layout[s * 3 + 1], 0, EASE_LINEAR);
    }
    k.b.key(BALL_SLOT, 1, lead.ball.x, lead.ball.y, 0, EASE_LINEAR);
    k.ball(FADE_ENTRY_MS, lead.ball.x, lead.ball.y);
    k.t0 = FADE_ENTRY_MS;
  }
  // Everyone (and the ball) holds still until the play starts: after a cut, nobody may
  // drift off in the dark before the lead-in begins.
  for (let s = 0; s <= BALL_SLOT; s++) {
    if (s < BALL_SLOT && sentOff.has(s)) continue;
    if (k.b.lastTime(s) < k.t0) { const p = k.b.at(s, k.t0); k.b.key(s, k.t0, p.x, p.y, p.z, EASE_LINEAR); }
  }
  // The lead-in (real time), then the decisive move on its own clock, from k.tm.decisiveMs.
  k.start = k.t0;
  lead.perform(k, k.t0, k.t0 + k.tm.leadMs);
  // Everyone is free again for the decisive move (the support runs include the lead-in's actors).
  k.scripted.clear();
  k.setDecisiveClock(k.t0, k.tm.decisiveMs, k.tm.contactMs);
  k.watched = new Set([c.finisher, c.creator, c.helper].filter(s => s >= 0));

  const shot = SCRIPTS[c.base](k, c);
  k.glueCarries();
  const runner = reboundRunnerState(k, c.finisher);
  const touched = finishShot(k, c, shot, runner);
  if (!full) return { k, timing, shot, runner };

  // Featured with a portrait: only who really takes part.
  const own = kind === 'own_goal';
  const featured: CastEntry[] = [{ slot: scorer, role: 'finisher' }];
  if (creator !== scorer && takesPart(k, creator, k.t0, S_CONTACT, 1.6)) featured.push({ slot: creator, role: 'creator' });
  const blocker = touched >= 0 && touched !== gk && defLive.includes(touched) ? touched : -1;
  if (blocker >= 0 && blocker !== scorer) featured.push({ slot: blocker, role: 'defender' });
  else if (!own && takesPart(k, defender, k.t0 + 150, k.sArrival, 3.2)) featured.push({ slot: defender, role: 'defender' });
  const seen = new Set<number>([gk]);
  const cast = featured.filter(entry => (seen.has(entry.slot) ? false : (seen.add(entry.slot), true))).slice(0, 3);
  cast.push({ slot: gk, role: 'goalkeeper' });

  // The players with a part slow down naturally first; the support runs then fit around
  // where they really end up.
  k.settleRuns(k.tm.endMs, sentOff);
  support(k, c, shot, new Set([finisher, gk, ...k.touchersSince(k.tm.decisiveMs)]));
  flowOffBall(k, new Set([finisher, gk, touched, creator, defender, helper, c.second, ...c.wall, ...cast.map(e => e.slot), ...Array.from(k.jumped), ...k.touchersSince(k.start)]), sentOff);
  clearPassingLanes(k, c, new Set([gk, touched, defender, c.second, ...(c.variant === 'nutmeg' ? [defender] : [])]));
  k.settleRuns(k.tm.endMs, sentOff);
  aftermath(k, c, finisher);
  // With every move in place: nobody stays on top of anyone, and nobody without a part
  // stands in the shot's way during its flight.
  const decisiveTouchers = new Set(k.touchersSince(k.tm.decisiveMs));
  const leadOnly = new Map(k.touchersSince(k.start).filter(s => !decisiveTouchers.has(s)).map(s => [s, k.tm.decisiveMs + 300] as [number, number]));
  const coreParticipants = new Set([finisher, gk, touched, creator, defender, helper, c.second, ...c.wall]);
  const participantGrace = new Map(leadOnly);
  // A touch makes a player part of the move only briefly after his last contact. Keeping
  // every passer protected through the whole aftermath can leave two runners stacked.
  for (const { slot, t } of k.touchLog()) {
    if (t >= k.tm.decisiveMs && !coreParticipants.has(slot)) {
      participantGrace.set(slot, Math.max(participantGrace.get(slot) ?? -1, t + 300));
    }
  }
  separatePlayers(k, c, coreParticipants, participantGrace);
  clearPassingLanes(k, c, new Set([finisher, gk, touched, ...c.wall, ...(own ? [defender] : [])]), k.tm.contactMs + 60, k.tm.arrivalMs, [...c.atkLive, ...c.defLive], 1.9, 3);

  let timeline = k.b.build(k.tm.endMs);
  // A double save keeps the decisive action alive after the first arrival, so frame the
  // whole chase and follow-up instead of cutting the camera range off at the first save.
  let focus = viewOfPlay(timeline, cast.map(entry => entry.slot), timing, finish === 'double');
  let strikeFocus = viewOfStrike(shot);
  let beats = [...k.beats].sort((a, b) => a.t - b.t);
  if (mirror) {
    timeline = mirrorTimeline(timeline);
    focus = { ...mirrorPoint(focus), zoom: focus.zoom };
    strikeFocus = { ...mirrorPoint(strikeFocus), zoom: strikeFocus.zoom };
    beats = beats.map(beat => (beat.kind === 'cut' ? beat : {
      ...beat, ...mirrorPoint(beat),
      ...(beat.fx !== undefined && beat.fy !== undefined ? { fx: PITCH_LENGTH - beat.fx, fy: PITCH_WIDTH - beat.fy } : {}),
    }));
  }
  const idOf = (slot: number) => (slot < 0 ? undefined : slot < PLAYERS_PER_SIDE ? sides.left.playerIds[slot] : sides.right.playerIds[slot - PLAYERS_PER_SIDE]);
  const leadIn: LeadIn = {
    pattern: lead.pattern,
    ownerId: idOf(lead.actors.owner),
    passerId: idOf(lead.actors.passer),
    secondId: idOf(lead.actors.second),
    loserId: idOf(lead.actors.loser),
    ...(lead.steps ? { steps: lead.steps.map(s => ({ at: k.start + s.at, beatenId: s.beaten === undefined ? undefined : idOf(s.beaten) })) } : {}),
  };
  return { k, timing, shot, runner, danger: { timeline, cast, beats, focus, strikeFocus, attackSide, entry: input.entry, variant, finish, lead: leadIn, touches: k.touchLog(), timing, epic } };
  }
}
