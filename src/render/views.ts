import * as THREE from 'three';
import { FX, RAGDOLL, RULES, TAIL } from '../config';
import type { BunnyState } from '../sim/bunny';
import type { DogState } from '../sim/dog';
import type { BoneUse } from '../sim/game';
import type { BodyPart, Particle, Ragdoll } from '../sim/ragdoll';
import {
  blobShadow,
  boneUseMaterial,
  makeBoneUse,
  makeBunny,
  makeDog,
  type BunnyModel,
  type DogModel,
} from './models';

/** Syncs the dog model to the sim pose and runs the procedural gallop, tail, ears and lick. */
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

  /** Accumulated wag phase, so a rate change speeds the wag up without a jump. */
  private wagPhase = 0;
  private lastElapsed = 0;

  /**
   * `lickT` is the lick timer as it was when the dog moved this frame;
   * `wagMul` scales the tail wag rate (1 normally, higher after a bone-use).
   */
  sync(d: DogState, elapsed: number, lickT: number, wagMul = 1): void {
    const m = this.model;
    const p = d.pose;
    const amp = p.amp;
    this.place(d);
    m.body.position.y = p.bodyY;
    m.body.rotation.x = p.pitch;
    const [l0, l1, l2, l3] = m.legs as [THREE.Group, THREE.Group, THREE.Group, THREE.Group];
    if (!d.grounded) {
      l0.rotation.x = l1.rotation.x = -0.9;
      l2.rotation.x = l3.rotation.x = 0.9;
    } else {
      l0.rotation.x = Math.sin(d.ph) * 0.9 * amp;
      l1.rotation.x = Math.sin(d.ph + 0.4) * 0.9 * amp;
      l2.rotation.x = Math.sin(d.ph + 2.4) * 0.9 * amp;
      l3.rotation.x = Math.sin(d.ph + 2.8) * 0.9 * amp;
    }
    const wagDt = Math.max(0, Math.min(elapsed - this.lastElapsed, 0.1));
    this.lastElapsed = elapsed;
    this.wagPhase += wagDt * TAIL.baseRate * wagMul;
    m.tail.rotation.y = Math.sin(this.wagPhase) * 0.6;
    const ear = -Math.abs(Math.sin(d.ph)) * 0.6 * amp - (d.grounded ? 0 : 0.8);
    for (const e of m.ears) {
      e.rotation.x = ear;
    }
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

  sync(b: BunnyState): void {
    const m = this.model;
    const hy = Math.abs(Math.sin(b.hopT)) * (0.08 + b.spd * 0.04) + b.by;
    m.outer.position.set(b.pos.x, 0, b.pos.z);
    m.outer.rotation.y = b.h;
    m.inner.position.y = hy;
    m.inner.rotation.x = -Math.cos(b.hopT) * 0.15 * Math.min(1, b.spd / 5);
    const earFlop = b.tired > 0 ? 0.9 : 0.15 + Math.sin(b.hopT) * 0.15;
    for (const e of m.ears) {
      e.rotation.x = -earFlop;
    }
  }

  /** Menu pose: hopping on the spot at the start position, slowly turning. */
  syncMenu(b: BunnyState, elapsed: number, x: number, z: number): void {
    const m = this.model;
    m.outer.position.set(x, 0, z);
    m.outer.rotation.y = elapsed * 0.5;
    m.inner.position.y = Math.abs(Math.sin(b.hopT)) * 0.15;
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpV = new THREE.Vector3();

/** Places a unit-height, y-aligned cylinder between two points. */
function placeLimb(mesh: THREE.Object3D, a: Particle, b: Particle): void {
  tmpV.set(b.x - a.x, b.y - a.y, b.z - a.z);
  const len = tmpV.length();
  mesh.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  if (len > 1e-5) {
    tmpV.multiplyScalar(1 / len);
    mesh.quaternion.setFromUnitVectors(UP, tmpV);
  }
  mesh.scale.set(1, len, 1);
}

type Limb = [BodyPart, BodyPart, THREE.Mesh];
type Joint = [BodyPart, THREE.Mesh];

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
  }

  sync(): void {
    const rag = this.rag;
    if (!rag) {
      return;
    }
    const b = rag.body;
    for (const [a, c, m] of this.limbs) {
      placeLimb(m, b[a], b[c]);
    }
    for (const [p, m] of this.joints) {
      m.position.set(b[p].x, b[p].y, b[p].z);
    }
    const h = b.head;
    const n = b.neck;
    this.headMesh.position.set(h.x, h.y, h.z);
    this.hairMesh.position.set(h.x, h.y + 0.01, h.z);
    tmpV.set(h.x - n.x, h.y - n.y, h.z - n.z).normalize();
    this.hairMesh.quaternion.setFromUnitVectors(UP, tmpV);
    const segs = Math.min(this.leashSegs.length, rag.rope.length - 1);
    for (let i = 0; i < segs; i++) {
      placeLimb(this.leashSegs[i]!, rag.rope[i]!, rag.rope[i + 1]!);
    }
    this.shadow.position.set(b.pelvis.x, 0, b.pelvis.z);
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
  }
}

/** Bone-uses (golden bones): spin and bob above their sim positions. */
export class BoneUsesView {
  private readonly meshes: THREE.Group[] = [];

  constructor(scene: THREE.Scene, count: number) {
    const mat = boneUseMaterial();
    for (let i = 0; i < count; i++) {
      const g = makeBoneUse(mat);
      scene.add(g);
      this.meshes.push(g);
    }
  }

  /** Initial placement, before any round has run. */
  place(boneUses: readonly BoneUse[]): void {
    boneUses.forEach((b, i) => this.meshes[i]?.position.set(b.x, FX.boneUseHeight, b.z));
  }

  sync(boneUses: readonly BoneUse[], elapsed: number): void {
    boneUses.forEach((b, i) => {
      const m = this.meshes[i];
      if (!m) {
        return;
      }
      m.rotation.y = b.spin;
      m.position.set(
        b.x,
        FX.boneUseHeight + Math.sin(elapsed * FX.boneUseBobRate + b.x) * FX.boneUseBob,
        b.z,
      );
    });
  }
}
