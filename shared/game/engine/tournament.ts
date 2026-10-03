// League fixtures, standings, knockout bracket and season stats.

import { DEFAULT_COMPETITION_FORMAT, normalizeCompetitionFormat, type CompetitionFormat } from '../competition';
import { random } from '../random';
import { statKey, type Team, type MatchResult, type StandingsEntry, type TablePointsConfig, STANDARD_TABLE_POINTS } from './teamModel';
import { runMatchSimulation, simulateMatch } from './matchSim';
import { simulatePenalties } from './strength';

// ============================================================
// ROUND-BY-ROUND LEAGUE FIXTURES AND STANDINGS CALCULATOR
// ============================================================
export interface LeagueFixture {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  result?: MatchResult;
  groupId?: number;
}

type ScheduleRng = () => number;

interface LeaguePairing {
  round: number;
  teamAId: string;
  teamBId: string;
}

/** Fisher–Yates used only when a new competition draw is created. */
function shuffleTeamsForDraw<T>(teams: T[], rng: ScheduleRng = random): T[] {
  const shuffled = [...teams];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const raw = Number(rng());
    const safe = Number.isFinite(raw) ? Math.min(0.999999999, Math.max(0, raw)) : 0.5;
    const swapIndex = Math.floor(safe * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function normalizedLeagueRounds(teamCount: number, requestedRounds: number): number {
  if (teamCount < 2) return 0;
  const rawRounds = Number.isFinite(requestedRounds)
    ? Math.trunc(requestedRounds)
    : DEFAULT_COMPETITION_FORMAT.leagueRounds;
  return Math.min(Math.max(rawRounds, 1), (teamCount - 1) * 2);
}

/**
 * Creates the pairings first, independently of home/away. The first leg uses
 * the circle method; when a second leg is requested, it repeats those exact
 * rounds with the home/away candidates swapped. No later round is re-sorted
 * based on the live table and no pair repeats before the return leg.
 */
function generateLeaguePairings(teams: Team[], requestedRounds: number): LeaguePairing[] {
  const rounds = normalizedLeagueRounds(teams.length, requestedRounds);
  if (rounds === 0) return [];
  const roundsPerLeg = teams.length - 1;
  const firstLegRounds = Math.min(rounds, roundsPerLeg);

  // The dummy slot keeps the helper correct for odd-sized custom groups too.
  const slots: Array<Team | null> = [...teams];
  if (slots.length % 2 !== 0) slots.push(null);

  const pairings: LeaguePairing[] = [];
  for (let round = 0; round < firstLegRounds; round++) {
    for (let index = 0; index < slots.length / 2; index++) {
      const left = slots[index];
      const right = slots[slots.length - 1 - index];
      if (left && right) {
        pairings.push({ round: round + 1, teamAId: left.id, teamBId: right.id });
      }
    }

    // Keep the first slot fixed and rotate the other slots one place. Over
    // N−1 rounds this visits every possible opponent exactly once.
    const last = slots.pop()!;
    slots.splice(1, 0, last);
  }

  if (rounds > roundsPerLeg) {
    const returnLegRounds = Math.min(rounds - roundsPerLeg, roundsPerLeg);
    for (const pairing of pairings.filter(candidate => candidate.round <= returnLegRounds)) {
      pairings.push({
        round: pairing.round + roundsPerLeg,
        teamAId: pairing.teamBId,
        teamBId: pairing.teamAId,
      });
    }
  }

  return pairings;
}

/**
 * Orients the already-drawn pairings while balancing the venue split. The
 * default 36-team/8-round competition therefore gives every team exactly four
 * home and four away matches, like the real league phase. For odd degrees a
 * temporary dummy edge makes the difference at most one match.
 */
function orientLeaguePairings(pairings: LeaguePairing[], teams: Team[], rng: ScheduleRng): LeagueFixture[] {
  if (pairings.length === 0) return [];

  const degree = new Map<string, number>(teams.map(team => [team.id, 0]));
  pairings.forEach(pairing => {
    degree.set(pairing.teamAId, (degree.get(pairing.teamAId) ?? 0) + 1);
    degree.set(pairing.teamBId, (degree.get(pairing.teamBId) ?? 0) + 1);
  });

  // An Euler orientation gives equal home/away counts at every even-degree
  // vertex. Odd-degree vertices receive one temporary dummy edge and therefore
  // finish with the only possible split: floor/ceil(degree / 2).
  const dummyId = '__schedule_dummy__';
  const edges = pairings.map(pairing => ({ a: pairing.teamAId, b: pairing.teamBId, real: true }));
  degree.forEach((teamDegree, teamId) => {
    if (teamDegree % 2 !== 0) edges.push({ a: teamId, b: dummyId, real: false });
  });

  const adjacency = new Map<string, number[]>();
  edges.forEach((edge, edgeIndex) => {
    if (!adjacency.has(edge.a)) adjacency.set(edge.a, []);
    if (!adjacency.has(edge.b)) adjacency.set(edge.b, []);
    adjacency.get(edge.a)!.push(edgeIndex);
    adjacency.get(edge.b)!.push(edgeIndex);
  });

  const used = new Array(edges.length).fill(false);
  const oriented = new Map<number, { home: string; away: string }>();

  for (const start of Array.from(adjacency.keys())) {
    if (!adjacency.get(start)!.some(edgeIndex => !used[edgeIndex])) continue;
    const componentEdges: number[] = [];

    const visit = (teamId: string): void => {
      const incident = adjacency.get(teamId) ?? [];
      for (const edgeIndex of incident) {
        if (used[edgeIndex]) continue;
        used[edgeIndex] = true;
        const edge = edges[edgeIndex];
        const other = edge.a === teamId ? edge.b : edge.a;
        oriented.set(edgeIndex, { home: teamId, away: other });
        componentEdges.push(edgeIndex);
        visit(other);
      }
    };

    visit(start);
    // Reversing a whole Euler component preserves the balance and gives the
    // draw a fresh venue orientation instead of tying it to array order.
    if (rng() >= 0.5) {
      for (const edgeIndex of componentEdges) {
        const direction = oriented.get(edgeIndex)!;
        oriented.set(edgeIndex, { home: direction.away, away: direction.home });
      }
    }
  }

  return pairings.map((pairing, index) => {
    const direction = oriented.get(index);
    return {
      round: pairing.round,
      homeTeamId: direction?.home ?? pairing.teamAId,
      awayTeamId: direction?.away ?? pairing.teamBId,
      played: false,
    };
  });
}

function generateLeagueFixturesFromOrder(teams: Team[], requestedRounds: number, rng: ScheduleRng): LeagueFixture[] {
  const pairings = generateLeaguePairings(teams, requestedRounds);
  if (pairings.length === 0) return [];

  const roundsPerLeg = teams.length - 1;
  if (normalizedLeagueRounds(teams.length, requestedRounds) <= roundsPerLeg) {
    return orientLeaguePairings(pairings, teams, rng);
  }

  // Orient only the first leg. Returning the reverse fixture directly keeps
  // every matchup genuinely ida e volta instead of merely scheduling the same
  // pair twice with a potentially unchanged venue.
  const firstLeg = pairings.filter(pairing => pairing.round <= roundsPerLeg);
  const firstFixtures = orientLeaguePairings(firstLeg, teams, rng);
  const byPair = new Map(firstFixtures.map(fixture => [
    [fixture.homeTeamId, fixture.awayTeamId].sort().join('|'),
    fixture,
  ]));
  const returnFixtures = pairings
    .filter(pairing => pairing.round > roundsPerLeg)
    .map(pairing => {
      const firstFixture = byPair.get([pairing.teamAId, pairing.teamBId].sort().join('|'));
      return {
        round: pairing.round,
        homeTeamId: firstFixture?.awayTeamId ?? pairing.teamAId,
        awayTeamId: firstFixture?.homeTeamId ?? pairing.teamBId,
        played: false,
      };
    });

  return [...firstFixtures, ...returnFixtures];
}

/** Deterministic (unshuffled) schedule — used by tests that need a fixed draw. */
export function generateLeagueFixtures(teams: Team[], requestedRounds = DEFAULT_COMPETITION_FORMAT.leagueRounds): LeagueFixture[] {
  return generateLeagueFixturesFromOrder(teams, requestedRounds, () => 0);
}

/**
 * Draws the complete league schedule once, at competition creation time. The
 * resulting fixtures are stored in state/server room state, so solo and online
 * never re-roll a later round and all online clients see the same draw.
 */
export function generateRandomLeagueFixtures(
  teams: Team[],
  requestedRounds = DEFAULT_COMPETITION_FORMAT.leagueRounds,
  rng: ScheduleRng = random,
): LeagueFixture[] {
  return generateLeagueFixturesFromOrder(shuffleTeamsForDraw(teams, rng), requestedRounds, rng);
}

function generateGroupFixturesFromOrder(teams: Team[], groupCount: number, requestedRounds: number, rng: ScheduleRng): LeagueFixture[] {
  if (groupCount < 1 || teams.length % groupCount !== 0) return [];
  const perGroup = teams.length / groupCount;
  const fixtures: LeagueFixture[] = [];
  for (let group = 0; group < groupCount; group++) {
    const groupTeams = teams.slice(group * perGroup, (group + 1) * perGroup);
    for (const fixture of generateLeagueFixturesFromOrder(groupTeams, requestedRounds, rng)) {
      fixtures.push({ ...fixture, groupId: group });
    }
  }
  return fixtures;
}

/** Generates one shared matchday schedule for a groups format. */
export function generateGroupFixtures(teams: Team[], groupCount: number, requestedRounds: number): LeagueFixture[] {
  return generateGroupFixturesFromOrder(teams, groupCount, requestedRounds, () => 0);
}

/** Randomly draws group allocation and every group's complete schedule once. */
export function generateRandomGroupFixtures(
  teams: Team[],
  groupCount: number,
  requestedRounds: number,
  rng: ScheduleRng = random,
): LeagueFixture[] {
  return generateGroupFixturesFromOrder(shuffleTeamsForDraw(teams, rng), groupCount, requestedRounds, rng);
}

export function computeStandings(
  teams: Team[],
  fixtures: LeagueFixture[],
  pointsConfig: TablePointsConfig = STANDARD_TABLE_POINTS,
): StandingsEntry[] {
  const standings: Record<string, StandingsEntry> = {};

  for (const team of teams) {
    standings[team.id] = {
      teamId: team.id,
      teamName: team.name,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0,
    };
  }

  for (const f of fixtures) {
    if (!f.played || !f.result) continue;
    const { homeTeamId, awayTeamId, result } = f;
    const hs = standings[homeTeamId];
    const as = standings[awayTeamId];
    if (!hs || !as) continue;

    hs.played++;
    as.played++;
    hs.goalsFor += result.homeGoals;
    hs.goalsAgainst += result.awayGoals;
    as.goalsFor += result.awayGoals;
    as.goalsAgainst += result.homeGoals;

    if (result.winner === homeTeamId) {
      hs.won++; hs.points += pointsConfig.win;
      as.lost++; as.points += pointsConfig.loss;
    } else if (result.winner === awayTeamId) {
      as.won++; as.points += pointsConfig.win;
      hs.lost++; hs.points += pointsConfig.loss;
    } else {
      hs.drawn++; hs.points += pointsConfig.draw;
      as.drawn++; as.points += pointsConfig.draw;
    }
  }

  return Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });
}

