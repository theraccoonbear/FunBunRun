import { describe, expect, it } from 'vitest';
import { collide } from '../../src/sim/collision';
import type { Obstacle } from '../../src/sim/world';

const rock: Obstacle = { ax: 0, az: 0, bx: 0, bz: 0, r: 1, h: 1.4 };
const log: Obstacle = { ax: -2, az: 5, bx: 2, bz: 5, r: 0.35, h: 0.7 };
const HALF = 98;

describe('collide', () => {
  it('pushes a circle out of a round obstacle along the contact normal', () => {
    const p = { x: 1, y: 0, z: 0 };
    collide([rock], HALF, p, 0.5, 0);
    expect(p.x).toBeCloseTo(1.5);
    expect(p.z).toBeCloseTo(0);
  });

  it('pushes out of a segment (log) sideways', () => {
    const p = { x: 0.5, y: 0, z: 5.2 };
    collide([log], HALF, p, 0.45, 0);
    expect(p.x).toBeCloseTo(0.5);
    expect(p.z).toBeCloseTo(5 + 0.35 + 0.45);
  });

  it('picks a fixed direction when exactly at the centre', () => {
    const p = { x: 0, y: 0, z: 0 };
    collide([rock], HALF, p, 0.5, 0);
    expect(p).toEqual({ x: 1.5, y: 0, z: 0 });
  });

  it('leaves points that are clear untouched', () => {
    const p = { x: 3, y: 0, z: 0 };
    collide([rock], HALF, p, 0.5, 0);
    expect(p.x).toBe(3);
  });

  it('lets a point at or above the obstacle height pass over (jumping a log)', () => {
    const low = { x: 0, y: 0.69, z: 5.1 };
    const high = { x: 0, y: 0.7, z: 5.1 };
    collide([log], HALF, low, 0.45, 0);
    collide([log], HALF, high, 0.45, 0);
    expect(low.z).not.toBeCloseTo(5.1);
    expect(high.z).toBe(5.1);
  });

  it('ignores obstacles shorter than minH (the bunny hops through logs)', () => {
    const p = { x: 0, y: 0, z: 5.1 };
    collide([log], HALF, p, 0.35, 0.8);
    expect(p.z).toBe(5.1);
  });

  it('clamps to the arena', () => {
    const p = { x: 120, y: 0, z: -150 };
    collide([], HALF, p, 0.5, 0);
    expect(p).toEqual({ x: HALF, y: 0, z: -HALF });
  });
});
