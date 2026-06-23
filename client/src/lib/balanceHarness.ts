// UCL Immortals — Balance analysis harness
// Pure simulation/aggregation helpers used by balance.test.ts to produce a broad,
// professional read of the current game balance. No assertions here — just data.

import {
  Team, MatchResult, simulateMatch, simulatePenalties, generateBotTeam,
  generateLeagueFixtures, computeStandings, createKnockoutBracket,
  playActiveKnockoutLeg, advanceKnockoutBracket,
} from './gameEngine';

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
export function tacticImpact(tactics: string[], n: number, strength = 0.8) {
  return tactics.map((t) => {
    let wins = 0, draws = 0, goalsFor = 0, goalsAgainst = 0;
    for (let i = 0; i < n; i++) {
      const home: Team = { ...generateBotTeam('TÁTICO', strength), playStyle: t };
      const away: Team = { ...generateBotTeam('NEUTRO', strength), playStyle: 'balanced' };
      const r = simulateMatch(home, away);
      goalsFor += r.homeGoals;
      goalsAgainst += r.awayGoals;
      if (r.winner === home.id) wins++;
      else if (r.winner === null) draws++;
    }
    return {
      tactic: t,
      winPct: wins / n,
      drawPct: draws / n,
      goalsForAvg: goalsFor / n,
      goalsAgainstAvg: goalsAgainst / n,
    };
  });
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
