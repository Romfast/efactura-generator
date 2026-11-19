import { test, expect } from '@playwright/test';
import { localOnly, openWithFixture, saveXml, xmlTexts, readTotals, recalc } from '../helpers/app';

localOnly(test);

/** Randul de defalcare TVA cu tipul dat. */
const rowOfType = async (page: any, type: string) => {
  const types: string[] = await page.locator('.vat-row .vat-type').evaluateAll((s: any[]) => s.map(x => x.value));
  const idx = types.indexOf(type);
  expect(idx, `rand TVA de tip ${type}`).toBeGreaterThanOrEqual(0);
  return page.locator('.vat-row').nth(idx);
};

test.describe('defalcare TVA: incarcare si categorii', () => {
  test('categorii S/Z/E/AE: randuri, coduri de scutire si totaluri', async ({ page }) => {
    await openWithFixture(page, 'factura-scutiri.xml');
    const rows = await page.locator('.vat-row').evaluateAll(rs => rs.map((r: any) => ({
      type: r.querySelector('.vat-type').value,
      code: r.querySelector('.vat-exemption-code').value,
      reason: r.querySelector('.vat-exemption-reason').value,
      hidden: r.querySelector('.vat-exemption').classList.contains('hidden'),
    })));
    expect(rows).toEqual([
      { type: 'S', code: '', reason: '', hidden: true },
      { type: 'Z', code: '', reason: '', hidden: true },
      { type: 'E', code: 'VATEX-EU-F', reason: 'Bunuri second hand', hidden: false },
      { type: 'AE', code: 'VATEX-EU-AE', reason: 'Taxare inversa', hidden: false },
    ]);
    expect(await readTotals(page)).toEqual({ subtotal: 200, allowances: 0, charges: 0, net: 200, vat: 21, total: 221 });
  });

  test('round-trip categorii: ID, Percent si coduri de scutire raman in XML', async ({ page }) => {
    await openWithFixture(page, 'factura-scutiri.xml');
    const { xml, alerts } = await saveXml(page);
    expect(alerts).toEqual([]);
    expect(await xmlTexts(page, xml, 'TaxSubtotal > TaxCategory > ID')).toEqual(['S', 'Z', 'E', 'AE']);
    expect(await xmlTexts(page, xml, 'TaxSubtotal > TaxCategory > Percent')).toEqual(['21.00', '0.00', '0.00', '0.00']);
    expect(await xmlTexts(page, xml, 'TaxSubtotal > TaxCategory > TaxExemptionReasonCode')).toEqual(['VATEX-EU-F', 'VATEX-EU-AE']);
    expect(await xmlTexts(page, xml, 'TaxSubtotal > TaxCategory > TaxExemptionReason')).toEqual(['Bunuri second hand', 'Taxare inversa']);
    expect(await xmlTexts(page, xml, 'LegalMonetaryTotal > PayableAmount')).toEqual(['221.00']);
    expect(await xmlTexts(page, xml, 'InvoiceLine > Item > ClassifiedTaxCategory > ID')).toEqual(['S', 'Z', 'E', 'AE']);
  });

  // BUG: script.js:323 displayTotals reconstruieste randurile TVA din linii la orice recalculare si pierde codul/motivul de scutire
  test('BUG: recalcularea pastreaza codul si motivul de scutire', async ({ page }) => {
    test.fail(true, 'BUG: displayTotals (script.js:323) reconstruieste defalcarea fara exemptionCode/Reason');
    await openWithFixture(page, 'factura-scutiri.xml');
    await recalc(page);
    const eRow = await rowOfType(page, 'E');
    await expect(eRow.locator('.vat-exemption-reason')).toHaveValue('Bunuri second hand');
  });

  // BUG: script.js:21 VAT_TYPES nu contine K (livrare intracomunitara) si G (export): la incarcare devin S cu 0% si pierd codul de scutire din XML
  test('BUG: categoriile K si G se pastreaza la round-trip', async ({ page }) => {
    test.fail(true, 'BUG: VAT_TYPES (script.js:21) nu are K/G; categoria devine S 0% la salvare');
    await openWithFixture(page, 'factura-k-g.xml');
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'TaxSubtotal > TaxCategory > ID')).toEqual(['S', 'K', 'G']);
    expect(await xmlTexts(page, xml, 'TaxSubtotal > TaxCategory > TaxExemptionReasonCode')).toEqual(['VATEX-EU-IC', 'VATEX-EU-G']);
  });
});

