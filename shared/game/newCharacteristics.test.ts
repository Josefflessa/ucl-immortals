import { describe, expect, it } from 'vitest';
import {
  applyMatchStatGrowth, applyPostMatchCardProgress, applyShopVariant, calculateChemistry, computeCharacteristicBoosts,
  generateBotTeam, getEvolutionLevel, statKey, stripVariant, DRAFT_VARIANT_POOL, RETIRED_VARIANT_FLAGS,
  type MatchResult, type PlayerCard, type Team,
} from './gameEngine';
import { FORMATIONS, effectiveSecondaries } from './gameData';
import { TURBINAR_VARIANTS } from './shop';
import { createMissionState, RETIRED_MISSION_IDS, rotateMissionBoard } from './missions';
import {
  FOMINHA_CHEM_PENALTY_PER_GOAL, IMPROVISADOR_OOP_CHEM, IMPROVISADOR_SECONDARY_CHEM, POLIGLOTA_STAT_BOOST_PER_NATION,
} from './engine/draft';

/** A bot team with every characteristic removed, so each test adds only what it needs. */
function plainTeam(): Team {
  const team = generateBotTeam('Teste FC', 0.7);
  return { ...team, isBot: false, players: team.players.map(player => stripVariant(player)) };
}

const withCard = (team: Team, index: number, card: PlayerCard): Team =>
  ({ ...team, players: team.players.map((p, i) => (i === index ? card : p)) });

const roles = (team: Team) => FORMATIONS.find(f => f.id === team.formationId)!.positions.map(p => p.role);

function result(team: Team, homeGoals: number, awayGoals: number, stats: Record<string, { goals: number; assists?: number }> = {}): MatchResult {
  const playerStats = Object.fromEntries(team.players.map(p => [statKey(team.id, p.id), { goals: 0, assists: 0, ...(stats[p.id] ?? {}) }]));
  return {
    homeTeamId: team.id, awayTeamId: 'rival', homeGoals, awayGoals, playerStats,
    startingLineups: { home: team.players.slice(0, 11).map(p => p.id), away: [] },
  } as unknown as MatchResult;
}

describe('retired characteristics', () => {
  it('Em Alta, Lobo Solitário and Pilar leave the draft pool and the Turbinar list', () => {
    for (const flag of ['inForm', 'lobo', 'pilar'] as const) {
      expect(RETIRED_VARIANT_FLAGS.has(flag)).toBe(true);
      expect(DRAFT_VARIANT_POOL).not.toContain(flag);
      expect(TURBINAR_VARIANTS.map(v => v.key)).not.toContain(flag);
    }
    expect(DRAFT_VARIANT_POOL).toEqual(expect.arrayContaining(['mentor', 'improvisador', 'desenfreado', 'fazTudo', 'fominha', 'poliglota']));
  });

  it('their missions never appear on a mission board', () => {
    let state = createMissionState('retired', 'L1');
    for (let round = 1; round <= 60; round++) {
      state = rotateMissionBoard(state, 'retired', `L${round}`);
      for (const id of state.boardIds) expect(RETIRED_MISSION_IDS.has(id)).toBe(false);
    }
  });

  it('bots no longer carry them', () => {
    for (let i = 0; i < 20; i++) {
      const bot = generateBotTeam(`Bot ${i}`, 0.97);
      expect(bot.players.some(p => p.inForm || p.lobo || p.pilar)).toBe(false);
    }
  });
});

