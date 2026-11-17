import { describe, expect, it } from 'vitest';
import {
  clamp,
  closestOnSegment,
  lerp,
  lerpAngle,
  smoothing,
  wrapAngle,
  type Vec2,
} from '../../src/core/math';

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

describe('lerp and lerpAngle', () => {
  it('blends linearly', () => {
    expect(lerp(2, 4, 0)).toBe(2);
    expect(lerp(2, 4, 0.25)).toBe(2.5);
    expect(lerp(2, 4, 1)).toBe(4);
  });

  it('blends angles along the shorter arc across the wrap', () => {
    expect(lerpAngle(3, -3, 0.5)).toBeCloseTo(Math.PI);
    expect(lerpAngle(0.5, 1, 0.5)).toBeCloseTo(0.75);
  });
});

describe('smoothing', () => {
  const step = 1 / 60;

  it('equals the tuned per-step factor min(1, step * rate) at the step', () => {
    expect(smoothing(5, step, step)).toBeCloseTo(5 / 60, 12);
    expect(smoothing(100, step, step)).toBe(1);
  });

  it('gives the same result over a second at any frame rate', () => {
    const settle = (dt: number): number => {
      let v = 0;
      for (let t = 0; t < 1 - 1e-9; t += dt) {
        v += (1 - v) * smoothing(5, dt, step);
      }
      return v;
    };
    const at60 = settle(1 / 60);
    expect(settle(1 / 30)).toBeCloseTo(at60, 9);
    expect(settle(1 / 144)).toBeCloseTo(at60, 9);
    expect(settle(1 / 240)).toBeCloseTo(at60, 9);
  });

  it('is 0 for a zero dt', () => {
    expect(smoothing(5, 0, step)).toBe(0);
  });
});
