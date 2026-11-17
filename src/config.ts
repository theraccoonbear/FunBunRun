/**
 * Tuning constants. Values are carried over unchanged from the single-file
 * prototype (served at /legacy/); changing any of them changes game feel.
 */

/** Arena: the playable square is [-ARENA_HALF, ARENA_HALF] on x and z. */
export const ARENA_HALF = 98;
/** Round length in seconds. */
export const ROUND_SECONDS = 90;
/** Leash length in metres (rope rest length and hard limit). */
export const LEASH_LENGTH = 3.6;

/**
 * Simulation clock (#3). The whole simulation (dog, bunny, person and leash,
 * rules) advances in fixed steps; rendering interpolates between the last two
 * steps.
 *
 * Time-drop policy: each rendered frame runs at most `maxStepsPerFrame`
 * steps. If more time than that is owed after a frame, the backlog is dropped
 * instead of being caught up later, so a slow frame cannot snowball into ever
 * slower frames. With 60 Hz steps and 4 steps per frame, the game runs at
 * full speed down to 15 fps and only slows below that. Gaps longer than
 * `maxFrameDt` (tab switches, debugger pauses) count as `maxFrameDt`; that
 * clamp also bounds per-frame visual effects.
 */
export const SIM = {
  /** Fixed step in seconds. Tuning constants below assume 60 Hz. */
  step: 1 / 60,
  maxStepsPerFrame: 4,
  maxFrameDt: 0.25,
} as const;

export const WORLD = {
  /** Spawn-clear radius around the origin where no prop is placed. */
  spawnClearRadius: 14,
  /** Props are placed at most this far in from the arena edge. */
  edgeMargin: 4,
  /** Attempts per freeSpot() call before falling back. */
  placementAttempts: 300,
  /** Fallback spot when no free spot is found. */
  fallbackSpot: { x: 0, z: 40 },
  trees: { count: 70, clearance: 3, radius: 0.5, height: 99, scaleMin: 0.8, scaleRange: 0.6 },
  bushes: { count: 40, clearance: 2.5, radius: 1.15, height: 1.6 },
  rocks: { count: 20, clearance: 2.5, radius: 1.0, height: 1.4, maxTilt: 3 },
  logs: { count: 18, clearance: 3, radius: 0.35, height: 0.7, halfLength: 2 },
  bones: { count: 12, clearance: 1.5 },
} as const;

export const DOG = {
  /** Collision radius against obstacles. */
  radius: 0.45,
  walkSpeed: 6.8,
  sprintSpeed: 11,
  /** Fraction of speed lost at full leash tension. */
  tensionSlowdown: 0.12,
  /** Stick magnitude below which the dog counts as standing still. */
  moveDeadzone: 0.05,
  /** Minimum stamina needed to keep sprinting. */
  sprintMinStamina: 0.02,
  staminaDrain: 0.26,
  staminaRefillMoving: 0.12,
  staminaRefillIdle: 0.22,
  /** Velocity response rate (1/s) on the ground and in the air. */
  groundAccel: 9,
  airAccel: 2.5,
  jumpVelocity: 7.5,
  gravity: 22,
  /** Horizontal speed above which the dog turns to face its velocity. */
  turnMinSpeed: 0.4,
  turnRate: 12,
  /** Gallop phase rate: base + per unit of horizontal speed. */
  gaitBase: 3,
  gaitPerSpeed: 1.7,
} as const;

