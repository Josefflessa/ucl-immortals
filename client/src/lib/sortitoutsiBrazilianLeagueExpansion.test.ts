import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYERS } from './gameData';
import { SORTITOUTSI_BRAZILIAN_LEAGUE_ADDITIONS } from './sortitoutsiBrazilianLeagueExpansion';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

describe('SortitoutSI Brazilian league expansion', () => {
  it('contains only unique, locally illustrated cards', () => {
    const additions = SORTITOUTSI_BRAZILIAN_LEAGUE_ADDITIONS;
    expect(additions).toHaveLength(166);
    expect(new Set(additions.map(player => player.id)).size).toBe(additions.length);
    expect(new Set(additions.map(player => normalize(player.fullName))).size).toBe(additions.length);

    for (const player of additions) {
      expect(player.photoUrl).toMatch(/^\/players\/sortitoutsi\/sortitoutsi_\d+\.webp$/);
      expect(existsSync(resolve(process.cwd(), 'client/public', player.photoUrl!.slice(1)))).toBe(true);
    }
  });

  it('does not duplicate a player already in the catalog at the same club', () => {
    const addedIds = new Set(SORTITOUTSI_BRAZILIAN_LEAGUE_ADDITIONS.map(player => player.id));
    const existingNameClubPairs = new Set(
      PLAYERS
        .filter(player => !addedIds.has(player.id))
        .flatMap(player => [
          `${normalize(player.fullName)}@${normalize(player.club)}`,
          `${normalize(player.shortName)}@${normalize(player.club)}`,
        ]),
    );

    const overlaps = SORTITOUTSI_BRAZILIAN_LEAGUE_ADDITIONS
      .filter(player => existingNameClubPairs.has(`${normalize(player.fullName)}@${normalize(player.club)}`)
        || existingNameClubPairs.has(`${normalize(player.shortName)}@${normalize(player.club)}`))
      .map(player => player.fullName);

    expect(overlaps).toEqual([]);
    expect(new Set(SORTITOUTSI_BRAZILIAN_LEAGUE_ADDITIONS.map(player => player.club))).toEqual(
      new Set(['Ceará', 'Vasco', 'Atlético Mineiro', 'São Paulo', 'Cruzeiro', 'Juventude', 'Vitória', 'Fluminense', 'Fortaleza', 'Grêmio', 'Mirassol', 'Bragantino', 'Santos', 'Palmeiras', 'Corinthians', 'Sport', 'Internacional', 'Botafogo', 'Bahia', 'Flamengo']),
    );
  });
});
