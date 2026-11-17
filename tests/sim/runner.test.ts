import { describe, expect, it } from 'vitest';
import { ROUND_SECONDS, RAGDOLL, SIM } from '../../src/config';
import { createRng } from '../../src/core/rng';
import { Actions } from '../../src/input/actions';
import { Game, type StepInput } from '../../src/sim/game';
import { SimRunner, type StepInputSource } from '../../src/sim/runner';

const H = SIM.step;

/** Frame-time generators: a fixed refresh rate, or jittered frames. */
type Frames = () => number;
const hz =
  (rate: number): Frames =>
  () =>
    1 / rate;
/** Jittered frames between 240 Hz and 16 Hz (under 4 steps, so no time is dropped). */
function jittered(seed: number): Frames {
  const r = createRng(seed);
  return () => r.range(1 / 240, 1 / 16);
}

const RATES: [string, Frames][] = [
  ['30 Hz', hz(30)],
  ['60 Hz', hz(60)],
  ['144 Hz', hz(144)],
  ['240 Hz', hz(240)],
  ['jittered', jittered(7)],
];

interface Timed<T> {
  at: number;
  value: T;
}

/**
 * A scripted input timeline. Held inputs are a function of sim time; edge
 * presses and look deltas are timestamped and taken by the first step that
 * starts at or after their time, exactly once.
 */
class Script implements StepInputSource {
  private next = 0;
  private nextLook = 0;
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

  constructor(
    private readonly held: (t: number) => Partial<StepInput>,
    private readonly presses: Timed<'jump' | 'lick'>[] = [],
    private readonly looks: Timed<[number, number]>[] = [],
    private readonly onTake: (t: number) => void = () => {},
  ) {}

  take(t: number): StepInput {
    this.onTake(t);
    Object.assign(this.out, {
      moveX: 0,
      moveY: 0,
      lookX: 0,
      lookY: 0,
      turn: 0,
      sprint: false,
      jump: false,
      lick: false,
      ...this.held(t),
    });
    // Compare with a tolerance so float noise in t cannot move an event a step.
    const due = (at: number): boolean => at <= t + H / 2;
    while (this.next < this.presses.length && due(this.presses[this.next]!.at)) {
      this.out[this.presses[this.next]!.value] = true;
      this.next++;
    }
    while (this.nextLook < this.looks.length && due(this.looks[this.nextLook]!.at)) {
      const [dx, dy] = this.looks[this.nextLook]!.value;
      this.out.lookX += dx;
      this.out.lookY += dy;
      this.nextLook++;
    }
    return this.out;
  }
}

/** Feeds frames from `frames` until exactly `seconds` (plus half a step) of time has passed. */
function drive(
  runner: SimRunner,
  frames: Frames,
  seconds: number,
  input: StepInputSource,
  beforeFrame?: (frame: number) => void,
): void {
  const end = seconds + H / 2;
  let t = 0;
  for (let f = 0; t < end; f++) {
    const dt = Math.min(frames(), end - t);
    t += dt;
    beforeFrame?.(f);
    runner.frame(dt, input);
  }
}

/**
 * A chase: sprint away, zig-zag, double back, jump and lick, with mouse look.
 * Hard direction changes at sprint speed yank the person over.
 */
function chaseScript(onTake?: (t: number) => void): Script {
  return new Script(
    (t) => ({
      moveY: t < 3 ? 1 : t < 4.5 ? -1 : 1,
      moveX: t > 1.5 ? (Math.floor(t / 0.7) % 2 ? 1 : -1) : 0,
      sprint: t < 2.5 || t > 5,
      turn: t > 6 && t < 6.5 ? 1 : 0,
    }),
    [
      { at: 0.9, value: 'lick' },
      { at: 2.0, value: 'jump' },
      { at: 3.31, value: 'lick' },
      { at: 4.1, value: 'jump' },
      { at: 5.55, value: 'lick' },
      { at: 6.9, value: 'jump' },
    ],
    [
      { at: 1.2, value: [40, 5] },
      { at: 3.6, value: [-120, -10] },
      { at: 5.05, value: [300, 20] },
    ],
    onTake,
  );
}

interface Run {
  game: Game;
  runner: SimRunner;
  events: string[];
  knockdowns: number[];
}

function runChase(frames: Frames, seconds = 8): Run {
  const game = new Game({ seed: 1234 });
  game.start();
  const runner = new SimRunner(game);
  const events: string[] = [];
  const knockdowns: number[] = [];
  for (const type of ['jump', 'lick', 'miss', 'bone', 'yank'] as const) {
    game.events.on(type, (e) => events.push(`${runner.ticks}:${type}:${JSON.stringify(e)}`));
  }
  // Knockdown: a step raised the stun timer to the stun time (the person is hit by the leash).
  let lastStun = game.rag.st.stun;
  const script = chaseScript(() => {
    const stun = game.rag.st.stun;
    if (stun > lastStun) {
      knockdowns.push(runner.ticks);
    }
    lastStun = stun;
  });
  drive(runner, frames, seconds, script);
  return { game, runner, events, knockdowns };
}

