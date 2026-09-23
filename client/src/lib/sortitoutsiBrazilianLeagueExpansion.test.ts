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
    expect(additions).toHaveLength(124);
    expect(new Set(additions.map(player => player.id)).size).toBe(additions.length);
    expect(new Set(additions.map(player => normalize(player.fullName))).size).toBe(additions.length);

    for (const player of additions) {
      expect(player.photoUrl).toMatch(/^\/players\/sortitoutsi\/sortitoutsi_\d+\.webp$/);
      expect(existsSync(resolve(process.cwd(), 'client/public', player.photoUrl!.slice(1)))).toBe(true);
    }
  });

  it('does not duplicate a player already in the catalog', () => {
    const addedIds = new Set(SORTITOUTSI_BRAZILIAN_LEAGUE_ADDITIONS.map(player => player.id));
    const existingNames = new Set(
      PLAYERS
        .filter(player => !addedIds.has(player.id))
        .flatMap(player => [normalize(player.fullName), normalize(player.shortName)]),
    );

    const overlaps = SORTITOUTSI_BRAZILIAN_LEAGUE_ADDITIONS
      .filter(player => existingNames.has(normalize(player.fullName)) || existingNames.has(normalize(player.shortName)))
      .map(player => player.fullName);

    expect(overlaps).toEqual([]);
    expect(new Set(SORTITOUTSI_BRAZILIAN_LEAGUE_ADDITIONS.map(player => player.club))).toEqual(
      new Set(['Ceará', 'Vasco', 'Atlético Mineiro', 'São Paulo', 'Cruzeiro', 'Juventude', 'Vitória', 'Fluminense', 'Fortaleza', 'Grêmio', 'Mirassol', 'Bragantino', 'Santos', 'Palmeiras', 'Corinthians', 'Sport', 'Internacional', 'Botafogo', 'Bahia', 'Flamengo']),
    );
  });
});
