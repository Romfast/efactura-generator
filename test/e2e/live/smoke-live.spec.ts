import { test, expect } from '../helpers/test';
import { fx, loadXmlFile, saveXml, xmlTexts, readTotals, getField } from '../helpers/app';
import * as fs from 'fs';
import * as path from 'path';

// Smoke post-deploy, DOAR CITIRE. Tinta: LIVE_URL (implicit GitHub Pages).
// Ruleaza: npm run smoke:live   (sau LIVE_URL=https://romfast.ro/efactura-generator/ npm run smoke:live)
// Nu apasa nimic care scrie pe server: cererile non-GET sunt blocate, ANAF e blocat.

const repoIndex = fs.readFileSync(path.resolve(__dirname, '../../../index.html'), 'utf8');
// baseURL poate avea cale (GitHub Pages: /efactura-generator/): goto relativ, nu '/'
async function openApp(page: import('../helpers/test').Page) {
  await page.goto('./');
  await page.waitForFunction(() => typeof (window as any).saveXML === 'function' && !!(window as any).addLineItem);
}

const EXPECTED_VERSION = process.env.EXPECT_VERSION ?? /id="app-version">v?([^<]+)</.exec(repoIndex)![1];

test.beforeEach(async ({ page }) => {
  await page.route(/anaf\.ro/, r => r.abort());
  await page.route('**/*', r => (r.request().method() === 'GET' || r.request().method() === 'HEAD') ? r.fallback() : r.abort());
});

test.describe('smoke live (read-only)', () => {
  test('pagina se incarca fara erori JS, cu versiunea asteptata', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource|third-party/i.test(m.text())) errors.push(m.text()); });
    await openApp(page);
    await expect(page.locator('#app-version')).toHaveText('v' + EXPECTED_VERSION);
    for (const name of ['Alege Fișier XML / ZIP', 'Factură Nouă', 'Stornează', 'Salvează XML', 'Recalculează Totaluri']) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }
    expect(errors, errors.join('; ')).toHaveLength(0);
  });

  test('cache-busting: css si script.js poarta ?v= = versiunea afisata', async ({ page }) => {
    await page.goto('./');
    const srcs = await page.evaluate(() => [
      ...Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src')),
      ...Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(s => s.getAttribute('href')),
    ].filter(u => u && u.includes('?v=')));
    expect(srcs.length).toBeGreaterThanOrEqual(2);
    for (const s of srcs) expect(s, s!).toContain('?v=' + EXPECTED_VERSION);
  });

  test('se incarca o factura XML: antet, linii si totaluri corecte', async ({ page }) => {
    await openApp(page);
    await loadXmlFile(page, fx('factura-baza.xml'));
    expect(await getField(page, 'invoiceNumber')).toBe('TST 0001');
    await expect(page.locator('#lineItems .line-item')).toHaveCount(2);
    expect((await readTotals(page)).total).toBeCloseTo(297.5, 2);
  });

  test('salvarea intoarce acelasi total (descarcare locala, fara server)', async ({ page }) => {
    await openApp(page);
    await loadXmlFile(page, fx('factura-baza.xml'));
    const { xml, alerts } = await saveXml(page);
    expect(alerts).toHaveLength(0);
    expect(await xmlTexts(page, xml, 'LegalMonetaryTotal > PayableAmount')).toEqual(['297.50']);
  });

  test('receiver.php lipsa pe hosting static: butoanele ANAF raman ascunse sau functioneaza (nu apar erori)', async ({ page }) => {
    await openApp(page);
    await page.locator('#btnActionsMenu').click();
    await expect(page.locator('#btnDownloadPDF')).toBeVisible();
  });
});
