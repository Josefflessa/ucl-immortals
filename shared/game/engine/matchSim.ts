// The minute-by-minute match simulation.

import { Player, Coach, COACHES, FORMATIONS, getTacticById } from '../gameData';
import { selectApproach, buildUpDesc, goalDesc, ownGoalDesc, saveDesc, missDesc, duelDesc, frangoDesc, screamedDesc, deflectedDesc, woodworkDesc, penaltyGoalDesc, penaltySaveDesc, penaltyMissDesc, freeKickGoalDesc, freeKickSaveDesc, freeKickMissDesc, cornerGoalDesc, cornerSaveDesc, cornerMissDesc, flowDesc, Approach, LastKeyCtx, foulDesc, yellowCardDesc, straightRedDesc, secondYellowDesc, injuryDesc } from '../matchNarrative';
import { getGoalkeeperTraitBonus, getPenaltyComposureBonus } from '../traits';
import { stadiumFor, type Stadium } from '../stadium';
import { projectLevel } from '../clubProjects';
import { yellowChance, injuryChanceFromFoul, randomInjuryChance, tacticAggression, formationAggression, CARD_POS_MULT, STRAIGHT_RED_PROB, RED_PENALTY, RED_GK_PENALTY, INJURY_DEBUFF, DANGEROUS_FOUL_CARD_MULT, THREAT_FOUL_CARD_MULT, DANGEROUS_FOUL_INJURY_MULT, compressAggression, settleFactor, SECOND_YELLOW_LENIENCY } from '../discipline';
import { random } from '../random';
import { type PlayerCard, setStatIds, statKey, type MatchTrigger, type MatchPlan, normalizeMatchPlan, isExcludedPlayer, type Team, matchRoleForPlayer, activeGoalkeeperForTeam, type MatchEvent, type MatchStatsDelta, type PlayerMatchStat, type PenaltyKick, type MatchResult } from './teamModel';
import { getChemistryBonus, computeCharacteristicBoosts, teamPlaymaking, midfieldBuildUpEdge, computePossession, getFreeKickTaker, getHeaderTarget } from './chemistry';
import { edgeChance } from './curves';
import { getEffectiveAttribute, DUEL_SCALE, FINISH_EDGE, KEEPER_DUEL_SCALE, SET_PIECE_SCALE, FREE_KICK_EDGE, HEADER_EDGE, PENALTY_EDGE, PENALTY_SCALE, ON_TARGET_RESISTANCE, TACTICAL_INFLUENCE, MATCH_NOISE, CHANCE_VOLUME_INFLUENCE, FORMATION_ATTACK_DANGER_INFLUENCE, TACTIC_ATTACK_DANGER_INFLUENCE, FORMATION_DEFENSE_SUPPRESSION_INFLUENCE, TACTIC_DEFENSE_SUPPRESSION_INFLUENCE, formationCounterBonusForAnalysisLevel } from './attributes';
import { captainBoostForTeam, calculateTeamStrength, getPenaltyTaker, simulatePenalties } from './strength';

// ── Flavour match statistics (shots/saves/corners/fouls) ──────
// These mostly populate the box-score; a foul can still become a penalty or a
// direct free kick and a corner can become a header chance (each may score). They are
// per-minute probabilistic and scaled by a per-match tempo/aggression roll, so
// every match looks different (a one-sided thrashing, a scrappy foul-fest, a
// quiet game with few corners) instead of fixed averages.
const FLAVOR_SHOT_RATE = 0.20;  // base chance the attacking side takes an extra attempt this minute
const FLAVOR_FOUL_RATE = 0.24;  // base chance of a foul this minute
const FREE_KICK_CHANCE = 0.10; // fraction of fouls that are dangerous → a direct free kick
const PENALTY_FOUL_CHANCE = 0.15; // fraction of dangerous fouls judged inside the box → penalty
const CORNER_CHANCE = 0.14;    // fraction of corners that produce a header chance
// A goalkeeper is a specialized role. Coringa removes the normal out-of-position
// penalty, but it does not teach a defender or midfielder how to keep goal. Their
// DEF still helps, at a reduced role-specific efficiency, while FIS/RIT and the other
// attributes remain untouched by this goalkeeper-specific factor. Goalkeeper-only
// traits remain exclusive to cards whose native position is GK.
export const OUTFIELD_GK_MULTIPLIER = 0.70;

export function isOutfieldGoalkeeper(
  player: Pick<Player, 'position'>,
  role?: string,
): boolean {
  return !!role
    && role === 'GK'
    && player.position !== 'GK';
}

// Applies the goalkeeper aptitude rule exactly once to the effective DEF. Keeping
// this helper shared by the detail view, team-strength calculation and save model
// prevents the UI and match engine from drifting apart or double-penalizing cards.
export function goalkeeperAptitudeDefending(
  player: Pick<Player, 'position'>,
  effectiveDefending: number,
  role?: string,
): number {
  return isOutfieldGoalkeeper(player, role)
    ? Math.max(1, Math.round(effectiveDefending * OUTFIELD_GK_MULTIPLIER))
    : effectiveDefending;
}

export function goalkeeperShotStoppingRating(
  player: Pick<Player, 'position'>,
  effectiveDefending: number,
  traits: string[],
): number {
  const isNaturalGoalkeeper = player.position === 'GK';
  const roleDefending = goalkeeperAptitudeDefending(player, effectiveDefending, 'GK');
  const specialistBonus = isNaturalGoalkeeper ? getGoalkeeperTraitBonus(traits) : 0;
  return Math.max(1, roleDefending + specialistBonus);
}
// Momentum gained/lost by the team that scores. Lower = leads snowball less, so
// fewer blowouts and more balanced (drawn) games.
const GOAL_MOMENTUM_SWING = 8;
// Momentum drifts back toward neutral (50) by this fraction every minute. Goals and flow still
// swing it, but a side can no longer snowball for the rest of the match off a self-reinforcing
// flow: without it, even games ended in one-sided routs far more often than real football.
export const MOMENTUM_REVERSION = 0.1;
// Share of the stadium bonus that counts in the territory battle (who attacks each minute).
// The bonus always counts in full in every duel; at full share here too, home sides won ~51%
// and away sides ~22% between equal teams (real football: ~45% / ~29%).
export const HOME_INITIATIVE_SHARE = 0.5;

// ── Open-play shot resolution ──────────────────────────────────────────────────
// Single source of truth for the chance math of a key-minute attack.
type ShotType = 'normal' | 'header' | 'long_range' | 'one_on_one' | 'first_time';
interface ChanceResult {
  outcome: 'goal' | 'save' | 'miss' | 'duel';
  onTarget: boolean;
  shotType: ShotType;
}

// The kind of finish a chance becomes, derived from the build-up approach.
export function shotTypeForApproach(approach: string): ShotType {
  if (approach === 'cross') return 'header';
  if (approach === 'longrange') return 'long_range';
  if (approach === 'through' || approach === 'counter') return random() < 0.6 ? 'one_on_one' : 'first_time';
  return 'normal';
}

// How each finish type bends accuracy (TARGET) and the keeper duel (GK):
//  header     — slightly harder to place, keeper well set
//  long_range — much harder to hit the target, keeper has time to set
//  one_on_one — easier to hit AND keeper exposed → the best chance
//  first_time — quick, a touch easier past the keeper
const SHOT_TARGET_MOD: Record<ShotType, number> = { normal: 1, header: 0.90, long_range: 0.70, one_on_one: 1.02, first_time: 1.0 };
const SHOT_GK_MOD:     Record<ShotType, number> = { normal: 0, header: 1,    long_range: 6,    one_on_one: -2,   first_time: 0 };

export function resolveOpenPlayChance(p: {
  atkShooting: number; atkPace: number; atkDribbling: number;
  defDefending: number; defPhysical: number; buildUp: number;
  gkRating: number; // goalkeeperShotStoppingRating(gk, effective DEF, traits)
  approach: string;
}): ChanceResult {
  const atkScore = (p.atkShooting + p.atkPace + p.atkDribbling) / 3 + p.buildUp;
  const defScore = (p.defDefending + p.defPhysical) / 2;
  if (random() >= edgeChance(atkScore - defScore, DUEL_SCALE)) return { outcome: 'duel', onTarget: false, shotType: 'normal' };

  const shotType = shotTypeForApproach(p.approach);
  const targetChance = (p.atkShooting / (p.atkShooting + ON_TARGET_RESISTANCE)) * SHOT_TARGET_MOD[shotType];
  if (random() >= targetChance) return { outcome: 'miss', onTarget: false, shotType };

  const finishEdge = p.atkShooting - p.gkRating + FINISH_EDGE - SHOT_GK_MOD[shotType];
  return { outcome: random() < edgeChance(finishEdge, KEEPER_DUEL_SCALE) ? 'goal' : 'save', onTarget: true, shotType };
}

// Key-event minutes for ONE match — the clear goalscoring chances ("lances de perigo").
// Jittered so every game has its own rhythm, but with a guaranteed MINIMUM SPACING so chances
// never land back-to-back (the old ±45% jitter let two fire within a minute of each other, which
// made matches feel like a chance every other minute). Fewer, better-spaced chances → a calmer,
// more realistic pace.
export function buildKeyMinutes(isKnockout: boolean): number[] {
  const cap = isKnockout ? 120 : 90;
  const target = isKnockout ? 17 : 13;            // clear (open-play) chances per match
  const minGap = 3;                                // never two clear chances within 3' → still no back-to-back
  const gap = cap / (target + 1);
  const mins: number[] = [];
  for (let i = 1; i <= target; i++) {
    let m = Math.round(gap * i + (random() * 2 - 1) * gap * 0.30); // gentler jitter (±30% of the gap)
    m = Math.max(3, Math.min(cap, m));
    const prev = mins[mins.length - 1];
    if (prev !== undefined && m - prev < minGap) m = prev + minGap;     // push apart to keep the spacing
    if (m > cap) break;                                                 // pushed past full time → stop early
    mins.push(m);
  }
  return mins;
}

// Tactical fingerprint derived from a formation's SHAPE (how many defenders/
// midfielders/forwards/wide players it fields), normalised around a balanced 4-4-2.
// Small numbers on purpose — the formation TILTS the game, it never decides it.
interface FormationProfile { attack: number; defense: number; control: number; cross: number; }

