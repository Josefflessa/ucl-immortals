// UCL Immortals — Game Engine
// Match simulation, chemistry calculation, draft logic

import {
  Player, Coach, Formation,
  PLAYERS, COACHES, FORMATIONS, HISTORICAL_TRIOS,
  getPositionGroup,
} from './gameData';
import {
  selectApproach, buildUpDesc, goalDesc, ownGoalDesc, saveDesc, missDesc, duelDesc,
  frangoDesc, screamedDesc, deflectedDesc, woodworkDesc,
  penaltyGoalDesc, penaltySaveDesc, penaltyMissDesc,
  flowDesc, Approach, LastKeyCtx,
} from './matchNarrative';
import {
  AttrKey, getTraitAttributeBonus, getGoalkeeperTraitBonus,
  getPenaltyComposureBonus, hasOopRelief, ROLLABLE_TRAITS,
} from './traits';

// ============================================================
// TYPES
// ============================================================
export interface PlayerCard extends Player {
  chemistryScore: number; // 0-3
  isOOP: boolean;
}

export interface Team {
  id: string;
  name: string;
  coachId: string;
  formationId: string;
  playStyle: string;
  players: PlayerCard[]; // 11 titulares
  captain?: string;
  penaltyTaker?: string;
  totalChemistry: number;
  isBot: boolean;
  botStrength?: number;
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'save' | 'miss' | 'duel' | 'sub' | 'penalty' | 'foul' | 'momentum' | 'yellow' | 'red';
  description: string;
  teamId: string;
  playerId?: string;
  opponentId?: string;
  assisterId?: string;
  isSpecial?: boolean;
}

export interface PlayerMatchStat {
  playerId: string;
  playerName: string;
  teamId: string;
  rating: number;
  goals: number;
  assists: number;
  shots: number;
  tackles: number;
  saves: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
}

export interface PenaltyKick {
  teamId: string;
  takerName: string;
  gkName: string;
  isGoal: boolean;
}

export interface MatchResult {
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
  events: MatchEvent[];
  winner: string | null; // null = draw
  penaltyWinner?: string;
  homePenalties?: number;
  awayPenalties?: number;
  penaltyKicks?: PenaltyKick[]; // kick-by-kick sequence for client replay
  durationMinutes?: number; // 90 (league/first leg) or 120 (extra time)
  mvp?: string;
  topDuel?: { attacker: string; defender: string; winner: string };
  stats: {
    homePos: number;
    awayPos: number;
    homeShots: number;
    awayShots: number;
    homeShotsOnTarget: number;
    awayShotsOnTarget: number;
    homeFouls: number;
    awayFouls: number;
    homeSaves: number;
    awaySaves: number;
    homeCorners: number;
    awayCorners: number;
  };
  playerStats?: Record<string, PlayerMatchStat>;
}

export interface StandingsEntry {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface DraftState {
  round: number;
  totalRounds: number;
  currentOptions: Player[];
  selectedPlayers: Player[];
  vetoesLeft: number;
  formationId: string;
  coachId: string;
  neededPositions: string[];
}

// ============================================================
// CHEMISTRY ENGINE
// ============================================================
// Check whether a player fits a formation position (native or secondary)
export function isPlayerInPosition(player: Player, formationRole: string): boolean {
  if (player.position === formationRole) return true;
  if (player.secondaryPositions?.includes(formationRole)) return true;
  return false;
}

export function calculateChemistry(
  players: Player[],
  coachId: string,
  formationRoles?: string[], // ordered list matching players array
): {
  individual: Record<string, number>;
  total: number;
  trios: string[];
  outOfPosition: Record<string, boolean>;
} {
  const individual: Record<string, number> = {};
  const outOfPosition: Record<string, boolean> = {};
  const trios: string[] = [];

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const formationRole = formationRoles?.[i];

    // If we know the formation role, check if player fits it
    const isOOP = formationRole ? !isPlayerInPosition(player, formationRole) : false;
    outOfPosition[player.id] = isOOP;

    // Out-of-position players are forced to chemistry=0
    if (isOOP) {
      individual[player.id] = 0;
      continue;
    }

    let score = 0;

    for (const other of players) {
      if (other.id === player.id) continue;

      // Same club
      if (player.club === other.club) score += 2;
      // Same nation
      else if (player.nation === other.nation) score += 1;
      // Same historical coach
      else if (
        player.historicalCoaches?.includes(coachId) &&
        other.historicalCoaches?.includes(coachId)
      ) score += 2;
      // Historical partners
      else if (player.historicalPartners?.includes(other.id)) score += 1;
    }

    // Coach bond
    if (player.historicalCoaches?.includes(coachId)) score += 1;

    individual[player.id] = Math.min(3, Math.round(score / 3));
  }

  // Check historical trios
  const playerIds = players.map(p => p.id);
  for (const trio of HISTORICAL_TRIOS) {
    if (trio.playerIds.every(id => playerIds.includes(id))) {
      trios.push(trio.id);
    }
  }

  // Total chemistry (0-100)
  const baseTotal = Object.values(individual).reduce((sum, v) => sum + v, 0);
  const maxPossible = players.length * 3;
  const trioBonus = trios.reduce((sum, trioId) => {
    const trio = HISTORICAL_TRIOS.find(t => t.id === trioId);
    return sum + (trio?.chemBonus ?? 0);
  }, 0);

  const total = Math.min(100, Math.round((baseTotal / maxPossible) * 80) + trioBonus);

  return { individual, total, trios, outOfPosition };
}

// ============================================================
// EFFECTIVE STATS CALCULATOR (for display in UI)
// ============================================================
export interface EffectiveStats {
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  chemScore: number;
  isOOP: boolean;
  overallMod: number; // positive or negative delta vs base
  activeCoachEffects: string[];
}

