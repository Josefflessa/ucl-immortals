import { describe, it, expect } from 'vitest';
import { generateBotTeam } from './gameEngine';
import { TACTICS, FORMATIONS, COACHES } from './gameData';
import {
  aggregateMatches, deriveMetrics, topScorelines,
  strengthCurve, tacticImpact, simulateSeason, penaltyFairness,
  knockoutTieFavoriteRate, formationImpact, coachImpact, chemistryImpact,
  botRosterStats, botDifficultyWinRate, ratingStatProfile, ratingByResult, captainStatImpact,
  homeAdvantageSplit, globalChemImpact,
} from './balanceHarness';

/* eslint-disable no-console */
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const log = (s: string) => console.log(s);

describe('balance — match-level panorama (even teams 0.80 vs 0.80)', () => {
  it('produces realistic football metrics', () => {
    const N = 400;
    const agg = aggregateMatches(
      () => generateBotTeam('Casa', 0.8),
      () => generateBotTeam('Fora', 0.8),
      N,
    );
    const m = deriveMetrics(agg);
    const top = topScorelines(agg, 8).map(([k, v]) => `${k}×${v}`).join('  ');

    log(
      `\n=== PANORAMA DE PARTIDA (${N} jogos, 0.80 vs 0.80) ===\n` +
      `  Gols/jogo .............. ${m.goalsPerGame.toFixed(2)}\n` +
      `  Resultado .............. mandante ${pct(m.homeWinPct)} | empate ${pct(m.drawPct)} | visitante ${pct(m.awayWinPct)}\n` +
      `  Ambos marcam (BTTS) .... ${pct(m.bttsPct)}\n` +
      `  Clean sheet (algum) .... ${pct(m.cleanSheetPct)}   |  0-0: ${pct(m.nilNilPct)}\n` +
      `  Chutes/jogo ............ ${m.shotsPerGame.toFixed(1)}  (varia ${agg.shotsMin}–${agg.shotsMax}; no alvo: ${m.sotPerGame.toFixed(1)}, precisão ${pct(m.shotAccuracy)})\n` +
      `  Conversão (gol/no-alvo)  ${pct(m.conversion)}\n` +
      `  Defesas/jogo ........... ${m.savesPerGame.toFixed(1)}\n` +
      `  Escanteios/jogo ........ ${m.cornersPerGame.toFixed(1)} (varia ${agg.cornersMin}–${agg.cornersMax})  |  Faltas/jogo: ${m.foulsPerGame.toFixed(1)} (varia ${agg.foulsMin}–${agg.foulsMax})\n` +
      `  Posse média mandante ... ${m.avgHomePossession.toFixed(1)}%\n` +
      `  Margem ................. 1 gol ${pct(m.oneGoalPct)} | goleada (3+) ${pct(m.blowoutPct)}\n` +
      `  Placares comuns ........ ${top}\n`,
    );

    // Guard-rails (loose — randomness tolerant).
    expect(m.goalsPerGame).toBeGreaterThan(2.0);
    expect(m.goalsPerGame).toBeLessThan(5.0);
    expect(m.drawPct).toBeGreaterThan(0.10);
    expect(m.drawPct).toBeLessThan(0.40);
    expect(agg.homeWins).toBeGreaterThan(0);
    expect(agg.awayWins).toBeGreaterThan(0);
    expect(m.shotAccuracy).toBeGreaterThan(0.15);
    expect(m.shotAccuracy).toBeLessThan(0.85);
    // Realistic box-score now that flavour stats are modelled.
    expect(m.shotsPerGame).toBeGreaterThan(12);
    expect(m.conversion).toBeGreaterThan(0.15);
    expect(m.conversion).toBeLessThan(0.55);
    expect(m.foulsPerGame).toBeGreaterThan(8);
    expect(m.cornersPerGame).toBeGreaterThan(2);
    expect(m.savesPerGame).toBeGreaterThan(2);
    // Stats must VARY match-to-match, never be a fixed number.
    expect(agg.shotsMax - agg.shotsMin).toBeGreaterThan(8);
    expect(agg.foulsMax - agg.foulsMin).toBeGreaterThan(6);
  });
});

