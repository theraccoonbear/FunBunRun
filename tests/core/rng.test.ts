import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';

const sample = (seed: number, n: number): number[] => {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
};

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    expect(sample(42, 50)).toEqual(sample(42, 50));
  });

  it('diverges for distinct seeds', () => {
    expect(sample(1, 20)).not.toEqual(sample(2, 20));
  });

  it('next() stays within [0, 1)', () => {
    for (const v of sample(7, 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('range() stays within [min, max)', () => {
    const rng = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(-5, 10);
      expect(v).toBeGreaterThanOrEqual(-5);
      expect(v).toBeLessThan(10);
    }
  });

  it('int() returns integers within [min, maxExclusive)', () => {
    const rng = createRng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = rng.int(2, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(2);
      expect(v).toBeLessThan(6);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([2, 3, 4, 5]);
  });

  it('pick() returns members of the array', () => {
    const rng = createRng(11);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it('pick() throws on an empty array', () => {
    expect(() => createRng(1).pick([])).toThrow();
  });
});
