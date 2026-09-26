import { describe, it, expect, vi } from 'vitest';
import { PLAYERS, COACHES, Player } from './gameData';
import {
  calculateChemistry, getEffectiveAttribute, getPlayerEffectiveStats, getChemistryBonus,
  calculateTeamStrength, simulateMatch, generateBotTeam, generateDraftOptions,
  statKey, getPlayerSeasonStats, PREFERRED_FORMATION_CHEM_BONUS,
  PlayerCard, MatchResult, applyDefeatGrowth, teamLostMatch, RESILIENTE_DEFEAT_BOOST,
  generateScoutOptions, SCOUT_MIN_OVERALL,
  formationCounterBonusForAnalysisLevel, formationAdvantageLabelForAnalysisLevel,
  tacticBuffMultiplierForAnalysisLevel, tacticStatBonus,
} from './gameEngine';

const asCard = (p: Player, over: Partial<PlayerCard> = {}): PlayerCard =>
  ({ ...p, chemistryScore: 0, isOOP: false, ...over });

const outfield = PLAYERS.find(p => p.position !== 'GK')!;
const coach = COACHES[0];
const noChem = { passing: 0, pace: 0, special: false };

describe('formation matchup analysis bonus', () => {
  it('uses the calibrated +3, +5 and +7 progression', () => {
    expect(formationCounterBonusForAnalysisLevel(1)).toBe(3);
    expect(formationCounterBonusForAnalysisLevel(2)).toBe(3);
    expect(formationCounterBonusForAnalysisLevel(3)).toBe(5);
    expect(formationCounterBonusForAnalysisLevel(4)).toBe(5);
    expect(formationCounterBonusForAnalysisLevel(5)).toBe(7);
    expect(formationCounterBonusForAnalysisLevel(Number.NaN)).toBe(3);
    expect(formationAdvantageLabelForAnalysisLevel(1)).toBe('Vantagem leve');
    expect(formationAdvantageLabelForAnalysisLevel(3)).toBe('Vantagem clara');
    expect(formationAdvantageLabelForAnalysisLevel(5)).toBe('Vantagem forte');
  });

  it('amplifies each existing tactic buff by 50% at levels 2 and 4', () => {
    expect(tacticBuffMultiplierForAnalysisLevel(1)).toBe(1);
    expect(tacticBuffMultiplierForAnalysisLevel(2)).toBe(1.5);
    expect(tacticBuffMultiplierForAnalysisLevel(4)).toBe(2);
    expect(tacticStatBonus('balanced', 'pace', 1)).toBe(2);
    expect(tacticStatBonus('balanced', 'pace', 2)).toBe(3);
    expect(tacticStatBonus('balanced', 'pace', 4)).toBe(4);
    expect(tacticStatBonus('possession', 'passing', 2)).toBe(8);
    expect(tacticStatBonus('possession', 'passing', 4)).toBe(10);
  });
});

describe('scout pack filters', () => {
  it('returns only unowned players with the requested primary position and minimum overall', () => {
    const options = generateScoutOptions('RM', []);

    expect(options).toHaveLength(4);
    expect(options.every(player =>
      player.position === 'RM'
      && player.overall >= SCOUT_MIN_OVERALL,
    )).toBe(true);
  });

  it('does not replace the strict filter with secondary-position players', () => {
    const ownedRightMids = PLAYERS.filter(player => player.position === 'RM').map(player => player.id);
    const options = generateScoutOptions('RM', ownedRightMids);

    expect(options).toHaveLength(0);
  });
});

describe('coach preferred-formation chemistry bonus', () => {
  it('adds the bonus to total chemistry only on the coach preferred formation', () => {
    const c = COACHES.find(co => !!co.preferredFormation)!;
    const players = PLAYERS.slice(0, 11);
    const roles = players.map(p => p.position);
    const off = calculateChemistry(players, c.id, roles, c.preferredFormation === '4-4-2' ? '4-3-3' : '4-4-2');
    const on = calculateChemistry(players, c.id, roles, c.preferredFormation);
    expect(on.total).toBe(off.total + PREFERRED_FORMATION_CHEM_BONUS);
    // No formation id passed → no bonus (backwards compatible).
    const none = calculateChemistry(players, c.id, roles);
    expect(none.total).toBe(off.total);
  });
});

