import { test, expect } from '../helpers/test';
import {
  localOnly, openApp, fillHeader, fillParty, fillLine, addLine, saveXml, xmlTexts, getField, readTotals, setField,
} from '../helpers/ui';

localOnly(test);

const lines = (page: any) => page.locator('#lineItems .line-item');

async function newInvoice(page: any, supplierVat?: string) {
  await openApp(page);
  if (supplierVat !== undefined) {
    await page.evaluate((v: string) => localStorage.setItem('efactura.profil.v1', JSON.stringify({ supplierVAT: v })), supplierVat);
  }
  await page.getByRole('button', { name: 'Factură Nouă' }).click();
  await page.locator('#btnGenerateInvoice').click();
  await expect(page.locator('#modal-new-invoice')).not.toHaveClass(/is-open/);
}

async function fillAll(page: any) {
  await fillHeader(page, { dueDate: '31.12.2030' });
  await fillParty(page, 'supplier');
  await fillParty(page, 'customer');
}

test.describe('factura noua cu un rand gol', () => {
  test('la incarcarea aplicatiei: exact un rand gol, fara RO -> O / 0%', async ({ page }) => {
    await openApp(page);
    await expect(lines(page)).toHaveCount(1);
    expect(await getField(page, 'description0')).toBe('');
    expect(await getField(page, 'vatType0')).toBe('O');
    expect(parseFloat(await getField(page, 'vatRate0'))).toBe(0);
    expect(parseFloat(await getField(page, 'price0'))).toBe(0);
  });

  test('Factura Noua cu furnizor fara RO (profil): un rand gol, O / 0%', async ({ page }) => {
    await newInvoice(page, '12345674');
    await expect(lines(page)).toHaveCount(1);
    expect(await getField(page, 'vatType0')).toBe('O');
    expect(parseFloat(await getField(page, 'vatRate0'))).toBe(0);
  });

  test('Factura Noua cu furnizor RO (implicit): un rand gol, S / 21%', async ({ page }) => {
    await newInvoice(page);
    await expect(lines(page)).toHaveCount(1);
    expect(await getField(page, 'vatType0')).toBe('S');
    expect(parseFloat(await getField(page, 'vatRate0'))).toBe(21);
  });

  test('incarcarea unui XML inlocuieste liniile, fara rand gol in plus', async ({ page }) => {
    await openApp(page);
    await page.locator('#fileInput').setInputFiles(require('path').resolve(__dirname, '../fixtures/factura-baza.xml'));
    await expect(lines(page)).toHaveCount(2);
  });
});

test.describe('rand complet gol ignorat la salvare', () => {
  test('o linie completata + una goala: XML cu 1 InvoiceLine, totaluri corecte, toast, randul ramane in formular', async ({ page }) => {
    await newInvoice(page, 'RO12345674');
    await fillAll(page);
    await fillLine(page, 0, { description: 'Serviciu test', quantity: '2', price: '100', vatRate: '21' });
    await addLine(page);
    await expect(lines(page)).toHaveCount(2);
    const { xml, alerts } = await saveXml(page);
    expect(alerts).toEqual([]);
    expect(await xmlTexts(page, xml, 'Invoice > InvoiceLine')).toHaveLength(1);
    expect(await xmlTexts(page, xml, 'InvoiceLine > InvoicedQuantity')).toEqual(['2.000']);
    expect(await xmlTexts(page, xml, 'LegalMonetaryTotal > LineExtensionAmount')).toEqual(['200.00']);
    expect(await xmlTexts(page, xml, 'LegalMonetaryTotal > PayableAmount')).toEqual(['242.00']);
    expect(await xmlTexts(page, xml, 'TaxTotal > TaxAmount')).toEqual(['42.00']);
    expect(await xmlTexts(page, xml, 'TaxTotal > TaxSubtotal')).toHaveLength(1);
    await expect(page.locator('.toast', { hasText: 'Rândul gol a fost ignorat la salvare' })).toBeVisible();
    // formularul ramane neschimbat: 2 randuri, totaluri neatinse
    await expect(lines(page)).toHaveCount(2);
    expect((await readTotals(page)).total).toBeCloseTo(242, 2);
  });

  test('randul gol pe prima pozitie: ordinea si indexarea liniilor ramân corecte', async ({ page }) => {
    await newInvoice(page, 'RO12345674');
    await fillAll(page);
    const idx = await addLine(page, { description: 'Al doilea', quantity: '1', price: '50', vatRate: '21' });
    expect(idx).toBe(1);
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'InvoiceLine > Item > Name')).toEqual(['Al doilea']);
    expect(await xmlTexts(page, xml, 'InvoiceLine > ID')).toEqual(['1']);
    await expect(lines(page).nth(1).locator('[name^="description"]')).toHaveValue('Al doilea');
    await expect(page.locator('[name="description1"]')).toHaveValue('Al doilea');
  });

  test('linie partial completata (are denumire, pret 0) se pastreaza si ramane validata', async ({ page }) => {
    await newInvoice(page, 'RO12345674');
    await fillAll(page);
    await fillLine(page, 0, { description: 'Doar denumire', quantity: '1', price: '0', vatRate: '21' });
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'Invoice > InvoiceLine')).toHaveLength(1);
    await expect(page.locator('.toast', { hasText: 'Rândul gol' })).toHaveCount(0);
  });

  test('linie cu pret dar fara denumire ramane cerinta de completare (nu se ignora)', async ({ page }) => {
    await newInvoice(page, 'RO12345674');
    await fillAll(page);
    await fillLine(page, 0, { quantity: '1', price: '10', vatRate: '21' });
    const alerts: string[] = [];
    page.on('dialog', async d => { alerts.push(d.message()); await d.dismiss(); });
    await page.getByRole('button', { name: 'Salvează XML' }).click();
    await expect.poll(() => alerts.length).toBeGreaterThan(0);
    await expect(page.locator('[name="description0"]')).toHaveClass(/invalid/);
  });

  test('toate liniile goale: nu se salveaza, BR-16-L apare, randul ramane in formular', async ({ page }) => {
    await newInvoice(page, 'RO12345674');
    await fillAll(page);
    const alerts: string[] = [];
    page.on('dialog', async d => { alerts.push(d.message()); await d.dismiss(); });
    await page.getByRole('button', { name: 'Salvează XML' }).click();
    await expect.poll(() => alerts.length).toBeGreaterThan(0);
    expect(alerts.join(' ')).toContain('cel puțin o linie');
    await expect(lines(page)).toHaveCount(1);
    await page.locator('#br-panel-header').click();
    await expect(page.locator('#br-panel-body .br-panel__item-code', { hasText: 'BR-16-L' })).toHaveCount(1);
  });
});
