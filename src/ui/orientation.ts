/** "Rotate for the best view" hint: shown on small portrait screens, dismissible, never blocks play. */

/** Widest portrait viewport (CSS px) that still counts as a small phone. */
export const SMALL_PHONE_MAX_WIDTH = 600;

export function shouldShowRotateHint(width: number, height: number, dismissed: boolean): boolean {
  return !dismissed && height > width && width <= SMALL_PHONE_MAX_WIDTH;
}

/** Wires the hint element; the dismissal lasts until the page reloads. */
export class RotateHint {
  private dismissed = false;

  constructor(
    private readonly el: HTMLElement,
    dismissButton: HTMLElement,
  ) {
    dismissButton.addEventListener('click', () => {
      this.dismissed = true;
      this.el.style.display = 'none';
    });
  }

  update(width: number, height: number): void {
    this.el.style.display = shouldShowRotateHint(width, height, this.dismissed) ? 'flex' : 'none';
  }
}