// Each shape's tactical fingerprint, tuned to its identity as a trade-off: attack
// (danger of the team's own chances) is paired with defense (suppression of opponent chance danger),
// so an attacking shape can create deadlier moments while a defensive shape is harder to break — no shape is
// strictly better. control = volume of attacking sequences and possession; cross = wide vs narrow
// (shifts the chance mix between crosses and through-balls). Validated by the round-robin in
// balance.test.ts ("formation impact"). Magnitudes stay small — the shape TILTS, never decides.
const FORMATION_PROFILES: Record<string, FormationProfile> = {
  // Wide front three: chances are a little more dangerous and the shape creates steady volume.
  '4-3-3':   { attack: 0.4, defense: 0,    control: 0.75, cross: 0 },
  // Patient control: double pivot is solid, the midfield owns the ball, but it's not direct.
  '4-2-3-1': { attack: -0.5, defense: 1, control: 0.75, cross: 0 },
  // Classic and compact: the dependable all-rounder, with a modest reduction in chance danger.
  '4-4-2':   { attack: 0,  defense: 0.75, control: 0, cross: 0 },
  // Midfield dominance through the middle, but only three at the back → ball-hungry yet exposed.
  '3-5-2':   { attack: 0,  defense: -0.25, control: 1.5, cross: -2 },
  // Three forwards: the chances it creates are much more dangerous, but the back line is exposed.
  '3-4-3':   { attack: 2,  defense: -2.5, control: 0.5,  cross: 1 },
  // Back five: suppresses the opponent well, but creates fewer sequences and less-dangerous chances.
  '5-3-2':   { attack: -1, defense: 2,  control: -0.75, cross: -2 },
};

export function formationProfile(formationId: string): FormationProfile {
  const explicit = FORMATION_PROFILES[formationId];
  if (explicit) return explicit;
  // Fallback for any shape without a hand-tuned entry: derive a profile from its role counts.
  const f = FORMATIONS.find(x => x.id === formationId);
  if (!f) return { attack: 0, defense: 0, control: 0, cross: 0 };
  const roles = f.positions.map(p => p.role);
  const cnt = (arr: string[]) => roles.filter(r => arr.includes(r)).length;
  const fwd = cnt(['ST', 'LW', 'RW']);
  const def = cnt(['CB', 'LB', 'RB', 'LWB', 'RWB']);
  const mid = cnt(['CDM', 'CM', 'CAM', 'LM', 'RM']);
  const wide = cnt(['LW', 'RW', 'LM', 'RM', 'LB', 'RB', 'LWB', 'RWB']);
  return { attack: fwd - 2, defense: def - 4, control: mid - 4, cross: wide - 4 };
}

// ── Tactic (play-style) effects — SHARED so the engine and the display never drift ──
// Each tactic now has a richer attribute footprint (not a single stat) AND a profile
// (attack/defense/control) that shapes how many and how good its chances are.
export function tacticBuffMultiplierForAnalysisLevel(level: number): number {
  if (!Number.isFinite(level)) return 1;
  const safeLevel = Math.max(1, Math.floor(level));
  if (safeLevel >= 4) return 2;
  if (safeLevel >= 2) return 1.5;
  return 1;
}

export function tacticStatBonus(playStyle: string, attr: string, analysisLevel = 1): number {
  const core = attr === 'pace' || attr === 'shooting' || attr === 'passing'
    || attr === 'dribbling' || attr === 'defending' || attr === 'physical';
  let base: number;
  switch (playStyle) {
    // Balanced is a real CHOICE, not the absence of one: a well-drilled side with no weak spot —
    // a modest +2 across every core stat (same total budget as the specialists, just no peak), so
    // it isn't strictly dominated by tactics that hand out free stats.
    case 'balanced':       base = core ? 2 : 0; break;
    case 'possession':     base = attr === 'passing' ? 5 : attr === 'vision' ? 5 : attr === 'dribbling' ? 3 : 0; break;
    case 'counter':        base = (attr === 'pace' || attr === 'shooting') ? 5 : attr === 'defending' ? 2 : 0; break;
    case 'high_press':     base = attr === 'physical' ? 5 : attr === 'defending' ? 3 : attr === 'pace' ? 2 : 0; break;
    case 'defensive':      base = attr === 'defending' ? 8 : attr === 'physical' ? 3 : 0; break;
    case 'all_out_attack': base = attr === 'shooting' ? 8 : attr === 'pace' ? 4 : attr === 'dribbling' ? 2 : 0; break;
    default:               base = 0;
  }
  return base === 0 ? 0 : Math.round(base * tacticBuffMultiplierForAnalysisLevel(analysisLevel));
}

// How a tactic shapes the same three axes as a formation:
// attack = danger of own chances, defense = suppression of opponent chance danger,
// control = volume of attacking sequences and possession.
export function tacticProfile(playStyle: string): { attack: number; defense: number; control: number } {
  switch (playStyle) {
    case 'possession':     return { attack: 0, defense: 0, control: 1 };   // patient, owns the midfield
    case 'counter':        return { attack: 1, defense: 0, control: -1 };  // sits in, hits fast (fewer but better chances)
    case 'high_press':     return { attack: 1, defense: -1, control: 1 };  // aggressive: wins it high, but the high line leaves space behind
    case 'defensive':      return { attack: -2, defense: 2, control: -1 }; // few chances, very hard to break down
    case 'all_out_attack': return { attack: 3, defense: -3.5, control: 0 }; // chances are very dangerous, but the team is open
    case 'balanced':       return { attack: 0, defense: 0, control: 0.5 }; // steady volume, no major weakness
    default:               return { attack: 0, defense: 0, control: 0 };
  }
}

// Pure tactical translations used by the match loop. Keeping these calculations in named
// functions makes the game's rules easy to inspect and gives balance tests a stable seam.
export function tacticalChanceVolumeModifier(formationControl: number, tacticControl: number): number {
  return (formationControl + tacticControl) * CHANCE_VOLUME_INFLUENCE * TACTICAL_INFLUENCE;
}

export function tacticalChanceDangerModifier(args: {
  attackingFormationAttack: number;
  attackingTacticAttack: number;
  defendingFormationDefense: number;
  defendingTacticDefense: number;
}): number {
  return (
    args.attackingFormationAttack * FORMATION_ATTACK_DANGER_INFLUENCE
    + args.attackingTacticAttack * TACTIC_ATTACK_DANGER_INFLUENCE
    - args.defendingFormationDefense * FORMATION_DEFENSE_SUPPRESSION_INFLUENCE
    - args.defendingTacticDefense * TACTIC_DEFENSE_SUPPRESSION_INFLUENCE
  ) * TACTICAL_INFLUENCE;
}

/** Pick a weighted random attacker — center forwards get higher weight */
function pickWeightedAttacker(players: PlayerCard[], roleForPlayer: (player: PlayerCard) => string = p => p.position): PlayerCard {
  const weighted: { player: PlayerCard; weight: number }[] = players.map(p => {
    let weight = 1;
    const position = roleForPlayer(p);
    if (position === 'ST') weight = 5;
    else if (position === 'LW' || position === 'RW') weight = 3;
    else if (position === 'CAM' || position === 'LM' || position === 'RM') weight = 2;
    return { player: p, weight };
  });
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
  let r = random() * totalWeight;
  for (const { player, weight } of weighted) {
    r -= weight;
    if (r <= 0) return player;
  }
  return players[players.length - 1];
}

function pickWeightedAssister(
  team: Team,
  scorerId: string,
  playerStats?: Record<string, PlayerMatchStat>,
  excludedIds?: ReadonlySet<string>,
): PlayerCard | null {
  // Teammates in the starting 11 who are not the scorer and not sent off
  const teammates = team.players.slice(0, 11).filter(p => {
    if (p.id === scorerId || isExcludedPlayer(team, p, excludedIds)) return false;
    const stat = playerStats?.[p.statId ?? statKey(team.id, p.id)];
    return (stat?.redCards ?? 0) === 0;
  });
  if (teammates.length === 0) return null;

  // 70% chance of an assist
  if (random() > 0.70) return null;

  const weighted: { player: PlayerCard; weight: number }[] = teammates.map(p => {
    let weight = 0.5; // default base weight for defenders/GK
    
    const role = matchRoleForPlayer(team, p);
    if (['CAM', 'CM', 'LM', 'RM'].includes(role)) {
      weight = 5.0 + (p.passing / 10) + (p.vision / 10);
    } else if (['LW', 'RW'].includes(role)) {
      weight = 4.0 + (p.passing / 10);
    } else if (role === 'ST') {
      weight = 1.0;
    } else if (role === 'CDM') {
      weight = 1.5 + (p.passing / 15);
    } else if (['LB', 'RB', 'LWB', 'RWB'].includes(role)) {
      weight = 2.0 + (p.passing / 15); // fullbacks can cross/assist
    }
    
    return { player: p, weight };
  });

  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
  if (totalWeight <= 0) return null;

  let r = random() * totalWeight;
  for (const { player, weight } of weighted) {
    r -= weight;
    if (r <= 0) return player;
  }
  return teammates[0];
}