describe('🔀 Improvisador', () => {
  it('adds +8 per secondary-position starter and +12 per out-of-position starter, without stacking', () => {
    const team = plainTeam();
    const formationRoles = roles(team);
    const xi = team.players.slice(0, 11);
    const base = calculateChemistry(xi, team.coachId, formationRoles, team.formationId);
    const secondary = Object.values(base.secondaryPos).filter(Boolean).length;
    const oop = Object.values(base.outOfPosition).filter(Boolean).length;
    const one = xi.map((p, i) => (i === 10 ? applyShopVariant(p, 'improvisador') : p));
    const two = one.map((p, i) => (i === 9 ? applyShopVariant(p, 'improvisador') : p));
    const expected = base.total + secondary * IMPROVISADOR_SECONDARY_CHEM + oop * IMPROVISADOR_OOP_CHEM;
    expect(calculateChemistry(one, team.coachId, formationRoles, team.formationId).total).toBe(expected);
    expect(calculateChemistry(two, team.coachId, formationRoles, team.formationId).total).toBe(expected);
  });

  it('counts a starter playing out of position', () => {
    const team = plainTeam();
    const formationRoles = roles(team);
    const xi = team.players.slice(0, 11);
    // Put the goalkeeper slot's card in a striker slot and vice-versa: both off position.
    const swapped = [...xi];
    const gk = formationRoles.indexOf('GK');
    const st = formationRoles.lastIndexOf('ST');
    [swapped[gk], swapped[st]] = [swapped[st], swapped[gk]];
    const plain = calculateChemistry(swapped, team.coachId, formationRoles, team.formationId);
    const slot = [0, 1, 2, 3, 4, 5].find(i => i !== gk && i !== st)!;
    const withImp = swapped.map((p, i) => (i === slot ? applyShopVariant(p, 'improvisador') : p));
    const improvised = calculateChemistry(withImp, team.coachId, formationRoles, team.formationId);
    const oop = Object.values(plain.outOfPosition).filter(Boolean).length;
    expect(oop).toBeGreaterThanOrEqual(2);
    expect(improvised.total - plain.total).toBeGreaterThanOrEqual(oop * IMPROVISADOR_OOP_CHEM);
  });
});

describe('💯 Desenfreado', () => {
  it('gives the whole XI +1 in everything per 3 chemistry points above 100, with no cap', () => {
    const team = plainTeam();
    const xi = team.players.map((p, i) => (i === 3 ? applyShopVariant(p, 'desenfreado') : p));
    expect(computeCharacteristicBoosts(xi, 100)[xi[0].id]?.flatAll ?? 0).toBe(0);
    const boosts = computeCharacteristicBoosts(xi, 131);
    for (const p of xi.slice(0, 11)) expect(boosts[p.id]?.flatAll).toBe(10);
    expect(boosts[xi[12].id]).toBeUndefined();
    expect(computeCharacteristicBoosts(xi, 300)[xi[0].id]?.flatAll).toBe(66);
  });

  it('does nothing without a Desenfreado starter', () => {
    const team = plainTeam();
    expect(computeCharacteristicBoosts(team.players, 150)[team.players[0].id]).toBeUndefined();
  });
});

describe('🌐 Poliglota', () => {
  it('+2 in everything on himself per other nation among the starters', () => {
    const team = plainTeam();
    const xi = team.players.slice(0, 11).map((p, i) => ({ ...p, nation: i < 6 ? 'Brasil' : `Nação ${i}` }));
    xi[0] = applyShopVariant(xi[0], 'poliglota');
    const boosts = computeCharacteristicBoosts(xi);
    expect(boosts[xi[0].id]?.flatAll).toBe(5 * POLIGLOTA_STAT_BOOST_PER_NATION);
    expect(boosts[xi[1].id]).toBeUndefined();
  });
});

describe('🍽️ Fominha', () => {
  it('accumulates his goals: +1 in everything on him and −2 team chemistry per goal', () => {
    const base = plainTeam();
    const fominha = applyShopVariant(base.players[10], 'fominha') as PlayerCard;
    const team = withCard(base, 10, fominha);
    const grown = applyMatchStatGrowth(team, result(team, 3, 0, { [fominha.id]: { goals: 3 } }), 'L1');
    const again = applyMatchStatGrowth(grown, result(grown, 3, 0, { [fominha.id]: { goals: 3 } }), 'L1');
    const card = again.players[10];
    expect(card.fominhaGoals).toBe(3);
    expect(computeCharacteristicBoosts(again.players)[card.id]?.flatAll).toBe(3);
    const formationRoles = roles(team);
    const before = calculateChemistry(team.players.slice(0, 11), team.coachId, formationRoles, team.formationId).total;
    const after = calculateChemistry(again.players.slice(0, 11), team.coachId, formationRoles, team.formationId).total;
    expect(after).toBe(Math.max(0, before - 3 * FOMINHA_CHEM_PENALTY_PER_GOAL));
    // The stored team chemistry is refreshed after the match.
    expect(applyPostMatchCardProgress(again, result(again, 3, 0), 'L1').totalChemistry).toBe(after);
  });
});

