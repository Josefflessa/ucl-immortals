/// <reference types="@cloudflare/workers-types" />

import {
  createGameRuntime,
  registerSocketHandlers,
  runGameTimer,
  runWithGameRuntime,
  type GameRuntime,
  type GameTimerKind,
  type GameTimerScheduler,
  type RoomState,
  type RuntimeMutation,
  roomMutationDigest,
} from './handlers.js';
import type { RealtimeEventHandler, RealtimeServer, RealtimeSocket } from './realtime.js';
import { cloneRoomJson } from '../shared/room-sync.js';
import {
  MAX_REALTIME_MESSAGE_BYTES,
  encodeRealtimeMessage,
  isValidRoomCode,
  parseRealtimeMessage,
} from '../shared/realtime-protocol.js';

interface Env {
  ASSETS: Fetcher;
  GAME_ROOM: DurableObjectNamespace;
  ROOM_DIRECTORY: DurableObjectNamespace;
}

interface RoomReservation {
  state: 'reserved' | 'claimed' | 'active';
  token: string;
  expiresAt?: number;
}

interface StoredGameRoom {
  /** Storage format version. Older records remain readable and are upgraded in memory. */
  schemaVersion?: 2;
  room: RoomState;
  marketSeq: number;
  savedRevision?: number;
  savedAt?: number;
  timers?: Array<[GameTimerKind, number]>;
}

interface DurableCheckpoint {
  room: StoredGameRoom | null;
  confirmReservation: boolean;
  reservationToken?: string;
}

/**
 * Match rooms contain the complete bot catalog, starting lineups and replay
 * data. Keeping that JSON as one uncompressed Durable Object value makes it
 * grow quickly as rounds are played. SQLite-backed objects allow a larger
 * value than the legacy KV backend, but the room should not depend on that
 * ceiling. The envelope also leaves old uncompressed records readable.
 */
interface CompressedStoredGameRoom {
  encoding: 'gzip-json-v1';
  payload: ArrayBuffer;
}

interface ChunkedStoredGameRoomManifest {
  encoding: 'gzip-json-chunked-v1';
  chunkCount: number;
  payloadBytes: number;
}

interface SocketAttachment {
  socketId: string;
  /** Durable Object identity, retained even before a player joins the game. */
  roomCode?: string;
  /** Socket.IO-style room membership; absent until join_room/create_room succeeds. */
  joinedRoomCode?: string;
  /** Restores the incremental sync capability after Durable Object hibernation. */
  supportsPatches?: boolean;
}

interface DurableTransactionSnapshot {
  roomPresent: boolean;
  room: RoomState | null;
  marketSeq: number;
  syncSessions: Array<[string, { snapshot: unknown | null; revision: number; supportsPatches: boolean }]>;
  timers: Array<[GameTimerKind, number]>;
}

const ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RESERVATION_TTL_MS = 10 * 60 * 1000;
const CLAIM_TTL_MS = 2 * 60 * 1000;
const MAX_PERSISTED_COMMAND_RECEIPTS = 256;
const GAME_STORAGE_KEY = 'game';
const GAME_MANIFEST_STORAGE_KEY = 'game:manifest';
const GAME_CHUNK_STORAGE_PREFIX = 'game:chunk:';
// Stay below both the current SQLite value ceiling and legacy KV-backed rooms.
// A round with a large replay history therefore becomes several durable values
// instead of one increasingly fragile blob.
const PERSISTED_GAME_CHUNK_BYTES = 96 * 1024;
const SLOW_REALTIME_OPERATION_MS = 250;
const SLOW_REALTIME_PERSIST_MS = 150;
const SLOW_REALTIME_QUEUE_WAIT_MS = 250;

function sameTimerEntries(
  left: Array<[GameTimerKind, number]>,
  right: Array<[GameTimerKind, number]>,
): boolean {
  if (left.length !== right.length) return false;
  const rightByKind = new Map(right);
  return left.every(([kind, at]) => rightByKind.get(kind) === at);
}

function isByteBuffer(value: unknown): value is ArrayBuffer | Uint8Array {
  return value instanceof ArrayBuffer || value instanceof Uint8Array;
}

function asArrayBuffer(value: unknown): ArrayBuffer | null {
  if (value instanceof ArrayBuffer) return value;
  if (value instanceof Uint8Array) return value.slice().buffer;
  return null;
}

function isCompressedStoredGameRoom(value: unknown): value is CompressedStoredGameRoom {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<CompressedStoredGameRoom>;
  return candidate.encoding === 'gzip-json-v1' && isByteBuffer(candidate.payload);
}

function isChunkedStoredGameRoomManifest(value: unknown): value is ChunkedStoredGameRoomManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Partial<ChunkedStoredGameRoomManifest>;
  const chunkCount = candidate.chunkCount;
  const payloadBytes = candidate.payloadBytes;
  return candidate.encoding === 'gzip-json-chunked-v1'
    && typeof chunkCount === 'number'
    && Number.isSafeInteger(chunkCount)
    && chunkCount > 0
    && chunkCount <= 100_000
    && typeof payloadBytes === 'number'
    && Number.isSafeInteger(payloadBytes)
    && payloadBytes > 0
    && payloadBytes <= chunkCount * PERSISTED_GAME_CHUNK_BYTES;
}

function gameChunkKey(index: number): string {
  return `${GAME_CHUNK_STORAGE_PREFIX}${index}`;
}

