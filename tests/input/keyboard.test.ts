import { describe, expect, it, vi } from 'vitest';
import { Actions } from '../../src/input/actions';
import { Keyboard } from '../../src/input/keyboard';

function setup(playing: boolean) {
  const onStart = vi.fn();
  const onPause = vi.fn();
  const kb = new Keyboard(new Actions(), { onStart, isPlaying: () => playing, onPause });
  return { kb, onStart, onPause };
}

describe('Keyboard', () => {
  it('reports Esc and P to the pause hook once per press', () => {
    const { kb, onPause } = setup(true);
    kb.down('Escape');
    kb.down('Escape');
    kb.up('Escape');
    kb.down('KeyP');
    expect(onPause.mock.calls).toEqual([['Escape'], ['KeyP']]);
  });

  it('Enter outside play calls onStart and suppresses the default (no double button click)', () => {
    const menu = setup(false);
    expect(menu.kb.down('Enter')).toBe(true);
    expect(menu.onStart).toHaveBeenCalledOnce();
    const play = setup(true);
    expect(play.kb.down('Enter')).toBe(false);
    expect(play.onStart).not.toHaveBeenCalled();
  });
});
