import { test, expect } from '@playwright/test';
import * as path from 'path';

const FIXTURE = path.resolve(__dirname, '../fixtures/user-br16-brco15.xml');

// Reproducerea cazului raportat de utilizator: factură cu cantitate "1.000"
// (3 zecimale canonical) și două TaxSubtotal-uri (21% și 11%). Înainte de fix,
// parseNum din br-ro.js interpreta "1.000" drept 1000 (ro-RO thousands) →
// BR-16 false positive. validateDateInput returna false pe billingRefDate gol →
// salvarea era blocată cu „completați toate câmpurile obligatorii".

test.describe('User-reported BR validation false positives', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'local') {
      test.skip();
      return;
    }
  });

  test('BR-16 + BR-CO-15 nu mai apar pentru qty=1.000', async ({ page }) => {
    await page.goto('/');
    await page.locator('#fileInput').setInputFiles(FIXTURE);
    await page.locator('#lineItems .line-item').first().waitFor({ state: 'visible', timeout: 15000 });

    // Asigură-te că validarea BR a rulat (br-panel injectat după parseXML).
    await page.locator('#br-panel').waitFor({ state: 'attached', timeout: 5000 });

    // Trigger explicit validateMath / re-run BR rules: focus & blur câmp ca să forțeze updateTotals.
    // De fapt parseXML deja apelează _updateBRPanel via updateTotals → validateMath path.
    await page.waitForTimeout(500);

    const violations = await page.evaluate(() => {
      // @ts-ignore — funcțiile sunt globale după initializeUI()
      const data = window.collectInvoiceDataForBR ? window.collectInvoiceDataForBR() : null;
      const items = Array.from(document.querySelectorAll('#br-panel-body .br-panel__item')).map(el => ({
        code: el.querySelector('.br-panel__item-code')?.textContent || '',
        msg: el.querySelector('.br-panel__item-msg')?.textContent || '',
      }));
      return { items, summary: document.getElementById('br-panel-summary')?.textContent || '' };
    });

    const codes = violations.items.map(v => v.code);
    console.log('BR violations:', JSON.stringify(violations, null, 2));

    expect(codes, 'BR-16 nu trebuie să apară pe qty=1.000 (qty×preț−disc=990 = lineTotal)').not.toContain('BR-16');
    expect(codes, 'BR-CO-15 nu trebuie să apară (sum 205.80+110=315.80=display)').not.toContain('BR-CO-15');
  });

  test('Salvarea funcționează fără billingRefDate', async ({ page }) => {
    await page.goto('/');
    await page.locator('#fileInput').setInputFiles(FIXTURE);
    await page.locator('#lineItems .line-item').first().waitFor({ state: 'visible', timeout: 15000 });

    // Confirmă: billingRefDate e gol.
    const billingDate = await page.locator('[name="billingRefDate"]').inputValue();
    expect(billingDate, 'billingRefDate trebuie să fie gol pentru această factură').toBe('');

    // Capturează alert-uri (validateForm-ul vechi alerta „completați toate câmpurile obligatorii").
    const alerts: string[] = [];
    page.on('dialog', async d => {
      alerts.push(d.message());
      await d.dismiss();
    });

    // Click Salvează XML — așteptăm download, NU alert.
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
    await page.getByText('Salvează XML', { exact: false }).click();
    const download = await downloadPromise;

    expect(alerts.filter(a => /câmpurile obligatorii/i.test(a)), 'Nu trebuie să apară alert despre câmpuri obligatorii').toHaveLength(0);
    expect(download, 'Download XML trebuie să se declanșeze').not.toBeNull();
  });
});
