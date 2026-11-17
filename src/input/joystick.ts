import { INPUT } from '../config';

/** Floating virtual joystick state, in screen pixels. */
export interface Joystick {
  /** Base centre; follows the finger when it drifts too far. */
  originX: number;
  originY: number;
  /** Movement output, x right and y up (forward), magnitude 0..1. */
  moveX: number;
  moveY: number;
  sprint: boolean;
  /** Knob offset from the base centre, clamped to the radius. */
  knobX: number;
  knobY: number;
}

export function createJoystick(x: number, y: number): Joystick {
  return { originX: x, originY: y, moveX: 0, moveY: 0, sprint: false, knobX: 0, knobY: 0 };
}

/**
 * Updates the joystick for a finger at (px, py). Past `follow * radius`
 * the base is dragged along so the stick never runs out; past
 * `sprint * radius` the dog sprints. A small dead zone near the centre
 * is removed and the rest rescaled to 0..1.
 */
export function moveJoystick(
  j: Joystick,
  px: number,
  py: number,
  radius = INPUT.joystickRadius,
): Joystick {
  let dx = px - j.originX;
  let dy = py - j.originY;
  const d = Math.sqrt(dx * dx + dy * dy);
  const follow = radius * INPUT.joystickFollow;
  if (d > follow) {
    const k = (d - follow) / d;
    j.originX += dx * k;
    j.originY += dy * k;
    dx = px - j.originX;
    dy = py - j.originY;
  }
  const dd = Math.sqrt(dx * dx + dy * dy);
  const cl = Math.min(1, dd / radius);
  const nx = dd > 0 ? dx / dd : 0;
  const ny = dd > 0 ? dy / dd : 0;
  const dz = INPUT.joystickDeadzone;
  const mag = cl < dz ? 0 : (cl - dz) / (1 - dz);
  j.moveX = nx * mag;
  j.moveY = -ny * mag;
  j.sprint = dd > radius * INPUT.joystickSprint;
  j.knobX = nx * Math.min(dd, radius);
  j.knobY = ny * Math.min(dd, radius);
  return j;
}
