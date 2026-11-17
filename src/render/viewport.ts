/** Viewport sizing helpers: visualViewport-aware size and the capped pixel ratio. */

/** Highest device pixel ratio the renderer uses (keeps phones affordable). */
export const MAX_PIXEL_RATIO = 1.5;

export interface Size {
  width: number;
  height: number;
}

export interface ViewportSource {
  innerWidth: number;
  innerHeight: number;
  visualViewport?: { width: number; height: number } | null;
}

/** Visible size in CSS pixels. Prefers `visualViewport`, which follows mobile browser UI changes. */
export function viewportSize(src: ViewportSource): Size {
  const vv = src.visualViewport;
  const width = vv && vv.width > 0 ? vv.width : src.innerWidth;
  const height = vv && vv.height > 0 ? vv.height : src.innerHeight;
  return { width: Math.round(width), height: Math.round(height) };
}

/** Device pixel ratio clamped to [1, MAX_PIXEL_RATIO]. */
export function cappedPixelRatio(dpr: number | undefined): number {
  return Math.min(dpr || 1, MAX_PIXEL_RATIO);
}

/**
 * Calls `onChange` when the layout viewport, the visual viewport, the
 * orientation or the device pixel ratio changes. Returns a function that
 * removes the listeners.
 */
export function watchViewport(win: Window, onChange: () => void): () => void {
  const cleanups: (() => void)[] = [];
  const listen = (target: EventTarget, type: string): void => {
    target.addEventListener(type, onChange);
    cleanups.push(() => target.removeEventListener(type, onChange));
  };
  listen(win, 'resize');
  listen(win, 'orientationchange');
  if (win.visualViewport) {
    listen(win.visualViewport, 'resize');
  }

  // A resolution query matches only the current ratio, so it fires once
  // when the ratio changes (zoom, moving between displays); re-arm after.
  let dprCleanup: (() => void) | null = null;
  const watchDpr = (): void => {
    dprCleanup?.();
    const mq = win.matchMedia(`(resolution: ${win.devicePixelRatio}dppx)`);
    const handler = (): void => {
      onChange();
      watchDpr();
    };
    mq.addEventListener('change', handler);
    dprCleanup = () => mq.removeEventListener('change', handler);
  };
  watchDpr();

  return () => {
    for (const c of cleanups) {
      c();
    }
    dprCleanup?.();
  };
}
