import { ARENA_HALF, WORLD } from '../config';
import { closestOnSegment, type Segment, type Vec2 } from '../core/math';
import type { Rng } from '../core/rng';

/** A capsule on the ground plane (a circle when a == b), `h` tall. */
export interface Obstacle extends Segment {
  r: number;
  h: number;
}

export interface TreeProp {
  x: number;
  z: number;
  scale: number;
  /** Index into the foliage colour palette. */
  variant: number;
}

export interface BushProp {
  x: number;
  z: number;
}

export interface RockProp {
  x: number;
  z: number;
  rotX: number;
  rotY: number;
}

export interface LogProp {
  x: number;
  z: number;
  /** Rotation about the vertical axis. */
  angle: number;
}

export interface World {
  half: number;
  obstacles: Obstacle[];
  trees: TreeProp[];
  bushes: BushProp[];
  rocks: RockProp[];
  logs: LogProp[];
}

const scratch: Vec2 = { x: 0, z: 0 };

/**
 * Picks a random spot at least `minR` clear of every obstacle (plus its
 * radius), outside the spawn area. Falls back to a fixed spot when no free
 * spot is found within the attempt budget.
 */
export function freeSpot(
  obstacles: readonly Obstacle[],
  minR: number,
  rng: Rng,
  half = ARENA_HALF,
): Vec2 {
  const extent = half - WORLD.edgeMargin;
  for (let i = 0; i < WORLD.placementAttempts; i++) {
    const x = (rng.next() * 2 - 1) * extent;
    const z = (rng.next() * 2 - 1) * extent;
    if (Math.sqrt(x * x + z * z) < WORLD.spawnClearRadius) {
      continue;
    }
    let ok = true;
    for (const o of obstacles) {
      closestOnSegment(o, x, z, scratch);
      if (Math.sqrt((x - scratch.x) ** 2 + (z - scratch.z) ** 2) < o.r + minR) {
        ok = false;
        break;
      }
    }
    if (ok) {
      return { x, z };
    }
  }
  return { ...WORLD.fallbackSpot };
}

function addCircle(obstacles: Obstacle[], x: number, z: number, r: number, h: number): void {
  obstacles.push({ ax: x, az: z, bx: x, bz: z, r, h });
}

/** Scatters trees, bushes, rocks and logs, in the prototype's order. */
export function generateWorld(rng: Rng, half = ARENA_HALF): World {
  const obstacles: Obstacle[] = [];
  const trees: TreeProp[] = [];
  const bushes: BushProp[] = [];
  const rocks: RockProp[] = [];
  const logs: LogProp[] = [];

  const T = WORLD.trees;
  for (let i = 0; i < T.count; i++) {
    const { x, z } = freeSpot(obstacles, T.clearance, rng, half);
    trees.push({ x, z, scale: T.scaleMin + rng.next() * T.scaleRange, variant: i % 3 });
    addCircle(obstacles, x, z, T.radius, T.height);
  }
  const Bu = WORLD.bushes;
  for (let i = 0; i < Bu.count; i++) {
    const { x, z } = freeSpot(obstacles, Bu.clearance, rng, half);
    bushes.push({ x, z });
    addCircle(obstacles, x, z, Bu.radius, Bu.height);
  }
  const R = WORLD.rocks;
  for (let i = 0; i < R.count; i++) {
    const { x, z } = freeSpot(obstacles, R.clearance, rng, half);
    rocks.push({ x, z, rotX: rng.next() * R.maxTilt, rotY: rng.next() * R.maxTilt });
    addCircle(obstacles, x, z, R.radius, R.height);
  }
  const L = WORLD.logs;
  for (let i = 0; i < L.count; i++) {
    const { x, z } = freeSpot(obstacles, L.clearance, rng, half);
    const angle = rng.next() * Math.PI;
    logs.push({ x, z, angle });
    const dx = Math.cos(angle) * L.halfLength;
    const dz = -Math.sin(angle) * L.halfLength;
    obstacles.push({ ax: x - dx, az: z - dz, bx: x + dx, bz: z + dz, r: L.radius, h: L.height });
  }

  return { half, obstacles, trees, bushes, rocks, logs };
}
