import { describe, expect, it } from 'vitest';
import { PLAYERS } from '@shared/game/gameData';
import { getAlbumLevelCardStats, getPlayerCardDisplayStats } from './PlayerCard';

const zidane = PLAYERS.find(player => player.id === 'zidane')!;

describe('album-level card values', () => {
  it('shows Zidane at 96 in the album modal at level 2', () => {
    const stats = getPlayerCardDisplayStats(zidane, 2);

    expect(zidane.overall).toBe(94);
    expect(stats.overall).toBe(96);
    expect(stats.pace).toBe(zidane.pace + 2);
    expect(stats.physical).toBe(zidane.physical + 2);
  });

  it('does not add the account level again to a frozen competition card', () => {
    const competitionCard = { ...zidane, competitionAlbumLevel: 2 as const };

    expect(getPlayerCardDisplayStats(competitionCard, 2).overall).toBe(96);
  });

  it('respects a zero-level competition snapshot instead of the current account level', () => {
    const competitionCard = { ...zidane, competitionAlbumLevel: 0 as const };

    expect(getPlayerCardDisplayStats(competitionCard, 2).overall).toBe(94);
  });

  it('keeps supplied team stats authoritative', () => {
    const teamStats = getAlbumLevelCardStats(zidane, 2);

    expect(getPlayerCardDisplayStats(zidane, 2, { ...teamStats, overall: 99 }).overall).toBe(99);
  });
});
