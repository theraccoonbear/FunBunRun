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

/** What the sound controls show: the mute button label and whether the unlock hint is up. */
export interface SoundUi {
  label: string;
  pressed: boolean;
  hint: boolean;
}

/**
 * `locked`: the audio context is not running. `tried`: an unlock was
 * attempted (a round started), so a still-locked context needs a gesture.
 * Muted players do not need the hint.
 */
export function soundUi(locked: boolean, muted: boolean, tried: boolean): SoundUi {
  return {
    label: muted ? 'Sound off (M)' : 'Sound on (M)',
    pressed: muted,
    hint: locked && !muted && tried,
  };
}

export class Hud {
  private readonly cache = new Map<string, string>();
  private readonly hint = $('hint');
  private readonly lickBtn = $('bLick');
  private readonly arrowWrap = $('arrowWrap');
  private readonly stamFill = $('stamFill');
  private readonly popEl = $('pop');
  private readonly muteBtn = $('bMute');
  private readonly soundHint = $('sndHint');

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

  setSound(ui: SoundUi): void {
    this.muteBtn.textContent = ui.pressed ? '\u266A off' : '\u266A on';
    this.muteBtn.title = ui.label;
    this.muteBtn.setAttribute('aria-label', ui.label);
    this.muteBtn.setAttribute('aria-pressed', String(ui.pressed));
    this.soundHint.style.display = ui.hint ? 'block' : 'none';
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
