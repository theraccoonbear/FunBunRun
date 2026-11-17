import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../src/config';
import {
  loadBest,
  loadMuted,
  localStore,
  memoryStore,
  saveBest,
  saveMuted,
} from '../../src/platform/storage';

describe('storage', () => {
  it('round-trips the best score under the prototype key', () => {
    const s = memoryStore();
    expect(loadBest(s)).toBe(0);
    saveBest(s, 1200);
    expect(s.get(STORAGE_KEYS.best)).toBe('1200');
    expect(STORAGE_KEYS.best).toBe('funbunrun-best');
    expect(loadBest(s)).toBe(1200);
  });

  it('round-trips the mute setting, defaulting to sound on', () => {
    const s = memoryStore();
    expect(loadMuted(s)).toBe(false);
    saveMuted(s, true);
    expect(s.get(STORAGE_KEYS.muted)).toBe('1');
    expect(loadMuted(s)).toBe(true);
    saveMuted(s, false);
    expect(loadMuted(s)).toBe(false);
    expect(loadMuted(memoryStore({ [STORAGE_KEYS.muted]: 'yes' }))).toBe(false);
  });

  it('reads garbage as 0', () => {
    expect(loadBest(memoryStore({ [STORAGE_KEYS.best]: 'abc' }))).toBe(0);
  });

  it('wraps a Storage and swallows its errors', () => {
    const data = new Map<string, string>();
    const fake = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    } as unknown as Storage;
    const s = localStore(() => fake);
    s.set('k', 'v');
    expect(s.get('k')).toBe('v');

    const broken = localStore(() => {
      throw new Error('denied');
    });
    expect(broken.get('k')).toBeNull();
    expect(() => broken.set('k', 'v')).not.toThrow();
  });
});