export function runMatchSimulation(
  home: Team,
  away: Team,
  startMinute: number,
  endMinute: number,
  initialHomeGoals: number,
  initialAwayGoals: number,
  initialEvents: MatchEvent[],
  initialStats: MatchResult['stats'],
  playerStats: Record<string, PlayerMatchStat>,
  isKnockout: boolean = false,
  isFinal: boolean = false,
  decideWinner: boolean = true, // when false, skip end-of-match bonuses/winner logic
  neutralFinal: boolean = isFinal,
): MatchResult {
  const events = [...initialEvents];
  let homeGoals = initialHomeGoals;
  let awayGoals = initialAwayGoals;
  let homeMomentum = 50;
  let awayMomentum = 50;

  const homeCoach = COACHES.find(c => c.id === home.coachId)!;
  const awayCoach = COACHES.find(c => c.id === away.coachId)!;
  const homeFormation = FORMATIONS.find(f => f.id === home.formationId)!;
  const awayFormation = FORMATIONS.find(f => f.id === away.formationId)!;

  const homeChem = getChemistryBonus(home.totalChemistry);
  const awayChem = getChemistryBonus(away.totalChemistry);

  const homeFormBonus = homeFormation.counters.includes(away.formationId)
    ? formationCounterBonusForAnalysisLevel(projectLevel(home.clubProjects, 'analysis'))
    : 0;
  const awayFormBonus = awayFormation.counters.includes(home.formationId)
    ? formationCounterBonusForAnalysisLevel(projectLevel(away.clubProjects, 'analysis'))
    : 0;

  // Formation shape + tactic both shape how each side creates/concedes chances.
  const homeProf = formationProfile(home.formationId);
  const awayProf = formationProfile(away.formationId);
  // The active style can change during the match through the team's pre-configured plan.
  // Keeping this state local to the simulation makes the same rules work for solo and online
  // matches, while the tactic event below makes the change visible in the replay/history.
  const lastTacticAction = (teamId: string, fallback: string) => {
    const previous = events
      .filter(event => event.type === 'tactic' && event.teamId === teamId && event.tacticAction)
      .sort((a, b) => a.minute - b.minute);
    return previous[previous.length - 1]?.tacticAction ?? fallback;
  };
  let homePlayStyle = lastTacticAction(home.id, home.playStyle ?? 'balanced');
  let awayPlayStyle = lastTacticAction(away.id, away.playStyle ?? 'balanced');
  const homeMatchPlan = normalizeMatchPlan(home.matchPlan);
  const awayMatchPlan = normalizeMatchPlan(away.matchPlan);
  const playmakingCache = new Map<string, number>();
  const playmakingFor = (team: Team, style: string) => {
    const key = `${team.id}:${style}`;
    const cached = playmakingCache.get(key);
    if (cached !== undefined) return cached;
    const value = teamPlaymaking(team, style);
    playmakingCache.set(key, value);
    return value;
  };
  const firedTriggerKeys = new Set(
    events
      .filter(event => event.type === 'tactic' && event.triggerId)
      .map(event => `${event.teamId}:${event.triggerId}`),
  );
  // Captain leadership — computed once per side (the best stat is fixed for the match).
  const homeCaptainBoost = captainBoostForTeam(home) ?? undefined;
  const awayCaptainBoost = captainBoostForTeam(away) ?? undefined;
  // 🩸❤️🪑🤝 Team-effect characteristics — computed once per side (constant across the match).
  const homeCharBoosts = computeCharacteristicBoosts(home.players);
  const awayCharBoosts = computeCharacteristicBoosts(away.players);

  const matchStats = { ...initialStats };

  const KEY_MINUTES = buildKeyMinutes(isKnockout);

  // Global danger cooldown: a dead-ball danger (free kick / corner header) never fires within
  // DANGER_COOLDOWN minutes of a KEY chance or of another dead-ball danger — so chances never
  // pile up back-to-back. Key chances are already spaced by buildKeyMinutes; this keeps the
  // RANDOM flavour dangers from landing right on top of them.
  const DANGER_COOLDOWN = 2;
  let lastFlavorDangerMin = -DANGER_COOLDOWN;
  // Hard ceiling on clear chances per match — once reached, further dangers resolve quietly,
  // so a match never floods past this many "lances de perigo" no matter how the dice fall.
  const MAX_DANGER = isKnockout ? 18 : 15;
  let dangerCount = 0;

  let lastKeyCtx: LastKeyCtx = null;

  // Per-match character so each box-score is different (tempo & aggression vary).
  const matchTempo = 0.7 + random() * 0.6;       // 0.70 .. 1.30
  const matchAggression = 0.55 + random() * 0.9; // 0.55 .. 1.45
  // 📉 Ímpeto COMPRIMIDO só para cartão/lesão → aproxima pico e vale sem mudar tempo/gols.
  const cardAggression = compressAggression(matchAggression);

  // Team strength only changes with discipline events (red cards, injuries) and with the score
  // (coach/trait bonuses "while losing"). It is cached for both score states and recomputed only
  // on discipline events. It includes the host's stadium edge, like the duels do.
  // 🩹🟥 Estado disciplinar da partida: força base MUTÁVEL (recomputada por evento).
  const sentOff = new Set<string>();                 // teamId::playerId removidos (🟥) → time joga com 10
  const injuredDebuff: Record<string, number> = {};  // teamId::playerId → jogador lesionado (capengando)
  let homeExtraPenalty = 0, awayExtraPenalty = 0;     // penalidade fixa do 🟥 (RED_PENALTY/RED_GK_PENALTY)
  const bookings = new Map<string, number>();         // teamId::playerId → nº de amarelos no jogo
  let totalCards = 0;                                  // 📉 nº de cartões no jogo (p/ o "juiz acalma")

  // Extra time can be simulated as a second engine segment. Rehydrate the disciplinary
  // state from the first segment so a red-card trigger, a suspended player and the red
  // strength penalty remain active through the whole match.
  for (const event of initialEvents) {
    if (!event.teamId || !event.playerId) continue;
    const eventTeam = event.teamId === home.id ? home : event.teamId === away.id ? away : undefined;
    const eventPlayer = eventTeam?.players.find(player => player.id === event.playerId);
    if (!eventTeam || !eventPlayer) continue;
    const key = statKey(eventTeam.id, eventPlayer.id);
    if (event.type === 'red') {
      sentOff.add(key);
      const penalty = matchRoleForPlayer(eventTeam, eventPlayer) === 'GK' ? RED_GK_PENALTY : RED_PENALTY;
      if (eventTeam.id === home.id) homeExtraPenalty += penalty; else awayExtraPenalty += penalty;
      totalCards++;
    } else if (event.type === 'yellow') {
      bookings.set(key, (bookings.get(key) ?? 0) + 1);
      totalCards++;
    } else if (event.type === 'injury') {
      injuredDebuff[key] = INJURY_DEBUFF;
    }
  }
  const disc = () => ({ sentOff, injuredDebuff, injuryDebuff: INJURY_DEBUFF });
  const isSentOff = (team: Team, player: Player) => isExcludedPlayer(team, player, sentOff);
  const hasMatchInjury = (team: Team, player: Player) => Boolean(injuredDebuff[statKey(team.id, player.id)]);
  type StrengthByScore = { level: number; losing: number };
  const strengthFor = (team: Team, coach: Coach, chem: typeof homeChem, formBonus: number): StrengthByScore => {
    const strength = (isLosing: boolean, venue: { homeStadium?: Stadium; stadiumProjectLevel?: number }) =>
      calculateTeamStrength(team, coach, chem, formBonus, disc(), { isKnockout, isFinal, isLosing, ...venue });
    // The host's stadium edge counts in full in every duel, and by HOME_INITIATIVE_SHARE in the
    // territory battle (strength → who attacks each minute). Not on a neutral final venue.
    if (team !== home || neutralFinal) return { level: strength(false, {}), losing: strength(true, {}) };
    const venue = { homeStadium: stadiumFor(home.coachId, false), stadiumProjectLevel: projectLevel(home.clubProjects, 'stadium') };
    const blend = (isLosing: boolean) => {
      const neutral = strength(isLosing, {});
      return neutral + (strength(isLosing, venue) - neutral) * HOME_INITIATIVE_SHARE;
    };
    return { level: blend(false), losing: blend(true) };
  };
  let homeBaseStrength = strengthFor(home, homeCoach, homeChem, homeFormBonus);
  let awayBaseStrength = strengthFor(away, awayCoach, awayChem, awayFormBonus);
  const recomputeStrength = () => {
    homeBaseStrength = strengthFor(home, homeCoach, homeChem, homeFormBonus);
    awayBaseStrength = strengthFor(away, awayCoach, awayChem, awayFormBonus);
  };
  const matchStatFor = (p: Player, team: Team): PlayerMatchStat | undefined =>
    playerStats[(p as PlayerCard).statId ?? statKey(team.id, p.id)];
  const pushFoul = (fouler: Player, victim: Player | undefined, team: Team, min: number) => {
    const stat = matchStatFor(fouler, team);
    if (stat) {
      stat.fouls++;
      stat.rating -= 0.1;
    }
    events.push({
      minute: min,
      type: 'foul',
      teamId: team.id,
      playerId: fouler.id,
      opponentId: victim?.id,
      description: foulDesc(fouler.shortName, victim?.shortName ?? 'um adversário'),
    });
  };
  const pushYellow = (p: Player, team: Team, min: number, cutDanger = false) => {
    // 🟨 texto puxa pelo perfil (compostura/posição ocupada) e por ter cortado um lance de perigo.
    const stat = matchStatFor(p, team);
    if (stat) {
      stat.yellowCards++;
      stat.rating -= 0.5;
    }
    events.push({ minute: min, type: 'yellow', teamId: team.id, playerId: p.id, description: yellowCardDesc(p.shortName, p.composure ?? 65, matchRoleForPlayer(team, p), cutDanger) });
    totalCards++;
  };
  const applySendOff = (p: Player, team: Team, reason: 'red' | 'second-yellow', min: number) => {
    if (isSentOff(team, p)) return;
    totalCards++;
    const stat = matchStatFor(p, team);
    if (stat) {
      stat.redCards++;
      stat.rating -= 1.5;
    }
    // 🟥 narração dramática e VARIADA — vermelho direto (viés por compostura) vs segundo amarelo.
    events.push({ minute: min, type: 'red', teamId: team.id, playerId: p.id, secondYellow: reason === 'second-yellow',
      description: reason === 'second-yellow' ? secondYellowDesc(p.shortName) : straightRedDesc(p.shortName, p.composure ?? 65) });
    sentOff.add(statKey(team.id, p.id));
    const pen = matchRoleForPlayer(team, p) === 'GK' ? RED_GK_PENALTY : RED_PENALTY;
    if (team.id === home.id) homeExtraPenalty += pen; else awayExtraPenalty += pen;
    recomputeStrength();
  };
  const applyInjury = (p: Player, team: Team, min: number) => {
    if (hasMatchInjury(team, p) || isSentOff(team, p)) return;
    injuredDebuff[statKey(team.id, p.id)] = INJURY_DEBUFF;
    events.push({ minute: min, type: 'injury', teamId: team.id, playerId: p.id, description: injuryDesc(p.shortName) });
    recomputeStrength();
  };
  const activeGoalkeeper = (team: Team): { player: PlayerCard; emergency: boolean } =>
    activeGoalkeeperForTeam(team, sentOff);

  // Some flavour attempts affect the box score without producing a player-facing
  // shot/save event. Keep those changes on the same authoritative timeline that
  // the client replays, instead of making the UI discover them only at full time.
  const pushStatEvent = (min: number, team: Team, statDelta: MatchStatsDelta, description: string) => {
    events.push({ minute: min, type: 'stat', teamId: team.id, description, statDelta });
  };
  const pushCornerEvent = (min: number, team: Team) => {
    events.push({ minute: min, type: 'corner', teamId: team.id, description: `🚩 Escanteio para ${team.name}.` });
  };

  const activePlayStyleFor = (team: Team) => team.id === home.id ? homePlayStyle : awayPlayStyle;
  const triggerConditionDescription = (trigger: MatchTrigger): string => {
    switch (trigger.condition) {
      case 'losing': return trigger.margin ? `estava perdendo por ${trigger.margin}+ gols` : 'estava perdendo';
      case 'winning': return trigger.margin ? `estava vencendo por ${trigger.margin}+ gols` : 'estava vencendo';
      case 'draw': return 'estava empatando';
      case 'red_card': return 'recebeu um cartão vermelho';
      case 'opponent_red_card': return 'o adversário recebeu um cartão vermelho';
    }
  };
  const triggerMatches = (
    team: Team,
    trigger: MatchTrigger,
    teamGoals: number,
    opponentGoals: number,
    currentMinute: number,
  ) => {
    const teamHasRedCard = Array.from(sentOff).some(key => key.split('::')[0] === team.id);
    const opponentHasRedCard = Array.from(sentOff).some(key => key.split('::')[0] !== team.id);
    if (trigger.condition === 'red_card') return teamHasRedCard;
    if (trigger.condition === 'opponent_red_card') return opponentHasRedCard;
    if (currentMinute < trigger.minute) return false;
    if (trigger.condition === 'losing') return opponentGoals - teamGoals >= (trigger.margin ?? 1);
    if (trigger.condition === 'winning') return teamGoals - opponentGoals >= (trigger.margin ?? 1);
    if (trigger.condition === 'draw') return teamGoals === opponentGoals;
    return false;
  };
  const applyNextTrigger = (
    team: Team,
    plan: MatchPlan,
    currentStyle: string,
    teamGoals: number,
    opponentGoals: number,
    currentMinute: number,
  ) => {
    const trigger = plan.triggers.find(candidate => {
      const key = `${team.id}:${candidate.id}`;
      return !firedTriggerKeys.has(key) && triggerMatches(
        team, candidate, teamGoals, opponentGoals, currentMinute,
      );
    });
    if (!trigger) return currentStyle;
    const triggerKey = `${team.id}:${trigger.id}`;
    firedTriggerKeys.add(triggerKey);
    const nextTactic = getTacticById(trigger.action);
    const previousTactic = getTacticById(currentStyle);
    events.push({
      minute: currentMinute,
      type: 'tactic',
      teamId: team.id,
      triggerId: trigger.id,
      tacticAction: trigger.action,
      description: `Tática alterada: ${team.name} troca a tática ${previousTactic.name} pela tática ${nextTactic.name} porque ${triggerConditionDescription(trigger)}.`,
    });
    return trigger.action;
  };
  const pickFouler = (team: Team, pool: Player[]): Player | undefined => {
    if (pool.length === 0) return undefined;
    const weights = pool.map(p => CARD_POS_MULT[matchRoleForPlayer(team, p)] ?? 1);
    const total = weights.reduce((s, w) => s + w, 0);
    let r = random() * total;
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  };
  // Lesão aleatória (não-falta): prob. por titular por jogo, diluída por minuto.
  const span = Math.max(1, endMinute - startMinute);

  // Rating changes are captured per minute and attached to that minute's last event.
  let ratingSnapshot: Record<string, number> = {};
  let minuteEventStart = events.length;
  let ratingMinute = startMinute;
  const snapshotRatings = () => {
    ratingSnapshot = Object.fromEntries(Object.entries(playerStats).map(([key, stat]) => [key, stat.rating]));
  };
  const flushRatingDelta = () => {
    const delta: Record<string, number> = {};
    for (const [key, stat] of Object.entries(playerStats)) {
      const d = Math.round((stat.rating - (ratingSnapshot[key] ?? stat.rating)) * 100) / 100;
      if (d !== 0) delta[key] = d;
    }
    if (Object.keys(delta).length === 0) return;
    if (events.length > minuteEventStart) {
      const last = events[events.length - 1];
      last.ratingDelta = { ...(last.ratingDelta ?? {}) };
      for (const [key, d] of Object.entries(delta)) last.ratingDelta[key] = Math.round(((last.ratingDelta[key] ?? 0) + d) * 100) / 100;
    } else {
      events.push({ minute: ratingMinute, type: 'stat', description: '', teamId: home.id, ratingDelta: delta });
    }
  };

  for (let minute = startMinute + 1; minute <= endMinute; minute++) {
    const isKeyEventMinute = KEY_MINUTES.includes(minute);
    if (minute > startMinute + 1) flushRatingDelta();
    snapshotRatings();
    minuteEventStart = events.length;
    ratingMinute = minute;

    // 🩹 Lesão ALEATÓRIA (sem falta): prob. por titular por jogo diluída pelos minutos, por físico.
    for (const team of [home, away]) {
      for (const p of team.players.slice(0, 11)) {
        if (hasMatchInjury(team, p) || isSentOff(team, p)) continue;
        if (random() < randomInjuryChance(p.physical ?? 70, Boolean(p.fragil)) / span) { applyInjury(p, team, minute); break; }
      }
    }

    const homeStrength = (homeGoals < awayGoals ? homeBaseStrength.losing : homeBaseStrength.level) - homeExtraPenalty;
    const awayStrength = (awayGoals < homeGoals ? awayBaseStrength.losing : awayBaseStrength.level) - awayExtraPenalty;

    homeMomentum += (50 - homeMomentum) * MOMENTUM_REVERSION;
    awayMomentum += (50 - awayMomentum) * MOMENTUM_REVERSION;
    const homeMomBonus = (homeMomentum - 50) * 0.25;
    const awayMomBonus = (awayMomentum - 50) * 0.25;

    // Evaluate both teams against the same pre-minute snapshot. A trigger is one-shot: once
    // fired, it never loops back and repeatedly toggles the team's style.
    const currentHomeStyle = homePlayStyle;
    const currentAwayStyle = awayPlayStyle;
    const nextHomeStyle = applyNextTrigger(
      home, homeMatchPlan, currentHomeStyle, homeGoals, awayGoals, minute,
    );
    const nextAwayStyle = applyNextTrigger(
      away, awayMatchPlan, currentAwayStyle, awayGoals, homeGoals, minute,
    );
    homePlayStyle = nextHomeStyle;
    awayPlayStyle = nextAwayStyle;
    const homeTac = tacticProfile(homePlayStyle);
    const awayTac = tacticProfile(awayPlayStyle);
    // Midfield passing ratings feed the quality of chances and follow the active tactic.
    const homeMid = playmakingFor(home, homePlayStyle);
    const awayMid = playmakingFor(away, awayPlayStyle);

    // Who carries the play this minute. CONTROL decides which side creates the sequence: it is
    // the volume axis, so it affects initiative, box-score attempts and the side of each clear
    // chance. ATTACK is intentionally absent here; it is applied below to make those chances
    // dangerous. Keeping the two separate makes a controlled team different from a direct one.
    const homeInitiative = homeStrength + homeMomBonus
      + tacticalChanceVolumeModifier(homeProf.control, homeTac.control);
    const awayInitiative = awayStrength + awayMomBonus
      + tacticalChanceVolumeModifier(awayProf.control, awayTac.control);

    const homeAttacks = random() < edgeChance(homeInitiative - awayInitiative, MATCH_NOISE);
    const attackTeam = homeAttacks ? home : away;
    const defendTeam = homeAttacks ? away : home;
    const attackCoach = homeAttacks ? homeCoach : awayCoach;
    const defendCoach = homeAttacks ? awayCoach : homeCoach;
    const attackChem = homeAttacks ? homeChem : awayChem;
    const defendChem = homeAttacks ? awayChem : homeChem;

    const homeIsLosing = homeGoals < awayGoals;
    const awayIsLosing = awayGoals < homeGoals;
    const matchCtxHome = { isKnockout, isFinal, isLosing: homeIsLosing, coachPrime: home.coachPrime, captainBoost: homeCaptainBoost, charBoosts: homeCharBoosts, credits: home.credits, analysisLevel: projectLevel(home.clubProjects, 'analysis'), stadiumProjectLevel: projectLevel(home.clubProjects, 'stadium'), homeStadium: neutralFinal ? undefined : stadiumFor(home.coachId, false) };
    const matchCtxAway = { isKnockout, isFinal, isLosing: awayIsLosing, coachPrime: away.coachPrime, captainBoost: awayCaptainBoost, charBoosts: awayCharBoosts, credits: away.credits, analysisLevel: projectLevel(away.clubProjects, 'analysis') };
    const attackCtx = homeAttacks ? matchCtxHome : matchCtxAway;
    const defendCtx = homeAttacks ? matchCtxAway : matchCtxHome;
    const playerContext = (team: Team, player: PlayerCard, ctx: typeof attackCtx) => ({
      ...ctx,
      role: matchRoleForPlayer(team, player),
    });

    // A dead-ball danger may fire this minute only if we're clear of any key chance and of the
    // last flavour danger (the cooldown) — this is what stops chances clustering / coming back-to-back.
    const nearKeyMinute = KEY_MINUTES.some(k => Math.abs(k - minute) < DANGER_COOLDOWN);
    const flavorDangerOk = !nearKeyMinute && (minute - lastFlavorDangerMin >= DANGER_COOLDOWN) && dangerCount < MAX_DANGER;

    // ── Flavour box-score + dead-ball play ──
    // The defending side fouls the attacking side this minute.
    if (random() < FLAVOR_FOUL_RATE * matchAggression) {
      if (homeAttacks) matchStats.awayFouls++; else matchStats.homeFouls++;

      // 🔗 LIGAÇÃO com o lance de perigo: decide AGORA se a falta é dura (vira cobrança perigosa)
      // e se ela cortou um ataque ameaçador (momentum alto). Isso puxa a chance de cartão/lesão.
      const dangerousFoul = flavorDangerOk && random() < FREE_KICK_CHANCE;
      const atkMomentum = homeAttacks ? homeMomentum : awayMomentum;
      const cutThreat = atkMomentum > 62; // o time que atacava estava pressionando
      const dangerCardMult = (dangerousFoul ? DANGEROUS_FOUL_CARD_MULT : 1) * (cutThreat ? THREAT_FOUL_CARD_MULT : 1);

      // O mesmo lance alimenta o total do time, a estatística individual e, quando
      // aplicável, a lógica de cartão/lesão. O evento precisa existir para o replay
      // e para a agregação da temporada conseguirem atribuir a falta ao jogador.
      const fouledPool = attackTeam.players.slice(0, 11).filter(p => !hasMatchInjury(attackTeam, p) && !isSentOff(attackTeam, p) && matchRoleForPlayer(attackTeam, p) !== 'GK');
      const fouled = fouledPool[Math.floor(random() * fouledPool.length)];
      let penaltyFoul = false;

      // 🟨🟥 Cartão do FALTADOR (lado defensor), ponderado por posição/compostura/ímpeto/tática/formação
      // E pela periculosidade da falta (falta dura ou que corta ameaça → mais cartão).
      const foulerPool = defendTeam.players.slice(0, 11).filter(p => !isSentOff(defendTeam, p) && matchRoleForPlayer(defendTeam, p) !== 'GK');
      const fouler = pickFouler(defendTeam, foulerPool);
      if (fouler) {
        pushFoul(fouler, fouled, defendTeam, minute);
        // A dangerous foul is close enough to goal to become either a direct free kick
        // or, rarely, a penalty-area foul. The penalty is resolved from THIS foul rather
        // than from an unrelated luck event later in the match.
        penaltyFoul = Boolean(fouled && dangerousFoul && random() < PENALTY_FOUL_CHANCE);
        // tAgg = tática × formação × periculosidade × "juiz acalma" (settle) — sem o ímpeto cru.
        const tAgg = tacticAggression(activePlayStyleFor(defendTeam)) * formationAggression(defendTeam.formationId) * dangerCardMult * settleFactor(totalCards);
        if (random() < STRAIGHT_RED_PROB * tAgg) {
          applySendOff(fouler, defendTeam, 'red', minute);
        } else {
          // 🟨 Já amarelado? O juiz pensa mais antes do 2º amarelo (que expulsa) → chance cai um pouco.
          const foulerKey = statKey(defendTeam.id, fouler.id);
          const already = bookings.get(foulerKey) ?? 0;
          const bookedLeniency = already >= 1 ? SECOND_YELLOW_LENIENCY : 1;
          if (random() < yellowChance(matchRoleForPlayer(defendTeam, fouler), fouler.composure ?? 65, cardAggression) * tAgg * bookedLeniency) {
            if (already >= 1) applySendOff(fouler, defendTeam, 'second-yellow', minute);
            else { bookings.set(foulerKey, already + 1); pushYellow(fouler, defendTeam, minute, dangerousFoul || cutThreat); }
          }
        }
      }
      // 🩹 Lesão do FALTADO (lado atacante) — falta dura machuca mais, ponderada pelo físico.
      if (fouled && random() < injuryChanceFromFoul(fouled.physical ?? 70, Boolean(fouled.fragil)) * (dangerousFoul ? DANGEROUS_FOUL_INJURY_MULT : 1)) {
        applyInjury(fouled, attackTeam, minute);
      }

      // A MESMA falta perigosa vira pênalti ou cobrança direta — não há dois lances
      // diferentes para a mesma falta.
      if (penaltyFoul) {
        lastFlavorDangerMin = minute;
        dangerCount++;
        const penaltyTaker = getPenaltyTaker(attackTeam, sentOff);
        const penaltyGkInfo = activeGoalkeeper(defendTeam);
        const penaltyGk = penaltyGkInfo.player;
        const penaltyTakerCtx = playerContext(attackTeam, penaltyTaker, attackCtx);
        const penaltyGkCtx = { ...defendCtx, role: 'GK' };
        const penComp = getEffectiveAttribute(penaltyTaker, 'composure', attackCoach, attackChem, activePlayStyleFor(attackTeam), penaltyTakerCtx)
          + getPenaltyComposureBonus(penaltyTaker.traits) + (penaltyTaker.id === attackTeam.penaltyTaker ? 5 : 0);
        const penGkRef = goalkeeperShotStoppingRating(
          penaltyGk,
          getEffectiveAttribute(penaltyGk, 'defending', defendCoach, defendChem, activePlayStyleFor(defendTeam), penaltyGkCtx),
          penaltyGk.traits,
        );
        const isPenGoal = random() < penaltyGoalChance(penComp, penGkRef);
        if (homeAttacks) matchStats.homeShots++; else matchStats.awayShots++;
        if (playerStats[penaltyTaker.statId!]) playerStats[penaltyTaker.statId!].shots++;

        if (isPenGoal) {
          if (homeAttacks) { homeGoals++; matchStats.homeShotsOnTarget++; } else { awayGoals++; matchStats.awayShotsOnTarget++; }
          if (playerStats[penaltyTaker.statId!]) { playerStats[penaltyTaker.statId!].goals++; playerStats[penaltyTaker.statId!].shotsOnTarget++; playerStats[penaltyTaker.statId!].rating += 1.0; }
          const foulerStat = fouler && playerStats[(fouler as PlayerCard).statId ?? statKey(defendTeam.id, fouler.id)];
          if (foulerStat) foulerStat.rating -= 0.2;
          events.push({
            minute, type: 'goal',
            description: penaltyGoalDesc(penaltyTaker.shortName, fouled?.shortName ?? 'um atacante', fouler?.shortName ?? 'um defensor', penaltyGk.shortName),
            teamId: attackTeam.id, playerId: penaltyTaker.id, opponentId: penaltyGk.id, isSpecial: true,
          });
          lastKeyCtx = { type: 'goal', teamId: attackTeam.id, atkName: penaltyTaker.shortName, defName: fouler?.shortName ?? 'um defensor', gkName: penaltyGk.shortName, approach: 'longrange' };
        } else if (random() < 0.5) {
          if (homeAttacks) { matchStats.homeShotsOnTarget++; matchStats.awaySaves++; } else { matchStats.awayShotsOnTarget++; matchStats.homeSaves++; }
          if (playerStats[penaltyGk.statId!]) { playerStats[penaltyGk.statId!].saves++; playerStats[penaltyGk.statId!].rating += 0.8; }
          if (playerStats[penaltyTaker.statId!]) playerStats[penaltyTaker.statId!].shotsOnTarget++;
          events.push({
            minute, type: 'save',
            description: penaltySaveDesc(penaltyGk.shortName, penaltyTaker.shortName),
            teamId: defendTeam.id, playerId: penaltyGk.id, opponentId: penaltyTaker.id,
          });
          lastKeyCtx = { type: 'save', teamId: defendTeam.id, atkName: penaltyTaker.shortName, defName: fouler?.shortName ?? 'um defensor', gkName: penaltyGk.shortName, approach: 'longrange' };
        } else {
          if (playerStats[penaltyTaker.statId!]) playerStats[penaltyTaker.statId!].rating -= 0.6;
          events.push({
            minute, type: 'miss',
            description: penaltyMissDesc(penaltyTaker.shortName),
            teamId: attackTeam.id, playerId: penaltyTaker.id,
          });
          lastKeyCtx = { type: 'miss', teamId: attackTeam.id, atkName: penaltyTaker.shortName, defName: fouler?.shortName ?? 'um defensor', gkName: penaltyGk.shortName, approach: 'longrange' };
        }
        if (isPenGoal) {
          const sw = homeAttacks ? 15 : -15;
          homeMomentum = Math.min(100, Math.max(0, homeMomentum + sw));
          awayMomentum = Math.min(100, Math.max(0, awayMomentum - sw));
        } else {
          const sw = homeAttacks ? -8 : 8;
          homeMomentum = Math.min(100, Math.max(0, homeMomentum + sw));
          awayMomentum = Math.min(100, Math.max(0, awayMomentum - sw));
        }
      } else if (dangerousFoul) {
        lastFlavorDangerMin = minute;
        dangerCount++;
        const fkGk = activeGoalkeeper(defendTeam).player;
        const taker = getFreeKickTaker(attackTeam, sentOff);
        const takerCtx = playerContext(attackTeam, taker, attackCtx);
        const takerShoot = getEffectiveAttribute(taker, 'shooting', attackCoach, attackChem, activePlayStyleFor(attackTeam), takerCtx);
        const takerComp = getEffectiveAttribute(taker, 'composure', attackCoach, attackChem, activePlayStyleFor(attackTeam), takerCtx);
        const fkGkRating = goalkeeperShotStoppingRating(
          fkGk,
          getEffectiveAttribute(fkGk, 'defending', defendCoach, defendChem, activePlayStyleFor(defendTeam), { ...defendCtx, role: 'GK' }),
          fkGk.traits,
        );
        const goalChance = freeKickGoalChance(takerShoot, takerComp, fkGkRating);
        const r = random();
        if (homeAttacks) matchStats.homeShots++; else matchStats.awayShots++;

        if (r < goalChance) {
          if (homeAttacks) { homeGoals++; matchStats.homeShotsOnTarget++; } else { awayGoals++; matchStats.awayShotsOnTarget++; }
          if (playerStats[taker.statId!]) { playerStats[taker.statId!].goals++; playerStats[taker.statId!].rating += 1.5; }
          if (playerStats[fkGk.statId!]) playerStats[fkGk.statId!].rating -= 0.3;
          events.push({
            minute, type: 'goal',
            description: freeKickGoalDesc(taker.shortName, fkGk.shortName),
            teamId: attackTeam.id, playerId: taker.id, opponentId: fkGk.id, isSpecial: true,
          });
          const sw = homeAttacks ? GOAL_MOMENTUM_SWING : -GOAL_MOMENTUM_SWING;
          homeMomentum = Math.min(100, Math.max(0, homeMomentum + sw));
          awayMomentum = Math.min(100, Math.max(0, awayMomentum - sw));
          lastKeyCtx = { type: 'goal', teamId: attackTeam.id, atkName: taker.shortName, defName: taker.shortName, gkName: fkGk.shortName, approach: 'longrange' };
        } else if (r < goalChance + 0.35) {
          if (homeAttacks) { matchStats.homeShotsOnTarget++; matchStats.awaySaves++; } else { matchStats.awayShotsOnTarget++; matchStats.homeSaves++; }
          if (playerStats[fkGk.statId!]) { playerStats[fkGk.statId!].saves++; playerStats[fkGk.statId!].rating += 0.5; }
          events.push({
            minute, type: 'save',
            description: freeKickSaveDesc(fkGk.shortName, taker.shortName),
            teamId: defendTeam.id, playerId: fkGk.id, opponentId: taker.id,
          });
        } else {
          events.push({
            minute, type: 'miss',
            description: freeKickMissDesc(taker.shortName),
            teamId: attackTeam.id, playerId: taker.id,
          });
        }
      }
    }
    // An extra attempt by the side on top this minute (off-target / corner / saved). A corner
    // can still turn into a header chance below.
    if (random() < FLAVOR_SHOT_RATE * matchTempo) {
      const extraShotDelta: MatchStatsDelta = {
        homeShots: homeAttacks ? 1 : 0,
        awayShots: homeAttacks ? 0 : 1,
      };
      const o = random();
      if (o < 0.34) {
        // on target but saved by the keeper
        if (homeAttacks) {
          matchStats.homeShots++;
          matchStats.homeShotsOnTarget++;
          matchStats.awaySaves++;
          extraShotDelta.homeShotsOnTarget = 1;
          extraShotDelta.awaySaves = 1;
        } else {
          matchStats.awayShots++;
          matchStats.awayShotsOnTarget++;
          matchStats.homeSaves++;
          extraShotDelta.awayShotsOnTarget = 1;
          extraShotDelta.homeSaves = 1;
        }
        pushStatEvent(minute, attackTeam, extraShotDelta, '📊 Finalização adicional defendida.');
      } else if (o < 0.62) {
        // blocked/deflected out for a corner
        if (homeAttacks) { matchStats.homeShots++; matchStats.homeCorners++; }
        else { matchStats.awayShots++; matchStats.awayCorners++; }
        pushCornerEvent(minute, attackTeam);
        pushStatEvent(minute, attackTeam, extraShotDelta, '📊 Finalização adicional desviada.');

        // A fraction of corners produce a header chance (set-piece goal). Conversion
        // is moderate, scaled by the aerial target's shooting + physical. The cooldown is
        // re-checked LIVE here (not the minute-start flavorDangerOk) so a corner can't fire in
        // the same minute as a free kick — keeping the spacing and the cap exact.
        if (dangerCount < MAX_DANGER && !nearKeyMinute && (minute - lastFlavorDangerMin >= DANGER_COOLDOWN) && random() < CORNER_CHANCE) {
          lastFlavorDangerMin = minute;
          dangerCount++;
          const cgk = activeGoalkeeper(defendTeam).player;
          const header = getHeaderTarget(attackTeam, sentOff);
          const headerCtx = playerContext(attackTeam, header, attackCtx);
          const hSkill = (getEffectiveAttribute(header, 'shooting', attackCoach, attackChem, activePlayStyleFor(attackTeam), headerCtx)
            + getEffectiveAttribute(header, 'physical', attackCoach, attackChem, activePlayStyleFor(attackTeam), headerCtx)) / 2;
          const cgkRating = goalkeeperShotStoppingRating(
            cgk,
            getEffectiveAttribute(cgk, 'defending', defendCoach, defendChem, activePlayStyleFor(defendTeam), { ...defendCtx, role: 'GK' }),
            cgk.traits,
          );
          const goalChance = headerGoalChance(hSkill, cgkRating);
          const r2 = random();
          if (homeAttacks) matchStats.homeShots++; else matchStats.awayShots++;

          if (r2 < goalChance) {
            if (homeAttacks) { homeGoals++; matchStats.homeShotsOnTarget++; } else { awayGoals++; matchStats.awayShotsOnTarget++; }
            if (playerStats[header.statId!]) { playerStats[header.statId!].goals++; playerStats[header.statId!].rating += 1.4; }
            if (playerStats[cgk.statId!]) playerStats[cgk.statId!].rating -= 0.3;
            const assister = pickWeightedAssister(attackTeam, header.id, playerStats, sentOff);
            if (assister && playerStats[assister.statId!]) { playerStats[assister.statId!].assists++; playerStats[assister.statId!].rating += 0.7; }
            events.push({
              minute, type: 'goal',
              description: cornerGoalDesc(header.shortName, cgk.shortName),
              teamId: attackTeam.id, playerId: header.id, opponentId: cgk.id, assisterId: assister?.id, isSpecial: true,
            });
            const sw = homeAttacks ? GOAL_MOMENTUM_SWING : -GOAL_MOMENTUM_SWING;
            homeMomentum = Math.min(100, Math.max(0, homeMomentum + sw));
            awayMomentum = Math.min(100, Math.max(0, awayMomentum - sw));
            lastKeyCtx = { type: 'goal', teamId: attackTeam.id, atkName: header.shortName, defName: header.shortName, gkName: cgk.shortName, approach: 'cross' };
          } else if (r2 < goalChance + 0.40) {
            if (homeAttacks) { matchStats.homeShotsOnTarget++; matchStats.awaySaves++; } else { matchStats.awayShotsOnTarget++; matchStats.homeSaves++; }
            if (playerStats[cgk.statId!]) { playerStats[cgk.statId!].saves++; playerStats[cgk.statId!].rating += 0.5; }
            events.push({
              minute, type: 'save',
              description: cornerSaveDesc(cgk.shortName, header.shortName),
              teamId: defendTeam.id, playerId: cgk.id, opponentId: header.id,
            });
          } else {
            events.push({
              minute, type: 'miss',
              description: cornerMissDesc(header.shortName),
              teamId: attackTeam.id, playerId: header.id,
            });
          }
        }
      }
      // else: off target — no further stat
      else {
        if (homeAttacks) matchStats.homeShots++; else matchStats.awayShots++;
        pushStatEvent(minute, attackTeam, extraShotDelta, '📊 Finalização adicional para fora.');
      }
    }

    if (isKeyEventMinute && dangerCount < MAX_DANGER) {
      const attackers = attackTeam.players.slice(0, 11).filter(p =>
        !isSentOff(attackTeam, p) && ['ST', 'LW', 'RW', 'CAM'].includes(matchRoleForPlayer(attackTeam, p))
      );
      const defenders = defendTeam.players.slice(0, 11).filter(p =>
        !isSentOff(defendTeam, p) && ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(matchRoleForPlayer(defendTeam, p))
      );

      const activeAttackers = attackTeam.players.slice(0, 11).filter(p => !isSentOff(attackTeam, p));
      const activeDefenders = defendTeam.players.slice(0, 11).filter(p => !isSentOff(defendTeam, p));
      const attacker = attackers.length > 0
        ? pickWeightedAttacker(attackers, p => matchRoleForPlayer(attackTeam, p))
        : activeAttackers[activeAttackers.length - 1] ?? attackTeam.players[10];
      const defender = defenders[Math.floor(random() * defenders.length)] || activeDefenders[0] || defendTeam.players[0];
      const gkInfo = activeGoalkeeper(defendTeam);
      const gk = gkInfo.player;

      // The wide creator must be SOMEONE ELSE — never the attacker himself, or the build-up
      // reads "Fulano cruza para Fulano... Fulano cabeceia" (happens when the attacker is a
      // winger, or in a team with no other wide option). Only the degenerate 1-player team falls back.
      const xiAtk = attackTeam.players.slice(0, 11).filter(p => !isSentOff(attackTeam, p));
      const widePlayer = xiAtk.find(p => p.id !== attacker.id && ['LW', 'RW', 'LM', 'RM'].includes(matchRoleForPlayer(attackTeam, p)))
        || xiAtk.find(p => p.id !== attacker.id && ['CAM', 'CM'].includes(matchRoleForPlayer(attackTeam, p)))
        || xiAtk.find(p => p.id !== attacker.id)
        || attacker;

      let approach: Approach = selectApproach(activePlayStyleFor(attackTeam));
      // Narrow formations (3-5-2 / 5-3-2) cross far less — swap some crosses for
      // central through-balls, which shifts their chances from headers to one-on-ones.
      if ((homeAttacks ? homeProf : awayProf).cross <= -2 && approach === 'cross' && random() < 0.6) {
        approach = 'through';
      }
      const isLuckEvent = random() < 0.04;

      if (isLuckEvent) {
        dangerCount++; // a luck event always resolves into a clear chance (goal / woodwork)
        const randLuck = random();
        // Every luck outcome is an attempt: a goal (on target) or the woodwork. The box
        // score counts it exactly like the replay timeline does.
        if (homeAttacks) matchStats.homeShots++; else matchStats.awayShots++;
        if (randLuck < 0.68) {
          if (homeAttacks) matchStats.homeShotsOnTarget++; else matchStats.awayShotsOnTarget++;
        }

        if (randLuck < 0.15) {
          // Own Goal
          if (homeAttacks) homeGoals++; else awayGoals++;
          if (playerStats[defender.statId!]) playerStats[defender.statId!].rating -= 0.8;
          events.push({
            minute, type: 'goal',
            description: ownGoalDesc(defender.shortName, gk.shortName),
            teamId: attackTeam.id, opponentId: defender.id,
          });
          lastKeyCtx = { type: 'goal', teamId: attackTeam.id, atkName: defender.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
          homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 15) : Math.max(0, homeMomentum - 15);
          awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 15) : Math.min(100, awayMomentum + 15);

        } else if (randLuck < 0.30) {
          // Goalkeeper blunder
          if (homeAttacks) homeGoals++; else awayGoals++;
          if (playerStats[attacker.statId!]) { playerStats[attacker.statId!].goals++; playerStats[attacker.statId!].rating += 1.2; }
          if (playerStats[gk.statId!]) playerStats[gk.statId!].rating -= 1.0;
          events.push({
            minute, type: 'goal',
            description: frangoDesc(attacker.shortName, gk.shortName),
            teamId: attackTeam.id, playerId: attacker.id, opponentId: gk.id,
          });
          lastKeyCtx = { type: 'goal', teamId: attackTeam.id, atkName: attacker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
          homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 15) : Math.max(0, homeMomentum - 15);
          awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 15) : Math.min(100, awayMomentum + 15);

        } else if (randLuck < 0.50) {
          // Deflected goal
          if (homeAttacks) homeGoals++; else awayGoals++;
          if (playerStats[attacker.statId!]) { playerStats[attacker.statId!].goals++; playerStats[attacker.statId!].rating += 1.2; }
          if (playerStats[defender.statId!]) playerStats[defender.statId!].rating -= 0.3;
          events.push({
            minute, type: 'goal',
            description: deflectedDesc(attacker.shortName, defender.shortName),
            teamId: attackTeam.id, playerId: attacker.id, opponentId: defender.id,
          });
          lastKeyCtx = { type: 'goal', teamId: attackTeam.id, atkName: attacker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
          homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 15) : Math.max(0, homeMomentum - 15);
          awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 15) : Math.min(100, awayMomentum + 15);

        } else if (randLuck < 0.68) {
          // Long-range screamer
          if (homeAttacks) homeGoals++; else awayGoals++;
          if (playerStats[attacker.statId!]) { playerStats[attacker.statId!].goals++; playerStats[attacker.statId!].rating += 1.6; }
          events.push({
            minute, type: 'goal',
            description: screamedDesc(attacker.shortName, gk.shortName),
            teamId: attackTeam.id, playerId: attacker.id, opponentId: gk.id, isSpecial: true,
          });
          lastKeyCtx = { type: 'goal', teamId: attackTeam.id, atkName: attacker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
          homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 20) : Math.max(0, homeMomentum - 20);
          awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 20) : Math.min(100, awayMomentum + 20);

        } else {
          // Woodwork
          if (playerStats[attacker.statId!]) { playerStats[attacker.statId!].shots++; playerStats[attacker.statId!].rating += 0.1; }
          events.push({
            minute, type: 'miss',
            description: woodworkDesc(attacker.shortName, defender.shortName),
            teamId: attackTeam.id, playerId: attacker.id,
          });
          lastKeyCtx = { type: 'miss', teamId: attackTeam.id, atkName: attacker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
          homeMomentum = homeAttacks ? Math.min(95, homeMomentum + 4) : Math.max(5, homeMomentum - 4);
          awayMomentum = homeAttacks ? Math.max(5, awayMomentum - 4) : Math.min(95, awayMomentum + 4);
        }
      } else {
        // Normal event — push build-up first, then resolve
        events.push({
          minute, type: 'momentum',
          description: buildUpDesc(approach, attacker.shortName, defender.shortName, widePlayer.shortName, attackTeam.name),
          teamId: attackTeam.id,
        });

        const attackerCtx = playerContext(attackTeam, attacker, attackCtx);
        const defenderCtx = playerContext(defendTeam, defender, defendCtx);
        const gkCtx = { ...defendCtx, role: 'GK' };
        const atkShooting = getEffectiveAttribute(attacker, 'shooting', attackCoach, attackChem, activePlayStyleFor(attackTeam), attackerCtx);
        const atkPace = getEffectiveAttribute(attacker, 'pace', attackCoach, attackChem, activePlayStyleFor(attackTeam), attackerCtx);
        const atkDribbling = getEffectiveAttribute(attacker, 'dribbling', attackCoach, attackChem, activePlayStyleFor(attackTeam), attackerCtx);
        const defDefending = getEffectiveAttribute(defender, 'defending', defendCoach, defendChem, activePlayStyleFor(defendTeam), defenderCtx);
        const defPhysical = getEffectiveAttribute(defender, 'physical', defendCoach, defendChem, activePlayStyleFor(defendTeam), defenderCtx);

        // Trait effects are already baked into the effective attributes above
        // (see getEffectiveAttribute + trait catalog), so no extra bonuses here.
        // Player playmaking still affects the quality of the build-up: a good midfield creates a
        // cleaner entry independent of the formation axis. Formation/tactic axes then do only
        // what their names promise: ATTACK raises own chance danger and DEFENSE suppresses the
        // danger of the opponent's chance. CONTROL already decided who generated more sequences.
        const atkProf = homeAttacks ? homeProf : awayProf;
        const defProf = homeAttacks ? awayProf : homeProf;
        const atkTac = homeAttacks ? homeTac : awayTac;
        const defTac = homeAttacks ? awayTac : homeTac;
        const formMod = tacticalChanceDangerModifier({
          attackingFormationAttack: atkProf.attack,
          attackingTacticAttack: atkTac.attack,
          defendingFormationDefense: defProf.defense,
          defendingTacticDefense: defTac.defense,
        });
        const buildUp = midfieldBuildUpEdge(homeAttacks ? homeMid : awayMid, homeAttacks ? awayMid : homeMid, activePlayStyleFor(attackTeam)) + formMod;
        const chance = resolveOpenPlayChance({
          atkShooting, atkPace, atkDribbling, defDefending, defPhysical, buildUp,
          gkRating: goalkeeperShotStoppingRating(
            gk,
            getEffectiveAttribute(gk, 'defending', defendCoach, defendChem, activePlayStyleFor(defendTeam), gkCtx),
            gk.traits,
          ),
          approach,
        });

        if (chance.outcome !== 'duel') {
          dangerCount++; // a shot (goal / save / miss) is a clear chance — counts toward the cap
          if (homeAttacks) matchStats.homeShots++; else matchStats.awayShots++;
          if (playerStats[attacker.statId!]) playerStats[attacker.statId!].shots++;

          if (chance.outcome !== 'miss') {
            if (homeAttacks) matchStats.homeShotsOnTarget++; else matchStats.awayShotsOnTarget++;

            if (chance.outcome === 'goal') {
              if (homeAttacks) homeGoals++; else awayGoals++;

              homeMomentum = homeAttacks ? Math.min(100, homeMomentum + GOAL_MOMENTUM_SWING) : Math.max(0, homeMomentum - GOAL_MOMENTUM_SWING);
              awayMomentum = homeAttacks ? Math.max(0, awayMomentum - GOAL_MOMENTUM_SWING) : Math.min(100, awayMomentum + GOAL_MOMENTUM_SWING);

              if (playerStats[attacker.statId!]) { playerStats[attacker.statId!].goals++; playerStats[attacker.statId!].shotsOnTarget++; playerStats[attacker.statId!].rating += 1.4; }
              if (playerStats[gk.statId!]) playerStats[gk.statId!].rating -= 0.3;
              defendTeam.players.slice(0, 11).forEach(p => {
                if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(matchRoleForPlayer(defendTeam, p)) && playerStats[p.statId!]) {
                  playerStats[p.statId!].rating -= 0.1;
                }
              });

              const assister = pickWeightedAssister(attackTeam, attacker.id, playerStats, sentOff);
              if (assister && playerStats[assister.statId!]) {
                playerStats[assister.statId!].assists++;
                playerStats[assister.statId!].rating += 0.8;
              }

              const atkGoals = homeAttacks ? homeGoals : awayGoals;
              const defGoals = homeAttacks ? awayGoals : homeGoals;
              const isImmortal = attacker.rarity === 'immortal';

              events.push({
                minute, type: 'goal',
                description: goalDesc(approach, attacker.shortName, assister?.shortName ?? null, defender.shortName, gk.shortName, homeGoals, awayGoals, minute, atkGoals, defGoals, isImmortal),
                teamId: attackTeam.id, playerId: attacker.id, opponentId: defender.id,
                assisterId: assister?.id,
                isSpecial: isImmortal || attacker.traits.includes('Frio na Final'),
              });
              lastKeyCtx = { type: 'goal', teamId: attackTeam.id, atkName: attacker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };

            } else {
              if (homeAttacks) matchStats.awaySaves++; else matchStats.homeSaves++;
              if (playerStats[gk.statId!]) { playerStats[gk.statId!].saves++; playerStats[gk.statId!].rating += 0.45; }
              // A shot on target forcing a save is a positive contribution, not a blemish.
              if (playerStats[attacker.statId!]) { playerStats[attacker.statId!].shotsOnTarget++; playerStats[attacker.statId!].rating += 0.05; }
              // Whoever played the killer ball gets a key pass (rewards creators/midfield).
              const creatorS = pickWeightedAssister(attackTeam, attacker.id, playerStats, sentOff);
              if (creatorS && playerStats[creatorS.statId!]) { playerStats[creatorS.statId!].keyPasses++; playerStats[creatorS.statId!].rating += 0.25; }

              const isCorner = random() < 0.4;
              if (isCorner) {
                if (homeAttacks) matchStats.homeCorners++; else matchStats.awayCorners++;
                pushCornerEvent(minute, attackTeam);
              }

              events.push({
                minute, type: 'save',
                description: saveDesc(approach, gk.shortName, attacker.shortName, isCorner),
                teamId: defendTeam.id, playerId: gk.id, opponentId: attacker.id, isCorner,
              });
              lastKeyCtx = { type: 'save', teamId: defendTeam.id, atkName: attacker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
            }
          } else {
            if (playerStats[attacker.statId!]) playerStats[attacker.statId!].rating -= 0.1;
            // The chance was still created — credit the supplier with a key pass.
            const creatorM = pickWeightedAssister(attackTeam, attacker.id, playerStats, sentOff);
            if (creatorM && playerStats[creatorM.statId!]) { playerStats[creatorM.statId!].keyPasses++; playerStats[creatorM.statId!].rating += 0.15; }
            events.push({
              minute, type: 'miss',
              description: missDesc(approach, attacker.shortName, defender.shortName, gk.shortName),
              teamId: attackTeam.id, playerId: attacker.id,
            });
            lastKeyCtx = { type: 'miss', teamId: attackTeam.id, atkName: attacker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
          }
        } else {
          // Defensive stop — attributed to a tackle or an interception (both tracked).
          if (playerStats[defender.statId!]) {
            if (random() < 0.5) playerStats[defender.statId!].tackles++;
            else playerStats[defender.statId!].interceptions++;
            playerStats[defender.statId!].rating += 0.32;
          }
          if (playerStats[attacker.statId!]) playerStats[attacker.statId!].rating -= 0.12;
          events.push({
            minute, type: 'duel',
            description: duelDesc(approach, defender.shortName, attacker.shortName),
            teamId: defendTeam.id, playerId: defender.id, opponentId: attacker.id,
          });
          lastKeyCtx = { type: 'duel', teamId: defendTeam.id, atkName: attacker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
          if (homeAttacks) homeMomentum = Math.max(0, homeMomentum - 5);
          else awayMomentum = Math.max(0, awayMomentum - 5);
        }
      }
    } else {
      if (random() < 0.30) {
        const homePossesses = random() < (homeMomentum / 100);
        const possessTeam = homePossesses ? home : away;
        const dTeam = homePossesses ? away : home;

        const midPlayers = possessTeam.players.slice(0, 11).filter(p => ['CM', 'CDM', 'CAM', 'LM', 'RM'].includes(matchRoleForPlayer(possessTeam, p)));
        const defPlayers = dTeam.players.slice(0, 11).filter(p => ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(matchRoleForPlayer(dTeam, p)));

        const playerA = midPlayers[Math.floor(random() * midPlayers.length)] || possessTeam.players[5];
        const defenderA = defPlayers[Math.floor(random() * defPlayers.length)] || dTeam.players[2];

        const coach = COACHES.find(c => c.id === possessTeam.coachId);

        const desc = flowDesc(
          lastKeyCtx,
          possessTeam.name,
          possessTeam.id,
          playerA.shortName,
          defenderA.shortName,
          activePlayStyleFor(possessTeam),
          coach?.id ?? '',
          dTeam.name,
          homeGoals,
          awayGoals,
        );

        events.push({
          minute, type: 'momentum',
          description: desc,
          teamId: possessTeam.id,
          playerId: playerA.id,
        });

        if (homePossesses) homeMomentum = Math.min(95, homeMomentum + 2);
        else homeMomentum = Math.max(5, homeMomentum - 2);
      }
    }
  }
  if (endMinute > startMinute) flushRatingDelta();

  // Determine winner
  let winner: string | null = null;
  let penaltyWinner: string | undefined;
  let homePenalties: number | undefined;
  let awayPenalties: number | undefined;

  // Winner determination, bonuses, and MVP are skipped when decideWinner=false
  // (used by simulateMatch to run 0→90 without prematurely triggering penalties,
  //  then call again for 90→120 extra time if needed).
  let penaltyKicks: PenaltyKick[] | undefined;

  if (decideWinner) {
    if (homeGoals > awayGoals) winner = home.id;
    else if (awayGoals > homeGoals) winner = away.id;
    else if (isKnockout) {
      const pRes = simulatePenalties(home, away, playerStats, homePlayStyle, awayPlayStyle, { isFinal, neutralVenue: neutralFinal });
      penaltyKicks = pRes.kicks;
      penaltyWinner = pRes.winner;
      homePenalties = pRes.homeScore;
      awayPenalties = pRes.awayScore;
      winner = pRes.winner;
      events.push({
        minute: endMinute,
        type: 'penalty',
        description: `🎯 Pênaltis! ${home.name} ${pRes.homeScore}-${pRes.awayScore} ${away.name}`,
        teamId: pRes.winner,
      });
      home.players.slice(0, 5).forEach(p => { if (playerStats[p.statId!]) playerStats[p.statId!].rating += 0.1; });
      away.players.slice(0, 5).forEach(p => { if (playerStats[p.statId!]) playerStats[p.statId!].rating += 0.1; });
    }

    // Clean sheet bonuses
    if (awayGoals === 0) {
      home.players.slice(0, 11).forEach(p => {
        const role = matchRoleForPlayer(home, p);
        if (role === 'GK' && playerStats[p.statId!]) playerStats[p.statId!].rating += 0.8;
        else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(role) && playerStats[p.statId!]) playerStats[p.statId!].rating += 0.4;
      });
    }
    if (homeGoals === 0) {
      away.players.slice(0, 11).forEach(p => {
        const role = matchRoleForPlayer(away, p);
        if (role === 'GK' && playerStats[p.statId!]) playerStats[p.statId!].rating += 0.8;
        else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(role) && playerStats[p.statId!]) playerStats[p.statId!].rating += 0.4;
      });
    }

    // Win/loss adjustments
    const homeStarters = home.players.slice(0, 11);
    const awayStarters = away.players.slice(0, 11);
    if (winner === home.id) {
      homeStarters.forEach(p => { if (playerStats[p.statId!]) playerStats[p.statId!].rating += 0.3; });
      awayStarters.forEach(p => { if (playerStats[p.statId!]) playerStats[p.statId!].rating -= 0.2; });
    } else if (winner === away.id) {
      awayStarters.forEach(p => { if (playerStats[p.statId!]) playerStats[p.statId!].rating += 0.3; });
      homeStarters.forEach(p => { if (playerStats[p.statId!]) playerStats[p.statId!].rating -= 0.2; });
    }

    // Clamp and format ratings
    [...homeStarters, ...awayStarters].forEach(p => {
      if (playerStats[p.statId!]) {
        const finalR = Math.min(10.0, Math.max(3.0, playerStats[p.statId!].rating));
        playerStats[p.statId!].rating = parseFloat(finalR.toFixed(1));
      }
    });
  }

  const allStarters = [...home.players.slice(0, 11), ...away.players.slice(0, 11)];
  const mvpId = allStarters.length > 0
    ? allStarters.reduce((best, p) =>
        (playerStats[p.statId!]?.rating ?? 6.0) > (playerStats[best.statId!]?.rating ?? 6.0) ? p : best,
        allStarters[0]
      ).id
    : '';

  // Real possession (was hardcoded 50/50): strength + chance share + the final active tactic.
  const homeBaseStr = calculateTeamStrength(home, homeCoach, homeChem, homeFormBonus);
  const awayBaseStr = calculateTeamStrength(away, awayCoach, awayChem, awayFormBonus);
  const possessionModel = { homeStrength: homeBaseStr, awayStrength: awayBaseStr, homeShapeControl: homeProf.control, awayShapeControl: awayProf.control };
  matchStats.homePos = computePossession(
    homeBaseStr, awayBaseStr, matchStats.homeShots, matchStats.awayShots,
    homePlayStyle, awayPlayStyle,
    homeProf.control + tacticProfile(homePlayStyle).control,
    awayProf.control + tacticProfile(awayPlayStyle).control,
  );
  matchStats.awayPos = 100 - matchStats.homePos;

  return {
    homeTeamId: home.id,
    awayTeamId: away.id,
    homeGoals,
    awayGoals,
    events,
    winner,
    penaltyWinner,
    homePenalties,
    awayPenalties,
    penaltyKicks,
    mvp: mvpId,
    stats: matchStats,
    playerStats,
    possessionModel,
  };
}

