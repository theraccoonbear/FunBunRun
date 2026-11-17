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
  private readonly boneUsePopEl = $('popBoneUse');

  private setText(id: string, t: string): void {
    if (this.cache.get(id) !== t) {
      this.cache.set(id, t);
      $(id).textContent = t;
    }
  }

  update(f: HudFrame): void {
    this.hint.className = f.lickReady ? 'on' : '';
    this.lickBtn.classList.toggle('hot', f.lickReady);
    this.arrowWrap.style.display = f.arrow === null ? 'none' : 'block';
    if (f.arrow !== null) {
      this.arrowWrap.style.transform = 'rotate(' + f.arrow + 'rad)';
    }
    this.setText('tTime', f.clock);
    this.setText('tScore', 'Score ' + f.score);
    this.setText('tLicks', 'Licks ' + f.licks);
    this.stamFill.style.width = (f.stamina * 100).toFixed(0) + '%';
  }

  /** The large gold "BONE-US!" pop-up, with the points as smaller secondary text. */
  popBoneUse(points: number): void {
    this.setText('buPoints', '+' + points);
    const el = this.boneUsePopEl;
    el.classList.remove('go');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('go');
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
