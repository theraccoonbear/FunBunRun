import { describe, expect, it } from 'vitest';
import { soundUi } from '../../src/ui/hud';

describe('soundUi', () => {
  it('shows the tap-for-sound hint only when a start left the audio locked and sound is on', () => {
    expect(soundUi(true, false, true).hint).toBe(true);
    expect(soundUi(true, false, false).hint).toBe(false);
    expect(soundUi(false, false, true).hint).toBe(false);
    expect(soundUi(true, true, true).hint).toBe(false);
  });

  it('labels the mute button with its state', () => {
    expect(soundUi(false, false, true)).toMatchObject({ label: 'Sound on (M)', pressed: false });
    expect(soundUi(false, true, true)).toMatchObject({ label: 'Sound off (M)', pressed: true });
  });
});
