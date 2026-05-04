import { test, expect } from '@playwright/test';
import * as path from 'path';

const DOCS_DIR = path.resolve(__dirname, '../../../docs');
const FIXTURES = [
  'efactura_cu_BT_descriere2.xml',
  'efactura_mai_multe_cote_TVA_si_cod_bare.xml',
];

for (const fx of FIXTURES) {
  test(`round-trip ${fx}`, async ({ page }, testInfo) => {
    if (testInfo.project.name === 'prod-romfast') {
      test.skip();
      return;
    }

    await page.goto('/');
    await page.locator('#fileInput').setInputFiles(path.join(DOCS_DIR, fx));
    await page.locator('#lineItems .line-item').first().waitFor({ state: 'visible', timeout: 15000 });

    const lineCount = await page.locator('#lineItems .line-item').count();
    expect(lineCount).toBeGreaterThan(0);

    // validateForm() returns false for empty billingRefDate (optional field but
    // validateDateInput returns false for empty string — known validation quirk).
    // Fill it with issueDate so save proceeds without alert blocking download.
    const issueDate = await page.locator('[name="issueDate"]').inputValue();
    const billingRefDate = page.locator('[name="billingRefDate"]');
    if (!await billingRefDate.inputValue()) {
      await billingRefDate.fill(issueDate);
    }

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByText('Salvează XML', { exact: false }).click(),
    ]);
    const savedPath = await download.path();
    expect(savedPath).toBeTruthy();

    // Reload saved XML — verify parse produces same number of line items
    await page.locator('#fileInput').setInputFiles(savedPath!);
    await page.locator('#lineItems .line-item').first().waitFor({ state: 'visible', timeout: 15000 });
    const reloadedCount = await page.locator('#lineItems .line-item').count();
    expect(reloadedCount).toBe(lineCount);
  });
}
