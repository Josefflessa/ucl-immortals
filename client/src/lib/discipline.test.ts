import { describe, it, expect } from 'vitest';
import { rollInjurySeverity, yellowChance, injuryChanceFromFoul, randomInjuryChance } from './discipline';
import { generateBotTeam } from './gameEngine';

import { applyMatchDiscipline, resetYellowsForKnockout, healInjury, availKey } from './discipline';
const nameOf = () => 'Jogador';
const evt = (type: any, teamId: string, playerId: string) => ({ minute: 10, type, description: '', teamId, playerId });
const res = (homeTeamId: string, awayTeamId: string, events: any[]) => ({ homeTeamId, awayTeamId, events });

describe('applyMatchDiscipline', () => {
  it('3º amarelo acumulado → suspenso 1 jogo e zera amarelos', () => {
    const m = { [availKey('t', 'p')]: { yellows: 2, banned: 0, injured: 0 } };
    const out = applyMatchDiscipline(m, ['t', 'o'], [res('t', 'o', [evt('yellow', 't', 'p')])], nameOf);
    expect(out.next[availKey('t', 'p')]).toEqual({ yellows: 0, banned: 1, injured: 0 });
    expect(out.newSuspensions).toHaveLength(1);
  });
  it('🟥 → suspenso 1 jogo (aplica no próximo)', () => {
    const out = applyMatchDiscipline({}, ['t', 'o'], [res('t', 'o', [evt('red', 't', 'p')])], nameOf);
    expect(out.next[availKey('t', 'p')].banned).toBe(1);
  });
  it('🟨🟨 vermelho por 2º amarelo → o amarelo daquele jogo NÃO acumula', () => {
    const m = { [availKey('t', 'p')]: { yellows: 1, banned: 0, injured: 0 } };
    const events = [
      evt('yellow', 't', 'p'),
      { minute: 80, type: 'red', description: '', teamId: 't', playerId: 'p', secondYellow: true },
    ];
    const out = applyMatchDiscipline(m, ['t', 'o'], [res('t', 'o', events)], nameOf);
    expect(out.next[availKey('t', 'p')].yellows).toBe(1); // continua 1 (não virou 2)
    expect(out.next[availKey('t', 'p')].banned).toBe(1);   // suspenso pelo vermelho
  });
  it('🟥 vermelho DIRETO não zera os amarelos acumulados', () => {
    const m = { [availKey('t', 'p')]: { yellows: 2, banned: 0, injured: 0 } };
    const out = applyMatchDiscipline(m, ['t', 'o'], [res('t', 'o', [evt('red', 't', 'p')])], nameOf);
    expect(out.next[availKey('t', 'p')].yellows).toBe(2); // amarelos ficam
    expect(out.next[availKey('t', 'p')].banned).toBe(1);
  });
  it('decrementa quem já estava fora ANTES de aplicar o novo', () => {
    const m = { [availKey('t', 'x')]: { yellows: 0, banned: 1, injured: 0 } };
    const out = applyMatchDiscipline(m, ['t', 'o'], [res('t', 'o', [])], nameOf);
    expect(out.next[availKey('t', 'x')].banned).toBe(0); // cumpriu o jogo
  });
  it('lesão seta injured pela gravidade (rng injetado → 2 jogos)', () => {
    const out = applyMatchDiscipline({}, ['t', 'o'], [res('t', 'o', [evt('injury', 't', 'p')])], nameOf, () => 0.7);
    expect(out.next[availKey('t', 'p')].injured).toBe(2);
    expect(out.newInjuries).toHaveLength(1);
  });
});

import { resolveAvailableLineup } from './discipline';
const mkP = (id: string, position: string, overall = 75): any => ({ id, shortName: id, fullName: id, position, overall, secondaryPositions: [], pace: overall, shooting: overall, passing: overall, dribbling: overall, defending: overall, physical: overall, vision: overall, composure: overall, nation: 'BR', club: 'X', rarity: 'gold' });
const mkTeam = (players: any[], extra: any = {}): any => ({ id: 't', name: 'T', players, captain: null, penaltyTaker: null, freeKickTaker: null, coachId: 'guardiola', formationId: '4-3-3', playStyle: 'balanced', totalChemistry: 0, ...extra });