interface GroupStandingsTable {
  groupId: number;
  entries: StandingsEntry[];
}

/**
 * Builds an independent table for every group. The fixture's groupId is the
 * source of truth; the team-order fallback keeps older saves without group
 * metadata readable.
 */
export function computeGroupStandings(
  teams: Team[],
  fixtures: LeagueFixture[],
  format: CompetitionFormat,
): GroupStandingsTable[] {
  if (format.id !== 'groups_knockout' || format.groupCount < 1) return [];

  const perGroup = Math.floor(teams.length / format.groupCount);
  return Array.from({ length: format.groupCount }, (_, groupId) => {
    const groupFixtures = fixtures.filter(f => f.groupId === groupId);
    const fixtureTeamIds = new Set(
      groupFixtures.flatMap(f => [f.homeTeamId, f.awayTeamId])
    );
    const members = fixtureTeamIds.size > 0
      ? teams.filter(team => fixtureTeamIds.has(team.id))
      : teams.slice(groupId * perGroup, (groupId + 1) * perGroup);

    return {
      groupId,
      entries: computeStandings(members, groupFixtures),
    };
  });
}

/** Returns group-ranked entries in bracket order (top N from each group). */
export function computeGroupQualifiedStandings(
  teams: Team[],
  fixtures: LeagueFixture[],
  format: CompetitionFormat,
): StandingsEntry[] {
  if (format.id !== 'groups_knockout' || format.groupCount < 1) return computeStandings(teams, fixtures).slice(0, format.qualifiedTeams);
  return computeGroupStandings(teams, fixtures, format)
    .flatMap(group => group.entries.slice(0, format.qualifiedPerGroup));
}

