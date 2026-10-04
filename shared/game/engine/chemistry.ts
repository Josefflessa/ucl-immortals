// Chemistry, effective stats, team-effect characteristics and possession.

import { Player, COACHES, FORMATIONS, HISTORICAL_TRIOS } from '../gameData';
import { AttrKey, getTraitAttributeBonus } from '../traits';
import { sameClub } from '../crests';
import { projectLevel } from '../clubProjects';
import { random } from '../random';
import { historicalPlayerId, areHistoricalPartners, type PlayerCard, isExcludedPlayer, type Team, formationRoleForPlayer, matchRoleForPlayer, padrinhoGodchildId } from './teamModel';
import { getEffectiveAttribute, SECONDARY_STAT_MULT, positionFit, specializationAttributeBonus } from './attributes';
import { goalkeeperAptitudeDefending, tacticStatBonus } from './matchSim';
import { captainBoostForTeam } from './strength';
import { MARTIR_TARGET_BOOST, DECIMO_HOMEM_STAT_BOOST, PIPOQUEIRO_LEAGUE_BOOST, PIPOQUEIRO_KO_PENALTY, NOE_STAT_BOOST, NOE_CHEM_BONUS, FORASTEIRO_STAT_BOOST, IDOLO_STAT_BOOST, COLECIONADOR_PER_RESERVE, estribadoStatBoost, LOBO_CHEM_PENALTY, PILAR_CHEM_BONUS, RESILIENTE_DEFEAT_BOOST, TODOS_POR_UM_STAT_BOOST, TODOS_POR_UM_CHEM_BONUS, prodigioStatBoost, goleadorStatBoost, garcomStatBoost, arroganteStatBoost, arroganteTeamPenalty, mercenarioStatBoost, padrinhoStatBoost, PADRINHO_AFILHADO_BOOST, hasVariant } from './draft';

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

    // Encaixe em 3 estados: nativa / secundária (−5%) / fora (−15%). 🃏 Coringa é sempre nativa.
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
      if (sameClub(player.club, other.club)) score += 2;
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

  // Total chemistry. The base scale starts at 0, but additive bonuses are allowed
  // to push the total beyond 100; 90+ already represents the top global-bonus tier.
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
  // 🛟 Noé — +50 na química geral, SÓ quando ele é o único titular com característica (põe o time na arca).
  const cardedXI = players.slice(0, 11).filter((p): p is Player => !!p && hasVariant(p));
  const noeBonus = (cardedXI.length === 1 && cardedXI[0].noe) ? NOE_CHEM_BONUS : 0;
  // 🤝 Todos por um — só ativa com os 11 titulares marcados; quando fecha o XI,
  // a união vira um bônus forte de química geral.
  const todosPorUmBonus = players.length === 11 && players.every(player => player.todosPorUm)
    ? TODOS_POR_UM_CHEM_BONUS
    : 0;

  const total = Math.max(0,
    Math.round((baseTotal / maxPossible) * 80) + trioBonus + coachFormBonus + pilarBonus - loboPenalty + noeBonus + todosPorUmBonus);

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
      if (sameClub(a.club, b.club)) type = 'club';
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
  position: number;   // 🔁 penalidade de posição (2ª = −5% / fora = −15%; 0 na nativa)
  goalkeeper: number; // 🧤 aptidão no gol — ajuste exclusivo da DEF de jogadores de linha
  coach: number;      // coach per-attribute modifier
  trait: number;      // sum of always-on trait bonuses
  tactic: number;     // play-style (tactic) bonus
  globalChem: number; // team-wide chemistry bonus (passing/pace only)
  captain: number;    // captain leadership bonus (+CAPTAIN_BOOST on the captain's best stat, for everyone)
  train: number;      // 💪 shop "Treino" — permanent, stacking per-attribute boost
  evolve: number;     // ⭐ Carta Evoluída — bônus do atributo escolhido
  prodigio: number;   // 📈 Prodígio — +1 a cada titularidade desde que a carta recebeu a característica
  resiliente: number; // 🔥 Resiliente — +2 em tudo por derrota do time
  goleador: number;   // ⚽ Goleador — +1 em tudo a cada 3 gols marcados
  garcom: number;     // 🎯 Garçom — +1 em tudo a cada 2 assistências dadas
  arrogante: number;  // 👑 Arrogante — +2 em tudo por gol; −1 nos outros titulares a cada 2 gols
  estribado: number;  // 💰 Estribado — +1 em tudo a cada 100 créditos disponíveis
  mercenario: number; // 🏆 Conquistador — +2 em tudo por missão concluída
  padrinho: number; // 🤵 Padrinho — +1 permanente por gol do afilhado
  lapidado: number; // 💎 bônus permanente recebido de Lapidadores enquanto estava na reserva
  char: number;       // 🩸❤️🪑🤝 team-effect characteristics buffing THIS player
  pipoqueiro: number; // 🍿 Pipoqueiro — +N em tudo na fase de liga, −N no mata-mata
  specialization: number; // ⭐ Especialização do nível 4 — +6 nos dois atributos da área
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
  chemMult: number;                                   // individual-chem multiplier (1.00–1.10; OOP lives in posMult)
  globalChemBonus: { passing: number; pace: number; special: number }; // team-wide bonus in stat points (special = +1/+2/+3/+5 to every attr by chem tier)
  breakdown: Record<'pace' | 'shooting' | 'passing' | 'dribbling' | 'defending' | 'physical' | 'vision' | 'composure', StatBreakdown>;
}

