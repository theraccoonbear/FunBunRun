/** Plain vector types shared by the simulation and its adapters. */
export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Wraps an angle into [-PI, PI]. */
export function wrapAngle(a: number): number {
  while (a > Math.PI) {
    a -= 2 * Math.PI;
  }
  while (a < -Math.PI) {
    a += 2 * Math.PI;
  }
  return a;
}

/** A line segment on the ground plane from (ax, az) to (bx, bz). A circle has a == b. */
export interface Segment {
  ax: number;
  az: number;
  bx: number;
  bz: number;
}

/**
 * Closest point on segment `s` to (x, z), written into `out` (allocation-free).
 * Returns `out`.
 */
export function closestOnSegment(s: Segment, x: number, z: number, out: Vec2): Vec2 {
  const vx = s.bx - s.ax;
  const vz = s.bz - s.az;
  const l2 = vx * vx + vz * vz;
  const t = l2 > 0 ? clamp(((x - s.ax) * vx + (z - s.az) * vz) / l2, 0, 1) : 0;
  out.x = s.ax + vx * t;
  out.z = s.az + vz * t;
  return out;
}
