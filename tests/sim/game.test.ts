import { describe, expect, it, vi } from 'vitest';
import { LEASH_LENGTH, ROUND_SECONDS, RULES, YANK_MESSAGES } from '../../src/config';
import { createRng } from '../../src/core/rng';
import { Game, type FrameInput, type GameEvents } from '../../src/sim/game';

const DT = 1 / 60;
const idle: FrameInput = {
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
  return new Game({ rng: createRng(42), best });
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

  it('defaults to Math.random', () => {
    const spy = vi.spyOn(Math, 'random');
    new Game();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
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
