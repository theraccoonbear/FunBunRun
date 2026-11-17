/** Page lifecycle and device events that should pause a running round (#7). */

import type { PauseReason } from '../ui/pause';

export interface SuspendDocument extends EventTarget {
  readonly visibilityState: DocumentVisibilityState;
  readonly pointerLockElement: Element | null;
}

/**
 * Calls `onSuspend` when the page is hidden (tab switch, app backgrounded,
 * screen locked), the window loses focus, the pointer lock on `lockTarget` is
 * released (Esc while captured), or a gamepad disconnects. The callback
 * decides whether to act; it is only expected to pause during play.
 * `wasLocked` is true for the pointer-lock trigger.
 */
export function attachSuspendTriggers(
  win: EventTarget,
  doc: SuspendDocument,
  lockTarget: unknown,
  onSuspend: (reason: PauseReason, wasLocked?: boolean) => void,
): void {
  let locked = doc.pointerLockElement === lockTarget;
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') {
      onSuspend('hidden');
    }
  });
  win.addEventListener('blur', () => onSuspend('blur'));
  doc.addEventListener('pointerlockchange', () => {
    const now = doc.pointerLockElement === lockTarget;
    if (locked && !now) {
      onSuspend('pointerlock', true);
    }
    locked = now;
  });
  win.addEventListener('gamepaddisconnected', () => onSuspend('disconnect'));
}
