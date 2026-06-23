// UCL Immortals — Safe localStorage wrapper
// localStorage can throw (private mode, disabled storage, quota exceeded).
// These helpers fail gracefully instead of crashing the app/socket handlers.

export const STORAGE_KEYS = {
  playerName: 'ucl_immortals_playerName',
  roomCode: 'ucl_immortals_roomCode',
} as const;

export function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    console.warn(`[storage] failed to read "${key}":`, e);
    return null;
  }
}

export function setStorageItem(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    console.warn(`[storage] failed to write "${key}":`, e);
  }
}

export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (e) {
    console.warn(`[storage] failed to remove "${key}":`, e);
  }
}