export interface KnockoutBracket {
  playoffs: any[];
  round16: any[];
  quarterFinals: any[];
  semiFinals: any[];
  final: any | null;
  currentRound: string;
  currentLeg: number; // 1 = ida, 2 = volta (active two-legged round)
  firstRoundSize?: number;
  knockoutLegs?: 1 | 2;
  finalSingleLeg?: boolean;
}

interface BracketEntrant {
  teamId: string;
  seed?: number;
  fromPlayoff?: number;
}

/**
 * In a two-legged tie the better seed (lower league position) hosts the
 * return. The bracket keeps the first-leg home/away order because match keys,
 * bets and replays use that order; this helper only chooses which side starts
 * at home. An unresolved play-off placeholder is treated as the lower seed
 * until its winner is known.
 */
function orientBracketEntrants(left: BracketEntrant, right: BracketEntrant, twoLegged: boolean): { home: BracketEntrant; away: BracketEntrant } {
  if (!twoLegged) return { home: left, away: right };
  if (left.seed !== undefined && right.seed !== undefined) {
    return left.seed < right.seed
      ? { home: right, away: left }
      : { home: left, away: right };
  }
  if (left.seed !== undefined) return { home: right, away: left };
  if (right.seed !== undefined) return { home: left, away: right };
  return { home: left, away: right };
}

