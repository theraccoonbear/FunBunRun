/** Start and round-over card. */

export interface RoundSummary {
  licks: number;
  score: number;
  dragged: number;
  newBest: boolean;
  best: number;
}

const TOUCH_CONTROLS =
  '<b>Left thumb</b>: run. Push past the ring to sprint (knob turns yellow)<br><b>Right side</b>: drag to swing the camera<br><b>LICK</b> glows when the bun is in reach<br><b>JUMP</b> over logs, hold <b>SNIFF</b> to track the bun';
const DESKTOP_CONTROLS =
  '<b>WASD</b> run, <b>Mouse</b> swing camera (click to capture)<br><b>Shift</b> sprint, <b>Space</b> jump over logs<br><b>E</b> or <b>Click</b> to lick, hold <b>Q</b> to sniff<br>Gamepad works too (A jump, X lick, B sniff, LB sprint)';

/** Card HTML; `summary` is null for the start menu. All values are numbers, so nothing needs escaping. */
export function menuHtml(isTouch: boolean, summary: RoundSummary | null): string {
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
      '</p>';
  } else {
    html +=
      '<p>You are a very good dog. There is a bun. You must <b>lick</b> the bun. (Not eat. Just lick.) Your human is coming with you whether they like it or not.</p>';
  }
  html +=
    "<div class='ctl'>" +
    (isTouch ? TOUCH_CONTROLS : DESKTOP_CONTROLS) +
    "</div><p style='font-size:13px'>Golden bones refill stamina. Lick streaks multiply points. The bun tires out if you keep the pressure on.</p>" +
    "<button id='go'>" +
    (summary ? 'Run again' : 'Start running') +
    '</button>';
  return html;
}

export class Menu {
  constructor(
    private readonly overlay: HTMLElement,
    private readonly card: HTMLElement,
    private readonly isTouch: boolean,
    private readonly onStart: () => void,
  ) {}

  show(summary: RoundSummary | null): void {
    this.overlay.style.display = 'flex';
    this.card.innerHTML = menuHtml(this.isTouch, summary);
    this.card.querySelector('#go')?.addEventListener('click', this.onStart);
  }

  hide(): void {
    this.overlay.style.display = 'none';
  }
}