function splitGamePayload(payload: ArrayBuffer): ArrayBuffer[] {
  const chunks: ArrayBuffer[] = [];
  for (let offset = 0; offset < payload.byteLength; offset += PERSISTED_GAME_CHUNK_BYTES) {
    chunks.push(payload.slice(offset, Math.min(payload.byteLength, offset + PERSISTED_GAME_CHUNK_BYTES)));
  }
  return chunks;
}

function joinGamePayload(chunks: ArrayBuffer[], payloadBytes: number): ArrayBuffer {
  const payload = new Uint8Array(payloadBytes);
  let offset = 0;
  chunks.forEach(chunk => {
    payload.set(new Uint8Array(chunk), offset);
    offset += chunk.byteLength;
  });
  if (offset !== payloadBytes) throw new Error('Snapshot persistido incompleto.');
  return payload.buffer;
}

/** Compress the durable record without changing the gameplay schema. */
async function encodeStoredGameRoom(value: StoredGameRoom): Promise<CompressedStoredGameRoom> {
  const json = JSON.stringify(value);
  const source = new Blob([json]).stream();
  const compressed = source.pipeThrough(new CompressionStream('gzip'));
  return {
    encoding: 'gzip-json-v1',
    payload: await new Response(compressed).arrayBuffer(),
  };
}

/** Read both the current compressed format and records from older deployments. */
async function decodeStoredGameRoom(value: unknown): Promise<StoredGameRoom | null> {
  if (isCompressedStoredGameRoom(value)) {
    const source = new Blob([value.payload]).stream();
    const decompressed = source.pipeThrough(new DecompressionStream('gzip'));
    const json = await new Response(decompressed).text();
    return JSON.parse(json) as StoredGameRoom;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as StoredGameRoom;
}

function isPersistedRoom(value: unknown): value is RoomState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const room = value as Partial<RoomState>;
  return isValidRoomCode(room.code)
    && Number.isSafeInteger(room.stateRevision)
    && (room.stateRevision as number) >= 0
    && typeof room.phase === 'string'
    && ['lobby', 'setup', 'draft', 'squad_review', 'league', 'knockout', 'report'].includes(room.phase)
    && Array.isArray(room.players)
    && Array.isArray(room.botTeams)
    && Array.isArray(room.leagueFixtures)
    && Array.isArray(room.leagueStandings)
    && Array.isArray(room.leagueResults)
    && Array.isArray(room.readyPlayers)
    && room.draftState !== null
    && typeof room.draftState === 'object';
}

function generateRoomCode(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
}

function isWebSocketUpgrade(request: Request): boolean {
  return request.headers.get('Upgrade')?.toLowerCase() === 'websocket';
}

/**
 * Tiny index used only to reserve human-friendly four-letter room codes.
 * Game state never passes through this object; each live match is isolated in
 * its own GameRoom Durable Object.
 */
export class RoomDirectory {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });

    if (url.pathname === '/reserve') {
      for (let attempt = 0; attempt < 64; attempt += 1) {
        const roomCode = generateRoomCode();
        const key = `room:${roomCode}`;
        const existing = await this.state.storage.get<RoomReservation>(key);
        if (existing?.state === 'active') continue;
        if ((existing?.state === 'reserved' || existing?.state === 'claimed') && (existing.expiresAt ?? 0) > Date.now()) continue;
        const token = crypto.randomUUID();
        await this.state.storage.put(key, { state: 'reserved', token, expiresAt: Date.now() + RESERVATION_TTL_MS } satisfies RoomReservation);
        return Response.json({ roomCode, reservationToken: token });
      }
      return Response.json({ message: 'Não foi possível reservar um código de sala.' }, { status: 503 });
    }

    const roomCode = url.searchParams.get('room')?.toUpperCase();
    if (!isValidRoomCode(roomCode)) return new Response('Invalid room code', { status: 400 });
    const key = `room:${roomCode}`;

    const token = url.searchParams.get('token');
    const reservation = await this.state.storage.get<RoomReservation>(key);
    if (url.pathname === '/claim') {
      if (!reservation || reservation.token !== token
        || !['reserved', 'claimed'].includes(reservation.state)
        || (reservation.expiresAt ?? 0) <= Date.now()) {
        return new Response('Reservation unavailable', { status: 409 });
      }
      await this.state.storage.put(key, { ...reservation, state: 'claimed', expiresAt: Date.now() + CLAIM_TTL_MS });
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/confirm') {
      if (!reservation || reservation.token !== token || !['reserved', 'claimed'].includes(reservation.state)) {
        return new Response('Reservation unavailable', { status: 409 });
      }
      await this.state.storage.put(key, { ...reservation, state: 'active', expiresAt: undefined });
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/release') {
      if (reservation && reservation.token !== token && reservation.state !== 'active') {
        return new Response('Reservation unavailable', { status: 409 });
      }
      await this.state.storage.delete(key);
      return new Response(null, { status: 204 });
    }
    return new Response('Not found', { status: 404 });
  }
}

class DurableSocket implements RealtimeSocket {
  private readonly handlers = new Map<string, RealtimeEventHandler[]>();
  private joinedRoomCode: string | undefined;
  private supportsPatches: boolean;