describe('getEffectiveAttribute', () => {
  it('applies a trait bonus to the matching attribute (isolated)', () => {
    const without = asCard(outfield, { traits: [] });
    const withTrait = asCard(outfield, { traits: ['Finalizador'] }); // +6 shooting
    const a = getEffectiveAttribute(without, 'shooting', coach, '', noChem, 'balanced');
    const b = getEffectiveAttribute(withTrait, 'shooting', coach, '', noChem, 'balanced');
    expect(b - a).toBe(6);
  });

  it('applies the play-style bonus (vs a neutral baseline)', () => {
    const card = asCard(outfield, { traits: [] });
    // Neutral baseline (no tactic) — an unknown play-style hits the default (zero) branch.
    const neutral = getEffectiveAttribute(card, 'defending', coach, '', noChem, '__neutral__');
    const defensive = getEffectiveAttribute(card, 'defending', coach, '', noChem, 'defensive');
    const balanced = getEffectiveAttribute(card, 'defending', coach, '', noChem, 'balanced');
    expect(defensive - neutral).toBe(8);  // the defensive tactic adds +8 defending
    expect(balanced - neutral).toBe(2);   // balanced is a real choice now: +2 to every core stat
  });

  it('applies conditional traits only with the right context', () => {
    const card = asCard(outfield, { traits: ['Frio na Final'] }); // +8 shooting only in the final
    const normal = getEffectiveAttribute(card, 'shooting', coach, '', noChem, 'balanced');
    const final = getEffectiveAttribute(card, 'shooting', coach, '', noChem, 'balanced', { isFinal: true });
    expect(final - normal).toBe(8);
  });

  it('uses the real formation role for positional coach bonuses', () => {
    const player = asCard({ ...outfield, position: 'CM', vision: 70, passing: 70, traits: [] });
    const forward = getEffectiveAttribute(player, 'passing', coach, '', noChem, '__neutral__', { role: 'ST' });
    const midfielder = getEffectiveAttribute(player, 'passing', coach, '', noChem, '__neutral__', { role: 'CM' });
    expect(midfielder - forward).toBe(5); // DNA Guardiola: +5 Passe nos meio-campistas
  });
});

describe('Técnico Prime', () => {
  const noChemistry = { passing: 0, pace: 0, special: 0 };
  const effective = (
    coachId: string,
    player: Player,
    attribute: keyof Player,
    context: Record<string, unknown> = {},
  ) => {
    const selectedCoach = COACHES.find(candidate => candidate.id === coachId)!;
    return getEffectiveAttribute(
      asCard(player),
      attribute,
      selectedCoach,
      '',
      noChemistry,
      '__neutral__',
      context,
    );
  };

  it('aumenta a assinatura específica de cada técnico, sem alterar outras regras', () => {
    const visionPlayer = { ...outfield, vision: 80, traits: [] };
    expect(effective('guardiola', visionPlayer, 'pace', { coachPrime: true }) - effective('guardiola', visionPlayer, 'pace')).toBe(4);

    const losingPlayer = { ...outfield, traits: [] };
    expect(effective('klopp', losingPlayer, 'pace', { isLosing: true, coachPrime: true }) - effective('klopp', losingPlayer, 'pace', { isLosing: true })).toBe(6);
    expect(effective('ferguson', losingPlayer, 'pace', { isLosing: true, coachPrime: true }) - effective('ferguson', losingPlayer, 'pace', { isLosing: true })).toBe(6);

    const defender = { ...outfield, position: 'CB', traits: [] };
    expect(effective('mourinho', defender, 'defending', { isKnockout: true, role: 'CB', coachPrime: true }) - effective('mourinho', defender, 'defending', { isKnockout: true, role: 'CB' })).toBe(6);
    expect(effective('ancelotti', losingPlayer, 'pace', { isFinal: true, coachPrime: true }) - effective('ancelotti', losingPlayer, 'pace', { isFinal: true })).toBe(6);

    const legend = { ...outfield, rarity: 'legendary' as const, traits: [] };
    expect(effective('zidane', legend, 'pace', { isKnockout: true, coachPrime: true }) - effective('zidane', legend, 'pace', { isKnockout: true })).toBe(4);
  });

  it('preserva os dois bônus posicionais do Luis Enrique e melhora ambos no Prime', () => {
    const midfielder = { ...outfield, position: 'CM', traits: [] };
    const attacker = { ...outfield, position: 'ST', traits: [] };
    expect(effective('luis_enrique', midfielder, 'vision', { role: 'CM', coachPrime: true }) - effective('luis_enrique', midfielder, 'vision', { role: 'CM' })).toBe(4);
    expect(effective('luis_enrique', attacker, 'pace', { role: 'ST', coachPrime: true }) - effective('luis_enrique', attacker, 'pace', { role: 'ST' })).toBe(4);
  });
});