/**
 * Everything the simulation owns, for exact comparison. Draws one number from
 * the game's RNG to compare its stream position, so call it once per game.
 */
function simState(g: Game): unknown {
  return {
    seed: g.seed,
    world: structuredClone(g.world),
    session: { ...g.session },
    dog: structuredClone({ ...g.dog }),
    look: { ...g.look },
    bunny: structuredClone({ ...g.bunny }),
    bones: structuredClone(g.bones),
    scent: structuredClone(g.scent),
    collar: { ...g.collar },
    pts: g.rag.pts.map((p) => ({ ...p })),
    st: structuredClone(g.rag.st),
    rng: g.rng.next(),
  };
}

describe('SimRunner determinism', () => {
  const STEPS = 8 * 60;
  const reference = runChase(hz(60));
  const referenceState = simState(reference.game);

  it('runs the expected number of steps', () => {
    expect(reference.runner.ticks).toBe(STEPS);
    // The script exercises the interesting paths.
    expect(reference.events.some((e) => e.includes(':jump:'))).toBe(true);
    expect(reference.events.some((e) => e.includes(':lick:') || e.includes(':miss:'))).toBe(true);
    expect(reference.events.some((e) => e.includes(':yank:'))).toBe(true);
    expect(reference.knockdowns.length).toBeGreaterThan(0);
    expect(reference.game.session.timeLeft).toBeLessThan(90);
  });

  it.each(RATES)('generates the identical seeded world layout at %s', (_, frames) => {
    const run = runChase(frames);
    expect(run.game.seed).toBe(1234);
    expect(run.game.world).toEqual(reference.game.world);
    expect(run.game.world).toEqual(new Game({ seed: 1234 }).world);
  });

  it.each(RATES)('ends in an identical sim state at %s', (_, frames) => {
    const run = runChase(frames);
    expect(run.runner.ticks).toBe(STEPS);
    expect(simState(run.game)).toEqual(referenceState);
    expect(run.game.session.score).toBe(reference.game.session.score);
    expect(run.game.dog.stam).toBe(reference.game.dog.stam);
  });

  it('keeps the bunny wander identical across frame rates (#3)', () => {
    const wander = (frames: Frames): unknown => {
      const game = new Game({ seed: 99 });
      game.start();
      // Far from the dog, so the bunny wanders with random turns.
      game.bunny.pos.x = -40;
      game.bunny.pos.z = -40;
      const runner = new SimRunner(game);
      drive(runner, frames, 4, new Script(() => ({})));
      expect(game.bunny.wander).not.toBe(Math.PI);
      return structuredClone({ ...game.bunny });
    };
    const ref = wander(hz(60));
    for (const [, frames] of RATES) {
      expect(wander(frames)).toEqual(ref);
    }
  });
});

describe('leash yank and knockdown detection (#2)', () => {
  const reference = runChase(hz(60));

  it.each(RATES)('fires the same knockdowns and yanks on the same steps at %s', (_, frames) => {
    const run = runChase(frames);
    expect(run.knockdowns).toEqual(reference.knockdowns);
    const yanks = (r: Run): string[] => r.events.filter((e) => e.includes(':yank:'));
    expect(yanks(run)).toEqual(yanks(reference));
    expect(yanks(run).length).toBeGreaterThan(0);
  });

  it('measures the collar speed over one step: a steady run reads the run speed', () => {
    const game = new Game({ seed: 5 });
    game.start();
    const runner = new SimRunner(game);
    // Run straight long enough to reach a steady walk, at a jittered frame rate.
    drive(runner, jittered(3), 2, new Script(() => ({ moveY: 1 })));
    const lc = { ...game.rag.st.lc! };
    runner.frame(H, new Script(() => ({ moveY: 1 })));
    const speed = Math.hypot(game.collar.x - lc.x, game.collar.z - lc.z) / H;
    const dogSpeed = Math.hypot(game.dog.vel.x, game.dog.vel.z);
    // The collar sits ahead of the root and bobs with the gait, so allow a few percent.
    expect(Math.abs(speed - dogSpeed) / dogSpeed).toBeLessThan(0.05);
    expect(speed).toBeGreaterThan(RAGDOLL.yankCollarSpeed);
  });
});