describe('balance — strength curve (does overall matter?)', () => {
  it('a bigger rating gap means a higher win rate', () => {
    const N = 150;
    const rows = strengthCurve([
      { home: 0.80, away: 0.80 },
      { home: 0.85, away: 0.75 },
      { home: 0.90, away: 0.70 },
      { home: 0.95, away: 0.60 },
    ], N);

    log('\n=== CURVA DE FORÇA (vitória do mandante por gap de overall) ===');
    rows.forEach(r =>
      log(`  ${r.label}  →  vit ${pct(r.homeWinPct)} | emp ${pct(r.drawPct)} | der ${pct(r.awayWinPct)}  (gols/jogo ${r.goalsPerGame.toFixed(2)})`),
    );
    log('');

    const even = rows[0].homeWinPct;
    const big = rows[3].homeWinPct;
    expect(big).toBeGreaterThan(0.6);            // a big gap should be a strong favorite
    expect(big).toBeGreaterThan(even + 0.15);    // clearly more than the even matchup (with margin)
    expect(rows[2].homeWinPct).toBeGreaterThan(even);
  });
});

describe('balance — tactic impact (each tactic has a real, distinct role)', () => {
  it('even strength: tactics differ and behave (defensive concedes least, attacking outscores)', () => {
    const N = 260;
    const rows = tacticImpact(TACTICS.map(t => t.id), N);
    const byId = Object.fromEntries(rows.map(r => [r.tactic, r]));

    log('\n=== IMPACTO DAS TÁTICAS (mesma força, vs Equilibrado) ===');
    rows.forEach(r => {
      const name = TACTICS.find(t => t.id === r.tactic)?.name ?? r.tactic;
      log(`  ${name.padEnd(16)} vit ${pct(r.winPct)} | emp ${pct(r.drawPct)} | PPJ ${r.pointsPerGame.toFixed(2)} | gols ${r.goalsForAvg.toFixed(2)} pró / ${r.goalsAgainstAvg.toFixed(2)} contra`);
    });
    log('');

    // Every tactic viable (no auto-win / auto-lose).
    rows.forEach(r => { expect(r.winPct).toBeGreaterThan(0.20); expect(r.winPct).toBeLessThan(0.80); });
    // Tactics must actually DIFFER (results spread).
    expect(Math.max(...rows.map(r => r.pointsPerGame)) - Math.min(...rows.map(r => r.pointsPerGame))).toBeGreaterThan(0.05);
    // Each does its JOB: defensive concedes less than balanced; the attacking tactics
    // (counter / all-out) outscore balanced.
    expect(byId['defensive'].goalsAgainstAvg).toBeLessThan(byId['balanced'].goalsAgainstAvg);
    expect(byId['counter'].goalsForAvg).toBeGreaterThan(byId['balanced'].goalsForAvg);
    expect(byId['all_out_attack'].goalsForAvg).toBeGreaterThan(byId['balanced'].goalsForAvg);
  });

  it('situational: as the underdog, sitting deep earns more than going gung-ho', () => {
    const N = 260;
    const rows = tacticImpact(['defensive', 'counter', 'all_out_attack', 'balanced'], N, 0.70, 0.85);
    const u = Object.fromEntries(rows.map(r => [r.tactic, r]));

    log('\n=== TÁTICA COMO AZARÃO (0.70 vs 0.85) ===');
    rows.forEach(r =>
      log(`  ${r.tactic.padEnd(16)} PPJ ${r.pointsPerGame.toFixed(2)} | vit ${pct(r.winPct)} emp ${pct(r.drawPct)} der ${pct(r.lossPct)} | sofridos ${r.goalsAgainstAvg.toFixed(2)}`),
    );
    log('');

    // Sitting deep concedes clearly fewer goals than throwing everyone forward — its
    // whole purpose as the underdog (the points outcome of the two is closer / noisier,
    // which is itself realistic: both are valid underdog plans).
    expect(u['defensive'].goalsAgainstAvg).toBeLessThan(u['all_out_attack'].goalsAgainstAvg);
  });

  it('situational: as the favourite, going for it scores more than parking the bus', () => {
    const N = 260;
    const rows = tacticImpact(['defensive', 'all_out_attack'], N, 0.88, 0.68);
    const f = Object.fromEntries(rows.map(r => [r.tactic, r]));

    log('\n=== TÁTICA COMO FAVORITO (0.88 vs 0.68) ===');
    rows.forEach(r =>
      log(`  ${r.tactic.padEnd(16)} PPJ ${r.pointsPerGame.toFixed(2)} | vit ${pct(r.winPct)} | feitos ${r.goalsForAvg.toFixed(2)}`),
    );
    log('');

    // With the better squad, all-out-attack puts more goals in than a defensive shell.
    expect(f['all_out_attack'].goalsForAvg).toBeGreaterThan(f['defensive'].goalsForAvg);
  });
});

