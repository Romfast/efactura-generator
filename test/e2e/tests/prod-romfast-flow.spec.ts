import { test, expect } from '@playwright/test';

test('full invoice flow without ANAF — prod-romfast', async ({ page }, testInfo) => {
  if (testInfo.project.name !== 'prod-romfast') {
    test.skip();
    return;
  }

  await page.goto('/');

  // ANAF buttons trebuie să fie ascunse (probeReceiver false pe prod-romfast)
  await expect(page.locator('#btnValidateAnaf')).toBeHidden();
  for (const btn of await page.locator('.anaf-cif-btn').all()) {
    await expect(btn).toBeHidden();
  }

  // Adaugă articol
  await page.getByText('Adaugă Articol', { exact: false }).click();

  // Populează minim pentru XML valid (linii, furnizor, client)
  const lineDesc = page.locator('input[name*="descriere"], input[id*="descriere"], textarea[name*="descriere"]').first();
  if (await lineDesc.count() > 0) {
    await lineDesc.fill('Produs test E2E');
  }

  const qty = page.locator('input[name*="cantitate"], input[id*="cantitate"]').first();
  if (await qty.count() > 0) {
    await qty.fill('1');
  }

  const price = page.locator('input[name*="pret"], input[name*="Pret"], input[id*="pret"]').first();
  if (await price.count() > 0) {
    await price.fill('100');
  }

  // Salvează XML
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.getByText('Salvează XML', { exact: false }).click(),
  ]);
  expect(await download.path()).toBeTruthy();
});
