// UCL Immortals — Game Engine
// Match simulation, chemistry calculation, draft logic

import {
  Player, Coach, Formation,
  PLAYERS, COACHES, FORMATIONS, HISTORICAL_TRIOS,
  getPositionGroup, effectiveSecondaries,
} from './gameData';
import {
  selectApproach, buildUpDesc, goalDesc, ownGoalDesc, saveDesc, missDesc, duelDesc,
  frangoDesc, screamedDesc, deflectedDesc, woodworkDesc,
  penaltyGoalDesc, penaltySaveDesc, penaltyMissDesc,
  freeKickGoalDesc, freeKickSaveDesc, freeKickMissDesc,
  cornerGoalDesc, cornerSaveDesc, cornerMissDesc,
  flowDesc, Approach, LastKeyCtx,
  yellowCardDesc, straightRedDesc, secondYellowDesc, injuryDesc,
} from './matchNarrative';
import {
  AttrKey, getTraitAttributeBonus, getGoalkeeperTraitBonus,
  getPenaltyComposureBonus, hasOopRelief, rollPlayerTraits,
} from './traits';
import { BOT_CREST_MAP } from './crests';
import { Stadium, stadiumFor } from './stadium';
import {
  yellowChance, injuryChanceFromFoul, randomInjuryChance, tacticAggression, formationAggression,
  CARD_POS_MULT, STRAIGHT_RED_PROB, RED_PENALTY, RED_GK_PENALTY, INJURY_DEBUFF,
  DANGEROUS_FOUL_CARD_MULT, THREAT_FOUL_CARD_MULT, DANGEROUS_FOUL_INJURY_MULT,
  compressAggression, settleFactor, SECOND_YELLOW_LENIENCY,
} from './discipline';
import { DEFAULT_COMPETITION_FORMAT, normalizeCompetitionFormat } from './competition';

// Premium variants keep their own card IDs for inventory/UI, but historical
// chemistry must resolve them to the same football identity as the base card.
function historicalPlayerId(player: Player): string {
  return player.basePlayerId ?? player.id;
}

function areHistoricalPartners(a: Player, b: Player): boolean {
  const aHistoricalId = historicalPlayerId(a);
  const bHistoricalId = historicalPlayerId(b);
  return !!(
    a.historicalPartners?.includes(bHistoricalId) ||
    b.historicalPartners?.includes(aHistoricalId)
  );
}

// ============================================================
// TYPES
// ============================================================
export interface PlayerCard extends Player {
  chemistryScore: number; // 0-3
  isOOP: boolean;
  isSecondary?: boolean; // jogando numa posição secundária (−7%)
  // Per-MATCH unique stat key ("teamId::playerId"). The same player (same id) can
  // appear on two teams (the pool is smaller than 36×11), so match stats must be
  // keyed per instance, not by playerId alone. Set by setStatIds() before a sim.
  statId?: string;
}

// Stamps every player on both teams with a per-instance stat key so a shared
// player (e.g. the same legend on both sides) gets SEPARATE stats per team.
export function setStatIds(home: Team, away: Team): void {
  home.players.forEach(p => { (p as PlayerCard).statId = `${home.id}::${p.id}`; });
  away.players.forEach(p => { (p as PlayerCard).statId = `${away.id}::${p.id}`; });
}

// Builds the same key from a (teamId, playerId) pair — for season-stat lookups
// and event-derived stats where we only have ids.
export function statKey(teamId: string, playerId: string): string {
  return `${teamId}::${playerId}`;
}

export interface Team {
  id: string;
  name: string;
  coachId: string;
  coachPrime?: boolean; // Fase 2: técnico evoluído pro Prime → estádio temático
  formationId: string;
  playStyle: string;
  players: PlayerCard[]; // 11 titulares
  captain?: string;
  penaltyTaker?: string;
  freeKickTaker?: string;
  totalChemistry: number;
  isBot: boolean;
  botStrength?: number;
  crestId?: string; // selected club crest (see lib/crests.ts); undefined → initials badge
}

// The order of `team.players` is the order of the formation slots for the XI,
// followed by the bench. Centralize this lookup so positional coach effects use
// the role actually occupied by a card, not only its native position.
export function formationRoleForPlayer(team: Team, player: Player): string | undefined {
  const index = team.players.findIndex(p => p === player || p.id === player.id);
  if (index < 0 || index >= 11) return undefined;
  return FORMATIONS.find(f => f.id === team.formationId)?.positions[index]?.role;
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'save' | 'miss' | 'duel' | 'sub' | 'penalty' | 'foul' | 'momentum' | 'yellow' | 'red' | 'injury';
  description: string;
  teamId: string;
  playerId?: string;
  opponentId?: string;
  assisterId?: string;
  isSpecial?: boolean;
  secondYellow?: boolean; // 🟨🟨 vermelho por 2º amarelo (o amarelo daquele jogo NÃO conta no acúmulo da temporada)
}

// 🟨🟥🩹 Cartões/lesão de UM jogador NESTE jogo, keyed por INSTÂNCIA (time + jogador).
// Crucial: o mesmo playerId pode estar nos DOIS times de uma partida (pool < 36×11), então
// filtrar só por playerId pintaria um cartão fantasma na cópia do outro time. Exige o teamId.
export function playerMatchDiscipline(events: MatchEvent[], teamId: string, playerId: string): { yellow: number; red: boolean; injury: boolean } {
  const mine = (e: MatchEvent) => e.playerId === playerId && e.teamId === teamId;
  return {
    yellow: events.filter(e => e.type === 'yellow' && mine(e)).length,
    red: events.some(e => e.type === 'red' && mine(e)),
    injury: events.some(e => e.type === 'injury' && mine(e)),
  };
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
  // Richer involvement data — feeds professional ratings (midfielders/defenders who
  // never score still get credit) and the balance harness.
  keyPasses: number;       // a pass that set up a shot (chance created), goal or not
  interceptions: number;   // broke up an attack without it becoming a shot
  shotsOnTarget: number;   // shots that forced a save or scored
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
  // Changes on every new turn and on every reroll, so the countdown can restart
  // even when the visible round number stays the same.
  timerKey: number;
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
  return positionFit(player, formationRole) !== 'off';
}

// Playing in the coach's preferred formation gels the side: a flat bonus to the team's
// TOTAL chemistry, which can push it into a higher global-bonus tier (passe/ritmo/especial).
export const PREFERRED_FORMATION_CHEM_BONUS = 8;

export function calculateChemistry(
  players: Player[],
  coachId: string,
  formationRoles?: string[], // ordered list matching players array
  formationId?: string,      // the team's formation id — enables the coach-preference bonus
): {
  individual: Record<string, number>;
  total: number;
  trios: string[];
  outOfPosition: Record<string, boolean>;
  secondaryPos: Record<string, boolean>;
} {
  const individual: Record<string, number> = {};
  const outOfPosition: Record<string, boolean> = {};
  const secondaryPos: Record<string, boolean> = {};
  const trios: string[] = [];

  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const formationRole = formationRoles?.[i];

    // Encaixe em 3 estados: nativa / secundária (−7%) / fora (−15%). 🃏 Coringa é sempre nativa.
    const fit = formationRole ? positionFit(player, formationRole) : 'native';
    const isOOP = fit === 'off';
    outOfPosition[player.id] = isOOP;
    secondaryPos[player.id] = fit === 'secondary';

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
      // Historical partnerships are undirected: either card may contain the
      // reference, but both players must receive the same chemistry link.
      else if (areHistoricalPartners(player, other)) score += 1;
      // 🌍 Nômade — a nation link with anyone they're NOT already connected to. Checked LAST so it
      // never doubles a link nor downgrades a stronger one (e.g. a +2 shared-coach bond).
      else if (player.nomade || other.nomade) score += 1;
    }

    // Coach bond
    if (player.historicalCoaches?.includes(coachId)) score += 1;

    individual[player.id] = Math.min(3, Math.round(score / 3));
  }

  // Check historical trios
  const playerIds = players.map(historicalPlayerId);
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

  // Coach-preference bonus: the formation the manager is known for lifts team chemistry.
  const coachFormBonus = (formationId && COACHES.find(c => c.id === coachId)?.preferredFormation === formationId)
    ? PREFERRED_FORMATION_CHEM_BONUS : 0;

  // 🧱 Pilar lifts the team's chemistry · 🐺 Lobo Solitário drains it (per such player in the XI).
  const pilarBonus = players.filter(p => p.pilar).length * PILAR_CHEM_BONUS;
  const loboPenalty = players.filter(p => p.lobo).length * LOBO_CHEM_PENALTY;
  // 🛟 Noé — +30 na química geral, SÓ quando ele é o único titular com característica (põe o time na arca).
  const cardedXI = players.slice(0, 11).filter((p): p is Player => !!p && hasVariant(p));
  const noeBonus = (cardedXI.length === 1 && cardedXI[0].noe) ? NOE_CHEM_BONUS : 0;

  const total = Math.max(0, Math.min(100,
    Math.round((baseTotal / maxPossible) * 80) + trioBonus + coachFormBonus + pilarBonus - loboPenalty + noeBonus));

  return { individual, total, trios, outOfPosition, secondaryPos };
}

// The chemistry LINKS between players (who connects with whom and why). Same priority
// order as calculateChemistry (club > nation > shared coach > partner). Used to draw the
// connection web on the pitch and to explain each player's chemistry in the UI.
export type ChemLinkType = 'club' | 'nation' | 'coach' | 'partner';
export interface ChemLink { aIndex: number; bIndex: number; type: ChemLinkType }
export function getChemistryLinks(players: (Player | undefined)[], coachId: string): ChemLink[] {
  const links: ChemLink[] = [];
  for (let i = 0; i < players.length; i++) {
    const a = players[i]; if (!a) continue;
    for (let j = i + 1; j < players.length; j++) {
      const b = players[j]; if (!b) continue;
      let type: ChemLinkType | null = null;
      if (a.club === b.club) type = 'club';
      else if (a.nation === b.nation) type = 'nation';
      else if (a.historicalCoaches?.includes(coachId) && b.historicalCoaches?.includes(coachId)) type = 'coach';
      else if (areHistoricalPartners(a, b)) type = 'partner';
      else if (a.nomade || b.nomade) type = 'nation'; // 🌍 Nômade — nation link only where none exists
      if (type) links.push({ aIndex: i, bIndex: j, type });
    }
  }
  return links;
}

// ============================================================
// EFFECTIVE STATS CALCULATOR (for display in UI)
// ============================================================
export interface StatBreakdown {
  base: number;       // raw attribute
  chem: number;       // delta from the individual-chemistry multiplier (pura, sem penalidade de posição)
  position: number;   // 🔁 penalidade de posição (2ª = −7% / fora = −15%; 0 na nativa)
  coach: number;      // coach per-attribute modifier
  trait: number;      // sum of always-on trait bonuses
  tactic: number;     // play-style (tactic) bonus
  globalChem: number; // team-wide chemistry bonus (passing/pace only)
  captain: number;    // captain leadership bonus (+CAPTAIN_BOOST on the captain's best stat, for everyone)
  train: number;      // 💪 shop "Treino" — permanent, stacking per-attribute boost
  evolve: number;     // ⭐ Carta Evoluída — pontos livres distribuídos neste atributo
  char: number;       // 🩸❤️🪑 team-effect characteristics (Mártir/Ídolo/12º Homem) buffing THIS player
}

export interface EffectiveStats {
  overall: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  vision: number;
  composure: number;
  chemScore: number;
  isOOP: boolean;
  overallMod: number; // positive or negative delta vs base
  activeCoachEffects: string[];
  // Per-source breakdown so the UI can explain WHERE each buff comes from.
  chemMult: number;                                   // individual-chem multiplier (1.00–1.10, or OOP 0.85/0.92)
  globalChemBonus: { passing: number; pace: number; special: number }; // team-wide bonus in stat points (special = +3 to every attr at perfect chem)
  breakdown: Record<'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'vision' | 'composure', StatBreakdown>;
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
  // No `overall` here: the effective overall is DERIVED from the per-attribute deltas
  // (see getPlayerEffectiveStats), so a coach never carries a bespoke overall modifier.
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

