/** Synthesized sound effects (Web Audio), as in the prototype. */

type Webkit = typeof window & { webkitAudioContext?: typeof AudioContext };

export interface Sfx {
  /** Creates or resumes the audio context; call from a user gesture. */
  init(): void;
  slurp(): void;
  miss(): void;
  bone(): void;
  jump(): void;
  oof(): void;
}

export function createSfx(): Sfx {
  let ac: AudioContext | null = null;

  function tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number): void {
    if (!ac) {
      return;
    }
    const t = ac.currentTime;
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
    g.connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  return {
    init() {
      try {
        const Ctor = window.AudioContext ?? (window as Webkit).webkitAudioContext;
        ac ??= Ctor ? new Ctor() : null;
        void ac?.resume?.();
      } catch {
        ac = null;
      }
    },
    slurp() {
      tone('sawtooth', 520, 130, 0.3, 0.25);
      setTimeout(() => tone('sine', 900, 1500, 0.12, 0.15), 160);
    },
    miss: () => tone('triangle', 260, 160, 0.12, 0.12),
    bone: () => tone('square', 660, 1320, 0.15, 0.1),
    jump: () => tone('sine', 300, 520, 0.12, 0.08),
    oof: () => tone('sawtooth', 220, 90, 0.35, 0.2),
  };
}
