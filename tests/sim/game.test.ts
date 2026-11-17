import { describe, expect, it, vi } from 'vitest';
import { CAMERA, LEASH_LENGTH, ROUND_SECONDS, RULES, WORLD, YANK_MESSAGES } from '../../src/config';
import { closestOnSegment } from '../../src/core/math';
import { Game, type StepInput, type GameEvents } from '../../src/sim/game';

const DT = 1 / 60;
const idle: StepInput = {
  moveX: 0,
  moveY: 0,
  lookX: 0,
  lookY: 0,
  turn: 0,
  sprint: false,
  jump: false,
  lick: false,
};

function newGame(best = 0): Game {
  return new Game({ seed: 42, best });
}

describe('Game', () => {
  it('generates a world with 12 bones and starts in the menu', () => {
    const g = newGame();
    expect(g.bones).toHaveLength(12);
    expect(g.phase).toBe('menu');
  });

  it('is reproducible with a seeded RNG', () => {
    expect(newGame().world).toEqual(newGame().world);
    expect(newGame().bones).toEqual(newGame().bones);
  });

  it('draws a random seed by default', () => {
    const spy = vi.spyOn(Math, 'random');
    new Game();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('exposes the forced seed and differs across seeds', () => {
    const a = new Game({ seed: 1 });
    const b = new Game({ seed: 2 });
    expect(a.seed).toBe(1);
    expect(a.world).not.toEqual(b.world);
    expect(a.bones).not.toEqual(b.bones);
  });

  it('places bones clear of obstacles and the spawn, and keeps respawns clear', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = new Game({ seed });
      expect(g.bones).toHaveLength(WORLD.bones.count);
      for (const bone of g.bones) {
        expect(Math.hypot(bone.x, bone.z)).toBeGreaterThanOrEqual(WORLD.spawnClearRadius);
        for (const o of g.world.obstacles) {
          const c = closestOnSegment(o, bone.x, bone.z, { x: 0, z: 0 });
          expect(Math.hypot(bone.x - c.x, bone.z - c.z)).toBeGreaterThanOrEqual(
            o.r + WORLD.bones.clearance - 1e-9,
          );
        }
      }
    }
  });

  it('respawns collected bones reproducibly for a seed', () => {
    const run = (): number[] => {
      const g = new Game({ seed: 8 });
      g.start();
      const target = g.bones[0]!;
      g.dog.pos.x = target.x;
      g.dog.pos.z = target.z;
      g.update(DT, idle);
      return g.bones.flatMap((b) => [b.x, b.z]);
    };
    const first = run();
    expect(run()).toEqual(first);
    expect(first).not.toEqual(new Game({ seed: 8 }).bones.flatMap((b) => [b.x, b.z]));
  });

  it('keeps the world layout independent of gameplay randomness', () => {
    const a = new Game({ seed: 9 });
    const b = new Game({ seed: 9 });
    for (let i = 0; i < 100; i++) {
      b.rng.next();
    }
    expect(b.world).toEqual(a.world);
    expect(b.bones).toEqual(a.bones);
  });

  it('gives each round a new seed unless one is forced', () => {
    const g = new Game();
    const first = g.seed;
    const onWorld = vi.fn();
    g.events.on('world', onWorld);
    g.start();
    expect(g.seed).toBe(first);
    g.session.phase = 'over';
    g.start();
    expect(onWorld).toHaveBeenCalledOnce();
    expect(g.seed).not.toBe(first);
  });

  it('regenerates the identical world every round with a forced seed', () => {
    const g = new Game({ seed: 77 });
    const world = structuredClone(g.world);
    const bones = structuredClone(g.bones);
    g.start();
    g.bones[0]!.x += 5;
    g.session.phase = 'over';
    g.start();
    expect(g.world).toEqual(world);
    expect(g.bones).toEqual(bones);
  });

  it('reports the world seed with the round result', () => {
    const g = new Game({ seed: 123 });
    const over = vi.fn<(r: GameEvents['roundOver']) => void>();
    g.events.on('roundOver', over);
    g.start();
    g.update(ROUND_SECONDS + 1, idle);
    expect(over.mock.calls[0]![0].seed).toBe(123);
  });

  it('only animates the bunny in the menu', () => {
    const g = newGame();
    g.update(DT, { ...idle, moveY: 1 });
    expect(g.dog.pos).toEqual({ x: 0, y: 0, z: 0 });
    expect(g.bunny.hopT).toBeGreaterThan(0);
    expect(g.session.elapsed).toBeCloseTo(DT);
  });

  it('start() emits start and resets the round', () => {
    const g = newGame();
    const onStart = vi.fn();
    g.events.on('start', onStart);
    expect(g.start()).toBe(true);
    expect(onStart).toHaveBeenCalledOnce();
    expect(g.phase).toBe('play');
    expect(g.start()).toBe(false);
  });

  it('pause() freezes the whole sim; resume() continues; quit() returns to the menu', () => {
    const g = newGame();
    const seen: string[] = [];
    for (const name of ['pause', 'resume', 'quit'] as const) {
      g.events.on(name, () => seen.push(name));
    }
    expect(g.pause()).toBe(false);
    g.start();
    for (let i = 0; i < 30; i++) {
      g.update(DT, { ...idle, moveY: 1 });
    }
    expect(g.pause()).toBe(true);
    expect(g.phase).toBe('paused');
    const frozen = {
      dog: { ...g.dog.pos },
      bunny: { ...g.bunny.pos },
      timeLeft: g.session.timeLeft,
      elapsed: g.session.elapsed,
    };
    for (let i = 0; i < 120; i++) {
      g.update(DT, { ...idle, moveY: 1, jump: true, lick: true });
    }
    expect({
      dog: g.dog.pos,
      bunny: g.bunny.pos,
      timeLeft: g.session.timeLeft,
      elapsed: g.session.elapsed,
    }).toEqual(frozen);
    expect(g.resume()).toBe(true);
    expect(g.resume()).toBe(false);
    g.update(DT, { ...idle, moveY: 1 });
    expect(g.session.timeLeft).toBeCloseTo(frozen.timeLeft - DT);
    g.pause();
    expect(g.quit()).toBe(true);
    expect(g.phase).toBe('menu');
    expect(g.quit()).toBe(false);
    expect(seen).toEqual(['pause', 'resume', 'pause', 'quit']);
  });

  it('restarts a fresh round from pause', () => {
    const g = newGame();
    g.start();
    g.update(DT, idle);
    g.pause();
    expect(g.start()).toBe(true);
    expect(g.phase).toBe('play');
    expect(g.session.timeLeft).toBe(ROUND_SECONDS);
  });

  it('moves the dog and emits jump during play', () => {
    const g = newGame();
    const onJump = vi.fn();
    g.events.on('jump', onJump);
    g.start();
    g.update(DT, { ...idle, moveY: 1, jump: true });
    g.update(DT, { ...idle, moveY: 1, jump: true });
    for (let i = 0; i < 30; i++) {
      g.update(DT, { ...idle, moveY: 1 });
    }
    expect(onJump).toHaveBeenCalledOnce();
    expect(g.dog.pos.z).toBeLessThan(-1);
  });

  it('licks a bunny in reach: points, combo, auto-aim, immunity', () => {
    const g = newGame();
    const licks: { points: number; combo: number }[] = [];
    g.events.on('lick', (e) => licks.push(e));
    g.start();
    g.bunny.pos.x = 2;
    g.bunny.pos.z = 0;
    g.update(DT, { ...idle, lick: true });
    expect(licks).toHaveLength(1);
    expect(licks[0]).toMatchObject({ points: 100, combo: 1 });
    expect(g.dog.h).toBeCloseTo(Math.atan2(g.reach.dx, g.reach.dz));
    expect(g.bunny.inv).toBeCloseTo(1.2);
    expect(g.session.lickT).toBeCloseTo(RULES.lickDuration - DT);

    // Cooldown blocks an immediate second lick; immunity blocks after it.
    g.update(DT, { ...idle, lick: true });
    expect(licks).toHaveLength(1);
    for (let i = 0; i < 90; i++) {
      g.update(DT, idle);
    }
    g.bunny.pos.x = g.dog.pos.x + 1;
    g.bunny.pos.z = g.dog.pos.z;
    g.update(DT, { ...idle, lick: true });
    expect(licks[1]).toMatchObject({ points: 200, combo: 2 });
    expect(g.session.score).toBe(300);
    expect(g.session.licks).toBe(2);
  });

  it('emits miss for a lick out of reach', () => {
    const g = newGame();
    const onMiss = vi.fn();
    g.events.on('miss', onMiss);
    g.start();
    g.update(DT, { ...idle, lick: true });
    expect(onMiss).toHaveBeenCalledOnce();
    expect(g.session.lickT).toBeGreaterThan(0);
  });

  it('collects a bone: score, full stamina, bone moves elsewhere', () => {
    const g = newGame();
    const onBone = vi.fn();
    g.events.on('bone', onBone);
    g.start();
    const bone = g.bones[0]!;
    bone.x = 0.5;
    bone.z = 0;
    g.dog.stam = 0.2;
    g.update(DT, idle);
    expect(onBone).toHaveBeenCalledWith({ points: RULES.bonePoints });
    expect(g.session.score).toBe(RULES.bonePoints);
    expect(g.dog.stam).toBeGreaterThan(0.99);
    expect(Math.hypot(bone.x, bone.z)).toBeGreaterThan(1.4);
    expect(bone.spin).toBeGreaterThan(0);
  });

  it('keeps the person within leash range while the dog sprints', () => {
    const g = newGame();
    g.start();
    for (let i = 0; i < 300; i++) {
      g.update(DT, { ...idle, moveY: 1, sprint: true });
      const hand = g.rag.body.rHand;
      const c = g.collar;
      expect(Math.hypot(hand.x - c.x, hand.y - c.y, hand.z - c.z)).toBeLessThanOrEqual(
        LEASH_LENGTH + 1e-6,
      );
    }
  });

  it('emits a yank message from the list when the person is knocked over', () => {
    const g = newGame();
    const msgs: string[] = [];
    g.events.on('yank', (e) => msgs.push(e.message));
    g.start();
    for (let i = 0; i < 240; i++) {
      g.update(DT, { ...idle, moveY: 1, sprint: true });
    }
    expect(msgs.length).toBeGreaterThan(0);
    for (const m of msgs) {
      expect(YANK_MESSAGES).toContain(m);
    }
    expect(g.rag.st.yanked).toBe(false);
  });

  it('ends the round after 90 s with the result and dragged distance', () => {
    const g = newGame(10);
    const over = vi.fn<(r: GameEvents['roundOver']) => void>();
    g.events.on('roundOver', over);
    g.start();
    g.session.score = 20;
    for (let t = 0; t < ROUND_SECONDS + 0.1; t += 0.05) {
      g.update(0.05, idle);
    }
    expect(g.phase).toBe('over');
    expect(over).toHaveBeenCalledOnce();
    expect(over.mock.calls[0]![0]).toMatchObject({
      score: 20,
      best: 20,
      newBest: true,
      bestChanged: true,
    });
    expect(over.mock.calls[0]![0].dragged).toBeGreaterThanOrEqual(0);
  });

  it('restarts with a fresh dog, bunny and person', () => {
    const g = newGame();
    g.start();
    for (let i = 0; i < 60; i++) {
      g.update(DT, { ...idle, moveY: 1 });
    }
    const oldRag = g.rag;
    g.session.phase = 'over';
    g.start();
    expect(g.dog.pos).toEqual({ x: 0, y: 0, z: 0 });
    expect(g.bunny.pos).toEqual({ x: 0, y: 0, z: -16 });
    expect(g.rag).not.toBe(oldRag);
    expect(g.scent.drops.every((d) => d.age > 12)).toBe(true);
  });

  it('steps the person once per update, so the collar speed is per step (#2)', () => {
    const g = newGame();
    g.start();
    g.update(DT, { ...idle, moveY: 1 });
    expect(g.rag.st.lc).toEqual({ x: g.collar.x, z: g.collar.z });
    g.update(DT, { ...idle, moveY: 1 });
    expect(g.rag.st.lc).toEqual({ x: g.collar.x, z: g.collar.z });
  });

  it('tracks the camera yaw the movement basis used', () => {
    const g = newGame();
    g.start();
    expect(g.camYaw).toBe(0);
    g.update(DT, { ...idle, lookX: -100 });
    expect(g.camYaw).toBeCloseTo(100 * CAMERA.yawPerPixel);
  });

  it('drops scent behind the bunny every quarter second', () => {
    const g = newGame();
    g.start();
    for (let i = 0; i < 60; i++) {
      g.update(DT, idle);
    }
    const fresh = g.scent.drops.filter((d) => d.age < 2);
    expect(fresh.length).toBeGreaterThanOrEqual(4);
    expect(fresh.length).toBeLessThanOrEqual(5);
  });
});
