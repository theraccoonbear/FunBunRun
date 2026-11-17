import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createRng } from '../../src/core/rng';
import { Hearts, TrailView } from '../../src/render/fx';
import { disposeProps, makeBunny, makeProps, setBlobShadows } from '../../src/render/models';
import { createScentTrail } from '../../src/sim/scent';
import { generateWorld } from '../../src/sim/world';

const meshesOf = (root: THREE.Object3D): THREE.Mesh[] => {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if ((o as Partial<THREE.Mesh>).isMesh) {
      out.push(o as THREE.Mesh);
    }
  });
  return out;
};

describe('makeProps', () => {
  const world = generateWorld(createRng(123));

  it('draws all props with one instanced mesh per geometry and material pair', () => {
    const meshes = meshesOf(makeProps(world));
    expect(meshes.every((m) => m instanceof THREE.InstancedMesh)).toBe(true);
    // trunks, three leaf colours, bushes, rocks, logs
    expect(meshes.length).toBeLessThanOrEqual(7);
    const total = (meshes as THREE.InstancedMesh[]).reduce((n, m) => n + m.count, 0);
    expect(total).toBe(
      world.trees.length * 2 + world.bushes.length + world.rocks.length + world.logs.length,
    );
    const pairs = new Set(
      meshes.map((m) => m.geometry.id + ':' + (m.material as THREE.Material).id),
    );
    expect(pairs.size).toBe(meshes.length);
  });

  it('places instances where the sim put the props', () => {
    const logs = meshesOf(makeProps(world)).find(
      (m) => m.geometry instanceof THREE.CylinderGeometry && m.geometry.parameters.height === 4,
    ) as THREE.InstancedMesh;
    const m = new THREE.Matrix4();
    logs.getMatrixAt(0, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    expect(p.x).toBeCloseTo(world.logs[0]!.x, 5);
    expect(p.y).toBeCloseTo(0.35, 5);
    expect(p.z).toBeCloseTo(world.logs[0]!.z, 5);
  });

  it('disposes geometries and instance buffers', () => {
    const props = makeProps(world);
    const meshes = meshesOf(props);
    const geoSpies = meshes.map((m) => vi.spyOn(m.geometry, 'dispose'));
    const instSpies = meshes.map((m) => vi.spyOn(m as THREE.InstancedMesh, 'dispose'));
    disposeProps(props);
    geoSpies.forEach((s) => expect(s).toHaveBeenCalled());
    instSpies.forEach((s) => expect(s).toHaveBeenCalled());
  });

  it('lowers segment counts with the detail multiplier', () => {
    const cone = (detail: number): THREE.ConeGeometry =>
      meshesOf(makeProps(world, detail)).find((m) => m.geometry instanceof THREE.ConeGeometry)!
        .geometry as THREE.ConeGeometry;
    expect(cone(1).parameters.radialSegments).toBe(8);
    expect(cone(0.5).parameters.radialSegments).toBe(4);
  });
});

describe('shared geometry and materials', () => {
  it('bunny parts share sphere geometries', () => {
    const meshes = meshesOf(makeBunny().outer).filter(
      (m) => m.geometry instanceof THREE.SphereGeometry,
    );
    expect(meshes.length).toBeGreaterThan(8);
    expect(new Set(meshes.map((m) => m.geometry)).size).toBe(2);
  });

  it('hearts share one geometry and one material', () => {
    const scene = new THREE.Scene();
    new Hearts(scene, createRng(1));
    const meshes = meshesOf(scene);
    expect(meshes.length).toBeGreaterThan(1);
    expect(new Set(meshes.map((m) => m.geometry)).size).toBe(1);
    expect(new Set(meshes.map((m) => m.material)).size).toBe(1);
  });

  it('blob shadows can be hidden by tier', () => {
    const bunny = makeBunny();
    const shadows = meshesOf(bunny.outer).filter((m) => m.userData['blobShadow']);
    expect(shadows).toHaveLength(1);
    setBlobShadows(bunny.outer, false);
    expect(shadows[0]!.visible).toBe(false);
    setBlobShadows(bunny.outer, true);
    expect(shadows[0]!.visible).toBe(true);
  });
});

describe('TrailView', () => {
  it('is one instanced mesh with one material and per-instance opacity', () => {
    const scene = new THREE.Scene();
    const trail = createScentTrail(4);
    const view = new TrailView(scene, 4);
    const meshes = meshesOf(scene) as THREE.InstancedMesh[];
    expect(meshes).toHaveLength(1);
    const mesh = meshes[0]!;
    expect(mesh.visible).toBe(false);

    const d = trail.drops[0]!;
    d.x = 3;
    d.z = 4;
    d.age = 0;
    view.sync(trail, true);
    expect(mesh.visible).toBe(true);
    const alpha = mesh.geometry.getAttribute('instanceAlpha') as THREE.BufferAttribute;
    expect(alpha.getX(0)).toBeGreaterThan(0.5);
    expect(alpha.getX(1)).toBe(0);
    const m = new THREE.Matrix4();
    mesh.getMatrixAt(0, m);
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    expect([p.x, p.y, p.z]).toEqual([3, expect.closeTo(0.2, 5), 4]);

    view.sync(trail, false);
    expect(mesh.visible).toBe(false);
  });
});
