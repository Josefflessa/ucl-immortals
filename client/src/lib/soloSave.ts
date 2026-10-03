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
const KEY = 'campaign';

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

export async function loadSoloSave<State>(): Promise<SoloSave<State> | null> {
  const save = await withStore<SoloSave<State>>('readonly', store => store.get(KEY));
  if (!save || save.version !== SOLO_SAVE_VERSION || !save.state || typeof save.state !== 'object') return null;
  return save;
}

export async function writeSoloSave<State>(state: State, accountId: string | null): Promise<void> {
  const save: SoloSave<State> = { version: SOLO_SAVE_VERSION, savedAt: Date.now(), accountId, state };
  await withStore('readwrite', store => store.put(save, KEY));
}

export async function clearSoloSave(): Promise<void> {
  await withStore('readwrite', store => store.delete(KEY));
}
