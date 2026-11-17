import { describe, expect, it } from 'vitest';
import { SIM } from '../../src/config';
import { createRng } from '../../src/core/rng';
import { Game, type StepInput } from '../../src/sim/game';
import {
  captureState,
  copyState,
  createRenderState,
  lerpState,
  type RenderState,
} from '../../src/sim/interp';
import { SimRunner } from '../../src/sim/runner';

const H = SIM.step;
const run: StepInput = {
  moveX: 0,
  moveY: 1,
  lookX: 0,
  lookY: 0,
  turn: 0,
  sprint: true,
  jump: false,
  lick: false,
};
const source = { take: (): StepInput => run };

function playing(): Game {
  const g = new Game({ rng: createRng(8) });
  g.start();
  return g;
}

describe('captureState', () => {
  it('copies the render-relevant game state', () => {
    const g = playing();
    for (let i = 0; i < 30; i++) {
      g.update(H, run);
    }
    const s = captureState(g, createRenderState());
    expect(s.elapsed).toBe(g.session.elapsed);
    expect(s.camYaw).toBe(g.camYaw);
    expect(s.camPitch).toBe(g.look.pitch);
    expect(s.dog).toMatchObject({
      x: g.dog.pose.x,
      z: g.dog.pose.z,
      heading: g.dog.pose.heading,
      ph: g.dog.ph,
      grounded: g.dog.grounded,
      lickT: g.dogLickT,
    });
    expect(s.bunny).toMatchObject({ x: g.bunny.pos.x, z: g.bunny.pos.z, hopT: g.bunny.hopT });
    expect(s.boneSpin).toEqual(g.bones.map((b) => b.spin));
    expect(s.pts).toHaveLength(g.rag.pts.length * 3);
    const head = g.rag.pts.indexOf(g.rag.body.head);
    expect(s.pts.slice(head * 3, head * 3 + 3)).toEqual([
      g.rag.body.head.x,
      g.rag.body.head.y,
      g.rag.body.head.z,
    ]);
  });
});

describe('lerpState', () => {
  function pair(): [RenderState, RenderState] {
    const a = createRenderState();
    const b = createRenderState();
    a.elapsed = 1;
    b.elapsed = 2;
    a.dog.x = 0;
    b.dog.x = 10;
    a.dog.heading = 3;
    b.dog.heading = -3;
    b.dog.grounded = false;
    a.bunny.h = -3;
    b.bunny.h = 3;
    b.bunny.tired = true;
    a.boneSpin = [0, 1];
    b.boneSpin = [1, 2];
    a.pts = [0, 0, 0];
    b.pts = [2, 4, 6];
    return [a, b];
  }

  it('returns a at 0 and b at 1', () => {
    const [a, b] = pair();
    expect(lerpState(a, b, 0, createRenderState())).toEqual({
      ...a,
      dog: { ...a.dog, grounded: false },
      bunny: { ...a.bunny, tired: true },
    });
    const end = lerpState(a, b, 1, createRenderState());
    // Angles arrive at b up to a whole turn.
    const turn = (x: number): number => Math.cos(x);
    expect(turn(end.dog.heading)).toBeCloseTo(turn(b.dog.heading), 12);
    expect(turn(end.bunny.h)).toBeCloseTo(turn(b.bunny.h), 12);
    expect({
      ...end,
      dog: { ...end.dog, heading: b.dog.heading },
      bunny: { ...end.bunny, h: b.bunny.h },
    }).toEqual(b);
  });

  it('blends positions halfway and angles along the shorter arc', () => {
    const [a, b] = pair();
    const m = lerpState(a, b, 0.5, createRenderState());
    expect(m.elapsed).toBe(1.5);
    expect(m.dog.x).toBe(5);
    expect(Math.abs(m.dog.heading)).toBeCloseTo(Math.PI);
    expect(Math.abs(m.bunny.h)).toBeCloseTo(Math.PI);
    expect(m.boneSpin).toEqual([0.5, 1.5]);
    expect(m.pts).toEqual([1, 2, 3]);
  });

  it('shows a new lick at once instead of blending into it', () => {
    const [a, b] = pair();
    a.dog.lickT = 0;
    b.dog.lickT = 0.3;
    expect(lerpState(a, b, 0.5, createRenderState()).dog.lickT).toBe(0.3);
    a.dog.lickT = 0.3;
    b.dog.lickT = 0.2;
    expect(lerpState(a, b, 0.5, createRenderState()).dog.lickT).toBeCloseTo(0.25);
  });

  it('uses b where a has fewer points', () => {
    const [a, b] = pair();
    a.pts = [];
    expect(lerpState(a, b, 0.5, createRenderState()).pts).toEqual([2, 4, 6]);
  });

  it('copyState makes an equal copy', () => {
    const [, b] = pair();
    const c = copyState(b, createRenderState());
    expect(c).toEqual(b);
    expect(c.pts).not.toBe(b.pts);
  });
});

describe('SimRunner rendering', () => {
  it('interpolates between the last two steps by the owed fraction of a step', () => {
    const g = playing();
    const r = new SimRunner(g);
    r.frame(H * 20, source);
    r.frame(H * 20, source);
    const before = g.dog.pose.z;
    r.frame(H * 1.25, source);
    const after = g.dog.pose.z;
    expect(r.alpha).toBeCloseTo(0.25);
    const view = r.render();
    expect(view.dog.z).toBeCloseTo(before + (after - before) * 0.25, 9);
    // More time without a step moves the view toward the latest step.
    r.frame(H * 0.5, source);
    expect(r.render().dog.z).toBeCloseTo(before + (after - before) * 0.75, 9);
  });

  it('snaps to the new round on start instead of blending from the old one', () => {
    const g = playing();
    const r = new SimRunner(g);
    for (let i = 0; i < 30; i++) {
      r.frame(H * 4, source);
    }
    r.frame(H / 2, source);
    g.session.phase = 'over';
    g.start();
    const view = r.render();
    expect(view.dog.x).toBe(0);
    expect(view.dog.z).toBe(0);
    expect(view.bunny.z).toBe(g.bunny.pos.z);
    const pelvis = g.rag.pts.indexOf(g.rag.body.pelvis);
    expect(view.pts[pelvis * 3]).toBe(g.rag.body.pelvis.x);
  });

  it('passes each step its sim time', () => {
    const g = playing();
    const r = new SimRunner(g);
    const times: number[] = [];
    r.frame(H * 3.5, {
      take: (t) => {
        times.push(t);
        return run;
      },
    });
    expect(times).toEqual([0, H, 2 * H]);
    expect(r.ticks).toBe(3);
  });
});
