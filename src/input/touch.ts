import { INPUT } from '../config';
import type { Actions } from './actions';
import { createJoystick, moveJoystick, type Joystick } from './joystick';

/** Half the joystick base element's size, to centre it on the touch point. */
const BASE_HALF = 60;

export interface TouchElements {
  layer: HTMLElement;
  joyBase: HTMLElement;
  joyKnob: HTMLElement;
  lick: HTMLElement;
  jump: HTMLElement;
  sniff: HTMLElement;
}

/**
 * Touch controls: left half of the screen is a floating joystick, right
 * half drags the camera, plus LICK / JUMP / SNIFF buttons. Pointer capture
 * keeps each finger bound to its control.
 */
export class TouchControls {
  moveX = 0;
  moveY = 0;
  sprint = false;
  sniff = false;
  private joyId: number | null = null;
  private joy: Joystick = createJoystick(0, 0);
  private lookId: number | null = null;
  private lookLastX = 0;
  private lookLastY = 0;

  constructor(
    private readonly el: TouchElements,
    private readonly actions: Actions,
  ) {
    const layer = el.layer;
    layer.addEventListener('pointerdown', (e) => this.onDown(e));
    layer.addEventListener('pointermove', (e) => this.onMove(e));
    layer.addEventListener('pointerup', (e) => this.onEnd(e));
    layer.addEventListener('pointercancel', (e) => this.onEnd(e));
    bindButton(el.lick, () => actions.press('lick'));
    bindButton(el.jump, () => actions.press('jump'));
    bindButton(
      el.sniff,
      () => {
        this.sniff = true;
      },
      () => {
        this.sniff = false;
      },
    );
  }

  /** Shows or hides the touch layer and buttons. */
  setVisible(on: boolean): void {
    this.el.layer.style.display = on ? 'block' : 'none';
    for (const b of [this.el.lick, this.el.jump, this.el.sniff]) {
      b.style.display = on ? 'flex' : 'none';
    }
    if (!on) {
      this.el.joyBase.style.display = 'none';
      this.joyId = this.lookId = null;
      this.moveX = this.moveY = 0;
    }
  }

  /** Adds this frame's touch movement into the actions. */
  apply(): void {
    this.actions.moveX += this.moveX;
    this.actions.moveY += this.moveY;
    this.actions.sprint ||= this.sprint;
    this.actions.sniff ||= this.sniff;
  }

  private placeBase(): void {
    this.el.joyBase.style.left = this.joy.originX - BASE_HALF + 'px';
    this.el.joyBase.style.top = this.joy.originY - BASE_HALF + 'px';
  }

  private onDown(e: PointerEvent): void {
    e.preventDefault();
    try {
      this.el.layer.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    if (e.clientX < innerWidth * 0.5 && this.joyId === null) {
      this.joyId = e.pointerId;
      this.joy = createJoystick(e.clientX, e.clientY);
      this.placeBase();
      this.el.joyBase.style.display = 'block';
      this.el.joyKnob.style.transform = 'translate(0,0)';
    } else if (this.lookId === null) {
      this.lookId = e.pointerId;
      this.lookLastX = e.clientX;
      this.lookLastY = e.clientY;
    }
  }

  private onMove(e: PointerEvent): void {
    e.preventDefault();
    if (e.pointerId === this.joyId) {
      const ox = this.joy.originX;
      const oy = this.joy.originY;
      const j = moveJoystick(this.joy, e.clientX, e.clientY);
      if (j.originX !== ox || j.originY !== oy) {
        this.placeBase();
      }
      this.moveX = j.moveX;
      this.moveY = j.moveY;
      this.sprint = j.sprint;
      this.el.joyKnob.className = j.sprint ? 'sprint' : '';
      this.el.joyKnob.style.transform = 'translate(' + j.knobX + 'px,' + j.knobY + 'px)';
    } else if (e.pointerId === this.lookId) {
      this.actions.addLook(
        (e.clientX - this.lookLastX) * INPUT.touchLookScale,
        (e.clientY - this.lookLastY) * INPUT.touchLookScale,
      );
      this.lookLastX = e.clientX;
      this.lookLastY = e.clientY;
    }
  }

  private onEnd(e: PointerEvent): void {
    if (e.pointerId === this.joyId) {
      this.joyId = null;
      this.moveX = this.moveY = 0;
      this.sprint = false;
      this.el.joyBase.style.display = 'none';
    }
    if (e.pointerId === this.lookId) {
      this.lookId = null;
    }
  }
}

function bindButton(el: HTMLElement, down: () => void, up?: () => void): void {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    el.classList.add('down');
    down();
  });
  const rel = (): void => {
    el.classList.remove('down');
    up?.();
  };
  el.addEventListener('pointerup', rel);
  el.addEventListener('pointercancel', rel);
}

/** Touch-first device detection, decided once at load (see #6). */
export function detectTouch(): boolean {
  return window.matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
}
