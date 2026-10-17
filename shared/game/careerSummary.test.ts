import { describe, expect, it } from 'vitest';
import { buildCareerSummary, type CareerSummary } from './careerSummary';
import { summarizeCareer, type CareerCompetition } from './achievements';
import { PLAYERS } from './gameData';
import type { KnockoutBracket, MatchResult } from './gameEngine';

const stat = (teamId: string, playerId: string, goals: number, assists = 0) => ({ playerId, playerName: playerId, teamId, goals, assists });
const match = (home: string, away: string, homeGoals: number, awayGoals: number, stats: ReturnType<typeof stat>[] = [], penaltyWinner?: string): MatchResult => ({
  homeTeamId: home, awayTeamId: away, homeGoals, awayGoals, winner: homeGoals > awayGoals ? home : awayGoals > homeGoals ? away : null,
  events: [], penaltyWinner,
  playerStats: Object.fromEntries(stats.map(s => [`${s.teamId}::${s.playerId}`, s])),
} as unknown as MatchResult);

describe('career summary', () => {
  it('extracts the facts the new achievements need', () => {
    const league = [
      match('me', 'a', 7, 0, [stat('me', 'st', 3, 0), stat('me', 'cm', 2, 3)]),
      match('b', 'me', 1, 1, [stat('b', 'x', 1)]),
    ];
    const bracket = {
      quarterFinals: [{ played: true, leg1: match('c', 'me', 2, 0), leg2: match('me', 'c', 3, 0) }],
      semiFinals: [{ played: true, result: match('me', 'd', 1, 1, [], 'me') }],
      final: { played: true, result: match('me', 'e', 3, 0) },
    } as unknown as KnockoutBracket;
    const xi = PLAYERS.filter(p => p.nation === 'Brasil').slice(0, 11).map(p => ({ ...p }));
    const summary = buildCareerSummary({
      teamId: 'me', leagueResults: league, bracket, leagueStandings: [{ teamId: 'me' }, { teamId: 'a' }],
      finalStarters: xi, finalChemistry: 112,
    });
    expect(summary).toMatchObject({
      knockoutMatches: 4, knockoutLosses: 1, shootoutWins: 1, finalWinMargin: 3, finalCleanSheetWin: true,
      hatTricks: 1, bigWins: 1, assists: 3, leagueMatches: 2, leagueLosses: 0, leaguePosition: 1,
      ownTopScorer: true, finalChemistry: 112, finalPlainXI: true, finalMaxSameNation: 11,
    });
  });

  it('feeds the new career metrics', () => {
    const facts: CareerSummary = {
      version: 1, knockoutLosses: 1, knockoutMatches: 4, shootoutWins: 2, finalWinMargin: 3, finalCleanSheetWin: true,
      hatTricks: 1, bigWins: 1, cleanSheets: 5, assists: 12, leagueMatches: 8, leagueLosses: 0, leaguePosition: 1,
      ownTopScorer: true, finalChemistry: 105, finalPlainXI: true, finalMaxSameNation: 7,
    };
    const competition = {
      difficultyId: 'gold', mode: 'solo', finishStage: 'champion', champion: true, wins: 10, draws: 1, losses: 1, games: 12,
      goals: 30, goalsAgainst: 6, humanPlayers: null, coachId: null, crestId: null, completedAt: 1, rankingPoints: 0,
      topPlayerGoals: 0, topPlayerAssists: 0, topKeeperSaves: 0, topPlayerOverall: 0, finalStarterIds: [], career: facts,
    } as CareerCompetition;
    const { metrics } = summarizeCareer([competition, { ...competition, career: null }]);
    expect(metrics).toMatchObject({
      comebackTitles: 1, bigFinalWins: 1, knockoutUnbeatenTitles: 0, finalCleanSheetWins: 1, plainTitles: 1,
      maxChemistryTitles: 1, nationTitles: 1, unbeatenLeagues: 1, leagueWins: 1, topScorerCompetitions: 1,
      shootoutWins: 2, hatTricks: 1, bigWins: 1, careerAssists: 12, careerCleanSheets: 5,
    });
  });
});
