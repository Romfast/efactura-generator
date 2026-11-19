import { test, expect } from '../helpers/test';
import * as fs from 'fs';
import { localOnly, openApp, openWithFixture, loadXmlFile, fx } from '../helpers/app';

localOnly(test);

test.describe('meniul Actiuni, tiparire si PDF', () => {
  test('meniul Actiuni se deschide/inchide (click, click in afara, Escape)', async ({ page }) => {
    await openApp(page);
    const menu = page.locator('#actionsMenu');
    await expect(menu).toBeHidden();
    await page.locator('#btnActionsMenu').click();
    await expect(menu).toBeVisible();
    await expect(page.locator('#btnActionsMenu')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('h1').click();
    await expect(menu).toBeHidden();
    await page.locator('#btnActionsMenu').click();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
  });

  test('Descarca PDF: fisier .pdf valid cu numarul facturii in nume', async ({ page }) => {
    test.setTimeout(60000);
    await openWithFixture(page);
    await page.locator('#btnActionsMenu').click();
    const dl = page.waitForEvent('download', { timeout: 45000 });
    await page.locator('#btnDownloadPDF').click();
    const download = await dl;
    expect(download.suggestedFilename()).toBe('factura_TST_0001.pdf');
    const buf = fs.readFileSync((await download.path())!);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(2000);
    await expect(page.locator('.toast-success')).toContainText('PDF generat');
    await expect(page.locator('#pdf-render-container')).toHaveCount(0);
  });

  for (const [label, tpl] of [['Standard', 'print.html'], ['Compact', 'print-compact.html']] as const) {
    test(`Printeaza ${label}: se deschide fereastra cu sablonul si datele facturii`, async ({ page, context }) => {
      await openWithFixture(page);
      await context.addInitScript(() => { window.print = () => {}; });
      await page.reload();
      await page.waitForFunction(() => typeof (window as any).saveXML === 'function');
      await loadXmlFile(page, fx('factura-baza.xml'));
      await page.locator('#btnActionsMenu').click();
      const popupPromise = context.waitForEvent('page', { timeout: 15000 });
      await page.locator(`[data-action="print"][data-template="${label.toLowerCase()}"]`).click();
      const popup = await popupPromise;
      await popup.waitForLoadState('domcontentloaded');
      expect(popup.url()).toContain(tpl);
      await expect(popup.locator('body')).toContainText('TST 0001', { timeout: 10000 });
      await expect(popup.locator('body')).toContainText('FURNIZOR TEST SRL');
      await expect(popup.locator('body')).toContainText('CLIENT TEST SRL');
      await expect(popup.locator('body')).toContainText('Produs Alfa');
      await expect(popup.locator('body')).toContainText('297');
    });
  }
});
