import { describe, expect, it } from 'vitest';
import { Game } from '../../src/sim/game';
import {
  ESC_RESUME_GRACE_MS,
  PAUSE_ITEMS,
  PauseController,
  pauseHtml,
  wrapIndex,
  type PauseHost,
} from '../../src/ui/pause';

function setup(opts: { locked?: boolean } = {}) {
  const game = new Game({ seed: 3 });
  const calls: string[] = [];
  let now = 1000;
  let locked = opts.locked ?? false;
  const host: PauseHost = {
    phase: () => game.phase,
    pause: () => game.pause(),
    resume: () => game.resume(),
    quit: () => game.quit(),
    restart: () => {
      calls.push('restart');
      game.start();
    },
    suspendAudio: () => calls.push('suspendAudio'),
    resumeAudio: () => calls.push('resumeAudio'),
    resetClock: () => calls.push('resetClock'),
    showOverlay: () => calls.push('show'),
    hideOverlay: () => calls.push('hide'),
    pointerLocked: () => locked,
    releasePointer: () => {
      calls.push('release');
      locked = false;
    },
    lockPointer: () => calls.push('lock'),
    now: () => now,
  };
  const ctrl = new PauseController(host);
  return {
    game,
    ctrl,
    calls,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('PauseController', () => {
  it('ignores pause requests outside play', () => {
    const { game, ctrl, calls } = setup();
    for (const reason of ['hidden', 'blur', 'pointerlock', 'disconnect'] as const) {
      expect(ctrl.pause(reason)).toBe(false);
    }
    expect(game.phase).toBe('menu');
    expect(calls).toEqual([]);
  });

  it('pauses: releases the pointer, suspends audio and shows the overlay', () => {
    const { game, ctrl, calls } = setup();
    game.start();
    expect(ctrl.pause('hidden')).toBe(true);
    expect(game.phase).toBe('paused');
    expect(ctrl.reason).toBe('hidden');
    expect(calls).toEqual(['release', 'suspendAudio', 'show']);
    // A second trigger (blur after hidden) changes nothing.
    expect(ctrl.pause('blur')).toBe(false);
    expect(ctrl.reason).toBe('hidden');
  });

  it('resumes: hides the overlay, resumes audio and resets the frame clock', () => {
    const { game, ctrl, calls } = setup();
    game.start();
    ctrl.pause('blur');
    calls.length = 0;
    expect(ctrl.resume(true)).toBe(true);
    expect(game.phase).toBe('play');
    expect(ctrl.reason).toBeNull();
    expect(calls).toEqual(['hide', 'resumeAudio', 'resetClock']);
    expect(ctrl.resume(true)).toBe(false);
  });

  it('re-locks the pointer on resume only from a gesture and only if it was locked', () => {
    const locked = setup({ locked: true });
    locked.game.start();
    locked.ctrl.pause('key');
    locked.ctrl.resume(true);
    expect(locked.calls).toContain('lock');

    const pad = setup({ locked: true });
    pad.game.start();
    pad.ctrl.pause('gamepad');
    pad.ctrl.resume(false);
    expect(pad.calls).not.toContain('lock');

    const free = setup();
    free.game.start();
    free.ctrl.pause('key');
    free.ctrl.resume(true);
    expect(free.calls).not.toContain('lock');

    // The pointer-lock trigger fires after the lock is gone, so it says so explicitly.
    const esc = setup();
    esc.game.start();
    esc.ctrl.pause('pointerlock', true);
    esc.ctrl.resume(true);
    expect(esc.calls).toContain('lock');
  });

  it('toggle() pauses in play and resumes when paused', () => {
    const { game, ctrl } = setup();
    game.start();
    ctrl.toggle('gamepad', false);
    expect(game.phase).toBe('paused');
    ctrl.toggle('gamepad', false);
    expect(game.phase).toBe('play');
  });

  it('Esc right after a pointer-lock pause does not resume; later it does', () => {
    const { game, ctrl, advance } = setup();
    game.start();
    ctrl.pause('pointerlock', true);
    advance(ESC_RESUME_GRACE_MS / 2);
    ctrl.escape();
    expect(game.phase).toBe('paused');
    advance(ESC_RESUME_GRACE_MS);
    ctrl.escape();
    expect(game.phase).toBe('play');
    ctrl.escape();
    expect(game.phase).toBe('paused');
    expect(ctrl.reason).toBe('key');
  });

  it('overlay choices: resume, restart and quit', () => {
    const r = setup();
    r.game.start();
    r.ctrl.pause('key');
    r.ctrl.choose('resume', true);
    expect(r.game.phase).toBe('play');

    const s = setup();
    s.game.start();
    for (let i = 0; i < 60; i++) {
      s.game.update(1 / 60, {
        moveX: 0,
        moveY: 1,
        lookX: 0,
        lookY: 0,
        turn: 0,
        sprint: false,
        jump: false,
        lick: false,
      });
    }
    const left = s.game.session.timeLeft;
    s.ctrl.pause('key');
    s.calls.length = 0;
    s.ctrl.choose('restart', true);
    expect(s.game.phase).toBe('play');
    expect(s.game.session.timeLeft).toBeGreaterThan(left);
    expect(s.calls).toEqual(['restart', 'hide', 'resumeAudio', 'resetClock']);

    const q = setup();
    q.game.start();
    q.ctrl.pause('key');
    q.calls.length = 0;
    q.ctrl.choose('quit', true);
    expect(q.game.phase).toBe('menu');
    expect(q.calls).toEqual(['hide', 'resumeAudio', 'resetClock']);
    // Choices do nothing when not paused.
    q.ctrl.choose('restart', true);
    expect(q.game.phase).toBe('menu');
  });
});

describe('pause overlay helpers', () => {
  it('lists Resume, Restart and Quit as buttons, Resume first', () => {
    expect(PAUSE_ITEMS.map((i) => i.choice)).toEqual(['resume', 'restart', 'quit']);
    const html = pauseHtml();
    expect(html).toContain('<h1>Paused</h1>');
    expect(html.match(/<button/g)).toHaveLength(3);
    expect(html.indexOf('Resume')).toBeLessThan(html.indexOf('Restart'));
    expect(html).toContain("data-choice='quit'");
  });

  it('wraps the focus index both ways', () => {
    expect(wrapIndex(0, -1, 3)).toBe(2);
    expect(wrapIndex(2, 1, 3)).toBe(0);
    expect(wrapIndex(1, 1, 3)).toBe(2);
  });
});
