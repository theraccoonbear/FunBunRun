/** Start and round-over card. */

import { GLYPHS, type PadFamily } from '../input/gamepad';

export interface RoundSummary {
  licks: number;
  score: number;
  dragged: number;
  newBest: boolean;
  best: number;
  /** World seed of the round, shown so a layout can be reproduced. */
  seed: number;
}

const TOUCH_CONTROLS =
  '<b>Left thumb</b>: run. Push past the ring to sprint (knob turns yellow)<br><b>Right side</b>: drag to swing the camera<br><b>LICK</b> glows when the bun is in reach<br><b>JUMP</b> over logs, hold <b>SNIFF</b> to track the bun';
const DESKTOP_CONTROLS =
  '<b>WASD</b> run, <b>Mouse</b> swing camera (click to capture)<br><b>Shift</b> sprint, <b>Space</b> jump over logs<br><b>E</b> or <b>Click</b> to lick, hold <b>Q</b> to sniff';

/** Gamepad line with the labels of the given controller family. */
export function padControls(family: PadFamily): string {
  const g = GLYPHS[family];
  return (
    '<b>' +
    g.jump +
    '</b> jump, <b>' +
    g.lick +
    '</b> lick, <b>' +
    g.sniff +
    '</b> sniff, <b>' +
    g.lb +
    '</b> sprint'
  );
}

/**
 * Card HTML; `summary` is null for the start menu. `pad` is the family of the
 * active gamepad, or null when none is connected. All values are numbers or
 * fixed labels, so nothing needs escaping.
 */
export function menuHtml(
  isTouch: boolean,
  summary: RoundSummary | null,
  pad: PadFamily | null = null,
): string {
  let html = '<h1>Fun Bun Run</h1>';
  if (summary) {
    html +=
      "<p style='font-size:22px'><b>" +
      summary.licks +
      '</b> licks, <b>' +
      summary.score +
      '</b> points</p>' +
      '<p>Human dragged: <b>' +
      Math.round(summary.dragged) +
      ' m</b></p>' +
      '<p>' +
      (summary.newBest ? 'New best!' : 'Best: ' + summary.best) +
      "</p><p class='seed' style='font-size:12px;opacity:.6'>World #" +
      summary.seed +
      '</p>';
  } else {
    html +=
      '<p>You are a very good dog. There is a bun. You must <b>lick</b> the bun. (Not eat. Just lick.) Your human is coming with you whether they like it or not.</p>';
  }
  html +=
    "<div class='ctl'>" +
    (isTouch ? TOUCH_CONTROLS : DESKTOP_CONTROLS) +
    (pad
      ? '<br>Gamepad: ' + padControls(pad)
      : isTouch
        ? ''
        : '<br>Gamepad works too (' + padControls('xbox').replace(/<\/?b>/g, '') + ')') +
    "</div><p style='font-size:13px'>Golden bones refill stamina. Lick streaks multiply points. The bun tires out if you keep the pressure on.</p>" +
    "<button id='go'>" +
    (summary ? 'Run again' : 'Start running') +
    '</button>';
  return html;
}

export class Menu {
  private summary: RoundSummary | null = null;
  private pad: PadFamily | null = null;

  constructor(
    private readonly overlay: HTMLElement,
    private readonly card: HTMLElement,
    private readonly isTouch: boolean,
    private readonly onStart: () => void,
  ) {}

  show(summary: RoundSummary | null): void {
    this.summary = summary;
    this.overlay.style.display = 'flex';
    this.render();
  }

  /** Switches the gamepad labels; re-renders the card if it is showing. */
  setPad(pad: PadFamily | null): void {
    if (pad === this.pad) {
      return;
    }
    this.pad = pad;
    if (this.overlay.style.display !== 'none') {
      this.render();
    }
  }

  private render(): void {
    this.card.innerHTML = menuHtml(this.isTouch, this.summary, this.pad);
    this.card.querySelector('#go')?.addEventListener('click', this.onStart);
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }
}
