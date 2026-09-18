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
// Gameplay commands are queued only when the caller provides a commandId. The
// server persists that ID and makes retries idempotent, so a response lost during
// a brief disconnect cannot duplicate a purchase or a phase transition.
const QUEUEABLE_EVENTS = new Set(['client_capabilities', 'create_room', 'join_room', 'sync_room']);
const RETRYABLE_GAMEPLAY_EVENTS = new Set([
  'start_setup', 'submit_setup', 'draft_pick', 'draft_veto', 'submit_squad_review',
  'set_match_roles', 'set_match_plan', 'play_round', 'advance_round',
  'play_knockout_round', 'advance_knockout_round', 'restart_room',
  'player_match_watched', 'shop_change_coach', 'evolve_coach_prime',
  'shop_open_unique_pack', 'shop_claim_unique_pack', 'shop_open_pack',
  'shop_pick_pack', 'shop_turbinar', 'shop_train', 'shop_remove_variant',
  'place_bet', 'cancel_bet', 'heal_injury', 'emergency_replace_player',
  'market_sell', 'market_list', 'market_cancel', 'market_buy',
  'player_ready', 'player_unready', 'swap_player_team', 'set_martir_targets',
  'set_evolve_point', 'reset_evolve_points', 'shop_buy_reroll',
  'reroll_reinforcement', 'pick_reinforcement', 'dismiss_reinforcement',
]);

function hasCommandId(payload: unknown): boolean {
  return !!payload && typeof payload === 'object' && !Array.isArray(payload)
    && typeof (payload as { commandId?: unknown }).commandId === 'string';
}

function commandIdFromPayload(payload: unknown): string | null {
  if (!hasCommandId(payload)) return null;
  return (payload as { commandId: string }).commandId;
}

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
 * Commands carrying an id can be retried after a short disconnect; the server
 * makes those retries idempotent and then sends a fresh authoritative snapshot.
 */
export class DurableRealtimeSocket implements RealtimeClientSocket {
  private socket: WebSocket | null = null;
  private readonly handlers = new Map<string, Set<EventHandler>>();
  private readonly pendingMessages: Array<{ event: string; message: string }> = [];
  private readonly inFlightCommands = new Map<string, { event: string; message: string }>();
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
    const canRetry = RETRYABLE_GAMEPLAY_EVENTS.has(event) && hasCommandId(payload);
    if (this.socket?.readyState === WebSocket.OPEN && this._id) {
      try {
        this.socket.send(message);
        if (canRetry) {
          const commandId = commandIdFromPayload(payload);
          if (commandId) this.inFlightCommands.set(commandId, { event, message });
        }
      } catch {
        if (QUEUEABLE_EVENTS.has(event) || canRetry) this.queue(event, message);
        else this.dispatch('action_dropped', { event });
      }
      return this;
    }

    if (QUEUEABLE_EVENTS.has(event) || canRetry) this.queue(event, message);
    else this.dispatch('action_dropped', { event });
    return this;
  }

  private queue(event: string, message: string): void {
    // A bounded queue protects the browser if the network remains unavailable.
    if (this.pendingMessages.length >= MAX_QUEUED_MESSAGES) {
      const dropped = this.pendingMessages.shift();
      if (dropped && RETRYABLE_GAMEPLAY_EVENTS.has(dropped.event)) {
        this.dispatch('action_dropped', { event: dropped.event, reason: 'queue_full' });
      }
    }
    this.pendingMessages.push({ event, message });
  }

  disconnect(): void {
    this.manuallyClosed = true;
    this.pendingMessages.length = 0;
    this.inFlightCommands.clear();
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
        // The server may have committed the command while its ACK was in
        // flight. Replaying the same ID is safe and closes that ambiguity.
        this.requeueInFlightCommands();
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
      if (event) {
        if (event.event === 'command_ack') {
          const payload = event.payload as { commandId?: unknown } | undefined;
          if (typeof payload?.commandId === 'string') this.inFlightCommands.delete(payload.commandId);
        }
        this.dispatch(event.event, event.payload);
      }
    } catch {
      // Ignore malformed frames; the Durable Object also validates inbound data.
    }
  }

  private flush(): void {
    while (this.pendingMessages.length > 0 && this.socket?.readyState === WebSocket.OPEN) {
      const pending = this.pendingMessages.shift()!;
      try {
        this.socket.send(pending.message);
        if (RETRYABLE_GAMEPLAY_EVENTS.has(pending.event)) {
          const parsed = JSON.parse(pending.message) as { payload?: unknown };
          const commandId = commandIdFromPayload(parsed.payload);
          if (commandId) this.inFlightCommands.set(commandId, pending);
        }
      } catch {
        // Put the exact command back. Its commandId makes a later retry safe.
        this.pendingMessages.unshift(pending);
        break;
      }
    }
  }

  private requeueInFlightCommands(): void {
    if (this.inFlightCommands.size === 0) return;
    const commands = Array.from(this.inFlightCommands.values());
    this.inFlightCommands.clear();
    commands.forEach(command => this.queue(command.event, command.message));
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
