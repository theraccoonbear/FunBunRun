import type { Actions } from './actions';

const PREVENT_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export interface KeyboardHooks {
  /** Called on Enter when no round is running. */
  onStart: () => void;
  isPlaying: () => boolean;
}

/** Tracks held keys and maps them to actions. */
export class Keyboard {
  private readonly keys = new Map<string, boolean>();

  constructor(
    private readonly actions: Actions,
    private readonly hooks: KeyboardHooks,
  ) {}

  isDown(code: string): boolean {
    return this.keys.get(code) ?? false;
  }

  /** Handles a key press; returns true when the browser default should be suppressed. */
  down(code: string): boolean {
    if (!this.isDown(code)) {
      if (code === 'Space') {
        this.actions.press('jump');
      }
      if (code === 'KeyE' || code === 'KeyF') {
        this.actions.press('lick');
      }
      if (code === 'Enter' && !this.hooks.isPlaying()) {
        this.hooks.onStart();
      }
    }
    this.keys.set(code, true);
    return PREVENT_DEFAULT.has(code);
  }

  up(code: string): void {
    this.keys.set(code, false);
  }

  /** Releases every key (window blur). */
  clear(): void {
    for (const k of this.keys.keys()) {
      this.keys.set(k, false);
    }
  }

  /** Writes this frame's held-key state into the actions (sets, not adds). */
  apply(): void {
    const a = this.actions;
    const k = (c: string): number => (this.isDown(c) ? 1 : 0);
    a.moveX = k('KeyD') - k('KeyA');
    a.moveY =
      (this.isDown('KeyW') || this.isDown('ArrowUp') ? 1 : 0) -
      (this.isDown('KeyS') || this.isDown('ArrowDown') ? 1 : 0);
    a.turn = k('ArrowLeft') - k('ArrowRight');
    a.sprint = this.isDown('ShiftLeft') || this.isDown('ShiftRight');
    a.sniff = this.isDown('KeyQ');
  }

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      if (this.down(e.code)) {
        e.preventDefault();
      }
    });
    target.addEventListener('keyup', (e) => this.up(e.code));
    target.addEventListener('blur', () => this.clear());
  }
}
