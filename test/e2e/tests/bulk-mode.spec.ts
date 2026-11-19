import { test, expect } from '@playwright/test';
import { localOnly, openApp, fx, getField, setField, saveXml, xmlTexts } from '../helpers/app';

localOnly(test);

const TWO = () => [fx('factura-baza.xml'), fx('factura-baza-b.xml')];

async function loadTwo(page: any) {
  await openApp(page);
  await page.locator('#fileInput').setInputFiles(TWO());
  await expect(page.locator('#xml-sidebar .xml-sidebar-item')).toHaveCount(2);
  await page.locator('#lineItems .line-item').first().waitFor();
}

test.describe('mod multi-fisier (sidebar)', () => {
  test('un singur fisier: fara sidebar', async ({ page }) => {
    await openApp(page);
    await page.locator('#fileInput').setInputFiles(fx('factura-baza.xml'));
    await page.locator('#lineItems .line-item').first().waitFor();
    await expect(page.locator('#xml-sidebar')).toHaveCount(0);
  });

  test('doua fisiere: sidebar cu 2 intrari, primul activ si incarcat in formular', async ({ page }) => {
    await loadTwo(page);
    await expect(page.locator('#xml-sidebar .xml-sidebar-header')).toContainText('(2)');
    await expect(page.locator('#xml-sidebar .xml-sidebar-item').first()).toHaveClass(/is-active/);
    await expect(page.locator('#xml-sidebar .xml-sidebar-item-name').first()).toHaveText('factura-baza.xml');
    expect(await getField(page, 'invoiceNumber')).toBe('TST 0001');
    expect(await page.evaluate(() => document.body.classList.contains('has-xml-sidebar'))).toBe(true);
  });

  test('click pe al doilea fisier il incarca in formular', async ({ page }) => {
    await loadTwo(page);
    await page.locator('#xml-sidebar .xml-sidebar-item').nth(1).click();
    await expect(page.locator('#xml-sidebar .xml-sidebar-item').nth(1)).toHaveClass(/is-active/);
    expect(await getField(page, 'invoiceNumber')).toBe('TST 0002');
  });

  test('editarea marcheaza fisierul ca modificat; editarea se pastreaza la comutare', async ({ page }) => {
    await loadTwo(page);
    await expect(page.locator('#xml-sidebar .xml-sidebar-dirty.is-dirty')).toHaveCount(0);
    await page.fill('[name="supplierName"]', 'FURNIZOR MODIFICAT');
    await expect(page.locator('#xml-sidebar .xml-sidebar-item').first().locator('.xml-sidebar-dirty')).toHaveClass(/is-dirty/);
    await page.locator('#xml-sidebar .xml-sidebar-item').nth(1).click();
    expect(await getField(page, 'supplierName')).toBe('FURNIZOR TEST SRL');
    await page.locator('#xml-sidebar .xml-sidebar-item').first().click();
    expect(await getField(page, 'supplierName')).toBe('FURNIZOR MODIFICAT');
  });

  test('saveCurrentFileAndMark curata marcajul de modificat', async ({ page }) => {
    await loadTwo(page);
    await page.fill('[name="supplierName"]', 'ALT NUME');
    await expect(page.locator('#xml-sidebar .xml-sidebar-dirty.is-dirty')).toHaveCount(1);
    await page.evaluate(() => (window as any).saveCurrentFileAndMark());
    await expect(page.locator('#xml-sidebar .xml-sidebar-dirty.is-dirty')).toHaveCount(0);
  });

  test('salvare din al doilea fisier: XML-ul are numarul acelui fisier', async ({ page }) => {
    await loadTwo(page);
    await page.locator('#xml-sidebar .xml-sidebar-item').nth(1).click();
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'Invoice > ID')).toEqual(['TST 0002']);
  });

  test('adaugarea altor fisiere extinde lista fara a schimba fisierul activ', async ({ page }) => {
    await loadTwo(page);
    await page.locator('#fileInput').setInputFiles([fx('nota-credit-381.xml'), fx('factura-scutiri.xml')]);
    await expect(page.locator('#xml-sidebar .xml-sidebar-item')).toHaveCount(4);
    await expect(page.locator('#xml-sidebar .xml-sidebar-item').first()).toHaveClass(/is-active/);
    await page.locator('#xml-sidebar .xml-sidebar-item').nth(2).click();
    expect(await getField(page, 'invoiceTypeCode')).toBe('381');
  });

  test('o factura ramasa cu campuri editate nu pierde editarea dupa comutari repetate', async ({ page }) => {
    await loadTwo(page);
    await setField(page, 'customerName', 'CLIENT SCHIMBAT');
    for (let i = 0; i < 3; i++) {
      await page.locator('#xml-sidebar .xml-sidebar-item').nth(1).click();
      await page.locator('#xml-sidebar .xml-sidebar-item').first().click();
    }
    expect(await getField(page, 'customerName')).toBe('CLIENT SCHIMBAT');
  });
});
