// Solo campaign autosave. A campaign (35 bot squads, every played match with its
// event timeline) can outgrow localStorage's ~5 MB, so it lives in IndexedDB.
// Online rooms are never stored here: the server owns them.

// Bump when the saved GameState shape changes incompatibly; older saves are then ignored.
export const SOLO_SAVE_VERSION = 1;

export interface SoloSave<State = unknown> {
  version: number;
  savedAt: number;
  /** Account that owns the campaign (null = guest), so one profile never resumes another's. */
  accountId: string | null;
  state: State;
}

const DB_NAME = 'ucl-immortals';
const STORE = 'solo';
// One slot per owner (guest or each account) so starting a campaign in one
// profile never overwrites another profile's campaign on the same device.
// Saves written before the split live under the single legacy key.
const LEGACY_KEY = 'campaign';
const slotKey = (accountId: string | null) => `campaign:${accountId ?? 'guest'}`;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise(resolve => {
    if (typeof indexedDB === 'undefined') { resolve(null); return; }
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = run(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
      tx.onabort = () => { db.close(); resolve(null); };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

function isUsableSave<State>(save: SoloSave<State> | null): save is SoloSave<State> {
  return !!save && save.version === SOLO_SAVE_VERSION && !!save.state && typeof save.state === 'object';
}

/** The campaign saved on this device for this owner (null = guest), or null. */
export async function loadSoloSave<State>(accountId: string | null): Promise<SoloSave<State> | null> {
  const save = await withStore<SoloSave<State>>('readonly', store => store.get(slotKey(accountId)));
  if (isUsableSave(save) && save.accountId === accountId) return save;

  // One-time move of a pre-split save into its owner's slot. A legacy save that
  // belongs to someone else stays where it is until that owner loads it.
  const legacy = await withStore<SoloSave<State>>('readonly', store => store.get(LEGACY_KEY));
  if (!isUsableSave(legacy) || legacy.accountId !== accountId) return null;
  await withStore('readwrite', store => store.put(legacy, slotKey(accountId)));
  await withStore('readwrite', store => store.delete(LEGACY_KEY));
  return legacy;
}

export async function writeSoloSave<State>(state: State, accountId: string | null): Promise<void> {
  const save: SoloSave<State> = { version: SOLO_SAVE_VERSION, savedAt: Date.now(), accountId, state };
  await withStore('readwrite', store => store.put(save, slotKey(accountId)));
}

/** Deletes only this owner's campaign; other profiles' saves are untouched. */
export async function clearSoloSave(accountId: string | null): Promise<void> {
  await withStore('readwrite', store => store.delete(slotKey(accountId)));
}
