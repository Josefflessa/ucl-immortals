// Cards, teams, match plans and match results; post-match card growth.

import { Player, FORMATIONS } from '../gameData';
import { type ClubProjectsState } from '../clubProjects';
import { LAPIDADOR_RESERVE_BOOST, MIDIATICO_CREDITS_PER_GOAL } from './draft';

// Premium variants keep their own card IDs for inventory/UI. Cards that represent
// a different club/era may provide historicalPlayerId so historical chemistry
// does not accidentally connect (for example) PSG Neymar to Barcelona's MSN.
export function historicalPlayerId(player: Player): string {
  return player.historicalPlayerId ?? player.basePlayerId ?? player.id;
}

export function areHistoricalPartners(a: Player, b: Player): boolean {
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
/** Card fields that grow with matches and change the card's effective numbers. */
export const KICKOFF_CARD_FIELDS = [
  'appearances', 'evolvePoints', 'prodigioStarts', 'resilienteDefeats', 'goleadorGoals',
  'garcomAssists', 'arroganteGoals', 'mercenarioMissions', 'padrinhoGoals', 'lapidadoBoost',
] as const;
export type KickoffCardState = Partial<Pick<Player, (typeof KICKOFF_CARD_FIELDS)[number]>>;

export interface PlayerCard extends Player {
  chemistryScore: number; // 0-3
  isOOP: boolean;
  isSecondary?: boolean; // jogando numa posição secundária (−5%)
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

// Plano de jogo: mudanças automáticas de mentalidade baseadas no estado da
// partida. O plano é pequeno de propósito: decisões importantes, sem virar um
// construtor de regras difícil de ler ou abusar.
export type MatchTriggerCondition = 'losing' | 'winning' | 'draw' | 'red_card' | 'opponent_red_card';
export type MatchTriggerAction = 'balanced' | 'possession' | 'counter' | 'high_press' | 'defensive' | 'all_out_attack';

export interface MatchTrigger {
  id: string;
  condition: MatchTriggerCondition;
  /** Optional goal difference required by a losing/winning score condition. */
  margin?: number;
  minute: number;
  action: MatchTriggerAction;
}

export interface MatchPlan {
  triggers: MatchTrigger[];
}

export const MAX_MATCH_TRIGGERS = 3;
export const MATCH_TRIGGER_MINUTES = [15, 30, 45, 55, 60, 65, 70, 75, 80, 85] as const;
export const MATCH_TRIGGER_GOAL_MARGINS = [1, 2, 3, 4, 5] as const;
const MATCH_TRIGGER_CONDITIONS: readonly MatchTriggerCondition[] = [
  'losing', 'draw', 'winning', 'red_card', 'opponent_red_card',
];
export const MATCH_TRIGGER_ACTIONS: readonly MatchTriggerAction[] = [
  'balanced', 'possession', 'counter', 'high_press', 'defensive', 'all_out_attack',
];

export const DEFAULT_MATCH_PLAN: MatchPlan = {
  triggers: [],
};

function isMatchTriggerCondition(value: unknown): value is MatchTriggerCondition {
  return typeof value === 'string' && MATCH_TRIGGER_CONDITIONS.includes(value as MatchTriggerCondition);
}

function isScoreCondition(condition: MatchTriggerCondition): boolean {
  return condition === 'losing' || condition === 'winning';
}

function normalizeGoalMargin(value: unknown): number {
  return Math.max(1, Math.min(5, Math.round(Number(value) || 2)));
}

function isMatchTriggerAction(value: unknown): value is MatchTriggerAction {
  return typeof value === 'string' && MATCH_TRIGGER_ACTIONS.includes(value as MatchTriggerAction);
}

/**
 * Returns a safe, canonical plan for client/network input and for generated bots.
 * `undefined` means "start with no automatic changes"; an explicit empty array
 * remains empty so the manager can deliberately keep automatic changes disabled.
 */
export function normalizeMatchPlan(input?: Partial<MatchPlan> | null): MatchPlan {
  if (input == null) return { triggers: DEFAULT_MATCH_PLAN.triggers.map(trigger => ({ ...trigger })) };
  const raw = (Array.isArray(input.triggers) ? input.triggers : []) as unknown[];
  const triggers = raw
    .filter((trigger): trigger is Record<string, unknown> => !!trigger && typeof trigger === 'object')
    .map((trigger, index): MatchTrigger | null => {
      const condition = trigger.condition;
      if (!isMatchTriggerCondition(condition) || !isMatchTriggerAction(trigger.action)) return null;

      const normalized: MatchTrigger = {
        id: typeof trigger.id === 'string' && trigger.id.trim() ? trigger.id.trim().slice(0, 40) : `trigger-${index + 1}`,
        condition,
        minute: condition === 'red_card' || condition === 'opponent_red_card'
          ? 0
          : Math.max(MATCH_TRIGGER_MINUTES[0], Math.min(85, Math.round(Number(trigger.minute) || 65))),
        action: trigger.action,
      };

      if (isScoreCondition(condition) && trigger.margin !== undefined) {
        normalized.margin = normalizeGoalMargin(trigger.margin);
      }
      return normalized;
    })
    .filter((trigger): trigger is MatchTrigger => trigger !== null)
    .slice(0, MAX_MATCH_TRIGGERS);
  return { triggers };
}

/** Server-side validation boundary. Invalid client payloads are rejected. */
export function validateMatchPlan(input: unknown): MatchPlan | null {
  if (!input || typeof input !== 'object' || !Array.isArray((input as Partial<MatchPlan>).triggers)) return null;
  const raw = (input as Partial<MatchPlan>).triggers!;
  if (raw.length > MAX_MATCH_TRIGGERS) return null;
  const plan = normalizeMatchPlan(input as Partial<MatchPlan>);
  if (plan.triggers.length !== raw.length) return null;
  if (new Set(plan.triggers.map(trigger => trigger.id)).size !== plan.triggers.length) return null;
  return plan;
}

// Per-match discipline must follow the card instance, not only the player card id.
// The same card can temporarily exist in both teams (especially in generated fixtures),
// so a plain `Set.has(player.id)` could expel the copy on the other side as well.
export function isExcludedPlayer(team: Team, player: Player, excludedIds?: ReadonlySet<string>): boolean {
  return !!excludedIds && (
    excludedIds.has(player.id) ||
    excludedIds.has(statKey(team.id, player.id))
  );
}

export interface Team {
  id: string;
  name: string;
  coachId: string;
  coachPrime?: boolean; // Técnico Prime: habilita a assinatura especial do treinador
  formationId: string;
  playStyle: string;
  matchPlan?: MatchPlan;
  players: PlayerCard[]; // 11 titulares
  captain?: string;
  penaltyTaker?: string;
  freeKickTaker?: string;
  totalChemistry: number;
  isBot: boolean;
  botStrength?: number;
  /** Shop-credit balance used by balance-sensitive card characteristics. */
  credits?: number;
  /** Club progression scaffold. Missing in legacy saves means every project is level 1. */
  clubProjects?: ClubProjectsState;
  crestId?: string; // selected club crest (see lib/crests.ts); undefined → initials badge
  /** 🔥 Recuperação — consecutive losses in a row right now. Resets to 0 on a win or draw. */
  lossStreak?: number;
}

// The first eleven slots are always the starting XI. Everything after them is
// the reserve bank, which is intentionally larger than the initial two draft
// reserves so the player can keep recruiting without creating an unbounded
// roster.
export const MAX_RESERVE_PLAYERS = 20;

export function reservePlayerCount(team: Pick<Team, 'players'>): number {
  return Math.max(0, team.players.length - 11);
}

// The order of `team.players` is the order of the formation slots for the XI,
// followed by the bench. Centralize this lookup so positional coach effects use
// the role actually occupied by a card, not only its native position.
export function formationRoleForPlayer(team: Team, player: Player): string | undefined {
  const index = team.players.findIndex(p => p === player || p.id === player.id);
  if (index < 0 || index >= 11) return undefined;
  return FORMATIONS.find(f => f.id === team.formationId)?.positions[index]?.role;
}

/**
 * Role used by the match engine for a player in the starting XI.
 *
 * A card keeps its native position for identity, chemistry and display, but a
 * match action must use the role occupied in the selected formation. Keeping
 * this boundary in one helper prevents the simulation from mixing both ideas.
 */
export function matchRoleForPlayer(team: Team, player: Player): string {
  return formationRoleForPlayer(team, player) ?? player.position;
}

/**
 * Resolves the goalkeeper who can actually participate in the current match.
 *
 * A red-carded goalkeeper cannot keep making saves. The game keeps the
 * formation slot intact for chemistry/display purposes, but the match engine
 * uses the best available line player as an emergency goalkeeper. The shared
 * goalkeeper resolver handles the reduced aptitude for any non-GK in the role.
 */
export function activeGoalkeeperForTeam(
  team: Team,
  excludedIds?: ReadonlySet<string>,
  playerStats?: Record<string, PlayerMatchStat>,
): { player: PlayerCard; emergency: boolean } {
  const starters = team.players.slice(0, 11);
  const isUnavailable = (player: PlayerCard) => {
    if (isExcludedPlayer(team, player, excludedIds)) return true;
    const stat = playerStats?.[player.statId ?? statKey(team.id, player.id)];
    return (stat?.redCards ?? 0) > 0;
  };
  const active = starters.filter(player => !isUnavailable(player));
  const assigned = active.find(player => matchRoleForPlayer(team, player) === 'GK');
  // A line player can occupy the GK slot (for example through Coringa), but that
  // does not make the card a natural goalkeeper. The match resolver applies the
  // role-specific penalty; `emergency` remains reserved for a forced replacement
  // after the natural keeper is unavailable, so the UI does not report a red-card
  // emergency when the manager deliberately chose a line player for the slot.
  if (assigned) return { player: assigned, emergency: false };

  const emergency = [...active].sort((a, b) =>
    ((b.defending ?? 0) + (b.physical ?? 0)) - ((a.defending ?? 0) + (a.physical ?? 0))
  )[0] ?? starters[0] ?? team.players[0];
  return { player: emergency, emergency: true };
}

export interface MatchEvent {
  minute: number;
  type: 'goal' | 'save' | 'miss' | 'duel' | 'sub' | 'penalty' | 'foul' | 'momentum' | 'tactic' | 'yellow' | 'red' | 'injury' | 'corner' | 'stat';
  description: string;
  teamId: string;
  playerId?: string;
  opponentId?: string;
  assisterId?: string;
  /** A corner is represented explicitly so the live replay never has to parse prose. */
  isCorner?: boolean;
  /** Team-stat changes that do not have a player-facing narrative event. */
  statDelta?: MatchStatsDelta;
  isSpecial?: boolean;
  triggerId?: string;
  tacticAction?: MatchTriggerAction;
  secondYellow?: boolean; // 🟨🟨 vermelho por 2º amarelo (o amarelo daquele jogo NÃO conta no acúmulo da temporada)
  /** Rating changes (statKey → delta) produced during this event's minute, so the replay
   * rebuilds the live ratings exactly as the engine computed them. */
  ratingDelta?: Record<string, number>;
}

/** Incremental match statistics attached to the authoritative event timeline. */
export interface MatchStatsDelta {
  homeShots?: number;
  awayShots?: number;
  homeShotsOnTarget?: number;
  awayShotsOnTarget?: number;
  homeFouls?: number;
  awayFouls?: number;
  homeSaves?: number;
  awaySaves?: number;
  homeCorners?: number;
  awayCorners?: number;
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
  /** The XI captured when this match/leg was started, before replay or later edits. */
  startingLineups?: {
    home: string[];
    away: string[];
  };
  /**
   * Each side's credits at kickoff. Credit-scaled traits (Estribado) are read
   * from here on replay, so every viewer sees the numbers the engine used —
   * an opponent's balance is private and the owner's changes after the match.
   */
  kickoffCredits?: {
    home?: number;
    away?: number;
  };
  /**
   * Per-card growth counters at kickoff (Goleador goals, appearances, …), keyed
   * by player id. The server credits this match's growth right after simulating
   * it, so without this the replay would show cards already boosted by goals
   * that have not happened on screen yet.
   */
  kickoffCards?: {
    home?: Record<string, KickoffCardState>;
    away?: Record<string, KickoffCardState>;
  };
  mvp?: string;
  topDuel?: { attacker: string; defender: string; winner: string };
  /** Inputs of computePossession (except shots and the active tactic), so the replay can show
   * the live possession with the same formula that produces the final value. */
  possessionModel?: { homeStrength: number; awayStrength: number; homeShapeControl: number; awayShapeControl: number };
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
  /**
   * Online rooms only: true when `events`/`playerStats` were stripped from
   * this result before it was synced (a bygone round's full detail is kept
   * server-side, just not re-sent on every unrelated room update). Callers
   * that need the full detail — "Ver Detalhes" — must fetch it on demand
   * instead of reading it directly off this object. Never set in solo mode.
   */
  resultTrimmed?: boolean;
  /**
   * League fixtures only: the round this was played in. Not set by the
   * simulator itself — attached where a league result needs to identify its
   * own fixture later (re-fetching a trimmed online result). Absent for
   * knockout results, which are never trimmed.
   */
  round?: number;
}

/** True when a team lost the match, including a knockout loss on penalties. */
export function teamLostMatch(result: MatchResult, teamId: string): boolean {
  const isHome = result.homeTeamId === teamId;
  const isAway = result.awayTeamId === teamId;
  if (!isHome && !isAway) return false;

  const goalsFor = isHome ? result.homeGoals : result.awayGoals;
  const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
  if (goalsFor !== goalsAgainst) return goalsFor < goalsAgainst;

  // A tied score is normally a draw. In a knockout match, penaltyWinner (or the
  // legacy winner field) is the deciding result and must count as a defeat.
  const decidedWinner = result.penaltyWinner ?? result.winner;
  return decidedWinner != null && decidedWinner !== teamId;
}

/** 🤵 The godchild a Padrinho sponsors in this XI: the chosen starter, or else the
 * highest-overall other starter. Undefined when the Padrinho is not in the XI. */
export function padrinhoGodchildId(players: (Player | undefined)[], padrinhoId: string): string | undefined {
  const xi = players.slice(0, 11).filter((p): p is Player => !!p);
  const godfather = xi.find(p => p.id === padrinhoId);
  if (!godfather?.padrinho) return undefined;
  const chosen = godfather.padrinhoTarget && godfather.padrinhoTarget !== padrinhoId
    ? xi.find(p => p.id === godfather.padrinhoTarget)
    : undefined;
  return (chosen ?? xi.filter(p => p.id !== padrinhoId).sort((x, y) => y.overall - x.overall)[0])?.id;
}

/** True when a team won the match, including a knockout win on penalties. */
export function teamWonMatch(result: MatchResult, teamId: string): boolean {
  const isHome = result.homeTeamId === teamId;
  if (!isHome && result.awayTeamId !== teamId) return false;
  const goalsFor = isHome ? result.homeGoals : result.awayGoals;
  const goalsAgainst = isHome ? result.awayGoals : result.homeGoals;
  if (goalsFor !== goalsAgainst) return goalsFor > goalsAgainst;
  const decidedWinner = result.penaltyWinner ?? result.winner;
  return decidedWinner === teamId;
}

/** Apply a Resiliente stack to the cards carrying it in the match XI. Bench cards do not grow. */
export function applyDefeatGrowth(team: Team, result: MatchResult): Team {
  if (!teamLostMatch(result, team.id)) return team;

  const starterIds = new Set(team.players.slice(0, 11).map(player => player.id));
  let changed = false;
  const players = team.players.map(player => {
    if (!player.resiliente || !starterIds.has(player.id)) return player;
    changed = true;
    return {
      ...player,
      resilienteDefeats: (player.resilienteDefeats ?? 0) + 1,
    };
  });

  return changed ? { ...team, players } : team;
}

/**
 * Credits the match's authoritative goals/assists to the cards that carry
 * Goleador/Garçom. The receipt arrays make the operation idempotent when an
 * online finish is retried after a reconnect or a double click.
 */
export function applyMatchStatGrowth(team: Team, result: MatchResult, matchId = `${result.homeTeamId}:${result.awayTeamId}`): Team {
  if (result.homeTeamId !== team.id && result.awayTeamId !== team.id) return team;
  if (!result.playerStats) return team;

  let changed = false;
  const players = team.players.map(player => {
    const instanceKey = statKey(team.id, player.id);
    const stat = result.playerStats?.[instanceKey]
      ?? (player.statId?.startsWith(`${team.id}::`) ? result.playerStats?.[player.statId] : undefined);
    if (!stat) return player;

    const next: PlayerCard = { ...player };
    if (player.goleador) {
      const receipts = Array.isArray(player.goleadorMatchIds) ? player.goleadorMatchIds : [];
      if (!receipts.includes(matchId)) {
        next.goleadorGoals = (player.goleadorGoals ?? 0) + Math.max(0, stat.goals ?? 0);
        next.goleadorMatchIds = Array.from(new Set([...receipts, matchId])).slice(-64);
        changed = true;
      }
    }
    if (player.garcom) {
      const receipts = Array.isArray(player.garcomMatchIds) ? player.garcomMatchIds : [];
      if (!receipts.includes(matchId)) {
        next.garcomAssists = (player.garcomAssists ?? 0) + Math.max(0, stat.assists ?? 0);
        next.garcomMatchIds = Array.from(new Set([...receipts, matchId])).slice(-64);
        changed = true;
      }
    }
    if (player.arrogante) {
      const receipts = Array.isArray(player.arroganteMatchIds) ? player.arroganteMatchIds : [];
      if (!receipts.includes(matchId)) {
        next.arroganteGoals = (player.arroganteGoals ?? 0) + Math.max(0, stat.goals ?? 0);
        next.arroganteMatchIds = Array.from(new Set([...receipts, matchId])).slice(-64);
        changed = true;
      }
    }
    return next;
  });

  const lineup = team.players;
  const goalsOf = (playerId: string): number => {
    const stat = result.playerStats?.[statKey(team.id, playerId)];
    return Math.max(0, stat?.goals ?? 0);
  };

  // 🤵 Padrinho: +1 permanente por gol do afilhado numa partida em que os dois foram titulares.
  for (let i = 0; i < Math.min(11, players.length); i++) {
    const godfather = players[i];
    if (!godfather?.padrinho) continue;
    const receipts = Array.isArray(godfather.padrinhoMatchIds) ? godfather.padrinhoMatchIds : [];
    if (receipts.includes(matchId)) continue;
    const godchildId = padrinhoGodchildId(lineup, godfather.id);
    players[i] = {
      ...godfather,
      padrinhoGoals: (godfather.padrinhoGoals ?? 0) + (godchildId ? goalsOf(godchildId) : 0),
      padrinhoMatchIds: Array.from(new Set([...receipts, matchId])).slice(-64),
    };
    changed = true;
  }

  // 💎 Lapidador: cada Lapidador titular numa vitória lapida TODA a reserva (+1 permanente, acumula).
  if (teamWonMatch(result, team.id)) {
    let polishers = 0;
    for (let i = 0; i < Math.min(11, players.length); i++) {
      const polisher = players[i];
      if (!polisher?.lapidador) continue;
      const receipts = Array.isArray(polisher.lapidadorMatchIds) ? polisher.lapidadorMatchIds : [];
      if (receipts.includes(matchId)) continue;
      players[i] = { ...polisher, lapidadorMatchIds: Array.from(new Set([...receipts, matchId])).slice(-64) };
      polishers++;
    }
    if (polishers > 0) {
      for (let i = 11; i < players.length; i++) {
        players[i] = { ...players[i], lapidadoBoost: (players[i].lapidadoBoost ?? 0) + polishers * LAPIDADOR_RESERVE_BOOST };
      }
      changed = true;
    }
  }

  return changed ? { ...team, players } : team;
}

/**
 * Persists the campaign-wide completed-mission total on every Conquistador card.
 * Keeping the snapshot on the card makes the effect deterministic in solo,
 * online and after a reconnect, without making the match simulator depend on
 * the private mission state object.
 */
export function applyMercenarioProgress(team: Team, completedMissions: number): Team {
  const count = Math.max(0, Math.floor(completedMissions));
  let changed = false;
  const players = team.players.map(player => {
    if (!player.mercenario || player.mercenarioMissions === count) return player;
    changed = true;
    return { ...player, mercenarioMissions: count };
  });
  return changed ? { ...team, players } : team;
}

/** 📺 Midiático: credits earned from this match's goals by the team's Midiático cards. */
export function midiaticoCredits(team: Team, result: MatchResult): number {
  if (!result.playerStats || (result.homeTeamId !== team.id && result.awayTeamId !== team.id)) return 0;
  let goals = 0;
  for (const player of team.players) {
    if (!player.midiatico) continue;
    const stat = result.playerStats[statKey(team.id, player.id)]
      ?? (player.statId?.startsWith(`${team.id}::`) ? result.playerStats[player.statId] : undefined);
    goals += Math.max(0, stat?.goals ?? 0);
  }
  return goals * MIDIATICO_CREDITS_PER_GOAL;
}

/** 🎲 Apostador: every card with the trait, anywhere in the squad, counts the bets just won. */
export function applyApostadorWins(team: Team, wonBets: number): Team {
  const wins = Math.max(0, Math.floor(wonBets));
  if (wins === 0 || !team.players.some(player => player.apostador)) return team;
  return {
    ...team,
    players: team.players.map(player => player.apostador ? { ...player, apostadorWins: (player.apostadorWins ?? 0) + wins } : player),
  };
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

/** Points that decide the tournament table, deliberately separate from shop credits. */
export interface TablePointsConfig {
  win: number;
  draw: number;
  loss: number;
}

export const STANDARD_TABLE_POINTS: TablePointsConfig = { win: 3, draw: 1, loss: 0 };

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