function makeBracketTie(
  id: string,
  left: BracketEntrant,
  right: BracketEntrant,
  twoLegged: boolean,
  isSingleLeg?: boolean,
): any {
  const { home, away } = orientBracketEntrants(left, right, twoLegged);
  return {
    id,
    homeTeamId: home.teamId,
    awayTeamId: away.teamId,
    ...(home.seed !== undefined ? { homeSeed: home.seed } : {}),
    ...(away.seed !== undefined ? { awaySeed: away.seed } : {}),
    ...(home.fromPlayoff !== undefined ? { homeFromPo: home.fromPlayoff } : {}),
    ...(away.fromPlayoff !== undefined ? { awayFromPo: away.fromPlayoff } : {}),
    ...(isSingleLeg !== undefined ? { isSingleLeg } : {}),
    played: false,
  };
}

// ============================================================
// KNOCKOUT BRACKET — faithful to the new UEFA Champions League format
// 36 teams → 8-round league phase →
//   • 1st–8th: qualify straight to the Round of 16 (seeded)
//   • 9th–24th: enter the knockout play-off round (two legs)
//   • 25th–36th: eliminated
// Play-off winners join the top 8 in the Round of 16, then Quarters → Semis → Final.
// The bracket path is fixed up front (1 and 2 can only meet in the final) and the
// play-off winners feed predetermined Round-of-16 slots.
// ============================================================

