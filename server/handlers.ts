import type { RealtimeServer, RealtimeSocket } from "./realtime.js";

// Import game engine functions
import {
  generateDraftOptions,
  getNeededPositions,
  generateBotTeam,
  generateStarPackOptions,
  generateScoutOptions,
  generateUniquePackOffer,
  drawUniquePackCard,
  buildUniquePackRoundKey,
  generateRandomLeagueFixtures,
  generateRandomGroupFixtures,
  computeStandings,
  computeGroupQualifiedStandings,
  simulateMatch,
  calculateChemistry,
  createKnockoutBracket,
  playActiveKnockoutLeg,
  advanceKnockoutBracket,
  getActiveKnockoutMatches,
  getAllPlayedMatchResults, getPlayerSeasonStats,
  normalizeMatchPlan,
  validateMatchPlan,
  rebuildTeamChemistry,
  applyShopVariant, hasVariant, canAddVariant, stripVariant, stripSpecificVariant, magnataPointMultiplier,
  bumpStarterAppearances, startingIdsForResult, stampMatchStartingLineups, applyMatchStatGrowth,
  getEvolutionLevel, isEvolved, applyEvolvePoint, EVOLVE_POINTS, applyDefeatGrowth,
  draftSlotIndex,
  VariantFlag,
  MatchPlan,
  Team,
  PlayerCard,
  MatchResult,
  LeagueFixture,
  StandingsEntry,
  KnockoutBracket
} from "../client/src/lib/gameEngine.js";

import { COACHES, FORMATIONS, DIFFICULTY_LEVELS, PLAYERS, POSITION_GROUPS, TACTICS, Player, UNIQUE_CARDS } from "../client/src/lib/gameData.js";
import { ALL_CRESTS } from "../client/src/lib/crests.js";
import { computeMatchPointsWithConfig, MatchPoints, SHOP_COSTS, trainCost, TRAIN_BOOST, ShopVariant, TrainAttr, sellValue, canEvolvePrime, PRIME_COST, TRAIN_ATTRS, TURBINAR_VARIANTS } from "../client/src/lib/shop.js";
import { Bet, BetMarket, buildLeagueMatchKey, buildKnockoutMatchKey, builderUsesTotalCards, canPlaceStake, createBet, settleBet, BET_ROUND_CAP } from "../client/src/lib/bets.js";
import { getOnlineLeagueParticipantIds, getOnlineKnockoutParticipantIds, knockoutLegWasPlayed } from "../client/src/lib/onlineReadiness.js";
import { pickHostId } from "./room-host.js";
import { cloneRoomJson, diffRoomJson, type RoomPatchOperation } from "../shared/room-sync.js";
import { DisciplineMap, applyMatchDiscipline, resolveAvailableLineup, resetYellowsForKnockout, healInjury, unavailableStarters, getEmergencyReplacementTarget, applyEmergencyReplacement } from "../client/src/lib/discipline.js";
import { MarketListing, marketMinPrice } from "../client/src/lib/market.js";
import { DRAFT_TURN_SECONDS } from "../shared/const.js";
import {
  DEFAULT_COMPETITION_FORMAT,
  MAX_ONLINE_PLAYERS,
  normalizeCompetitionFormat,
  validateCompetitionFormat,
} from "../client/src/lib/competition.js";
import type { CompetitionFormat } from "../client/src/lib/competition.js";

export interface RoomPlayer {
  socketId: string;
  clientId?: string; // identidade persistente do cliente (reconexão robusta, mesmo entre refreshes)
  kicked?: boolean; // removido pelo host; o assento ativo não pode voltar por reconexão
  id: string;
  name: string;
  crestId?: string | null; // selected club crest (see client/src/lib/crests)
  coachId: string;
  coachPrime: boolean; // Fase 2: técnico evoluído pro Prime → estádio temático
  formationId: string;
  playStyle: string;
  matchPlan: MatchPlan;
  draftedPlayers: (Player | undefined)[];
  vetoesLeft: number;
  captain: string | null;
  penaltyTaker: string | null;
  freeKickTaker: string | null;
  team: Team | null;
  ready: boolean;
  connected: boolean;
  points: number; // shop currency, earned per league match
  lastMatchPoints: MatchPoints | null;    // last round's points breakdown (shown once)
  reinforcementOptions: Player[] | null;   // end-of-round free pick (1 of 6 → bench)
  reinforcementRerolls: number;            // 🔄 tokens to re-roll the reinforcement (persist across rounds)
  pendingPack: { kind: 'star' | 'scout'; options: Player[] } | null; // 🛒 pacote JÁ PAGO na abertura (escolha grátis)
  pendingUniquePack: Player | null; // ⭐ pacote Único já pago, aguardando revelação
  uniquePackOfferIds?: string[]; // ⭐ quatro cartas visíveis da rodada (privado por jogador)
  uniquePackOfferRoundKey?: string | null;
  bets: Bet[];                        // 🎯 palpites (escrow já debitado; crédito só na revelação)
  pendingMatchPoints?: number;        // pontos da partida calculados, NÃO creditados até a revelação
}

export interface RoomState {
  code: string;
  /** Monotonic authoritative revision. Clients use it to reject late snapshots. */
  stateRevision: number;
  /** Changes whenever the host starts a new match in the same room code. */
  roomEpoch: number;
  /** Persisted receipts make retried commands safe after reconnects. */
  commandReceipts?: Array<{
    commandId: string;
    event: string;
    stateRevision: number;
  }>;
  /** Private durable recovery marker; never exposed in room views. */
  lastCheckpoint?: {
    phase: RoomState['phase'];
    leagueRound: number;
    knockoutRound: string | null;
    knockoutLeg: number | null;
    stateRevision: number;
    savedAt: number;
    reason: string;
  };
  /** Persistent identities barred by the host from rejoining this room. */
  kickedClientIds?: string[];
  phase: 'lobby' | 'setup' | 'draft' | 'squad_review' | 'league' | 'knockout' | 'report';
  difficulty: string;
  competitionFormat: CompetitionFormat;
  // id of the player that currently drives progression (first connected player).
  hostId: string;
  players: RoomPlayer[];
  botTeams: Team[];
  leagueFixtures: LeagueFixture[];
  leagueStandings: StandingsEntry[];
  leagueResults: MatchResult[];
  leagueRound: number;
  knockoutBracket: KnockoutBracket | null;
  champion: string | null;
  // Synchronization: which human players have confirmed watching the current round/leg
  watchedRoundPlayers: string[];
  watchedKnockoutLegPlayers: string[];
  /** Exact result window those confirmations belong to; rejects late frames. */
  watchedLeagueRound: number | null;
  watchedKnockoutLegKey: { round: string; leg: number } | null;
  readyPlayers: string[];    // ✅ participantes da rodada/perna atual que confirmaram "Estou pronto"
  discipline: DisciplineMap; // 🟨🟥🩹 disponibilidade por jogador (todos os times)
  market: MarketListing[];   // 🏪 anúncios do mercado online (jogadores em escrow, fora dos elencos)
  draftState: {
    round: number;
    timerKey: number;
    turnIndex: number;
    draftOrder: string[];
    alreadyDraftedIds: string[];
    history: {
      round: number;
      teamName: string;
      playerName: string;
      playerId: string;
      position: string;
      overall: number;
    }[];
    currentOptionsByPlayer: Record<string, Player[]>;
  };
}

interface RoomSyncSession {
  snapshot: unknown | null;
  revision: number;
  supportsPatches: boolean;
}

export interface RuntimeMutation {
  event: string;
  roomCode: string | null;
  changed: boolean;
  stateRevision: number | null;
}

// Sync state is kept per socket instead of per room because some actions are
// intentionally private (bets, shop offers and balances). This also lets a
// reconnected client receive a clean snapshot without forcing every other
// participant to download the room again.
export type GameTimerKind = 'room_cleanup' | 'host_grace' | 'draft_turn';

/** Durable Objects replace Node's process-local timers with persisted alarms. */
export interface GameTimerScheduler {
  schedule(kind: GameTimerKind, roomCode: string, delayMs: number): void;
  cancel(kind: GameTimerKind, roomCode: string): void;
}

export interface GameRuntime {
  /** A Durable Object owns exactly one code; omitted for the Node server. */
  roomCode?: string;
  rooms: Map<string, RoomState>;
  marketSeq: number;
  roomSyncSessions: Map<string, RoomSyncSession>;
  cleanupTimers: Map<string, ReturnType<typeof setTimeout>>;
  hostGraceTimers: Map<string, ReturnType<typeof setTimeout>>;
  draftTurnTimers: Map<string, ReturnType<typeof setTimeout>>;
  scheduler?: GameTimerScheduler;
  /** Durable Object owns the outer rollback; avoid a second room clone here. */
  externalTransactions?: boolean;
  /** Room snapshot supplied by the outer transaction for change detection. */
  transactionRoomBefore: RoomState | null;
  /** Result of the last wrapped socket handler, consumed by Durable Objects. */
  lastMutation: RuntimeMutation | null;
  /**
   * Set by an authoritative handler when it emits a room update. This is a
   * cheap fast path for change detection: the JSON digest remains as a safe
   * fallback for handlers that mutate state without broadcasting.
   */
  mutationObserved: boolean;
}

export function createGameRuntime(options: Pick<GameRuntime, 'roomCode' | 'scheduler' | 'externalTransactions'> = {}): GameRuntime {
  return {
    roomCode: options.roomCode,
    scheduler: options.scheduler,
    rooms: new Map<string, RoomState>(),
    marketSeq: 0,
    roomSyncSessions: new Map<string, RoomSyncSession>(),
    cleanupTimers: new Map<string, ReturnType<typeof setTimeout>>(),
    hostGraceTimers: new Map<string, ReturnType<typeof setTimeout>>(),
    draftTurnTimers: new Map<string, ReturnType<typeof setTimeout>>(),
    externalTransactions: options.externalTransactions === true,
    transactionRoomBefore: null,
    lastMutation: null,
    mutationObserved: false,
  };
}

// The existing handlers are deliberately synchronous. Switching these references
// around one event at a time lets the exact same rules run in Node (default
// runtime) and in an isolated Durable Object runtime without duplicating logic.
const defaultRuntime = createGameRuntime();
let activeRuntime = defaultRuntime;
let rooms = defaultRuntime.rooms;
let marketSeq = defaultRuntime.marketSeq;
let roomSyncSessions = defaultRuntime.roomSyncSessions;
let cleanupTimers = defaultRuntime.cleanupTimers;
let hostGraceTimers = defaultRuntime.hostGraceTimers;
let draftTurnTimers = defaultRuntime.draftTurnTimers;

export function runWithGameRuntime<T>(runtime: GameRuntime, callback: () => T): T {
  const previous = {
    runtime: activeRuntime,
    rooms,
    marketSeq,
    roomSyncSessions,
    cleanupTimers,
    hostGraceTimers,
    draftTurnTimers,
  };

  activeRuntime = runtime;
  rooms = runtime.rooms;
  marketSeq = runtime.marketSeq;
  roomSyncSessions = runtime.roomSyncSessions;
  cleanupTimers = runtime.cleanupTimers;
  hostGraceTimers = runtime.hostGraceTimers;
  draftTurnTimers = runtime.draftTurnTimers;

  try {
    return callback();
  } finally {
    runtime.marketSeq = marketSeq;
    activeRuntime = previous.runtime;
    rooms = previous.rooms;
    marketSeq = previous.marketSeq;
    roomSyncSessions = previous.roomSyncSessions;
    cleanupTimers = previous.cleanupTimers;
    hostGraceTimers = previous.hostGraceTimers;
    draftTurnTimers = previous.draftTurnTimers;
  }
}

function getRoomSyncSession(socket: RealtimeSocket): RoomSyncSession {
  const existing = roomSyncSessions.get(socket.id);
  if (existing) return existing;
  const created: RoomSyncSession = { snapshot: null, revision: 0, supportsPatches: false };
  roomSyncSessions.set(socket.id, created);
  return created;
}

function rememberInitialRoomSnapshot(socket: RealtimeSocket, room: RoomState): { roomState: RoomState; syncRevision: number } {
  const session = getRoomSyncSession(socket);
  session.snapshot = roomViewForSocket(room, socket.id);
  session.revision = 0;
  return { roomState: session.snapshot as RoomState, syncRevision: session.revision };
}

function emitInitialRoom(
  socket: RealtimeSocket,
  event: 'room_created' | 'joined_room',
  payload: Record<string, unknown>,
  room: RoomState,
): void {
  // Joining/rejoining is an authoritative transaction. Materialize a missing
  // private offer here so the first room payload and the next purchase use the
  // same persisted offer, including for rooms created before this field existed.
  const viewer = room.players.find(player => player.socketId === socket.id);
  if (viewer) ensureUniquePackOffer(room, viewer);
  const { roomState, syncRevision } = rememberInitialRoomSnapshot(socket, room);
  const ownPlayer = (roomState as RoomState).players.find(player => player.socketId === socket.id);
  socket.emit(event, { ...payload, player: ownPlayer ?? payload.player, roomState, syncRevision });
}

function emitRoomSnapshot(socket: RealtimeSocket, room: RoomState): void {
  const { roomState, syncRevision } = rememberInitialRoomSnapshot(socket, room);
  socket.emit('room_snapshot', { roomState, syncRevision });
}

interface RoomUpdateOptions {
  onlySocketId?: string;
  excludeSocketId?: string;
}

/**
 * Send the smallest safe representation of the current room to each target.
 * New clients receive a versioned patch stream; old clients continue to get
 * room_updated snapshots for backwards compatibility during deployment.
 */
function jsonByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/**
 * The room object is authoritative, but not every field is public information.
 * In particular, a player's clientId is a reconnection credential and balances,
 * pending packs and bets are private. Build a per-socket view before calculating
 * patches so those fields never cross the wire to another participant.
 */
function roomViewForSocket(room: RoomState, socketId: string): RoomState {
  const viewer = room.players.find(player => player.socketId === socketId);
  const view = cloneRoomJson(room);
  // These fields are server-only persistence metadata. In particular, command
  // receipts must not reveal another client's retry history.
  delete view.commandReceipts;
  delete view.lastCheckpoint;
  delete view.kickedClientIds;
  const viewerId = viewer?.id;

  view.players = view.players.map(player => {
    if (player.id === viewerId) return player;
    return {
      ...player,
      clientId: undefined,
      points: 0,
      lastMatchPoints: null,
      reinforcementOptions: null,
      reinforcementRerolls: 0,
      pendingPack: null,
      pendingUniquePack: null,
      uniquePackOfferIds: [],
      uniquePackOfferRoundKey: null,
      bets: [],
      pendingMatchPoints: undefined,
      // Shop balance is private; the public opponent team still carries the
      // lineup, but never the credits used by Estribado.
      team: player.team ? { ...player.team, credits: undefined } : null,
    };
  });

  // Draft options are private to the player whose turn is active. History and
  // the already-picked ids remain public so the draft UI can render correctly.
  const activePlayerId = view.draftState.draftOrder[view.draftState.turnIndex];
  const activePlayer = view.players.find(player => player.id === activePlayerId);
  if (!activePlayer || activePlayer.id !== viewerId) {
    view.draftState.currentOptionsByPlayer = {};
  } else {
    const options = view.draftState.currentOptionsByPlayer[activePlayerId];
    view.draftState.currentOptionsByPlayer = options
      ? { [activePlayerId]: options }
      : {};
  }

  return view;
}

