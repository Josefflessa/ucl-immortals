import { describe, expect, it } from 'vitest';
import { PLAYERS, PLAYER_SOURCES, UNIQUE_CARDS } from './index';

const key = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

describe('card catalogue', () => {
  it('every card id is unique', () => {
    const ids = [...PLAYERS, ...UNIQUE_CARDS].map(card => card.id);
    const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(repeated).toEqual([]);
  });

  it('the same person is not added twice for the same club and season', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const card of PLAYERS) {
      const identity = `${key(card.fullName || card.shortName)}|${key(card.club)}|${key(String(card.season))}`;
      const previous = seen.get(identity);
      if (previous) duplicates.push(`${previous} = ${card.id}`);
      else seen.set(identity, card.id);
    }
    expect(duplicates).toEqual([]);
  });

  it('PLAYERS is exactly the listed sources, in order', () => {
    expect(PLAYERS.map(card => card.id)).toEqual(PLAYER_SOURCES.flatMap(source => source.players.map(card => card.id)));
  });
});
