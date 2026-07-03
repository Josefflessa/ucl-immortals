// Deterministic UNIT tests for the engine's pure logic — complements the statistical
// balance.test.ts (which measures emergent behaviour). These pin the RULES exactly, with no
// randomness (or with Math.random mocked), so they never flake.
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getChemistryBonus, getChemistryLinks, computeCharacteristicBoosts, getEffectiveAttribute,
  resolveOpenPlayChance, shotTypeForApproach, GK_SAVE_EDGE, ON_TARGET_RESISTANCE,
  getPenaltyTaker, getPenaltyOrder, computeStandings, generateLeagueFixtures, buildKeyMinutes,
  generateBotTeam, applyShopVariant, calculateTeamStrength, getChemistryBonus as chemOf,
  PIPOQUEIRO_LEAGUE_BOOST, PIPOQUEIRO_KO_PENALTY, hasVariant, stripVariant,
  calculateChemistry, NOE_STAT_BOOST, NOE_CHEM_BONUS, FORASTEIRO_STAT_BOOST,
  type Team, type PlayerCard, type MatchResult, type LeagueFixture,
} from './gameEngine';
import { PLAYERS, COACHES, FORMATIONS, type Player } from './gameData';
import { computeMatchPoints } from './shop';
import { ALL_CRESTS, CRESTS_BY_ID, BOT_CREST_MAP, getCrest } from './crests';

afterEach(() => vi.restoreAllMocks());

