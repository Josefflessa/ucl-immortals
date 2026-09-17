/** Native WebSocket envelope shared by the browser and the Durable Object. */
export const MAX_REALTIME_MESSAGE_BYTES = 256 * 1024;

export interface RealtimeEventMessage {
  type: 'event';
  event: string;
  payload?: unknown;
}

export interface RealtimeConnectedMessage {
  type: 'system';
  event: 'connected';
  socketId: string;
}

export type RealtimeServerMessage = RealtimeEventMessage | RealtimeConnectedMessage;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isRealtimeEventMessage(value: unknown): value is RealtimeEventMessage {
  return isPlainObject(value)
    && value.type === 'event'
    && typeof value.event === 'string'
    && value.event.length > 0
    && value.event.length <= 80;
}

export function encodeRealtimeMessage(message: RealtimeServerMessage): string {
  return JSON.stringify(message);
}

export function parseRealtimeMessage(raw: string): RealtimeEventMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    return isRealtimeEventMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isValidRoomCode(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Z]{4}$/.test(value);
}
