import { test, expect } from '@playwright/test';

test.describe('smoke', () => {
  test('app loads and version matches', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (
          !text.includes('Pikaday') &&
          !text.includes('favicon.ico') &&
          !/third-party/i.test(text)
        ) {
          errors.push(text);
        }
      }
    });

    await page.goto('/');

    // Version in footer
    const version = await page.locator('#app-version').textContent();
    expect(version).toMatch(/v\d+\.\d+-beta-\d+/);

    // Form visible
    await expect(page.locator('#invoiceForm, #INVOICE_FORM, form')).toBeVisible();

    // Key buttons
    await expect(page.getByText('Salvează XML', { exact: false })).toBeVisible();
    await expect(page.getByText('Stornează', { exact: false })).toBeVisible();
    await expect(page.getByText('Adaugă Articol', { exact: false })).toBeVisible();

    // No unexpected console errors
    expect(errors, `Console errors: ${errors.join('; ')}`).toHaveLength(0);
  });

  test('ANAF buttons hidden on prod-romfast', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'prod-romfast') {
      test.skip();
      return;
    }
    await page.goto('/');
    await expect(page.locator('#btnValidateAnaf')).toBeHidden();
    const anafBtns = page.locator('.anaf-cif-btn');
    for (const btn of await anafBtns.all()) {
      await expect(btn).toBeHidden();
    }
  });
});