  constructor(
    readonly id: string,
    private readonly webSocket: WebSocket,
    private readonly server: DurableRealtimeServer,
    private readonly objectRoomCode: string,
    attachment?: SocketAttachment,
  ) {
    this.joinedRoomCode = attachment?.joinedRoomCode;
    this.supportsPatches = attachment?.supportsPatches === true;
  }

  on(event: string, handler: RealtimeEventHandler): this {
    const handlers = this.handlers.get(event) ?? [];
    handlers.push(handler);
    this.handlers.set(event, handlers);
    return this;
  }

  emit(event: string, payload?: unknown): void {
    this.server.send(this, event, payload);
  }

  webSocketSend(message: string): void {
    this.webSocket.send(message);
  }

  join(roomCode: string): void {
    if (this.joinedRoomCode && this.joinedRoomCode !== roomCode) {
      this.server.leave(this.id, this.joinedRoomCode);
    }
    this.joinedRoomCode = roomCode;
    this.server.join(this.id, roomCode);
    this.saveAttachment();
  }

  leave(roomCode: string): void {
    this.server.leave(this.id, roomCode);
    if (this.joinedRoomCode === roomCode) this.joinedRoomCode = undefined;
    this.saveAttachment();
  }

  dispatch(event: string, payload?: unknown): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }

  disconnect(): void {
    this.dispatch('disconnect');
  }

  restoreMembership(): void {
    if (this.joinedRoomCode) this.server.join(this.id, this.joinedRoomCode);
  }

  markSupportsPatches(): void {
    if (!this.supportsPatches) {
      this.supportsPatches = true;
      this.saveAttachment();
    }
  }

  restoreCapabilities(): void {
    if (this.supportsPatches) this.dispatch('client_capabilities', { roomUpdates: 1 });
  }

  private saveAttachment(): void {
    this.webSocket.serializeAttachment({
      socketId: this.id,
      roomCode: this.objectRoomCode,
      joinedRoomCode: this.joinedRoomCode,
      supportsPatches: this.supportsPatches || undefined,
    } satisfies SocketAttachment);
  }
}

/** Socket.IO-compatible adapter backed by hibernatable Durable Object sockets. */
class DurableRealtimeServer implements RealtimeServer {
  private readonly connectionHandlers: Array<(socket: RealtimeSocket) => void> = [];
  private readonly byWebSocket = new Map<WebSocket, DurableSocket>();
  private pendingMessages: Array<{ socket: DurableSocket; event: string; payload?: unknown }> | null = null;
  readonly sockets = {
    adapter: { rooms: new Map<string, Set<string>>() },
    sockets: new Map<string, RealtimeSocket>(),
  };

  on(event: 'connection', handler: (socket: RealtimeSocket) => void): void {
    if (event === 'connection') this.connectionHandlers.push(handler);
  }

  beginTransaction(): void {
    if (this.pendingMessages) throw new Error('Já existe uma transação de mensagens ativa.');
    this.pendingMessages = [];
  }

  send(socket: DurableSocket, event: string, payload?: unknown): void {
    if (this.pendingMessages) {
      this.pendingMessages.push({ socket, event, payload });
      return;
    }
    this.sendNow(socket, event, payload);
  }

  sendNow(socket: DurableSocket, event: string, payload?: unknown): void {
    try {
      socket.webSocketSend(encodeRealtimeMessage({ type: 'event', event, payload }));
    } catch {
      // A close event will perform the authoritative disconnect cleanup.
    }
  }

  commit(): void {
    const messages = this.pendingMessages;
    this.pendingMessages = null;
    messages?.forEach(message => this.sendNow(message.socket, message.event, message.payload));
  }

  rollback(): void {
    this.pendingMessages = null;
  }

  to(roomCode: string) {
    return {
      emit: (event: string, payload?: unknown) => {
        Array.from(this.sockets.adapter.rooms.get(roomCode) ?? []).forEach((socketId) => {
          this.sockets.sockets.get(socketId)?.emit(event, payload);
        });
      },
    };
  }

  attach(webSocket: WebSocket, roomCode: string, restored = false): DurableSocket {
    const attachment = webSocket.deserializeAttachment() as SocketAttachment | null;
    const socketId = attachment?.socketId || crypto.randomUUID();
    const socket = new DurableSocket(socketId, webSocket, this, roomCode, attachment ?? undefined);
    this.byWebSocket.set(webSocket, socket);
    this.sockets.sockets.set(socketId, socket);
    socket.restoreMembership();
    this.connectionHandlers.forEach((handler) => handler(socket));
    if (restored) socket.restoreCapabilities();
    if (!restored) {
      webSocket.serializeAttachment({ socketId, roomCode } satisfies SocketAttachment);
      webSocket.send(encodeRealtimeMessage({ type: 'system', event: 'connected', socketId }));
    }
    return socket;
  }

  restore(webSockets: WebSocket[], roomCode: string): void {
    for (const webSocket of webSockets) {
      if (!this.byWebSocket.has(webSocket)) this.attach(webSocket, roomCode, true);
    }
  }

  get(webSocket: WebSocket): DurableSocket | undefined {
    return this.byWebSocket.get(webSocket);
  }

  detach(webSocket: WebSocket): void {
    const socket = this.byWebSocket.get(webSocket);
    if (!socket) return;
    this.byWebSocket.delete(webSocket);
    this.sockets.sockets.delete(socket.id);
    Array.from(this.sockets.adapter.rooms.entries()).forEach(([roomCode, socketIds]) => {
      socketIds.delete(socket.id);
      if (socketIds.size === 0) this.sockets.adapter.rooms.delete(roomCode);
    });
    socket.disconnect();
  }

