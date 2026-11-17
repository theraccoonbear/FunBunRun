/** Seeded pseudo-random number generator (mulberry32). */
export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Float in [min, max). */
  range(min: number, max: number): number;
  /** Integer in [min, maxExclusive). */
  int(min: number, maxExclusive: number): number;
  /** Uniformly chosen element; throws on an empty array. */
  pick<T>(arr: readonly T[]): T;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const range = (min: number, max: number): number => min + next() * (max - min);

  const int = (min: number, maxExclusive: number): number => Math.floor(range(min, maxExclusive));

  const pick = <T>(arr: readonly T[]): T => {
    if (arr.length === 0) {
      throw new Error('pick: empty array');
    }
    return arr[int(0, arr.length)] as T;
  };

  return { next, range, int, pick };
}
