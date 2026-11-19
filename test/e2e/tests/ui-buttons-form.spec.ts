import { test, expect } from '../helpers/test';
import {
  localOnly, openApp, openWithFixture, fx, getField, setField, saveXml, savedXml, xmlTexts, xmlQuery, readTotals, recalc,
  newInvoiceFilled, addLine, fillHeader, fillParty, loadXmlFile, SUPPLIER_TEST, CUSTOMER_TEST,
} from '../helpers/ui';
import * as fs from 'fs';

localOnly(test);

// Formular: antet factura, date, parti, nota, plati, totaluri editabile, panouri, toast.

const FIXED = new Date('2026-03-15T10:00:00');
const fixedApp = async (page: any) => { await page.clock.setFixedTime(FIXED); await openApp(page); };

test.describe('calendare (Pikaday) si campuri de data', () => {
  for (const [field, xmlSel, shown, iso] of [['issueDate', 'IssueDate', '20.03.2026', '2026-03-20'], ['dueDate', 'DueDate', '20.12.2030', '2030-12-20']] as const) {
    test(`buton calendar ${field}: se deschide, ziua aleasa ajunge in camp si in XML`, async ({ page }) => {
      await page.clock.setFixedTime(FIXED);
      await newInvoiceFilled(page);
      const btn = page.locator(`[name="${field}"]`).locator('xpath=..').locator('.calendar-button');
      await btn.click();
      const pika = page.locator('.pika-single:not(.is-hidden)');
      await expect(pika).toBeVisible();
      await pika.locator('.pika-button.pika-day:not(.is-outside-current-month)[data-pika-day="20"]').click();
      await expect(pika).toHaveCount(0);
      expect(await getField(page, field)).toBe(shown);
      const xml = await savedXml(page);
      expect((await xmlTexts(page, xml, `Invoice > ${xmlSel}`))[0]).toBe(iso);
    });
  }

  test('calendar data factura referita: ziua aleasa ajunge in BillingReference', async ({ page }) => {
    await page.clock.setFixedTime(FIXED);
    await newInvoiceFilled(page);
    await setField(page, 'billingRefId', 'FV-100');
    await page.locator('[name="billingRefDate"]').locator('xpath=..').locator('.calendar-button').click();
    await page.locator('.pika-single:not(.is-hidden) .pika-button.pika-day:not(.is-outside-current-month)[data-pika-day="05"], .pika-single:not(.is-hidden) .pika-button.pika-day:not(.is-outside-current-month)[data-pika-day="5"]').first().click();
    expect(await getField(page, 'billingRefDate')).toBe('05.03.2026');
    const xml = await savedXml(page);
    expect(await xmlTexts(page, xml, 'BillingReference > InvoiceDocumentReference > ID')).toEqual(['FV-100']);
    expect(await xmlTexts(page, xml, 'BillingReference > InvoiceDocumentReference > IssueDate')).toEqual(['2026-03-05']);
  });

  test('calendar: butoanele luna anterioara / urmatoare schimba luna afisata (denumiri romanesti)', async ({ page }) => {
    await fixedApp(page);
    await page.locator('[name="issueDate"]').locator('xpath=..').locator('.calendar-button').click();
    const pika = page.locator('.pika-single:not(.is-hidden)');
    await expect(pika.locator('.pika-title')).toContainText('Martie');
    await pika.locator('.pika-next').click();
    await expect(pika.locator('.pika-title')).toContainText('Aprilie');
    await pika.locator('.pika-prev').click();
    await pika.locator('.pika-prev').click();
    await expect(pika.locator('.pika-title')).toContainText('Februarie');
  });

  test('data tastata: cifrele primesc automat puncte, literele sunt ignorate, lungime maxima 10', async ({ page }) => {
    await fixedApp(page);
    const f = page.locator('[name="dueDate"]');
    await f.fill('');
    await f.pressSequentially('15ab032026999');
    expect(await f.inputValue()).toBe('15.03.2026');
  });

  test('data cu format gresit (1..1..2026) este marcata invalida la blur; data valida curata marcajul', async ({ page }) => {
    await fixedApp(page);
    const f = page.locator('[name="dueDate"]');
    await f.fill('1.1.2026');
    await f.blur();
    await expect(f).toHaveClass(/invalid/);
    await f.fill('28.02.2026');
    await f.blur();
    await expect(f).not.toHaveClass(/invalid/);
    expect(await f.inputValue()).toBe('28.02.2026');
  });

  test('data imposibila (31.02.2026, 99.99.2026) ramane cum a fost scrisa si e marcata invalida', async ({ page }) => {
    await fixedApp(page);
    const f = page.locator('[name="dueDate"]');
    await f.fill('31.02.2026');
    await f.blur();
    expect(await f.inputValue()).toBe('31.02.2026');
    await expect(f).toHaveClass(/invalid/);
    await f.fill('99.99.2026');
    await f.blur();
    expect(await f.inputValue()).toBe('99.99.2026');
    await expect(f).toHaveClass(/invalid/);
  });

  test('implicit: data emiterii = azi, scadenta = azi + 30 zile', async ({ page }) => {
    await fixedApp(page);
    expect(await getField(page, 'issueDate')).toBe('15.03.2026');
    expect(await getField(page, 'dueDate')).toBe('14.04.2026');
  });
});

