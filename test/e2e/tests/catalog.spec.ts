import { test, expect } from '@playwright/test';
import { localOnly, openWithFixture, getField, setField } from '../helpers/app';

localOnly(test);

const catalogList = (page: any) => page.evaluate(async () => {
  const m = await import('/js/catalog.js');
  return await m.catalogList();
});

test.describe('catalog local de produse (IndexedDB)', () => {
  test('"Salveaza in catalog": produsul apare in IndexedDB cu valorile liniei', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('.line-item').first().getByRole('button', { name: /Detalii Suplimentare/ }).click();
    await page.fill('[name="itemDescription0"]', 'Descriere catalog alfa');
    await page.locator('.line-item').first().getByRole('button', { name: 'Salvează în catalog' }).click();
    await expect(page.locator('.toast-success')).toContainText('salvat în catalog');
    const items = await catalogList(page);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: 'Produs Alfa', unit: 'H87', price: '100.0000', vatType: 'S', description: 'Descriere catalog alfa',
    });
    expect(parseFloat(items[0].vatRate)).toBe(21);
  });

  test('linie fara denumire: avertisment, nimic salvat', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Adaugă Articol' }).click();
    await page.evaluate(() => (window as any).saveLineToLocalCatalog(2));
    await expect(page.locator('.toast-warning')).toContainText('denumire');
    expect(await catalogList(page)).toHaveLength(0);
  });

  test('salvarea aceluiasi produs de doua ori nu strica catalogul', async ({ page }) => {
    await openWithFixture(page);
    await page.evaluate(() => (window as any).saveLineToLocalCatalog(1));
    await page.evaluate(() => (window as any).saveLineToLocalCatalog(1));
    await expect.poll(async () => (await catalogList(page)).length).toBeGreaterThan(0);
    const names = (await catalogList(page)).map((i: any) => i.name);
    expect(names.every((n: string) => n === 'Produs Beta')).toBe(true);
  });

  test('autocomplete: prefix in Denumire arata sugestii; click aplica produsul pe linie', async ({ page }) => {
    await openWithFixture(page);
    await page.evaluate(async () => {
      const m = await import('/js/catalog.js');
      await m.catalogAdd({ name: 'Servicii consultanta', unit: 'KGM', price: '150', vatType: 'S', vatRate: '11', description: 'Ora de consultanta' });
      await m.catalogAdd({ name: 'Servicii mentenanta', unit: 'EA', price: '80', vatType: 'S', vatRate: '21' });
      await m.catalogAdd({ name: 'Altceva', unit: 'EA', price: '1', vatType: 'S', vatRate: '21' });
    });
    await page.getByRole('button', { name: 'Adaugă Articol' }).click();
    const desc = page.locator('[name="description2"]');
    await desc.click();
    await desc.pressSequentially('Serv');
    const items = page.locator('.catalog-dropdown .catalog-dropdown-item');
    await expect(items).toHaveCount(2);
    await expect(items.first().locator('.catalog-item-name')).toHaveText('Servicii consultanta');

    await items.first().dispatchEvent('mousedown');
    expect(await getField(page, 'description2')).toBe('Servicii consultanta');
    expect(await getField(page, 'unit2')).toBe('KGM');
    expect(parseFloat(await getField(page, 'price2'))).toBe(150);
    expect(parseFloat(await getField(page, 'vatRate2'))).toBe(11);
    expect(await getField(page, 'itemDescription2')).toBe('Ora de consultanta');
    await expect(page.locator('.catalog-dropdown')).toHaveCount(0);
  });

  // BUG: script.js:5162 _applyCatalogItem seteaza select-ul UM cu o valoare absenta din UNIT_CODES (ex. HUR) -> select ramane gol
  test('BUG: unitatea din catalog care nu e in lista UM se pastreaza', async ({ page }) => {
    test.fail(true, 'BUG: _applyCatalogItem (script.js:5162) lasa select-ul UM gol pentru coduri necunoscute (HUR)');
    await openWithFixture(page);
    await page.evaluate(async () => {
      const m = await import('/js/catalog.js');
      await m.catalogAdd({ name: 'Ore consultanta', unit: 'HUR', price: '150', vatType: 'S', vatRate: '21' });
    });
    await page.getByRole('button', { name: 'Adaugă Articol' }).click();
    await page.locator('[name="description2"]').pressSequentially('Ore');
    await page.locator('.catalog-dropdown-item').first().dispatchEvent('mousedown');
    expect(await getField(page, 'unit2')).toBe('HUR');
  });

  test('autocomplete: sub 2 caractere nu apare dropdown; fara potrivire apare mesaj gol', async ({ page }) => {
    await openWithFixture(page);
    await page.evaluate(async () => {
      const m = await import('/js/catalog.js');
      await m.catalogAdd({ name: 'Marfa test', unit: 'EA', price: '5', vatType: 'S', vatRate: '21' });
    });
    await page.getByRole('button', { name: 'Adaugă Articol' }).click();
    const desc = page.locator('[name="description2"]');
    await desc.click();
    await desc.pressSequentially('M');
    await page.waitForTimeout(500);
    await expect(page.locator('.catalog-dropdown')).toHaveCount(0);
    await desc.pressSequentially('zz');
    await expect(page.locator('.catalog-dropdown .catalog-item-empty')).toBeVisible();
  });

  test('Escape inchide dropdown-ul de sugestii', async ({ page }) => {
    await openWithFixture(page);
    await page.evaluate(async () => {
      const m = await import('/js/catalog.js');
      await m.catalogAdd({ name: 'Marfa test', unit: 'EA', price: '5', vatType: 'S', vatRate: '21' });
    });
    await page.getByRole('button', { name: 'Adaugă Articol' }).click();
    const desc = page.locator('[name="description2"]');
    await desc.click();
    await desc.pressSequentially('Mar');
    await expect(page.locator('.catalog-dropdown')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.catalog-dropdown')).toHaveCount(0);
  });

  test('catalogul supravietuieste reincarcarii; produs aplicat intra in totaluri', async ({ page }) => {
    await openWithFixture(page);
    await page.evaluate(() => (window as any).saveLineToLocalCatalog(0));
    await expect.poll(async () => (await catalogList(page)).length).toBe(1);
    await page.reload();
    await page.waitForFunction(() => typeof (window as any).addLineItem === 'function');
    expect(await catalogList(page)).toHaveLength(1);
    await page.getByRole('button', { name: 'Adaugă Articol' }).click();
    await setField(page, 'description0', 'Produs');
    await page.locator('[name="description0"]').click();
    await page.locator('[name="description0"]').pressSequentially(' A');
    await page.locator('.catalog-dropdown-item').first().dispatchEvent('mousedown');
    expect(parseFloat(await getField(page, 'price0'))).toBe(100);
    expect(await getField(page, 'description0')).toBe('Produs Alfa');
  });
});
