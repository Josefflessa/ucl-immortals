import { describe, it, expect } from 'vitest';
import { PLAYERS, COACHES, Player } from './gameData';
import {
  calculateChemistry, getEffectiveAttribute, getPlayerEffectiveStats, getChemistryBonus,
  calculateTeamStrength, simulateMatch, generateBotTeam, generateDraftOptions,
  statKey, getPlayerSeasonStats, PREFERRED_FORMATION_CHEM_BONUS,
  PlayerCard,
} from './gameEngine';

const asCard = (p: Player, over: Partial<PlayerCard> = {}): PlayerCard =>
  ({ ...p, chemistryScore: 0, isOOP: false, ...over });

const outfield = PLAYERS.find(p => p.position !== 'GK')!;
const coach = COACHES[0];
const noChem = { passing: 0, pace: 0, special: false };

describe('coach preferred-formation chemistry bonus', () => {
  it('adds the bonus to total chemistry only on the coach preferred formation', () => {
    const c = COACHES.find(co => !!co.preferredFormation)!;
    const players = PLAYERS.slice(0, 11);
    const roles = players.map(p => p.position);
    const off = calculateChemistry(players, c.id, roles, c.preferredFormation === '4-4-2' ? '4-3-3' : '4-4-2');
    const on = calculateChemistry(players, c.id, roles, c.preferredFormation);
    expect(on.total).toBe(Math.min(100, off.total + PREFERRED_FORMATION_CHEM_BONUS));
    // No formation id passed → no bonus (backwards compatible).
    const none = calculateChemistry(players, c.id, roles);
    expect(none.total).toBe(off.total);
  });
});

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
    // Traits are now rolled at draft time (no fixed traits in the pool), so assign a
    // representative trait set here to exercise the trait path in both functions.
    const base = PLAYERS.find(p => p.position !== 'GK')!;
    const player: Player = { ...base, traits: ['Finalizador', 'Velocista', 'Frio na Final'] };
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

describe('match stats are keyed per team (shared player is not conflated)', () => {
  it('a player on BOTH teams gets SEPARATE stat entries', () => {
    const home = generateBotTeam('Casa', 0.8);
    const away = generateBotTeam('Fora', 0.8);
    home.id = 'home_test';
    away.id = 'away_test';
    // Force the same legend (same id) into both starting XIs.
    const shared = asCard(PLAYERS.find(p => p.position === 'ST')!, { chemistryScore: 3 });
    home.players[10] = { ...shared };
    away.players[10] = { ...shared };

    const r = simulateMatch(home, away);
    const homeKey = statKey(home.id, shared.id);
    const awayKey = statKey(away.id, shared.id);

    expect(homeKey).not.toBe(awayKey);
    expect(r.playerStats![homeKey]).toBeDefined();
    expect(r.playerStats![awayKey]).toBeDefined();
    // Each instance is attributed to its own team — no copying across.
    expect(r.playerStats![homeKey].teamId).toBe(home.id);
    expect(r.playerStats![awayKey].teamId).toBe(away.id);

    // Season stats for the same player on each team read independently.
    const homeSeason = getPlayerSeasonStats(shared.id, home.id, [r]);
    const awaySeason = getPlayerSeasonStats(shared.id, away.id, [r]);
    expect(homeSeason.goals).toBe(r.playerStats![homeKey].goals);
    expect(awaySeason.goals).toBe(r.playerStats![awayKey].goals);
  });
});
