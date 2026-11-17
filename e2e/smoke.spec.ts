import { expect, test, type Page } from '@playwright/test';

async function startRound(page: Page, path: string): Promise<Error[]> {
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));

  await page.goto(path);

  await expect(page.locator('canvas')).toBeVisible();
  await expect(page.locator('#overlay')).toBeVisible();

  await page.locator('#go').click();

  await expect(page.locator('#overlay')).toBeHidden();
  // The HUD clock counting down shows the round is running.
  await expect(page.locator('#tTime')).not.toHaveText('1:30');
  // Let a few frames run so runtime errors in the game loop surface.
  await page.waitForTimeout(1000);
  return errors;
}

test('loads, renders a canvas and starts a round without page errors', async ({ page }) => {
  const errors = await startRound(page, './');
  expect(errors).toEqual([]);
});

test('the legacy prototype is served at /legacy/ and starts a round', async ({ page }) => {
  const errors = await startRound(page, './legacy/');
  expect(errors).toEqual([]);
});
