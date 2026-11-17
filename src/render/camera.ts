import type * as THREE from 'three';
import { BUNNY, CAMERA, SIM } from '../config';
import { smoothing, type Vec3 } from '../core/math';

/**
 * Third-person orbit behind the dog; widens the FOV while sprinting. The
 * target, yaw and pitch are the interpolated sim values; the FOV eases per
 * rendered frame with the 60 Hz-tuned rate made frame-rate independent.
 */
export function followCamera(
  camera: THREE.PerspectiveCamera,
  dog: Readonly<Vec3>,
  yaw: number,
  pitch: number,
  sprinting: boolean,
  dt: number,
): void {
  const tx = dog.x;
  const ty = dog.y + CAMERA.targetHeight;
  const tz = dog.z;
  const dist = CAMERA.distance;
  // Forward on the ground plane, as in basisFromYaw().
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  camera.position.set(
    tx - fx * Math.cos(pitch) * dist,
    ty + Math.sin(pitch) * dist,
    tz - fz * Math.cos(pitch) * dist,
  );
  camera.lookAt(tx, ty, tz);
  const fovT = sprinting ? CAMERA.sprintFov : CAMERA.fov;
  const fov = camera.fov + (fovT - camera.fov) * smoothing(CAMERA.fovRate, dt, SIM.step);
  // The projection only needs rebuilding while the FOV is actually moving.
  if (fov !== camera.fov) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
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