describe('Resiliente', () => {
  const result = (over: Partial<MatchResult> = {}): MatchResult => ({
    homeTeamId: 'team',
    awayTeamId: 'opponent',
    homeGoals: 0,
    awayGoals: 1,
    events: [],
    winner: 'opponent',
    stats: {
      homePos: 50, awayPos: 50, homeShots: 0, awayShots: 0,
      homeShotsOnTarget: 0, awayShotsOnTarget: 0, homeFouls: 0,
      awayFouls: 0, homeSaves: 0, awaySaves: 0, homeCorners: 0, awayCorners: 0,
    },
    ...over,
  });

  it('acumula +2 em todos os atributos após cada derrota, mas só para titulares', () => {
    const team = generateBotTeam('Resiliente', 0.8);
    expect(team.players.length).toBeGreaterThan(11);
    const tracked = {
      ...team,
      players: team.players.map((player, index) =>
        index === 0 || index === 11
          ? { ...player, resiliente: true, resilienteDefeats: 0 }
          : player
      ),
    };
    const afterLoss = applyDefeatGrowth(tracked, result({ homeTeamId: tracked.id }));
    expect(afterLoss.players[0].resilienteDefeats).toBe(1);
    expect(afterLoss.players[11].resilienteDefeats).toBe(0);

    const plain = asCard({ ...outfield, traits: [] });
    const grown = asCard({ ...outfield, traits: [], resiliente: true, resilienteDefeats: 3 });
    const base = getEffectiveAttribute(plain, 'pace', coach, '', noChem, '__neutral__');
    const effective = getEffectiveAttribute(grown, 'pace', coach, '', noChem, '__neutral__');
    expect(effective - base).toBe(RESILIENTE_DEFEAT_BOOST * 3);
    expect(getPlayerEffectiveStats(grown, 0, false, coach.id, 0, '__neutral__').breakdown.pace.resiliente)
      .toBe(RESILIENTE_DEFEAT_BOOST * 3);
  });

  it('não cresce em vitória/empate e reconhece derrota nos pênaltis', () => {
    const team = generateBotTeam('Resiliente', 0.8);
    const tracked = { ...team, players: team.players.map(player => ({ ...player, resiliente: true, resilienteDefeats: 2 })) };
    expect(applyDefeatGrowth(tracked, result({ homeTeamId: tracked.id, homeGoals: 2, awayGoals: 0, winner: tracked.id }))).toBe(tracked);
    expect(applyDefeatGrowth(tracked, result({ homeTeamId: tracked.id, homeGoals: 1, awayGoals: 1, winner: null }))).toBe(tracked);
    const penaltyLoss = result({ homeTeamId: tracked.id, homeGoals: 1, awayGoals: 1, winner: 'opponent', penaltyWinner: 'opponent' });
    expect(teamLostMatch(penaltyLoss, tracked.id)).toBe(true);
    expect(applyDefeatGrowth(tracked, penaltyLoss).players[0].resilienteDefeats).toBe(3);
    expect(applyDefeatGrowth(tracked, penaltyLoss).players[11].resilienteDefeats).toBe(2);
  });
});

