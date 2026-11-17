import { describe, expect, it, vi } from 'vitest';
import {
  cappedPixelRatio,
  MAX_PIXEL_RATIO,
  viewportSize,
  watchViewport,
} from '../../src/render/viewport';

describe('viewportSize', () => {
  it('uses the visual viewport when present', () => {
    expect(
      viewportSize({
        innerWidth: 800,
        innerHeight: 600,
        visualViewport: { width: 390.4, height: 700.6 },
      }),
    ).toEqual({ width: 390, height: 701 });
  });

  it('falls back to the window size', () => {
    expect(viewportSize({ innerWidth: 800, innerHeight: 600 })).toEqual({
      width: 800,
      height: 600,
    });
    expect(
      viewportSize({ innerWidth: 800, innerHeight: 600, visualViewport: { width: 0, height: 0 } }),
    ).toEqual({ width: 800, height: 600 });
  });
});

describe('cappedPixelRatio', () => {
  it('caps high ratios and defaults missing ones to 1', () => {
    expect(cappedPixelRatio(3)).toBe(MAX_PIXEL_RATIO);
    expect(cappedPixelRatio(1)).toBe(1);
    expect(cappedPixelRatio(undefined)).toBe(1);
    expect(cappedPixelRatio(0)).toBe(1);
  });
});

describe('watchViewport', () => {
  it('fires on resize, visual viewport resize and a DPR change, and detaches', () => {
    const win = new EventTarget() as unknown as Window & EventTarget;
    const vv = new EventTarget();
    const queries: EventTarget[] = [];
    Object.assign(win, {
      visualViewport: vv,
      devicePixelRatio: 2,
      matchMedia: () => {
        const mq = new EventTarget();
        queries.push(mq);
        return mq;
      },
    });
    const onChange = vi.fn();
    const stop = watchViewport(win, onChange);

    win.dispatchEvent(new Event('resize'));
    vv.dispatchEvent(new Event('resize'));
    win.dispatchEvent(new Event('orientationchange'));
    expect(onChange).toHaveBeenCalledTimes(3);

    queries[0]?.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalledTimes(4);
    // Re-armed with a fresh query after the ratio changed.
    expect(queries).toHaveLength(2);
    queries[1]?.dispatchEvent(new Event('change'));
    expect(onChange).toHaveBeenCalledTimes(5);

    stop();
    win.dispatchEvent(new Event('resize'));
    vv.dispatchEvent(new Event('resize'));
    expect(onChange).toHaveBeenCalledTimes(5);
  });
});
