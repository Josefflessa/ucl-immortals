import { describe, expect, it } from 'vitest';
import { generateBotTeam } from './gameEngine';
import {
  applyEmergencyReplacement,
  availKey,
  emergencyReplacementOptions,
  getEmergencyReplacementTarget,
  type DisciplineMap,
} from './discipline';

describe('contratação emergencial', () => {
  it('oferece prata/bronze compatível e coloca a escolha no XI sem criar carta especial', () => {
    const original = generateBotTeam('Emergency FC', 0.7);
    const team = { ...original, players: original.players.slice(0, 11) };
    const starter = team.players.find(p => p.position !== 'GK') ?? team.players[0];
    const discipline: DisciplineMap = {
      [availKey(team.id, starter.id)]: { yellows: 0, banned: 1, injured: 0 },
    };

    const target = getEmergencyReplacementTarget(team, discipline);
    expect(target?.starterId).toBe(starter.id);
    expect(target?.options.length).toBeGreaterThan(0);
    expect(target?.options.every(p => p.rarity === 'silver' || p.rarity === 'bronze')).toBe(true);
    expect(target?.options.every(p => p.position === starter.position || p.secondaryPositions?.includes(starter.position))).toBe(true);
    expect(emergencyReplacementOptions(starter.position, team.players.map(p => p.id))).toEqual(target?.options);

    const chosen = target!.options[0];
    const updated = applyEmergencyReplacement(team, discipline, starter.id, chosen);

    expect(updated).not.toBeNull();
    expect(updated!.players).toHaveLength(team.players.length + 1);
    expect(updated!.players[team.players.indexOf(starter)].id).toBe(chosen.id);
    expect(updated!.players.slice(11).some(p => p.id === starter.id)).toBe(true);
    expect(updated!.players.find(p => p.id === chosen.id)).toMatchObject({
      rarity: chosen.rarity,
      chemistryScore: expect.any(Number),
      isOOP: false,
    });
    expect('emergency' in (updated!.players.find(p => p.id === chosen.id) ?? {})).toBe(false);
  });
});