describe('getPlayerEffectiveStats mirrors the engine (display = simulation)', () => {
  it('matches getEffectiveAttribute for every shown attribute', () => {
    // Traits are now rolled at draft time (no fixed traits in the pool), so assign a
    // representative trait set here to exercise the trait path in both functions.
    const base = PLAYERS.find(p => p.position !== 'GK')!;
    const player: Player = { ...base, traits: ['Finalizador', 'Velocista', 'Frio na Final'] };
    const total = 90;                       // high team chem → exercises global chem bonus
    const chem = getChemistryBonus(total);  // { passing: 3, pace: 2 }
    const playStyle = 'counter';
    const chemScore = 2;

    const eff = getPlayerEffectiveStats(player, chemScore, false, coach.id, total, playStyle);
    const card = asCard(player, { chemistryScore: chemScore });

    (['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'] as const).forEach(attr => {
      expect(eff[attr]).toBe(getEffectiveAttribute(card, attr, coach, '', chem, playStyle));
    });
  });

  it('does not exempt a legacy Versatilidade string from position penalties', () => {
    const plain = PLAYERS.find(p => p.position !== 'GK' && p.traits.length === 0)
      ?? { ...outfield, traits: [] };
    const legacy: Player = { ...plain, traits: ['Versatilidade'] };
    const a = getPlayerEffectiveStats(plain, 0, false, coach.id, 0, 'balanced', { isSecondary: true });
    const b = getPlayerEffectiveStats(legacy, 0, false, coach.id, 0, 'balanced', { isSecondary: true });
    expect(b.physical).toBe(a.physical);
  });
});

describe('calculateChemistry', () => {
  it('returns a sane structure', () => {
    const starters = PLAYERS.slice(0, 11);
    const chem = calculateChemistry(starters, coach.id, starters.map(p => p.position));
    expect(chem.total).toBeGreaterThanOrEqual(0);
    expect(Object.keys(chem.individual).length).toBe(11);
  });

  it('allows additive chemistry bonuses to push the total above 100', () => {
    const starters = PLAYERS.slice(0, 11).map((player, index) => ({
      ...player,
      id: `chem-${index}`,
      club: 'Chemistry FC',
      nation: 'Chemistry Nation',
      pilar: index < 9,
    }));
    const chem = calculateChemistry(starters, coach.id, starters.map(p => p.position));
    expect(chem.total).toBeGreaterThan(100);
  });
});

describe('calculateTeamStrength', () => {
  it('is positive for a real team and 0 for an empty lineup', () => {
    const team = generateBotTeam('Teste', 0.8);
    const c = COACHES.find(x => x.id === team.coachId)!;
    const strength = calculateTeamStrength(team, c, noChem, 0);
    expect(strength).toBeGreaterThan(0);
    expect(calculateTeamStrength({ ...team, players: [] }, c, noChem, 0)).toBe(0);
  });
});

describe('simulateMatch', () => {
  it('produces a valid result', () => {
    const home = generateBotTeam('Casa', 0.8);
    const away = generateBotTeam('Fora', 0.8);
    const r = simulateMatch(home, away);
    expect(r.homeGoals).toBeGreaterThanOrEqual(0);
    expect(r.awayGoals).toBeGreaterThanOrEqual(0);
    expect([home.id, away.id, null]).toContain(r.winner);
    expect(Number.isFinite(r.stats.homePos)).toBe(true);
  });

  it('can leave a two-legged return leg level after 90 minutes', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99999);
    const home = generateBotTeam('Casa', 0.8);
    const away = generateBotTeam('Fora', 0.8);
    const r = simulateMatch(home, away, true, false, false);
    expect(r.durationMinutes).toBe(90);
    expect(r.homeGoals).toBe(r.awayGoals);
    expect(r.winner).toBeNull();
    expect(r.penaltyWinner).toBeUndefined();
  });

  it('keeps hidden box-score increments on the replay event timeline', () => {
    for (let i = 0; i < 24; i++) {
      const home = generateBotTeam(`Casa-${i}`, 0.8);
      const away = generateBotTeam(`Fora-${i}`, 0.8);
      const result = simulateMatch(home, away);
      const derived = {
        homeShots: 0, awayShots: 0,
        homeShotsOnTarget: 0, awayShotsOnTarget: 0,
        homeFouls: 0, awayFouls: 0,
        homeSaves: 0, awaySaves: 0,
        homeCorners: 0, awayCorners: 0,
      };
      const otherTeam = (teamId: string) => teamId === result.homeTeamId ? result.awayTeamId : result.homeTeamId;

      for (const event of result.events) {
        if (event.type === 'stat' && event.statDelta) {
          for (const [key, value] of Object.entries(event.statDelta) as [keyof typeof derived, number][]) {
            derived[key] += value;
          }
        } else if (event.type === 'corner') {
          if (event.teamId === result.homeTeamId) derived.homeCorners++;
          else derived.awayCorners++;
        } else if (event.type === 'goal') {
          if (event.teamId === result.homeTeamId) { derived.homeShots++; derived.homeShotsOnTarget++; }
          else { derived.awayShots++; derived.awayShotsOnTarget++; }
        } else if (event.type === 'save') {
          const attackTeamId = otherTeam(event.teamId);
          if (attackTeamId === result.homeTeamId) {
            derived.homeShots++; derived.homeShotsOnTarget++; derived.awaySaves++;
          } else {
            derived.awayShots++; derived.awayShotsOnTarget++; derived.homeSaves++;
          }
        } else if (event.type === 'miss') {
          if (event.teamId === result.homeTeamId) derived.homeShots++;
          else derived.awayShots++;
        } else if (event.type === 'foul') {
          if (event.teamId === result.homeTeamId) derived.homeFouls++;
          else derived.awayFouls++;
        }
      }

      expect(derived).toEqual({
        homeShots: result.stats.homeShots,
        awayShots: result.stats.awayShots,
        homeShotsOnTarget: result.stats.homeShotsOnTarget,
        awayShotsOnTarget: result.stats.awayShotsOnTarget,
        homeFouls: result.stats.homeFouls,
        awayFouls: result.stats.awayFouls,
        homeSaves: result.stats.homeSaves,
        awaySaves: result.stats.awaySaves,
        homeCorners: result.stats.homeCorners,
        awayCorners: result.stats.awayCorners,
      });
    }
  });
});