describe('edge inputs through the runner', () => {
  const PRESS_RATES: [string, Frames][] = [
    ['240 Hz', hz(240)],
    ['144 Hz', hz(144)],
    ['60 Hz', hz(60)],
    ['30 Hz', hz(30)],
    ['15 Hz', hz(15)],
    ['jittered', jittered(11)],
  ];

  function countPresses(frames: Frames, pressFrame: number): Record<string, number> {
    const game = new Game({ seed: 3 });
    game.start();
    const runner = new SimRunner(game);
    const actions = new Actions();
    const counts: Record<string, number> = { jump: 0, lick: 0, miss: 0 };
    game.events.on('jump', () => counts.jump!++);
    game.events.on('lick', () => counts.lick!++);
    game.events.on('miss', () => counts.miss!++);
    drive(runner, frames, 1.5, actions, (f) => {
      if (f === pressFrame) {
        actions.press('jump');
        actions.press('lick');
      }
    });
    return counts;
  }

  it.each(PRESS_RATES)('processes one press exactly once at %s', (_, frames) => {
    // Several press frames, so presses land in frames with 0, 1 and several steps.
    for (let pressFrame = 3; pressFrame < 9; pressFrame++) {
      const c = countPresses(frames, pressFrame);
      expect(c.jump).toBe(1);
      expect(c.lick! + c.miss!).toBe(1);
    }
  });

  it('keeps a press made in a frame that runs no step for the next step', () => {
    const game = new Game({ seed: 3 });
    game.start();
    const runner = new SimRunner(game);
    const actions = new Actions();
    let jumps = 0;
    game.events.on('jump', () => jumps++);
    actions.press('jump');
    expect(runner.frame(H / 4, actions)).toBe(0);
    expect(jumps).toBe(0);
    expect(runner.frame(H, actions)).toBe(1);
    expect(jumps).toBe(1);
    runner.frame(H * 3, actions);
    expect(jumps).toBe(1);
  });

  it('processes a press once when a long frame drops time', () => {
    const game = new Game({ seed: 3 });
    game.start();
    const runner = new SimRunner(game);
    const actions = new Actions();
    let licks = 0;
    game.events.on('miss', () => licks++);
    actions.press('lick');
    expect(runner.frame(1, actions)).toBe(SIM.maxStepsPerFrame);
    expect(runner.stepper.pending).toBe(0);
    runner.frame(1, actions);
    expect(licks).toBe(1);
  });
});

describe('world regeneration with the runner', () => {
  it('snaps to the new round instead of blending from the old world', () => {
    const game = new Game({ seedSource: createRng(21) });
    game.start();
    const runner = new SimRunner(game);
    const worlds: unknown[] = [];
    game.events.on('world', () => worlds.push(game.world));
    drive(runner, hz(60), ROUND_SECONDS + 1, new Script(() => ({ moveY: 1 })));
    expect(game.phase).toBe('over');
    const firstWorld = game.world;
    const firstSeed = game.seed;

    game.start();
    expect(worlds).toHaveLength(1);
    expect(game.world).not.toBe(firstWorld);
    expect(game.seed).not.toBe(firstSeed);
    // Both interpolation ends hold the new round, so whatever alpha is left over renders it exactly.
    const r = runner.render();
    expect(r.dog.x).toBe(game.dog.pos.x);
    expect(r.dog.z).toBe(game.dog.pos.z);
    expect(r.bunny.x).toBe(game.bunny.pos.x);
    expect(r.bunny.z).toBe(game.bunny.pos.z);
  });
});

describe('pause with the runner (#7)', () => {
  it('runs no steps and keeps no backlog while paused', () => {
    const game = new Game({ seed: 5 });
    const runner = new SimRunner(game);
    const input = new Actions();
    game.start();
    runner.frame(0.5 * H, input);
    game.pause();
    const ticks = runner.ticks;
    const timeLeft = game.session.timeLeft;
    for (let i = 0; i < 600; i++) {
      expect(runner.frame(1 / 60, input)).toBe(0);
    }
    // A long frame (a suspended tab) is discarded too.
    expect(runner.frame(SIM.maxFrameDt, input)).toBe(0);
    expect(runner.ticks).toBe(ticks);
    expect(game.session.timeLeft).toBe(timeLeft);
    expect(runner.stepper.pending).toBeLessThan(H);
  });

  it('resumes without a catch-up burst: one frame of time runs one step', () => {
    const game = new Game({ seed: 5 });
    const runner = new SimRunner(game);
    const input = new Actions();
    game.start();
    runner.frame(10 * H + 0.5 * H, input);
    game.pause();
    for (let i = 0; i < 300; i++) {
      runner.frame(1 / 30, input);
    }
    game.resume();
    expect(runner.stepper.pending).toBe(0);
    const ticks = runner.ticks;
    const timeLeft = game.session.timeLeft;
    expect(runner.frame(H, input)).toBe(1);
    expect(runner.ticks).toBe(ticks + 1);
    expect(game.session.timeLeft).toBeCloseTo(timeLeft - H);
  });

  it('keeps the rendered state still while paused', () => {
    const game = new Game({ seed: 5 });
    const runner = new SimRunner(game);
    const input = new Actions();
    game.start();
    input.moveY = 1;
    runner.frame(20 * H + 0.4 * H, input);
    game.pause();
    const before = structuredClone(runner.render());
    runner.frame(0.3, input);
    expect(runner.render()).toEqual(before);
  });
});