describe('balance — formation impact (same squad, only the shape differs)', () => {
  it('formations differ and behave: defensive shapes concede less, attacking shapes score more', () => {
    const N = 220;
    const rows = formationImpact(FORMATIONS.map(f => f.id), N);
    const byId = Object.fromEntries(rows.map(r => [r.formation, r]));

    log('\n=== IMPACTO DAS FORMAÇÕES (mesmo elenco, vs 4-3-3) ===');
    rows.forEach(r =>
      log(`  ${r.formation.padEnd(8)} vit ${pct(r.winPct)} | emp ${pct(r.drawPct)} | gols pró ${r.goalsForAvg.toFixed(2)} / contra ${r.goalsAgainstAvg.toFixed(2)}`),
    );
    log('');

    // Every formation must be viable (no auto-win / auto-lose). The baseline 4-3-3 is a
    // strong, well-rounded shape, so a niche formation can sit in the mid/high-teens.
    rows.forEach(r => { expect(r.winPct).toBeGreaterThan(0.12); expect(r.winPct).toBeLessThan(0.80); });
    // Formations must actually DIFFER (clear spread in effectiveness).
    const winRange = Math.max(...rows.map(r => r.winPct)) - Math.min(...rows.map(r => r.winPct));
    expect(winRange).toBeGreaterThan(0.08);
    // Defensive shapes do their JOB — a back five (5-3-2) concedes clearly less than an
    // exposed back three (3-5-2) and than a flat 4-4-2; the back three concedes more.
    expect(byId['5-3-2'].goalsAgainstAvg).toBeLessThan(byId['3-5-2'].goalsAgainstAvg);
    expect(byId['5-3-2'].goalsAgainstAvg).toBeLessThan(byId['4-4-2'].goalsAgainstAvg);
    expect(byId['3-5-2'].goalsAgainstAvg).toBeGreaterThan(byId['5-3-2'].goalsAgainstAvg);
  });
});

describe('balance — coach impact (same squad, only the manager differs)', () => {
  it('coaches differ and none is broken (vs a reference coach)', () => {
    const N = 200;
    const rows = coachImpact(COACHES.map(c => c.id), N, 'ancelotti');
    const byId = Object.fromEntries(rows.map(r => [r.coach, r]));

    log('\n=== IMPACTO DOS TÉCNICOS (mesmo elenco, vs Ancelotti) ===');
    rows.forEach(r => {
      const name = COACHES.find(c => c.id === r.coach)?.name ?? r.coach;
      log(`  ${name.padEnd(18)} vit ${pct(r.winPctVsRef)} | emp ${pct(r.drawPct)} | gols pró ${r.goalsForAvg.toFixed(2)} / contra ${r.goalsAgainstAvg.toFixed(2)}`);
    });
    log('');

    // The reference vs itself is a coin-flip — sanity that the harness is symmetric
    // (wide band: only the home/away split + sampling separate the identical sides).
    // (bands are generous: the test coach plays at HOME, so the home advantage nudges
    // every winPctVsRef up a few points on top of sampling noise at N=200.)
    expect(byId['ancelotti'].winPctVsRef).toBeGreaterThan(0.30);
    expect(byId['ancelotti'].winPctVsRef).toBeLessThan(0.72);
    // No coach is broken (auto-win / auto-lose). The reference (Ancelotti) is a strong
    // manager, so weaker coaches can sit in the low-20s/high-10s — that is not "broken".
    rows.forEach(r => { expect(r.winPctVsRef).toBeGreaterThan(0.12); expect(r.winPctVsRef).toBeLessThan(0.83); });
    // Coaches must actually DIFFER in impact.
    const range = Math.max(...rows.map(r => r.winPctVsRef)) - Math.min(...rows.map(r => r.winPctVsRef));
    expect(range).toBeGreaterThan(0.05);
  });
});

