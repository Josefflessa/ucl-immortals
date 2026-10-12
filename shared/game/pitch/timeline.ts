/** Keyframe tracks for the 22 players and the ball, sampled into a reusable
 * buffer every animation frame (no allocation on the hot path). */
import { PITCH_LENGTH, PITCH_WIDTH, SLOT_COUNT } from './geometry';

export const EASE_SMOOTH = 0;
export const EASE_LINEAR = 1;
export const EASE_OUT = 2;
/**
 * A ball rolling on the grass: it leaves faster than its average speed and arrives
 * slower (1.4x to 0.6x), as friction slows it, without ever stopping.
 */
export const EASE_ROLL = 3;
export type Ease = 0 | 1 | 2 | 3;

/** `ease` and `arc` describe the segment that ENDS at this key; `arc` lifts z by a
 * half sine over that segment (a ball in flight, a jump). */
export interface Key { t: number; x: number; y: number; z: number; ease: Ease; arc: number }
export interface Timeline { duration: number; tracks: Key[][] }

export function createPositionBuffer(): Float32Array {
  return new Float32Array(SLOT_COUNT * 3);
}

function eased(k: number, ease: Ease): number {
  if (ease === EASE_LINEAR) return k;
  if (ease === EASE_OUT) return 1 - (1 - k) * (1 - k);
  if (ease === EASE_ROLL) return k + 0.4 * k * (1 - k);
  return k * k * (3 - 2 * k);
}

export function sampleTrack(track: Key[], t: number, out: Float32Array, offset: number): void {
  const first = track[0];
  if (track.length === 1 || t <= first.t) {
    out[offset] = first.x; out[offset + 1] = first.y; out[offset + 2] = first.z;
    return;
  }
  const last = track[track.length - 1];
  if (t >= last.t) {
    out[offset] = last.x; out[offset + 1] = last.y; out[offset + 2] = last.z;
    return;
  }
  // The first key at or after t (a binary search: off-ball runs carry a key every 100 ms).
  let lo = 1, hi = track.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (track[mid].t < t) lo = mid + 1; else hi = mid;
  }
  const i = lo;
  const a = track[i - 1];
  const b = track[i];
  const raw = (t - a.t) / (b.t - a.t);
  const k = eased(raw, b.ease);
  out[offset] = a.x + (b.x - a.x) * k;
  out[offset + 1] = a.y + (b.y - a.y) * k;
  out[offset + 2] = a.z + (b.z - a.z) * k + (b.arc !== 0 ? Math.sin(Math.PI * raw) * b.arc : 0);
}

export function sampleTimeline(timeline: Timeline, t: number, out: Float32Array): void {
  const time = t < 0 ? 0 : t > timeline.duration ? timeline.duration : t;
  for (let slot = 0; slot < SLOT_COUNT; slot++) sampleTrack(timeline.tracks[slot], time, out, slot * 3);
}

export class TimelineBuilder {
  private readonly tracks: Key[][];
  private readonly scratch = new Float32Array(3);

  constructor(start: Float32Array) {
    this.tracks = Array.from({ length: SLOT_COUNT }, (_, s) => [
      { t: 0, x: start[s * 3], y: start[s * 3 + 1], z: start[s * 3 + 2], ease: EASE_SMOOTH as Ease, arc: 0 },
    ]);
  }

  /** Adds (or replaces, at the same time) a key, keeping the track sorted. */
  key(slot: number, t: number, x: number, y: number, z = 0, ease: Ease = EASE_SMOOTH, arc = 0): this {
    const track = this.tracks[slot];
    const key: Key = { t: Math.max(1, t), x, y, z, ease, arc };
    let i = track.length;
    while (i > 0 && track[i - 1].t > key.t) i--;
    if (i > 0 && track[i - 1].t === key.t) track[i - 1] = key;
    else track.splice(i, 0, key);
    return this;
  }

  /** Pins the slot where it is at time t, so later keys start from there. */
  hold(slot: number, t: number): this {
    const p = this.at(slot, t);
    return this.key(slot, t, p.x, p.y, p.z, EASE_LINEAR);
  }

  at(slot: number, t: number): { x: number; y: number; z: number } {
    sampleTrack(this.tracks[slot], t, this.scratch, 0);
    return { x: this.scratch[0], y: this.scratch[1], z: this.scratch[2] };
  }

  moved(slot: number): boolean {
    return this.tracks[slot].length > 1;
  }

  /** The keys just before and just after t (either may be missing). */
  around(slot: number, t: number): { prev?: Key; next?: Key } {
    const track = this.tracks[slot];
    let prev: Key | undefined;
    let next: Key | undefined;
    for (const key of track) {
      if (key.t <= t) prev = key;
      else { next = key; break; }
    }
    return { prev, next };
  }

  /** How many keys a slot has strictly between two times. */
  keysBetween(slot: number, from: number, to: number): number {
    return this.tracks[slot].filter(key => key.t > from && key.t < to).length;
  }

  /** A slot's keys, in time order (live: changing one changes the track). */
  track(slot: number): readonly Key[] {
    return this.tracks[slot];
  }

  /** Drops every key after t (the first key always stays). */
  dropAfter(slot: number, t: number): this {
    const track = this.tracks[slot];
    let n = track.length;
    while (n > 1 && track[n - 1].t > t) n--;
    track.length = n;
    return this;
  }

  lastTime(slot: number): number {
    const track = this.tracks[slot];
    return track[track.length - 1].t;
  }

  build(duration: number): Timeline {
    return { duration, tracks: this.tracks };
  }
}

export function mirrorTimeline(timeline: Timeline): Timeline {
  return {
    duration: timeline.duration,
    tracks: timeline.tracks.map(track => track.map(k => ({ ...k, x: PITCH_LENGTH - k.x, y: PITCH_WIDTH - k.y }))),
  };
}

export function mirrorBuffer(src: Float32Array, dst: Float32Array): void {
  for (let i = 0; i < src.length; i += 3) {
    dst[i] = PITCH_LENGTH - src[i];
    dst[i + 1] = PITCH_WIDTH - src[i + 1];
    dst[i + 2] = src[i + 2];
  }
}
