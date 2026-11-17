import { describe, expect, it } from 'vitest';
import { INPUT } from '../../src/config';
import { createJoystick, moveJoystick } from '../../src/input/joystick';

const R = INPUT.joystickRadius;

describe('moveJoystick', () => {
  it('ignores a small dead zone near the centre', () => {
    const j = moveJoystick(createJoystick(100, 100), 105, 100);
    expect(j.moveX).toBe(0);
    expect(Math.abs(j.moveY)).toBe(0);
    expect(j.knobX).toBe(5);
  });

  it('maps a full push to magnitude 1; screen up is forward', () => {
    const j = moveJoystick(createJoystick(100, 100), 100, 100 - R);
    expect(j.moveX).toBeCloseTo(0);
    expect(j.moveY).toBeCloseTo(1);
    expect(j.sprint).toBe(false);
  });

  it('rescales past the dead zone linearly', () => {
    const j = moveJoystick(createJoystick(0, 0), R * 0.56, 0);
    expect(j.moveX).toBeCloseTo((0.56 - 0.12) / 0.88);
  });

  it('clamps the knob to the radius and sprints past 1.15 R', () => {
    const j = moveJoystick(createJoystick(0, 0), R * 1.3, 0);
    expect(j.knobX).toBe(R);
    expect(j.moveX).toBeCloseTo(1);
    expect(j.sprint).toBe(true);
    expect(j.originX).toBe(0);
  });

  it('drags the base along once the finger is past 1.6 R', () => {
    const j = moveJoystick(createJoystick(0, 0), R * 3, 0);
    expect(j.originX).toBeCloseTo(R * 3 - R * 1.6);
    expect(j.sprint).toBe(true);
    expect(j.moveX).toBeCloseTo(1);
  });

  it('handles the exact centre', () => {
    const j = moveJoystick(createJoystick(10, 10), 10, 10);
    expect([j.moveX, j.moveY, j.knobX, j.knobY].map(Math.abs)).toEqual([0, 0, 0, 0]);
  });
});
