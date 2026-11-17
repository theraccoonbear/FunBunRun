import * as THREE from 'three';
import { DOG_MODEL } from '../sim/dog';
import type { World } from '../sim/world';

/** Flat translucent disc under a character. */
export function blobShadow(parent: THREE.Object3D, r: number): THREE.Mesh {
  const s = new THREE.Mesh(
    new THREE.CircleGeometry(r, 16),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    }),
  );
  s.rotation.x = -Math.PI / 2;
  s.position.y = 0.02;
  parent.add(s);
  return s;
}

export interface BunnyModel {
  outer: THREE.Group;
  inner: THREE.Group;
  ears: THREE.Group[];
}

export function makeBunny(): BunnyModel {
  const outer = new THREE.Group();
  const inner = new THREE.Group();
  outer.add(inner);
  const fur = new THREE.MeshLambertMaterial({ color: 0xf3ece2 });
  const pink = new THREE.MeshLambertMaterial({ color: 0xffa6c9 });
  const dark = new THREE.MeshBasicMaterial({ color: 0x222222 });
  const sph = (
    r: number,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
  ): THREE.Mesh => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), m);
    s.position.set(x, y, z);
    s.scale.set(sx, sy, sz);
    inner.add(s);
    return s;
  };
  sph(0.35, fur, 0, 0.35, 0, 1, 0.9, 1.3);
  sph(0.24, fur, 0, 0.62, 0.38);
  sph(0.12, fur, 0, 0.42, -0.47);
  sph(0.04, dark, 0.12, 0.68, 0.57);
  sph(0.04, dark, -0.12, 0.68, 0.57);
  sph(0.045, pink, 0, 0.61, 0.62);
  const ears: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(0.1 * sx, 0.8, 0.32);
    const e = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), fur);
    e.scale.set(0.08, 0.32, 0.05);
    e.position.y = 0.26;
    const inn = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), pink);
    inn.scale.set(0.05, 0.25, 0.03);
    inn.position.set(0, 0.26, 0.025);
    ear.add(e, inn);
    ear.rotation.z = -0.15 * sx;
    inner.add(ear);
    ears.push(ear);
  }
  blobShadow(outer, 0.45);
  outer.scale.setScalar(1.15);
  return { outer, inner, ears };
}

export interface DogModel {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  ears: THREE.Group[];
  tonguePivot: THREE.Group;
  tail: THREE.Group;
  legs: THREE.Group[];
}

/** Box-built dog. The collar anchor lives in sim/dog.ts (DOG_MODEL) so the sim can place the leash. */
export function makeDog(): DogModel {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = DOG_MODEL.bodyRestY;
  root.add(body);
  const fur = new THREE.MeshLambertMaterial({ color: 0xb07a45 });
  const furDark = new THREE.MeshLambertMaterial({ color: 0x7d5230 });
  const black = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  const box = (w: number, h: number, d: number, m: THREE.Material): THREE.Mesh =>
    new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  body.add(box(0.4, 0.36, 0.95, fur));
  const head = new THREE.Group();
  head.position.set(0, 0.26, 0.52);
  body.add(head);
  head.add(box(0.34, 0.3, 0.32, fur));
  const snout = box(0.2, 0.15, 0.24, fur);
  snout.position.set(0, -0.06, 0.26);
  head.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), black);
  nose.position.set(0, -0.01, 0.39);
  head.add(nose);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), black);
    eye.position.set(0.09 * sx, 0.06, 0.16);
    head.add(eye);
  }
  const ears: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const ep = new THREE.Group();
    ep.position.set(0.17 * sx, 0.12, -0.02);
    const e = box(0.06, 0.24, 0.14, furDark);
    e.position.y = -0.1;
    ep.add(e);
    ep.rotation.z = 0.25 * sx;
    head.add(ep);
    ears.push(ep);
  }
  const tonguePivot = new THREE.Group();
  tonguePivot.position.set(0, -0.13, 0.32);
  const tongue = box(0.1, 0.02, 0.18, new THREE.MeshLambertMaterial({ color: 0xff7aa8 }));
  tongue.position.z = 0.09;
  tonguePivot.add(tongue);
  head.add(tonguePivot);
  const collar = new THREE.Mesh(
    new THREE.TorusGeometry(0.17, 0.03, 6, 14),
    new THREE.MeshLambertMaterial({ color: 0xd62e3e }),
  );
  collar.position.set(0, 0.12, 0.42);
  body.add(collar);
  const tail = new THREE.Group();
  tail.position.set(0, 0.12, -0.46);
  const tm = box(0.07, 0.07, 0.4, fur);
  tm.position.z = -0.18;
  tail.add(tm);
  tail.rotation.x = -0.7;
  body.add(tail);
  const legs: THREE.Group[] = [];
  const legSpots: [number, number][] = [
    [-0.13, 0.34],
    [0.13, 0.34],
    [-0.13, -0.34],
    [0.13, -0.34],
  ];
  for (const [x, z] of legSpots) {
    const lp = new THREE.Group();
    lp.position.set(x, -0.12, z);
    const lm = box(0.11, 0.42, 0.11, fur);
    lm.position.y = -0.21;
    lp.add(lm);
    body.add(lp);
    legs.push(lp);
  }
  blobShadow(root, 0.55);
  root.scale.setScalar(DOG_MODEL.scale);
  return { root, body, head, ears, tonguePivot, tail, legs };
}

