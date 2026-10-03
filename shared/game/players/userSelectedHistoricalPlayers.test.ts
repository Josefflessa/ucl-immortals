import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYERS } from '../gameData';
import { USER_SELECTED_HISTORICAL_PLAYERS } from './userSelectedHistoricalPlayers';

const normalize = (value: string) => value
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]/g, '');

describe('cartas históricas selecionadas pelo usuário', () => {
  it('contém os cinco jogadores e retratos locais fornecidos', () => {
    expect(USER_SELECTED_HISTORICAL_PLAYERS).toHaveLength(5);
    expect(new Set(USER_SELECTED_HISTORICAL_PLAYERS.map(player => player.id)).size).toBe(5);

    for (const player of USER_SELECTED_HISTORICAL_PLAYERS) {
      expect(player.photoUrl).toMatch(/^\/players\/euro-legends\/[a-z_]+\.webp$/);
      expect(existsSync(resolve(process.cwd(), 'client/public', player.photoUrl!.slice(1)))).toBe(true);
    }
  });

  it('não repete uma identidade já existente no catálogo', () => {
    const addedIds = new Set(USER_SELECTED_HISTORICAL_PLAYERS.map(player => player.id));
    const existingIdentities = new Set(
      PLAYERS
        .filter(player => !addedIds.has(player.id))
        .map(player => normalize(player.fullName)),
    );

    expect(USER_SELECTED_HISTORICAL_PLAYERS.some(player => existingIdentities.has(normalize(player.fullName)))).toBe(false);
  });
});
