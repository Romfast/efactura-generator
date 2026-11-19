import { test, expect } from '../helpers/test';
import { localOnly, openApp, fx, getField, loadZipOf, makeZip, collectDialogs, newInvoiceFilled, savedXml, xmlTexts, readTotals } from '../helpers/ui';
import * as fs from 'fs';

localOnly(test);

// Antet: butoane, incarcare fisiere (buton, Ctrl+O, ZIP, drag-and-drop), linkuri, scurtaturi.

test.describe('antet: incarcare fisiere', () => {
  test('buton "Alege Fisier XML / ZIP": deschide selectorul de fisiere; fisierul ales populeaza formularul', async ({ page }) => {
    await openApp(page);
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Alege Fișier XML / ZIP' }).click();
    const fc = await chooser;
    expect(fc.isMultiple()).toBe(true);
    await fc.setFiles(fx('factura-baza.xml'));
    await expect(page.locator('#lineItems .line-item').first()).toBeVisible();
    expect(await getField(page, 'invoiceNumber')).toBe('TST 0001');
    expect((await readTotals(page)).total).toBeGreaterThan(0);
  });

  test('Ctrl+O deschide selectorul de fisiere', async ({ page }) => {
    await openApp(page);
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Control+o');
    expect(await chooser).toBeTruthy();
  });

  test('ZIP cu un XML: se incarca la fel ca XML-ul simplu', async ({ page }) => {
    await openApp(page);
    await loadZipOf(page, ['factura-baza.xml']);
    expect(await getField(page, 'invoiceNumber')).toBe('TST 0001');
    expect(await page.locator('#lineItems .line-item').count()).toBeGreaterThan(0);
    await expect(page.locator('#xml-sidebar')).toHaveCount(0);
  });

  test('ZIP fara XML: alerta "nu contine niciun fisier .xml", formularul ramane gol', async ({ page }) => {
    await openApp(page);
    const dialogs = collectDialogs(page);
    const buffer = await makeZip({ 'readme.txt': 'nimic de incarcat' });
    await page.locator('#fileInput').setInputFiles({ name: 'gol.zip', mimeType: 'application/zip', buffer });
    await expect.poll(() => dialogs.length).toBeGreaterThan(0);
    expect(dialogs[0]).toContain('nu conține niciun fișier .xml');
    await expect(page.locator('#lineItems .line-item')).toHaveCount(0);
  });

  test('drag-and-drop: dragenter pune marcajul, drop incarca XML-ul', async ({ page }) => {
    await openApp(page);
    const xml = fs.readFileSync(fx('factura-baza.xml'), 'utf8');
    const dt = await page.evaluateHandle(x => {
      const d = new DataTransfer();
      d.items.add(new File([x], 'trasa.xml', { type: 'text/xml' }));
      return d;
    }, xml);
    await page.dispatchEvent('body', 'dragenter', { dataTransfer: dt });
    await expect(page.locator('body')).toHaveClass(/drag-over/);
    await page.dispatchEvent('body', 'drop', { dataTransfer: dt });
    await expect(page.locator('body')).not.toHaveClass(/drag-over/);
    await expect(page.locator('#lineItems .line-item').first()).toBeVisible();
    expect(await getField(page, 'invoiceNumber')).toBe('TST 0001');
  });

  test('drag-and-drop cu doua fisiere: pornesc modul multi-fisier (sidebar)', async ({ page }) => {
    await openApp(page);
    const a = fs.readFileSync(fx('factura-baza.xml'), 'utf8');
    const b = fs.readFileSync(fx('factura-baza-b.xml'), 'utf8');
    const dt = await page.evaluateHandle(([x, y]) => {
      const d = new DataTransfer();
      d.items.add(new File([x], 'a.xml', { type: 'text/xml' }));
      d.items.add(new File([y], 'b.xml', { type: 'text/xml' }));
      return d;
    }, [a, b]);
    await page.dispatchEvent('body', 'drop', { dataTransfer: dt });
    await expect(page.locator('#xml-sidebar .xml-sidebar-item')).toHaveCount(2);
  });

  test('fisier care nu e XML valid: alerta de eroare, fara linii', async ({ page }) => {
    await openApp(page);
    const dialogs = collectDialogs(page);
    await page.locator('#fileInput').setInputFiles({ name: 'rau.xml', mimeType: 'text/xml', buffer: Buffer.from('<Invoice><nu-e-inchis>') });
    await expect.poll(() => dialogs.length).toBeGreaterThan(0);
    await expect(page.locator('#lineItems .line-item')).toHaveCount(0);
  });
});

