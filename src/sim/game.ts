import { FX, LEASH_LENGTH, RAGDOLL, RULES, WORLD, YANK_MESSAGES } from '../config';
import { Emitter } from '../core/events';
import type { Vec3 } from '../core/math';
import { createRng, deriveSeed, mathRandomRng, randomSeed, type Rng } from '../core/rng';
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
  pauseRound,
  quitRound,
  resumeRound,
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

/** Input for one simulation step, already merged from every device. */
export interface StepInput {
  /** Movement stick, x right and y forward, each roughly -1..1. */
  moveX: number;
  moveY: number;
  /** Look deltas in pixels (or equivalent) since the previous step. */
  lookX: number;
  lookY: number;
  /** Key turning, -1..1, positive turns left. */
  turn: number;
  sprint: boolean;
  /** Edge-triggered: true on exactly one step per press. */
  jump: boolean;
  lick: boolean;
}

export interface GameEvents extends Record<string, unknown> {
  start: undefined;
  /** play -> paused: the sim and the round clock stop until resume or quit. */
  pause: undefined;
  /** paused -> play. */
  resume: undefined;
  /** paused -> menu: the round was abandoned. */
  quit: undefined;
  jump: undefined;
  lick: { points: number; combo: number; x: number; z: number };
  miss: undefined;
  bone: { points: number };
  yank: { message: string };
  /** The world was regenerated for a new round; rebuild its visuals. */
  world: undefined;
  roundOver: RoundResult & { dragged: number; seed: number };
}

export interface Bone {
  x: number;
  z: number;
  /** Spin angle; advances only during play. */
  spin: number;
}

/** Salt for the gameplay stream derived from the world seed. */
const GAMEPLAY_STREAM_SALT = 0xa11ce;

export interface GameOptions {
  /** Forces this world seed for every round (e.g. from `?seed=`). */
  seed?: number;
  /** Where random seeds come from when none is forced. */
  seedSource?: Rng;
  best?: number;
}

/**
 * The whole simulation: world, dog, bunny, person on the leash, bones and
 * round rules. No three.js and no DOM; adapters read its state and
 * subscribe to `events`.
 */
export class Game {
  /** Seed of the current world. */
  seed = 0;
  /**
   * Gameplay randomness (bunny AI, yank messages): a separate stream derived
   * from the seed, so changing AI code never shifts the world layout.
   */
  rng: Rng = createRng(0);
  world: World;
  readonly events = new Emitter<GameEvents>();
  readonly session: Session;
  readonly dog: DogState = createDog();
  readonly look: LookState = createLook();
  readonly bunny: BunnyState = createBunny();
  readonly bones: Bone[] = [];
  readonly scent: ScentTrail = createScentTrail();
  readonly reach: LickReach = createReach();
  /** Camera-relative basis used for movement in the last step. */
  readonly basis: Basis = { fx: 0, fz: -1, rx: 1, rz: 0 };
  /** Collar (leash anchor) world position at the last step. */
  readonly collar: Vec3 = { x: 0, y: 0, z: 0 };
  rag: Ragdoll;
  sprinting = false;
  /**
   * Camera yaw the movement basis was built from in the last step (before
   * auto-follow nudges the look), which is the yaw the camera shows.
   */
  camYaw = 0;
  /** Lick timer as it was when the dog moved in the last step (drives the head and tongue pose). */
  dogLickT = 0;
  private readonly ragCollide = (p: Particle): void =>
    collide(this.world.obstacles, this.world.half, p, p.r, 0);

  private readonly forcedSeed: number | undefined;
  private readonly seedSource: Rng;
  /** World stream: obstacle, prop and bone placement, including bone respawns. */
  private worldRng: Rng = createRng(0);
  private started = false;

  constructor(opts: GameOptions = {}) {
    this.forcedSeed = opts.seed;
    this.seedSource = opts.seedSource ?? mathRandomRng();
    this.session = createSession(opts.best ?? 0);
    this.world = this.buildWorld(this.nextSeed());
    this.rag = this.buildPerson();
  }

  private nextSeed(): number {
    return this.forcedSeed ?? randomSeed(this.seedSource);
  }

  /** Generates the world and bones for `seed` and reseeds both random streams. */
  private buildWorld(seed: number): World {
    this.seed = seed;
    this.worldRng = createRng(seed);
    this.rng = createRng(deriveSeed(seed, GAMEPLAY_STREAM_SALT));
    const world = generateWorld(this.worldRng);
    this.bones.length = 0;
    for (let i = 0; i < WORLD.bones.count; i++) {
      const { x, z } = freeSpot(world.obstacles, WORLD.bones.clearance, this.worldRng);
      this.bones.push({ x, z, spin: 0 });
    }
    return world;
  }

  get phase(): Session['phase'] {
    return this.session.phase;
  }

  /** Starts a round from the menu or the round-over screen. */
  start(): boolean {
    if (!startRound(this.session)) {
      return false;
    }
    if (this.started) {
      // Each round after the first gets a new world (the same one when the seed is forced).
      this.world = this.buildWorld(this.nextSeed());
      this.events.emit('world', undefined);
    }
    this.started = true;
    resetDog(this.dog);
    resetLook(this.look);
    this.camYaw = this.look.yaw;
    resetBunny(this.bunny);
    this.rag = this.buildPerson();
    clearScentTrail(this.scent);
    this.events.emit('start', undefined);
    return true;
  }

  /** Pauses a running round. Returns false outside play. */
  pause(): boolean {
    if (!pauseRound(this.session)) {
      return false;
    }
    this.events.emit('pause', undefined);
    return true;
  }

  /** Resumes a paused round where it stopped. Returns false when not paused. */
  resume(): boolean {
    if (!resumeRound(this.session)) {
      return false;
    }
    this.events.emit('resume', undefined);
    return true;
  }

  /** Abandons a paused round and returns to the menu. Returns false when not paused. */
  quit(): boolean {
    if (!quitRound(this.session)) {
      return false;
    }
    this.events.emit('quit', undefined);
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

  /**
   * Advances the whole simulation by one step of `dt` seconds. The game loop
   * always passes the fixed step (SIM.step) through a SimRunner, so results do
   * not depend on the frame rate. Does nothing while paused.
   */
  update(dt: number, input: StepInput): void {
    const s = this.session;
    if (s.phase === 'paused') {
      return;
    }
    s.elapsed += dt;
    if (s.phase === 'play') {
      this.updatePlay(dt, input);
    } else {
      idleBunny(this.bunny, dt);
    }
    s.lickT = Math.max(0, s.lickT - dt);
  }

  private updatePlay(dt: number, input: StepInput): void {
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
    this.camYaw = Math.atan2(-this.basis.fx, -this.basis.fz);
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

    // Person and leash physics, anchored to the posed collar. One ragdoll step
    // per dog step, so the collar speed the yank check sees is the true
    // per-step speed at any frame rate (#2).
    collarWorld(d.pose, this.collar);
    this.rag.step(dt, this.collar, this.ragCollide);
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
        const spot = freeSpot(this.world.obstacles, WORLD.bones.clearance, this.worldRng);
        bone.x = spot.x;
        bone.z = spot.z;
      }
    }

    const result = tickClock(s, dt);
    if (result) {
      this.events.emit('roundOver', { ...result, dragged: this.rag.st.dragged, seed: this.seed });
    }
    ageScent(this.scent, dt);
  }
}