// Every tie is TWO-LEGGED (home & away), decided on aggregate, EXCEPT the single
// grand final. `currentLeg` (1 = ida / 2 = volta) tracks the leg being played in
// the active round. `awayFromPo` marks a Round-of-16 slot whose away team is
// filled once that play-off tie is decided.
export function createKnockoutBracket(
  standings: StandingsEntry[],
  requestedFormat = DEFAULT_COMPETITION_FORMAT,
  rng: ScheduleRng = random,
): KnockoutBracket {
  const format = normalizeCompetitionFormat(requestedFormat);
  const seedId = (pos: number) => standings[pos - 1]?.teamId;

  // Direct elimination has no league table. The standings passed by the caller
  // are simply the seeded entrant list; use the same round representation as
  // the existing UI so 4/8/16-team brackets remain backwards compatible.
  if (format.id === 'knockout') {
    const entrants = standings.slice(0, format.teamCount);
    const firstRound = Array.from({ length: Math.floor(entrants.length / 2) }, (_, index) => {
      const left: BracketEntrant = { teamId: entrants[index]?.teamId ?? '', seed: index + 1 };
      const right: BracketEntrant = {
        teamId: entrants[entrants.length - 1 - index]?.teamId ?? '',
        seed: entrants.length - index,
      };
      return makeBracketTie(`ko_${index}`, left, right, format.knockoutLegs === 2, format.knockoutLegs === 1);
    });
    return {
      playoffs: [],
      round16: firstRound,
      quarterFinals: [],
      semiFinals: [],
      final: null,
      currentRound: 'round16',
      currentLeg: 1,
      firstRoundSize: format.teamCount,
      knockoutLegs: format.knockoutLegs,
      finalSingleLeg: format.finalSingleLeg,
    };
  }

  // The Round of 16 always has 16 entrants. If the configured qualification
  // line is above 16, the lower half of that line plays a seeded playoff first.
  // Q=24 reproduces the original UCL path (8 direct + 16 playoff); Q=16 has no
  // playoff and sends the top 16 straight to the Round of 16.
  const playoffCount = format.qualifiedTeams - 16;
  const directCount = 16 - playoffCount;
  const playoffs: any[] = [];

  const addPlayoffDrawGroup = (seedRanks: number[], unseedRanks: number[]) => {
    const drawnSeeds = shuffleTeamsForDraw(seedRanks, rng);
    const drawnUnseeded = shuffleTeamsForDraw(unseedRanks, rng);
    for (let i = 0; i < drawnSeeds.length; i++) {
      const seeded: BracketEntrant = { teamId: seedId(drawnSeeds[i]) ?? '', seed: drawnSeeds[i] };
      const unseeded: BracketEntrant = { teamId: seedId(drawnUnseeded[i]) ?? '', seed: drawnUnseeded[i] };
      // UEFA-style play-off draw: the seeded side is paired within its
      // ranking band and hosts the return leg.
      playoffs.push(makeBracketTie(`po_${playoffs.length}`, seeded, unseeded, format.knockoutLegs === 2));
    }
  };

  if (format.qualifiedTeams === 24 && playoffCount === 8) {
    // The real Champions League draw uses four seeded pairs against four
    // unseeded pairs, with the pairing bands fixed and the clubs inside each
    // band drawn randomly.
    addPlayoffDrawGroup([9, 10], [23, 24]);
    addPlayoffDrawGroup([11, 12], [21, 22]);
    addPlayoffDrawGroup([13, 14], [19, 20]);
    addPlayoffDrawGroup([15, 16], [17, 18]);
  } else {
    const seededRanks = Array.from({ length: playoffCount }, (_, index) => directCount + index + 1);
    const unseededRanks = Array.from({ length: playoffCount }, (_, index) => format.qualifiedTeams - index);
    addPlayoffDrawGroup(seededRanks, unseededRanks);
  }

  // Standard 16-slot bracket order: top seeds 1 and 2 remain on opposite sides.
  // Ranks after `directCount` are placeholders for playoff winners. This keeps
  // the bracket path stable after the initial draw while still allowing the
  // playoff pairings inside UEFA-style ranking bands to be randomized.
  const r16Ranks = [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11];
  const round16 = Array.from({ length: 8 }, (_, idx) => {
    const leftRank = r16Ranks[idx * 2];
    const rightRank = r16Ranks[idx * 2 + 1];
    const left: BracketEntrant = leftRank <= directCount
      ? { teamId: seedId(leftRank) ?? '', seed: leftRank }
      : { teamId: '', fromPlayoff: leftRank - directCount - 1 };
    const right: BracketEntrant = rightRank <= directCount
      ? { teamId: seedId(rightRank) ?? '', seed: rightRank }
      : { teamId: '', fromPlayoff: rightRank - directCount - 1 };
    return makeBracketTie(`r16_${idx}`, left, right, format.knockoutLegs === 2, format.knockoutLegs === 1);
  });

  return {
    playoffs,
    round16,
    quarterFinals: [],
    semiFinals: [],
    final: null,
    currentRound: playoffCount > 0 ? 'playoffs' : 'round16',
    currentLeg: 1,
    knockoutLegs: format.knockoutLegs,
    finalSingleLeg: format.finalSingleLeg,
  };
}

