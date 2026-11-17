import * as THREE from 'three';
import { FX, RULES } from '../config';
import type { BunnyState } from '../sim/bunny';
import type { DogState } from '../sim/dog';
import type { Bone } from '../sim/game';
import type { Particle, Ragdoll } from '../sim/ragdoll';
import {
  blobShadow,
  boneMaterial,
  makeBone,
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

  /** `lickT` is the lick timer as it was when the dog moved this frame. */
  sync(d: DogState, elapsed: number, lickT: number): void {
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
    m.tail.rotation.y = Math.sin(elapsed * 14) * 0.6;
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

/** The person and the leash, drawn from the ragdoll particles. */
export class PersonView {
  private readonly skin = new THREE.MeshLambertMaterial({ color: 0xf1c27d });
  private readonly shirt = new THREE.MeshLambertMaterial({ color: 0x3f7fd9 });
  private readonly pants = new THREE.MeshLambertMaterial({ color: 0x3b3b55 });
  private readonly leashMat = new THREE.MeshLambertMaterial({ color: 0xd62e3e });
  private readonly jointGeo = new THREE.SphereGeometry(1, 8, 6);
  private readonly meshes: THREE.Object3D[] = [];
  private limbs: [Particle, Particle, THREE.Mesh][] = [];
  private joints: [Particle, THREE.Mesh][] = [];
  private leashSegs: THREE.Mesh[] = [];
  private headMesh: THREE.Mesh | null = null;
  private hairMesh: THREE.Mesh | null = null;
  private shadow: THREE.Group | null = null;
  private rag: Ragdoll | null = null;

  constructor(private readonly scene: THREE.Scene) {}

  private limbGeo(r: number): THREE.CylinderGeometry {
    return new THREE.CylinderGeometry(r, r, 1, 8);
  }

  /** Binds the view to a (new) ragdoll, rebuilding the meshes. */
  build(rag: Ragdoll): void {
    for (const m of this.meshes) {
      this.scene.remove(m);
    }
    this.meshes.length = 0;
    this.rag = rag;
    const b = rag.body;
    const add = <T extends THREE.Object3D>(m: T): T => {
      this.scene.add(m);
      this.meshes.push(m);
      return m;
    };
    const { skin, shirt, pants } = this;
    const limb = (r: number, m: THREE.Material): THREE.Mesh =>
      add(new THREE.Mesh(this.limbGeo(r), m));
    this.limbs = [
      [b.neck, b.pelvis, limb(0.17, shirt)],
      [b.neck, b.lElbow, limb(0.06, shirt)],
      [b.lElbow, b.lHand, limb(0.05, skin)],
      [b.neck, b.rElbow, limb(0.06, shirt)],
      [b.rElbow, b.rHand, limb(0.05, skin)],
      [b.pelvis, b.lKnee, limb(0.08, pants)],
      [b.lKnee, b.lFoot, limb(0.07, pants)],
      [b.pelvis, b.rKnee, limb(0.08, pants)],
      [b.rKnee, b.rFoot, limb(0.07, pants)],
    ];
    const jointSpecs: [Particle, number, THREE.Material][] = [
      [b.pelvis, 0.17, pants],
      [b.neck, 0.17, shirt],
      [b.lElbow, 0.06, shirt],
      [b.rElbow, 0.06, shirt],
      [b.lKnee, 0.08, pants],
      [b.rKnee, 0.08, pants],
      [b.lHand, 0.065, skin],
      [b.rHand, 0.065, skin],
      [b.lFoot, 0.09, pants],
      [b.rFoot, 0.09, pants],
    ];
    this.joints = jointSpecs.map(([p, r, m]) => {
      const j = add(new THREE.Mesh(this.jointGeo, m));
      j.scale.setScalar(r);
      return [p, j];
    });
    this.headMesh = add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin));
    this.hairMesh = add(
      new THREE.Mesh(
        new THREE.SphereGeometry(0.165, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: 0x5a3a1e }),
      ),
    );
    this.leashSegs = [];
    for (let i = 0; i < rag.rope.length - 1; i++) {
      this.leashSegs.push(limb(0.022, this.leashMat));
    }
    this.shadow = new THREE.Group();
    blobShadow(this.shadow, 0.5);
    add(this.shadow);
  }

  sync(): void {
    const rag = this.rag;
    if (!rag || !this.headMesh || !this.hairMesh || !this.shadow) {
      return;
    }
    for (const [a, b, m] of this.limbs) {
      placeLimb(m, a, b);
    }
    for (const [p, m] of this.joints) {
      m.position.set(p.x, p.y, p.z);
    }
    const h = rag.body.head;
    const n = rag.body.neck;
    this.headMesh.position.set(h.x, h.y, h.z);
    this.hairMesh.position.set(h.x, h.y + 0.01, h.z);
    tmpV.set(h.x - n.x, h.y - n.y, h.z - n.z).normalize();
    this.hairMesh.quaternion.setFromUnitVectors(UP, tmpV);
    for (let i = 0; i < this.leashSegs.length; i++) {
      placeLimb(this.leashSegs[i]!, rag.rope[i]!, rag.rope[i + 1]!);
    }
    this.shadow.position.set(rag.body.pelvis.x, 0, rag.body.pelvis.z);
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

  sync(bones: readonly Bone[], elapsed: number): void {
    bones.forEach((b, i) => {
      const m = this.meshes[i];
      if (!m) {
        return;
      }
      m.rotation.y = b.spin;
      m.position.set(
        b.x,
        FX.boneHeight + Math.sin(elapsed * FX.boneBobRate + b.x) * FX.boneBob,
        b.z,
      );
    });
  }
}
