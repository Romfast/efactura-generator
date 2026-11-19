import { test, expect, Page } from '../helpers/test';
import * as fs from 'fs';
import { localOnly, openWithFixture } from '../helpers/app';

localOnly(test);

// Toate apelurile catre ANAF sunt simulate (page.route) — nicio cerere nu iese spre ANAF.

async function guardNoRealAnaf(page: Page) {
  const external: string[] = [];
  await page.route(/https?:\/\/[^/]*anaf\.ro\//, route => { external.push(route.request().url()); route.abort(); });
  return external;
}

async function mockPing(page: Page) {
  await page.route(/receiver\.php\?action=ping/, route => route.fulfill({ json: { pong: true } }));
}

async function setup(page: Page) {
  const external = await guardNoRealAnaf(page);
  await mockPing(page);
  await openWithFixture(page);
  await page.locator('#btnActionsMenu').click();
  await expect(page.locator('#btnValidateAnaf')).toBeVisible({ timeout: 8000 });
  return external;
}

const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');

test.describe('validare / PDF ANAF (receiver simulat)', () => {
  test('fara receiver.php: butoanele ANAF raman ascunse', async ({ page }) => {
    await guardNoRealAnaf(page);
    await page.route(/receiver\.php\?action=ping/, route => route.fulfill({ status: 404, body: 'nu exista' }));
    await openWithFixture(page);
    await page.locator('#btnActionsMenu').click();
    await expect(page.locator('#btnValidateAnaf')).toBeHidden();
    await expect(page.locator('#btnPdfAnaf')).toBeHidden();
  });

  test('Validare ANAF: raspuns fara erori -> toast de succes; trimite XML-ul curent', async ({ page }) => {
    const external = await setup(page);
    let body = '';
    await page.route(/receiver\.php\?action=validate/, async route => {
      body = route.request().postData() || '';
      await route.fulfill({ json: { Messages: [] } });
    });
    await page.locator('#btnValidateAnaf').click();
    await expect(page.locator('.toast-success')).toContainText('Factură validă ANAF');
    expect(body).toContain('<cbc:ID>TST 0001</cbc:ID>');
    expect(body).toContain('RO76543210');
    expect(external).toEqual([]);
  });

  test('Validare ANAF: erori si avertismente -> toast de eroare cu numarul lor', async ({ page }) => {
    await setup(page);
    await page.route(/receiver\.php\?action=validate/, route => route.fulfill({
      json: { Messages: [
        { message: 'BR-CO-15 total gresit', severity: 'ERROR' },
        { message: 'Atentie minora', severity: 'WARNING' },
      ] },
    }));
    await page.locator('#btnValidateAnaf').click();
    const t = page.locator('.toast-error');
    await expect(t).toContainText('1 erori');
    await expect(t).toContainText('1 avertismente');
    await expect(t).toContainText('BR-CO-15 total gresit');
  });

  test('Validare ANAF: HTTP 500 de la receiver -> toast de eroare, butonul revine', async ({ page }) => {
    await setup(page);
    await page.route(/receiver\.php\?action=validate/, route => route.fulfill({ status: 500, body: 'config lipsa' }));
    await page.locator('#btnValidateAnaf').click();
    await expect(page.locator('.toast-error')).toContainText('Eroare validare ANAF');
    await page.locator('#btnActionsMenu').click();
    await expect(page.locator('#btnValidateAnaf')).toBeEnabled();
    await expect(page.locator('#btnValidateAnaf')).toHaveText('Validare ANAF');
  });

  test('PDF ANAF: raspuns application/pdf -> descarca TST_0001_ANAF.pdf', async ({ page }) => {
    await setup(page);
    await page.route(/receiver\.php\?action=pdf/, route => route.fulfill({
      status: 200, headers: { 'Content-Type': 'application/pdf' }, body: PDF_BYTES,
    }));
    const dl = page.waitForEvent('download', { timeout: 10000 });
    await page.locator('#btnPdfAnaf').click();
    const download = await dl;
    expect(download.suggestedFilename()).toBe('TST_0001_ANAF.pdf');
    expect(fs.readFileSync((await download.path())!).subarray(0, 5).toString('latin1')).toBe('%PDF-');
    await expect(page.locator('.toast-success')).toContainText('PDF ANAF descărcat');
  });

  test('PDF ANAF: XML respins (JSON cu erori) -> toast, fara descarcare', async ({ page }) => {
    await setup(page);
    await page.route(/receiver\.php\?action=pdf/, route => route.fulfill({
      status: 400, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Messages: [{ message: 'Element lipsa BT-10', severity: 'ERROR' }] }),
    }));
    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.locator('#btnPdfAnaf').click();
    await expect(page.locator('.toast-error')).toContainText('ANAF a respins XML-ul');
    await expect(page.locator('.toast-error')).toContainText('Element lipsa BT-10');
    expect(downloaded).toBe(false);
  });

  test('lookupCif: CIF negasit -> mesaj, campurile nu se modifica', async ({ page }) => {
    await guardNoRealAnaf(page);
    await mockPing(page);
    await page.route(/receiver\.php\?action=cif/, route => route.fulfill({ json: { found: false } }));
    await openWithFixture(page);
    await expect(page.locator('#btnLookupCustomerCif')).toBeVisible({ timeout: 8000 });
    await page.locator('#btnLookupCustomerCif').click();
    await expect(page.locator('.toast').first()).toBeVisible({ timeout: 8000 });
    expect(await page.locator('[name="customerName"]').inputValue()).toBe('CLIENT TEST SRL');
  });
});
