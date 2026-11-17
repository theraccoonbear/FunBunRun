import { clamp, closestOnSegment, type Vec2, type Vec3 } from '../core/math';
import type { Obstacle } from './world';

const scratch: Vec2 = { x: 0, z: 0 };

/**
 * Pushes the circle at `p` (radius `rad`) out of every obstacle at least
 * `minH` tall that `p` is below, then clamps it to the arena. Points at or
 * above an obstacle's height pass over it (jumping logs). Mutates `p`.
 */
export function collide(
  obstacles: readonly Obstacle[],
  half: number,
  p: Vec3,
  rad: number,
  minH: number,
): void {
  for (const o of obstacles) {
    if (o.h < minH || p.y >= o.h) {
      continue;
    }
    closestOnSegment(o, p.x, p.z, scratch);
    const cx = scratch.x;
    const cz = scratch.z;
    let dx = p.x - cx;
    let dz = p.z - cz;
    const d = Math.hypot(dx, dz);
    const md = o.r + rad;
    if (d < md) {
      if (d < 1e-4) {
        dx = 1;
        dz = 0;
      } else {
        dx /= d;
        dz /= d;
      }
      p.x = cx + dx * md;
      p.z = cz + dz * md;
    }
  }
  p.x = clamp(p.x, -half, half);
  p.z = clamp(p.z, -half, half);
}
