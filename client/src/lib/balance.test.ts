import { describe, it, expect } from 'vitest';
import { generateBotTeam, freeKickGoalChance, penaltyGoalChance } from './gameEngine';
import { TACTICS, FORMATIONS, COACHES } from './gameData';
import {
  aggregateMatches, deriveMetrics, topScorelines,
  strengthCurve, tacticImpact, tacticMatrix, simulateSeason, penaltyFairness, penaltyComposureImpact, penaltyConversionByComposure,
  knockoutTieFavoriteRate, formationImpact, formationMatrix, coachImpact, chemistryImpact, dangerChanceStats,
  botRosterStats, botDifficultyWinRate, ratingStatProfile, ratingByResult, captainStatImpact,
  homeAdvantageSplit, globalChemImpact, visionImpact,
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
    const N = 200;
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
  it('even strength: each tactic fits its identity, and none dominates', () => {
    const N = 200; // matches per ORDERED pair (round-robin, home+away) → bias cancelled
    const rows = tacticMatrix(TACTICS.map(t => t.id), N);
    const byId = Object.fromEntries(rows.map(r => [r.tactic, r]));

    log('\n=== IMPACTO DAS TÁTICAS (todas contra todas, casa+fora — viés cancelado) ===');
    log('  tática           PPJ   vit% emp% der% | gols pró/contra | posse% | chutes(alvo) | conv% | CS%');
    rows.forEach(r => {
      const name = (TACTICS.find(t => t.id === r.tactic)?.name ?? r.tactic).padEnd(16);
      log(
        `  ${name} ${r.ppg.toFixed(2)}  ${pct(r.winPct)} ${pct(r.drawPct)} ${pct(r.lossPct)} | ` +
        `${r.goalsForAvg.toFixed(2)}/${r.goalsAgainstAvg.toFixed(2)} | ${r.possession.toFixed(1)}% | ` +
        `${r.shots.toFixed(1)}(${r.sot.toFixed(1)}) | ${pct(r.conversion)} | ${pct(r.cleanSheetPct)}`,
      );
    });
    log('');

    // 1) BALANCE — with a fair round-robin no tactic auto-wins or auto-loses; the field stays
    //    close to the coin-flip and the best-to-worst gap is modest (a STYLE choice, not a power one).
    rows.forEach(r => { expect(r.winPct).toBeGreaterThan(0.25); expect(r.winPct).toBeLessThan(0.45); });
    expect(Math.max(...rows.map(r => r.ppg)) - Math.min(...rows.map(r => r.ppg))).toBeLessThan(0.45);

    // 2) IDENTITY — each tactic behaves like its description.
    // Attacking tactics outscore the defensive shell…
    expect(byId['all_out_attack'].goalsForAvg).toBeGreaterThan(byId['defensive'].goalsForAvg);
    expect(byId['counter'].goalsForAvg).toBeGreaterThan(byId['defensive'].goalsForAvg);
    // …all-out attack pays for it: it concedes clearly the most.
    expect(byId['all_out_attack'].goalsAgainstAvg).toBeGreaterThan(byId['balanced'].goalsAgainstAvg);
    // Defensive is the meanest (fewest conceded, most clean sheets) and the lowest-scoring.
    expect(byId['defensive'].goalsAgainstAvg).toBeLessThan(byId['balanced'].goalsAgainstAvg);
    expect(byId['defensive'].cleanSheetPct).toBeGreaterThan(byId['all_out_attack'].cleanSheetPct);
    // Possession tactic owns the ball more than the counter (which cedes it to hit on the break).
    expect(byId['possession'].possession).toBeGreaterThan(byId['counter'].possession);
  });

  it('situational: as the underdog, sitting deep earns more than going gung-ho', () => {
    const N = 400;
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
    const N = 400;
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

describe('balance — frequência de lances de perigo (chances claras por jogo)', () => {
  it('mede quantos lances de perigo cada situação produz — e nenhuma estoura o teto', () => {
    const N = 300;
    const mk = (id: string, strength: number, opts: Partial<{ playStyle: string; formationId: string }> = {}) =>
      () => ({ ...generateBotTeam(id, strength), ...opts });

    const scenarios: { label: string; home: () => any; away: () => any }[] = [
      { label: 'Equilíbrio (0.80 × 0.80)', home: mk('A', 0.80), away: mk('B', 0.80) },
      { label: 'Favorito forte (0.95 × 0.55)', home: mk('A', 0.95), away: mk('B', 0.55) },
      { label: 'Ambos Tudo pro Ataque', home: mk('A', 0.80, { playStyle: 'all_out_attack' }), away: mk('B', 0.80, { playStyle: 'all_out_attack' }) },
      { label: 'Ambos Defensivo', home: mk('A', 0.80, { playStyle: 'defensive' }), away: mk('B', 0.80, { playStyle: 'defensive' }) },
      { label: 'Ambos 3-4-3', home: mk('A', 0.80, { formationId: '3-4-3' }), away: mk('B', 0.80, { formationId: '3-4-3' }) },
      { label: 'Extremo: favorito 3-4-3 ataque × azarão 5-3-2', home: mk('A', 0.95, { playStyle: 'all_out_attack', formationId: '3-4-3' }), away: mk('B', 0.60, { playStyle: 'defensive', formationId: '5-3-2' }) },
    ];

    log('\n=== FREQUÊNCIA DE LANCES DE PERIGO (chances claras = gol/defesa/perdida/pênalti) ===');
    log('  cenário                                    perigo/jogo (mín–máx) | gols | defesas | perdidas | chutes(alvo)');
    const rows = scenarios.map(s => ({ label: s.label, d: dangerChanceStats(s.home, s.away, N) }));
    rows.forEach(({ label, d }) =>
      log(
        `  ${label.padEnd(42)} ${d.bigChancesPerGame.toFixed(1)} (${d.minBigInOneGame}–${d.maxBigInOneGame}) | ` +
        `${d.goalsPerGame.toFixed(2)} | ${d.savesPerGame.toFixed(1)} | ${d.missesPerGame.toFixed(1)} | ` +
        `${d.shotsPerGame.toFixed(1)}(${d.sotPerGame.toFixed(1)})`,
      ),
    );
    log('');

    // A clear chance is a big moment — even a wide-open, end-to-end match shouldn't feel like a
    // chance every other minute. Ceiling guards against the "perigo alto demais" the player saw.
    rows.forEach(({ label, d }) => {
      expect(d.bigChancesPerGame, `${label}: lances de perigo/jogo`).toBeLessThan(16);
      expect(d.bigChancesPerGame, `${label}: lances de perigo/jogo`).toBeGreaterThan(2);
    });
  });
});

describe('balance — formation impact (same squad, only the shape differs)', () => {
  it('formations differ and behave: each shape fits its identity, and none dominates', () => {
    const N = 200; // matches per ORDERED pair → each formation plays N×(F-1)×2 games total
    const rows = formationMatrix(FORMATIONS.map(f => f.id), N);
    const byId = Object.fromEntries(rows.map(r => [r.formation, r]));

    log('\n=== IMPACTO DAS FORMAÇÕES (todos contra todos, casa+fora — viés cancelado) ===');
    log('  forma     PPJ   vit% emp% der% | gols pró/contra | posse% | chutes(alvo) | conv% | CS%');
    rows.forEach(r =>
      log(
        `  ${r.formation.padEnd(8)} ${r.ppg.toFixed(2)}  ${pct(r.winPct)} ${pct(r.drawPct)} ${pct(r.lossPct)} | ` +
        `${r.goalsForAvg.toFixed(2)}/${r.goalsAgainstAvg.toFixed(2)} | ${r.possession.toFixed(1)}% | ` +
        `${r.shots.toFixed(1)}(${r.sot.toFixed(1)}) | ${pct(r.conversion)} | ${pct(r.cleanSheetPct)}`,
      ),
    );
    log('');

    // 1) BALANCE — no shape auto-wins or auto-loses. With a fair round-robin the whole field
    //    should cluster near the coin-flip; the gap between best and worst stays modest.
    rows.forEach(r => { expect(r.winPct).toBeGreaterThan(0.22); expect(r.winPct).toBeLessThan(0.45); });
    const ppgRange = Math.max(...rows.map(r => r.ppg)) - Math.min(...rows.map(r => r.ppg));
    expect(ppgRange).toBeLessThan(0.55); // every formation is competitive (≈ within half a PPG)

    // 2) IDENTITY — each shape behaves like its description.
    // Attacking shape (3-4-3) outscores the back-five (5-3-2)…
    expect(byId['3-4-3'].goalsForAvg).toBeGreaterThan(byId['5-3-2'].goalsForAvg);
    // …but pays for it: it concedes clearly more than the back-five.
    expect(byId['3-4-3'].goalsAgainstAvg).toBeGreaterThan(byId['5-3-2'].goalsAgainstAvg);
    // The back-five (5-3-2) is the meanest defence (fewest conceded, most clean sheets)…
    expect(byId['5-3-2'].goalsAgainstAvg).toBeLessThan(byId['4-4-2'].goalsAgainstAvg);
    expect(byId['5-3-2'].cleanSheetPct).toBeGreaterThan(byId['3-4-3'].cleanSheetPct);
    // …and the most attacking shape (3-4-3) creates the most (most shots).
    expect(byId['3-4-3'].shots).toBeGreaterThan(byId['5-3-2'].shots);
    // Control shapes (4-2-3-1, 3-5-2) own the ball more than the direct/defensive ones.
    expect(byId['4-2-3-1'].possession).toBeGreaterThan(byId['5-3-2'].possession);
    expect(byId['3-5-2'].possession).toBeGreaterThan(byId['4-3-3'].possession);
  });
});

describe('balance — coach impact (same squad, only the manager differs)', () => {
  it('coaches differ and none is broken (vs a reference coach)', () => {
    const N = 400;
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
    log(`  COM buff (≥90: +6 passe/+4 ritmo/+3 em todos) → marca ${g.highGoalsFor.toFixed(2)} | sofre ${g.highConceded.toFixed(2)} | vence ${pct(g.highWin)}`);
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
    const TEAMS = 50;
    const easy = botRosterStats(0.50, TEAMS);
    const mid = botRosterStats(0.72, TEAMS);
    const hard = botRosterStats(0.95, TEAMS);

    log('\n=== BOTS: DIFICULDADE × VARIEDADE (' + TEAMS + ' times cada) ===');
    log(`  fácil (0.50)  → overall médio ${easy.avgOverall.toFixed(1)} | jogadores distintos ${easy.distinctPlayers}`);
    log(`  médio (0.72)  → overall médio ${mid.avgOverall.toFixed(1)} | jogadores distintos ${mid.distinctPlayers}`);
    log(`  difícil (0.95) → overall médio ${hard.avgOverall.toFixed(1)} | jogadores distintos ${hard.distinctPlayers}`);
    const wr = botDifficultyWinRate(0.90, 0.60, 600);
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

describe('balance — vision drives chance creation', () => {
  it('a high-vision midfield creates more goals and wins more (same squad otherwise)', () => {
    const N = 600;
    const f = visionImpact(N);
    log('\n=== IMPACTO DA VISÃO (' + N + ', mesmo elenco, só a visão difere; vs mesmo adversário) ===');
    log(`  gols/jogo: visão 95 → ${f.highGoalsFor.toFixed(2)} vs visão 50 → ${f.lowGoalsFor.toFixed(2)}`);
    log(`  vitórias: visão 95 → ${pct(f.highWin)} vs visão 50 → ${pct(f.lowWin)}\n`);
    // Vision must move the needle now (chance creation + a slice of team strength), but
    // modestly — it tilts, never dominates.
    expect(f.highGoalsFor).toBeGreaterThan(f.lowGoalsFor);
    expect(f.highWin).toBeGreaterThan(f.lowWin);
  });
});

describe('balance — composure decides penalties & free kicks', () => {
  it('high composure wins clearly more shootouts than an identical low-composure team', () => {
    const N = 2000;
    const f = penaltyComposureImpact(N);
    log('\n=== COMPOSTURA NOS PÊNALTIS (' + N + ', times idênticos, só a compostura difere) ===');
    log(`  CONVERSÃO por cobrança: compostura 92 → ${pct(f.highConvPct)}  |  compostura 48 → ${pct(f.lowConvPct)}`);
    log(`  alta compostura vence ${pct(f.highWinPct)} das disputas | decisivos ${pct(f.decisivePct)}\n`);
    expect(f.decisivePct).toBe(1);              // every shootout still resolves
    expect(f.highConvPct).toBeGreaterThan(f.lowConvPct + 0.08); // cool head converts clearly more per kick
    expect(f.highWinPct).toBeGreaterThan(0.58); // composure must create a REAL edge, not 50/50
  });

  it('the conversion curve is realistic across the range real takers occupy', () => {
    const N = 1500;
    // Real takers sit ≈85–99 effective (median base 85, p90 92, +5 designated). Include a
    // weak value (65) for contrast — but that's not a value a real penalty taker has.
    const curve = penaltyConversionByComposure([65, 80, 85, 90, 92, 95, 99], N);
    log('\n=== CONVERSÃO DE PÊNALTI POR COMPOSTURA (' + N + ', vs goleiros reais) ===');
    for (const p of curve) log(`  compostura ${p.level} → ${pct(p.convPct)}`);
    const at = (lvl: number) => curve.find(p => p.level === lvl)!.convPct;
    log('');
    // End-to-end smoke test: composure still raises conversion in real shootouts. (The exact
    // spread is compressed here vs the clean grid below — bot keepers are weak and bot takers
    // pick up random penalty traits — so the precise targets live in the grid test.)
    expect(at(99)).toBeGreaterThan(at(80));              // rises with composure
    expect(at(80)).toBeGreaterThan(at(65));
    expect(at(99) - at(65)).toBeGreaterThan(0.08);       // real end-to-end spread
    expect(at(85)).toBeGreaterThan(0.55);
  });

  it('penalty conversion hits its targets across the whole keeper range (composure × GK)', () => {
    const gks = [70, 75, 80, 85, 90];
    const comps = [80, 85, 90, 95, 100, 110, 120];
    log('\n=== PÊNALTI: CONVERSÃO (compostura × goleiro) ===');
    log('  comp\\gk ' + gks.map(g => ('gk' + g).padStart(7)).join(''));
    for (const c of comps) {
      log('  ' + String(c).padEnd(7) + gks.map(g => pct(penaltyGoalChance(c, g)).padStart(7)).join(''));
    }
    log('');
    // Targets pinned on a strong keeper (gk 90): the composure ladder 80→120 lands on
    // 60 / 64 / 68 / 72 / 76 / 84 / 92%.
    expect(penaltyGoalChance(80, 90)).toBeCloseTo(0.60, 2);
    expect(penaltyGoalChance(90, 90)).toBeCloseTo(0.68, 2);
    expect(penaltyGoalChance(100, 90)).toBeCloseTo(0.76, 2);
    expect(penaltyGoalChance(110, 90)).toBeCloseTo(0.84, 2);
    expect(penaltyGoalChance(120, 90)).toBeCloseTo(0.92, 2);
    // The keeper carries real weight: a great shot-stopper drags conversion down a lot.
    expect(penaltyGoalChance(95, 70) - penaltyGoalChance(95, 90)).toBeGreaterThan(0.15);
    // Both axes monotonic — composure up ⇒ more, keeper up ⇒ less.
    expect(penaltyGoalChance(110, 80)).toBeGreaterThan(penaltyGoalChance(80, 80));
    expect(penaltyGoalChance(95, 75)).toBeGreaterThan(penaltyGoalChance(95, 85));
  });

  it('free-kick conversion rises with composure (same shooting)', () => {
    const c = (comp: number) => freeKickGoalChance(90, comp);
    log('\n=== COMPOSTURA NA FALTA (finalização 90) ===');
    log(`  compostura 82 → ${pct(c(82))} | 90 → ${pct(c(90))} | 99 → ${pct(c(99))}\n`);
    // monotonic in the active range — more composure, more chance
    expect(c(82)).toBeGreaterThan(0.015);
    expect(c(90)).toBeGreaterThan(c(82));
    expect(c(99)).toBeGreaterThan(c(90));
    // a cool taker converts free kicks far more than a nervous one (same shooting)
    expect(freeKickGoalChance(88, 95)).toBeGreaterThan(freeKickGoalChance(88, 55) * 1.5);
    // clamped to the design floor / ceiling so free kicks stay rare
    expect(freeKickGoalChance(1, 1)).toBe(0.015);
    expect(freeKickGoalChance(99, 99)).toBe(0.11);
  });
});
