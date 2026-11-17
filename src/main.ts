import { BUNNY, MAX_FRAME_DT } from './config';
import { startLoop } from './core/loop';
import { mathRandomRng } from './core/rng';
import { createSfx } from './audio/sfx';
import { installDebugHook } from './debug';
import { Actions, EdgeDetector } from './input/actions';
import { pollGamepads, readGamepads } from './input/gamepad';
import { Keyboard } from './input/keyboard';
import { attachPointer, releasePointer } from './input/pointer';
import { detectTouch, TouchControls } from './input/touch';
import { loadBest, localStore, saveBest } from './platform/storage';
import { followCamera, menuCamera } from './render/camera';
import { Hearts, TrailView, updateSniffAtmosphere } from './render/fx';
import { makeProps } from './render/models';
import { configureColorPipeline, createScene } from './render/scene';
import { BonesView, BunnyView, DogView, PersonView } from './render/views';
import { Game } from './sim/game';
import { formatClock } from './sim/rules';
import { $, Hud } from './ui/hud';
import { Menu } from './ui/menu';

configureColorPipeline();

const isTouch = detectTouch();
const store = localStore();
// Cosmetic randomness (grass speckles, heart bursts) stays separate from the sim stream.
const fxRng = mathRandomRng();
const kit = createScene(isTouch, fxRng);
const game = new Game({ best: loadBest(store) });

kit.scene.add(makeProps(game.world));
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

function frame(dt: number): void {
  keyboard.apply();
  touch.apply();
  pollGamepads(readGamepads(), padEdges, actions, { isPlaying, onStart: startGame }, dt);

  const wasPlaying = isPlaying();
  game.update(dt, actions);
  const s = game.session;

  if (wasPlaying) {
    dogView.sync(game.dog, s.elapsed, game.dogLickT);
    followCamera(kit.camera, game.dog.pos, game.look, game.basis, game.sprinting, dt);
    bunnyView.sync(game.bunny);
    personView.sync();
    bonesView.sync(game.bones, s.elapsed);

    const sniffing = actions.sniff;
    updateSniffAtmosphere(kit, sniffing, dt);
    trailView.sync(game.scent, sniffing);
    let arrow: number | null = null;
    if (sniffing) {
      const dx = game.bunny.pos.x - game.dog.pos.x;
      const dz = game.bunny.pos.z - game.dog.pos.z;
      const b = game.basis;
      arrow = Math.atan2(dx * b.rx + dz * b.rz, dx * b.fx + dz * b.fz);
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
    menuCamera(kit.camera, s.elapsed);
    bunnyView.syncMenu(game.bunny, s.elapsed, BUNNY.start.x, BUNNY.start.z);
    if (game.phase === 'over') {
      personView.sync();
    }
  }

  hearts.update(dt);
  actions.endFrame();
  kit.render();
}

addEventListener('resize', () => kit.resize());

dogView.place(game.dog);
bonesView.place(game.bones);
personView.bind(game.rag);
showMenu(null);
installDebugHook(game, location.search);
startLoop(frame, MAX_FRAME_DT);
