import { describe, expect, it } from 'vitest';
import * as seatRules from './seatRules';
import {
  applyApostadorWins, applyShopVariant, computeCharacteristicBoosts, DRAFT_VARIANT_CHANCE, generateBotTeam,
  generateDraftOptions, apostadorStatBoost, hasVariant, midiaticoCredits, RECRUITMENT_VARIANT_CHANCE, statKey,
  stripVariant, VARIANT_FLAGS, type MatchResult, type Team,
} from './gameEngine';
import { newlyWonBets, type Bet } from './bets';
import { SHOP_COSTS, shopItemCost } from './shop';
import { calculateClubReward } from './clubProjects';
import { createMissionState } from './missions';
import { seededRandom, withRandomSource } from './random';

/** A bot team with every characteristic removed, so each test adds only what it needs. */
function plainTeam(): Team {
  const team = generateBotTeam('Teste FC', 0.7);
  return { ...team, isBot: false, players: team.players.map(player => stripVariant(player)) };
}

function seat(team: Team, points = 1000): seatRules.PlayerSeat {
  return { team, points, missions: createMissionState('seat', 'L1'), pendingPack: null, pendingPackReveal: null, pendingUniquePack: null };
}

describe('characteristics in the draft', () => {
  it('a card comes with one 25% of the time in the draft and 40% in the recruitment, drawn evenly', () => {
    const share = (chance: number) => withRandomSource(seededRandom(7), () => {
      const seen = new Map<string, number>();
      let cards = 0;
      let carded = 0;
      for (let i = 0; i < 700; i++) {
        for (const card of generateDraftOptions([], [], 6, 0, chance)) {
          cards += 1;
          if (!hasVariant(card)) continue;
          carded += 1;
          const flag = VARIANT_FLAGS.find(key => (card as unknown as Record<string, unknown>)[key])!;
          seen.set(flag, (seen.get(flag) ?? 0) + 1);
        }
      }
      return { ratio: carded / cards, seen };
    });
    const draft = share(DRAFT_VARIANT_CHANCE);
    expect(draft.ratio).toBeGreaterThan(0.23);
    expect(draft.ratio).toBeLessThan(0.27);
    // Uniform: every characteristic shows up, none far from the mean.
    expect(draft.seen.size).toBe(VARIANT_FLAGS.length);
    const mean = [...draft.seen.values()].reduce((a, b) => a + b, 0) / VARIANT_FLAGS.length;
    for (const count of draft.seen.values()) expect(Math.abs(count - mean) / mean).toBeLessThan(0.6);

    const recruitment = share(RECRUITMENT_VARIANT_CHANCE);
    expect(recruitment.ratio).toBeGreaterThan(0.37);
    expect(recruitment.ratio).toBeLessThan(0.43);
  });
});

describe('🎲 Apostador', () => {
  it('gains +2 in every attribute per bet won while in the squad', () => {
    const team = plainTeam();
    const bench = team.players[team.players.length - 1];
    const withTrait = { ...team, players: team.players.map(p => (p.id === bench.id ? applyShopVariant(p, 'apostador') : p)) };
    const before: Bet[] = [
      { id: 'a', matchKey: 'L1:x-y', homeGoals: 1, awayGoals: 0, stake: 10, market: 'exact' } as Bet,
      { id: 'b', matchKey: 'L1:z-w', homeGoals: 1, awayGoals: 0, stake: 10, market: 'exact' } as Bet,
      { id: 'c', matchKey: 'L0:q-r', homeGoals: 1, awayGoals: 0, stake: 10, market: 'exact', revealed: true, won: true } as Bet,
    ];
    const after = [{ ...before[0], revealed: true, won: true }, { ...before[1], revealed: true, won: false }, before[2]];
    // Only the bet revealed now counts; the one already revealed before does not.
    expect(newlyWonBets(before, after)).toBe(1);
    const grown = applyApostadorWins(applyApostadorWins(withTrait, 1), 2);
    const card = grown.players.find(p => p.id === bench.id)!;
    expect(card.apostadorWins).toBe(3);
    expect(apostadorStatBoost(card.apostadorWins)).toBe(6);
    // Cards without the characteristic are untouched.
    expect(grown.players[0]).toBe(withTrait.players[0]);
  });
});

describe('🔗 Agregador', () => {
  it('gives the XI +1 per different characteristic among the starters, and each Agregador adds its own', () => {
    const team = plainTeam();
    const players = team.players.map((p, i) => (i === 0 ? applyShopVariant(p, 'agregador')
      : i === 1 ? applyShopVariant(p, 'pilar')
      : i === 2 ? applyShopVariant(p, 'goleador')
      : i === 3 ? applyShopVariant(p, 'goleador')
      
      : p));
    const boosts = computeCharacteristicBoosts(players);
    // Agregador, Pilar and Goleador (twice, but one kind) = 3 different.
    for (const p of players.slice(0, 11)) expect(boosts[p.id]?.flatAll).toBe(3);

    const two = players.map((p, i) => (i === 4 ? applyShopVariant(p, 'agregador') : p));
    expect(computeCharacteristicBoosts(two)[two[5].id]?.flatAll).toBe(6);
  });
});

describe('🏷️ Pechincheiro', () => {
  it('makes shop items 15% cheaper from anywhere in the squad', () => {
    const team = plainTeam();
    const bench = team.players[team.players.length - 1];
    const withTrait = { ...team, players: team.players.map(p => (p.id === bench.id ? applyShopVariant(p, 'pechincheiro') : p)) };
    expect(shopItemCost(SHOP_COSTS.turbinar, team.players)).toBe(SHOP_COSTS.turbinar);
    expect(shopItemCost(SHOP_COSTS.turbinar, withTrait.players)).toBe(Math.round(SHOP_COSTS.turbinar * 0.85));
    const open: seatRules.SeatContext = { shopOpen: true, roundKey: 'league:1' };
    const turbo = seatRules.turbinar(seat(withTrait), open, withTrait.players[0].id, 'inForm', {});
    expect(turbo.ok).toBe(true);
    if (turbo.ok) expect(turbo.seat.points).toBe(1000 - Math.round(SHOP_COSTS.turbinar * 0.85));
    const coach = seatRules.changeCoach(seat(withTrait), open, 'klopp');
    if (coach.ok) expect(coach.seat.points).toBe(1000 - Math.round(SHOP_COSTS.changeCoach * 0.85));
  });
});

describe('📺 Midiático', () => {
  it('earns 15 credits per goal it scores, on top of the match credits', () => {
    const team = plainTeam();
    const star = applyShopVariant(team.players[9], 'midiatico');
    const withTrait = { ...team, players: team.players.map((p, i) => (i === 9 ? star : p)) };
    const result = {
      homeTeamId: team.id, awayTeamId: 'rival', homeGoals: 3, awayGoals: 0,
      playerStats: {
        [statKey(team.id, star.id)]: { goals: 2, assists: 0 },
        [statKey(team.id, team.players[8].id)]: { goals: 1, assists: 1 },
      },
    } as unknown as MatchResult;
    expect(midiaticoCredits(withTrait, result)).toBe(30);
    expect(midiaticoCredits(team, result)).toBe(0);
    const reward = calculateClubReward(100, 1, 'home', false, 0, 30);
    expect(reward.midiaticoBonus).toBe(30);
    expect(reward.total).toBe(130);
  });
});
