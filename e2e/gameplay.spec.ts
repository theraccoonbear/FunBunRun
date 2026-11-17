import { expect, test } from '@playwright/test';
import type { DebugSnapshot } from '../src/debug';

const snapshot = (): DebugSnapshot => {
  const hook = window.__fbr;
  if (!hook) {
    throw new Error('debug hook missing');
  }
  return hook.snapshot();
};

test('the debug hook is only installed with ?debug', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('canvas')).toBeVisible();
  expect(await page.evaluate(() => typeof window.__fbr)).toBe('undefined');
});

test('keyboard input runs and jumps the dog and the leash holds', async ({ page }) => {
  const errors: Error[] = [];
  page.on('pageerror', (err) => errors.push(err));
  await page.goto('./?debug');
  await expect(page.locator('#overlay')).toBeVisible();
  expect((await page.evaluate(snapshot)).phase).toBe('menu');

  await page.keyboard.press('Enter');
  await expect(page.locator('#overlay')).toBeHidden();
  const start = await page.evaluate(snapshot);
  expect(start.phase).toBe('play');

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');

  const after = await page.evaluate(snapshot);
  // Camera yaw 0 looks down -z, so W runs toward -z.
  expect(after.dog.z).toBeLessThan(start.dog.z - 2);
  expect(after.leash.handToCollar).toBeLessThanOrEqual(after.leash.length + 1e-6);
  expect(after.timeLeft).toBeLessThan(start.timeLeft);

  await page.keyboard.press('Space');
  await expect.poll(async () => (await page.evaluate(snapshot)).dog.y).toBeGreaterThan(0.2);

  expect(errors).toEqual([]);
});
