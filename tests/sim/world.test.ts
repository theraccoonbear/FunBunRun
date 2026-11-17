import { describe, expect, it } from 'vitest';
import { WORLD } from '../../src/config';
import { closestOnSegment } from '../../src/core/math';
import { createRng, rngFrom } from '../../src/core/rng';
import { freeSpot, generateWorld, type Obstacle } from '../../src/sim/world';

const dist = (o: Obstacle, x: number, z: number): number => {
  const c = closestOnSegment(o, x, z, { x: 0, z: 0 });
  return Math.hypot(x - c.x, z - c.z);
};

describe('generateWorld', () => {
  const world = generateWorld(createRng(1234));

  it('places the prototype prop counts', () => {
    expect(world.trees).toHaveLength(WORLD.trees.count);
    expect(world.bushes).toHaveLength(WORLD.bushes.count);
    expect(world.rocks).toHaveLength(WORLD.rocks.count);
    expect(world.logs).toHaveLength(WORLD.logs.count);
    expect(world.obstacles).toHaveLength(70 + 40 + 20 + 18);
  });

  it('keeps the spawn area clear and props inside the arena margin', () => {
    const limit = world.half - WORLD.edgeMargin;
    for (const p of [...world.trees, ...world.bushes, ...world.rocks, ...world.logs]) {
      expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(WORLD.spawnClearRadius);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(limit);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(limit);
    }
  });

  it('keeps each prop clear of every obstacle placed before it', () => {
    const clearances = [
      ...Array<number>(WORLD.trees.count).fill(WORLD.trees.clearance),
      ...Array<number>(WORLD.bushes.count).fill(WORLD.bushes.clearance),
      ...Array<number>(WORLD.rocks.count).fill(WORLD.rocks.clearance),
      ...Array<number>(WORLD.logs.count).fill(WORLD.logs.clearance),
    ];
    const centres = [...world.trees, ...world.bushes, ...world.rocks, ...world.logs];
    centres.forEach((c, i) => {
      for (let j = 0; j < i; j++) {
        const o = world.obstacles[j]!;
        expect(dist(o, c.x, c.z)).toBeGreaterThanOrEqual(o.r + clearances[i]! - 1e-9);
      }
    });
  });

  it('builds tall tree trunks and low, 4 m log segments', () => {
    const tree = world.obstacles[0]!;
    expect(tree.h).toBe(WORLD.trees.height);
    const log = world.obstacles[world.obstacles.length - 1]!;
    expect(log.h).toBe(WORLD.logs.height);
    expect(Math.hypot(log.bx - log.ax, log.bz - log.az)).toBeCloseTo(2 * WORLD.logs.halfLength);
  });

  it('is reproducible for a seed and differs across seeds', () => {
    expect(generateWorld(createRng(1234))).toEqual(world);
    expect(generateWorld(createRng(99)).trees[0]).not.toEqual(world.trees[0]);
  });
});

describe('freeSpot', () => {
  it('avoids obstacles', () => {
    const rng = createRng(5);
    const obstacles: Obstacle[] = [{ ax: 30, az: 30, bx: 30, bz: 30, r: 1, h: 1 }];
    for (let i = 0; i < 200; i++) {
      const s = freeSpot(obstacles, 2, rng);
      expect(dist(obstacles[0]!, s.x, s.z)).toBeGreaterThanOrEqual(3);
    }
  });

  it('falls back to a fixed spot when the arena is full', () => {
    const blanket: Obstacle[] = [{ ax: 0, az: 0, bx: 0, bz: 0, r: 500, h: 1 }];
    expect(freeSpot(blanket, 1, createRng(1))).toEqual(WORLD.fallbackSpot);
  });

  it('rejects spots inside the spawn radius', () => {
    // First draw lands at the origin (0.5 -> 0), the second just outside the spawn radius.
    const values = [0.5, 0.5, 0.5, 0.6];
    const rng = rngFrom(() => values.shift() ?? 0.9);
    const s = freeSpot([], 1, rng);
    expect(Math.hypot(s.x, s.z)).toBeGreaterThanOrEqual(WORLD.spawnClearRadius);
  });
});
