import { RAGDOLL } from '../config';
import type { Vec2, Vec3 } from '../core/math';

/**
 * Person-on-a-leash ragdoll: Verlet particles with distance constraints. The
 * person's body and the leash rope share one solver; the rope's first point
 * is pinned to the dog's collar and its last point is the person's right hand.
 */

export interface Particle {
  name: string;
  x: number;
  y: number;
  z: number;
  /** Previous position (Verlet). */
  px: number;
  py: number;
  pz: number;
  /** Collision radius. */
  r: number;
  /** Inverse mass; 0 pins the particle. */
  im: number;
}

interface Constraint {
  a: Particle;
  b: Particle;
  len: number;
  /** Stiffness 0..1. */
  s: number;
  /** Ropes only pull, never push. */
  rope: boolean;
}

export type BodyPart =
  | 'head'
  | 'neck'
  | 'pelvis'
  | 'lElbow'
  | 'lHand'
  | 'rElbow'
  | 'rHand'
  | 'lKnee'
  | 'lFoot'
  | 'rKnee'
  | 'rFoot';

export interface RagdollStatus {
  /** Seconds of stun left; negative values count recovery time. */
  stun: number;
  /** Leash tension 0..1 from the last step. */
  tension: number;
  /** Cooldown before the next yank can register. */
  yank: number;
  walkPh: number;
  /** Walk leg/arm swing, -1..1; eases back to 0 after the person stops walking. */
  swing: number;
  /** Metres the person has been dragged while down. */
  dragged: number;
  /** Set when a yank knocks the person down; the game clears it. */
  yanked: boolean;
  /** Collar position at the previous step; null before the first step. */
  lc: Vec2 | null;
}

export interface Ragdoll {
  pts: Particle[];
  body: Record<BodyPart, Particle>;
  rope: Particle[];
  st: RagdollStatus;
  /** Leash length. */
  L: number;
  step(h: number, collar: Readonly<Vec3>, collide: (p: Particle) => void): void;
}

export interface RagdollOptions {
  x: number;
  z: number;
  leash: number;
  collar: Readonly<Vec3>;
}

