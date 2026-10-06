/**
 * Minimal transport contract used by the online game rules.
 *
 * Socket.IO implements this contract in the Vite dev server, while the
 * Cloudflare Durable Object implementation uses native WebSockets. Keeping
 * the game handlers dependent on this small surface prevents the two
 * transports from drifting apart.
 */
export type RealtimeEventHandler = (payload?: unknown) => void;

export interface RealtimeSocket {
  id: string;
  /** Identity from the HttpOnly account session, never supplied by the client. */
  accountId?: string;
  /** Event Únicas that account unlocked (its personal Pacote Único pool), loaded with the session. */
  eventCardIds?: string[];
  /** Optional transport-level liveness marker used by the room watchdog. */
  getLastSeenAt?(): number | undefined;
  on(event: string, handler: RealtimeEventHandler): unknown;
  emit(event: string, payload?: unknown): unknown;
  join(roomCode: string): unknown;
  /** Remove this socket from a room without closing the transport. */
  leave?(roomCode: string): unknown;
}

export interface RealtimeEmitter {
  emit(event: string, payload?: unknown): unknown;
}

export interface RealtimeServer {
  on(event: 'connection', handler: (socket: RealtimeSocket) => void): unknown;
  to(roomCode: string): RealtimeEmitter;
  sockets: {
    adapter: { rooms: Map<string, Set<string>> };
    sockets: Map<string, RealtimeSocket>;
  };
}
