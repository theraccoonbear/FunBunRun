import { describe, expect, it } from 'vitest';
import { BUNNY, SNIFF } from '../../src/config';
import {
  ageScent,
  clearScentTrail,
  createScentTrail,
  dropScent,
  scentOpacity,
} from '../../src/sim/scent';

describe('scent trail', () => {
  it('drops a marker per interval into a ring buffer', () => {
    const t = createScentTrail(3);
    dropScent(t, 1, 2, 0.01);
    expect(t.drops[0]).toEqual({ x: 1, z: 2, age: 0 });
    dropScent(t, 5, 5, BUNNY.trailInterval / 2);
    expect(t.next).toBe(1);
    for (let i = 0; i < 3; i++) {
      dropScent(t, i, i, BUNNY.trailInterval);
    }
    expect(t.next).toBe(1);
    expect(t.drops[0]).toMatchObject({ x: 2, z: 2 });
  });

  it('ages and clears markers', () => {
    const t = createScentTrail(2);
    dropScent(t, 0, 0, 1);
    ageScent(t, 3);
    expect(t.drops[0]!.age).toBe(3);
    clearScentTrail(t);
    expect(t.drops.every((d) => d.age >= SNIFF.trailLife)).toBe(true);
  });

  it('fades markers out over their lifetime', () => {
    expect(scentOpacity(0)).toBeCloseTo(SNIFF.trailOpacity);
    expect(scentOpacity(SNIFF.trailLife / 2)).toBeCloseTo(SNIFF.trailOpacity / 2);
    expect(scentOpacity(SNIFF.trailLife)).toBe(0);
  });
});