  // Apply every coach bonus to its named attribute. The `phase` field
  // ('Criação'/'Finalização'/'Defesa'/'Todos') is descriptive: each attribute is only
  // read during its natural phase of play in the sim (shooting→finalização,
  // pace/dribbling→criação, defending/physical→defesa), so a per-attribute bonus
  // effectively only "fires" in that phase. Team strength uses RAW stats, so these
  // never inflate favouritism — they tilt the in-phase duels only. Display and sim
  // both read this function, so the breakdown UI stays in sync.
  for (const bonus of coach.bonuses) {
    const val = bonus.value;
    if (bonus.attribute === 'all') {
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
      modifiers.defending += 6;
      modifiers.activeEffects.push("Muralha Mourinho: +6 Defesa");
    }
  } else if (coachId === 'ancelotti') {
    if (player.overall >= 85) {
      const b = 4;
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
      // Every player already has the +2 base bonus above. Legends/immortals get a higher all-round
      // bump: +4 total normally, +6 in a knockout/final. `b` is the EXTRA added on top of the +2 base;
      // the label states the TOTAL (so it matches the per-attribute chips the player sees).
      let b = 2; // +2 base + 2 = +4 total
      let label = "Galácticos Zidane: +4 Geral";
      if (isFinal || isKnockout) {
        b = 4; // +2 base + 4 = +6 total
        label = isFinal ? "Rei da Final: +6 Geral" : "Rei do Mata-Mata: +6 Geral";
      }
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
  playStyle: string = 'balanced',
  context?: {
    isKnockout?: boolean;
    isFinal?: boolean;
    isLosing?: boolean;
    role?: string;
    // The captain's single best attribute is boosted by +amount for EVERY teammate
    // (and the captain himself). Mirrors getEffectiveAttribute so the modal matches the engine.
    captainBoost?: { stat: string; amount: number };
    // 🩸❤️🪑 per-player boosts from team-effect characteristics (keyed by player id).
    charBoosts?: CharBoostMap;
    // 🔁 jogando numa posição SECUNDÁRIA (−7%). Mantém a química (só o OOP zera).
    isSecondary?: boolean;
  }
): EffectiveStats {
  const isSecondary = context?.isSecondary ?? false;
  const versatile = hasOopRelief(player.traits); // 🧭 Versatilidade: joga secundárias sem penalidade
  const effectiveChem = isOOP ? 0 : chemScore;
  // Química PURA (OOP tem chem 0 → 1.00). A penalidade de POSIÇÃO é separada em posMult.
  const chemMult = effectiveChem === 3 ? 1.10 : effectiveChem === 2 ? 1.06 : effectiveChem === 1 ? 1.03 : 1.00;
  const oopMult = versatile ? 0.92 : 0.85;
  // Penalidade de posição: fora = −15% (−8% versátil); secundária = −7% (0% versátil); nativa = 0%.
  const posMult = isOOP ? oopMult : (isSecondary && !versatile ? SECONDARY_STAT_MULT : 1);

  const applyMult = (base: number) => Math.round(base * chemMult * posMult);
  const chemOnly = (base: number) => Math.round(base * chemMult);

  const modifiers = getCoachModifiersForPlayer(player, coachId, context);
  const chemBonus = getChemistryBonus(teamChemTotal);

  // Unconditional trait bonuses (no context → only 'always' boosts count; conditional
  // traits like "na final" are shown separately, not summed here).
  const traitBonus = (attr: AttrKey) => getTraitAttributeBonus(player.traits, attr);

  // Play-style (tactic) modifiers — same rules as getEffectiveAttribute.
  const styleBonus = (attr: AttrKey): number => tacticStatBonus(playStyle, attr);

  // Global chemistry bonus, same as the engine: +passing/+pace by tier, PLUS a flat +3
  // to every attribute once the team hits perfect chemistry (90+, chemBonus.special).
  const globalChem = (attr: AttrKey): number => {
    let v = chemBonus.special;
    if (attr === 'passing') v += chemBonus.passing * 2;
    if (attr === 'pace') v += chemBonus.pace * 2;
    return v;
  };

  // Captain leadership: +amount on the captain's single best stat, for the whole team
  // (the captain included). Same rule the match engine applies in getEffectiveAttribute.
  const captainBonus = (attr: AttrKey): number =>
    context?.captainBoost && attr === context.captainBoost.stat ? context.captainBoost.amount : 0;

  // 💪 Shop "Treino": a permanent, stacking per-attribute boost (no cap), same nature as the
  // other additive buffs — it feeds the per-attribute delta and therefore the effective overall.
  const trainBonus = (attr: AttrKey): number => player.trainBoosts?.[attr] ?? 0;
  const evolveBonus = (attr: AttrKey): number => player.evolvePoints?.[attr] ?? 0;

  // 🩸❤️🪑 Team-effect characteristics buffing THIS player (Mártir/Ídolo/12º Homem).
  const charB = context?.charBoosts?.[player.id];
  const charBonus = (attr: AttrKey): number => charB ? (charB.flatAll + (charB.perStat[attr] ?? 0)) : 0;

  // 🍿 Pipoqueiro — +N em tudo na fase de liga, −N no mata-mata (mesma regra do getEffectiveAttribute).
  const pipoqBonus = (_attr: AttrKey): number =>
    player.pipoqueiro ? (context?.isKnockout ? -PIPOQUEIRO_KO_PENALTY : PIPOQUEIRO_LEAGUE_BOOST) : 0;

  // All additive bonuses beyond chemistry-multiplier and the coach's per-attribute mod.
  const extra = (attr: AttrKey) => traitBonus(attr) + styleBonus(attr) + globalChem(attr) + captainBonus(attr) + trainBonus(attr) + evolveBonus(attr) + charBonus(attr) + pipoqBonus(attr);

  const eff = (base: number, mod: number, attr: AttrKey) =>
    Math.max(1, applyMult(base) + mod + extra(attr));

  const pace      = eff(player.pace, modifiers.pace, 'pace');
  const shooting  = eff(player.shooting, modifiers.shooting, 'shooting');
  const passing   = eff(player.passing, modifiers.passing, 'passing');
  const dribbling = eff(player.dribbling, modifiers.dribbling, 'dribbling');
  const defending = eff(player.defending, modifiers.defending, 'defending');
  const physical  = eff(player.physical, modifiers.physical, 'physical');
  // Vision & composure are full attributes too (they drive possession, playmaking and
  // penalties), so they go through the exact same pipeline and surface in the breakdown.
  const vision    = eff(player.vision, modifiers.vision, 'vision');
  const composure = eff(player.composure, modifiers.composure, 'composure');

  // Per-source breakdown (base + chem + coach + trait + tactic + globalChem = effective,
  // barring the rare Math.max(1, …) floor). Lets the UI show where each point comes from.
  const mkBreak = (base: number, mod: number, attr: AttrKey): StatBreakdown => ({
    base,
    chem: chemOnly(base) - base,                 // só química (sem penalidade de posição)
    position: applyMult(base) - chemOnly(base),  // 🔁 penalidade de posição (2ª = −7% / fora = −15%)
    coach: mod,
    trait: traitBonus(attr),
    tactic: styleBonus(attr),
    globalChem: globalChem(attr),
    captain: captainBonus(attr),
    train: trainBonus(attr),
    evolve: evolveBonus(attr),
    char: charBonus(attr),
  });

  // Effective overall = base overall + the MEAN change across ALL EIGHT attributes (the six
  // core + vision + composure, now first-class). ONE rule for every modifier (chemistry,
  // coach, traits, tactic, global chem): each already surfaces as a per-attribute delta, and
  // overall is simply their average — so nothing needs a bespoke "overall mod".
  // The "em alta" upgrade lives in the BASE (the six stats + player.overall), so it is already
  // reflected here without being a delta.
  const avgAttrDelta = Math.round(
    ((pace - player.pace) + (shooting - player.shooting) + (passing - player.passing)
      + (dribbling - player.dribbling) + (defending - player.defending) + (physical - player.physical)
      + (vision - player.vision) + (composure - player.composure)) / 8
  );
  const effectiveOverall = Math.max(1, player.overall + avgAttrDelta);
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
    vision,
    composure,
    chemScore: effectiveChem,
    isOOP,
    overallMod,
    activeCoachEffects: modifiers.activeEffects,
    chemMult,
    globalChemBonus: { passing: chemBonus.passing * 2, pace: chemBonus.pace * 2, special: chemBonus.special },
    breakdown: {
      pace: mkBreak(player.pace, modifiers.pace, 'pace'),
      shooting: mkBreak(player.shooting, modifiers.shooting, 'shooting'),
      passing: mkBreak(player.passing, modifiers.passing, 'passing'),
      dribbling: mkBreak(player.dribbling, modifiers.dribbling, 'dribbling'),
      defending: mkBreak(player.defending, modifiers.defending, 'defending'),
      physical: mkBreak(player.physical, modifiers.physical, 'physical'),
      vision: mkBreak(player.vision, modifiers.vision, 'vision'),
      composure: mkBreak(player.composure, modifiers.composure, 'composure'),
    },
  };
}

// `special` = flat "+N to EVERY attribute" awarded at each chemistry milestone (tiered): a gelled
// team gets steadily stronger, peaking at +5 for perfect chemistry (90+).
export function getChemistryBonus(total: number): { passing: number; pace: number; special: number } {
  if (total >= 90) return { passing: 3, pace: 2, special: 5 };
  if (total >= 75) return { passing: 2, pace: 1, special: 3 };
  if (total >= 60) return { passing: 1, pace: 1, special: 2 };
  if (total >= 45) return { passing: 1, pace: 0, special: 1 };
  return { passing: 0, pace: 0, special: 0 };
}

// ── Team-effect characteristics (Mártir 🩸 / Ídolo ❤️ / 12º Homem 🪑) ──────────────
// These buff OTHER players. computeCharacteristicBoosts returns, per XI player id, the extra
// attribute points they get from teammates' characteristics (stackable). The buffs then flow
// through getEffectiveAttribute / getPlayerEffectiveStats exactly like the captain boost.
// Cada contribuição individual (pra mostrar SEPARADO no painel: quem deu e quanto).
export type CharSource = { type: 'idolo' | 'martir' | 'decimoHomem' | 'noe' | 'forasteiro'; fromId: string; fromName: string; flatAll: number; perStat: Partial<Record<AttrKey, number>>; self?: boolean };
export type CharBoost = { flatAll: number; perStat: Partial<Record<AttrKey, number>>; sources: CharSource[] };
export type CharBoostMap = Record<string, CharBoost>;

export function computeCharacteristicBoosts(players: (Player | undefined)[]): CharBoostMap {
  const map: CharBoostMap = {};
  const xi = players.slice(0, 11).filter((p): p is Player => !!p);
  const slot = (id: string) => map[id] ?? (map[id] = { flatAll: 0, perStat: {}, sources: [] });
  // Registra uma contribuição: soma no total (flatAll/perStat, que o motor lê) E guarda a fonte.
  const contribute = (id: string, src: CharSource) => {
    const b = slot(id);
    b.flatAll += src.flatAll;
    for (const k in src.perStat) b.perStat[k as AttrKey] = (b.perStat[k as AttrKey] ?? 0) + (src.perStat[k as AttrKey] ?? 0);
    b.sources.push(src);
  };
  // ❤️ Ídolo — +2 em todos os atributos a cada OUTRO titular do MESMO CLUBE (NÃO a ele: o ídolo
  // inspira os companheiros de clube, não a si mesmo).
  for (const idol of xi) {
    if (!idol.idolo) continue;
    for (const mate of xi) if (mate.id !== idol.id && mate.club === idol.club) contribute(mate.id, { type: 'idolo', fromId: idol.id, fromName: idol.shortName, flatAll: 2, perStat: {} });
  }
  // 🩸 Mártir — +3 em tudo aos 2 titulares escolhidos (ou 2 maiores overalls além dele). Acumulável.
  for (const m of xi) {
    if (!m.martir) continue;
    let targets = (m.martirTargets ?? []).filter(id => id !== m.id && xi.some(p => p.id === id)).slice(0, 2);
    if (targets.length < 2) {
      const fill = xi.filter(p => p.id !== m.id && !targets.includes(p.id))
        .sort((a, b) => b.overall - a.overall).map(p => p.id);
      targets = [...targets, ...fill].slice(0, 2);
    }
    for (const id of targets) contribute(id, { type: 'martir', fromId: m.id, fromName: m.shortName, flatAll: 3, perStat: {} });
  }
  // 🪑 12º Homem — no BANCO (índice ≥11): +1 compostura e +2 visão a todo o XI.
  for (let i = 11; i < players.length; i++) {
    const p = players[i];
    if (!p?.decimoHomem) continue;
    for (const mate of xi) contribute(mate.id, { type: 'decimoHomem', fromId: p.id, fromName: p.shortName, flatAll: 0, perStat: { composure: 1, vision: 2 } });
  }
  // 🛟 Noé — SÓ rende se ele é o ÚNICO titular do XI com característica: +10 em tudo NELE.
  // (o +30 de química vive em calculateChemistry). Dois Noés no XI se cancelam (nenhum é "o único").
  const carded = xi.filter(hasVariant);
  if (carded.length === 1 && carded[0].noe) {
    const n = carded[0];
    contribute(n.id, { type: 'noe', fromId: n.id, fromName: n.shortName, flatAll: NOE_STAT_BOOST, perStat: {}, self: true });
  }
  // 🧳 Forasteiro — +5 em tudo quando é o ÚNICO titular do seu PAÍS e do seu CLUBE.
  for (const f of xi) {
    if (!f.forasteiro) continue;
    const soloNation = xi.filter(p => p.nation === f.nation).length === 1;
    const soloClub = xi.filter(p => p.club === f.club).length === 1;
    if (soloNation && soloClub) {
      contribute(f.id, { type: 'forasteiro', fromId: f.id, fromName: f.shortName, flatAll: FORASTEIRO_STAT_BOOST, perStat: {}, self: true });
    }
  }
  return map;
}

// Average passing of a team's midfield (central + wide mids) — a proxy for who
// controls the middle of the pitch. Used so a side that out-passes the opponent's
// midfield manufactures BETTER chances (passing finally feeds chance creation, not
// just assist selection). Falls back to the whole XI if no midfielders are fielded.
// Midfield build-up rating: passing (execution) blended with vision (the incisive idea /
// final ball). Vision is ~35% so a true playmaker lifts chance creation noticeably, without
// overshadowing pure passing. Feeds midfieldBuildUpEdge → the QUALITY of chances created.
export function teamPlaymaking(team: Team): number {
  const xi = team.players.slice(0, 11);
  const mids = xi.filter(p => ['CM', 'CAM', 'CDM', 'LM', 'RM'].includes(p.position));
  const pool = mids.length > 0 ? mids : xi;
  if (pool.length === 0) return 70;
  // EFFECTIVE passing/vision (coach, chemistry, traits, training, captain, tactic) — so a buffed
  // midfield really does create better chances, matching the attributes the duels already use.
  const coach = COACHES.find(c => c.id === team.coachId)!;
  const chemBonus = getChemistryBonus(team.totalChemistry);
  const captainBoost = captainBoostForTeam(team) ?? undefined;
  const charBoosts = computeCharacteristicBoosts(team.players);
  const eff = (p: PlayerCard, attr: 'passing' | 'vision') =>
    getEffectiveAttribute(p, attr, coach, 'Criação', chemBonus, team.playStyle ?? 'balanced', {
      captainBoost,
      charBoosts,
      role: formationRoleForPlayer(team, p),
    });
  return pool.reduce((s, p) => s + eff(p as PlayerCard, 'passing') * 0.65 + eff(p as PlayerCard, 'vision') * 0.35, 0) / pool.length;
}

// Build-up edge added to the attacker's chance-creation score: midfield-control gap
// (bounded) plus a nudge for the possession tactic. Kept modest so squad/tactic
// quality tilts — never decides — the duel on its own.
export function midfieldBuildUpEdge(atkMid: number, defMid: number, attackPlayStyle: string): number {
  const gap = Math.max(-8, Math.min(8, (atkMid - defMid) * 0.3));
  return gap + (attackPlayStyle === 'possession' ? 2 : 0);
}

// Realistic ball possession from squad strength + how the chances actually split,
// with a tactic tilt. Compressed toward the centre so it stays believable (rarely
// beyond ~28–72). Replaces the old hardcoded 50/50.
export function computePossession(
  homeStrength: number, awayStrength: number,
  homeShots: number, awayShots: number,
  homePlayStyle: string, awayPlayStyle: string,
  homeControl: number = 0, awayControl: number = 0,
): number {
  const strShare = homeStrength / (homeStrength + awayStrength || 1);
  const shotShare = (homeShots + 1) / (homeShots + awayShots + 2);
  let p = 0.55 * strShare + 0.45 * shotShare;
  if (homePlayStyle === 'possession') p += 0.05;
  if (awayPlayStyle === 'possession') p -= 0.05;
  if (homePlayStyle === 'counter') p -= 0.04;       // a side sitting deep sees less of the ball
  if (awayPlayStyle === 'counter') p += 0.04;
  p += (homeControl - awayControl) * 0.02;           // a midfield-heavy SHAPE owns more of the ball
  p = 0.5 + (p - 0.5) * 0.85;                        // compress toward the centre
  return Math.round(Math.max(28, Math.min(72, p * 100)));
}

// ── Free kick (direct) ────────────────────────────────────────────────────────
// Best dead-ball taker: a "Cobrador de Falta" specialist first, else the highest
// shooting+composure outfielder. Never the keeper.
export function getFreeKickTaker(team: Team): PlayerCard {
  const starters = team.players.slice(0, 11);
  const outfield = starters.filter(p => p.position !== 'GK');
  const pool = outfield.length > 0 ? outfield : starters;
  // The player's designated taker wins — but must be an outfielder (never the GK).
  if (team.freeKickTaker) {
    const chosen = pool.find(p => p.id === team.freeKickTaker);
    if (chosen) return chosen;
  }
  const specialist = pool.find(p => p.traits.includes('Cobrador de Falta') || p.traits.includes('Cobrança de Falta'));
  if (specialist) return specialist;
  return [...pool].sort((a, b) => (b.shooting + b.composure) - (a.shooting + a.composure))[0];
}

// Who gets on the end of a corner — a WEIGHTED RANDOM pick, not a fixed player.
// Strong/tall players (CBs, strikers) and heading specialists go up far more often,
// but a corner is a scramble, so it genuinely varies who heads it each time.
export function getHeaderTarget(team: Team): PlayerCard {
  const xi = team.players.slice(0, 11);
  const pool = xi.filter(p => p.position !== 'GK');
  const cand = pool.length > 0 ? pool : xi;
  const weighted = cand.map(p => {
    let w = (p.physical + p.shooting) / 2;                           // base aerial threat
    if (['CB', 'ST', 'CF'].includes(p.position)) w *= 1.8;           // these crash the box
    else if (['LB', 'RB', 'CDM', 'CM'].includes(p.position)) w *= 0.7;
    else w *= 0.4;                                                   // wingers/playmakers rarely head it
    if (p.traits.includes('Cabeceador Implacável')) w += 40;
    else if (p.traits.includes('Cabeceador')) w += 25;
    return { p, w: Math.max(1, w) };
  });
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of weighted) { r -= x.w; if (r <= 0) return x.p; }
  return weighted[weighted.length - 1].p;
}

