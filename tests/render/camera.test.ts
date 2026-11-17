import { describe, expect, it } from 'vitest';
import { CAMERA } from '../../src/config';
import {
  createFollowZoom,
  damp,
  resetFollowZoom,
  updateFollowZoom,
  type FollowZoom,
} from '../../src/render/camera';

/** Runs the zoom for `seconds` at `hz` frames per second. */
function zoomFor(z: FollowZoom, sprinting: boolean, seconds: number, hz: number): FollowZoom {
  const frames = Math.round(seconds * hz);
  for (let i = 0; i < frames; i++) {
    updateFollowZoom(z, sprinting, 1 / hz);
  }
  return z;
}

describe('damp', () => {
  it('approaches the target exponentially', () => {
    expect(damp(0, 10, 2, 0)).toBe(0);
    expect(damp(0, 10, 2, 1)).toBeCloseTo(10 * (1 - Math.exp(-2)));
    expect(damp(0, 10, 2, 100)).toBeCloseTo(10);
    expect(damp(10, 10, 2, 0.5)).toBe(10);
  });

  it('is frame-rate independent: two half steps equal one full step', () => {
    const half = damp(damp(3, 9, 2.5, 0.05), 9, 2.5, 0.05);
    expect(half).toBeCloseTo(damp(3, 9, 2.5, 0.1), 12);
  });
});

describe('updateFollowZoom', () => {
  it('starts at the normal framing', () => {
    expect(createFollowZoom()).toEqual({ dist: CAMERA.distance, lift: 0 });
  });

  it('pulls back while sprinting and settles in when the sprint ends', () => {
    const z = createFollowZoom();
    zoomFor(z, true, 0.2, 60);
    // Still well short of the bolt distance: the dog gets ahead first.
    expect(z.dist).toBeGreaterThan(CAMERA.distance);
    expect(z.dist).toBeLessThan(CAMERA.boltDistance);
    zoomFor(z, true, 5, 60);
    expect(z.dist).toBeCloseTo(CAMERA.boltDistance, 2);
    expect(z.lift).toBeCloseTo(CAMERA.boltLift, 2);
    zoomFor(z, false, 5, 60);
    expect(z.dist).toBeCloseTo(CAMERA.distance, 2);
    expect(z.lift).toBeCloseTo(0, 2);
  });

  it('eases in faster than it eases out', () => {
    expect(CAMERA.boltInRate).toBeGreaterThan(CAMERA.boltOutRate);
    const span = CAMERA.boltDistance - CAMERA.distance;
    const out = zoomFor(createFollowZoom(), true, 0.3, 60).dist - CAMERA.distance;
    const back = { dist: CAMERA.boltDistance, lift: CAMERA.boltLift };
    const inn = CAMERA.boltDistance - zoomFor(back, false, 0.3, 60).dist;
    expect(inn / span).toBeGreaterThan(out / span);
  });

  it.each([30, 60, 144, 240])('gives the same zoom after one second at %i Hz', (hz) => {
    const ref = zoomFor(createFollowZoom(), true, 1, 60);
    const z = zoomFor(createFollowZoom(), true, 1, hz);
    expect(z.dist).toBeCloseTo(ref.dist, 9);
    expect(z.lift).toBeCloseTo(ref.lift, 9);
  });

  it('resets to the normal framing', () => {
    const z = zoomFor(createFollowZoom(), true, 1, 60);
    resetFollowZoom(z);
    expect(z).toEqual(createFollowZoom());
  });
});
