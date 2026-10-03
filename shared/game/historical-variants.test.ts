import { describe, expect, it } from 'vitest';
import { PLAYERS } from './gameData';

describe('versões históricas', () => {
  it('não reutiliza exatamente os mesmos atributos entre versões do mesmo jogador', () => {
    const variantsByBase = new Map<string, typeof PLAYERS>();

    for (const player of PLAYERS) {
      if (!player.basePlayerId) continue;
      const variants = variantsByBase.get(player.basePlayerId) ?? [];
      variants.push(player);
      variantsByBase.set(player.basePlayerId, variants);
    }

    for (const variants of variantsByBase.values()) {
      if (variants.length < 2) continue;

      const signatures = new Set(
        variants.map(player => [
          player.overall,
          player.pace,
          player.shooting,
          player.passing,
          player.dribbling,
          player.defending,
          player.physical,
          player.composure,
          player.vision,
        ].join(':')),
      );

      expect(signatures.size).toBe(variants.length);
    }
  });
});