// ============================================================
// ATTRIBUTE RESOLVER
// ============================================================
export function getEffectiveAttribute(
  player: PlayerCard,
  attribute: keyof Player,
  coach: Coach,
  phase: string,
  chemBonus: { passing: number; pace: number; special: number },
  playStyle: string,
  context?: {
    isKnockout?: boolean;
    isFinal?: boolean;
    isLosing?: boolean;
    role?: string;
    // The captain's single best attribute is boosted by +amount for EVERY teammate.
    captainBoost?: { stat: string; amount: number };
    // 🩸❤️🪑 per-player boosts from team-effect characteristics (keyed by player id).
    charBoosts?: CharBoostMap;
    // 🏟️ Estádio Prime do mandante (só setado pro time da casa) — buff temático nos 2 atributos.
    homeStadium?: Stadium;
  }
): number {
  let base = player[attribute] as number;

  // Individual chemistry bonus: If OOP, apply a stats debuff (softened by the
  // "Versatilidade" trait). If not, apply standard chemistry multipliers (+0% / +3% / +6% / +10%)
  const versatile = hasOopRelief(player.traits); // 🧭 Versatilidade: secundária sem penalidade
  const oopMult = versatile ? 0.92 : 0.85;
  const chemMult = player.isOOP ? oopMult : (player.chemistryScore >= 3 ? 1.10 : player.chemistryScore === 2 ? 1.06 : player.chemistryScore === 1 ? 1.03 : 1.00) * (player.isSecondary && !versatile ? SECONDARY_STAT_MULT : 1);
  base = Math.round(base * chemMult);

  // Chemistry global bonus (passing & pace)
  if (attribute === 'passing') base += chemBonus.passing * 2;
  if (attribute === 'pace') base += chemBonus.pace * 2;
  // Perfect team chemistry (90+): a flat +3 to EVERY attribute, for every starter — the
  // reward for a fully gelled XI. Lives here so it flows through both the match engine and
  // the modal (replaces the old flat +5 on team strength, which was an invisible team-only buff).
  base += chemBonus.special;

  // Coach bonuses (using the new unified modifiers function)
  const modifiers = getCoachModifiersForPlayer(player, coach.id, {
    isKnockout: context?.isKnockout,
    isFinal: context?.isFinal,
    isLosing: context?.isLosing,
    role: context?.role ?? player.position,
  });

  const mod = modifiers[attribute as keyof typeof modifiers] as number || 0;
  base += mod;

  // Play style modifiers (shared with the display so the two never drift)
  base += tacticStatBonus(playStyle, attribute as string);

  // Captain's leadership: their strongest attribute lifts the WHOLE team by +amount.
  if (context?.captainBoost && attribute === context.captainBoost.stat) base += context.captainBoost.amount;

  // Trait attribute bonuses (data-driven from the trait catalog)
  base += getTraitAttributeBonus(player.traits, attribute as AttrKey, context);

  // 💪 Shop "Treino": permanent, stacking per-attribute boost bought in the shop (no cap).
  base += (player.trainBoosts?.[attribute as keyof NonNullable<Player['trainBoosts']>] ?? 0);

  // ⭐ Carta Evoluída: pontos livres distribuídos (mesma natureza do Treino, sem teto).
  base += (player.evolvePoints?.[attribute as keyof NonNullable<Player['evolvePoints']>] ?? 0);

  // 🩸❤️🪑 Team-effect characteristics buffing this player (Mártir/Ídolo/12º Homem).
  const cb = context?.charBoosts?.[player.id];
  if (cb) base += cb.flatAll + (cb.perStat[attribute as AttrKey] ?? 0);

  // 🏟️ Vantagem de casa carimbada por atributo (só o mandante; homeStadium só é setado pra ele,
  // e nunca na final). Uniforme: +N em TODOS os atributos (+4 padrão / +7 Prime). Temático (Prime):
  // +3/+6 a mais nos 2 atributos do tema.
  const st = context?.homeStadium;
  if (st) {
    base += st.homeAttrBonus;
    if (st.prime && st.themedAttrs && (st.themedAttrs as string[]).includes(attribute as string)) {
      const themedForClubNation =
        (!!st.themedClub && player.club === st.themedClub) ||
        (!!st.themedNation && player.nation === st.themedNation);
      base += themedForClubNation ? PRIME_THEMED_CLUB_BONUS : PRIME_THEMED_BONUS;
    }
  }

  // 🍿 Pipoqueiro — brilha na fase de liga (+N em tudo), some no mata-mata (−N em tudo).
  if (player.pipoqueiro) base += context?.isKnockout ? -PIPOQUEIRO_KO_PENALTY : PIPOQUEIRO_LEAGUE_BOOST;

  return Math.max(1, base);
}

// ============================================================
// MATCH ENGINE
// ============================================================

// Balance knobs (tuned via client/src/lib/balance.test.ts to ~3.2 goals/match):
//  - GK_SAVE_EDGE: extra edge for the keeper in the shot-vs-keeper duel.
//  - ON_TARGET_RESISTANCE: higher = fewer shots on target (denominator of the
//    accuracy curve atkShooting/(atkShooting + resistance)). Both raise = fewer goals.
export const GK_SAVE_EDGE = 5;
export const ON_TARGET_RESISTANCE = 48;
// Global weight of FORMATION + TACTIC on results (chance volume + chance quality). 1.0 = baseline;
// >1 makes the shape/style choice matter more (squad strength is untouched). Applied to every
// formation/tactic scalar so the whole tactical contribution scales linearly by this factor.
export const TACTICAL_INFLUENCE = 1.2;
// Per-minute randomness in deciding which team attacks. Lower = team strength
// matters more. Tuned to 20 via the harness: favorites clearly win more (champion
// avg strength-rank ~8 of 36, vs ~18.5 random) while upsets stay common (a rank
// ~20+ team still lifts the trophy now and then). Football should be unpredictable.
export const MATCH_NOISE = 20;

// Home advantage: the host enjoys a small territorial edge (crowd, familiarity, no travel).
// Modelado como +4 em TODOS os atributos do mandante — e como a força do time é a média dos
// overalls efetivos, +4 em todo atributo desloca o overall (logo a força) em +4, então é aplicado
// como +4 direto na força. Aplicado EXCETO na grande final (campo neutro). Ver StadiumCard/DEFAULT_STADIUM.
export const HOME_ATTR_BONUS = 3;

// Jogar numa posição SECUNDÁRIA custa −7% (× 0.93) — entre a nativa (0%) e o fora-de-posição (−15%).
export const SECONDARY_STAT_MULT = 0.93;
export type PosFit = 'native' | 'secondary' | 'off';
export function positionFit(player: { position: string; secondaryPositions?: string[]; coringa?: boolean }, role: string): PosFit {
  if (player.coringa) return 'native';                       // 🃏 imune
  if (player.position === role) return 'native';
  if (effectiveSecondaries(player).includes(role)) return 'secondary';
  return 'off';
}

// Fase 2 (Técnico Prime): estádio temático. Buff de casa maior + temático em 2 atributos.
export const PRIME_HOME_ATTR_BONUS = 6;   // uniforme em casa (vs +3 do padrão)
export const PRIME_THEMED_BONUS = 3;      // nos 2 atributos do tema, todos os titulares do mandante
export const PRIME_THEMED_CLUB_BONUS = 6; // nos 2 atributos, pros do clube/nação daquele estádio

// ⭐ Cartas Evoluídas: 6 jogos como titular → libera 8 pontos livres (sem teto por atributo).
export const EVOLVE_GAMES = 6;
export const EVOLVE_POINTS = 8;
export function isEvolved(p: { appearances?: number }): boolean {
  return (p.appearances ?? 0) >= EVOLVE_GAMES;
}
export function evolvePointsSpent(ep?: Partial<Record<AttrKey, number>>): number {
  return ep ? (Object.values(ep) as number[]).reduce((s, v) => s + (v ?? 0), 0) : 0;
}
export function applyEvolvePoint(ep: Partial<Record<AttrKey, number>>, attr: AttrKey, delta: number): Partial<Record<AttrKey, number>> {
  const next = (ep[attr] ?? 0) + delta;
  if (next < 0) return ep;                                      // não abaixo de 0
  if (evolvePointsSpent(ep) + delta > EVOLVE_POINTS) return ep; // não passa de 8
  return { ...ep, [attr]: next };
}
// Valor de pontos digitado direto na caixa de um atributo → recortado pro que é
// válido: [0, atual + pontos que sobram], respeitando o teto de 8 no total.
// Valor inválido (NaN) mantém o atual. Não muda estado; devolve só o alvo em pontos.
export function clampEvolveInput(ep: Partial<Record<AttrKey, number>>, attr: AttrKey, typed: number): number {
  const current = ep[attr] ?? 0;
  if (!Number.isFinite(typed)) return current;
  const left = EVOLVE_POINTS - evolvePointsSpent(ep); // pontos livres além do que já está alocado
  const max = current + left;                         // teto que este atributo pode alcançar
  return Math.max(0, Math.min(Math.floor(typed), max));
}
export function bumpStarterAppearances(team: Team): Team {
  return { ...team, players: team.players.map((p, i) => i < 11 ? { ...p, appearances: (p.appearances ?? 0) + 1 } : p) };
}

// Formation counter edge: if your shape "counters" the opponent's (see FORMATIONS[].counters),
// you get this much added strength. A SOFT nudge on top of each formation's own profile (which
// already carries its identity) — kept at the home-advantage scale so picking the counter tilts
// the matchup without deciding it. The countered side gets +0 (not a penalty), so it's not a swing.
export const FORMATION_COUNTER_BONUS = 3;

// ── Flavour match statistics (shots/saves/corners/fouls) ──────
// These populate the box-score WITHOUT ever changing the score. They are
// per-minute probabilistic and scaled by a per-match tempo/aggression roll, so
// every match looks different (a one-sided thrashing, a scrappy foul-fest, a
// quiet game with few corners) instead of fixed averages.
const FLAVOR_SHOT_RATE = 0.20;  // base chance the attacking side takes an extra attempt this minute
const FLAVOR_FOUL_RATE = 0.24;  // base chance of a foul this minute
export const FREE_KICK_CHANCE = 0.10; // fraction of fouls that are dangerous → a direct free kick
export const CORNER_CHANCE = 0.14;    // fraction of corners that produce a header chance
// Momentum gained/lost by the team that scores. Lower = leads snowball less, so
// fewer blowouts and more balanced (drawn) games.
export const GOAL_MOMENTUM_SWING = 8;

// ── Open-play shot resolution (SHARED by the engine and the live sim) ──────────
// This is the single source of truth for the chance math, so the two run loops can
// never drift. Each side still builds its own events/messages/stats from the result.
export type ShotType = 'normal' | 'header' | 'long_range' | 'one_on_one' | 'first_time';
export interface ChanceResult {
  outcome: 'goal' | 'save' | 'miss' | 'duel';
  onTarget: boolean;
  shotType: ShotType;
}

// The kind of finish a chance becomes, derived from the build-up approach.
export function shotTypeForApproach(approach: string): ShotType {
  if (approach === 'cross') return 'header';
  if (approach === 'longrange') return 'long_range';
  if (approach === 'through' || approach === 'counter') return Math.random() < 0.6 ? 'one_on_one' : 'first_time';
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
  gkRating: number; // gk.defending + getGoalkeeperTraitBonus(gk.traits)
  approach: string;
}): ChanceResult {
  const atkScore = (p.atkShooting + p.atkPace + p.atkDribbling) / 3 + p.buildUp + Math.random() * 40;
  const defScore = (p.defDefending + p.defPhysical) / 2 + Math.random() * 40;
  if (atkScore <= defScore) return { outcome: 'duel', onTarget: false, shotType: 'normal' };

  const shotType = shotTypeForApproach(p.approach);
  const targetChance = (p.atkShooting / (p.atkShooting + ON_TARGET_RESISTANCE)) * SHOT_TARGET_MOD[shotType];
  if (Math.random() >= targetChance) return { outcome: 'miss', onTarget: false, shotType };

  const gkScore = p.gkRating + GK_SAVE_EDGE + SHOT_GK_MOD[shotType] + Math.random() * 36;
  const shootScore = p.atkShooting + Math.random() * 36;
  return { outcome: shootScore > gkScore ? 'goal' : 'save', onTarget: true, shotType };
}

