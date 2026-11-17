/** `?debug` gamepad panel: raw pad state, for diagnosing detection and mapping problems (#14). */

import { padFamily, type PadLike } from '../input/gamepad';

const fmt = (v: number): string => (v >= 0 ? ' ' : '') + v.toFixed(2);

/** Text for the panel: one block per pad slot, with raw button and axis values. */
export function formatPads(pads: readonly (PadLike | null)[], active: number | null): string {
  const lines: string[] = [];
  for (const gp of pads) {
    if (!gp) {
      continue;
    }
    lines.push(
      (gp.index === active ? '> ' : '  ') +
        '#' +
        gp.index +
        ' ' +
        (gp.id ?? '?') +
        '\n    mapping=' +
        (gp.mapping || '(none)') +
        ' connected=' +
        String(gp.connected ?? true) +
        ' family=' +
        padFamily(gp.id ?? ''),
      '    axes ' + gp.axes.map((v, i) => i + ':' + fmt(v)).join(' '),
      '    btns ' +
        gp.buttons
          .map((b, i) => i + ':' + (b.pressed ? '#' : (b.value ?? 0) > 0.05 ? '~' : '.'))
          .join(' '),
    );
  }
  return lines.length
    ? lines.join('\n')
    : 'No gamepads. Press a button on the pad: browsers only expose a pad after input.';
}

/**
 * Adds a read-only panel listing every pad when the URL has `?debug`.
 * Returns the per-frame update function, or null without `?debug`. The panel
 * ignores pointer input so it never blocks the game.
 */
export function installPadDebugPanel(
  search: string,
  read: () => readonly (PadLike | null)[],
  active: () => number | null,
): (() => void) | null {
  if (!new URLSearchParams(search).has('debug')) {
    return null;
  }
  const el = document.createElement('pre');
  el.id = 'padDebug';
  el.style.cssText =
    'position:fixed;left:6px;bottom:6px;margin:0;padding:6px 8px;max-width:calc(100% - 12px);' +
    'overflow:hidden;font:11px/1.3 monospace;color:#e8ffe8;background:rgba(0,0,0,.6);' +
    'border-radius:6px;pointer-events:none;z-index:20;white-space:pre-wrap';
  document.body.appendChild(el);
  let last = '';
  return () => {
    const text = 'gamepads\n' + formatPads(read(), active());
    if (text !== last) {
      last = text;
      el.textContent = text;
    }
  };
}