export function getCoachModifiersForPlayer(
  player: Player,
  coachId: string,
  context?: {
    isKnockout?: boolean;
    isFinal?: boolean;
    isLosing?: boolean;
    role?: string;
  }
): {
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  composure: number;
  vision: number;
  activeEffects: string[];
} {
  const isKnockout = context?.isKnockout ?? false;
  const isFinal = context?.isFinal ?? false;
  const isLosing = context?.isLosing ?? false;
  const role = context?.role ?? player.position;

  const modifiers = {
    overall: 0,
    pace: 0,
    shooting: 0,
    passing: 0,
    dribbling: 0,
    defending: 0,
    physical: 0,
    composure: 0,
    vision: 0,
    activeEffects: [] as string[],
  };

  const coach = COACHES.find(c => c.id === coachId);
  if (!coach) return modifiers;

  // Add the base bonuses from the bonuses array
  for (const bonus of coach.bonuses) {
    if (bonus.phase === 'Todos') {
      const val = bonus.value;
      if (bonus.attribute === 'all') {
        modifiers.overall += val;
        modifiers.pace += val;
        modifiers.shooting += val;
        modifiers.passing += val;
        modifiers.dribbling += val;
        modifiers.defending += val;
        modifiers.physical += val;
        modifiers.composure += val;
        modifiers.vision += val;
      } else {
        const attr = bonus.attribute as keyof typeof modifiers;
        if (attr in modifiers && attr !== 'activeEffects') {
          (modifiers[attr] as number) += val;
        }
      }
    }
  }

  // Active conditional effects
  const pos = role || player.position;
  const isMidfielder = ['CDM', 'CM', 'CAM', 'LM', 'RM'].includes(pos);
  const isDefender = ['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(pos);
  const isGK = pos === 'GK';

  if (coachId === 'guardiola') {
    if (isMidfielder) {
      modifiers.passing += 5;
      modifiers.vision += 5;
      modifiers.activeEffects.push("DNA Guardiola: +5 Passe/Visão (MC)");
    }
    if (player.vision >= 80) {
      const b = 3;
      modifiers.overall += b;
      modifiers.pace += b;
      modifiers.shooting += b;
      modifiers.passing += b;
      modifiers.dribbling += b;
      modifiers.defending += b;
      modifiers.physical += b;
      modifiers.composure += b;
      modifiers.vision += b;
      modifiers.activeEffects.push("Visão de Jogo: +3 Geral");
    }
  } else if (coachId === 'klopp') {
    if (isLosing) {
      const b = 8;
      modifiers.overall += b;
      modifiers.pace += b;
      modifiers.shooting += b;
      modifiers.passing += b;
      modifiers.dribbling += b;
      modifiers.defending += b;
      modifiers.physical += b;
      modifiers.composure += b;
      modifiers.vision += b;
      modifiers.activeEffects.push("Gegenpressing: +8 Geral");
    }
  } else if (coachId === 'mourinho') {
    if (isGK) {
      modifiers.defending += 5;
      modifiers.activeEffects.push("Goleiro Mourinho: +5 Defesa");
    }
    if (isKnockout && isDefender) {
      modifiers.defending += 10;
      modifiers.activeEffects.push("Muralha Mourinho: +10 Defesa");
    }
  } else if (coachId === 'ancelotti') {
    if (player.overall >= 85) {
      const b = 4;
      modifiers.overall += b;
      modifiers.pace += b;
      modifiers.shooting += b;
      modifiers.passing += b;
      modifiers.dribbling += b;
      modifiers.defending += b;
      modifiers.physical += b;
      modifiers.composure += b;
      modifiers.vision += b;
      modifiers.activeEffects.push("Gestão de Estrelas: +4 Geral");
    }
    if (isFinal) {
      const b = 6;
      modifiers.overall += b;
      modifiers.pace += b;
      modifiers.shooting += b;
      modifiers.passing += b;
      modifiers.dribbling += b;
      modifiers.defending += b;
      modifiers.physical += b;
      modifiers.composure += b;
      modifiers.vision += b;
      modifiers.activeEffects.push("Mentalidade Decisiva: +6 Geral");
    }
  } else if (coachId === 'zidane') {
    if (player.rarity === 'legendary' || player.rarity === 'immortal') {
      let b = 5;
      let label = "Galácticos Zidane: +5 Geral";
      if (isFinal) {
        b = 10;
        label = "Rei da Final: +10 Geral";
      } else if (isKnockout) {
        b = 7;
        label = "Rei do Mata-Mata: +7 Geral";
      }
      modifiers.overall += b;
      modifiers.pace += b;
      modifiers.shooting += b;
      modifiers.passing += b;
      modifiers.dribbling += b;
      modifiers.defending += b;
      modifiers.physical += b;
      modifiers.composure += b;
      modifiers.vision += b;
      modifiers.activeEffects.push(label);
    }
  } else if (coachId === 'ferguson') {
    if (isLosing) {
      const b = 10;
      modifiers.overall += b;
      modifiers.pace += b;
      modifiers.shooting += b;
      modifiers.passing += b;
      modifiers.dribbling += b;
      modifiers.defending += b;
      modifiers.physical += b;
      modifiers.composure += b;
      modifiers.vision += b;
      modifiers.activeEffects.push("Fergie Time: +10 Geral");
    }
  }

  return modifiers;
}

export function getPlayerEffectiveStats(
  player: Player,
  chemScore: number, // 0-3 individual chem
  isOOP: boolean,
  coachId: string,
  teamChemTotal: number,
  context?: {
    isKnockout?: boolean;
    isFinal?: boolean;
    isLosing?: boolean;
    role?: string;
  }
): EffectiveStats {
  const effectiveChem = isOOP ? 0 : chemScore;
  const chemMult = isOOP ? 0.85 : (effectiveChem === 3 ? 1.10 : effectiveChem === 2 ? 1.06 : effectiveChem === 1 ? 1.03 : 1.00);

  const applyMult = (base: number) => Math.round(base * chemMult);

  const modifiers = getCoachModifiersForPlayer(player, coachId, context);

  const eff = (base: number, mod: number) => Math.max(1, applyMult(base) + mod);

  const pace      = eff(player.pace, modifiers.pace);
  const shooting  = eff(player.shooting, modifiers.shooting);
  const passing   = eff(player.passing, modifiers.passing);
  const dribbling = eff(player.dribbling, modifiers.dribbling);
  const defending = eff(player.defending, modifiers.defending);
  const physical  = eff(player.physical, modifiers.physical);

  const effectiveOverall = Math.max(1, Math.round(player.overall * chemMult) + modifiers.overall);
  const baseOverall = player.overall;
  const overallMod = effectiveOverall - baseOverall;

  return {
    overall: effectiveOverall,
    pace,
    shooting,
    passing,
    dribbling,
    defending,
    physical,
    chemScore: effectiveChem,
    isOOP,
    overallMod,
    activeCoachEffects: modifiers.activeEffects,
  };
}

export function getChemistryBonus(total: number): { passing: number; pace: number; special: boolean } {
  if (total >= 90) return { passing: 3, pace: 2, special: true };
  if (total >= 75) return { passing: 2, pace: 1, special: false };
  if (total >= 60) return { passing: 1, pace: 1, special: false };
  if (total >= 45) return { passing: 1, pace: 0, special: false };
  return { passing: 0, pace: 0, special: false };
}

// ============================================================
// ATTRIBUTE RESOLVER
// ============================================================
export function getEffectiveAttribute(
  player: PlayerCard,
  attribute: keyof Player,
  coach: Coach,
  phase: string,
  chemBonus: { passing: number; pace: number; special: boolean },
  playStyle: string,
  context?: {
    isKnockout?: boolean;
    isFinal?: boolean;
    isLosing?: boolean;
  }
): number {
  let base = player[attribute] as number;

  // Individual chemistry bonus: If OOP, apply a stats debuff (softened by the
  // "Versatilidade" trait). If not, apply standard chemistry multipliers (+0% / +3% / +6% / +10%)
  const oopMult = hasOopRelief(player.traits) ? 0.92 : 0.85;
  const chemMult = player.isOOP ? oopMult : (player.chemistryScore >= 3 ? 1.10 : player.chemistryScore === 2 ? 1.06 : player.chemistryScore === 1 ? 1.03 : 1.00);
  base = Math.round(base * chemMult);

  // Chemistry global bonus (passing & pace)
  if (attribute === 'passing') base += chemBonus.passing * 2;
  if (attribute === 'pace') base += chemBonus.pace * 2;

  // Coach bonuses (using the new unified modifiers function)
  const modifiers = getCoachModifiersForPlayer(player, coach.id, {
    isKnockout: context?.isKnockout,
    isFinal: context?.isFinal,
    isLosing: context?.isLosing,
    role: player.position,
  });

  const mod = modifiers[attribute as keyof typeof modifiers] as number || 0;
  base += mod;

  // Play style modifiers
  if (playStyle === 'possession' && (attribute === 'passing' || attribute === 'vision')) base += 5;
  if (playStyle === 'counter' && (attribute === 'pace' || attribute === 'shooting')) base += 5;
  if (playStyle === 'high_press' && attribute === 'physical') base += 5;
  if (playStyle === 'defensive' && attribute === 'defending') base += 8;
  if (playStyle === 'all_out_attack' && attribute === 'shooting') base += 8;

  // Trait attribute bonuses (data-driven from the trait catalog)
  base += getTraitAttributeBonus(player.traits, attribute as AttrKey, context);

  return Math.max(1, base);
}

// ============================================================
// MATCH ENGINE
// ============================================================

/** Pick a weighted random attacker — ST/CF get higher weight */
function pickWeightedAttacker(players: PlayerCard[]): PlayerCard {
  const weighted: { player: PlayerCard; weight: number }[] = players.map(p => {
    let weight = 1;
    if (p.position === 'ST' || p.position === 'CF') weight = 5;
    else if (p.position === 'LW' || p.position === 'RW') weight = 3;
    else if (p.position === 'CAM' || p.position === 'LM' || p.position === 'RM') weight = 2;
    return { player: p, weight };
  });
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * totalWeight;
  for (const { player, weight } of weighted) {
    r -= weight;
    if (r <= 0) return player;
  }
  return players[players.length - 1];
}

export function pickWeightedAssister(team: Team, scorerId: string, playerStats?: Record<string, PlayerMatchStat>): PlayerCard | null {
  // Teammates in the starting 11 who are not the scorer and not sent off
  const teammates = team.players.slice(0, 11).filter(p => p.id !== scorerId);
  if (teammates.length === 0) return null;

  // 70% chance of an assist
  if (Math.random() > 0.70) return null;

  const weighted: { player: PlayerCard; weight: number }[] = teammates.map(p => {
    let weight = 0.5; // default base weight for defenders/GK
    
    const role = p.position;
    if (['CAM', 'CM', 'LM', 'RM'].includes(role)) {
      weight = 5.0 + (p.passing / 10) + (p.vision / 10);
    } else if (['LW', 'RW', 'CF'].includes(role)) {
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

  let r = Math.random() * totalWeight;
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

  const homeFormBonus = homeFormation.counters.includes(away.formationId) ? 5 : 0;
  const awayFormBonus = awayFormation.counters.includes(home.formationId) ? 5 : 0;

  const matchStats = { ...initialStats };

  const fergusonActive = (team: Team, goals: number, oppGoals: number) =>
    team.coachId === 'ferguson' && goals < oppGoals;

  const zidaneBonus = (team: Team) =>
    team.coachId === 'zidane' && (isKnockout || isFinal) ? (isFinal ? 10 : 7) : 0;

  const KEY_MINUTES = [8, 15, 22, 28, 35, 42, 47, 55, 62, 68, 75, 82, 88, 90];
  if (isKnockout) {
    KEY_MINUTES.push(95, 102, 108, 114, 120);
  }

  let lastKeyCtx: LastKeyCtx = null;

  for (let minute = startMinute + 1; minute <= endMinute; minute++) {
    const isKeyEventMinute = KEY_MINUTES.includes(minute);

    const homeStrength = calculateTeamStrength(home, homeCoach, homeChem, homeFormBonus) +
      zidaneBonus(home) +
      (fergusonActive(home, homeGoals, awayGoals) ? 10 : 0);
    const awayStrength = calculateTeamStrength(away, awayCoach, awayChem, awayFormBonus) +
      zidaneBonus(away) +
      (fergusonActive(away, awayGoals, homeGoals) ? 10 : 0);

    const homeMomBonus = (homeMomentum - 50) * 0.25;
    const awayMomBonus = (awayMomentum - 50) * 0.25;

    const homeAttack = homeStrength + homeMomBonus + (Math.random() * 44 - 22);
    const awayAttack = awayStrength + awayMomBonus + (Math.random() * 44 - 22);

    const homeAttacks = homeAttack > awayAttack;
    const attackTeam = homeAttacks ? home : away;
    const defendTeam = homeAttacks ? away : home;
    const attackCoach = homeAttacks ? homeCoach : awayCoach;
    const defendCoach = homeAttacks ? awayCoach : homeCoach;
    const attackChem = homeAttacks ? homeChem : awayChem;
    const defendChem = homeAttacks ? awayChem : homeChem;

    const homeIsLosing = homeGoals < awayGoals;
    const awayIsLosing = awayGoals < homeGoals;
    const matchCtxHome = { isKnockout, isFinal, isLosing: homeIsLosing };
    const matchCtxAway = { isKnockout, isFinal, isLosing: awayIsLosing };
    const attackCtx = homeAttacks ? matchCtxHome : matchCtxAway;
    const defendCtx = homeAttacks ? matchCtxAway : matchCtxHome;

    if (isKeyEventMinute) {
      const attackers = attackTeam.players.slice(0, 11).filter(p =>
        ['ST', 'CF', 'LW', 'RW', 'CAM'].includes(p.position)
      );
      const defenders = defendTeam.players.slice(0, 11).filter(p =>
        ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(p.position)
      );

      const attacker = attackers.length > 0 ? pickWeightedAttacker(attackers) : attackTeam.players[10];
      const defender = defenders[Math.floor(Math.random() * defenders.length)] || defendTeam.players[0];
      const gk = defendTeam.players.find(p => p.position === 'GK') || defendTeam.players[0];

      const widePlayer = attackTeam.players.slice(0, 11).find(p =>
        ['LW', 'RW', 'LM', 'RM'].includes(p.position)
      ) || attackTeam.players.slice(0, 11).find(p =>
        ['CAM', 'CM'].includes(p.position)
      ) || attacker;

      const approach: Approach = selectApproach(attackTeam.playStyle ?? 'balanced');
      const isLuckEvent = Math.random() < 0.04;

      if (isLuckEvent) {
        const randLuck = Math.random();

        if (randLuck < 0.15) {
          // Own Goal
          if (homeAttacks) homeGoals++; else awayGoals++;
          if (playerStats[defender.id]) playerStats[defender.id].rating -= 0.8;
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
          if (playerStats[attacker.id]) { playerStats[attacker.id].goals++; playerStats[attacker.id].rating += 1.2; }
          if (playerStats[gk.id]) playerStats[gk.id].rating -= 1.2;
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
          if (playerStats[attacker.id]) { playerStats[attacker.id].goals++; playerStats[attacker.id].rating += 1.2; }
          if (playerStats[defender.id]) playerStats[defender.id].rating -= 0.3;
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
          if (playerStats[attacker.id]) { playerStats[attacker.id].goals++; playerStats[attacker.id].rating += 1.6; }
          events.push({
            minute, type: 'goal',
            description: screamedDesc(attacker.shortName, gk.shortName),
            teamId: attackTeam.id, playerId: attacker.id, opponentId: gk.id, isSpecial: true,
          });
          lastKeyCtx = { type: 'goal', teamId: attackTeam.id, atkName: attacker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
          homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 20) : Math.max(0, homeMomentum - 20);
          awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 20) : Math.min(100, awayMomentum + 20);

        } else if (randLuck < 0.86) {
          // Penalty
          const takers = attackTeam.players.slice(0, 11);
          // Designated taker first; bots fall back to their most composed starter;
          // finally guarantee a real player so `taker` is never undefined.
          const taker = takers.find(p => p.id === attackTeam.penaltyTaker)
            || (attackTeam.isBot ? [...takers].sort((a, b) => b.composure - a.composure)[0] : undefined)
            || takers[0]
            || attackTeam.players[0];
          if (!taker) continue; // degenerate: team has no players at all — skip this minute
          const isPenGoal = Math.random() < 0.76;
          if (isPenGoal) {
            if (homeAttacks) homeGoals++; else awayGoals++;
            if (playerStats[taker.id]) { playerStats[taker.id].goals++; playerStats[taker.id].rating += 1.0; }
            if (playerStats[defender.id]) playerStats[defender.id].rating -= 0.2;
            events.push({
              minute, type: 'goal',
              description: penaltyGoalDesc(taker.shortName, defender.shortName, gk.shortName),
              teamId: attackTeam.id, playerId: taker.id, opponentId: gk.id,
            });
            lastKeyCtx = { type: 'goal', teamId: attackTeam.id, atkName: taker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
            homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 15) : Math.max(0, homeMomentum - 15);
            awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 15) : Math.min(100, awayMomentum + 15);
          } else {
            if (Math.random() < 0.5) {
              if (playerStats[gk.id]) { playerStats[gk.id].saves++; playerStats[gk.id].rating += 0.8; }
              if (playerStats[taker.id]) playerStats[taker.id].rating -= 0.5;
              events.push({
                minute, type: 'save',
                description: penaltySaveDesc(gk.shortName, taker.shortName),
                teamId: defendTeam.id, playerId: gk.id, opponentId: taker.id,
              });
              lastKeyCtx = { type: 'save', teamId: defendTeam.id, atkName: taker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
            } else {
              if (playerStats[taker.id]) playerStats[taker.id].rating -= 0.6;
              events.push({
                minute, type: 'miss',
                description: penaltyMissDesc(taker.shortName),
                teamId: attackTeam.id, playerId: taker.id,
              });
              lastKeyCtx = { type: 'miss', teamId: attackTeam.id, atkName: taker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
            }
            homeMomentum = homeAttacks ? Math.max(0, homeMomentum - 8) : Math.min(100, homeMomentum + 8);
            awayMomentum = homeAttacks ? Math.min(100, awayMomentum + 8) : Math.max(0, awayMomentum - 8);
          }

        } else {
          // Woodwork
          if (playerStats[attacker.id]) { playerStats[attacker.id].shots++; playerStats[attacker.id].rating += 0.1; }
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

        const atkShooting = getEffectiveAttribute(attacker, 'shooting', attackCoach, 'Finalização', attackChem, attackTeam.playStyle, attackCtx);
        const atkPace = getEffectiveAttribute(attacker, 'pace', attackCoach, 'Criação', attackChem, attackTeam.playStyle, attackCtx);
        const atkDribbling = getEffectiveAttribute(attacker, 'dribbling', attackCoach, 'Criação', attackChem, attackTeam.playStyle, attackCtx);
        const defDefending = getEffectiveAttribute(defender, 'defending', defendCoach, 'Defesa', defendChem, defendTeam.playStyle, defendCtx);
        const defPhysical = getEffectiveAttribute(defender, 'physical', defendCoach, 'Defesa', defendChem, defendTeam.playStyle, defendCtx);

        // Trait effects are already baked into the effective attributes above
        // (see getEffectiveAttribute + trait catalog), so no extra bonuses here.
        const atkScore = (atkShooting + atkPace + atkDribbling) / 3 + Math.random() * 40;
        const defScore = (defDefending + defPhysical) / 2 + Math.random() * 40;

        if (atkScore > defScore) {
          if (homeAttacks) matchStats.homeShots++; else matchStats.awayShots++;
          if (playerStats[attacker.id]) playerStats[attacker.id].shots++;

          const targetChance = atkShooting / (atkShooting + 30);
          if (Math.random() < targetChance) {
            if (homeAttacks) matchStats.homeShotsOnTarget++; else matchStats.awayShotsOnTarget++;

            const gkScore = gk.defending + getGoalkeeperTraitBonus(gk.traits) + Math.random() * 36;
            const shootScore = atkShooting + Math.random() * 36;

            if (shootScore > gkScore) {
              if (homeAttacks) homeGoals++; else awayGoals++;

              homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 15) : Math.max(0, homeMomentum - 15);
              awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 15) : Math.min(100, awayMomentum + 15);

              if (playerStats[attacker.id]) { playerStats[attacker.id].goals++; playerStats[attacker.id].rating += 1.4; }
              if (playerStats[gk.id]) playerStats[gk.id].rating -= 0.4;
              defendTeam.players.slice(0, 11).forEach(p => {
                if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position) && playerStats[p.id]) {
                  playerStats[p.id].rating -= 0.1;
                }
              });

              const assister = pickWeightedAssister(attackTeam, attacker.id, playerStats);
              if (assister && playerStats[assister.id]) {
                playerStats[assister.id].assists++;
                playerStats[assister.id].rating += 0.8;
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
              if (playerStats[gk.id]) { playerStats[gk.id].saves++; playerStats[gk.id].rating += 0.4; }
              if (playerStats[attacker.id]) playerStats[attacker.id].rating -= 0.1;

              const isCorner = Math.random() < 0.4;
              if (isCorner) { if (homeAttacks) matchStats.homeCorners++; else matchStats.awayCorners++; }

              events.push({
                minute, type: 'save',
                description: saveDesc(approach, gk.shortName, attacker.shortName, isCorner),
                teamId: defendTeam.id, playerId: gk.id, opponentId: attacker.id,
              });
              lastKeyCtx = { type: 'save', teamId: defendTeam.id, atkName: attacker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
            }
          } else {
            if (playerStats[attacker.id]) playerStats[attacker.id].rating -= 0.15;
            events.push({
              minute, type: 'miss',
              description: missDesc(approach, attacker.shortName, defender.shortName, gk.shortName),
              teamId: attackTeam.id, playerId: attacker.id,
            });
            lastKeyCtx = { type: 'miss', teamId: attackTeam.id, atkName: attacker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
          }
        } else {
          if (playerStats[defender.id]) { playerStats[defender.id].tackles++; playerStats[defender.id].rating += 0.35; }
          if (playerStats[attacker.id]) playerStats[attacker.id].rating -= 0.15;
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
      if (Math.random() < 0.30) {
        const homePossesses = Math.random() < (homeMomentum / 100);
        const possessTeam = homePossesses ? home : away;
        const dTeam = homePossesses ? away : home;

        const midPlayers = possessTeam.players.slice(0, 11).filter(p => ['MID', 'CM', 'CDM', 'CAM', 'LM', 'RM'].includes(p.position));
        const defPlayers = dTeam.players.slice(0, 11).filter(p => ['DEF', 'CB', 'LB', 'RB', 'CDM'].includes(p.position));

        const playerA = midPlayers[Math.floor(Math.random() * midPlayers.length)] || possessTeam.players[5];
        const defenderA = defPlayers[Math.floor(Math.random() * defPlayers.length)] || dTeam.players[2];

        const coach = COACHES.find(c => c.id === possessTeam.coachId);

        const desc = flowDesc(
          lastKeyCtx,
          possessTeam.name,
          possessTeam.id,
          playerA.shortName,
          defenderA.shortName,
          possessTeam.playStyle ?? 'balanced',
          coach?.id ?? '',
          dTeam.name,
          homeGoals,
          awayGoals,
          minute,
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
      const pRes = simulatePenalties(home, away, playerStats);
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
      home.players.slice(0, 5).forEach(p => { if (playerStats[p.id]) playerStats[p.id].rating += 0.1; });
      away.players.slice(0, 5).forEach(p => { if (playerStats[p.id]) playerStats[p.id].rating += 0.1; });
    }

    // Clean sheet bonuses
    if (awayGoals === 0) {
      home.players.slice(0, 11).forEach(p => {
        if (p.position === 'GK' && playerStats[p.id]) playerStats[p.id].rating += 0.8;
        else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position) && playerStats[p.id]) playerStats[p.id].rating += 0.4;
      });
    }
    if (homeGoals === 0) {
      away.players.slice(0, 11).forEach(p => {
        if (p.position === 'GK' && playerStats[p.id]) playerStats[p.id].rating += 0.8;
        else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position) && playerStats[p.id]) playerStats[p.id].rating += 0.4;
      });
    }

    // Win/loss adjustments
    const homeStarters = home.players.slice(0, 11);
    const awayStarters = away.players.slice(0, 11);
    if (winner === home.id) {
      homeStarters.forEach(p => { if (playerStats[p.id]) playerStats[p.id].rating += 0.3; });
      awayStarters.forEach(p => { if (playerStats[p.id]) playerStats[p.id].rating -= 0.2; });
    } else if (winner === away.id) {
      awayStarters.forEach(p => { if (playerStats[p.id]) playerStats[p.id].rating += 0.3; });
      homeStarters.forEach(p => { if (playerStats[p.id]) playerStats[p.id].rating -= 0.2; });
    }

    // Clamp and format ratings
    [...homeStarters, ...awayStarters].forEach(p => {
      if (playerStats[p.id]) {
        const finalR = Math.min(10.0, Math.max(3.0, playerStats[p.id].rating));
        playerStats[p.id].rating = parseFloat(finalR.toFixed(1));
      }
    });
  }

  const allStarters = [...home.players.slice(0, 11), ...away.players.slice(0, 11)];
  const mvpId = allStarters.length > 0
    ? allStarters.reduce((best, p) =>
        (playerStats[p.id]?.rating ?? 6.0) > (playerStats[best.id]?.rating ?? 6.0) ? p : best,
        allStarters[0]
      ).id
    : '';

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
  };
}

export function simulateMatch(
  home: Team,
  away: Team,
  isKnockout: boolean = false,
  isFinal: boolean = false,
): MatchResult {
  const playerStats: Record<string, PlayerMatchStat> = {};
  
  const initStatsForTeam = (team: Team) => {
    team.players.slice(0, 11).forEach(p => {
      playerStats[p.id] = {
        playerId: p.id,
        playerName: p.shortName,
        teamId: team.id,
        rating: 6.0,
        goals: 0,
        assists: 0,
        shots: 0,
        tackles: 0,
        saves: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
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
  // This gives us the authoritative 90-min state to check whether extra time is needed.
  const r90 = runMatchSimulation(home, away, 0, 90, 0, 0, [], initialStats, playerStats, false, isFinal, false);

  if (isKnockout && r90.homeGoals === r90.awayGoals) {
    // Tied at 90 → extra time (90→120). Winner determination + penalties handled inside.
    const rET = runMatchSimulation(home, away, 90, 120, r90.homeGoals, r90.awayGoals, r90.events, r90.stats, playerStats, true, isFinal, true);
    rET.durationMinutes = 120;
    return rET;
  }

  // Match decided in 90 minutes — apply winner/bonuses manually on the existing result.
  const hg = r90.homeGoals;
  const ag = r90.awayGoals;
  r90.winner = hg > ag ? home.id : ag > hg ? away.id : null;
  r90.durationMinutes = 90;

  // Clean sheet bonuses
  if (ag === 0) home.players.slice(0, 11).forEach(p => {
    if (!playerStats[p.id]) return;
    if (p.position === 'GK') playerStats[p.id].rating += 0.8;
    else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position)) playerStats[p.id].rating += 0.4;
  });
  if (hg === 0) away.players.slice(0, 11).forEach(p => {
    if (!playerStats[p.id]) return;
    if (p.position === 'GK') playerStats[p.id].rating += 0.8;
    else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position)) playerStats[p.id].rating += 0.4;
  });

  // Win/loss adjustments
  const hs = home.players.slice(0, 11);
  const as_ = away.players.slice(0, 11);
  if (r90.winner === home.id) {
    hs.forEach(p => { if (playerStats[p.id]) playerStats[p.id].rating += 0.3; });
    as_.forEach(p => { if (playerStats[p.id]) playerStats[p.id].rating -= 0.2; });
  } else if (r90.winner === away.id) {
    as_.forEach(p => { if (playerStats[p.id]) playerStats[p.id].rating += 0.3; });
    hs.forEach(p => { if (playerStats[p.id]) playerStats[p.id].rating -= 0.2; });
  }

  // Clamp ratings and set MVP
  [...hs, ...as_].forEach(p => {
    if (playerStats[p.id]) {
      playerStats[p.id].rating = parseFloat(Math.min(10, Math.max(3, playerStats[p.id].rating)).toFixed(1));
    }
  });
  const r90Starters = [...hs, ...as_];
  r90.mvp = r90Starters.length > 0
    ? r90Starters.reduce((best, p) =>
        (playerStats[p.id]?.rating ?? 6) > (playerStats[best.id]?.rating ?? 6) ? p : best,
        r90Starters[0]
      ).id
    : '';
  r90.playerStats = playerStats;

  return r90;
}

export function simulateRemainingMatch(
  home: Team,
  away: Team,
  currentMinute: number,
  currentHomeGoals: number,
  currentAwayGoals: number,
  existingEvents: MatchEvent[],
  existingStats: MatchResult['stats'],
  isKnockout: boolean = false,
  isFinal: boolean = false,
): MatchResult {
  const playerStats: Record<string, PlayerMatchStat> = {};
  
  const initStatsForTeam = (team: Team) => {
    team.players.slice(0, 11).forEach(p => {
      playerStats[p.id] = {
        playerId: p.id,
        playerName: p.shortName,
        teamId: team.id,
        rating: 6.0,
        goals: 0,
        assists: 0,
        shots: 0,
        tackles: 0,
        saves: 0,
        fouls: 0,
        yellowCards: 0,
        redCards: 0,
      };
    });
  };
  initStatsForTeam(home);
  initStatsForTeam(away);

  // Parse existing events to pre-fill stats
  existingEvents.forEach(e => {
    if (e.type === 'goal') {
      if (e.playerId && playerStats[e.playerId]) {
        playerStats[e.playerId].goals++;
        playerStats[e.playerId].rating += 1.4;
      }
      if (e.assisterId && playerStats[e.assisterId]) {
        playerStats[e.assisterId].assists++;
        playerStats[e.assisterId].rating += 0.8;
      }
      const gkId = e.opponentId; // goalkeeper could be opponentId
      if (gkId && playerStats[gkId]) {
        playerStats[gkId].rating -= 0.4;
      }
    } else if (e.type === 'save') {
      if (e.playerId && playerStats[e.playerId]) {
        playerStats[e.playerId].saves++;
        playerStats[e.playerId].rating += 0.4;
      }
      if (e.opponentId && playerStats[e.opponentId]) {
        playerStats[e.opponentId].rating -= 0.1;
      }
    } else if (e.type === 'miss') {
      if (e.playerId && playerStats[e.playerId]) {
        playerStats[e.playerId].shots++;
        playerStats[e.playerId].rating -= 0.15;
      }
    } else if (e.type === 'duel') {
      if (e.playerId && playerStats[e.playerId]) {
        playerStats[e.playerId].tackles++;
        playerStats[e.playerId].rating += 0.35;
      }
      if (e.opponentId && playerStats[e.opponentId]) {
        playerStats[e.opponentId].rating -= 0.15;
      }
    } else if (e.type === 'yellow') {
      if (e.playerId && playerStats[e.playerId]) {
        playerStats[e.playerId].yellowCards++;
        playerStats[e.playerId].rating -= 0.5;
      }
    }
  });

  const finalMin = isKnockout ? 120 : 90;

  return runMatchSimulation(
    home,
    away,
    currentMinute,
    finalMin,
    currentHomeGoals,
    currentAwayGoals,
    existingEvents,
    existingStats,
    playerStats,
    isKnockout,
    isFinal
  );
}

export function calculateTeamStrength(
  team: Team,
  coach: Coach,
  chemBonus: { passing: number; pace: number; special: boolean },
  formationBonus: number,
): number {
  const starters = team.players.slice(0, 11);
  // Guard against an empty lineup (would otherwise divide by zero → NaN strength).
  if (starters.length === 0) return 0;
  const avgStrength = starters.reduce((sum, p) => {
    // GKs are evaluated on shot-stopping attributes (defending + physical) rather than
    // the 6-stat average that inflates/deflates them due to low shooting/dribbling.
    const base = p.position === 'GK'
      ? (p.defending * 1.5 + p.physical + p.pace * 0.5) / 3
      : (p.pace + p.shooting + p.passing + p.dribbling + p.defending + p.physical) / 6;
    const chemMod = p.isOOP ? 0.85 : (p.chemistryScore >= 3 ? 1.10 : p.chemistryScore === 2 ? 1.06 : p.chemistryScore === 1 ? 1.03 : 1.00);
    return sum + base * chemMod;
  }, 0) / starters.length;

  let captainBonus = 0;
  if (team.captain) {
    const captainPlayer = starters.find(p => p.id === team.captain);
    if (captainPlayer) {
      captainBonus = captainPlayer.rarity === 'immortal' ? 3.5 : captainPlayer.rarity === 'legendary' ? 2.5 : 1.5;
    }
  } else if (team.isBot) {
    const bestStarter = [...starters].sort((a, b) => b.overall - a.overall)[0];
    if (bestStarter) {
      captainBonus = bestStarter.rarity === 'immortal' ? 3.5 : bestStarter.rarity === 'legendary' ? 2.5 : 1.5;
    }
  }

  let strength = avgStrength + formationBonus + chemBonus.passing + (chemBonus.special ? 5 : 0) + captainBonus;
  
  if (team.isBot && team.botStrength !== undefined) {
    // Bronze (~0.45) → 0.75x, Gold (~0.75) → 0.91x, Immortal (~0.97) → 1.03x
    const multiplier = 0.50 + team.botStrength * 0.55;
    strength = strength * multiplier;
  }

  return strength;
}

// Resolves the designated penalty taker: the explicit choice if valid, otherwise
// the best outfield player by composure+shooting. NEVER the goalkeeper unless the
// XI somehow has no outfield player. Fixes the old bug where the keeper (slot 0)
// was the default taker.
export function getPenaltyTaker(team: Team): PlayerCard {
  const starters = team.players.slice(0, 11);
  if (team.penaltyTaker) {
    const chosen = starters.find(p => p.id === team.penaltyTaker);
    if (chosen) return chosen;
  }
  const outfield = starters.filter(p => p.position !== 'GK');
  const pool = outfield.length > 0 ? outfield : starters;
  return [...pool].sort((a, b) => (b.composure + b.shooting) - (a.composure + a.shooting))[0];
}

// Ordered shootout takers: designated taker (or best outfield) first, then the
// remaining outfield by composure+shooting, with the goalkeeper last of all.
export function getPenaltyOrder(team: Team): PlayerCard[] {
  const starters = team.players.slice(0, 11);
  const outfield = starters.filter(p => p.position !== 'GK');
  const keepers = starters.filter(p => p.position === 'GK');
  const sorted = [...outfield].sort((a, b) => (b.composure + b.shooting) - (a.composure + a.shooting));
  const designated = team.penaltyTaker ? sorted.find(p => p.id === team.penaltyTaker) : undefined;
  const ordered = designated ? [designated, ...sorted.filter(p => p.id !== designated.id)] : sorted;
  return [...ordered, ...keepers];
}

function simulatePenalties(home: Team, away: Team, _playerStats?: Record<string, PlayerMatchStat>): {
  winner: string;
  homeScore: number;
  awayScore: number;
  kicks: PenaltyKick[];
} {
  let homeScore = 0;
  let awayScore = 0;
  const kicks: PenaltyKick[] = [];

  const homeTakers = getPenaltyOrder(home);
  const awayTakers = getPenaltyOrder(away);
  const homeGK = home.players.find(p => p.position === 'GK') || home.players[0];
  const awayGK = away.players.find(p => p.position === 'GK') || away.players[0];
  const homeTakerId = getPenaltyTaker(home).id;
  const awayTakerId = getPenaltyTaker(away).id;

  for (let i = 0; i < 5; i++) {
    const homeTaker = homeTakers[i % homeTakers.length];
    const awayTaker = awayTakers[i % awayTakers.length];

    // Home kick
    const homeComp = homeTaker.composure
      + getPenaltyComposureBonus(homeTaker.traits)
      + (homeTaker.id === homeTakerId ? 5 : 0);
    const awayGKRef = awayGK.defending + getGoalkeeperTraitBonus(awayGK.traits);
    const homeGoal = Math.random() < homeComp / (homeComp + awayGKRef * 0.5);
    if (homeGoal) homeScore++;
    kicks.push({ teamId: home.id, takerName: homeTaker.shortName, gkName: awayGK.shortName, isGoal: homeGoal });

    // Away kick
    const awayComp = awayTaker.composure
      + getPenaltyComposureBonus(awayTaker.traits)
      + (awayTaker.id === awayTakerId ? 5 : 0);
    const homeGKRef = homeGK.defending + getGoalkeeperTraitBonus(homeGK.traits);
    const awayGoal = Math.random() < awayComp / (awayComp + homeGKRef * 0.5);
    if (awayGoal) awayScore++;
    kicks.push({ teamId: away.id, takerName: awayTaker.shortName, gkName: homeGK.shortName, isGoal: awayGoal });
  }

  // Sudden death: simulate paired kicks until outcomes differ (max 10 rounds)
  if (homeScore === awayScore) {
    for (let sd = 0; sd < 10; sd++) {
      const homeTaker = homeTakers[(5 + sd) % homeTakers.length];
      const awayTaker = awayTakers[(5 + sd) % awayTakers.length];

      const homeComp2 = homeTaker.composure
        + getPenaltyComposureBonus(homeTaker.traits)
        + (homeTaker.id === homeTakerId ? 5 : 0);
      const awayGKRef2 = awayGK.defending + getGoalkeeperTraitBonus(awayGK.traits);
      const homeGoalSD = Math.random() < homeComp2 / (homeComp2 + awayGKRef2 * 0.5);

      const awayComp2 = awayTaker.composure
        + getPenaltyComposureBonus(awayTaker.traits)
        + (awayTaker.id === awayTakerId ? 5 : 0);
      const homeGKRef2 = homeGK.defending + getGoalkeeperTraitBonus(homeGK.traits);
      const awayGoalSD = Math.random() < awayComp2 / (awayComp2 + homeGKRef2 * 0.5);

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

// ============================================================
// DRAFT ENGINE
// ============================================================

const DRAFT_OPTIONS_COUNT = 6;

// ── Draft card variants (arcade variety) ──────────────────────
// Each card in the draft pool has a small chance to spawn as a boosted "in-form"
// special, or to receive a wildcard extra trait. These ALWAYS clone the player
// so the static PLAYERS pool is never mutated.
const DRAFT_INFORM_CHANCE = 0.06;   // rare boosted card
const DRAFT_WILDCARD_CHANCE = 0.14; // extra trait, no stat boost
const INFORM_OVERALL_BOOST = 3;
const INFORM_STAT_BOOST = 3;

function clampStat(v: number): number {
  return Math.max(1, Math.min(99, v));
}

function pickRollableTrait(existing: string[]): string | null {
  const pool = ROLLABLE_TRAITS.filter(t => !existing.includes(t));
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function applyDraftVariant(p: Player): Player {
  const roll = Math.random();

  // In-form: rare, boosts overall + core stats and adds an extra trait.
  if (roll < DRAFT_INFORM_CHANCE) {
    const extra = pickRollableTrait(p.traits);
    return {
      ...p,
      inForm: true,
      baseOverall: p.overall,
      overall: clampStat(p.overall + INFORM_OVERALL_BOOST),
      pace: clampStat(p.pace + INFORM_STAT_BOOST),
      shooting: clampStat(p.shooting + INFORM_STAT_BOOST),
      passing: clampStat(p.passing + INFORM_STAT_BOOST),
      dribbling: clampStat(p.dribbling + INFORM_STAT_BOOST),
      defending: clampStat(p.defending + INFORM_STAT_BOOST),
      physical: clampStat(p.physical + INFORM_STAT_BOOST),
      traits: extra ? [...p.traits, extra] : [...p.traits],
      rolledTrait: extra ?? undefined,
    };
  }

  // Wildcard: just an extra trait (no stat change).
  if (roll < DRAFT_INFORM_CHANCE + DRAFT_WILDCARD_CHANCE) {
    const extra = pickRollableTrait(p.traits);
    if (!extra) return p;
    return { ...p, traits: [...p.traits, extra], rolledTrait: extra };
  }

  return p;
}

function withDraftVariants(list: Player[]): Player[] {
  return list.map(applyDraftVariant);
}

function shuffleWithRarityWeight(pool: Player[]): Player[] {
  const weighted: Player[] = [];
  for (const p of pool) {
    // Rarer cards appear less often (lower weight = lower chance)
    const weight = p.rarity === 'immortal' ? 1 : p.rarity === 'legendary' ? 2 : p.rarity === 'gold' ? 4 : p.rarity === 'silver' ? 6 : 8;
    for (let i = 0; i < weight; i++) weighted.push(p);
  }
  const shuffled = weighted.sort(() => Math.random() - 0.5);
  const seen = new Set<string>();
  const unique: Player[] = [];
  for (const p of shuffled) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      unique.push(p);
    }
  }
  return unique;
}

export function generateDraftOptions(
  neededPositions: string[],
  alreadyDrafted: string[],
): Player[] {
  const fullAvailable = PLAYERS.filter(p => !alreadyDrafted.includes(p.id));

  if (neededPositions.length === 0) {
    return withDraftVariants(shuffleWithRarityWeight(fullAvailable).slice(0, DRAFT_OPTIONS_COUNT));
  }

  // Filter available players: they must be able to play in at least one of the remaining needed positions
  let available = fullAvailable.filter(p =>
    neededPositions.some(pos => p.position === pos || p.secondaryPositions?.includes(pos))
  );

  // Fallback: if we don't have enough players (unlikely), use all available players
  if (available.length < DRAFT_OPTIONS_COUNT) {
    available = fullAvailable;
  }

  // ── STARTERS: guarantee at least 1 matches the next needed pos ──
  const primaryPos = neededPositions[0];
  const posGroup = primaryPos ? getPositionGroup(primaryPos as any) : null;

  // Pick 1 guaranteed card that fits the exact position (or group)
  const exactMatch = available.filter(p =>
    p.position === primaryPos ||
    (p.secondaryPositions ?? []).includes(primaryPos)
  );
  const groupMatch = posGroup
    ? available.filter(p => getPositionGroup(p.position) === posGroup && !exactMatch.includes(p))
    : [];

  // Shuffle each bucket
  const shuffledExact = shuffleWithRarityWeight(exactMatch);
  const shuffledGroup = shuffleWithRarityWeight(groupMatch);
  const shuffledAll   = shuffleWithRarityWeight(available);

  // Guaranteed slot: prefer exact match, fall back to group, then any
  const guaranteed = shuffledExact[0] ?? shuffledGroup[0] ?? shuffledAll[0];
  const usedIds = new Set<string>(guaranteed ? [guaranteed.id] : []);

  // Fill remaining 5 slots from the full pool (biased to position group)
  const biasedPool = posGroup
    ? [
        ...available.filter(p => getPositionGroup(p.position) === posGroup),
        ...available.filter(p => getPositionGroup(p.position) !== posGroup),
      ]
    : available;

  const rest = shuffleWithRarityWeight(biasedPool)
    .filter(p => !usedIds.has(p.id))
    .slice(0, DRAFT_OPTIONS_COUNT - 1);

  const result = guaranteed ? [guaranteed, ...rest] : rest.slice(0, DRAFT_OPTIONS_COUNT);
  // Shuffle the final list so the guaranteed pick isn't always first
  return withDraftVariants(result.sort(() => Math.random() - 0.5));
}

export function getNeededPositions(
  formationId: string,
  drafted: (Player | undefined)[],
): string[] {
  const formation = FORMATIONS.find(f => f.id === formationId);
  if (!formation) return [];

  const missing: string[] = [];
  for (let i = 0; i < 11; i++) {
    if (drafted[i] === undefined) {
      missing.push(formation.positions[i].role);
    }
  }
  return missing;
}

// ============================================================
// BOT TEAM GENERATOR
// ============================================================
export function generateBotTeam(name: string, difficulty: number): Team {
  const coach = COACHES[Math.floor(Math.random() * COACHES.length)];
  const formation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];

  // Build a pool sorted by quality tier but randomized within each tier so every
  // call returns a different ordering among same-strength players. Without this,
  // all bots of the same difficulty always see candidates in identical rank order
  // and end up picking from the exact same handful of top players every time.
  const tieredPool = [...PLAYERS].sort((a, b) => {
    const tA = Math.floor(a.overall / 4); // 4-point bands: 92-95, 88-91, 84-87 …
    const tB = Math.floor(b.overall / 4);
    if (tA !== tB) return tB - tA;
    return Math.random() - 0.5; // random within the same quality band
  });
  const topN = Math.round(tieredPool.length * (1 - difficulty * 0.5));
  const pool = tieredPool.slice(0, Math.max(22, topN)); // min 22 so fallback has options

  const selected: Player[] = [];

  // Candidate window: how many positional matches to consider per slot.
  // Wider window → more variety; harder bots still pick from a quality pool,
  // just with more randomness within it.
  const candidateWindow = difficulty >= 0.88 ? 7 : difficulty >= 0.62 ? 12 : 20;

  // Fill formation positions (11 titulares)
  for (const pos of formation.positions) {
    const candidates = pool.filter(p =>
      !selected.find(s => s.id === p.id) &&
      (p.position === pos.role || p.secondaryPositions?.includes(pos.role))
    );
    if (candidates.length > 0) {
      const randIdx = Math.floor(Math.random() * Math.min(candidates.length, candidateWindow));
      selected.push(candidates[randIdx]);
    }
  }

  // Complete missing slots if formation matching failed
  while (selected.length < 11) {
    const remaining = pool.filter(p => !selected.find(s => s.id === p.id));
    if (remaining.length === 0) break;
    const randIdx = Math.floor(Math.random() * Math.min(remaining.length, candidateWindow));
    selected.push(remaining[randIdx]);
  }

  const formationRoles = formation.positions.map(p => p.role);
  const chemData = calculateChemistry(selected, coach.id, formationRoles);

  const playerCards: PlayerCard[] = selected.map((p, idx) => ({
    ...p,
    chemistryScore: chemData.individual[p.id] ?? 1,
    isOOP: chemData.outOfPosition[p.id] ?? false,
  }));

  return {
    id: `bot_${name.toLowerCase().replace(/\s/g, '_')}`,
    name,
    coachId: coach.id,
    formationId: formation.id,
    playStyle: 'balanced',
    players: playerCards,
    totalChemistry: chemData.total,
    isBot: true,
    botStrength: difficulty,
  };
}

// ============================================================
// LEAGUE SIMULATION
// ============================================================
export function simulateLeague(teams: Team[]): {
  standings: StandingsEntry[];
  results: MatchResult[];
} {
  const results: MatchResult[] = [];
  const standings: Record<string, StandingsEntry> = {};

  // Init standings
  for (const team of teams) {
    standings[team.id] = {
      teamId: team.id,
      teamName: team.name,
      played: 0, won: 0, drawn: 0, lost: 0,
      goalsFor: 0, goalsAgainst: 0, points: 0,
    };
  }

  // Round-robin (simplified: each team plays 8 matches)
  const matchups: [Team, Team][] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matchups.push([teams[i], teams[j]]);
    }
  }

  // Limit to 8 matches per team
  const played: Record<string, number> = {};
  for (const team of teams) played[team.id] = 0;

  for (const [home, away] of matchups) {
    if (played[home.id] >= 8 || played[away.id] >= 8) continue;

    const result = simulateMatch(home, away);
    results.push(result);
    played[home.id]++;
    played[away.id]++;

    const hs = standings[home.id];
    const as = standings[away.id];

    hs.played++;
    as.played++;
    hs.goalsFor += result.homeGoals;
    hs.goalsAgainst += result.awayGoals;
    as.goalsFor += result.awayGoals;
    as.goalsAgainst += result.homeGoals;

    if (result.winner === home.id) {
      hs.won++; hs.points += 3;
      as.lost++;
    } else if (result.winner === away.id) {
      as.won++; as.points += 3;
      hs.lost++;
    } else {
      hs.drawn++; hs.points++;
      as.drawn++; as.points++;
    }
  }

  const sortedStandings = Object.values(standings).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdA = a.goalsFor - a.goalsAgainst;
    const gdB = b.goalsFor - b.goalsAgainst;
    if (gdB !== gdA) return gdB - gdA;
    return b.goalsFor - a.goalsFor;
  });

  return { standings: sortedStandings, results };
}

