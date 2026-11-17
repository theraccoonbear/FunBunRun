/**
 * Fixed-step accumulator. Feed it variable frame times; it reports how many
 * fixed steps to run. At most `maxSteps` run per frame; if the backlog is
 * still at least one step after that, it is dropped so a slow frame cannot
 * snowball into ever more steps.
 */
export class FixedStepper {
  private acc = 0;

  constructor(
    readonly step: number,
    readonly maxSteps: number,
  ) {}

  /** Adds `dt` and calls `fn(step)` once per whole step due. Returns the step count. */
  advance(dt: number, fn: (h: number) => void): number {
    this.acc += dt;
    let n = 0;
    while (this.acc >= this.step && n < this.maxSteps) {
      fn(this.step);
      this.acc -= this.step;
      n++;
    }
    if (n === this.maxSteps) {
      this.acc = 0;
    }
    return n;
  }

  reset(): void {
    this.acc = 0;
  }

  /** Unconsumed time, in seconds. */
  get pending(): number {
    return this.acc;
  }
}

/** Measures the time between frames in seconds, capped at `maxDt`. */
export class FrameTimer {
  private last: number | null = null;

  constructor(
    private readonly maxDt: number,
    private readonly now: () => number = () => performance.now(),
  ) {}

  tick(): number {
    const t = this.now();
    const dt = this.last === null ? 0 : (t - this.last) / 1000;
    this.last = t;
    return Math.min(this.maxDt, dt);
  }
}

/** Starts a requestAnimationFrame loop. Returns a function that stops it. */
export function startLoop(frame: (dt: number) => void, maxDt: number): () => void {
  const timer = new FrameTimer(maxDt);
  let id = 0;
  let running = true;
  const tick = (): void => {
    if (!running) {
      return;
    }
    id = requestAnimationFrame(tick);
    frame(timer.tick());
  };
  tick();
  return () => {
    running = false;
    cancelAnimationFrame(id);
  };
}
