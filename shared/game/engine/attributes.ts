// Per-minute effective attributes, balance knobs, evolution and formation counters.

import { Player, Coach, effectiveSecondaries, PLAYER_SPECIALIZATIONS, type Rarity, type EvolutionLevel, type PlayerSpecialization } from '../gameData';
import { AttrKey, getTraitAttributeBonus } from '../traits';
import { Stadium } from '../stadium';
import { stadiumHomeBonus } from '../clubProjects';
import { type PlayerCard, type Team, type MatchResult, type KickoffCardState, KICKOFF_CARD_FIELDS } from './teamModel';
import { getCoachModifiersForPlayer, type CharBoostMap } from './chemistry';
import { tacticStatBonus } from './matchSim';
import { PIPOQUEIRO_LEAGUE_BOOST, PIPOQUEIRO_KO_PENALTY, estribadoStatBoost, ESTRIBADO_CREDITS_PER_BOOST, RESILIENTE_DEFEAT_BOOST, prodigioStatBoost, goleadorStatBoost, garcomStatBoost, arroganteStatBoost, mercenarioStatBoost, padrinhoStatBoost } from './draft';

// ============================================================
// ATTRIBUTE RESOLVER
// ============================================================
export function getEffectiveAttribute(
  player: PlayerCard,
  attribute: keyof Player,
  coach: Coach,
  chemBonus: { passing: number; pace: number; special: number },
  playStyle: string,
  context?: {
    isKnockout?: boolean;
    isFinal?: boolean;
    isLosing?: boolean;
    coachPrime?: boolean;
    role?: string;
    // The captain's single best attribute is boosted by +amount for EVERY teammate.
    captainBoost?: { stat: string; amount: number };
    // 🩸❤️🪑 per-player boosts from team-effect characteristics (keyed by player id).
    charBoosts?: CharBoostMap;
    // 💰 Estribado reads the owner's current shop-credit balance at runtime.
    credits?: number;
    // 🔎 Núcleo de Análise: cumulative tactic-buff tier for this team.
    analysisLevel?: number;
    // 🏟️ Estádio: project level for the flat home-attribute advantage.
    stadiumProjectLevel?: number;
    // 🏟️ Marcador de mandante (só setado pro time da casa); o valor vem do projeto Estádio.
    homeStadium?: Stadium;
  }
): number {
  let base = player[attribute] as number;

  // Individual chemistry bonus: If OOP, apply the full stats debuff. If not, apply
  // standard chemistry multipliers (+0% / +3% / +6% / +10%), plus the secondary-position penalty.
  const oopMult = 0.85;
  const chemMult = player.isOOP ? oopMult : (player.chemistryScore >= 3 ? 1.10 : player.chemistryScore === 2 ? 1.06 : player.chemistryScore === 1 ? 1.03 : 1.00) * (player.isSecondary ? SECONDARY_STAT_MULT : 1);
  base = Math.round(base * chemMult);

  // Chemistry global bonus (passing & pace)
  if (attribute === 'passing') base += chemBonus.passing * 2;
  if (attribute === 'pace') base += chemBonus.pace * 2;
  // Team chemistry tier: a flat +1/+2/+3/+5 to EVERY attribute (45/60/75/90), for every
  // starter. Lives here so it flows through both the match engine and the modal.
  base += chemBonus.special;

  // Coach bonuses (using the new unified modifiers function)
  const modifiers = getCoachModifiersForPlayer(player, coach.id, {
    isKnockout: context?.isKnockout,
    isFinal: context?.isFinal,
    isLosing: context?.isLosing,
    coachPrime: context?.coachPrime,
    role: context?.role ?? player.position,
  });

  const mod = modifiers[attribute as keyof typeof modifiers] as number || 0;
  base += mod;

  // Play style modifiers (shared with the display so the two never drift)
  base += tacticStatBonus(playStyle, attribute as string, context?.analysisLevel);

  // Captain's leadership: their strongest attribute lifts the WHOLE team by +amount.
  if (context?.captainBoost && attribute === context.captainBoost.stat) base += context.captainBoost.amount;

  // Trait attribute bonuses (data-driven from the trait catalog)
  base += getTraitAttributeBonus(player.traits, attribute as AttrKey, context);

  // 💪 Shop "Treino": permanent, stacking per-attribute boost bought in the shop (no cap).
  base += (player.trainBoosts?.[attribute as keyof NonNullable<Player['trainBoosts']>] ?? 0);

  // ⭐ Carta Evoluída: bônus dos atributos escolhidos (mesma natureza do Treino).
  base += (player.evolvePoints?.[attribute as keyof NonNullable<Player['evolvePoints']>] ?? 0);

  // ⭐ Especialização da carta Imortal: +6 em cada atributo da área escolhida.
  base += specializationAttributeBonus(player, attribute as AttrKey);

  // 📈 Prodígio: +1 a cada titularidade desde que a característica foi recebida.
  base += player.prodigio ? prodigioStatBoost(player.prodigioStarts) : 0;

  // 🔥 Resiliente: +2 em todos os atributos por derrota do time como titular.
  base += player.resiliente ? (player.resilienteDefeats ?? 0) * RESILIENTE_DEFEAT_BOOST : 0;

  // ⚽ Goleador / 🎯 Garçom / 👑 Arrogante: cumulative match-stat bonuses.
  // acumulados enquanto a carta carrega a característica.
  base += player.goleador ? goleadorStatBoost(player.goleadorGoals) : 0;
  base += player.garcom ? garcomStatBoost(player.garcomAssists) : 0;
  base += player.arrogante ? arroganteStatBoost(player.arroganteGoals) : 0;
  base += player.estribado ? estribadoStatBoost(context?.credits) : 0;
  base += player.mercenario ? mercenarioStatBoost(player.mercenarioMissions) : 0;
  // 🤵 Padrinho: +1 permanente por gol do afilhado · 💎 bônus recebido de Lapidadores na reserva.
  base += player.padrinho ? padrinhoStatBoost(player.padrinhoGoals) : 0;
  base += Math.max(0, player.lapidadoBoost ?? 0);

  // 🩸❤️🪑🤝 Team-effect characteristics buffing this player.
  const cb = context?.charBoosts?.[player.id];
  if (cb) base += cb.flatAll + (cb.perStat[attribute as AttrKey] ?? 0);

  // 🏟️ Vantagem de casa carimbada por atributo (só o mandante; homeStadium só é setado pra ele,
  // e nunca na final). O projeto Estádio é a única fonte do bônus de mando.
  const st = context?.homeStadium;
  if (st) {
    const projectBonus = context?.stadiumProjectLevel == null
      ? (st.prime ? HOME_ATTR_BONUS : st.homeAttrBonus)
      : stadiumHomeBonus(context.stadiumProjectLevel);
    base += projectBonus;
  }

  // 🍿 Pipoqueiro — brilha na fase de liga (+N em tudo), some no mata-mata (−N em tudo).
  if (player.pipoqueiro) base += context?.isKnockout ? -PIPOQUEIRO_KO_PENALTY : PIPOQUEIRO_LEAGUE_BOOST;

  return Math.max(1, base);
}

