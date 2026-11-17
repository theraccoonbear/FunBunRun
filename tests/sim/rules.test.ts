import { describe, expect, it } from 'vitest';
import { DOG, RULES } from '../../src/config';
import {
  canPickBone,
  createReach,
  formatClock,
  lickPoints,
  lickReach,
  nextCombo,
  showsNewBest,
  updatedBest,
} from '../../src/sim/rules';

const dog = { x: 0, y: 0, z: 0 };

describe('lickReach', () => {
  it('is in range under 2.6 m when the bunny is not immune', () => {
    const r = lickReach(dog, { x: 0, y: 0, z: 2.5 }, 0, createReach());
    expect(r).toMatchObject({ ok: true, dx: 0, dz: 2.5 });
    expect(r.d).toBeCloseTo(2.5);
    expect(lickReach(dog, { x: 0, y: 0, z: 2.6 }, 0, createReach()).ok).toBe(false);
  });

  it('is blocked while the bunny is immune after a lick', () => {
    expect(lickReach(dog, { x: 1, y: 0, z: 0 }, 0.5, createReach()).ok).toBe(false);
    expect(lickReach(dog, { x: 1, y: 0, z: 0 }, 0, createReach()).ok).toBe(true);
  });

  it('succeeds with the dog at peak jump height (#4)', () => {
    const peak = (DOG.jumpVelocity * DOG.jumpVelocity) / (2 * DOG.gravity);
    expect(lickReach({ x: 0, y: peak, z: 0 }, { x: 1, y: 0, z: 0 }, 0, createReach()).ok).toBe(
      true,
    );
  });
});

describe('combo and scoring', () => {
  it('extends the combo within the window and resets after it', () => {
    expect(nextCombo(0, 5, RULES.noLickTime)).toBe(1);
    expect(nextCombo(1, 10, 5)).toBe(2);
    expect(nextCombo(2, 12.99, 5)).toBe(3);
    expect(nextCombo(3, 13, 5)).toBe(1);
  });

  it('scores 100 points times the combo', () => {
    expect(lickPoints(1)).toBe(100);
    expect(lickPoints(4)).toBe(400);
  });
});

describe('bones', () => {
  it('are picked up within 1.4 m', () => {
    expect(canPickBone(dog, 1, 0.9)).toBe(true);
    expect(canPickBone(dog, 1.4, 0)).toBe(false);
  });

  it('are picked up with the dog at peak jump height (#4)', () => {
    const peak = (DOG.jumpVelocity * DOG.jumpVelocity) / (2 * DOG.gravity);
    expect(canPickBone({ x: 0, y: peak, z: 0 }, 1, 0)).toBe(true);
  });
});

describe('best score', () => {
  it('only rises', () => {
    expect(updatedBest(500, 300)).toBe(500);
    expect(updatedBest(200, 300)).toBe(300);
  });

  it('shows "New best!" for a new record but not for zero', () => {
    expect(showsNewBest(500, updatedBest(500, 300))).toBe(true);
    expect(showsNewBest(200, updatedBest(200, 300))).toBe(false);
    expect(showsNewBest(0, updatedBest(0, 0))).toBe(false);
  });

  it('also shows "New best!" on a tie (prototype behaviour, #5)', () => {
    expect(showsNewBest(300, updatedBest(300, 300))).toBe(true);
  });
});

describe('formatClock', () => {
  it('rounds up to whole seconds', () => {
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(89.01)).toBe('1:30');
    expect(formatClock(89)).toBe('1:29');
    expect(formatClock(9.5)).toBe('0:10');
    expect(formatClock(0)).toBe('0:00');
  });
});
