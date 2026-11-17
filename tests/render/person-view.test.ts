import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { makeRagdollSim } from '../../src/sim/ragdoll';
import { PersonView } from '../../src/render/views';

const rag = (x = 0): ReturnType<typeof makeRagdollSim> =>
  makeRagdollSim({ x, z: 2.6, leash: 3.6, collar: { x: 0, y: 0.9, z: 0 } });

function collect(scene: THREE.Scene) {
  const meshes: THREE.Mesh[] = [];
  scene.traverse((o) => {
    if ((o as Partial<THREE.Mesh>).isMesh) {
      meshes.push(o as THREE.Mesh);
    }
  });
  const geometries = new Set(meshes.map((m) => m.geometry));
  const materials = new Set(meshes.map((m) => m.material as THREE.Material));
  return { meshes, geometries, materials };
}

describe('PersonView', () => {
  it('reuses the same meshes, geometries and materials across restarts (no GPU leak)', () => {
    const scene = new THREE.Scene();
    const view = new PersonView(scene);
    view.bind(rag());
    view.sync();
    const first = collect(scene);
    for (let round = 0; round < 5; round++) {
      view.bind(rag(round));
      view.sync();
    }
    const after = collect(scene);
    expect(after.meshes).toEqual(first.meshes);
    expect(after.geometries).toEqual(first.geometries);
    expect(after.materials).toEqual(first.materials);
    // 6 cylinder radii (shared by 19 limb and leash meshes), joint, head, hair, shadow.
    expect(first.meshes).toHaveLength(9 + 10 + 10 + 2 + 1);
    expect(first.geometries.size).toBe(10);
  });

  it('follows the bound ragdoll', () => {
    const scene = new THREE.Scene();
    const view = new PersonView(scene);
    const r = rag(5);
    view.bind(r);
    view.sync();
    const head = collect(scene).meshes.find(
      (m) => m.position.x === r.body.head.x && m.position.y === r.body.head.y,
    );
    expect(head).toBeDefined();
  });

  it('dispose() frees every geometry and material and leaves the scene', () => {
    const scene = new THREE.Scene();
    const view = new PersonView(scene);
    const { geometries, materials } = collect(scene);
    const spies = [...geometries, ...materials].map((x) => vi.spyOn(x, 'dispose'));
    view.dispose();
    for (const s of spies) {
      expect(s).toHaveBeenCalled();
    }
    expect(collect(scene).meshes).toHaveLength(0);
  });
});