export const CAMERA = {
  initialPitch: 0.38,
  minPitch: 0.08,
  maxPitch: 1.1,
  /** Radians per pixel of look input. */
  yawPerPixel: 0.004,
  pitchPerPixel: 0.003,
  /** Arrow-key yaw speed in rad/s. */
  keyYawSpeed: 2.4,
  /** Seconds without look input before the camera drifts behind the dog. */
  autoFollowDelay: 1.0,
  autoFollowRate: 1.2,
  distance: 7.5,
  targetHeight: 0.9,
  fov: 65,
  sprintFov: 72,
  fovRate: 5,
  near: 0.1,
  far: 300,
  /** Menu orbit around the bunny. */
  menuOrbitSpeed: 0.15,
  menuOrbitRadius: 6,
  menuOrbitHeight: 1.6,
  /**
   * Sprint pull-back (#43): while sprinting the follow distance eases out to
   * `boltDistance` and the camera rises by `boltLift`, so the dog appears to
   * bolt ahead. Rates are exponential (1/s): the gap closes by 1 - e^(-rate*dt)
   * each frame, at any frame rate.
   */
  boltDistance: 9.6,
  /** Extra camera height (m) at full pull-back. */
  boltLift: 0.45,
  /** Ease-out rate when a sprint starts; lower lets the dog pull further ahead first. */
  boltOutRate: 2.2,
  /** Ease-in rate when the sprint ends, so the camera settles back in tight. */
  boltInRate: 3.2,
} as const;

export const BUNNY = {
  start: { x: 0, z: -16 },
  startHeading: Math.PI,
  radius: 0.35,
  /** Only obstacles at least this tall block or repel the bunny. */
  minObstacleHeight: 0.8,
  /** Dog distance below which the bunny flees. */
  fleeDistance: 22,
  /** Dog distance below which the bunny may jink sideways. */
  jinkDistance: 6,
  jinkDuration: 0.5,
  jinkAngleMin: 0.7,
  jinkAngleRange: 0.9,
  jinkCooldownMin: 0.9,
  jinkCooldownRange: 1.3,
  fleeSpeed: 9.0,
  tiredSpeed: 4.2,
  wanderSpeed: 2.2,
  fleeStaminaDrain: 0.11,
  wanderStaminaRefill: 0.2,
  tiredDuration: 2.8,
  /** Stamina restored when the tired spell ends. */
  recoverStamina: 0.6,
  wanderTurnNoise: 3,
  /** Obstacle avoidance: look-ahead and strength. */
  avoidReach: 2.5,
  avoidStrength: 2,
  /** Edge avoidance starts this far in from the arena edge. */
  edgeMargin: 7,
  edgeFalloff: 2.5,
  turnRate: 6,
  jinkTurnRate: 14,
  speedResponse: 4,
  hopBase: 3,
  hopPerSpeed: 1.1,
  gravity: 22,
  /** Upward pop velocity after being licked. */
  lickPop: 6,
  /** Seconds of lick immunity after a lick. */
  lickImmunity: 1.2,
  /** Interval between scent trail drops. */
  trailInterval: 0.25,
  menuHopRate: 4,
} as const;

export const RULES = {
  lickRange: 2.6,
  lickDuration: 0.35,
  lickCooldown: 0.45,
  /** Seconds after a lick within which the next lick extends the combo. */
  comboWindow: 8,
  pointsPerLick: 100,
  bonePickupRange: 1.4,
  bonePoints: 25,
  /** Sentinel for "no lick yet" so the first lick never extends a combo. */
  noLickTime: -99,
} as const;

export const RAGDOLL = {
  gravity: 18,
  /** Per-step velocity retention (air drag). */
  damping: 0.995,
  /** Horizontal velocity retention while touching the ground. */
  groundFriction: 0.86,
  /** Height above a point's radius that counts as ground contact. */
  groundSlop: 0.02,
  ropeSegments: 10,
  ropeInvMass: 0.6,
  ropeRadius: 0.03,
  solverIterations: 10,
  /** Recovery: seconds of negative stun needed for full standing control. */
  recoverTime: 1.2,
  walkSpeed: 3.2,
  walkPhaseRate: 10,
  /** Person walks after the dog once farther than this fraction of the leash. */
  followFraction: 0.7,
  /** Per-step decay of the walk swing when the person stops walking. */
  swingDecay: 0.9,
  poseStrength: 0.15,
  poseDamping: 0.5,
  /**
   * Collar speed (m/s) above which leash pull can stun or yank. Measured from
   * the collar's displacement over one sim step, so it is frame-rate independent (#2).
   */
  yankCollarSpeed: 3.5,
  stunPull: 0.004,
  stunTime: 0.9,
  yankPull: 0.03,
  yankCooldown: 2.5,
  tensionScale: 20,
  /** Head below this height counts as being dragged. */
  draggedHeadHeight: 0.8,
  standHeadHeight: 1.3,
  standPelvisHeight: 0.75,
  /** Initial stun so the person starts in control. */
  initialStun: -5,
  /** Spawn offset of the person from the dog. */
  spawnOffset: { x: 0.6, z: 2.6 },
} as const;

