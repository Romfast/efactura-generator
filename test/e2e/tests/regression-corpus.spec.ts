import { test, expect } from '@playwright/test';

test('regression corpus pass', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'local') {
    test.skip();
    return;
  }

  await page.goto('/test/regression.html');
  await expect(page.locator('#test-banner')).toHaveClass(/banner-pass/, { timeout: 30000 });
  expect(await page.locator('.test-fail').count()).toBe(0);
});
