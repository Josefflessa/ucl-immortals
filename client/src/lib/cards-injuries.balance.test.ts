import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { simulateMatch, generateBotTeam, calculateTeamStrength, getChemistryBonus } from './gameEngine';
import { COACHES } from './gameData';
import { RED_PENALTY, INJURY_DEBUFF } from './discipline';

// mulberry32 seeded — determinístico (padrão do balance.test.ts).
function seed(s: number) {
  let a = s >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('cards & injuries — taxas na faixa-alvo', () => {
  beforeEach(() => { vi.spyOn(Math, 'random').mockImplementation(seed(12345)); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('em 200 jogos: ~3-4 amarelos/jogo, vermelho e lesão raros mas presentes', () => {
    let yellows = 0, reds = 0, injuries = 0, goals = 0;
    for (let i = 0; i < 200; i++) {
      const a = generateBotTeam('A' + i, 0.7), b = generateBotTeam('B' + i, 0.7);
      const r = simulateMatch(a, b);
      yellows += r.events.filter(e => e.type === 'yellow').length;
      reds += r.events.filter(e => e.type === 'red').length;
      injuries += r.events.filter(e => e.type === 'injury').length;
      goals += r.homeGoals + r.awayGoals;
    }
    const yPer = yellows / 200, gPer = goals / 200;
    expect(yPer).toBeGreaterThan(1.0); expect(yPer).toBeLessThan(5.5);   // ~1.5/jogo (média baixa)
    expect(reds).toBeGreaterThan(0); expect(reds).toBeLessThan(110);     // raro (~1 a cada 3-4 jogos)
    expect(injuries).toBeGreaterThan(4); expect(injuries).toBeLessThan(60); // ~0.10/jogo (raras: 0 em ~90% dos jogos)
    expect(gPer).toBeGreaterThan(1.2); expect(gPer).toBeLessThan(4.0);   // sanidade (calibração fina fica na suíte de balanço)
  });

  it('cartão aparece mais em zaga/volante que em atacante (distribuição por posição)', () => {
    let defMidCards = 0, atkCards = 0;
    for (let i = 0; i < 200; i++) {
      const a = generateBotTeam('A' + i, 0.7), b = generateBotTeam('B' + i, 0.7);
      const r = simulateMatch(a, b);
      const posOf = (id: string) => [...a.players, ...b.players].find(p => p.id === id)?.position;
      for (const e of r.events.filter(e => e.type === 'yellow' || e.type === 'red')) {
        const pos = e.playerId ? posOf(e.playerId) : undefined;
        if (!pos) continue;
        if (['CB', 'CDM', 'LB', 'RB', 'CM'].includes(pos)) defMidCards++;
        else if (['ST', 'CF', 'LW', 'RW'].includes(pos)) atkCards++;
      }
    }
    expect(defMidCards).toBeGreaterThan(atkCards);
  });

  it('formação de bloco baixo (5-3-2) leva mais cartão que a de 3 zagueiros (3-4-3)', () => {
    const cardsWithFormation = (formationId: string) => {
      let c = 0;
      for (let i = 0; i < 120; i++) {
        const test = generateBotTeam('T' + i, 0.7); test.formationId = formationId;
        const res = simulateMatch(test, generateBotTeam('O' + i, 0.7));
        c += res.events.filter(e => (e.type === 'yellow' || e.type === 'red') && test.players.some(p => p.id === e.playerId)).length;
      }
      return c;
    };
    expect(cardsWithFormation('5-3-2')).toBeGreaterThan(cardsWithFormation('3-4-3'));
  });
});

describe('hierarquia 🟥 > lesão (força)', () => {
  it('lesão baixa a força; e RED_PENALTY dói mais que uma única lesão', () => {
    const t = generateBotTeam('X', 0.7);
    const coach = COACHES.find(c => c.id === t.coachId)!;
    const chem = getChemistryBonus(t.totalChemistry);
    const full = calculateTeamStrength(t, coach, chem, 0);
    const midId = t.players[5].id;
    const injured = calculateTeamStrength(t, coach, chem, 0, { injuredDebuff: { [midId]: INJURY_DEBUFF }, injuryDebuff: INJURY_DEBUFF });
    expect(injured).toBeLessThan(full);                 // lesão sempre reduz
    expect(RED_PENALTY).toBeGreaterThan(full - injured); // 10 homens (penalidade) dói mais
  });
});