export const boneMaterial = (): THREE.MeshLambertMaterial =>
  new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0x443300 });

export function makeBone(mat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.6, 8), mat);
  shaft.rotation.z = Math.PI / 2;
  g.add(shaft);
  for (const x of [-0.3, 0.3]) {
    for (const y of [-0.08, 0.08]) {
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), mat);
      k.position.set(x, y, 0);
      g.add(k);
    }
  }
  return g;
}

/** Frees the GPU resources of a group built by `makeProps`. */
export function disposeProps(group: THREE.Group): void {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      const mesh = o as THREE.Mesh<THREE.BufferGeometry, THREE.Material | THREE.Material[]>;
      mesh.geometry.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => m.dispose());
    }
  });
}

/** Static props for a generated world; geometry and materials are shared per kind. */
export function makeProps(world: World): THREE.Group {
  const g = new THREE.Group();
  const trunkGeo = new THREE.CylinderGeometry(0.3, 0.4, 2.2, 7);
  const leafGeo = new THREE.ConeGeometry(1.9, 4.2, 8);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5233 });
  const leafMats = [0x2f8a3c, 0x3d9e48, 0x267a35].map(
    (c) => new THREE.MeshLambertMaterial({ color: c }),
  );
  for (const t of world.trees) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(t.x, 1.1, t.z);
    const leaves = new THREE.Mesh(leafGeo, leafMats[t.variant % leafMats.length]);
    leaves.position.set(t.x, 4, t.z);
    leaves.scale.setScalar(t.scale);
    g.add(trunk, leaves);
  }
  const bushGeo = new THREE.SphereGeometry(1.2, 10, 8);
  const bushMat = new THREE.MeshLambertMaterial({ color: 0x4caf50 });
  for (const b of world.bushes) {
    const m = new THREE.Mesh(bushGeo, bushMat);
    m.position.set(b.x, 0.6, b.z);
    m.scale.set(1, 0.8, 1);
    g.add(m);
  }
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x9a9a9a });
  for (const r of world.rocks) {
    const m = new THREE.Mesh(rockGeo, rockMat);
    m.position.set(r.x, 0.5, r.z);
    m.rotation.set(r.rotX, r.rotY, 0);
    g.add(m);
  }
  const logGeo = new THREE.CylinderGeometry(0.35, 0.35, 4, 8);
  const logMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
  for (const l of world.logs) {
    const m = new THREE.Mesh(logGeo, logMat);
    m.position.set(l.x, 0.35, l.z);
    m.rotation.set(0, l.angle, Math.PI / 2);
    g.add(m);
  }
  return g;
}
