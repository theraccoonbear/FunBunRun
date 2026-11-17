import { BUNNY, SNIFF } from '../config';

export interface ScentDrop {
  x: number;
  z: number;
  /** Seconds since the drop; large values mean unused. */
  age: number;
}

/** Ring buffer of scent markers the bunny leaves behind (shown while sniffing). */
export interface ScentTrail {
  drops: ScentDrop[];
  next: number;
  timer: number;
}

const UNUSED_AGE = 99;

export function createScentTrail(size: number = SNIFF.trailSize): ScentTrail {
  return {
    drops: Array.from({ length: size }, () => ({ x: 0, z: 0, age: UNUSED_AGE })),
    next: 0,
    timer: 0,
  };
}

/** Hides every marker (round start). The drop timer and ring index carry over. */
export function clearScentTrail(t: ScentTrail): void {
  for (const d of t.drops) {
    d.age = UNUSED_AGE;
  }
}

/** Drops a marker at (x, z) every BUNNY.trailInterval seconds. */
export function dropScent(t: ScentTrail, x: number, z: number, dt: number): void {
  t.timer -= dt;
  if (t.timer <= 0) {
    t.timer = BUNNY.trailInterval;
    const d = t.drops[t.next];
    t.next = (t.next + 1) % t.drops.length;
    if (d) {
      d.x = x;
      d.z = z;
      d.age = 0;
    }
  }
}

export function ageScent(t: ScentTrail, dt: number): void {
  for (const d of t.drops) {
    d.age += dt;
  }
}

/** Marker opacity while sniffing; 0 means hidden. */
export function scentOpacity(age: number): number {
  return age < SNIFF.trailLife ? SNIFF.trailOpacity * (1 - age / SNIFF.trailLife) : 0;
}
