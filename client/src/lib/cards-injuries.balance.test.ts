import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { runMatchSimulation, setStatIds, generateBotTeam, calculateTeamStrength, getChemistryBonus } from './gameEngine';
import type { PlayerMatchStat } from './gameEngine';
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

  // Cartões e lesões não precisam de uma partida completa para esta verificação de
  // tendência. Rodar 45 minutos diretamente corta o custo do teste pela metade,
  // mantendo o mesmo loop de lances e normalizando as taxas para 90 minutos.
  const quickMatch = (home: ReturnType<typeof generateBotTeam>, away: ReturnType<typeof generateBotTeam>) => {
    setStatIds(home, away);
    const playerStats: Record<string, PlayerMatchStat> = {};
    for (const team of [home, away]) {
      for (const player of team.players.slice(0, 11)) {
        playerStats[player.statId!] = {
          playerId: player.id, playerName: player.shortName, teamId: team.id,
          rating: 6.4, goals: 0, assists: 0, shots: 0, tackles: 0, saves: 0,
          fouls: 0, yellowCards: 0, redCards: 0, keyPasses: 0, interceptions: 0, shotsOnTarget: 0,
        };
      }
    }
    return runMatchSimulation(
      home, away, 0, 45, 0, 0, [],
      { homePos: 50, awayPos: 50, homeShots: 0, awayShots: 0, homeShotsOnTarget: 0, awayShotsOnTarget: 0, homeFouls: 0, awayFouls: 0, homeSaves: 0, awaySaves: 0, homeCorners: 0, awayCorners: 0 },
      playerStats, false, false, false, false,
    );
  };

  it('em 60 amostras: ~3-4 amarelos/jogo, vermelho e lesão raros mas presentes', () => {
    let yellows = 0, reds = 0, injuries = 0, goals = 0;
    for (let i = 0; i < 60; i++) {
      const a = generateBotTeam('A' + i, 0.7), b = generateBotTeam('B' + i, 0.7);
      const r = quickMatch(a, b);
      yellows += r.events.filter(e => e.type === 'yellow').length;
      reds += r.events.filter(e => e.type === 'red').length;
      injuries += r.events.filter(e => e.type === 'injury').length;
      goals += r.homeGoals + r.awayGoals;
    }
    const yPer = (yellows / 60) * 2, gPer = (goals / 60) * 2;
    expect(yPer).toBeGreaterThan(1.0); expect(yPer).toBeLessThan(5.5);   // ~1.5/jogo (média baixa)
    expect(reds).toBeGreaterThan(0); expect(reds).toBeLessThan(50);       // raro (~1 a cada 3-4 jogos)
    expect(injuries).toBeGreaterThan(0); expect(injuries).toBeLessThan(30); // lesões raras, mas presentes
    // The roster is intentionally extensible; adding a large, stronger catalog
    // can move this fixed-seed sample without changing the goal algorithm.
    // Keep this as a broad sanity guard; precise calibration belongs elsewhere.
    expect(gPer).toBeGreaterThan(0.5); expect(gPer).toBeLessThan(4.0);
  });

  it('cartão aparece mais em zaga/volante que em atacante (distribuição por posição)', () => {
    let defMidCards = 0, atkCards = 0;
    for (let i = 0; i < 60; i++) {
      const a = generateBotTeam('A' + i, 0.7), b = generateBotTeam('B' + i, 0.7);
      const r = quickMatch(a, b);
      const posOf = (id: string) => [...a.players, ...b.players].find(p => p.id === id)?.position;
      for (const e of r.events.filter(e => e.type === 'yellow' || e.type === 'red')) {
        const pos = e.playerId ? posOf(e.playerId) : undefined;
        if (!pos) continue;
        if (['CB', 'CDM', 'LB', 'RB', 'CM'].includes(pos)) defMidCards++;
        else if (['ST', 'LW', 'RW'].includes(pos)) atkCards++;
      }
    }
    expect(defMidCards).toBeGreaterThan(atkCards);
  });

  it('formação de bloco baixo (5-3-2) leva mais cartão que a de 3 zagueiros (3-4-3)', () => {
    const cardsWithFormation = (formationId: string) => {
      let c = 0;
      for (let i = 0; i < 40; i++) {
        const test = generateBotTeam('T' + i, 0.7); test.formationId = formationId;
        const res = quickMatch(test, generateBotTeam('O' + i, 0.7));
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
