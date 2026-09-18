import {
  encodeRealtimeMessage,
  parseRealtimeMessage,
} from '../../../shared/realtime-protocol';

type EventHandler = (payload?: any) => void;

/** Socket.IO-shaped client surface used by GameContext. */
export interface RealtimeClientSocket {
  readonly id?: string;
  on(event: string, handler: EventHandler): unknown;
  emit(event: string, payload?: unknown): unknown;
  disconnect(): void;
}

const MAX_QUEUED_MESSAGES = 16;
const RECONNECT_DELAYS_MS = [250, 500, 1_000, 2_000, 4_000, 8_000];
// Replaying an old gameplay click after a reconnect is dangerous: the room may
// already be in another leg, phase or balance. Only messages needed to establish
// identity and obtain the latest authoritative snapshot are safe to queue.
const QUEUEABLE_EVENTS = new Set(['client_capabilities', 'create_room', 'join_room', 'sync_room']);

function websocketUrl(roomCode: string): string {
  const configured = import.meta.env.VITE_REALTIME_URL as string | undefined;
  const base = configured || window.location.origin;
  const url = new URL('/api/realtime', base);
  url.protocol = url.protocol === 'https:' || url.protocol === 'wss:' ? 'wss:' : 'ws:';
  url.searchParams.set('room', roomCode);
  return url.toString();
}

/**
 * Native WebSocket client with the small behavior subset used by the game.
 * Outbound gameplay actions are intentionally not queued while a reconnect is in
 * progress. The server is authoritative; after reconnect the UI receives a fresh
 * room snapshot and the player can repeat an action against that current state.
 */
export class DurableRealtimeSocket implements RealtimeClientSocket {
  private socket: WebSocket | null = null;
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly pendingMessages: string[] = [];
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private manuallyClosed = false;
  private _id: string | undefined;

  constructor(private readonly roomCode: string) {
    this.open();
  }

  get id(): string | undefined {
    return this._id;
  }

  on(event: string, handler: EventHandler): this {
    let listeners = this.handlers.get(event);
    if (!listeners) {
      listeners = new Set();
      this.handlers.set(event, listeners);
    }
    listeners.add(handler);
    return this;
  }

  emit(event: string, payload?: unknown): this {
    const message = encodeRealtimeMessage({ type: 'event', event, payload });
    if (this.socket?.readyState === WebSocket.OPEN && this._id) {
      try {
        this.socket.send(message);
      } catch {
        if (QUEUEABLE_EVENTS.has(event)) this.queue(message);
        else this.dispatch('action_dropped', { event });
      }
      return this;
    }

    if (QUEUEABLE_EVENTS.has(event)) this.queue(message);
    else this.dispatch('action_dropped', { event });
    return this;
  }

  private queue(message: string): void {
    // A bounded queue protects the browser if the network remains unavailable.
    if (this.pendingMessages.length >= MAX_QUEUED_MESSAGES) this.pendingMessages.shift();
    this.pendingMessages.push(message);
  }

  disconnect(): void {
    this.manuallyClosed = true;
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.socket?.close(1000, 'client disconnect');
    this.socket = null;
    this._id = undefined;
  }

  private open(): void {
    if (this.manuallyClosed) return;
    try {
      const socket = new WebSocket(websocketUrl(this.roomCode));
      this.socket = socket;
      socket.onmessage = (event) => this.handleMessage(event.data);
      socket.onerror = () => {
        // The close event is the single source of reconnect/disconnect state.
      };
      socket.onclose = () => {
        const wasConnected = !!this._id;
        this._id = undefined;
        if (wasConnected) this.dispatch('disconnect', 'transport close');
        if (!this.manuallyClosed) this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    try {
      const message: unknown = JSON.parse(raw);
      if (message && typeof message === 'object' && !Array.isArray(message)
        && (message as { type?: unknown }).type === 'system'
        && (message as { event?: unknown }).event === 'connected'
        && typeof (message as { socketId?: unknown }).socketId === 'string') {
        this._id = (message as { socketId: string }).socketId;
        this.reconnectAttempt = 0;
        // Let GameContext re-identify this socket (join_room) before replaying
        // actions queued while offline. Otherwise a queued action could reach
        // the room just before the server associates the new socket to its
        // player and be discarded as unauthorized/no-op.
        this.dispatch('connect');
        this.flush();
        return;
      }

      const event = parseRealtimeMessage(raw);
      if (event) this.dispatch(event.event, event.payload);
    } catch {
      // Ignore malformed frames; the Durable Object also validates inbound data.
    }
  }

  private flush(): void {
    while (this.pendingMessages.length > 0 && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(this.pendingMessages.shift()!);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null || this.manuallyClosed) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.open();
    }, delay);
  }

  private dispatch(event: string, payload?: unknown): void {
    this.handlers.get(event)?.forEach((handler) => handler(payload));
  }
}
