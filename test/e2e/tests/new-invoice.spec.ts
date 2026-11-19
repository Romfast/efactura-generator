import { test, expect } from '../helpers/test';
import { localOnly, openApp, openWithFixture, getField, saveXml, xmlTexts } from '../helpers/app';

localOnly(test);

const SEQ_KEY = 'efactura.sequence.v1';
const readSeq = (page: any) => page.evaluate((k: string) => JSON.parse(localStorage.getItem(k) || 'null'), SEQ_KEY);
const year = new Date().getFullYear();

test.describe('factura noua si numerotare automata', () => {
  test('modalul: se deschide cu valorile implicite si previzualizare', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    const modal = page.locator('#modal-new-invoice');
    await expect(modal).toHaveClass(/is-open/);
    await expect(page.locator('#seq-serie')).toHaveValue('RFT');
    await expect(page.locator('#seq-counter')).toHaveValue('1');
    await expect(page.locator('#seq-cifre')).toHaveValue('4');
    await expect(page.locator('#seq-include-an')).toBeChecked();
    await expect(page.locator('#seq-preview')).toHaveText(`RFT ${year}0001`);
  });

  test('previzualizarea urmareste seria, contorul, cifrele si optiunea de an', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await page.fill('#seq-serie', 'abc');
    await page.fill('#seq-counter', '42');
    await expect(page.locator('#seq-preview')).toHaveText(`ABC ${year}0042`);
    await page.fill('#seq-cifre', '6');
    await expect(page.locator('#seq-preview')).toHaveText(`ABC ${year}000042`);
    await page.uncheck('#seq-include-an');
    await expect(page.locator('#seq-preview')).toHaveText('ABC 000042');
  });

  test('genereaza: numarul ajunge in formular, contorul creste, secventa salvata', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await page.fill('#seq-serie', 'tst');
    await page.fill('#seq-counter', '7');
    await page.locator('#btnGenerateInvoice').click();
    await expect(page.locator('#modal-new-invoice')).not.toHaveClass(/is-open/);
    expect(await getField(page, 'invoiceNumber')).toBe(`TST ${year}0007`);
    expect(await getField(page, 'invoiceTypeCode')).toBe('380');
    expect(await getField(page, 'documentCurrencyCode')).toBe('RON');
    const seq = await readSeq(page);
    expect(seq).toMatchObject({ serie: 'TST', contor: 8, an: year, includeAn: true, cifre: 4 });
    await expect(page.locator('.toast-success')).toContainText(`TST ${year}0007`);
  });

  test('a doua factura noua continua de la contorul incrementat', async ({ page }) => {
    await openApp(page);
    for (const expected of ['0001', '0002']) {
      await page.getByRole('button', { name: 'Factură Nouă' }).click();
      await page.locator('#btnGenerateInvoice').click();
      expect(await getField(page, 'invoiceNumber')).toBe(`RFT ${year}${expected}`);
    }
  });

  test('fara an in numar si cu 5 cifre', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await page.uncheck('#seq-include-an');
    await page.fill('#seq-cifre', '5');
    await page.locator('#btnGenerateInvoice').click();
    expect(await getField(page, 'invoiceNumber')).toBe('RFT 00001');
  });

  test('Anulare si Escape inchid modalul fara sa incrementeze contorul', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await page.locator('#btnCloseNewInvoice').click();
    await expect(page.locator('#modal-new-invoice')).not.toHaveClass(/is-open/);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#modal-new-invoice')).not.toHaveClass(/is-open/);
    expect(await readSeq(page)).toBeNull();
  });

  test('factura noua e salvabila dupa completare minima si numarul ajunge in XML', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await page.locator('#btnGenerateInvoice').click();
    await page.fill('[name="supplierName"]', 'FURNIZOR TEST SRL');
    await page.fill('[name="supplierVAT"]', 'RO76543210');
    await page.fill('[name="customerName"]', 'CLIENT TEST SRL');
    await page.getByRole('button', { name: 'Adaugă Articol' }).click();
    await page.fill('[name="description0"]', 'Serviciu');
    await page.fill('[name="price0"]', '100');
    await page.locator('[name="price0"]').blur();
    // dueDate poate ramane gol la factura noua: il completam daca e cazul
    if (!(await getField(page, 'dueDate'))) await page.fill('[name="dueDate"]', '30.12.2099');
    const { xml, alerts } = await saveXml(page);
    expect(alerts).toEqual([]);
    expect(await xmlTexts(page, xml, 'Invoice > ID')).toEqual([`RFT ${year}0001`]);
    expect(await xmlTexts(page, xml, 'InvoiceLine > Item > Name')).toEqual(['Serviciu']);
  });

  test('banner de an nou: secventa din anul trecut cere alegere, "Reseteaza la 1" reseteaza contorul', async ({ page }) => {
    await page.addInitScript((k) => {
      localStorage.setItem(k, JSON.stringify({ serie: 'OLD', an: 2020, contor: 57, includeAn: true, cifre: 4 }));
    }, SEQ_KEY);
    await openApp(page);
    const banner = page.locator('#year-rollover-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('OLD');
    await expect(banner).toContainText('57');
    await banner.getByRole('button', { name: 'Resetează la 1' }).click();
    await expect(banner).toHaveCount(0);
    expect(await readSeq(page)).toMatchObject({ serie: 'OLD', an: year, contor: 1 });
  });

  test('banner de an nou: "Continua" pastreaza contorul', async ({ page }) => {
    await page.addInitScript((k) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify({ serie: 'OLD', an: 2020, contor: 57, includeAn: true, cifre: 4 }));
    }, SEQ_KEY);
    await openApp(page);
    await page.locator('#year-rollover-banner').getByRole('button', { name: /Continuă cu 57/ }).click();
    await expect(page.locator('#year-rollover-banner')).toHaveCount(0);
    expect(await readSeq(page)).toMatchObject({ an: year, contor: 57 });
  });

  test('nu apare banner cand secventa e din anul curent', async ({ page }) => {
    await openWithFixture(page);
    await expect(page.locator('#year-rollover-banner')).toHaveCount(0);
  });
});
