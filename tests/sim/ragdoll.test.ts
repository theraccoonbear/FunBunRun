import { describe, expect, it } from 'vitest';
import { RAGDOLL } from '../../src/config';
import { makeRagdollSim, type Particle } from '../../src/sim/ragdoll';

const L = 3.6;
const H = RAGDOLL.step;
const noCollide = (): void => {};
const collar = { x: 0, y: 0.9, z: 0 };

function make(): ReturnType<typeof makeRagdollSim> {
  return makeRagdollSim({ x: 0.6, z: 2.6, leash: L, collar });
}

describe('makeRagdollSim', () => {
  it('builds 11 body points plus a 10-segment rope ending at the right hand', () => {
    const r = make();
    expect(r.pts).toHaveLength(11 + RAGDOLL.ropeSegments);
    expect(r.rope).toHaveLength(RAGDOLL.ropeSegments + 1);
    expect(r.rope[r.rope.length - 1]).toBe(r.body.rHand);
    expect(r.rope[0]!.im).toBe(0);
  });

  it('never lets the hand get farther from the collar than the leash, even when yanked hard', () => {
    const r = make();
    const c = { ...collar };
    let maxSeen = 0;
    for (let i = 0; i < 600; i++) {
      // Dog sprints away at 11 m/s, then zig-zags.
      c.x += (i < 300 ? 11 : -6) * H;
      c.z += Math.sin(i * 0.1) * 8 * H;
      r.step(H, c, noCollide);
      const hand = r.body.rHand;
      const d = Math.hypot(hand.x - c.x, hand.y - c.y, hand.z - c.z);
      maxSeen = Math.max(maxSeen, d);
    }
    expect(maxSeen).toBeLessThanOrEqual(L + 1e-6);
  });

  it('keeps the rope taut-or-slack: each segment at most a little over its rest length', () => {
    const r = make();
    const c = { ...collar };
    for (let i = 0; i < 300; i++) {
      c.x += 9 * H;
      r.step(H, c, noCollide);
    }
    const seg = L / RAGDOLL.ropeSegments;
    for (let i = 0; i < r.rope.length - 1; i++) {
      const a = r.rope[i]!;
      const b = r.rope[i + 1]!;
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(seg * 1.5);
    }
  });

  it('clamps every particle to the ground', () => {
    const r = make();
    const c = { ...collar };
    for (let i = 0; i < 400; i++) {
      c.x += 11 * H;
      r.step(H, c, noCollide);
      for (const p of r.pts) {
        expect(p.y).toBeGreaterThanOrEqual(p.r - 1e-9);
      }
    }
  });

  it('pins rope[0] to the collar', () => {
    const r = make();
    const c = { x: 5, y: 1, z: -2 };
    r.step(H, c, noCollide);
    expect(r.rope[0]).toMatchObject({ x: 5, y: 1, z: -2, px: 5, py: 1, pz: -2 });
  });

  it('stands and follows a dog that walks away slowly, without being knocked down', () => {
    const r = make();
    const c = { ...collar };
    for (let i = 0; i < 600; i++) {
      c.z -= 1.5 * H;
      r.step(H, c, noCollide);
    }
    expect(r.body.head.y).toBeGreaterThan(1.3);
    expect(r.st.dragged).toBe(0);
    // Followed: the person moved toward -z with the dog.
    expect(r.body.pelvis.z).toBeLessThan(0);
  });

  it('is yanked off their feet by a sprinting dog and then dragged', () => {
    const r = make();
    const c = { ...collar };
    let yanks = 0;
    for (let i = 0; i < 300; i++) {
      c.z -= 11 * H;
      r.step(H, c, noCollide);
      if (r.st.yanked) {
        yanks++;
        r.st.yanked = false;
      }
    }
    expect(yanks).toBeGreaterThanOrEqual(1);
    expect(r.st.tension).toBeGreaterThan(0);
    expect(r.st.dragged).toBeGreaterThan(1);
  });

  it('passes each body particle to the collision callback every step', () => {
    const r = make();
    const seen = new Set<Particle>();
    r.step(H, collar, (p) => seen.add(p));
    expect(seen.size).toBe(11);
  });
});