export function makeRagdollSim(opts: RagdollOptions): Ragdoll {
  const G = RAGDOLL.gravity;
  const pts: Particle[] = [];
  const cons: Constraint[] = [];
  function P(name: string, x: number, y: number, z: number, r: number, im: number): Particle {
    const p = { name, x, y, z, px: x, py: y, pz: z, r, im };
    pts.push(p);
    return p;
  }
  function C(a: Particle, b: Particle, stiff: number): void {
    cons.push({ a, b, len: Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z), s: stiff, rope: false });
  }
  const ox = opts.x;
  const oz = opts.z;
  const b: Record<BodyPart, Particle> = {
    head: P('head', ox, 1.62, oz, 0.16, 1),
    neck: P('neck', ox, 1.4, oz, 0.12, 1),
    pelvis: P('pelvis', ox, 0.95, oz, 0.14, 1),
    lElbow: P('lElbow', ox - 0.32, 1.15, oz, 0.07, 1),
    lHand: P('lHand', ox - 0.36, 0.9, oz, 0.06, 1),
    rElbow: P('rElbow', ox + 0.32, 1.15, oz, 0.07, 1),
    rHand: P('rHand', ox + 0.36, 0.9, oz - 0.05, 0.06, 1),
    lKnee: P('lKnee', ox - 0.12, 0.5, oz, 0.08, 1),
    lFoot: P('lFoot', ox - 0.12, 0.08, oz, 0.08, 1),
    rKnee: P('rKnee', ox + 0.12, 0.5, oz, 0.08, 1),
    rFoot: P('rFoot', ox + 0.12, 0.08, oz, 0.08, 1),
  };
  C(b.head, b.neck, 1);
  C(b.neck, b.pelvis, 1);
  C(b.head, b.pelvis, 0.6);
  C(b.neck, b.lElbow, 1);
  C(b.lElbow, b.lHand, 1);
  C(b.neck, b.rElbow, 1);
  C(b.rElbow, b.rHand, 1);
  C(b.pelvis, b.lKnee, 1);
  C(b.lKnee, b.lFoot, 1);
  C(b.pelvis, b.rKnee, 1);
  C(b.rKnee, b.rFoot, 1);
  C(b.lKnee, b.rKnee, 0.3);
  C(b.lElbow, b.rElbow, 0.15);
  const bodyPts = pts.slice();
  // Particles the standing pose pulls toward, and their per-step target buffer (x, y, z each).
  const poseParts: Particle[] = [
    b.lFoot,
    b.rFoot,
    b.lKnee,
    b.rKnee,
    b.pelvis,
    b.neck,
    b.head,
    b.rElbow,
    b.rHand,
    b.lElbow,
    b.lHand,
  ];
  const poseTargets = new Float64Array(poseParts.length * 3);

  // Leash rope: rope[0] pinned to the dog collar, last point is the person's right hand
  const L = opts.leash;
  const N = RAGDOLL.ropeSegments;
  const rope: Particle[] = [];
  const c0 = opts.collar;
  for (let i = 0; i < N; i++) {
    const t = i / N;
    rope.push(
      P(
        'rope' + i,
        c0.x + (b.rHand.x - c0.x) * t,
        c0.y + (b.rHand.y - c0.y) * t,
        c0.z + (b.rHand.z - c0.z) * t,
        RAGDOLL.ropeRadius,
        i === 0 ? 0 : RAGDOLL.ropeInvMass,
      ),
    );
  }
  rope.push(b.rHand);
  const ropeCons: Constraint[] = [];
  for (let i = 0; i < N; i++) {
    ropeCons.push({ a: rope[i]!, b: rope[i + 1]!, len: L / N, s: 1, rope: true });
  }

  const st: RagdollStatus = {
    stun: RAGDOLL.initialStun,
    tension: 0,
    yank: 0,
    walkPh: 0,
    swing: 0,
    dragged: 0,
    yanked: false,
    lc: null,
  };

  function solve(c: Constraint): void {
    const a = c.a;
    const bb = c.b;
    const dx = bb.x - a.x;
    const dy = bb.y - a.y;
    const dz = bb.z - a.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
    if (c.rope && d < c.len) {
      return; // ropes only pull
    }
    const w = a.im + bb.im;
    if (w === 0) {
      return;
    }
    const diff = ((d - c.len) / d) * c.s;
    a.x += (dx * diff * a.im) / w;
    a.y += (dy * diff * a.im) / w;
    a.z += (dz * diff * a.im) / w;
    bb.x -= (dx * diff * bb.im) / w;
    bb.y -= (dy * diff * bb.im) / w;
    bb.z -= (dz * diff * bb.im) / w;
  }
  function shiftBody(dx: number, dz: number): void {
    for (const p of bodyPts) {
      p.x += dx;
      p.px += dx;
      p.z += dz;
      p.pz += dz;
    }
  }

  function step(h: number, collar: Readonly<Vec3>, collide: (p: Particle) => void): void {
    const r0 = rope[0]!;
    r0.x = r0.px = collar.x;
    r0.y = r0.py = collar.y;
    r0.z = r0.pz = collar.z;
    const pelX0 = b.pelvis.x;
    const pelZ0 = b.pelvis.z;

    // Integrate
    for (const p of pts) {
      if (p.im === 0) {
        continue;
      }
      let vx = (p.x - p.px) * RAGDOLL.damping;
      const vy = (p.y - p.py) * RAGDOLL.damping;
      let vz = (p.z - p.pz) * RAGDOLL.damping;
      if (p.y <= p.r + RAGDOLL.groundSlop) {
        vx *= RAGDOLL.groundFriction;
        vz *= RAGDOLL.groundFriction;
      }
      p.px = p.x;
      p.py = p.y;
      p.pz = p.z;
      p.x += vx;
      p.y += vy - G * h * h;
      p.z += vz;
    }

    // The person tries to get up and follow the dog: blend toward a standing pose,
    // ramping in after each yank so they visibly scramble back to their feet.
    st.stun -= h;
    st.yank -= h;
    const standing = b.head.y > RAGDOLL.standHeadHeight && b.pelvis.y > RAGDOLL.standPelvisHeight;
    const rec = Math.max(0, Math.min(1, -st.stun / RAGDOLL.recoverTime));
    if (rec > 0) {
      const Fx = (b.lFoot.x + b.rFoot.x) / 2;
      const Fz = (b.lFoot.z + b.rFoot.z) / 2;
      let fx = collar.x - Fx;
      let fz = collar.z - Fz;
      const fd = Math.sqrt(fx * fx + fz * fz) || 1;
      fx /= fd;
      fz /= fd;
      const rx = -fz;
      const rz = fx;
      // The swing persists across steps so it eases out after walking stops
      // (it was a per-step local, so the decay below always decayed 0).
      if (standing && fd > L * RAGDOLL.followFraction) {
        const sp = RAGDOLL.walkSpeed * h * rec;
        shiftBody(fx * sp, fz * sp);
        st.walkPh += h * RAGDOLL.walkPhaseRate;
        st.swing = Math.sin(st.walkPh);
      } else {
        st.swing *= RAGDOLL.swingDecay;
      }
      const swing = st.swing;
      // Targets go into a preallocated buffer, in the order of `poseParts`.
      const T = poseTargets;
      T[0] = Fx - rx * 0.12 + fx * swing * 0.25;
      T[1] = 0.08;
      T[2] = Fz - rz * 0.12 + fz * swing * 0.25;
      T[3] = Fx + rx * 0.12 - fx * swing * 0.25;
      T[4] = 0.08;
      T[5] = Fz + rz * 0.12 - fz * swing * 0.25;
      T[6] = Fx - rx * 0.12 + fx * (0.06 + swing * 0.12);
      T[7] = 0.5;
      T[8] = Fz - rz * 0.12 + fz * (0.06 + swing * 0.12);
      T[9] = Fx + rx * 0.12 + fx * (0.06 - swing * 0.12);
      T[10] = 0.5;
      T[11] = Fz + rz * 0.12 + fz * (0.06 - swing * 0.12);
      T[12] = Fx;
      T[13] = 0.95;
      T[14] = Fz;
      T[15] = Fx + fx * 0.06;
      T[16] = 1.4;
      T[17] = Fz + fz * 0.06;
      T[18] = Fx + fx * 0.08;
      T[19] = 1.62;
      T[20] = Fz + fz * 0.08;
      T[21] = Fx + rx * 0.25 + fx * 0.22;
      T[22] = 1.2;
      T[23] = Fz + rz * 0.25 + fz * 0.22;
      T[24] = Fx + rx * 0.2 + fx * 0.5;
      T[25] = 1.15;
      T[26] = Fz + rz * 0.2 + fz * 0.5;
      T[27] = Fx - rx * 0.3 - fx * swing * 0.1;
      T[28] = 1.15;
      T[29] = Fz - rz * 0.3 - fz * swing * 0.1;
      T[30] = Fx - rx * 0.34 - fx * swing * 0.25;
      T[31] = 0.9;
      T[32] = Fz - rz * 0.34 - fz * swing * 0.25;
      const s = RAGDOLL.poseStrength * rec;
      const damp = 1 - RAGDOLL.poseDamping * rec;
      for (let i = 0; i < poseParts.length; i++) {
        const p = poseParts[i]!;
        const vx = (p.x - p.px) * damp;
        const vy = (p.y - p.py) * damp;
        const vz = (p.z - p.pz) * damp;
        p.x += (T[i * 3]! - p.x) * s;
        p.y += (T[i * 3 + 1]! - p.y) * s;
        p.z += (T[i * 3 + 2]! - p.z) * s;
        p.px = p.x - vx;
        p.py = p.y - vy;
        p.pz = p.z - vz;
      }
    }

    // Constraints
    let pull = 0;
    for (let it = 0; it < RAGDOLL.solverIterations; it++) {
      for (const c of cons) {
        solve(c);
      }
      for (const c of ropeCons) {
        solve(c);
      }
      // Hard leash limit: the dog always wins
      const hx = b.rHand.x - collar.x;
      const hy = b.rHand.y - collar.y;
      const hz = b.rHand.z - collar.z;
      const hd = Math.sqrt(hx * hx + hy * hy + hz * hz);
      if (hd > L) {
        const k = L / hd;
        pull += hd - L;
        b.rHand.x = collar.x + hx * k;
        b.rHand.y = collar.y + hy * k;
        b.rHand.z = collar.z + hz * k;
      }
      for (const p of pts) {
        if (p.y < p.r) {
          p.y = p.r;
        }
      }
    }
    for (const p of bodyPts) {
      collide(p);
    }

    st.tension = Math.min(1, pull * RAGDOLL.tensionScale);
    // Only a moving dog knocks the human over; slack-taking while they get up does not
    const cs = st.lc ? Math.sqrt((collar.x - st.lc.x) ** 2 + (collar.z - st.lc.z) ** 2) / h : 0;
    if (st.lc) {
      st.lc.x = collar.x;
      st.lc.z = collar.z;
    } else {
      st.lc = { x: collar.x, z: collar.z };
    }
    if (pull > RAGDOLL.stunPull && cs > RAGDOLL.yankCollarSpeed) {
      st.stun = Math.max(st.stun, RAGDOLL.stunTime);
    }
    if (pull > RAGDOLL.yankPull && cs > RAGDOLL.yankCollarSpeed && standing && st.yank <= 0) {
      st.yank = RAGDOLL.yankCooldown;
      st.yanked = true;
    }
    if (b.head.y < RAGDOLL.draggedHeadHeight) {
      st.dragged += Math.sqrt((b.pelvis.x - pelX0) ** 2 + (b.pelvis.z - pelZ0) ** 2);
    }
  }

  return { pts, body: b, rope, st, step, L };
}