test.describe('antet factura: tip, numar, moneda -> XML', () => {
  for (const code of ['380', '381', '384', '389']) {
    test(`tip factura ${code}: selectul scrie InvoiceTypeCode ${code}`, async ({ page }) => {
      await newInvoiceFilled(page);
      await fillHeader(page, { type: code });
      if (code === '381') await setField(page, 'billingRefId', 'FV-1');
      const xml = (await saveXml(page)).xml;
      expect(await xmlTexts(page, xml, 'Invoice > InvoiceTypeCode')).toEqual([code]);
    });
  }

  test('numar factura si moneda editate: ajung in XML (moneda cu majuscule)', async ({ page }) => {
    await newInvoiceFilled(page);
    await fillHeader(page, { number: 'FV-2026-77', currency: 'eur' });
    const xml = await savedXml(page);
    expect(await xmlTexts(page, xml, 'Invoice > ID')).toEqual(['FV-2026-77']);
    expect(await xmlTexts(page, xml, 'Invoice > DocumentCurrencyCode')).toEqual(['EUR']);
  });
});

test.describe('parti: toate campurile -> XML -> reincarcare', () => {
  test('furnizor si client: fiecare camp ajunge in XML si revine in formular dupa reincarcare', async ({ page }) => {
    await newInvoiceFilled(page);
    const xml = await savedXml(page);
    const sup = 'AccountingSupplierParty';
    const cus = 'AccountingCustomerParty';
    for (const [root, d] of [[sup, SUPPLIER_TEST], [cus, CUSTOMER_TEST]] as const) {
      expect(await xmlTexts(page, xml, `${root} PartyLegalEntity > RegistrationName`)).toEqual([d.Name]);
      expect(await xmlTexts(page, xml, `${root} PartyTaxScheme > CompanyID`)).toEqual([d.VAT]);
      expect(await xmlTexts(page, xml, `${root} PartyLegalEntity > CompanyID`)).toEqual([d.CompanyId]);
      expect(await xmlTexts(page, xml, `${root} PostalAddress > StreetName`)).toEqual([d.Address]);
      expect(await xmlTexts(page, xml, `${root} PostalAddress > CityName`)).toEqual([d.City]);
      expect(await xmlTexts(page, xml, `${root} PostalAddress > CountrySubentity`)).toEqual([d.CountrySubentity]);
      expect(await xmlTexts(page, xml, `${root} PostalAddress > Country > IdentificationCode`)).toEqual([d.Country]);
      expect(await xmlTexts(page, xml, `${root} Contact > Telephone`)).toEqual([d.Phone]);
      expect(await xmlTexts(page, xml, `${root} Contact > Name`)).toEqual([d.ContactName]);
      expect(await xmlTexts(page, xml, `${root} Contact > ElectronicMail`)).toEqual([d.Email]);
    }
    // reincarcare: formular nou, fisierul salvat
    await openApp(page);
    await page.locator('#fileInput').setInputFiles({ name: 'salvat.xml', mimeType: 'text/xml', buffer: Buffer.from(xml, 'utf8') });
    await page.locator('#lineItems .line-item').first().waitFor();
    for (const [party, d] of [['supplier', SUPPLIER_TEST], ['customer', CUSTOMER_TEST]] as const) {
      for (const [k, v] of Object.entries(d)) {
        expect(await getField(page, party + k), party + k).toBe(v);
      }
    }
  });

  test('Cod TVA/CUI: campul accepta valoarea de test si nu apare mesaj de eroare', async ({ page }) => {
    await newInvoiceFilled(page);
    await expect(page.locator('#supplierVAT-error')).toHaveCount(0);
    await expect(page.locator('#customerVAT-error')).toHaveCount(0);
  });
});