// ── factories ────────────────────────────────────────────────────────────────
let uid = 0;
function mkP(over: Partial<Player> = {}): Player {
  uid++;
  return {
    id: `p${uid}`, shortName: `P${uid}`, fullName: `Player ${uid}`, position: 'CM',
    nation: 'Testland', club: 'Test FC', season: '2024', rarity: 'gold', overall: 80,
    pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physical: 70,
    composure: 70, vision: 70, traits: [], ...over,
  };
}
const card = (p: Player, over: Partial<PlayerCard> = {}): PlayerCard => ({ ...p, chemistryScore: 0, isOOP: false, ...over });
function mkTeam(id: string, players: Player[], over: Partial<Team> = {}): Team {
  return {
    id, name: id, coachId: COACHES[0].id, formationId: '4-3-3', playStyle: 'balanced',
    players: players.map(p => card(p)), totalChemistry: 0, isBot: false, ...over,
  };
}
const result = (homeId: string, awayId: string, hg: number, ag: number): MatchResult => ({
  homeTeamId: homeId, awayTeamId: awayId, homeGoals: hg, awayGoals: ag, events: [],
  winner: hg > ag ? homeId : ag > hg ? awayId : null, stats: {} as MatchResult['stats'],
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('getChemistryBonus — milestone tiers', () => {
  it('returns the exact buff at each chemistry milestone', () => {
    expect(getChemistryBonus(0)).toEqual({ passing: 0, pace: 0, special: 0 });
    expect(getChemistryBonus(44)).toEqual({ passing: 0, pace: 0, special: 0 });
    expect(getChemistryBonus(45)).toEqual({ passing: 1, pace: 0, special: 1 });
    expect(getChemistryBonus(60)).toEqual({ passing: 1, pace: 1, special: 2 });
    expect(getChemistryBonus(75)).toEqual({ passing: 2, pace: 1, special: 3 });
    expect(getChemistryBonus(90)).toEqual({ passing: 3, pace: 2, special: 5 });
    expect(getChemistryBonus(100).special).toBe(5);
  });
  it('is monotonic non-decreasing in the special buff', () => {
    let prev = -1;
    for (let t = 0; t <= 100; t++) { const s = getChemistryBonus(t).special; expect(s).toBeGreaterThanOrEqual(prev); prev = s; }
  });
});

describe('getChemistryLinks — link typing & priority', () => {
  it('same club → club link; same nation (diff club) → nation link', () => {
    const a = mkP({ id: 'a', club: 'X', nation: 'BR' });
    const b = mkP({ id: 'b', club: 'X', nation: 'AR' });
    const c = mkP({ id: 'c', club: 'Y', nation: 'BR' });
    const links = getChemistryLinks([a, b, c], COACHES[0].id);
    expect(links.find(l => l.aIndex === 0 && l.bIndex === 1)?.type).toBe('club');
    expect(links.find(l => l.aIndex === 0 && l.bIndex === 2)?.type).toBe('nation');
  });
  it('historical partner forms a partner link when nothing stronger applies', () => {
    const a = mkP({ id: 'a', club: 'X', nation: 'BR', historicalPartners: ['b'] });
    const b = mkP({ id: 'b', club: 'Y', nation: 'AR' });
    expect(getChemistryLinks([a, b], COACHES[0].id)[0]?.type).toBe('partner');
  });
  it('🌍 Nômade forms a nation link with anyone otherwise unlinked', () => {
    const a = mkP({ id: 'a', club: 'X', nation: 'BR', nomade: true });
    const b = mkP({ id: 'b', club: 'Y', nation: 'AR' });
    expect(getChemistryLinks([a, b], COACHES[0].id)[0]?.type).toBe('nation');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('computeCharacteristicBoosts — team-effect characteristics', () => {
  const xiOf = (players: Player[]) => players; // helper for readability

  it('❤️ Ídolo gives +2 to every SAME-CLUB starter (himself included)', () => {
    const idol = mkP({ id: 'idol', club: 'ACME', idolo: true });
    const mate = mkP({ id: 'mate', club: 'ACME' });
    const other = mkP({ id: 'other', club: 'OTHER' });
    const rest = Array.from({ length: 8 }, () => mkP({ club: 'OTHER' }));
    const map = computeCharacteristicBoosts(xiOf([idol, mate, other, ...rest]));
    expect(map['mate'].flatAll).toBe(2);
    expect(map['idol'].flatAll).toBe(2);   // ele incluso
    expect(map['other']?.flatAll ?? 0).toBe(0);
    expect(map['mate'].sources[0]).toMatchObject({ type: 'idolo', fromId: 'idol', flatAll: 2 });
  });

  it('🩸 Mártir gives +3 to its two chosen starters, and stacks', () => {
    const m1 = mkP({ id: 'm1', martir: true, martirTargets: ['t1', 't2'] });
    const m2 = mkP({ id: 'm2', martir: true, martirTargets: ['t1', 'x'] });
    const t1 = mkP({ id: 't1' }); const t2 = mkP({ id: 't2' }); const x = mkP({ id: 'x' });
    const rest = Array.from({ length: 6 }, () => mkP());
    const map = computeCharacteristicBoosts([m1, m2, t1, t2, x, ...rest]);
    expect(map['t1'].flatAll).toBe(6);   // boosted by BOTH mártires
    expect(map['t2'].flatAll).toBe(3);
    expect(map['t1'].sources).toHaveLength(2);
  });

  it('🩸 Mártir with no valid targets falls back to the 2 highest-overall teammates', () => {
    const m = mkP({ id: 'm', martir: true, martirTargets: [] });
    const hi1 = mkP({ id: 'hi1', overall: 95 }); const hi2 = mkP({ id: 'hi2', overall: 93 });
    const lo = mkP({ id: 'lo', overall: 60 });
    const rest = Array.from({ length: 7 }, () => mkP({ overall: 50 }));
    const map = computeCharacteristicBoosts([m, hi1, hi2, lo, ...rest]);
    expect(map['hi1'].flatAll).toBe(3);
    expect(map['hi2'].flatAll).toBe(3);
    expect(map['lo']?.flatAll ?? 0).toBe(0);
  });

  it('🪑 12º Homem on the BENCH gives +1 composure & +2 vision to the whole XI', () => {
    const xi = Array.from({ length: 11 }, (_, i) => mkP({ id: `xi${i}` }));
    const benchHelper = mkP({ id: 'bench', decimoHomem: true });
    const map = computeCharacteristicBoosts([...xi, benchHelper]);
    expect(map['xi0'].perStat).toEqual({ composure: 1, vision: 2 });
    expect(map['xi0'].flatAll).toBe(0);
    // himself (on the bench) is NOT in the XI, so gets nothing
    expect(map['bench']).toBeUndefined();
  });

  it('12º Homem in the STARTING XI has no effect (must be benched)', () => {
    const starter = mkP({ id: 's', decimoHomem: true });
    const rest = Array.from({ length: 10 }, (_, i) => mkP({ id: `r${i}` }));
    const map = computeCharacteristicBoosts([starter, ...rest]);
    expect(map['r0']?.perStat.vision ?? 0).toBe(0);
  });
});

describe('char boosts flow through getEffectiveAttribute (engine = the buff)', () => {
  it('a Mártir target reads +3 on every attribute', () => {
    const m = mkP({ id: 'm', martir: true, martirTargets: ['t'] });
    const t = mkP({ id: 't' });
    const rest = Array.from({ length: 9 }, () => mkP());
    const xi = [m, t, ...rest];
    const charBoosts = computeCharacteristicBoosts(xi);
    const noChem = getChemistryBonus(0);
    const eff = (ctx?: object) => getEffectiveAttribute(card(t), 'pace', COACHES[0], '', noChem, '__neutral__', ctx);
    expect(eff({ charBoosts }) - eff({})).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('🛟 Noé — só rende como ÚNICO titular com característica (+10 e +30 química)', () => {
  const xiOf = (extra: Player[]) => [...extra, ...Array.from({ length: 11 - extra.length }, () => mkP())];

  it('+10 em tudo quando é o único carimbado do XI', () => {
    const noe = mkP({ id: 'noe', noe: true });
    const boosts = computeCharacteristicBoosts(xiOf([noe]));
    expect(boosts['noe']?.flatAll).toBe(NOE_STAT_BOOST);
  });

  it('desliga se QUALQUER outro titular tem característica', () => {
    const noe = mkP({ id: 'noe', noe: true });
    const other = mkP({ id: 'p', pilar: true });
    const boosts = computeCharacteristicBoosts(xiOf([noe, other]));
    expect(boosts['noe']?.flatAll ?? 0).toBe(0);
  });

  it('dois Noés se cancelam (nenhum é "o único")', () => {
    const a = mkP({ id: 'a', noe: true }), b = mkP({ id: 'b', noe: true });
    const boosts = computeCharacteristicBoosts(xiOf([a, b]));
    expect(boosts['a']?.flatAll ?? 0).toBe(0);
    expect(boosts['b']?.flatAll ?? 0).toBe(0);
  });

  it('+30 na química geral quando ativo (e nada quando desligado)', () => {
    // XI com nação/clube DISTINTOS → química base baixa, pra o +30 não estourar o teto (100).
    const plainXI = Array.from({ length: 11 }, (_, i) => mkP({ id: `n${i}`, nation: `Nat${i}`, club: `Club${i}` }));
    const noeXI = plainXI.map(p => p.id === 'n0' ? { ...p, noe: true } : p);
    const base = calculateChemistry(plainXI, 'default').total;
    const withNoe = calculateChemistry(noeXI, 'default').total;
    expect(withNoe - base).toBe(NOE_CHEM_BONUS);
    // com outro carimbado no XI, o +30 não vale
    const noeXIblocked = noeXI.map(p => p.id === 'n1' ? { ...p, pilar: true } : p);
    const blocked = calculateChemistry(noeXIblocked, 'default').total;
    expect(blocked - base).toBeLessThan(NOE_CHEM_BONUS);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('🧳 Forasteiro — +5 como único do país E do clube', () => {
  const filler = () => mkP({ nation: 'Fillerland', club: 'Filler FC' }); // todos iguais entre si

  it('+5 quando ninguém compartilha nação nem clube', () => {
    const f = mkP({ id: 'f', forasteiro: true, nation: 'Solônia', club: 'Solo FC' });
    const xi = [f, ...Array.from({ length: 10 }, filler)];
    // fillers compartilham nação/clube entre si, mas não com o Forasteiro
    const boosts = computeCharacteristicBoosts(xi);
    expect(boosts['f']?.flatAll).toBe(FORASTEIRO_STAT_BOOST);
  });

  it('desliga se compartilha o CLUBE com um titular', () => {
    const f = mkP({ id: 'f', forasteiro: true, nation: 'Solônia', club: 'Shared FC' });
    const mate = mkP({ nation: 'Outra', club: 'Shared FC' });
    const xi = [f, mate, ...Array.from({ length: 9 }, filler)];
    const boosts = computeCharacteristicBoosts(xi);
    expect(boosts['f']?.flatAll ?? 0).toBe(0);
  });

  it('desliga se compartilha a NAÇÃO com um titular', () => {
    const f = mkP({ id: 'f', forasteiro: true, nation: 'Shared', club: 'Solo FC' });
    const mate = mkP({ nation: 'Shared', club: 'Outro FC' });
    const xi = [f, mate, ...Array.from({ length: 9 }, filler)];
    const boosts = computeCharacteristicBoosts(xi);
    expect(boosts['f']?.flatAll ?? 0).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('🍿 Pipoqueiro — +4 na liga, −5 no mata-mata (o anti-Pilar)', () => {
  const noChem = getChemistryBonus(0);
  const eff = (p: Player, ctx?: object) =>
    getEffectiveAttribute(card(p), 'pace', COACHES[0], '', noChem, '__neutral__', ctx);

  it('ganha PIPOQUEIRO_LEAGUE_BOOST na fase de liga', () => {
    const plain = mkP({ id: 'a' });
    const pipo = mkP({ id: 'b', pipoqueiro: true });
    expect(eff(pipo, { isKnockout: false }) - eff(plain, { isKnockout: false })).toBe(PIPOQUEIRO_LEAGUE_BOOST);
  });

  it('perde PIPOQUEIRO_KO_PENALTY no mata-mata', () => {
    const plain = mkP({ id: 'a' });
    const pipo = mkP({ id: 'b', pipoqueiro: true });
    expect(eff(pipo, { isKnockout: true }) - eff(plain, { isKnockout: true })).toBe(-PIPOQUEIRO_KO_PENALTY);
  });

  it('sem contexto (default) trata como fase de liga', () => {
    const plain = mkP({ id: 'a' });
    const pipo = mkP({ id: 'b', pipoqueiro: true });
    expect(eff(pipo) - eff(plain)).toBe(PIPOQUEIRO_LEAGUE_BOOST);
  });

  it('applyShopVariant("pipoqueiro") marca a flag sem mexer no stat base', () => {
    const base = mkP({ id: 'c', pace: 70 });
    const turbo = applyShopVariant(base, 'pipoqueiro');
    expect(turbo.pipoqueiro).toBe(true);
    expect(turbo.pace).toBe(70); // efeito é runtime, não assado no base
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('🧹 Remover característica (hasVariant / stripVariant)', () => {
  it('hasVariant detecta qualquer característica, inclusive Pipoqueiro', () => {
    expect(hasVariant(mkP())).toBe(false);
    expect(hasVariant(mkP({ pilar: true }))).toBe(true);
    expect(hasVariant(mkP({ pipoqueiro: true }))).toBe(true);
    expect(hasVariant(mkP({ inForm: true }))).toBe(true);
  });

  it('reverte o boost assado do Em Alta e limpa a flag', () => {
    const boosted = applyShopVariant(mkP({ id: 'a', pace: 70, overall: 80 }), 'inForm');
    expect(boosted.pace).toBeGreaterThan(70);
    const clean = stripVariant(boosted);
    expect(clean.inForm).toBeFalsy();
    expect(clean.baseOverall).toBeUndefined();
    expect(clean.pace).toBe(70);
    expect(clean.overall).toBe(80);
    expect(hasVariant(clean)).toBe(false);
  });

  it('reverte a penalidade do Mártir e limpa flag + alvos', () => {
    const m = applyShopVariant(mkP({ id: 'b', pace: 70, overall: 80, martirTargets: ['x', 'y'] }), 'martir');
    expect(m.pace).toBeLessThan(70);
    const clean = stripVariant(m);
    expect(clean.martir).toBeFalsy();
    expect(clean.martirTargets).toBeUndefined();
    expect(clean.pace).toBe(70);
    expect(clean.overall).toBe(80);
  });

  it('característica só-flag (Pilar) some sem alterar stats', () => {
    const clean = stripVariant(mkP({ id: 'c', pace: 70, pilar: true }));
    expect(clean.pilar).toBeFalsy();
    expect(clean.pace).toBe(70);
    expect(hasVariant(clean)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('resolveOpenPlayChance — the shot duel (RNG mocked)', () => {
  const base = { atkShooting: 80, atkPace: 80, atkDribbling: 80, defDefending: 40, defPhysical: 40, buildUp: 0, gkRating: 40, approach: 'normal' };
  const withRandoms = (seq: number[]) => { const s = vi.spyOn(Math, 'random'); seq.forEach(v => s.mockReturnValueOnce(v)); };

  it('defence wins the duel → no shot', () => {
    withRandoms([0, 1]); // atk rng low, def rng high
    expect(resolveOpenPlayChance({ ...base, atkShooting: 30, atkPace: 30, atkDribbling: 30, defDefending: 95, defPhysical: 95 }).outcome).toBe('duel');
  });
  it('beats the defender but misses the target', () => {
    withRandoms([1, 0, 0.999]); // atk high, def low, then target roll fails
    const r = resolveOpenPlayChance(base);
    expect(r.outcome).toBe('miss'); expect(r.onTarget).toBe(false);
  });
  it('on target and beats the keeper → goal', () => {
    withRandoms([1, 0, 0, 0, 1]); // atk high, def low, target ok, gk low, shot high
    const r = resolveOpenPlayChance(base);
    expect(r.outcome).toBe('goal'); expect(r.onTarget).toBe(true);
  });
  it('on target but the keeper wins → save', () => {
    withRandoms([1, 0, 0, 1, 0]); // gk high, shot low
    expect(resolveOpenPlayChance({ ...base, atkShooting: 50 }).outcome).toBe('save');
  });
  it('exposes its tuning knobs', () => {
    expect(GK_SAVE_EDGE).toBeGreaterThan(0);
    expect(ON_TARGET_RESISTANCE).toBeGreaterThan(0);
  });
});

describe('shotTypeForApproach', () => {
  it('maps every approach to a shot type', () => {
    for (const a of ['cross', 'through', 'long', 'build', 'balanced', 'anything']) {
      expect(typeof shotTypeForApproach(a)).toBe('string');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('penalty takers — never the goalkeeper', () => {
  const gk = mkP({ id: 'gk', position: 'GK', composure: 99, shooting: 99 });
  const striker = mkP({ id: 'st', position: 'ST', composure: 90, shooting: 90 });
  const mid = mkP({ id: 'mid', position: 'CM', composure: 70, shooting: 70 });
  const team = mkTeam('T', [gk, striker, mid, ...Array.from({ length: 8 }, () => mkP())]);

  it('picks the best outfielder by composure+shooting, never the keeper', () => {
    expect(getPenaltyTaker(team).id).toBe('st');
    expect(getPenaltyTaker(team).position).not.toBe('GK');
  });
  it('respects a valid designated taker', () => {
    expect(getPenaltyTaker({ ...team, penaltyTaker: 'mid' }).id).toBe('mid');
  });
  it('ignores a designated taker that points at the keeper', () => {
    expect(getPenaltyTaker({ ...team, penaltyTaker: 'gk' }).position).not.toBe('GK');
  });
  it('shootout order puts the keeper dead last', () => {
    const order = getPenaltyOrder(team);
    expect(order[order.length - 1].position).toBe('GK');
    expect(order[0].id).toBe('st');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('computeMatchPoints — shop economy math', () => {
  it('rewards a win with base + goal-diff + goals + clean sheet', () => {
    const p = computeMatchPoints(result('me', 'you', 3, 0), 'me');
    expect(p.outcome).toBe('win');
    expect(p.cleanSheet).toBe(true);
    expect(p.total).toBe(p.base + p.gdBonus + p.goalsBonus + p.csBonus);
    expect(p.goalsFor).toBe(3); expect(p.goalsAgainst).toBe(0);
  });
  it('a loss still pays the loss base and no GD bonus', () => {
    const p = computeMatchPoints(result('me', 'you', 0, 2), 'me');
    expect(p.outcome).toBe('loss'); expect(p.gdBonus).toBe(0); expect(p.total).toBeGreaterThan(0);
  });
  it('reads the score from the player’s own perspective (away side)', () => {
    const p = computeMatchPoints(result('you', 'me', 1, 4), 'me');
    expect(p.goalsFor).toBe(4); expect(p.outcome).toBe('win');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('computeStandings — table integrity', () => {
  it('assigns 3/1/0, tallies goals, and sorts the leader on top', () => {
    const A = mkTeam('A', Array.from({ length: 11 }, () => mkP()));
    const B = mkTeam('B', Array.from({ length: 11 }, () => mkP()));
    const fixtures: LeagueFixture[] = [
      { round: 1, homeTeamId: 'A', awayTeamId: 'B', played: true, result: result('A', 'B', 2, 0) },
      { round: 2, homeTeamId: 'B', awayTeamId: 'A', played: true, result: result('B', 'A', 1, 1) },
    ];
    const table = computeStandings([A, B], fixtures);
    const a = table.find(t => t.teamId === 'A')!; const b = table.find(t => t.teamId === 'B')!;
    expect(a.points).toBe(4); expect(a.won).toBe(1); expect(a.drawn).toBe(1);
    expect(b.points).toBe(1); expect(b.goalsFor).toBe(1); expect(b.goalsAgainst).toBe(3);
    expect(table[0].teamId).toBe('A'); // leader first
  });
  it('ignores unplayed fixtures', () => {
    const A = mkTeam('A', [mkP()]); const B = mkTeam('B', [mkP()]);
    const table = computeStandings([A, B], [{ round: 1, homeTeamId: 'A', awayTeamId: 'B', played: false }]);
    expect(table.every(t => t.played === 0)).toBe(true);
  });
});

describe('generateLeagueFixtures', () => {
  it('never schedules a team against itself and pairs every team', () => {
    const teams = Array.from({ length: 6 }, (_, i) => mkTeam(`T${i}`, [mkP()]));
    const fx = generateLeagueFixtures(teams);
    expect(fx.length).toBeGreaterThan(0);
    expect(fx.every(f => f.homeTeamId !== f.awayTeamId)).toBe(true);
    expect(fx.every(f => teams.some(t => t.id === f.homeTeamId) && teams.some(t => t.id === f.awayTeamId))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('buildKeyMinutes — chance frequency', () => {
  it('league: ~13 clear chances, spaced ≥3′, all within 90′', () => {
    const m = buildKeyMinutes(false);
    expect(m.length).toBeGreaterThanOrEqual(11);
    expect(m.length).toBeLessThanOrEqual(13);
    expect(Math.max(...m)).toBeLessThanOrEqual(90);
    for (let i = 1; i < m.length; i++) expect(m[i] - m[i - 1]).toBeGreaterThanOrEqual(3);
  });
  it('knockout allows more chances and extends to 120′', () => {
    const ko = buildKeyMinutes(true);
    expect(ko.length).toBeGreaterThanOrEqual(14);
    expect(Math.max(...ko)).toBeLessThanOrEqual(120);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('crest catalogue integrity', () => {
  it('every crest id is unique', () => {
    const ids = ALL_CRESTS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('every bot-name mapping points at a real crest', () => {
    for (const id of Object.values(BOT_CREST_MAP)) expect(CRESTS_BY_ID[id], id).toBeDefined();
  });
  it('getCrest resolves known ids and is null for the rest', () => {
    expect(getCrest(ALL_CRESTS[0].id)?.id).toBe(ALL_CRESTS[0].id);
    expect(getCrest('does-not-exist')).toBeNull();
    expect(getCrest(null)).toBeNull();
  });
});

describe('generateBotTeam', () => {
  it('fields a full valid XI and maps the crest from the bot name', () => {
    const t = generateBotTeam('Real Madrid', 0.7);
    expect(t.players.length).toBeGreaterThanOrEqual(11);
    expect(t.players.every(p => p && p.overall > 0)).toBe(true);
    expect(t.isBot).toBe(true);
    expect(t.crestId).toBe(BOT_CREST_MAP['Real Madrid']);
    expect(calculateTeamStrength(t, COACHES[0], getChemistryBonus(t.totalChemistry), 0)).toBeGreaterThan(0);
  });
  it('a bot name with no mapping simply has no crest', () => {
    expect(generateBotTeam('Zzz Unknown FC', 0.5).crestId).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
describe('applyShopVariant — variant stat math (no pool mutation)', () => {
  const src = PLAYERS.find(p => p.position !== 'GK' && p.overall < 90)!;

  it('🩸 Mártir subtracts 6 from every attribute and records baseOverall', () => {
    const before = { ...src };
    const v = applyShopVariant(src, 'martir');
    expect(v.martir).toBe(true);
    expect(v.overall).toBe(src.overall - 6);
    expect(v.pace).toBe(src.pace - 6);
    expect(v.baseOverall).toBe(src.overall);
    expect(src).toEqual(before); // original untouched
  });
  it('🐺 Lobo adds a flat boost to every attribute', () => {
    const v = applyShopVariant(src, 'lobo');
    const delta = v.overall - src.overall;
    expect(delta).toBeGreaterThan(0);
    expect(v.pace - src.pace).toBe(delta);
    expect(v.lobo).toBe(true);
  });
  it('flag-only variants (idolo / decimoHomem / coringa) leave stats untouched', () => {
    for (const key of ['idolo', 'decimoHomem', 'coringa'] as const) {
      const v = applyShopVariant(src, key);
      expect((v as Record<string, unknown>)[key]).toBe(true);
      expect(v.overall).toBe(src.overall);
      expect(v.pace).toBe(src.pace);
    }
  });
});
