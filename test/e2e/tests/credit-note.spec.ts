import { test, expect } from '../helpers/test';
import { localOnly, openWithFixture, saveXml, xmlTexts, readTotals, getField, setField } from '../helpers/app';

localOnly(test);

test.describe('nota de credit 381 si stornare', () => {
  test('incarcare 381: tip, referinta la factura initiala si totaluri', async ({ page }) => {
    await openWithFixture(page, 'nota-credit-381.xml');
    expect(await getField(page, 'invoiceTypeCode')).toBe('381');
    expect(await getField(page, 'invoiceNumber')).toBe('TST 0003');
    expect(await getField(page, 'billingRefId')).toBe('TST 0001');
    expect(await getField(page, 'billingRefDate')).toBe('10.03.2026');
    expect((await readTotals(page)).total).toBeCloseTo(297.5, 2);
  });

  test('round-trip 381: se pastreaza tipul si BillingReference in XML', async ({ page }) => {
    await openWithFixture(page, 'nota-credit-381.xml');
    const { xml, alerts } = await saveXml(page);
    expect(alerts).toEqual([]);
    expect(await xmlTexts(page, xml, 'CreditNote > CreditNoteTypeCode')).toEqual(['381']);
    expect(await xmlTexts(page, xml, 'BillingReference > InvoiceDocumentReference > ID')).toEqual(['TST 0001']);
    expect(await xmlTexts(page, xml, 'BillingReference > InvoiceDocumentReference > IssueDate')).toEqual(['2026-03-10']);
  });

  test('schimbarea tipului in 384 / 389 se scrie in XML', async ({ page }) => {
    await openWithFixture(page, 'nota-credit-381.xml');
    for (const code of ['384', '389']) {
      await page.selectOption('[name="invoiceTypeCode"]', code);
      const { xml } = await saveXml(page);
      expect(await xmlTexts(page, xml, 'Invoice > InvoiceTypeCode')).toEqual([code]);
    }
  });

  test('stornare: tip 380, referinta completata, cantitati si totaluri negative', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Stornează' }).click();
    expect(await getField(page, 'invoiceTypeCode')).toBe('380');
    expect(await getField(page, 'billingRefId')).toBe('TST 0001');
    expect(await getField(page, 'billingRefDate')).toBe('10.03.2026');
    expect(parseFloat(await getField(page, 'quantity0'))).toBe(-2);
    expect(parseFloat(await getField(page, 'quantity1'))).toBe(-1);
    // pretul ramane pozitiv (BR-27)
    expect(parseFloat(await getField(page, 'price0'))).toBe(100);
    const t = await readTotals(page);
    expect(t.subtotal).toBe(-250);
    expect(t.vat).toBeCloseTo(-47.5, 2);
    expect(t.total).toBeCloseTo(-297.5, 2);
  });

  test('stornare + salvare: XML 380 (Invoice), cantitati negative, BillingReference si total negativ', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Stornează' }).click();
    const { xml, alerts } = await saveXml(page);
    expect(alerts).toEqual([]);
    expect(await xmlTexts(page, xml, 'Invoice > InvoiceTypeCode')).toEqual(['380']);
    expect(await xmlTexts(page, xml, 'BillingReference > InvoiceDocumentReference > ID')).toEqual(['TST 0001']);
    const qty = (await xmlTexts(page, xml, 'InvoiceLine > InvoicedQuantity')).map(parseFloat);
    expect(qty).toEqual([-2, -1]);
    expect((await xmlTexts(page, xml, 'InvoiceLine > Price > PriceAmount')).map(parseFloat)).toEqual([100, 50]);
    expect(parseFloat((await xmlTexts(page, xml, 'LegalMonetaryTotal > PayableAmount'))[0])).toBeCloseTo(-297.5, 2);
    expect((await xmlTexts(page, xml, 'TaxSubtotal > TaxableAmount')).map(parseFloat)).toEqual([-200, -50]);
  });

  test('stornarea nu suprascrie o referinta deja completata', async ({ page }) => {
    await openWithFixture(page);
    await setField(page, 'billingRefId', 'FACT-ORIG-9');
    await page.getByRole('button', { name: 'Stornează' }).click();
    expect(await getField(page, 'billingRefId')).toBe('FACT-ORIG-9');
  });

  test('stornare cu reducere globala: suma reducerii devine negativa', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Adaugă Reducere/Taxă' }).click();
    await page.selectOption('[name="chargeType0"]', 'false');
    await page.selectOption('[name="chargeVatType0"]', 'S');
    await setField(page, 'chargeAmount0', '10');
    await setField(page, 'chargeVatRate0', '21');
    await page.getByRole('button', { name: 'Stornează' }).click();
    expect(parseFloat(await getField(page, 'chargeAmount0'))).toBe(-10);
  });
});