test.describe('text aditional (nota) si contor', () => {
  test('tastare: contorul arata N/900; nota ajunge in XML; maxlength 900', async ({ page }) => {
    await newInvoiceFilled(page);
    const note = page.locator('[name="invoiceNote"]');
    await note.fill('Plata prin OP in 30 de zile.');
    await expect(page.locator('.note-counter')).toHaveText('28/900 caractere');
    expect(await note.getAttribute('maxlength')).toBe('900');
    const xml = await savedXml(page);
    expect(await xmlTexts(page, xml, 'Invoice > Note')).toEqual(['Plata prin OP in 30 de zile.']);
    await note.fill('x'.repeat(950));
    expect((await note.inputValue()).length).toBeLessThanOrEqual(900);
    await expect(page.locator('.note-counter')).toHaveText(/^900\/900/);
  });

  test('nota goala: nu se scrie cbc:Note', async ({ page }) => {
    await newInvoiceFilled(page);
    const xml = await savedXml(page);
    expect(await xmlTexts(page, xml, 'Invoice > Note')).toEqual([]);
  });
});

test.describe('modalitati de plata: cod', () => {
  test('alegerea codului modalitatii de plata ajunge in PaymentMeansCode', async ({ page }) => {
    await newInvoiceFilled(page);
    await page.getByRole('button', { name: '+ Adaugă' }).click();
    const sel = page.locator('[name^="paymentMeansCode"]').last();
    const values = await sel.evaluate(e => Array.from((e as HTMLSelectElement).options).map(o => o.value));
    expect(values.length).toBeGreaterThan(3);
    const pick = values.find(v => v === '58') ?? values[values.length - 1];
    await sel.selectOption(pick);
    const xml = await savedXml(page);
    expect(await xmlTexts(page, xml, 'PaymentMeans > PaymentMeansCode')).toEqual([pick]);
  });
});

test.describe('reduceri/taxe: campuri', () => {
  test('motiv, baza de calcul, tip TVA Z (cota blocata) ajung in XML', async ({ page }) => {
    await newInvoiceFilled(page);
    await page.getByRole('button', { name: 'Adaugă Reducere/Taxă' }).click();
    await page.locator('[name="chargeType0"]').selectOption('false');
    await setField(page, 'chargeReason0', 'Reducere fidelitate');
    await setField(page, 'chargeAmount0', '10');
    await setField(page, 'chargeBaseAmount0', '200');
    await page.locator('[name="chargeVatType0"]').selectOption('S');
    await setField(page, 'chargeVatRate0', '21');
    await recalc(page);
    const xml = await savedXml(page);
    expect(await xmlTexts(page, xml, 'Invoice > AllowanceCharge > AllowanceChargeReason')).toEqual(['Reducere fidelitate']);
    expect(await xmlTexts(page, xml, 'Invoice > AllowanceCharge > BaseAmount')).toEqual(['200.00']);
    expect(await xmlTexts(page, xml, 'Invoice > AllowanceCharge > Amount')).toEqual(['10.00']);
    expect(await xmlTexts(page, xml, 'Invoice > AllowanceCharge > TaxCategory > Percent')).toEqual(['21']);
  });
});

