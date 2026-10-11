import { describe, expect, it } from 'vitest';
import { BALL_SLOT, type PitchSides } from './geometry';
import { buildRegroupSegment, kickoffPositions, kickoffTaker } from './flow';
import { createPositionBuffer, sampleTimeline } from './timeline';
import { thirdFor, zoneCentre, ZoneModel } from './zone';

const ids = (p: string) => Array.from({ length: 11 }, (_, i) => `${p}${i}`);
const sides: PitchSides = { left: { teamId: 'L', playerIds: ids('L'), formationId: '4-3-3' }, right: { teamId: 'R', playerIds: ids('R'), formationId: '3-5-2' } };

describe('zona do jogo (visão de rádio)', () => {
  it('os terços são vistos pelo lado de quem tem a bola', () => {
    expect(zoneCentre({ side: 'left', third: 2 }).x).toBeGreaterThan(70);
    expect(zoneCentre({ side: 'right', third: 2 }).x).toBeLessThan(35);
    expect(zoneCentre({ side: 'left', third: 1 }).x).toBeCloseTo(52.5);
    expect([thirdFor(80), thirdFor(50), thirdFor(20)]).toEqual([2, 1, 0]);
  });

  it('a bola desliza até a zona sem passar da velocidade de um passe e fica nela', () => {
    const zone = new ZoneModel({ side: 'left', third: 1 });
    zone.set({ side: 'left', third: 2 }, true);
    let prev = { ...zone.ball };
    for (let t = 16; t <= 6000; t += 16) {
      zone.advanceTo(t);
      expect(Math.hypot(zone.ball.x - prev.x, zone.ball.y - prev.y) / 0.016).toBeLessThanOrEqual(14.5);
      prev = { ...zone.ball };
    }
    const centre = zoneCentre({ side: 'left', third: 2 });
    expect(Math.abs(zone.ball.x - centre.x)).toBeLessThan(3);
    expect(Math.abs(zone.ball.y - centre.y)).toBeLessThan(6);
  });

  it('não troca de zona a cada minuto, só quando forçado ou depois de um tempo', () => {
    const zone = new ZoneModel({ side: 'left', third: 1 });
    zone.advanceTo(1000);
    expect(zone.set({ side: 'right', third: 1 })).toBe(true);
    zone.advanceTo(2000);
    expect(zone.set({ side: 'left', third: 1 })).toBe(false);
    zone.advanceTo(3000);
    expect(zone.set({ side: 'left', third: 1 })).toBe(true);
    expect(zone.set({ side: 'right', third: 2 }, true)).toBe(true);
  });

  it('escanteio leva a bola à bandeira e depois de volta à área', () => {
    const zone = new ZoneModel({ side: 'left', third: 2 }, { x: 84, y: 20 });
    zone.corner('left');
    zone.advanceTo(2100);
    expect(zone.ball.x).toBeGreaterThan(100);
    zone.advanceTo(6000);
    expect(zone.ball.x).toBeLessThan(92);
  });
});

describe('saída de bola', () => {
  it('leva todos ao próprio campo e a bola ao centro', () => {
    const k = buildRegroupSegment(createPositionBuffer(), kickoffPositions(sides, 'right'), 1100, new Set());
    const out = createPositionBuffer();
    sampleTimeline(k, 1100, out);
    for (let s = 0; s < 11; s++) expect(out[s * 3]).toBeLessThanOrEqual(52.5);
    for (let s = 11; s < 22; s++) expect(out[s * 3]).toBeGreaterThanOrEqual(52.5);
    expect(out[BALL_SLOT * 3]).toBeCloseTo(52.5);
    expect(kickoffTaker(sides, 'right')).toBeGreaterThanOrEqual(11);
  });
});
