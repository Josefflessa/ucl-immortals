import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYERS } from './gameData';
import { getClubCatalog } from './clubCatalog';
import { getPlayerPhotoDirectory, getPlayerPhotoFilename } from './playerPhotoCatalog';
import { SORTITOUTSI_FACE_IDS, SORTITOUTSI_MAJOR_LEAGUE_ADDITIONS } from './sortitoutsiMajorLeagueExpansion';

describe('expansão de jogadores pesquisada no Sortitoutsi', () => {
  it('não contém ids repetidos e todos os retratos estão identificados pela face de origem', () => {
    const ids = SORTITOUTSI_MAJOR_LEAGUE_ADDITIONS.map(player => player.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(SORTITOUTSI_FACE_IDS).sort()).toEqual([...ids].sort());
  });

  it('usa clubes catalogados e retratos locais no caminho país/liga/clube', () => {
    for (const player of SORTITOUTSI_MAJOR_LEAGUE_ADDITIONS) {
      const catalogPlayer = PLAYERS.find(candidate => candidate.id === player.id);
      expect(catalogPlayer).toBeDefined();
      expect(getClubCatalog(catalogPlayer?.clubId)).not.toBeNull();

      const directory = getPlayerPhotoDirectory(player.id);
      const filename = getPlayerPhotoFilename(player.id);
      expect(filename).toMatch(/^[a-z0-9_]+_[a-z0-9_]+\.webp$/);
      expect(existsSync(resolve(process.cwd(), 'client/public', directory.slice(1), filename ?? ''))).toBe(true);
    }
  });

  it('mantém perfis diferentes por posição, em vez de copiar atributos entre cartas', () => {
    const profiles = SORTITOUTSI_MAJOR_LEAGUE_ADDITIONS.map(player => [
      player.pace, player.shooting, player.passing, player.dribbling,
      player.defending, player.physical, player.composure, player.vision,
    ].join(':'));
    expect(new Set(profiles).size).toBe(profiles.length);
    for (const player of SORTITOUTSI_MAJOR_LEAGUE_ADDITIONS) {
      expect(player.overall).toBeGreaterThanOrEqual(70);
      expect(player.overall).toBeLessThanOrEqual(87);
      for (const attribute of ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'composure', 'vision'] as const) {
        expect(player[attribute]).toBeGreaterThanOrEqual(0);
        expect(player[attribute]).toBeLessThanOrEqual(99);
      }
    }
  });
});
