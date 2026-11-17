import { FX, LEASH_LENGTH, RAGDOLL, RULES, WORLD, YANK_MESSAGES } from '../config';
import { Emitter } from '../core/events';
import { FixedStepper } from '../core/loop';
import type { Vec3 } from '../core/math';
import { mathRandomRng, type Rng } from '../core/rng';
import {
  createBunny,
  idleBunny,
  onLicked,
  resetBunny,
  updateBunny,
  type BunnyState,
} from './bunny';
import { collide } from './collision';
import { collarWorld, createDog, resetDog, updateDog, type DogState } from './dog';
import {
  createSession,
  scoreLick,
  startRound,
  tickClock,
  type RoundResult,
  type Session,
} from './game-state';
import { createLook, resetLook, type Basis, type LookState } from './look';
import { makeRagdollSim, type Particle, type Ragdoll } from './ragdoll';
import { canPickBone, createReach, lickReach, type LickReach } from './rules';
import { ageScent, clearScentTrail, createScentTrail, dropScent, type ScentTrail } from './scent';
import { freeSpot, generateWorld, type World } from './world';

/** Per-frame input, already merged from every device. */
export interface FrameInput {
  /** Movement stick, x right and y forward, each roughly -1..1. */
  moveX: number;
  moveY: number;
  /** Look deltas in pixels (or equivalent) this frame. */
  lookX: number;
  lookY: number;
  /** Key turning, -1..1, positive turns left. */
  turn: number;
  sprint: boolean;
  /** Edge-triggered this frame. */
  jump: boolean;
  lick: boolean;
}

export interface GameEvents extends Record<string, unknown> {
  start: undefined;
  jump: undefined;
  lick: { points: number; combo: number; x: number; z: number };
  miss: undefined;
  bone: { points: number };
  yank: { message: string };
  roundOver: RoundResult & { dragged: number };
}

export interface Bone {
  x: number;
  z: number;
  /** Spin angle; advances only during play. */
  spin: number;
}

export interface GameOptions {
  rng?: Rng;
  best?: number;
}

/**
 * The whole simulation: world, dog, bunny, person on the leash, bones and
 * round rules. No three.js and no DOM; adapters read its state and
 * subscribe to `events`.
 */
export class Game {
  readonly rng: Rng;
  readonly world: World;
  readonly events = new Emitter<GameEvents>();
  readonly session: Session;
  readonly dog: DogState = createDog();
  readonly look: LookState = createLook();
  readonly bunny: BunnyState = createBunny();
  readonly bones: Bone[] = [];
  readonly scent: ScentTrail = createScentTrail();
  readonly reach: LickReach = createReach();
  /** Camera-relative basis used for movement this frame. */
  readonly basis: Basis = { fx: 0, fz: -1, rx: 1, rz: 0 };
  /** Collar (leash anchor) world position at the last physics update. */
  readonly collar: Vec3 = { x: 0, y: 0, z: 0 };
  rag: Ragdoll;
  sprinting = false;
  /** Lick timer as it was when the dog moved this frame (drives the head and tongue pose). */
  dogLickT = 0;
  private readonly physics = new FixedStepper(RAGDOLL.step, RAGDOLL.maxStepsPerFrame);
  private readonly ragCollide = (p: Particle): void =>
    collide(this.world.obstacles, this.world.half, p, p.r, 0);

  constructor(opts: GameOptions = {}) {
    this.rng = opts.rng ?? mathRandomRng();
    this.session = createSession(opts.best ?? 0);
    this.world = generateWorld(this.rng);
    for (let i = 0; i < WORLD.bones.count; i++) {
      const { x, z } = freeSpot(this.world.obstacles, WORLD.bones.clearance, this.rng);
      this.bones.push({ x, z, spin: 0 });
    }
    this.rag = this.buildPerson();
  }

  get phase(): Session['phase'] {
    return this.session.phase;
  }

  /** Starts a round from the menu or the round-over screen. */
  start(): boolean {
    if (!startRound(this.session)) {
      return false;
    }
    resetDog(this.dog);
    resetLook(this.look);
    resetBunny(this.bunny);
    this.rag = this.buildPerson();
    clearScentTrail(this.scent);
    this.events.emit('start', undefined);
    return true;
  }

  private buildPerson(): Ragdoll {
    collarWorld(this.dog.pose, this.collar);
    return makeRagdollSim({
      x: this.dog.pos.x + RAGDOLL.spawnOffset.x,
      z: this.dog.pos.z + RAGDOLL.spawnOffset.z,
      leash: LEASH_LENGTH,
      collar: this.collar,
    });
  }

  update(dt: number, input: FrameInput): void {
    const s = this.session;
    s.elapsed += dt;
    if (s.phase === 'play') {
      this.updatePlay(dt, input);
    } else {
      idleBunny(this.bunny, dt);
    }
    s.lickT = Math.max(0, s.lickT - dt);
  }

  private updatePlay(dt: number, input: FrameInput): void {
    const s = this.session;
    const d = this.dog;
    const b = this.bunny;

    const res = updateDog(
      d,
      this.look,
      {
        moveX: input.moveX,
        moveY: input.moveY,
        lookX: input.lookX,
        lookY: input.lookY,
        turn: input.turn,
        sprint: input.sprint,
        jump: input.jump,
      },
      this.rag.st.tension,
      this.world,
      dt,
      this.basis,
    );
    this.sprinting = res.sprinting;
    this.dogLickT = s.lickT;
    if (res.jumped) {
      this.events.emit('jump', undefined);
    }
    updateBunny(b, d.pos, this.world, this.rng, dt);
    dropScent(this.scent, b.pos.x, b.pos.z, dt);

    const reach = lickReach(d.pos, b.pos, b.inv, this.reach);
    s.lickCD -= dt;
    if (input.lick && s.lickCD <= 0) {
      s.lickT = RULES.lickDuration;
      s.lickCD = RULES.lickCooldown;
      if (reach.ok) {
        // Auto-aim: snap the dog's face to the bun
        d.h = Math.atan2(reach.dx, reach.dz);
        const points = scoreLick(s);
        this.events.emit('lick', { points, combo: s.combo, x: b.pos.x, z: b.pos.z });
        onLicked(b);
      } else {
        this.events.emit('miss', undefined);
      }
    }

    // Person and leash physics at a fixed 60 Hz, anchored to the posed collar
    collarWorld(d.pose, this.collar);
    this.physics.advance(dt, (h) => this.rag.step(h, this.collar, this.ragCollide));
    if (this.rag.st.yanked) {
      this.rag.st.yanked = false;
      this.events.emit('yank', { message: this.rng.pick(YANK_MESSAGES) });
    }

    for (const bone of this.bones) {
      bone.spin += dt * FX.boneSpin;
      if (canPickBone(d.pos, bone.x, bone.z)) {
        d.stam = 1;
        s.score += RULES.bonePoints;
        this.events.emit('bone', { points: RULES.bonePoints });
        const spot = freeSpot(this.world.obstacles, WORLD.bones.clearance, this.rng);
        bone.x = spot.x;
        bone.z = spot.z;
      }
    }

    const result = tickClock(s, dt);
    if (result) {
      this.events.emit('roundOver', { ...result, dragged: this.rag.st.dragged });
    }
    ageScent(this.scent, dt);
  }
}
