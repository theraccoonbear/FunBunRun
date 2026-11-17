import { describe, expect, it, vi } from 'vitest';
import { Actions, EdgeDetector } from '../../src/input/actions';
import { PAD, pollGamepads, type PadLike } from '../../src/input/gamepad';

function pad(pressed: number[] = [], axes: number[] = [0, 0, 0, 0]): PadLike {
  return {
    index: 0,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
  };
}

function setup(playing = true) {
  const actions = new Actions();
  const edges = new EdgeDetector();
  const onStart = vi.fn();
  const poll = (p: PadLike | null, dt = 1 / 60): void =>
    pollGamepads([p], edges, actions, { isPlaying: () => playing, onStart }, dt);
  return { actions, poll, onStart };
}

describe('pollGamepads', () => {
  it('adds the left stick with a dead zone (y inverted)', () => {
    const { actions, poll } = setup();
    poll(pad([], [0.5, -0.8, 0, 0]));
    expect(actions.moveX).toBe(0.5);
    expect(actions.moveY).toBe(0.8);
    actions.moveX = actions.moveY = 0;
    poll(pad([], [0.1, 0.14, 0, 0]));
    expect([actions.moveX, actions.moveY]).toEqual([0, 0]);
  });

  it('turns the right stick into look deltas scaled by dt', () => {
    const { actions, poll } = setup();
    poll(pad([], [0, 0, 1, -0.5]), 0.1);
    expect(actions.lookX).toBeCloseTo(70);
    expect(actions.lookY).toBeCloseTo(-25);
  });

  it('A jumps in play and starts the game in menus', () => {
    const play = setup(true);
    play.poll(pad([PAD.a]));
    expect(play.actions.jump).toBe(true);
    const menu = setup(false);
    menu.poll(pad([PAD.a]));
    expect(menu.onStart).toHaveBeenCalledOnce();
    expect(menu.actions.jump).toBe(false);
  });

  it('Start begins a round only from menus', () => {
    const menu = setup(false);
    menu.poll(pad([PAD.start]));
    expect(menu.onStart).toHaveBeenCalledOnce();
    const play = setup(true);
    play.poll(pad([PAD.start]));
    expect(play.onStart).not.toHaveBeenCalled();
  });

  it('X or RT lick once per press', () => {
    const { actions, poll } = setup();
    poll(pad([PAD.x]));
    expect(actions.lick).toBe(true);
    actions.endFrame();
    poll(pad([PAD.x]));
    expect(actions.lick).toBe(false);
    poll(pad([]));
    poll(pad([PAD.rt]));
    expect(actions.lick).toBe(true);
  });

  it('X and RT pressed together lick once, not again on the next frame (double-lick regression)', () => {
    const { actions, poll } = setup();
    let licks = 0;
    for (let frame = 0; frame < 5; frame++) {
      poll(pad([PAD.x, PAD.rt]));
      if (actions.lick) {
        licks++;
      }
      actions.endFrame();
    }
    expect(licks).toBe(1);
  });

  it('holds sniff on B/LT and sprint on LB/L3', () => {
    const { actions, poll } = setup();
    poll(pad([PAD.lt, PAD.l3]));
    expect(actions.sniff).toBe(true);
    expect(actions.sprint).toBe(true);
  });

  it('skips empty pad slots', () => {
    const { actions, poll } = setup();
    expect(() => poll(null)).not.toThrow();
    expect(actions.moveX).toBe(0);
  });
});
