import type { StepInput } from '../sim/game';
import type { StepInputSource } from '../sim/runner';

export type EdgeAction = 'jump' | 'lick';

/**
 * Abstract actions, filled by every input device. Axes and held buttons are
 * rebuilt each frame. Look deltas and edge actions (jump, lick) latch until a
 * simulation step consumes them with take(): a press is applied by exactly
 * one step, whether a frame runs no step (it waits for the next frame), one
 * step, or several (only the first sees it).
 */
export class Actions implements StepInputSource {
  moveX = 0;
  moveY = 0;
  lookX = 0;
  lookY = 0;
  turn = 0;
  sprint = false;
  sniff = false;
  jump = false;
  lick = false;
  private readonly out: StepInput = {
    moveX: 0,
    moveY: 0,
    lookX: 0,
    lookY: 0,
    turn: 0,
    sprint: false,
    jump: false,
    lick: false,
  };

  press(action: EdgeAction): void {
    this[action] = true;
  }

  addLook(dx: number, dy: number): void {
    this.lookX += dx;
    this.lookY += dy;
  }

  /**
   * Input for one simulation step: the held state plus everything latched
   * since the last step, which is then cleared. The returned object is reused.
   */
  take(): StepInput {
    const o = this.out;
    o.moveX = this.moveX;
    o.moveY = this.moveY;
    o.lookX = this.lookX;
    o.lookY = this.lookY;
    o.turn = this.turn;
    o.sprint = this.sprint;
    o.jump = this.jump;
    o.lick = this.lick;
    this.lookX = this.lookY = 0;
    this.jump = this.lick = false;
    return o;
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