test.describe('antet: linkuri', () => {
  test('logo-ul si "Aplicatii online" deschid romfast.ro in tab nou', async ({ page, context }) => {
    await context.route(/https?:\/\/(www\.)?romfast\.ro\//, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<title>romfast</title>' }));
    await openApp(page);
    for (const sel of ['.brand-logo-link', '.footer-logo-link', 'a:has-text("Aplicații online")']) {
      const link = page.locator(sel).first();
      await expect(link).toHaveAttribute('target', '_blank');
      const popupP = context.waitForEvent('page');
      await link.click();
      const popup = await popupP;
      await popup.waitForLoadState('domcontentloaded');
      expect(popup.url(), sel).toContain('romfast.ro');
      await popup.close();
    }
  });
});

test.describe('antet: salvare, storno, factura noua (butoane)', () => {
  test('buton "Salveaza XML" pe o factura completata de la zero: descarcare cu numarul in nume si continut', async ({ page }) => {
    await newInvoiceFilled(page);
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Salvează XML' }).click();
    const download = await dl;
    expect(download.suggestedFilename()).toMatch(/\.xml$/);
    const xml = fs.readFileSync((await download.path())!, 'utf8');
    expect(xml).toMatch(/<cbc:ID>RFT \d{4}0001<\/cbc:ID>/);
    expect(await xmlTexts(page, xml, 'LegalMonetaryTotal > PayableAmount')).toEqual(['242.00']);
  });

  test('Ctrl+S: salveaza XML-ul (descarcare)', async ({ page }) => {
    await newInvoiceFilled(page);
    const dl = page.waitForEvent('download');
    await page.keyboard.press('Control+s');
    expect((await dl).suggestedFilename()).toMatch(/\.xml$/);
  });

  test('buton "Stornează" pe factura completata: tip 381, referinta, cantitate si total negative in XML', async ({ page }) => {
    await newInvoiceFilled(page);
    const nr = await getField(page, 'invoiceNumber');
    await page.getByRole('button', { name: 'Stornează' }).click();
    expect(await getField(page, 'invoiceTypeCode')).toBe('381');
    expect(await getField(page, 'billingRefId')).toBe(nr);
    const xml = await savedXml(page);
    expect(await xmlTexts(page, xml, 'InvoiceTypeCode')).toEqual(['381']);
    expect(await xmlTexts(page, xml, 'InvoiceLine > InvoicedQuantity')).toEqual(['-2.000']);
    expect(await xmlTexts(page, xml, 'LegalMonetaryTotal > PayableAmount')).toEqual(['-242.00']);
  });

  test('buton "Factura Noua": modal cu focus pe serie; click pe fundal il inchide fara sa incrementeze contorul', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    const modal = page.locator('#modal-new-invoice');
    await expect(modal).toHaveClass(/is-open/);
    await expect(page.locator('#seq-serie')).toBeFocused();
    await modal.click({ position: { x: 5, y: 5 } });
    await expect(modal).not.toHaveClass(/is-open/);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await expect(page.locator('#seq-counter')).toHaveValue('1');
  });

  test('modal: seria se scrie cu majuscule in numarul generat; "Genereaza" inchide modalul si da toast', async ({ page }) => {
    await openApp(page);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await page.locator('#seq-serie').fill('abc');
    await page.locator('#seq-counter').fill('7');
    await expect(page.locator('#seq-preview')).toContainText('ABC');
    await page.locator('#btnGenerateInvoice').click();
    await expect(page.locator('#modal-new-invoice')).not.toHaveClass(/is-open/);
    expect(await getField(page, 'invoiceNumber')).toMatch(/^ABC \d{4}0007$/);
    await expect(page.locator('.toast-success')).toContainText('Factură nouă creată');
  });
});
