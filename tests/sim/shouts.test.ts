import { describe, expect, it } from 'vitest';
import { RAGDOLL, SHOUT, SIM } from '../../src/config';
import { createRng } from '../../src/core/rng';
import { Game } from '../../src/sim/game';
import { makeRagdollSim } from '../../src/sim/ragdoll';
import {
  createShoutProbe,
  createShouts,
  createShoutSense,
  isDraggedHard,
  probeBefore,
  resetShouts,
  senseAfter,
  updateShouts,
  type Shout,
  type ShoutSense,
} from '../../src/sim/shouts';

const H = SIM.step;

const dragged = (): ShoutSense => ({
  speed: SHOUT.dragSpeed + 1,
  tension: 0,
  down: true,
  impact: 0,
});
const calm = (): ShoutSense => ({ speed: 0, tension: 0, down: false, impact: 0 });

/** Runs `steps` fixed steps with the same sense and returns the step index of each shout. */
function run(
  sense: (i: number) => ShoutSense,
  steps: number,
  seed = 1,
): { at: number; shout: Shout }[] {
  const st = createShouts();
  const rng = createRng(seed);
  const out: { at: number; shout: Shout }[] = [];
  for (let i = 0; i < steps; i++) {
    const s = updateShouts(st, sense(i), rng, H);
    if (s) {
      out.push({ at: i, shout: s });
    }
  }
  return out;
}

describe('isDraggedHard', () => {
  it('needs speed and either being down or a taut leash', () => {
    expect(isDraggedHard(dragged())).toBe(true);
    expect(isDraggedHard({ ...dragged(), down: false })).toBe(false);
    expect(isDraggedHard({ ...dragged(), down: false, tension: SHOUT.dragTension })).toBe(true);
    expect(isDraggedHard({ ...dragged(), speed: SHOUT.dragSpeed - 0.1 })).toBe(false);
  });
});

describe('updateShouts', () => {
  it('stays quiet when the person is not dragged or hit', () => {
    expect(run(calm, 600)).toEqual([]);
  });

  it('waits for the build-up, then shouts a drag phrase', () => {
    const shouts = run(dragged, 120);
    expect(shouts.length).toBeGreaterThan(0);
    const first = shouts[0]!;
    expect(first.shout.kind).toBe('drag');
    expect(SHOUT.dragPhrases).toContain(first.shout.text);
    // Fires on the step where the accumulated drag time reaches the build-up.
    expect((first.at + 1) * H).toBeGreaterThanOrEqual(SHOUT.dragBuildUp - 1e-9);
    expect(first.at * H).toBeLessThan(SHOUT.dragBuildUp);
  });

  it('restarts the build-up when the drag stops', () => {
    // Dragged for less than the build-up, then calm for a step, repeatedly.
    const burst = Math.floor(SHOUT.dragBuildUp / H) - 2;
    const shouts = run((i) => (i % (burst + 1) === burst ? calm() : dragged()), 600);
    expect(shouts).toEqual([]);
  });

  it('spaces drag shouts by the random cooldown', () => {
    const shouts = run(dragged, 60 * 30);
    expect(shouts.length).toBeGreaterThan(3);
    for (let i = 1; i < shouts.length; i++) {
      const gap = (shouts[i]!.at - shouts[i - 1]!.at) * H;
      expect(gap).toBeGreaterThanOrEqual(SHOUT.dragCooldownMin - H);
      expect(gap).toBeLessThanOrEqual(SHOUT.dragCooldownMax + H);
    }
    // The cooldown is random, so the gaps differ.
    const gaps = new Set(shouts.slice(1).map((s, i) => s.at - shouts[i]!.at));
    expect(gaps.size).toBeGreaterThan(1);
  });

  it('shouts a short phrase on a hard impact, with its own cooldown', () => {
    const hit = (): ShoutSense => ({ ...calm(), impact: SHOUT.impactSpeed + 1 });
    const shouts = run(hit, 60 * 5);
    expect(shouts[0]).toMatchObject({ at: 0, shout: { kind: 'impact' } });
    expect(SHOUT.impactPhrases).toContain(shouts[0]!.shout.text);
    const gap = Math.max(SHOUT.impactCooldown, SHOUT.minGap);
    for (let i = 1; i < shouts.length; i++) {
      expect((shouts[i]!.at - shouts[i - 1]!.at) * H).toBeGreaterThanOrEqual(gap - H);
    }
  });

  it('ignores soft landings', () => {
    expect(run(() => ({ ...calm(), impact: SHOUT.impactSpeed - 0.5 }), 60)).toEqual([]);
  });

  it('keeps the minimum gap between an impact and a drag shout', () => {
    const shouts = run((i) => ({ ...dragged(), impact: i === 0 ? 10 : 0 }), 60 * 3);
    expect(shouts[0]!.shout.kind).toBe('impact');
    expect(shouts[1]!.shout.kind).toBe('drag');
    expect((shouts[1]!.at - shouts[0]!.at) * H).toBeGreaterThanOrEqual(SHOUT.minGap - H);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const a = run(dragged, 60 * 30, 42);
    expect(run(dragged, 60 * 30, 42)).toEqual(a);
    const differs = [1, 2, 3, 4, 5].some(
      (seed) => JSON.stringify(run(dragged, 60 * 30, seed)) !== JSON.stringify(a),
    );
    expect(differs).toBe(true);
  });

  it('resets every timer', () => {
    const st = createShouts();
    updateShouts(st, { ...dragged(), impact: 10 }, createRng(1), H);
    resetShouts(st);
    expect(st).toEqual(createShouts());
  });
});

