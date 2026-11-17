import { INPUT } from '../config';
import type { Actions, EdgeDetector } from './actions';

/** The parts of the Gamepad API used here. */
export interface PadLike {
  index: number;
  /** Device name as the browser reports it, e.g. "Xbox 360 Controller (XInput STANDARD GAMEPAD)". */
  id?: string;
  /** 'standard' when the browser remapped the pad to the W3C standard layout, '' otherwise. */
  mapping?: string;
  connected?: boolean;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value?: number }[];
}

export interface GamepadHooks {
  isPlaying: () => boolean;
  onStart: () => void;
}

/** Standard-mapping button indices (https://w3c.github.io/gamepad/#remapping). */
export const PAD = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  back: 8,
  start: 9,
  l3: 10,
  r3: 11,
  up: 12,
  down: 13,
} as const;

/** A pad's controls in game terms, independent of its layout. */
export interface PadState {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  /** Bottom face button (Xbox A, PlayStation cross, Nintendo B). */
  south: boolean;
  /** Right face button (Xbox B). */
  east: boolean;
  /** Left face button (Xbox X). */
  west: boolean;
  lb: boolean;
  lt: boolean;
  rt: boolean;
  start: boolean;
  l3: boolean;
  up: boolean;
  down: boolean;
}

/** Trigger axes rest at -1 on Linux; count them pressed past this. */
const TRIGGER_AXIS_PRESSED = 0.5;

const deadzone = (v: number): number => (Math.abs(v) < INPUT.gamepadDeadzone ? 0 : v);

/**
 * Reads a pad into game terms.
 *
 * With `mapping === 'standard'` the W3C standard indices are used as is.
 * Other pads (common on Linux Firefox, which exposes the raw evdev layout)
 * get a best-effort guess:
 *
 * - Left stick: axes 0/1.
 * - Six or more axes (evdev style: lx, ly, LT, rx, ry, RT, d-pad hat): right
 *   stick on axes 3/4, triggers on axes 2/5, d-pad on axes 6/7. Face buttons
 *   0-3 and bumpers 4/5. With 13 or more buttons (hid-sony: L2, R2, Share,
 *   Options, PS, L3, R3 after the bumpers) Start is 9 and L3 is 11; with fewer
 *   (xpad: Back, Start, Guide, L3, R3) Start is 7 and L3 is 9. PlayStation
 *   pads report square as 3 and triangle as 2, so the left face button is 3
 *   for them.
 * - Fewer axes (DirectInput style): right stick on axes 2/3, buttons 0-3 face,
 *   4/5 bumpers, 6/7 triggers, 9 Start, 10 L3, d-pad on buttons 12/13 if present.
 *
 * Limits: the face-button order of generic DirectInput pads varies by vendor,
 * so a jump may land on another face button; pads that put the d-pad on
 * buttons in the evdev layout get no d-pad; trigger axes that rest at 0 rather
 * than -1 still work, since they count as pressed only past +0.5. The `?debug`
 * gamepad panel shows the raw indices for diagnosing a new pad.
 */
export function readPad(gp: PadLike): PadState {
  const ax = (i: number): number => gp.axes[i] ?? 0;
  const btn = (i: number): boolean => !!gp.buttons[i]?.pressed;
  if (gp.mapping === 'standard') {
    return {
      moveX: deadzone(ax(0)),
      moveY: -deadzone(ax(1)),
      lookX: deadzone(ax(2)),
      lookY: deadzone(ax(3)),
      south: btn(PAD.a),
      east: btn(PAD.b),
      west: btn(PAD.x),
      lb: btn(PAD.lb),
      lt: btn(PAD.lt),
      rt: btn(PAD.rt),
      start: btn(PAD.start),
      l3: btn(PAD.l3),
      up: btn(PAD.up),
      down: btn(PAD.down),
    };
  }
  const base = {
    moveX: deadzone(ax(0)),
    moveY: -deadzone(ax(1)),
    south: btn(0),
    east: btn(1),
    lb: btn(4),
  };
  if (gp.axes.length >= 6) {
    const sony = gp.buttons.length >= 13;
    const ps = padFamily(gp.id ?? '') === 'playstation';
    return {
      ...base,
      lookX: deadzone(ax(3)),
      lookY: deadzone(ax(4)),
      west: btn(ps ? 3 : 2),
      lt: ax(2) > TRIGGER_AXIS_PRESSED,
      rt: ax(5) > TRIGGER_AXIS_PRESSED,
      start: btn(sony ? 9 : 7),
      l3: btn(sony ? 11 : 9),
      up: gp.axes.length >= 8 && ax(7) < -0.5,
      down: gp.axes.length >= 8 && ax(7) > 0.5,
    };
  }
  return {
    ...base,
    lookX: deadzone(ax(2)),
    lookY: deadzone(ax(3)),
    west: btn(2),
    lt: btn(6),
    rt: btn(7),
    start: btn(9),
    l3: btn(10),
    up: btn(12),
    down: btn(13),
  };
}

