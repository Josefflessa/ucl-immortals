import { describe, it, expect } from 'vitest';
import { PLAYERS } from './gameData';
import {
  TRAITS, TRAIT_MAP, TRAIT_POOLS, rollPlayerTraits, positionGroup,
  getTraitAttributeBonus, getGoalkeeperTraitBonus, getPenaltyComposureBonus,
  hasOopRelief, traitEffectLabel,
} from './traits';

describe('trait catalog integrity', () => {
  it('has unique ids', () => {
    const ids = TRAITS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every trait actually used by players (no orphan strings)', () => {
    const used = new Set<string>();
    PLAYERS.forEach(p => p.traits.forEach(t => used.add(t)));
    const missing = [...used].filter(t => !TRAIT_MAP[t]);
    expect(missing).toEqual([]);
  });

  it('every trait in the roll pools exists in the catalog', () => {
    const missing = Object.values(TRAIT_POOLS).flat().filter(t => !TRAIT_MAP[t]);
    expect(missing).toEqual([]);
  });

  it('has no mechanical duplicates (same exact effect twice)', () => {
    const sig = (t: typeof TRAITS[number]) => JSON.stringify({
      b: (t.boosts ?? []).map(x => `${x.attribute}${x.value}${x.condition ?? ''}`).sort(),
      gk: t.goalkeeperSave ?? 0, pen: t.penaltyComposure ?? 0, oop: t.oopRelief ?? false,
    });
    const seen = new Map<string, string>();
    const dups: string[] = [];
    for (const t of TRAITS) {
      const s = sig(t);
      if (seen.has(s)) dups.push(`${t.id} == ${seen.get(s)}`); else seen.set(s, t.id);
    }
    expect(dups).toEqual([]);
  });

  it('rolls 1–3 valid, non-duplicate, position-appropriate traits', () => {
    for (const pos of ['GK', 'CB', 'CM', 'ST']) {
      for (let i = 0; i < 60; i++) {
        const rolled = rollPlayerTraits(pos, 'immortal');
        expect(rolled.length).toBeGreaterThanOrEqual(1);
        expect(rolled.length).toBeLessThanOrEqual(3);
        expect(new Set(rolled).size).toBe(rolled.length);
        rolled.forEach(id => {
          expect(TRAIT_MAP[id]).toBeTruthy();
          expect(TRAIT_POOLS[positionGroup(pos)]).toContain(id);
        });
      }
    }
  });

  it('every trait produces a readable effect label', () => {
    for (const t of TRAITS) {
      expect(traitEffectLabel(t.id).length).toBeGreaterThan(0);
    }
  });
});

describe('getTraitAttributeBonus', () => {
  it('sums unconditional boosts for the matching attribute', () => {
    expect(getTraitAttributeBonus(['Finalizador'], 'shooting')).toBe(6);
    expect(getTraitAttributeBonus(['Pivô Implacável'], 'physical')).toBe(5);
    expect(getTraitAttributeBonus(['Pivô Implacável'], 'shooting')).toBe(3);
  });

  it('ignores boosts for other attributes', () => {
    expect(getTraitAttributeBonus(['Finalizador'], 'defending')).toBe(0);
  });

  it('applies conditional boosts only when the condition holds', () => {
    expect(getTraitAttributeBonus(['Frio na Final'], 'shooting')).toBe(0);
    expect(getTraitAttributeBonus(['Frio na Final'], 'shooting', { isFinal: true })).toBe(8);
    expect(getTraitAttributeBonus(['Especialista em Decisões'], 'shooting')).toBe(0);
    expect(getTraitAttributeBonus(['Especialista em Decisões'], 'shooting', { isKnockout: true })).toBe(6);
  });

  it('stacks multiple traits', () => {
    expect(getTraitAttributeBonus(['Velocista', 'Dribblador Veloz'], 'pace')).toBe(5 + 3);
  });

  it('ignores unknown trait strings', () => {
    expect(getTraitAttributeBonus(['Nao Existe'], 'pace')).toBe(0);
  });
});

describe('goalkeeper & penalty trait helpers', () => {
  it('sums goalkeeper save bonuses', () => {
    expect(getGoalkeeperTraitBonus(['Reflexo Felino'])).toBe(10);
    expect(getGoalkeeperTraitBonus(['Reflexo Felino', 'Pegador de Pênalti'])).toBe(18);
    expect(getGoalkeeperTraitBonus(['Finalizador'])).toBe(0);
  });

  it('sums penalty composure bonuses', () => {
    expect(getPenaltyComposureBonus(['Frio na Final'])).toBe(10);
    expect(getPenaltyComposureBonus(['Especialista em Decisões', 'Frio na Final'])).toBe(20);
    expect(getPenaltyComposureBonus(['Velocista'])).toBe(0);
  });

  it('detects the out-of-position relief trait', () => {
    expect(hasOopRelief(['Versatilidade'])).toBe(true);
    expect(hasOopRelief(['Velocista'])).toBe(false);
  });
});
