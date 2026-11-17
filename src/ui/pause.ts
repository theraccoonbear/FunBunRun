/** Pause: the controller that decides when to pause or resume, and the overlay card (#7). */

import type { Phase } from '../sim/game-state';

export type PauseChoice = 'resume' | 'restart' | 'quit';

/** Overlay buttons, top to bottom. The first is focused when the overlay opens. */
export const PAUSE_ITEMS: readonly { choice: PauseChoice; label: string }[] = [
  { choice: 'resume', label: 'Resume' },
  { choice: 'restart', label: 'Restart' },
  { choice: 'quit', label: 'Quit to menu' },
];

/** What caused a pause; only used for diagnostics and tests. */
export type PauseReason =
  'key' | 'button' | 'gamepad' | 'hidden' | 'blur' | 'pointerlock' | 'disconnect';

/**
 * Esc pressed within this many ms of a pause does not resume. Exiting pointer
 * lock with Esc pauses through `pointerlockchange`, and some browsers also
 * deliver the Esc keydown; without the grace period that keydown would undo
 * the pause straight away.
 */
export const ESC_RESUME_GRACE_MS = 400;

/** Everything the controller drives; main.ts wires these to the game, audio, loop and DOM. */
export interface PauseHost {
  phase(): Phase;
  /** Game.pause / resume / quit: phase changes, return false when not allowed. */
  pause(): boolean;
  resume(): boolean;
  quit(): boolean;
  /** Starts a fresh round (Game.start through the normal start path). */
  restart(): void;
  suspendAudio(): void;
  resumeAudio(): void;
  /** Makes the next frame's dt 0, so no paused time reaches the sim. */
  resetClock(): void;
  showOverlay(): void;
  hideOverlay(): void;
  /** True while the canvas holds the pointer lock. */
  pointerLocked(): boolean;
  releasePointer(): void;
  /** Re-requests pointer lock; only works inside a user gesture. */
  lockPointer(): void;
  now(): number;
}

export class PauseController {
  private pausedAt = -Infinity;
  /** Whether the pointer was locked when the round paused, so resume can re-lock it. */
  private relock = false;
  /** Reason for the current pause, or null when not paused. */
  reason: PauseReason | null = null;

  constructor(private readonly host: PauseHost) {}

  get paused(): boolean {
    return this.host.phase() === 'paused';
  }

  /**
   * Pauses a running round; ignored outside play. `wasLocked` defaults to the
   * current lock state; the pointer-lock trigger passes true, since the lock
   * is already gone by the time it fires.
   */
  pause(reason: PauseReason, wasLocked: boolean = this.host.pointerLocked()): boolean {
    const h = this.host;
    if (!h.pause()) {
      return false;
    }
    this.reason = reason;
    this.pausedAt = h.now();
    this.relock = wasLocked;
    h.releasePointer();
    h.suspendAudio();
    h.showOverlay();
    return true;
  }

  /**
   * Resumes a paused round. `gesture` is true when called from a DOM input
   * event (key, click, tap), where the pointer lock may be requested again.
   */
  resume(gesture: boolean): boolean {
    const h = this.host;
    if (!h.resume()) {
      return false;
    }
    this.afterPause(gesture);
    return true;
  }

  /** P key, the HUD button and gamepad Start: pause in play, resume when paused. */
  toggle(reason: PauseReason, gesture: boolean): void {
    if (this.paused) {
      this.resume(gesture);
    } else {
      this.pause(reason);
    }
  }

  /** Esc: pauses in play; resumes when paused, except right after the pause (see ESC_RESUME_GRACE_MS). */
  escape(): void {
    if (!this.paused) {
      this.pause('key');
    } else if (this.host.now() - this.pausedAt >= ESC_RESUME_GRACE_MS) {
      this.resume(true);
    }
  }

  /** Acts on an overlay button. */
  choose(choice: PauseChoice, gesture: boolean): void {
    if (!this.paused) {
      return;
    }
    if (choice === 'resume') {
      this.resume(gesture);
    } else if (choice === 'restart') {
      this.host.restart();
      this.afterPause(gesture);
    } else if (this.host.quit()) {
      this.reason = null;
      this.relock = false;
      this.host.hideOverlay();
      this.host.resumeAudio();
      this.host.resetClock();
    }
  }

  private afterPause(gesture: boolean): void {
    const h = this.host;
    this.reason = null;
    h.hideOverlay();
    h.resumeAudio();
    h.resetClock();
    if (gesture && this.relock) {
      h.lockPointer();
    }
    this.relock = false;
  }
}

/** Index `i + dir` wrapped into 0..n-1 (menu focus movement). */
export function wrapIndex(i: number, dir: number, n: number): number {
  return (((i + dir) % n) + n) % n;
}

/** Card HTML for the pause overlay. */
export function pauseHtml(): string {
  return (
    '<h1>Paused</h1>' +
    PAUSE_ITEMS.map(
      (it, i) =>
        "<button type='button' data-choice='" +
        it.choice +
        "' data-index='" +
        i +
        "'>" +
        it.label +
        '</button>',
    ).join('')
  );
}

/**
 * The pause overlay: a card with Resume, Restart and Quit-to-menu buttons.
 * Mouse and touch click the buttons; keyboard and gamepad move the focus
 * with move() and press the focused one with activate().
 */
export class PauseMenu {
  private focus = 0;
  private readonly buttons: HTMLButtonElement[];

  constructor(
    private readonly overlay: HTMLElement,
    card: HTMLElement,
    private readonly onChoose: (choice: PauseChoice, gesture: boolean) => void,
  ) {
    card.innerHTML = pauseHtml();
    this.buttons = Array.from(card.querySelectorAll('button'));
    this.buttons.forEach((b, i) => {
      b.addEventListener('click', () => this.onChoose(PAUSE_ITEMS[i]!.choice, true));
      b.addEventListener('focus', () => {
        this.focus = i;
      });
    });
  }

  get visible(): boolean {
    return this.overlay.style.display === 'flex';
  }

  show(): void {
    this.overlay.style.display = 'flex';
    this.focus = 0;
    this.buttons[0]?.focus();
  }

  hide(): void {
    this.overlay.style.display = 'none';
    this.buttons[this.focus]?.blur();
  }

  /** Moves the focus up (-1) or down (+1), wrapping. */
  move(dir: number): void {
    this.focus = wrapIndex(this.focus, dir, this.buttons.length);
    this.buttons[this.focus]?.focus();
  }

  /** Presses the focused button. */
  activate(gesture: boolean): void {
    this.onChoose(PAUSE_ITEMS[this.focus]!.choice, gesture);
  }
}
