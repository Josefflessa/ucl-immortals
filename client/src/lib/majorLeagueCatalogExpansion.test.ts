import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYERS } from './gameData';
import {
  MAJOR_LEAGUE_CATALOG_EXPANSION,
  MAJOR_LEAGUE_CATALOG_EXPANSION_LIVE,
  MAJOR_LEAGUE_CATALOG_EXCLUDED_IDS,
} from './majorLeagueCatalogExpansion';

describe('major league catalog expansion', () => {
  it('keeps the audited source expansion at 94 cards', () => {
    expect(MAJOR_LEAGUE_CATALOG_EXPANSION).toHaveLength(94);
  });

  it('activates 93 cards and keeps the known duplicate excluded', () => {
    expect(MAJOR_LEAGUE_CATALOG_EXPANSION_LIVE).toHaveLength(93);
    expect(MAJOR_LEAGUE_CATALOG_EXCLUDED_IDS).toEqual(new Set(['frimpong_leverkusen']));
    expect(MAJOR_LEAGUE_CATALOG_EXPANSION_LIVE.some(player => player.id === 'frimpong_leverkusen')).toBe(false);
  });

  it('uses unique IDs and separates the requested club versions', () => {
    const ids = MAJOR_LEAGUE_CATALOG_EXPANSION.map(player => player.id);
    expect(new Set(ids).size).toBe(ids.length);
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

  it('includes every active card in the live player pool with a local portrait', () => {
    const livePlayerIds = new Set(PLAYERS.map(player => player.id));
    const portraitDirectory = resolve(process.cwd(), 'client/public/players/regular');

    for (const player of MAJOR_LEAGUE_CATALOG_EXPANSION_LIVE) {
      expect(livePlayerIds.has(player.id)).toBe(true);
      expect(existsSync(resolve(portraitDirectory, `${player.id}.webp`))).toBe(true);
    }
  });
});
