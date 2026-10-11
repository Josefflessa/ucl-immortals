import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYERS } from '@shared/game/gameData';
import { FIFAINDEX_FAMOUS_ADDITIONS } from '@shared/game/players/fifaIndexFamousExpansion';
import { FIFAINDEX_VERSION_ADDITIONS } from '@shared/game/players/fifaIndexVersionsExpansion';
import { FIFAINDEX_ALBUM_CLUB_ADDITIONS } from '@shared/game/players/fifaIndexAlbumClubsExpansion';
import { buildPlayerCatalog } from './playerCatalog';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

describe('fifaindex famous additions', () => {
  it('contains only unique, locally illustrated cards', () => {
    const additions = FIFAINDEX_FAMOUS_ADDITIONS;
    expect(additions).toHaveLength(107);
    expect(new Set(additions.map(player => player.id)).size).toBe(additions.length);
    expect(new Set(additions.map(player => normalize(player.fullName))).size).toBe(additions.length);
    for (const player of additions) {
      expect(player.photoUrl).toMatch(/^\/players\/fifaindex-famous\/\d+\.webp$/);
      expect(existsSync(resolve(process.cwd(), 'client/public', player.photoUrl!.slice(1)))).toBe(true);
    }
  });

  it('does not reuse an id or duplicate a person already in the catalog', () => {
    const addedIds = new Set(FIFAINDEX_FAMOUS_ADDITIONS.map(player => player.id));
    // Later batches add these same people at other clubs on purpose (other versions): they
    // are not duplicates of this one, which only brought people new to the catalogue.
    const laterVersions = new Set([...FIFAINDEX_VERSION_ADDITIONS, ...FIFAINDEX_ALBUM_CLUB_ADDITIONS].map(player => player.id));
    const rest = PLAYERS.filter(player => !addedIds.has(player.id) && !laterVersions.has(player.id));
    const existingFullNames = new Set(rest.map(player => normalize(player.fullName)));
    expect(PLAYERS.filter(player => addedIds.has(player.id))).toHaveLength(FIFAINDEX_FAMOUS_ADDITIONS.length);
    expect(FIFAINDEX_FAMOUS_ADDITIONS.filter(player => existingFullNames.has(normalize(player.fullName))).map(p => p.fullName)).toEqual([]);
  });

  it('keeps attributes in range and rarity consistent with the overall', () => {
    for (const player of FIFAINDEX_FAMOUS_ADDITIONS) {
      expect(player.overall).toBeGreaterThanOrEqual(80);
      expect(player.overall).toBeLessThanOrEqual(93);
      const expected = player.overall <= 87 ? 'gold' : 'legendary';
      expect(player.rarity).toBe(expected);
      for (const attribute of ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'composure', 'vision'] as const) {
        expect(player[attribute]).toBeGreaterThanOrEqual(1);
        expect(player[attribute]).toBeLessThanOrEqual(99);
      }
    }
  });

  it('resolves every club to a registered crest', () => {
    expect(() => buildPlayerCatalog()).not.toThrow();
  });
});
