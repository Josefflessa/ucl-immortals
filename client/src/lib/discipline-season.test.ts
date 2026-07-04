import { describe, it, expect } from 'vitest';
import { generateBotTeam } from './gameEngine';
import { applyMatchDiscipline, resolveAvailableLineup, resetYellowsForKnockout, isAvailable, availKey, DisciplineMap } from './discipline';

// Invariantes de temporada: aplica disciplina em rodadas sintéticas e checa que a escalação
// resolvida NUNCA fura as regras (ninguém indisponível joga; XI sempre com 11 e 1 goleiro).
describe('coerência de temporada — invariantes', () => {
  const nameOf = (t: string, p: string) => `${t}:${p}`;

  it('suspenso/lesionado nunca entra no XI; XI sempre com 11 e exatamente 1 GK; ban decrementa', () => {
    const a = generateBotTeam('Alpha', 0.7);
    const b = generateBotTeam('Beta', 0.7);
    let disc: DisciplineMap = {};

    // Rodada 1: um titular de cada time leva 🟥 e um se lesiona (eventos sintéticos).
    const aStarter = a.players[3].id, aInjured = a.players[7].id;
    const bStarter = b.players[4].id;
    const round1 = [{
      homeTeamId: a.id, awayTeamId: b.id, events: [
        { minute: 20, type: 'red', teamId: a.id, playerId: aStarter, description: '' },
        { minute: 55, type: 'injury', teamId: a.id, playerId: aInjured, description: '' },
        { minute: 70, type: 'red', teamId: b.id, playerId: bStarter, description: '' },
      ],
    }];
    disc = applyMatchDiscipline(disc, [a.id, b.id], round1 as any, nameOf, () => 0.5).next;
    expect(disc[availKey(a.id, aStarter)].banned).toBe(1);
    expect(disc[availKey(a.id, aInjured)].injured).toBe(1);
    expect(disc[availKey(b.id, bStarter)].banned).toBe(1);

    // Escalações da rodada 2 (bloqueados fora): invariantes.
    for (const t of [a, b]) {
      const xi = resolveAvailableLineup(t, disc).team.players.slice(0, 11);
      expect(xi).toHaveLength(11);
      expect(xi.filter(p => p.position === 'GK')).toHaveLength(1);
      for (const p of xi) expect(isAvailable(disc, t.id, p.id)).toBe(true); // ninguém indisponível
    }

    // Rodada 2 sem novos cartões → bans/lesões decrementam (cumpriram 1 jogo).
    disc = applyMatchDiscipline(disc, [a.id, b.id], [{ homeTeamId: a.id, awayTeamId: b.id, events: [] }] as any, nameOf).next;
    expect(disc[availKey(a.id, aStarter)].banned).toBe(0);
    expect(disc[availKey(a.id, aInjured)].injured).toBe(0);
    expect(disc[availKey(b.id, bStarter)].banned).toBe(0);
  });

  it('amarelos acumulados zeram ao entrar no mata-mata; suspensões em curso continuam', () => {
    const disc: DisciplineMap = {
      [availKey('t', 'p1')]: { yellows: 2, banned: 0, injured: 0 },
      [availKey('t', 'p2')]: { yellows: 1, banned: 1, injured: 2 },
    };
    const ko = resetYellowsForKnockout(disc);
    expect(ko[availKey('t', 'p1')].yellows).toBe(0);
    expect(ko[availKey('t', 'p2')]).toEqual({ yellows: 0, banned: 1, injured: 2 });
  });
});
