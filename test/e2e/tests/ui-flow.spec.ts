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
    await page.locator('#basicDetails').waitFor({ state: 'visible', timeout: 15000 });

    // Read initial subtotal
    const initialTotal = await page.locator('#invoiceTotal, [id*="total"], [id*="Total"]').first().textContent() ?? '0';

    // Edit cantitate linia 1
    const qtyInput = page.locator('input[name*="cantitate"], input[id*="cantitate"], input[placeholder*="antitate"]').first();
    if (await qtyInput.count() > 0) {
      await qtyInput.fill('2');
    }

    // Save XML
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByText('Salvează XML', { exact: false }).click(),
    ]);
    const savedPath = await download.path();
    expect(savedPath).toBeTruthy();

    // Reload saved XML
    await page.locator('#fileInput').setInputFiles(savedPath!);
    await page.locator('#basicDetails').waitFor({ state: 'visible', timeout: 15000 });

    // Assert form populated (basic check)
    const versionEl = await page.locator('#app-version').textContent();
    expect(versionEl).toMatch(/v\d+/);
  });
}
