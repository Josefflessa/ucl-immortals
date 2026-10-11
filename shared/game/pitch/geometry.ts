/** Pitch measurements and slot layout for the live pitch. Metres, origin at the
 * top-left corner; the left team attacks to the right (towards x = 105). */
import { FORMATIONS } from '../gameData';

export const PITCH_LENGTH = 105;
export const PITCH_WIDTH = 68;
/** The goal is drawn (and played) 10 m wide, wider than the real 7.32 m, so it
 * always reads bigger than the keeper on a small screen, as 2D football games do. */
export const GOAL_Y_MIN = 29;
export const GOAL_Y_MAX = 39;
export const GOAL_HEIGHT = 2.44;
export const PLAYERS_PER_SIDE = 11;
/** Slots 0-10 are the left XI, 11-21 the right XI (formation order), 22 the ball. */
export const BALL_SLOT = 22;
export const SLOT_COUNT = 23;

export type Side = 'left' | 'right';
export const SIDES: readonly Side[] = ['left', 'right'];

export interface Point { x: number; y: number }
export interface Squad { teamId: string; playerIds: readonly string[]; formationId: string }
export interface PitchSides { left: Squad; right: Squad }

export const slotBase = (side: Side) => (side === 'left' ? 0 : PLAYERS_PER_SIDE);
export const otherSide = (side: Side): Side => (side === 'left' ? 'right' : 'left');
export const sideOfSlot = (slot: number): Side => (slot < PLAYERS_PER_SIDE ? 'left' : 'right');
export const mirrorPoint = (p: Point): Point => ({ x: PITCH_LENGTH - p.x, y: PITCH_WIDTH - p.y });

export function slotOfPlayer(sides: PitchSides, playerId: string | undefined, teamId?: string): number {
  if (!playerId) return -1;
  // Match events identify players by card id, but the same card can appear on
  // both teams. When the event's team is known, resolve only inside that side.
  if (teamId !== undefined) {
    const side = sides.left.teamId === teamId ? 'left' : sides.right.teamId === teamId ? 'right' : null;
    if (!side) return -1;
    const index = sides[side].playerIds.indexOf(playerId);
    if (index < 0 || index >= PLAYERS_PER_SIDE) return -1;
    return slotBase(side) + index;
  }
  const left = sides.left.playerIds.indexOf(playerId);
  if (left >= 0 && left < PLAYERS_PER_SIDE) return left;
  const right = sides.right.playerIds.indexOf(playerId);
  return right >= 0 && right < PLAYERS_PER_SIDE ? PLAYERS_PER_SIDE + right : -1;
}

export function sideOfTeam(sides: PitchSides, teamId: string | undefined): Side | null {
  if (teamId === sides.left.teamId) return 'left';
  if (teamId === sides.right.teamId) return 'right';
  return null;
}

function formation(formationId: string) {
  return FORMATIONS.find(f => f.id === formationId) ?? FORMATIONS.find(f => f.id === '4-4-2') ?? FORMATIONS[0];
}

export function roleOfSlot(sides: PitchSides, slot: number): string {
  const side = sideOfSlot(slot);
  return formation(sides[side].formationId).positions[slot - slotBase(side)]?.role ?? 'CM';
}

/** Kick-off shape of a team attacking to the right: formation slots (x across the
 * width, y 0 = attack) mapped onto its own half. */
export function homeShape(formationId: string): Point[] {
  return formation(formationId).positions.map(p => ({
    x: p.role === 'GK' ? 5 : 6 + (100 - p.y) * 0.47,
    y: (p.x / 100) * PITCH_WIDTH,
  }));
}

/** A team's shape pushed forward by `advance` metres and stretched across by
 * `widthScale`, in screen coordinates for the given side. */
export function shapeFor(side: Side, formationId: string, opts: { advance: number; widthScale: number }): Point[] {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return homeShape(formationId).map((p, i) => {
    const isKeeper = formation(formationId).positions[i]?.role === 'GK';
    const point = isKeeper
      ? { x: clamp(p.x + opts.advance * 0.3, 2, 18), y: 34 + (p.y - 34) * 0.4 }
      : { x: clamp(p.x + opts.advance, 3, 101), y: clamp(34 + (p.y - 34) * opts.widthScale, 2.5, 65.5) };
    return side === 'left' ? point : mirrorPoint(point);
  });
}
