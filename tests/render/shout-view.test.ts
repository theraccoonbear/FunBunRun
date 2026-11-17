import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SHOUT_FX } from '../../src/config';
import { createRng } from '../../src/core/rng';
import { ShoutView } from '../../src/render/shouts';

function sprites(scene: THREE.Scene): THREE.Sprite[] {
  return scene.children.filter((o): o is THREE.Sprite => (o as THREE.Sprite).isSprite === true);
}
const visible = (scene: THREE.Scene): THREE.Sprite[] => sprites(scene).filter((s) => s.visible);

describe('ShoutView', () => {
  beforeEach(() => {
    // Node has no DOM: a canvas stand-in without a 2D context is enough for the pool logic.
    vi.stubGlobal('document', {
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pools a fixed number of sprites up front', () => {
    const scene = new THREE.Scene();
    new ShoutView(scene, createRng(1));
    expect(sprites(scene)).toHaveLength(SHOUT_FX.poolSize);
    expect(visible(scene)).toHaveLength(0);
  });

  it('spells letters one at a time from the moving head, skipping spaces', () => {
    const scene = new THREE.Scene();
    const view = new ShoutView(scene, createRng(1));
    const pts = [0, 1.6, 0];
    view.shout('H E', 'drag');
    view.update(0.001, pts, 0);
    expect(visible(scene)).toHaveLength(1);
    // The head moves; the next letter spawns where the head is then.
    pts[0] = 2;
    view.update(SHOUT_FX.letterInterval, pts, 0); // the space
    expect(visible(scene)).toHaveLength(1);
    view.update(SHOUT_FX.letterInterval, pts, 0);
    const shown = visible(scene);
    expect(shown).toHaveLength(2);
    const xs = shown.map((s) => s.position.x).sort((a, b) => a - b);
    expect(xs[0]).toBeLessThan(1);
    expect(xs[1]).toBeGreaterThan(1);
    expect(shown[0]!.position.y).toBeGreaterThan(1.6);
  });

  it('fades letters out after their life and reuses the pool', () => {
    const scene = new THREE.Scene();
    const view = new ShoutView(scene, createRng(1));
    view.shout('oof!', 'impact');
    for (let i = 0; i < 10; i++) {
      view.update(SHOUT_FX.letterInterval, [0, 1, 0], 0);
    }
    expect(visible(scene)).toHaveLength(4);
    view.update(SHOUT_FX.letterLife, [0, 1, 0], 0);
    expect(visible(scene)).toHaveLength(0);
    // More letters than the pool: the oldest are recycled.
    for (let i = 0; i < 4; i++) {
      view.shout('x'.repeat(SHOUT_FX.poolSize), 'drag');
      view.shout('overflow dropped', 'drag');
    }
    for (let i = 0; i < SHOUT_FX.poolSize * 2; i++) {
      view.update(SHOUT_FX.letterInterval / 2, [0, 1, 0], 0);
    }
    expect(visible(scene).length).toBeLessThanOrEqual(SHOUT_FX.poolSize);
  });

  it('clears letters and queued shouts', () => {
    const scene = new THREE.Scene();
    const view = new ShoutView(scene, createRng(1));
    view.shout('whoa!', 'drag');
    view.update(0.001, [0, 1, 0], 0);
    view.clear();
    view.update(1, [0, 1, 0], 0);
    expect(visible(scene)).toHaveLength(0);
  });

  it('waits for the ragdoll points before spawning', () => {
    const scene = new THREE.Scene();
    const view = new ShoutView(scene, createRng(1));
    view.shout('ow!', 'impact');
    view.update(0.1, [], 0);
    expect(visible(scene)).toHaveLength(0);
    view.update(0.001, [0, 1, 0], 0);
    expect(visible(scene).length).toBeGreaterThan(0);
  });
});
