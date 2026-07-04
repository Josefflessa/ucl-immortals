import { describe, it, expect } from 'vitest';
import { sellValue } from './shop';

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
