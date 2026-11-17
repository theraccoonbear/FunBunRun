import * as THREE from 'three';
import { FX, SNIFF } from '../config';
import type { Rng } from '../core/rng';
import { scentOpacity, type ScentTrail } from '../sim/scent';
import type { SceneKit } from './scene';

/** Scent trail markers, shown while sniffing. */
export class TrailView {
  private readonly meshes: THREE.Mesh[] = [];
  private readonly mats: THREE.MeshBasicMaterial[] = [];

  constructor(scene: THREE.Scene, count: number) {
    for (let i = 0; i < count; i++) {
      const m = new THREE.MeshBasicMaterial({ color: 0xff7ad9, transparent: true, opacity: 0 });
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), m);
      s.visible = false;
      scene.add(s);
      this.meshes.push(s);
      this.mats.push(m);
    }
  }

  hideAll(): void {
    for (const m of this.meshes) {
      m.visible = false;
    }
  }

  sync(trail: ScentTrail, sniffing: boolean): void {
    trail.drops.forEach((d, i) => {
      const mesh = this.meshes[i];
      const mat = this.mats[i];
      if (!mesh || !mat) {
        return;
      }
      mesh.position.set(d.x, 0.2, d.z);
      const show = sniffing && d.age < SNIFF.trailLife;
      mesh.visible = show;
      if (show) {
        mat.opacity = scentOpacity(d.age);
      }
    });
  }
}

interface Heart {
  m: THREE.Mesh;
  v: THREE.Vector3;
  life: number;
}

/** Heart particles that burst from the bunny on a lick. */
export class Hearts {
  private readonly hearts: Heart[] = [];

  constructor(
    scene: THREE.Scene,
    private readonly rng: Rng,
  ) {
    for (let i = 0; i < FX.heartCount; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.1, 6, 5),
        new THREE.MeshBasicMaterial({ color: 0xff4fa3 }),
      );
      m.visible = false;
      scene.add(m);
      this.hearts.push({ m, v: new THREE.Vector3(), life: 0 });
    }
  }

  burst(x: number, z: number): void {
    const r = this.rng;
    for (const h of this.hearts) {
      h.m.position.set(x, FX.heartSpawnHeight, z);
      h.v.set((r.next() - 0.5) * 4, 3 + r.next() * 3, (r.next() - 0.5) * 4);
      h.life = 1;
      h.m.visible = true;
    }
  }

  update(dt: number): void {
    for (const h of this.hearts) {
      if (h.life > 0) {
        h.life -= dt;
        h.v.y -= FX.heartGravity * dt;
        h.m.position.addScaledVector(h.v, dt);
        h.m.visible = h.life > 0;
      }
    }
  }
}

/** Sniff mode: the sky darkens to purple and the fog closes in. */
export function updateSniffAtmosphere(kit: SceneKit, sniffing: boolean, dt: number): void {
  const k = Math.min(1, dt * SNIFF.blendRate);
  kit.background.lerp(sniffing ? kit.sniffSky : kit.sky, k);
  kit.fog.color.copy(kit.background);
  kit.fog.far += ((sniffing ? SNIFF.fogFar : SNIFF.normalFogFar) - kit.fog.far) * k;
}