describe('🔧 Faz-Tudo', () => {
  it('learns a position after 2 starts out of position there; it then counts as secondary', () => {
    const base = plainTeam();
    const formationRoles = roles(base);
    const gkSlot = formationRoles.indexOf('GK');
    const outfieldSlot = formationRoles.findIndex(role => role === 'ST');
    // A goalkeeper card with Faz-Tudo playing as striker.
    const keeper = applyShopVariant(base.players[gkSlot], 'fazTudo') as PlayerCard;
    const players = [...base.players];
    [players[gkSlot], players[outfieldSlot]] = [players[outfieldSlot], keeper];
    let team: Team = { ...base, players };
    team = applyMatchStatGrowth(team, result(team, 1, 0), 'L1');
    expect(team.players[outfieldSlot].learnedPositions ?? []).not.toContain('ST');
    team = applyMatchStatGrowth(team, result(team, 1, 0), 'L1'); // same match: idempotent
    expect(team.players[outfieldSlot].fazTudoStarts?.ST).toBe(1);
    team = applyMatchStatGrowth(team, result(team, 0, 2), 'L2');
    const learned = team.players[outfieldSlot];
    expect(learned.learnedPositions).toContain('ST');
    expect(effectiveSecondaries(learned)).toContain('ST');
    expect(stripVariant(learned).learnedPositions).toBeUndefined();
  });
});

describe('🧑‍🏫 Mentor', () => {
  it('a win with him starting adds +1 evolution start to the whole squad, without stacking', () => {
    const base = plainTeam();
    let team = withCard(base, 4, applyShopVariant(base.players[4], 'mentor') as PlayerCard);
    team = withCard(team, 5, applyShopVariant(team.players[5], 'mentor') as PlayerCard);
    team = withCard(team, 12, applyShopVariant(team.players[12], 'prodigio') as PlayerCard);
    const won = applyPostMatchCardProgress(team, result(team, 2, 0), 'L1');
    for (const p of won.players) expect(p.appearances ?? 0).toBe(1);
    expect(won.players[12].prodigioStarts ?? 0).toBe(0); // only evolution, not a Prodígio start
    const retried = applyPostMatchCardProgress(won, result(won, 2, 0), 'L1');
    expect(retried.players.every(p => (p.appearances ?? 0) === 1)).toBe(true);
    const lost = applyPostMatchCardProgress(won, result(won, 0, 1), 'L2');
    expect(lost.players.every(p => (p.appearances ?? 0) === 1)).toBe(true);
  });

  it('four Mentor wins take a reserve to evolution level 1', () => {
    const base = plainTeam();
    let team = withCard(base, 4, applyShopVariant(base.players[4], 'mentor') as PlayerCard);
    for (let round = 1; round <= 4; round++) team = applyPostMatchCardProgress(team, result(team, 1, 0), `L${round}`);
    const reserve = team.players[13];
    if (reserve.rarity !== 'unique') expect(getEvolutionLevel(reserve)).toBe(1);
  });

  it('does nothing when the Mentor is on the bench', () => {
    const base = plainTeam();
    const team = withCard(base, 12, applyShopVariant(base.players[12], 'mentor') as PlayerCard);
    const after = applyPostMatchCardProgress(team, result(team, 3, 0), 'L1');
    expect(after.players.every(p => (p.appearances ?? 0) === 0)).toBe(true);
  });
});
