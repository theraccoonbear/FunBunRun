import { expect, test } from '@playwright/test';

test('loads, renders a canvas and starts a round without page errors', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));

  await page.goto('./');

  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#overlay')).toBeVisible();

  await page.locator('#go').click();

  await expect(page.locator('#overlay')).toBeHidden();
  // Game state is private to an IIFE; the HUD clock counting down shows the round is running.
  await expect(page.locator('#tTime')).not.toHaveText('1:30');
  // Let a few frames run so runtime errors in the game loop surface.
  await page.waitForTimeout(1000);

  expect(errors).toEqual([]);
});