describe('generateDraftOptions', () => {
  it('returns the right number of options', () => {
    expect(generateDraftOptions([], []).length).toBe(6);
    expect(generateDraftOptions([], [], 8).length).toBe(8);
  });

  it('respects the recruitment overall floor without changing the default draft', () => {
    const options = generateDraftOptions([], [], 8, 88);
    expect(options.length).toBeLessThanOrEqual(8);
    expect(options.every(player => player.overall >= 88)).toBe(true);
  });

  it('never mutates the static PLAYERS pool (variant cloning is safe)', () => {
    const traitCountBefore = PLAYERS.reduce((s, p) => s + p.traits.length, 0);
    for (let i = 0; i < 300; i++) generateDraftOptions([], []);
    const traitCountAfter = PLAYERS.reduce((s, p) => s + p.traits.length, 0);
    expect(traitCountAfter).toBe(traitCountBefore);
    // No base player should ever carry a draft-only variant flag.
    expect(PLAYERS.some(p => p.inForm || p.rolledTrait)).toBe(false);
  });
});

describe('match stats are keyed per team (shared player is not conflated)', () => {
  it('a player on BOTH teams gets SEPARATE stat entries', () => {
    const home = generateBotTeam('Casa', 0.8);
    const away = generateBotTeam('Fora', 0.8);
    home.id = 'home_test';
    away.id = 'away_test';
    // Force the same legend (same id) into both starting XIs.
    const shared = asCard(PLAYERS.find(p => p.position === 'ST')!, { chemistryScore: 3 });
    home.players[10] = { ...shared };
    away.players[10] = { ...shared };

    const r = simulateMatch(home, away);
    const homeKey = statKey(home.id, shared.id);
    const awayKey = statKey(away.id, shared.id);

    expect(homeKey).not.toBe(awayKey);
    expect(r.playerStats![homeKey]).toBeDefined();
    expect(r.playerStats![awayKey]).toBeDefined();
    // Each instance is attributed to its own team — no copying across.
    expect(r.playerStats![homeKey].teamId).toBe(home.id);
    expect(r.playerStats![awayKey].teamId).toBe(away.id);

    // Season stats for the same player on each team read independently.
    const homeSeason = getPlayerSeasonStats(shared.id, home.id, [r]);
    const awaySeason = getPlayerSeasonStats(shared.id, away.id, [r]);
    expect(homeSeason.goals).toBe(r.playerStats![homeKey].goals);
    expect(awaySeason.goals).toBe(r.playerStats![awayKey].goals);
  });
});
