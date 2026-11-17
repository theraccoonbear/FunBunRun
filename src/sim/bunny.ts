import { BUNNY } from '../config';
import { closestOnSegment, wrapAngle, type Vec2, type Vec3 } from '../core/math';
import type { Rng } from '../core/rng';
import { collide } from './collision';
import type { World } from './world';

export interface BunnyState {
  /** Ground position (y stays 0; the hop height is `by`). */
  pos: Vec3;
  /** Heading in radians; 0 faces +z. */
  h: number;
  spd: number;
  stam: number;
  /** Seconds left of the tired spell; > 0 means tired. */
  tired: number;
  /** Seconds left of the current jink (sideways dodge). */
  jinkT: number;
  jinkCD: number;
  jinkAng: number;
  /** Wander heading when the dog is far away. */
  wander: number;
  /** Hop phase (drives the hop animation). */
  hopT: number;
  /** Seconds of lick immunity left. */
  inv: number;
  /** Pop height and vertical velocity after a lick. */
  by: number;
  bvy: number;
}

export function createBunny(): BunnyState {
  const b = {} as BunnyState;
  resetBunny(b);
  return b;
}

export function resetBunny(b: BunnyState): void {
  Object.assign(b, {
    pos: { x: BUNNY.start.x, y: 0, z: BUNNY.start.z },
    h: BUNNY.startHeading,
    spd: 0,
    stam: 1,
    tired: 0,
    jinkT: 0,
    jinkCD: 0,
    jinkAng: 0,
    wander: Math.PI,
    hopT: 0,
    inv: 0,
    by: 0,
    bvy: 0,
  } satisfies BunnyState);
}

const scratch: Vec2 = { x: 0, z: 0 };

/**
 * One sim step of bunny AI: flee (with jinks) when the dog is near, wander
 * when it is far, tire out after a long chase, avoid tall obstacles and the
 * arena edge. Returns the distance to the dog.
 */
export function updateBunny(
  b: BunnyState,
  dog: Readonly<Vec3>,
  world: World,
  rng: Rng,
  dt: number,
): number {
  const dx = b.pos.x - dog.x;
  const dz = b.pos.z - dog.z;
  const dist = Math.hypot(dx, dz) || 0.001;
  b.inv -= dt;
  b.jinkT -= dt;
  b.jinkCD -= dt;
  if (b.tired > 0) {
    b.tired -= dt;
    if (b.tired <= 0) {
      b.stam = BUNNY.recoverStamina;
    }
  }
  let wx: number;
  let wz: number;
  let spd: number;
  if (dist < BUNNY.fleeDistance) {
    wx = dx / dist;
    wz = dz / dist;
    if (dist < BUNNY.jinkDistance && b.jinkCD <= 0) {
      const side = rng.next() < 0.5 ? -1 : 1;
      b.jinkAng = side * (BUNNY.jinkAngleMin + rng.next() * BUNNY.jinkAngleRange);
      b.jinkT = BUNNY.jinkDuration;
      b.jinkCD = BUNNY.jinkCooldownMin + rng.next() * BUNNY.jinkCooldownRange;
    }
    if (b.jinkT > 0) {
      const c = Math.cos(b.jinkAng);
      const s = Math.sin(b.jinkAng);
      const nx = wx * c - wz * s;
      const nz = wx * s + wz * c;
      wx = nx;
      wz = nz;
    }
    if (b.tired > 0) {
      spd = BUNNY.tiredSpeed;
    } else {
      spd = BUNNY.fleeSpeed;
      b.stam -= dt * BUNNY.fleeStaminaDrain;
      if (b.stam <= 0) {
        b.stam = 0;
        b.tired = BUNNY.tiredDuration;
      }
    }
  } else {
    // Tuned per 60 Hz step. The sim always runs the fixed step, so the random
    // walk is the same at any frame rate (#3).
    b.wander += (rng.next() - 0.5) * dt * BUNNY.wanderTurnNoise;
    wx = Math.sin(b.wander);
    wz = Math.cos(b.wander);
    spd = BUNNY.wanderSpeed;
    b.stam = Math.min(1, b.stam + dt * BUNNY.wanderStaminaRefill);
  }
  for (const o of world.obstacles) {
    if (o.h < BUNNY.minObstacleHeight) {
      continue;
    }
    closestOnSegment(o, b.pos.x, b.pos.z, scratch);
    const ox = b.pos.x - scratch.x;
    const oz = b.pos.z - scratch.z;
    const d = Math.hypot(ox, oz);
    const reach = o.r + BUNNY.avoidReach;
    if (d < reach && d > 1e-4) {
      const w = ((reach - d) / BUNNY.avoidReach) * BUNNY.avoidStrength;
      wx += (ox / d) * w;
      wz += (oz / d) * w;
    }
  }
  const m = world.half - BUNNY.edgeMargin;
  if (b.pos.x > m) {
    wx -= (b.pos.x - m) / BUNNY.edgeFalloff;
  }
  if (b.pos.x < -m) {
    wx += (-m - b.pos.x) / BUNNY.edgeFalloff;
  }
  if (b.pos.z > m) {
    wz -= (b.pos.z - m) / BUNNY.edgeFalloff;
  }
  if (b.pos.z < -m) {
    wz += (-m - b.pos.z) / BUNNY.edgeFalloff;
  }

  const target = Math.atan2(wx, wz);
  const diff = wrapAngle(target - b.h);
  const tr = (b.jinkT > 0 ? BUNNY.jinkTurnRate : BUNNY.turnRate) * dt;
  b.h = wrapAngle(b.h + Math.max(-tr, Math.min(tr, diff)));
  b.spd += (spd - b.spd) * Math.min(1, dt * BUNNY.speedResponse);
  b.pos.x += Math.sin(b.h) * b.spd * dt;
  b.pos.z += Math.cos(b.h) * b.spd * dt;
  collide(world.obstacles, world.half, b.pos, BUNNY.radius, BUNNY.minObstacleHeight);

  b.hopT += dt * (BUNNY.hopBase + b.spd * BUNNY.hopPerSpeed);
  b.bvy -= BUNNY.gravity * dt;
  b.by = Math.max(0, b.by + b.bvy * dt);
  if (b.by === 0) {
    b.bvy = 0;
  }
  return dist;
}

/** Menu idle: the bunny hops in place. */
export function idleBunny(b: BunnyState, dt: number): void {
  b.hopT += dt * BUNNY.menuHopRate;
}

/** Called when the bunny is licked: brief immunity, a pop, and fresh legs. */
export function onLicked(b: BunnyState): void {
  b.inv = BUNNY.lickImmunity;
  b.stam = 1;
  b.tired = 0;
  b.bvy = BUNNY.lickPop;
  b.jinkT = 0;
  b.jinkCD = 0;
}
