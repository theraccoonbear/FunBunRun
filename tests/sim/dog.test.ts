import { describe, expect, it } from 'vitest';
import { DOG } from '../../src/config';
import {
  collarWorld,
  createDog,
  DOG_MODEL,
  resetDog,
  updateDog,
  type DogInput,
} from '../../src/sim/dog';
import { createLook, type Basis } from '../../src/sim/look';
import type { World } from '../../src/sim/world';

const emptyWorld: World = { half: 98, obstacles: [], trees: [], bushes: [], rocks: [], logs: [] };
const idle: DogInput = {
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  turn: 0,
  sprint: false,
  jump: false,
};
const DT = 1 / 60;

function run(input: Partial<DogInput>, seconds: number, world = emptyWorld) {
  const d = createDog();
  const look = createLook();
  const basis: Basis = { fx: 0, fz: 0, rx: 0, rz: 0 };
  const res = { sprinting: false, jumped: false };
  for (let t = 0; t < seconds; t += DT) {
    Object.assign(res, updateDog(d, look, { ...idle, ...input }, 0, world, DT, basis));
  }
  return { d, look, basis, res };
}

describe('updateDog', () => {
  it('runs forward (camera yaw 0 faces -z) at walk speed', () => {
    const { d } = run({ moveY: 1 }, 2);
    expect(d.pos.z).toBeLessThan(-10);
    expect(Math.hypot(d.vel.x, d.vel.z)).toBeCloseTo(DOG.walkSpeed, 1);
  });

  it('drains stamina while sprinting at the configured rate', () => {
    const { d, res } = run({ moveY: 1, sprint: true }, 1);
    expect(res.sprinting).toBe(true);
    expect(d.stam).toBeCloseTo(1 - DOG.staminaDrain, 1);
  });

  it('stops sprinting when stamina runs out', () => {
    const { d, res } = run({ moveY: 1, sprint: true }, 5);
    expect(res.sprinting).toBe(false);
    expect(d.stam).toBeLessThan(0.1);
  });

  it('refills stamina faster when idle than when moving', () => {
    const d1 = createDog();
    const d2 = createDog();
    d1.stam = d2.stam = 0;
    const look = createLook();
    const basis: Basis = { fx: 0, fz: 0, rx: 0, rz: 0 };
    updateDog(d1, look, idle, 0, emptyWorld, 1, basis);
    updateDog(d2, look, { ...idle, moveY: 1 }, 0, emptyWorld, 1, basis);
    expect(d1.stam).toBeCloseTo(DOG.staminaRefillIdle);
    expect(d2.stam).toBeCloseTo(DOG.staminaRefillMoving);
  });

  it('jumps in an arc peaking near v^2/2g and lands grounded', () => {
    const d = createDog();
    const look = createLook();
    const basis: Basis = { fx: 0, fz: 0, rx: 0, rz: 0 };
    const first = updateDog(d, look, { ...idle, jump: true }, 0, emptyWorld, DT, basis);
    expect(first.jumped).toBe(true);
    expect(d.grounded).toBe(false);
    let peak = 0;
    let frames = 0;
    while (!d.grounded && frames < 200) {
      const r = updateDog(d, look, { ...idle, jump: true }, 0, emptyWorld, DT, basis);
      expect(r.jumped).toBe(false); // no double jump
      peak = Math.max(peak, d.pos.y);
      frames++;
    }
    const ideal = DOG.jumpVelocity ** 2 / (2 * DOG.gravity);
    expect(peak).toBeGreaterThan(ideal * 0.9);
    expect(peak).toBeLessThan(ideal);
    expect(d.grounded).toBe(true);
    expect(d.pos.y).toBe(0);
    // Airtime about 2v/g.
    expect(frames * DT).toBeCloseTo((2 * DOG.jumpVelocity) / DOG.gravity, 1);
  });

  it('is blocked by a log on the ground but clears it in a jump', () => {
    const log = { ax: -3, az: -3, bx: 3, bz: -3, r: 0.35, h: 0.7 };
    const world: World = { ...emptyWorld, obstacles: [log] };
    const walk = run({ moveY: 1 }, 2, world);
    expect(walk.d.pos.z).toBeGreaterThan(-3);

    const d = createDog();
    const look = createLook();
    const basis: Basis = { fx: 0, fz: 0, rx: 0, rz: 0 };
    for (let t = 0; t < 2; t += DT) {
      // Jump when 1.2 m short of the log.
      const jump = d.pos.z < -1.8 && d.pos.z > -2.2;
      updateDog(d, look, { ...idle, moveY: 1, jump }, 0, world, DT, basis);
    }
    expect(d.pos.z).toBeLessThan(-4);
  });

  it('slows down under leash tension', () => {
    const d = createDog();
    const look = createLook();
    const basis: Basis = { fx: 0, fz: 0, rx: 0, rz: 0 };
    for (let i = 0; i < 120; i++) {
      updateDog(d, look, { ...idle, moveY: 1 }, 1, emptyWorld, DT, basis);
    }
    expect(Math.hypot(d.vel.x, d.vel.z)).toBeCloseTo(DOG.walkSpeed * (1 - DOG.tensionSlowdown), 1);
  });

  it('turns the camera with look input and keys, and clamps pitch', () => {
    const { look } = run({ lookX: 100, lookY: 10000 }, DT);
    expect(look.yaw).toBeCloseTo(-0.4);
    expect(look.pitch).toBe(1.1);
    const turned = run({ turn: 1 }, 1);
    expect(turned.look.yaw).toBeCloseTo(2.4, 1);
  });

  it('drifts the camera back behind a moving dog after a second without look input', () => {
    const d = createDog();
    d.h = Math.PI / 2;
    const look = createLook();
    const basis: Basis = { fx: 0, fz: 0, rx: 0, rz: 0 };
    // Barely moving: counts as moving, but too slow to turn the dog.
    const creep = { ...idle, moveY: 0.055 };
    for (let t = 0; t < 0.9; t += DT) {
      updateDog(d, look, creep, 0, emptyWorld, DT, basis);
    }
    expect(look.yaw).toBe(0);
    for (let t = 0; t < 6; t += DT) {
      updateDog(d, look, creep, 0, emptyWorld, DT, basis);
    }
    expect(d.h).toBe(Math.PI / 2);
    expect(look.yaw).toBeCloseTo(-Math.PI / 2, 2);
  });

  it('reports the movement basis from the camera yaw', () => {
    const { basis } = run({}, DT);
    expect(basis.fx).toBeCloseTo(0);
    expect(basis.fz).toBeCloseTo(-1);
    expect(basis.rx).toBeCloseTo(1);
    expect(basis.rz).toBeCloseTo(0);
  });

  it('resetDog returns to the origin facing -z with full stamina', () => {
    const { d } = run({ moveY: 1, sprint: true }, 1);
    resetDog(d);
    expect(d.pos).toEqual({ x: 0, y: 0, z: 0 });
    expect(d.h).toBe(Math.PI);
    expect(d.stam).toBe(1);
    expect(d.pose.heading).toBe(Math.PI);
  });
});

describe('collarWorld', () => {
  it('places the collar ahead of and above the dog at rest', () => {
    const d = createDog();
    const c = collarWorld(d.pose, { x: 0, y: 0, z: 0 });
    const s = DOG_MODEL.scale;
    // Heading PI faces -z, so the collar (local +z) is at -z.
    expect(c.x).toBeCloseTo(0);
    expect(c.y).toBeCloseTo(s * (DOG_MODEL.bodyRestY + DOG_MODEL.collar.y));
    expect(c.z).toBeCloseTo(-s * DOG_MODEL.collar.z);
  });

  it('follows heading and body pitch', () => {
    const pose = { x: 1, y: 0.5, z: 2, heading: Math.PI / 2, bodyY: 0.55, pitch: 0, amp: 0 };
    const c = collarWorld(pose, { x: 0, y: 0, z: 0 });
    expect(c.x).toBeCloseTo(1 + DOG_MODEL.scale * DOG_MODEL.collar.z);
    expect(c.z).toBeCloseTo(2);
    const pitched = collarWorld({ ...pose, pitch: 0.3 }, { x: 0, y: 0, z: 0 });
    expect(pitched.y).not.toBeCloseTo(c.y);
  });
});
