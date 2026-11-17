import { describe, expect, it } from 'vitest';
import { loadRounds, memoryStore, saveRounds } from '../../src/platform/storage';
import { TouchHints, touchHintsVisible, type HintState } from '../../src/ui/touch-hints';

const base: HintState = { touch: true, playing: true, roundsDone: 0, onboardingRounds: 2 };

describe('touchHintsVisible', () => {
  it('shows during the onboarding rounds and hides afterwards in play', () => {
    expect(touchHintsVisible(base)).toBe(true);
    expect(touchHintsVisible({ ...base, roundsDone: 1 })).toBe(true);
    expect(touchHintsVisible({ ...base, roundsDone: 2 })).toBe(false);
    expect(touchHintsVisible({ ...base, roundsDone: 50 })).toBe(false);
  });

  it('always shows on the menu and pause when touch is in use', () => {
    expect(touchHintsVisible({ ...base, playing: false, roundsDone: 50 })).toBe(true);
  });

  it('never shows when touch is not the last-used device', () => {
    expect(touchHintsVisible({ ...base, touch: false })).toBe(false);
    expect(touchHintsVisible({ ...base, touch: false, playing: false })).toBe(false);
  });
});

describe('TouchHints', () => {
  it('toggles classes on the container', () => {
    const set = new Set<string>();
    const el = {
      classList: {
        toggle: (c: string, on: boolean) => (on ? set.add(c) : set.delete(c)),
      },
    } as unknown as HTMLElement;
    const hints = new TouchHints(el);
    hints.setVisible(true);
    hints.setActive(true, false);
    expect([...set].sort()).toEqual(['joy-live', 'on']);
    hints.setVisible(false);
    hints.setActive(false, true);
    expect([...set].sort()).toEqual(['look-live']);
  });
});

describe('rounds counter storage', () => {
  it('round-trips and reads garbage as 0', () => {
    const s = memoryStore();
    expect(loadRounds(s)).toBe(0);
    saveRounds(s, 3);
    expect(loadRounds(s)).toBe(3);
    expect(loadRounds(memoryStore({ 'funbunrun-rounds': 'x' }))).toBe(0);
    expect(loadRounds(memoryStore({ 'funbunrun-rounds': '-4' }))).toBe(0);
  });
});
