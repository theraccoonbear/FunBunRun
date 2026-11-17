import type * as THREE from 'three';
import { BUNNY, CAMERA } from '../config';
import type { Vec3 } from '../core/math';
import type { Basis, LookState } from '../sim/look';

/** Third-person orbit behind the dog; widens the FOV while sprinting. */
export function followCamera(
  camera: THREE.PerspectiveCamera,
  dog: Readonly<Vec3>,
  look: Readonly<LookState>,
  basis: Readonly<Basis>,
  sprinting: boolean,
  dt: number,
): void {
  const tx = dog.x;
  const ty = dog.y + CAMERA.targetHeight;
  const tz = dog.z;
  const dist = CAMERA.distance;
  camera.position.set(
    tx - basis.fx * Math.cos(look.pitch) * dist,
    ty + Math.sin(look.pitch) * dist,
    tz - basis.fz * Math.cos(look.pitch) * dist,
  );
  camera.lookAt(tx, ty, tz);
  const fovT = sprinting ? CAMERA.sprintFov : CAMERA.fov;
  camera.fov += (fovT - camera.fov) * Math.min(1, dt * CAMERA.fovRate);
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
