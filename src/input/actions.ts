import type { FrameInput } from '../sim/game';

export type EdgeAction = 'jump' | 'lick';

/**
 * Abstract per-frame actions, filled by every input device. Axes and held
 * buttons are rebuilt each frame; look deltas accumulate between frames;
 * edge actions (jump, lick) latch when pressed and stay set until
 * endFrame(), so a press between two frames is never lost.
 */
export class Actions implements FrameInput {
  moveX = 0;
  moveY = 0;
  lookX = 0;
  lookY = 0;
  turn = 0;
  sprint = false;
  sniff = false;
  jump = false;
  lick = false;

  press(action: EdgeAction): void {
    this[action] = true;
  }

  addLook(dx: number, dy: number): void {
    this.lookX += dx;
    this.lookY += dy;
  }

  /** Clears consumed look deltas and edge latches after the simulation ran. */
  endFrame(): void {
    this.lookX = this.lookY = 0;
    this.jump = this.lick = false;
  }
}

/** Rising-edge detector for polled buttons, keyed by any string. */
export class EdgeDetector {
  private readonly prev = new Map<string, boolean>();

  /** True only on the poll where `pressed` goes from false to true. Always records the state. */
  edge(key: string, pressed: boolean): boolean {
    const was = this.prev.get(key) ?? false;
    this.prev.set(key, pressed);
    return pressed && !was;
  }
}
