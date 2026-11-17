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

test('?seed=123 produces the same world layout on every load', async ({ page }) => {
  const layout = async (url: string): Promise<{ seed: number; layout: unknown }> => {
    await page.goto(url);
    await expect(page.locator('canvas')).toBeVisible();
    const snap = await page.evaluate(snapshot);
    return { seed: snap.seed, layout: snap.layout };
  };
  const first = await layout('./?debug&seed=123');
  const second = await layout('./?debug&seed=123');
  const other = await layout('./?debug&seed=124');
  expect(first.seed).toBe(123);
  expect(second).toEqual(first);
  expect(other.layout).not.toEqual(first.layout);
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

test('M toggles mute and the setting survives a reload', async ({ page }) => {
  await page.goto('./');
  const mute = page.locator('#bMute');
  await expect(mute).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.press('KeyM');
  await expect(mute).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.locator('#bMute')).toHaveAttribute('aria-pressed', 'true');
  // The HUD button is clickable during play (the menu card covers it).
  await page.keyboard.press('Enter');
  await expect(page.locator('#overlay')).toBeHidden();
  await page.locator('#bMute').click();
  await expect(page.locator('#bMute')).toHaveAttribute('aria-pressed', 'false');
});
