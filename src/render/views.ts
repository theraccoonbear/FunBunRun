import * as THREE from 'three';
import { FX, RAGDOLL, RULES } from '../config';
import type { DogState } from '../sim/dog';
import type { Bone } from '../sim/game';
import type { BunnyRender, DogRender } from '../sim/interp';
import type { BodyPart, Ragdoll } from '../sim/ragdoll';
import {
  blobShadow,
  boneMaterial,
  makeBone,
  makeBunny,
  makeDog,
  type BunnyModel,
  type DogModel,
} from './models';

/** Syncs the dog model to the (interpolated) sim pose and runs the procedural gallop, tail, ears and lick. */
export class DogView {
  readonly model: DogModel = makeDog();

  constructor(scene: THREE.Scene) {
    scene.add(this.model.root);
  }

  /** Root placement only (position and heading). */
  place(d: DogState): void {
    this.model.root.position.set(d.pose.x, d.pose.y, d.pose.z);
    this.model.root.rotation.y = d.pose.heading;
  }

  sync(p: DogRender, elapsed: number): void {
    const m = this.model;
    const amp = p.amp;
    m.root.position.set(p.x, p.y, p.z);
    m.root.rotation.y = p.heading;
    m.body.position.y = p.bodyY;
    m.body.rotation.x = p.pitch;
    const [l0, l1, l2, l3] = m.legs as [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
    if (!p.grounded) {
      l0.rotation.x = l1.rotation.x = -0.9;
      l2.rotation.x = l3.rotation.x = 0.9;
    } else {
      l0.rotation.x = Math.sin(p.ph) * 0.9 * amp;
      l1.rotation.x = Math.sin(p.ph + 0.4) * 0.9 * amp;
      l2.rotation.x = Math.sin(p.ph + 2.4) * 0.9 * amp;
      l3.rotation.x = Math.sin(p.ph + 2.8) * 0.9 * amp;
    }
    m.tail.rotation.y = Math.sin(elapsed * 14) * 0.6;
    const ear = -Math.abs(Math.sin(p.ph)) * 0.6 * amp - (p.grounded ? 0 : 0.8);
    for (const e of m.ears) {
      e.rotation.x = ear;
    }
    const lickT = p.lickT;
    const ext = lickT > 0 ? Math.sin((1 - lickT / RULES.lickDuration) * Math.PI) : 0;
    m.head.position.z = 0.52 + ext * 0.12;
    m.head.rotation.x = ext * 0.25;
    m.tonguePivot.scale.set(1, 1, 1 + ext * 3);
  }
}

export class BunnyView {
  readonly model: BunnyModel = makeBunny();

  constructor(scene: THREE.Scene) {
    scene.add(this.model.outer);
  }

  sync(b: BunnyRender): void {
    const m = this.model;
    const hy = Math.abs(Math.sin(b.hopT)) * (0.08 + b.spd * 0.04) + b.by;
    m.outer.position.set(b.x, 0, b.z);
    m.outer.rotation.y = b.h;
    m.inner.position.y = hy;
    m.inner.rotation.x = -Math.cos(b.hopT) * 0.15 * Math.min(1, b.spd / 5);
    const earFlop = b.tired ? 0.9 : 0.15 + Math.sin(b.hopT) * 0.15;
    for (const e of m.ears) {
      e.rotation.x = -earFlop;
    }
  }

