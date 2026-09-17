import { describe, expect, it } from 'vitest';
import {
  MAX_REALTIME_MESSAGE_BYTES,
  isRealtimeEventMessage,
  isValidRoomCode,
  parseRealtimeMessage,
} from './realtime-protocol';

describe('native realtime protocol', () => {
  it('accepts bounded named event envelopes', () => {
    expect(parseRealtimeMessage('{"type":"event","event":"draft_pick","payload":{"playerId":"x"}}'))
      .toEqual({ type: 'event', event: 'draft_pick', payload: { playerId: 'x' } });
  });

  it('rejects malformed or nameless event envelopes', () => {
    expect(parseRealtimeMessage('{')).toBeNull();
    expect(isRealtimeEventMessage({ type: 'event', event: '' })).toBe(false);
    expect(isRealtimeEventMessage({ type: 'other', event: 'draft_pick' })).toBe(false);
  });

  it('only accepts the public four-letter room code format', () => {
    expect(isValidRoomCode('ABCD')).toBe(true);
    expect(isValidRoomCode('abcD')).toBe(false);
    expect(isValidRoomCode('ABCDE')).toBe(false);
  });

  it('keeps a sensible inbound frame limit', () => {
    expect(MAX_REALTIME_MESSAGE_BYTES).toBeGreaterThan(100_000);
    expect(MAX_REALTIME_MESSAGE_BYTES).toBeLessThanOrEqual(512 * 1024);
  });
});
