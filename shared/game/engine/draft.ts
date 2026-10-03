// Draft options, card variants and shop packs.

import { Player, PLAYERS, UNIQUE_CARDS, FORMATIONS, getPositionGroup, effectiveSecondaries, type Rarity } from '../gameData';
import { rollPlayerTraits } from '../traits';
import { random } from '../random';

// ============================================================
// DRAFT ENGINE
// ============================================================

const DRAFT_OPTIONS_COUNT = 6;

// Draft rarity is sampled once per offer slot (there are six slots). The player
// count inside each bucket does not dilute the configured tier chance; it only
// decides which card is selected within that tier. If a tier has no eligible
// cards left, the remaining tiers are naturally renormalized.
type DraftRarity = Exclude<Rarity, 'unique'>;
export const DRAFT_RARITY_CHANCES: Readonly<Record<DraftRarity, number>> = {
  bronze: 0.14,
  silver: 0.44,
  gold: 0.33,
  legendary: 0.08,
  immortal: 0.01,
};

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
const DRAFT_FRAGIL_CHANCE = 0.03;   // 🩹 Frágil — +7 em tudo, mas se machuca com muito mais frequência
const DRAFT_PRODIGIO_CHANCE = 0.03; // 📈 Prodígio — cresce a cada titularidade
const DRAFT_RESILIENTE_CHANCE = 0.03; // 🔥 Resiliente — cresce após cada derrota do time
const DRAFT_COLECIONADOR_CHANCE = 0.03; // 🧩 Colecionador — +1 por jogador na reserva
const DRAFT_GOLEADOR_CHANCE = 0.03; // ⚽ Goleador — cresce a cada 3 gols marcados
const DRAFT_GARCOM_CHANCE = 0.03; // 🎯 Garçom — cresce a cada 2 assistências dadas
const DRAFT_ARROGANTE_CHANCE = 0.03; // 👑 Arrogante — +2 por gol; −1 aos outros a cada 2 gols
const DRAFT_ESTRIBADO_CHANCE = 0.03; // 💰 Estribado — +1 por cada 100 créditos disponíveis
const DRAFT_TODOS_POR_UM_CHANCE = 0.03; // 🤝 Todos por um — só ativa quando fecha o XI
const DRAFT_MERCENARIO_CHANCE = 0.03; // 🏆 Conquistador — +2 por missão concluída
const DRAFT_PADRINHO_CHANCE = 0.03; // 🤵 Padrinho — +3 no afilhado; cresce com os gols dele
const DRAFT_LAPIDADOR_CHANCE = 0.03; // 💎 Lapidador — vitória como titular lapida toda a reserva
export const MARTIR_STAT_PENALTY = 6;      // Mártir: −6 em todos os atributos (nele mesmo)
export const MARTIR_TARGET_BOOST = 5; // Mártir: +5 em todos os atributos para 2 titulares escolhidos
export const DECIMO_HOMEM_STAT_BOOST = 1; // 12º Homem: +1 em tudo para o XI quando está no banco
export const MAGNATA_STAT_PENALTY = 7;     // 🤑 Magnata: −7 em todos os atributos (nele mesmo)
export const FRAGIL_STAT_BOOST = 7;  // 🩹 Frágil: +7 em todos os atributos (nele mesmo)
// 🤑 Magnata — titular multiplica os CRÉDITOS da partida por isto (não empilha: 1+ magnatas → 1 só).
export const MAGNATA_POINT_MULT = 1.5;
// Créditos da partida ×MAGNATA_POINT_MULT se QUALQUER titular (0-10) for Magnata; senão ×1 (não empilha).
export function magnataPointMultiplier(starters: (Player | undefined)[]): number {
  return starters.slice(0, 11).some(p => p?.magnata) ? MAGNATA_POINT_MULT : 1;
}
// 🍿 Pipoqueiro — o anti-Pilar: brilha na fase de liga, "pipoca" (some) no mata-mata. Aplicado em
// RUNTIME (depende de context.isKnockout), por isso NÃO é assado no stat base como o Em Alta/Lobo.
export const PIPOQUEIRO_LEAGUE_BOOST = 7;   // +7 em cada atributo na FASE DE LIGA
export const PIPOQUEIRO_KO_PENALTY = 7;     // −7 em cada atributo no MATA-MATA
// 🛟 Noé — só rende quando é o ÚNICO titular do XI com característica: +20 em tudo NELE e +50 na
// química geral do time (ele "põe todo mundo na arca"). Condição/efeitos em computeCharacteristicBoosts
// (atributos) e calculateChemistry (o +50). O custo é estrutural: abrir mão de toda outra característica.
export const NOE_STAT_BOOST = 20;
export const NOE_CHEM_BONUS = 50;
// 🧳 Forasteiro — o anti-química: +8 em tudo quando é o ÚNICO titular do seu país E do seu clube.
export const FORASTEIRO_STAT_BOOST = 8;
/** ❤️ Ídolo: +N em cada atributo para os outros titulares do mesmo clube. */
export const IDOLO_STAT_BOOST = 2;
// 🧩 Colecionador — +1 em todos os atributos por jogador que estiver na reserva.
export const COLECIONADOR_PER_RESERVE = 1;
// 💰 Estribado — +1 em todos os atributos a cada 100 créditos disponíveis.
export const ESTRIBADO_CREDITS_PER_BOOST = 100;
export const ESTRIBADO_STAT_BOOST = 1;
export function estribadoStatBoost(credits?: number): number {
  return Math.floor(Math.max(0, credits ?? 0) / ESTRIBADO_CREDITS_PER_BOOST) * ESTRIBADO_STAT_BOOST;
}
// Single boost value: "em alta" adds this to EVERY attribute. The overall rises by the
// same amount as a CONSEQUENCE — overall is the mean of the attributes, so +N across all
// eight is +N overall. That's why it's described to the player simply as "+N em cada atributo".
export const INFORM_STAT_BOOST = 4;
export const LOBO_STAT_BOOST = 7;     // Lobo Solitário: a BIGGER personal boost than Em Alta…
export const LOBO_CHEM_PENALTY = 12; // …paid for with this much TEAM chemistry per lone wolf.
export const PILAR_CHEM_BONUS = 12;  // Pilar: lifts the team's total chemistry by this much.
export const RESILIENTE_DEFEAT_BOOST = 2;
export const PRODIGIO_STARTS_PER_BOOST = 1;
export const GOLEADOR_GOALS_PER_BOOST = 3;
export const GARCOM_ASSISTS_PER_BOOST = 2;
export const ARROGANTE_GOALS_PER_PENALTY = 2;
export const ARROGANTE_STAT_BOOST_PER_GOAL = 2;
const ARROGANTE_TEAM_PENALTY = 1;
export const TODOS_POR_UM_STAT_BOOST = 20;
export const TODOS_POR_UM_CHEM_BONUS = 50;
export const MERCENARIO_STAT_BOOST_PER_MISSION = 2;
export const PADRINHO_AFILHADO_BOOST = 3;
export const PADRINHO_BOOST_PER_GOAL = 1;
export const LAPIDADOR_RESERVE_BOOST = 1;

