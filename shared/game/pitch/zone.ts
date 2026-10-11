/**
 * Open play as the radio tells it: no players on screen, only where the game is.
 * The pitch is split in thirds from the point of view of the side with the ball
 * (its own third, midfield, the attacking third) and the ball rests in that zone,
 * gliding when the zone changes. The minute's events steer it: possession,
 * dominance, corners, and the side about to create a chance.
 */
import { PITCH_LENGTH, PITCH_WIDTH, type Side } from './geometry';

export type Third = 0 | 1 | 2; // own third, midfield, attacking third
export interface Zone { side: Side; third: Third }

const GLIDE_SPEED = 14; // m/s
const MIN_ZONE_MS = 1800;
const CORNER_MS = 2200;

/** Centre of a zone in screen coordinates (the left side attacks to the right). */
export function zoneCentre(zone: Zone): { x: number; y: number } {
  const xs = [17.5, 52.5, 84];
  const x = xs[zone.third];
  return { x: zone.side === 'left' ? x : PITCH_LENGTH - x, y: PITCH_WIDTH / 2 };
}

/** The zone that fits a dominance (0-100 for the side with the ball). */
export function thirdFor(dominance: number): Third {
  if (dominance >= 62) return 2;
  if (dominance <= 38) return 0;
  return 1;
}

export class ZoneModel {
  zone: Zone;
  readonly ball = { x: PITCH_LENGTH / 2, y: PITCH_WIDTH / 2 };
  private time = 0;
  private lastChange = -Infinity;
  private cornerUntil = -Infinity;
  private cornerSpot = { x: 0, y: 0 };

  constructor(zone: Zone, ball?: { x: number; y: number }) {
    this.zone = zone;
    if (ball) { this.ball.x = ball.x; this.ball.y = ball.y; }
  }

  get now(): number { return this.time; }

  /** Moves the game to a zone (at most every 1.8 s, unless forced: a chance is coming). */
  set(zone: Zone, force = false): boolean {
    if (zone.side === this.zone.side && zone.third === this.zone.third) return false;
    if (!force && this.time - this.lastChange < MIN_ZONE_MS) return false;
    this.zone = zone;
    this.lastChange = this.time;
    return true;
  }

  /** A corner: the ball goes to the flag for a moment, then back into the attacking third. */
  corner(side: Side): void {
    this.set({ side, third: 2 }, true);
    this.cornerSpot = { x: side === 'left' ? PITCH_LENGTH - 0.6 : 0.6, y: this.ball.y < PITCH_WIDTH / 2 ? 0.6 : PITCH_WIDTH - 0.6 };
    this.cornerUntil = this.time + CORNER_MS;
  }

  advanceTo(ms: number): void {
    const dt = Math.max(0, ms - this.time) / 1000;
    this.time = Math.max(this.time, ms);
    const resting = zoneCentre(this.zone);
    // A slow sway inside the zone, so the radio view never looks frozen.
    const sway = { x: Math.sin(this.time / 1300) * 2.2, y: Math.sin(this.time / 1700) * 5 };
    const target = this.time < this.cornerUntil ? this.cornerSpot : { x: resting.x + sway.x, y: resting.y + sway.y };
    const dx = target.x - this.ball.x;
    const dy = target.y - this.ball.y;
    const d = Math.hypot(dx, dy);
    const step = Math.min(d, GLIDE_SPEED * dt, d * Math.min(1, dt * 4) + 0.02);
    if (d > 0.001) {
      this.ball.x += (dx / d) * step;
      this.ball.y += (dy / d) * step;
    }
  }
}
