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

/**
 * Unseeded Rng backed by Math.random. The game uses this by default, so
 * worlds differ per page load as in the prototype; pass createRng(seed) for
 * reproducible runs (#11).
 */
export function mathRandomRng(): Rng {
  return rngFrom(() => Math.random());
}
