import { test, expect } from '@playwright/test';

// Ruleaza paginile de test din browser (test/*.html) si cere 0 esecuri.
for (const pageName of ['regression.html', 'numeric.html', 'fixes.html']) {
  test(`pagina de test ${pageName}: 0 esecuri`, async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'local') {
      test.skip();
      return;
    }
    await page.goto(`/test/${pageName}`);
    await page.waitForFunction(() => (window as any).__testResult !== undefined, null, { timeout: 60000 });
    const res = await page.evaluate(() => (window as any).__testResult as { passed: number; failed: number });
    const failRows = await page.locator('.test-fail').allTextContents();
    expect(res.failed, `Esecuri in ${pageName}:\n${failRows.join('\n')}`).toBe(0);
    expect(res.passed, `${pageName} nu a rulat niciun test`).toBeGreaterThan(0);
  });
}