function emitRoomUpdate(io: RealtimeServer, room: RoomState, options: RoomUpdateOptions = {}): void {
  // Offers are authoritative room data, not presentation state. Materialize
  // them before building any private view so a reconnect/snapshot cannot create
  // a random offer that is only present in memory and then disagree with the
  // next purchase attempt.
  room.players.forEach(player => ensureUniquePackOffer(room, player));
  activeRuntime.mutationObserved = true;

  const roomSocketIds = options.onlySocketId
    ? [options.onlySocketId]
    : Array.from(io.sockets.adapter.rooms.get(room.code) ?? []);
  for (const socketId of roomSocketIds) {
    if (options.excludeSocketId === socketId) continue;
    const target = io.sockets.sockets.get(socketId);
    if (!target) continue;

    const nextSnapshot = roomViewForSocket(room, socketId);
    const nextSnapshotBytes = jsonByteLength(nextSnapshot);

    const session = getRoomSyncSession(target);
    if (!session.supportsPatches) {
      target.emit('room_updated', nextSnapshot);
      session.snapshot = nextSnapshot;
      continue;
    }

    if (session.snapshot == null) {
      session.snapshot = nextSnapshot;
      session.revision = 0;
      target.emit('room_snapshot', { roomState: nextSnapshot, syncRevision: session.revision });
      continue;
    }

    const patch: RoomPatchOperation[] = diffRoomJson(session.snapshot, nextSnapshot);
    if (patch.length === 0) continue;

    const baseRevision = session.revision;
    const revision = baseRevision + 1;
    session.snapshot = nextSnapshot;
    session.revision = revision;

    // Large structural changes (for example a full new lineup) are safer and
    // cheaper as a snapshot. Small actions such as a pick, ready or training
    // update only the changed paths.
    const patchBytes = jsonByteLength(patch);
    if (patchBytes >= nextSnapshotBytes) {
      target.emit('room_snapshot', { roomState: nextSnapshot, syncRevision: revision });
    } else {
      target.emit('room_patch', { baseRevision, revision, patch });
    }
  }
}

const VALID_COACH_IDS = new Set(COACHES.map(c => c.id));
const VALID_FORMATION_IDS = new Set(FORMATIONS.map(f => f.id));
const VALID_TACTIC_IDS = new Set(TACTICS.map(t => t.id));
const VALID_CREST_IDS = new Set(ALL_CRESTS.map(c => c.id));
const VALID_POSITION_IDS = new Set(Object.values(POSITION_GROUPS).flat());
const VALID_TRAIN_ATTRS = new Set(TRAIN_ATTRS.map(a => a.key));
const VALID_VARIANTS = new Set(TURBINAR_VARIANTS.map(v => v.key));
const MAX_PLAYER_NAME_LENGTH = 32;
const MAX_CLIENT_ID_LENGTH = 80;
const MAX_COMMAND_ID_LENGTH = 120;
const MAX_COMMAND_RECEIPTS = 256;
const MAX_EVENTS_PER_SECOND = 120;

// The balance lives on RoomPlayer, while the match engine receives a Team.
// Keep the runtime copy synchronized immediately before simulations and after
// reveal credits so Estribado always reads the authoritative balance.
function syncTeamCredits(player: RoomPlayer): void {
  if (player.team) player.team = { ...player.team, credits: Math.max(0, player.points) };
}

function syncAllTeamCredits(room: RoomState): void {
  room.players.forEach(syncTeamCredits);
}

function normalizePlayerName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (name.length === 0 || name.length > MAX_PLAYER_NAME_LENGTH) return null;
  // Names are rendered in multiple contexts and must never contain controls or
  // line breaks that could corrupt logs/UI layout.
  if (/[\u0000-\u001F\u007F-\u009F]/.test(name)) return null;
  return name;
}

function isValidClientId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= MAX_CLIENT_ID_LENGTH
    && /^[A-Za-z0-9_-]+$/.test(value);
}

function isShopPhase(room: RoomState): boolean {
  return room.phase === 'league' || room.phase === 'knockout';
}

function uniquePackRoundKeyForRoom(room: RoomState): string | null {
  if (room.phase === 'league') {
    return buildUniquePackRoundKey('league', room.leagueRound);
  }
  if (room.phase === 'knockout' && room.knockoutBracket) {
    return buildUniquePackRoundKey(
      'knockout',
      room.leagueRound,
      room.knockoutBracket.currentRound,
      room.knockoutBracket.currentLeg,
    );
  }
  return null;
}

/**
 * Materializes the four-card offer for the player's current round exactly
 * once. The offer is private to that player, persisted in the room and never
 * regenerated just because the shop was closed or the socket reconnected.
 */
function ensureUniquePackOffer(room: RoomState, player: RoomPlayer): void {
  if (!player.team || !isShopPhase(room)) return;
  const roundKey = uniquePackRoundKeyForRoom(room);
  if (!roundKey) return;

  const ownedIds = player.team.players.map(card => card.id);
  const excludedIds = player.pendingUniquePack ? [player.pendingUniquePack.id] : [];
  const storedIds = player.uniquePackOfferIds;
  const validStoredIds = Array.isArray(storedIds)
    && storedIds.every(id => UNIQUE_CARDS.some(card => card.id === id));
  const hasAnyUnexcludedCard = UNIQUE_CARDS.some(card => !new Set([...ownedIds, ...excludedIds]).has(card.id));

  // An empty array is also a valid persisted offer when the catalog is already
  // complete. Otherwise, an absent/legacy empty value must be initialized.
  if (
    player.uniquePackOfferRoundKey === roundKey
    && validStoredIds
    && (storedIds!.length > 0 || !hasAnyUnexcludedCard)
  ) {
    return;
  }

  player.uniquePackOfferIds = generateUniquePackOffer(ownedIds, excludedIds);
  player.uniquePackOfferRoundKey = roundKey;
}

// A disconnected player cannot click the end-of-round reinforcement modal.
// Give that player one of the server-generated options automatically, keeping
// the reward meaningful without allowing offline spending in the shop.
function autoPickOfflineReinforcement(player: RoomPlayer): void {
  if (player.connected || !player.team || !player.reinforcementOptions?.length) return;

  const available = player.reinforcementOptions.filter(option =>
    !player.team!.players.some(existing => existing.id === option.id));
  if (available.length === 0) {
    player.reinforcementOptions = null;
    return;
  }

  const chosen = available[Math.floor(Math.random() * available.length)];
  const card: PlayerCard = { ...chosen, chemistryScore: 0, isOOP: false };
  player.team = { ...player.team, players: [...player.team.players, card] };
  player.reinforcementOptions = null;
}

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 80;
}

function commandIdFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as { commandId?: unknown }).commandId;
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_COMMAND_ID_LENGTH) return null;
  // Opaque client IDs use this compact alphabet; it also keeps control
  // characters out of persisted recovery metadata.
  return /^[A-Za-z0-9:_-]+$/.test(value) ? value : null;
}

function roomEpochFromPayload(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as { roomEpoch?: unknown }).roomEpoch;
  return Number.isSafeInteger(value) && (value as number) > 0 ? value as number : null;
}

export function roomMutationDigest(room: RoomState): string {
  // The digest is only used for equality, never sent or persisted. A replacer
  // avoids allocating a second full room clone in the Durable Object runtime.
  return JSON.stringify(room, (key, value) => {
    if (key === 'stateRevision' || key === 'commandReceipts' || key === 'lastCheckpoint') return undefined;
    return value;
  });
}

function rememberCommand(room: RoomState, event: string, commandId: string): void {
  const receipts = room.commandReceipts ?? [];
  const existingIndex = receipts.findIndex(receipt => receipt.commandId === commandId);
  if (existingIndex >= 0) receipts.splice(existingIndex, 1);
  receipts.push({ commandId, event, stateRevision: room.stateRevision });
  if (receipts.length > MAX_COMMAND_RECEIPTS) {
    receipts.splice(0, receipts.length - MAX_COMMAND_RECEIPTS);
  }
  room.commandReceipts = receipts;
}

function findCommand(room: RoomState, commandId: string): { event: string; stateRevision: number } | undefined {
  return room.commandReceipts?.find(receipt => receipt.commandId === commandId);
}

function markRoomCheckpoint(room: RoomState, reason: string): void {
  room.lastCheckpoint = {
    phase: room.phase,
    leagueRound: room.leagueRound,
    knockoutRound: room.knockoutBracket?.currentRound ?? null,
    knockoutLeg: room.knockoutBracket?.currentLeg ?? null,
    stateRevision: room.stateRevision,
    savedAt: Date.now(),
    reason: reason.slice(0, 80),
  };
}

function roomCodeFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  const value = (payload as { roomCode?: unknown }).roomCode;
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return isValidRoomCode(code) ? code : null;
}

/**
 * Advance the authoritative version before a handler can emit a snapshot.
 * A room is deliberately small (at most the online player cap), so using a
 * single revision is considerably safer than trying to infer freshness from
 * each browser's private patch counter.
 */
function bumpRoomRevision(room: RoomState): void {
  const current = Number.isSafeInteger(room.stateRevision) && room.stateRevision >= 0
    ? room.stateRevision
    : 0;
  if (current >= Number.MAX_SAFE_INTEGER) throw new Error('A versão da sala excedeu o limite seguro.');
  room.stateRevision = current + 1;
}

function isValidRoomCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{4}$/.test(value);
}

function isValidOptionalId(value: unknown): value is string | null | undefined {
  return value == null || isValidId(value);
}

function canonicalRoleId(value: unknown, starters: Array<Player | PlayerCard>, predicate?: (p: Player | PlayerCard) => boolean): string | null {
  if (!isValidId(value)) return null;
  const found = starters.find(p => p.id === value && (!predicate || predicate(p)));
  return found?.id ?? null;
}

