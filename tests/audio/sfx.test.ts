import { describe, expect, it, vi } from 'vitest';
import { attachAudioUnlock, createSfx, type AudioContextLike } from '../../src/audio/sfx';

type Call = [string, ...unknown[]];

/** Records every scheduling call; enough of AudioContext for sfx.ts. */
class FakeParam {
  value = 0;
  constructor(
    private readonly log: Call[],
    private readonly name: string,
  ) {}
  setValueAtTime(v: number, t: number): void {
    this.log.push([this.name + '.set', v, t]);
  }
  exponentialRampToValueAtTime(v: number, t: number): void {
    this.log.push([this.name + '.ramp', v, t]);
  }
}

class FakeNode {
  connected: unknown[] = [];
  connect(n: unknown): void {
    this.connected.push(n);
  }
}

class FakeContext {
  currentTime = 10;
  state: AudioContextState = 'suspended';
  readonly destination = new FakeNode();
  onstatechange: (() => void) | null = null;
  readonly log: Call[] = [];
  readonly gains: { gain: FakeParam }[] = [];
  /** Whether resume() succeeds, as it does inside a user gesture. */
  allowResume = true;
  resumeCalls = 0;

  resume(): Promise<void> {
    this.resumeCalls++;
    if (!this.allowResume) {
      return new Promise(() => {});
    }
    this.state = 'running';
    this.onstatechange?.();
    return Promise.resolve();
  }
  createOscillator() {
    const log = this.log;
    const o = Object.assign(new FakeNode(), {
      type: 'sine',
      frequency: new FakeParam(log, 'freq'),
      start: (t: number) => log.push(['start', o.type, t]),
      stop: (t: number) => log.push(['stop', t]),
    });
    return o;
  }
  createGain() {
    const g = Object.assign(new FakeNode(), { gain: new FakeParam(this.log, 'gain') });
    this.gains.push(g);
    return g;
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { type: 'lowpass', frequency: { value: 0 } });
  }
}

function setup(opts: { allowResume?: boolean; muted?: boolean } = {}) {
  const ctx = new FakeContext();
  ctx.allowResume = opts.allowResume ?? true;
  const create = vi.fn(() => ctx as unknown as AudioContextLike);
  const sfx = createSfx({ createContext: create, muted: opts.muted ?? false });
  return { ctx, sfx, create };
}

const starts = (ctx: FakeContext) => ctx.log.filter((c) => c[0] === 'start');

describe('audio unlock', () => {
  it('is locked until unlocked, then creates the context once and resumes it', () => {
    const { ctx, sfx, create } = setup();
    expect(sfx.locked).toBe(true);
    expect(create).not.toHaveBeenCalled();
    sfx.unlock();
    expect(sfx.locked).toBe(false);
    sfx.unlock();
    expect(create).toHaveBeenCalledOnce();
    expect(ctx.resumeCalls).toBe(1);
  });

  it('stays locked when the resume is refused (no gesture) and retries on the next gesture', () => {
    const { ctx, sfx } = setup({ allowResume: false });
    const changes = vi.fn();
    sfx.onChange = changes;
    sfx.unlock();
    expect(sfx.locked).toBe(true);
    const target = new EventTarget();
    attachAudioUnlock(target, sfx);
    ctx.allowResume = true;
    target.dispatchEvent(new Event('touchend'));
    expect(sfx.locked).toBe(false);
    expect(changes).toHaveBeenCalled();
    // Once running, gestures no longer call resume().
    const calls = ctx.resumeCalls;
    target.dispatchEvent(new Event('keydown'));
    target.dispatchEvent(new Event('pointerdown'));
    expect(ctx.resumeCalls).toBe(calls);
  });

  it('unlocks on pointerdown, keydown and touchend', () => {
    for (const type of ['pointerdown', 'keydown', 'touchend']) {
      const { sfx } = setup();
      const target = new EventTarget();
      attachAudioUnlock(target, sfx);
      target.dispatchEvent(new Event(type));
      expect(sfx.locked).toBe(false);
    }
  });

  it('survives a missing or throwing AudioContext', () => {
    expect(() => createSfx({ createContext: () => null }).unlock()).not.toThrow();
    const broken = createSfx({
      createContext: () => {
        throw new Error('no audio');
      },
    });
    broken.unlock();
    expect(broken.locked).toBe(true);
    expect(() => broken.slurp()).not.toThrow();
  });

  it('init() is the same as unlock()', () => {
    const { sfx } = setup();
    sfx.init();
    expect(sfx.locked).toBe(false);
  });
});

describe('sound scheduling', () => {
  it('schedules both parts of the slurp on the audio clock, 160 ms apart, without timers', () => {
    vi.useFakeTimers();
    try {
      const { ctx, sfx } = setup();
      sfx.unlock();
      sfx.slurp();
      expect(vi.getTimerCount()).toBe(0);
      expect(starts(ctx)).toEqual([
        ['start', 'sawtooth', 10],
        ['start', 'sine', 10.16],
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the tone envelope: sweep, 30 ms attack, decay, stop 20 ms after', () => {
    const { ctx, sfx } = setup();
    sfx.unlock();
    sfx.tone('square', 660, 1320, 0.15, 0.1, 0.5);
    const t = 10.5;
    expect(ctx.log).toEqual([
      ['freq.set', 660, t],
      ['freq.ramp', 1320, t + 0.15],
      ['gain.set', 0.0001, t],
      ['gain.ramp', 0.1, t + 0.03],
      ['gain.ramp', 0.0001, t + 0.15],
      ['start', 'square', t],
      ['stop', t + 0.15 + 0.02],
    ]);
  });

  it('plays each effect with its prototype waveform', () => {
    const { ctx, sfx } = setup();
    sfx.unlock();
    sfx.miss();
    sfx.bone();
    sfx.jump();
    sfx.oof();
    expect(starts(ctx).map((c) => c[1])).toEqual(['triangle', 'square', 'sine', 'sawtooth']);
  });

  it('plays nothing before the context exists', () => {
    const { ctx, sfx } = setup();
    sfx.slurp();
    expect(ctx.log).toEqual([]);
  });
});

describe('mute', () => {
  it('silences the master gain and skips new sounds; unmuting restores them', () => {
    const { ctx, sfx } = setup({ muted: true });
    sfx.unlock();
    const master = ctx.gains[0]!;
    expect(master.gain.value).toBe(0);
    sfx.jump();
    expect(starts(ctx)).toEqual([]);
    sfx.muted = false;
    expect(master.gain.value).toBe(1);
    sfx.jump();
    expect(starts(ctx)).toHaveLength(1);
    sfx.muted = true;
    expect(master.gain.value).toBe(0);
    expect(sfx.muted).toBe(true);
  });
});