// Direct free-kick conversion chance — the taker's shooting AND composure against the keeper's
// effective shot-stopping (≈6–8% for typical takers, so free kicks stay rare). No ceiling: a
// better taker always converts more, a better keeper always saves more. Exported so the balance
// suite can assert composure actually moves the needle (it's too rare to sample in-sim).
export function freeKickGoalChance(shooting: number, composure: number, gkRating: number): number {
  const skill = (shooting + composure) / 2;
  return edgeChance(skill - gkRating + FREE_KICK_EDGE, SET_PIECE_SCALE);
}

// Corner header conversion — the aerial target's (shooting + physical) / 2 against the keeper
// (≈8–10% for typical targets).
export function headerGoalChance(headerSkill: number, gkRating: number): number {
  return edgeChance(headerSkill - gkRating + HEADER_EDGE, SET_PIECE_SCALE);
}

// Penalty conversion chance — a DIFFERENCE model (taker composure vs keeper shot-stopping)
// instead of a ratio, which used to saturate ~70% for everyone. `comp` already includes the
// designated +5 and penalty traits (Cobrador +8, Frio na Final / Especialista +10 each), so a
// real taker sits ≈90 (plain) to ≈120 (full specialist), and characteristics can push it further.
// gkRef is the keeper's EFFECTIVE shot-stopping (chemistry, coach, captain, traits…), ≈100–110
// for real keepers. A designated taker converts ≈76% and a whole shootout ≈72%, as in real
// football; ~0.9% per point of composure or of keeper around there, with no ceiling either way.
export function penaltyGoalChance(comp: number, gkRef: number): number {
  return edgeChance(comp - gkRef + PENALTY_EDGE, PENALTY_SCALE);
}

