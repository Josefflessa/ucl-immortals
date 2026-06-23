import { describe, it, expect } from 'vitest';
import { PLAYERS, COACHES, Player } from './gameData';
import {
  calculateChemistry, getEffectiveAttribute, getPlayerEffectiveStats, getChemistryBonus,
  calculateTeamStrength, simulateMatch, generateBotTeam, generateDraftOptions,
  PlayerCard,
} from './gameEngine';

const asCard = (p: Player, over: Partial<PlayerCard> = {}): PlayerCard =>
  ({ ...p, chemistryScore: 0, isOOP: false, ...over });

const outfield = PLAYERS.find(p => p.position !== 'GK')!;
const coach = COACHES[0];
const noChem = { passing: 0, pace: 0, special: false };

describe('getEffectiveAttribute', () => {
  it('applies a trait bonus to the matching attribute (isolated)', () => {
    const without = asCard(outfield, { traits: [] });
    const withTrait = asCard(outfield, { traits: ['Finalizador'] }); // +6 shooting
    const a = getEffectiveAttribute(without, 'shooting', coach, '', noChem, 'balanced');
    const b = getEffectiveAttribute(withTrait, 'shooting', coach, '', noChem, 'balanced');
    expect(b - a).toBe(6);
  });

  it('applies the play-style bonus', () => {
    const card = asCard(outfield, { traits: [] });
    const balanced = getEffectiveAttribute(card, 'defending', coach, '', noChem, 'balanced');
    const defensive = getEffectiveAttribute(card, 'defending', coach, '', noChem, 'defensive');
    expect(defensive - balanced).toBe(8);
  });

  it('applies conditional traits only with the right context', () => {
    const card = asCard(outfield, { traits: ['Frio na Final'] }); // +8 shooting only in the final
    const normal = getEffectiveAttribute(card, 'shooting', coach, '', noChem, 'balanced');
    const final = getEffectiveAttribute(card, 'shooting', coach, '', noChem, 'balanced', { isFinal: true });
    expect(final - normal).toBe(8);
  });
});

describe('getPlayerEffectiveStats mirrors the engine (display = simulation)', () => {
  it('matches getEffectiveAttribute for every shown attribute', () => {
    const player = PLAYERS.find(p => p.traits.length > 0 && p.position !== 'GK')!;
    const total = 90;                       // high team chem → exercises global chem bonus
    const chem = getChemistryBonus(total);  // { passing: 3, pace: 2 }
    const playStyle = 'counter';
    const chemScore = 2;

    const eff = getPlayerEffectiveStats(player, chemScore, false, coach.id, total, playStyle);
    const card = asCard(player, { chemistryScore: chemScore });

    (['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const).forEach(attr => {
      expect(eff[attr]).toBe(getEffectiveAttribute(card, attr, coach, '', chem, playStyle));
    });
  });

  it('softens the out-of-position penalty for the Versatilidade trait', () => {
    const plain = PLAYERS.find(p => p.position !== 'GK' && p.traits.length === 0)
      ?? { ...outfield, traits: [] };
    const versatile: Player = { ...plain, traits: ['Versatilidade'] };
    const a = getPlayerEffectiveStats(plain, 0, true, coach.id, 0, 'balanced');
    const b = getPlayerEffectiveStats(versatile, 0, true, coach.id, 0, 'balanced');
    expect(b.physical).toBeGreaterThanOrEqual(a.physical);
  });
});

describe('calculateChemistry', () => {
  it('returns a sane structure', () => {
    const starters = PLAYERS.slice(0, 11);
    const chem = calculateChemistry(starters, coach.id, starters.map(p => p.position));
    expect(chem.total).toBeGreaterThanOrEqual(0);
    expect(chem.total).toBeLessThanOrEqual(100);
    expect(Object.keys(chem.individual).length).toBe(11);
  });
});

describe('calculateTeamStrength', () => {
  it('is positive for a real team and 0 for an empty lineup', () => {
    const team = generateBotTeam('Teste', 0.8);
    const c = COACHES.find(x => x.id === team.coachId)!;
    const strength = calculateTeamStrength(team, c, noChem, 0);
    expect(strength).toBeGreaterThan(0);
    expect(calculateTeamStrength({ ...team, players: [] }, c, noChem, 0)).toBe(0);
  });
});

describe('simulateMatch', () => {
  it('produces a valid result', () => {
    const home = generateBotTeam('Casa', 0.8);
    const away = generateBotTeam('Fora', 0.8);
    const r = simulateMatch(home, away);
    expect(r.homeGoals).toBeGreaterThanOrEqual(0);
    expect(r.awayGoals).toBeGreaterThanOrEqual(0);
    expect([home.id, away.id, null]).toContain(r.winner);
    expect(Number.isFinite(r.stats.homePos)).toBe(true);
  });
});

describe('generateDraftOptions', () => {
  it('returns the right number of options', () => {
    expect(generateDraftOptions([], []).length).toBe(6);
  });

  it('never mutates the static PLAYERS pool (variant cloning is safe)', () => {
    const traitCountBefore = PLAYERS.reduce((s, p) => s + p.traits.length, 0);
    for (let i = 0; i < 300; i++) generateDraftOptions([], []);
    const traitCountAfter = PLAYERS.reduce((s, p) => s + p.traits.length, 0);
    expect(traitCountAfter).toBe(traitCountBefore);
    // No base player should ever carry a draft-only variant flag.
    expect(PLAYERS.some(p => p.inForm || p.rolledTrait)).toBe(false);
  });
});
