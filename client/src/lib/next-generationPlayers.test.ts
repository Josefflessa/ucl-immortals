import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PLAYERS } from './gameData';
import { NEXT_GENERATION_PLAYERS } from './next-generationPlayers';

describe('next generation player catalog', () => {
  it('contains the complete audited batch with unique IDs', () => {
    expect(NEXT_GENERATION_PLAYERS).toHaveLength(38);
    expect(new Set(NEXT_GENERATION_PLAYERS.map(player => player.id)).size).toBe(38);
    const liveIds = new Set(PLAYERS.map(player => player.id));
    expect(liveIds.size).toBe(PLAYERS.length);
    expect(NEXT_GENERATION_PLAYERS.every(player => liveIds.has(player.id))).toBe(true);
    expect(NEXT_GENERATION_PLAYERS.every(player => PLAYERS.find(live => live.id === player.id)?.clubId)).toBe(true);
  });

  it('has a local WebP portrait for every new player', () => {
    const portraitDirectory = resolve(process.cwd(), 'client/public/players/regular');

    for (const player of NEXT_GENERATION_PLAYERS) {
      expect(existsSync(resolve(portraitDirectory, `${player.id}.webp`))).toBe(true);
    }
  });
});
