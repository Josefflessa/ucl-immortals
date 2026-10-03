// Captain boost, team strength and penalty shootouts.

import { Player, Coach, COACHES } from '../gameData';
import { getPenaltyComposureBonus } from '../traits';
import { Stadium } from '../stadium';
import { projectLevel, stadiumHomeBonus } from '../clubProjects';
import { random } from '../random';
import { type PlayerCard, statKey, isExcludedPlayer, type Team, matchRoleForPlayer, activeGoalkeeperForTeam, type PlayerMatchStat, type PenaltyKick } from './teamModel';
import { getChemistryBonus, computeCharacteristicBoosts } from './chemistry';
import { getEffectiveAttribute } from './attributes';
import { goalkeeperAptitudeDefending, goalkeeperShotStoppingRating, penaltyGoalChance } from './matchSim';

// The captain's single strongest attribute is amplified by CAPTAIN_BOOST for EVERY
// teammate — so naming a captain is a tactical choice (which team-wide stat do you want
// lifted?), not just "give the armband to your best card". A bot (no captain set)
// defaults to its best player's strongest stat so it isn't shortchanged.
export const CAPTAIN_BOOST = 3;
const CAPTAIN_STATS: (keyof Player)[] = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'];

// Same rule as captainBestStat, but takes the starters + captain id directly so the squad
// UI (which holds a plain Player list, not a Team) can reuse the EXACT engine logic.
export function captainBestStatFromStarters(starters: Player[], captainId?: string): keyof Player | null {
  if (starters.length === 0) return null;
  let cap = captainId ? starters.find(p => p.id === captainId) : undefined;
  if (!cap) cap = [...starters].sort((a, b) => b.overall - a.overall)[0]; // bot / unset → best player
  if (!cap) return null;
  return CAPTAIN_STATS.reduce((best, s) => ((cap![s] as number) > (cap![best] as number) ? s : best), CAPTAIN_STATS[0]);
}

// Convenience for the UI: the captain boost object (stat + amount) to feed getPlayerEffectiveStats,
// or null when there are no starters. Mirrors what the match engine builds per side.
export function captainBoostFromStarters(starters: Player[], captainId?: string): { stat: string; amount: number } | null {
  const stat = captainBestStatFromStarters(starters, captainId);
  if (!stat) return null;
  // 🗣️ Capitão Nato: se o capitão do time tem a característica, o bônus vem DOBRADO.
  let cap = captainId ? starters.find(p => p.id === captainId) : undefined;
  if (!cap) cap = [...starters].sort((a, b) => b.overall - a.overall)[0];
  return { stat: stat as string, amount: CAPTAIN_BOOST * (cap?.capitaoNato ? 2 : 1) };
}
// Mesmo bônus, a partir de um Team (usado pelo motor e pelo display).
export function captainBoostForTeam(team: Team): { stat: string; amount: number } | null {
  return captainBoostFromStarters(team.players.slice(0, 11), team.captain);
}

