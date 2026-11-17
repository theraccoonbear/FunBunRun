import { expect, test } from '@playwright/test';

// A desktop-size viewport with a touchscreen: a touchscreen laptop.
test.use({ viewport: { width: 1280, height: 720 }, hasTouch: true });

test('a mouse click on the canvas does not start the joystick', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('canvas')).toBeVisible();
  await page.locator('#go').click();
  await expect(page.locator('#overlay')).toBeHidden();

  await page.mouse.move(300, 300);
  await page.mouse.down();
  await page.mouse.move(340, 320);
  await expect(page.locator('#joyBase')).toBeHidden();
  await page.mouse.up();
  await expect(page.locator('#joyBase')).toBeHidden();
  // Mouse was last used: no touch buttons.
  await expect(page.locator('#bLick')).toBeHidden();
});

test('touch brings the buttons and joystick back, keys hide the buttons again', async ({
  page,
}) => {
  await page.goto('./');
  await page.locator('#go').click();
  await expect(page.locator('#overlay')).toBeHidden();
  await page.mouse.move(400, 300);
  await expect(page.locator('#bLick')).toBeHidden();

  // A finger on the left half shows the live joystick and the touch buttons.
  await page.evaluate(() => {
    const layer = document.getElementById('touch');
    layer?.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 7,
        pointerType: 'touch',
        clientX: 200,
        clientY: 400,
        bubbles: true,
      }),
    );
  });
  await expect(page.locator('#joyBase')).toBeVisible();
  await expect(page.locator('#bLick')).toBeVisible();

  await page.keyboard.press('KeyW');
  await expect(page.locator('#bLick')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-input', 'mouse');
});

test('the start card follows the last-used device', async ({ page }) => {
  await page.goto('./');
  await page.mouse.move(100, 100);
  await expect(page.locator('#card')).toContainText('WASD');
  await page.touchscreen.tap(640, 20);
  await expect(page.locator('#card')).toContainText('Left thumb');
});
