// UCL Immortals — Balance analysis harness
// Pure simulation/aggregation helpers used by balance.test.ts to produce a broad,
// professional read of the current game balance. No assertions here — just data.

import {
  Team, MatchResult, simulateMatch, simulatePenalties, generateBotTeam,
  generateLeagueFixtures, computeStandings, createKnockoutBracket,
  playActiveKnockoutLeg, advanceKnockoutBracket,
} from './gameEngine';
// Same squad, only the formation id changes — so formationImpact measures the
// tactical PROFILE of the shape in isolation (attack/defense/control/width), without
// the roster-fit / out-of-position confound (that is what chemistryImpact covers).
function withFormation(base: Team, formationId: string, id: string): Team {
  return { ...base, id, formationId };
}

// ============================================================
// MATCH-LEVEL AGGREGATE
// ============================================================
export interface MatchAgg {
  matches: number;
  totalGoals: number;
  homeGoals: number;
  awayGoals: number;
  homeWins: number;
  awayWins: number;
  draws: number;
  shutoutMatches: number; // at least one team kept a clean sheet
  nilNil: number;         // 0-0
  btts: number;           // both teams scored
  shots: number;
  shotsOnTarget: number;
  saves: number;
  corners: number;
  fouls: number;
  possessionHomeSum: number;
  scorelines: Record<string, number>;
  margin: { draw: number; one: number; two: number; threePlus: number };
  // Per-match ranges (to prove stats VARY, never fixed).
  shotsMin: number; shotsMax: number;
  foulsMin: number; foulsMax: number;
  cornersMin: number; cornersMax: number;
}

const emptyAgg = (): MatchAgg => ({
  matches: 0, totalGoals: 0, homeGoals: 0, awayGoals: 0,
  homeWins: 0, awayWins: 0, draws: 0, shutoutMatches: 0, nilNil: 0, btts: 0,
  shots: 0, shotsOnTarget: 0, saves: 0, corners: 0, fouls: 0, possessionHomeSum: 0,
  scorelines: {}, margin: { draw: 0, one: 0, two: 0, threePlus: 0 },
  shotsMin: Infinity, shotsMax: 0, foulsMin: Infinity, foulsMax: 0, cornersMin: Infinity, cornersMax: 0,
});

export function accumulate(agg: MatchAgg, r: MatchResult, homeId: string, awayId: string): void {
  agg.matches++;
  const hg = r.homeGoals, ag = r.awayGoals;
  agg.totalGoals += hg + ag;
  agg.homeGoals += hg;
  agg.awayGoals += ag;
  if (r.winner === homeId) agg.homeWins++;
  else if (r.winner === awayId) agg.awayWins++;
  else agg.draws++;
  if (hg === 0 || ag === 0) agg.shutoutMatches++;
  if (hg === 0 && ag === 0) agg.nilNil++;
  if (hg > 0 && ag > 0) agg.btts++;
  const s = r.stats;
  agg.shots += s.homeShots + s.awayShots;
  agg.shotsOnTarget += s.homeShotsOnTarget + s.awayShotsOnTarget;
  agg.saves += s.homeSaves + s.awaySaves;
  agg.corners += s.homeCorners + s.awayCorners;
  agg.fouls += s.homeFouls + s.awayFouls;
  agg.possessionHomeSum += s.homePos;
  const mShots = s.homeShots + s.awayShots;
  const mFouls = s.homeFouls + s.awayFouls;
  const mCorners = s.homeCorners + s.awayCorners;
  agg.shotsMin = Math.min(agg.shotsMin, mShots); agg.shotsMax = Math.max(agg.shotsMax, mShots);
  agg.foulsMin = Math.min(agg.foulsMin, mFouls); agg.foulsMax = Math.max(agg.foulsMax, mFouls);
  agg.cornersMin = Math.min(agg.cornersMin, mCorners); agg.cornersMax = Math.max(agg.cornersMax, mCorners);
  const key = `${hg}-${ag}`;
  agg.scorelines[key] = (agg.scorelines[key] ?? 0) + 1;
  const diff = Math.abs(hg - ag);
  if (diff === 0) agg.margin.draw++;
  else if (diff === 1) agg.margin.one++;
  else if (diff === 2) agg.margin.two++;
  else agg.margin.threePlus++;
}

export function aggregateMatches(makeHome: () => Team, makeAway: () => Team, n: number): MatchAgg {
  const agg = emptyAgg();
  for (let i = 0; i < n; i++) {
    const home = makeHome();
    const away = makeAway();
    accumulate(agg, simulateMatch(home, away), home.id, away.id);
  }
  return agg;
}

// Derived, human-readable metrics from a MatchAgg.
export function deriveMetrics(a: MatchAgg) {
  const n = a.matches;
  const goalsPerGame = a.totalGoals / n;
  const shotsPerGame = a.shots / n;
  const sotPerGame = a.shotsOnTarget / n;
  return {
    goalsPerGame,
    homeWinPct: a.homeWins / n,
    drawPct: a.draws / n,
    awayWinPct: a.awayWins / n,
    bttsPct: a.btts / n,
    cleanSheetPct: a.shutoutMatches / n,
    nilNilPct: a.nilNil / n,
    shotsPerGame,
    sotPerGame,
    shotAccuracy: a.shots ? a.shotsOnTarget / a.shots : 0, // % of shots on target
    conversion: a.shotsOnTarget ? a.totalGoals / a.shotsOnTarget : 0, // goals per SOT
    savesPerGame: a.saves / n,
    cornersPerGame: a.corners / n,
    foulsPerGame: a.fouls / n,
    avgHomePossession: a.possessionHomeSum / n,
    blowoutPct: a.margin.threePlus / n,
    oneGoalPct: a.margin.one / n,
  };
}

