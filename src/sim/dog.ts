import { CAMERA, DOG } from '../config';
import { wrapAngle, type Vec3 } from '../core/math';
import { collide } from './collision';
import { applyLook, basisFromYaw, type Basis, type LookState } from './look';
import type { World } from './world';

/** Gait pose shared by the view and the collar (leash anchor) computation. */
export interface DogPose {
  x: number;
  y: number;
  z: number;
  /** Heading the model faces this frame. */
  heading: number;
  /** Height of the body pivot above the root. */
  bodyY: number;
  /** Body pitch about its local x axis. */
  pitch: number;
  /** Gait amplitude 0..1 (from horizontal speed). */
  amp: number;
}

export interface DogState {
  pos: Vec3;
  vel: Vec3;
  vy: number;
  /** Heading in radians; 0 faces +z. */
  h: number;
  stam: number;
  grounded: boolean;
  /** Gallop phase. */
  ph: number;
  pose: DogPose;
}

export interface DogInput {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  turn: number;
  sprint: boolean;
  jump: boolean;
}

export interface DogStepResult {
  sprinting: boolean;
  jumped: boolean;
}

/** Model-space constants the leash anchor depends on (see render/models.ts). */
export const DOG_MODEL = {
  scale: 1.15,
  bodyRestY: 0.55,
  bodyBob: 0.12,
  bodyPitch: 0.13,
  collar: { x: 0, y: 0.24, z: 0.38 },
} as const;

export function createDog(): DogState {
  return {
    pos: { x: 0, y: 0, z: 0 },
    vel: { x: 0, y: 0, z: 0 },
    vy: 0,
    h: Math.PI,
    stam: 1,
    grounded: true,
    ph: 0,
    pose: { x: 0, y: 0, z: 0, heading: Math.PI, bodyY: DOG_MODEL.bodyRestY, pitch: 0, amp: 0 },
  };
}

/** Round start: back to the origin, facing -z, full stamina. */
export function resetDog(d: DogState): void {
  d.pos.x = d.pos.y = d.pos.z = 0;
  d.vel.x = d.vel.y = d.vel.z = 0;
  d.vy = 0;
  d.h = Math.PI;
  d.stam = 1;
  placeDog(d);
}

/** Moves the model root to the dog (the gait pose is kept). */
export function placeDog(d: DogState): void {
  d.pose.x = d.pos.x;
  d.pose.y = d.pos.y;
  d.pose.z = d.pos.z;
  d.pose.heading = d.h;
}

/**
 * One frame of dog movement, camera look and gait. `basis` receives the
 * camera-relative movement basis used this frame (before auto-follow).
 */
export function updateDog(
  d: DogState,
  look: LookState,
  input: DogInput,
  tension: number,
  world: World,
  dt: number,
  basis: Basis,
): DogStepResult {
  applyLook(look, input.lookX, input.lookY, input.turn, dt);

  let mx = input.moveX;
  let my = input.moveY;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const mag = Math.min(1, len);
  const moving = mag > DOG.moveDeadzone;
  const sprinting = input.sprint && moving && d.stam > DOG.sprintMinStamina;
  if (sprinting) {
    d.stam = Math.max(0, d.stam - dt * DOG.staminaDrain);
  } else {
    d.stam = Math.min(1, d.stam + dt * (moving ? DOG.staminaRefillMoving : DOG.staminaRefillIdle));
  }
  const speed =
    (sprinting ? DOG.sprintSpeed : DOG.walkSpeed) * mag * (1 - DOG.tensionSlowdown * tension);
  const { fx, fz, rx, rz } = basisFromYaw(look.yaw, basis);
  const tx = (fx * my + rx * mx) * speed;
  const tz = (fz * my + rz * mx) * speed;
  const k = 1 - Math.exp(-(d.grounded ? DOG.groundAccel : DOG.airAccel) * dt);
  d.vel.x += (tx - d.vel.x) * k;
  d.vel.z += (tz - d.vel.z) * k;
  d.pos.x += d.vel.x * dt;
  d.pos.z += d.vel.z * dt;
  let jumped = false;
  if (input.jump && d.grounded) {
    d.vy = DOG.jumpVelocity;
    d.grounded = false;
    jumped = true;
  }
  d.vy -= DOG.gravity * dt;
  d.pos.y += d.vy * dt;
  if (d.pos.y <= 0) {
    d.pos.y = 0;
    d.vy = 0;
    d.grounded = true;
  }
  collide(world.obstacles, world.half, d.pos, DOG.radius, 0);

  const hs = Math.hypot(d.vel.x, d.vel.z);
  if (hs > DOG.turnMinSpeed) {
    const target = Math.atan2(d.vel.x, d.vel.z);
    d.h = wrapAngle(d.h + wrapAngle(target - d.h) * Math.min(1, dt * DOG.turnRate));
  }
  // Camera drifts back behind the dog when running and not steering it
  if (moving && look.idle > CAMERA.autoFollowDelay) {
    look.yaw += wrapAngle(d.h + Math.PI - look.yaw) * Math.min(1, dt * CAMERA.autoFollowRate);
  }

  // Gallop pose
  const amp = Math.min(1, hs / DOG.walkSpeed);
  d.ph += dt * (DOG.gaitBase + hs * DOG.gaitPerSpeed);
  placeDog(d);
  d.pose.amp = amp;
  d.pose.bodyY = DOG_MODEL.bodyRestY + Math.abs(Math.sin(d.ph)) * DOG_MODEL.bodyBob * amp;
  d.pose.pitch = Math.sin(d.ph) * DOG_MODEL.bodyPitch * amp;

  return { sprinting, jumped };
}

/**
 * World position of the leash anchor on the collar, from the posed model:
 * root (position, heading, scale) -> body (bob, pitch) -> collar point.
 */
export function collarWorld(pose: DogPose, out: Vec3): Vec3 {
  const c = DOG_MODEL.collar;
  const s = DOG_MODEL.scale;
  const cp = Math.cos(pose.pitch);
  const sp = Math.sin(pose.pitch);
  // Body space: rotate about x by pitch, then offset by the body pivot.
  const bx = c.x;
  const by = pose.bodyY + c.y * cp - c.z * sp;
  const bz = c.y * sp + c.z * cp;
  // Root space: scale, then rotate about y by heading.
  const ch = Math.cos(pose.heading);
  const sh = Math.sin(pose.heading);
  out.x = pose.x + s * (bx * ch + bz * sh);
  out.y = pose.y + s * by;
  out.z = pose.z + s * (-bx * sh + bz * ch);
  return out;
}
