import { describe, expect, it } from 'vitest';
import type { PadLike } from '../../src/input/gamepad';
import { formatPads, installPadDebugPanel } from '../../src/ui/pad-debug';

describe('formatPads', () => {
  it('lists each pad with id, mapping, connection, family and raw values', () => {
    const pad: PadLike = {
      index: 1,
      id: '054c-09cc-Sony Wireless Controller',
      mapping: '',
      connected: true,
      axes: [0.5, -1],
      buttons: [{ pressed: true }, { pressed: false, value: 0.4 }, { pressed: false }],
    };
    const text = formatPads([null, pad], 1);
    expect(text).toContain('> #1 054c-09cc-Sony Wireless Controller');
    expect(text).toContain('mapping=(none) connected=true family=playstation');
    expect(text).toContain('axes 0: 0.50 1:-1.00');
    expect(text).toContain('btns 0:# 1:~ 2:.');
  });

  it('marks only the active pad and explains an empty list', () => {
    const p = (index: number): PadLike => ({ index, mapping: 'standard', axes: [], buttons: [] });
    const text = formatPads([p(0), p(1)], 0);
    expect(text).toContain('> #0');
    expect(text).toContain('  #1');
    expect(formatPads([], null)).toContain('No gamepads');
  });

  it('is not installed without ?debug', () => {
    expect(
      installPadDebugPanel(
        '?seed=1',
        () => [],
        () => null,
      ),
    ).toBeNull();
  });
});