export function topScorelines(a: MatchAgg, k: number): [string, number][] {
  return Object.entries(a.scorelines).sort((x, y) => y[1] - x[1]).slice(0, k);
}

// ============================================================
// STRENGTH CURVE — does a higher-rated team reliably win?
// ============================================================
export function strengthCurve(
  pairs: { home: number; away: number }[],
  n: number,
) {
  return pairs.map(({ home, away }) => {
    const agg = aggregateMatches(
      () => generateBotTeam('A', home),
      () => generateBotTeam('B', away),
      n,
    );
    return {
      label: `${home.toFixed(2)} vs ${away.toFixed(2)}`,
      gap: home - away,
      homeWinPct: agg.homeWins / n,
      drawPct: agg.draws / n,
      awayWinPct: agg.awayWins / n,
      goalsPerGame: agg.totalGoals / n,
    };
  });
}

// ============================================================
// TACTIC IMPACT — win rate of each tactic vs a balanced side of equal strength
// ============================================================
export function tacticImpact(tactics: string[], n: number, ownStrength = 0.8, oppStrength = ownStrength) {
  return tactics.map((t) => {
    let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
    for (let i = 0; i < n; i++) {
      const home: Team = { ...generateBotTeam('TÁTICO', ownStrength), playStyle: t };
      const away: Team = { ...generateBotTeam('NEUTRO', oppStrength), playStyle: 'balanced' };
      const r = simulateMatch(home, away);
      goalsFor += r.homeGoals;
      goalsAgainst += r.awayGoals;
      if (r.winner === home.id) wins++;
      else if (r.winner === null) draws++;
      else losses++;
    }
    return {
      tactic: t,
      winPct: wins / n,
      drawPct: draws / n,
      lossPct: losses / n,
      pointsPerGame: (wins * 3 + draws) / n,   // a tactic's RESULT value in this scenario
      goalsForAvg: goalsFor / n,
      goalsAgainstAvg: goalsAgainst / n,
    };
  });
}

// FAIR tactic comparison: every play-style faces every OTHER one, home and away, on the SAME
// squad (only the tactic differs) — so the home edge cancels and no single reference skews it.
// Rich box-score per tactic so we can see WHAT each one actually changes (possession, shot
// volume, chance quality/conversion, clean sheets), not just win% vs balanced.
export function tacticMatrix(tactics: string[], n: number, strength = 0.8) {
  type Acc = {
    games: number; w: number; d: number; l: number;
    gf: number; ga: number; pos: number; shots: number; sot: number;
    shotsAg: number; cs: number;
  };
  const acc: Record<string, Acc> = {};
  for (const t of tactics) acc[t] = { games: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pos: 0, shots: 0, sot: 0, shotsAg: 0, cs: 0 };

  const rec = (t: string, gfg: number, gag: number, pos: number, shots: number, sot: number, shotsAg: number) => {
    const a = acc[t];
    a.games++; a.gf += gfg; a.ga += gag; a.pos += pos; a.shots += shots; a.sot += sot; a.shotsAg += shotsAg;
    if (gfg > gag) a.w++; else if (gfg === gag) a.d++; else a.l++;
    if (gag === 0) a.cs++;
  };

  for (const A of tactics) {
    for (const B of tactics) {
      if (A === B) continue;
      for (let i = 0; i < n; i++) {
        const base = generateBotTeam('BASE', strength);
        const home: Team = { ...base, id: 'home_t', playStyle: A };
        const away: Team = { ...base, id: 'away_t', playStyle: B };
        const r = simulateMatch(home, away);
        const s = r.stats;
        rec(A, r.homeGoals, r.awayGoals, s.homePos, s.homeShots, s.homeShotsOnTarget, s.awayShots);
        rec(B, r.awayGoals, r.homeGoals, s.awayPos, s.awayShots, s.awayShotsOnTarget, s.homeShots);
      }
    }
  }

  return tactics.map((t) => {
    const a = acc[t]; const g = a.games || 1;
    return {
      tactic: t,
      games: a.games,
      winPct: a.w / g, drawPct: a.d / g, lossPct: a.l / g,
      ppg: (a.w * 3 + a.d) / g,
      goalsForAvg: a.gf / g, goalsAgainstAvg: a.ga / g,
      possession: a.pos / g,
      shots: a.shots / g, sot: a.sot / g,
      shotsAgainst: a.shotsAg / g,
      conversion: a.sot ? a.gf / a.sot : 0,
      cleanSheetPct: a.cs / g,
    };
  });
}