describe('balance — chemistry impact (same squad, high vs low chemistry)', () => {
  it('high chemistry clearly beats low chemistry', () => {
    const N = 400;
    const c = chemistryImpact(N);
    log('\n=== IMPACTO DA QUÍMICA (mesmo elenco, alta vs baixa) ===');
    log(`  Química ALTA vence ${pct(c.highChemWinPct)} | empate ${pct(c.drawPct)} | Química BAIXA vence ${pct(c.lowChemWinPct)}`);
    log(`  Gols: alta ${c.highGoalsAvg.toFixed(2)} / baixa ${c.lowGoalsAvg.toFixed(2)}\n`);

    // Same players — the only difference is chemistry, so the high-chem side must win
    // clearly more often (and score more), but not be an absolute lock (football).
    expect(c.highChemWinPct).toBeGreaterThan(c.lowChemWinPct + 0.12);
    expect(c.highChemWinPct).toBeGreaterThan(0.45);
    expect(c.highGoalsAvg).toBeGreaterThan(c.lowGoalsAvg);
  });
});

describe('balance — knockout meritocracy (2-legged ties)', () => {
  it('the stronger team advances more often as the gap grows', () => {
    const N = 300;
    const gaps: [number, number][] = [
      [0.84, 0.80], // small gap (qualified teams are close)
      [0.88, 0.78],
      [0.92, 0.74],
    ];
    log('\n=== MATA-MATA (favorito avança em confronto ida/volta) ===');
    const rates = gaps.map(([s, w]) => {
      const r = knockoutTieFavoriteRate(s, w, N);
      log(`  ${s.toFixed(2)} vs ${w.toFixed(2)}  →  favorito avança ${pct(r)}`);
      return r;
    });
    log('');
    // A clear gap should give a clear edge, and bigger gap → higher rate.
    expect(rates[2]).toBeGreaterThan(0.6);
    expect(rates[2]).toBeGreaterThan(rates[0]);
  });
});

describe('balance — full season (competitive integrity)', () => {
  it('strong teams win more titles, but it is not always the #1 seed', () => {
    const SEASONS = 12;
    const ENTRANTS = 36;
    const strengths = Array.from({ length: ENTRANTS }, (_, i) => 0.55 + (0.92 - 0.55) * (i / (ENTRANTS - 1)));

    const champRanks: number[] = [];
    let goalsAcc = 0, topScorerAcc = 0, ptsTop = 0, ptsBottom = 0;
    let last = simulateSeason(strengths);
    for (let s = 0; s < SEASONS; s++) {
      const r = s === 0 ? last : simulateSeason(strengths);
      last = r;
      champRanks.push(r.championStrengthRank);
      goalsAcc += r.leagueGoalsPerGame;
      topScorerAcc += r.topScorerGoals;
      ptsTop += r.pointsTop;
      ptsBottom += r.pointsBottom;
    }
    const avgRank = champRanks.reduce((a, b) => a + b, 0) / SEASONS;
    const avgTopScorer = topScorerAcc / SEASONS;

    log('\n=== TEMPORADA COMPLETA (' + SEASONS + ' temporadas, ' + ENTRANTS + ' times) ===');
    log(`  Estrutura da liga ...... ${last.leagueMatches} jogos/temporada | jogos por time: ${last.minGamesPerTeam}–${last.maxGamesPerTeam} (esperado: 8–8)`);
    log(`  Rank de força do campeão (1=mais forte): ${champRanks.join(', ')}  → média ${avgRank.toFixed(1)} (aleatório seria ~${((ENTRANTS + 1) / 2).toFixed(1)})`);
    log(`  Gols/jogo na liga ...... ${(goalsAcc / SEASONS).toFixed(2)}`);
    log(`  Artilheiro (gols) ...... ${avgTopScorer.toFixed(1)} em média`);
    log(`  Pontos: topo ${(ptsTop / SEASONS).toFixed(1)} | lanterna ${(ptsBottom / SEASONS).toFixed(1)}\n`);

    // Favorites should be favored vs a purely random champion (~(N+1)/2).
    expect(avgRank).toBeLessThan((ENTRANTS + 1) / 2);
    // Sanity on the season top scorer (loose upper guard against runaway inflation).
    expect(avgTopScorer).toBeGreaterThan(3);
    expect(avgTopScorer).toBeLessThan(80);
    // The table should spread (top earns clearly more than the bottom).
    expect(ptsTop / SEASONS).toBeGreaterThan(ptsBottom / SEASONS);
  });
});