// ============================================================
// MATCH ENGINE
// ============================================================

// Balance knobs — every contest is a logistic curve of the rating EDGE (see curves.ts): no
// attribute ever hits a ceiling and attack/defence are symmetric. Calibrated against bots of the
// same difficulty (the league table of a campaign): ~2.7 goals/match, ~8% 0-0, ~26% draws.
//  - DUEL_SCALE: attacker (shooting/pace/dribbling + build-up) vs defender (defending/physical).
//  - FINISH_EDGE / KEEPER_DUEL_SCALE: a shot on target, finisher's shooting vs the keeper's
//    effective shot-stopping. Effective keeper ratings run ~13 above finishers' shooting (GK
//    defending + keeper traits + buffs), so the edge offsets that gap; the scale sets how much
//    each point of keeper or finisher is worth.
//  - ON_TARGET_RESISTANCE: higher = fewer shots on target (accuracy curve
//    atkShooting/(atkShooting + resistance), which keeps rising with shooting).
//  - SET_PIECE_SCALE / FREE_KICK_EDGE / HEADER_EDGE: direct free kicks and corner headers,
//    taker vs keeper. Flatter, so they stay rare.
//  - PENALTY_EDGE / PENALTY_SCALE: taker composure vs keeper (≈76% for a designated taker).
export const DUEL_SCALE = 9;
export const FINISH_EDGE = 14;
export const KEEPER_DUEL_SCALE = 12;
export const ON_TARGET_RESISTANCE = 48;
export const SET_PIECE_SCALE = 20;
export const FREE_KICK_EDGE = -38;
export const HEADER_EDGE = -19;
export const PENALTY_EDGE = 33;
export const PENALTY_SCALE = 18;
// Global weight of FORMATION + TACTIC on results (chance volume + chance danger). 1.0 = baseline;
// >1 makes the shape/style choice matter more (squad strength is untouched). Applied to every
// formation/tactic scalar so the whole tactical contribution scales linearly by this factor.
export const TACTICAL_INFLUENCE = 1.2;
// Per-minute randomness in deciding which team attacks: the logistic scale of the initiative
// edge. Lower = team strength matters more. 9 matches the spread of the old ±20 uniform noise
// (favourites clearly win more while upsets stay common) without its hard cut-off.
export const MATCH_NOISE = 9;

