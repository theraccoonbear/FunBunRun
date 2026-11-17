import { afterEach, describe, expect, it, vi } from 'vitest';
import { SIM } from '../../src/config';
import { FixedStepper, FrameTimer, startLoop } from '../../src/core/loop';

describe('FixedStepper', () => {
  it('runs whole steps and carries the remainder', () => {
    const s = new FixedStepper(0.01, 10);
    const steps: number[] = [];
    expect(s.advance(0.025, (h) => steps.push(h))).toBe(2);
    expect(steps).toEqual([0.01, 0.01]);
    expect(s.pending).toBeCloseTo(0.005);
    expect(s.advance(0.006, () => {})).toBe(1);
    expect(s.pending).toBeCloseTo(0.001);
  });

  it('caps the steps per frame and drops the backlog beyond the cap', () => {
    const s = new FixedStepper(0.01, 3);
    expect(s.advance(0.1, () => {})).toBe(3);
    expect(s.pending).toBe(0);
  });

  it('keeps the remainder when the cap is reached exactly', () => {
    const s = new FixedStepper(0.01, 4);
    expect(s.advance(0.045, () => {})).toBe(4);
    expect(s.pending).toBeCloseTo(0.005);
  });

  it('keeps full speed down to 15 fps at the game settings', () => {
    const s = new FixedStepper(SIM.step, SIM.maxStepsPerFrame);
    let steps = 0;
    // 10 s at 15.5 fps: every owed step runs, none is dropped.
    const dt = 1 / 15.5;
    for (let i = 0; i < 155; i++) {
      steps += s.advance(dt, () => {});
    }
    expect(steps).toBeGreaterThanOrEqual(599);
    expect(steps).toBeLessThanOrEqual(600);
  });

  it('drops time only below 15 fps, at most maxSteps per frame', () => {
    const s = new FixedStepper(SIM.step, SIM.maxStepsPerFrame);
    let steps = 0;
    // 10 s at 10 fps: 4 steps per frame, so the game runs at 40/60 speed.
    for (let i = 0; i < 100; i++) {
      const n = s.advance(0.1, () => {});
      expect(n).toBe(SIM.maxStepsPerFrame);
      steps += n;
    }
    expect(steps).toBe(400);
  });

  it('reports the interpolation factor as the owed fraction of a step', () => {
    const s = new FixedStepper(0.01, 4);
    expect(s.alpha).toBe(0);
    s.advance(0.0125, () => {});
    expect(s.alpha).toBeCloseTo(0.25);
    s.advance(0.005, () => {});
    expect(s.alpha).toBeCloseTo(0.75);
  });

  it('reset() drops pending time', () => {
    const s = new FixedStepper(0.01, 3);
    s.advance(0.005, () => {});
    s.reset();
    expect(s.pending).toBe(0);
  });
});

describe('FrameTimer', () => {
  it('reports seconds between ticks, capped', () => {
    let t = 1000;
    const timer = new FrameTimer(0.05, () => t);
    expect(timer.tick()).toBe(0);
    t += 16;
    expect(timer.tick()).toBeCloseTo(0.016);
    t += 500;
    expect(timer.tick()).toBe(0.05);
  });
});

describe('startLoop', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('runs a frame per animation frame with capped dt until stopped', () => {
    const queue: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => queue.push(cb));
    const cancel = vi.fn();
    vi.stubGlobal('cancelAnimationFrame', cancel);
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const dts: number[] = [];
    const stop = startLoop((dt) => dts.push(dt), 0.05);
    now = 16;
    queue.shift()?.(now);
    now = 1000;
    queue.shift()?.(now);
    expect(dts[0]).toBe(0);
    expect(dts[1]).toBeCloseTo(0.016);
    expect(dts[2]).toBe(0.05);
    stop();
    expect(cancel).toHaveBeenCalled();
    queue.shift()?.(now);
    expect(dts).toHaveLength(3);
  });
});
