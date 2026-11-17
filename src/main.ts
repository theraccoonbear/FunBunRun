import { BUNNY, SIM } from './config';
import { startLoop } from './core/loop';
import { mathRandomRng, parseSeed } from './core/rng';
import { createSfx } from './audio/sfx';
import { installDebugHook } from './debug';
import { Actions, EdgeDetector } from './input/actions';
import {
  GLYPHS,
  padFamily,
  PadTracker,
  pollGamepads,
  readGamepads,
  type PadFamily,
} from './input/gamepad';
import { Keyboard } from './input/keyboard';
import { attachPointer, releasePointer } from './input/pointer';
import { detectTouch, TouchControls } from './input/touch';
import { loadBest, localStore, saveBest } from './platform/storage';
import { followCamera, menuCamera } from './render/camera';
import { Hearts, TrailView, updateSniffAtmosphere } from './render/fx';
import { disposeProps, makeProps } from './render/models';
import { configureColorPipeline, createScene } from './render/scene';
import { BonesView, BunnyView, DogView, PersonView } from './render/views';
import { Game } from './sim/game';
import { SimRunner } from './sim/runner';
import { formatClock } from './sim/rules';
import { $, Hud } from './ui/hud';
import { Menu } from './ui/menu';
import { installPadDebugPanel } from './ui/pad-debug';

configureColorPipeline();

const isTouch = detectTouch();
const store = localStore();
// Cosmetic randomness (grass speckles, heart bursts) stays separate from the sim stream.
const fxRng = mathRandomRng();
const kit = createScene(isTouch, fxRng);
// `?seed=<n>` forces the world seed for every round; otherwise each round draws a random one.
const forcedSeed = parseSeed(location.search);
const game = new Game({
  best: loadBest(store),
  ...(forcedSeed === null ? {} : { seed: forcedSeed }),
});
// Fixed-step clock for the whole simulation; rendering interpolates (#3).
const runner = new SimRunner(game);

let props = makeProps(game.world);
kit.scene.add(props);
const dogView = new DogView(kit.scene);
const bunnyView = new BunnyView(kit.scene);
const bonesView = new BonesView(kit.scene, game.bones.length);
const personView = new PersonView(kit.scene);
const trailView = new TrailView(kit.scene, game.scent.drops.length);
const hearts = new Hearts(kit.scene, fxRng);
const sfx = createSfx();
const hud = new Hud();

const actions = new Actions();
const isPlaying = (): boolean => game.phase === 'play';
const touch = new TouchControls(
  {
    layer: $('touch'),
    joyBase: $('joyBase'),
    joyKnob: $('joyKnob'),
    lick: $('bLick'),
    jump: $('bJump'),
    sniff: $('bSniff'),
  },
  actions,
);
const menu = new Menu($('overlay'), $('card'), isTouch, () => startGame());

function startGame(): void {
  sfx.init();
  game.start();
}

function showMenu(summary: Parameters<Menu['show']>[0]): void {
  touch.setVisible(false);
  releasePointer();
  menu.show(summary);
}

game.events.on('world', () => {
  kit.scene.remove(props);
  disposeProps(props);
  props = makeProps(game.world);
  kit.scene.add(props);
});
game.events.on('start', () => {
  dogView.place(game.dog);
  personView.bind(game.rag);
  trailView.hideAll();
  menu.hide();
  if (isTouch) {
    touch.setVisible(true);
  }
  hud.pop('Find the bun!', '#fff');
});
game.events.on('jump', () => sfx.jump());
game.events.on('lick', (e) => {
  hud.pop('LICK! +' + e.points + (e.combo > 1 ? '  x' + e.combo : ''), '#ff8fd6');
  sfx.slurp();
  hearts.burst(e.x, e.z);
});
game.events.on('miss', () => sfx.miss());
game.events.on('yank', (e) => {
  hud.pop(e.message, '#bfe3ff');
  sfx.oof();
});
game.events.on('bone', (e) => {
  hud.pop('Bone! +' + e.points, '#ffd34d');
  sfx.bone();
});
game.events.on('roundOver', (r) => {
  if (r.bestChanged) {
    saveBest(store, r.best);
  }
  showMenu(r);
});

const keyboard = new Keyboard(actions, { onStart: startGame, isPlaying });
keyboard.attach(window);
attachPointer(kit.renderer.domElement, actions, { isPlaying, isTouch });
document.addEventListener('contextmenu', (e) => e.preventDefault());
const padEdges = new EdgeDetector();
const padTracker = new PadTracker();
let padShown: PadFamily | null = null;

/** Switches menu and HUD button labels to the active pad's family (none: keyboard labels). */
function syncPadGlyphs(pads: ReturnType<typeof readGamepads>): void {
  const active = pads.find((p) => p && p.index === padTracker.active && p.connected !== false);
  const family = active ? padFamily(active.id ?? '') : null;
  if (family === padShown) {
    return;
  }
  padShown = family;
  menu.setPad(family);
  hud.setLickGlyph(family ? GLYPHS[family].lick : null);
}
addEventListener('gamepadconnected', () => syncPadGlyphs(readGamepads()));
addEventListener('gamepaddisconnected', () => {
  // TODO(#7): pause the round on disconnect once the pause state exists.
  const pads = readGamepads();
  padTracker.select(pads);
  syncPadGlyphs(pads);
});
const updatePadDebug = installPadDebugPanel(location.search, readGamepads, () => padTracker.active);

/** One rendered frame: sample input, run the sim steps due, draw the interpolated state. */
function frame(dt: number): void {
  keyboard.apply();
  touch.apply();
  const pads = readGamepads();
  pollGamepads(pads, padEdges, actions, { isPlaying, onStart: startGame }, dt, padTracker);
  syncPadGlyphs(pads);
  updatePadDebug?.();

  const wasPlaying = isPlaying();
  runner.frame(dt, actions);
  const s = game.session;
  const r = runner.render();

  if (wasPlaying) {
    dogView.sync(r.dog, r.elapsed);
    followCamera(kit.camera, r.dog, r.camYaw, r.camPitch, game.sprinting, dt);
    bunnyView.sync(r.bunny);
    personView.sync(r.pts);
    bonesView.sync(game.bones, r.boneSpin, r.elapsed);

    const sniffing = actions.sniff;
    updateSniffAtmosphere(kit, sniffing, dt);
    trailView.sync(game.scent, sniffing);
    let arrow: number | null = null;
    if (sniffing) {
      const dx = r.bunny.x - r.dog.x;
      const dz = r.bunny.z - r.dog.z;
      // Screen-relative: forward and right of the rendered camera yaw.
      const sy = Math.sin(r.camYaw);
      const cy = Math.cos(r.camYaw);
      arrow = Math.atan2(dx * cy - dz * sy, -dx * sy - dz * cy);
    }
    hud.update({
      clock: formatClock(s.timeLeft),
      score: s.score,
      licks: s.licks,
      stamina: game.dog.stam,
      lickReady: game.reach.ok,
      arrow,
    });
  } else {
    menuCamera(kit.camera, r.elapsed);
    bunnyView.syncMenu(r.bunny.hopT, r.elapsed, BUNNY.start.x, BUNNY.start.z);
    if (game.phase === 'over') {
      personView.sync(r.pts);
    }
  }

  // Visual-only effects stay per frame.
  hearts.update(dt);
  kit.render();
}

addEventListener('resize', () => kit.resize());

dogView.place(game.dog);
bonesView.place(game.bones);
personView.bind(game.rag);
showMenu(null);
installDebugHook(game, location.search);
startLoop(frame, SIM.maxFrameDt);
