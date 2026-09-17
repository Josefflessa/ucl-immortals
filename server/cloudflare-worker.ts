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
} from './handlers.js';
import type { RealtimeEventHandler, RealtimeServer, RealtimeSocket } from './realtime.js';
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
  state: 'reserved' | 'active';
  expiresAt?: number;
}

interface StoredGameRoom {
  room: RoomState;
  marketSeq: number;
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

const ROOM_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RESERVATION_TTL_MS = 10 * 60 * 1000;

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
        if (existing?.state === 'reserved' && (existing.expiresAt ?? 0) > Date.now()) continue;
        await this.state.storage.put(key, { state: 'reserved', expiresAt: Date.now() + RESERVATION_TTL_MS } satisfies RoomReservation);
        return Response.json({ roomCode });
      }
      return Response.json({ message: 'Não foi possível reservar um código de sala.' }, { status: 503 });
    }

    const roomCode = url.searchParams.get('room')?.toUpperCase();
    if (!isValidRoomCode(roomCode)) return new Response('Invalid room code', { status: 400 });
    const key = `room:${roomCode}`;

    if (url.pathname === '/confirm') {
      await this.state.storage.put(key, { state: 'active' } satisfies RoomReservation);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/release') {
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
    try {
      this.webSocket.send(encodeRealtimeMessage({ type: 'event', event, payload }));
    } catch {
      // A close event will perform the authoritative disconnect cleanup.
    }
  }

  join(roomCode: string): void {
    if (this.joinedRoomCode && this.joinedRoomCode !== roomCode) {
      this.server.leave(this.id, this.joinedRoomCode);
    }
    this.joinedRoomCode = roomCode;
    this.server.join(this.id, roomCode);
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
  readonly sockets = {
    adapter: { rooms: new Map<string, Set<string>>() },
    sockets: new Map<string, RealtimeSocket>(),
  };

  on(event: 'connection', handler: (socket: RealtimeSocket) => void): void {
    if (event === 'connection') this.connectionHandlers.push(handler);
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
  private readonly runtime: GameRuntime = createGameRuntime({ scheduler: this.scheduler });
  private readonly server = new DurableRealtimeServer();
  private serial: Promise<unknown> = Promise.resolve();
  private roomCode = '';
  private initialized = false;
  private wasPersisted = false;

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
      await this.ensureInitializedFromSocket(webSocket);
      if (typeof message !== 'string' || new TextEncoder().encode(message).byteLength > MAX_REALTIME_MESSAGE_BYTES) {
        webSocket.close(1009, 'Mensagem inválida');
        return;
      }
      const incoming = parseRealtimeMessage(message);
      if (!incoming) return;
      runWithGameRuntime(this.runtime, () => {
        const socket = this.server.get(webSocket);
        socket?.dispatch(incoming.event, incoming.payload);
        if (incoming.event === 'client_capabilities'
          && incoming.payload !== null
          && typeof incoming.payload === 'object'
          && (incoming.payload as { roomUpdates?: unknown }).roomUpdates === 1) {
          socket?.markSupportsPatches();
        }
      });
      await this.persist(incoming.event === 'create_room');
    });
  }

  webSocketClose(webSocket: WebSocket): Promise<void> {
    return this.serially(async () => {
      await this.ensureInitializedFromSocket(webSocket);
      runWithGameRuntime(this.runtime, () => this.server.detach(webSocket));
      await this.persist(false);
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
      for (const kind of due) {
        this.scheduledTimers.delete(kind);
        runGameTimer(this.server, this.runtime, kind, this.roomCode);
      }
      await this.persist(false);
    });
  }

  private serially<T>(work: () => Promise<T>): Promise<T> {
    const result = this.serial.then(work, work);
    this.serial = result.then(() => undefined, () => undefined);
    return result;
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
    const [stored, timers] = await Promise.all([
      this.state.storage.get<StoredGameRoom>('game'),
      this.state.storage.get<Array<[GameTimerKind, number]>>('timers'),
    ]);
    if (stored) {
      // An alarm can wake a hibernated object without a WebSocket attachment.
      // The durable state itself is therefore the source of truth for its room
      // identity in that lifecycle path.
      if (!this.roomCode) {
        if (!isValidRoomCode(stored.room.code)) throw new Error('Estado persistido com código de sala inválido.');
        this.roomCode = stored.room.code;
        this.runtime.roomCode = this.roomCode;
      }
      this.runtime.rooms.set(this.roomCode, stored.room);
      this.runtime.marketSeq = stored.marketSeq;
      this.wasPersisted = true;
    }
    for (const [kind, at] of timers ?? []) {
      // Alarms are at-least-once and can be delayed during an outage. Keep an
      // overdue timer so `alarm()` executes it immediately after a wake-up
      // instead of silently losing an auto-pick/cleanup/host transfer.
      if (Number.isFinite(at)) this.scheduledTimers.set(kind, at);
    }
    runWithGameRuntime(this.runtime, () => this.server.restore(this.state.getWebSockets(), this.roomCode));
    this.initialized = true;
  }

  private async persist(confirmReservation: boolean): Promise<void> {
    const room = this.runtime.rooms.get(this.roomCode);
    if (room) {
      await this.state.storage.put('game', { room, marketSeq: this.runtime.marketSeq } satisfies StoredGameRoom);
      this.wasPersisted = true;
      if (confirmReservation) await this.directoryRequest('/confirm');
    } else if (this.wasPersisted) {
      await this.state.storage.delete('game');
      await this.directoryRequest('/release');
      this.wasPersisted = false;
    }

    if (room) {
      await this.state.storage.put('timers', Array.from(this.scheduledTimers.entries()));
      const nextAlarm = Math.min(...Array.from(this.scheduledTimers.values()));
      if (Number.isFinite(nextAlarm)) await this.state.storage.setAlarm(nextAlarm);
      else await this.state.storage.deleteAlarm();
    } else {
      this.scheduledTimers.clear();
      await this.state.storage.delete('timers');
      await this.state.storage.deleteAlarm();
    }
  }

  private async directoryRequest(path: '/confirm' | '/release'): Promise<void> {
    try {
      const id = this.env.ROOM_DIRECTORY.idFromName('room-directory');
      await this.env.ROOM_DIRECTORY.get(id).fetch(`https://room-directory${path}?room=${this.roomCode}`, { method: 'POST' });
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
