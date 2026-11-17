import * as THREE from 'three';
import { ARENA_HALF, CAMERA, COLORS, SNIFF } from '../config';
import type { Rng } from '../core/rng';

/**
 * Colour pipeline matching the r128 prototype. r128 rendered with
 * LinearEncoding output and no colour management, so hex colours went to
 * the screen unconverted. Since r152 three.js converts hex colours from
 * sRGB and encodes output to sRGB by default; turning colour management
 * off and writing linear output reproduces the prototype's colours.
 * Must run before any THREE.Color is created.
 */
export function configureColorPipeline(): void {
  THREE.ColorManagement.enabled = false;
}

/**
 * Light intensities as tuned in the prototype. r155 made physically based
 * light units the default (and r165 removed the legacy mode), which drops
 * the factor of PI the legacy mode applied to punctual and hemisphere
 * lights. Multiplying by PI restores the same irradiance.
 */
const LEGACY_LIGHT_SCALE = Math.PI;
const HEMI_INTENSITY = 0.9 * LEGACY_LIGHT_SCALE;
const SUN_INTENSITY = 0.7 * LEGACY_LIGHT_SCALE;

export interface SceneKit {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  fog: THREE.Fog;
  background: THREE.Color;
  sky: THREE.Color;
  sniffSky: THREE.Color;
  render(): void;
  resize(): void;
}

export function createScene(isTouch: boolean, rng: Rng): SceneKit {
  const renderer = new THREE.WebGLRenderer({ antialias: !isTouch });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  const scene = new THREE.Scene();
  const sky = new THREE.Color(COLORS.sky);
  const sniffSky = new THREE.Color(COLORS.sniffSky);
  const background = sky.clone();
  scene.background = background;
  const fog = new THREE.Fog(sky.clone(), SNIFF.fogNear, SNIFF.normalFogFar);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(
    CAMERA.fov,
    innerWidth / innerHeight,
    CAMERA.near,
    CAMERA.far,
  );
  scene.add(new THREE.HemisphereLight(0xffffff, 0x4a7a3a, HEMI_INTENSITY));
  const sun = new THREE.DirectionalLight(0xffffff, SUN_INTENSITY);
  sun.position.set(30, 60, 20);
  scene.add(sun);

  addGround(scene, rng);
  addFences(scene);

  return {
    renderer,
    scene,
    camera,
    fog,
    background,
    sky,
    sniffSky,
    render: () => renderer.render(scene, camera),
    resize: () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
    },
  };
}

/** Speckled grass: a 128px canvas texture tiled 50 times. */
function addGround(scene: THREE.Scene, rng: Rng): void {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#6fbf4f';
    g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 700; i++) {
      const s = rng.next();
      g.fillStyle =
        s < 0.5 ? '#62b043' : s < 0.95 ? '#7dcc5c' : rng.next() < 0.5 ? '#fff7a8' : '#ffc2e2';
      g.fillRect(rng.next() * 128, rng.next() * 128, 2, 2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  // Raw canvas values, no sRGB decode (as r128's default LinearEncoding).
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(50, 50);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(240, 240),
    new THREE.MeshLambertMaterial({ map: tex }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
}

function addFences(scene: THREE.Scene): void {
  const B = ARENA_HALF;
  const m = new THREE.MeshLambertMaterial({ color: 0xc9a27a });
  const geo = new THREE.BoxGeometry(2 * B + 2, 1.2, 0.4);
  const sides: [number, number, number][] = [
    [0, -B - 0.7, 0],
    [0, B + 0.7, 0],
    [-B - 0.7, 0, Math.PI / 2],
    [B + 0.7, 0, Math.PI / 2],
  ];
  for (const [x, z, r] of sides) {
    const f = new THREE.Mesh(geo, m);
    f.position.set(x, 0.6, z);
    f.rotation.y = r;
    scene.add(f);
  }
}