export function getActiveKnockoutMatches(bracket: KnockoutBracket): any[] {
  switch (bracket.currentRound) {
    case 'playoffs': return bracket.playoffs;
    case 'round16': return bracket.round16;
    case 'quarters': return bracket.quarterFinals;
    case 'semis': return bracket.semiFinals;
    case 'final': return bracket.final ? [bracket.final] : [];
    default: return [];
  }
}

/** Whether a team is still alive in the current knockout stage. */
export function isKnockoutTeamAlive(bracket: KnockoutBracket, teamId: string): boolean {
  const tie = getActiveKnockoutMatches(bracket).find(match =>
    match.homeTeamId === teamId || match.awayTeamId === teamId,
  );
  if (!tie) {
    // In the playoff round, direct qualifiers have a bye and already occupy
    // their Round-of-16 slot while playoff winners are still being decided.
    return bracket.currentRound === 'playoffs'
      && bracket.round16.some(match => match.homeTeamId === teamId || match.awayTeamId === teamId);
  }
  if (!tie.played || !tie.result) return true;
  if (bracket.currentRound === 'final') return false;
  return (tie.result.winner ?? tie.result.penaltyWinner) === teamId;
}

function emptyMatchStats(): MatchResult['stats'] {
  return {
    homePos: 50, awayPos: 50, homeShots: 0, awayShots: 0,
    homeShotsOnTarget: 0, awayShotsOnTarget: 0, homeFouls: 0, awayFouls: 0,
    homeSaves: 0, awaySaves: 0, homeCorners: 0, awayCorners: 0,
  };
}

// Simulates the SECOND leg of a two-legged tie. `homeB` hosts the return leg (the
// first-leg away side); `awayA` is the first-leg home side. Extra time and the
// shootout are decided on AGGREGATE, never on the single leg.
function simulateSecondLeg(homeB: Team, awayA: Team, leg1: MatchResult, isFinal = false, neutralFinal = false): {
  leg2: MatchResult; tieWinner: string; aggA: number; aggB: number;
} {
  // 90-minute return leg (draws allowed). It still uses knockout modifiers;
  // only the aggregate decides whether ET/penalties are necessary.
  let leg2 = simulateMatch(homeB, awayA, true, isFinal, false, neutralFinal);
  // Team A was first-leg HOME / second-leg AWAY; team B was first-leg AWAY / second-leg HOME.
  let aggA = leg1.homeGoals + leg2.awayGoals;
  let aggB = leg1.awayGoals + leg2.homeGoals;

  if (aggA === aggB) {
    // Level on aggregate → extra time (engine adds no auto-penalties here).
    leg2 = runMatchSimulation(
      homeB, awayA, 90, 120,
      leg2.homeGoals, leg2.awayGoals, leg2.events, leg2.stats,
      leg2.playerStats ?? {}, true, isFinal, false, neutralFinal
    );
    leg2.durationMinutes = 120;
    aggA = leg1.homeGoals + leg2.awayGoals;
    aggB = leg1.awayGoals + leg2.homeGoals;
    if (aggA === aggB) {
      const pens = simulatePenalties(homeB, awayA, leg2.playerStats, undefined, undefined, { isFinal, neutralVenue: neutralFinal });
      leg2.penaltyWinner = pens.winner;
      leg2.homePenalties = pens.homeScore;
      leg2.awayPenalties = pens.awayScore;
      leg2.penaltyKicks = pens.kicks;
      leg2.events.push({
        minute: 120,
        type: 'penalty',
        description: `🎯 Pênaltis! ${homeB.name} ${pens.homeScore}-${pens.awayScore} ${awayA.name}`,
        teamId: pens.winner,
      });
    }
  } else {
    leg2.durationMinutes = 90;
  }

  let tieWinner: string;
  if (aggA > aggB) tieWinner = awayA.id;        // team A advances
  else if (aggB > aggA) tieWinner = homeB.id;   // team B advances
  else tieWinner = leg2.penaltyWinner!;         // decided on penalties (B home / A away)

  return { leg2, tieWinner, aggA, aggB };
}