export function simulateMatch(
  home: Team,
  away: Team,
  isKnockout: boolean = false,
  isFinal: boolean = false,
  resolveKnockoutTie: boolean = true,
  neutralFinal: boolean = isFinal,
): MatchResult {
  setStatIds(home, away);
  const playerStats: Record<string, PlayerMatchStat> = {};

  const initStatsForTeam = (team: Team) => {
    team.players.slice(0, 11).forEach(p => {
      playerStats[(p as PlayerCard).statId!] = {
        playerId: p.id,
        playerName: p.shortName,
        teamId: team.id,
        rating: 6.4,
        goals: 0,
        assists: 0,
        shots: 0,
        tackles: 0,
        saves: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
        keyPasses: 0,
        interceptions: 0,
        shotsOnTarget: 0,
      };
    });
  };
  initStatsForTeam(home);
  initStatsForTeam(away);

  const baseHomePos = Math.round(50);
  const initialStats = {
    homePos: baseHomePos,
    awayPos: 100 - baseHomePos,
    homeShots: 0,
    awayShots: 0,
    homeShotsOnTarget: 0,
    awayShotsOnTarget: 0,
    homeFouls: 0,
    awayFouls: 0,
    homeSaves: 0,
    awaySaves: 0,
    homeCorners: 0,
    awayCorners: 0,
  };

  // Phase 1: run 90 minutes WITHOUT deciding the winner yet (no penalties, no bonuses).
  // Keep the real phase context here. Two-legged ties pass resolveKnockoutTie=false so
  // a draw in the return leg can still be compared against the aggregate before ET.
  const r90 = runMatchSimulation(home, away, 0, 90, 0, 0, [], initialStats, playerStats, isKnockout, isFinal, false, neutralFinal);

  if (isKnockout && resolveKnockoutTie && r90.homeGoals === r90.awayGoals) {
    // Tied at 90 → extra time (90→120). Winner determination + penalties handled inside.
    const rET = runMatchSimulation(home, away, 90, 120, r90.homeGoals, r90.awayGoals, r90.events, r90.stats, playerStats, true, isFinal, true, neutralFinal);
    rET.durationMinutes = 120;
    return rET;
  }

  // Match decided in 90 minutes — or intentionally left level for aggregate resolution.
  // Apply winner/bonuses manually on the existing result.
  const hg = r90.homeGoals;
  const ag = r90.awayGoals;
  r90.winner = hg > ag ? home.id : ag > hg ? away.id : null;
  r90.durationMinutes = 90;

  // Clean sheet bonuses
  if (ag === 0) home.players.slice(0, 11).forEach(p => {
    if (!playerStats[p.statId!]) return;
    const role = matchRoleForPlayer(home, p);
    if (role === 'GK') playerStats[p.statId!].rating += 0.8;
    else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(role)) playerStats[p.statId!].rating += 0.4;
  });
  if (hg === 0) away.players.slice(0, 11).forEach(p => {
    if (!playerStats[p.statId!]) return;
    const role = matchRoleForPlayer(away, p);
    if (role === 'GK') playerStats[p.statId!].rating += 0.8;
    else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(role)) playerStats[p.statId!].rating += 0.4;
  });

  // Win/loss adjustments
  const hs = home.players.slice(0, 11);
  const as_ = away.players.slice(0, 11);
  if (r90.winner === home.id) {
    hs.forEach(p => { if (playerStats[p.statId!]) playerStats[p.statId!].rating += 0.3; });
    as_.forEach(p => { if (playerStats[p.statId!]) playerStats[p.statId!].rating -= 0.2; });
  } else if (r90.winner === away.id) {
    as_.forEach(p => { if (playerStats[p.statId!]) playerStats[p.statId!].rating += 0.3; });
    hs.forEach(p => { if (playerStats[p.statId!]) playerStats[p.statId!].rating -= 0.2; });
  }

  // Clamp ratings and set MVP
  [...hs, ...as_].forEach(p => {
    if (playerStats[p.statId!]) {
      playerStats[p.statId!].rating = parseFloat(Math.min(10, Math.max(3, playerStats[p.statId!].rating)).toFixed(1));
    }
  });
  // Expulso não pode ser MVP (a não ser que sobre ninguém).
  const notSentOff = [...hs, ...as_].filter(p => (playerStats[p.statId!]?.redCards ?? 0) === 0);
  const r90Starters = notSentOff.length > 0 ? notSentOff : [...hs, ...as_];
  r90.mvp = r90Starters.length > 0
    ? r90Starters.reduce((best, p) =>
        (playerStats[p.statId!]?.rating ?? 6) > (playerStats[best.statId!]?.rating ?? 6) ? p : best,
        r90Starters[0]
      ).id
    : '';
  r90.playerStats = playerStats;

  return r90;
}
