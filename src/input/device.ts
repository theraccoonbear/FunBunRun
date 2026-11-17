/**
 * Last-used input device tracking (#6). Every input method stays active at
 * once; this only decides which prompts and on-screen controls to show.
 */

export type InputDevice = 'touch' | 'mouse' | 'gamepad';

/** Maps a `PointerEvent.pointerType` to a device; pens count as touch. Unknown types return null. */
export function deviceFromPointerType(pointerType: string): InputDevice | null {
  if (pointerType === 'mouse') {
    return 'mouse';
  }
  if (pointerType === 'touch' || pointerType === 'pen') {
    return 'touch';
  }
  return null;
}

/** True when any button is pressed or a stick is pushed past `deadzone`. */
export function padHasInput(
  pads: readonly ({
    axes: readonly number[];
    buttons: readonly { pressed: boolean }[];
  } | null)[],
  deadzone: number,
): boolean {
  return pads.some(
    (p) => !!p && (p.buttons.some((b) => b.pressed) || p.axes.some((a) => Math.abs(a) >= deadzone)),
  );
}

/** Remembers the last-used device and notifies listeners when it changes. */
export class InputDeviceTracker {
  private current: InputDevice;
  private readonly listeners: ((device: InputDevice) => void)[] = [];

  /** `initial` is a guess from device capability until the first real input arrives. */
  constructor(initial: InputDevice) {
    this.current = initial;
  }

  get device(): InputDevice {
    return this.current;
  }

  get isTouch(): boolean {
    return this.current === 'touch';
  }

  /** Records input from `device`; returns true when it changed the last-used device. */
  note(device: InputDevice): boolean {
    if (device === this.current) {
      return false;
    }
    this.current = device;
    for (const l of this.listeners) {
      l(device);
    }
    return true;
  }

  /** Subscribes to device changes; returns an unsubscribe function. */
  onChange(listener: (device: InputDevice) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) {
        this.listeners.splice(i, 1);
      }
    };
  }
}

/**
 * Feeds the tracker from DOM events. Capture-phase listeners on `target`
 * see input before any layer can swallow it. Only pointer events are used,
 * so the compatibility mouse events a browser fires after a tap are ignored.
 */
export function attachDeviceDetection(target: Window, tracker: InputDeviceTracker): void {
  const onPointer = (e: PointerEvent): void => {
    const d = deviceFromPointerType(e.pointerType);
    if (d) {
      tracker.note(d);
    }
  };
  target.addEventListener('pointerdown', onPointer, true);
  // Mouse movement counts; touch moves are always preceded by a pointerdown.
  target.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'mouse') {
        tracker.note('mouse');
      }
    },
    true,
  );
  target.addEventListener('keydown', () => tracker.note('mouse'), true);
}
