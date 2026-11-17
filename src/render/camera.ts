import type * as THREE from 'three';
import { BUNNY, CAMERA, SIM } from '../config';
import { smoothing, type Vec3 } from '../core/math';

/** Follow distance and extra height, eased toward the sprint or normal framing (#43). */
export interface FollowZoom {
  dist: number;
  lift: number;
}

export function createFollowZoom(): FollowZoom {
  return { dist: CAMERA.distance, lift: 0 };
}

export function resetFollowZoom(z: FollowZoom): void {
  z.dist = CAMERA.distance;
  z.lift = 0;
}

/** Exponential approach of `current` to `target` at `rate` (1/s) over `dt` seconds. */
export function damp(current: number, target: number, rate: number, dt: number): number {
  return target + (current - target) * Math.exp(-rate * dt);
}

/**
 * Eases the follow zoom: out to the bolt framing while sprinting (slowly, so
 * the dog pulls ahead first), back in to the normal framing otherwise.
 * Frame-rate independent: two half steps equal one full step.
 */
export function updateFollowZoom(z: FollowZoom, sprinting: boolean, dt: number): FollowZoom {
  const rate = sprinting ? CAMERA.boltOutRate : CAMERA.boltInRate;
  z.dist = damp(z.dist, sprinting ? CAMERA.boltDistance : CAMERA.distance, rate, dt);
  z.lift = damp(z.lift, sprinting ? CAMERA.boltLift : 0, rate, dt);
  return z;
}

/**
 * Third-person orbit behind the dog; widens the FOV and pulls back while
 * sprinting. The target, yaw and pitch are the interpolated sim values; the
 * FOV and zoom ease per rendered frame, frame-rate independent.
 */
export function followCamera(
  camera: THREE.PerspectiveCamera,
  dog: Readonly<Vec3>,
  yaw: number,
  pitch: number,
  sprinting: boolean,
  dt: number,
  zoom: FollowZoom,
): void {
  updateFollowZoom(zoom, sprinting, dt);
  const tx = dog.x;
  const ty = dog.y + CAMERA.targetHeight;
  const tz = dog.z;
  const dist = zoom.dist;
  // Forward on the ground plane, as in basisFromYaw().
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  camera.position.set(
    tx - fx * Math.cos(pitch) * dist,
    ty + Math.sin(pitch) * dist + zoom.lift,
    tz - fz * Math.cos(pitch) * dist,
  );
  camera.lookAt(tx, ty, tz);
  const fovT = sprinting ? CAMERA.sprintFov : CAMERA.fov;
  camera.fov += (fovT - camera.fov) * smoothing(CAMERA.fovRate, dt, SIM.step);
  camera.updateProjectionMatrix();
}

/** Menu: slow orbit around the bunny's start spot. */
export function menuCamera(camera: THREE.PerspectiveCamera, elapsed: number): void {
  const a = elapsed * CAMERA.menuOrbitSpeed;
  const { x, z } = BUNNY.start;
  camera.position.set(
    x + Math.sin(a) * CAMERA.menuOrbitRadius,
    CAMERA.menuOrbitHeight,
    z + Math.cos(a) * CAMERA.menuOrbitRadius,
  );
  camera.lookAt(x, 0.5, z);
}