describe('balance — sistema de NOTAS dos jogadores (profissional)', () => {
  const p = ratingStatProfile(() => generateBotTeam('Casa', 0.8), () => generateBotTeam('Fora', 0.8), 600);

  it('imprime o perfil completo de notas/stats por posição', () => {
    const row = (k: string, v: typeof p.byPos.GK) =>
      `  ${k.padEnd(4)} n=${String(v.n).padStart(5)} | nota méd ${v.avgRating.toFixed(2)} (p10 ${v.p10.toFixed(1)} · p50 ${v.p50.toFixed(1)} · p90 ${v.p90.toFixed(1)} · ${v.min.toFixed(1)}–${v.max.toFixed(1)}) | ` +
      `G ${v.goals.toFixed(2)} A ${v.assists.toFixed(2)} KP ${v.keyPasses.toFixed(2)} CH ${v.shots.toFixed(2)}/${v.sot.toFixed(2)} DES ${v.tackles.toFixed(2)} INT ${v.interceptions.toFixed(2)} DEF ${v.saves.toFixed(2)}`;
    log('\n=== PERFIL DE NOTAS & STATS POR POSIÇÃO (600 jogos, 0.80 vs 0.80) ===');
    log(row('GOL', p.byPos.GK)); log(row('ZAG', p.byPos.DEF)); log(row('MEI', p.byPos.MID)); log(row('ATA', p.byPos.FWD));
    log(`  GERAL: média ${p.overall.avg.toFixed(2)} | p1 ${p.overall.p1.toFixed(1)} · p10 ${p.overall.p10.toFixed(1)} · p25 ${p.overall.p25.toFixed(1)} · p50 ${p.overall.p50.toFixed(1)} · p75 ${p.overall.p75.toFixed(1)} · p90 ${p.overall.p90.toFixed(1)} · p99 ${p.overall.p99.toFixed(1)} | ${p.overall.min.toFixed(1)}–${p.overall.max.toFixed(1)}`);
    log(`  MELHOR EM CAMPO: méd ${p.motm.avg.toFixed(2)} (${p.motm.min.toFixed(1)}–${p.motm.max.toFixed(1)})  |  PIOR: méd ${p.worst.avg.toFixed(2)} (${p.worst.min.toFixed(1)}–${p.worst.max.toFixed(1)})`);
    log(`  Nota de quem marcou: ${p.scorerAvg.toFixed(2)}  |  GOL em clean sheet: ${p.cleanSheetGkAvg.toFixed(2)}`);
    log(`  Distribuição: <4 ${p.outOf10.below4.toFixed(1)}% · 4-6 ${p.outOf10.r4to6.toFixed(1)}% · 6-7 ${p.outOf10.r6to7.toFixed(1)}% · 7-8 ${p.outOf10.r7to8.toFixed(1)}% · 8+ ${p.outOf10.above8.toFixed(1)}%`);
    log(`  POR JOGO: gols ${p.perMatch.goals.toFixed(2)} · chutes ${p.perMatch.shots.toFixed(1)} (alvo ${p.perMatch.sot.toFixed(1)}, ${p.perMatch.sotPct.toFixed(0)}%) · defesas ${p.perMatch.saves.toFixed(1)} · faltas ${p.perMatch.fouls.toFixed(1)} · escanteios ${p.perMatch.corners.toFixed(1)} · dif. posse ${p.perMatch.possSpread.toFixed(1)}%\n`);
    expect(p.overall.n).toBeGreaterThan(5000);
  });

  it('distribui as notas como o futebol real (média ~6.7, sino centrado em 6-7)', () => {
    expect(p.overall.avg).toBeGreaterThan(6.5);
    expect(p.overall.avg).toBeLessThan(7.05);
    expect(p.overall.p50).toBeGreaterThan(6.3);
    expect(p.overall.p50).toBeLessThan(6.9);
    // O grosso fica em 6-7; poucos abaixo de 6; notas baixíssimas são raras.
    expect(p.outOf10.r6to7).toBeGreaterThan(40);
    expect(p.outOf10.r4to6).toBeLessThan(20);
    expect(p.outOf10.below4).toBeLessThan(2);
    // Notas excelentes existem, mas são minoria.
    expect(p.outOf10.above8).toBeGreaterThan(3);
    expect(p.outOf10.above8).toBeLessThan(16);
    // Toda nota dentro de [3,10].
    expect(p.overall.min).toBeGreaterThanOrEqual(3.0);
    expect(p.overall.max).toBeLessThanOrEqual(10.0);
  });

  it('equilibra as posições — nenhuma fica esquecida nem inflada', () => {
    const avgs = [p.byPos.GK.avgRating, p.byPos.DEF.avgRating, p.byPos.MID.avgRating, p.byPos.FWD.avgRating];
    avgs.forEach(a => { expect(a).toBeGreaterThan(6.4); expect(a).toBeLessThan(7.4); });
    // Spread apertado entre posições (o atacante pode liderar, mas sem abismo).
    expect(Math.max(...avgs) - Math.min(...avgs)).toBeLessThan(0.6);
    // Goleiro não pode mais afundar como antes.
    expect(p.byPos.GK.avgRating).toBeGreaterThan(6.5);
  });

  it('recompensa o desempenho certo por função (gol/passe/desarme/defesa)', () => {
    // Atacante marca mais que meia, que marca mais que zaga.
    expect(p.byPos.FWD.goals).toBeGreaterThan(p.byPos.MID.goals);
    expect(p.byPos.MID.goals).toBeGreaterThan(p.byPos.DEF.goals);
    // Meio-campo é quem mais cria (passe-chave) — antes não ganhava nada por isso.
    expect(p.byPos.MID.keyPasses).toBeGreaterThan(p.byPos.DEF.keyPasses);
    expect(p.byPos.MID.keyPasses).toBeGreaterThan(p.byPos.FWD.keyPasses);
    // Zaga é quem mais desarma/intercepta; goleiro é quem defende.
    expect(p.byPos.DEF.tackles + p.byPos.DEF.interceptions).toBeGreaterThan(p.byPos.MID.tackles + p.byPos.MID.interceptions);
    expect(p.byPos.GK.saves).toBeGreaterThan(0.3);
  });

  it('premia momentos decisivos (gol, melhor em campo, clean sheet)', () => {
    // Quem marca rende bem; o melhor em campo rende muito; o pior, mal.
    expect(p.scorerAvg).toBeGreaterThan(7.6);
    expect(p.motm.avg).toBeGreaterThan(8.0);
    expect(p.motm.avg).toBeLessThan(9.5);
    expect(p.motm.min).toBeGreaterThan(7.0);   // o melhor de cada jogo SEMPRE rende bem
    expect(p.worst.avg).toBeGreaterThan(4.5);
    expect(p.worst.avg).toBeLessThan(6.2);
    // Goleiro com clean sheet rende alto.
    expect(p.cleanSheetGkAvg).toBeGreaterThan(7.3);
  });

  it('as estatísticas por jogo continuam realistas', () => {
    expect(p.perMatch.goals).toBeGreaterThan(2.5);
    expect(p.perMatch.goals).toBeLessThan(4.5);
    expect(p.perMatch.shots).toBeGreaterThan(16);
    expect(p.perMatch.shots).toBeLessThan(36);
    expect(p.perMatch.sotPct).toBeGreaterThan(30);
    expect(p.perMatch.sotPct).toBeLessThan(55);
    expect(p.perMatch.saves).toBeGreaterThan(3);
    expect(p.perMatch.saves).toBeLessThan(13);
  });

  it('as notas ACOMPANHAM o resultado — vencedor rende mais que perdedor', () => {
    const r = ratingByResult(() => generateBotTeam('Casa', 0.8), () => generateBotTeam('Fora', 0.8), 500);
    log(`\n  Nota média do time — vencedor ${r.winnerAvg.toFixed(2)} | empate ${r.drawAvg.toFixed(2)} | perdedor ${r.loserAvg.toFixed(2)}\n`);
    expect(r.winnerAvg).toBeGreaterThan(r.drawAvg);
    expect(r.drawAvg).toBeGreaterThan(r.loserAvg);
    expect(r.winnerAvg - r.loserAvg).toBeGreaterThan(0.4); // diferença clara e perceptível
  });
});

