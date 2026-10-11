import { describe, expect, it } from 'vitest';
import type { MatchEvent } from '../engine/teamModel';
import { BALL_SLOT, GOAL_HEIGHT, GOAL_Y_MAX, GOAL_Y_MIN, type PitchSides } from './geometry';
import { quickEventCue } from './cues';
import { buildShootoutKick, shootoutLineup, shootoutMissKind, SHOOTOUT_BUILDUP_MS, SHOOTOUT_KICK_MS } from './shootout';
import { createPositionBuffer, sampleTimeline } from './timeline';

const ids = (p: string) => Array.from({ length: 11 }, (_, i) => `${p}${i}`);
const sides: PitchSides = { left: { teamId: 'L', playerIds: ids('L'), formationId: '4-3-3' }, right: { teamId: 'R', playerIds: ids('R'), formationId: '4-4-2' } };
const ev = (e: Partial<MatchEvent>): MatchEvent => ({ minute: 30, type: 'foul', description: '', teamId: 'L', ...e });

describe('marcadores rápidos', () => {
  it('falta destaca infrator e vítima', () => {
    expect(quickEventCue(ev({ type: 'foul', playerId: 'L4', opponentId: 'R9' }), sides)).toMatchObject({ kind: 'foul', slots: [4, 20], side: 'left' });
  });
  it('cartões, lesão e tática', () => {
    expect(quickEventCue(ev({ type: 'yellow', playerId: 'R3', teamId: 'R' }), sides)?.slots).toEqual([14]);
    expect(quickEventCue(ev({ type: 'red', playerId: 'L5' }), sides)?.kind).toBe('red');
    expect(quickEventCue(ev({ type: 'injury', playerId: 'L6' }), sides)?.kind).toBe('injury');
    expect(quickEventCue(ev({ type: 'tactic', tacticAction: 'high_press' }), sides)?.label?.length).toBeGreaterThan(2);
  });
  it('eventos sem marcador', () => {
    expect(quickEventCue(ev({ type: 'momentum' }), sides)).toBeNull();
    expect(quickEventCue(ev({ type: 'stat', statDelta: {} }), sides)).toBeNull();
  });
});

describe('disputa de pênaltis', () => {
  it('alterna defesa e chute para fora como a narração', () => {
    expect([0, 1, 2, 3].map(shootoutMissKind)).toEqual(['save', 'miss', 'save', 'miss']);
  });

  for (const [isGoal, kickIndex] of [[true, 0], [false, 0], [false, 1]] as const) {
    it(`cobrança ${isGoal ? 'convertida' : shootoutMissKind(kickIndex)}`, () => {
      const prev = shootoutLineup(sides);
      const k = buildShootoutKick({ sides, prev, takerSlot: 20, goalkeeperSlot: 0, isGoal, kickIndex, seed: 5 });
      const out = createPositionBuffer();
      sampleTimeline(k.timeline, SHOOTOUT_BUILDUP_MS, out);
      const x = out[BALL_SLOT * 3], y = out[BALL_SLOT * 3 + 1], z = out[BALL_SLOT * 3 + 2];
      if (isGoal) {
        expect(x).toBeGreaterThanOrEqual(105);
        expect(y).toBeGreaterThan(GOAL_Y_MIN);
        expect(y).toBeLessThan(GOAL_Y_MAX);
        expect(z).toBeLessThan(GOAL_HEIGHT);
      } else if (shootoutMissKind(kickIndex) === 'save') {
        expect(Math.hypot(x - out[0], y - out[1])).toBeLessThan(1.5);
      } else {
        expect(y < GOAL_Y_MIN || y > GOAL_Y_MAX || z > GOAL_HEIGHT).toBe(true);
      }
      expect(k.timeline.duration).toBe(SHOOTOUT_KICK_MS);
      expect(k.cast.map(c => c.slot)).toEqual([20, 0]);
    });
  }
});