/** Returns the permanent all-attribute bonus earned by Prodígio so far. */
export function prodigioStatBoost(starts: number | undefined): number {
  return Math.floor(Math.max(0, starts ?? 0) / PRODIGIO_STARTS_PER_BOOST);
}

/** Returns the permanent all-attribute bonus earned by Goleador so far. */
export function goleadorStatBoost(goals: number | undefined): number {
  return Math.floor(Math.max(0, goals ?? 0) / GOLEADOR_GOALS_PER_BOOST);
}

/** Returns the permanent all-attribute bonus earned by Garçom so far. */
export function garcomStatBoost(assists: number | undefined): number {
  return Math.floor(Math.max(0, assists ?? 0) / GARCOM_ASSISTS_PER_BOOST);
}

/** Returns Arrogante's personal all-attribute boost: +2 for every goal. */
export function arroganteStatBoost(goals: number | undefined): number {
  return Math.max(0, goals ?? 0) * ARROGANTE_STAT_BOOST_PER_GOAL;
}

/** Returns the all-attribute penalty Arrogante applies to every other starter. */
export function arroganteTeamPenalty(goals: number | undefined): number {
  return Math.floor(Math.max(0, goals ?? 0) / ARROGANTE_GOALS_PER_PENALTY) * ARROGANTE_TEAM_PENALTY;
}

