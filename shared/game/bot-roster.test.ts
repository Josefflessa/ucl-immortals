import { describe, expect, it } from 'vitest';
import { botCrestId, pickBotNames } from './gameEngine';

describe('bot roster', () => {
  it('never reuses a human club name or crest, and still fills the biggest league', () => {
    const humans = [
      { name: 'real madrid', crestId: 'manchester-city' },
      { name: 'Meu Time', crestId: 'barcelona' },
      { name: 'Atletico de Madrid', crestId: null },
    ];
    const bots = pickBotNames(33, humans);
    expect(bots).toHaveLength(33);
    expect(new Set(bots).size).toBe(33);
    expect(bots).not.toContain('Real Madrid');        // same name (case-insensitive)
    expect(bots).not.toContain('Atlético de Madrid'); // same name (accent-insensitive)
    expect(bots).not.toContain('Manchester City');    // same crest
    expect(bots).not.toContain('FC Barcelona');       // same crest
    const crests = bots.map(botCrestId);
    expect(crests).not.toContain('manchester-city');
    expect(crests).not.toContain('barcelona');
    expect(new Set(crests).size).toBe(crests.length);
  });

  it('keeps the usual order when nobody collides', () => {
    expect(pickBotNames(3, [{ name: 'Meu Time' }])).toEqual(['Real Madrid', 'Manchester City', 'Bayern München']);
  });
});