// Simulates ONE tie's current leg. Two-legged: leg 1 = 90', leg 2 = aggregate
// decider (sets result + played). A single-leg tie: 120' + penalties.
function simulateKnockoutTieLeg(
  tie: any,
  currentLeg: number,
  isFinalRound: boolean,
  resolve: (id: string) => Team | undefined
): void {
  const home = resolve(tie.homeTeamId);
  const away = resolve(tie.awayTeamId);
  if (!home || !away) return;

  if (tie.isSingleLeg === true) {
    if (tie.played) return;
    tie.result = simulateMatch(home, away, true, true, true, true);
    tie.played = true;
    return;
  }

  if (currentLeg === 1) {
    if (tie.leg1) return;
    tie.leg1 = simulateMatch(home, away, true, isFinalRound, false, !isFinalRound); // 90', durationMinutes = 90
  } else {
    if (tie.leg2) return;
    const sl = simulateSecondLeg(away, home, tie.leg1, isFinalRound, false); // return leg: B home, A away
    tie.leg2 = sl.leg2;
    tie.result = {
      homeTeamId: tie.homeTeamId,
      awayTeamId: tie.awayTeamId,
      homeGoals: sl.aggA,
      awayGoals: sl.aggB,
      events: [],
      winner: sl.tieWinner,
      stats: emptyMatchStats(),
    };
    tie.played = true;
  }
}

// Plays the current leg for EVERY tie of the active round, then bumps the leg
// pointer 1 → 2 for two-legged rounds.
export function playActiveKnockoutLeg(
  bracket: KnockoutBracket,
  resolve: (id: string) => Team | undefined
): void {
  const isFinalRound = bracket.currentRound === 'final';
  const ties = getActiveKnockoutMatches(bracket);
  for (const tie of ties) {
    simulateKnockoutTieLeg(tie, bracket.currentLeg, isFinalRound, resolve);
  }
  if (bracket.currentLeg === 1 && ties.some(tie => tie.isSingleLeg !== true)) {
    bracket.currentLeg = 2;
  }
}

// Advances the bracket when the active round is fully played. Mutates `bracket`
// in place and returns the champion's teamId once the final is decided (else null).
export function advanceKnockoutBracket(bracket: KnockoutBracket): string | null {
  const round = bracket.currentRound;
  const list = getActiveKnockoutMatches(bracket);
  if (list.length === 0 || !list.every((m: any) => m.played && m.result)) return null;

  const winnerOf = (m: any): string => m.result.winner ?? m.result.penaltyWinner;
  const winnerEntrant = (m: any): BracketEntrant => ({
    teamId: winnerOf(m),
    seed: winnerOf(m) === m.homeTeamId ? m.homeSeed : m.awaySeed,
  });
  const nextTie = (id: string, left: BracketEntrant, right: BracketEntrant, isSingleLeg = bracket.knockoutLegs === 1) =>
    makeBracketTie(id, left, right, !isSingleLeg, isSingleLeg);

  if (round === 'playoffs') {
    // Slot each playoff winner into its predetermined Round-of-16 berth. Depending
    // on the configured line, a playoff winner can occupy either side of a tie.
    for (const tie of bracket.round16) {
      const homePo = tie.homeFromPo !== undefined ? bracket.playoffs[tie.homeFromPo] : undefined;
      const awayPo = tie.awayFromPo !== undefined ? bracket.playoffs[tie.awayFromPo] : undefined;
      if (homePo) {
        const winner = winnerEntrant(homePo);
        tie.homeTeamId = winner.teamId;
        tie.homeSeed = winner.seed;
      }
      if (awayPo) {
        const winner = winnerEntrant(awayPo);
        tie.awayTeamId = winner.teamId;
        tie.awaySeed = winner.seed;
      }
    }
    bracket.currentRound = 'round16';
    bracket.currentLeg = 1;
    return null;
  }
  if (round === 'round16') {
    const w = bracket.round16.map(winnerEntrant);
    if (w.length === 2) {
      bracket.final = nextTie('final', w[0], w[1], bracket.finalSingleLeg !== false);
      bracket.currentRound = 'final';
    } else if (w.length === 4) {
      bracket.quarterFinals = [
        nextTie('qf_0', w[0], w[1]),
        nextTie('qf_1', w[2], w[3]),
      ];
      bracket.currentRound = 'quarters';
    } else {
      bracket.quarterFinals = [
        nextTie('qf_0', w[0], w[1]),
        nextTie('qf_1', w[2], w[3]),
        nextTie('qf_2', w[4], w[5]),
        nextTie('qf_3', w[6], w[7]),
      ];
      bracket.currentRound = 'quarters';
    }
    bracket.currentLeg = 1;
    return null;
  }
  if (round === 'quarters') {
    const w = bracket.quarterFinals.map(winnerEntrant);
    if (w.length === 2) {
      bracket.final = nextTie('final', w[0], w[1], bracket.finalSingleLeg !== false);
      bracket.currentRound = 'final';
    } else {
      bracket.semiFinals = [
        nextTie('sf_0', w[0], w[1]),
        nextTie('sf_1', w[2], w[3]),
      ];
      bracket.currentRound = 'semis';
    }
    bracket.currentLeg = 1;
    return null;
  }
  if (round === 'semis') {
    const w = bracket.semiFinals.map(winnerEntrant);
    // The final follows the selected format. Single-leg finals are neutral;
    // two-legged finals use the normal home/away aggregate flow.
    bracket.final = nextTie('final', w[0], w[1], bracket.finalSingleLeg !== false);
    bracket.currentRound = 'final';
    bracket.currentLeg = 1;
    return null;
  }
  if (round === 'final') {
    return winnerOf(bracket.final);
  }
  return null;
}

