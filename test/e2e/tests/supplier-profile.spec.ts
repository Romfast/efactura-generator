import { test, expect } from '@playwright/test';
import { localOnly, openApp, openWithFixture, getField, setField } from '../helpers/app';

localOnly(test);

const KEY = 'efactura.profil.v1';
const readProfile = (page: any) => page.evaluate((k: string) => {
  const v = localStorage.getItem(k);
  return v ? JSON.parse(v) : null;
}, KEY);

test.describe('profil furnizor (localStorage)', () => {
  test('fara profil: butoanele "Foloseste" si "Sterge" sunt ascunse', async ({ page }) => {
    await openApp(page);
    await expect(page.locator('#btnSaveProfile')).toBeVisible();
    await expect(page.locator('#btnUseProfile')).toBeHidden();
    await expect(page.locator('#btnDeleteProfile')).toBeHidden();
  });

  test('salveaza profil: cheie in localStorage cu campurile furnizorului + toast + butoane vizibile', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('#btnSaveProfile').click();
    const p = await readProfile(page);
    expect(p).toMatchObject({
      supplierName: 'FURNIZOR TEST SRL',
      supplierVAT: 'RO76543210',
      supplierCompanyId: 'J40/1/2020',
      supplierAddress: 'Str. Exemplu 1',
    });
    await expect(page.locator('.toast-success')).toContainText('Profil furnizor salvat');
    await expect(page.locator('#btnUseProfile')).toBeVisible();
    await expect(page.locator('#btnDeleteProfile')).toBeVisible();
  });

  test('foloseste profil: restaureaza campurile furnizorului modificate intre timp', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('#btnSaveProfile').click();
    await setField(page, 'supplierName', 'ALT FURNIZOR');
    await setField(page, 'supplierPhone', '0711111111');
    await page.locator('#btnUseProfile').click();
    expect(await getField(page, 'supplierName')).toBe('FURNIZOR TEST SRL');
    expect(await getField(page, 'supplierPhone')).toBe('0700000001');
    await expect(page.locator('.toast-success').last()).toContainText('Profil furnizor aplicat');
  });

  test('profilul nu atinge campurile clientului', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('#btnSaveProfile').click();
    await setField(page, 'customerName', 'CLIENT NOU');
    await page.locator('#btnUseProfile').click();
    expect(await getField(page, 'customerName')).toBe('CLIENT NOU');
  });

  test('profilul supravietuieste reincarcarii paginii', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('#btnSaveProfile').click();
    await page.reload();
    await page.waitForFunction(() => typeof (window as any).saveXML === 'function');
    await expect(page.locator('#btnUseProfile')).toBeVisible();
    await page.locator('#btnUseProfile').click();
    expect(await getField(page, 'supplierName')).toBe('FURNIZOR TEST SRL');
  });

  test('sterge profil: cheia dispare si butoanele se ascund', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('#btnSaveProfile').click();
    expect(await readProfile(page)).not.toBeNull();
    await page.locator('#btnDeleteProfile').click();
    expect(await readProfile(page)).toBeNull();
    await expect(page.locator('#btnUseProfile')).toBeHidden();
    await expect(page.locator('#btnDeleteProfile')).toBeHidden();
    await expect(page.locator('.toast-info').last()).toContainText('Profil furnizor șters');
  });

  test('profil salvat: factura noua are furnizorul precompletat', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('#btnSaveProfile').click();
    await page.reload();
    await page.waitForFunction(() => typeof (window as any).openNewInvoiceModal === 'function');
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await page.locator('#btnGenerateInvoice').click();
    expect(await getField(page, 'supplierName')).toBe('FURNIZOR TEST SRL');
    expect(await getField(page, 'supplierVAT')).toBe('RO76543210');
  });
});
