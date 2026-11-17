/**
 * Touch zone hints (#22): a faint resting joystick marks the left zone and a
 * drag hint marks the right camera zone. They are shown while onboarding and
 * on the menu, then fade out completely in regular play.
 */

export interface HintState {
  /** Touch is the last-used input device (see `InputDeviceTracker`). */
  touch: boolean;
  /** Whether a round is running (false on the menu, round-over card and pause). */
  playing: boolean;
  /** Rounds finished on this device. */
  roundsDone: number;
  /** Rounds that count as onboarding. */
  onboardingRounds: number;
}

export function touchHintsVisible(s: HintState): boolean {
  if (!s.touch) {
    return false;
  }
  return !s.playing || s.roundsDone < s.onboardingRounds;
}

/** Toggles the hint container's classes. The container itself is `pointer-events: none`. */
export class TouchHints {
  constructor(private readonly el: HTMLElement) {}

  setVisible(on: boolean): void {
    this.el.classList.toggle('on', on);
  }

  /** The live joystick or camera drag replaces its resting hint while a finger is down. */
  setActive(joystick: boolean, look: boolean): void {
    this.el.classList.toggle('joy-live', joystick);
    this.el.classList.toggle('look-live', look);
  }
}
