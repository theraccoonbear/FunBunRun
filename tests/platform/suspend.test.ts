import { describe, expect, it } from 'vitest';
import { attachSuspendTriggers, type SuspendDocument } from '../../src/platform/suspend';

class FakeDoc extends EventTarget implements SuspendDocument {
  visibilityState: DocumentVisibilityState = 'visible';
  pointerLockElement: Element | null = null;
}

function setup(initiallyLocked = false) {
  const win = new EventTarget();
  const doc = new FakeDoc();
  const canvas = {} as Element;
  if (initiallyLocked) {
    doc.pointerLockElement = canvas;
  }
  const seen: [string, boolean | undefined][] = [];
  attachSuspendTriggers(win, doc, canvas, (reason, wasLocked) => seen.push([reason, wasLocked]));
  return { win, doc, canvas, seen };
}

describe('attachSuspendTriggers', () => {
  it('fires on the page becoming hidden, not visible', () => {
    const { doc, seen } = setup();
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    doc.visibilityState = 'visible';
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(seen).toEqual([['hidden', undefined]]);
  });

  it('fires on window blur and gamepad disconnect', () => {
    const { win, seen } = setup();
    win.dispatchEvent(new Event('blur'));
    win.dispatchEvent(new Event('gamepaddisconnected'));
    win.dispatchEvent(new Event('gamepadconnected'));
    expect(seen.map((s) => s[0])).toEqual(['blur', 'disconnect']);
  });

  it('fires when the pointer lock on the canvas is released, not when it is taken', () => {
    const { doc, canvas, seen } = setup();
    doc.pointerLockElement = canvas;
    doc.dispatchEvent(new Event('pointerlockchange'));
    expect(seen).toEqual([]);
    doc.pointerLockElement = null;
    doc.dispatchEvent(new Event('pointerlockchange'));
    expect(seen).toEqual([['pointerlock', true]]);
    // A second change without a lock does not fire again.
    doc.dispatchEvent(new Event('pointerlockchange'));
    expect(seen).toHaveLength(1);
  });

  it('knows about a lock that was already held when attached', () => {
    const { doc, seen } = setup(true);
    doc.pointerLockElement = null;
    doc.dispatchEvent(new Event('pointerlockchange'));
    expect(seen).toEqual([['pointerlock', true]]);
  });
});