// The three tactical axes have deliberately separate jobs in the match engine:
//   - CONTROL creates more attacking sequences (initiative, shots and possession).
//   - ATTACK makes the chances your team creates more dangerous.
//   - DEFENSE reduces the danger of the chances the opponent creates.
// These are named knobs so the rules remain auditable and balance changes do not silently mix
// volume with chance quality.
export const CHANCE_VOLUME_INFLUENCE = 2;
export const FORMATION_ATTACK_DANGER_INFLUENCE = 1.6;
export const TACTIC_ATTACK_DANGER_INFLUENCE = 1.6;
export const FORMATION_DEFENSE_SUPPRESSION_INFLUENCE = 3.6;
export const TACTIC_DEFENSE_SUPPRESSION_INFLUENCE = 2.2;

// Home advantage fallback: +3 em TODOS os atributos dos titulares do mandante, usado só quando
// nenhum nível de Estádio é informado. Na partida o valor vem de stadiumHomeBonus(nível do
// projeto Estádio) = +3/+5/+7/+9/+11, aplicado por atributo (não entra na força). É omitido
// quando `neutralFinal` é true: na final de jogo único o campo é neutro.
export const HOME_ATTR_BONUS = 3;

// Jogar numa posição SECUNDÁRIA custa −5% (× 0.95) — entre a nativa (0%) e o fora-de-posição (−15%).
export const SECONDARY_STAT_MULT = 0.95;
type PosFit = 'native' | 'secondary' | 'off';
export function positionFit(player: { position: string; secondaryPositions?: string[]; coringa?: boolean }, role: string): PosFit {
  if (player.coringa) return 'native';                       // 🃏 imune
  if (player.position === role) return 'native';
  if (effectiveSecondaries(player).includes(role)) return 'secondary';
  return 'off';
}

// ⭐ Evolução cumulativa: 4/8/12 titularidades desbloqueiam os níveis 1/2/3.
// Cartas Imortais chegam ao nível 4 com um desbloqueio único de créditos e
// escolhem uma especialização. O nível 4 não adiciona um quarto pacote genérico
// de pontos.
// Level 4 is purchased after level 3; the final slot is kept at 12 only so
// the shared progress UI can represent the completed level-3 milestone.
export const EVOLVE_LEVEL_THRESHOLDS = [0, 4, 8, 12, 12] as const;
export const EVOLVE_GAMES = EVOLVE_LEVEL_THRESHOLDS[1];
export const EVOLVE_POINTS = 6;
const EVOLVE_POINT_LEVELS = 3;
const EVOLVE_ATTRIBUTE_KEYS: readonly AttrKey[] = ['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical', 'vision', 'composure'];
const EVOLVE_ATTRIBUTE_KEY_SET = new Set<string>(EVOLVE_ATTRIBUTE_KEYS);
export const SPECIALIZATION_LEVEL = 4;
export const SPECIALIZATION_POINTS = 6;
export const SPECIALIZATION_UNLOCK_COST = 200;

