import { describe, expect, it } from 'vitest';
import { bestDraw, flipOrder, gridLayout, seeded, tierOf } from './gachaTiers';

describe('gacha tiers', () => {
  it('waits longer and shows more as the rarity grows', () => {
    const order = ['bronze', 'silver', 'gold', 'legendary', 'immortal', 'unique'] as const;
    for (let i = 1; i < order.length; i++) {
      expect(tierOf(order[i]).rank).toBeGreaterThan(tierOf(order[i - 1]).rank);
      expect(tierOf(order[i]).chargeMs).toBeGreaterThan(tierOf(order[i - 1]).chargeMs);
    }
    expect(tierOf('bronze').rays).toBe(0);
    expect(tierOf('immortal').shake).toBe(true);
  });

  it('picks the best draw, the first one on a tie', () => {
    expect(bestDraw([{ rarity: 'gold', id: 1 }, { rarity: 'legendary', id: 2 }, { rarity: 'legendary', id: 3 }, { rarity: 'silver', id: 4 }])?.id).toBe(2);
    expect(bestDraw([])).toBeUndefined();
  });

  it('flips from the weakest to the best, keeping the original order among equals', () => {
    expect(flipOrder(['gold', 'bronze', 'immortal', 'bronze', 'silver'])).toEqual([1, 3, 4, 0, 2]);
  });
});

describe('gridLayout', () => {
  it('shows one card alone and never makes cards unreadably small or huge', () => {
    expect(gridLayout(1, 400, 800).columns).toBe(1);
    for (const [w, h] of [[360, 640], [475, 873], [1440, 620], [1440, 900]]) {
      const { scale } = gridLayout(10, w, h);
      expect(scale).toBeGreaterThanOrEqual(0.3);
      expect(scale).toBeLessThanOrEqual(0.72);
    }
  });

  it('keeps all ten cards inside the area', () => {
    for (const [w, h] of [[475, 873 - 215], [1440, 620 - 215], [1440, 900 - 215]]) {
      const { columns, scale } = gridLayout(10, w, h);
      const rows = Math.ceil(10 / columns);
      expect(rows * (324 * scale + 66) + 14).toBeLessThanOrEqual(h + 1);
      expect(columns * 200 * scale + (columns - 1) * 12 + 32).toBeLessThanOrEqual(w + 1);
    }
  });

  it('spreads the cards on a wide short screen and stacks them on a tall one or a phone', () => {
    expect(gridLayout(10, 1440, 405).columns).toBe(10);
    expect(gridLayout(10, 1440, 700).columns).toBe(5);
    expect(gridLayout(10, 475, 700).columns).toBeGreaterThanOrEqual(3);
    expect(gridLayout(2, 1440, 700).columns).toBe(3 > 2 ? 2 : 3);
  });
});

describe('gridLayout without fitting the height (phone summary)', () => {
  it('makes cards as big as the width allows, in 2 or 3 columns', () => {
    const phone = gridLayout(10, 390, 300, false);
    expect(phone.columns).toBe(3);
    expect(phone.scale).toBeGreaterThan(0.5);
    expect(gridLayout(3, 390, 300, false).columns).toBe(3);
    expect(gridLayout(2, 390, 300, false).columns).toBe(2);
  });
});

describe('seeded', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = seeded(5), b = seeded(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
