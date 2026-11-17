import { SIM } from '../config';
import { FixedStepper } from '../core/loop';
import type { Game, StepInput } from './game';
import { captureState, copyState, createRenderState, lerpState, type RenderState } from './interp';

/** Supplies the input for each simulation step. */
export interface StepInputSource {
  /**
   * Called once per step, before it runs. `t` is the sim time at the start of
   * the step (step index times the step length). An edge input (jump, lick)
   * returned here must not be returned again.
   */
  take(t: number): StepInput;
}

/**
 * Drives a Game on a fixed timestep from variable frame times and provides
 * the interpolated state to render. The same seed and the same per-step
 * input give the same simulation at any frame rate, as long as no time is
 * dropped (see SIM in config.ts).
 */
export class SimRunner {
  readonly stepper: FixedStepper;
  /** Steps run so far. */
  ticks = 0;
  private prev = createRenderState();
  private curr = createRenderState();
  private readonly view = createRenderState();

  constructor(
    readonly game: Game,
    step: number = SIM.step,
    maxSteps: number = SIM.maxStepsPerFrame,
  ) {
    this.stepper = new FixedStepper(step, maxSteps);
    this.resync();
    // A new round teleports everything; do not blend from the old round.
    game.events.on('start', () => this.resync());
  }

  /** Feeds one frame's elapsed time and runs the steps due. Returns the step count. */
  frame(dt: number, input: StepInputSource): number {
    return this.stepper.advance(dt, (h) => {
      const t = this.ticks * h;
      const done = this.prev;
      this.prev = this.curr;
      this.curr = done;
      this.game.update(h, input.take(t));
      this.ticks++;
      captureState(this.game, this.curr);
    });
  }

  /** Interpolation factor between the last two steps, 0..1. */
  get alpha(): number {
    return this.stepper.alpha;
  }

  /** The state to draw this frame, blended between the last two steps. The object is reused. */
  render(): RenderState {
    return lerpState(this.prev, this.curr, this.stepper.alpha, this.view);
  }

  /** Snaps both interpolation ends to the current game state. */
  resync(): void {
    captureState(this.game, this.curr);
    copyState(this.curr, this.prev);
  }
}
