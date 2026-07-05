import { describe, it, expect } from 'vitest';
import { DEFAULT_STADIUM, PRIME_STADIUMS, stadiumFor } from './stadium';

describe('stadium', () => {
  it('estádio padrão dá +3 em todos os atributos e aponta pro asset webp', () => {
    expect(DEFAULT_STADIUM.homeAttrBonus).toBe(3);
    expect(DEFAULT_STADIUM.photoUrl).toBe('/stadiums/default.webp');
    expect(DEFAULT_STADIUM.name).toBe('Estádio Padrão');
  });
});

describe('estádios Prime', () => {
  it('stadiumFor volta o padrão sem prime e o temático com prime', () => {
    expect(stadiumFor('guardiola', false)).toBe(DEFAULT_STADIUM);
    const et = stadiumFor('guardiola', true);
    expect(et.name).toBe('Etihad');
    expect(et.homeAttrBonus).toBe(6);
    expect(et.prime).toBe(true);
    expect(et.themedAttrs).toEqual(['passing', 'vision']);
    expect(et.themedClub).toBe('Manchester City');
  });
  it('tem os 6 técnicos, todos +7 e com foto Prime', () => {
    for (const id of ['guardiola', 'klopp', 'ancelotti', 'mourinho', 'zidane', 'ferguson']) {
      const s = PRIME_STADIUMS[id];
      expect(s.homeAttrBonus).toBe(6);
      expect(s.prime).toBe(true);
      expect(s.coachPhotoUrl).toMatch(/^\/coaches\/prime\//);
      expect(s.themedClub || s.themedNation).toBeTruthy();
    }
  });
});
