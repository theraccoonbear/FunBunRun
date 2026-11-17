/** Source of random numbers. Inject one wherever randomness is needed. */
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

/** Builds an Rng from a function returning floats in [0, 1). */
export function rngFrom(next: () => number): Rng {
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

/** Seeded pseudo-random number generator (mulberry32). */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  return rngFrom(() => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
}

/** Unseeded Rng backed by Math.random; used for cosmetic randomness and for drawing seeds. */
export function mathRandomRng(): Rng {
  return rngFrom(() => Math.random());
}

/** A random 32-bit unsigned seed, drawn from `source` (Math.random by default). */
export function randomSeed(source: Rng = mathRandomRng()): number {
  return Math.floor(source.next() * 4294967296) >>> 0;
}

/**
 * Derives an independent 32-bit seed for a named stream from a base seed, so
 * streams (world layout, bunny AI) do not shift each other when one of them
 * consumes more or fewer numbers.
 */
export function deriveSeed(seed: number, salt: number): number {
  let h = ((seed >>> 0) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Reads `?seed=<n>` from a URL query string. Accepts a non-negative integer
 * up to 2^32 - 1; anything else (missing, negative, fractional, junk) is null.
 */
export function parseSeed(search: string): number | null {
  const raw = new URLSearchParams(search).get('seed');
  if (raw === null || !/^\d{1,10}$/.test(raw)) {
    return null;
  }
  const n = Number(raw);
  return n <= 0xffffffff ? n : null;
}