export function getCoachModifiersForPlayer(
  player: Player,
  coachId: string,
  context?: {
    isKnockout?: boolean;
    isFinal?: boolean;
    isLosing?: boolean;
    coachPrime?: boolean;
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
  const coachPrime = context?.coachPrime ?? false;
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
      const b = coachPrime ? 7 : 3;
      modifiers.pace += b;
      modifiers.shooting += b;
      modifiers.passing += b;
      modifiers.dribbling += b;
      modifiers.defending += b;
      modifiers.physical += b;
      modifiers.composure += b;
      modifiers.vision += b;
      modifiers.activeEffects.push("Visão de Jogo" + (coachPrime ? " Prime" : "") + ": +" + b + " Geral");
    }
  } else if (coachId === 'klopp') {
    if (isLosing) {
      const b = coachPrime ? 14 : 8;
      modifiers.pace += b;
      modifiers.shooting += b;
      modifiers.passing += b;
      modifiers.dribbling += b;
      modifiers.defending += b;
      modifiers.physical += b;
      modifiers.composure += b;
      modifiers.vision += b;
      modifiers.activeEffects.push("Gegenpressing" + (coachPrime ? " Prime" : "") + ": +" + b + " Geral");
    }
  } else if (coachId === 'mourinho') {
    if (isGK) {
      modifiers.defending += 5;
      modifiers.activeEffects.push("Goleiro Mourinho: +5 Defesa");
    }
    if (isKnockout && isDefender) {
      const b = coachPrime ? 12 : 6;
      modifiers.defending += b;
      modifiers.activeEffects.push("Muralha Mourinho" + (coachPrime ? " Prime" : "") + ": +" + b + " Defesa");
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
      const b = coachPrime ? 12 : 6;
      modifiers.pace += b;
      modifiers.shooting += b;
      modifiers.passing += b;
      modifiers.dribbling += b;
      modifiers.defending += b;
      modifiers.physical += b;
      modifiers.composure += b;
      modifiers.vision += b;
      modifiers.activeEffects.push("Mentalidade Decisiva" + (coachPrime ? " Prime" : "") + ": +" + b + " Geral");
    }
  } else if (coachId === 'zidane') {
    if (player.rarity === 'legendary' || player.rarity === 'immortal') {
      // Every player already has the +2 base bonus above. Legends/immortals get a higher all-round
      // bump: +4 total normally, +6 in a knockout/final. `b` is the EXTRA added on top of the +2 base;
      // the label states the TOTAL (so it matches the per-attribute chips the player sees).
      let b = 2; // +2 base + 2 = +4 total
      let label = "Galácticos Zidane: +4 Geral";
      if (isFinal || isKnockout) {
        b = coachPrime ? 8 : 4; // +2 base + extra = +10 Prime or +6 normal total
        const total = coachPrime ? 10 : 6;
        label = isFinal
          ? "Rei da Final" + (coachPrime ? " Prime" : "") + ": +" + total + " Geral"
          : "Rei do Mata-Mata" + (coachPrime ? " Prime" : "") + ": +" + total + " Geral";
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
      const b = coachPrime ? 16 : 10;
      modifiers.pace += b;
      modifiers.shooting += b;
      modifiers.passing += b;
      modifiers.dribbling += b;
      modifiers.defending += b;
      modifiers.physical += b;
      modifiers.composure += b;
      modifiers.vision += b;
      modifiers.activeEffects.push("Fergie Time" + (coachPrime ? " Prime" : "") + ": +" + b + " Geral");
    }
  } else if (coachId === 'luis_enrique') {
    // Luis Enrique's identity is vertical circulation: midfielders find the next pass,
    // while the front line attacks the space immediately after the build-up.
    if (isMidfielder) {
      const b = coachPrime ? 7 : 3;
      modifiers.vision += b;
      modifiers.activeEffects.push("Transição Vertical" + (coachPrime ? " Prime" : "") + ": +" + b + " Visão (MC)");
    }
    if (['ST', 'LW', 'RW'].includes(pos)) {
      const b = coachPrime ? 6 : 2;
      modifiers.pace += b;
      modifiers.dribbling += b;
      modifiers.activeEffects.push("Transição Vertical" + (coachPrime ? " Prime" : "") + ": +" + b + " Ritmo/Drible (ataque)");
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
    coachPrime?: boolean;
    role?: string;
    // The captain's single best attribute is boosted by +amount for EVERY teammate
    // (and the captain himself). Mirrors getEffectiveAttribute so the modal matches the engine.
    captainBoost?: { stat: string; amount: number };
    // 🩸❤️🪑 per-player boosts from team-effect characteristics (keyed by player id).
    charBoosts?: CharBoostMap;
    // 💰 Estribado reads the owner's current shop-credit balance at runtime.
    credits?: number;
    // 🔎 Núcleo de Análise: cumulative tactic-buff tier for this team.
    analysisLevel?: number;
    // 🔁 jogando numa posição SECUNDÁRIA (−5%). Mantém a química (só o OOP zera).
    isSecondary?: boolean;
  }
): EffectiveStats {
  const isSecondary = context?.isSecondary ?? false;
  const effectiveChem = isOOP ? 0 : chemScore;
  // Química PURA (OOP tem chem 0 → 1.00). A penalidade de POSIÇÃO é separada em posMult.
  const chemMult = effectiveChem === 3 ? 1.10 : effectiveChem === 2 ? 1.06 : effectiveChem === 1 ? 1.03 : 1.00;
  const oopMult = 0.85;
  // Penalidade de posição: fora = −15%; secundária = −5%; nativa = 0%.
  const posMult = isOOP ? oopMult : (isSecondary ? SECONDARY_STAT_MULT : 1);

  const applyMult = (base: number) => Math.round(base * chemMult * posMult);
  const chemOnly = (base: number) => Math.round(base * chemMult);

  const modifiers = getCoachModifiersForPlayer(player, coachId, context);
  const chemBonus = getChemistryBonus(teamChemTotal);

  // Unconditional trait bonuses (no context → only 'always' boosts count; conditional
  // traits like "na final" are shown separately, not summed here).
  const traitBonus = (attr: AttrKey) => getTraitAttributeBonus(player.traits, attr);

  // Play-style (tactic) modifiers — same rules as getEffectiveAttribute.
  const styleBonus = (attr: AttrKey): number => tacticStatBonus(playStyle, attr, context?.analysisLevel);

  // Global chemistry bonus, same as the engine: +passing/+pace by tier, PLUS a flat
  // +1/+2/+3/+5 to every attribute by chemistry tier (45/60/75/90, chemBonus.special).
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
  const specializationBonus = (attr: AttrKey): number => specializationAttributeBonus(player, attr);
  // 📈 Prodígio: +1 a cada partida iniciada como titular desde que a carta recebeu a característica.
  const prodigioBonus = (_attr: AttrKey): number => player.prodigio ? prodigioStatBoost(player.prodigioStarts) : 0;
  // 🔥 Resiliente: cresce após cada derrota do time em que a carta foi titular.
  const resilienteBonus = (_attr: AttrKey): number => player.resiliente
    ? (player.resilienteDefeats ?? 0) * RESILIENTE_DEFEAT_BOOST
    : 0;
  // ⚽ Goleador / 🎯 Garçom: permanent all-attribute bonuses earned from the
  // authoritative cumulative match stats.
  const goleadorBonus = (_attr: AttrKey): number => player.goleador ? goleadorStatBoost(player.goleadorGoals) : 0;
  const garcomBonus = (_attr: AttrKey): number => player.garcom ? garcomStatBoost(player.garcomAssists) : 0;
  const arroganteBonus = (_attr: AttrKey): number => player.arrogante ? arroganteStatBoost(player.arroganteGoals) : 0;
  const estribadoBonus = (_attr: AttrKey): number => player.estribado ? estribadoStatBoost(context?.credits) : 0;
  const mercenarioBonus = (_attr: AttrKey): number => player.mercenario ? mercenarioStatBoost(player.mercenarioMissions) : 0;
  const padrinhoBonus = (_attr: AttrKey): number => player.padrinho ? padrinhoStatBoost(player.padrinhoGoals) : 0;
  const lapidadoBonus = (_attr: AttrKey): number => Math.max(0, player.lapidadoBoost ?? 0);

  // 🩸❤️🪑🤝 Team-effect characteristics buffing THIS player.
  const charB = context?.charBoosts?.[player.id];
  const charBonus = (attr: AttrKey): number => charB ? (charB.flatAll + (charB.perStat[attr] ?? 0)) : 0;

  // 🍿 Pipoqueiro — +N em tudo na fase de liga, −N no mata-mata (mesma regra do getEffectiveAttribute).
  const pipoqBonus = (_attr: AttrKey): number =>
    player.pipoqueiro ? (context?.isKnockout ? -PIPOQUEIRO_KO_PENALTY : PIPOQUEIRO_LEAGUE_BOOST) : 0;

  // All additive bonuses beyond chemistry-multiplier and the coach's per-attribute mod.
  const extra = (attr: AttrKey) => traitBonus(attr) + styleBonus(attr) + globalChem(attr) + captainBonus(attr) + trainBonus(attr) + evolveBonus(attr) + specializationBonus(attr) + prodigioBonus(attr) + resilienteBonus(attr) + goleadorBonus(attr) + garcomBonus(attr) + arroganteBonus(attr) + estribadoBonus(attr) + mercenarioBonus(attr) + padrinhoBonus(attr) + lapidadoBonus(attr) + charBonus(attr) + pipoqBonus(attr);

  const eff = (base: number, mod: number, attr: AttrKey) =>
    Math.max(1, applyMult(base) + mod + extra(attr));

  const pace      = eff(player.pace, modifiers.pace, 'pace');
  const shooting  = eff(player.shooting, modifiers.shooting, 'shooting');
  const passing   = eff(player.passing, modifiers.passing, 'passing');
  const dribbling = eff(player.dribbling, modifiers.dribbling, 'dribbling');
  const defendingBeforeGoalkeeper = eff(player.defending, modifiers.defending, 'defending');
  // A falta de aptidão para o gol é uma limitação da DEF para fazer defesas — não
  // uma penalidade geral na carta. Assim, FIS/RIT e os demais atributos continuam
  // exatamente como calculados pela posição e pela química.
  const defending = goalkeeperAptitudeDefending(player, defendingBeforeGoalkeeper, context?.role);
  const physical  = eff(player.physical, modifiers.physical, 'physical');
  // Vision & composure are full attributes too (they drive possession, playmaking and
  // penalties), so they go through the exact same pipeline and surface in the breakdown.
  const vision    = eff(player.vision, modifiers.vision, 'vision');
  const composure = eff(player.composure, modifiers.composure, 'composure');

  // Per-source breakdown (base + chem + coach + trait + tactic + globalChem = effective,
  // barring the rare Math.max(1, …) floor). Lets the UI show where each point comes from.
  const mkBreak = (base: number, mod: number, attr: AttrKey, goalkeeper = 0): StatBreakdown => ({
    base,
    chem: chemOnly(base) - base,                 // só química (sem penalidade de posição)
    position: applyMult(base) - chemOnly(base),  // 🔁 penalidade de posição (2ª = −5% / fora = −15%)
    goalkeeper,
    coach: mod,
    trait: traitBonus(attr),
    tactic: styleBonus(attr),
    globalChem: globalChem(attr),
    captain: captainBonus(attr),
    train: trainBonus(attr),
    evolve: evolveBonus(attr),
    specialization: specializationBonus(attr),
    prodigio: prodigioBonus(attr),
    resiliente: resilienteBonus(attr),
    goleador: goleadorBonus(attr),
    garcom: garcomBonus(attr),
    arrogante: arroganteBonus(attr),
    estribado: estribadoBonus(attr),
    mercenario: mercenarioBonus(attr),
    padrinho: padrinhoBonus(attr),
    lapidado: lapidadoBonus(attr),
    char: charBonus(attr),
    pipoqueiro: pipoqBonus(attr),
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
      defending: mkBreak(player.defending, modifiers.defending, 'defending', defending - defendingBeforeGoalkeeper),
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

// ── Team-effect characteristics (Mártir 🩸 / Ídolo ❤️ / 12º Homem 🪑 / Todos por um 🤝) ──
// These buff OTHER players. computeCharacteristicBoosts returns, per XI player id, the extra
// attribute points they get from teammates' characteristics (stackable). The buffs then flow
// through getEffectiveAttribute / getPlayerEffectiveStats exactly like the captain boost.
// Cada contribuição individual (pra mostrar SEPARADO no painel: quem deu e quanto).
export type CharSource = { type: 'idolo' | 'martir' | 'decimoHomem' | 'noe' | 'forasteiro' | 'colecionador' | 'todosPorUm' | 'arrogante' | 'padrinho'; fromId: string; fromName: string; flatAll: number; perStat: Partial<Record<AttrKey, number>>; self?: boolean };
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
    for (const mate of xi) if (mate.id !== idol.id && sameClub(mate.club, idol.club)) contribute(mate.id, { type: 'idolo', fromId: idol.id, fromName: idol.shortName, flatAll: IDOLO_STAT_BOOST, perStat: {} });
  }
  // 🩸 Mártir — +5 em tudo aos 2 titulares escolhidos (ou 2 maiores overalls além dele). Acumulável.
  for (const m of xi) {
    if (!m.martir) continue;
    let targets = (m.martirTargets ?? []).filter(id => id !== m.id && xi.some(p => p.id === id)).slice(0, 2);
    if (targets.length < 2) {
      const fill = xi.filter(p => p.id !== m.id && !targets.includes(p.id))
        .sort((a, b) => b.overall - a.overall).map(p => p.id);
      targets = [...targets, ...fill].slice(0, 2);
    }
    for (const id of targets) contribute(id, { type: 'martir', fromId: m.id, fromName: m.shortName, flatAll: MARTIR_TARGET_BOOST, perStat: {} });
  }
  // 🤵 Padrinho — o afilhado escolhido (ou o titular de maior overall além dele) ganha +3 em tudo
  // enquanto os dois são titulares. Vários Padrinhos podem apadrinhar o mesmo jogador (acumula).
  for (const godfather of xi) {
    if (!godfather.padrinho) continue;
    const godchildId = padrinhoGodchildId(xi, godfather.id);
    if (godchildId) contribute(godchildId, { type: 'padrinho', fromId: godfather.id, fromName: godfather.shortName, flatAll: PADRINHO_AFILHADO_BOOST, perStat: {} });
  }
  // 🪑 12º Homem — no BANCO (índice ≥11): +1 em todos os atributos a todo o XI.
  for (let i = 11; i < players.length; i++) {
    const p = players[i];
    if (!p?.decimoHomem) continue;
    for (const mate of xi) contribute(mate.id, { type: 'decimoHomem', fromId: p.id, fromName: p.shortName, flatAll: DECIMO_HOMEM_STAT_BOOST, perStat: {} });
  }
  // 🧩 Colecionador — titular recebe +1 em tudo por cada jogador que estiver na reserva.
  const reservePlayerCount = players.slice(11).filter((p): p is Player => !!p).length;
  for (const c of xi) {
    if (!c.colecionador) continue;
    contribute(c.id, { type: 'colecionador', fromId: c.id, fromName: c.shortName, flatAll: reservePlayerCount * COLECIONADOR_PER_RESERVE, perStat: {}, self: true });
  }
  // 🤝 Todos por um — a característica só existe de verdade quando o XI inteiro
  // a carrega. Cada titular recebe a mesma fonte para o breakdown explicar o +20.
  if (xi.length === 11 && xi.every(player => player.todosPorUm)) {
    for (const mate of xi) {
      contribute(mate.id, {
        type: 'todosPorUm',
        fromId: 'todos-por-um',
        fromName: 'Todos por um',
        flatAll: TODOS_POR_UM_STAT_BOOST,
        perStat: {},
        self: true,
      });
    }
  }
  // 👑 Arrogante — brilha individualmente, mas a cada 2 gols cobra −1 em tudo
  // dos OUTROS titulares. O próprio arrogante nunca recebe essa penalidade.
  for (const a of xi) {
    if (!a.arrogante) continue;
    const penalty = arroganteTeamPenalty(a.arroganteGoals);
    if (penalty === 0) continue;
    for (const mate of xi) {
      if (mate.id !== a.id) {
        contribute(mate.id, { type: 'arrogante', fromId: a.id, fromName: a.shortName, flatAll: -penalty, perStat: {} });
      }
    }
  }
  // 🛟 Noé — SÓ rende se ele é o ÚNICO titular do XI com característica: +20 em tudo NELE.
  // (o +50 de química vive em calculateChemistry). Dois Noés no XI se cancelam (nenhum é "o único").
  const carded = xi.filter(hasVariant);
  if (carded.length === 1 && carded[0].noe) {
    const n = carded[0];
    contribute(n.id, { type: 'noe', fromId: n.id, fromName: n.shortName, flatAll: NOE_STAT_BOOST, perStat: {}, self: true });
  }
  // 🧳 Forasteiro — +8 em tudo quando é o ÚNICO titular do seu PAÍS e do seu CLUBE.
  for (const f of xi) {
    if (!f.forasteiro) continue;
    const soloNation = xi.filter(p => p.nation === f.nation).length === 1;
    const soloClub = xi.filter(p => sameClub(p.club, f.club)).length === 1;
    if (soloNation && soloClub) {
      contribute(f.id, { type: 'forasteiro', fromId: f.id, fromName: f.shortName, flatAll: FORASTEIRO_STAT_BOOST, perStat: {}, self: true });
    }
  }
  return map;
}

interface TeamEffectiveStatsOptions {
  playStyle?: string;
  isKnockout?: boolean;
  isFinal?: boolean;
  isLosing?: boolean;
  // Match-only role changes, e.g. a line player taking the goal after a red card.
  roleOverrides?: Record<string, string>;
}

/**
 * Builds one effective-stat snapshot for every card in a team.
 *
 * This is deliberately team-scoped: the card value remains the source of truth
 * in Draft/shop/album/reinforcement pickers, while squad and match views can ask
 * for the same complete calculation (chemistry, coach, traits, tactic, captain
 * and team-effect characteristics) without duplicating the rules in each screen.
 * Reserves keep the team's global context, but do not receive an XI-only
 * individual chemistry, position or captain assignment.
 */
export function getTeamEffectiveStats(
  team: Team,
  options: TeamEffectiveStatsOptions = {},
): Record<string, EffectiveStats> {
  const formation = FORMATIONS.find(f => f.id === team.formationId);
  const formationRoles = formation?.positions.map(position => position.role) ?? [];
  const starters = team.players.slice(0, 11);
  const chemistry = calculateChemistry(starters, team.coachId, formationRoles, team.formationId);
  const captainBoost = captainBoostForTeam(team) ?? undefined;
  const charBoosts = computeCharacteristicBoosts(team.players);
  const playStyle = options.playStyle ?? team.playStyle ?? 'balanced';

  return Object.fromEntries(team.players.map((player, index) => {
    const isStarter = index < 11;
    const effective = getPlayerEffectiveStats(
      player,
      isStarter ? (chemistry.individual[player.id] ?? 0) : 0,
      isStarter ? (chemistry.outOfPosition[player.id] ?? false) : false,
      team.coachId,
      // Chemistry's global tier is a team-wide effect, including for the bench.
      chemistry.total,
      playStyle,
      {
        captainBoost: isStarter ? captainBoost : undefined,
        charBoosts,
        isKnockout: options.isKnockout,
        isFinal: options.isFinal,
        isLosing: options.isLosing,
        coachPrime: team.coachPrime,
        analysisLevel: projectLevel(team.clubProjects, 'analysis'),
        role: options.roleOverrides?.[player.id]
          ?? (isStarter ? (formationRoles[index] ?? player.position) : player.position),
        isSecondary: isStarter ? (chemistry.secondaryPos[player.id] ?? false) : false,
        credits: team.credits,
      },
    );
    return [player.id, effective];
  }));
}

/**
 * Bonuses a card carries wherever it goes (they live on the card itself).
 * Everything else — chemistry, position, coach, tactic, captain, teammates'
 * characteristics, the owner's credits (Estribado) and the owner's mission
 * count (Conquistador) — belongs to the team and is recalculated on a new one.
 */
const CARD_INTRINSIC_SOURCES = [
  'trait', 'train', 'evolve', 'specialization', 'prodigio', 'resiliente', 'goleador',
  'garcom', 'arrogante', 'padrinho', 'lapidado', 'pipoqueiro',
] as const;
const CARD_ATTRS = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'vision', 'composure'] as const;

/** A card's own value, as shown to anyone outside its team (market, trades). */
export function getCardIntrinsicStats(player: Player, options: { isKnockout?: boolean } = {}): {
  overall: number; pace: number; shooting: number; passing: number; dribbling: number;
  defending: number; physical: number; vision: number; composure: number;
} {
  const eff = getPlayerEffectiveStats(player, 0, false, '', 0, 'balanced', {
    isKnockout: options.isKnockout,
    role: player.position,
  });
  const values = Object.fromEntries(CARD_ATTRS.map(attr => {
    const breakdown = eff.breakdown[attr] as unknown as Record<string, number>;
    const bonus = CARD_INTRINSIC_SOURCES.reduce((sum, key) => sum + (breakdown[key] ?? 0), 0);
    return [attr, Math.max(1, player[attr] + bonus)];
  })) as Record<(typeof CARD_ATTRS)[number], number>;
  const meanDelta = Math.round(CARD_ATTRS.reduce((sum, attr) => sum + values[attr] - player[attr], 0) / CARD_ATTRS.length);
  return { overall: Math.max(1, player.overall + meanDelta), ...values };
}

// Average passing of a team's midfield (central + wide mids) — a proxy for who
// controls the middle of the pitch. Used so a side that out-passes the opponent's
// midfield manufactures BETTER chances (passing finally feeds chance creation, not
// just assist selection). Falls back to the whole XI if no midfielders are fielded.
// Midfield build-up rating: passing (execution) blended with vision (the incisive idea /
// final ball). Vision is ~35% so a true playmaker lifts chance creation noticeably, without
// overshadowing pure passing. Feeds midfieldBuildUpEdge → the QUALITY of chances created.
export function teamPlaymaking(team: Team, playStyleOverride = team.playStyle): number {
  const xi = team.players.slice(0, 11);
  const mids = xi.filter(p => ['CM', 'CAM', 'CDM', 'LM', 'RM'].includes(matchRoleForPlayer(team, p)));
  const pool = mids.length > 0 ? mids : xi;
  if (pool.length === 0) return 70;
  // EFFECTIVE passing/vision (coach, chemistry, traits, training, captain, tactic) — so a buffed
  // midfield really does create better chances, matching the attributes the duels already use.
  const coach = COACHES.find(c => c.id === team.coachId)!;
  const chemBonus = getChemistryBonus(team.totalChemistry);
  const captainBoost = captainBoostForTeam(team) ?? undefined;
  const charBoosts = computeCharacteristicBoosts(team.players);
  const eff = (p: PlayerCard, attr: 'passing' | 'vision') =>
    getEffectiveAttribute(p, attr, coach, chemBonus, playStyleOverride ?? 'balanced', {
      captainBoost,
      charBoosts,
      coachPrime: team.coachPrime,
      analysisLevel: projectLevel(team.clubProjects, 'analysis'),
      role: formationRoleForPlayer(team, p),
      credits: team.credits,
    });
  return pool.reduce((s, p) => s + eff(p as PlayerCard, 'passing') * 0.65 + eff(p as PlayerCard, 'vision') * 0.35, 0) / pool.length;
}

// Build-up edge added to the attacker's chance-creation score: midfield-control gap plus a
// nudge for the possession tactic. Weighted (0.3) so squad/tactic quality tilts the duel, with
// no ceiling — a better midfield always helps a little more.
export function midfieldBuildUpEdge(atkMid: number, defMid: number, attackPlayStyle: string): number {
  const gap = (atkMid - defMid) * 0.3;
  return gap + (attackPlayStyle === 'possession' ? 2 : 0);
}

// Realistic ball possession from squad strength + how the chances actually split,
// with a tactic tilt. Compressed toward the centre with a smooth curve so it stays believable
// (approaches but never reaches 28/72): a stronger side always keeps a little more of the ball.
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
  p = 0.5 + 0.22 * Math.tanh(((p - 0.5) * 0.85) / 0.22); // compress toward the centre (≈ linear near 50%)
  return Math.round(p * 100);
}