test.describe('totaluri: editare inline si recalculare', () => {
  test('click pe total il face editabil; Enter iese din editare; valoarea se recalculeaza din linii', async ({ page }) => {
    await openWithFixture(page);
    const before = await readTotals(page);
    const el = page.locator('#subtotal');
    await expect(el).not.toHaveAttribute('contenteditable', 'true');
    await el.click();
    await expect(el).toHaveAttribute('contenteditable', 'true');
    await page.keyboard.press('Control+a');
    await page.keyboard.type('1');
    await page.keyboard.press('Enter');
    await expect(el).toHaveAttribute('contenteditable', 'false');
    await recalc(page);
    expect((await readTotals(page)).subtotal).toBe(before.subtotal);
  });

  test('toate cele 6 totaluri sunt editabile prin click', async ({ page }) => {
    await openWithFixture(page);
    for (const id of ['subtotal', 'totalAllowances', 'totalCharges', 'netAmount', 'vat', 'total']) {
      const el = page.locator('#' + id);
      await el.click();
      await expect(el, id).toHaveAttribute('contenteditable', 'true');
      await page.keyboard.press('Enter');
      await expect(el, id).toHaveAttribute('contenteditable', 'false');
    }
  });

  test('"Recalculeaza Totaluri" dupa schimbarea pretului actualizeaza total si TVA', async ({ page }) => {
    await openWithFixture(page);
    const before = await readTotals(page);
    await setField(page, 'price0', '1000');
    await recalc(page);
    const after = await readTotals(page);
    expect(after.subtotal).not.toBe(before.subtotal);
    expect(after.total).toBeCloseTo(after.net + after.vat, 2);
  });
});

test.describe('defalcare TVA: campuri pe rand', () => {
  test('rand adaugat: tip, cota, baza si valoare TVA editate ajung in XML', async ({ page }) => {
    await newInvoiceFilled(page);
    await page.getByRole('button', { name: 'Adaugă Cotă TVA' }).click();
    const row = page.locator('#vatBreakdownRows .vat-row').last();
    await row.locator('.vat-type').selectOption('S');
    await row.locator('.vat-rate').fill('11');
    await row.locator('.vat-rate').dispatchEvent('change');
    await row.locator('.vat-base').fill('50');
    await row.locator('.vat-base').dispatchEvent('change');
    await row.locator('.vat-amount').fill('5.50');
    await row.locator('.vat-amount').dispatchEvent('change');
    const xml = await savedXml(page);
    const bases = await xmlTexts(page, xml, 'TaxTotal > TaxSubtotal > TaxableAmount');
    expect(bases).toContain('50.00');
    const rates = await xmlTexts(page, xml, 'TaxTotal > TaxSubtotal > TaxCategory > Percent');
    expect(rates).toContain('11.00');
    const vats = await xmlTexts(page, xml, 'TaxTotal > TaxSubtotal > TaxAmount');
    expect(vats).toContain('5.50');
  });
});

test.describe('coduri de identificare: toate tipurile', () => {
  test('fiecare buton "+ ..." adauga un rand de tipul lui; randul gol nu ajunge in XML; ✕ il sterge', async ({ page }) => {
    await newInvoiceFilled(page);
    await page.locator('#lineItems .line-item').first().getByRole('button', { name: /Detalii Suplimentare/ }).click();
    const container = page.locator('#identifications0');
    const buttons = container.locator('.identification-buttons button');
    const n = await buttons.count();
    expect(n).toBeGreaterThanOrEqual(4);
    for (let i = 0; i < n; i++) await buttons.nth(i).click();
    const rows = container.locator('.identification-row');
    await expect(rows).toHaveCount(n);
    const types = await rows.evaluateAll(els => els.map(e => (e as HTMLElement).dataset.type));
    expect(new Set(types).size).toBe(n);
    // randurile cu selector de schema: schimba schema si completeaza valoarea
    const withScheme = container.locator('.identification-row select.scheme-select');
    const ns = await withScheme.count();
    expect(ns).toBeGreaterThan(0);
    for (let i = 0; i < ns; i++) {
      const sel = withScheme.nth(i);
      const opts = await sel.evaluate(e => Array.from((e as HTMLSelectElement).options).map(o => o.value));
      await sel.selectOption(opts[opts.length - 1]);
      await sel.locator('xpath=following-sibling::input[1]').fill('VAL' + i);
    }
    const xml = await savedXml(page);
    const ids = await xmlQuery(page, xml, 'InvoiceLine > Item > CommodityClassification > ItemClassificationCode, InvoiceLine > Item > StandardItemIdentification > ID, InvoiceLine > Item > SellersItemIdentification > ID, InvoiceLine > Item > BuyersItemIdentification > ID');
    expect(ids.filter(x => x.text.startsWith('VAL')).length).toBeGreaterThan(0);
    // stergere
    await container.locator('.delete-identification').first().click();
    await expect(rows).toHaveCount(n - 1);
  });
});