/** Returns Padrinho's own permanent bonus: +1 per goal the godchild scored with both starting. */
export function padrinhoStatBoost(goals: number | undefined): number {
  return Math.max(0, Math.floor(goals ?? 0)) * PADRINHO_BOOST_PER_GOAL;
}

/** Returns Conquistador's all-attribute bonus from completed missions. */
export function mercenarioStatBoost(completedMissions: number | undefined): number {
  return Math.max(0, Math.floor(completedMissions ?? 0)) * MERCENARIO_STAT_BOOST_PER_MISSION;
}

// Aplica o +N/−N das características assadas no BASE (Em Alta/Lobo/Mártir/Magnata). SEM teto de 99:
// o base pode passar de 99 (o efetivo já era livre). Mantém só o PISO de 1 (nenhum stat vira 0/negativo).
function clampStat(v: number): number {
  return Math.max(1, v);
}

function applyDraftVariant(p: Player): Player {
  const r = random();
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

  // 🩸 Mártir: sacrifica-se (−6 em tudo) pra dar +5 em tudo a 2 titulares (efeito em computeCharacteristicBoosts).
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

  // 🧩 Colecionador — bônus individual baseado na quantidade de jogadores na reserva.
  acc += DRAFT_COLECIONADOR_CHANCE;
  if (r < acc) return { ...p, colecionador: true, traits: rollPlayerTraits(p.position, p.rarity) };

  // 🗣️ Capitão Nato — flag pura; efeito (dobra o bônus de capitão SE for o capitão) em captainBoostFromStarters.
  acc += DRAFT_CAPITAO_CHANCE;
  if (r < acc) return { ...p, capitaoNato: true, traits: rollPlayerTraits(p.position, p.rarity) };

  // 🤑 Magnata — sacrifica −7 em tudo, mas multiplica os créditos da partida (efeito em magnataPointMultiplier).
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

  // 🩹 Frágil — ganha +7 em tudo, mas fica muito mais sujeito a lesões durante as partidas.
  acc += DRAFT_FRAGIL_CHANCE;
  if (r < acc) {
    const b = FRAGIL_STAT_BOOST;
    return {
      ...p, fragil: true, baseOverall: p.overall,
      overall: clampStat(p.overall + b), pace: clampStat(p.pace + b), shooting: clampStat(p.shooting + b),
      passing: clampStat(p.passing + b), dribbling: clampStat(p.dribbling + b), defending: clampStat(p.defending + b),
      physical: clampStat(p.physical + b), vision: clampStat(p.vision + b), composure: clampStat(p.composure + b),
      traits: rollPlayerTraits(p.position, p.rarity),
    };
  }

  // 📈 Prodígio — começa a contar titularidades a partir desta carta, sem herdar jogos anteriores.
  acc += DRAFT_PRODIGIO_CHANCE;
  if (r < acc) return { ...p, prodigio: true, prodigioStarts: 0, traits: rollPlayerTraits(p.position, p.rarity) };

  // 🔥 Resiliente — starts at zero and grows only when its team loses a match.
  acc += DRAFT_RESILIENTE_CHANCE;
  if (r < acc) return { ...p, resiliente: true, resilienteDefeats: 0, traits: rollPlayerTraits(p.position, p.rarity) };

  // ⚽ Goleador — starts at zero and grows from the authoritative match stats.
  acc += DRAFT_GOLEADOR_CHANCE;
  if (r < acc) return { ...p, goleador: true, goleadorGoals: 0, traits: rollPlayerTraits(p.position, p.rarity) };

  // 🎯 Garçom — starts at zero and grows from the authoritative match stats.
  acc += DRAFT_GARCOM_CHANCE;
  if (r < acc) return { ...p, garcom: true, garcomAssists: 0, traits: rollPlayerTraits(p.position, p.rarity) };

  // 👑 Arrogante — começa sem gols acumulados; a vaidade cresce com os gols,
  // mas o peso da personalidade recai sobre os outros titulares.
  acc += DRAFT_ARROGANTE_CHANCE;
  if (r < acc) return { ...p, arrogante: true, arroganteGoals: 0, traits: rollPlayerTraits(p.position, p.rarity) };

  // 💰 Estribado — runtime bonus based on the owner's current credit balance.
  acc += DRAFT_ESTRIBADO_CHANCE;
  if (r < acc) return { ...p, estribado: true, traits: rollPlayerTraits(p.position, p.rarity) };

  // 🤝 Todos por um — flag pura; o bônus só liga quando os 11 titulares a possuem.
  acc += DRAFT_TODOS_POR_UM_CHANCE;
  if (r < acc) return { ...p, todosPorUm: true, traits: rollPlayerTraits(p.position, p.rarity) };

  // 🏆 Conquistador — começa sem missões acumuladas e cresce com o mural da campanha.
  acc += DRAFT_MERCENARIO_CHANCE;
  if (r < acc) return { ...p, mercenario: true, mercenarioMissions: 0, traits: rollPlayerTraits(p.position, p.rarity) };

  // 🤵 Padrinho — começa sem gols do afilhado; o afilhado é escolhido no elenco.
  acc += DRAFT_PADRINHO_CHANCE;
  if (r < acc) return { ...p, padrinho: true, padrinhoGoals: 0, traits: rollPlayerTraits(p.position, p.rarity) };

  // 💎 Lapidador — flag pura; o bônus vai para as cartas da reserva a cada vitória.
  acc += DRAFT_LAPIDADOR_CHANCE;
  if (r < acc) return { ...p, lapidador: true, traits: rollPlayerTraits(p.position, p.rarity) };

  // Every other card is dealt fresh random traits (1 guaranteed + rarity-weighted extras).
  return { ...p, traits: rollPlayerTraits(p.position, p.rarity) };
}

