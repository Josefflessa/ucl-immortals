// UCL Immortals — Game Engine
// Match simulation, chemistry calculation, draft logic

import {
  Player, Coach, Formation,
  PLAYERS, COACHES, FORMATIONS, HISTORICAL_TRIOS,
  getPositionGroup,
} from './gameData';

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
      let b = 8;
      let label = "Galácticos Zidane: +8 Geral";
      if (isFinal) {
        b = 20;
        label = "Rei da Final: +20 Geral";
      } else if (isKnockout) {
        b = 12;
        label = "Rei do Mata-Mata: +12 Geral";
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
      const b = 15;
      modifiers.overall += b;
      modifiers.pace += b;
      modifiers.shooting += b;
      modifiers.passing += b;
      modifiers.dribbling += b;
      modifiers.defending += b;
      modifiers.physical += b;
      modifiers.composure += b;
      modifiers.vision += b;
      modifiers.activeEffects.push("Fergie Time: +15 Geral");
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

  // Individual chemistry bonus: If OOP, apply 15% stats debuff. If not, apply standard chemistry multipliers (+0% / +3% / +6% / +10%)
  const chemMult = player.isOOP ? 0.85 : (player.chemistryScore >= 3 ? 1.10 : player.chemistryScore === 2 ? 1.06 : player.chemistryScore === 1 ? 1.03 : 1.00);
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

const getPosLabelPt = (pos: string): string => {
  if (['CB'].includes(pos)) return 'zagueiro';
  if (['LB', 'LWB'].includes(pos)) return 'lateral-esquerdo';
  if (['RB', 'RWB'].includes(pos)) return 'lateral-direito';
  if (['CDM'].includes(pos)) return 'volante';
  if (['CM', 'CAM', 'LM', 'RM'].includes(pos)) return 'meio-campista';
  return 'defensor';
};

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
    team.coachId === 'zidane' && (isKnockout || isFinal) ? (isFinal ? 20 : 12) : 0;

  const KEY_MINUTES = [8, 15, 22, 28, 35, 42, 47, 55, 62, 68, 75, 82, 88, 90];
  if (isKnockout) {
    KEY_MINUTES.push(95, 102, 108, 114, 120);
  }

  for (let minute = startMinute + 1; minute <= endMinute; minute++) {
    const isKeyEventMinute = KEY_MINUTES.includes(minute);

    const homeStrength = calculateTeamStrength(home, homeCoach, homeChem, homeFormBonus) +
      zidaneBonus(home) +
      (fergusonActive(home, homeGoals, awayGoals) ? 15 : 0);
    const awayStrength = calculateTeamStrength(away, awayCoach, awayChem, awayFormBonus) +
      zidaneBonus(away) +
      (fergusonActive(away, awayGoals, homeGoals) ? 15 : 0);

    const homeMomBonus = (homeMomentum - 50) * 0.1;
    const awayMomBonus = (awayMomentum - 50) * 0.1;

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

      // FATOR SORTE: 12% de chance de eventos de sorte/azar bizarros ou imprevisíveis (Own Goals, Blunders, Screamer, Handball, Woodwork)
      const isLuckEvent = Math.random() < 0.12;

      if (isLuckEvent) {
        const randLuck = Math.random();
        
        if (randLuck < 0.15) {
          // Own Goal
          if (homeAttacks) homeGoals++; else awayGoals++;
          if (playerStats[defender.id]) {
            playerStats[defender.id].rating -= 0.8;
          }
          events.push({
            minute,
            type: 'goal',
            description: `⚽ GOL CONTRA! Cruzamento perigoso na área, o ${getPosLabelPt(defender.position)} ${defender.shortName} tenta fazer o corte de cabeça, mas desvia contra as próprias redes!`,
            teamId: attackTeam.id,
            opponentId: defender.id,
          });
          
          homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 15) : Math.max(0, homeMomentum - 15);
          awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 15) : Math.min(100, awayMomentum + 15);
        } else if (randLuck < 0.30) {
          // Goalkeeper Blunder (Frango)
          if (homeAttacks) homeGoals++; else awayGoals++;
          if (playerStats[attacker.id]) {
            playerStats[attacker.id].goals++;
            playerStats[attacker.id].rating += 1.2;
          }
          if (playerStats[gk.id]) {
            playerStats[gk.id].rating -= 1.2;
          }
          
          events.push({
            minute,
            type: 'goal',
            description: `⚽ FRANGO HISTÓRICO! ${attacker.shortName} arrisca um chute fraco e rasteiro de longe. O goleiro ${gk.shortName} tenta segurar, mas a bola passa por baixo de seus braços e entra de mansinho!`,
            teamId: attackTeam.id,
            playerId: attacker.id,
            opponentId: gk.id,
          });
          
          homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 15) : Math.max(0, homeMomentum - 15);
          awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 15) : Math.min(100, awayMomentum + 15);
        } else if (randLuck < 0.50) {
          // Deflected Goal
          if (homeAttacks) homeGoals++; else awayGoals++;
          if (playerStats[attacker.id]) {
            playerStats[attacker.id].goals++;
            playerStats[attacker.id].rating += 1.2;
          }
          if (playerStats[defender.id]) {
            playerStats[defender.id].rating -= 0.3;
          }
          
          events.push({
            minute,
            type: 'goal',
            description: `⚽ GOL DESVIADO! ${attacker.shortName} bate forte da entrada da área. A bola carimba as costas do ${getPosLabelPt(defender.position)} ${defender.shortName}, muda completamente de rumo e mata o goleiro!`,
            teamId: attackTeam.id,
            playerId: attacker.id,
            opponentId: defender.id,
          });
          
          homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 15) : Math.max(0, homeMomentum - 15);
          awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 15) : Math.min(100, awayMomentum + 15);
        } else if (randLuck < 0.68) {
          // Long Range Screamer
          if (homeAttacks) homeGoals++; else awayGoals++;
          if (playerStats[attacker.id]) {
            playerStats[attacker.id].goals++;
            playerStats[attacker.id].rating += 1.6;
          }
          
          events.push({
            minute,
            type: 'goal',
            description: `⚽ GOLAÇO MONSTRUOSO! ${attacker.shortName} domina na intermediária e manda uma bomba sem pulo! A bola viaja a 110km/h e explode na gaveta, sem chances para o goleiro!`,
            teamId: attackTeam.id,
            playerId: attacker.id,
            opponentId: gk.id,
            isSpecial: true,
          });
          
          homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 20) : Math.max(0, homeMomentum - 20);
          awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 20) : Math.min(100, awayMomentum + 20);
        } else if (randLuck < 0.86) {
          // Handball Penalty (Pênalti por Mão na bola)
          const takers = attackTeam.players.slice(0, 11);
          let taker = takers.find(p => p.id === attackTeam.penaltyTaker) || takers[0];
          if (!taker && attackTeam.isBot) {
            taker = [...takers].sort((a,b) => b.composure - a.composure)[0] || takers[0];
          }
          
          const isGoal = Math.random() < 0.76;
          
          if (isGoal) {
            if (homeAttacks) homeGoals++; else awayGoals++;
            if (playerStats[taker.id]) {
              playerStats[taker.id].goals++;
              playerStats[taker.id].rating += 1.0;
            }
            if (playerStats[defender.id]) {
              playerStats[defender.id].rating -= 0.2;
            }
            events.push({
              minute,
              type: 'goal',
              description: `⚽ GOL DE PÊNALTI! O árbitro pega toque de mão do ${getPosLabelPt(defender.position)} ${defender.shortName} na área! Na cobrança, ${taker.shortName} bate com extrema categoria deslocando o goleiro!`,
              teamId: attackTeam.id,
              playerId: taker.id,
              opponentId: gk.id,
            });
            
            homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 15) : Math.max(0, homeMomentum - 15);
            awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 15) : Math.min(100, awayMomentum + 15);
          } else {
            if (Math.random() < 0.5) {
              if (playerStats[gk.id]) {
                playerStats[gk.id].saves++;
                playerStats[gk.id].rating += 0.8;
              }
              if (playerStats[taker.id]) {
                playerStats[taker.id].rating -= 0.5;
              }
              events.push({
                minute,
                type: 'save',
                description: `🧤 DEFENDEU O PÊNALTI! Após toque de mão na área, ${taker.shortName} correu para a bola, mas o goleiro ${gk.shortName} voou no canto esquerdo para espalmar!`,
                teamId: defendTeam.id,
                playerId: gk.id,
                opponentId: taker.id,
              });
            } else {
              if (playerStats[taker.id]) {
                playerStats[taker.id].rating -= 0.6;
              }
              events.push({
                minute,
                type: 'miss',
                description: `❌ PÊNALTI PARA FORA! Falha defensiva com bola na mão! ${taker.shortName} ajeitou a bola e mandou um foguete, mas isolou por cima do travessão!`,
                teamId: attackTeam.id,
                playerId: taker.id,
              });
            }
            
            homeMomentum = homeAttacks ? Math.max(0, homeMomentum - 8) : Math.min(100, homeMomentum + 8);
            awayMomentum = homeAttacks ? Math.min(100, awayMomentum + 8) : Math.max(0, awayMomentum - 8);
          }
        } else {
          // Woodwork Miss
          if (playerStats[attacker.id]) {
            playerStats[attacker.id].shots++;
            playerStats[attacker.id].rating += 0.1;
          }
          events.push({
            minute,
            type: 'miss',
            description: `💥 NA TRAVE! ${attacker.shortName} limpa a marcação e bate colocado de chapa. A bola explode no travessão e volta limpa para o ${getPosLabelPt(defender.position)} ${defender.shortName} isolar!`,
            teamId: attackTeam.id,
            playerId: attacker.id,
          });
          
          homeMomentum = homeAttacks ? Math.min(95, homeMomentum + 4) : Math.max(5, homeMomentum - 4);
          awayMomentum = homeAttacks ? Math.max(5, awayMomentum - 4) : Math.min(95, awayMomentum + 4);
        }
      } else {
        // EVENTO LÓGICO NORMAL: duelo com variabilidade de sorte aumentada
        const atkShooting = getEffectiveAttribute(attacker, 'shooting', attackCoach, 'Finalização', attackChem, attackTeam.playStyle, attackCtx);
        const atkPace = getEffectiveAttribute(attacker, 'pace', attackCoach, 'Criação', attackChem, attackTeam.playStyle, attackCtx);
        const atkDribbling = getEffectiveAttribute(attacker, 'dribbling', attackCoach, 'Criação', attackChem, attackTeam.playStyle, attackCtx);
        const defDefending = getEffectiveAttribute(defender, 'defending', defendCoach, 'Defesa', defendChem, defendTeam.playStyle, defendCtx);
        const defPhysical = getEffectiveAttribute(defender, 'physical', defendCoach, 'Defesa', defendChem, defendTeam.playStyle, defendCtx);

        let atkBonus = 0;
        let defBonus = 0;
        if (attacker.traits.includes('Frio na Final') && isFinal) atkBonus += 8;
        if (attacker.traits.includes('Especialista em Decisões') && isKnockout) atkBonus += 6;
        if (attacker.traits.includes('Velocista')) atkBonus += 4;
        if (defender.traits.includes('Pressão Implacável')) defBonus += 8;
        if (defender.traits.includes('Marcador Implacável')) defBonus += 6;

        // Variabilidade aumentada (de Math.random() * 30 para Math.random() * 40)
        const atkScore = (atkShooting + atkPace + atkDribbling) / 3 + atkBonus + Math.random() * 40;
        const defScore = (defDefending + defPhysical) / 2 + defBonus + Math.random() * 40;

        if (atkScore > defScore) {
          if (homeAttacks) matchStats.homeShots++;
          else matchStats.awayShots++;

          if (playerStats[attacker.id]) {
            playerStats[attacker.id].shots++;
          }

          const targetChance = atkShooting / (atkShooting + 30);
          if (Math.random() < targetChance) {
            if (homeAttacks) matchStats.homeShotsOnTarget++;
            else matchStats.awayShotsOnTarget++;

            // Variabilidade aumentada (de Math.random() * 28 para Math.random() * 36)
            const gkScore = gk.defending + (gk.traits.includes('Reflexo Felino') ? 10 : 0) + Math.random() * 36;
            const shootScore = atkShooting + Math.random() * 36;

            if (shootScore > gkScore) {
              if (homeAttacks) homeGoals++;
              else awayGoals++;

              homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 15) : Math.max(0, homeMomentum - 15);
              awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 15) : Math.min(100, awayMomentum + 15);

              if (playerStats[attacker.id]) {
                playerStats[attacker.id].goals++;
                playerStats[attacker.id].rating += 1.4;
              }

              // GK conceded
              if (playerStats[gk.id]) {
                playerStats[gk.id].rating -= 0.4;
              }
              // Defenders penalty
              defendTeam.players.slice(0, 11).forEach(p => {
                if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position) && playerStats[p.id]) {
                  playerStats[p.id].rating -= 0.1;
                }
              });

              // Assist logic
              const assister = pickWeightedAssister(attackTeam, attacker.id, playerStats);
              let desc = "";
              if (assister) {
                if (playerStats[assister.id]) {
                  playerStats[assister.id].assists++;
                  playerStats[assister.id].rating += 0.8;
                }
                desc = `⚽ GOL! ${attacker.shortName} finaliza com precisão após ótimo passe de ${assister.shortName}! ${homeGoals}-${awayGoals}`;
              } else {
                desc = `⚽ GOL! ${attacker.shortName} finaliza com precisão para vencer o goleiro e marcar! ${homeGoals}-${awayGoals}`;
              }

              const isSpecial = attacker.rarity === 'immortal' || attacker.traits.includes('Frio na Final');
              events.push({
                minute,
                type: 'goal',
                description: desc,
                teamId: attackTeam.id,
                playerId: attacker.id,
                opponentId: defender.id,
                assisterId: assister?.id,
                isSpecial,
              });
            } else {
              if (homeAttacks) matchStats.awaySaves++;
              else matchStats.homeSaves++;

              if (playerStats[gk.id]) {
                playerStats[gk.id].saves++;
                playerStats[gk.id].rating += 0.4;
              }
              if (playerStats[attacker.id]) {
                playerStats[attacker.id].rating -= 0.1;
              }

              events.push({
                minute,
                type: 'save',
                description: `🧤 Defesa espetacular! O goleiro se estica todo e defende a finalização perigosa de ${attacker.shortName}!`,
                teamId: defendTeam.id,
                playerId: gk.id,
                opponentId: attacker.id,
              });

              if (Math.random() < 0.4) {
                if (homeAttacks) matchStats.homeCorners++;
                else matchStats.awayCorners++;

                events.push({
                  minute,
                  type: 'duel',
                  description: `🚩 Escanteio! A bola é desviada pela defesa e sai pela linha de fundo.`,
                  teamId: attackTeam.id,
                });
              }
            }
          } else {
            if (playerStats[attacker.id]) {
              playerStats[attacker.id].rating -= 0.15;
            }
            events.push({
              minute,
              type: 'miss',
              description: `❌ Chute para fora! ${attacker.shortName} recebe na cara do gol mas bate torto na bola.`,
              teamId: attackTeam.id,
              playerId: attacker.id,
            });
          }
        } else {
          if (playerStats[defender.id]) {
            playerStats[defender.id].tackles++;
            playerStats[defender.id].rating += 0.35;
          }
          if (playerStats[attacker.id]) {
            playerStats[attacker.id].rating -= 0.15;
          }

          events.push({
            minute,
            type: 'duel',
            description: `🤺 Desarme preciso! ${defender.shortName} rouba a bola de ${attacker.shortName} no campo de defesa.`,
            teamId: defendTeam.id,
            playerId: defender.id,
            opponentId: attacker.id,
          });

          if (homeAttacks) homeMomentum = Math.max(0, homeMomentum - 5);
          else awayMomentum = Math.max(0, awayMomentum - 5);
        }
      }

      // Fouls and Yellow Cards (no red cards / expulsions)
      if (Math.random() < 0.15) {
        const outfieldFoulers = defendTeam.players.slice(0, 11).filter(p => p.position !== 'GK');
        const fouler = outfieldFoulers[Math.floor(Math.random() * outfieldFoulers.length)] || defendTeam.players[1];
        if (homeAttacks) matchStats.awayFouls++;
        else matchStats.homeFouls++;

        if (playerStats[fouler.id]) {
          playerStats[fouler.id].fouls++;
          playerStats[fouler.id].rating -= 0.1;
        }

        let cardType: 'yellow' | null = null;
        let cardDesc = "";
        const randCard = Math.random();

        if (randCard < 0.17) {
          cardType = 'yellow';
          if (playerStats[fouler.id]) {
            playerStats[fouler.id].yellowCards++;
            playerStats[fouler.id].rating -= 0.5;
          }
          cardDesc = `🟨 Cartão Amarelo! ${fouler.shortName} é advertido pelo árbitro por entrada dura.`;
        }

        events.push({
          minute,
          type: cardType || 'duel',
          description: cardDesc || `🚨 Falta cometida por ${fouler.shortName} interrompendo o ataque de ${attackTeam.name}.`,
          teamId: defendTeam.id,
          playerId: fouler.id,
        });
      }
    } else {
      if (Math.random() < 0.25) {
        const homePossesses = Math.random() < (homeMomentum / 100);
        const possessTeam = homePossesses ? home : away;
        const dTeam = homePossesses ? away : home;

        const midPlayers = possessTeam.players.slice(0, 11).filter(p => ['MID', 'CM', 'CDM', 'CAM', 'LM', 'RM'].includes(p.position));
        const defPlayers = dTeam.players.slice(0, 11).filter(p => ['DEF', 'CB', 'LB', 'RB', 'CDM'].includes(p.position));

        const playerA = midPlayers[Math.floor(Math.random() * midPlayers.length)] || possessTeam.players[5];
        const defenderA = defPlayers[Math.floor(Math.random() * defPlayers.length)] || dTeam.players[2];

        const coach = COACHES.find(c => c.id === possessTeam.coachId);
        const style = possessTeam.playStyle;
        const rand = Math.random();

        let desc = "";
        if (style === 'possession' || coach?.id === 'guardiola') {
          if (rand < 0.4) desc = `🔄 ${playerA.shortName} organiza o jogo no círculo central, trocando passes curtos com paciência.`;
          else if (rand < 0.7) desc = `⚙️ Linha de passes rápidos! O time de ${coach?.name || 'Guardiola'} envolve a marcação com maestria.`;
          else desc = `🛡️ ${dTeam.name} fecha os espaços tentando conter a troca de passes do adversário.`;
        } else if (style === 'counter' || coach?.id === 'klopp') {
          if (rand < 0.4) desc = `⚡ Contra-ataque rápido! ${playerA.shortName} puxa a transição ofensiva em alta velocidade!`;
          else if (rand < 0.7) desc = `🏃 Lançamento em profundidade de ${playerA.shortName} tentando encontrar espaço nas costas da zaga!`;
          else desc = `🛑 Pressão asfixiante de ${possessTeam.name}! ${defenderA.shortName} recupera a posse no meio de campo.`;
        } else {
          if (rand < 0.3) desc = `⚽ ${playerA.shortName} domina no meio-campo e distribui o jogo nas pontas.`;
          else if (rand < 0.6) desc = `⚔️ Batalha física! ${playerA.shortName} e ${defenderA.shortName} disputam espaço ombro a ombro.`;
          else desc = `🛡️ Bloqueio sólido! A linha defensiva de ${dTeam.name} rebate de cabeça o cruzamento na área.`;
        }

        events.push({
          minute,
          type: 'momentum',
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

  if (homeGoals > awayGoals) winner = home.id;
  else if (awayGoals > homeGoals) winner = away.id;
  else if (isKnockout) {
    const pRes = simulatePenalties(home, away, playerStats);
    penaltyWinner = pRes.winner;
    homePenalties = pRes.homeScore;
    awayPenalties = pRes.awayScore;
    winner = pRes.winner;
    events.push({
      minute: 120,
      type: 'penalty',
      description: `🎯 Pênaltis! ${home.name} ${pRes.homeScore}-${pRes.awayScore} ${away.name}`,
      teamId: pRes.winner,
    });

    // Penalties rating impact
    // We can add minor points
    home.players.slice(0, 5).forEach(p => {
      if (playerStats[p.id]) playerStats[p.id].rating += 0.1;
    });
    away.players.slice(0, 5).forEach(p => {
      if (playerStats[p.id]) playerStats[p.id].rating += 0.1;
    });
  }

  // End of match Clean Sheet bonuses
  if (awayGoals === 0) {
    home.players.slice(0, 11).forEach(p => {
      if (p.position === 'GK' && playerStats[p.id]) {
        playerStats[p.id].rating += 0.8;
      } else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position) && playerStats[p.id]) {
        playerStats[p.id].rating += 0.4;
      }
    });
  }
  if (homeGoals === 0) {
    away.players.slice(0, 11).forEach(p => {
      if (p.position === 'GK' && playerStats[p.id]) {
        playerStats[p.id].rating += 0.8;
      } else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position) && playerStats[p.id]) {
        playerStats[p.id].rating += 0.4;
      }
    });
  }

  // Win/Loss match rating adjustment
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
  const allStarters = [...homeStarters, ...awayStarters];
  allStarters.forEach(p => {
    if (playerStats[p.id]) {
      const finalR = Math.min(10.0, Math.max(3.0, playerStats[p.id].rating));
      playerStats[p.id].rating = parseFloat(finalR.toFixed(1));
    }
  });

  const scorers = events.filter(e => e.type === 'goal').map(e => e.playerId);
  const mvpId = scorers.length > 0
    ? scorers[scorers.length - 1]
    : allStarters.sort((a,b) => (playerStats[b.id]?.rating ?? 6.0) - (playerStats[a.id]?.rating ?? 6.0))[0]?.id || allStarters[0].id;

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

  const result = runMatchSimulation(
    home,
    away,
    0, // startMinute
    isKnockout ? 120 : 90, // endMinute
    0, // initialHomeGoals
    0, // initialAwayGoals
    [], // initialEvents
    initialStats,
    playerStats,
    isKnockout,
    isFinal
  );
  result.durationMinutes = isKnockout ? 120 : 90;
  return result;
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
  const avgStrength = starters.reduce((sum, p) => {
    const base = (p.pace + p.shooting + p.passing + p.dribbling + p.defending + p.physical) / 6;
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

function simulatePenalties(home: Team, away: Team, playerStats?: Record<string, PlayerMatchStat>): {
  winner: string;
  homeScore: number;
  awayScore: number;
} {
  let homeScore = 0;
  let awayScore = 0;

  const getTakers = (team: Team) => {
    const takers = getPenaltyOrder(team);
    const takerId = getPenaltyTaker(team).id;
    return { takers, takerId };
  };

  const { takers: homeTakers, takerId: homeTakerId } = getTakers(home);
  const { takers: awayTakers, takerId: awayTakerId } = getTakers(away);

  for (let i = 0; i < 5; i++) {
    const homeTaker = homeTakers[i % homeTakers.length];
    const awayTaker = awayTakers[i % awayTakers.length];
    const homeGK = home.players.find(p => p.position === 'GK') || home.players[0];
    const awayGK = away.players.find(p => p.position === 'GK') || away.players[0];

    // Home penalty
    let homeComposure = homeTaker.composure + (homeTaker.traits.includes('Especialista em Decisões') ? 10 : 0) + (homeTaker.traits.includes('Frio na Final') ? 10 : 0);
    if (homeTaker.id === homeTakerId) {
      homeComposure += 5;
    }
    const awayGKReflexes = awayGK.defending + (awayGK.traits.includes('Reflexo Felino') ? 10 : 0);
    if (Math.random() < homeComposure / (homeComposure + awayGKReflexes * 0.5)) homeScore++;

    // Away penalty
    let awayComposure = awayTaker.composure + (awayTaker.traits.includes('Especialista em Decisões') ? 10 : 0) + (awayTaker.traits.includes('Frio na Final') ? 10 : 0);
    if (awayTaker.id === awayTakerId) {
      awayComposure += 5;
    }
    const homeGKReflexes = homeGK.defending + (homeGK.traits.includes('Reflexo Felino') ? 10 : 0);
    if (Math.random() < awayComposure / (awayComposure + homeGKReflexes * 0.5)) awayScore++;
  }

  // Sudden death if tied
  if (homeScore === awayScore) {
    return Math.random() < 0.5
      ? { winner: home.id, homeScore: homeScore + 1, awayScore }
      : { winner: away.id, homeScore, awayScore: awayScore + 1 };
  }

  return {
    winner: homeScore > awayScore ? home.id : away.id,
    homeScore,
    awayScore,
  };
}

// ============================================================
// DRAFT ENGINE
// ============================================================

const DRAFT_OPTIONS_COUNT = 6;

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
    return shuffleWithRarityWeight(fullAvailable).slice(0, DRAFT_OPTIONS_COUNT);
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
  return result.sort(() => Math.random() - 0.5);
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

  // Pick players based on difficulty
  const sortedPlayers = [...PLAYERS].sort((a, b) => b.overall - a.overall);
  const topN = Math.round(sortedPlayers.length * (1 - difficulty * 0.5));
  const pool = sortedPlayers.slice(0, Math.max(11, topN));

  const selected: Player[] = [];

  // Fill formation positions (11 titulares)
  for (const pos of formation.positions) {
    const candidates = pool.filter(p =>
      !selected.find(s => s.id === p.id) &&
      (p.position === pos.role || p.secondaryPositions?.includes(pos.role))
    );
    if (candidates.length > 0) {
      // Pick randomly from top N candidates — window scales with difficulty so easier bots vary more
      const window = difficulty >= 0.88 ? 4 : difficulty >= 0.62 ? 6 : 8;
      const randIdx = Math.floor(Math.random() * Math.min(candidates.length, window));
      selected.push(candidates[randIdx]);
    }
  }

  // Complete missing slots if formation matching failed
  while (selected.length < 11) {
    const remaining = pool.filter(p => !selected.find(s => s.id === p.id));
    if (remaining.length === 0) break;
    const window = difficulty >= 0.88 ? 4 : difficulty >= 0.62 ? 6 : 8;
    const randIdx = Math.floor(Math.random() * Math.min(remaining.length, window));
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


