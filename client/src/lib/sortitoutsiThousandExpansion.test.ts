import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYERS } from './gameData';
import { getClubCatalog } from './clubCatalog';
import { getPlayerPhotoDirectory, getPlayerPhotoFilename } from './playerPhotoCatalog';
import { SORTITOUTSI_1000_ADDITIONS, SORTITOUTSI_1000_FACE_IDS } from './sortitoutsiThousandExpansion';

const normalizeName = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .replace(/[^a-z0-9]/g, '');

const normalizeClub = (value: string) => normalizeName(value);

const nameTokens = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('pt-BR')
  .match(/[a-z0-9]+/g)?.length ?? 0;

function likelySameClubIdentity(left: typeof PLAYERS[number], right: typeof PLAYERS[number]): boolean {
  if (normalizeClub(left.club) !== normalizeClub(right.club)) return false;

  const leftFullName = normalizeName(left.fullName);
  const rightFullName = normalizeName(right.fullName);
  const fullNameMatch = leftFullName === rightFullName
    || (nameTokens(left.fullName) >= 2 && rightFullName.includes(leftFullName))
    || (nameTokens(right.fullName) >= 2 && leftFullName.includes(rightFullName));

  // Alguns jogadores são catalogados pelo apelido (por exemplo, "Pedri"),
  // então o nome curto também precisa participar da verificação. Ele é usado
  // apenas em igualdade exata e dentro do mesmo clube para evitar falsos
  // positivos de nomes parecidos, como Gabriel e Gabriel Jesus.
  return fullNameMatch || normalizeName(left.shortName) === normalizeName(right.shortName);
}

describe('lote de fechamento dos 1.000 jogadores', () => {
  it('adiciona exatamente 75 ids inéditos e sem repetir identidade no mesmo clube', () => {
    const ids = SORTITOUTSI_1000_ADDITIONS.map(player => player.id);
    expect(ids).toHaveLength(75);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(SORTITOUTSI_1000_FACE_IDS).sort()).toEqual([...ids].sort());

    const addedIds = new Set(ids);
    const previousPlayers = PLAYERS.filter(player => !addedIds.has(player.id));
    for (const addedPlayer of SORTITOUTSI_1000_ADDITIONS) {
      expect(previousPlayers.some(previousPlayer => likelySameClubIdentity(addedPlayer, previousPlayer))).toBe(false);
    }
  });

  it('fecha o catálogo em 1.000 e mantém cada carta ligada a clube e retrato locais', () => {
    expect(PLAYERS).toHaveLength(1000);

    for (const player of SORTITOUTSI_1000_ADDITIONS) {
      const catalogPlayer = PLAYERS.find(candidate => candidate.id === player.id);
      expect(catalogPlayer).toBeDefined();
      expect(getClubCatalog(catalogPlayer?.clubId)).not.toBeNull();

      const directory = getPlayerPhotoDirectory(player.id);
      const filename = getPlayerPhotoFilename(player.id);
      expect(filename).toMatch(/^[a-z0-9_]+_[a-z0-9_]+\.webp$/);
      expect(existsSync(resolve(process.cwd(), 'client/public', directory.slice(1), filename ?? ''))).toBe(true);
    }
  });

  it('não deixa duas identidades prováveis no mesmo clube em todo o pool', () => {
    const playersByClub = new Map<string, typeof PLAYERS>();
    for (const player of PLAYERS) {
      const clubPlayers = playersByClub.get(normalizeClub(player.club)) ?? [];
      clubPlayers.push(player);
      playersByClub.set(normalizeClub(player.club), clubPlayers);
    }

    for (const clubPlayers of playersByClub.values()) {
      for (let leftIndex = 0; leftIndex < clubPlayers.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < clubPlayers.length; rightIndex += 1) {
          expect(likelySameClubIdentity(clubPlayers[leftIndex], clubPlayers[rightIndex])).toBe(false);
        }
      }
    }
  });

  it('mantém atributos individuais e faixas coerentes', () => {
    const profiles = SORTITOUTSI_1000_ADDITIONS.map(player => [
      player.pace, player.shooting, player.passing, player.dribbling,
      player.defending, player.physical, player.composure, player.vision,
    ].join(':'));
    expect(new Set(profiles).size).toBe(profiles.length);

    for (const player of SORTITOUTSI_1000_ADDITIONS) {
      expect(player.overall).toBeGreaterThanOrEqual(70);
      expect(player.overall).toBeLessThanOrEqual(88);
      for (const attribute of ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'composure', 'vision'] as const) {
        expect(player[attribute]).toBeGreaterThanOrEqual(0);
        expect(player[attribute]).toBeLessThanOrEqual(99);
      }
    }
  });
});
