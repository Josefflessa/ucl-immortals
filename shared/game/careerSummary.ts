// UCL Immortals — compact per-competition facts for the achievements.
// Built once when a competition ends (solo report and online room alike) and
// stored in the history report as `career`, because the full match snapshot is
// archived later. shared/game/achievements.ts reads it through CareerCompetition.

import type { Player } from './gameData';
import type { KnockoutBracket, MatchResult } from './gameEngine';
import { hasVariant } from './engine/draft';
import type { Bet } from './bets';

export interface CareerSummary {
  version: 1;
  /** Knockout matches (legs) the team lost in regular time. */
  knockoutLosses: number;
  /** Knockout matches (legs) the team played. */
  knockoutMatches: number;
  /** Penalty shootouts the team won. */
  shootoutWins: number;
  /** The team won the final by this margin (0 when it did not win the final, or won on penalties). */
  finalWinMargin: number;
  /** The team won the final without conceding. */
  finalCleanSheetWin: boolean;
  /** Players of the team that scored 3+ goals in one match. */
  hatTricks: number;
  /** Wins by 6 goals or more. */
  bigWins: number;
  /** Matches without conceding. */
  cleanSheets: number;
  /** Assists of the whole team. */
  assists: number;
  /** League-phase matches played and lost (0 played = no league phase). */
  leagueMatches: number;
  leagueLosses: number;
  /** Final position in the league table (null without one). */
  leaguePosition: number | null;
  /** The competition's top scorer (most goals among every team) plays for this team. */
  ownTopScorer: boolean;
  /** Team chemistry when the competition ended. */
  finalChemistry: number;
  /** The final's XI had no special characteristic at all. */
  finalPlainXI: boolean;
  /** Most starters of the final's XI from one nation. */
  finalMaxSameNation: number;
  /** Shop credits left when the competition ended. */
  finalCredits?: number;
  /** Missions completed during the competition. */
  missionsCompleted?: number;
  /** Bets won, and those won with the exact score. */
  betsWon?: number;
  exactBets?: number;
  /** Wins against teams of other human players (online). */
  humanWins?: number;
}

function teamGoals(result: MatchResult, teamId: string): { own: number; against: number } | null {
  if (result.homeTeamId === teamId) return { own: result.homeGoals, against: result.awayGoals };
  if (result.awayTeamId === teamId) return { own: result.awayGoals, against: result.homeGoals };
  return null;
}

function knockoutResults(bracket: KnockoutBracket | null): { result: MatchResult; final: boolean }[] {
  if (!bracket) return [];
  const ties = [
    ...(bracket.playoffs ?? []), ...(bracket.round16 ?? []), ...bracket.quarterFinals, ...bracket.semiFinals,
  ].map(tie => ({ tie, final: false }));
  if (bracket.final) ties.push({ tie: bracket.final, final: true });
  return ties.flatMap(({ tie, final }) => {
    const legs = [tie.leg1, tie.leg2].filter((leg): leg is MatchResult => !!leg);
    if (legs.length > 0) return legs.map(result => ({ result, final }));
    return tie.played && tie.result ? [{ result: tie.result as MatchResult, final }] : [];
  });
}

export function buildCareerSummary(input: {
  teamId: string;
  leagueResults: MatchResult[];
  bracket: KnockoutBracket | null;
  /** Standings rows in table order (any shape with a teamId). */
  leagueStandings?: ReadonlyArray<{ teamId: string }>;
  finalStarters: ReadonlyArray<Player>;
  finalChemistry: number;
  finalCredits?: number;
  missionsCompleted?: number;
  bets?: ReadonlyArray<Pick<Bet, 'settled' | 'won' | 'tier'>>;
  /** Teams of the other human players in an online room. */
  humanTeamIds?: ReadonlyArray<string>;
}): CareerSummary {
  const { teamId } = input;
  const knockout = knockoutResults(input.bracket);
  const all = [...input.leagueResults, ...knockout.map(entry => entry.result)];
  const summary: CareerSummary = {
    version: 1, knockoutLosses: 0, knockoutMatches: 0, shootoutWins: 0, finalWinMargin: 0, finalCleanSheetWin: false,
    hatTricks: 0, bigWins: 0, cleanSheets: 0, assists: 0, leagueMatches: 0, leagueLosses: 0, leaguePosition: null,
    ownTopScorer: false, finalChemistry: Math.max(0, Math.round(input.finalChemistry || 0)),
    finalPlainXI: input.finalStarters.length === 11 && input.finalStarters.every(player => !hasVariant(player)),
    finalMaxSameNation: 0,
    finalCredits: Math.max(0, Math.floor(input.finalCredits ?? 0)),
    missionsCompleted: Math.max(0, Math.floor(input.missionsCompleted ?? 0)),
    betsWon: (input.bets ?? []).filter(bet => bet.settled && bet.won).length,
    exactBets: (input.bets ?? []).filter(bet => bet.settled && bet.won && bet.tier === 'exact').length,
    humanWins: 0,
  };
  const humans = new Set(input.humanTeamIds ?? []);

  const goalsByPlayer = new Map<string, { teamId: string; goals: number }>();
  for (const result of all) {
    for (const stat of Object.values(result.playerStats ?? {})) {
      const key = `${stat.teamId}:${stat.playerId}`;
      const entry = goalsByPlayer.get(key) ?? { teamId: stat.teamId, goals: 0 };
      entry.goals += stat.goals ?? 0;
      goalsByPlayer.set(key, entry);
      if (stat.teamId !== teamId) continue;
      if ((stat.goals ?? 0) >= 3) summary.hatTricks += 1;
      summary.assists += stat.assists ?? 0;
    }
    const goals = teamGoals(result, teamId);
    if (!goals) continue;
    if (goals.against === 0) summary.cleanSheets += 1;
    if (goals.own - goals.against >= 6) summary.bigWins += 1;
    const opponent = result.homeTeamId === teamId ? result.awayTeamId : result.homeTeamId;
    if (goals.own > goals.against && humans.has(opponent)) summary.humanWins = (summary.humanWins ?? 0) + 1;
  }

  for (const result of input.leagueResults) {
    const goals = teamGoals(result, teamId);
    if (!goals) continue;
    summary.leagueMatches += 1;
    if (goals.own < goals.against) summary.leagueLosses += 1;
  }

  for (const { result, final } of knockout) {
    const goals = teamGoals(result, teamId);
    if (!goals) continue;
    summary.knockoutMatches += 1;
    if (goals.own < goals.against) summary.knockoutLosses += 1;
    if (result.penaltyWinner === teamId) summary.shootoutWins += 1;
    if (final && goals.own > goals.against) {
      summary.finalWinMargin = goals.own - goals.against;
      summary.finalCleanSheetWin = goals.against === 0;
    }
  }

  const position = input.leagueStandings?.findIndex(row => row.teamId === teamId) ?? -1;
  summary.leaguePosition = position >= 0 ? position + 1 : null;

  const topGoals = Math.max(0, ...Array.from(goalsByPlayer.values(), entry => entry.goals));
  summary.ownTopScorer = topGoals > 0 && Array.from(goalsByPlayer.values()).some(entry => entry.teamId === teamId && entry.goals === topGoals);

  const nations = new Map<string, number>();
  for (const player of input.finalStarters) nations.set(player.nation, (nations.get(player.nation) ?? 0) + 1);
  summary.finalMaxSameNation = Math.max(0, ...Array.from(nations.values()));
  return summary;
}
