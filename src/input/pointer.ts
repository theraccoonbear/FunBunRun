import type { Actions } from './actions';

export interface PointerHooks {
  isPlaying: () => boolean;
  /** Touch devices use the touch layer instead of mouse look. */
  isTouch: boolean;
}

/**
 * Mouse look: the first click captures the pointer (or drag-looks while
 * the lock request is pending or refused); clicks while captured lick.
 */
export function attachPointer(
  canvas: HTMLCanvasElement,
  actions: Actions,
  hooks: PointerHooks,
): void {
  let dragging = false;
  canvas.addEventListener('mousedown', () => {
    if (hooks.isTouch || !hooks.isPlaying()) {
      return;
    }
    if (document.pointerLockElement === canvas) {
      actions.press('lick');
    } else {
      dragging = true;
      try {
        const r = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
        r?.catch(() => {});
      } catch {
        /* drag-look fallback */
      }
    }
  });
  addEventListener('mouseup', () => {
    dragging = false;
  });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === canvas || dragging) {
      actions.addLook(e.movementX || 0, e.movementY || 0);
    }
  });
}

export function releasePointer(): void {
  if (document.pointerLockElement) {
    document.exitPointerLock();
  }
}