export function evolvePointsBudget(level: number): number {
  return Math.min(EVOLVE_POINT_LEVELS, Math.max(0, Math.floor(level))) * EVOLVE_POINTS;
}

export function getEvolutionLevel(p: { rarity?: Rarity | string; evolutionLevel?: number; appearances?: number; specializationUnlocked?: boolean }): EvolutionLevel {
  // Unique cards have their own fixed presentation and never evolve.
  if (p.rarity === 'unique') return 0;

  const explicit = Number(p.evolutionLevel);
  // Explicit levels are useful for isolated previews/old data without an
  // appearance counter. Real cards always derive the level from appearances.
  if (p.appearances === undefined && (explicit === 1 || explicit === 2 || explicit === 3)) return explicit;
  if (p.appearances === undefined && explicit === SPECIALIZATION_LEVEL) return p.rarity === 'immortal' ? SPECIALIZATION_LEVEL : 3;

  const appearances = Math.max(0, p.appearances ?? 0);
  if (p.rarity === 'immortal' && p.specializationUnlocked === true) return SPECIALIZATION_LEVEL;
  if (appearances >= EVOLVE_LEVEL_THRESHOLDS[3]) return 3;
  if (appearances >= EVOLVE_LEVEL_THRESHOLDS[2]) return 2;
  if (appearances >= EVOLVE_LEVEL_THRESHOLDS[1]) return 1;
  return 0;
}
export function isEvolved(p: { rarity?: Rarity | string; evolutionLevel?: number; appearances?: number }): boolean {
  return getEvolutionLevel(p) > 0;
}
export function evolvePointsSpent(ep?: Partial<Record<AttrKey, number>>): number {
  return ep ? (Object.values(ep) as number[]).reduce((s, v) => s + (v ?? 0), 0) : 0;
}
export function chooseEvolveAttribute(attr: AttrKey): Partial<Record<AttrKey, number>> {
  return { [attr]: EVOLVE_POINTS };
}
export function applyEvolvePoint(
  ep: Partial<Record<AttrKey, number>>,
  attr: AttrKey,
  delta: number,
  unlockedPoints = EVOLVE_POINTS,
): Partial<Record<AttrKey, number>> {
  // Each click spends exactly one newly unlocked package. The total budget is
  // enforced here so both solo and online flows can safely call the same rule.
  if (delta !== EVOLVE_POINTS || evolvePointsSpent(ep) + delta > unlockedPoints) return ep;
  return { ...ep, [attr]: (ep[attr] ?? 0) + delta };
}

export function specializationAttributeBonus(player: Pick<Player, 'rarity' | 'specialization' | 'evolutionLevel' | 'appearances' | 'specializationUnlocked'>, attr: AttrKey): number {
  if (player.rarity !== 'immortal' || getEvolutionLevel(player) < SPECIALIZATION_LEVEL || !player.specialization) return 0;
  return (PLAYER_SPECIALIZATIONS[player.specialization].attributes as readonly string[]).includes(attr)
    ? SPECIALIZATION_POINTS
    : 0;
}

export function canChooseSpecialization(player: Pick<Player, 'rarity' | 'specialization' | 'evolutionLevel' | 'appearances' | 'specializationUnlocked'>): boolean {
  return player.rarity === 'immortal' && getEvolutionLevel(player) >= SPECIALIZATION_LEVEL;
}

export function canUnlockSpecialization(player: Pick<Player, 'rarity' | 'evolutionLevel' | 'appearances' | 'specializationUnlocked'>): boolean {
  return player.rarity === 'immortal'
    && getEvolutionLevel(player) === 3
    && player.specializationUnlocked !== true;
}

export function unlockPlayerSpecialization<T extends Player>(player: T): T {
  if (!canUnlockSpecialization(player)) return player;
  return { ...player, specializationUnlocked: true } as T;
}

export function choosePlayerSpecialization<T extends Player>(player: T, specialization: PlayerSpecialization): T {
  if (!canChooseSpecialization(player) || !PLAYER_SPECIALIZATIONS[specialization]) return player;
  return { ...player, specialization } as T;
}
const MAX_APPEARANCE_RECEIPTS = 64;