// ============================================================
// DANGER-CHANCE FREQUENCY — how many clear goalscoring chances ("lances de perigo")
// a match produces. A "danger chance" is a NARRATED big moment: a goal, a save, a clear
// miss or a penalty — NOT every box-score shot (those include harmless off-target efforts).
// Lets us see whether certain situations (a big favourite, all-out attack, etc.) flood the
// match with chances.
// ============================================================
const DANGER_TYPES = new Set(['goal', 'save', 'miss', 'penalty']);
export function dangerChanceStats(makeHome: () => Team, makeAway: () => Team, n: number) {
  let bigChances = 0, goals = 0, saves = 0, misses = 0, shots = 0, sot = 0;
  let maxBig = 0, minBig = Infinity;
  for (let i = 0; i < n; i++) {
    const r = simulateMatch(makeHome(), makeAway());
    const big = r.events.filter(e => DANGER_TYPES.has(e.type)).length;
    bigChances += big;
    maxBig = Math.max(maxBig, big);
    minBig = Math.min(minBig, big);
    goals += r.homeGoals + r.awayGoals;
    saves += r.events.filter(e => e.type === 'save').length;
    misses += r.events.filter(e => e.type === 'miss').length;
    shots += r.stats.homeShots + r.stats.awayShots;
    sot += r.stats.homeShotsOnTarget + r.stats.awayShotsOnTarget;
  }
  return {
    bigChancesPerGame: bigChances / n,
    maxBigInOneGame: maxBig,
    minBigInOneGame: minBig === Infinity ? 0 : minBig,
    goalsPerGame: goals / n,
    savesPerGame: saves / n,
    missesPerGame: misses / n,
    shotsPerGame: shots / n,
    sotPerGame: sot / n,
  };
}

// ============================================================
// FORMATION IMPACT — same SQUAD, formation F vs the same squad as 4-3-3
// (isolates the formation: only the shape differs)
// ============================================================
export function formationImpact(formations: string[], n: number, strength = 0.8) {
  return formations.map((f) => {
    let wins = 0, draws = 0, gf = 0, ga = 0;
    for (let i = 0; i < n; i++) {
      const base = generateBotTeam('BASE', strength);
      const home = withFormation(base, f, 'home_f');
      const away = withFormation(base, '4-3-3', 'away_f');
      const r = simulateMatch(home, away);
      gf += r.homeGoals; ga += r.awayGoals;
      if (r.winner === home.id) wins++;
      else if (r.winner === null) draws++;
    }
    return { formation: f, winPct: wins / n, drawPct: draws / n, goalsForAvg: gf / n, goalsAgainstAvg: ga / n };
  });
}

// FAIR formation comparison: a full round-robin where every formation faces every OTHER
// formation, once at home and once away (so the home edge and the counter matchups cancel
// out across the field). Same squad on both sides → only the SHAPE differs. Reports a rich
// box-score per formation so we can see WHAT each shape actually changes (possession, shot
// volume, chance quality/conversion, clean sheets), not just win% vs one reference.
export function formationMatrix(formations: string[], n: number, strength = 0.8) {
  type Acc = {
    games: number; w: number; d: number; l: number;
    gf: number; ga: number; pos: number; shots: number; sot: number;
    shotsAg: number; cs: number; corners: number;
  };
  const acc: Record<string, Acc> = {};
  for (const f of formations) acc[f] = { games: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pos: 0, shots: 0, sot: 0, shotsAg: 0, cs: 0, corners: 0 };

  const rec = (f: string, gfg: number, gag: number, pos: number, shots: number, sot: number, shotsAg: number, corners: number) => {
    const a = acc[f];
    a.games++; a.gf += gfg; a.ga += gag; a.pos += pos; a.shots += shots; a.sot += sot; a.shotsAg += shotsAg; a.corners += corners;
    if (gfg > gag) a.w++; else if (gfg === gag) a.d++; else a.l++;
    if (gag === 0) a.cs++;
  };

  for (const A of formations) {
    for (const B of formations) {
      if (A === B) continue;
      for (let i = 0; i < n; i++) {
        const base = generateBotTeam('BASE', strength);
        const home = withFormation(base, A, 'home_f');
        const away = withFormation(base, B, 'away_f');
        const r = simulateMatch(home, away);
        const s = r.stats;
        rec(A, r.homeGoals, r.awayGoals, s.homePos, s.homeShots, s.homeShotsOnTarget, s.awayShots, s.homeCorners);
        rec(B, r.awayGoals, r.homeGoals, s.awayPos, s.awayShots, s.awayShotsOnTarget, s.homeShots, s.awayCorners);
      }
    }
  }

  return formations.map((f) => {
    const a = acc[f]; const g = a.games || 1;
    return {
      formation: f,
      games: a.games,
      winPct: a.w / g, drawPct: a.d / g, lossPct: a.l / g,
      ppg: (a.w * 3 + a.d) / g,
      goalsForAvg: a.gf / g, goalsAgainstAvg: a.ga / g,
      possession: a.pos / g,
      shots: a.shots / g, sot: a.sot / g,
      shotsAgainst: a.shotsAg / g,
      conversion: a.sot ? a.gf / a.sot : 0,            // goals per shot on target
      cleanSheetPct: a.cs / g,
      corners: a.corners / g,
    };
  });
}

