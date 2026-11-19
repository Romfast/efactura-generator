import { test, expect } from '@playwright/test';
import {
  recalc, localOnly, openWithFixture, saveXml, xmlQuery, xmlTexts, readTotals, setField, loadXmlFile, trackPageErrors, expectNoErrors,
} from '../helpers/app';

localOnly(test);

// Baza: 200 (21%) + 50 (11%) = 250; TVA 47.50; total 297.50.
test.describe('reduceri si taxe globale', () => {
  test('reducere 25 pe cota 21: totaluri + XML AllowanceCharge', async ({ page }) => {
    const errs = trackPageErrors(page);
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Adaugă Reducere/Taxă' }).click();
    await page.selectOption('[name="chargeType0"]', 'false');
    await setField(page, 'chargeAmount0', '25');
    await page.selectOption('[name="chargeVatType0"]', 'S');
    await setField(page, 'chargeVatRate0', '21');
    await recalc(page);

    const t = await readTotals(page);
    expect(t.subtotal).toBe(250);
    expect(t.allowances).toBe(25);
    expect(t.charges).toBe(0);
    expect(t.net).toBe(225);
    // baza 21% = 175 -> 36.75 ; 11% = 50 -> 5.50
    expect(t.vat).toBeCloseTo(42.25, 2);
    expect(t.total).toBeCloseTo(267.25, 2);

    const { xml, alerts } = await saveXml(page);
    expect(alerts).toEqual([]);
    const ind = await xmlTexts(page, xml, 'Invoice > AllowanceCharge > ChargeIndicator');
    expect(ind).toEqual(['false']);
    expect(await xmlTexts(page, xml, 'Invoice > AllowanceCharge > Amount')).toEqual(['25.00']);
    expect(await xmlTexts(page, xml, 'Invoice > AllowanceCharge TaxCategory > ID')).toEqual(['S']);
    expect(await xmlTexts(page, xml, 'Invoice > AllowanceCharge TaxCategory > Percent')).toEqual(['21']);
    expect(await xmlTexts(page, xml, 'LegalMonetaryTotal > AllowanceTotalAmount')).toEqual(['25.00']);
    expect(await xmlTexts(page, xml, 'LegalMonetaryTotal > TaxExclusiveAmount')).toEqual(['225.00']);
    expect(await xmlTexts(page, xml, 'LegalMonetaryTotal > PayableAmount')).toEqual(['267.25']);
    expectNoErrors(errs);
  });

  test('taxa 10 pe cota 11: ChargeIndicator true, cod motiv si total', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Adaugă Reducere/Taxă' }).click();
    // implicit: Taxa (true) cu cod TV
    expect(await page.locator('[name="chargeType0"]').inputValue()).toBe('true');
    expect(await page.locator('[name="chargeReasonCode0"]').inputValue()).toBe('TV');
    await setField(page, 'chargeAmount0', '10');
    await page.selectOption('[name="chargeVatType0"]', 'S');
    await setField(page, 'chargeVatRate0', '11');
    await recalc(page);

    const t = await readTotals(page);
    expect(t.charges).toBe(10);
    expect(t.net).toBe(260);
    // 11%: (50+10)*0.11 = 6.60 ; 21%: 42.00
    expect(t.vat).toBeCloseTo(48.6, 2);
    expect(t.total).toBeCloseTo(308.6, 2);

    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'Invoice > AllowanceCharge > ChargeIndicator')).toEqual(['true']);
    expect(await xmlTexts(page, xml, 'Invoice > AllowanceCharge > AllowanceChargeReasonCode')).toEqual(['TV']);
    expect(await xmlTexts(page, xml, 'LegalMonetaryTotal > ChargeTotalAmount')).toEqual(['10.00']);
  });

  // BUG: js/script.js:2292 setupAllowanceChargeListeners — la `change` refreshTotals citeste dataset.raw inca vechi (blur il actualizeaza dupa), deci dupa Tab totalurile raman nerecalculate
  test('BUG: totalurile se actualizeaza imediat dupa editarea sumei si Tab', async ({ page }) => {
    test.fail(true, 'BUG: change pe chargeAmount/chargeVatRate citeste dataset.raw vechi (script.js:2292)');
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Adaugă Reducere/Taxă' }).click();
    await page.locator('[name="chargeAmount0"]').fill('10');
    await page.keyboard.press('Tab');
    expect((await readTotals(page)).charges).toBe(10);
  });

  test('schimbarea tipului in Reducere schimba lista codurilor de motiv', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Adaugă Reducere/Taxă' }).click();
    const taxaCodes = await page.locator('[name="chargeReasonCode0"] option').evaluateAll(o => o.map((x: any) => x.value));
    await page.selectOption('[name="chargeType0"]', 'false');
    const redCodes = await page.locator('[name="chargeReasonCode0"] option').evaluateAll(o => o.map((x: any) => x.value));
    expect(taxaCodes.length).toBeGreaterThan(0);
    expect(redCodes.length).toBeGreaterThan(0);
    expect(redCodes).not.toEqual(taxaCodes);
    expect(redCodes).toContain('95');
  });

  test('stergerea unei reduceri readuce totalurile la valoarea initiala', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Adaugă Reducere/Taxă' }).click();
    await page.selectOption('[name="chargeType0"]', 'false');
    await setField(page, 'chargeAmount0', '50');
    await page.selectOption('[name="chargeVatType0"]', 'S');
    await setField(page, 'chargeVatRate0', '21');
    await recalc(page);
    expect((await readTotals(page)).allowances).toBe(50);

    await page.locator('.allowance-charge .remove-line-item').click();
    await expect(page.locator('.allowance-charge')).toHaveCount(0);
    const t = await readTotals(page);
    expect(t.allowances).toBe(0);
    expect(t.total).toBeCloseTo(297.5, 2);
  });

  test('round-trip: reducerea salvata se reincarca in formular', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Adaugă Reducere/Taxă' }).click();
    await page.selectOption('[name="chargeType0"]', 'false');
    await setField(page, 'chargeAmount0', '20');
    await page.selectOption('[name="chargeVatType0"]', 'S');
    await setField(page, 'chargeVatRate0', '21');
    await recalc(page);
    await setField(page, 'chargeReason0', 'Discount fidelitate');
    const { xml } = await saveXml(page);

    const fs = await import('fs');
    const os = await import('os');
    const path = await import('path');
    const tmp = path.join(os.tmpdir(), `efactura-rt-${Date.now()}.xml`);
    fs.writeFileSync(tmp, xml, 'utf8');
    await page.reload();
    await page.waitForFunction(() => typeof (window as any).saveXML === 'function');
    await loadXmlFile(page, tmp);
    fs.unlinkSync(tmp);

    await expect(page.locator('.allowance-charge')).toHaveCount(1);
    expect(await page.locator('[name="chargeType0"]').inputValue()).toBe('false');
    expect(await page.locator('[name="chargeReason0"]').inputValue()).toBe('Discount fidelitate');
    expect(parseFloat(await page.locator('[name="chargeAmount0"]').inputValue())).toBe(20);
    const t = await readTotals(page);
    expect(t.allowances).toBe(20);
    const nodes = await xmlQuery(page, xml, 'Invoice > AllowanceCharge > Amount');
    expect(nodes[0].attrs.currencyID).toBe('RON');
  });
});