// Human-readable label for a bracket round.
export function knockoutRoundLabel(round: string, firstRoundSize?: number): string {
  if (round === 'round16' && firstRoundSize && firstRoundSize < 16) {
    return firstRoundSize === 4 ? 'SEMIFINAIS' : 'QUARTAS DE FINAL';
  }
  switch (round) {
    case 'playoffs': return 'PLAYOFFS';
    case 'round16': return 'OITAVAS DE FINAL';
    case 'quarters': return 'QUARTAS DE FINAL';
    case 'semis': return 'SEMIFINAIS';
    case 'final': return 'GRANDE FINAL';
    default: return '';
  }
}

export function getAllPlayedMatchResults(
  leagueResults: MatchResult[],
  bracket: KnockoutBracket | null
): MatchResult[] {
  const all: MatchResult[] = [...leagueResults];
  if (bracket) {
    const list = [
      ...(bracket.playoffs ?? []),
      ...(bracket.round16 ?? []),
      ...bracket.quarterFinals,
      ...bracket.semiFinals,
      ...(bracket.final ? [bracket.final] : [])
    ];
    for (const m of list) {
      // Two-legged ties contribute each leg (real events/stats); single-leg ties
      // contribute their one result. The aggregate object on a
      // two-legged tie carries no events, so it is never counted on its own.
      if (m.leg1) all.push(m.leg1);
      if (m.leg2) all.push(m.leg2);
      if (!m.leg1 && !m.leg2 && m.played && m.result) all.push(m.result);
    }
  }
  return all;
}

export interface PlayerSeasonStats {
  played: number;
  goals: number;
  assists: number;
  ratingSum: number;
  ratingAvg: number;
  shots: number;
  tackles: number;
  saves: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
}

export function getPlayerSeasonStats(
  playerId: string,
  teamId: string,
  results: MatchResult[]
): PlayerSeasonStats {
  const stats: PlayerSeasonStats = {
    played: 0,
    goals: 0,
    assists: 0,
    ratingSum: 0,
    ratingAvg: 0.0,
    shots: 0,
    tackles: 0,
    saves: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
  };

  for (const r of results) {
    // Match stats are keyed by team+player, so this never picks up a same-named
    // player from the OTHER team.
    const ps = r.playerStats?.[statKey(teamId, playerId)];
    if (ps) {
      {
        stats.played++;
        stats.goals += ps.goals;
        stats.assists += ps.assists;
        stats.shots += ps.shots;
        stats.tackles += ps.tackles;
        stats.saves += ps.saves;
        stats.fouls += ps.fouls;
        stats.yellowCards += ps.yellowCards;
        stats.redCards += ps.redCards;
        stats.ratingSum += ps.rating;
      }
    }
  }

  if (stats.played > 0) {
    stats.ratingAvg = parseFloat((stats.ratingSum / stats.played).toFixed(2));
  }

  return stats;
}