// ============================================================
// COACH IMPACT — same SQUAD with coach C vs the same squad with a reference coach
// (isolates the coach: only the manager differs)
// ============================================================
export function coachImpact(coaches: string[], n: number, reference = 'ancelotti', strength = 0.8) {
  return coaches.map((c) => {
    let wins = 0, draws = 0, gf = 0, ga = 0;
    for (let i = 0; i < n; i++) {
      const base = generateBotTeam('BASE', strength);
      const home: Team = { ...base, id: 'home_c', coachId: c };
      const away: Team = { ...base, id: 'away_c', coachId: reference };
      const r = simulateMatch(home, away);
      gf += r.homeGoals; ga += r.awayGoals;
      if (r.winner === home.id) wins++;
      else if (r.winner === null) draws++;
    }
    return { coach: c, winPctVsRef: wins / n, drawPct: draws / n, goalsForAvg: gf / n, goalsAgainstAvg: ga / n };
  });
}

// ============================================================
// CHEMISTRY IMPACT — same SQUAD with HIGH chemistry vs LOW chemistry
// (isolates chemistry: individual chem score + team total + OOP)
// ============================================================
export function chemistryImpact(n: number, strength = 0.8) {
  let highWins = 0, draws = 0, lowWins = 0, highGoals = 0, lowGoals = 0;
  for (let i = 0; i < n; i++) {
    const base = generateBotTeam('BASE', strength);
    const high: Team = {
      ...base, id: 'home_chem', totalChemistry: 95,
      players: base.players.map((p, idx) => ({ ...p, chemistryScore: idx < 11 ? 3 : 0, isOOP: false })),
    };
    const low: Team = {
      ...base, id: 'away_chem', totalChemistry: 20,
      players: base.players.map((p, idx) => ({ ...p, chemistryScore: 0, isOOP: idx < 11 && idx % 3 === 0 })),
    };
    const r = simulateMatch(high, low);
    highGoals += r.homeGoals; lowGoals += r.awayGoals;
    if (r.winner === high.id) highWins++;
    else if (r.winner === null) draws++;
    else lowWins++;
  }
  return { highChemWinPct: highWins / n, drawPct: draws / n, lowChemWinPct: lowWins / n, highGoalsAvg: highGoals / n, lowGoalsAvg: lowGoals / n };
}

// ============================================================
// BOT ROSTER — variety + difficulty scaling
// ============================================================
export function botRosterStats(difficulty: number, teams: number) {
  const used = new Set<string>();
  let overallSum = 0, slots = 0;
  for (let i = 0; i < teams; i++) {
    const xi = generateBotTeam('B', difficulty).players.slice(0, 11);
    xi.forEach(p => used.add(p.id));
    overallSum += xi.reduce((s, p) => s + p.overall, 0);
    slots += xi.length;
  }
  return { distinctPlayers: used.size, avgOverall: overallSum / slots, slots };
}

// Win rate of a stronger-difficulty bot vs a weaker one (does difficulty matter?).
export function botDifficultyWinRate(strongDiff: number, weakDiff: number, n: number): number {
  const agg = aggregateMatches(
    () => generateBotTeam('FORTE', strongDiff),
    () => generateBotTeam('FRACO', weakDiff),
    n,
  );
  return agg.homeWins / n;
}

// ============================================================
// PLAYER RATINGS & MATCH-STAT PROFILE — deep per-player / per-event read used to
// validate (and tune) the rating system and confirm match statistics are realistic.
// ============================================================
type PosBucket = 'GK' | 'DEF' | 'MID' | 'FWD';
const POS_BUCKET: Record<string, PosBucket> = {
  GK: 'GK',
  CB: 'DEF', LB: 'DEF', RB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  ST: 'FWD', CF: 'FWD', LW: 'FWD', RW: 'FWD',
};

function pctl(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}
const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);

export interface PosProfile {
  n: number; avgRating: number; p10: number; p50: number; p90: number; min: number; max: number;
  goals: number; assists: number; keyPasses: number; shots: number; sot: number;
  tackles: number; interceptions: number; saves: number; // all PER player-match
}
export interface RatingProfile {
  byPos: Record<PosBucket, PosProfile>;
  overall: { n: number; avg: number; p1: number; p10: number; p25: number; p50: number; p75: number; p90: number; p99: number; min: number; max: number };
  motm: { avg: number; min: number; max: number };
  worst: { avg: number; min: number; max: number };
  scorerAvg: number;       // avg rating of a player who scored >=1
  cleanSheetGkAvg: number; // avg GK rating in a clean sheet
  outOf10: { below4: number; r4to6: number; r6to7: number; r7to8: number; above8: number }; // % of player-matches
  perMatch: { goals: number; shots: number; sot: number; sotPct: number; saves: number; fouls: number; corners: number; possSpread: number };
}

