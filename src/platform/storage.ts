import { STORAGE_KEYS } from '../config';

/** Minimal synchronous key-value store, so other back-ends can plug in (#15). */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** localStorage-backed store; every access is guarded (private mode, quota, disabled storage). */
export function localStore(storage: () => Storage = () => localStorage): KeyValueStore {
  return {
    get(key) {
      try {
        return storage().getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        storage().setItem(key, value);
      } catch {
        /* ignore */
      }
    },
  };
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const m = new Map(Object.entries(initial));
  return {
    get: (key) => m.get(key) ?? null,
    set: (key, value) => {
      m.set(key, value);
    },
  };
}

/** Best score; missing or invalid values read as 0. */
export function loadBest(store: KeyValueStore): number {
  return Number(store.get(STORAGE_KEYS.best)) || 0;
}

/** Rounds finished on this device; missing, invalid or negative values read as 0. */
export function loadRounds(store: KeyValueStore): number {
  const n = Math.floor(Number(store.get(STORAGE_KEYS.rounds)));
  return n > 0 ? n : 0;
}

export function saveRounds(store: KeyValueStore, rounds: number): void {
  store.set(STORAGE_KEYS.rounds, String(rounds));
}

export function saveBest(store: KeyValueStore, best: number): void {
  store.set(STORAGE_KEYS.best, String(best));
}
