import { test, expect } from '../helpers/test';
import {
  localOnly, openWithFixture, saveXml, xmlQuery, xmlTexts, readTotals, setField, setNum, recalc,
} from '../helpers/app';

localOnly(test);

test.describe('linii de factura', () => {
  test('adauga articol: valori implicite, apoi completare -> totaluri + XML', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Adaugă Articol' }).click();
    await expect(page.locator('.line-item')).toHaveCount(3);
    expect(await page.locator('[name="quantity2"]').inputValue()).toMatch(/^1(\.0+)?$/);
    expect(await page.locator('[name="vatType2"]').inputValue()).toBe('S');
    expect(await page.locator('[name="vatRate2"]').inputValue()).toMatch(/^21/);
    expect(await page.locator('[name="unit2"]').inputValue()).toBe('EA');

    await page.fill('[name="description2"]', 'Produs Gama');
    await setNum(page, 'quantity2', '3');
    await setNum(page, 'price2', '10');
    const t = await readTotals(page);
    expect(t.subtotal).toBe(280);
    expect(t.vat).toBeCloseTo(47.5 + 6.3, 2);
    expect(t.total).toBeCloseTo(280 + 53.8, 2);

    const { xml, alerts } = await saveXml(page);
    expect(alerts).toEqual([]);
    expect(await xmlTexts(page, xml, 'InvoiceLine > ID')).toEqual(['1', '2', '3']);
    expect(await xmlTexts(page, xml, 'InvoiceLine > Item > Name')).toEqual(['Produs Alfa', 'Produs Beta', 'Produs Gama']);
    expect(await xmlTexts(page, xml, 'InvoiceLine > LineExtensionAmount')).toEqual(['200.00', '50.00', '30.00']);
    const qty = await xmlQuery(page, xml, 'InvoiceLine > InvoicedQuantity');
    expect(qty[2].attrs.unitCode).toBe('EA');
    expect(parseFloat(qty[2].text)).toBe(3);
  });

  test('stergerea unei linii renumeroteaza si recalculeaza totalurile', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('.line-item').first().locator('.remove-line-item').click();
    await expect(page.locator('.line-item')).toHaveCount(1);
    expect(await page.locator('[name="description0"]').inputValue()).toBe('Produs Beta');
    const t = await readTotals(page);
    expect(t.subtotal).toBe(50);
    expect(t.vat).toBeCloseTo(5.5, 2);
    expect(t.total).toBeCloseTo(55.5, 2);
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'InvoiceLine > ID')).toEqual(['1']);
    expect(await xmlTexts(page, xml, 'InvoiceLine > Item > Name')).toEqual(['Produs Beta']);
  });

  test('fara nicio linie salvarea e blocata cu alerta', async ({ page }) => {
    await openWithFixture(page);
    await page.evaluate(() => { (window as any).removeLineItem(1); (window as any).removeLineItem(0); });
    await expect(page.locator('.line-item')).toHaveCount(0);
    const alerts: string[] = [];
    page.on('dialog', async d => { alerts.push(d.message()); await d.dismiss(); });
    await page.getByRole('button', { name: 'Salvează XML' }).click();
    await page.waitForTimeout(400);
    expect(alerts.join('|')).toMatch(/cel puțin o linie/);
  });

  test('dupa stergerea primei linii, butonul ✕ al liniei ramase o sterge', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('.line-item').first().locator('.remove-line-item').click();
    await expect(page.locator('.line-item')).toHaveCount(1);
    await page.locator('.line-item').first().locator('.remove-line-item').click();
    await expect(page.locator('.line-item')).toHaveCount(0);
  });

  test('discount pe linie: cod motiv activat, net redus, AllowanceCharge pe linie in XML', async ({ page }) => {
    await openWithFixture(page);
    await expect(page.locator('[name="discountReasonCode0"]')).toBeDisabled();
    await page.fill('[name="lineDiscount0"]', '20');
    await expect(page.locator('[name="discountReasonCode0"]')).toBeEnabled();
    const reason = await page.locator('[name="discountReasonCode0"]').inputValue();
    expect(reason).not.toBe('');
    await setNum(page, 'lineDiscount0', '20');
    const t = await readTotals(page);
    expect(t.subtotal).toBe(230);
    expect(t.vat).toBeCloseTo(180 * 0.21 + 5.5, 2);

    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'InvoiceLine > LineExtensionAmount')).toEqual(['180.00', '50.00']);
    expect(await xmlTexts(page, xml, 'InvoiceLine > AllowanceCharge > ChargeIndicator')).toEqual(['false']);
    expect(await xmlTexts(page, xml, 'InvoiceLine > AllowanceCharge > Amount')).toEqual(['20.00']);
    expect(await xmlTexts(page, xml, 'InvoiceLine > AllowanceCharge > AllowanceChargeReasonCode')).toEqual([reason]);
  });

  test('BaseAmount din AllowanceCharge-ul liniei e valoarea inainte de discount', async ({ page }) => {
    await openWithFixture(page);
    await setNum(page, 'lineDiscount0', '20');
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'InvoiceLine > AllowanceCharge > BaseAmount')).toEqual(['200.00']);
  });

  test('unitate de masura aleasa ajunge in unitCode', async ({ page }) => {
    await openWithFixture(page);
    await page.selectOption('[name="unit0"]', 'KGM');
    const { xml } = await saveXml(page);
    const qty = await xmlQuery(page, xml, 'InvoiceLine > InvoicedQuantity');
    expect(qty[0].attrs.unitCode).toBe('KGM');
    expect(qty[1].attrs.unitCode).toBe('H87');
  });

  test('pret negativ: minusul trece pe cantitate (BR-27)', async ({ page }) => {
    await openWithFixture(page);
    await page.fill('[name="price0"]', '-100');
    await page.locator('[name="price0"]').dispatchEvent('change');
    expect(parseFloat(await page.locator('[name="price0"]').inputValue())).toBe(100);
    expect(parseFloat(await page.locator('[name="quantity0"]').inputValue())).toBe(-2);
  });

  test('stergerea liniei din mijloc: XML are doar liniile ramase, ID-uri consecutive', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Adaugă Articol' }).click();
    await page.fill('[name="description2"]', 'Produs Gama');
    await page.locator('.line-item').nth(1).locator('.remove-line-item').click();
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'InvoiceLine > ID')).toEqual(['1', '2']);
    expect(await xmlTexts(page, xml, 'InvoiceLine > Item > Name')).toEqual(['Produs Alfa', 'Produs Gama']);
  });

  test('furnizor fara RO: linia noua porneste ca neplatitor (O, cota 0 blocata)', async ({ page }) => {
    await openWithFixture(page);
    await setField(page, 'supplierVAT', '76543210');
    await page.getByRole('button', { name: 'Adaugă Articol' }).click();
    expect(await page.locator('[name="vatType2"]').inputValue()).toBe('O');
    await expect(page.locator('[name="vatRate2"]')).toBeDisabled();
  });

  test('scurtaturi: Ctrl+N adauga linie, Ctrl+S salveaza XML', async ({ page }) => {
    await openWithFixture(page);
    await page.keyboard.press('Control+n');
    await expect(page.locator('.line-item')).toHaveCount(3);
    page.on('dialog', d => d.dismiss());
    // linia noua are pret 0 si denumire goala: validateForm cere denumire -> completam
    await page.fill('[name="description2"]', 'Linie scurtatura');
    const dl = page.waitForEvent('download', { timeout: 8000 });
    await page.keyboard.press('Control+s');
    expect((await dl).suggestedFilename()).toMatch(/\.xml$/i);
  });
});