/** Captures the XI at the moment a match is started, before any later state changes. */
export function starterPlayerIds(team: Pick<Team, 'players'>): string[] {
  return team.players.slice(0, 11).map(player => player.id);
}

/**
 * Credits one starting appearance to the captured XI.
 *
 * `appearanceMatchId` is a durable idempotency key. Older saves can still call
 * this helper without it and retain the legacy behavior, while all match flows
 * pass a key so a duplicate finish/retry cannot evolve a card twice.
 */
export function bumpStarterAppearances(
  team: Team,
  capturedStarterIds: readonly string[] = starterPlayerIds(team),
  appearanceMatchId?: string,
): Team {
  const starterIds = new Set(capturedStarterIds);
  if (starterIds.size === 0) return team;

  let changed = false;
  const players = team.players.map(player => {
    if (!starterIds.has(player.id)) return player;

    const receipts = Array.isArray(player.appearanceMatchIds)
      ? player.appearanceMatchIds.filter(id => typeof id === 'string' && id.length > 0)
      : [];
    if (appearanceMatchId && receipts.includes(appearanceMatchId)) return player;

    changed = true;
    const previousEvolutionLevel = getEvolutionLevel(player);
    const next: PlayerCard = {
      ...player,
      appearances: (player.appearances ?? 0) + 1,
      ...(player.prodigio ? { prodigioStarts: (player.prodigioStarts ?? 0) + 1 } : {}),
    };
    const nextEvolutionLevel = getEvolutionLevel(next);
    const previousPointLevel = Math.min(EVOLVE_POINT_LEVELS, previousEvolutionLevel);
    const nextPointLevel = Math.min(EVOLVE_POINT_LEVELS, nextEvolutionLevel);
    if (next.autoEvolveAttribute && EVOLVE_ATTRIBUTE_KEY_SET.has(next.autoEvolveAttribute) && nextPointLevel > previousPointLevel) {
      let points = next.evolvePoints ?? {};
      for (let level = previousPointLevel + 1; level <= nextPointLevel; level += 1) {
        points = applyEvolvePoint(points, next.autoEvolveAttribute, EVOLVE_POINTS, evolvePointsBudget(level));
      }
      next.evolvePoints = points;
    }
    if (appearanceMatchId) {
      next.appearanceMatchIds = Array.from(new Set([...receipts, appearanceMatchId])).slice(-MAX_APPEARANCE_RECEIPTS);
    }
    return next;
  });

  return changed ? { ...team, players } : team;
}

/** Attaches the captured XI to an authoritative result without changing the score. */
export function stampMatchStartingLineups(
  result: MatchResult,
  home: Pick<Team, 'players'> & Partial<Pick<Team, 'credits'>>,
  away: Pick<Team, 'players'> & Partial<Pick<Team, 'credits'>>,
): MatchResult {
  return {
    ...result,
    startingLineups: {
      home: starterPlayerIds(home),
      away: starterPlayerIds(away),
    },
    kickoffCredits: result.kickoffCredits ?? {
      home: kickoffCreditBand(home),
      away: kickoffCreditBand(away),
    },
    kickoffCards: result.kickoffCards ?? {
      home: kickoffCardStates(home),
      away: kickoffCardStates(away),
    },
  };
}

function kickoffCardStates(team: Pick<Team, 'players'>): Record<string, KickoffCardState> {
  const states: Record<string, KickoffCardState> = {};
  for (const player of team.players) {
    if (!player?.id) continue;
    const state: KickoffCardState = {};
    for (const field of KICKOFF_CARD_FIELDS) {
      const value = player[field];
      if (value !== undefined) (state as Record<string, unknown>)[field] = field === 'evolvePoints' ? { ...(value as object) } : value;
    }
    // An empty entry still matters: it resets a counter that only appeared after kickoff.
    states[player.id] = state;
  }
  return states;
}

/**
 * Only Estribado reads credits, and only in whole bands. Recording the band
 * (never the exact balance, and nothing for teams without the trait) keeps the
 * opponent's balance private while reproducing the exact same bonus.
 */
