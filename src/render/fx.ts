import * as THREE from 'three';
import { FX, SIM, SNIFF } from '../config';
import { smoothing } from '../core/math';
import type { Rng } from '../core/rng';
import { scentOpacity, type ScentTrail } from '../sim/scent';
import type { SceneKit } from './scene';

/** Scent trail markers, shown while sniffing. */
export class TrailView {
  private readonly mesh: THREE.InstancedMesh;
  private readonly alpha: THREE.InstancedBufferAttribute;
  private readonly obj = new THREE.Object3D();
  private readonly count: number;
  /** Whether the last sync left every marker hidden, so an idle sync can skip the work. */
  private hidden = true;

  constructor(scene: THREE.Scene, count: number) {
    this.count = count;
    // One shared material for every marker: the per-instance opacity is an
    // instanced attribute multiplied into the fragment alpha.
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff7ad9,
      transparent: true,
      depthWrite: false,
    });
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          'void main() {',
          'attribute float instanceAlpha;\nvarying float vInstanceAlpha;\nvoid main() {',
        )
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvInstanceAlpha = instanceAlpha;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'varying float vInstanceAlpha;\nvoid main() {')
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\ndiffuseColor.a *= vInstanceAlpha;',
        );
    };
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.14, 6, 5), mat, count);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    this.mesh.geometry.setAttribute('instanceAlpha', this.alpha);
    // Markers move around the whole arena; skip culling against a stale bound.
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  hideAll(): void {
    this.mesh.visible = false;
    this.hidden = true;
  }

  sync(trail: ScentTrail, sniffing: boolean): void {
    if (!sniffing && this.hidden) {
      return;
    }
    const drops = trail.drops;
    const n = Math.min(drops.length, this.count);
    const o = this.obj;
    let any = false;
    for (let i = 0; i < n; i++) {
      const d = drops[i]!;
      const show = sniffing && d.age < SNIFF.trailLife;
      if (show) {
        any = true;
        o.position.set(d.x, 0.2, d.z);
        o.scale.setScalar(1);
      } else {
        o.scale.setScalar(0);
      }
      o.updateMatrix();
      this.mesh.setMatrixAt(i, o.matrix);
      this.alpha.setX(i, show ? scentOpacity(d.age) : 0);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.alpha.needsUpdate = true;
    this.mesh.visible = any;
    this.hidden = !any;
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
    const geo = new THREE.SphereGeometry(0.1, 6, 5);
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4fa3 });
    for (let i = 0; i < FX.heartCount; i++) {
      const m = new THREE.Mesh(geo, mat);
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
  // Tuned per 60 Hz frame; the same blend per second at any refresh rate.
  const k = smoothing(SNIFF.blendRate, dt, SIM.step);
  kit.background.lerp(sniffing ? kit.sniffSky : kit.sky, k);
  kit.fog.color.copy(kit.background);
  kit.fog.far += ((sniffing ? SNIFF.fogFar : SNIFF.normalFogFar) - kit.fog.far) * k;
}
