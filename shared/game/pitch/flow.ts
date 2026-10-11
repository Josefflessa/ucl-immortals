/** Kick-off layout and the regrouping moves between phases (kick-off, shootout). */
import { BALL_SLOT, SIDES, shapeFor, slotBase, type PitchSides, type Side } from './geometry';
import { createPositionBuffer, EASE_OUT, TimelineBuilder, type Timeline } from './timeline';

export function kickoffTaker(sides: PitchSides, side: Side): number {
  const base = slotBase(side);
  const shape = shapeFor('left', sides[side].formationId, { advance: 0, widthScale: 1 });
  let best = 1;
  for (let i = 1; i < shape.length; i++) if (shape[i].x > shape[best].x) best = i;
  return base + best;
}

export function kickoffPositions(sides: PitchSides, kickoff: Side = 'left'): Float32Array {
  const out = createPositionBuffer();
  for (const side of SIDES) {
    const base = slotBase(side);
    shapeFor(side, sides[side].formationId, { advance: 0, widthScale: 1 }).forEach((p, i) => {
      out[(base + i) * 3] = p.x;
      out[(base + i) * 3 + 1] = p.y;
    });
  }
  const taker = kickoffTaker(sides, kickoff);
  out[taker * 3] = kickoff === 'left' ? 51.6 : 53.4;
  out[taker * 3 + 1] = 34;
  out[BALL_SLOT * 3] = 52.5;
  out[BALL_SLOT * 3 + 1] = 34;
  return out;
}

export function buildRegroupSegment(prev: Float32Array, target: Float32Array, durationMs: number, sentOff: ReadonlySet<number>): Timeline {
  const b = new TimelineBuilder(prev);
  for (let s = 0; s < BALL_SLOT; s++) {
    if (sentOff.has(s)) continue;
    b.key(s, durationMs, target[s * 3], target[s * 3 + 1]);
  }
  b.key(BALL_SLOT, durationMs, target[BALL_SLOT * 3], target[BALL_SLOT * 3 + 1], 0, EASE_OUT);
  return b.build(durationMs);
}
