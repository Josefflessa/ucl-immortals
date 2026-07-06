// UCL Immortals — Safe localStorage wrapper
// localStorage can throw (private mode, disabled storage, quota exceeded).
// These helpers fail gracefully instead of crashing the app/socket handlers.

export const STORAGE_KEYS = {
  playerName: 'ucl_immortals_playerName',
  roomCode: 'ucl_immortals_roomCode',
  clientId: 'ucl_immortals_clientId',
} as const;

// Identidade PERSISTENTE do cliente (mesma pessoa entre refreshes/reconexões). Permite ao servidor
// reconhecer que é o mesmo jogador e reassumir o assento sem depender do flag "conectado" (evita o
// falso "nome já usado" numa corrida de reconexão).
export function getClientId(): string {
  let id = getStorageItem(STORAGE_KEYS.clientId);
  if (!id) {
    id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `c_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    setStorageItem(STORAGE_KEYS.clientId, id);
  }
  return id;
}

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