export function calculateTeamStrength(
  team: Team,
  coach: Coach,
  chemBonus: { passing: number; pace: number; special: number },
  formationBonus: number,
  // 🩹🟥 Disciplina in-match (opcional): jogadores expulsos SAEM da média (10 homens) e lesionados
  // entram com −injuryDebuff em cada atributo. Sem `disc`, comportamento idêntico ao original.
  disc?: { sentOff?: Set<string>; injuredDebuff?: Record<string, number>; injuryDebuff?: number },
  // Match situation. Every conditional bonus that applies in a duel (coach in the knockout/final
  // or while losing, traits, Pipoqueiro) applies to team strength too — one rule for both.
  situation?: { isKnockout?: boolean; isFinal?: boolean; isLosing?: boolean; homeStadium?: Stadium; stadiumProjectLevel?: number },
): number {
  let starters = team.players.slice(0, 11) as PlayerCard[];
  if (disc?.sentOff && disc.sentOff.size > 0) starters = starters.filter(p => !isExcludedPlayer(team, p, disc.sentOff));
  // Guard against an empty lineup (would otherwise divide by zero → NaN strength).
  if (starters.length === 0) return 0;
  // Captain leadership: +CAPTAIN_BOOST on the captain's best stat, for every teammate (🗣️ Capitão Nato dobra).
  const captainBoost = captainBoostForTeam(team) ?? undefined;
  const charBoosts = computeCharacteristicBoosts(team.players);
  const avgStrength = starters.reduce((sum, p) => {
    // Strength is built from the EFFECTIVE attributes (not raw): individual + global chemistry,
    // the coach, traits, the captain, characteristics and the match situation are all folded in
    // via getEffectiveAttribute, so a buff that helps in a duel also helps win territory. TACTIC is deliberately excluded
    // (the '__neutral__' play-style yields no tactic bonus — NOT 'balanced', which now carries its
    // own +2 buff) — tactics already shape chance volume + chance danger, so letting them tilt strength
    // too would double-count them and distort each tactic's risk/reward.
    // Team-scoped key, so identical cards in opposing teams never share an injury state.
    const injuryMarker = disc?.injuredDebuff?.[statKey(team.id, p.id)];
    const debuff = injuryMarker ? (disc?.injuryDebuff ?? 0) : 0; // lesionado joga capengando
    const role = matchRoleForPlayer(team, p);
    const v = (s: keyof Player) => getEffectiveAttribute(p, s, coach, chemBonus, '__neutral__', {
      captainBoost,
      charBoosts,
      role,
      coachPrime: team.coachPrime,
      credits: team.credits,
      isKnockout: situation?.isKnockout,
      isFinal: situation?.isFinal,
      isLosing: situation?.isLosing,
      homeStadium: situation?.homeStadium,
      stadiumProjectLevel: situation?.stadiumProjectLevel,
    }) - debuff;
    // GKs are evaluated on shot-stopping attributes (defending + physical), not the outfield
    // blend that low shooting/dribbling would distort. Outfielders use the six core stats PLUS
    // vision at half weight — playmaking is a real "control the game" signal. Composure is
    // deliberately NOT here: it's a clutch / dead-ball stat (penalties, free kicks), with no
    // open-play role, so it shouldn't tilt possession/territory.
    const gkDefending = goalkeeperAptitudeDefending(p, v('defending'), role);
    const base = role === 'GK'
      ? ((gkDefending * 1.5 + v('physical') + v('pace') * 0.5) / 3)
      : (v('pace') + v('shooting') + v('passing') + v('dribbling') + v('defending') + v('physical')
          + v('vision') * 0.5) / 6.5;
    return sum + base;
  }, 0) / starters.length;

  // formationBonus is the formation-matchup edge (team-level, not a per-player attribute), so it
  // stays added on top. Individual/global chemistry, captain and perfect-chem already live inside
  // the effective attributes above — adding them here too would double-count.
  let strength = avgStrength + formationBonus;
  
  if (team.isBot && team.botStrength !== undefined) {
    // Bot strength multiplier — buffed across the board (+0.08 base) so every tier is tougher:
    // Bronze (~0.45) → 0.83x · Prata (~0.62) → 0.92x · Ouro (~0.75) → 0.99x · Lendário (~0.88) → 1.06x · Imortal (~0.97) → 1.11x
    const multiplier = 0.58 + team.botStrength * 0.55;
    strength = strength * multiplier;
  }

  return strength;
}

// Resolves the designated penalty taker: the explicit choice if valid, otherwise
// a penalty specialist and then the best outfield player by composure+shooting.
// A goalkeeper is eligible only when the card explicitly has the penalty trait;
// this preserves the normal rule while allowing specialist keepers such as Ceni.
export function getPenaltyTaker(
  team: Team,
  excludedIds?: ReadonlySet<string>,
  playerStats?: Record<string, PlayerMatchStat>,
): PlayerCard {
  const starters = team.players.slice(0, 11);
  const available = starters.filter(p => {
    if (isExcludedPlayer(team, p, excludedIds)) return false;
    const stat = playerStats?.[p.statId ?? statKey(team.id, p.id)];
    return (stat?.redCards ?? 0) === 0;
  });
  const active = available.length > 0 ? available : starters;
  const outfield = active.filter(p => matchRoleForPlayer(team, p) !== 'GK');
  const pool = outfield.length > 0 ? outfield : active;
  const isSpecialist = (p: PlayerCard) => p.traits.includes('Cobrador de Pênaltis');
  // The designated taker must be an outfielder, unless the card explicitly
  // carries the penalty specialist trait.
  if (team.penaltyTaker) {
    const chosen = active.find(p => p.id === team.penaltyTaker);
    if (chosen && (matchRoleForPlayer(team, chosen) !== 'GK' || isSpecialist(chosen))) return chosen;
  }
  const specialist = active.find(isSpecialist);
  if (specialist) return specialist;
  return [...pool].sort((a, b) => (b.composure + b.shooting) - (a.composure + a.shooting))[0];
}

