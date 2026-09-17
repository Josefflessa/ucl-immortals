import { describe, expect, it } from 'vitest';
import { applyRoomPatch, diffRoomJson } from '../shared/room-sync';

describe('room sync patches', () => {
  it('round-trips nested changes without mutating the source', () => {
    const previous = {
      phase: 'league',
      players: [{ id: 'p1', points: 40, connected: true }],
      bracket: { round: 1, played: false },
    };
    const next = {
      phase: 'league',
      players: [{ id: 'p1', points: 55, connected: true }],
      bracket: { round: 1, played: true },
    };

    const patch = diffRoomJson(previous, next);
    expect(applyRoomPatch(previous, patch)).toEqual(next);
    expect(previous).toEqual({
      phase: 'league',
      players: [{ id: 'p1', points: 40, connected: true }],
      bracket: { round: 1, played: false },
    });
  });

  it('replaces arrays when their length changes', () => {
    const previous = { ids: ['a', 'b'] };
    const next = { ids: ['a', 'b', 'c'] };
    const patch = diffRoomJson(previous, next);

    expect(patch).toEqual([{ op: 'set', path: ['ids'], value: ['a', 'b', 'c'] }]);
    expect(applyRoomPatch(previous, patch)).toEqual(next);
  });

  it('represents removed properties explicitly', () => {
    const patch = diffRoomJson({ player: { pendingPack: { kind: 'star' } } }, { player: {} });
    expect(patch).toEqual([{ op: 'delete', path: ['player', 'pendingPack'] }]);
  });

  it('rejects unsafe paths instead of mutating object prototypes', () => {
    expect(() => applyRoomPatch({}, [{ op: 'set', path: ['__proto__', 'polluted'], value: true }])).toThrow();
    expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
  });
});
