import { describe, expect, it, vi } from 'vitest';
import { Actions, EdgeDetector } from '../../src/input/actions';
import { Keyboard } from '../../src/input/keyboard';

describe('Actions', () => {
  it('latches edge actions until the end of the frame', () => {
    const a = new Actions();
    a.press('lick');
    a.press('lick');
    expect(a.lick).toBe(true);
    expect(a.jump).toBe(false);
    a.endFrame();
    expect(a.lick).toBe(false);
  });

  it('accumulates look deltas between frames and clears them after', () => {
    const a = new Actions();
    a.addLook(3, 1);
    a.addLook(2, -4);
    expect([a.lookX, a.lookY]).toEqual([5, -3]);
    a.endFrame();
    expect([a.lookX, a.lookY]).toEqual([0, 0]);
  });
});

describe('EdgeDetector', () => {
  it('fires once per press', () => {
    const e = new EdgeDetector();
    expect(e.edge('a', false)).toBe(false);
    expect(e.edge('a', true)).toBe(true);
    expect(e.edge('a', true)).toBe(false);
    expect(e.edge('a', false)).toBe(false);
    expect(e.edge('a', true)).toBe(true);
  });

  it('tracks keys independently', () => {
    const e = new EdgeDetector();
    expect(e.edge('a', true)).toBe(true);
    expect(e.edge('b', true)).toBe(true);
  });
});

describe('Keyboard', () => {
  function setup(playing = true) {
    const a = new Actions();
    const onStart = vi.fn();
    const kb = new Keyboard(a, { onStart, isPlaying: () => playing });
    return { a, kb, onStart };
  }

  it('maps held keys to movement, turning, sprint and sniff', () => {
    const { a, kb } = setup();
    for (const k of ['KeyW', 'KeyD', 'ArrowLeft', 'ShiftLeft', 'KeyQ']) {
      kb.down(k);
    }
    kb.apply();
    expect(a).toMatchObject({ moveX: 1, moveY: 1, turn: 1, sprint: true, sniff: true });
    kb.up('KeyW');
    kb.down('ArrowDown');
    kb.apply();
    expect(a.moveY).toBe(-1);
    kb.clear();
    kb.apply();
    expect(a).toMatchObject({ moveX: 0, moveY: 0, turn: 0, sprint: false, sniff: false });
  });

  it('latches jump and lick once per physical press, ignoring auto-repeat', () => {
    const { a, kb } = setup();
    kb.down('Space');
    expect(a.jump).toBe(true);
    a.endFrame();
    kb.down('Space'); // auto-repeat
    expect(a.jump).toBe(false);
    kb.up('Space');
    kb.down('KeyE');
    expect(a.lick).toBe(true);
    a.endFrame();
    kb.down('KeyF');
    expect(a.lick).toBe(true);
  });

  it('starts from Enter only outside play', () => {
    const menu = setup(false);
    menu.kb.down('Enter');
    expect(menu.onStart).toHaveBeenCalledOnce();
    const play = setup(true);
    play.kb.down('Enter');
    expect(play.onStart).not.toHaveBeenCalled();
  });

  it('asks to suppress the browser default for space and arrows only', () => {
    const { kb } = setup();
    expect(kb.down('Space')).toBe(true);
    expect(kb.down('ArrowUp')).toBe(true);
    expect(kb.down('KeyW')).toBe(false);
  });
});
