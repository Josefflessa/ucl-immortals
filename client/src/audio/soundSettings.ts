/**
 * The player's sound choices, shared by the match audio and the interface sounds: one mute
 * switch and one effects volume. Both are remembered on this device. The mute key is the one
 * the match already used, so an earlier "muted" choice carries over.
 */

const MUTE_KEY = 'ucl-immortals:sound-muted';
const VOLUME_KEY = 'ucl-immortals:sound-volume';
const DEFAULT_VOLUME = 0.7;

export interface SoundSettings { muted: boolean; volume: number }

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
}

function readStored(): SoundSettings {
  try {
    const muted = localStorage.getItem(MUTE_KEY) === '1';
    const raw = localStorage.getItem(VOLUME_KEY);
    return { muted, volume: raw === null ? DEFAULT_VOLUME : clamp01(Number(raw)) };
  } catch {
    return { muted: false, volume: DEFAULT_VOLUME };
  }
}

let current: SoundSettings = readStored();
const listeners = new Set<() => void>();

function commit(next: SoundSettings): void {
  if (next.muted === current.muted && next.volume === current.volume) return;
  current = next;
  try {
    localStorage.setItem(MUTE_KEY, next.muted ? '1' : '0');
    localStorage.setItem(VOLUME_KEY, String(next.volume));
  } catch { /* private mode: not remembered */ }
  listeners.forEach(listener => listener());
}

export const soundSettings = {
  /** A stable snapshot (the same object until something changes), for useSyncExternalStore. */
  get: (): SoundSettings => current,
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
  setMuted: (muted: boolean): void => commit({ ...current, muted }),
  setVolume: (volume: number): void => commit({ ...current, volume: clamp01(volume) }),
  /** The linear gain every sound goes through (0 when muted). */
  gain: (): number => (current.muted ? 0 : current.volume),
};