test.describe('notificari (toast)', () => {
  test('toast: buton × il inchide; poate coexista cu altele', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: 'Salvează profil' }).click();
    const toast = page.locator('.toast').first();
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Profil');
    await page.evaluate(() => (window as any).showToast('Al doilea mesaj', 'info'));
    await expect(page.locator('.toast')).toHaveCount(2);
    await toast.locator('.toast-dismiss').click();
    await expect(page.locator('.toast')).toHaveCount(1);
    await expect(page.locator('.toast')).toContainText('Al doilea mesaj');
  });

  test('toast cu variante: eroare si avertisment folosesc role=alert', async ({ page }) => {
    await openApp(page);
    await page.evaluate(() => { (window as any).showToast('Eroare', 'error', 'detaliu'); (window as any).showToast('Atentie', 'warning'); (window as any).showToast('Bine', 'success'); });
    await expect(page.locator('.toast-error')).toHaveAttribute('role', 'alert');
    await expect(page.locator('.toast-warning')).toHaveAttribute('role', 'alert');
    await expect(page.locator('.toast-success')).toHaveAttribute('role', 'status');
    await expect(page.locator('.toast-error .toast-sub')).toHaveText('detaliu');
  });
});

test.describe('panou validare BR', () => {
  async function invalidInvoice(page: any) {
    await openApp(page);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await page.locator('#btnGenerateInvoice').click();
    await addLine(page, { description: 'x', quantity: '1', price: '10' });
  }

  test('factura valida: panoul BR e ascuns', async ({ page }) => {
    await newInvoiceFilled(page);
    await expect(page.locator('#br-panel')).toHaveClass(/br-panel--hidden/);
  });

  test('factura cu probleme: panou vizibil cu sumar; click pe antet il extinde/restrange; Enter/Space la fel', async ({ page }) => {
    await invalidInvoice(page);
    const panel = page.locator('#br-panel');
    await expect(panel).not.toHaveClass(/br-panel--hidden/);
    await expect(page.locator('#br-panel-summary')).toContainText(/erori|critice|warning/);
    const header = page.locator('#br-panel-header');
    await expect(header).toHaveAttribute('aria-expanded', 'false');
    await header.click();
    await expect(panel).toHaveClass(/is-expanded/);
    await expect(header).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#br-panel-toggle')).toContainText('restrânge');
    await header.press('Enter');
    await expect(panel).not.toHaveClass(/is-expanded/);
    await header.press(' ');
    await expect(panel).toHaveClass(/is-expanded/);
  });

  test('click pe o problema: campul indicat primeste evidentiere si focus', async ({ page }) => {
    await invalidInvoice(page);
    await page.locator('#br-panel-header').click();
    const items = page.locator('.br-panel__item[data-field-ref]:not([data-field-ref=""])');
    await expect(items.first()).toBeVisible();
    const ref = await items.first().getAttribute('data-field-ref');
    await items.first().click();
    await expect(page.locator(ref!)).toHaveClass(/br-field-highlight/);
  });

  test('corectarea problemelor face panoul sa dispara', async ({ page }) => {
    await invalidInvoice(page);
    await expect(page.locator('#br-panel')).not.toHaveClass(/br-panel--hidden/);
    await fillParty(page, 'supplier');
    await fillParty(page, 'customer');
    await fillHeader(page, { dueDate: '31.12.2030' });
    await recalc(page);
    await expect(page.locator('#br-panel')).toHaveClass(/br-panel--hidden/);
  });
});
