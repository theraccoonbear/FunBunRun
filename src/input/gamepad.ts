import { INPUT } from '../config';
import type { Actions, EdgeDetector } from './actions';

/** The parts of the Gamepad API used here (standard mapping). */
export interface PadLike {
  index: number;
  axes: readonly number[];
  buttons: readonly { pressed: boolean }[];
}

export interface GamepadHooks {
  isPlaying: () => boolean;
  onStart: () => void;
}

/** Standard-mapping button indices. */
export const PAD = {
  a: 0,
  b: 1,
  x: 2,
  lb: 4,
  lt: 6,
  rt: 7,
  start: 9,
  l3: 10,
} as const;

const deadzone = (v: number): number => (Math.abs(v) < INPUT.gamepadDeadzone ? 0 : v);

/** Adds every connected pad's sticks and buttons to `actions` for this frame. */
export function pollGamepads(
  pads: readonly (PadLike | null)[],
  edges: EdgeDetector,
  actions: Actions,
  hooks: GamepadHooks,
  dt: number,
): void {
  for (const gp of pads) {
    if (!gp) {
      continue;
    }
    actions.moveX += deadzone(gp.axes[0] ?? 0);
    actions.moveY -= deadzone(gp.axes[1] ?? 0);
    actions.addLook(
      deadzone(gp.axes[2] ?? 0) * INPUT.gamepadLookX * dt,
      deadzone(gp.axes[3] ?? 0) * INPUT.gamepadLookY * dt,
    );
    const pressed = (i: number): boolean => !!gp.buttons[i]?.pressed;
    const edge = (i: number): boolean => edges.edge(gp.index + ':' + i, pressed(i));
    if (edge(PAD.a)) {
      if (hooks.isPlaying()) {
        actions.press('jump');
      } else {
        hooks.onStart();
      }
    }
    if (edge(PAD.x) || edge(PAD.rt)) {
      actions.press('lick');
    }
    if (edge(PAD.start) && !hooks.isPlaying()) {
      hooks.onStart();
    }
    if (pressed(PAD.b) || pressed(PAD.lt)) {
      actions.sniff = true;
    }
    if (pressed(PAD.lb) || pressed(PAD.l3)) {
      actions.sprint = true;
    }
  }
}

export function readGamepads(): readonly (PadLike | null)[] {
  return typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
}
