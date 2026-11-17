import { describe, expect, it } from 'vitest';
import { shouldShowRotateHint } from '../../src/ui/orientation';

describe('shouldShowRotateHint', () => {
  it('shows on small portrait screens', () => {
    expect(shouldShowRotateHint(390, 844, false)).toBe(true);
  });

  it('hides in landscape, on large screens and once dismissed', () => {
    expect(shouldShowRotateHint(844, 390, false)).toBe(false);
    expect(shouldShowRotateHint(820, 1180, false)).toBe(false);
    expect(shouldShowRotateHint(390, 844, true)).toBe(false);
  });
});
