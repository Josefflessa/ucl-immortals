import { describe, it, expect } from 'vitest';
import { DEFAULT_STADIUM, PRIME_STADIUMS, stadiumDisplayFor, stadiumFor } from './stadium';

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
    expect(et.homeAttrBonus).toBe(11);
    expect(et.prime).toBe(true);
    expect(et.themedAttrs).toBeUndefined();
    expect(et.themedClub).toBeUndefined();
  });
  it('tem os 7 técnicos e uma foto Prime para o catálogo visual', () => {
    for (const id of ['guardiola', 'klopp', 'ancelotti', 'mourinho', 'zidane', 'ferguson', 'luis_enrique']) {
      const s = PRIME_STADIUMS[id];
      expect(s.homeAttrBonus).toBe(11);
      expect(s.prime).toBe(true);
      expect(s.coachPhotoUrl).toMatch(/^\/coaches\/prime\//);
      expect(s.themedClub || s.themedNation).toBeFalsy();
    }
  });
  it('nível 5 usa a foto do estádio Prime sem ativar os buffs temáticos do técnico', () => {
    const displayed = stadiumDisplayFor('guardiola', false, 5);
    expect(displayed.name).toBe('Etihad');
    expect(displayed.photoUrl).toBe('/stadiums/etihad.webp');
    expect(displayed.homeAttrBonus).toBe(11);
    expect(displayed.prime).toBe(true);
    expect(displayed.themedAttrs).toBeUndefined();
  });
});
