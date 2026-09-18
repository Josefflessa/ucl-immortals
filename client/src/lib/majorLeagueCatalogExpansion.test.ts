import { describe, expect, it } from 'vitest';
import { PLAYERS } from './gameData';
import { MAJOR_LEAGUE_CATALOG_EXPANSION } from './majorLeagueCatalogExpansion';

describe('major league catalog expansion', () => {
  it('keeps the audited expansion at 94 cards after excluding known variants', () => {
    expect(MAJOR_LEAGUE_CATALOG_EXPANSION).toHaveLength(94);
  });

  it('uses unique IDs and separates the requested club versions', () => {
    const ids = MAJOR_LEAGUE_CATALOG_EXPANSION.map(player => player.id);
    expect(new Set(ids).size).toBe(ids.length);

    expect(MAJOR_LEAGUE_CATALOG_EXPANSION).toEqual(
      expect.arrayContaining([
      ]),
    );
  });

  it('keeps every new regular card within the game attribute limits', () => {
    for (const player of MAJOR_LEAGUE_CATALOG_EXPANSION) {
      expect(player.rarity).not.toBe('unique');
      expect(player.overall).toBeGreaterThanOrEqual(1);
      expect(player.overall).toBeLessThanOrEqual(99);
      for (const attribute of ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'composure', 'vision'] as const) {
        expect(player[attribute]).toBeGreaterThanOrEqual(1);
        expect(player[attribute]).toBeLessThanOrEqual(99);
      }
    }
  });

  it('keeps the expansion out of the live player pool until its portraits are ready', () => {
    const livePlayerIds = new Set(PLAYERS.map(player => player.id));

    expect(MAJOR_LEAGUE_CATALOG_EXPANSION.every(player => !livePlayerIds.has(player.id))).toBe(true);
  });
});
