/** HUD: clock, score, licks, stamina bar, lick hint, sniff arrow and pop-ups. */

const $ = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error('missing #' + id);
  }
  return el;
};

export interface HudFrame {
  clock: string;
  score: number;
  licks: number;
  stamina: number;
  lickReady: boolean;
  /** Arrow angle toward the bunny (radians, 0 = straight ahead), or null when not sniffing. */
  arrow: number | null;
}

export class Hud {
  private readonly cache = new Map<string, string>();
  private readonly hint = $('hint');
  private readonly lickBtn = $('bLick');
  private readonly arrowWrap = $('arrowWrap');
  private readonly stamFill = $('stamFill');
  private readonly popEl = $('pop');
  // Last values written, so unchanged ones cost no DOM write.
  private lickReady: boolean | null = null;
  private arrowShown: boolean | null = null;
  private arrowDeg = Number.NaN;
  private stamPct = -1;

  private readonly textEls = new Map<string, HTMLElement>();

  private setText(id: string, t: string): void {
    if (this.cache.get(id) !== t) {
      this.cache.set(id, t);
      let el = this.textEls.get(id);
      if (!el) {
        el = $(id);
        this.textEls.set(id, el);
      }
      el.textContent = t;
    }
  }

  update(f: HudFrame): void {
    if (f.lickReady !== this.lickReady) {
      this.lickReady = f.lickReady;
      this.hint.className = f.lickReady ? 'on' : '';
      this.lickBtn.classList.toggle('hot', f.lickReady);
    }
    const arrowShown = f.arrow !== null;
    if (arrowShown !== this.arrowShown) {
      this.arrowShown = arrowShown;
      this.arrowWrap.style.display = arrowShown ? 'block' : 'none';
    }
    if (f.arrow !== null && f.arrow !== this.arrowDeg) {
      this.arrowDeg = f.arrow;
      this.arrowWrap.style.transform = 'rotate(' + f.arrow + 'rad)';
    }
    this.setText('tTime', f.clock);
    this.setText('tScore', 'Score ' + f.score);
    this.setText('tLicks', 'Licks ' + f.licks);
    const pct = Math.round(f.stamina * 100);
    if (pct !== this.stamPct) {
      this.stamPct = pct;
      this.stamFill.style.width = pct + '%';
    }
  }

  pop(text: string, color = '#fff'): void {
    const el = this.popEl;
    el.textContent = text;
    el.style.color = color;
    el.classList.remove('go');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('go');
  }
}

export { $ };