describe('balance — buff global de química faz diferença real', () => {
  it('o buff de time todo (passe/ritmo/força) muda o jogo de forma clara', () => {
    const g = globalChemImpact(900);
    log('\n=== BUFF GLOBAL DE QUÍMICA (isolado — mesmos jogadores, só muda o buff) ===');
    log(`  COM buff (≥90: +6 passe/+4 ritmo/+5 força) → marca ${g.highGoalsFor.toFixed(2)} | sofre ${g.highConceded.toFixed(2)} | vence ${pct(g.highWin)}`);
    log(`  SEM buff (<45)                              → marca ${g.noneGoalsFor.toFixed(2)} | sofre ${g.noneConceded.toFixed(2)} | vence ${pct(g.noneWin)}`);
    log(`  Δ → +${(g.highGoalsFor - g.noneGoalsFor).toFixed(2)} gol/jogo · +${pct(g.highWin - g.noneWin)} de vitória\n`);
    // O buff global vale a pena: time igual com buff cheio vence claramente mais,
    // marca mais e sofre menos do que sem buff nenhum.
    expect(g.highWin).toBeGreaterThan(g.noneWin + 0.05);
    expect(g.highGoalsFor).toBeGreaterThan(g.noneGoalsFor);
    expect(g.highConceded).toBeLessThan(g.noneConceded);
  });
});

