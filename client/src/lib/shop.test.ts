import { describe, it, expect } from 'vitest';
import { sellValue, canEvolvePrime, PRIME_COST, PRIME_WINS_REQUIRED } from './shop';

describe('canEvolvePrime', () => {
  it('exige 4 vitórias E 500 pontos', () => {
    expect(PRIME_COST).toBe(500);
    expect(PRIME_WINS_REQUIRED).toBe(4);
    expect(canEvolvePrime(4, 500)).toBe(true);
    expect(canEvolvePrime(10, 800)).toBe(true);
    expect(canEvolvePrime(3, 500)).toBe(false);
    expect(canEvolvePrime(4, 499)).toBe(false);
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