  join(socketId: string, roomCode: string): void {
    const members = this.sockets.adapter.rooms.get(roomCode) ?? new Set<string>();
    members.add(socketId);
    this.sockets.adapter.rooms.set(roomCode, members);
  }

  leave(socketId: string, roomCode: string): void {
    const members = this.sockets.adapter.rooms.get(roomCode);
    if (!members) return;
    members.delete(socketId);
    if (members.size === 0) this.sockets.adapter.rooms.delete(roomCode);
  }
}

/** One isolated, persisted game runtime per match room. */
export class GameRoom {
  private readonly scheduledTimers = new Map<GameTimerKind, number>();
  private readonly scheduler: GameTimerScheduler = {
    schedule: (kind, roomCode, delayMs) => {
      if (roomCode === this.roomCode) this.scheduledTimers.set(kind, Date.now() + delayMs);
    },
    cancel: (kind, roomCode) => {
      if (roomCode === this.roomCode) this.scheduledTimers.delete(kind);
    },
  };
  private readonly runtime: GameRuntime = createGameRuntime({
    scheduler: this.scheduler,
    externalTransactions: true,
  });
  private readonly server = new DurableRealtimeServer();
  private serial: Promise<unknown> = Promise.resolve();
  private roomCode = '';
  private initialized = false;
  private wasPersisted = false;
  private lastPersistedRevision = 0;
  private reservationToken: string | undefined;
  private serialQueueDepth = 0;
  private checkpointPending: DurableCheckpoint | null = null;
  private checkpointRunner: Promise<void> | null = null;

  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    registerSocketHandlers(this.server);
  }

  fetch(request: Request): Promise<Response> {
    return this.serially(async () => {
      const roomCode = new URL(request.url).searchParams.get('room')?.toUpperCase();
      if (!isValidRoomCode(roomCode)) return new Response('Código de sala inválido.', { status: 400 });
      if (!isWebSocketUpgrade(request)) return new Response('WebSocket upgrade required', { status: 426 });
      await this.ensureInitialized(roomCode);

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      this.state.acceptWebSocket(server);
      runWithGameRuntime(this.runtime, () => this.server.attach(server, roomCode));
      return new Response(null, { status: 101, webSocket: client });
    });
  }

  webSocketMessage(webSocket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    return this.serially(async () => {
      const operationStartedAt = performance.now();
      await this.ensureInitializedFromSocket(webSocket);
      if (typeof message !== 'string' || new TextEncoder().encode(message).byteLength > MAX_REALTIME_MESSAGE_BYTES) {
        webSocket.close(1009, 'Mensagem inválida');
        return;
      }
      const incoming = parseRealtimeMessage(message);
      if (!incoming) return;

      const socket = this.server.get(webSocket);
      // Browser WebSockets do not expose TCP ping/pong. A tiny control frame
      // lets the client detect a half-open mobile connection without entering
      // the gameplay transaction or touching durable storage.
      if (incoming.event === 'client_ping') {
        if (socket) {
          this.server.sendNow(socket, 'client_pong', {
            sentAt: incoming.payload && typeof incoming.payload === 'object' && !Array.isArray(incoming.payload)
              ? (incoming.payload as { sentAt?: unknown }).sentAt
              : undefined,
            serverTime: Date.now(),
          });
        }
        return;
      }

      // Capability negotiation and explicit resync only update ephemeral
      // socket/session state. They are deliberately kept outside the full
      // transaction + persistence path.
      if (incoming.event === 'client_capabilities' || incoming.event === 'sync_room') {
        runWithGameRuntime(this.runtime, () => {
          socket?.dispatch(incoming.event, incoming.payload);
          if (incoming.event === 'client_capabilities'
            && incoming.payload !== null
            && typeof incoming.payload === 'object'
            && (incoming.payload as { roomUpdates?: unknown }).roomUpdates === 1) {
            socket?.markSupportsPatches();
          }
        });
        return;
      }

      if (incoming.event === 'create_room' && !this.runtime.rooms.has(this.roomCode)) {
        const payload = incoming.payload;
        const reservationToken = payload && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as { reservationToken?: unknown }).reservationToken
          : undefined;
        if (typeof reservationToken !== 'string' || reservationToken.length > 100
          || !(await this.claimReservation(reservationToken))) {
          const socket = this.server.get(webSocket);
          if (socket) this.server.sendNow(socket, 'action_error', { event: 'create_room', message: 'A reserva desta sala expirou ou já foi usada. Crie uma nova sala.' });
          return;
        }
        this.reservationToken = reservationToken;
      }
      const snapshot = this.takeTransactionSnapshot();
      this.runtime.lastMutation = null;
      this.runtime.transactionRoomBefore = snapshot.room;
      this.server.beginTransaction();
      let checkpointCaptureMs = 0;
      let committed = false;
      try {
        runWithGameRuntime(this.runtime, () => {
          socket?.dispatch(incoming.event, incoming.payload);
        });
        // The handler callback mutates this runtime field synchronously. Keep
        // the explicit type here so TypeScript does not narrow the property to
        // the value assigned immediately before the callback.
        const mutation = this.runtime.lastMutation as RuntimeMutation | null;
        const timersChanged = !sameTimerEntries(
          snapshot.timers,
          Array.from(this.scheduledTimers.entries()),
        );
        const durableStateChanged = mutation?.changed === true
          || this.runtime.marketSeq !== snapshot.marketSeq
          || timersChanged
          || (mutation === null && this.hasDurableChanges(snapshot));

        let checkpoint: DurableCheckpoint | null = null;
        // Rejected/no-op gameplay commands still receive their terminal ACK,
        // but do not pay for a checkpoint. For a real mutation we capture an
        // immutable recovery point, commit the network response immediately,
        // and let the serialized checkpoint writer handle compression/storage
        // outside the action's critical path.
        if (durableStateChanged) {
          const captureStartedAt = performance.now();
          checkpoint = this.captureCheckpoint(incoming.event === 'create_room');
          checkpointCaptureMs = performance.now() - captureStartedAt;
        }
        this.server.commit();
        committed = true;
        if (checkpoint) this.enqueueCheckpoint(checkpoint);
      } catch (error) {
        if (committed) {
          console.error('A ação foi transmitida, mas o checkpoint não pôde ser agendado:', {
            roomCode: this.roomCode,
            event: incoming.event,
            error,
          });
          return;
        }
        this.restoreTransactionSnapshot(snapshot);
        this.server.rollback();
        // A gameplay failure must not become a transport failure. The
        // transaction has already been restored, so report the rejected
        // command on the existing socket and let the player retry manually.
        // Closing here made the client reconnect and replay the same command,
        // which could turn one transient persistence/handler error into an
        // infinite "connection lost" loop.
        const socket = this.server.get(webSocket);
        const payload = incoming.payload;
        const failedCommandId = payload && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as { commandId?: unknown }).commandId
          : undefined;
        const room = this.runtime.rooms.get(this.roomCode);
        if (socket) {
          if (typeof failedCommandId === 'string' && failedCommandId.length > 0) {
            this.server.sendNow(socket, 'command_ack', {
              commandId: failedCommandId,
              event: incoming.event,
              status: 'rejected',
              reason: 'server_error',
              stateRevision: room?.stateRevision,
            });
          }
          this.server.sendNow(socket, 'action_error', {
            event: incoming.event,
            message: 'Não foi possível confirmar essa ação. O estado da sala foi preservado; tente novamente.',
          });
        }
        console.error('Falha ao processar ação realtime; transação revertida:', {
          roomCode: this.roomCode,
          event: incoming.event,
          error,
        });
      } finally {
        this.runtime.transactionRoomBefore = null;
        const operationMs = performance.now() - operationStartedAt;
        if (operationMs >= SLOW_REALTIME_OPERATION_MS || checkpointCaptureMs >= SLOW_REALTIME_PERSIST_MS) {
          console.warn('[realtime] operação lenta', {
            roomCode: this.roomCode,
            event: incoming.event,
            operationMs: Math.round(operationMs),
            checkpointCaptureMs: Math.round(checkpointCaptureMs),
            stateRevision: this.runtime.rooms.get(this.roomCode)?.stateRevision ?? null,
            connectedSockets: this.state.getWebSockets().length,
            queueDepth: this.serialQueueDepth,
          });
        }
      }
    });
  }

  webSocketClose(webSocket: WebSocket): Promise<void> {
    return this.serially(async () => {
      await this.ensureInitializedFromSocket(webSocket);
      const snapshot = this.takeTransactionSnapshot();
      this.server.beginTransaction();
      try {
        runWithGameRuntime(this.runtime, () => this.server.detach(webSocket));
        if (this.hasDurableChanges(snapshot)) await this.persistCurrentWithRetry(false);
        this.server.commit();
      } catch (error) {
        this.restoreTransactionSnapshot(snapshot);
        this.server.rollback();
        throw error;
      }
    });
  }

  webSocketError(webSocket: WebSocket): Promise<void> {
    return this.webSocketClose(webSocket);
  }

  alarm(): Promise<void> {
    return this.serially(async () => {
      await this.ensureInitializedFromStorage();
      const now = Date.now();
      const due = Array.from(this.scheduledTimers.entries())
        .filter(([, at]) => at <= now)
        .map(([kind]) => kind);
      const snapshot = this.takeTransactionSnapshot();
      this.server.beginTransaction();
      try {
        for (const kind of due) {
          this.scheduledTimers.delete(kind);
          runGameTimer(this.server, this.runtime, kind, this.roomCode);
        }
        await this.persistCurrentWithRetry(false);
        this.server.commit();
      } catch (error) {
        this.restoreTransactionSnapshot(snapshot);
        this.server.rollback();
        throw error;
      }
    });
  }

  private serially<T>(work: () => Promise<T>): Promise<T> {
    this.serialQueueDepth += 1;
    const queuedAt = performance.now();
    const run = async () => {
      const queueWaitMs = performance.now() - queuedAt;
      if (queueWaitMs >= SLOW_REALTIME_QUEUE_WAIT_MS) {
        console.warn('[realtime] fila serial da sala aguardou', {
          roomCode: this.roomCode || null,
          queueWaitMs: Math.round(queueWaitMs),
          queueDepth: this.serialQueueDepth,
        });
      }
      try {
        return await work();
      } finally {
        this.serialQueueDepth = Math.max(0, this.serialQueueDepth - 1);
      }
    };
    const result = this.serial.then(run, run);
    this.serial = result.then(() => undefined, () => undefined);
    return result;
  }

  private hasDurableChanges(snapshot: DurableTransactionSnapshot): boolean {
    const room = this.runtime.rooms.get(this.roomCode);
    const roomChanged = snapshot.room && room
      ? roomMutationDigest(snapshot.room) !== roomMutationDigest(room)
      : snapshot.roomPresent !== !!room;
    return roomChanged
      || this.runtime.marketSeq !== snapshot.marketSeq
      || !sameTimerEntries(snapshot.timers, Array.from(this.scheduledTimers.entries()));
  }

  private takeTransactionSnapshot(): DurableTransactionSnapshot {
    const room = this.runtime.rooms.get(this.roomCode);
    return {
      roomPresent: !!room,
      room: room ? cloneRoomJson(room) : null,
      marketSeq: this.runtime.marketSeq,
      syncSessions: Array.from(this.runtime.roomSyncSessions.entries()).map(([socketId, session]) => [
        socketId,
        {
          snapshot: session.snapshot == null ? null : cloneRoomJson(session.snapshot),
          revision: session.revision,
          supportsPatches: session.supportsPatches,
        },
      ]),
      timers: Array.from(this.scheduledTimers.entries()),
    };
  }

  private restoreTransactionSnapshot(snapshot: DurableTransactionSnapshot): void {
    if (snapshot.roomPresent && snapshot.room) this.runtime.rooms.set(this.roomCode, snapshot.room);
    else this.runtime.rooms.delete(this.roomCode);
    this.runtime.marketSeq = snapshot.marketSeq;

    this.runtime.roomSyncSessions.clear();
    snapshot.syncSessions.forEach(([socketId, session]) => {
      this.runtime.roomSyncSessions.set(socketId, {
        snapshot: session.snapshot == null ? null : cloneRoomJson(session.snapshot),
        revision: session.revision,
        supportsPatches: session.supportsPatches,
      });
    });

    this.scheduledTimers.clear();
    snapshot.timers.forEach(([kind, at]) => this.scheduledTimers.set(kind, at));
  }

  private async ensureInitialized(roomCode: string): Promise<void> {
    if (this.initialized) {
      if (roomCode !== this.roomCode) throw new Error('Durable Object received a mismatched room code.');
      return;
    }
    this.roomCode = roomCode;
    this.runtime.roomCode = roomCode;
    await this.ensureInitializedFromStorage();
  }

  private async ensureInitializedFromSocket(webSocket: WebSocket): Promise<void> {
    if (!this.initialized) {
      const attachment = webSocket.deserializeAttachment() as SocketAttachment | null;
      if (!isValidRoomCode(attachment?.roomCode)) throw new Error('Socket sem código de sala.');
      this.roomCode = attachment!.roomCode!;
      this.runtime.roomCode = this.roomCode;
      await this.ensureInitializedFromStorage();
    }
  }

  private async ensureInitializedFromStorage(): Promise<void> {
    if (this.initialized) return;
    const [storedRecord, storedManifest, legacyTimers] = await Promise.all([
      this.state.storage.get<StoredGameRoom | CompressedStoredGameRoom>(GAME_STORAGE_KEY),
      this.state.storage.get<ChunkedStoredGameRoomManifest>(GAME_MANIFEST_STORAGE_KEY),
      this.state.storage.get<Array<[GameTimerKind, number]>>('timers'),
    ]);
    let durableGameRecord: unknown = storedRecord;
    if (isChunkedStoredGameRoomManifest(storedManifest)) {
      const storedChunks = await Promise.all(
        Array.from({ length: storedManifest.chunkCount }, (_, index) =>
          this.state.storage.get<ArrayBuffer>(gameChunkKey(index))),
      );
      const chunks = storedChunks.map(asArrayBuffer);
      if (chunks.some(chunk => chunk === null)) {
        throw new Error('Snapshot persistido incompleto; recuperação destrutiva recusada.');
      }
      durableGameRecord = {
        encoding: 'gzip-json-v1',
        payload: joinGamePayload(chunks as ArrayBuffer[], storedManifest.payloadBytes),
      } satisfies CompressedStoredGameRoom;
    }
    const stored = durableGameRecord ? await decodeStoredGameRoom(durableGameRecord) : null;
    if (stored) {
      // An alarm can wake a hibernated object without a WebSocket attachment.
      // The durable state itself is therefore the source of truth for its room
      // identity in that lifecycle path.
      if (!isPersistedRoom(stored.room)) {
        // Fail closed instead of silently creating a new lobby over a damaged
        // or partially written match. This preserves the last known progress
        // for manual recovery and prevents a corrupted state from advancing.
        throw new Error('Estado persistido inválido; inicialização destrutiva recusada.');
      }
      if (this.roomCode && stored.room.code !== this.roomCode) {
        throw new Error('Estado persistido pertence a outra sala.');
      }
      if (!this.roomCode) {
        this.roomCode = stored.room.code;
        this.runtime.roomCode = this.roomCode;
      }
      // Older rooms did not have a global revision. They are upgraded in
      // memory once, without changing their gameplay data.
      if (!Number.isSafeInteger(stored.room.stateRevision) || stored.room.stateRevision < 0) {
        stored.room.stateRevision = stored.savedRevision && Number.isSafeInteger(stored.savedRevision)
          ? stored.savedRevision
          : 1;
      }
      if (!Number.isSafeInteger(stored.room.roomEpoch) || stored.room.roomEpoch < 1) {
        stored.room.roomEpoch = 1;
      }
      // Rooms created before command idempotency was deployed remain fully
      // playable. Their new private receipt log starts empty and is bounded.
      stored.room.commandReceipts = Array.isArray(stored.room.commandReceipts)
        ? stored.room.commandReceipts
          .filter(receipt => receipt && typeof receipt.commandId === 'string' && typeof receipt.event === 'string'
            && Number.isSafeInteger(receipt.stateRevision))
          .slice(-MAX_PERSISTED_COMMAND_RECEIPTS)
        : [];
      this.runtime.rooms.set(this.roomCode, stored.room);
      this.runtime.marketSeq = stored.marketSeq;
      this.wasPersisted = true;
      this.lastPersistedRevision = stored.room.stateRevision;
    } else {
      // A browser may open an unjoined socket before the creator's first
      // message arrives. That connection is harmless and must not prevent the
      // creator from initializing the room. A socket that already restored a
      // room membership, however, proves that durable state disappeared; fail
      // closed instead of silently replacing a live game with a new lobby.
      const hasJoinedSocket = this.state.getWebSockets().some(webSocket => {
        const attachment = webSocket.deserializeAttachment() as SocketAttachment | null;
        return attachment?.joinedRoomCode === this.roomCode;
      });
      if (hasJoinedSocket) {
        throw new Error('Sala ativa sem estado persistido; recusando inicialização destrutiva.');
      }
    }
    for (const [kind, at] of stored?.timers ?? legacyTimers ?? []) {
      // Alarms are at-least-once and can be delayed during an outage. Keep an
      // overdue timer so `alarm()` executes it immediately after a wake-up
      // instead of silently losing an auto-pick/cleanup/host transfer.
      if (Number.isFinite(at)) this.scheduledTimers.set(kind, at);
    }
    runWithGameRuntime(this.runtime, () => this.server.restore(this.state.getWebSockets(), this.roomCode));
    this.initialized = true;
  }

  private captureCheckpoint(confirmReservation: boolean): DurableCheckpoint {
    const room = this.runtime.rooms.get(this.roomCode);
    return {
      room: room
        ? {
          schemaVersion: 2,
          room: cloneRoomJson(room),
          marketSeq: this.runtime.marketSeq,
          savedRevision: Number.isSafeInteger(room.stateRevision) && room.stateRevision >= 0
            ? room.stateRevision
            : 0,
          savedAt: Date.now(),
          timers: Array.from(this.scheduledTimers.entries()),
        }
        : null,
      confirmReservation,
      reservationToken: this.reservationToken,
    };
  }

  private enqueueCheckpoint(checkpoint: DurableCheckpoint): Promise<void> {
    const previous = this.checkpointPending;
    if (previous && checkpoint.room) {
      // If a create-room checkpoint is superseded before it reaches storage,
      // the newer snapshot still has to confirm that original reservation.
      checkpoint.confirmReservation ||= previous.confirmReservation;
      checkpoint.reservationToken ||= previous.reservationToken;
    }
    this.checkpointPending = checkpoint;
    if (this.checkpointRunner) return this.checkpointRunner;
    const runner = this.flushCheckpoints();
    this.checkpointRunner = runner;
    this.state.waitUntil(runner);
    return runner;
  }

  private async flushCheckpoints(): Promise<void> {
    while (this.checkpointPending) {
      const checkpoint = this.checkpointPending;
      this.checkpointPending = null;
      const startedAt = performance.now();
      try {
        await this.persistCheckpointWithRetry(checkpoint);
        const durationMs = performance.now() - startedAt;
        if (durationMs >= SLOW_REALTIME_PERSIST_MS) {
          console.warn('[realtime] checkpoint lento', {
            roomCode: this.roomCode,
            revision: checkpoint.room?.savedRevision ?? null,
            durationMs: Math.round(durationMs),
          });
        }
      } catch (error) {
        // The authoritative in-memory room has already been broadcast. A
        // checkpoint is recovery insurance, not a reason to reject a valid
        // gameplay action. Give a transient storage failure one extra cycle
        // before leaving the last durable checkpoint in place.
        console.error('Falha no checkpoint assíncrono da sala:', {
          roomCode: this.roomCode,
          revision: checkpoint.room?.savedRevision ?? null,
          error,
        });
        if (!this.checkpointPending) {
          await new Promise(resolve => setTimeout(resolve, 250));
          try {
            await this.persistCheckpointWithRetry(checkpoint);
          } catch (retryError) {
            console.error('Checkpoint continua indisponível; a sala seguirá em memória até a próxima tentativa:', {
              roomCode: this.roomCode,
              revision: checkpoint.room?.savedRevision ?? null,
              error: retryError,
            });
          }
        }
      }
    }
    this.checkpointRunner = null;
  }

  private async persistCheckpoint(checkpoint: DurableCheckpoint): Promise<void> {
    const storedRoom = checkpoint.room;
    if (storedRoom) {
      const revision = storedRoom.savedRevision ?? 0;
      if (revision < this.lastPersistedRevision) {
        throw new Error('Tentativa de persistir uma versão antiga da sala foi bloqueada.');
      }
      const compressed = await encodeStoredGameRoom(storedRoom);
      const chunks = splitGamePayload(compressed.payload);
      const previousManifest = await this.state.storage.get<ChunkedStoredGameRoomManifest>(GAME_MANIFEST_STORAGE_KEY);

      if (chunks.length === 1) {
        // Keep small rooms in one value for the cheapest load path.
        await this.state.storage.put(GAME_STORAGE_KEY, compressed);
        await this.state.storage.delete(GAME_MANIFEST_STORAGE_KEY);
      } else {
        // Write chunks before publishing the manifest. If a write fails, the
        // old manifest remains the recovery point and the room is not exposed
        // half-written on the next Durable Object wake-up.
        await Promise.all(chunks.map((chunk, index) =>
          this.state.storage.put(gameChunkKey(index), chunk),
        ));
        await this.state.storage.put(GAME_MANIFEST_STORAGE_KEY, {
          encoding: 'gzip-json-chunked-v1',
          chunkCount: chunks.length,
          payloadBytes: compressed.payload.byteLength,
        } satisfies ChunkedStoredGameRoomManifest);
        await this.state.storage.delete(GAME_STORAGE_KEY);
      }

      // Remove chunks left behind when a room shrinks or switches back to a
      // single value. The manifest/value above is already the new recovery
      // point, so these deletes are only bounded cleanup.
      const oldChunkCount = isChunkedStoredGameRoomManifest(previousManifest)
        ? previousManifest.chunkCount
        : 0;
      for (let index = chunks.length; index < oldChunkCount; index += 1) {
        await this.state.storage.delete(gameChunkKey(index));
      }
      this.wasPersisted = true;
      this.lastPersistedRevision = revision;
      if (checkpoint.confirmReservation) await this.directoryRequest('/confirm', checkpoint.reservationToken);
    } else if (this.wasPersisted) {
      const previousManifest = await this.state.storage.get<ChunkedStoredGameRoomManifest>(GAME_MANIFEST_STORAGE_KEY);
      await this.state.storage.delete(GAME_STORAGE_KEY);
      await this.state.storage.delete(GAME_MANIFEST_STORAGE_KEY);
      if (isChunkedStoredGameRoomManifest(previousManifest)) {
        await Promise.all(Array.from({ length: previousManifest.chunkCount }, (_, index) =>
          this.state.storage.delete(gameChunkKey(index)),
        ));
      }
      await this.directoryRequest('/release', checkpoint.reservationToken);
      this.wasPersisted = false;
      this.lastPersistedRevision = 0;
    }

    if (storedRoom) {
      // `timers` is embedded in the same durable record as the room. Keep the
      // legacy key untouched for older deployments; new loads prefer the
      // embedded value, avoiding a room/timer split-brain after a crash.
      const nextAlarm = Math.min(...(storedRoom.timers ?? []).map(([, at]) => at));
      if (Number.isFinite(nextAlarm)) await this.state.storage.setAlarm(nextAlarm);
      else await this.state.storage.deleteAlarm();
    } else {
      await this.state.storage.delete('timers');
      await this.state.storage.deleteAlarm();
    }
  }

  private async persistCurrentWithRetry(confirmReservation: boolean): Promise<void> {
    await this.enqueueCheckpoint(this.captureCheckpoint(confirmReservation));
  }

  private async persistCheckpointWithRetry(checkpoint: DurableCheckpoint): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await this.persistCheckpoint(checkpoint);
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 25 * (attempt + 1)));
      }
    }
    console.error('Falha ao persistir o estado da sala após tentativas:', lastError);
    throw lastError instanceof Error ? lastError : new Error('Não foi possível persistir a sala.');
  }

  private async claimReservation(token: string): Promise<boolean> {
    try {
      const id = this.env.ROOM_DIRECTORY.idFromName('room-directory');
      const response = await this.env.ROOM_DIRECTORY.get(id).fetch(
        `https://room-directory/claim?room=${this.roomCode}&token=${encodeURIComponent(token)}`,
        { method: 'POST' },
      );
      return response.ok;
    } catch (error) {
      console.error('Room directory claim failed:', error);
      return false;
    }
  }

  private async directoryRequest(path: '/confirm' | '/release', token?: string): Promise<void> {
    try {
      const id = this.env.ROOM_DIRECTORY.idFromName('room-directory');
      const suffix = token ? `&token=${encodeURIComponent(token)}` : '';
      await this.env.ROOM_DIRECTORY.get(id).fetch(`https://room-directory${path}?room=${this.roomCode}${suffix}`, { method: 'POST' });
    } catch (error) {
      // The room remains authoritative if the auxiliary index is temporarily
      // unavailable; a stale reservation is safer than deleting live state.
      console.error('Room directory update failed:', error);
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/realtime/room-code' && request.method === 'POST') {
      const directory = env.ROOM_DIRECTORY.get(env.ROOM_DIRECTORY.idFromName('room-directory'));
      return directory.fetch('https://room-directory/reserve', { method: 'POST' });
    }
    if (url.pathname === '/api/realtime') {
      if (!isWebSocketUpgrade(request)) return new Response('WebSocket upgrade required', { status: 426 });
      const roomCode = url.searchParams.get('room')?.toUpperCase();
      if (!isValidRoomCode(roomCode)) return new Response('Código de sala inválido.', { status: 400 });
      const room = env.GAME_ROOM.get(env.GAME_ROOM.idFromName(roomCode));
      return room.fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