describe('ragdoll sensing', () => {
  const rag = () => makeRagdollSim({ x: 0, z: 2.6, leash: 3.6, collar: { x: 0, y: 0.9, z: 0 } });

  it('reads pelvis speed, tension and being down over a step', () => {
    const r = rag();
    const probe = probeBefore(r.body, H, createShoutProbe());
    r.body.pelvis.x += 0.1;
    r.body.head.y = RAGDOLL.draggedHeadHeight - 0.1;
    const s = senseAfter(r.body, 0.7, probe, H, createShoutSense());
    expect(s.speed).toBeCloseTo(0.1 / H);
    expect(s.tension).toBe(0.7);
    expect(s.down).toBe(true);
    expect(s.impact).toBe(0);
  });

  it('reports the downward speed when the head or pelvis touches down', () => {
    const r = rag();
    const head = r.body.head;
    head.y = 0.5;
    head.py = 0.6; // falling 0.1 m per step
    const probe = probeBefore(r.body, H, createShoutProbe());
    head.py = head.y;
    head.y = head.r;
    const s = senseAfter(r.body, 0, probe, H, createShoutSense());
    expect(s.impact).toBeCloseTo(0.1 / H);

    // Already on the ground before the step: no new impact.
    const probe2 = probeBefore(r.body, H, createShoutProbe());
    expect(senseAfter(r.body, 0, probe2, H, createShoutSense()).impact).toBe(0);
  });

  it('reports a pelvis touchdown', () => {
    const r = rag();
    const pel = r.body.pelvis;
    pel.y = 0.3;
    pel.py = 0.4;
    const probe = probeBefore(r.body, H, createShoutProbe());
    pel.y = pel.r;
    expect(senseAfter(r.body, 0, probe, H, createShoutSense()).impact).toBeCloseTo(0.1 / H);
  });
});

describe('Game shouts', () => {
  it('emits personShout while the person is dragged, from a seeded stream', () => {
    const shoutsFor = (seed: number): string[] => {
      const game = new Game({ seed });
      game.start();
      const out: string[] = [];
      game.events.on('personShout', (e) => out.push(`${e.kind}:${e.text}`));
      const input = {
        moveX: 0,
        moveY: 1,
        lookX: 0,
        lookY: 0,
        turn: 0,
        sprint: true,
        jump: false,
        lick: false,
      };
      for (let i = 0; i < 60 * 12; i++) {
        // Zig-zag at sprint speed so the person is pulled over and dragged.
        input.moveX = Math.floor(i / 40) % 2 ? 1 : -1;
        game.update(H, input);
      }
      return out;
    };
    const a = shoutsFor(77);
    expect(a.length).toBeGreaterThan(0);
    expect(shoutsFor(77)).toEqual(a);
  });

  it('resets shout timers on a new round', () => {
    const game = new Game({ seed: 3 });
    game.start();
    game.shouts.gap = 5;
    game.shouts.dragT = 1;
    game.session.phase = 'over';
    game.start();
    expect(game.shouts).toEqual(createShouts());
  });
});
