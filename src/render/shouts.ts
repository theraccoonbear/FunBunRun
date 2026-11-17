import * as THREE from 'three';
import { SHOUT_FX } from '../config';
import type { Rng } from '../core/rng';
import type { ShoutKind } from '../sim/shouts';

interface Letter {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface Pending {
  text: string;
  kind: ShoutKind;
}

const GLYPH_PX = 128;

/**
 * Person shouts (#43), spelled out one letter at a time. Each letter spawns
 * at the head as it is at that moment, then drifts up and fades, so letters
 * trail behind a dragged person. Sprites, materials and queue slots are
 * pooled; a glyph texture is drawn once per distinct character.
 */
export class ShoutView {
  private readonly letters: Letter[] = [];
  private readonly glyphs = new Map<string, THREE.CanvasTexture>();
  /** Ring buffer of shouts waiting; slot objects are reused. */
  private readonly queue: Pending[] = [];
  private qHead = 0;
  private qLen = 0;
  /** Shout being spelled out, and the index of its next character. */
  private text = '';
  private kind: ShoutKind = 'drag';
  private cursor = 0;
  private timer = 0;
  private nextSlot = 0;

  constructor(
    scene: THREE.Scene,
    private readonly rng: Rng,
  ) {
    for (let i = 0; i < SHOUT_FX.poolSize; i++) {
      const mat = new THREE.SpriteMaterial({
        transparent: true,
        depthTest: false,
        depthWrite: false,
        fog: false,
        opacity: 0,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 10;
      sprite.scale.setScalar(SHOUT_FX.letterSize);
      scene.add(sprite);
      this.letters.push({ sprite, mat, vx: 0, vy: 0, vz: 0, life: 0 });
    }
    for (let i = 0; i < SHOUT_FX.queueSize; i++) {
      this.queue.push({ text: '', kind: 'drag' });
    }
  }

  /** Queues a shout; dropped when the queue is full. */
  shout(text: string, kind: ShoutKind): void {
    if (this.qLen >= this.queue.length) {
      return;
    }
    const slot = this.queue[(this.qHead + this.qLen) % this.queue.length]!;
    slot.text = text;
    slot.kind = kind;
    this.qLen++;
  }

  /** Hides every letter and forgets queued shouts (new round). */
  clear(): void {
    for (const l of this.letters) {
      l.life = 0;
      l.sprite.visible = false;
    }
    this.qLen = 0;
    this.text = '';
    this.cursor = 0;
    this.timer = 0;
  }

  /**
   * Advances spelling and the live letters. `pts` is the rendered ragdoll
   * point array (x, y, z per point) and `head` the head's point index.
   */
  update(dt: number, pts: readonly number[], head: number): void {
    this.spell(dt, pts, head);
    const life = SHOUT_FX.letterLife;
    for (const l of this.letters) {
      if (l.life <= 0) {
        continue;
      }
      l.life -= dt;
      if (l.life <= 0) {
        l.sprite.visible = false;
        continue;
      }
      const p = l.sprite.position;
      p.x += l.vx * dt;
      p.y += l.vy * dt;
      p.z += l.vz * dt;
      const age = 1 - l.life / life;
      // Pop in over the first tenth of the life, fade over the last half.
      const pop = Math.min(1, age * 10);
      l.sprite.scale.setScalar(SHOUT_FX.letterSize * (0.6 + 0.4 * pop));
      l.mat.opacity = Math.min(1, (l.life / life) * 2);
    }
  }

  private spell(dt: number, pts: readonly number[], head: number): void {
    if (this.cursor >= this.text.length) {
      if (this.qLen === 0) {
        return;
      }
      const next = this.queue[this.qHead]!;
      this.qHead = (this.qHead + 1) % this.queue.length;
      this.qLen--;
      this.text = next.text;
      this.kind = next.kind;
      this.cursor = 0;
      this.timer = 0;
    }
    this.timer -= dt;
    const i = head * 3;
    if (pts.length < i + 3) {
      return;
    }
    while (this.timer <= 0 && this.cursor < this.text.length) {
      const ch = this.text[this.cursor]!;
      this.cursor++;
      this.timer += SHOUT_FX.letterInterval;
      if (ch !== ' ') {
        this.spawn(ch, pts[i]!, pts[i + 1]! + SHOUT_FX.headOffset, pts[i + 2]!);
      }
    }
  }

  private spawn(ch: string, x: number, y: number, z: number): void {
    const l = this.letters[this.nextSlot]!;
    this.nextSlot = (this.nextSlot + 1) % this.letters.length;
    if (!l.mat.map) {
      // First glyph on this material: the shader gains a map once, then is reused.
      l.mat.needsUpdate = true;
    }
    l.mat.map = this.glyph(ch);
    l.mat.color.setHex(this.kind === 'impact' ? SHOUT_FX.impactColor : SHOUT_FX.dragColor);
    l.mat.opacity = 1;
    l.sprite.position.set(x, y, z);
    l.sprite.scale.setScalar(SHOUT_FX.letterSize * 0.6);
    l.sprite.visible = true;
    const j = SHOUT_FX.jitter;
    l.vx = (this.rng.next() - 0.5) * 2 * j;
    l.vz = (this.rng.next() - 0.5) * 2 * j;
    l.vy = SHOUT_FX.rise;
    l.life = SHOUT_FX.letterLife;
  }

  /** White glyph with a dark outline; tinted per shout by the material colour. */
  private glyph(ch: string): THREE.CanvasTexture {
    const cached = this.glyphs.get(ch);
    if (cached) {
      return cached;
    }
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = GLYPH_PX;
    const g = canvas.getContext('2d');
    if (g) {
      g.font = `bold ${GLYPH_PX * 0.8}px "Trebuchet MS", "Comic Sans MS", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineJoin = 'round';
      g.lineWidth = GLYPH_PX * 0.12;
      g.strokeStyle = '#2a1f3d';
      g.strokeText(ch, GLYPH_PX / 2, GLYPH_PX / 2);
      g.fillStyle = '#ffffff';
      g.fillText(ch, GLYPH_PX / 2, GLYPH_PX / 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    this.glyphs.set(ch, tex);
    return tex;
  }
}