// ============================================================
// IMMORTAL REPORT
// ============================================================
export interface ImmortalReport {
  champion: string;
  topScorer: { name: string; goals: number };
  bestMatch: string;
  mvpFinal: string;
  biggestDuel: string;
  chemistryHighlight: string;
  historicalRecreations: string[];
  totalGoals: number;
}

export interface TopScorerEntry {
  playerId: string;
  playerName: string;
  teamName: string;
  teamId: string;
  goals: number;
}

export function computeSeasonTopScorers(
  results: MatchResult[],
  teams: Team[],
): TopScorerEntry[] {
  const goalCount: Record<string, { goals: number; teamId: string }> = {};

  for (const result of results) {
    for (const event of result.events) {
      if (event.type === 'goal' && event.playerId) {
        if (!goalCount[event.playerId]) {
          goalCount[event.playerId] = { goals: 0, teamId: event.teamId };
        }
        goalCount[event.playerId].goals++;
        goalCount[event.playerId].teamId = event.teamId;
      }
    }
  }

  const entries: TopScorerEntry[] = [];
  for (const [playerId, data] of Object.entries(goalCount)) {
    const team = teams.find(t => t.id === data.teamId);
    const player = team?.players.find(p => p.id === playerId);
    if (player && team) {
      entries.push({
        playerId,
        playerName: player.shortName,
        teamName: team.name,
        teamId: data.teamId,
        goals: data.goals,
      });
    }
  }

  return entries.sort((a, b) => b.goals - a.goals);
}

