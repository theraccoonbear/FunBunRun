import { expect, test, type Page } from '@playwright/test';

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});

async function overlaps(page: Page, a: string, b: string): Promise<boolean> {
  return page.evaluate(
    ([x, y]) => {
      const r1 = document.querySelector(x as string)?.getBoundingClientRect();
      const r2 = document.querySelector(y as string)?.getBoundingClientRect();
      if (!r1 || !r2) {
        throw new Error('missing element');
      }
      return r1.left < r2.right && r2.left < r1.right && r1.top < r2.bottom && r2.top < r1.bottom;
    },
    [a, b],
  );
}

test('zone hints show on the menu and in the first round, and never block input', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('#touchHints')).toHaveClass(/\bon\b/);
  await expect(page.locator('#hintJoy')).toBeVisible();
  await expect(page.locator('#hintLook')).toBeVisible();

  await page.locator('#go').tap();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#touchHints')).toHaveClass(/\bon\b/);
  await expect(page.locator('#touchHints')).toHaveCSS('pointer-events', 'none');
  await expect(page.locator('#hintJoy')).toBeInViewport();
  await expect(page.locator('#hintLook')).toBeInViewport();
  for (const b of ['#bLick', '#bJump', '#bSniff']) {
    expect(await overlaps(page, '#hintLook', b)).toBe(false);
    expect(await overlaps(page, '#hintJoy', b)).toBe(false);
  }

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#hintJoy')).toBeInViewport();
  await expect(page.locator('#hintLook')).toBeInViewport();
  for (const b of ['#bLick', '#bJump', '#bSniff']) {
    expect(await overlaps(page, '#hintLook', b)).toBe(false);
    expect(await overlaps(page, '#hintJoy', b)).toBe(false);
  }
});

test('zone hints are hidden once onboarding is done', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('funbunrun-rounds', '5'));
  await page.goto('./');
  // Menu still shows them; regular play does not.
  await expect(page.locator('#touchHints')).toHaveClass(/\bon\b/);
  await page.locator('#go').tap();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#touchHints')).not.toHaveClass(/\bon\b/);
  await expect(page.locator('#hintJoy')).toBeHidden();
});