test.describe('detalii suplimentare si coduri de identificare', () => {
  test('toggleOptionalDetails deschide/inchide zona; descrierea ajunge in XML', async ({ page }) => {
    await openWithFixture(page);
    const box = page.locator('#optionalDetails0');
    await expect(box).toBeHidden();
    await page.locator('.line-item').first().getByRole('button', { name: /Detalii Suplimentare/ }).click();
    await expect(box).toBeVisible();
    await page.fill('[name="itemDescription0"]', 'Descriere detaliata alfa');
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'InvoiceLine > Item > Description')).toEqual(['Descriere detaliata alfa']);
    await page.locator('.line-item').first().getByRole('button', { name: /Detalii Suplimentare/ }).click();
    await expect(box).toBeHidden();
  });

  test('codul furnizor din XML apare in lista de identificari', async ({ page }) => {
    await openWithFixture(page);
    const row = page.locator('#identifications0 .identification-row');
    await expect(row).toHaveCount(1);
    await expect(row.locator('input[type="text"]')).toHaveValue('ALFA-01');
  });

  test('addIdentification: cod client, cod de bare (schemeID 0160) si clasificare -> XML', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('.line-item').nth(1).getByRole('button', { name: /Detalii Suplimentare/ }).click();
    await page.evaluate(() => {
      (window as any).addIdentification(1, 'BUYERS');
      (window as any).addIdentification(1, 'STANDARD');
      (window as any).addIdentification(1, 'COMMODITY');
    });
    const rows = page.locator('#identifications1 .identification-row');
    await expect(rows).toHaveCount(3);
    await rows.nth(0).locator('input[type="text"]').fill('CLI-77');
    await rows.nth(1).locator('input[type="text"]').fill('5941234567890');
    await rows.nth(2).locator('input[type="text"]').fill('12345678');
    const { xml } = await saveXml(page);
    const line2 = 'InvoiceLine:nth-of-type(2)';
    expect(await xmlTexts(page, xml, `${line2} BuyersItemIdentification > ID`)).toEqual(['CLI-77']);
    const std = await xmlQuery(page, xml, `${line2} StandardItemIdentification > ID`);
    expect(std[0].text).toBe('5941234567890');
    expect(std[0].attrs.schemeID).toBe('0160');
    const cc = await xmlQuery(page, xml, `${line2} CommodityClassification > ItemClassificationCode`);
    expect(cc[0].text).toBe('12345678');
    expect(cc[0].attrs.listID).toBeTruthy();
  });

  test('buton "+ Cod Furnizor" adauga un rand; ✕ il sterge', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('.line-item').nth(1).getByRole('button', { name: /Detalii Suplimentare/ }).click();
    await page.locator('#identifications1').getByRole('button', { name: '+ Cod Furnizor' }).click();
    await expect(page.locator('#identifications1 .identification-row')).toHaveCount(1);
    await page.locator('#identifications1 .identification-row .delete-identification').click();
    await expect(page.locator('#identifications1 .identification-row')).toHaveCount(0);
  });

  test('cod de identificare gol nu se scrie in XML', async ({ page }) => {
    await openWithFixture(page);
    await page.evaluate(() => (window as any).addIdentification(1, 'SELLERS'));
    const { xml } = await saveXml(page);
    expect(await xmlQuery(page, xml, 'InvoiceLine:nth-of-type(2) SellersItemIdentification')).toHaveLength(0);
  });
});