// Runs n matches, bucketing every player-match by position. Captures rating + stat
// distributions, MOTM/worst, scorer & clean-sheet ratings, and per-match team stats.
export function ratingStatProfile(makeHome: () => Team, makeAway: () => Team, n: number): RatingProfile {
  const ratingsByPos: Record<PosBucket, number[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  const statSums: Record<PosBucket, Record<string, number>> = {
    GK: {}, DEF: {}, MID: {}, FWD: {},
  };
  const bump = (b: PosBucket, k: string, v: number) => { statSums[b][k] = (statSums[b][k] || 0) + v; };
  const allRatings: number[] = [];
  const motm: number[] = [];
  const worst: number[] = [];
  const scorerRatings: number[] = [];
  const csGk: number[] = [];
  let below4 = 0, r4to6 = 0, r6to7 = 0, r7to8 = 0, above8 = 0;
  const pm = { goals: [] as number[], shots: [] as number[], sot: [] as number[], saves: [] as number[], fouls: [] as number[], corners: [] as number[], possSpread: [] as number[] };

  for (let i = 0; i < n; i++) {
    const home = makeHome(), away = makeAway();
    const r = simulateMatch(home, away, false);
    const idToPos = new Map<string, PosBucket>();
    [...home.players.slice(0, 11), ...away.players.slice(0, 11)].forEach(p => {
      const b = POS_BUCKET[p.position]; if (b) idToPos.set(p.id, b);
    });
    if (!r.playerStats) continue;
    const ratingsThisMatch: number[] = [];
    const gkCleanSheet = new Set<string>();
    // home clean sheet → away conceded 0
    if ((r.awayGoals ?? 0) === 0) home.players.slice(0, 11).filter(p => p.position === 'GK').forEach(p => gkCleanSheet.add(p.id));
    if ((r.homeGoals ?? 0) === 0) away.players.slice(0, 11).filter(p => p.position === 'GK').forEach(p => gkCleanSheet.add(p.id));

    for (const ps of Object.values(r.playerStats) as any[]) {
      const b = idToPos.get(ps.playerId); if (!b) continue;
      ratingsByPos[b].push(ps.rating);
      allRatings.push(ps.rating);
      ratingsThisMatch.push(ps.rating);
      bump(b, 'goals', ps.goals); bump(b, 'assists', ps.assists); bump(b, 'keyPasses', ps.keyPasses || 0);
      bump(b, 'shots', ps.shots); bump(b, 'sot', ps.shotsOnTarget || 0); bump(b, 'tackles', ps.tackles);
      bump(b, 'interceptions', ps.interceptions || 0); bump(b, 'saves', ps.saves); bump(b, 'count', 1);
      if (ps.goals >= 1) scorerRatings.push(ps.rating);
      if (gkCleanSheet.has(ps.playerId)) csGk.push(ps.rating);
      if (ps.rating < 4) below4++; else if (ps.rating < 6) r4to6++; else if (ps.rating < 7) r6to7++; else if (ps.rating < 8) r7to8++; else above8++;
    }
    if (ratingsThisMatch.length) { motm.push(Math.max(...ratingsThisMatch)); worst.push(Math.min(...ratingsThisMatch)); }
    const s = r.stats;
    if (s) {
      pm.goals.push((r.homeGoals ?? 0) + (r.awayGoals ?? 0));
      pm.shots.push(s.homeShots + s.awayShots);
      pm.sot.push(s.homeShotsOnTarget + s.awayShotsOnTarget);
      pm.saves.push(s.homeSaves + s.awaySaves);
      pm.fouls.push(s.homeFouls + s.awayFouls);
      pm.corners.push(s.homeCorners + s.awayCorners);
      pm.possSpread.push(Math.abs(s.homePos - s.awayPos));
    }
  }

  const mkPos = (b: PosBucket): PosProfile => {
    const arr = [...ratingsByPos[b]].sort((x, y) => x - y);
    const cnt = statSums[b]['count'] || 1;
    const per = (k: string) => (statSums[b][k] || 0) / cnt;
    return {
      n: ratingsByPos[b].length, avgRating: mean(ratingsByPos[b]),
      p10: pctl(arr, 10), p50: pctl(arr, 50), p90: pctl(arr, 90), min: arr[0] ?? 0, max: arr[arr.length - 1] ?? 0,
      goals: per('goals'), assists: per('assists'), keyPasses: per('keyPasses'), shots: per('shots'), sot: per('sot'),
      tackles: per('tackles'), interceptions: per('interceptions'), saves: per('saves'),
    };
  };
  const allSorted = [...allRatings].sort((a, b) => a - b);
  const totalPM = allRatings.length || 1;
  const sumSot = mean(pm.sot), sumShots = mean(pm.shots);
  return {
    byPos: { GK: mkPos('GK'), DEF: mkPos('DEF'), MID: mkPos('MID'), FWD: mkPos('FWD') },
    overall: {
      n: allRatings.length, avg: mean(allRatings),
      p1: pctl(allSorted, 1), p10: pctl(allSorted, 10), p25: pctl(allSorted, 25), p50: pctl(allSorted, 50),
      p75: pctl(allSorted, 75), p90: pctl(allSorted, 90), p99: pctl(allSorted, 99),
      min: allSorted[0] ?? 0, max: allSorted[allSorted.length - 1] ?? 0,
    },
    motm: { avg: mean(motm), min: Math.min(...motm), max: Math.max(...motm) },
    worst: { avg: mean(worst), min: Math.min(...worst), max: Math.max(...worst) },
    scorerAvg: mean(scorerRatings),
    cleanSheetGkAvg: mean(csGk),
    outOf10: {
      below4: (below4 / totalPM) * 100, r4to6: (r4to6 / totalPM) * 100, r6to7: (r6to7 / totalPM) * 100,
      r7to8: (r7to8 / totalPM) * 100, above8: (above8 / totalPM) * 100,
    },
    perMatch: {
      goals: mean(pm.goals), shots: sumShots, sot: sumSot, sotPct: sumShots ? (sumSot / sumShots) * 100 : 0,
      saves: mean(pm.saves), fouls: mean(pm.fouls), corners: mean(pm.corners), possSpread: mean(pm.possSpread),
    },
  };
}

// Average team rating by match result — validates that ratings track performance
// (the winning XI should, on average, out-rate the losing XI).
export function ratingByResult(makeHome: () => Team, makeAway: () => Team, n: number): { winnerAvg: number; loserAvg: number; drawAvg: number; n: number } {
  const winner: number[] = [], loser: number[] = [], draw: number[] = [];
  const avgXi = (team: Team, r: MatchResult): number => {
    const ids = new Set(team.players.slice(0, 11).map(p => p.id));
    const rs = Object.values(r.playerStats || {}).filter((ps: any) => ids.has(ps.playerId)).map((ps: any) => ps.rating);
    return rs.length ? rs.reduce((s, x) => s + x, 0) / rs.length : 0;
  };
  for (let i = 0; i < n; i++) {
    const home = makeHome(), away = makeAway();
    const r = simulateMatch(home, away, false);
    const h = avgXi(home, r), a = avgXi(away, r);
    if ((r.homeGoals ?? 0) > (r.awayGoals ?? 0)) { winner.push(h); loser.push(a); }
    else if ((r.awayGoals ?? 0) > (r.homeGoals ?? 0)) { winner.push(a); loser.push(h); }
    else { draw.push(h); draw.push(a); }
  }
  return { winnerAvg: mean(winner), loserAvg: mean(loser), drawAvg: mean(draw), n };
}

// Captain leadership impact: the captain's best stat is amplified +3 for the WHOLE
// team. A captain whose best stat is SHOOTING should make the side score more; one
// whose best stat is DEFENDING should make it concede less. We force the captain's
// best stat (same altered captain slot for both variants → a clean A/B).
export function captainStatImpact(n: number): { shootGoalsFor: number; shootGoalsAgainst: number; defGoalsFor: number; defGoalsAgainst: number } {
  const clone = (t: Team): Team => ({ ...t, players: t.players.map(p => ({ ...p })) });
  const makeVariant = (base: Team, stat: string): Team => {
    const t = clone(base);
    const cap = t.players[1] as unknown as Record<string, number> & { id: string }; // an outfield starter
    ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'].forEach(s => { cap[s] = 55; });
    cap[stat] = 99; // makes `stat` unambiguously the captain's best → +3 of it for everyone
    t.captain = cap.id;
    t.id = 'CAP_' + stat;
    return t;
  };
  let sgf = 0, sga = 0, dgf = 0, dga = 0;
  for (let i = 0; i < n; i++) {
    // PAIRED trial: same base squad, same opponent — only the captain's boosted stat
    // differs. This cancels squad/opponent variance and isolates the captain effect.
    const base = generateBotTeam('Base', 0.8);
    const opp = generateBotTeam('Opp', 0.8);
    const r1 = simulateMatch(makeVariant(base, 'shooting'), clone(opp), false);
    sgf += r1.homeGoals; sga += r1.awayGoals;
    const r2 = simulateMatch(makeVariant(base, 'defending'), clone(opp), false);
    dgf += r2.homeGoals; dga += r2.awayGoals;
  }
  return { shootGoalsFor: sgf / n, shootGoalsAgainst: sga / n, defGoalsFor: dgf / n, defGoalsAgainst: dga / n };
}

// ISOLATES the team-wide (global) chemistry buff: identical players and identical
// INDIVIDUAL chemistry — only `totalChemistry` differs, so the only change is the global
// passing/pace/special bonus. Answers "is the team-wide chem buff actually worth it?".
export function globalChemImpact(n: number): { highGoalsFor: number; noneGoalsFor: number; highWin: number; noneWin: number; highConceded: number; noneConceded: number } {
  const clone = (t: Team): Team => ({ ...t, players: t.players.map(p => ({ ...p })) });
  let hgf = 0, ngf = 0, hw = 0, nw = 0, hc = 0, nc = 0;
  for (let i = 0; i < n; i++) {
    const base = generateBotTeam('Base', 0.8);
    const players = base.players.map((p, idx) => ({ ...p, chemistryScore: idx < 11 ? 2 : 0, isOOP: false }));
    const high: Team = { ...base, id: 'high', totalChemistry: 95, players };          // full global buff (+6 pass/+4 pace/+5 str)
    const none: Team = { ...base, id: 'none', totalChemistry: 30, players };           // no global buff at all
    const opp = generateBotTeam('Opp', 0.8);
    const r1 = simulateMatch(clone(high), clone(opp)); // paired: same opponent
    hgf += r1.homeGoals; hc += r1.awayGoals; if (r1.winner === 'high') hw++;
    const r2 = simulateMatch(clone(none), clone(opp));
    ngf += r2.homeGoals; nc += r2.awayGoals; if (r2.winner === 'none') nw++;
  }
  return { highGoalsFor: hgf / n, noneGoalsFor: ngf / n, highWin: hw / n, noneWin: nw / n, highConceded: hc / n, noneConceded: nc / n };
}

// Vision impact: two squads identical except their players' VISION (95 vs 50), each played
// against the SAME opponent — isolates how much playmaking (vision feeds chance creation +
// team strength) lifts goals and wins. Confirms vision is no longer decorative.
export function visionImpact(n: number, strength = 0.8): { highGoalsFor: number; lowGoalsFor: number; highWin: number; lowWin: number } {
  const clone = (t: Team): Team => ({ ...t, players: t.players.map(p => ({ ...p })) });
  const setVision = (base: Team, id: string, vis: number): Team => ({
    ...base, id, players: base.players.map((p, idx) => ({ ...p, id: `${id}_${idx}`, vision: vis })),
  });
  let hgf = 0, lgf = 0, hw = 0, lw = 0;
  for (let i = 0; i < n; i++) {
    const base = generateBotTeam('Base', strength);
    const high = setVision(base, 'HI', 95);
    const low = setVision(base, 'LO', 50);
    const opp = generateBotTeam('Opp', strength);
    const r1 = simulateMatch(clone(high), clone(opp)); // paired: same opponent
    hgf += r1.homeGoals; if (r1.winner === 'HI') hw++;
    const r2 = simulateMatch(clone(low), clone(opp));
    lgf += r2.homeGoals; if (r2.winner === 'LO') lw++;
  }
  return { highGoalsFor: hgf / n, lowGoalsFor: lgf / n, highWin: hw / n, lowWin: lw / n };
}

// Home/draw/away split between EVEN teams — measures the home advantage. With
// isFinal=true the match is at a neutral venue, so the host edge must vanish.
export function homeAdvantageSplit(n: number, isFinal: boolean): { homeWin: number; draw: number; awayWin: number; goalsHome: number; goalsAway: number } {
  let h = 0, d = 0, a = 0, gh = 0, ga = 0;
  for (let i = 0; i < n; i++) {
    const r = simulateMatch(generateBotTeam('Casa', 0.8), generateBotTeam('Fora', 0.8), false, isFinal);
    gh += r.homeGoals; ga += r.awayGoals;
    if (r.homeGoals > r.awayGoals) h++; else if (r.homeGoals < r.awayGoals) a++; else d++;
  }
  return { homeWin: h / n, draw: d / n, awayWin: a / n, goalsHome: gh / n, goalsAway: ga / n };
}

// ============================================================
// FULL SEASON — league (Swiss) + knockout, to gauge competitive integrity
// ============================================================
export interface SeasonResult {
  championStrengthRank: number; // 1 = strongest of the 36 entrants
  totalEntrants: number;
  leagueGoalsPerGame: number;
  topScorerGoals: number;
  pointsTop: number;
  pointsMedian: number;
  pointsBottom: number;
  leagueMatches: number;
  minGamesPerTeam: number;
  maxGamesPerTeam: number;
}

export function simulateSeason(strengths: number[]): SeasonResult {
  // Build teams; remember each team's pre-season strength rank (1 = strongest).
  const teams: Team[] = strengths.map((s, i) => generateBotTeam(`T${i}`, s));
  const strengthRank = new Map<string, number>();
  [...teams]
    .map((t, i) => ({ id: t.id, s: strengths[i] }))
    .sort((a, b) => b.s - a.s)
    .forEach((e, idx) => strengthRank.set(e.id, idx + 1));

  const byId = (id: string) => teams.find(t => t.id === id);

  // League phase
  const fixtures = generateLeagueFixtures(teams);
  const gamesPerTeam: Record<string, number> = {};
  for (const f of fixtures) {
    gamesPerTeam[f.homeTeamId] = (gamesPerTeam[f.homeTeamId] ?? 0) + 1;
    gamesPerTeam[f.awayTeamId] = (gamesPerTeam[f.awayTeamId] ?? 0) + 1;
  }
  let leagueGoals = 0, leagueMatches = 0;
  const seasonGoals: Record<string, number> = {};
  for (const f of fixtures) {
    const home = byId(f.homeTeamId)!;
    const away = byId(f.awayTeamId)!;
    const r = simulateMatch(home, away);
    f.played = true;
    f.result = r;
    leagueGoals += r.homeGoals + r.awayGoals;
    leagueMatches++;
    if (r.playerStats) {
      // Key by team+player: bot teams can share the same player id from the pool,
      // so summing by raw playerId would conflate different teams' instances.
      for (const ps of Object.values(r.playerStats)) {
        const key = `${ps.teamId}::${ps.playerId}`;
        seasonGoals[key] = (seasonGoals[key] ?? 0) + ps.goals;
      }
    }
  }

  const standings = computeStandings(teams, fixtures.filter(f => f.played));
  const pts = standings.map(s => s.points);
  const pointsTop = pts[0] ?? 0;
  const pointsBottom = pts[pts.length - 1] ?? 0;
  const pointsMedian = pts[Math.floor(pts.length / 2)] ?? 0;

  // Knockout phase
  const bracket = createKnockoutBracket(standings);
  let champion: string | null = null;
  let guard = 0;
  while (!champion && guard++ < 8) {
    const isFinal = bracket.currentRound === 'final';
    playActiveKnockoutLeg(bracket, byId); // leg 1 (or final)
    if (!isFinal) playActiveKnockoutLeg(bracket, byId); // leg 2
    champion = advanceKnockoutBracket(bracket);
  }

  const topScorerGoals = Math.max(0, ...Object.values(seasonGoals));
  const gameCounts = teams.map(t => gamesPerTeam[t.id] ?? 0);

  return {
    championStrengthRank: champion ? (strengthRank.get(champion) ?? -1) : -1,
    totalEntrants: teams.length,
    leagueGoalsPerGame: leagueGoals / leagueMatches,
    topScorerGoals,
    pointsTop,
    pointsMedian,
    pointsBottom,
    leagueMatches,
    minGamesPerTeam: Math.min(...gameCounts),
    maxGamesPerTeam: Math.max(...gameCounts),
  };
}

// ============================================================
// KNOCKOUT TIE — does the stronger team advance through a 2-legged tie?
// ============================================================
function simulateTie(strong: Team, weak: Team): string {
  // Two legs (strong home first), aggregate, penalties if level.
  const leg1 = simulateMatch(strong, weak);
  const leg2 = simulateMatch(weak, strong);
  const aggStrong = leg1.homeGoals + leg2.awayGoals;
  const aggWeak = leg1.awayGoals + leg2.homeGoals;
  if (aggStrong > aggWeak) return strong.id;
  if (aggWeak > aggStrong) return weak.id;
  return simulatePenalties(weak, strong).winner; // level on aggregate → shootout
}

export function knockoutTieFavoriteRate(strongStr: number, weakStr: number, n: number): number {
  let favAdvances = 0;
  for (let i = 0; i < n; i++) {
    const strong = generateBotTeam('Forte', strongStr);
    const weak = generateBotTeam('Fraco', weakStr);
    if (simulateTie(strong, weak) === strong.id) favAdvances++;
  }
  return favAdvances / n;
}

// ============================================================
// PENALTY SHOOTOUT FAIRNESS
// ============================================================
// Two IDENTICAL teams that differ ONLY in composure → isolates composure's effect on the
// shootout (same GKs, same shooting, distinct player ids so nothing collides). The cool-
// headed side should clearly win more than half.
export function penaltyComposureImpact(n: number, strength = 0.8): {
  highWinPct: number; decisivePct: number; highConvPct: number; lowConvPct: number;
} {
  const setComp = (base: Team, id: string, c: number): Team => ({
    ...base,
    id,
    players: base.players.map((p, idx) => ({ ...p, id: `${id}_${idx}`, composure: c })),
  });
  let highWins = 0, decisive = 0;
  let highKicks = 0, highGoals = 0, lowKicks = 0, lowGoals = 0;
  for (let i = 0; i < n; i++) {
    const base = generateBotTeam('Base', strength);
    const high = setComp(base, 'HI', 92);
    const low = setComp(base, 'LO', 48);
    const r = simulatePenalties(high, low);
    if (r.winner === 'HI') highWins++;
    if (r.winner) decisive++;
    for (const k of r.kicks) {
      if (k.teamId === 'HI') { highKicks++; if (k.isGoal) highGoals++; }
      else if (k.teamId === 'LO') { lowKicks++; if (k.isGoal) lowGoals++; }
    }
  }
  return {
    highWinPct: highWins / n,
    decisivePct: decisive / n,
    highConvPct: highKicks ? highGoals / highKicks : 0,
    lowConvPct: lowKicks ? lowGoals / lowKicks : 0,
  };
}

// Real penalty conversion at each composure LEVEL (both sides set to the same value, so
// it isolates the level against real bot keepers + the designated-taker +5). Reveals how
// flat the curve is across the range real takers actually occupy (≈85–99 effective).
export function penaltyConversionByComposure(levels: number[], n: number, strength = 0.8): { level: number; convPct: number }[] {
  return levels.map(level => {
    let kicks = 0, goals = 0;
    for (let i = 0; i < n; i++) {
      const base = generateBotTeam('Base', strength);
      const mk = (id: string): Team => ({
        ...base, id, players: base.players.map((p, idx) => ({ ...p, id: `${id}_${idx}`, composure: level })),
      });
      const r = simulatePenalties(mk('A'), mk('B'));
      for (const k of r.kicks) { kicks++; if (k.isGoal) goals++; }
    }
    return { level, convPct: kicks ? goals / kicks : 0 };
  });
}

export function penaltyFairness(n: number, strength = 0.8) {
  let homeWins = 0, awayWins = 0, decisive = 0;
  for (let i = 0; i < n; i++) {
    const home = generateBotTeam('PH', strength);
    const away = generateBotTeam('PA', strength);
    const r = simulatePenalties(home, away);
    if (r.winner === home.id) homeWins++;
    else if (r.winner === away.id) awayWins++;
    if (r.winner) decisive++;
  }
  return { homeWinPct: homeWins / n, awayWinPct: awayWins / n, decisivePct: decisive / n };
}
