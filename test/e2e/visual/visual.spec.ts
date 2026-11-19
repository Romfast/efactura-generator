import { test, expect } from '../helpers/test';
import { openApp, fx, loadXmlFile, setField } from '../helpers/app';
import { addLine, fillParty, fillHeader, newInvoiceFilled } from '../helpers/ui';
import { openStable, openStableWithFixture, shot, waitFonts } from '../helpers/visual';

// Regresie vizuala. Baseline-uri: test/e2e/visual-baselines/*.png (vezi test/README.md pentru actualizare).
// Ceas inghetat (15.03.2026), viewport 1280x900, fonturi asteptate, versiunea/toast-urile ascunse (visual/stable.css).

test.describe('formular', () => {
  test('formular gol', async ({ page, context }) => {
    await openStable(page, context);
    await shot(page, 'formular-gol', { fullPage: true });
  });

  test('factura incarcata', async ({ page, context }) => {
    await openStableWithFixture(page, context);
    await shot(page, 'factura-incarcata', { fullPage: true });
  });

  test('factura noua completata de la zero (modal inchis, totaluri)', async ({ page, context }) => {
    await openStable(page, context);
    await newInvoiceFilled(page);
    await waitFonts(page);
    await shot(page, 'factura-noua-completata', { fullPage: true });
  });

  test('calendar deschis pe data emiterii', async ({ page, context }) => {
    await openStable(page, context);
    await page.locator('[name="issueDate"]').locator('xpath=..').locator('.calendar-button').click();
    await expect(page.locator('.pika-single:not(.is-hidden)')).toBeVisible();
    await shot(page, 'calendar-deschis');
  });

  test('detalii suplimentare si coduri de identificare deschise', async ({ page, context }) => {
    await openStableWithFixture(page, context);
    const line = page.locator('#lineItems .line-item').first();
    await line.getByRole('button', { name: /Detalii Suplimentare/ }).click();
    await line.locator('.identification-buttons button').first().click();
    await shot(line, 'linie-detalii-identificari');
  });

  test('reducere + taxa globala adaugate', async ({ page, context }) => {
    await openStableWithFixture(page, context);
    await page.getByRole('button', { name: 'Adaugă Reducere/Taxă' }).click();
    await setField(page, 'chargeAmount0', '10');
    await shot(page.locator('#allowanceCharges'), 'reduceri-taxe');
  });

  test('eroare IBAN sub camp', async ({ page, context }) => {
    await openStableWithFixture(page, context);
    const iban = page.locator('[name="paymentMeansIBAN0"]');
    await iban.fill('RO00INVALID');
    await iban.blur();
    await expect(page.locator('#paymentMeansIBAN0-error')).toBeVisible();
    await shot(page.locator('#paymentMeansSection'), 'plata-iban-invalid');
  });
});

test.describe('defalcare TVA', () => {
  test('defalcare cu scutiri (S, Z, E, AE)', async ({ page, context }) => {
    await openStableWithFixture(page, context, 'factura-scutiri.xml');
    await shot(page.locator('.totals'), 'defalcare-tva-scutiri');
  });

  test('defalcare K/G (livrare intracomunitara / export)', async ({ page, context }) => {
    await openStableWithFixture(page, context, 'factura-k-g.xml');
    await shot(page.locator('.totals'), 'defalcare-tva-k-g');
  });
});

test.describe('modale, meniuri, panouri', () => {
  test('modal Factura Noua', async ({ page, context }) => {
    await openStable(page, context);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await expect(page.locator('#modal-new-invoice')).toHaveClass(/is-open/);
    await waitFonts(page);
    await shot(page, 'modal-factura-noua');
  });

  test('meniul Actiuni deschis', async ({ page, context }) => {
    await openStableWithFixture(page, context);
    await page.locator('#btnActionsMenu').click();
    await expect(page.locator('#actionsMenu')).toBeVisible();
    await shot(page, 'meniu-actiuni');
  });

  test('banner an nou (secventa din anul trecut)', async ({ page, context }) => {
    await context.addInitScript(() => {
      localStorage.setItem('efactura.sequence.v1', JSON.stringify({ serie: 'RFT', an: 2025, contor: 12, includeAn: true, cifre: 4 }));
    });
    await openStable(page, context);
    await expect(page.locator('#year-rollover-banner')).toBeVisible();
    await shot(page.locator('#year-rollover-banner'), 'banner-an-nou');
  });

  test('toast de succes', async ({ page, context }) => {
    await openStable(page, context);
    await page.evaluate(() => (window as any).showToast('Profil furnizor salvat', 'success', 'Se refoloseste la factura noua.'));
    const toast = page.locator('.toast').first();
    await page.addStyleTag({ content: '.toast-container{visibility:visible !important}' });
    await expect(toast).toBeVisible();
    await expect(toast).toHaveScreenshot('toast-succes.png', { animations: 'disabled' });
  });

  test('panou de validare BR extins (factura cu erori)', async ({ page, context }) => {
    await openStable(page, context);
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await page.locator('#btnGenerateInvoice').click();
    await addLine(page, { description: 'Articol fara date furnizor', quantity: '1', price: '10' });
    await page.keyboard.press('Escape');
    await page.locator('#vatBreakdown').click({ position: { x: 5, y: 5 } });
    await page.locator('#br-panel-header').click();
    await expect(page.locator('#br-panel')).toHaveClass(/is-expanded/);
    await waitFonts(page);
    await shot(page, 'panou-validare-br');
  });

  test('mod multi-fisier: sidebar cu doua facturi', async ({ page, context }) => {
    await openStable(page, context);
    await page.locator('#fileInput').setInputFiles([fx('factura-baza.xml'), fx('factura-baza-b.xml')]);
    await expect(page.locator('#xml-sidebar .xml-sidebar-item')).toHaveCount(2);
    await page.locator('#lineItems .line-item').first().waitFor();
    await setField(page, 'customerName', 'Client modificat SRL');
    await waitFonts(page);
    await shot(page, 'sidebar-multi-fisier', { fullPage: true });
  });
});

test.describe('previzualizare tiparire', () => {
  for (const [label, name] of [['standard', 'print-standard'], ['compact', 'print-compact']] as const) {
    test(`print ${label}`, async ({ page, context }) => {
      await openStableWithFixture(page, context);
      await page.locator('#btnActionsMenu').click();
      const popupP = context.waitForEvent('page');
      await page.locator(`[data-action="print"][data-template="${label}"]`).click();
      const popup = await popupP;
      await popup.waitForLoadState('load');
      await expect(popup.locator('body')).toContainText('TST 0001');
      await waitFonts(popup);
      await shot(popup, name, { fullPage: true });
    });
  }
});

test.describe('mobil 390x844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('formular gol (mobil)', async ({ page, context }) => {
    await openStable(page, context);
    await shot(page, 'mobil-formular-gol', { fullPage: true });
  });

  test('factura incarcata (mobil)', async ({ page, context }) => {
    await openStableWithFixture(page, context);
    await shot(page, 'mobil-factura-incarcata', { fullPage: true });
  });

  test('meniul Actiuni (mobil)', async ({ page, context }) => {
    await openStableWithFixture(page, context);
    await page.locator('#btnActionsMenu').click();
    await expect(page.locator('#actionsMenu')).toBeVisible();
    await shot(page, 'mobil-meniu-actiuni');
  });
});
