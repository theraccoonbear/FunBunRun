import { lerp, lerpAngle } from '../core/math';
import type { Game } from './game';

/** Dog pose and animation inputs the view needs. */
export interface DogRender {
  x: number;
  y: number;
  z: number;
  heading: number;
  bodyY: number;
  pitch: number;
  amp: number;
  /** Gallop phase. */
  ph: number;
  grounded: boolean;
  /** Lick timer as the dog moved (drives the head and tongue). */
  lickT: number;
}

export interface BunnyRender {
  x: number;
  z: number;
  h: number;
  hopT: number;
  by: number;
  spd: number;
  tired: boolean;
}

/**
 * The parts of the simulation state that rendering reads, as plain numbers.
 * The runner keeps one copy per sim step and blends the last two for each
 * rendered frame, so motion is smooth at any refresh rate.
 */
export interface RenderState {
  elapsed: number;
  camYaw: number;
  camPitch: number;
  dog: DogRender;
  bunny: BunnyRender;
  boneSpin: number[];
  /** Ragdoll particle positions (person and rope), x, y, z per point in `rag.pts` order. */
  pts: number[];
}

export function createRenderState(): RenderState {
  return {
    elapsed: 0,
    camYaw: 0,
    camPitch: 0,
    dog: {
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      bodyY: 0,
      pitch: 0,
      amp: 0,
      ph: 0,
      grounded: true,
      lickT: 0,
    },
    bunny: { x: 0, z: 0, h: 0, hopT: 0, by: 0, spd: 0, tired: false },
    boneSpin: [],
    pts: [],
  };
}

/** Copies the render-relevant parts of the game state into `out`. */
export function captureState(game: Game, out: RenderState): RenderState {
  out.elapsed = game.session.elapsed;
  out.camYaw = game.camYaw;
  out.camPitch = game.look.pitch;
  const p = game.dog.pose;
  const d = out.dog;
  d.x = p.x;
  d.y = p.y;
  d.z = p.z;
  d.heading = p.heading;
  d.bodyY = p.bodyY;
  d.pitch = p.pitch;
  d.amp = p.amp;
  d.ph = game.dog.ph;
  d.grounded = game.dog.grounded;
  d.lickT = game.dogLickT;
  const b = game.bunny;
  const o = out.bunny;
  o.x = b.pos.x;
  o.z = b.pos.z;
  o.h = b.h;
  o.hopT = b.hopT;
  o.by = b.by;
  o.spd = b.spd;
  o.tired = b.tired > 0;
  const bones = game.bones;
  out.boneSpin.length = bones.length;
  for (let i = 0; i < bones.length; i++) {
    out.boneSpin[i] = bones[i]!.spin;
  }
  const pts = game.rag.pts;
  out.pts.length = pts.length * 3;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i]!;
    out.pts[i * 3] = q.x;
    out.pts[i * 3 + 1] = q.y;
    out.pts[i * 3 + 2] = q.z;
  }
  return out;
}

export function copyState(src: RenderState, out: RenderState): RenderState {
  return lerpState(src, src, 0, out);
}

/**
 * Blends two consecutive step states: `t` = 0 gives `a`, 1 gives `b`.
 * Angles take the shorter arc. Flags, and the lick timer when it jumps up
 * (a new lick), take `b`.
 */
export function lerpState(
  a: RenderState,
  b: RenderState,
  t: number,
  out: RenderState,
): RenderState {
  out.elapsed = lerp(a.elapsed, b.elapsed, t);
  out.camYaw = lerpAngle(a.camYaw, b.camYaw, t);
  out.camPitch = lerp(a.camPitch, b.camPitch, t);
  const ad = a.dog;
  const bd = b.dog;
  const od = out.dog;
  od.x = lerp(ad.x, bd.x, t);
  od.y = lerp(ad.y, bd.y, t);
  od.z = lerp(ad.z, bd.z, t);
  od.heading = lerpAngle(ad.heading, bd.heading, t);
  od.bodyY = lerp(ad.bodyY, bd.bodyY, t);
  od.pitch = lerp(ad.pitch, bd.pitch, t);
  od.amp = lerp(ad.amp, bd.amp, t);
  od.ph = lerp(ad.ph, bd.ph, t);
  od.grounded = bd.grounded;
  od.lickT = bd.lickT > ad.lickT ? bd.lickT : lerp(ad.lickT, bd.lickT, t);
  const ab = a.bunny;
  const bb = b.bunny;
  const ob = out.bunny;
  ob.x = lerp(ab.x, bb.x, t);
  ob.z = lerp(ab.z, bb.z, t);
  ob.h = lerpAngle(ab.h, bb.h, t);
  ob.hopT = lerp(ab.hopT, bb.hopT, t);
  ob.by = lerp(ab.by, bb.by, t);
  ob.spd = lerp(ab.spd, bb.spd, t);
  ob.tired = bb.tired;
  lerpArray(a.boneSpin, b.boneSpin, t, out.boneSpin);
  lerpArray(a.pts, b.pts, t, out.pts);
  return out;
}

/** Element-wise blend; where `a` is shorter, `b` is used as is. */
function lerpArray(a: readonly number[], b: readonly number[], t: number, out: number[]): void {
  out.length = b.length;
  for (let i = 0; i < b.length; i++) {
    const v = b[i]!;
    out[i] = i < a.length ? lerp(a[i]!, v, t) : v;
  }
}
