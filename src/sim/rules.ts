import { RULES } from '../config';
import type { Vec3 } from '../core/math';

export interface LickReach {
  /** Ground distance from dog to bunny. */
  d: number;
  dx: number;
  dz: number;
  /** True when a lick now would land. */
  ok: boolean;
}

export function createReach(): LickReach {
  return { d: 0, dx: 0, dz: 0, ok: false };
}

/** Whether the bunny is within licking range. Licks are allowed mid-air (#4). */
export function lickReach(
  dog: Readonly<Vec3>,
  bunny: Readonly<Vec3>,
  bunnyImmunity: number,
  out: LickReach,
): LickReach {
  out.dx = bunny.x - dog.x;
  out.dz = bunny.z - dog.z;
  out.d = Math.hypot(out.dx, out.dz);
  out.ok = out.d < RULES.lickRange && bunnyImmunity <= 0;
  return out;
}

/** Combo count after a successful lick at `now`. */
export function nextCombo(combo: number, now: number, lastLick: number): number {
  return now - lastLick < RULES.comboWindow ? combo + 1 : 1;
}

export function lickPoints(combo: number): number {
  return RULES.pointsPerLick * combo;
}

/** Whether a bone is within pickup range. Pickups are allowed mid-air (#4). */
export function canPickBone(dog: Readonly<Vec3>, boneX: number, boneZ: number): boolean {
  return Math.hypot(boneX - dog.x, boneZ - dog.z) < RULES.bonePickupRange;
}

/** The best score after a round ending with `score`. */
export function updatedBest(score: number, best: number): number {
  return score > best ? score : best;
}

/**
 * Whether the round-over card says "New best!". Evaluated after the best has
 * been updated, so a tie also qualifies (#5); kept for parity.
 */
export function showsNewBest(score: number, bestAfterUpdate: number): boolean {
  return score >= bestAfterUpdate && score > 0;
}

/** HUD clock text, rounding up to whole seconds: 90 -> "1:30". */
export function formatClock(timeLeft: number): string {
  const s = Math.ceil(timeLeft);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