export function rebuildTeamChemistry(team: Team): Team {
  const formation = FORMATIONS.find(f => f.id === team.formationId);
  const formationRoles = formation?.positions.map(p => p.role) ?? [];
  const starters = team.players.slice(0, 11);
  const chemData = calculateChemistry(starters, team.coachId, formationRoles);

  const updatedPlayers = team.players.map((p, idx) => ({
    ...p,
    chemistryScore: chemData.individual[p.id] ?? 1,
    isOOP: chemData.outOfPosition[p.id] ?? false,
  }));

  return {
    ...team,
    players: updatedPlayers,
    totalChemistry: chemData.total,
  };
}

export function generateImmortalReport(
  playerTeam: Team,
  allResults: MatchResult[],
  champion: string,
): ImmortalReport {
  const playerResults = allResults.filter(
    r => r.homeTeamId === playerTeam.id || r.awayTeamId === playerTeam.id
  );

  // Count goals per player
  const goalCount: Record<string, number> = {};
  for (const result of playerResults) {
    for (const event of result.events) {
      if (event.type === 'goal' && event.teamId === playerTeam.id && event.playerId) {
        goalCount[event.playerId] = (goalCount[event.playerId] || 0) + 1;
      }
    }
  }

  const topScorerEntry = Object.entries(goalCount).sort((a, b) => b[1] - a[1])[0];
  const topScorer = topScorerEntry
    ? { name: playerTeam.players.find(p => p.id === topScorerEntry[0])?.shortName ?? 'Desconhecido', goals: topScorerEntry[1] }
    : { name: 'Nenhum', goals: 0 };

  // Best match (most goals)
  const bestResult = playerResults.sort((a, b) => {
    const totalA = a.homeGoals + a.awayGoals;
    const totalB = b.homeGoals + b.awayGoals;
    return totalB - totalA;
  })[0];

  const bestMatch = bestResult
    ? `${bestResult.homeGoals}-${bestResult.awayGoals}`
    : '0-0';

  // Chemistry highlights
  const chemData = calculateChemistry(playerTeam.players.slice(0, 11), playerTeam.coachId);
  const activeTrios = chemData.trios.map(trioId => {
    const trio = HISTORICAL_TRIOS.find(t => t.id === trioId);
    return trio?.name ?? trioId;
  });

  const totalGoals = playerResults.reduce((sum, r) => {
    return sum + (r.homeTeamId === playerTeam.id ? r.homeGoals : r.awayGoals);
  }, 0);

  return {
    champion,
    topScorer,
    bestMatch,
    mvpFinal: playerTeam.players[Math.floor(Math.random() * Math.min(5, playerTeam.players.length))]?.shortName ?? 'Desconhecido',
    biggestDuel: 'Duelo épico da campanha',
    chemistryHighlight: chemData.total >= 90 ? 'Química Perfeita!' : chemData.total >= 60 ? 'Química Excelente' : 'Química Boa',
    historicalRecreations: activeTrios,
    totalGoals,
  };
}