test.describe('defalcare TVA: coduri de scutire (rand obtinut dintr-o linie)', () => {
  test('linie E: cod gol; alegerea codului pune motivul (updateExemptionReason)', async ({ page }) => {
    await openWithFixture(page);
    await page.selectOption('[name="vatType1"]', 'E');
    const row = await rowOfType(page, 'E');
    await expect(row.locator('.vat-exemption')).not.toHaveClass(/hidden/);
    await expect(row.locator('.vat-exemption-code')).toHaveValue('');
    await row.locator('.vat-exemption-code').selectOption('VATEX-EU-F');
    await expect(row.locator('.vat-exemption-reason')).toHaveValue('Bunuri second hand');
    await row.locator('.vat-exemption-code').selectOption('VATEX-EU-D');
    await expect(row.locator('.vat-exemption-reason')).toHaveValue('Regim special agentii de turism');
    await row.locator('.vat-exemption-code').selectOption('');
    await expect(row.locator('.vat-exemption-reason')).toHaveValue('Scutit');
  });

  test('linie AE: cod VATEX-EU-AE; linie Z: fara zona de scutire', async ({ page }) => {
    await openWithFixture(page);
    await page.selectOption('[name="vatType0"]', 'AE');
    await page.selectOption('[name="vatType1"]', 'Z');
    const ae = await rowOfType(page, 'AE');
    await expect(ae.locator('.vat-exemption')).not.toHaveClass(/hidden/);
    await expect(ae.locator('.vat-exemption-code')).toHaveValue('VATEX-EU-AE');
    const z = await rowOfType(page, 'Z');
    await expect(z.locator('.vat-exemption')).toHaveClass(/hidden/);
  });

  test('linie O: cod VATEX-EU-O', async ({ page }) => {
    await openWithFixture(page);
    await page.selectOption('[name="vatType1"]', 'O');
    const o = await rowOfType(page, 'O');
    await expect(o.locator('.vat-exemption')).not.toHaveClass(/hidden/);
    await expect(o.locator('.vat-exemption-code')).toHaveValue('VATEX-EU-O');
  });

  test('updateExemptionReason (apelat direct) pune motivul potrivit', async ({ page }) => {
    await openWithFixture(page, 'factura-scutiri.xml');
    const row = await rowOfType(page, 'E');
    const id = await row.getAttribute('id');
    await row.locator('.vat-exemption-reason').fill('');
    await page.evaluate((rid) => (window as any).updateExemptionReason(rid), id);
    await expect(row.locator('.vat-exemption-reason')).toHaveValue('Bunuri second hand');
  });

  test('rand E fara cod si fara motiv blocheaza salvarea', async ({ page }) => {
    await openWithFixture(page, 'factura-scutiri.xml');
    const row = await rowOfType(page, 'E');
    await row.locator('.vat-exemption-code').selectOption('');
    await row.locator('.vat-exemption-reason').fill('');
    const alerts: string[] = [];
    page.on('dialog', async d => { alerts.push(d.message()); await d.dismiss(); });
    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.getByRole('button', { name: 'Salvează XML' }).click();
    await page.waitForTimeout(500);
    expect(downloaded).toBe(false);
    expect(alerts.join('|')).toMatch(/scutirii de TVA/);
  });

  test('cod ales pe randul E ajunge in XML (cod + motiv)', async ({ page }) => {
    await openWithFixture(page);
    await page.selectOption('[name="vatType1"]', 'E');
    const row = await rowOfType(page, 'E');
    await row.locator('.vat-exemption-code').selectOption('VATEX-EU-D');
    const { xml, alerts } = await saveXml(page);
    expect(alerts).toEqual([]);
    expect(await xmlTexts(page, xml, 'TaxSubtotal > TaxCategory > TaxExemptionReasonCode')).toEqual(['VATEX-EU-D']);
    expect(await xmlTexts(page, xml, 'TaxSubtotal > TaxCategory > TaxExemptionReason')).toEqual(['Regim special agentii de turism']);
  });
});