// Key-event minutes for ONE match — the clear goalscoring chances ("lances de perigo").
// Jittered so every game has its own rhythm, but with a guaranteed MINIMUM SPACING so chances
// never land back-to-back (the old ±45% jitter let two fire within a minute of each other, which
// made matches feel like a chance every other minute). Fewer, better-spaced chances → a calmer,
// more realistic pace. Shared by the engine and the live sim.
export function buildKeyMinutes(isKnockout: boolean): number[] {
  const cap = isKnockout ? 120 : 90;
  const target = isKnockout ? 17 : 13;            // clear (open-play) chances per match
  const minGap = 3;                                // never two clear chances within 3' → still no back-to-back
  const gap = cap / (target + 1);
  const mins: number[] = [];
  for (let i = 1; i <= target; i++) {
    let m = Math.round(gap * i + (Math.random() * 2 - 1) * gap * 0.30); // gentler jitter (±30% of the gap)
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
export interface FormationProfile { attack: number; defense: number; control: number; cross: number; }

// Each shape's tactical fingerprint, tuned to its IDENTITY as a balanced TRADE-OFF: attack
// (territory/chance volume) is paired with defense (exposure when defending), so an attacking
// shape both scores AND concedes more, while a defensive shape does the reverse — no shape is
// strictly better. control = midfield grip (possession + chance quality); cross = wide vs narrow
// (shifts the chance mix between crosses and through-balls). Validated by the round-robin in
// balance.test.ts ("formation impact"). Magnitudes stay small — the shape TILTS, never decides.
const FORMATION_PROFILES: Record<string, FormationProfile> = {
  // Attacking, wide, well-rounded: takes territory, leaves just a LITTLE space behind (mild cost).
  '4-3-3':   { attack: 0.4, defense: 0, control: 0,  cross: 0 },
  // Patient control: double pivot is solid, the midfield owns the ball, but it's not direct.
  '4-2-3-1': { attack: -0.5, defense: 1, control: 0.75, cross: 0 },
  // Classic and compact: two banks of four are defensively organised (+defense), with no special
  // attacking or midfield tilt — the dependable all-rounder.
  '4-4-2':   { attack: 0,  defense: 0.75, control: 0, cross: 0 },
  // Midfield dominance through the middle, but only three at the back → ball-hungry yet exposed.
  '3-5-2':   { attack: 0,  defense: -0.25, control: 1.5, cross: -2 },
  // All-out attack: floods forward (most chances) and is wide open at the back (MOST exposed).
  '3-4-3':   { attack: 2,  defense: -2.5, control: 0,  cross: 1 },
  // Impenetrable back five that cedes the ball and hits on the counter: fewest chances, meanest D.
  '5-3-2':   { attack: -1, defense: 2,  control: 0,  cross: -2 },
};

export function formationProfile(formationId: string): FormationProfile {
  const explicit = FORMATION_PROFILES[formationId];
  if (explicit) return explicit;
  // Fallback for any shape without a hand-tuned entry: derive a profile from its role counts.
  const f = FORMATIONS.find(x => x.id === formationId);
  if (!f) return { attack: 0, defense: 0, control: 0, cross: 0 };
  const roles = f.positions.map(p => p.role);
  const cnt = (arr: string[]) => roles.filter(r => arr.includes(r)).length;
  const fwd = cnt(['ST', 'CF', 'LW', 'RW']);
  const def = cnt(['CB', 'LB', 'RB', 'LWB', 'RWB']);
  const mid = cnt(['CDM', 'CM', 'CAM', 'LM', 'RM']);
  const wide = cnt(['LW', 'RW', 'LM', 'RM', 'LB', 'RB', 'LWB', 'RWB']);
  return { attack: fwd - 2, defense: def - 4, control: mid - 4, cross: wide - 4 };
}

// ── Tactic (play-style) effects — SHARED so the engine and the display never drift ──
// Each tactic now has a richer attribute footprint (not a single stat) AND a profile
// (attack/defense/control) that shapes how many and how good its chances are.
export function tacticStatBonus(playStyle: string, attr: string): number {
  const core = attr === 'pace' || attr === 'shooting' || attr === 'passing'
    || attr === 'dribbling' || attr === 'defending' || attr === 'physical';
  switch (playStyle) {
    // Balanced is a real CHOICE, not the absence of one: a well-drilled side with no weak spot —
    // a modest +2 across every core stat (same total budget as the specialists, just no peak), so
    // it isn't strictly dominated by tactics that hand out free stats.
    case 'balanced':       return core ? 2 : 0;
    case 'possession':     return attr === 'passing' ? 5 : attr === 'vision' ? 5 : attr === 'dribbling' ? 3 : 0;
    case 'counter':        return (attr === 'pace' || attr === 'shooting') ? 5 : attr === 'defending' ? 2 : 0;
    case 'high_press':     return attr === 'physical' ? 5 : attr === 'defending' ? 3 : attr === 'pace' ? 2 : 0;
    case 'defensive':      return attr === 'defending' ? 8 : attr === 'physical' ? 3 : 0;
    case 'all_out_attack': return attr === 'shooting' ? 8 : attr === 'pace' ? 4 : attr === 'dribbling' ? 2 : 0;
    default:               return 0;
  }
}

// How a tactic shapes chance VOLUME (attack = territory/waves), how exposed it is
// (defense = lower opponent chance quality), and midfield grip (control = build-up).
export function tacticProfile(playStyle: string): { attack: number; defense: number; control: number } {
  switch (playStyle) {
    case 'possession':     return { attack: 0, defense: 0, control: 1 };   // patient, owns the midfield
    case 'counter':        return { attack: 1, defense: 0, control: -1 };  // sits in, hits fast (fewer but better chances)
    case 'high_press':     return { attack: 1, defense: -1, control: 1 };  // aggressive: wins it high, but the high line leaves space behind
    case 'defensive':      return { attack: -2, defense: 2, control: -1 }; // few chances, very hard to break down
    case 'all_out_attack': return { attack: 3, defense: -3.5, control: 0 }; // floods forward, wide open at the back
    case 'balanced':       return { attack: 0, defense: 0, control: 0.5 }; // well-drilled, slight midfield presence, no weak spot
    default:               return { attack: 0, defense: 0, control: 0 };
  }
}

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

  // Midfield passing ratings (constant across the match) feed chance quality.
  const homeMid = teamPlaymaking(home);
  const awayMid = teamPlaymaking(away);

  const homeFormBonus = homeFormation.counters.includes(away.formationId) ? FORMATION_COUNTER_BONUS : 0;
  const awayFormBonus = awayFormation.counters.includes(home.formationId) ? FORMATION_COUNTER_BONUS : 0;

  // Formation shape + tactic both shape how each side creates/concedes chances.
  const homeProf = formationProfile(home.formationId);
  const awayProf = formationProfile(away.formationId);
  const homeTac = tacticProfile(home.playStyle);
  const awayTac = tacticProfile(away.playStyle);
  // Captain leadership — computed once per side (the best stat is fixed for the match).
  const homeCaptainBoost = captainBoostForTeam(home) ?? undefined;
  const awayCaptainBoost = captainBoostForTeam(away) ?? undefined;
  // 🩸❤️🪑 Team-effect characteristics — computed once per side (constant across the match).
  const homeCharBoosts = computeCharacteristicBoosts(home.players);
  const awayCharBoosts = computeCharacteristicBoosts(away.players);

  const matchStats = { ...initialStats };

  const fergusonActive = (team: Team, goals: number, oppGoals: number) =>
    team.coachId === 'ferguson' && goals < oppGoals;

  const zidaneBonus = (team: Team) =>
    team.coachId === 'zidane' && (isKnockout || isFinal) ? (isFinal ? 10 : 7) : 0;

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
  const matchTempo = 0.7 + Math.random() * 0.6;       // 0.70 .. 1.30
  const matchAggression = 0.55 + Math.random() * 0.9; // 0.55 .. 1.45
  // 📉 Ímpeto COMPRIMIDO só para cartão/lesão → aproxima pico e vale sem mudar tempo/gols.
  const cardAggression = compressAggression(matchAggression);

  // Base team strength is CONSTANT across the match (squad, chemistry, coach, captain…), so
  // compute it ONCE here instead of every minute. Only the score-dependent Ferguson swing and
  // the host edge are applied per-minute below.
  // 🩹🟥 Estado disciplinar da partida: força base MUTÁVEL (recomputada por evento).
  const sentOff = new Set<string>();                 // ids removidos (🟥) → time joga com 10
  const injuredDebuff: Record<string, number> = {};  // id → jogador lesionado (capengando)
  let homeExtraPenalty = 0, awayExtraPenalty = 0;     // penalidade fixa do 🟥 (RED_PENALTY/RED_GK_PENALTY)
  const bookings = new Map<string, number>();         // id → nº de amarelos no jogo
  let totalCards = 0;                                  // 📉 nº de cartões no jogo (p/ o "juiz acalma")
  const disc = () => ({ sentOff, injuredDebuff, injuryDebuff: INJURY_DEBUFF });
  let homeBaseStrength = calculateTeamStrength(home, homeCoach, homeChem, homeFormBonus, disc()) + zidaneBonus(home);
  let awayBaseStrength = calculateTeamStrength(away, awayCoach, awayChem, awayFormBonus, disc()) + zidaneBonus(away);
  const recomputeStrength = () => {
    homeBaseStrength = calculateTeamStrength(home, homeCoach, homeChem, homeFormBonus, disc()) + zidaneBonus(home);
    awayBaseStrength = calculateTeamStrength(away, awayCoach, awayChem, awayFormBonus, disc()) + zidaneBonus(away);
  };
  const pushYellow = (p: Player, team: Team, min: number, cutDanger = false) => {
    // 🟨 texto puxa pelo perfil (compostura/posição) e por ter cortado um lance de perigo.
    events.push({ minute: min, type: 'yellow', teamId: team.id, playerId: p.id, description: yellowCardDesc(p.shortName, p.composure ?? 65, p.position, cutDanger) });
    totalCards++;
  };
  const applySendOff = (p: Player, team: Team, reason: 'red' | 'second-yellow', min: number) => {
    if (sentOff.has(p.id)) return;
    totalCards++;
    // 🟥 narração dramática e VARIADA — vermelho direto (viés por compostura) vs segundo amarelo.
    events.push({ minute: min, type: 'red', teamId: team.id, playerId: p.id, secondYellow: reason === 'second-yellow',
      description: reason === 'second-yellow' ? secondYellowDesc(p.shortName) : straightRedDesc(p.shortName, p.composure ?? 65) });
    sentOff.add(p.id);
    const pen = p.position === 'GK' ? RED_GK_PENALTY : RED_PENALTY;
    if (team.id === home.id) homeExtraPenalty += pen; else awayExtraPenalty += pen;
    recomputeStrength();
  };
  const applyInjury = (p: Player, team: Team, min: number) => {
    if (injuredDebuff[p.id] || sentOff.has(p.id)) return;
    injuredDebuff[p.id] = INJURY_DEBUFF;
    events.push({ minute: min, type: 'injury', teamId: team.id, playerId: p.id, description: injuryDesc(p.shortName) });
    recomputeStrength();
  };
  const pickFouler = (pool: Player[]): Player | undefined => {
    if (pool.length === 0) return undefined;
    const weights = pool.map(p => CARD_POS_MULT[p.position] ?? 1);
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
    return pool[pool.length - 1];
  };
  // Lesão aleatória (não-falta): prob. por titular por jogo, diluída por minuto.
  const span = Math.max(1, endMinute - startMinute);

  for (let minute = startMinute + 1; minute <= endMinute; minute++) {
    const isKeyEventMinute = KEY_MINUTES.includes(minute);

    // 🩹 Lesão ALEATÓRIA (sem falta): prob. por titular por jogo diluída pelos minutos, por físico.
    for (const [team, side] of [[home, 'h'], [away, 'a']] as [Team, string][]) {
      for (const p of team.players.slice(0, 11)) {
        if (injuredDebuff[p.id] || sentOff.has(p.id)) continue;
        if (Math.random() < randomInjuryChance(p.physical ?? 70) / span) { applyInjury(p, team, minute); break; }
      }
      void side;
    }

    // Vantagem de casa NÃO entra mais como bônus de força aqui: é carimbada por atributo em cada
    // titular do mandante (ver getEffectiveAttribute + homeStadium), então já flui pelos duelos.
    const homeStrength = homeBaseStrength - homeExtraPenalty +
      (fergusonActive(home, homeGoals, awayGoals) ? 10 : 0);
    const awayStrength = awayBaseStrength - awayExtraPenalty +
      (fergusonActive(away, awayGoals, homeGoals) ? 10 : 0);

    const homeMomBonus = (homeMomentum - 50) * 0.25;
    const awayMomBonus = (awayMomentum - 50) * 0.25;

    // Who carries the play this minute. An attacking shape pushes more territory (+attack), so it
    // ATTACKS more often (chance volume). The price for that volume is paid in formMod below: an
    // attacking shape's negative DEFENSE makes the chances it concedes far deadlier — so attack vs
    // defense is a real trade-off (more/own chances vs leakier when caught out), not pure upside.
    // The tactic's attacking intent is NOT applied here (it lifts own chance quality below instead).
    const homeAttack = homeStrength + homeMomBonus + homeProf.attack * 2 * TACTICAL_INFLUENCE + (Math.random() * 2 - 1) * MATCH_NOISE;
    const awayAttack = awayStrength + awayMomBonus + awayProf.attack * 2 * TACTICAL_INFLUENCE + (Math.random() * 2 - 1) * MATCH_NOISE;

    const homeAttacks = homeAttack > awayAttack;
    const attackTeam = homeAttacks ? home : away;
    const defendTeam = homeAttacks ? away : home;
    const attackCoach = homeAttacks ? homeCoach : awayCoach;
    const defendCoach = homeAttacks ? awayCoach : homeCoach;
    const attackChem = homeAttacks ? homeChem : awayChem;
    const defendChem = homeAttacks ? awayChem : homeChem;

    const homeIsLosing = homeGoals < awayGoals;
    const awayIsLosing = awayGoals < homeGoals;
    const matchCtxHome = { isKnockout, isFinal, isLosing: homeIsLosing, captainBoost: homeCaptainBoost, charBoosts: homeCharBoosts, homeStadium: isFinal ? undefined : stadiumFor(home.coachId, !!home.coachPrime) };
    const matchCtxAway = { isKnockout, isFinal, isLosing: awayIsLosing, captainBoost: awayCaptainBoost, charBoosts: awayCharBoosts };
    const attackCtx = homeAttacks ? matchCtxHome : matchCtxAway;
    const defendCtx = homeAttacks ? matchCtxAway : matchCtxHome;
    const playerContext = (team: Team, player: PlayerCard, ctx: typeof attackCtx) => ({
      ...ctx,
      role: formationRoleForPlayer(team, player),
    });

    // A dead-ball danger may fire this minute only if we're clear of any key chance and of the
    // last flavour danger (the cooldown) — this is what stops chances clustering / coming back-to-back.
    const nearKeyMinute = KEY_MINUTES.some(k => Math.abs(k - minute) < DANGER_COOLDOWN);
    const flavorDangerOk = !nearKeyMinute && (minute - lastFlavorDangerMin >= DANGER_COOLDOWN) && dangerCount < MAX_DANGER;

    // ── Flavour box-score + dead-ball play ──
    // The defending side fouls the attacking side this minute.
    if (Math.random() < FLAVOR_FOUL_RATE * matchAggression) {
      if (homeAttacks) matchStats.awayFouls++; else matchStats.homeFouls++;

      // 🔗 LIGAÇÃO com o lance de perigo: decide AGORA se a falta é dura (vira cobrança perigosa)
      // e se ela cortou um ataque ameaçador (momentum alto). Isso puxa a chance de cartão/lesão.
      const dangerousFoul = flavorDangerOk && Math.random() < FREE_KICK_CHANCE;
      const atkMomentum = homeAttacks ? homeMomentum : awayMomentum;
      const cutThreat = atkMomentum > 62; // o time que atacava estava pressionando
      const dangerCardMult = (dangerousFoul ? DANGEROUS_FOUL_CARD_MULT : 1) * (cutThreat ? THREAT_FOUL_CARD_MULT : 1);

      // 🟨🟥 Cartão do FALTADOR (lado defensor), ponderado por posição/compostura/ímpeto/tática/formação
      // E pela periculosidade da falta (falta dura ou que corta ameaça → mais cartão).
      const foulerPool = defendTeam.players.slice(0, 11).filter(p => !sentOff.has(p.id) && p.position !== 'GK');
      const fouler = pickFouler(foulerPool);
      if (fouler) {
        // tAgg = tática × formação × periculosidade × "juiz acalma" (settle) — sem o ímpeto cru.
        const tAgg = tacticAggression(defendTeam.playStyle ?? 'balanced') * formationAggression(defendTeam.formationId) * dangerCardMult * settleFactor(totalCards);
        if (Math.random() < STRAIGHT_RED_PROB * tAgg) {
          applySendOff(fouler, defendTeam, 'red', minute);
        } else {
          // 🟨 Já amarelado? O juiz pensa mais antes do 2º amarelo (que expulsa) → chance cai um pouco.
          const already = bookings.get(fouler.id) ?? 0;
          const bookedLeniency = already >= 1 ? SECOND_YELLOW_LENIENCY : 1;
          if (Math.random() < yellowChance(fouler.position, fouler.composure ?? 65, cardAggression) * tAgg * bookedLeniency) {
            if (already >= 1) applySendOff(fouler, defendTeam, 'second-yellow', minute);
            else { bookings.set(fouler.id, already + 1); pushYellow(fouler, defendTeam, minute, dangerousFoul || cutThreat); }
          }
        }
      }
      // 🩹 Lesão do FALTADO (lado atacante) — falta dura machuca mais, ponderada pelo físico.
      const fouledPool = attackTeam.players.slice(0, 11).filter(p => !injuredDebuff[p.id] && !sentOff.has(p.id) && p.position !== 'GK');
      const fouled = fouledPool[Math.floor(Math.random() * fouledPool.length)];
      if (fouled && Math.random() < injuryChanceFromFoul(fouled.physical ?? 70) * (dangerousFoul ? DANGEROUS_FOUL_INJURY_MULT : 1)) {
        applyInjury(fouled, attackTeam, minute);
      }

      // A MESMA falta dura vira a cobrança perigosa (não re-rola — conexão real com o cartão acima).
      if (dangerousFoul) {
        lastFlavorDangerMin = minute;
        dangerCount++;
        const fkGk = defendTeam.players.slice(0, 11).find(p => p.position === 'GK') ?? defendTeam.players[0];
        const taker = getFreeKickTaker(attackTeam);
        const takerCtx = playerContext(attackTeam, taker, attackCtx);
        const takerShoot = getEffectiveAttribute(taker, 'shooting', attackCoach, 'Finalização', attackChem, attackTeam.playStyle ?? 'balanced', takerCtx);
        const takerComp = getEffectiveAttribute(taker, 'composure', attackCoach, 'Finalização', attackChem, attackTeam.playStyle ?? 'balanced', takerCtx);
        const goalChance = freeKickGoalChance(takerShoot, takerComp);
        const r = Math.random();
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
    // An extra attempt by the side on top this minute (off-target / corner / saved — never a goal).
    if (Math.random() < FLAVOR_SHOT_RATE * matchTempo) {
      if (homeAttacks) matchStats.homeShots++; else matchStats.awayShots++;
      const o = Math.random();
      if (o < 0.34) {
        // on target but saved by the keeper
        if (homeAttacks) { matchStats.homeShotsOnTarget++; matchStats.awaySaves++; }
        else { matchStats.awayShotsOnTarget++; matchStats.homeSaves++; }
      } else if (o < 0.62) {
        // blocked/deflected out for a corner
        if (homeAttacks) matchStats.homeCorners++; else matchStats.awayCorners++;

        // A fraction of corners produce a header chance (set-piece goal). Conversion
        // is moderate, scaled by the aerial target's shooting + physical. The cooldown is
        // re-checked LIVE here (not the minute-start flavorDangerOk) so a corner can't fire in
        // the same minute as a free kick — keeping the spacing and the cap exact.
        if (dangerCount < MAX_DANGER && !nearKeyMinute && (minute - lastFlavorDangerMin >= DANGER_COOLDOWN) && Math.random() < CORNER_CHANCE) {
          lastFlavorDangerMin = minute;
          dangerCount++;
          const cgk = defendTeam.players.slice(0, 11).find(p => p.position === 'GK') ?? defendTeam.players[0];
          const header = getHeaderTarget(attackTeam);
          const headerCtx = playerContext(attackTeam, header, attackCtx);
          const hSkill = (getEffectiveAttribute(header, 'shooting', attackCoach, 'Finalização', attackChem, attackTeam.playStyle ?? 'balanced', headerCtx)
            + getEffectiveAttribute(header, 'physical', attackCoach, 'Finalização', attackChem, attackTeam.playStyle ?? 'balanced', headerCtx)) / 2;
          const goalChance = Math.max(0.04, Math.min(0.20, (hSkill - 74) / 95));
          const r2 = Math.random();
          if (homeAttacks) matchStats.homeShots++; else matchStats.awayShots++;

          if (r2 < goalChance) {
            if (homeAttacks) { homeGoals++; matchStats.homeShotsOnTarget++; } else { awayGoals++; matchStats.awayShotsOnTarget++; }
            if (playerStats[header.statId!]) { playerStats[header.statId!].goals++; playerStats[header.statId!].rating += 1.4; }
            if (playerStats[cgk.statId!]) playerStats[cgk.statId!].rating -= 0.3;
            const assister = pickWeightedAssister(attackTeam, header.id, playerStats);
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
    }

    if (isKeyEventMinute && dangerCount < MAX_DANGER) {
      const attackers = attackTeam.players.slice(0, 11).filter(p =>
        ['ST', 'CF', 'LW', 'RW', 'CAM'].includes(p.position)
      );
      const defenders = defendTeam.players.slice(0, 11).filter(p =>
        ['CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM'].includes(p.position)
      );

      const attacker = attackers.length > 0 ? pickWeightedAttacker(attackers) : attackTeam.players[10];
      const defender = defenders[Math.floor(Math.random() * defenders.length)] || defendTeam.players[0];
      const gk = defendTeam.players.find(p => p.position === 'GK') || defendTeam.players[0];

      // The wide creator must be SOMEONE ELSE — never the attacker himself, or the build-up
      // reads "Fulano cruza para Fulano... Fulano cabeceia" (happens when the attacker is a
      // winger, or in a team with no other wide option). Only the degenerate 1-player team falls back.
      const xiAtk = attackTeam.players.slice(0, 11);
      const widePlayer = xiAtk.find(p => p.id !== attacker.id && ['LW', 'RW', 'LM', 'RM'].includes(p.position))
        || xiAtk.find(p => p.id !== attacker.id && ['CAM', 'CM'].includes(p.position))
        || xiAtk.find(p => p.id !== attacker.id)
        || attacker;

      let approach: Approach = selectApproach(attackTeam.playStyle ?? 'balanced');
      // Narrow formations (3-5-2 / 5-3-2) cross far less — swap some crosses for
      // central through-balls, which shifts their chances from headers to one-on-ones.
      if ((homeAttacks ? homeProf : awayProf).cross <= -2 && approach === 'cross' && Math.random() < 0.6) {
        approach = 'through';
      }
      const isLuckEvent = Math.random() < 0.04;

      if (isLuckEvent) {
        dangerCount++; // a luck event always resolves into a clear chance (goal / penalty / woodwork)
        const randLuck = Math.random();

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
          // Conversion follows the SAME model as the shootout (penaltyGoalChance): the taker's
          // EFFECTIVE composure (+ penalty traits + designated bonus) vs the keeper's EFFECTIVE
          // shot-stopping — never a flat rate, so buffs and a strong/weak keeper actually matter.
          const takerCtx = playerContext(attackTeam, taker, attackCtx);
          const gkCtx = playerContext(defendTeam, gk, defendCtx);
          const penComp = getEffectiveAttribute(taker, 'composure', attackCoach, 'Finalização', attackChem, attackTeam.playStyle, takerCtx)
            + getPenaltyComposureBonus(taker.traits) + (taker.id === attackTeam.penaltyTaker ? 5 : 0);
          const penGkRef = getEffectiveAttribute(gk, 'defending', defendCoach, 'Defesa', defendChem, defendTeam.playStyle, gkCtx)
            + getGoalkeeperTraitBonus(gk.traits);
          const isPenGoal = Math.random() < penaltyGoalChance(penComp, penGkRef);
          if (isPenGoal) {
            if (homeAttacks) homeGoals++; else awayGoals++;
            if (playerStats[taker.statId!]) { playerStats[taker.statId!].goals++; playerStats[taker.statId!].rating += 1.0; }
            if (playerStats[defender.statId!]) playerStats[defender.statId!].rating -= 0.2;
            events.push({
              minute, type: 'goal',
              description: penaltyGoalDesc(taker.shortName, attacker.shortName, defender.shortName, gk.shortName),
              teamId: attackTeam.id, playerId: taker.id, opponentId: gk.id,
            });
            lastKeyCtx = { type: 'goal', teamId: attackTeam.id, atkName: taker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
            homeMomentum = homeAttacks ? Math.min(100, homeMomentum + 15) : Math.max(0, homeMomentum - 15);
            awayMomentum = homeAttacks ? Math.max(0, awayMomentum - 15) : Math.min(100, awayMomentum + 15);
          } else {
            if (Math.random() < 0.5) {
              if (playerStats[gk.statId!]) { playerStats[gk.statId!].saves++; playerStats[gk.statId!].rating += 0.8; }
              if (playerStats[taker.statId!]) playerStats[taker.statId!].rating -= 0.5;
              events.push({
                minute, type: 'save',
                description: penaltySaveDesc(gk.shortName, taker.shortName),
                teamId: defendTeam.id, playerId: gk.id, opponentId: taker.id,
              });
              lastKeyCtx = { type: 'save', teamId: defendTeam.id, atkName: taker.shortName, defName: defender.shortName, gkName: gk.shortName, approach };
            } else {
              if (playerStats[taker.statId!]) playerStats[taker.statId!].rating -= 0.6;
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
        const gkCtx = playerContext(defendTeam, gk, defendCtx);
        const atkShooting = getEffectiveAttribute(attacker, 'shooting', attackCoach, 'Finalização', attackChem, attackTeam.playStyle, attackerCtx);
        const atkPace = getEffectiveAttribute(attacker, 'pace', attackCoach, 'Criação', attackChem, attackTeam.playStyle, attackerCtx);
        const atkDribbling = getEffectiveAttribute(attacker, 'dribbling', attackCoach, 'Criação', attackChem, attackTeam.playStyle, attackerCtx);
        const defDefending = getEffectiveAttribute(defender, 'defending', defendCoach, 'Defesa', defendChem, defendTeam.playStyle, defenderCtx);
        const defPhysical = getEffectiveAttribute(defender, 'physical', defendCoach, 'Defesa', defendChem, defendTeam.playStyle, defenderCtx);

        // Trait effects are already baked into the effective attributes above
        // (see getEffectiveAttribute + trait catalog), so no extra bonuses here.
        // Midfield control (passing) lifts the quality of the chance created.
        // Formation + tactic tune chance QUALITY: the midfield-control battle and how
        // solid the defending side is (a deep block lowers the chance; an open one raises it).
        const atkProf = homeAttacks ? homeProf : awayProf;
        const defProf = homeAttacks ? awayProf : homeProf;
        const atkTac = homeAttacks ? homeTac : awayTac;
        const defTac = homeAttacks ? awayTac : homeTac;
        const formMod = (((atkProf.control + atkTac.control) - (defProf.control + defTac.control)) * 1.2
          + atkTac.attack * 1.6                          // attacking intent → better own chances
          - defProf.defense * 3.6                        // FORMATION defense: a deep block crushes chance quality,
                                                         //   an exposed back line (defense<0) leaks deadly chances —
                                                         //   strong enough to pay back the attacking shape's volume edge
          - defTac.defense * 2.2                         // tactic defensive intent (already tuned)
          ) * TACTICAL_INFLUENCE;                        // global weight of formation/tactic on chance quality
        const buildUp = midfieldBuildUpEdge(homeAttacks ? homeMid : awayMid, homeAttacks ? awayMid : homeMid, attackTeam.playStyle) + formMod;
        const chance = resolveOpenPlayChance({
          atkShooting, atkPace, atkDribbling, defDefending, defPhysical, buildUp,
          gkRating: getEffectiveAttribute(gk, 'defending', defendCoach, 'Defesa', defendChem, defendTeam.playStyle, gkCtx) + getGoalkeeperTraitBonus(gk.traits), approach,
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
                if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position) && playerStats[p.statId!]) {
                  playerStats[p.statId!].rating -= 0.1;
                }
              });

              const assister = pickWeightedAssister(attackTeam, attacker.id, playerStats);
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
              const creatorS = pickWeightedAssister(attackTeam, attacker.id, playerStats);
              if (creatorS && playerStats[creatorS.statId!]) { playerStats[creatorS.statId!].keyPasses++; playerStats[creatorS.statId!].rating += 0.25; }

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
            if (playerStats[attacker.statId!]) playerStats[attacker.statId!].rating -= 0.1;
            // The chance was still created — credit the supplier with a key pass.
            const creatorM = pickWeightedAssister(attackTeam, attacker.id, playerStats);
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
            if (Math.random() < 0.5) playerStats[defender.statId!].tackles++;
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
      home.players.slice(0, 5).forEach(p => { if (playerStats[p.statId!]) playerStats[p.statId!].rating += 0.1; });
      away.players.slice(0, 5).forEach(p => { if (playerStats[p.statId!]) playerStats[p.statId!].rating += 0.1; });
    }

    // Clean sheet bonuses
    if (awayGoals === 0) {
      home.players.slice(0, 11).forEach(p => {
        if (p.position === 'GK' && playerStats[p.statId!]) playerStats[p.statId!].rating += 0.8;
        else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position) && playerStats[p.statId!]) playerStats[p.statId!].rating += 0.4;
      });
    }
    if (homeGoals === 0) {
      away.players.slice(0, 11).forEach(p => {
        if (p.position === 'GK' && playerStats[p.statId!]) playerStats[p.statId!].rating += 0.8;
        else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position) && playerStats[p.statId!]) playerStats[p.statId!].rating += 0.4;
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

  // Real possession (was hardcoded 50/50): strength + chance share + tactic.
  const homeBaseStr = calculateTeamStrength(home, homeCoach, homeChem, homeFormBonus);
  const awayBaseStr = calculateTeamStrength(away, awayCoach, awayChem, awayFormBonus);
  matchStats.homePos = computePossession(
    homeBaseStr, awayBaseStr, matchStats.homeShots, matchStats.awayShots,
    home.playStyle ?? 'balanced', away.playStyle ?? 'balanced',
    homeProf.control, awayProf.control,
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
  };
}

// Direct free-kick conversion chance — scales with the taker's shooting AND composure,
// floored (0.015) and capped (0.11) so free kicks stay rare. Exported so the balance
// suite can assert composure actually moves the needle (it's too rare to sample in-sim).
export function freeKickGoalChance(shooting: number, composure: number): number {
  const skill = (shooting + composure) / 2;
  return Math.max(0.015, Math.min(0.11, (skill - 80) / 140));
}

// Penalty conversion chance — a DIFFERENCE model (taker composure vs keeper shot-stopping)
// instead of a ratio, which used to saturate ~70% for everyone. `comp` already includes the
// designated +5 and penalty traits (Cobrador +8, Frio na Final / Especialista +10 each), so a
// real taker sits ≈90 (plain) to ≈120 (full specialist) — the curve is centred on 100 (a good
// designated taker, ~62%) and moves ~1.2%/point of composure and ~1.1%/point of keeper rating,
// so even a 110 taker keeps differentiating instead of pinning the ceiling. Clamped to stay sane.
export function penaltyGoalChance(comp: number, gkRef: number): number {
  // Tuned on a strong keeper (gkRef 90): the composure ladder 80/85/90/95/100/110/120 lands on
  // 60/64/68/72/76/84/92%. ~0.8%/point of composure, ~1.1%/point of keeper rating.
  return Math.max(0.42, Math.min(0.94, 0.79 + (comp - 90) * 0.008 - (gkRef - 80) * 0.011));
}

export function simulateMatch(
  home: Team,
  away: Team,
  isKnockout: boolean = false,
  isFinal: boolean = false,
  resolveKnockoutTie: boolean = true,
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
  const r90 = runMatchSimulation(home, away, 0, 90, 0, 0, [], initialStats, playerStats, isKnockout, isFinal, false);

  if (isKnockout && resolveKnockoutTie && r90.homeGoals === r90.awayGoals) {
    // Tied at 90 → extra time (90→120). Winner determination + penalties handled inside.
    const rET = runMatchSimulation(home, away, 90, 120, r90.homeGoals, r90.awayGoals, r90.events, r90.stats, playerStats, true, isFinal, true);
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
    if (p.position === 'GK') playerStats[p.statId!].rating += 0.8;
    else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position)) playerStats[p.statId!].rating += 0.4;
  });
  if (hg === 0) away.players.slice(0, 11).forEach(p => {
    if (!playerStats[p.statId!]) return;
    if (p.position === 'GK') playerStats[p.statId!].rating += 0.8;
    else if (['CB', 'LB', 'RB', 'LWB', 'RWB'].includes(p.position)) playerStats[p.statId!].rating += 0.4;
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
  setStatIds(home, away);
  const playerStats: Record<string, PlayerMatchStat> = {};

  const initStatsForTeam = (team: Team) => {
    team.players.slice(0, 11).forEach(p => {
      playerStats[p.statId!] = {
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

  // Stat keys for an event's actor (on e.teamId) and its opponent (the other team).
  const otherTeam = (teamId?: string) => (teamId === home.id ? away.id : home.id);
  const actorKey = (e: MatchEvent, id?: string) => (e.teamId && id ? statKey(e.teamId, id) : undefined);
  const oppKey = (e: MatchEvent, id?: string) => (id ? statKey(otherTeam(e.teamId), id) : undefined);

  // Parse existing events to pre-fill stats
  existingEvents.forEach(e => {
    if (e.type === 'goal') {
      const sk = actorKey(e, e.playerId);
      if (sk && playerStats[sk]) { playerStats[sk].goals++; playerStats[sk].rating += 1.4; }
      const ak = actorKey(e, e.assisterId);
      if (ak && playerStats[ak]) { playerStats[ak].assists++; playerStats[ak].rating += 0.8; }
      const gk = oppKey(e, e.opponentId); // goalkeeper is on the opposing team
      if (gk && playerStats[gk]) playerStats[gk].rating -= 0.4;
    } else if (e.type === 'save') {
      const sk = actorKey(e, e.playerId);
      if (sk && playerStats[sk]) { playerStats[sk].saves++; playerStats[sk].rating += 0.4; }
      const ok = oppKey(e, e.opponentId);
      if (ok && playerStats[ok]) playerStats[ok].rating -= 0.1;
    } else if (e.type === 'miss') {
      const sk = actorKey(e, e.playerId);
      if (sk && playerStats[sk]) { playerStats[sk].shots++; playerStats[sk].rating -= 0.15; }
    } else if (e.type === 'duel') {
      const sk = actorKey(e, e.playerId);
      if (sk && playerStats[sk]) { playerStats[sk].tackles++; playerStats[sk].rating += 0.35; }
      const ok = oppKey(e, e.opponentId);
      if (ok && playerStats[ok]) playerStats[ok].rating -= 0.15;
    } else if (e.type === 'yellow') {
      const sk = actorKey(e, e.playerId);
      if (sk && playerStats[sk]) { playerStats[sk].yellowCards++; playerStats[sk].rating -= 0.5; }
    } else if (e.type === 'red') {
      const sk = actorKey(e, e.playerId);
      if (sk && playerStats[sk]) { playerStats[sk].redCards++; playerStats[sk].rating -= 1.5; }
    } else if (e.type === 'injury') {
      const sk = actorKey(e, e.playerId);
      if (sk && playerStats[sk]) playerStats[sk].rating -= 0.3;
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

// The captain's single strongest attribute is amplified by CAPTAIN_BOOST for EVERY
// teammate — so naming a captain is a tactical choice (which team-wide stat do you want
// lifted?), not just "give the armband to your best card". A bot (no captain set)
// defaults to its best player's strongest stat so it isn't shortchanged.
export const CAPTAIN_BOOST = 3;
const CAPTAIN_STATS: (keyof Player)[] = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical'];
export function captainBestStat(team: Team): keyof Player | null {
  return captainBestStatFromStarters(team.players.slice(0, 11), team.captain);
}

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
): number {
  let starters = team.players.slice(0, 11) as PlayerCard[];
  if (disc?.sentOff && disc.sentOff.size > 0) starters = starters.filter(p => !disc.sentOff!.has(p.id));
  // Guard against an empty lineup (would otherwise divide by zero → NaN strength).
  if (starters.length === 0) return 0;
  // Captain leadership: +CAPTAIN_BOOST on the captain's best stat, for every teammate (🗣️ Capitão Nato dobra).
  const captainBoost = captainBoostForTeam(team) ?? undefined;
  const charBoosts = computeCharacteristicBoosts(team.players);
  const avgStrength = starters.reduce((sum, p) => {
    // Strength is built from the EFFECTIVE attributes (not raw): individual + global chemistry,
    // the coach, traits, the captain and perfect-chem are all folded in via getEffectiveAttribute,
    // so a buff that helps in a duel also helps win territory. TACTIC is deliberately excluded
    // (the '__neutral__' play-style yields no tactic bonus — NOT 'balanced', which now carries its
    // own +2 buff) — tactics already shape possession + chance quality, so letting them tilt strength
    // too would double-count them and distort each tactic's risk/reward.
    const debuff = disc?.injuredDebuff?.[p.id] ? (disc.injuryDebuff ?? 0) : 0; // lesionado joga capengando
    const v = (s: keyof Player) => getEffectiveAttribute(p, s, coach, '', chemBonus, '__neutral__', {
      captainBoost,
      charBoosts,
      role: formationRoleForPlayer(team, p),
    }) - debuff;
    // GKs are evaluated on shot-stopping attributes (defending + physical), not the outfield
    // blend that low shooting/dribbling would distort. Outfielders use the six core stats PLUS
    // vision at half weight — playmaking is a real "control the game" signal. Composure is
    // deliberately NOT here: it's a clutch / dead-ball stat (penalties, free kicks), with no
    // open-play role, so it shouldn't tilt possession/territory.
    const base = p.position === 'GK'
      ? (v('defending') * 1.5 + v('physical') + v('pace') * 0.5) / 3
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
// the best outfield player by composure+shooting. NEVER the goalkeeper unless the
// XI somehow has no outfield player. Fixes the old bug where the keeper (slot 0)
// was the default taker.
export function getPenaltyTaker(team: Team): PlayerCard {
  const starters = team.players.slice(0, 11);
  const outfield = starters.filter(p => p.position !== 'GK');
  const pool = outfield.length > 0 ? outfield : starters;
  // The designated taker must be an outfielder — never the goalkeeper, even if a
  // stale/garbage penaltyTaker id points at him (that produced "GK scores penalty").
  if (team.penaltyTaker) {
    const chosen = pool.find(p => p.id === team.penaltyTaker);
    if (chosen) return chosen;
  }
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

// Resolves a single penalty kick: taker EFFECTIVE composure (+ frieza traits, + designated
// bonus) vs the keeper's EFFECTIVE shot-stopping (+ Reflexo Felino). Returns whether it went in.
type PenCtx = { coach: Coach; chem: { passing: number; pace: number; special: number }; playStyle: string };
function penaltyKickGoal(taker: PlayerCard, takerCtx: PenCtx, gk: PlayerCard, gkCtx: PenCtx, designatedTakerId: string): boolean {
  const comp = getEffectiveAttribute(taker, 'composure', takerCtx.coach, 'Finalização', takerCtx.chem, takerCtx.playStyle)
    + getPenaltyComposureBonus(taker.traits) + (taker.id === designatedTakerId ? 5 : 0);
  const gkRef = getEffectiveAttribute(gk, 'defending', gkCtx.coach, 'Defesa', gkCtx.chem, gkCtx.playStyle)
    + getGoalkeeperTraitBonus(gk.traits);
  return Math.random() < penaltyGoalChance(comp, gkRef);
}

export function simulatePenalties(home: Team, away: Team, _playerStats?: Record<string, PlayerMatchStat>): {
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
  // Per-team context so each kick uses EFFECTIVE composure/defending (coach, chemistry, traits…).
  const homeCtx: PenCtx = { coach: COACHES.find(c => c.id === home.coachId)!, chem: getChemistryBonus(home.totalChemistry), playStyle: home.playStyle ?? 'balanced' };
  const awayCtx: PenCtx = { coach: COACHES.find(c => c.id === away.coachId)!, chem: getChemistryBonus(away.totalChemistry), playStyle: away.playStyle ?? 'balanced' };

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
    const homeGoal = penaltyKickGoal(homeTaker, homeCtx, awayGK, awayCtx, homeTakerId);
    if (homeGoal) homeScore++;
    homeKicks++;
    kicks.push({ teamId: home.id, takerName: homeTaker.shortName, gkName: awayGK.shortName, isGoal: homeGoal });
    if (clinched()) { decided = true; break; }

    const awayTaker = awayTakers[awayKicks % awayTakers.length];
    const awayGoal = penaltyKickGoal(awayTaker, awayCtx, homeGK, homeCtx, awayTakerId);
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

      const homeGoalSD = penaltyKickGoal(homeTaker, homeCtx, awayGK, awayCtx, homeTakerId);
      const awayGoalSD = penaltyKickGoal(awayTaker, awayCtx, homeGK, homeCtx, awayTakerId);

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
const DRAFT_INFORM_CHANCE = 0.06;   // ⚡ Em alta — rare boosted card
// Extra special variants (mutually exclusive with each other and with "em alta"):
const DRAFT_LOBO_CHANCE = 0.04;     // 🐺 Lobo Solitário
const DRAFT_CORINGA_CHANCE = 0.04;  // 🃏 Coringa
const DRAFT_NOMADE_CHANCE = 0.04;   // 🌍 Nômade
const DRAFT_PILAR_CHANCE = 0.04;    // 🧱 Pilar
const DRAFT_MARTIR_CHANCE = 0.03;   // 🩸 Mártir
const DRAFT_IDOLO_CHANCE = 0.03;    // ❤️ Ídolo
const DRAFT_DECIMO_CHANCE = 0.03;   // 🪑 12º Homem
const DRAFT_PIPOQUEIRO_CHANCE = 0.03; // 🍿 Pipoqueiro
const DRAFT_NOE_CHANCE = 0.02;        // 🛟 Noé — raro (é MUITO forte)
const DRAFT_FORASTEIRO_CHANCE = 0.03; // 🧳 Forasteiro
const DRAFT_CAPITAO_CHANCE = 0.03;  // 🗣️ Capitão Nato
const DRAFT_MAGNATA_CHANCE = 0.03;  // 🤑 Magnata
const MARTIR_STAT_PENALTY = 6;      // Mártir: −6 em todos os atributos (nele mesmo)
const MAGNATA_STAT_PENALTY = 5;     // 🤑 Magnata: −5 em todos os atributos (nele mesmo)
// 🤑 Magnata — titular multiplica os PONTOS da partida de LIGA por isto (não empilha: 1+ magnatas → 1 só).
export const MAGNATA_POINT_MULT = 1.5;
// Pontos de LIGA ×MAGNATA_POINT_MULT se QUALQUER titular (0-10) for Magnata; senão ×1 (não empilha).
export function magnataPointMultiplier(starters: (Player | undefined)[]): number {
  return starters.slice(0, 11).some(p => p?.magnata) ? MAGNATA_POINT_MULT : 1;
}
// 🍿 Pipoqueiro — o anti-Pilar: brilha na fase de liga, "pipoca" (some) no mata-mata. Aplicado em
// RUNTIME (depende de context.isKnockout), por isso NÃO é assado no stat base como o Em Alta/Lobo.
export const PIPOQUEIRO_LEAGUE_BOOST = 4;   // +4 em cada atributo na FASE DE LIGA
export const PIPOQUEIRO_KO_PENALTY = 5;     // −5 em cada atributo no MATA-MATA
// 🛟 Noé — só rende quando é o ÚNICO titular do XI com característica: +10 em tudo NELE e +30 na
// química geral do time (ele "põe todo mundo na arca"). Condição/efeitos em computeCharacteristicBoosts
// (atributos) e calculateChemistry (o +30). O custo é estrutural: abrir mão de toda outra característica.
export const NOE_STAT_BOOST = 10;
export const NOE_CHEM_BONUS = 30;
// 🧳 Forasteiro — o anti-química: +5 em tudo quando é o ÚNICO titular do seu país E do seu clube.
export const FORASTEIRO_STAT_BOOST = 5;
// Single boost value: "em alta" adds this to EVERY attribute. The overall rises by the
// same amount as a CONSEQUENCE — overall is the mean of the attributes, so +N across all
// eight is +N overall. That's why it's described to the player simply as "+N em cada atributo".
const INFORM_STAT_BOOST = 3;
const LOBO_STAT_BOOST = 6;           // Lobo Solitário: a BIGGER personal boost (double the in-form)…
export const LOBO_CHEM_PENALTY = 12; // …paid for with this much TEAM chemistry per lone wolf.
export const PILAR_CHEM_BONUS = 12;  // Pilar: lifts the team's total chemistry by this much.

// Aplica o +N/−N das características assadas no BASE (Em Alta/Lobo/Mártir/Magnata). SEM teto de 99:
// o base pode passar de 99 (o efetivo já era livre). Mantém só o PISO de 1 (nenhum stat vira 0/negativo).
function clampStat(v: number): number {
  return Math.max(1, v);
}

function applyDraftVariant(p: Player): Player {
  const r = Math.random();
  let acc = DRAFT_INFORM_CHANCE;

  // ⚡ Em alta: +N to every attribute (overall follows) AND a guaranteed extra trait.
  if (r < acc) {
    const b = INFORM_STAT_BOOST;
    return {
      ...p, inForm: true, baseOverall: p.overall,
      overall: clampStat(p.overall + b), pace: clampStat(p.pace + b), shooting: clampStat(p.shooting + b),
      passing: clampStat(p.passing + b), dribbling: clampStat(p.dribbling + b), defending: clampStat(p.defending + b),
      physical: clampStat(p.physical + b), vision: clampStat(p.vision + b), composure: clampStat(p.composure + b),
      traits: rollPlayerTraits(p.position, p.rarity, 2),
    };
  }

  // 🐺 Lobo Solitário: a bigger personal boost than "em alta", but it drains the team's
  // chemistry (applied in calculateChemistry). baseOverall stored for the "+N" display.
  acc += DRAFT_LOBO_CHANCE;
  if (r < acc) {
    const b = LOBO_STAT_BOOST;
    return {
      ...p, lobo: true, baseOverall: p.overall,
      overall: clampStat(p.overall + b), pace: clampStat(p.pace + b), shooting: clampStat(p.shooting + b),
      passing: clampStat(p.passing + b), dribbling: clampStat(p.dribbling + b), defending: clampStat(p.defending + b),
      physical: clampStat(p.physical + b), vision: clampStat(p.vision + b), composure: clampStat(p.composure + b),
      traits: rollPlayerTraits(p.position, p.rarity, 2),
    };
  }

  // 🃏 Coringa · 🌍 Nômade · 🧱 Pilar — pure flags (no stat change); their effect lives in calculateChemistry.
  acc += DRAFT_CORINGA_CHANCE;
  if (r < acc) return { ...p, coringa: true, traits: rollPlayerTraits(p.position, p.rarity) };
  acc += DRAFT_NOMADE_CHANCE;
  if (r < acc) return { ...p, nomade: true, traits: rollPlayerTraits(p.position, p.rarity) };
  acc += DRAFT_PILAR_CHANCE;
  if (r < acc) return { ...p, pilar: true, traits: rollPlayerTraits(p.position, p.rarity) };

  // 🩸 Mártir: sacrifica-se (−6 em tudo) pra dar +3 em tudo a 2 titulares (efeito em computeCharacteristicBoosts).
  acc += DRAFT_MARTIR_CHANCE;
  if (r < acc) {
    const b = MARTIR_STAT_PENALTY;
    return {
      ...p, martir: true, baseOverall: p.overall,
      overall: clampStat(p.overall - b), pace: clampStat(p.pace - b), shooting: clampStat(p.shooting - b),
      passing: clampStat(p.passing - b), dribbling: clampStat(p.dribbling - b), defending: clampStat(p.defending - b),
      physical: clampStat(p.physical - b), vision: clampStat(p.vision - b), composure: clampStat(p.composure - b),
      traits: rollPlayerTraits(p.position, p.rarity),
    };
  }
  // ❤️ Ídolo · 🪑 12º Homem — flags puras; efeito em computeCharacteristicBoosts.
  acc += DRAFT_IDOLO_CHANCE;
  if (r < acc) return { ...p, idolo: true, traits: rollPlayerTraits(p.position, p.rarity) };
  acc += DRAFT_DECIMO_CHANCE;
  if (r < acc) return { ...p, decimoHomem: true, traits: rollPlayerTraits(p.position, p.rarity) };
  // 🍿 Pipoqueiro — flag pura; efeito (runtime, por fase) em getEffectiveAttribute/getPlayerEffectiveStats.
  acc += DRAFT_PIPOQUEIRO_CHANCE;
  if (r < acc) return { ...p, pipoqueiro: true, traits: rollPlayerTraits(p.position, p.rarity) };
  // 🛟 Noé · 🧳 Forasteiro — flags puras; efeito (por composição do XI) em computeCharacteristicBoosts.
  acc += DRAFT_NOE_CHANCE;
  if (r < acc) return { ...p, noe: true, traits: rollPlayerTraits(p.position, p.rarity) };
  acc += DRAFT_FORASTEIRO_CHANCE;
  if (r < acc) return { ...p, forasteiro: true, traits: rollPlayerTraits(p.position, p.rarity) };

  // 🗣️ Capitão Nato — flag pura; efeito (dobra o bônus de capitão SE for o capitão) em captainBoostFromStarters.
  acc += DRAFT_CAPITAO_CHANCE;
  if (r < acc) return { ...p, capitaoNato: true, traits: rollPlayerTraits(p.position, p.rarity) };

  // 🤑 Magnata — sacrifica −5 em tudo, mas multiplica os pontos da partida de liga (efeito em magnataPointMultiplier).
  acc += DRAFT_MAGNATA_CHANCE;
  if (r < acc) {
    const b = MAGNATA_STAT_PENALTY;
    return {
      ...p, magnata: true, baseOverall: p.overall,
      overall: clampStat(p.overall - b), pace: clampStat(p.pace - b), shooting: clampStat(p.shooting - b),
      passing: clampStat(p.passing - b), dribbling: clampStat(p.dribbling - b), defending: clampStat(p.defending - b),
      physical: clampStat(p.physical - b), vision: clampStat(p.vision - b), composure: clampStat(p.composure - b),
      traits: rollPlayerTraits(p.position, p.rarity),
    };
  }

  // Every other card is dealt fresh random traits (1 guaranteed + rarity-weighted extras).
  return { ...p, traits: rollPlayerTraits(p.position, p.rarity) };
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

function canPlayDraftPosition(player: Player, position: string): boolean {
  return player.position === position || effectiveSecondaries(player).includes(position);
}

// Position demand keeps rarity weighting inside the set of roles that are still
// open in the formation. Once a role is filled, it cannot reappear until the
// starter XI is complete (unless the player can fill another open role).
function draftPositionNeedWeight(player: Player, neededPositions: string[]): number {
  if (neededPositions.length === 0) return 1;

  const exactMatches = neededPositions.filter(pos => canPlayDraftPosition(player, pos)).length;
  const playerGroup = getPositionGroup(player.position as any);
  const groupNeeds = neededPositions.filter(pos => getPositionGroup(pos as any) === playerGroup).length;

  if (exactMatches > 0) return 4 + Math.min(exactMatches, 4) * 0.75 + Math.min(groupNeeds, 5) * 0.15;
  if (groupNeeds > 0) return 1.5 + Math.min(groupNeeds, 5) * 0.1;
  return 0.4;
}

function shuffleWithDraftNeed(pool: Player[], neededPositions: string[]): Player[] {
  const remaining = [...pool];
  const shuffled: Player[] = [];

  while (remaining.length > 0) {
    const weighted = remaining.map(player => {
      const rarityWeight = player.rarity === 'immortal' ? 1 : player.rarity === 'legendary' ? 2 : player.rarity === 'gold' ? 4 : player.rarity === 'silver' ? 6 : 8;
      return { player, weight: rarityWeight * draftPositionNeedWeight(player, neededPositions) };
    });
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = Math.random() * total;
    let chosenIndex = weighted.length - 1;
    for (let i = 0; i < weighted.length; i++) {
      roll -= weighted[i].weight;
      if (roll <= 0) {
        chosenIndex = i;
        break;
      }
    }
    shuffled.push(weighted[chosenIndex].player);
    remaining.splice(chosenIndex, 1);
  }

  return shuffled;
}

export function generateDraftOptions(
  neededPositions: string[],
  alreadyDrafted: string[],
): Player[] {
  const fullAvailable = PLAYERS.filter(p => !alreadyDrafted.includes(p.id));

  if (neededPositions.length === 0) {
    return withDraftVariants(shuffleWithRarityWeight(fullAvailable).slice(0, DRAFT_OPTIONS_COUNT));
  }

  // Hard-gate the starter draft to the remaining formation roles. This keeps
  // the draft varied by rarity, while preventing a second goalkeeper (or any
  // already-completed role) from appearing before the XI is complete.
  const available = fullAvailable.filter(p =>
    neededPositions.some(pos => canPlayDraftPosition(p, pos))
  );

  // ── STARTERS: guarantee at least 1 matches the next needed pos ──
  const primaryPos = neededPositions[0];
  const posGroup = primaryPos ? getPositionGroup(primaryPos as any) : null;

  // Pick 1 guaranteed card that fits the exact position (or group)
  const exactMatch = available.filter(p =>
    canPlayDraftPosition(p, primaryPos)
  );
  const groupMatch = posGroup
    ? available.filter(p => getPositionGroup(p.position as any) === posGroup && !exactMatch.includes(p))
    : [];

  // Shuffle each bucket
  const shuffledExact = shuffleWithDraftNeed(exactMatch, neededPositions);
  const shuffledGroup = shuffleWithDraftNeed(groupMatch, neededPositions);
  const shuffledAll   = shuffleWithDraftNeed(available, neededPositions);

  // Guaranteed slot: prefer exact match, fall back to group, then any
  const guaranteed = shuffledExact[0] ?? shuffledGroup[0] ?? shuffledAll[0];
  const usedIds = new Set<string>(guaranteed ? [guaranteed.id] : []);

  // Fill remaining slots using rarity plus the needs of all remaining roles.
  const rest = shuffledAll
    .filter(p => !usedIds.has(p.id))
    .slice(0, DRAFT_OPTIONS_COUNT - 1);

  const result = guaranteed ? [guaranteed, ...rest] : rest.slice(0, DRAFT_OPTIONS_COUNT);
  // Shuffle the final list so the guaranteed pick isn't always first
  return withDraftVariants(result.sort(() => Math.random() - 0.5));
}

// ── Shop packs ──────────────────────────────────────────────────────────────
// "Pacote do Craque": 3 elite (overall ≥ 88) players the team doesn't already own. Plain
// cards (no random draft variant) — what you see is what you buy.
const STAR_PACK_MIN_OVERALL = 88;
export function generateStarPackOptions(ownedIds: string[]): Player[] {
  let pool = PLAYERS.filter(p => !ownedIds.includes(p.id) && p.overall >= STAR_PACK_MIN_OVERALL);
  if (pool.length < 3) pool = PLAYERS.filter(p => !ownedIds.includes(p.id)).sort((a, b) => b.overall - a.overall);
  return shuffleWithRarityWeight(pool).slice(0, 3).map(p => ({ ...p }));
}

// "Caça-Talentos": 4 players that can fill a chosen position, that the team doesn't own.
export function generateScoutOptions(position: string, ownedIds: string[]): Player[] {
  let pool = PLAYERS.filter(p =>
    !ownedIds.includes(p.id) && (p.position === position || (p.secondaryPositions ?? []).includes(position)));
  if (pool.length < 4) pool = PLAYERS.filter(p => !ownedIds.includes(p.id));
  return shuffleWithRarityWeight(pool).slice(0, 4).map(p => ({ ...p }));
}

// "Turbinar Carta": apply a chosen special variant to an owned player. Mirrors applyDraftVariant
// but is deterministic (the player picks which) and preserves the card's existing traits.
export function applyShopVariant(player: Player, variant: 'inForm' | 'lobo' | 'coringa' | 'nomade' | 'pilar' | 'martir' | 'idolo' | 'decimoHomem' | 'pipoqueiro' | 'noe' | 'forasteiro' | 'capitaoNato' | 'magnata'): Player {
  if (variant === 'inForm' || variant === 'lobo' || variant === 'martir' || variant === 'magnata') {
    // inForm/lobo add to every attribute; martir/magnata SUBTRACT from every attribute.
    const b = variant === 'inForm' ? INFORM_STAT_BOOST : variant === 'lobo' ? LOBO_STAT_BOOST : variant === 'martir' ? -MARTIR_STAT_PENALTY : -MAGNATA_STAT_PENALTY;
    return {
      ...player, [variant]: true, baseOverall: player.baseOverall ?? player.overall,
      overall: clampStat(player.overall + b), pace: clampStat(player.pace + b), shooting: clampStat(player.shooting + b),
      passing: clampStat(player.passing + b), dribbling: clampStat(player.dribbling + b), defending: clampStat(player.defending + b),
      physical: clampStat(player.physical + b), vision: clampStat(player.vision + b), composure: clampStat(player.composure + b),
    };
  }
  return { ...player, [variant]: true };
}

// Does this card carry ANY special characteristic? (used to gate Turbinar — one per card — and
// to gate the "remover característica" purchase). Keeps every variant flag in ONE place.
const VARIANT_FLAGS = ['inForm', 'lobo', 'coringa', 'nomade', 'pilar', 'martir', 'idolo', 'decimoHomem', 'pipoqueiro', 'noe', 'forasteiro', 'capitaoNato', 'magnata'] as const;
export type VariantFlag = typeof VARIANT_FLAGS[number];
export function hasVariant(p: Player): boolean {
  return VARIANT_FLAGS.some(f => (p as unknown as Record<string, unknown>)[f]);
}
export function variantCount(p: Player): number {
  return VARIANT_FLAGS.filter(f => (p as unknown as Record<string, unknown>)[f]).length;
}
// ⭐ Cartas Únicas podem ter DUAS características (o diferencial delas); as demais, só uma.
export function maxVariantsFor(p: Player): number {
  return p.rarity === 'unique' ? 2 : 1;
}
export function canAddVariant(p: Player): boolean {
  return variantCount(p) < maxVariantsFor(p);
}

// Loja "Remover Característica": strips whatever special variant a card has, so the player can then
// apply a different one. Reverts the baked stat boost of the stat-changing variants (Em Alta/Lobo add,
// Mártir subtracts) via the stored baseOverall, then clears every variant flag.
export function stripVariant<T extends Player>(player: T): T {
  const p: T = { ...player };
  if (p.baseOverall !== undefined && (p.inForm || p.lobo || p.martir || p.magnata)) {
    const delta = p.overall - p.baseOverall; // +N for Em Alta/Lobo, −N for Mártir/Magnata
    p.pace = clampStat(p.pace - delta);
    p.shooting = clampStat(p.shooting - delta);
    p.passing = clampStat(p.passing - delta);
    p.dribbling = clampStat(p.dribbling - delta);
    p.defending = clampStat(p.defending - delta);
    p.physical = clampStat(p.physical - delta);
    p.vision = clampStat(p.vision - delta);
    p.composure = clampStat(p.composure - delta);
    p.overall = p.baseOverall;
  }
  delete p.baseOverall;
  delete p.inForm; delete p.lobo; delete p.coringa; delete p.nomade; delete p.pilar;
  delete p.martir; delete p.martirTargets; delete p.idolo; delete p.decimoHomem; delete p.pipoqueiro;
  delete p.noe; delete p.forasteiro; delete p.capitaoNato; delete p.magnata;
  return p;
}

// Loja "Remover Característica" quando a carta tem DUAS (só Únicas): remove APENAS a escolhida,
// preservando a outra. Reverte o efeito de stat da variante baked que sai (Em Alta/Lobo somaram,
// Mártir subtraiu) e só descarta o baseOverall se não sobrar nenhuma outra variante baked.
const BAKED_DELTA: Partial<Record<VariantFlag, number>> = {
  inForm: INFORM_STAT_BOOST, lobo: LOBO_STAT_BOOST, martir: -MARTIR_STAT_PENALTY,
};
export function stripSpecificVariant<T extends Player>(player: T, variant: VariantFlag): T {
  const p: T = { ...player };
  const d = BAKED_DELTA[variant] ?? 0;
  if (d !== 0 && p.baseOverall !== undefined) {
    p.pace = clampStat(p.pace - d); p.shooting = clampStat(p.shooting - d);
    p.passing = clampStat(p.passing - d); p.dribbling = clampStat(p.dribbling - d);
    p.defending = clampStat(p.defending - d); p.physical = clampStat(p.physical - d);
    p.vision = clampStat(p.vision - d); p.composure = clampStat(p.composure - d);
    p.overall = clampStat(p.overall - d);
    // baseOverall só faz sentido enquanto AINDA houver alguma variante baked ativa
    const otherBaked = (['inForm', 'lobo', 'martir'] as const).some(k => k !== variant && p[k]);
    if (!otherBaked) delete p.baseOverall;
  }
  delete (p as unknown as Record<string, unknown>)[variant];
  if (variant === 'martir') delete p.martirTargets;
  return p;
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

// Bots pick a tactic COERENTE com a formação e a dificuldade (não fica sempre no 'balanced'):
// formações ofensivas puxam táticas de ataque, defensivas puxam retranca/contra-ataque, e um bot
// mais forte joga mais assertivo (posse/pressão) enquanto o mais fraco senta mais atrás. Sorteio
// PONDERADO — então continua variado, sem virar regra fixa. 'balanced' mantém um peso-base sólido.
export function pickBotTactic(formationId: string, difficulty: number): string {
  const prof = formationProfile(formationId);
  const lean = prof.attack - prof.defense;   // >0 = formação ofensiva · <0 = formação defensiva
  const d = Math.max(0, Math.min(1, difficulty)); // 0.45 fácil … 0.97 difícil
  const up = Math.max(0, lean), down = Math.max(0, -lean);
  const weights: Record<string, number> = {
    balanced:       2.0,
    possession:     1.0 + up * 0.4 + d * 1.2,
    counter:        1.0 + down * 0.4 + (1 - d) * 1.0,
    high_press:     0.8 + up * 0.3 + d * 1.0,
    defensive:      0.8 + down * 0.6 + (1 - d) * 1.2,
    all_out_attack: 0.5 + up * 0.6 + d * 0.6,
  };
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let r = Math.random() * total;
  for (const [style, v] of entries) { r -= v; if (r <= 0) return style; }
  return 'balanced';
}

// 🎚️ Perfil de dificuldade: um `botStrength` (0.45 bronze … 0.97 imortal) vira VÁRIOS botões que
// deixam o bot mais forte E mais inteligente por nível. Puro/testável. (ver spec dificuldade-multidimensional)
export function difficultyProfile(strength: number) {
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  // Os botStrength dos 5 níveis têm espaçamento DESIGUAL → uma fórmula linear neles dá passos desiguais.
  // Mapeia strength → "tier" 0..1 UNIFORME entre os níveis (0=Bronze … 1=Imortal) pra a dificuldade
  // subir em passos PARELHOS. Contínuo (o ref/bots com strength intermediário caem no meio).
  const PTS = [0.45, 0.62, 0.75, 0.88, 0.97];
  let t = strength <= PTS[0] ? 0 : 1;
  for (let i = 0; i < PTS.length - 1; i++) {
    if (strength <= PTS[i + 1]) { t = (i + clamp((strength - PTS[i]) / (PTS[i + 1] - PTS[i]), 0, 1)) / (PTS.length - 1); break; }
  }
  return {
    // Gradação PARELHA e num patamar moderado (nerfado). A química fica abaixo do 1º marco (45) até
    // o topo, então a dificuldade sobe suave pelo OVERALL (sem marcos); só o Imortal cruza o marco.
    center: 78 + t * 11,           // Bronze 78 · Prata ~80,8 · Ouro ~83,5 · Lendário ~86,3 · Imortal 89 (passos iguais)
    loSpread: 8 - t * 4,           // piso sobe mais rápido que o teto
    hiSpread: 6,
    chemBias: t * 0.32,            // baixa (abaixo do "engate" ~0.3) → química sobe suave, sem pulo
    smartCoachChance: t,
    variantChance: Math.max(0, (t - 0.2) * 0.26), // rampa GRADUAL e fraca (Prata ~0 · Ouro ~8% · Lendário ~14% · Imortal ~21%)
  };
}

// Escolha PONDERADA POR QUÍMICA: com chemBias>0, prefere candidatos conectados (mesmo clube ×2,
// mesma nação ×1) aos já escolhidos — é o que faz o bot montar um XI entrosado nos níveis altos.
function pickChemAware(cands: Player[], selected: Player[], chemBias: number): Player {
  if (chemBias <= 0 || selected.length === 0) return cands[Math.floor(Math.random() * cands.length)];
  const conn = (p: Player) => selected.reduce((n, s) => n + (s.club === p.club ? 2 : 0) + (s.nation === p.nation ? 1 : 0), 0);
  const weights = cands.map(p => 1 + chemBias * conn(p) * 1.5);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) return cands[i]; }
  return cands[cands.length - 1];
}

export function generateBotTeam(name: string, difficulty: number): Team {
  const prof = difficultyProfile(difficulty);
  const formation = FORMATIONS[Math.floor(Math.random() * FORMATIONS.length)];
  // 🎩 Técnico: nos níveis altos, tende a escolher um que COMBINA com a formação (senão aleatório).
  let coach = COACHES[Math.floor(Math.random() * COACHES.length)];
  if (Math.random() < prof.smartCoachChance) {
    const fitting = COACHES.filter(c => c.preferredFormation === formation.id);
    if (fitting.length > 0) coach = fitting[Math.floor(Math.random() * fitting.length)];
  }

  // Difficulty sets the OVERALL BAND the bot recruits from; WITHIN the band each slot
  // is filled at RANDOM. So two bots of the same difficulty field different XIs drawn
  // from the WHOLE 200+ pool — not the same handful of top names every time — while a
  // harder bot still recruits from a clearly higher band than an easier one.
  const lo = prof.center - prof.loSpread, hi = prof.center + prof.hiSpread;

  const selected: Player[] = [];
  const taken = (p: Player) => selected.some(s => s.id === p.id);
  const inBand = (p: Player) => p.overall >= lo && p.overall <= hi;
  const fits = (p: Player, role: string) => p.position === role || (p.secondaryPositions?.includes(role) ?? false);
  const randOf = (arr: Player[]) => arr[Math.floor(Math.random() * arr.length)];

  // Fill formation positions (11 titulares) — dentro da faixa, por posição, PONDERADO POR QUÍMICA.
  for (const pos of formation.positions) {
    let cands = PLAYERS.filter(p => !taken(p) && fits(p, pos.role) && inBand(p));
    if (cands.length < 4) cands = PLAYERS.filter(p => !taken(p) && fits(p, pos.role)); // widen if scarce for this role
    if (cands.length === 0) cands = PLAYERS.filter(p => !taken(p) && inBand(p) && p.position !== 'GK');
    if (cands.length > 0) selected.push(pickChemAware(cands, selected, prof.chemBias));
  }

  // Complete missing slots if formation matching failed.
  while (selected.length < 11) {
    let rem = PLAYERS.filter(p => !taken(p) && inBand(p) && p.position !== 'GK');
    if (rem.length === 0) rem = PLAYERS.filter(p => !taken(p));
    if (rem.length === 0) break;
    selected.push(pickChemAware(rem, selected, prof.chemBias));
  }

  // 🎖️ Características: nos níveis altos, alguns titulares ganham uma variante SEMPRE-BOA
  // (Em Alta +3 em tudo, ou Pilar +química) — antes de calcular a química e o banco.
  if (prof.variantChance > 0) {
    for (let i = 0; i < Math.min(11, selected.length); i++) {
      if (Math.random() < prof.variantChance) {
        // Favorece Em Alta (boost liso de stats) sobre Pilar (+12 química, que pode cruzar marcos e criar degrau).
        selected[i] = applyShopVariant(selected[i], Math.random() < 0.75 ? 'inForm' : 'pilar');
      }
    }
  }

  // 🪑 Banco: 7 reservas da mesma faixa, GARANTINDO 1 goleiro reserva (p/ cobrir lesão/suspensão do GK).
  const bench: Player[] = [];
  const takenAll = (p: Player) => taken(p) || bench.some(b => b.id === p.id);
  let gkCands = PLAYERS.filter(p => !takenAll(p) && p.position === 'GK' && inBand(p));
  if (gkCands.length === 0) gkCands = PLAYERS.filter(p => !takenAll(p) && p.position === 'GK');
  if (gkCands.length > 0) bench.push(randOf(gkCands));
  while (bench.length < 7) {
    let rem = PLAYERS.filter(p => !takenAll(p) && inBand(p) && p.position !== 'GK');
    if (rem.length === 0) rem = PLAYERS.filter(p => !takenAll(p) && p.position !== 'GK');
    if (rem.length === 0) break;
    bench.push(randOf(rem));
  }
  const starters = selected.slice(0, 11); // química/forma só sobre os titulares
  selected.push(...bench);

  const formationRoles = formation.positions.map(p => p.role);
  const chemData = calculateChemistry(starters, coach.id, formationRoles, formation.id);

  const playerCards: PlayerCard[] = selected.map((p, idx) => ({
    ...p,
    traits: rollPlayerTraits(p.position, p.rarity), // random traits, like every card
    chemistryScore: chemData.individual[p.id] ?? 1,
    isOOP: chemData.outOfPosition[p.id] ?? false,
    isSecondary: chemData.secondaryPos[p.id] ?? false,
  }));

  return {
    id: `bot_${name.toLowerCase().replace(/\s/g, '_')}`,
    name,
    coachId: coach.id,
    formationId: formation.id,
    playStyle: pickBotTactic(formation.id, difficulty),
    players: playerCards,
    totalChemistry: chemData.total,
    isBot: true,
    botStrength: difficulty,
    crestId: BOT_CREST_MAP[name],
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
  const chemData = calculateChemistry(starters, team.coachId, formationRoles, team.formationId);

  const updatedPlayers = team.players.map((p, idx) => ({
    ...p,
    chemistryScore: chemData.individual[p.id] ?? 1,
    isOOP: chemData.outOfPosition[p.id] ?? false,
    isSecondary: chemData.secondaryPos[p.id] ?? false,
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

export function generateLeagueFixtures(teams: Team[], requestedRounds = DEFAULT_COMPETITION_FORMAT.leagueRounds): LeagueFixture[] {
  const fixtures: LeagueFixture[] = [];
  const N = teams.length;
  const tempTeams = [...teams];

  // With N teams, the circle method has N - 1 unique rounds. Keep this helper
  // defensive because it is also used by tests and old saved sessions.
  const rawRounds = Number.isFinite(requestedRounds) ? Math.trunc(requestedRounds) : DEFAULT_COMPETITION_FORMAT.leagueRounds;
  const rounds = Math.min(Math.max(rawRounds, 1), Math.max(1, N - 1));
  const matchesPerRound = Math.floor(N / 2);
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
export function createKnockoutBracket(
  standings: StandingsEntry[],
  requestedFormat = DEFAULT_COMPETITION_FORMAT,
): KnockoutBracket {
  const format = normalizeCompetitionFormat(requestedFormat);
  const seedId = (pos: number) => standings[pos - 1]?.teamId;

  // The Round of 16 always has 16 entrants. If the configured qualification
  // line is above 16, the lower half of that line plays a seeded playoff first.
  // Q=24 reproduces the original UCL path (8 direct + 16 playoff); Q=16 has no
  // playoff and sends the top 16 straight to the Round of 16.
  const playoffCount = format.qualifiedTeams - 16;
  const directCount = 16 - playoffCount;
  const playoffs = [];
  for (let i = 0; i < playoffCount; i++) {
    playoffs.push({
      id: `po_${i}`,
      homeTeamId: seedId(directCount + i + 1), // seeded half
      awayTeamId: seedId(format.qualifiedTeams - i), // unseeded half, reversed
      played: false,
    });
  }

  // Standard 16-slot bracket order: top seeds 1 and 2 remain on opposite sides.
  // Ranks after `directCount` are placeholders for playoff winners. This lets any
  // validated Q in [16, 24] produce a complete, deterministic bracket.
  const r16Ranks = [1, 16, 8, 9, 4, 13, 5, 12, 2, 15, 7, 10, 3, 14, 6, 11];
  const entrantForRank = (rank: number) => rank <= directCount
    ? { teamId: seedId(rank) }
    : { teamId: '', fromPlayoff: rank - directCount - 1 };
  const round16 = Array.from({ length: 8 }, (_, idx) => {
    const home = entrantForRank(r16Ranks[idx * 2]);
    const away = entrantForRank(r16Ranks[idx * 2 + 1]);
    return {
      id: `r16_${idx}`,
      homeTeamId: home.teamId,
      awayTeamId: away.teamId,
      ...(home.fromPlayoff !== undefined ? { homeFromPo: home.fromPlayoff } : {}),
      ...(away.fromPlayoff !== undefined ? { awayFromPo: away.fromPlayoff } : {}),
      played: false,
    };
  });

  return {
    playoffs,
    round16,
    quarterFinals: [],
    semiFinals: [],
    final: null,
    currentRound: playoffCount > 0 ? 'playoffs' : 'round16',
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
  // 90-minute return leg (draws allowed). It still uses knockout modifiers;
  // only the aggregate decides whether ET/penalties are necessary.
  let leg2 = simulateMatch(homeB, awayA, true, false, false);
  // Team A was first-leg HOME / second-leg AWAY; team B was first-leg AWAY / second-leg HOME.
  let aggA = leg1.homeGoals + leg2.awayGoals;
  let aggB = leg1.awayGoals + leg2.homeGoals;

  if (aggA === aggB) {
    // Level on aggregate → extra time (engine adds no auto-penalties here).
    leg2 = runMatchSimulation(
      homeB, awayA, 90, 120,
      leg2.homeGoals, leg2.awayGoals, leg2.events, leg2.stats,
      leg2.playerStats ?? {}, true, false, false
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
    tie.leg1 = simulateMatch(home, away, true, false, false); // 90', durationMinutes = 90
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
    // Slot each playoff winner into its predetermined Round-of-16 berth. Depending
    // on the configured line, a playoff winner can occupy either side of a tie.
    for (const tie of bracket.round16) {
      const homePo = tie.homeFromPo !== undefined ? bracket.playoffs[tie.homeFromPo] : undefined;
      const awayPo = tie.awayFromPo !== undefined ? bracket.playoffs[tie.awayFromPo] : undefined;
      if (homePo) tie.homeTeamId = winnerOf(homePo);
      if (awayPo) tie.awayTeamId = winnerOf(awayPo);
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
    // Match stats are keyed by team+player, so this never picks up a same-named
    // player from the OTHER team.
    const ps = r.playerStats?.[statKey(teamId, playerId)];
    if (ps) {
      {
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


