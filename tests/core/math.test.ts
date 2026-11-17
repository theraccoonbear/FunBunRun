import { describe, expect, it } from 'vitest';
import { clamp, closestOnSegment, wrapAngle, type Vec2 } from '../../src/core/math';

describe('clamp', () => {
  it('limits to the range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe('wrapAngle', () => {
  it('wraps into [-PI, PI]', () => {
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
    expect(wrapAngle(-3 * Math.PI)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(Math.PI / 2 + 4 * Math.PI)).toBeCloseTo(Math.PI / 2);
    expect(wrapAngle(0.25)).toBe(0.25);
  });
});

describe('closestOnSegment', () => {
  const seg = { ax: 0, az: 0, bx: 10, bz: 0 };
  const out: Vec2 = { x: 0, z: 0 };

  it('projects onto the interior', () => {
    expect(closestOnSegment(seg, 4, 3, out)).toEqual({ x: 4, z: 0 });
  });

  it('clamps to the endpoints', () => {
    expect(closestOnSegment(seg, -5, 2, out)).toEqual({ x: 0, z: 0 });
    expect(closestOnSegment(seg, 15, -2, out)).toEqual({ x: 10, z: 0 });
  });

  it('returns the centre of a degenerate segment (circle)', () => {
    expect(closestOnSegment({ ax: 2, az: 3, bx: 2, bz: 3 }, 9, 9, out)).toEqual({ x: 2, z: 3 });
  });

  it('writes into and returns the out parameter', () => {
    const o: Vec2 = { x: 0, z: 0 };
    expect(closestOnSegment(seg, 1, 1, o)).toBe(o);
  });
});
