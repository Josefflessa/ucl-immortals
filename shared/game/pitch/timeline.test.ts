import { describe, expect, it } from 'vitest';
import { BALL_SLOT, homeShape, PITCH_LENGTH, PITCH_WIDTH, shapeFor, slotOfPlayer, type PitchSides } from './geometry';
import { createPositionBuffer, EASE_LINEAR, mirrorBuffer, mirrorTimeline, sampleTimeline, TimelineBuilder } from './timeline';

const ids = (p: string) => Array.from({ length: 11 }, (_, i) => `${p}${i}`);
const sides: PitchSides = { left: { teamId: 'L', playerIds: ids('L'), formationId: '4-3-3' }, right: { teamId: 'R', playerIds: ids('R'), formationId: '4-4-2' } };

describe('geometria', () => {
  it('a formação do time da esquerda fica no próprio campo, com o goleiro na pequena área', () => {
    const shape = homeShape('4-3-3');
    expect(shape).toHaveLength(11);
    expect(shape[0].x).toBeLessThan(8);
    for (const p of shape) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(PITCH_LENGTH / 2);
      expect(p.y).toBeGreaterThan(0);
      expect(p.y).toBeLessThan(PITCH_WIDTH);
    }
  });

  it('o time da direita é o espelho', () => {
    const left = shapeFor('left', '4-3-3', { advance: 0, widthScale: 1 });
    const right = shapeFor('right', '4-3-3', { advance: 0, widthScale: 1 });
    left.forEach((p, i) => {
      expect(right[i].x).toBeCloseTo(PITCH_LENGTH - p.x);
      expect(right[i].y).toBeCloseTo(PITCH_WIDTH - p.y);
    });
  });

  it('acha o slot de um jogador e ignora os reservas', () => {
    expect(slotOfPlayer(sides, 'L3')).toBe(3);
    expect(slotOfPlayer(sides, 'R10')).toBe(21);
    expect(slotOfPlayer(sides, 'nada')).toBe(-1);
  });
});

describe('linha do tempo', () => {
  it('interpola entre quadros-chave e respeita o arco da bola', () => {
    const start = createPositionBuffer();
    const b = new TimelineBuilder(start);
    b.key(BALL_SLOT, 1000, 10, 20, 0, EASE_LINEAR, 4);
    const tl = b.build(1000);
    const out = createPositionBuffer();
    sampleTimeline(tl, 500, out);
    expect(out[BALL_SLOT * 3]).toBeCloseTo(5);
    expect(out[BALL_SLOT * 3 + 1]).toBeCloseTo(10);
    expect(out[BALL_SLOT * 3 + 2]).toBeCloseTo(4); // peak of the arc
    sampleTimeline(tl, 5000, out); // clamped to the end
    expect(out[BALL_SLOT * 3]).toBeCloseTo(10);
  });

  it('insere quadros fora de ordem no lugar certo', () => {
    const b = new TimelineBuilder(createPositionBuffer());
    b.key(0, 1000, 10, 0, 0, EASE_LINEAR);
    b.key(0, 500, 2, 0, 0, EASE_LINEAR);
    expect(b.build(1000).tracks[0].map(k => k.t)).toEqual([0, 500, 1000]);
  });

  it('espelha posições e linhas do tempo', () => {
    const src = createPositionBuffer();
    src[0] = 10; src[1] = 5;
    const dst = createPositionBuffer();
    mirrorBuffer(src, dst);
    expect(dst[0]).toBeCloseTo(95);
    expect(dst[1]).toBeCloseTo(63);
    const b = new TimelineBuilder(src);
    b.key(0, 100, 20, 30);
    const m = mirrorTimeline(b.build(100));
    expect(m.tracks[0][1].x).toBeCloseTo(85);
    expect(m.tracks[0][1].y).toBeCloseTo(38);
  });
});