function kickoffCreditBand(team: Pick<Team, 'players'> & Partial<Pick<Team, 'credits'>>): number | undefined {
  if (typeof team.credits !== 'number' || !team.players.some(player => player?.estribado)) return undefined;
  return Math.floor(Math.max(0, team.credits) / ESTRIBADO_CREDITS_PER_BOOST) * ESTRIBADO_CREDITS_PER_BOOST;
}

/**
 * A replay team as it was when the match was simulated: its credit band and
 * every card's growth counters at kickoff. Both viewers rebuild the same cards.
 * Results recorded before these snapshots existed keep the current team.
 */
export function teamAtKickoff<T extends Pick<Team, 'id' | 'credits' | 'players'>>(team: T, result: MatchResult): T {
  const side = result.homeTeamId === team.id ? 'home' : result.awayTeamId === team.id ? 'away' : null;
  if (!side) return team;
  const credits = result.kickoffCredits?.[side];
  const cards = result.kickoffCards?.[side];
  let next = team;
  if (typeof credits === 'number' && credits !== team.credits) next = { ...next, credits };
  if (cards) {
    next = {
      ...next,
      players: team.players.map(player => {
        const state = player ? cards[player.id] : undefined;
        if (!state) return player;
        const restored = { ...player } as Record<string, unknown>;
        for (const field of KICKOFF_CARD_FIELDS) {
          if (state[field] === undefined) delete restored[field];
          else restored[field] = state[field];
        }
        return restored as unknown as typeof player;
      }),
    };
  }
  return next;
}

/** Gets the captured starters for one side of a result, with a safe legacy fallback. */
export function startingIdsForResult(result: MatchResult, teamId: string, fallback?: Pick<Team, 'players'>): string[] {
  if (result.homeTeamId === teamId && result.startingLineups?.home) return result.startingLineups.home;
  if (result.awayTeamId === teamId && result.startingLineups?.away) return result.startingLineups.away;
  return fallback ? starterPlayerIds(fallback) : [];
}

// Formation counter edge: if your shape "counters" the opponent's (see FORMATIONS[].counters),
// the analysis project adds a small, persistent team-level edge. It is deliberately not a
// per-player attribute bonus and it never penalizes the countered side.
//
// Formation levels alternate with the tactic-buff levels of the analysis project:
//   level 1 → +3 (light advantage)
//   level 2 → tactic-buff upgrade; formation stays at +3
//   level 3 → +5 (clear advantage)
//   level 4 → tactic-buff upgrade; formation stays at +5
//   level 5 → +7 (strong advantage)
// Keeping this mapping here makes solo and online simulations use the same rule and preserves
// level 1 behaviour for legacy teams that do not have clubProjects yet.
const FORMATION_COUNTER_BONUSES = [3, 3, 5, 5, 7] as const;
const FORMATION_COUNTER_BONUS = FORMATION_COUNTER_BONUSES[0];

export function formationCounterBonusForAnalysisLevel(level: number): number {
  if (!Number.isFinite(level)) return FORMATION_COUNTER_BONUS;
  const safeLevel = Math.max(1, Math.floor(level));
  return FORMATION_COUNTER_BONUSES[Math.min(safeLevel, FORMATION_COUNTER_BONUSES.length) - 1];
}

type FormationAdvantageTier = 'light' | 'clear' | 'strong';

/** User-facing formation matchup label. Internal strength values stay in the engine. */
function formationAdvantageTierForAnalysisLevel(level: number): FormationAdvantageTier {
  if (Number.isFinite(level) && Math.floor(level) >= 5) return 'strong';
  if (Number.isFinite(level) && Math.floor(level) >= 3) return 'clear';
  return 'light';
}

export function formationAdvantageLabelForAnalysisLevel(level: number): string {
  const labels: Record<FormationAdvantageTier, string> = {
    light: 'Vantagem leve',
    clear: 'Vantagem clara',
    strong: 'Vantagem forte',
  };
  return labels[formationAdvantageTierForAnalysisLevel(level)];
}

export function formationAdvantageColorForAnalysisLevel(level: number): string {
  const colors: Record<FormationAdvantageTier, string> = {
    light: '#7FCF6A',
    clear: '#F0D77A',
    strong: '#F97316',
  };
  return colors[formationAdvantageTierForAnalysisLevel(level)];
}
