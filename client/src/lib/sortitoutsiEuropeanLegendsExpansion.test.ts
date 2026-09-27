import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYERS } from './gameData';
import { SORTITOUTSI_EUROPEAN_LEGENDS } from './sortitoutsiEuropeanLegendsExpansion';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

describe('SortitoutSI European legends expansion', () => {
  it('contains only unique, locally illustrated cards', () => {
    const additions = SORTITOUTSI_EUROPEAN_LEGENDS;
    expect(additions).toHaveLength(11);
    expect(new Set(additions.map(player => player.id)).size).toBe(additions.length);
    expect(new Set(additions.map(player => normalize(player.fullName))).size).toBe(additions.length);

    for (const player of additions) {
      expect(player.photoUrl).toMatch(/^\/players\/euro-legends\/(sortitoutsi_\d+|futwiz_[a-z_]+)\.webp$/);
      expect(existsSync(resolve(process.cwd(), 'client/public', player.photoUrl!.slice(1)))).toBe(true);
    }
  });

  it('does not duplicate a player already in the catalog at the same club', () => {
    const addedIds = new Set(SORTITOUTSI_EUROPEAN_LEGENDS.map(player => player.id));
    const existingNameClubPairs = new Set(
      PLAYERS
        .filter(player => !addedIds.has(player.id))
        .flatMap(player => [
          `${normalize(player.fullName)}@${normalize(player.club)}`,
          `${normalize(player.shortName)}@${normalize(player.club)}`,
        ]),
    );

    const overlaps = SORTITOUTSI_EUROPEAN_LEGENDS
      .filter(player => existingNameClubPairs.has(`${normalize(player.fullName)}@${normalize(player.club)}`)
        || existingNameClubPairs.has(`${normalize(player.shortName)}@${normalize(player.club)}`))
      .map(player => player.fullName);

    expect(overlaps).toEqual([]);
  });

  it('spans a realistic overall range for gold/legendary/immortal cards', () => {
    for (const player of SORTITOUTSI_EUROPEAN_LEGENDS) {
      expect(player.overall).toBeGreaterThanOrEqual(80);
      expect(player.overall).toBeLessThanOrEqual(97);
      for (const attribute of ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'composure', 'vision'] as const) {
        expect(player[attribute]).toBeGreaterThanOrEqual(0);
        expect(player[attribute]).toBeLessThanOrEqual(99);
      }
    }
  });
});
