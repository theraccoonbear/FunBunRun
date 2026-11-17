import { Session } from 'node:inspector';
import { describe, expect, it } from 'vitest';
import { SIM } from '../../src/config';
import { Actions } from '../../src/input/actions';
import { Game } from '../../src/sim/game';
import { SimRunner } from '../../src/sim/runner';

/**
 * Steady-state allocation checks for the simulation hot path. Heap-size
 * deltas are too noisy to assert on (JIT code and collector timing swing them
 * by megabytes), so this uses V8's sampling heap profiler at a 1-byte
 * interval, which attributes every allocation, including ones already
 * collected, to the function that made it. Only frames from `src/` count.
 */

interface ProfileNode {
  callFrame: { functionName: string; url: string; lineNumber: number };
  selfSize: number;
  children: ProfileNode[];
}

interface SamplingProfile {
  profile: { head: ProfileNode };
}

function post(session: Session, method: string, params?: object): Promise<unknown> {
  return new Promise((resolve, reject) => {
    session.post(method, params, (err, result) => (err ? reject(err) : resolve(result)));
  });
}

/** Bytes allocated by `src/` code while `work` runs, and the top allocating functions. */
async function srcAllocations(work: () => void): Promise<{ bytes: number; top: string }> {
  const session = new Session();
  session.connect();
  await post(session, 'HeapProfiler.startSampling', {
    samplingInterval: 1,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  });
  work();
  const { profile } = (await post(session, 'HeapProfiler.stopSampling')) as SamplingProfile;
  session.disconnect();
  const perFn = new Map<string, number>();
  const walk = (n: ProfileNode): void => {
    if (n.callFrame.url.includes('/src/') && n.selfSize > 0) {
      const k =
        n.callFrame.functionName +
        ' ' +
        n.callFrame.url.split('/src/')[1] +
        ':' +
        n.callFrame.lineNumber;
      perFn.set(k, (perFn.get(k) ?? 0) + n.selfSize);
    }
    n.children.forEach(walk);
  };
  walk(profile.head);
  const entries = [...perFn.entries()].sort((a, b) => b[1] - a[1]);
  return {
    bytes: entries.reduce((sum, e) => sum + e[1], 0),
    top: entries
      .slice(0, 8)
      .map((e) => e[0] + ' = ' + e[1])
      .join('\n'),
  };
}

const STEPS = 600;
/** One step per frame. */
const FRAME = SIM.step;
/**
 * Bytes the steady-state steps may allocate in `src/` over the measured window
 * (1 KB per step). Before this was fixed the same window allocated about 14 MB;
 * what remains is occasional event objects and V8 number boxing.
 */
const BUDGET_BYTES = 600 * 1024;

function drive(actions: Actions, runner: SimRunner, frames: number, from: number): void {
  for (let i = from; i < from + frames; i++) {
    actions.moveY = 1;
    actions.moveX = Math.sin(i * 0.05);
    actions.sprint = i % 200 < 60;
    if (i % 90 === 0) {
      actions.press('jump');
    }
    if (i % 70 === 0) {
      actions.press('lick');
    }
    actions.addLook(Math.cos(i * 0.1) * 3, 0);
    runner.frame(FRAME, actions);
    runner.render();
  }
}

describe('hot path allocations', () => {
  it('allocates (almost) nothing in src/ over 600 steady-state steps', async () => {
    const game = new Game({ seed: 12345 });
    const runner = new SimRunner(game);
    const actions = new Actions();
    game.start();
    // Warm up: first-time allocations (lazily sized arrays, first ragdoll step).
    drive(actions, runner, 6 * STEPS, 0);
    const { bytes, top } = await srcAllocations(() => drive(actions, runner, STEPS, 6 * STEPS));
    if (process.env['FBR_PRINT_ALLOC']) {
      console.log('src/ allocation over ' + STEPS + ' steps: ' + bytes + ' bytes\n' + top);
    }
    expect(runner.ticks).toBeGreaterThanOrEqual(7 * STEPS);
    expect(bytes, top).toBeLessThan(BUDGET_BYTES);
  });

  it('reuses the interpolation buffers and the step input object', () => {
    const game = new Game({ seed: 7 });
    const runner = new SimRunner(game);
    const actions = new Actions();
    game.start();
    drive(actions, runner, 30, 0);
    const view = runner.render();
    const dog = view.dog;
    const pts = view.pts;
    const input = actions.take();
    drive(actions, runner, 120, 30);
    expect(runner.render()).toBe(view);
    expect(runner.render().dog).toBe(dog);
    expect(runner.render().pts).toBe(pts);
    expect(actions.take()).toBe(input);
  });
});
