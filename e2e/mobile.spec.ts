import { expect, test, type Page } from '@playwright/test';

// iPhone-like emulation (touch, mobile viewport) on the existing chromium project.
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 3,
});

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

async function expectInViewport(page: Page, selector: string): Promise<void> {
  const box: Box | null = await page.locator(selector).boundingBox();
  const vp = page.viewportSize();
  expect(box, selector).not.toBeNull();
  if (!box || !vp) {
    return;
  }
  expect(box.x, selector).toBeGreaterThanOrEqual(0);
  expect(box.y, selector).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, selector).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height, selector).toBeLessThanOrEqual(vp.height);
}

async function canvasSize(page: Page): Promise<{ w: number; h: number }> {
  return page.evaluate(() => {
    const r = document.querySelector('canvas')?.getBoundingClientRect();
    return { w: Math.round(r?.width ?? 0), h: Math.round(r?.height ?? 0) };
  });
}

const HUD_AND_BUTTONS = ['#tTime', '#tScore', '#tLicks', '#stam', '#bLick', '#bJump', '#bSniff'];

test('HUD and buttons stay inside the viewport in portrait and landscape', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));
  await page.goto('./');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('#go').tap();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#bLick')).toBeVisible();

  expect(await canvasSize(page)).toEqual({ w: 390, h: 844 });
  for (const s of HUD_AND_BUTTONS) {
    await expectInViewport(page, s);
  }

  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(() => canvasSize(page)).toEqual({ w: 844, h: 390 });
  for (const s of HUD_AND_BUTTONS) {
    await expectInViewport(page, s);
  }
  expect(errors).toEqual([]);
});

test('the rotate hint shows in portrait, can be dismissed and does not block play', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('#rotateHint')).toBeVisible();
  await page.locator('#go').tap();
  await expect(page.locator('#overlay')).toBeHidden();
  await expect(page.locator('#rotateHint')).toBeVisible();
  await page.locator('#rotateDismiss').tap();
  await expect(page.locator('#rotateHint')).toBeHidden();

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('#rotateHint')).toBeHidden();
});

test('the start card fits in landscape', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto('./');
  await expect(page.locator('#go')).toBeVisible();
  await page.locator('#go').tap();
  await expect(page.locator('#overlay')).toBeHidden();
});