// A variant never pushes a card below the offer's overall floor (a recruitment
// offer promises that minimum): such a card is offered without the variant.
function withDraftVariants(list: Player[], overallFloor = 0): Player[] {
  return list.map(player => {
    const variant = applyDraftVariant(player);
    return variant.overall >= overallFloor ? variant : player;
  });
}

function shuffleWithRarityWeight(pool: Player[]): Player[] {
  const weighted: Player[] = [];
  for (const p of pool) {
    // Rarer cards appear less often (lower weight = lower chance)
    const weight = p.rarity === 'immortal' ? 1 : p.rarity === 'legendary' ? 2 : p.rarity === 'gold' ? 4 : p.rarity === 'silver' ? 6 : 8;
    for (let i = 0; i < weight; i++) weighted.push(p);
  }
  const shuffled = weighted.sort(() => random() - 0.5);
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

// A draft slot can be `null` after a RoomState crosses the Socket.IO/JSON
// boundary (undefined array entries are serialized as null). Treat both as
// empty everywhere so solo and online drafts see the same formation needs.
function isEmptyDraftSlot(player: Player | null | undefined): boolean {
  return player == null;
}

// Shared placement rule for solo and online drafts. A card may fill its primary
// position first, then an effective secondary position. If the XI is complete,
// any remaining card goes to the first reserve slot. An incompatible card is
// never allowed to occupy an arbitrary starter slot such as the goalkeeper.
export function draftSlotIndex(
  formationId: string,
  drafted: (Player | null | undefined)[],
  player: Player,
): number {
  const formation = FORMATIONS.find(f => f.id === formationId);
  const roles = formation?.positions.map(p => p.role) ?? [];
  const preferredRoles = [player.position, ...effectiveSecondaries(player)];
  for (const preferredRole of preferredRoles) {
    const targetIndex = roles.findIndex((role, index) =>
      role === preferredRole && isEmptyDraftSlot(drafted[index])
    );
    if (targetIndex !== -1) return targetIndex;
  }

  const startersComplete = drafted.slice(0, 11).every(slot => !isEmptyDraftSlot(slot));
  if (!startersComplete) return -1;
  return drafted.findIndex((slot, index) => index >= 11 && isEmptyDraftSlot(slot));
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

function shuffleWithDraftNeed(pool: Player[], neededPositions: string[], limit = Number.POSITIVE_INFINITY): Player[] {
  const remaining = [...pool];
  const shuffled: Player[] = [];

  while (remaining.length > 0 && shuffled.length < limit) {
    // Preserve the configured chance for each rarity bucket, then use the
    // positional need only to choose a card inside that bucket.
    const rarityNeedTotals = new Map<DraftRarity, number>();
    for (const player of remaining) {
      const rarity = player.rarity as DraftRarity;
      const needWeight = draftPositionNeedWeight(player, neededPositions);
      rarityNeedTotals.set(rarity, (rarityNeedTotals.get(rarity) ?? 0) + needWeight);
    }
    const weighted = remaining.map(player => {
      const rarity = player.rarity as DraftRarity;
      const needWeight = draftPositionNeedWeight(player, neededPositions);
      const rarityNeedTotal = rarityNeedTotals.get(rarity) ?? needWeight;
      const rarityChance = DRAFT_RARITY_CHANCES[rarity] ?? 0;
      return { player, weight: rarityChance * needWeight / rarityNeedTotal };
    });
    const total = weighted.reduce((sum, item) => sum + item.weight, 0);
    let roll = random() * total;
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
  optionCount = DRAFT_OPTIONS_COUNT,
  minimumOverall = 0,
): Player[] {
  const requestedCount = Math.max(1, Math.floor(optionCount));
  const overallFloor = Math.max(0, Math.floor(minimumOverall));
  const fullAvailable = PLAYERS.filter(p =>
    !alreadyDrafted.includes(p.id) && p.overall >= overallFloor,
  );

  if (neededPositions.length === 0) {
    return withDraftVariants(shuffleWithDraftNeed(fullAvailable, [], requestedCount), overallFloor);
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
  const shuffledExact = shuffleWithDraftNeed(exactMatch, neededPositions, 1);
  const shuffledGroup = shuffleWithDraftNeed(groupMatch, neededPositions, 1);
  const shuffledAll   = shuffleWithDraftNeed(available, neededPositions, requestedCount);

  // Guaranteed slot: prefer exact match, fall back to group, then any
  const guaranteed = shuffledExact[0] ?? shuffledGroup[0] ?? shuffledAll[0];
  const usedIds = new Set<string>(guaranteed ? [guaranteed.id] : []);

  // Fill remaining slots using rarity plus the needs of all remaining roles.
  const rest = shuffledAll
    .filter(p => !usedIds.has(p.id))
    .slice(0, requestedCount - 1);

  const result = guaranteed ? [guaranteed, ...rest] : rest.slice(0, requestedCount);
  // Shuffle the final list so the guaranteed pick isn't always first
  return withDraftVariants(result.sort(() => random() - 0.5), overallFloor);
}

// ── Shop packs ──────────────────────────────────────────────────────────────
// Rarity-themed regular packs: the pool is exact, never a loose overall
// threshold. This keeps a Bronze pack from unexpectedly containing a Silver
// card and makes the package identity legible in the UI.
export const PLAYER_PACK_OFFER_SIZE = 4;

export function generatePlayerPackOptions(
  rarity: Exclude<Rarity, 'unique'>,
  ownedIds: string[],
  size = 3,
): Player[] {
  const pool = PLAYERS.filter(player => player.rarity === rarity && !ownedIds.includes(player.id));
  return shuffleWithRarityWeight(pool).slice(0, Math.max(0, size)).map(player => ({ ...player }));
}

/** Creates the four cards shown in a regular rarity pack for one round. */
export function generatePlayerPackOffer(
  rarity: Exclude<Rarity, 'unique'>,
  ownedIds: string[],
  excludedIds: string[] = [],
  size = PLAYER_PACK_OFFER_SIZE,
): string[] {
  const excluded = Array.from(new Set([...ownedIds, ...excludedIds]));
  return generatePlayerPackOptions(rarity, excluded, size).map(player => player.id);
}

/** Draws one unowned card from the persisted offer; the client never chooses the result. */
export function drawPlayerPackCard(
  offerIds: string[],
  rarity: Exclude<Rarity, 'unique'>,
  ownedIds: string[],
): Player | null {
  const owned = new Set(ownedIds);
  const pool = Array.from(new Set(offerIds))
    .map(id => PLAYERS.find(player => player.id === id))
    .filter((player): player is Player => !!player && player.rarity === rarity && !owned.has(player.id));
  if (pool.length === 0) return null;
  return { ...pool[Math.floor(random() * pool.length)] };
}

// "Caça-Talentos": até 4 jogadores que têm a posição escolhida como PRINCIPAL,
// que o time ainda não possui e com overall mínimo de 84. Não usar secundárias
// aqui é intencional: o pacote serve para reforçar exatamente a vaga procurada.
export const SCOUT_MIN_OVERALL = 84;
export function generateScoutOptions(position: string, ownedIds: string[]): Player[] {
  const requestedPosition = position;
  const pool = PLAYERS.filter(p =>
    !ownedIds.includes(p.id)
    && p.position === requestedPosition
    && p.overall >= SCOUT_MIN_OVERALL);
  return shuffleWithRarityWeight(pool).slice(0, 4).map(p => ({ ...p }));
}

// "Pacote Único": oferta rotativa de quatro cartas especiais.
// A oferta é criada uma vez por rodada e fica estável até a próxima rodada.
// O sorteio continua sendo feito pelo motor/servidor, nunca por uma escolha do cliente.
const UNIQUE_PACK_OFFER_SIZE = 4;

export function buildUniquePackRoundKey(
  phase: 'league' | 'knockout',
  leagueRound: number,
  knockoutRound?: string | null,
  knockoutLeg?: number | null,
): string {
  if (phase === 'league') return `league:${leagueRound}`;
  return `knockout:${knockoutRound ?? 'unknown'}:${knockoutLeg ?? 1}`;
}

/**
 * Creates the cards shown in the Unique Pack shop for one round.
 * `excludedIds` is used for a card already paid for but still waiting for its
 * reveal, so a reconnect/new round cannot expose the same pending purchase twice.
 */
export function generateUniquePackOffer(
  ownedIds: string[],
  excludedIds: string[] = [],
  size = UNIQUE_PACK_OFFER_SIZE,
): string[] {
  const excluded = new Set([...ownedIds, ...excludedIds]);
  const pool = UNIQUE_CARDS.filter(card => !excluded.has(card.id)).map(card => card.id);

  // Fisher-Yates keeps each available card equally likely and avoids the
  // duplicated entries used by rarity-weighted draft shuffles.
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool.slice(0, Math.max(0, size));
}

/** Draws one card from the persisted round offer, ignoring cards already owned. */
export function drawUniquePackCard(offerIds: string[], ownedIds: string[]): Player | null {
  const owned = new Set(ownedIds);
  const pool = Array.from(new Set(offerIds))
    .map(id => UNIQUE_CARDS.find(card => card.id === id))
    .filter((card): card is Player => !!card && !owned.has(card.id));
  if (pool.length === 0) return null;
  return { ...pool[Math.floor(random() * pool.length)] };
}

// "Turbinar Carta": apply a chosen special variant to an owned player. Mirrors applyDraftVariant
// but is deterministic (the player picks which) and preserves the card's existing traits.
export function applyShopVariant(
  player: Player,
  variant: 'inForm' | 'lobo' | 'coringa' | 'nomade' | 'pilar' | 'martir' | 'idolo' | 'decimoHomem' | 'pipoqueiro' | 'noe' | 'forasteiro' | 'colecionador' | 'estribado' | 'todosPorUm' | 'capitaoNato' | 'magnata' | 'fragil' | 'prodigio' | 'resiliente' | 'goleador' | 'garcom' | 'arrogante' | 'mercenario' | 'padrinho' | 'lapidador',
  competitionStats: { goals?: number; assists?: number; missionsCompleted?: number } = {},
): Player {
  if (variant === 'inForm' || variant === 'lobo' || variant === 'martir' || variant === 'magnata' || variant === 'fragil') {
    // inForm/lobo/fragil add to every attribute; martir/magnata SUBTRACT from every attribute.
    const b = variant === 'inForm' ? INFORM_STAT_BOOST : variant === 'lobo' ? LOBO_STAT_BOOST : variant === 'martir' ? -MARTIR_STAT_PENALTY : variant === 'fragil' ? FRAGIL_STAT_BOOST : -MAGNATA_STAT_PENALTY;
    return {
      ...player, [variant]: true, baseOverall: player.baseOverall ?? player.overall,
      overall: clampStat(player.overall + b), pace: clampStat(player.pace + b), shooting: clampStat(player.shooting + b),
      passing: clampStat(player.passing + b), dribbling: clampStat(player.dribbling + b), defending: clampStat(player.defending + b),
      physical: clampStat(player.physical + b), vision: clampStat(player.vision + b), composure: clampStat(player.composure + b),
    };
  }
  if (variant === 'prodigio') return { ...player, prodigio: true, prodigioStarts: 0 };
  if (variant === 'resiliente') return { ...player, resiliente: true, resilienteDefeats: player.resilienteDefeats ?? 0 };
  if (variant === 'goleador') return { ...player, goleador: true, goleadorGoals: Math.max(0, competitionStats.goals ?? 0), goleadorMatchIds: [] };
  if (variant === 'garcom') return { ...player, garcom: true, garcomAssists: Math.max(0, competitionStats.assists ?? 0), garcomMatchIds: [] };
  if (variant === 'arrogante') return { ...player, arrogante: true, arroganteGoals: Math.max(0, competitionStats.goals ?? 0), arroganteMatchIds: [] };
  if (variant === 'mercenario') return { ...player, mercenario: true, mercenarioMissions: Math.max(0, Math.floor(competitionStats.missionsCompleted ?? 0)) };
  if (variant === 'padrinho') return { ...player, padrinho: true, padrinhoGoals: 0, padrinhoMatchIds: [] };
  if (variant === 'lapidador') return { ...player, lapidador: true, lapidadorMatchIds: [] };
  return { ...player, [variant]: true };
}

// Does this card carry ANY special characteristic? (used to gate Turbinar — one per card — and
// to gate the "remover característica" purchase). Keeps every variant flag in ONE place.
const VARIANT_FLAGS = ['inForm', 'lobo', 'coringa', 'nomade', 'pilar', 'martir', 'idolo', 'decimoHomem', 'pipoqueiro', 'noe', 'forasteiro', 'colecionador', 'estribado', 'todosPorUm', 'capitaoNato', 'magnata', 'fragil', 'prodigio', 'resiliente', 'goleador', 'garcom', 'arrogante', 'mercenario', 'padrinho', 'lapidador'] as const;
export type VariantFlag = typeof VARIANT_FLAGS[number];
export function hasVariant(p: Player): boolean {
  return VARIANT_FLAGS.some(f => (p as unknown as Record<string, unknown>)[f]);
}
export function variantCount(p: Player): number {
  return VARIANT_FLAGS.filter(f => (p as unknown as Record<string, unknown>)[f]).length;
}
// ⭐ Cartas Únicas podem ter DUAS características (o diferencial delas); as demais, só uma.
function maxVariantsFor(p: Player): number {
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
  if (p.baseOverall !== undefined && (p.inForm || p.lobo || p.martir || p.magnata || p.fragil)) {
    const delta = p.overall - p.baseOverall; // +N for Em Alta/Lobo/Frágil, −N for Mártir/Magnata
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
  delete p.noe; delete p.forasteiro; delete p.colecionador; delete p.estribado; delete p.todosPorUm; delete p.capitaoNato; delete p.magnata; delete p.fragil; delete p.prodigio; delete p.prodigioStarts;
  delete p.resiliente; delete p.resilienteDefeats; delete p.goleador; delete p.goleadorGoals; delete p.goleadorMatchIds;
  delete p.garcom; delete p.garcomAssists; delete p.garcomMatchIds; delete p.arrogante; delete p.arroganteGoals; delete p.arroganteMatchIds;
  delete p.mercenario; delete p.mercenarioMissions;
  delete p.padrinho; delete p.padrinhoTarget; delete p.padrinhoGoals; delete p.padrinhoMatchIds;
  delete p.lapidador; delete p.lapidadorMatchIds;
  return p;
}

// Loja "Remover Característica" quando a carta tem DUAS (só Únicas): remove APENAS a escolhida,
// preservando a outra. Reverte o efeito de stat da variante baked que sai (Em Alta/Lobo/Frágil
// somaram, Mártir/Magnata subtraíram) e só descarta o baseOverall se não sobrar outra variante baked.
const BAKED_DELTA: Partial<Record<VariantFlag, number>> = {
  inForm: INFORM_STAT_BOOST, lobo: LOBO_STAT_BOOST, martir: -MARTIR_STAT_PENALTY, fragil: FRAGIL_STAT_BOOST,
  magnata: -MAGNATA_STAT_PENALTY,
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
    const otherBaked = (['inForm', 'lobo', 'martir', 'fragil', 'magnata'] as const).some(k => k !== variant && p[k]);
    if (!otherBaked) delete p.baseOverall;
  }
  delete (p as unknown as Record<string, unknown>)[variant];
  if (variant === 'martir') delete p.martirTargets;
  if (variant === 'prodigio') delete p.prodigioStarts;
  if (variant === 'resiliente') delete p.resilienteDefeats;
  if (variant === 'goleador') { delete p.goleadorGoals; delete p.goleadorMatchIds; }
  if (variant === 'garcom') { delete p.garcomAssists; delete p.garcomMatchIds; }
  if (variant === 'arrogante') { delete p.arroganteGoals; delete p.arroganteMatchIds; }
  if (variant === 'mercenario') delete p.mercenarioMissions;
  if (variant === 'padrinho') { delete p.padrinhoTarget; delete p.padrinhoGoals; delete p.padrinhoMatchIds; }
  if (variant === 'lapidador') delete p.lapidadorMatchIds;
  return p;
}

export function getNeededPositions(
  formationId: string,
  drafted: (Player | null | undefined)[],
): string[] {
  const formation = FORMATIONS.find(f => f.id === formationId);
  if (!formation) return [];

  const missing: string[] = [];
  for (let i = 0; i < 11; i++) {
    if (drafted[i] == null) {
      missing.push(formation.positions[i].role);
    }
  }
  return missing;
}
