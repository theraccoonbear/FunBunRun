import { CAMERA } from '../config';
import { clamp } from '../core/math';

/** Camera orbit angles. Movement is relative to the camera yaw. */
export interface LookState {
  yaw: number;
  pitch: number;
  /** Seconds since the last look input. */
  idle: number;
}

/** Ground-plane basis derived from the camera yaw: forward (f) and right (r). */
export interface Basis {
  fx: number;
  fz: number;
  rx: number;
  rz: number;
}

export function createLook(): LookState {
  return { yaw: 0, pitch: CAMERA.initialPitch, idle: 0 };
}

export function resetLook(look: LookState): void {
  look.yaw = 0;
  look.pitch = CAMERA.initialPitch;
}

/**
 * Applies pointer/stick look deltas (pixels) and key turning (-1..1, positive
 * turns left) for one frame.
 */
export function applyLook(
  look: LookState,
  lookX: number,
  lookY: number,
  turn: number,
  dt: number,
): void {
  look.yaw -= lookX * CAMERA.yawPerPixel;
  look.pitch += lookY * CAMERA.pitchPerPixel;
  look.yaw += turn * CAMERA.keyYawSpeed * dt;
  look.pitch = clamp(look.pitch, CAMERA.minPitch, CAMERA.maxPitch);
  look.idle = lookX || lookY ? 0 : look.idle + dt;
}

export function basisFromYaw(yaw: number, out: Basis): Basis {
  out.fx = -Math.sin(yaw);
  out.fz = -Math.cos(yaw);
  out.rx = Math.cos(yaw);
  out.rz = -Math.sin(yaw);
  return out;
}
