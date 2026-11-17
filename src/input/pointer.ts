import type { Actions } from './actions';

export interface PointerHooks {
  isPlaying: () => boolean;
}

/**
 * Mouse look: the first click captures the pointer (or drag-looks while
 * the lock request is pending or refused); clicks while captured lick.
 * Always active: only `pointerType === 'mouse'` presses count, so the touch
 * layer above the canvas neither blocks them nor reacts to them, and a
 * finger never triggers mouse look (hybrid devices, #6).
 */
export function attachPointer(
  canvas: HTMLCanvasElement,
  layer: HTMLElement,
  actions: Actions,
  hooks: PointerHooks,
): void {
  let dragging = false;
  addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || !hooks.isPlaying()) {
      return;
    }
    // The menu card and buttons handle their own clicks.
    if (e.target !== canvas && e.target !== layer) {
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