  /** Menu pose: hopping on the spot at the start position, slowly turning. */
  syncMenu(hopT: number, elapsed: number, x: number, z: number): void {
    const m = this.model;
    m.outer.position.set(x, 0, z);
    m.outer.rotation.y = elapsed * 0.5;
    m.inner.position.y = Math.abs(Math.sin(hopT)) * 0.15;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();

/**
 * Places a unit-height, y-aligned cylinder between points `a` and `b`, given
 * as indices into a flat x, y, z position array.
 */
function placeLimb(mesh: THREE.Object3D, p: readonly number[], a: number, b: number): void {
  const ax = p[a * 3]!;
  const ay = p[a * 3 + 1]!;
  const az = p[a * 3 + 2]!;
  const bx = p[b * 3]!;
  const by = p[b * 3 + 1]!;
  const bz = p[b * 3 + 2]!;
  tmpV.set(bx - ax, by - ay, bz - az);
  const len = tmpV.length();
  mesh.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
  if (len > 1e-5) {
    tmpV.multiplyScalar(1 / len);
    mesh.quaternion.setFromUnitVectors(UP, tmpV);
  }
  mesh.scale.set(1, len, 1);
}

type Limb = [BodyPart, BodyPart, THREE.Mesh];
type Joint = [BodyPart, THREE.Mesh];

/** Index of each body part in `rag.pts`, resolved when a ragdoll is bound. */
type PartIndex = Record<BodyPart, number>;

/**
 * The person and the leash, drawn from the ragdoll particles. Meshes,
 * geometries and materials are created once and rebound to each new
 * ragdoll, so restarting a round allocates nothing on the GPU.
 */
export class PersonView {
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private readonly root = new THREE.Group();
  private readonly limbs: Limb[];
  private readonly joints: Joint[];
  private readonly leashSegs: THREE.Mesh[] = [];
  private readonly headMesh: THREE.Mesh;
  private readonly hairMesh: THREE.Mesh;
  private readonly shadow = new THREE.Group();
  private rag: Ragdoll | null = null;
  private part: PartIndex | null = null;
  private ropeIdx: number[] = [];
  private own: number[] = [];

  constructor(private readonly scene: THREE.Scene) {
    const mat = (color: number): THREE.MeshLambertMaterial =>
      this.track(this.materials, new THREE.MeshLambertMaterial({ color }));
    const skin = mat(0xf1c27d);
    const shirt = mat(0x3f7fd9);
    const pants = mat(0x3b3b55);
    const leashMat = mat(0xd62e3e);
    const hairMat = mat(0x5a3a1e);
    // One unit-height cylinder per radius, shared by every limb of that radius.
    const cylinders = new Map<number, THREE.CylinderGeometry>();
    const cylinder = (r: number): THREE.CylinderGeometry => {
      let g = cylinders.get(r);
      if (!g) {
        g = this.track(this.geometries, new THREE.CylinderGeometry(r, r, 1, 8));
        cylinders.set(r, g);
      }
      return g;
    };
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material): THREE.Mesh => {
      const x = new THREE.Mesh(g, m);
      this.root.add(x);
      return x;
    };
    const limb = (a: BodyPart, b: BodyPart, r: number, m: THREE.Material): Limb => [
      a,
      b,
      mesh(cylinder(r), m),
    ];
    this.limbs = [
      limb('neck', 'pelvis', 0.17, shirt),
      limb('neck', 'lElbow', 0.06, shirt),
      limb('lElbow', 'lHand', 0.05, skin),
      limb('neck', 'rElbow', 0.06, shirt),
      limb('rElbow', 'rHand', 0.05, skin),
      limb('pelvis', 'lKnee', 0.08, pants),
      limb('lKnee', 'lFoot', 0.07, pants),
      limb('pelvis', 'rKnee', 0.08, pants),
      limb('rKnee', 'rFoot', 0.07, pants),
    ];
    const jointGeo = this.track(this.geometries, new THREE.SphereGeometry(1, 8, 6));
    const jointSpecs: [BodyPart, number, THREE.Material][] = [
      ['pelvis', 0.17, pants],
      ['neck', 0.17, shirt],
      ['lElbow', 0.06, shirt],
      ['rElbow', 0.06, shirt],
      ['lKnee', 0.08, pants],
      ['rKnee', 0.08, pants],
      ['lHand', 0.065, skin],
      ['rHand', 0.065, skin],
      ['lFoot', 0.09, pants],
      ['rFoot', 0.09, pants],
    ];
    this.joints = jointSpecs.map(([p, r, m]) => {
      const j = mesh(jointGeo, m);
      j.scale.setScalar(r);
      return [p, j];
    });
    this.headMesh = mesh(this.track(this.geometries, new THREE.SphereGeometry(0.16, 12, 10)), skin);
    this.hairMesh = mesh(
      this.track(
        this.geometries,
        new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      ),
      hairMat,
    );
    for (let i = 0; i < RAGDOLL.ropeSegments; i++) {
      this.leashSegs.push(mesh(cylinder(0.022), leashMat));
    }
    const shadow = blobShadow(this.shadow, 0.5);
    this.track(this.geometries, shadow.geometry);
    this.track(this.materials, shadow.material as THREE.Material);
    this.root.add(this.shadow);
    scene.add(this.root);
  }

  private track<U, T extends U>(list: U[], item: T): T {
    list.push(item);
    return item;
  }

  /** Binds the view to a (new) ragdoll. */
  bind(rag: Ragdoll): void {
    this.rag = rag;
    const part = {} as PartIndex;
    for (const k of Object.keys(rag.body) as BodyPart[]) {
      part[k] = rag.pts.indexOf(rag.body[k]);
    }
    this.part = part;
    this.ropeIdx = rag.rope.map((p) => rag.pts.indexOf(p));
  }

  /**
   * Draws the person and leash from `pts` (x, y, z per point in `rag.pts`
   * order, as interpolated by the sim runner), or from the bound ragdoll's
   * current particles when omitted.
   */
  sync(pts?: readonly number[]): void {
    const rag = this.rag;
    const part = this.part;
    if (!rag || !part) {
      return;
    }
    let p = pts;
    if (!p) {
      const own = this.own;
      own.length = rag.pts.length * 3;
      rag.pts.forEach((q, i) => {
        own[i * 3] = q.x;
        own[i * 3 + 1] = q.y;
        own[i * 3 + 2] = q.z;
      });
      p = own;
    }
    for (const [a, c, m] of this.limbs) {
      placeLimb(m, p, part[a], part[c]);
    }
    for (const [j, m] of this.joints) {
      const i = part[j] * 3;
      m.position.set(p[i]!, p[i + 1]!, p[i + 2]);
    }
    const h = part.head * 3;
    const n = part.neck * 3;
    const hx = p[h]!;
    const hy = p[h + 1]!;
    const hz = p[h + 2]!;
    this.headMesh.position.set(hx, hy, hz);
    this.hairMesh.position.set(hx, hy + 0.01, hz);
    tmpV.set(hx - p[n]!, hy - p[n + 1]!, hz - p[n + 2]!).normalize();
    this.hairMesh.quaternion.setFromUnitVectors(UP, tmpV);
    const rope = this.ropeIdx;
    const segs = Math.min(this.leashSegs.length, rope.length - 1);
    for (let i = 0; i < segs; i++) {
      placeLimb(this.leashSegs[i]!, p, rope[i]!, rope[i + 1]!);
    }
    const pel = part.pelvis * 3;
    this.shadow.position.set(p[pel]!, 0, p[pel + 2]);
  }

  /** Removes the person from the scene and frees its GPU resources. */
  dispose(): void {
    this.scene.remove(this.root);
    for (const g of this.geometries) {
      g.dispose();
    }
    for (const m of this.materials) {
      m.dispose();
    }
    this.rag = null;
    this.part = null;
  }
}

/** Golden bones: spin and bob above their sim positions. */
export class BonesView {
  private readonly meshes: THREE.Group[] = [];

  constructor(scene: THREE.Scene, count: number) {
    const mat = boneMaterial();
    for (let i = 0; i < count; i++) {
      const g = makeBone(mat);
      scene.add(g);
      this.meshes.push(g);
    }
  }

  /** Initial placement, before any round has run. */
  place(bones: readonly Bone[]): void {
    bones.forEach((b, i) => this.meshes[i]?.position.set(b.x, FX.boneHeight, b.z));
  }

  /** `spins` are the interpolated spin angles; positions come from the bones. */
  sync(bones: readonly Bone[], spins: readonly number[], elapsed: number): void {
    bones.forEach((b, i) => {
      const m = this.meshes[i];
      if (!m) {
        return;
      }
      m.rotation.y = spins[i] ?? b.spin;
      m.position.set(
        b.x,
        FX.boneHeight + Math.sin(elapsed * FX.boneBobRate + b.x) * FX.boneBob,
        b.z,
      );
    });
  }
}