// ── Free kick (direct) ────────────────────────────────────────────────────────
// Best dead-ball taker: a "Cobrador de Falta" specialist first, else the highest
// shooting+composure outfielder. A goalkeeper is eligible only when the card
// explicitly has that specialist trait (Rogério Ceni is the intentional case).
// During a match, excludedIds prevents an already sent-off player from taking a later free kick.
export function getFreeKickTaker(team: Team, excludedIds?: ReadonlySet<string>): PlayerCard {
  const starters = team.players.slice(0, 11);
  const available = starters.filter(p => !isExcludedPlayer(team, p, excludedIds));
  const availableOutfield = available.filter(p => matchRoleForPlayer(team, p) !== 'GK');
  const outfield = starters.filter(p => matchRoleForPlayer(team, p) !== 'GK');
  const isSpecialist = (p: PlayerCard) => p.traits.includes('Cobrador de Falta') || p.traits.includes('Cobrança de Falta');
  // A normal match always leaves an available outfielder. Keep a defensive
  // fallback for malformed/legacy lineups so this helper never returns undefined.
  const pool = availableOutfield.length > 0 ? availableOutfield : outfield.length > 0 ? outfield : starters;
  // A designated taker wins when valid. A GK designation is accepted only for
  // a card that explicitly carries the free-kick specialist trait.
  if (team.freeKickTaker) {
    const chosen = available.find(p => p.id === team.freeKickTaker);
    if (chosen && (matchRoleForPlayer(team, chosen) !== 'GK' || isSpecialist(chosen))) return chosen;
  }
  const specialist = available.find(isSpecialist);
  if (specialist) return specialist;
  return [...pool].sort((a, b) => (b.shooting + b.composure) - (a.shooting + a.composure))[0];
}