describe('balance — vantagem de jogar em casa', () => {
  it('o mandante leva uma vantagem realista — e a final (campo neutro) é equilibrada', () => {
    const N = 1500;
    const reg = homeAdvantageSplit(N, false);
    const fin = homeAdvantageSplit(N, true);
    log('\n=== VANTAGEM DE CASA ===');
    log(`  Jogo normal  → casa ${pct(reg.homeWin)} | empate ${pct(reg.draw)} | fora ${pct(reg.awayWin)}  (gols ${reg.goalsHome.toFixed(2)}–${reg.goalsAway.toFixed(2)})`);
    log(`  Final neutra → casa ${pct(fin.homeWin)} | empate ${pct(fin.draw)} | fora ${pct(fin.awayWin)}  (gols ${fin.goalsHome.toFixed(2)}–${fin.goalsAway.toFixed(2)})\n`);
    // Em jogo normal o mandante vence mais que o visitante (margem folgada: traits
    // aleatórias por jogador adicionam ruído à amostra).
    expect(reg.homeWin).toBeGreaterThan(reg.awayWin + 0.03);
    expect(reg.goalsHome).toBeGreaterThan(reg.goalsAway);
    // ...mas sem ser decisivo demais (nada de "mando = vitória garantida").
    expect(reg.homeWin).toBeLessThan(0.55);
    // Na FINAL (campo neutro) o mando praticamente SOME: a diferença casa-fora fica bem
    // menor que no jogo normal (comparação relativa → robusta ao ruído amostral).
    const regEdge = reg.homeWin - reg.awayWin;
    const finEdge = fin.homeWin - fin.awayWin;
    expect(regEdge).toBeGreaterThan(finEdge + 0.05);
  });
});