/** True when the pad is being used: a stick past the dead zone or a mapped button held. */
export function padActive(s: PadState): boolean {
  return (
    s.moveX !== 0 ||
    s.moveY !== 0 ||
    s.lookX !== 0 ||
    s.lookY !== 0 ||
    s.south ||
    s.east ||
    s.west ||
    s.lb ||
    s.lt ||
    s.rt ||
    s.start ||
    s.l3 ||
    s.up ||
    s.down
  );
}

export type PadFamily = 'xbox' | 'playstation' | 'nintendo' | 'generic';

/** Guesses the controller family from the browser's pad id string. */
export function padFamily(id: string): PadFamily {
  const s = id.toLowerCase();
  // USB vendor ids: Microsoft 045e, Sony 054c, Nintendo 057e. Xbox is checked
  // first because "Xbox Wireless Controller" would otherwise look generic-Sony.
  if (/045e|xbox|xinput|x-box/.test(s)) {
    return 'xbox';
  }
  if (/054c|sony|playstation|dualshock|dualsense|\bps[345]\b/.test(s)) {
    return 'playstation';
  }
  if (/057e|nintendo|switch|joy-con|pro controller/.test(s)) {
    return 'nintendo';
  }
  return 'generic';
}

/** Button labels per family, by game role. Positions follow the standard layout. */
export interface Glyphs {
  /** Bottom face button: jump, start. */
  jump: string;
  /** Left face button: lick. */
  lick: string;
  /** Right face button: sniff. */
  sniff: string;
  lt: string;
  rt: string;
  lb: string;
  start: string;
}

export const GLYPHS: Record<PadFamily, Glyphs> = {
  xbox: { jump: 'A', lick: 'X', sniff: 'B', lt: 'LT', rt: 'RT', lb: 'LB', start: 'Menu' },
  playstation: {
    jump: '✕',
    lick: '□',
    sniff: '○',
    lt: 'L2',
    rt: 'R2',
    lb: 'L1',
    start: 'Options',
  },
  // Nintendo swaps the letters: the bottom button is B and the left one is Y.
  nintendo: { jump: 'B', lick: 'Y', sniff: 'A', lt: 'ZL', rt: 'ZR', lb: 'L', start: '+' },
  generic: { jump: 'A', lick: 'X', sniff: 'B', lt: 'LT', rt: 'RT', lb: 'LB', start: 'Start' },
};

/**
 * Picks the pad to read when several are connected: the most recently
 * active one. Starts with the first connected pad and switches when another
 * pad is used; falls back to the first connected pad when the active one
 * disconnects.
 */
export class PadTracker {
  /** Index of the active pad, or null when none is connected. */
  active: number | null = null;

  select(pads: readonly (PadLike | null)[]): PadLike | null {
    let current: PadLike | null = null;
    let first: PadLike | null = null;
    let used: PadLike | null = null;
    for (const gp of pads) {
      if (!gp || gp.connected === false) {
        continue;
      }
      first ??= gp;
      if (gp.index === this.active) {
        current = gp;
      } else if (!used && padActive(readPad(gp))) {
        used = gp;
      }
    }
    const pick = used ?? current ?? first;
    this.active = pick ? pick.index : null;
    return pick;
  }
}

/** Adds the active pad's sticks and buttons to `actions` for this frame. */
export function pollGamepads(
  pads: readonly (PadLike | null)[],
  edges: EdgeDetector,
  actions: Actions,
  hooks: GamepadHooks,
  dt: number,
  tracker: PadTracker = new PadTracker(),
): void {
  const gp = tracker.select(pads);
  if (!gp) {
    return;
  }
  const s = readPad(gp);
  actions.moveX += s.moveX;
  actions.moveY += s.moveY;
  actions.addLook(s.lookX * INPUT.gamepadLookX * dt, s.lookY * INPUT.gamepadLookY * dt);
  const edge = (name: string, pressed: boolean): boolean =>
    edges.edge(gp.index + ':' + name, pressed);
  if (edge('south', s.south)) {
    if (hooks.isPlaying()) {
      actions.press('jump');
    } else {
      hooks.onStart();
    }
  }
  // Evaluate both edges every poll: with `edge(x) || edge(rt)` a press of X
  // skipped RT's edge update, so RT fired a second lick on the next frame.
  const lickX = edge('west', s.west);
  const lickRT = edge('rt', s.rt);
  if (lickX || lickRT) {
    actions.press('lick');
  }
  if (edge('start', s.start) && !hooks.isPlaying()) {
    hooks.onStart();
  }
  if (s.east || s.lt) {
    actions.sniff = true;
  }
  if (s.lb || s.l3) {
    actions.sprint = true;
  }
}

export function readGamepads(): readonly (PadLike | null)[] {
  return typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
}
