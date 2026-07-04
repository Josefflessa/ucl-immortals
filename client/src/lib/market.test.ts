import { describe, it, expect } from 'vitest';
import { marketMinPrice } from './market';
import { Player } from './gameData';

const mk = (rarity: string): Player => ({
  id: 'x', shortName: 'X', fullName: 'X', position: 'ST', nation: 'Brasil', club: 'Milan',
  season: 'Única', rarity, overall: 80, pace: 80, shooting: 80, passing: 80, dribbling: 80,
  defending: 80, physical: 80, vision: 80, composure: 80, traits: [],
} as unknown as Player);

describe('marketMinPrice — piso = valor da banca', () => {
  it('usa o sellValue da raridade', () => {
    expect(marketMinPrice(mk('bronze'))).toBe(30);
    expect(marketMinPrice(mk('gold'))).toBe(100);
    expect(marketMinPrice(mk('unique'))).toBe(400);
  });
});