describe('resolveAvailableLineup', () => {
  it('promove reserva compatível quando um titular está suspenso', () => {
    const players = [mkP('gk', 'GK'), ...Array.from({ length: 10 }, (_, i) => mkP('s' + i, i < 4 ? 'CB' : 'CM')), mkP('b0', 'CM', 80)];
    const m = { [availKey('t', 's5')]: { yellows: 0, banned: 1, injured: 0 } };
    const out = resolveAvailableLineup(mkTeam(players), m);
    expect(out.team.players.slice(0, 11).some(p => p.id === 's5')).toBe(false);
    expect(out.team.players.slice(0, 11).some(p => p.id === 'b0')).toBe(true);
    expect(out.forced).toEqual([{ outId: 's5', inId: 'b0' }]);
  });
  it('GK indisponível promove GK reserva do banco (XI segue com exatamente 1 GK)', () => {
    const players = [mkP('gk', 'GK'), ...Array.from({ length: 10 }, (_, i) => mkP('s' + i, 'CM')), mkP('gk2', 'GK', 78)];
    const m = { [availKey('t', 'gk')]: { yellows: 0, banned: 0, injured: 2 } };
    const out = resolveAvailableLineup(mkTeam(players), m);
    expect(out.team.players.slice(0, 11).filter(p => p.position === 'GK')).toHaveLength(1);
    expect(out.team.players.slice(0, 11).some(p => p.id === 'gk2')).toBe(true);
  });
  it('sem GK no banco, coloca linha no gol (isOOP) — nunca fica sem goleiro', () => {
    const players = [mkP('gk', 'GK'), ...Array.from({ length: 10 }, (_, i) => mkP('s' + i, 'CM')), mkP('b0', 'CM')];
    const m = { [availKey('t', 'gk')]: { yellows: 0, banned: 1, injured: 0 } };
    const out = resolveAvailableLineup(mkTeam(players), m);
    expect(out.team.players.slice(0, 11)).toHaveLength(11);
    expect(out.team.players.slice(0, 11).some(p => p.position === 'GK' || (p as any).isOOP)).toBe(true);
    expect(out.team.players.slice(0, 11).some(p => p.id === 'b0')).toBe(true);
  });
  it('re-seleciona capitão se ele sair do XI', () => {
    const players = [mkP('gk', 'GK'), ...Array.from({ length: 10 }, (_, i) => mkP('s' + i, 'CM')), mkP('b0', 'CM')];
    const m = { [availKey('t', 's3')]: { yellows: 0, banned: 1, injured: 0 } };
    const out = resolveAvailableLineup(mkTeam(players, { captain: 's3' }), m);
    expect(out.team.captain).not.toBe('s3');
    expect(out.team.players.slice(0, 11).some(p => p.id === out.team.captain)).toBe(true);
  });
});

describe('reset & physio', () => {
  it('resetYellowsForKnockout zera amarelos e preserva bans/lesões', () => {
    const m = { [availKey('t', 'p')]: { yellows: 2, banned: 1, injured: 2 } };
    expect(resetYellowsForKnockout(m)[availKey('t', 'p')]).toEqual({ yellows: 0, banned: 1, injured: 2 });
  });
  it('healInjury reduz 1 (piso 0)', () => {
    const m = { [availKey('t', 'p')]: { yellows: 0, banned: 0, injured: 2 } };
    expect(healInjury(m, 't', 'p')[availKey('t', 'p')].injured).toBe(1);
  });
});

describe('generateBotTeam — banco', () => {
  it('gera 11 titulares + banco (>=18) com >=1 GK reserva e exatamente 1 GK titular', () => {
    const t = generateBotTeam('Bot Teste', 0.7);
    expect(t.players.length).toBeGreaterThanOrEqual(18);
    expect(t.players.slice(11).filter(p => p.position === 'GK').length).toBeGreaterThanOrEqual(1);
    expect(t.players.slice(0, 11).filter(p => p.position === 'GK').length).toBe(1);
  });
});

describe('rollInjurySeverity', () => {
  it('mapeia faixas do rng p/ 1/2/3 conforme os pesos (.6/.3/.1)', () => {
    expect(rollInjurySeverity(() => 0.0)).toBe(1);
    expect(rollInjurySeverity(() => 0.59)).toBe(1);
    expect(rollInjurySeverity(() => 0.61)).toBe(2);
    expect(rollInjurySeverity(() => 0.89)).toBe(2);
    expect(rollInjurySeverity(() => 0.95)).toBe(3);
  });
});

describe('yellowChance', () => {
  it('zaga arrisca mais cartão que atacante (mesma compostura/ímpeto)', () => {
    expect(yellowChance('CB', 70, 1)).toBeGreaterThan(yellowChance('ST', 70, 1));
  });
  it('compostura alta reduz o risco', () => {
    expect(yellowChance('CM', 90, 1)).toBeLessThan(yellowChance('CM', 50, 1));
  });
  it('goleiro é ~0', () => {
    expect(yellowChance('GK', 70, 1)).toBeLessThan(0.02);
  });
});

describe('lesão', () => {
  it('jogador mais frágil (físico baixo) lesiona mais no aleatório', () => {
    expect(randomInjuryChance(50)).toBeGreaterThan(randomInjuryChance(90));
  });
  it('falta dura tem chance positiva, maior p/ frágil', () => {
    expect(injuryChanceFromFoul(50)).toBeGreaterThan(injuryChanceFromFoul(90));
    expect(injuryChanceFromFoul(90)).toBeGreaterThan(0);
  });
});
