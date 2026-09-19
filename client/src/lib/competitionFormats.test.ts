import { describe, expect, it } from 'vitest';
import {
  advanceKnockoutBracket,
  computeGroupStandings,
  computeGroupQualifiedStandings,
  createKnockoutBracket,
  generateGroupFixtures,
  generateBotTeam,
  generateUniquePackOffer,
  drawUniquePackCard,
  generateUniquePackCard,
  playActiveKnockoutLeg,
} from './gameEngine';
import { UNIQUE_CARDS } from './gameData';
import { createCompetitionFormat } from './competition';

const teams = Array.from({ length: 32 }, (_, index) => ({ id: `team_${index}`, name: `Team ${index}` } as any));
const standings = teams.slice(0, 16).map((team, index) => ({
  teamId: team.id, teamName: team.name, played: 0, won: 0, drawn: 0, lost: 0,
  goalsFor: 0, goalsAgainst: 0, points: 16 - index,
}));

describe('competition format engine helpers', () => {
  it('creates isolated group schedules with the configured matchday count', () => {
    const fixtures = generateGroupFixtures(teams, 8, 3);
    expect(fixtures).toHaveLength(48);
    expect(new Set(fixtures.map(fixture => fixture.groupId))).toHaveProperty('size', 8);
    expect(fixtures.filter(fixture => fixture.round === 1)).toHaveLength(16);
  });

  it('builds direct knockout brackets with the requested number of teams', () => {
    for (const teamCount of [4, 8, 16]) {
      const format = createCompetitionFormat('knockout');
      format.teamCount = teamCount;
      const bracket = createKnockoutBracket(standings, format);
      expect(bracket.round16).toHaveLength(teamCount / 2);
      expect(bracket.firstRoundSize).toBe(teamCount);
      expect(bracket.playoffs).toHaveLength(0);
    }
  });

  it('carries the configured final leg format into the decisive tie', () => {
    const format = createCompetitionFormat('knockout');
    format.teamCount = 4;
    format.finalSingleLeg = false;
    const bracket = createKnockoutBracket(standings.slice(0, 4), format);

    for (const match of bracket.round16) {
      match.played = true;
      match.result = {
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeGoals: 1,
        awayGoals: 0,
        winner: match.homeTeamId,
        events: [],
      } as any;
    }

    expect(advanceKnockoutBracket(bracket)).toBeNull();
    expect(bracket.currentRound).toBe('final');
    expect(bracket.finalSingleLeg).toBe(false);
    expect(bracket.final?.isSingleLeg).toBe(false);
  });

  it('plays both final legs and resolves the winner on aggregate', () => {
    const finalTeams = Array.from({ length: 4 }, (_, index) => generateBotTeam(`Final Test ${index}`, 50));
    const format = createCompetitionFormat('knockout');
    format.teamCount = 4;
    format.knockoutLegs = 1;
    format.finalSingleLeg = false;
    const seeded = finalTeams.map((team, index) => ({
      teamId: team.id, teamName: team.name, played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 4 - index,
    }));
    const bracket = createKnockoutBracket(seeded, format);
    const byId = (id: string) => finalTeams.find(team => team.id === id);

    for (const match of bracket.round16) {
      match.played = true;
      match.result = {
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        homeGoals: 1,
        awayGoals: 0,
        winner: match.homeTeamId,
        events: [],
      } as any;
    }
    expect(advanceKnockoutBracket(bracket)).toBeNull();

    playActiveKnockoutLeg(bracket, byId);
    expect(bracket.currentRound).toBe('final');
    expect(bracket.currentLeg).toBe(2);
    expect(bracket.final?.leg1).toBeDefined();
    expect(bracket.final?.played).toBe(false);

    playActiveKnockoutLeg(bracket, byId);
    expect(bracket.final?.leg2).toBeDefined();
    expect(bracket.final?.played).toBe(true);
    expect(bracket.final?.result?.winner).toBeTruthy();
  });

  it('qualifies the configured number from each group', () => {
    const format = createCompetitionFormat('groups_knockout');
    const groupRanked = computeGroupQualifiedStandings(teams, [], format);
    expect(groupRanked).toHaveLength(16);
  });

  it('keeps every group table independent from the global team order', () => {
    const format = createCompetitionFormat('groups_knockout');
    const fixtures = generateGroupFixtures(teams, format.groupCount, format.groupRounds);
    const tables = computeGroupStandings([...teams].reverse(), fixtures, format);

    expect(tables).toHaveLength(format.groupCount);
    expect(tables.every(table => table.entries.length === 4)).toBe(true);
    expect(tables[0].entries.map(entry => entry.teamId).sort()).toEqual(['team_0', 'team_1', 'team_2', 'team_3']);
    expect(tables[1].entries.map(entry => entry.teamId).sort()).toEqual(['team_4', 'team_5', 'team_6', 'team_7']);
  });

  it('draws one unowned Unique card and stops when the catalog is complete', () => {
    const ownedIds = UNIQUE_CARDS.slice(0, -1).map(card => card.id);
    const lastAvailable = generateUniquePackCard(ownedIds);

    expect(lastAvailable?.id).toBe(UNIQUE_CARDS[UNIQUE_CARDS.length - 1].id);
    expect(lastAvailable?.rarity).toBe('unique');
    expect(generateUniquePackCard(UNIQUE_CARDS.map(card => card.id))).toBeNull();
  });

  it('creates a stable-size offer and draws only from cards not yet owned', () => {
    const ownedIds = UNIQUE_CARDS.slice(0, 2).map(card => card.id);
    const offer = generateUniquePackOffer(ownedIds);

    expect(offer).toHaveLength(4);
    expect(new Set(offer).size).toBe(4);
    expect(offer.some(id => ownedIds.includes(id))).toBe(false);

    const drawn = drawUniquePackCard(offer, ownedIds);
    expect(drawn).not.toBeNull();
    expect(offer).toContain(drawn!.id);

    const remaining = drawUniquePackCard(offer, [...ownedIds, drawn!.id]);
    expect(remaining).not.toBeNull();
    expect(remaining!.id).not.toBe(drawn!.id);
  });

  it('keeps the offer cards available for display even after they are owned', () => {
    const offer = generateUniquePackOffer([]);
    const first = offer[0];

    expect(offer).toContain(first);
    expect(drawUniquePackCard(offer, [first])?.id).not.toBe(first);
  });
});