// Who gets on the end of a corner — a WEIGHTED RANDOM pick, not a fixed player.
// Strong/tall players (CBs, strikers) and heading specialists go up far more often,
// but a corner is a scramble, so it genuinely varies who heads it each time.
export function getHeaderTarget(team: Team, excludedIds?: ReadonlySet<string>): PlayerCard {
  const xi = team.players.slice(0, 11);
  const available = xi.filter(p => !isExcludedPlayer(team, p, excludedIds));
  const active = available.length > 0 ? available : xi;
  const pool = active.filter(p => matchRoleForPlayer(team, p) !== 'GK');
  const cand = pool.length > 0 ? pool : active;
  const weighted = cand.map(p => {
    let w = (p.physical + p.shooting) / 2;                           // base aerial threat
    const role = matchRoleForPlayer(team, p);
    if (['CB', 'ST'].includes(role)) w *= 1.8; // these crash the box
    else if (['LB', 'RB', 'CDM', 'CM'].includes(role)) w *= 0.7;
    else w *= 0.4;                                                   // wingers/playmakers rarely head it
    if (p.traits.includes('Cabeceador Implacável')) w += 40;
    else if (p.traits.includes('Cabeceador')) w += 25;
    return { p, w: Math.max(1, w) };
  });
  const total = weighted.reduce((s, x) => s + x.w, 0);
  let r = random() * total;
  for (const x of weighted) { r -= x.w; if (r <= 0) return x.p; }
  return weighted[weighted.length - 1].p;
}
