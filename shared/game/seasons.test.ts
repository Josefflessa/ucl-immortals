import { describe, expect, it } from 'vitest';
import { browsableSeasons, currentSeason, seasonAt, seasonBounds, seasonPrize, SEASON_THEMES } from './seasons';
import { AVATAR_FRAME_BY_KEY } from './events';
import { PROFILE_COVER_BY_KEY } from '../profileCovers';
import { EVENT_UNIQUE_CARDS } from './gameData';

const SP = (y: number, m: number, d: number) => Date.UTC(y, m - 1, d, 3); // 00:00 in São Paulo

describe('ranking seasons', () => {
  it('season 0 counts all earlier history and closes on 17/11/2026 at 00:00 (São Paulo)', () => {
    expect(seasonBounds(0)).toEqual({ season: 0, start: 0, end: SP(2026, 11, 17) });
    expect(seasonAt(0)).toBe(0);
    expect(seasonAt(SP(2026, 11, 17) - 1)).toBe(0);
    expect(seasonAt(SP(2026, 11, 17))).toBe(1);
  });

  it('later seasons last one month, from the 17th to the next 17th', () => {
    expect(seasonBounds(1)).toEqual({ season: 1, start: SP(2026, 11, 17), end: SP(2026, 12, 17) });
    expect(seasonBounds(2)).toEqual({ season: 2, start: SP(2026, 12, 17), end: SP(2027, 1, 17) });
    expect(seasonAt(SP(2027, 1, 16))).toBe(2);
  });

  it('lists the browsable seasons from the current one back to 0', () => {
    expect(browsableSeasons(SP(2026, 10, 20))).toEqual([0]);
    expect(currentSeason(SP(2027, 1, 20))).toBe(3);
    expect(browsableSeasons(SP(2027, 1, 20))).toEqual([3, 2, 1, 0]);
  });

  it('pays the top 10 only, with the exclusives on the podium', () => {
    expect(seasonPrize(0)).toBeNull();
    expect(seasonPrize(11)).toBeNull();
    expect(seasonPrize(1)).toMatchObject({ coins: 3000, frame: true, cover: true, card: true });
    expect(seasonPrize(2)).toMatchObject({ coins: 2000, frame: true, cover: true, card: false });
    expect(seasonPrize(3)).toMatchObject({ coins: 1500, frame: true, cover: false, card: false });
    expect(seasonPrize(5)).toMatchObject({ coins: 1000, frame: false });
    expect(seasonPrize(10)).toMatchObject({ coins: 500, packs: { gold: 2 } });
  });

  it('season themes point to rewards that exist and are not sold nor free', () => {
    for (const theme of Object.values(SEASON_THEMES)) {
      const frame = AVATAR_FRAME_BY_KEY.get(theme.frameKey);
      const cover = PROFILE_COVER_BY_KEY.get(theme.coverKey);
      expect(frame?.shopPrice).toBeUndefined();
      expect(frame?.rewardOnly).toBeTruthy();
      expect(cover?.shopPrice).toBeUndefined();
      expect(cover?.rewardOnly).toBeTruthy();
      expect(EVENT_UNIQUE_CARDS.some(card => card.id === theme.cardId)).toBe(true);
    }
  });
});