// Ordered shootout takers: the designated/specialist taker first, then the
// remaining outfield by composure+shooting. A specialist goalkeeper is included
// by the same exception used for in-match penalties; ordinary keepers stay last.
export function getPenaltyOrder(
  team: Team,
  excludedIds?: ReadonlySet<string>,
  playerStats?: Record<string, PlayerMatchStat>,
): PlayerCard[] {
  const starters = team.players.slice(0, 11);
  const available = starters.filter(p => {
    if (isExcludedPlayer(team, p, excludedIds)) return false;
    const stat = playerStats?.[p.statId ?? statKey(team.id, p.id)];
    return (stat?.redCards ?? 0) === 0;
  });
  const active = available.length > 0 ? available : starters;
  const outfield = active.filter(p => matchRoleForPlayer(team, p) !== 'GK');
  const keepers = active.filter(p => matchRoleForPlayer(team, p) === 'GK');
  const sorted = [...outfield].sort((a, b) => (b.composure + b.shooting) - (a.composure + a.shooting));
  const isSpecialist = (p: PlayerCard) => p.traits.includes('Cobrador de Pênaltis');
  const designated = team.penaltyTaker
    ? active.find(p => p.id === team.penaltyTaker && (matchRoleForPlayer(team, p) !== 'GK' || isSpecialist(p)))
    : undefined;
  const specialists = active.filter(isSpecialist).sort((a, b) => (b.composure + b.shooting) - (a.composure + a.shooting));
  const first = designated ? [designated] : specialists;
  const used = new Set(first.map(p => p.id));
  const ordered = [...first, ...sorted.filter(p => !used.has(p.id))];
  return [...ordered, ...keepers.filter(p => !used.has(p.id))];
}

// Resolves a single penalty kick: taker EFFECTIVE composure (+ frieza traits, + designated
// bonus) vs the keeper's EFFECTIVE shot-stopping (+ Reflexo Felino). Returns whether it went in.
// One side of a shootout: the same effective-attribute context the in-match penalty uses
// (coach, chemistry, captain, team characteristics, home stadium, knockout/final).
type ShootoutSide = {
  team: Team;
  coach: Coach;
  chem: { passing: number; pace: number; special: number };
  playStyle: string;
  ctx: NonNullable<Parameters<typeof getEffectiveAttribute>[5]>;
  /** The host's stadium bonus, already scaled by SHOOTOUT_HOME_SHARE (0 away / on a neutral venue). */
  homeBonus: number;
};
// Share of the stadium bonus that counts in a shootout. Nerves decide shootouts far more than the
// venue; at full share the host won ~61% of shootouts between equal teams.
export const SHOOTOUT_HOME_SHARE = 0.5;
function shootoutSide(team: Team, playStyle: string, isHome: boolean, situation: { isFinal?: boolean; neutralVenue?: boolean }): ShootoutSide {
  const homeVenue = isHome && !situation.neutralVenue;
  return {
    team,
    coach: COACHES.find(c => c.id === team.coachId)!,
    chem: getChemistryBonus(team.totalChemistry),
    playStyle,
    ctx: {
      isKnockout: true,
      isFinal: situation.isFinal,
      isLosing: false,
      coachPrime: team.coachPrime,
      captainBoost: captainBoostForTeam(team) ?? undefined,
      charBoosts: computeCharacteristicBoosts(team.players),
      credits: team.credits,
      analysisLevel: projectLevel(team.clubProjects, 'analysis'),
    },
    homeBonus: homeVenue ? stadiumHomeBonus(projectLevel(team.clubProjects, 'stadium')) * SHOOTOUT_HOME_SHARE : 0,
  };
}
function penaltyKickGoal(taker: PlayerCard, takerSide: ShootoutSide, gk: PlayerCard, gkSide: ShootoutSide): boolean {
  const comp = getEffectiveAttribute(taker, 'composure', takerSide.coach, takerSide.chem, takerSide.playStyle, { ...takerSide.ctx, role: matchRoleForPlayer(takerSide.team, taker) })
    + getPenaltyComposureBonus(taker.traits) + (taker.id === takerSide.team.penaltyTaker ? 5 : 0) + takerSide.homeBonus;
  const gkRef = goalkeeperShotStoppingRating(
    gk,
    getEffectiveAttribute(gk, 'defending', gkSide.coach, gkSide.chem, gkSide.playStyle, { ...gkSide.ctx, role: 'GK' }),
    gk.traits,
  ) + gkSide.homeBonus;
  return random() < penaltyGoalChance(comp, gkRef);
}

