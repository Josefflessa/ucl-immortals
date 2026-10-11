import { afterEach, describe, expect, it, vi } from 'vitest';
import { seededRandom } from '../random';
import { generateBotTeam } from './bots';
import { simulateMatch } from './matchSim';
import type { Team } from './teamModel';

const DANGER = new Set(['goal', 'save', 'miss', 'duel']);
const owns = (team: Team, id?: string) => !id || team.players.some(p => p.id === id);

describe('MatchEvent.play', () => {
  afterEach(() => vi.restoreAllMocks());

  it('todo lance de perigo registra a jogada com papéis coerentes', () => {
    const kinds = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
      const home = generateBotTeam(`H${seed}`, 0.7);
      const away = generateBotTeam(`A${seed}`, 0.7);
      const result = simulateMatch(home, away, seed % 2 === 0, false);
      vi.restoreAllMocks();
      for (const e of result.events) {
        if (!DANGER.has(e.type)) continue;
        expect(e.play, `${e.type} aos ${e.minute}' sem play`).toBeDefined();
        const play = e.play!;
        kinds.add(play.kind);
        // A save and a duel are credited to the defending side; goal and miss to the attackers.
        const eventTeam = e.teamId === home.id ? home : away;
        const otherTeam = eventTeam === home ? away : home;
        const defendingEvent = e.type === 'save' || e.type === 'duel';
        const attack = defendingEvent ? otherTeam : eventTeam;
        const defend = defendingEvent ? eventTeam : otherTeam;
        expect(owns(attack, play.attackerId), 'attackerId').toBe(true);
        expect(owns(attack, play.creatorId), 'creatorId').toBe(true);
        expect(owns(attack, play.wideId), 'wideId').toBe(true);
        expect(owns(defend, play.defenderId), 'defenderId').toBe(true);
        expect(owns(defend, play.goalkeeperId), 'goalkeeperId').toBe(true);
      }
    }
    for (const kind of ['cross', 'through', 'dribble', 'longrange', 'counter', 'corner', 'freekick', 'penalty']) {
      expect(kinds.has(kind), `nenhum lance do tipo ${kind}`).toBe(true);
    }
  });

  it('o resultado traz o andamento do jogo minuto a minuto', () => {
    for (let seed = 1; seed <= 40; seed++) {
      vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
      const home = generateBotTeam('F' + seed, 0.7);
      const away = generateBotTeam('G' + seed, 0.7);
      const result = simulateMatch(home, away, true, false);
      vi.restoreAllMocks();
      const minutes = result.durationMinutes ?? 90;
      expect(result.flow).toHaveLength(minutes);
      for (const v of result.flow!) {
        expect(Math.abs(v)).toBeGreaterThanOrEqual(1);
        expect(Math.abs(v)).toBeLessThanOrEqual(101);
      }
    }
  });

  it('as cobranças da disputa de pênaltis trazem os ids do batedor e do goleiro', () => {
    let checked = 0;
    for (let seed = 1; seed <= 400 && checked < 5; seed++) {
      vi.spyOn(Math, 'random').mockImplementation(seededRandom(seed));
      const home = generateBotTeam(`PH${seed}`, 0.7);
      const away = generateBotTeam(`PA${seed}`, 0.7);
      const result = simulateMatch(home, away, true, false);
      vi.restoreAllMocks();
      if (!result.penaltyKicks?.length) continue;
      checked++;
      for (const kick of result.penaltyKicks) {
        const kicking = kick.teamId === home.id ? home : away;
        const keeping = kicking === home ? away : home;
        expect(kicking.players.some(p => p.id === kick.takerId)).toBe(true);
        expect(keeping.players.some(p => p.id === kick.gkId)).toBe(true);
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