function canonicalDraftOrder(submitted: unknown, authoritative: (Player | undefined)[]): (Player | undefined)[] | null {
  if (!Array.isArray(submitted) || submitted.length !== 13) return null;
  const byId = new Map(authoritative.filter((p): p is Player => !!p).map(p => [p.id, p]));
  const ids: string[] = [];
  const ordered = submitted.map(item => {
    if (!item || typeof item !== 'object' || !isValidId((item as { id?: unknown }).id)) return undefined;
    const id = (item as { id: string }).id;
    if (!byId.has(id) || ids.includes(id)) return undefined;
    ids.push(id);
    return byId.get(id);
  });
  const authoritativeCount = authoritative.filter(Boolean).length;
  // A squad review is only valid once the complete 11+2 draft exists. This
  // prevents a reconnect/race from starting a competition with a partial team.
  return authoritativeCount === 13 && ids.length === authoritativeCount ? ordered : null;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function getUniqueRoomCode(): string {
  let code = generateRoomCode();
  while (rooms.has(code)) {
    code = generateRoomCode();
  }
  return code;
}

// Pending deletions for rooms whose players have all left (kept off the RoomState
// so the timer object is never serialized to clients).
const ROOM_CLEANUP_MS = 5 * 60 * 1000; // delete an all-empty room after 5 min

// O host controla a progressão. A regra é ESTÁVEL (ver room-host.ts): mantém o host
// atual enquanto ele estiver na sala, mesmo caído um instante — só transfere quando ele
// some de vez. Assim o papel não fica "pulando" entre jogadores a cada queda transitória.
// (O abandono real do host é tratado por um grace timer no disconnect.)
function recomputeHost(room: RoomState): void {
  room.hostId = pickHostId(room.players, room.hostId);
}

function isHost(room: RoomState, socketId: string): boolean {
  const host = room.players.find(p => p.id === room.hostId);
  return !!host && host.socketId === socketId;
}

function leagueParticipantIds(room: RoomState): string[] {
  return getOnlineLeagueParticipantIds(room.players, room.leagueFixtures, room.leagueRound);
}

function knockoutParticipantIds(room: RoomState): string[] {
  return room.knockoutBracket
    ? getOnlineKnockoutParticipantIds(room.players, getActiveKnockoutMatches(room.knockoutBracket))
    : [];
}

function invalidateReady(room: RoomState, playerId: string): void {
  room.readyPlayers = room.readyPlayers.filter(id => id !== playerId);
}

function emitReadyState(io: RealtimeServer, room: RoomState): void {
  // Readiness is shared UI state, while room_updated may contain private shop
  // offers and balances. Keep the two channels separate.
  io.to(room.code).emit("ready_state_updated", { readyPlayers: room.readyPlayers });
}

function pruneReadyPlayers(room: RoomState, participantIds: string[]): void {
  const participants = new Set(participantIds);
  room.readyPlayers = room.readyPlayers.filter(id => participants.has(id));
}

// Whether every human in the active knockout round has confirmed watching the leg
// that was just played. Used to gate BOTH playing the next leg (ida → volta) and
// advancing the bracket (after the volta) — so the host can never skip ahead.
function knockoutWatchStatus(room: RoomState): { allWatched: boolean; waiting: string[] } {
  const bracket = room.knockoutBracket;
  if (!bracket) return { allWatched: true, waiting: [] };
  const roundKey = bracket.currentRound === 'quarters' ? 'quarterFinals' : bracket.currentRound === 'semis' ? 'semiFinals' : bracket.currentRound;
  const currentMatches: any[] = bracket.currentRound === 'final'
    ? (bracket.final ? [bracket.final] : [])
    : (bracket as any)[roundKey] || [];
  // Only CONNECTED humans gate advancement — a player who left/disconnected must not
  // freeze the host waiting for a "watch" that will never come.
  const humanIdsInRound = getOnlineKnockoutParticipantIds(room.players, currentMatches);
  const allWatched = humanIdsInRound.every(id => room.watchedKnockoutLegPlayers.includes(id));
  const waiting = room.players
    .filter(p => humanIdsInRound.includes(p.id) && !room.watchedKnockoutLegPlayers.includes(p.id))
    .map(p => p.name);
  return { allWatched, waiting };
}

function knockoutLegAlreadyPlayed(room: RoomState): boolean {
  const bracket = room.knockoutBracket;
  if (!bracket) return false;
  const ties = getActiveKnockoutMatches(bracket) as any[];
  if (ties.length === 0) return false;
  const isFinal = bracket.currentRound === 'final';
  return ties.every(tie => {
    const singleLeg = tie.isSingleLeg === true || (isFinal && tie.isSingleLeg === undefined);
    if (singleLeg) return Boolean(tie.played && tie.result);
    return bracket.currentLeg === 1 ? Boolean(tie.leg1) : Boolean(tie.leg2);
  });
}

// 🎯 Revelação da rodada de LIGA: quando todos os humanos conectados com jogo na rodada já
// assistiram, credita de uma vez os pontos da partida (pendentes) + os ganhos dos palpites.
// Idempotente: zera pendingMatchPoints e marca bets revealed após creditar.
function creditLeagueRoundIfAllWatched(room: RoomState): void {
  const withFixture = leagueParticipantIds(room);
  const allWatched = withFixture.length > 0 && withFixture.every(id => room.watchedRoundPlayers.includes(id));
  if (!allWatched) return;
  const betPrefix = `L${room.leagueRound}:`;
  room.players.forEach(p => {
    if (p.pendingMatchPoints != null) { p.points += p.pendingMatchPoints; p.pendingMatchPoints = undefined; }
    p.bets = p.bets.map(b => {
      if (b.settled && !b.revealed && b.matchKey.startsWith(betPrefix)) {
        p.points += b.payout ?? 0;
        return { ...b, revealed: true };
      }
      return b;
    });
    syncTeamCredits(p);
  });
}

// 🎯 Revelação da PERNA do mata-mata: mesmo princípio, atrelado ao knockoutWatchStatus.
function creditKnockoutLegIfAllWatched(room: RoomState): void {
  if (!room.knockoutBracket) return;
  if (!knockoutWatchStatus(room).allWatched) return;
  room.players.forEach(p => {
    if (p.pendingMatchPoints != null) { p.points += p.pendingMatchPoints; p.pendingMatchPoints = undefined; }
    p.bets = p.bets.map(b => {
      if (b.settled && !b.revealed && b.matchKey.startsWith('K')) {
        p.points += b.payout ?? 0;
        return { ...b, revealed: true };
      }
      return b;
    });
    syncTeamCredits(p);
  });
}

// Schedule deletion of a room once every player has disconnected; cancelled if
// anyone (re)joins. Prevents abandoned rooms from leaking forever.
function scheduleRoomCleanupIfEmpty(room: RoomState): void {
  if (room.players.some(p => p.connected)) {
    cancelRoomCleanup(room.code);
    return;
  }
  if (activeRuntime.scheduler) {
    activeRuntime.scheduler.schedule('room_cleanup', room.code, ROOM_CLEANUP_MS);
    return;
  }
  if (cleanupTimers.has(room.code)) return;
  const timer = setTimeout(() => {
    runRoomCleanup(room.code);
  }, ROOM_CLEANUP_MS);
  cleanupTimers.set(room.code, timer);
}

function cancelRoomCleanup(code: string): void {
  if (activeRuntime.scheduler) {
    activeRuntime.scheduler.cancel('room_cleanup', code);
    return;
  }
  const t = cleanupTimers.get(code);
  if (t) { clearTimeout(t); cleanupTimers.delete(code); }
}

// Grace do HOST: se o host cai no meio do jogo, NÃO transferimos na hora (ele quase
// sempre reconecta em segundos — ver reconexão automática no cliente). Só se continuar
// offline após este tempo passamos o host pro primeiro conectado, pra não travar a sala
// num abandono real. Cancelado assim que o host reconecta.
const HOST_GRACE_MS = 30 * 1000;

function cancelHostGrace(code: string): void {
  if (activeRuntime.scheduler) {
    activeRuntime.scheduler.cancel('host_grace', code);
    return;
  }
  const t = hostGraceTimers.get(code);
  if (t) { clearTimeout(t); hostGraceTimers.delete(code); }
}

function scheduleHostGraceTransfer(io: RealtimeServer, room: RoomState): void {
  if (activeRuntime.scheduler) {
    activeRuntime.scheduler.schedule('host_grace', room.code, HOST_GRACE_MS);
    return;
  }
  if (hostGraceTimers.has(room.code)) return;
  const timer = setTimeout(() => {
    runHostGraceTransfer(io, room.code);
  }, HOST_GRACE_MS);
  hostGraceTimers.set(room.code, timer);
}

// Slots the chosen player into the active player's lineup and advances the draft
// turn (or moves to squad review when the draft is complete). Shared by the
// draft_pick handler and the disconnected-player auto-pick.
function applyDraftPick(room: RoomState, activePlayer: RoomPlayer, chosenPlayer: Player): boolean {
  const ds = room.draftState;
  const currentRound = ds.round;
  const newDrafted = [...activePlayer.draftedPlayers];
  const targetIndex = draftSlotIndex(activePlayer.formationId, newDrafted, chosenPlayer);
  // Never overwrite a starter with an incompatible card. This can only happen
  // if an old/stale client submits an option that is no longer valid.
  if (targetIndex === -1) return false;

  newDrafted[targetIndex] = chosenPlayer;
  activePlayer.draftedPlayers = newDrafted;

  ds.alreadyDraftedIds.push(chosenPlayer.id);
  ds.timerKey += 1;
  ds.history.push({
    round: currentRound,
    teamName: activePlayer.name,
    playerName: chosenPlayer.shortName,
    playerId: chosenPlayer.id,
    position: chosenPlayer.position,
    overall: chosenPlayer.overall,
  });

  const nextTurnIndex = ds.turnIndex + 1;
  if (nextTurnIndex >= ds.draftOrder.length) {
    room.phase = 'squad_review';
    room.players.forEach(p => { p.ready = false; });
  } else {
    ds.turnIndex = nextTurnIndex;
    ds.round = Math.floor(nextTurnIndex / room.players.length) + 1;
    const nextPlayerId = ds.draftOrder[nextTurnIndex];
    const nextPlayer = room.players.find(p => p.id === nextPlayerId);
    if (nextPlayer) {
      const nextNeeded = getNeededPositions(nextPlayer.formationId, nextPlayer.draftedPlayers);
      ds.currentOptionsByPlayer[nextPlayerId] = generateDraftOptions(nextNeeded, ds.alreadyDraftedIds);
    }
  }
  return true;
}

// Auto-picks (first available option) for any disconnected player whose turn it
// is, so the draft never stalls on someone who left. Stops at the first connected
// player. Emits once if any auto-pick happened.
function autoPickDisconnected(io: RealtimeServer, room: RoomState): void {
  let picked = false;
  let guard = 0;
  while (room.phase === 'draft' && guard++ < 1000) {
    const ds = room.draftState;
    const activeId = ds.draftOrder[ds.turnIndex];
    const active = room.players.find(p => p.id === activeId);
    if (!active || active.connected) break;
    let options = ds.currentOptionsByPlayer[activeId];
    if (!options || options.length === 0) {
      const needed = getNeededPositions(active.formationId, active.draftedPlayers);
      options = generateDraftOptions(needed, ds.alreadyDraftedIds);
      ds.currentOptionsByPlayer[activeId] = options;
    }
    const chosen = options[0];
    if (!chosen) break;
    if (!applyDraftPick(room, active, chosen)) break;
    picked = true;
  }
  if (picked) {
    bumpRoomRevision(room);
    emitRoomUpdate(io, room);
  }
}

// ── Draft turn timer ── auto-picks for a CONNECTED player who sits idle on their turn, so a
// single AFK player can't freeze the whole draft. (Disconnected players are covered separately
// by autoPickDisconnected.) Kept off RoomState so the timer object is never serialized.
const DRAFT_TURN_MS = DRAFT_TURN_SECONDS * 1000;

function clearDraftTurnTimer(code: string): void {
  if (activeRuntime.scheduler) {
    activeRuntime.scheduler.cancel('draft_turn', code);
    return;
  }
  const t = draftTurnTimers.get(code);
  if (t) { clearTimeout(t); draftTurnTimers.delete(code); }
}

// (Re)arm the idle-turn timer for whoever is on the clock. No-op when the draft is over or the
// active player is disconnected. Safe to call after any draft state change — it always resets.
function scheduleDraftTurnTimer(io: RealtimeServer, room: RoomState): void {
  clearDraftTurnTimer(room.code);
  if (room.phase !== 'draft') return;
  const active = room.players.find(p => p.id === room.draftState.draftOrder[room.draftState.turnIndex]);
  if (!active || !active.connected) return;
  if (activeRuntime.scheduler) {
    activeRuntime.scheduler.schedule('draft_turn', room.code, DRAFT_TURN_MS);
    return;
  }
  const timer = setTimeout(() => {
    runDraftTurnTimer(io, room.code);
  }, DRAFT_TURN_MS);
  draftTurnTimers.set(room.code, timer);
}

function runRoomCleanup(roomCode: string): void {
  cleanupTimers.delete(roomCode);
  const room = rooms.get(roomCode);
  if (!room || room.players.some(p => p.connected)) return;
  clearDraftTurnTimer(roomCode);
  cancelHostGrace(roomCode);
  rooms.delete(roomCode);
  console.log(`Room ${roomCode} deleted (all players left)`);
}

function runHostGraceTransfer(io: RealtimeServer, roomCode: string): void {
  hostGraceTimers.delete(roomCode);
  const room = rooms.get(roomCode);
  if (!room) return;
  const host = room.players.find(p => p.id === room.hostId);
  if (host && !host.connected) {
    const replacement = room.players.find(p => p.connected);
    if (replacement) {
      room.hostId = replacement.id;
      bumpRoomRevision(room);
      emitRoomUpdate(io, room);
      console.log(`Host transferido (abandono) na sala ${room.code} → ${replacement.name}`);
    }
  }
}

function runDraftTurnTimer(io: RealtimeServer, roomCode: string): void {
  draftTurnTimers.delete(roomCode);
  const room = rooms.get(roomCode);
  if (!room || room.phase !== 'draft') return;
  const draftState = room.draftState;
  const active = room.players.find(p => p.id === draftState.draftOrder[draftState.turnIndex]);
  if (!active) return;
  let options = draftState.currentOptionsByPlayer[active.id];
  if (!options || options.length === 0) {
    options = generateDraftOptions(getNeededPositions(active.formationId, active.draftedPlayers), draftState.alreadyDraftedIds);
    draftState.currentOptionsByPlayer[active.id] = options;
  }
  if (options[0] && applyDraftPick(room, active, options[0])) {
    bumpRoomRevision(room);
    emitRoomUpdate(io, room);
    autoPickDisconnected(io, room);
    scheduleDraftTurnTimer(io, room);
  }
}

/** Called by Durable Object alarms. Node timers use the same implementation. */
export function runGameTimer(io: RealtimeServer, runtime: GameRuntime, kind: GameTimerKind, roomCode: string): void {
  runWithGameRuntime(runtime, () => {
    if (kind === 'room_cleanup') runRoomCleanup(roomCode);
    else if (kind === 'host_grace') runHostGraceTransfer(io, roomCode);
    else runDraftTurnTimer(io, roomCode);
  });
}

export function registerSocketHandlers(io: RealtimeServer) {
  const rateWindows = new Map<string, { startedAt: number; count: number; warned: boolean }>();

  io.on("connection", (socket: RealtimeSocket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Registra um handler de gameplay com rede de segurança: se ELE ESTOURAR no meio,
    // o servidor não emitiria `room_updated` e o cliente ficaria com a tela travada sem
    // feedback. Aqui capturamos a exceção, logamos e avisamos o cliente (`action_error`)
    // pra ele mostrar um toast em vez de congelar. (O `disconnect` fica no socket.on cru.)
    const on = (event: string, handler: (payload: any) => void) => {
      socket.on(event, (payload: any) => {
        const now = Date.now();
        const previousWindow = rateWindows.get(socket.id);
        const currentWindow = !previousWindow || now - previousWindow.startedAt >= 1000
          ? { startedAt: now, count: 0, warned: false }
          : previousWindow;
        currentWindow.count += 1;
        rateWindows.set(socket.id, currentWindow);
        if (currentWindow.count > MAX_EVENTS_PER_SECOND) {
          if (!currentWindow.warned) {
            currentWindow.warned = true;
            socket.emit("action_error", { event, message: "Muitas ações em pouco tempo. Aguarde um instante." });
          }
          return;
        }

        // These events only negotiate the wire format or request a fresh
        // authoritative snapshot. They must never pay the price of cloning,
        // diffing, and persisting the complete room state.
        const readOnlyEvent = event === 'client_capabilities' || event === 'sync_room';
        if (readOnlyEvent) {
          try {
            handler(payload);
          } catch (err) {
            console.error(`Erro no handler de sincronização "${event}" (socket ${socket.id}):`, err);
            socket.emit("action_error", { event, message: "Não foi possível sincronizar a sala. Tente novamente." });
          }
          return;
        }

        const roomCode = roomCodeFromPayload(payload);
        const previousRoom = roomCode ? rooms.get(roomCode) : undefined;
        // Handlers mutate the authoritative room in place. Keep a transaction-sized
        // backup so an unexpected exception cannot persist a half-applied purchase,
        // bracket transition or readiness update.
        const managedByOuterTransaction = activeRuntime.externalTransactions === true;
        const previousRoomSnapshot = managedByOuterTransaction
          ? undefined
          : previousRoom ? cloneRoomJson(previousRoom) : undefined;
        const previousRoomForDigest = managedByOuterTransaction
          ? activeRuntime.transactionRoomBefore ?? null
          : previousRoomSnapshot;
        const previousMarketSeq = marketSeq;
        const commandId = commandIdFromPayload(payload);
        const expectedRoomEpoch = roomEpochFromPayload(payload);
        try {
          activeRuntime.mutationObserved = false;
          if (previousRoom && expectedRoomEpoch !== null && expectedRoomEpoch !== previousRoom.roomEpoch) {
            // A queued command from a previous restart must never act on the
            // new match that happens to reuse the same four-letter room code.
            if (commandId) {
              socket.emit('command_ack', {
                commandId,
                event,
                status: 'rejected',
                reason: 'stale_room_epoch',
                stateRevision: previousRoom.stateRevision,
              });
            }
            return;
          }
          if (previousRoom && commandId) {
            const receipt = findCommand(previousRoom, commandId);
            if (receipt) {
              // A response may have been lost while the client disconnected.
              // Replaying the exact command is acknowledged, never executed.
              socket.emit('command_ack', {
                commandId,
                event: receipt.event,
                status: 'already_applied',
                stateRevision: receipt.stateRevision,
              });
              return;
            }
          }
          if (previousRoom && event !== 'client_capabilities' && event !== 'sync_room') {
            bumpRoomRevision(previousRoom);
          }
          handler(payload);

          const nextRoom = roomCode ? rooms.get(roomCode) : undefined;
          const changed = activeRuntime.mutationObserved
            || (previousRoomForDigest && nextRoom
              ? roomMutationDigest(previousRoomForDigest) !== roomMutationDigest(nextRoom)
              : !!previousRoomForDigest !== !!nextRoom);
          activeRuntime.lastMutation = {
            event,
            roomCode,
            changed,
            stateRevision: nextRoom?.stateRevision ?? null,
          };
          if (nextRoom && changed) {
            if (commandId) rememberCommand(nextRoom, event, commandId);
            // This marker is intentionally private. Durable Objects persist the
            // complete room after the handler returns, so it becomes a recovery
            // point only after the transaction commits.
            markRoomCheckpoint(nextRoom, event);
            if (commandId) {
              socket.emit('command_ack', {
                commandId,
                event,
                status: 'applied',
                stateRevision: nextRoom.stateRevision,
              });
            }
          } else if (nextRoom && commandId) {
            // A command that reached the authoritative handler but was no-op
            // or invalid is terminal too. Tell the client to stop retrying it;
            // the next intentional click will receive a fresh command ID.
            socket.emit('command_ack', {
              commandId,
              event,
              status: 'rejected',
              stateRevision: nextRoom.stateRevision,
            });
          }
        } catch (err) {
          // The Cloudflare Durable Object owns the outer transaction and will
          // restore its snapshot. Re-throw so it can also roll back pending
          // outbound frames atomically.
          if (managedByOuterTransaction) throw err;
          if (roomCode) {
            if (previousRoomSnapshot) rooms.set(roomCode, previousRoomSnapshot);
            else if (!previousRoom) rooms.delete(roomCode);
          }
          marketSeq = previousMarketSeq;
          console.error(`Erro no handler "${event}" (socket ${socket.id}):`, err);
          socket.emit("action_error", { event, message: "Algo deu errado ao processar a ação. Tenta de novo." });
        }
      });
    };

    // Clients that understand the incremental protocol opt in explicitly.
    // Until then, the legacy full-snapshot event remains available so a
    // rolling deploy never strands an older browser tab.
    on("client_capabilities", ({ roomUpdates }: { roomUpdates?: unknown }) => {
      if (roomUpdates === 1) getRoomSyncSession(socket).supportsPatches = true;
    });

    // A patch gap is never guessed through. The client asks for the current
    // authoritative state and resumes the patch stream from that revision.
    on("sync_room", ({ roomCode }: { roomCode?: unknown }) => {
      if (!isValidId(roomCode)) return;
      const room = rooms.get(roomCode);
      if (!room || !room.players.some(player => player.socketId === socket.id)) return;
      emitRoomSnapshot(socket, room);
    });

    // Create Room
    on("create_room", ({ creatorName, competitionFormat, difficulty, clientId, roomCode: requestedRoomCode }: { creatorName: string; competitionFormat?: unknown; difficulty?: unknown; clientId?: string; roomCode?: unknown }) => {
      const normalizedCreatorName = normalizePlayerName(creatorName);
      if (!normalizedCreatorName) {
        socket.emit("action_error", { event: "create_room", message: `O nome deve ter entre 1 e ${MAX_PLAYER_NAME_LENGTH} caracteres.` });
        return;
      }
      if (clientId != null && !isValidClientId(clientId)) {
        socket.emit("action_error", { event: "create_room", message: "Identidade do dispositivo inválida. Recarregue a página e tente novamente." });
        return;
      }
      const requestedFormat = competitionFormat ?? DEFAULT_COMPETITION_FORMAT;
      const formatError = validateCompetitionFormat(requestedFormat);
      if (formatError) {
        socket.emit("action_error", { event: "create_room", message: formatError });
        return;
      }
      const requestedDifficulty = difficulty ?? 'gold';
      if (typeof requestedDifficulty !== 'string' || !DIFFICULTY_LEVELS.some(level => level.id === requestedDifficulty)) {
        socket.emit("action_error", { event: "create_room", message: "Escolha uma dificuldade válida para os bots." });
        return;
      }
      const requestedCode = typeof requestedRoomCode === 'string' ? requestedRoomCode.trim().toUpperCase() : undefined;
      if (requestedCode !== undefined && !isValidRoomCode(requestedCode)) {
        socket.emit("action_error", { event: "create_room", message: "Código de sala inválido." });
        return;
      }
      const roomCode = requestedCode ?? getUniqueRoomCode();
      // A Cloudflare room object is intentionally scoped to one code. Without
      // this guard a forged message could create a second room in that object.
      if (activeRuntime.roomCode && roomCode !== activeRuntime.roomCode) {
        socket.emit("action_error", { event: "create_room", message: "Código de sala não corresponde à conexão." });
        return;
      }
      if (rooms.has(roomCode)) {
        socket.emit("action_error", { event: "create_room", message: "Este código acabou de ser usado. Tente criar a sala novamente." });
        return;
      }
      const newRoom: RoomState = {
        code: roomCode,
        stateRevision: 1,
        roomEpoch: 1,
        commandReceipts: [],
        kickedClientIds: [],
        phase: 'lobby',
        difficulty: requestedDifficulty,
        competitionFormat: normalizeCompetitionFormat(requestedFormat),
        hostId: 'player_0',
        players: [
          {
            socketId: socket.id,
            clientId,
            id: 'player_0',
            name: normalizedCreatorName,
            coachId: 'guardiola',
            coachPrime: false,
            formationId: '4-3-3',
            playStyle: 'balanced',
            matchPlan: normalizeMatchPlan(),
            draftedPlayers: Array(13).fill(undefined), // 11 titulares + 2 reservas
            vetoesLeft: 4,
            captain: null,
            penaltyTaker: null,
            freeKickTaker: null,
            team: null,
            ready: false,
            connected: true,
            points: 0,
            lastMatchPoints: null,
            reinforcementOptions: null,
            reinforcementRerolls: 0,
            pendingPack: null,
            pendingUniquePack: null,
            uniquePackOfferIds: [],
            uniquePackOfferRoundKey: null,
            bets: []
          }
        ],
        botTeams: [],
        leagueFixtures: [],
        leagueStandings: [],
        leagueResults: [],
        leagueRound: 1,
        knockoutBracket: null,
        champion: null,
        watchedRoundPlayers: [],
        watchedKnockoutLegPlayers: [],
        watchedLeagueRound: null,
        watchedKnockoutLegKey: null,
        readyPlayers: [],
        discipline: {},
        market: [],
        draftState: {
          round: 1,
          timerKey: 0,
          turnIndex: 0,
          draftOrder: [],
          alreadyDraftedIds: [],
          history: [],
          currentOptionsByPlayer: {}
        }
      };

      rooms.set(roomCode, newRoom);
      socket.join(roomCode);
      emitInitialRoom(socket, "room_created", { roomCode }, newRoom);
      console.log(`Room created: ${roomCode} by ${normalizedCreatorName}`);
    });

    // Join Room
    on("join_room", ({ roomCode, playerName, clientId }: { roomCode: string; playerName: string; clientId?: string }) => {
      const code = typeof roomCode === 'string' ? roomCode.trim().toUpperCase() : '';
      const normalizedPlayerName = normalizePlayerName(playerName);
      if (!isValidRoomCode(code)) {
        socket.emit("error_message", "Código de sala inválido.");
        return;
      }
      if (!normalizedPlayerName) {
        socket.emit("error_message", `O nome deve ter entre 1 e ${MAX_PLAYER_NAME_LENGTH} caracteres.`);
        return;
      }
      if (clientId != null && !isValidClientId(clientId)) {
        socket.emit("error_message", "Identidade do dispositivo inválida. Recarregue a página e tente novamente.");
        return;
      }
      const room = rooms.get(code);

      if (!room) {
        socket.emit("error_message", "Sala não encontrada. Verifique o código.");
        return;
      }

      if (clientId && room.kickedClientIds?.includes(clientId)) {
        socket.emit("error_message", "Você foi removido desta sala pelo anfitrião.");
        return;
      }

      // RECONEXÃO ROBUSTA por clientId: é COMPROVADAMENTE a mesma pessoa (identidade persistente),
      // então reassume o assento mesmo se ainda constar "conectado" (corrida de refresh) — sem falso
      // "nome já usado". Só o dono do clientId reassume aquele assento.
      const byClient = clientId ? room.players.find(p => p.clientId === clientId) : undefined;
      if (byClient) {
        if (byClient.kicked) {
          socket.emit("error_message", "Você foi removido desta sala pelo anfitrião.");
          return;
        }
        byClient.socketId = socket.id;
        byClient.connected = true;
        cancelRoomCleanup(code);
        if (byClient.id === room.hostId) cancelHostGrace(code); // só o host que voltou cancela a transferência
        recomputeHost(room);
        socket.join(code);
        emitInitialRoom(socket, "joined_room", { roomCode: code, player: byClient }, room);
        emitRoomUpdate(io, room, { excludeSocketId: socket.id });
        if (room.phase === 'draft') { autoPickDisconnected(io, room); scheduleDraftTurnTimer(io, room); }
        console.log(`Player reconnected (clientId): ${byClient.name} to ${code}`);
        return;
      }

      // Check if player name already exists (Reconnect Scenario)
      const existingPlayer = room.players.find(p => p.name.toLowerCase() === normalizedPlayerName.toLowerCase());
      if (existingPlayer) {
        if (existingPlayer.kicked) {
          socket.emit("error_message", "Você foi removido desta sala pelo anfitrião.");
          return;
        }
        // Only treat a name match as a RECONNECT if that player is actually offline. If they're
        // still connected, this is a different person with a clashing name — reject it, otherwise
        // they'd hijack the original player's seat (steal their socket/team).
        if (existingPlayer.connected) {
          socket.emit("error_message", "Já existe um jogador com esse nome nesta sala. Escolha outro nome.");
          return;
        }
        // A name match is only a legacy fallback for rooms created before the
        // persistent client identity existed. Once a clientId is stored, a
        // different browser cannot hijack that seat by typing the same name.
        if (existingPlayer.clientId && existingPlayer.clientId !== clientId) {
          socket.emit("error_message", "Esta vaga pertence a outro dispositivo. Reconecte pelo mesmo navegador.");
          return;
        }
        existingPlayer.socketId = socket.id;
        existingPlayer.connected = true;
        if (clientId) existingPlayer.clientId = clientId; // adota a identidade p/ reconexões futuras
        cancelRoomCleanup(code);
        if (existingPlayer.id === room.hostId) cancelHostGrace(code); // só o host que voltou cancela a transferência
        recomputeHost(room);
        socket.join(code);
        emitInitialRoom(socket, "joined_room", { roomCode: code, player: existingPlayer }, room);
        emitRoomUpdate(io, room, { excludeSocketId: socket.id });
        // A reconnected player may have been the one we were waiting on for a pick.
        if (room.phase === 'draft') { autoPickDisconnected(io, room); scheduleDraftTurnTimer(io, room); }
        console.log(`Player reconnected: ${normalizedPlayerName} to ${code}`);
        return;
      }

      if (room.phase !== 'lobby') {
        socket.emit("error_message", "A partida nesta sala já começou.");
        return;
      }

      if (room.players.length >= MAX_ONLINE_PLAYERS) {
        socket.emit("error_message", `A sala já está cheia (limite de ${MAX_ONLINE_PLAYERS} jogadores).`);
        return;
      }

      const newPlayer: RoomPlayer = {
        socketId: socket.id,
        clientId,
        id: `player_${room.players.length}`,
        name: normalizedPlayerName,
        coachId: 'guardiola',
        coachPrime: false,
        formationId: '4-3-3',
        playStyle: 'balanced',
        matchPlan: normalizeMatchPlan(),
        draftedPlayers: Array(13).fill(undefined), // 11 titulares + 2 reservas
        vetoesLeft: 4,
        captain: null,
        penaltyTaker: null,
        freeKickTaker: null,
        team: null,
        ready: false,
        connected: true,
        points: 0,
        lastMatchPoints: null,
        reinforcementOptions: null,
        reinforcementRerolls: 0,
        pendingPack: null,
        pendingUniquePack: null,
        uniquePackOfferIds: [],
        uniquePackOfferRoundKey: null,
        bets: []
      };

      room.players.push(newPlayer);
      recomputeHost(room);
      socket.join(code);
      emitInitialRoom(socket, "joined_room", { roomCode: code, player: newPlayer }, room);
      emitRoomUpdate(io, room, { excludeSocketId: socket.id });
      console.log(`Player joined: ${playerName} to ${code}`);
    });

    // Host starts setup phase
    on("start_setup", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || !isHost(room, socket.id) || room.phase !== 'lobby') return;
      if (room.players.filter(p => p.connected).length < 2) {
        socket.emit("error_message", "São necessários pelo menos 2 jogadores conectados para iniciar.");
        return;
      }
      room.phase = 'setup';
      room.players.forEach(p => { p.ready = false; });
      emitRoomUpdate(io, room);
    });

    // Player submits coach & formation
    on("submit_setup", ({ roomCode, coachId, formationId, crestId }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (room.phase !== 'setup') return;
      if (!isValidId(coachId) || !VALID_COACH_IDS.has(coachId)) return;
      if (!isValidId(formationId) || !VALID_FORMATION_IDS.has(formationId)) return;
      if (crestId != null && (!isValidId(crestId) || !VALID_CREST_IDS.has(crestId))) return;

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      player.coachId = coachId;
      player.formationId = formationId;
      player.crestId = crestId ?? null;
      player.ready = true;

      // Check if all players have submitted setup
      const connectedPlayers = room.players.filter(p => p.connected);
      const allReady = connectedPlayers.length > 0 && connectedPlayers.every(p => p.ready);
      if (allReady) {
        // Build Snake Draft Order for 13 rounds (11 titulares + 2 reservas)
        const numPlayers = room.players.length;
        const draftOrder: string[] = [];
        for (let round = 1; round <= 13; round++) {
          if (round % 2 !== 0) {
            for (let i = 0; i < numPlayers; i++) {
              draftOrder.push(room.players[i].id);
            }
          } else {
            for (let i = numPlayers - 1; i >= 0; i--) {
              draftOrder.push(room.players[i].id);
            }
          }
        }

        room.draftState = {
          round: 1,
          timerKey: 0,
          turnIndex: 0,
          draftOrder,
          alreadyDraftedIds: [],
          history: [],
          currentOptionsByPlayer: {}
        };
        room.phase = 'draft';
        room.players.forEach(p => { p.ready = false; });

        // Generate draft options for first turn
        const firstPlayerId = draftOrder[0];
        const firstPlayer = room.players.find(p => p.id === firstPlayerId)!;
        const needed = getNeededPositions(firstPlayer.formationId, firstPlayer.draftedPlayers);
        const options = generateDraftOptions(needed, []);
        room.draftState.currentOptionsByPlayer[firstPlayerId] = options;
      }

      emitRoomUpdate(io, room);
      // If the draft just started on a disconnected player, don't stall.
      if (room.phase === 'draft') { autoPickDisconnected(io, room); scheduleDraftTurnTimer(io, room); }
    });

    // Player picks a card
    on("draft_pick", ({ roomCode, playerId }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.draftState) return;

      const activePlayerId = room.draftState.draftOrder[room.draftState.turnIndex];
      const activePlayer = room.players.find(p => p.id === activePlayerId);
      if (!activePlayer) return;

      // Verify it is indeed their turn
      if (activePlayer.socketId !== socket.id) return;

      const options = room.draftState.currentOptionsByPlayer[activePlayerId] || [];
      const chosenPlayer = options.find(p => p.id === playerId);
      if (!chosenPlayer) return;

      if (!applyDraftPick(room, activePlayer, chosenPlayer)) {
        socket.emit("action_error", { event: "draft_pick", message: "Essa carta não cabe em uma vaga válida do seu time." });
        return;
      }
      emitRoomUpdate(io, room);
      // If the turn landed on someone who has disconnected, keep the draft moving.
      autoPickDisconnected(io, room);
      scheduleDraftTurnTimer(io, room); // arm the idle timer for the new active player
    });

    // Player vetoes current draft options
    on("draft_veto", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || !room.draftState) return;

      const activePlayerId = room.draftState.draftOrder[room.draftState.turnIndex];
      const activePlayer = room.players.find(p => p.id === activePlayerId);
      if (!activePlayer) return;

      if (activePlayer.socketId !== socket.id || activePlayer.vetoesLeft <= 0) return;

      activePlayer.vetoesLeft -= 1;
      room.draftState.timerKey += 1;
      const needed = getNeededPositions(activePlayer.formationId, activePlayer.draftedPlayers);
      const options = generateDraftOptions(needed, room.draftState.alreadyDraftedIds);
      room.draftState.currentOptionsByPlayer[activePlayerId] = options;

      emitRoomUpdate(io, room);
      scheduleDraftTurnTimer(io, room); // fresh time after a veto
    });

    // Player submits squad review (captain, penalty taker)
    on("submit_squad_review", ({ roomCode, captain, penaltyTaker, freeKickTaker, draftedPlayers, playStyle, formationId, matchPlan }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (room.phase !== 'squad_review') return;
      if (playStyle != null && (!isValidId(playStyle) || !VALID_TACTIC_IDS.has(playStyle))) return;
      if (formationId != null && (!isValidId(formationId) || !VALID_FORMATION_IDS.has(formationId))) return;
      const canonicalMatchPlan = matchPlan == null ? normalizeMatchPlan() : validateMatchPlan(matchPlan);
      if (!canonicalMatchPlan) return;

      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      // The client may reorder the 13 cards during review, but it may not replace
      // a server-owned card or alter its stats/traits. Rebuild the submitted order
      // from the authoritative draft instances.
      const orderedDraft = canonicalDraftOrder(draftedPlayers, player.draftedPlayers);
      if (!orderedDraft) return;
      const submittedStarters = orderedDraft.slice(0, 11).filter((p): p is Player => !!p);
      const canonicalCaptain = captain == null ? null : canonicalRoleId(captain, submittedStarters);
      const canonicalPenaltyTaker = penaltyTaker == null ? null : canonicalRoleId(penaltyTaker, submittedStarters, p => p.position !== 'GK');
      const canonicalFreeKickTaker = freeKickTaker == null ? null : canonicalRoleId(freeKickTaker, submittedStarters, p => p.position !== 'GK');
      if ((captain != null && !canonicalCaptain) || (penaltyTaker != null && !canonicalPenaltyTaker) || (freeKickTaker != null && !canonicalFreeKickTaker)) return;

      player.captain = canonicalCaptain;
      player.penaltyTaker = canonicalPenaltyTaker;
      player.freeKickTaker = canonicalFreeKickTaker;
      player.draftedPlayers = orderedDraft;
      if (playStyle) player.playStyle = playStyle;
      if (formationId) player.formationId = formationId; // formation can be changed post-draft
      player.matchPlan = canonicalMatchPlan;
      player.ready = true;

      // Start once every CONNECTED player is ready — a player who dropped during squad review
      // must not freeze the whole room forever. Their team is still built below from the lineup
      // the draft already completed for them.
      const allReady = room.players.every(p => p.ready || !p.connected);
      if (allReady) {
        // Build Team objects for all humans
        room.players.forEach(p => {
          const starters = p.draftedPlayers.slice(0, 11).filter((pl): pl is Player => pl !== undefined);
          const formation = FORMATIONS.find(f => f.id === p.formationId);
          const roles = formation?.positions.map(pos => pos.role) ?? [];
          const chemData = calculateChemistry(starters, p.coachId, roles, p.formationId);

          const playerCards: PlayerCard[] = p.draftedPlayers
            .filter((pl): pl is Player => pl !== undefined)
            .map(pl => {
              const idx = p.draftedPlayers.findIndex(dp => dp?.id === pl.id);
              const isOOP = idx !== -1 && idx < 11 ? (chemData.outOfPosition[pl.id] ?? false) : false;
              return {
                ...pl,
                chemistryScore: chemData.individual[pl.id] ?? 1,
                isOOP
              };
            });

          p.team = {
            id: p.id,
            name: p.name,
            coachId: p.coachId,
            formationId: p.formationId,
            playStyle: p.playStyle ?? 'balanced',
            matchPlan: normalizeMatchPlan(p.matchPlan),
            players: playerCards,
            captain: p.captain ?? undefined,
            penaltyTaker: p.penaltyTaker ?? undefined,
            freeKickTaker: p.freeKickTaker ?? undefined,
            totalChemistry: chemData.total,
            isBot: false,
            credits: p.points,
            crestId: p.crestId ?? undefined
          };
        });

        // Generate only the number of bots required by the selected preset.
        const diffLevel = DIFFICULTY_LEVELS.find(d => d.id === room.difficulty);
        const botStrength = diffLevel?.botStrength ?? 0.72;

        const BOT_NAMES = [
          'Real Madrid', 'Manchester City', 'Bayern München', 'Paris Saint-Germain',
          'Liverpool FC', 'Inter de Milão', 'Arsenal FC', 'FC Barcelona',
          'Borussia Dortmund', 'Juventus FC', 'Atlético de Madrid', 'Bayer Leverkusen',
          'AC Milan', 'Benfica Glorioso', 'Sporting CP', 'FC Porto', 'Ajax Legends',
          'PSV Eindhoven', 'Feyenoord Roterdã', 'Aston Villa', 'Atalanta Bergamo',
          'AS Monaco', 'Lille OSC', 'VfB Stuttgart', 'Bologna FC', 'Girona FC',
          'Celtic FC', 'Club Brugge', 'Shakhtar Donetsk', 'Dinamo Zagreb',
          'RB Salzburg', 'Sparta Praga', 'Young Boys Bern', 'Estrela Vermelha',
          'Lazio Roma'
        ];

        const humanNames = room.players.map(p => p.team!.name.toLowerCase());
        const filteredBotNames = BOT_NAMES.filter(name => !humanNames.includes(name.toLowerCase()));
        const numBotsNeeded = Math.max(0, room.competitionFormat.teamCount - room.players.length);
        const selectedBotNames = filteredBotNames.slice(0, numBotsNeeded);

        room.botTeams = selectedBotNames.map(name => generateBotTeam(name, botStrength));
        const allTeams = [...room.players.map(p => p.team!), ...room.botTeams];

        room.leagueFixtures = room.competitionFormat.id === 'groups_knockout'
          ? generateRandomGroupFixtures(allTeams, room.competitionFormat.groupCount, room.competitionFormat.groupRounds)
          : generateRandomLeagueFixtures(allTeams, room.competitionFormat.leagueRounds);
        room.leagueStandings = computeStandings(allTeams, []);
        room.leagueRound = 1;
        if (room.competitionFormat.id === 'knockout') {
          room.knockoutBracket = createKnockoutBracket(room.leagueStandings, room.competitionFormat);
          room.phase = 'knockout';
          room.discipline = resetYellowsForKnockout(room.discipline);
        } else {
          room.phase = 'league';
        }
      }

      emitRoomUpdate(io, room);
    });

    // Player updates captain / penalty taker for their own team (pre-league and
    // between matches). Kept on the authoritative server team so the server-side
    // simulation uses the chosen penalty taker.
    on("set_match_roles", ({ roomCode, captain, penaltyTaker, freeKickTaker, playStyle, formationId }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;

      if (playStyle != null && (!isValidId(playStyle) || !VALID_TACTIC_IDS.has(playStyle))) return;
      if (formationId != null && (!isValidId(formationId) || !VALID_FORMATION_IDS.has(formationId))) return;
      if (!isValidOptionalId(captain) || !isValidOptionalId(penaltyTaker) || !isValidOptionalId(freeKickTaker)) return;
      const starters = player.team?.players.slice(0, 11) ?? player.draftedPlayers.slice(0, 11).filter((p): p is Player => !!p).map(p => ({ ...p, chemistryScore: 0, isOOP: false } as PlayerCard));
      const canonicalCaptain = captain == null ? null : canonicalRoleId(captain, starters);
      const canonicalPenaltyTaker = penaltyTaker == null ? null : canonicalRoleId(penaltyTaker, starters, p => p.position !== 'GK');
      const canonicalFreeKickTaker = freeKickTaker == null ? null : canonicalRoleId(freeKickTaker, starters, p => p.position !== 'GK');
      if ((captain != null && !canonicalCaptain) || (penaltyTaker != null && !canonicalPenaltyTaker) || (freeKickTaker != null && !canonicalFreeKickTaker)) return;

      player.captain = canonicalCaptain;
      player.penaltyTaker = canonicalPenaltyTaker;
      player.freeKickTaker = canonicalFreeKickTaker;
      if (playStyle) player.playStyle = playStyle;
      if (formationId) player.formationId = formationId;
      if (player.team) {
        player.team.captain = canonicalCaptain ?? undefined;
        player.team.penaltyTaker = canonicalPenaltyTaker ?? undefined;
        player.team.freeKickTaker = canonicalFreeKickTaker ?? undefined;
        if (playStyle) player.team.playStyle = playStyle;
        // Changing formation between matches re-maps roles → recompute chemistry / OOP
        // server-side so the authoritative simulation uses the new shape.
        if (formationId && player.team.formationId !== formationId) {
          player.team.formationId = formationId;
          const formation = FORMATIONS.find(f => f.id === formationId);
          const roles = formation?.positions.map(pos => pos.role) ?? [];
          const starters = player.team.players.slice(0, 11);
          const chemData = calculateChemistry(starters, player.team.coachId, roles, formationId);
          player.team.players = player.team.players.map((pl, idx) => ({
            ...pl,
            chemistryScore: chemData.individual[pl.id] ?? 1,
            isOOP: idx < 11 ? (chemData.outOfPosition[pl.id] ?? false) : false,
          }));
          player.team.totalChemistry = chemData.total;
        }
      }
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
      emitReadyState(io, room);
    });

    // Each player owns their own automatic match plan. The server validates and stores the
    // canonical version so an online client cannot inject arbitrary actions or more than two
    // one-shot triggers into the authoritative simulation.
    on("set_match_plan", ({ roomCode, matchPlan }) => {
      const room = rooms.get(roomCode);
      if (!room || (room.phase !== 'league' && room.phase !== 'knockout')) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.connected || !player.team) return;
      const canonicalMatchPlan = validateMatchPlan(matchPlan);
      if (!canonicalMatchPlan) return;

      player.matchPlan = canonicalMatchPlan;
      player.team.matchPlan = canonicalMatchPlan;
      // Editing a plan after pressing "Estou pronto" invalidates that confirmation. This
      // prevents a player from changing instructions while the host is resolving the round.
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room);
    });

    // Swap two players in this player's squad (bench ↔ starter, or reorder the XI). Mirrors the
    // solo SWAP_PLAYER_TEAM: recompute chemistry/OOP and drop captain/taker roles that fell out
    // of the XI, so the authoritative simulation uses the new lineup.
    on("swap_player_team", ({ roomCode, indexA, indexB }: { roomCode: string; indexA: number; indexB: number }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      const players = [...player.team.players];
      if (indexA < 0 || indexB < 0 || indexA >= players.length || indexB >= players.length || indexA === indexB) return;
      const tmp = players[indexA]; players[indexA] = players[indexB]; players[indexB] = tmp;

      const starters = players.slice(0, 11);
      let captain = player.team.captain;
      let penaltyTaker = player.team.penaltyTaker;
      let freeKickTaker = player.team.freeKickTaker;
      if (captain && !starters.some(p => p.id === captain)) captain = undefined;
      if (penaltyTaker && !starters.some(p => p.id === penaltyTaker)) penaltyTaker = undefined;
      if (freeKickTaker && !starters.some(p => p.id === freeKickTaker)) freeKickTaker = undefined;

      player.team = rebuildTeamChemistry({ ...player.team, players, captain, penaltyTaker, freeKickTaker });
      // Keep the RoomPlayer role fields in sync (they seed future set_match_roles / rebuilds).
      player.captain = captain ?? null;
      player.penaltyTaker = penaltyTaker ?? null;
      player.freeKickTaker = freeKickTaker ?? null;
      // ✅ Mudou a escalação → precisa reconfirmar "Estou pronto".
      const wasReady = room.readyPlayers.includes(player.id);
      invalidateReady(room, player.id);
      if (wasReady) {
        emitRoomUpdate(io, room);
      } else {
        emitRoomUpdate(io, room, { onlySocketId: socket.id });
      }
      if (wasReady) emitReadyState(io, room);
    });

    // 🩸 Mártir — set which (up to 2) XI teammates receive the +3. Validated against the CURRENT XI.
    on("set_martir_targets", ({ roomCode, playerId, targetIds }: { roomCode: string; playerId: string; targetIds: string[] }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      if (!isValidId(playerId) || !Array.isArray(targetIds)) return;
      const source = player.team.players.find(p => p.id === playerId);
      if (!source?.martir) return;
      const starterIds = new Set(player.team.players.slice(0, 11).map(p => p.id));
      const valid = (targetIds || []).filter(id => id !== playerId && starterIds.has(id)).slice(0, 2);
      player.team.players = player.team.players.map(p => p.id === playerId ? { ...p, martirTargets: valid } : p);
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
      emitReadyState(io, room);
    });

    // ⭐ Carta Evoluída: aplicar um pacote de 6 pontos ao atributo escolhido (só carta do próprio time).
    on("set_evolve_point", ({ roomCode, playerId, attr, delta }: { roomCode: string; playerId: string; attr: any; delta: number }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      if (!isValidId(playerId) || !VALID_TRAIN_ATTRS.has(attr) || !Number.isInteger(delta) || delta !== EVOLVE_POINTS) return;
      player.team.players = player.team.players.map(p => {
        if (p.id !== playerId || !isEvolved(p)) return p;
        const unlockedPoints = getEvolutionLevel(p) * EVOLVE_POINTS;
        return { ...p, evolvePoints: applyEvolvePoint(p.evolvePoints ?? {}, attr, delta, unlockedPoints) };
      });
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
      emitReadyState(io, room);
    });
    on("reset_evolve_points", ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      player.team.players = player.team.players.map(p => p.id === playerId ? { ...p, evolvePoints: {} } : p);
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
      emitReadyState(io, room);
    });

    // ============================================================
    // SHOP — spend points (earned per league match) on this player's own team.
    // Server is authoritative: it validates the cost, mutates the player's team and
    // re-broadcasts. The local client then sees the change + new balance via room_updated.
    // ============================================================
    on("shop_change_coach", ({ roomCode, coachId }: { roomCode: string; coachId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      if (!isValidId(coachId) || !VALID_COACH_IDS.has(coachId)) return;
      const cost = SHOP_COSTS.changeCoach;
      if (player.points < cost || player.team.coachId === coachId) return;
      player.points -= cost;
      player.coachId = coachId;
      player.team.coachId = coachId;
      player.team = rebuildTeamChemistry(player.team);
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
      emitReadyState(io, room);
    });

    on("evolve_coach_prime", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team || player.coachPrime) return;
      const wins = room.leagueStandings.find(s => s.teamId === player.team!.id)?.won ?? 0;
      if (!canEvolvePrime(wins, player.points)) return;
      player.points -= PRIME_COST;
      player.coachPrime = true;
      player.team.coachPrime = true;
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
      emitReadyState(io, room);
    });

    // ⭐ Pacote Único — cobra na abertura, sorteia no servidor e guarda o resultado
    // até o jogador concluir a animação. O cliente nunca escolhe a carta.
    on("shop_open_unique_pack", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team || player.pendingUniquePack || player.pendingPack) return;
      if (room.phase !== 'league' && room.phase !== 'knockout') return;
      ensureUniquePackOffer(room, player);
      const cost = SHOP_COSTS.uniqueCard;
      if (player.points < cost) {
        socket.emit("action_error", { event: "shop_open_unique_pack", message: `Saldo insuficiente: você tem ${player.points} pontos e precisa de ${cost}.` });
        // A rejected purchase is also a recovery point. This corrects a stale
        // balance on the browser without changing any authoritative progress.
        emitRoomSnapshot(socket, room);
        return;
      }
      const chosen = drawUniquePackCard(
        player.uniquePackOfferIds ?? [],
        player.team.players.map(p => p.id),
      );
      if (!chosen) {
        socket.emit("action_error", { event: "shop_open_unique_pack", message: "Você já possui todas as Cartas Únicas desta oferta." });
        return;
      }
      player.points -= cost;
      player.pendingUniquePack = { ...chosen };
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
    });

    // ⭐ Revelar a carta já sorteada: valida novamente no catálogo autoritativo.
    on("shop_claim_unique_pack", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team || !player.pendingUniquePack) return;
      const pending = player.pendingUniquePack;
      const canonical = UNIQUE_CARDS.find(card => card.id === pending.id);
      if (!canonical || player.team.players.some(card => card.id === canonical.id)) {
        socket.emit("action_error", { event: "shop_claim_unique_pack", message: "Não foi possível adicionar esta Carta Única." });
        emitRoomUpdate(io, room, { onlySocketId: socket.id });
        return;
      }
      const card: PlayerCard = { ...canonical, chemistryScore: 0, isOOP: false };
      // Só consumimos o pacote depois que a carta passou pela validação final.
      // Assim, um estado inconsistente não faz o jogador perder uma compra já paga.
      player.pendingUniquePack = null;
      player.team.players = [...player.team.players, card];
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
      emitReadyState(io, room);
    });

    // 🛒 Abrir pacote (Craque/Caça-Talentos): COBRA aqui e guarda as opções → impede re-sortear de graça.
    // The server rolls from its own catalog. The client sends only the scout position;
    // client-provided card objects/options are deliberately ignored.
    on("shop_open_pack", ({ roomCode, kind, position }: { roomCode: string; kind: 'star' | 'scout'; position?: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team || player.pendingPack) return;              // um pacote pendente por vez
      if (kind !== 'star' && kind !== 'scout') return;
      if (kind === 'scout' && (!isValidId(position) || !VALID_POSITION_IDS.has(position))) return;
      const ownedIds = player.team.players.map(p => p.id);
      const options = kind === 'star'
        ? generateStarPackOptions(ownedIds)
        : generateScoutOptions(position!, ownedIds);
      if (options.length === 0 || options.some(option => !PLAYERS.some(base => base.id === option.id))) return;
      const cost = kind === 'star' ? SHOP_COSTS.starPack : SHOP_COSTS.scout;
      if (player.points < cost) return;
      if (kind === 'star' && options.some(o => o.overall < 88)) return;       // pacote do craque = 88+
      player.points -= cost;
      player.pendingPack = { kind, options: options.map(option => ({ ...option })) };
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
    });

    // 🛒 Escolher 1 do pacote JÁ PAGO (sem cobrar de novo) → banco.
    on("shop_pick_pack", ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team || !player.pendingPack || !isValidId(playerId)) return;
      const valid = player.pendingPack.options.some(o => o.id === playerId)
        && !player.team.players.some(p => p.id === playerId);
      const chosen = PLAYERS.find(p => p.id === playerId);
      // A stale tab or a malformed request must never consume a pack that was
      // already paid for. Keep it pending so the player can reconnect and pick
      // again from the authoritative offer.
      if (!valid || !chosen) {
        socket.emit("action_error", { event: "shop_pick_pack", message: "Essa opção não está mais disponível. O pacote continua reservado para você." });
        emitRoomSnapshot(socket, room);
        return;
      }
      player.pendingPack = null;
      const card: PlayerCard = { ...chosen, chemistryScore: 0, isOOP: false };
      player.team.players = [...player.team.players, card];
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
      emitReadyState(io, room);
    });

    on("shop_turbinar", ({ roomCode, playerId, variant }: { roomCode: string; playerId: string; variant: ShopVariant }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      if (!isValidId(playerId) || !VALID_VARIANTS.has(variant)) return;
      const cost = SHOP_COSTS.turbinar;
      const target = player.team.players.find(p => p.id === playerId);
      if (!target || player.points < cost) return;
      if (!canAddVariant(target)) return; // 1 por carta (Únicas: até 2)
      // A característica usa o histórico da competição inteira, inclusive
      // partidas disputadas antes da compra no meio da temporada.
      const competitionStats = getPlayerSeasonStats(
        target.id,
        player.team.id,
        getAllPlayedMatchResults(room.leagueResults, room.knockoutBracket),
      );
      player.points -= cost;
      player.team.players = player.team.players.map(p =>
        p.id === playerId ? ({ ...applyShopVariant(p, variant, competitionStats), chemistryScore: p.chemistryScore, isOOP: p.isOOP } as PlayerCard) : p);
      player.team = rebuildTeamChemistry(player.team);
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
      emitReadyState(io, room);
    });

    // 🧹 Remove a card's characteristic (so a new one can be applied via Turbinar).
    on("shop_remove_variant", ({ roomCode, playerId, variantKey }: { roomCode: string; playerId: string; variantKey?: VariantFlag }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      if (!isValidId(playerId) || (variantKey != null && !VALID_VARIANTS.has(variantKey))) return;
      const cost = SHOP_COSTS.removeVariant;
      const target = player.team.players.find(p => p.id === playerId);
      if (!target || player.points < cost || !hasVariant(target)) return;
      player.points -= cost;
      player.team.players = player.team.players.map(p =>
        p.id === playerId ? ({ ...(variantKey ? stripSpecificVariant(p, variantKey) : stripVariant(p)), chemistryScore: p.chemistryScore, isOOP: p.isOOP } as PlayerCard) : p);
      player.team = rebuildTeamChemistry(player.team);
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
      emitReadyState(io, room);
    });

    // 🎯 PALPITE — apostar/editar. Escrow debitado na hora; validado no servidor (fundos, teto,
    // fase, e a partida-alvo ainda não jogada). Só o autor recebe o room_updated (não vaza).
    on("place_bet", ({ roomCode, matchKey, homeTeamId, awayTeamId, homeGoals, awayGoals, stake, market, selections }: {
      roomCode: string;
      matchKey: string;
      homeTeamId?: string;
      awayTeamId?: string;
      homeGoals?: number;
      awayGoals?: number;
      stake: number;
      market?: BetMarket;
      selections?: unknown;
    }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.connected) return;
      if (typeof matchKey !== 'string' || matchKey.length === 0 || matchKey.length > 160
        || !Number.isSafeInteger(stake) || stake <= 0) return;

      // A partida-alvo tem que existir, ser da rodada/perna ativa e ainda NÃO ter sido jogada.
      let prefix: string;
      let actualHomeTeamId: string | undefined;
      let actualAwayTeamId: string | undefined;
      if (room.phase === 'league') {
        const fx = room.leagueFixtures.find(f => buildLeagueMatchKey(f.round, f.homeTeamId, f.awayTeamId) === matchKey);
        if (!fx || fx.round !== room.leagueRound || fx.played) return;
        prefix = `L${room.leagueRound}:`;
        actualHomeTeamId = fx.homeTeamId;
        actualAwayTeamId = fx.awayTeamId;
      } else if (room.phase === 'knockout' && room.knockoutBracket) {
        const leg = room.knockoutBracket.currentLeg;
        const active = getActiveKnockoutMatches(room.knockoutBracket) as any[];
        const tie = active.find(m => buildKnockoutMatchKey(m.id, leg) === matchKey);
        const legPlayed = tie && (leg === 2 ? !!tie.leg2 : !!(tie.leg1 || tie.result));
        if (!tie || legPlayed) return;
        prefix = matchKey; // por jogo: teto próprio de cada partida (ida/volta independentes)
        actualHomeTeamId = leg === 2 ? tie.awayTeamId : tie.homeTeamId;
        actualAwayTeamId = leg === 2 ? tie.homeTeamId : tie.awayTeamId;
      } else {
        return;
      }

      // The client sends the IDs that label the score selectors. Validate them
      // against the authoritative fixture and always store the server's order;
      // this makes a return-leg bet immune to home/away inversion or stale UI.
      if ((homeTeamId != null && homeTeamId !== actualHomeTeamId)
        || (awayTeamId != null && awayTeamId !== actualAwayTeamId)) return;

      const existing = player.bets.find(b => b.matchKey === matchKey);
      if (existing?.settled) return;
      const escrowDelta = stake - (existing?.stake ?? 0);
      if (escrowDelta > player.points) return;
      const betCap = room.competitionFormat.matchSettings?.betRoundCap ?? BET_ROUND_CAP;
      if (!canPlaceStake(player.bets, prefix, matchKey, stake, betCap)) return;
      // A disciplina da competição é a fonte de verdade para os mercados de
      // cartões. Revalidar no servidor impede que um cliente alterado crie uma
      // aposta que a partida não tem como liquidar.
      if (market === 'builder'
        && room.competitionFormat.matchSettings?.cardsEnabled === false
        && builderUsesTotalCards(selections)) return;
      // The canonical builder parser also calculates and locks its multiplier.
      // The client never gets to choose odds or bypass the minimum/unique-market rules.
      const bet = createBet({
        matchKey,
        homeTeamId: actualHomeTeamId,
        awayTeamId: actualAwayTeamId,
        homeGoals,
        awayGoals,
        stake,
        market,
        selections,
      });
      if (!bet) return;
      player.bets = existing ? player.bets.map(b => b.matchKey === matchKey ? bet : b) : [...player.bets, bet];
      player.points -= escrowDelta;
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
    });

    on("cancel_bet", ({ roomCode, matchKey }: { roomCode: string; matchKey: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;
      const existing = player.bets.find(b => b.matchKey === matchKey);
      if (!existing || existing.settled) return;
      player.points += existing.stake;
      player.bets = player.bets.filter(b => b.matchKey !== matchKey);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
    });

    // 🏥 Fisioterapia — reduz 1 jogo de lesão de um jogador do time do autor (paga PHYSIO_COST).
    on("heal_injury", ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team || !isValidId(playerId) || player.points < SHOP_COSTS.physio) return;
      const key = `${player.team.id}:${playerId}`;
      if (!room.discipline[key] || room.discipline[key].injured <= 0) return;
      player.points -= SHOP_COSTS.physio;
      room.discipline = healInjury(room.discipline, player.team.id, playerId);
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
      emitReadyState(io, room);
    });

    on("shop_train", ({ roomCode, playerId, attr }: { roomCode: string; playerId: string; attr: TrainAttr }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      if (!isValidId(playerId) || !VALID_TRAIN_ATTRS.has(attr)) return;
      const target = player.team.players.find(p => p.id === playerId);
      if (!target) return;
      const cost = trainCost(target.trainCount ?? 0);
      if (player.points < cost) return;
      player.points -= cost;
      player.team.players = player.team.players.map(p => {
        if (p.id !== playerId) return p;
        const boosts = { ...(p.trainBoosts ?? {}) };
        boosts[attr] = (boosts[attr] ?? 0) + TRAIN_BOOST;
        return { ...p, trainBoosts: boosts, trainCount: (p.trainCount ?? 0) + 1 };
      });
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
      emitReadyState(io, room);
    });

    // 🔄 Buy a reinforcement re-roll token (unlimited; persists across rounds).
    on("shop_buy_reroll", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || player.points < SHOP_COSTS.reroll) return;
      player.points -= SHOP_COSTS.reroll;
      player.reinforcementRerolls += 1;
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
    });

    // 🏪 Mercado — VENDER uma reserva PRA BANCA por valor fixo (igual o solo). Só pontos + banco mudam.
    on("market_sell", ({ roomCode, playerId }: { roomCode: string; playerId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;
      const idx = player.team.players.findIndex(p => p.id === playerId);
      if (idx < 11) return; // só reserva (índice ≥ 11)
      const sold = player.team.players[idx];
      player.team.players = player.team.players.filter((_, i) => i !== idx);
      delete room.discipline[`${player.team.id}:${playerId}`];
      player.points += sellValue(sold.rarity);
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room);
    });

    // 🏪 Mercado online — ANUNCIAR uma reserva (escrow: sai do banco do vendedor).
    on("market_list", ({ roomCode, playerId, price }: { roomCode: string; playerId: string; price: number }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const seller = room.players.find(p => p.socketId === socket.id);
      if (!seller || !seller.team) return;
      const idx = seller.team.players.findIndex(p => p.id === playerId);
      if (idx < 11) return; // só reserva (índice ≥ 11); -1 ou titular bloqueia
      const player = seller.team.players[idx];
      if (!Number.isSafeInteger(price) || price < marketMinPrice(player)) return;
      // escrow: tira do elenco e limpa a disciplina do jogador
      seller.team.players = seller.team.players.filter((_, i) => i !== idx);
      delete room.discipline[`${seller.team.id}:${playerId}`];
      room.market.push({ id: `m${++marketSeq}`, sellerId: seller.id, sellerName: seller.name, player, price });
      invalidateReady(room, seller.id);
      emitRoomUpdate(io, room);
    });

    // 🏪 Mercado online — CANCELAR um anúncio (devolve o jogador pro banco do vendedor).
    on("market_cancel", ({ roomCode, listingId }: { roomCode: string; listingId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const seller = room.players.find(p => p.socketId === socket.id);
      const li = room.market.find(l => l.id === listingId);
      if (!seller || !seller.team || !li || li.sellerId !== seller.id) return;
      seller.team.players.push({ ...li.player, chemistryScore: 0, isOOP: false } as PlayerCard);
      room.market = room.market.filter(l => l.id !== listingId);
      invalidateReady(room, seller.id);
      emitRoomUpdate(io, room);
    });

    // 🏪 Mercado online — COMPRAR um anúncio (transfere jogador + pontos, atômico).
    on("market_buy", ({ roomCode, listingId }: { roomCode: string; listingId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const buyer = room.players.find(p => p.socketId === socket.id);
      const li = room.market.find(l => l.id === listingId);
      if (!buyer || !buyer.team || !li) return;
      if (buyer.id === li.sellerId) return;                                  // não compra o próprio
      if (buyer.points < li.price) return;                                   // sem saldo
      if (buyer.team.players.some(p => p.id === li.player.id)) return;       // já tem o jogador
      const seller = room.players.find(p => p.id === li.sellerId);
      if (!seller) return;                                                   // vendedor saiu da sala → aborta (não some pontos)
      buyer.points -= li.price;
      seller.points += li.price;
      buyer.team.players.push({ ...li.player, chemistryScore: 0, isOOP: false } as PlayerCard);
      room.market = room.market.filter(l => l.id !== listingId);
      invalidateReady(room, buyer.id);
      emitRoomUpdate(io, room);
    });

    // 🔄 Spend a token to re-roll THIS player's reinforcement options.
    on("reroll_reinforcement", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      if (!isShopPhase(room)) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team || player.reinforcementRerolls <= 0 || !player.reinforcementOptions) return;
      player.reinforcementRerolls -= 1;
      const ownedIds = player.team.players.map(p => p.id);
      player.reinforcementOptions = generateDraftOptions([], ownedIds).slice(0, room.competitionFormat.rewards.reinforcementOptions);
      emitRoomUpdate(io, room, { onlySocketId: socket.id });
    });

    // End-of-round reinforcement (free pick, same as solo): 1 of 6 → bench.
    on("pick_reinforcement", ({ roomCode, player: chosen }: { roomCode: string; player: Player }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team || !chosen) return;
      // The client sends the selected id for convenience, but never gets to
      // submit the card's stats/traits. Rebuild it from the server catalog.
      const offered = player.reinforcementOptions?.find(o => o.id === chosen.id);
      const canonical = offered && PLAYERS.find(option => option.id === offered.id);
      if (!canonical || player.team.players.some(p => p.id === canonical.id)) {
        socket.emit("action_error", { event: "pick_reinforcement", message: "Essa carta não está mais disponível. Sua escolha continua reservada." });
        emitRoomSnapshot(socket, room);
        return;
      }
      const card: PlayerCard = { ...canonical, chemistryScore: 0, isOOP: false };
      player.team.players = [...player.team.players, card];
      invalidateReady(room, player.id);
      player.reinforcementOptions = null;
      emitRoomUpdate(io, room, { onlySocketId: socket.id }); // only this player's own bench changed
    });

    on("dismiss_reinforcement", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;
      player.reinforcementOptions = null;
      emitRoomUpdate(io, room, { onlySocketId: socket.id }); // only this player's own state changed
    });

    // 🆘 Contratação emergencial — quando não há reserva disponível para cobrir uma
    // vaga titular indisponível, oferece uma carta prata/bronze gratuita. A decisão
    // é validada no servidor e a escalação pronta anterior é invalidada.
    on("emergency_replace_player", ({ roomCode, starterId, playerId }: { roomCode: string; starterId: string; playerId: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.team) return;

      const target = getEmergencyReplacementTarget(player.team, room.discipline);
      const chosen = PLAYERS.find(p => p.id === playerId);
      if (!target || target.starterId !== starterId || !chosen || !target.options.some(option => option.id === chosen.id)) {
        socket.emit("action_error", { event: "emergency_replace_player", message: "Essa contratação emergencial não está disponível." });
        return;
      }

      const updatedTeam = applyEmergencyReplacement(player.team, room.discipline, starterId, chosen);
      if (!updatedTeam) {
        socket.emit("action_error", { event: "emergency_replace_player", message: "Não foi possível atualizar a escalação." });
        return;
      }

      player.team = updatedTeam;
      invalidateReady(room, player.id);
      emitRoomUpdate(io, room);
    });

    // ============================================================
    // LEAGUE — server-authoritative, host-driven round progression
    // ============================================================

    // Host triggers the whole round: the SERVER simulates every fixture of the
    // current round at once (single source of truth) so the scores/data are
    // identical on every device. Each human then watches their own match as a
    // deterministic replay of the result the server produced here.
    // ✅ "Estou pronto" — só um participante humano conectado da rodada/perna atual
    // pode confirmar, e a escalação precisa estar válida.
    on("player_ready", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.connected || !player.team) return;
      if (room.phase !== 'league' && room.phase !== 'knockout') return;
      const participantIds = room.phase === 'league' ? leagueParticipantIds(room) : knockoutParticipantIds(room);
      pruneReadyPlayers(room, participantIds);
      if (!participantIds.includes(player.id)) return;
      const bad = unavailableStarters(player.team, room.discipline);
      if (bad.length > 0) { socket.emit("ready_blocked", { players: bad.map((u: any) => u.shortName) }); return; }
      if (!room.readyPlayers.includes(player.id)) room.readyPlayers.push(player.id);
      emitRoomUpdate(io, room); // todos veem a contagem
    });
    on("player_unready", ({ roomCode }: { roomCode: string }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;
      room.readyPlayers = room.readyPlayers.filter(id => id !== player.id);
      emitRoomUpdate(io, room);
    });

    on("play_round", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || room.phase !== 'league') return;
      if (!isHost(room, socket.id)) return;

      // ✅ Apenas humanos conectados com partida na rodada entram no ready-check.
      const participantIds = leagueParticipantIds(room);
      pruneReadyPlayers(room, participantIds);
      if (!participantIds.every(id => room.readyPlayers.includes(id))) return; // ainda faltam prontos

      syncAllTeamCredits(room);
      const allHumanTeams = room.players.map(p => p.team!).filter(Boolean);
      const allTeams = [...allHumanTeams, ...room.botTeams];

      let simulatedAny = false;
      room.leagueFixtures = room.leagueFixtures.map(f => {
        if (f.round === room.leagueRound && !f.played) {
          const home = allTeams.find(t => t.id === f.homeTeamId);
          const away = allTeams.find(t => t.id === f.awayTeamId);
          if (!home || !away) return f;
          // 🟨🟥🩹 Bots resolvem a escalação (humanos já estão válidos pelo bloqueio acima).
          // Capture the XI before the authoritative result is stored. The replay
          // may happen later, after the user has edited the squad again.
          const resolvedHome = resolveAvailableLineup(home, room.discipline).team;
          const resolvedAway = resolveAvailableLineup(away, room.discipline).team;
          const result = simulateMatch(
            resolvedHome,
            resolvedAway,
            false,
            false,
            true,
            false,
            room.competitionFormat.matchSettings,
          );
          const authoritativeResult = stampMatchStartingLineups(result, resolvedHome, resolvedAway);
          room.leagueResults.push(authoritativeResult);
          simulatedAny = true;
          return { ...f, played: true, result: authoritativeResult };
        }
        return f;
      });

      if (simulatedAny) {
        // 🟨🟥🩹 Aplica a disciplina da rodada (todos os times que jogaram).
        const roundFx = room.leagueFixtures.filter(f => f.round === room.leagueRound && f.result);
        const roundTeamIds = Array.from(new Set(roundFx.flatMap(f => [f.homeTeamId, f.awayTeamId])));
        const nameOf = (teamId: string, playerId: string) => allTeams.find(t => t.id === teamId)?.players.find(p => p.id === playerId)?.shortName ?? '?';
        room.discipline = applyMatchDiscipline(room.discipline, roundTeamIds, roundFx.map(f => f.result!), nameOf).next;

        room.leagueStandings = computeStandings(allTeams, room.leagueFixtures.filter(f => f.played));
        // Reset watch confirmations so the new round requires fresh confirmation
        room.watchedRoundPlayers = [];
        room.watchedLeagueRound = room.leagueRound;
        room.readyPlayers = []; // ✅ próxima rodada exige "prontos" de novo
        // Award shop points + offer the end-of-round reinforcement to each human (same as solo).
        room.players.forEach(p => {
          if (!p.team) return;
          const fixture = room.leagueFixtures.find(f =>
            f.round === room.leagueRound && f.result &&
            (f.homeTeamId === p.team!.id || f.awayTeamId === p.team!.id));
          if (fixture?.result) {
            // ⭐ +1 jogo pros 11 titulares deste jogador (progresso pra Carta Evoluída).
            p.team = bumpStarterAppearances(
              applyMatchStatGrowth(
                applyDefeatGrowth(p.team, fixture.result),
                fixture.result,
                buildLeagueMatchKey(fixture.round, fixture.homeTeamId, fixture.awayTeamId),
              ),
              startingIdsForResult(fixture.result, p.team.id, p.team),
              buildLeagueMatchKey(fixture.round, fixture.homeTeamId, fixture.awayTeamId),
            );
            const rewards = room.competitionFormat.rewards;
            const mp = computeMatchPointsWithConfig(fixture.result, p.team.id, rewards.points);
            // 🤑 Magnata — titular multiplica os pontos da partida de liga (não empilha).
            const magMult = magnataPointMultiplier(p.team.players);
            const earned = rewards.pointsEnabled ? Math.round(mp.total * magMult) : 0;
            // FIX anti-spoiler: NÃO credita agora; guarda como pendente até a revelação.
            p.pendingMatchPoints = rewards.pointsEnabled ? earned : undefined;
            p.lastMatchPoints = rewards.pointsEnabled ? (magMult > 1 ? { ...mp, total: earned } : mp) : null; // resumo do PRÓPRIO jogo (não é spoiler)
          }
          // 🎯 Liquida (sem creditar) os palpites da rodada deste jogador.
          const betPrefix = `L${room.leagueRound}:`;
          p.bets = p.bets.map(b => {
            if (b.revealed || b.settled || !b.matchKey.startsWith(betPrefix)) return b;
            const bfx = room.leagueFixtures.find(f => buildLeagueMatchKey(f.round, f.homeTeamId, f.awayTeamId) === b.matchKey);
            if (!bfx?.result) return b;
            const r = settleBet(b, bfx.result);
            return { ...b, settled: true, won: r.won, tier: r.tier, payout: r.payout };
          });
          const rewards = room.competitionFormat.rewards;
          const stageRounds = room.competitionFormat.id === 'groups_knockout' ? room.competitionFormat.groupRounds : room.competitionFormat.leagueRounds;
          const shouldOfferReinforcement = rewards.reinforcement !== 'off'
            && (rewards.reinforcementUntilRound === null || room.leagueRound <= rewards.reinforcementUntilRound)
            && (rewards.reinforcement === 'round' || room.leagueRound === stageRounds);
          // If a player disconnected after a previous offer was created, settle
          // that offer before materializing the next round's reward.
          autoPickOfflineReinforcement(p);
          const ownedIds = p.team.players.map(pl => pl.id);
          p.reinforcementOptions = shouldOfferReinforcement
            ? generateDraftOptions([], ownedIds).slice(0, rewards.reinforcementOptions)
            : null;
          autoPickOfflineReinforcement(p);
        });

        // 🔥 Resiliente também cresce nas equipes controladas pelo servidor, sempre que
        // a carta esteve no XI. A derrota de cada rodada é processada uma única vez aqui.
        room.botTeams = room.botTeams.map(team => {
          const fixture = roundFx.find(f => f.homeTeamId === team.id || f.awayTeamId === team.id);
          if (!fixture?.result) return team;
          return applyMatchStatGrowth(
            applyDefeatGrowth(team, fixture.result),
            fixture.result,
            buildLeagueMatchKey(fixture.round, fixture.homeTeamId, fixture.awayTeamId),
          );
        });
      }

      emitRoomUpdate(io, room);
    });

    // Host advances to the next round (or to the knockout) — only allowed once
    // the entire current round has been played.
    on("advance_round", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || room.phase !== 'league') return;
      if (!isHost(room, socket.id)) return;

      const roundFixtures = room.leagueFixtures.filter(f => f.round === room.leagueRound);
      const allPlayed = roundFixtures.length > 0 && roundFixtures.every(f => f.played);
      if (!allPlayed) return;

      // Block advancement until every CONNECTED human with a match this round has watched
      // (a player who left/disconnected must not freeze the host).
      const playersWithFixture = getOnlineLeagueParticipantIds(room.players, roundFixtures, room.leagueRound);
      const allWatched = playersWithFixture.every(id => room.watchedRoundPlayers.includes(id));
      if (!allWatched) {
        const waiting = room.players
          .filter(p => playersWithFixture.includes(p.id) && !room.watchedRoundPlayers.includes(p.id))
          .map(p => p.name);
        socket.emit("advance_blocked", { waiting });
        return;
      }

      const stageRounds = room.competitionFormat.id === 'groups_knockout' ? room.competitionFormat.groupRounds : room.competitionFormat.leagueRounds;
      if (room.leagueRound < stageRounds) {
        room.leagueRound += 1;
      } else if (room.competitionFormat.id === 'league') {
        room.phase = 'report';
        room.champion = room.leagueStandings[0]?.teamId ?? null;
      } else {
        // End of league phase! Build the full UCL knockout bracket
        // (play-offs → R16 → quarters → semis → final).
        room.phase = 'knockout';
        const allTeams = [...room.players.map(p => p.team!).filter(Boolean), ...room.botTeams];
        const bracketStandings = room.competitionFormat.id === 'groups_knockout'
          ? computeGroupQualifiedStandings(allTeams, room.leagueFixtures, room.competitionFormat)
          : room.leagueStandings;
        room.knockoutBracket = createKnockoutBracket(bracketStandings, room.competitionFormat);
        room.watchedRoundPlayers = [];
        room.watchedLeagueRound = null;
        room.watchedKnockoutLegPlayers = [];
        room.watchedKnockoutLegKey = null;
        room.discipline = resetYellowsForKnockout(room.discipline); // 🟨 amarelos zeram no mata-mata
      }

      emitRoomUpdate(io, room);
    });

    // ============================================================
    // KNOCKOUT — server-authoritative, host-driven round progression
    // ============================================================

    // Host triggers the whole knockout round: the SERVER simulates every match
    // of the active bracket round. The bracket does NOT progress yet so that
    // each human can watch their tie before the next round is drawn.
    on("play_knockout_round", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || room.phase !== 'knockout' || !room.knockoutBracket) return;
      if (!isHost(room, socket.id)) return;
      // Once a leg has been simulated, a repeated click must not reset the
      // watch/readiness window or manufacture a second transition.
      if (knockoutLegAlreadyPlayed(room)) return;

      // About to play the SECOND leg (volta)? Gate it just like advancing: every
      // human must have watched the FIRST leg (ida) first. Without this the host
      // could fire the volta immediately, spoiling the ida score for everyone.
      if (room.knockoutBracket.currentLeg === 2) {
        const { allWatched, waiting } = knockoutWatchStatus(room);
        if (!allWatched) {
          socket.emit("advance_blocked", { waiting });
          return;
        }
      }

      // ✅ Ready-check do mata-mata: apenas humanos conectados em confronto ativo.
      const participantIds = knockoutParticipantIds(room);
      pruneReadyPlayers(room, participantIds);
      if (!participantIds.every(id => room.readyPlayers.includes(id))) return;

      syncAllTeamCredits(room);
      const allHumanTeams = room.players.map(p => p.team!).filter(Boolean);
      const allTeams = [...allHumanTeams, ...room.botTeams];
      const resolvedTeams = new Map<string, Team>();
      // 🟨🟥🩹 Resolve as escalações contra a disciplina antes de simular a perna (bots inclusos).
      const resolve = (id: string) => {
        const cached = resolvedTeams.get(id);
        if (cached) return cached;
        const t = allTeams.find(tm => tm.id === id);
        if (!t) return undefined;
        const resolved = resolveAvailableLineup(t, room.discipline).team;
        resolvedTeams.set(id, resolved);
        return resolved;
      };

      // Which leg is being played now (playActiveKnockoutLeg may bump currentLeg 1→2 afterwards).
      const isFinalRound = room.knockoutBracket.currentRound === 'final';
      const legPlayed = room.knockoutBracket.currentLeg;

      // Plays the current leg (ida or volta) of every tie in the active round.
      // Knockout results live in the bracket only — they are NOT pushed into
      // leagueResults (season stats read the legs directly from the bracket).
      playActiveKnockoutLeg(room.knockoutBracket, resolve as any, room.competitionFormat.matchSettings);
      // Reset watch confirmations for this new leg
      room.watchedKnockoutLegPlayers = [];
      room.watchedKnockoutLegKey = { round: room.knockoutBracket.currentRound, leg: legPlayed };
      room.readyPlayers = []; // ✅ próxima perna/rodada exige "prontos" de novo

      // 🟨🟥🩹 Aplica a disciplina da PERNA recém-jogada.
      {
        const active = getActiveKnockoutMatches(room.knockoutBracket) as any[];
        const legResults = active.map((tie: any) => {
          const singleLeg = tie.isSingleLeg === true || (isFinalRound && tie.isSingleLeg === undefined);
          const result = singleLeg ? tie.result : legPlayed === 2 ? tie.leg2 : tie.leg1;
          if (!result) return null;
          const stamped = stampMatchStartingLineups(
            result,
            resolvedTeams.get(result.homeTeamId) ?? allTeams.find(team => team.id === result.homeTeamId) ?? { players: [] },
            resolvedTeams.get(result.awayTeamId) ?? allTeams.find(team => team.id === result.awayTeamId) ?? { players: [] },
          );
          if (singleLeg) tie.result = stamped;
          else if (legPlayed === 2) tie.leg2 = stamped;
          else tie.leg1 = stamped;
          return stamped;
        }).filter((result): result is MatchResult => Boolean(result));
        const koTeamIds = Array.from(new Set(active.flatMap((t: any) => [t.homeTeamId, t.awayTeamId]))) as string[];
        const nameOf = (teamId: string, playerId: string) => allTeams.find(t => t.id === teamId)?.players.find(p => p.id === playerId)?.shortName ?? '?';
        room.discipline = applyMatchDiscipline(room.discipline, koTeamIds, legResults, nameOf).next;
        // ⭐ +1 jogo pros 11 titulares de cada humano que disputou esta perna (Carta Evoluída).
        const playedIds = new Set(koTeamIds);
        const resultFor = (teamId: string) => legResults.find((result: MatchResult) =>
          result.homeTeamId === teamId || result.awayTeamId === teamId);
        room.players.forEach(p => {
          if (!p.team || !playedIds.has(p.team.id)) return;
          const result = resultFor(p.team.id);
          if (!result) return;
          const tie = active.find((candidate: any) => candidate.homeTeamId === p.team!.id || candidate.awayTeamId === p.team!.id);
          const matchKey = tie ? buildKnockoutMatchKey(tie.id, legPlayed) : undefined;
          p.team = bumpStarterAppearances(
            applyMatchStatGrowth(applyDefeatGrowth(p.team, result), result, matchKey),
            startingIdsForResult(result, p.team.id, p.team),
            matchKey,
          );
        });
        room.botTeams = room.botTeams.map(team => {
          const result = resultFor(team.id);
          if (!result) return team;
          const tie = active.find((candidate: any) => candidate.homeTeamId === team.id || candidate.awayTeamId === team.id);
          const matchKey = tie ? buildKnockoutMatchKey(tie.id, legPlayed) : undefined;
          return applyMatchStatGrowth(applyDefeatGrowth(team, result), result, matchKey);
        });
      }

      // Award shop points for each human's OWN leg (ida & volta) — same as the league, but with
      // NO reinforcement (league-only) and NO points for the FINAL (season's over, nothing to spend).
      // FIX anti-spoiler: pontos vão pra pendingMatchPoints (creditados só quando todos assistirem).
      const ties = getActiveKnockoutMatches(room.knockoutBracket) as any[];
      if (!isFinalRound && room.competitionFormat.rewards.knockoutPointsEnabled) {
        room.players.forEach(p => {
          if (!p.team) return;
          const tie = ties.find((t: any) => t.homeTeamId === p.team!.id || t.awayTeamId === p.team!.id);
          if (!tie) return;
          const legRes = legPlayed === 1 ? tie.leg1 : tie.leg2;
          if (legRes) p.pendingMatchPoints = room.competitionFormat.rewards.pointsEnabled
            ? computeMatchPointsWithConfig(legRes, p.team.id, room.competitionFormat.rewards.points).total
            : undefined;
        });
      }

      // Presets may opt into a free reinforcement between completed knockout
      // stages. Never offer it between the two legs of the same tie.
      const stageNumber = room.competitionFormat.id === 'knockout'
        ? ({ round16: 1, quarters: 2, semis: 3, final: 4 } as Record<string, number>)[room.knockoutBracket.currentRound] ?? 1
        : ({ playoffs: 1, round16: 2, quarters: 3, semis: 4, final: 5 } as Record<string, number>)[room.knockoutBracket.currentRound] ?? 1;
      const koRewards = room.competitionFormat.rewards;
      const stageFinished = ties.length > 0 && ties.every((t: any) => t.played);
      const offerStageReinforcement = !isFinalRound && stageFinished
        && koRewards.reinforcement === 'stage'
        && (koRewards.reinforcementUntilRound === null || stageNumber <= koRewards.reinforcementUntilRound);
      room.players.forEach(p => {
        if (!p.team) return;
        autoPickOfflineReinforcement(p);
        if (offerStageReinforcement) {
          p.reinforcementOptions = generateDraftOptions([], p.team.players.map(pl => pl.id))
            .slice(0, koRewards.reinforcementOptions);
        }
        autoPickOfflineReinforcement(p);
      });

      // 🎯 Liquida (sem creditar) os palpites da perna recém-jogada de cada jogador.
      room.players.forEach(p => {
        p.bets = p.bets.map(b => {
          if (b.revealed || b.settled || !b.matchKey.startsWith('K')) return b;
          const [id, legStr] = b.matchKey.slice(1).split(':');
          if (Number(legStr) !== legPlayed) return b;
          const tie = ties.find((t: any) => t.id === id);
          const legRes = tie ? (legPlayed === 2 ? tie.leg2 : (tie.leg1 ?? tie.result)) : undefined;
          if (!legRes) return b;
          const r = settleBet(b, legRes);
          return { ...b, settled: true, won: r.won, tier: r.tier, payout: r.payout };
        });
      });

      emitRoomUpdate(io, room);
    });

    // Host advances the bracket — only once the active round has been played.
    on("advance_knockout_round", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || room.phase !== 'knockout' || !room.knockoutBracket) return;
      if (!isHost(room, socket.id)) return;

      // Block until all human players who are in the current knockout round have
      // confirmed watching the leg just played (the volta).
      const { allWatched, waiting } = knockoutWatchStatus(room);
      if (!allWatched) {
        socket.emit("advance_blocked", { waiting });
        return;
      }

      const champion = advanceKnockoutBracket(room.knockoutBracket);
      if (champion) {
        room.champion = champion;
        room.phase = 'report';
      }

      emitRoomUpdate(io, room);
    });

    // Player confirms they finished watching their match replay for the current round/leg.
    // The host cannot advance until all human players who have a match have confirmed.
    on("player_match_watched", ({ roomCode, type, matchId, leg, round }: {
      roomCode: string;
      type: 'league' | 'knockout';
      matchId?: string;
      leg?: number;
      round?: number;
    }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.connected) return;

      if (type === 'league') {
        if (room.phase !== 'league') return;
        if (round != null && room.watchedLeagueRound != null && round !== room.watchedLeagueRound) return;
        const participantIds = leagueParticipantIds(room);
        const fixture = room.leagueFixtures.find(f => f.round === room.leagueRound
          && (f.homeTeamId === player.id || f.awayTeamId === player.id));
        // A watch confirmation is accepted only for the participant's own,
        // already simulated fixture in the active round.
        if (!participantIds.includes(player.id) || !fixture?.played || !fixture.result) return;
        if (!room.watchedRoundPlayers.includes(player.id)) {
          room.watchedRoundPlayers.push(player.id);
        }
        creditLeagueRoundIfAllWatched(room); // 🎯 revela pontos+palpites quando todos assistiram
      } else if (type === 'knockout') {
        if (room.phase !== 'knockout' || !room.knockoutBracket) return;
        const activeTies = getActiveKnockoutMatches(room.knockoutBracket) as any[];
        const participantIds = knockoutParticipantIds(room);
        const tie = activeTies.find(m => matchId && m.id === matchId)
          ?? activeTies.find(m => m.homeTeamId === player.id || m.awayTeamId === player.id);
        const playerIsInTie = !!tie && (tie.homeTeamId === player.id || tie.awayTeamId === player.id);
        const expectedLeg = room.watchedKnockoutLegKey?.round === room.knockoutBracket.currentRound
          ? room.watchedKnockoutLegKey.leg
          : room.knockoutBracket.currentLeg === 2 && tie?.leg1 && !tie.leg2 ? 1 : room.knockoutBracket.currentLeg;
        const requestedLeg = leg === 1 || leg === 2 ? leg : expectedLeg;
        if (requestedLeg !== expectedLeg) return;
        const isPlayedLeg = tie && knockoutLegWasPlayed(
          tie,
          room.knockoutBracket.currentRound,
          room.knockoutBracket.currentLeg,
          requestedLeg,
        );
        if (!participantIds.includes(player.id) || !playerIsInTie || !isPlayedLeg) return;
        if (!room.watchedKnockoutLegPlayers.includes(player.id)) {
          room.watchedKnockoutLegPlayers.push(player.id);
        }
        creditKnockoutLegIfAllWatched(room);
      } else {
        return;
      }

      emitRoomUpdate(io, room);
    });

    // Restart game in room (host only — otherwise any player could wipe progress)
    on("restart_room", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || !isHost(room, socket.id)) return;

      clearDraftTurnTimer(roomCode);
      cancelRoomCleanup(roomCode);
      cancelHostGrace(roomCode);
      room.roomEpoch = Number.isSafeInteger(room.roomEpoch) && room.roomEpoch < Number.MAX_SAFE_INTEGER
        ? room.roomEpoch + 1
        : 1;
      room.phase = 'lobby';
      room.difficulty = 'gold';
      room.players.forEach(p => {
        p.coachId = 'guardiola';
        p.coachPrime = false;
        p.crestId = null;
        p.formationId = '4-3-3';
        p.draftedPlayers = Array(13).fill(undefined);
        p.vetoesLeft = 4;
        p.captain = null;
        p.penaltyTaker = null;
        p.freeKickTaker = null;
        p.playStyle = 'balanced';
        p.matchPlan = normalizeMatchPlan();
        p.team = null;
        p.ready = false;
        p.points = 0;
        p.lastMatchPoints = null;
        p.reinforcementOptions = null;
        p.reinforcementRerolls = 0;
        p.pendingPack = null;
        p.pendingUniquePack = null;
        p.uniquePackOfferIds = [];
        p.uniquePackOfferRoundKey = null;
        p.bets = [];
        p.pendingMatchPoints = undefined;
      });
      room.botTeams = [];
      room.leagueFixtures = [];
      room.leagueStandings = [];
      room.leagueResults = [];
      room.leagueRound = 1;
      room.knockoutBracket = null;
      room.champion = null;
      room.watchedRoundPlayers = [];
      room.watchedKnockoutLegPlayers = [];
      room.watchedLeagueRound = null;
      room.watchedKnockoutLegKey = null;
      room.readyPlayers = [];
      room.discipline = {};
      room.market = [];
      room.draftState = {
        round: 1,
        timerKey: 0,
        turnIndex: 0,
        draftOrder: [],
        alreadyDraftedIds: [],
        history: [],
        currentOptionsByPlayer: {}
      };
      // A restart begins a new authoritative match. Receipts from the previous
      // match must not be able to suppress a command in the new one.
      room.commandReceipts = [];
      room.lastCheckpoint = undefined;

      emitRoomUpdate(io, room);
    });

    // The current host may explicitly hand the role to another connected
    // player. This is separate from disconnect/leave failover so an active
    // competition keeps its progress and only the authority changes.
    on("transfer_host", ({ roomCode, targetPlayerId }) => {
      const room = rooms.get(roomCode);
      if (!room || !isHost(room, socket.id) || !isValidId(targetPlayerId)) return;

      const target = room.players.find(player => (
        player.id === targetPlayerId
        && player.id !== room.hostId
        && player.connected !== false
        && !!player.socketId
      ));
      if (!target) return;

      room.hostId = target.id;
      emitRoomUpdate(io, room);
    });

    // The host may remove another player without changing the competition
    // authority. In the lobby the seat is released; during a competition the
    // seat/team remains authoritative so the tournament does not reshuffle,
    // but the player is marked as kicked and cannot reconnect.
    on("remove_player", ({ roomCode, targetPlayerId }) => {
      const room = rooms.get(roomCode);
      if (!room || !isHost(room, socket.id) || !isValidId(targetPlayerId)) return;

      const targetIndex = room.players.findIndex(player => (
        player.id === targetPlayerId && player.id !== room.hostId && !player.kicked
      ));
      if (targetIndex < 0) return;

      const target = room.players[targetIndex];
      const targetSocket = target.socketId ? io.sockets.sockets.get(target.socketId) : undefined;
      const kickedClientIds = room.kickedClientIds ?? [];
      if (target.clientId && !kickedClientIds.includes(target.clientId)) {
        room.kickedClientIds = [...kickedClientIds, target.clientId].slice(-64);
      }

      targetSocket?.emit('room_kicked', {
        roomCode,
        message: 'Você foi removido da sala pelo anfitrião.',
      });
      targetSocket?.leave?.(roomCode);

      if (room.phase === 'lobby') {
        room.players.splice(targetIndex, 1);
        recomputeHost(room);
      } else {
        target.kicked = true;
        target.connected = false;
        target.socketId = '';
        invalidateReady(room, target.id);
        autoPickOfflineReinforcement(target);
      }

      emitRoomUpdate(io, room);
      console.log(`Player ${target.name} removido pelo anfitrião da sala ${room.code}`);
    });

    // Explicitly leaving is different from a transport drop: the player has
    // made a deliberate decision, so a host transfer must happen immediately.
    // During an active competition we keep the seat as disconnected, allowing
    // the same device to reconnect without losing its team or progress. In the
    // lobby the seat is released normally so another player can join.
    on("leave_room", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room) return;
      const idx = room.players.findIndex(player => player.socketId === socket.id);
      if (idx === -1) return;

      const player = room.players[idx];
      const wasHost = player.id === room.hostId;
      cancelHostGrace(roomCode);

      if (room.phase === 'lobby') {
        room.players.splice(idx, 1);
        if (room.players.length > 0) {
          if (wasHost) {
            room.hostId = room.players.find(candidate => candidate.connected)?.id ?? room.players[0].id;
          }
          recomputeHost(room);
          emitRoomUpdate(io, room);
        } else {
          cancelRoomCleanup(roomCode);
          clearDraftTurnTimer(roomCode);
          rooms.delete(roomCode);
        }
      } else {
        player.connected = false;
        invalidateReady(room, player.id);
        autoPickOfflineReinforcement(player);
        if (wasHost) {
          const replacement = room.players.find(candidate => candidate.connected && candidate.id !== player.id);
          if (replacement) room.hostId = replacement.id;
        }
        emitRoomUpdate(io, room);
        scheduleRoomCleanupIfEmpty(room);
      }

      socket.emit('room_left', {
        roomCode,
        message: 'Você saiu da sala.',
        hostTransferred: wasHost && room.players.some(candidate => candidate.id === room.hostId && candidate.id !== player.id),
      });
    });

    // Encerrar is destructive and therefore only available to the current host.
    // Notify everyone before removing the authoritative room so every client
    // clears its local session instead of trying to reconnect to stale state.
    on("close_room", ({ roomCode }) => {
      const room = rooms.get(roomCode);
      if (!room || !isHost(room, socket.id)) return;

      clearDraftTurnTimer(roomCode);
      cancelRoomCleanup(roomCode);
      cancelHostGrace(roomCode);
      io.to(roomCode).emit('room_closed', {
        roomCode,
        message: 'A sala foi encerrada pelo anfitrião.',
      });
      rooms.delete(roomCode);
      console.log(`Room ${roomCode} closed by host`);
    });

    // Disconnect (evento de ciclo de vida — fica no socket.on cru, fora do wrapper)
    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
      rateWindows.delete(socket.id);
      roomSyncSessions.delete(socket.id);
      // Find rooms where player was present
      rooms.forEach((room: RoomState, code: string) => {
        const idx = room.players.findIndex((p: RoomPlayer) => p.socketId === socket.id);
        if (idx === -1) return;
        console.log(`Player ${room.players[idx].name} disconnected from room ${code}`);

        if (room.phase === 'lobby') {
          // In the lobby we fully remove the player (the seat is freed).
          room.players.splice(idx, 1);
          if (room.players.length === 0) {
            cancelRoomCleanup(code);
            clearDraftTurnTimer(code);
            rooms.delete(code);
            console.log(`Room ${code} deleted (empty)`);
            return;
          }
          recomputeHost(room);
          bumpRoomRevision(room);
          emitRoomUpdate(io, room);
          return;
        }

        // Mid-game: keep the player (so they can reconnect) but mark them offline.
        // Host is STICKY (recomputeHost keeps it), so a transient drop won't hand the
        // role to someone else. If the player who dropped WAS the host, arm a grace
        // timer that transfers only if they never come back (real abandonment).
        const wasHost = room.players[idx].id === room.hostId;
        room.players[idx].connected = false;
        // Readiness belongs to the current connection/session and must be
        // confirmed again. Watch confirmations, however, are durable facts:
        // if the player already watched the exact current result, a transient
        // reconnect must not make the host wait for a replay that already happened.
        invalidateReady(room, room.players[idx].id);
        autoPickOfflineReinforcement(room.players[idx]);
        recomputeHost(room);
        bumpRoomRevision(room);
        emitRoomUpdate(io, room);
        if (wasHost) scheduleHostGraceTransfer(io, room);
        if (room.phase === 'draft') { autoPickDisconnected(io, room); scheduleDraftTurnTimer(io, room); }
        scheduleRoomCleanupIfEmpty(room);
      });
    });
  });
}