test.describe('validateMath si totaluri', () => {
  test('factura incarcata consistenta: badge-uri ok, fara diferenta la subsol', async ({ page }) => {
    await openWithFixture(page);
    const r = await page.evaluate(() => {
      const v = (window as any).validateMath();
      return { over: v.footerOver, diff: Number(v.footerDiff.toString()) };
    });
    expect(r).toEqual({ over: false, diff: 0 });
    await expect(page.locator('#total-badge')).toHaveClass(/badge-ok/);
    await expect(page.locator('[data-line-badge-index="0"]')).toHaveClass(/badge-ok/);
  });

  test('pret modificat: totalul liniei se recalculeaza, badge-ul liniei arata diferenta fata de XML', async ({ page }) => {
    await openWithFixture(page);
    await setNum(page, 'price0', '120');
    await expect(page.locator('[data-line-total-index="0"]')).toContainText(/240/);
    const badge = page.locator('[data-line-badge-index="0"]');
    await expect(badge).toHaveClass(/badge-error/);
    await expect(badge).toContainText('40.00');
  });

  test('linie adaugata de utilizator nu are badge', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Adaugă Articol' }).click();
    await setNum(page, 'price2', '10');
    await expect(page.locator('[data-line-badge-index="2"]')).toHaveText('');
  });

  test('cantitate modificata: subtotal, TVA si total coerente, footer ok', async ({ page }) => {
    await openWithFixture(page);
    await setNum(page, 'quantity1', '4');
    const t = await readTotals(page);
    expect(t.subtotal).toBe(400);
    expect(t.vat).toBeCloseTo(42 + 22, 2);
    expect(t.total).toBeCloseTo(464, 2);
    await expect(page.locator('#total-badge')).toHaveClass(/badge-ok/);
  });
});

test.describe('totaluri dupa editare cu tastatura reala', () => {
  test('dupa editarea pretului si Tab, subtotalul se actualizeaza imediat', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('[name="price0"]').fill('110');
    await page.keyboard.press('Tab');
    expect((await readTotals(page)).subtotal).toBe(270);
  });

  test('dupa Tab, un click pe "Recalculeaza Totaluri" aplica editarea', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('[name="price0"]').fill('110');
    await page.keyboard.press('Tab');
    await recalc(page);
    expect((await readTotals(page)).subtotal).toBe(270);
  });

  test('Salveaza XML scrie valoarea editata chiar daca totalurile nu au fost reimprospatate', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('[name="price0"]').fill('110');
    await page.keyboard.press('Tab');
    const { xml } = await saveXml(page);
    const prices = await xmlTexts(page, xml, 'InvoiceLine > Price > PriceAmount');
    expect(parseFloat(prices[0])).toBe(110);
  });
});
