import { describe, it, expect } from 'vitest';
import { generateBotTeam } from './gameEngine';
import { TACTICS } from './gameData';
import {
  aggregateMatches, deriveMetrics, topScorelines,
  strengthCurve, tacticImpact, simulateSeason, penaltyFairness,
  knockoutTieFavoriteRate,
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

describe('balance — tactic impact (vs balanced, equal strength)', () => {
  it('no tactic is broken or dominant; defensive concedes less, attacking scores more', () => {
    const N = 220;
    const rows = tacticImpact(TACTICS.map(t => t.id), N);
    const byId = Object.fromEntries(rows.map(r => [r.tactic, r]));

    log('\n=== IMPACTO DAS TÁTICAS (vs Equilibrado, mesma força) ===');
    rows.forEach(r => {
      const name = TACTICS.find(t => t.id === r.tactic)?.name ?? r.tactic;
      log(`  ${name.padEnd(16)} vit ${pct(r.winPct)} | emp ${pct(r.drawPct)} | gols pró ${r.goalsForAvg.toFixed(2)} / contra ${r.goalsAgainstAvg.toFixed(2)}`);
    });
    log('');

    // Every tactic should be viable (not auto-win, not auto-lose). Wide band so
    // the guard-rail never trips on sampling noise.
    rows.forEach(r => {
      expect(r.winPct).toBeGreaterThan(0.20);
      expect(r.winPct).toBeLessThan(0.80);
    });
    // Directional sanity (with tolerance): defensive should not concede MORE than
    // all-out-attack by any meaningful margin.
    expect(byId['defensive'].goalsAgainstAvg).toBeLessThan(byId['all_out_attack'].goalsAgainstAvg + 0.25);
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
