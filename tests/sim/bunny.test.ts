import { describe, expect, it } from 'vitest';
import { BUNNY } from '../../src/config';
import { createRng, rngFrom } from '../../src/core/rng';
import { createBunny, idleBunny, onLicked, resetBunny, updateBunny } from '../../src/sim/bunny';
import type { World } from '../../src/sim/world';

const empty: World = { half: 98, obstacles: [], trees: [], bushes: [], rocks: [], logs: [] };
const DT = 1 / 60;

describe('updateBunny', () => {
  it('starts at the menu spot', () => {
    const b = createBunny();
    expect(b.pos).toEqual({ x: 0, y: 0, z: -16 });
    expect(b.h).toBe(Math.PI);
  });

  it('flees directly away from a nearby dog at flee speed', () => {
    const b = createBunny();
    const rng = createRng(1);
    for (let i = 0; i < 120; i++) {
      // Dog follows 10 m behind (toward +z).
      updateBunny(b, { x: 0, y: 0, z: b.pos.z + 10 }, empty, rng, DT);
    }
    expect(b.pos.z).toBeLessThan(-26);
    expect(Math.abs(b.pos.x)).toBeLessThan(0.5);
    expect(b.spd).toBeGreaterThan(BUNNY.fleeSpeed * 0.95);
  });

  it('jinks sideways when the dog gets within reach', () => {
    const b = createBunny();
    b.h = Math.PI; // facing -z, away from the dog
    // side = -1 (0.2 < 0.5), angle = 0.7 + 0.5 * 0.9, cooldown = 0.9 + 0.5 * 1.3
    const rng = rngFrom(() => 0.5);
    const first = [0.2, 0.5, 0.5];
    const r = rngFrom(() => first.shift() ?? rng.next());
    updateBunny(b, { x: 0, y: 0, z: -12 }, empty, r, DT);
    expect(b.jinkT).toBeCloseTo(BUNNY.jinkDuration);
    expect(b.jinkAng).toBeCloseTo(-(0.7 + 0.45));
    expect(b.jinkCD).toBeCloseTo(0.9 + 0.65);
    for (let i = 0; i < 20; i++) {
      updateBunny(b, { x: 0, y: 0, z: -12 }, empty, r, DT);
    }
    expect(Math.abs(b.pos.x)).toBeGreaterThan(0.1);
  });

  it('tires after a long chase, slows down, then recovers to 60% stamina', () => {
    const b = createBunny();
    const rng = createRng(2);
    let sawTired = false;
    for (let t = 0; t < 12; t += DT) {
      // Dog keeps 8 m behind.
      const dog = { x: b.pos.x - Math.sin(b.h) * 8, y: 0, z: b.pos.z - Math.cos(b.h) * 8 };
      updateBunny(b, dog, empty, rng, DT);
      if (b.tired > 0) {
        sawTired = true;
        expect(b.stam).toBe(0);
      }
      if (sawTired && b.tired <= 0) {
        break;
      }
    }
    expect(sawTired).toBe(true);
    expect(b.stam).toBeCloseTo(BUNNY.recoverStamina, 1);
  });

  it('runs at tired speed while tired', () => {
    const b = createBunny();
    b.tired = 5;
    const rng = createRng(3);
    for (let i = 0; i < 120; i++) {
      updateBunny(b, { x: b.pos.x, y: 0, z: b.pos.z + 10 }, empty, rng, DT);
    }
    expect(b.spd).toBeCloseTo(BUNNY.tiredSpeed, 1);
  });

  it('wanders slowly and regains stamina when the dog is far away', () => {
    const b = createBunny();
    b.stam = 0.5;
    const rng = createRng(4);
    for (let i = 0; i < 60; i++) {
      updateBunny(b, { x: 0, y: 0, z: 80 }, empty, rng, DT);
    }
    expect(b.spd).toBeLessThan(BUNNY.wanderSpeed + 1e-9);
    expect(b.stam).toBeCloseTo(0.5 + BUNNY.wanderStaminaRefill, 2);
  });

  it('stays inside the arena when chased into a corner for a long time', () => {
    const b = createBunny();
    b.pos.x = 85;
    b.pos.z = 85;
    const rng = createRng(5);
    for (let t = 0; t < 30; t += DT) {
      updateBunny(b, { x: b.pos.x - 5, y: 0, z: b.pos.z - 5 }, empty, rng, DT);
      expect(Math.abs(b.pos.x)).toBeLessThanOrEqual(98);
      expect(Math.abs(b.pos.z)).toBeLessThanOrEqual(98);
    }
  });

  it('steers around tall obstacles and is pushed out of them', () => {
    const tree = { ax: 0, az: -20, bx: 0, bz: -20, r: 0.5, h: 99 };
    const world: World = { ...empty, obstacles: [tree] };
    const b = createBunny();
    const rng = createRng(6);
    let minDist = Infinity;
    for (let i = 0; i < 120; i++) {
      updateBunny(b, { x: 0, y: 0, z: -8 }, world, rng, DT);
      minDist = Math.min(minDist, Math.hypot(b.pos.x, b.pos.z + 20));
    }
    expect(minDist).toBeGreaterThanOrEqual(0.5 + BUNNY.radius - 1e-9);
    expect(b.pos.z).toBeLessThan(-21);
  });

  it('pops up after a lick and lands again', () => {
    const b = createBunny();
    b.tired = 1;
    b.stam = 0;
    onLicked(b);
    expect(b).toMatchObject({ inv: BUNNY.lickImmunity, stam: 1, tired: 0, bvy: BUNNY.lickPop });
    const rng = createRng(7);
    updateBunny(b, { x: 0, y: 0, z: 50 }, empty, rng, DT);
    expect(b.by).toBeGreaterThan(0);
    for (let i = 0; i < 60; i++) {
      updateBunny(b, { x: 0, y: 0, z: 50 }, empty, rng, DT);
    }
    expect(b.by).toBe(0);
    expect(b.bvy).toBe(0);
  });

  it('hops in place in the menu and resets cleanly', () => {
    const b = createBunny();
    idleBunny(b, 0.5);
    expect(b.hopT).toBeCloseTo(BUNNY.menuHopRate * 0.5);
    b.pos.x = 30;
    resetBunny(b);
    expect(b.pos.x).toBe(0);
    expect(b.hopT).toBe(0);
  });
});
