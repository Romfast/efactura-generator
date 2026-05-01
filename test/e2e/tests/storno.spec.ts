import { test, expect } from '@playwright/test';
import * as path from 'path';

const FIXTURE = path.resolve(__dirname, '../../../docs/efactura_cu_BT_descriere2.xml');

test('storno flips quantities and totals', async ({ page }, testInfo) => {
  if (testInfo.project.name === 'prod-romfast') {
    test.skip();
    return;
  }

  await page.goto('/');
  await page.locator('#fileInput').setInputFiles(FIXTURE);
  await page.locator('#basicDetails').waitFor({ state: 'visible', timeout: 15000 });

  // Click Stornează
  await page.getByText('Stornează', { exact: false }).click();

  // Assert quantities are negative
  const qtyInputs = page.locator('input[name*="cantitate"], input[id*="cantitate"]');
  const count = await qtyInputs.count();
  for (let i = 0; i < count; i++) {
    const val = await qtyInputs.nth(i).inputValue();
    const num = parseFloat(val.replace(',', '.'));
    if (!isNaN(num) && num !== 0) {
      expect(num, `Cantitate linia ${i + 1} trebuie să fie negativă`).toBeLessThan(0);
    }
  }

  // Save XML
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Salvează XML', { exact: false }).click(),
  ]);
  const savedPath = await download.path();
  expect(savedPath).toBeTruthy();

  // Reload and verify negative preserved
  await page.locator('#fileInput').setInputFiles(savedPath!);
  await page.locator('#basicDetails').waitFor({ state: 'visible', timeout: 15000 });

  const reloadedQty = page.locator('input[name*="cantitate"], input[id*="cantitate"]');
  const reloadCount = await reloadedQty.count();
  for (let i = 0; i < reloadCount; i++) {
    const val = await reloadedQty.nth(i).inputValue();
    const num = parseFloat(val.replace(',', '.'));
    if (!isNaN(num) && num !== 0) {
      expect(num, `Cantitate linia ${i + 1} trebuie să rămână negativă după reload`).toBeLessThan(0);
    }
  }
});
