import { RAGDOLL, SHOUT } from '../config';
import type { Rng } from '../core/rng';
import type { Particle } from './ragdoll';

/**
 * When and what the person on the leash shouts (#43). Pure: the game feeds
 * in what the ragdoll did during a step, and the renderer spells out any
 * shout returned.
 */

/** `drag`: a long shout while being dragged hard. `impact`: a short one on a hard landing. */
export type ShoutKind = 'drag' | 'impact';

export interface Shout {
  text: string;
  kind: ShoutKind;
}

export interface ShoutState {
  /** Seconds until any shout may fire again. */
  gap: number;
  /** Seconds until the next drag shout may fire. */
  dragCD: number;
  /** Seconds until the next impact shout may fire. */
  impactCD: number;
  /** Seconds of continuous hard dragging so far. */
  dragT: number;
}

/** What the person did during one step, as seen by the shout rules. */
export interface ShoutSense {
  /** Pelvis ground speed over the step, m/s. */
  speed: number;
  /** Leash tension 0..1. */
  tension: number;
  /** Head below the dragged height (the person is down). */
  down: boolean;
  /** Downward speed at touchdown this step, m/s; 0 when nothing landed. */
  impact: number;
}

export function createShouts(): ShoutState {
  return { gap: 0, dragCD: 0, impactCD: 0, dragT: 0 };
}

export function resetShouts(st: ShoutState): void {
  st.gap = 0;
  st.dragCD = 0;
  st.impactCD = 0;
  st.dragT = 0;
}

export function createShoutSense(): ShoutSense {
  return { speed: 0, tension: 0, down: false, impact: 0 };
}

/** Hard dragging: moving fast while either down or held on a taut leash. */
export function isDraggedHard(s: Readonly<ShoutSense>): boolean {
  return s.speed >= SHOUT.dragSpeed && (s.down || s.tension >= SHOUT.dragTension);
}

/**
 * Advances the shout timers by `dt` and returns the shout to make this step,
 * if any. Impacts win over drag shouts; `minGap` keeps shouts apart.
 */
export function updateShouts(
  st: ShoutState,
  sense: Readonly<ShoutSense>,
  rng: Rng,
  dt: number,
): Shout | null {
  st.gap -= dt;
  st.dragCD -= dt;
  st.impactCD -= dt;
  const hard = isDraggedHard(sense);
  st.dragT = hard ? st.dragT + dt : 0;
  if (st.gap > 0) {
    return null;
  }
  if (sense.impact >= SHOUT.impactSpeed && st.impactCD <= 0) {
    st.impactCD = SHOUT.impactCooldown;
    st.gap = SHOUT.minGap;
    return { text: rng.pick(SHOUT.impactPhrases), kind: 'impact' };
  }
  if (hard && st.dragT >= SHOUT.dragBuildUp && st.dragCD <= 0) {
    st.dragCD = rng.range(SHOUT.dragCooldownMin, SHOUT.dragCooldownMax);
    st.gap = SHOUT.minGap;
    return { text: rng.pick(SHOUT.dragPhrases), kind: 'drag' };
  }
  return null;
}

/** Ragdoll readings taken before a step, compared with the state after it. */
export interface ShoutProbe {
  pelX: number;
  pelZ: number;
  /** Vertical speed (m/s) going into the step; negative is falling. */
  headVy: number;
  pelVy: number;
  headAir: boolean;
  pelAir: boolean;
}

export function createShoutProbe(): ShoutProbe {
  return { pelX: 0, pelZ: 0, headVy: 0, pelVy: 0, headAir: false, pelAir: false };
}

interface ProbedBody {
  head: Particle;
  pelvis: Particle;
}

const grounded = (p: Particle): boolean => p.y <= p.r + RAGDOLL.groundSlop;

/** Records the head and pelvis before a ragdoll step of `dt` seconds. */
export function probeBefore(body: ProbedBody, dt: number, out: ShoutProbe): ShoutProbe {
  out.pelX = body.pelvis.x;
  out.pelZ = body.pelvis.z;
  out.headVy = (body.head.y - body.head.py) / dt;
  out.pelVy = (body.pelvis.y - body.pelvis.py) / dt;
  out.headAir = !grounded(body.head);
  out.pelAir = !grounded(body.pelvis);
  return out;
}

/** Fills `out` from the ragdoll after the step that `probe` was taken before. */
export function senseAfter(
  body: ProbedBody,
  tension: number,
  probe: Readonly<ShoutProbe>,
  dt: number,
  out: ShoutSense,
): ShoutSense {
  out.speed = Math.hypot(body.pelvis.x - probe.pelX, body.pelvis.z - probe.pelZ) / dt;
  out.tension = tension;
  out.down = body.head.y < RAGDOLL.draggedHeadHeight;
  let impact = 0;
  if (probe.headAir && grounded(body.head)) {
    impact = Math.max(impact, -probe.headVy);
  }
  if (probe.pelAir && grounded(body.pelvis)) {
    impact = Math.max(impact, -probe.pelVy);
  }
  out.impact = impact;
  return out;
}
