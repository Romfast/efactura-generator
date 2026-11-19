import { test, expect } from '../helpers/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { localOnly, openWithFixture, openApp, loadXmlFile, saveXml, xmlTexts, getField, readTotals, fx } from '../helpers/app';

localOnly(test);

const CN_NS = 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2';

/** Salveaza XML-ul intr-un fisier temporar si il reincarca in aplicatie (pagina noua). */
async function reload(page: any, xml: string) {
  const tmp = path.join(os.tmpdir(), `efactura-cn-${Date.now()}.xml`);
  fs.writeFileSync(tmp, xml, 'utf8');
  try {
    await openApp(page);
    await loadXmlFile(page, tmp);
  } finally {
    fs.unlinkSync(tmp);
  }
}

test.describe('nota de credit 381 scrisa ca CreditNote', () => {
  test('381 -> radacina CreditNote, linii, cantitati, fara DueDate la radacina', async ({ page }) => {
    await openWithFixture(page, 'nota-credit-381.xml');
    const { xml, alerts } = await saveXml(page);
    expect(alerts).toEqual([]);
    expect(xml).toMatch(/<CreditNote\b/);
    expect(xml).toContain(CN_NS);
    expect(xml).not.toMatch(/<Invoice\b|InvoiceTypeCode|InvoiceLine|InvoicedQuantity/);
    expect(await xmlTexts(page, xml, 'CreditNote > CreditNoteTypeCode')).toEqual(['381']);
    expect(await xmlTexts(page, xml, 'CreditNote > CreditNoteLine')).toHaveLength(2);
    expect((await xmlTexts(page, xml, 'CreditNoteLine > CreditedQuantity')).map(parseFloat)).toEqual([2, 1]);
    expect(await xmlTexts(page, xml, 'CreditNote > DueDate')).toEqual([]);
    expect(await xmlTexts(page, xml, 'PaymentMeans > PaymentDueDate')).toEqual(['2026-04-09']);
    expect(await xmlTexts(page, xml, 'BillingReference > InvoiceDocumentReference > ID')).toEqual(['TST 0001']);
    // ordinea UBL: tip dupa IssueDate, PaymentMeans inainte de TaxTotal, linii dupa LegalMonetaryTotal
    expect(await page.evaluate((x) => Array.from(new DOMParser().parseFromString(x, 'text/xml').documentElement.children)
      .map(e => e.localName).filter(n => ['IssueDate', 'CreditNoteTypeCode', 'PaymentMeans', 'TaxTotal', 'LegalMonetaryTotal', 'CreditNoteLine'].includes(n)).join(','), xml))
      .toBe('IssueDate,CreditNoteTypeCode,PaymentMeans,TaxTotal,LegalMonetaryTotal,CreditNoteLine,CreditNoteLine');
  });

  test('stornare: se scrie Invoice 380 cu cantitati negative (nu CreditNote)', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Stornează' }).click();
    const { xml } = await saveXml(page);
    expect(xml).toMatch(/<Invoice\b/);
    expect(xml).not.toMatch(/<CreditNote\b|CreditNoteTypeCode/);
    expect(await xmlTexts(page, xml, 'Invoice > InvoiceTypeCode')).toEqual(['380']);
    expect((await xmlTexts(page, xml, 'InvoiceLine > InvoicedQuantity')).map(parseFloat)).toEqual([-2, -1]);
    expect((await xmlTexts(page, xml, 'InvoiceLine > Price > PriceAmount')).map(parseFloat)).toEqual([100, 50]);
    expect(await xmlTexts(page, xml, 'BillingReference > InvoiceDocumentReference > ID')).toEqual(['TST 0001']);
  });

  test('380, 384, 389 raman Invoice', async ({ page }) => {
    await openWithFixture(page, 'nota-credit-381.xml');
    for (const code of ['380', '384', '389']) {
      await page.selectOption('[name="invoiceTypeCode"]', code);
      const { xml } = await saveXml(page);
      expect(xml).toMatch(/<Invoice\b/);
      expect(xml).not.toMatch(/<CreditNote\b/);
      expect(await xmlTexts(page, xml, 'Invoice > InvoiceTypeCode')).toEqual([code]);
      expect(await xmlTexts(page, xml, 'Invoice > DueDate')).toEqual(['2026-04-09']);
      expect(await xmlTexts(page, xml, 'InvoiceLine > InvoicedQuantity')).toHaveLength(2);
    }
  });

  test('incarcare CreditNote: antet, linii, cantitati, totaluri, referinta, scadenta', async ({ page }) => {
    await openWithFixture(page, 'nota-credit-creditnote.xml');
    expect(await getField(page, 'invoiceTypeCode')).toBe('381');
    expect(await getField(page, 'invoiceNumber')).toBe('TST 0004');
    expect(await getField(page, 'billingRefId')).toBe('TST 0001');
    expect(await getField(page, 'dueDate')).toBe('09.04.2026');
    await expect(page.locator('#lineItems .line-item')).toHaveCount(2);
    expect(parseFloat(await getField(page, 'quantity0'))).toBe(2);
    expect(parseFloat(await getField(page, 'quantity1'))).toBe(1);
    expect((await readTotals(page)).total).toBeCloseTo(297.5, 2);
  });

  test('round-trip CreditNote: salvare, reincarcare, salvare = XML identic', async ({ page }) => {
    await openWithFixture(page, 'nota-credit-creditnote.xml');
    const first = (await saveXml(page)).xml;
    expect(first).toMatch(/<CreditNote\b/);
    await reload(page, first);
    const second = (await saveXml(page)).xml;
    expect(second).toBe(first);
    expect(await xmlTexts(page, second, 'PaymentMeans > PaymentDueDate')).toEqual(['2026-04-09']);
    expect(await xmlTexts(page, second, 'CreditNote > CreditNoteLine')).toHaveLength(2);
  });

  test('Invoice vechi cu 381 se incarca si se salveaza ca CreditNote', async ({ page }) => {
    await openWithFixture(page, 'nota-credit-381.xml');
    expect(await getField(page, 'invoiceTypeCode')).toBe('381');
    expect(await getField(page, 'dueDate')).toBe('09.04.2026');
    const a = (await saveXml(page)).xml;
    await openWithFixture(page, 'nota-credit-creditnote.xml');
    const b = (await saveXml(page)).xml;
    // aceeasi nota (alt numar): restul documentului e identic
    expect(a.replace('TST 0003', 'TST 0004')).toBe(b);
  });
});

