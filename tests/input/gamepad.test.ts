import { describe, expect, it, vi } from 'vitest';
import { Actions, EdgeDetector } from '../../src/input/actions';
import {
  GLYPHS,
  PAD,
  padFamily,
  PadTracker,
  pollGamepads,
  readPad,
  type PadLike,
} from '../../src/input/gamepad';

function pad(pressed: number[] = [], axes: number[] = [0, 0, 0, 0]): PadLike {
  return {
    index: 0,
    mapping: 'standard',
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
    actions.take();
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
      actions.take();
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

/** A non-standard pad: raw buttons and axes as Linux Firefox reports them. */
function raw(opts: {
  index?: number;
  id?: string;
  buttons: number;
  pressed?: number[];
  axes: number[];
}): PadLike {
  return {
    index: opts.index ?? 0,
    id: opts.id ?? 'generic',
    mapping: '',
    connected: true,
    axes: opts.axes,
    buttons: Array.from({ length: opts.buttons }, (_, i) => ({
      pressed: (opts.pressed ?? []).includes(i),
    })),
  };
}

// Linux evdev rest state: sticks centred, triggers at -1, hat centred.
const EVDEV_REST = [0, 0, -1, 0, 0, -1, 0, 0];

describe('readPad mapping', () => {
  it('uses standard indices when mapping is standard', () => {
    const s = readPad(pad([PAD.a, PAD.x, PAD.lt, PAD.up], [0.5, -0.5, 0.3, -0.4]));
    expect(s).toMatchObject({
      moveX: 0.5,
      moveY: 0.5,
      lookX: 0.3,
      lookY: -0.4,
      south: true,
      west: true,
      lt: true,
      rt: false,
      up: true,
    });
  });

  it('xpad layout (11 buttons, 8 axes): right stick on 3/4, triggers on axes, Start 7', () => {
    const id = '045e-028e-Microsoft X-Box 360 pad';
    const rest = readPad(raw({ id, buttons: 11, axes: EVDEV_REST }));
    // Resting triggers at -1 must not read as a camera turn or a press.
    expect(rest).toMatchObject({ lookX: 0, lookY: 0, lt: false, rt: false, start: false });
    const s = readPad(
      raw({ id, buttons: 11, pressed: [2, 7, 9], axes: [0, 0, 1, 0.8, -0.6, 1, 0, -1] }),
    );
    expect(s).toMatchObject({
      lookX: 0.8,
      lookY: -0.6,
      west: true,
      lt: true,
      rt: true,
      start: true,
      l3: true,
      up: true,
      down: false,
    });
  });

  it('hid-sony layout (13 buttons): square is the left face button, Options is 9, L3 is 11', () => {
    const id = '054c-09cc-Sony Interactive Entertainment Wireless Controller';
    const s = readPad(raw({ id, buttons: 13, pressed: [3, 9, 11], axes: EVDEV_REST }));
    expect(s).toMatchObject({ west: true, start: true, l3: true, lt: false });
    // Button 2 (triangle) does not lick.
    expect(readPad(raw({ id, buttons: 13, pressed: [2], axes: EVDEV_REST })).west).toBe(false);
    // Button 7 (R2 digital) does not open the menu.
    expect(readPad(raw({ id, buttons: 13, pressed: [7], axes: EVDEV_REST })).start).toBe(false);
  });

  it('DirectInput-style pads (4 axes): right stick on 2/3, triggers as buttons 6/7', () => {
    const s = readPad(raw({ buttons: 12, pressed: [6, 7, 9, 10], axes: [0, 0, 0.9, 0.5] }));
    expect(s).toMatchObject({ lookX: 0.9, lookY: 0.5, lt: true, rt: true, start: true, l3: true });
  });

  it('applies the dead zone to every stick', () => {
    const s = readPad(raw({ buttons: 11, axes: [0.1, -0.1, -1, 0.14, -0.14, -1, 0, 0] }));
    expect([s.moveX, s.moveY, s.lookX, s.lookY].every((v) => v === 0)).toBe(true);
  });
});

describe('controller families and glyphs', () => {
  it.each([
    ['Xbox 360 Controller (XInput STANDARD GAMEPAD)', 'xbox'],
    ['045e-0b13-Xbox Wireless Controller', 'xbox'],
    ['Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', 'xbox'],
    ['DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', 'playstation'],
    ['054c-05c4-Sony Computer Entertainment Wireless Controller', 'playstation'],
    ['Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)', 'playstation'],
    ['Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)', 'nintendo'],
    ['057e-2009-Nintendo Switch Pro Controller', 'nintendo'],
    ['USB Gamepad (Vendor: 0079 Product: 0011)', 'generic'],
    ['', 'generic'],
  ])('%s -> %s', (id, family) => {
    expect(padFamily(id)).toBe(family);
  });

  it('labels the same positions per family', () => {
    expect([GLYPHS.xbox.jump, GLYPHS.xbox.lick, GLYPHS.xbox.sniff]).toEqual(['A', 'X', 'B']);
    expect([GLYPHS.playstation.jump, GLYPHS.playstation.lick, GLYPHS.playstation.sniff]).toEqual([
      '\u2715',
      '\u25A1',
      '\u25CB',
    ]);
    expect([GLYPHS.nintendo.jump, GLYPHS.nintendo.lick, GLYPHS.nintendo.sniff]).toEqual([
      'B',
      'Y',
      'A',
    ]);
  });
});

describe('PadTracker', () => {
  const idle = (index: number): PadLike => ({ ...pad(), index, connected: true });
  const pressing = (index: number): PadLike => ({ ...pad([PAD.a]), index, connected: true });

  it('starts on the first connected pad and switches to the one most recently used', () => {
    const t = new PadTracker();
    expect(t.select([null, idle(1), idle(2)])?.index).toBe(1);
    expect(t.select([null, idle(1), pressing(2)])?.index).toBe(2);
    // Stays on pad 2 when both go idle.
    expect(t.select([null, idle(1), idle(2)])?.index).toBe(2);
    expect(t.select([null, pressing(1), idle(2)])?.index).toBe(1);
  });

  it('falls back when the active pad disconnects, and reports none when all are gone', () => {
    const t = new PadTracker();
    t.select([idle(0), pressing(1)]);
    expect(t.active).toBe(1);
    expect(t.select([idle(0), { ...idle(1), connected: false }])?.index).toBe(0);
    expect(t.select([null, null])).toBeNull();
    expect(t.active).toBeNull();
  });

  it('pollGamepads reads only the active pad', () => {
    const actions = new Actions();
    const edges = new EdgeDetector();
    const t = new PadTracker();
    const hooks = { isPlaying: () => true, onStart: vi.fn() };
    const a = { ...pad([], [1, 0, 0, 0]), index: 0 };
    const b = { ...pad([], [0, 0, 0, 0]), index: 1 };
    pollGamepads([a, b], edges, actions, hooks, 1 / 60, t);
    expect(actions.moveX).toBe(1);
    actions.moveX = 0;
    // Pad 1 jumps: it becomes active, and pad 0's stick is ignored.
    pollGamepads([a, { ...b, buttons: pad([PAD.a]).buttons }], edges, actions, hooks, 1 / 60, t);
    expect(t.active).toBe(1);
    expect(actions.moveX).toBe(0);
    expect(actions.jump).toBe(true);
  });
});