export function simulatePenalties(
  home: Team,
  away: Team,
  _playerStats?: Record<string, PlayerMatchStat>,
  homePlayStyle = home.playStyle ?? 'balanced',
  awayPlayStyle = away.playStyle ?? 'balanced',
  situation: { isFinal?: boolean; neutralVenue?: boolean } = {},
): {
  winner: string;
  homeScore: number;
  awayScore: number;
  kicks: PenaltyKick[];
} {
  let homeScore = 0;
  let awayScore = 0;
  const kicks: PenaltyKick[] = [];

  const homeGKInfo = activeGoalkeeperForTeam(home, undefined, _playerStats);
  const awayGKInfo = activeGoalkeeperForTeam(away, undefined, _playerStats);
  const homeGK = homeGKInfo.player;
  const awayGK = awayGKInfo.player;
  const homeTakers = getPenaltyOrder(home, undefined, _playerStats);
  const awayTakers = getPenaltyOrder(away, undefined, _playerStats);
  // Per-team context so each kick uses EFFECTIVE composure/defending, exactly like an in-match penalty.
  const homeSide = shootoutSide(home, homePlayStyle, true, situation);
  const awaySide = shootoutSide(away, awayPlayStyle, false, situation);

  // Best-of-5, kick by kick, stopping as soon as the result is mathematically
  // decided (as in a real shootout — no pointless extra kicks).
  let homeKicks = 0;
  let awayKicks = 0;
  let decided = false;
  // A team has clinched it once the other can no longer catch up with its kicks left.
  const clinched = () =>
    homeScore > awayScore + (5 - awayKicks) || awayScore > homeScore + (5 - homeKicks);

  for (let i = 0; i < 5 && !decided; i++) {
    const homeTaker = homeTakers[homeKicks % homeTakers.length];
    const homeGoal = penaltyKickGoal(homeTaker, homeSide, awayGK, awaySide);
    if (homeGoal) homeScore++;
    homeKicks++;
    kicks.push({ teamId: home.id, takerName: homeTaker.shortName, gkName: awayGK.shortName, isGoal: homeGoal });
    if (clinched()) { decided = true; break; }

    const awayTaker = awayTakers[awayKicks % awayTakers.length];
    const awayGoal = penaltyKickGoal(awayTaker, awaySide, homeGK, homeSide);
    if (awayGoal) awayScore++;
    awayKicks++;
    kicks.push({ teamId: away.id, takerName: awayTaker.shortName, gkName: homeGK.shortName, isGoal: awayGoal });
    if (clinched()) { decided = true; break; }
  }

  // Sudden death: simulate paired kicks until outcomes differ (max 10 rounds)
  if (!decided && homeScore === awayScore) {
    for (let sd = 0; sd < 10; sd++) {
      const homeTaker = homeTakers[(5 + sd) % homeTakers.length];
      const awayTaker = awayTakers[(5 + sd) % awayTakers.length];

      const homeGoalSD = penaltyKickGoal(homeTaker, homeSide, awayGK, awaySide);
      const awayGoalSD = penaltyKickGoal(awayTaker, awaySide, homeGK, homeSide);

      kicks.push({ teamId: home.id, takerName: homeTaker.shortName, gkName: awayGK.shortName, isGoal: homeGoalSD });
      kicks.push({ teamId: away.id, takerName: awayTaker.shortName, gkName: homeGK.shortName, isGoal: awayGoalSD });

      if (homeGoalSD && !awayGoalSD) return { winner: home.id, homeScore: homeScore + 1, awayScore, kicks };
      if (awayGoalSD && !homeGoalSD) return { winner: away.id, homeScore, awayScore: awayScore + 1, kicks };
      // Both scored or both missed → next round
      if (homeGoalSD) homeScore++;
      if (awayGoalSD) awayScore++;
    }
    // Safety fallback (extremely rare all-10-rounds tie)
    const homeWins = homeScore >= awayScore;
    return homeWins
      ? { winner: home.id, homeScore: homeScore + 1, awayScore, kicks }
      : { winner: away.id, homeScore, awayScore: awayScore + 1, kicks };
  }

  return { winner: homeScore > awayScore ? home.id : away.id, homeScore, awayScore, kicks };
}