export const STORAGE_KEYS = {
  best: 'funbunrun-best',
} as const;

export const SNIFF = {
  /** Scent trail markers fade over this many seconds. */
  trailLife: 12,
  trailSize: 50,
  trailOpacity: 0.9,
  fogFar: 70,
  fogNear: 30,
  normalFogFar: 120,
  blendRate: 6,
} as const;

export const COLORS = {
  sky: 0x87c5ea,
  sniffSky: 0x5a3d78,
} as const;

export const INPUT = {
  gamepadDeadzone: 0.15,
  /** Right stick look speed, in pseudo-pixels per second. */
  gamepadLookX: 700,
  gamepadLookY: 500,
  touchLookScale: 1.3,
  joystickRadius: 50,
  /** Joystick base follows the finger beyond this multiple of the radius. */
  joystickFollow: 1.6,
  /** Sprint engages beyond this multiple of the radius. */
  joystickSprint: 1.15,
  joystickDeadzone: 0.12,
} as const;

export const FX = {
  heartCount: 14,
  heartGravity: 6,
  heartSpawnHeight: 0.9,
  boneSpin: 2,
  boneHeight: 0.6,
  boneBob: 0.1,
  boneBobRate: 3,
} as const;

export const YANK_MESSAGES = ['Yoink!', 'Whoa!', 'Not again!', 'Slow down!'] as const;

/**
 * Exclamations from the person on the leash (#43). The sim decides when and
 * what; the renderer spells each shout out letter by letter from the head.
 */
export const SHOUT = {
  /** Pelvis ground speed (m/s) above which the person counts as dragged hard. */
  dragSpeed: 3.4,
  /** Leash tension (0..1) that counts as hard dragging while still upright. */
  dragTension: 0.5,
  /** Seconds of continuous hard dragging before the first shout. */
  dragBuildUp: 0.35,
  /** Random wait between drag shouts while the drag goes on, in seconds. */
  dragCooldownMin: 2.2,
  dragCooldownMax: 4.0,
  /** Downward speed (m/s) of the head or pelvis on touchdown that counts as an impact. */
  impactSpeed: 3.0,
  /** Minimum gap between impact shouts. */
  impactCooldown: 1.4,
  /** Minimum gap between any two shouts, so spelled-out letters do not overlap much. */
  minGap: 1.1,
  /** Long shouts while being dragged. Spaces only add a pause when spelled out. */
  dragPhrases: [
    'H E L P !',
    'whoa!',
    'slow down!',
    'aaah!',
    'my arm!',
    'heel! heel!',
    'wait up!',
    'easy, pup!',
  ],
  /** Short shouts on hard landings. */
  impactPhrases: ['oof!', 'ow!', 'ouch!', 'umph!'],
} as const;

/** How shouts are spelled out on screen (render only; no effect on the sim). */
export const SHOUT_FX = {
  /** Seconds between letters. */
  letterInterval: 0.09,
  /** Seconds each letter stays visible. */
  letterLife: 1.4,
  /** Letter sprite size in metres. */
  letterSize: 0.42,
  /** Spawn height above the head centre. */
  headOffset: 0.35,
  /** Upward drift speed (m/s) and random sideways jitter speed. */
  rise: 0.55,
  jitter: 0.25,
  /** Pool size: the most letters on screen at once. */
  poolSize: 40,
  /** Shouts waiting to be spelled out; later ones are dropped. */
  queueSize: 2,
  dragColor: 0xffffff,
  impactColor: 0xffe066,
} as const;