// ============================================================
// ROUND-BY-ROUND LEAGUE FIXTURES AND STANDINGS CALCULATOR
// ============================================================
export interface LeagueFixture {
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  played: boolean;
  result?: MatchResult;
}

export function generateLeagueFixtures(teams: Team[]): LeagueFixture[] {
  const fixtures: LeagueFixture[] = [];
  const N = teams.length;
  const tempTeams = [...teams];
  
  const rounds = 8;
  const matchesPerRound = N / 2;
  const list = tempTeams.slice(1); // 13 teams
  
  for (let r = 0; r < rounds; r++) {
    const roundNumber = r + 1;
    
    // Pair team 0
    const home0 = tempTeams[0].id;
    const away0 = list[r % list.length].id;
    if (r % 2 === 0) {
      fixtures.push({ round: roundNumber, homeTeamId: home0, awayTeamId: away0, played: false });
    } else {
      fixtures.push({ round: roundNumber, homeTeamId: away0, awayTeamId: home0, played: false });
    }
    
    for (let i = 1; i < matchesPerRound; i++) {
      const homeIdx = (r - i + list.length) % list.length;
      const awayIdx = (r + i) % list.length;
      if (homeIdx !== awayIdx) {
        fixtures.push({
          round: roundNumber,
          homeTeamId: list[homeIdx].id,
          awayTeamId: list[awayIdx].id,
          played: false
        });
      }
    }
  }
  return fixtures;
}