test.describe('nota de credit 381: scadenta fara modalitate de plata', () => {
  const warn = (page: any) => page.locator('#br-panel-body .br-panel__item-code', { hasText: 'BR-CN-DUE' });

  test('avertisment in panou, toast la salvare, fara PaymentDueDate; dispare cu plata sau cu alt tip', async ({ page }) => {
    await openWithFixture(page, 'nota-credit-381.xml');
    await expect(warn(page)).toHaveCount(0);
    await page.locator('.payment-means-row button').first().click();
    await expect(warn(page)).toHaveCount(1);
    await expect(page.locator('#br-panel-body')).toContainText('modalitate de plată');
    const { xml } = await saveXml(page);
    await expect(page.locator('.toast-warning')).toContainText('scadenței nu a fost scrisă');
    expect(await xmlTexts(page, xml, 'PaymentDueDate')).toEqual([]);
    expect(await xmlTexts(page, xml, 'PaymentMeans')).toEqual([]);
    await page.locator('button[onclick="window.addPaymentMeansRow()"]').click();
    await expect(warn(page)).toHaveCount(0);
    await page.locator('.payment-means-row button').first().click();
    await expect(warn(page)).toHaveCount(1);
    await page.selectOption('[name="invoiceTypeCode"]', '380');
    await expect(warn(page)).toHaveCount(0);
  });
});
