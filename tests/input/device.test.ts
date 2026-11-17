import { describe, expect, it, vi } from 'vitest';
import {
  attachDeviceDetection,
  deviceFromPointerType,
  InputDeviceTracker,
  padHasInput,
} from '../../src/input/device';

describe('deviceFromPointerType', () => {
  it('maps pointer types to devices', () => {
    expect(deviceFromPointerType('mouse')).toBe('mouse');
    expect(deviceFromPointerType('touch')).toBe('touch');
    expect(deviceFromPointerType('pen')).toBe('touch');
    expect(deviceFromPointerType('')).toBeNull();
  });
});

describe('padHasInput', () => {
  const pad = (axes: number[], pressed: boolean) => ({ axes, buttons: [{ pressed }] });

  it('ignores idle and missing pads', () => {
    expect(padHasInput([], 0.15)).toBe(false);
    expect(padHasInput([null, pad([0.05, -0.1], false)], 0.15)).toBe(false);
  });

  it('detects a pressed button or a pushed stick', () => {
    expect(padHasInput([pad([0, 0], true)], 0.15)).toBe(true);
    expect(padHasInput([pad([0, -0.6], false)], 0.15)).toBe(true);
  });
});

describe('InputDeviceTracker', () => {
  it('starts from the initial guess', () => {
    const t = new InputDeviceTracker('touch');
    expect(t.device).toBe('touch');
    expect(t.isTouch).toBe(true);
  });

  it('switches on the last-used device and reports changes only', () => {
    const t = new InputDeviceTracker('touch');
    const seen: string[] = [];
    t.onChange((d) => seen.push(d));
    expect(t.note('touch')).toBe(false);
    expect(t.note('mouse')).toBe(true);
    expect(t.note('mouse')).toBe(false);
    expect(t.isTouch).toBe(false);
    expect(t.note('gamepad')).toBe(true);
    expect(t.note('touch')).toBe(true);
    expect(seen).toEqual(['mouse', 'gamepad', 'touch']);
  });

  it('stops notifying after unsubscribe', () => {
    const t = new InputDeviceTracker('mouse');
    const fn = vi.fn();
    const off = t.onChange(fn);
    off();
    t.note('touch');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('attachDeviceDetection', () => {
  function setup(): { win: EventTarget; tracker: InputDeviceTracker } {
    const win = new EventTarget();
    const tracker = new InputDeviceTracker('touch');
    attachDeviceDetection(win as unknown as Window, tracker);
    return { win, tracker };
  }
  const ptr = (type: string, pointerType: string): Event =>
    Object.assign(new Event(type), { pointerType });

  it('follows pointer types, mouse movement and keys', () => {
    const { win, tracker } = setup();
    win.dispatchEvent(ptr('pointermove', 'mouse'));
    expect(tracker.device).toBe('mouse');
    win.dispatchEvent(ptr('pointerdown', 'touch'));
    expect(tracker.device).toBe('touch');
    win.dispatchEvent(new Event('keydown'));
    expect(tracker.device).toBe('mouse');
    win.dispatchEvent(ptr('pointerdown', 'pen'));
    expect(tracker.device).toBe('touch');
    win.dispatchEvent(ptr('pointerdown', 'mouse'));
    expect(tracker.device).toBe('mouse');
  });

  it('does not switch to touch on touch moves', () => {
    const { win, tracker } = setup();
    tracker.note('mouse');
    win.dispatchEvent(ptr('pointermove', 'touch'));
    expect(tracker.device).toBe('mouse');
  });
});
