import { test, expect } from '../helpers/test';
import { localOnly, openWithFixture, saveXml, xmlQuery, xmlTexts, setField, readTotals } from '../helpers/app';

localOnly(test);

test.describe('moneda factura si curs valutar', () => {
  test('EUR: currencyID EUR pe toate sumele din XML, DocumentCurrencyCode EUR', async ({ page }) => {
    await openWithFixture(page);
    await setField(page, 'documentCurrencyCode', 'EUR');
    const { xml, alerts } = await saveXml(page);
    expect(alerts).toEqual([]);
    expect(await xmlTexts(page, xml, 'Invoice > DocumentCurrencyCode')).toEqual(['EUR']);
    const amounts = [
      'LegalMonetaryTotal > PayableAmount', 'LegalMonetaryTotal > TaxExclusiveAmount',
      'TaxTotal > TaxAmount', 'TaxSubtotal > TaxableAmount', 'InvoiceLine > LineExtensionAmount', 'Price > PriceAmount',
    ];
    for (const sel of amounts) {
      const nodes = await xmlQuery(page, xml, sel);
      expect(nodes.length, sel).toBeGreaterThan(0);
      for (const n of nodes) expect(n.attrs.currencyID, sel).toBe('EUR');
    }
    // suma nu se schimba doar pentru ca s-a schimbat moneda
    expect(await xmlTexts(page, xml, 'LegalMonetaryTotal > PayableAmount')).toEqual(['297.50']);
  });

  test('minusculele din moneda se scriu cu majuscule in XML', async ({ page }) => {
    await openWithFixture(page);
    await setField(page, 'documentCurrencyCode', 'usd');
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'Invoice > DocumentCurrencyCode')).toEqual(['USD']);
  });

  test('moneda TVA diferita: apare campul curs valutar, dispare cand monedele coincid', async ({ page }) => {
    await openWithFixture(page);
    await expect(page.locator('#exchangeRateContainer')).toHaveCount(0);
    await setField(page, 'documentCurrencyCode', 'EUR');
    await setField(page, 'taxCurrencyCode', 'RON');
    await expect(page.locator('#exchangeRateContainer')).toBeVisible();
    await expect(page.locator('#exchangeRateContainer label')).toContainText('EUR/RON');
    await setField(page, 'taxCurrencyCode', 'EUR');
    await expect(page.locator('#exchangeRateContainer')).toHaveCount(0);
    await setField(page, 'taxCurrencyCode', '');
    await expect(page.locator('#exchangeRateContainer')).toHaveCount(0);
  });

  test('curs 5 EUR->RON: al doilea TaxTotal in RON = TVA x curs', async ({ page }) => {
    await openWithFixture(page);
    await setField(page, 'documentCurrencyCode', 'EUR');
    await setField(page, 'taxCurrencyCode', 'RON');
    await setField(page, 'exchangeRate', '5');
    const { xml, alerts } = await saveXml(page);
    expect(alerts).toEqual([]);
    const taxTotals = await xmlQuery(page, xml, 'Invoice > TaxTotal > TaxAmount');
    expect(taxTotals.map(n => n.attrs.currencyID)).toEqual(['EUR', 'RON']);
    expect(taxTotals[0].text).toBe('47.50');
    expect(taxTotals[1].text).toBe('237.50');
    expect(await xmlTexts(page, xml, 'Invoice > TaxCurrencyCode')).toEqual(['RON']);
  });

  test('curs 0 sau gol blocheaza salvarea cu alerta de campuri obligatorii', async ({ page }) => {
    await openWithFixture(page);
    await setField(page, 'documentCurrencyCode', 'EUR');
    await setField(page, 'taxCurrencyCode', 'RON');
    await setField(page, 'exchangeRate', '0');
    const alerts: string[] = [];
    page.on('dialog', async d => { alerts.push(d.message()); await d.dismiss(); });
    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.getByRole('button', { name: 'Salvează XML' }).click();
    await page.waitForTimeout(500);
    expect(downloaded).toBe(false);
    expect(alerts.join('|')).toMatch(/câmpurile obligatorii/);
    await expect(page.locator('[name="exchangeRate"]')).toHaveClass(/invalid/);
  });

  test('schimbarea monedei nu schimba totalurile afisate', async ({ page }) => {
    await openWithFixture(page);
    const before = await readTotals(page);
    await setField(page, 'documentCurrencyCode', 'EUR');
    expect(await readTotals(page)).toEqual(before);
  });
});