test.describe('defalcare TVA: butoane pe rand', () => {
  // BUG: script.js:3009/2999/2930 — defalcarea e derivata din linii: refreshTotals reconstruieste randurile, deci
  // "Adauga Cota TVA", stergerea unui rand si schimbarea tipului pe rand nu au efect durabil.
  test('BUG: "Adauga Cota TVA" lasa un rand vizibil', async ({ page }) => {
    test.fail(true, 'BUG: addVATRate (script.js:3009) -> refreshTotals sterge randul nou (fara baza)');
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Adaugă Cotă TVA' }).click();
    await expect(page.locator('.vat-row')).toHaveCount(3);
  });

  test('BUG: stergerea unui rand TVA (✕) il elimina din defalcare', async ({ page }) => {
    test.fail(true, 'BUG: removeVATRow (script.js:2999) -> refreshTotals recreeaza randul din linii');
    await openWithFixture(page);
    await page.locator('.vat-row').first().locator('button.button-danger').click();
    await expect(page.locator('.vat-row')).toHaveCount(1);
  });

  test('BUG: schimbarea tipului pe un rand TVA ramane aplicata', async ({ page }) => {
    test.fail(true, 'BUG: updateVATRow manual (script.js:2930) -> refreshTotals reface randul din linii');
    await openWithFixture(page);
    await page.locator('.vat-row').first().locator('.vat-type').selectOption('E');
    await expect(page.locator('.vat-row').first().locator('.vat-type')).toHaveValue('E');
  });
});

test.describe('defalcare TVA: editare si efect pe totaluri', () => {
  test('TVA editat manual pe un rand se reflecta in total si in XML', async ({ page }) => {
    await openWithFixture(page);
    const amount = page.locator('.vat-row').first().locator('.vat-amount');
    await amount.fill('42.01');
    await amount.dispatchEvent('change');
    await amount.blur();
    const t = await readTotals(page);
    expect(t.vat).toBeCloseTo(47.51, 2);
    expect(t.total).toBeCloseTo(297.51, 2);
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'Invoice > TaxTotal > TaxAmount')).toEqual(['47.51']);
    expect((await xmlTexts(page, xml, 'TaxSubtotal > TaxAmount'))[0]).toBe('42.01');
  });

  test('linie trecuta pe Z: TVA scade, defalcarea are rand Z si XML-ul il pastreaza', async ({ page }) => {
    await openWithFixture(page);
    await page.selectOption('[name="vatType1"]', 'Z');
    await expect(page.locator('[name="vatRate1"]')).toBeDisabled();
    await expect(page.locator('[name="vatRate1"]')).toHaveValue('0.00');
    const t = await readTotals(page);
    expect(t.vat).toBeCloseTo(42, 2);
    expect(t.total).toBeCloseTo(292, 2);
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'InvoiceLine > Item > ClassifiedTaxCategory > ID')).toEqual(['S', 'Z']);
    expect(await xmlTexts(page, xml, 'TaxSubtotal > TaxCategory > ID')).toEqual(['S', 'Z']);
  });

  test('linie trecuta pe AE: cota 0, TVA 0 pe acea baza', async ({ page }) => {
    await openWithFixture(page);
    await page.selectOption('[name="vatType0"]', 'AE');
    const t = await readTotals(page);
    // ramane doar linia 2 (50 x 11%) = 5.50
    expect(t.vat).toBeCloseTo(5.5, 2);
    expect(t.total).toBeCloseTo(255.5, 2);
    await recalc(page);
    expect((await readTotals(page)).vat).toBeCloseTo(5.5, 2);
  });

  test('doua linii pe aceeasi cota se aduna intr-un singur rand de defalcare', async ({ page }) => {
    await openWithFixture(page);
    await page.selectOption('[name="vatType1"]', 'S');
    await page.fill('[name="vatRate1"]', '21');
    await page.locator('[name="vatRate1"]').dispatchEvent('change');
    await page.locator('[name="vatRate1"]').blur();
    await recalc(page);
    await expect(page.locator('.vat-row')).toHaveCount(1);
    const t = await readTotals(page);
    expect(t.vat).toBeCloseTo(52.5, 2);
    expect(t.total).toBeCloseTo(302.5, 2);
  });
});
