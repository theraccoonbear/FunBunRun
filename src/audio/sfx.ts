/**
 * Synthesized sound effects (Web Audio), as in the prototype.
 *
 * Every sound, including the delayed parts of multi-part sounds, is scheduled
 * on the AudioContext clock (`currentTime` plus an offset), never with
 * setTimeout, so timing does not drift and background-tab timer throttling
 * cannot reorder or bunch the parts (#8).
 */

type Webkit = typeof window & { webkitAudioContext?: typeof AudioContext };

/** The parts of AudioContext used here, so tests can pass a fake. */
export type AudioContextLike = Pick<
  AudioContext,
  | 'currentTime'
  | 'state'
  | 'destination'
  | 'resume'
  | 'createOscillator'
  | 'createGain'
  | 'createBiquadFilter'
> & {
  onstatechange: ((this: BaseAudioContext, ev: Event) => unknown) | null;
};

export interface Sfx {
  /**
   * Creates the audio context if needed and asks it to resume. Call it from
   * every user gesture (see attachAudioUnlock) and when a round starts.
   * Browsers only allow the resume inside a user gesture (key, click, tap);
   * from a gamepad press it may stay suspended, which `locked` reports.
   */
  unlock(): void;
  /** Kept for callers of the old API: same as unlock(). */
  init(): void;
  /** True while sound cannot play because the context is missing or not running. */
  readonly locked: boolean;
  muted: boolean;
  /** Called whenever `locked` may have changed. */
  onChange: (() => void) | null;
  /**
   * Plays one tone: an oscillator of `type` sweeping from `f0` to `f1` Hz over
   * `dur` seconds at peak gain `vol`, through a 1400 Hz low-pass, starting
   * `delay` seconds from now on the audio clock. Exposed for new sounds.
   */
  tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    vol: number,
    delay?: number,
  ): void;
  slurp(): void;
  miss(): void;
  bone(): void;
  jump(): void;
  oof(): void;
}

function browserContext(): AudioContextLike | null {
  const Ctor =
    typeof window === 'undefined'
      ? undefined
      : (window.AudioContext ?? (window as Webkit).webkitAudioContext);
  return Ctor ? new Ctor() : null;
}

export interface SfxOptions {
  /** Creates the context; defaults to the browser's AudioContext. */
  createContext?: () => AudioContextLike | null;
  muted?: boolean;
}

export function createSfx(opts: SfxOptions = {}): Sfx {
  const createContext = opts.createContext ?? browserContext;
  let ac: AudioContextLike | null = null;
  let master: GainNode | null = null;
  let muted = opts.muted ?? false;

  const notify = (): void => sfx.onChange?.();

  function ensureContext(): AudioContextLike | null {
    if (ac) {
      return ac;
    }
    try {
      ac = createContext();
    } catch {
      ac = null;
    }
    if (ac) {
      master = ac.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ac.destination);
      ac.onstatechange = notify;
    }
    return ac;
  }

  function tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    vol: number,
    delay = 0,
  ): void {
    if (!ac || !master || muted) {
      return;
    }
    const t = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    const f = ac.createBiquadFilter();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.type = 'lowpass';
    f.frequency.value = 1400;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f);
    f.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  const sfx: Sfx = {
    onChange: null,
    unlock() {
      const ctx = ensureContext();
      if (ctx && ctx.state !== 'running') {
        try {
          void ctx.resume().then(notify, () => {});
        } catch {
          /* still locked; the next gesture tries again */
        }
      }
      notify();
    },
    init() {
      sfx.unlock();
    },
    get locked() {
      return !ac || ac.state !== 'running';
    },
    get muted() {
      return muted;
    },
    set muted(m: boolean) {
      muted = m;
      if (master) {
        master.gain.value = m ? 0 : 1;
      }
      notify();
    },
    tone,
    slurp() {
      tone('sawtooth', 520, 130, 0.3, 0.25);
      tone('sine', 900, 1500, 0.12, 0.15, 0.16);
    },
    miss: () => tone('triangle', 260, 160, 0.12, 0.12),
    bone: () => tone('square', 660, 1320, 0.15, 0.1),
    jump: () => tone('sine', 300, 520, 0.12, 0.08),
    oof: () => tone('sawtooth', 220, 90, 0.35, 0.2),
  };
  return sfx;
}

/** User-gesture events that browsers accept for starting audio. */
export const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchend'] as const;

/**
 * Calls `sfx.unlock()` on every pointerdown, keydown and touchend while the
 * context is locked (the context can be suspended again later, e.g. by an
 * iOS audio interruption). Listens in the capture phase so handlers that stop
 * propagation cannot swallow the gesture.
 */
export function attachAudioUnlock(target: EventTarget, sfx: Pick<Sfx, 'unlock' | 'locked'>): void {
  const onGesture = (): void => {
    if (sfx.locked) {
      sfx.unlock();
    }
  };
  for (const type of UNLOCK_EVENTS) {
    target.addEventListener(type, onGesture, { capture: true, passive: true });
  }
}
