/**
 * The player's sound choices, shared by the match audio, the interface sounds and the music:
 * effects (one mute switch and one volume) and music (its own switch and volume). All of it
 * is remembered on this device. The effects mute key is the one the match already used, so an
 * earlier "muted" choice carries over.
 */

const MUTE_KEY = 'ucl-immortals:sound-muted';
const VOLUME_KEY = 'ucl-immortals:sound-volume';
const MUSIC_MUTE_KEY = 'ucl-immortals:music-muted';
const MUSIC_VOLUME_KEY = 'ucl-immortals:music-volume';
const DEFAULT_VOLUME = 0.7;
const DEFAULT_MUSIC_VOLUME = 0.5;

export interface SoundSettings {
  /** Effects (interface and match). */
  muted: boolean;
  volume: number;
  /** Background music. */
  musicMuted: boolean;
  musicVolume: number;
}

function clamp01(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
}

function readStored(): SoundSettings {
  const defaults: SoundSettings = { muted: false, volume: DEFAULT_VOLUME, musicMuted: false, musicVolume: DEFAULT_MUSIC_VOLUME };
  try {
    const number = (key: string, fallback: number) => {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : clamp01(Number(raw), fallback);
    };
    return {
      muted: localStorage.getItem(MUTE_KEY) === '1',
      volume: number(VOLUME_KEY, DEFAULT_VOLUME),
      musicMuted: localStorage.getItem(MUSIC_MUTE_KEY) === '1',
      musicVolume: number(MUSIC_VOLUME_KEY, DEFAULT_MUSIC_VOLUME),
    };
  } catch {
    return defaults;
  }
}

let current: SoundSettings = readStored();
const listeners = new Set<() => void>();

function commit(next: SoundSettings): void {
  if (next.muted === current.muted && next.volume === current.volume
    && next.musicMuted === current.musicMuted && next.musicVolume === current.musicVolume) return;
  current = next;
  try {
    localStorage.setItem(MUTE_KEY, next.muted ? '1' : '0');
    localStorage.setItem(VOLUME_KEY, String(next.volume));
    localStorage.setItem(MUSIC_MUTE_KEY, next.musicMuted ? '1' : '0');
    localStorage.setItem(MUSIC_VOLUME_KEY, String(next.musicVolume));
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
  setVolume: (volume: number): void => commit({ ...current, volume: clamp01(volume, DEFAULT_VOLUME) }),
  setMusicMuted: (musicMuted: boolean): void => commit({ ...current, musicMuted }),
  setMusicVolume: (musicVolume: number): void => commit({ ...current, musicVolume: clamp01(musicVolume, DEFAULT_MUSIC_VOLUME) }),
  /** The linear gain every effect goes through (0 when muted). */
  gain: (): number => (current.muted ? 0 : current.volume),
  /** The linear level of the music (0 when muted), before each track's own levelling. */
  musicGain: (): number => (current.musicMuted ? 0 : current.musicVolume),
};