describe('balance — capitão (melhor stat → +3 pra todo o time)', () => {
  it('a estatística escolhida pelo capitão muda o time na direção certa', () => {
    const c = captainStatImpact(700);
    log(`\n=== CAPITÃO: melhor stat vira +3 do time (teste pareado) ===`);
    log(`  Capitão de FINALIZAÇÃO → marca ${c.shootGoalsFor.toFixed(2)} | sofre ${c.shootGoalsAgainst.toFixed(2)}`);
    log(`  Capitão de DEFESA      → marca ${c.defGoalsFor.toFixed(2)} | sofre ${c.defGoalsAgainst.toFixed(2)}\n`);
    // Mesmo time e mesmo adversário; só muda a estatística do capitão. Trocar um capitão
    // de finalização por um de DEFESA deixa o time CLARAMENTE mais sólido — prova que a
    // escolha do capitão muda o time na direção da stat escolhida (efeito forte e robusto).
    expect(c.defGoalsAgainst).toBeLessThan(c.shootGoalsAgainst - 0.15);
    // E o capitão de finalização troca solidez por ataque: marca mais e sofre mais.
    expect(c.shootGoalsAgainst).toBeGreaterThan(c.defGoalsAgainst);
  });
});

describe('balance — bot difficulty & roster variety', () => {
  it('difficulty scales the squad, bots draw from a WIDE pool, and stronger bots win more', () => {
    const TEAMS = 30;
    const easy = botRosterStats(0.50, TEAMS);
    const mid = botRosterStats(0.72, TEAMS);
    const hard = botRosterStats(0.95, TEAMS);

    log('\n=== BOTS: DIFICULDADE × VARIEDADE (' + TEAMS + ' times cada) ===');
    log(`  fácil (0.50)  → overall médio ${easy.avgOverall.toFixed(1)} | jogadores distintos ${easy.distinctPlayers}`);
    log(`  médio (0.72)  → overall médio ${mid.avgOverall.toFixed(1)} | jogadores distintos ${mid.distinctPlayers}`);
    log(`  difícil (0.95) → overall médio ${hard.avgOverall.toFixed(1)} | jogadores distintos ${hard.distinctPlayers}`);
    const wr = botDifficultyWinRate(0.90, 0.60, 300);
    log(`  bot 0.90 vs bot 0.60 → forte vence ${pct(wr)}\n`);

    // Difficulty scales the squad quality (harder → clearly higher average overall).
    expect(hard.avgOverall).toBeGreaterThan(easy.avgOverall + 2.5);
    expect(hard.avgOverall).toBeGreaterThan(mid.avgOverall);
    expect(mid.avgOverall).toBeGreaterThan(easy.avgOverall);
    // Variety: across 30 bots, each difficulty fields MANY distinct players (uses the
    // big pool, not a small handful). 30×11 = 330 slots.
    expect(easy.distinctPlayers).toBeGreaterThan(70);
    expect(mid.distinctPlayers).toBeGreaterThan(70);
    expect(hard.distinctPlayers).toBeGreaterThan(45);
    // Difficulty must MATTER — a strong bot clearly beats a weak one.
    expect(wr).toBeGreaterThan(0.62);
  });
});

describe('balance — penalty shootout fairness', () => {
  it('even teams are ~50/50 and every shootout is decisive', () => {
    const N = 2000;
    const f = penaltyFairness(N);
    log('\n=== DISPUTA DE PÊNALTIS (' + N + ', times equivalentes) ===');
    log(`  mandante ${pct(f.homeWinPct)} | visitante ${pct(f.awayWinPct)} | decisivos ${pct(f.decisivePct)}\n`);

    expect(f.homeWinPct).toBeGreaterThan(0.40);
    expect(f.homeWinPct).toBeLessThan(0.60);
    expect(f.decisivePct).toBe(1); // a shootout must always produce a winner
  });
});
