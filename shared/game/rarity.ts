import type { Rarity } from './gameData';

// Raridade das cartas regulares: a faixa é determinada só pelo overall BASE.
// Única fonte de verdade, usada pelo catálogo (gameData) e pelos arquivos de expansão.
export function rarityForBaseOverall(overall: number): Exclude<Rarity, 'unique'> {
  if (overall <= 74) return 'bronze';
  if (overall <= 79) return 'silver';
  if (overall <= 87) return 'gold';
  if (overall <= 93) return 'legendary';
  return 'immortal';
}
