import { describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../src/config';
import { memoryStore } from '../../src/platform/storage';
import {
  defaultQuality,
  parseQuality,
  QUALITY_TIERS,
  resolveQuality,
  segments,
} from '../../src/render/quality';

const desktop = { touch: false, width: 1920, height: 1080 };
const phone = { touch: true, width: 844, height: 390 };
const tablet = { touch: true, width: 1180, height: 820 };

describe('quality tiers', () => {
  it('parses only the three names', () => {
    expect(parseQuality('low')).toBe('low');
    expect(parseQuality('medium')).toBe('medium');
    expect(parseQuality('high')).toBe('high');
    expect(parseQuality('ultra')).toBeNull();
    expect(parseQuality(null)).toBeNull();
  });

  it('defaults to medium for small touch screens and high otherwise', () => {
    expect(defaultQuality(phone)).toBe('medium');
    expect(defaultQuality(tablet)).toBe('high');
    expect(defaultQuality(desktop)).toBe('high');
    expect(defaultQuality({ touch: false, width: 400, height: 300 })).toBe('high');
  });

  it('gets cheaper from high to low', () => {
    const { low, medium, high } = QUALITY_TIERS;
    expect(low.pixelRatioCap).toBeLessThan(medium.pixelRatioCap);
    expect(medium.pixelRatioCap).toBeLessThan(high.pixelRatioCap);
    expect(high.detail).toBe(1);
    expect(low.detail).toBeLessThan(medium.detail);
  });

  it('never drops below a triangle of segments', () => {
    expect(segments(7, 1)).toBe(7);
    expect(segments(8, 0.5)).toBe(4);
    expect(segments(4, 0.1)).toBe(3);
  });

  it('uses the heuristic with nothing saved and does not save it', () => {
    const store = memoryStore();
    expect(resolveQuality('', store, phone).name).toBe('medium');
    expect(store.get(STORAGE_KEYS.quality)).toBeNull();
  });

  it('?quality= wins over the heuristic and is saved', () => {
    const store = memoryStore();
    expect(resolveQuality('?quality=low', store, desktop).name).toBe('low');
    expect(store.get(STORAGE_KEYS.quality)).toBe('low');
    expect(resolveQuality('', store, desktop).name).toBe('low');
  });

  it('ignores an invalid parameter and invalid saved values', () => {
    expect(resolveQuality('?quality=max', memoryStore(), desktop).name).toBe('high');
    const bad = memoryStore({ [STORAGE_KEYS.quality]: 'nope' });
    expect(resolveQuality('', bad, phone).name).toBe('medium');
  });
});
