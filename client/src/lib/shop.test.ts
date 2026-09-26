import { describe, it, expect } from 'vitest';
import { sellValue, canEvolvePrime, PRIME_COST, PRIME_WINS_REQUIRED, SHOP_COSTS } from './shop';

describe('Pacote Único', () => {
  it('custa 750 pontos', () => {
    expect(SHOP_COSTS.uniqueCard).toBe(750);
  });
});

describe('canEvolvePrime', () => {
  it('exige 4 vitórias E 350 pontos', () => {
    expect(PRIME_COST).toBe(350);
    expect(PRIME_WINS_REQUIRED).toBe(4);
    expect(canEvolvePrime(4, 350)).toBe(true);
    expect(canEvolvePrime(10, 800)).toBe(true);
    expect(canEvolvePrime(3, 500)).toBe(false);
    expect(canEvolvePrime(4, 349)).toBe(false);
  });
});

describe('sellValue — valor de venda por raridade', () => {
  it('cada raridade tem o valor calibrado', () => {
    expect(sellValue('bronze')).toBe(30);
    expect(sellValue('silver')).toBe(60);
    expect(sellValue('gold')).toBe(100);
    expect(sellValue('legendary')).toBe(180);
    expect(sellValue('immortal')).toBe(250);
    expect(sellValue('unique')).toBe(400);
  });
  it('raridade desconhecida cai no fallback bronze (30)', () => {
    expect(sellValue('inexistente')).toBe(30);
  });
});