export function computeStandings(teams: Team[], fixtures: LeagueFixture[]): StandingsEntry[] {
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
      hs.won++; hs.points += 3;
      as.lost++;
    } else if (result.winner === awayTeamId) {
      as.won++; as.points += 3;
      hs.lost++;
    } else {
      hs.drawn++; hs.points++;
      as.drawn++; as.points++;
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

export interface KnockoutBracket {
  playoffs: any[];
  round16: any[];
  quarterFinals: any[];
  semiFinals: any[];
  final: any | null;
  currentRound: string;
  currentLeg: number; // 1 = ida, 2 = volta (active two-legged round)
}

// ============================================================
// KNOCKOUT BRACKET — faithful to the new UEFA Champions League format
// 36 teams → 8-round league phase →
//   • 1st–8th: qualify straight to the Round of 16 (seeded)
//   • 9th–24th: enter the knockout play-off round (single-leg here)
//   • 25th–36th: eliminated
// Play-off winners join the top 8 in the Round of 16, then Quarters → Semis → Final.
// The bracket path is fixed up front (1 and 2 can only meet in the final) and the
// play-off winners feed predetermined Round-of-16 slots.
// ============================================================

// Every tie is TWO-LEGGED (home & away), decided on aggregate, EXCEPT the single
// grand final. `currentLeg` (1 = ida / 2 = volta) tracks the leg being played in
// the active round. `awayFromPo` marks a Round-of-16 slot whose away team is
// filled once that play-off tie is decided.
export function createKnockoutBracket(standings: StandingsEntry[]): KnockoutBracket {
  const seedId = (pos: number) => standings[pos - 1]?.teamId;

  // Play-off ties PO1..PO8 — seeded (9–16) vs unseeded (17–24):
  // PO1 9v24, PO2 10v23, ... PO8 16v17.
  const playoffs = [];
  for (let i = 1; i <= 8; i++) {
    playoffs.push({
      id: `po_${i - 1}`,
      homeTeamId: seedId(8 + i),   // 9..16 (seeded, first-leg home)
      awayTeamId: seedId(25 - i),  // 24..17 (unseeded)
      played: false,
    });
  }

  // Round of 16 in bracket order so array-pairing yields a correct bracket where
  // seeds 1 and 2 are kept apart until the final. Home = top-8 seed; away = winner
  // of play-off PO(9 - seed) (best seed faces the lowest-ranked play-off path).
  const r16Seeds = [1, 8, 4, 5, 2, 7, 3, 6];
  const round16 = r16Seeds.map((s, idx) => ({
    id: `r16_${idx}`,
    homeTeamId: seedId(s),
    awayTeamId: '',                 // filled after the play-off round
    awayFromPo: (9 - s) - 1,        // 0-based index into `playoffs`
    played: false,
  }));

  return {
    playoffs,
    round16,
    quarterFinals: [],
    semiFinals: [],
    final: null,
    currentRound: 'playoffs',
    currentLeg: 1,
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
export function simulateSecondLeg(homeB: Team, awayA: Team, leg1: MatchResult): {
  leg2: MatchResult; tieWinner: string; aggA: number; aggB: number;
} {
  // 90-minute return leg (draws allowed).
  let leg2 = simulateMatch(homeB, awayA, false);
  // Team A was first-leg HOME / second-leg AWAY; team B was first-leg AWAY / second-leg HOME.
  let aggA = leg1.homeGoals + leg2.awayGoals;
  let aggB = leg1.awayGoals + leg2.homeGoals;

  if (aggA === aggB) {
    // Level on aggregate → extra time (engine adds no auto-penalties here).
    leg2 = runMatchSimulation(
      homeB, awayA, 90, 120,
      leg2.homeGoals, leg2.awayGoals, leg2.events, leg2.stats,
      leg2.playerStats ?? {}, false, false
    );
    leg2.durationMinutes = 120;
    aggA = leg1.homeGoals + leg2.awayGoals;
    aggB = leg1.awayGoals + leg2.homeGoals;
    if (aggA === aggB) {
      const pens = simulatePenalties(homeB, awayA, leg2.playerStats);
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
// decider (sets result + played). Single-leg final: 120' + penalties.
export function simulateKnockoutTieLeg(
  tie: any,
  currentLeg: number,
  isFinalRound: boolean,
  resolve: (id: string) => Team | undefined,
): void {
  const home = resolve(tie.homeTeamId);
  const away = resolve(tie.awayTeamId);
  if (!home || !away) return;

  if (tie.isSingleLeg || isFinalRound) {
    if (tie.played) return;
    tie.result = simulateMatch(home, away, true, true);
    tie.played = true;
    return;
  }

  if (currentLeg === 1) {
    if (tie.leg1) return;
    tie.leg1 = simulateMatch(home, away, false); // 90', durationMinutes = 90
  } else {
    if (tie.leg2) return;
    const sl = simulateSecondLeg(away, home, tie.leg1); // return leg: B home, A away
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
  resolve: (id: string) => Team | undefined,
): void {
  const isFinalRound = bracket.currentRound === 'final';
  const ties = getActiveKnockoutMatches(bracket);
  for (const tie of ties) {
    simulateKnockoutTieLeg(tie, bracket.currentLeg, isFinalRound, resolve);
  }
  if (!isFinalRound && bracket.currentLeg === 1) {
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

  if (round === 'playoffs') {
    // Slot each play-off winner into its predetermined Round-of-16 away berth.
    for (const tie of bracket.round16) {
      const po = bracket.playoffs[tie.awayFromPo];
      tie.awayTeamId = po ? winnerOf(po) : '';
    }
    bracket.currentRound = 'round16';
    bracket.currentLeg = 1;
    return null;
  }
  if (round === 'round16') {
    const w = bracket.round16.map(winnerOf);
    bracket.quarterFinals = [
      { id: 'qf_0', homeTeamId: w[0], awayTeamId: w[1], played: false },
      { id: 'qf_1', homeTeamId: w[2], awayTeamId: w[3], played: false },
      { id: 'qf_2', homeTeamId: w[4], awayTeamId: w[5], played: false },
      { id: 'qf_3', homeTeamId: w[6], awayTeamId: w[7], played: false },
    ];
    bracket.currentRound = 'quarters';
    bracket.currentLeg = 1;
    return null;
  }
  if (round === 'quarters') {
    const w = bracket.quarterFinals.map(winnerOf);
    bracket.semiFinals = [
      { id: 'sf_0', homeTeamId: w[0], awayTeamId: w[1], played: false },
      { id: 'sf_1', homeTeamId: w[2], awayTeamId: w[3], played: false },
    ];
    bracket.currentRound = 'semis';
    bracket.currentLeg = 1;
    return null;
  }
  if (round === 'semis') {
    const w = bracket.semiFinals.map(winnerOf);
    // The grand final is a SINGLE match at a neutral venue.
    bracket.final = { id: 'final', homeTeamId: w[0], awayTeamId: w[1], played: false, isSingleLeg: true };
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
export function knockoutRoundLabel(round: string): string {
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
      // (the final) contribute their one result. The aggregate object on a
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
    if (r.playerStats && r.playerStats[playerId]) {
      const ps = r.playerStats[playerId];
      if (ps.teamId === teamId) {
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


