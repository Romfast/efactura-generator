import { test, expect } from '@playwright/test';
import { localOnly, openApp, openWithFixture, saveXml, xmlTexts, xmlQuery } from '../helpers/app';

localOnly(test);

const IBAN_OK = 'RO08TEST0000000000000001';
const IBAN_OK2 = 'RO78TEST0000000000000002';

test.describe('modalitati de plata', () => {
  test('fixture: randul de plata e incarcat (cod 42 + IBAN)', async ({ page }) => {
    await openWithFixture(page);
    await expect(page.locator('.payment-means-row')).toHaveCount(1);
    expect(await page.locator('[name="paymentMeansCode0"]').inputValue()).toBe('42');
    expect(await page.locator('[name="paymentMeansIBAN0"]').inputValue()).toBe(IBAN_OK);
  });

  test('adauga al doilea rand, salveaza: 2 x PaymentMeans in XML', async ({ page }) => {
    await openWithFixture(page);
    await page.getByRole('button', { name: '+ Adaugă' }).click();
    await expect(page.locator('.payment-means-row')).toHaveCount(2);
    await page.selectOption('[name="paymentMeansCode1"]', '30');
    await page.fill('[name="paymentMeansIBAN1"]', IBAN_OK2);
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'Invoice > PaymentMeans > PaymentMeansCode')).toEqual(['42', '30']);
    expect(await xmlTexts(page, xml, 'Invoice > PaymentMeans > PayeeFinancialAccount > ID')).toEqual([IBAN_OK, IBAN_OK2]);
  });

  test('stergerea tuturor randurilor elimina PaymentMeans din XML', async ({ page }) => {
    await openWithFixture(page);
    await page.locator('.payment-means-row button.button-danger').first().click();
    await expect(page.locator('.payment-means-row')).toHaveCount(0);
    const { xml } = await saveXml(page);
    expect(await xmlQuery(page, xml, 'Invoice > PaymentMeans')).toHaveLength(0);
  });

  test('rand fara IBAN: PaymentMeansCode fara PayeeFinancialAccount', async ({ page }) => {
    await openWithFixture(page);
    await page.fill('[name="paymentMeansIBAN0"]', '');
    await page.selectOption('[name="paymentMeansCode0"]', '10');
    const { xml } = await saveXml(page);
    expect(await xmlTexts(page, xml, 'Invoice > PaymentMeans > PaymentMeansCode')).toEqual(['10']);
    expect(await xmlQuery(page, xml, 'Invoice > PaymentMeans > PayeeFinancialAccount')).toHaveLength(0);
  });
});

test.describe('validare IBAN in formular', () => {
  test('IBAN invalid: mesaj sub camp la blur, dispare la tastare', async ({ page }) => {
    await openWithFixture(page);
    const iban = page.locator('[name="paymentMeansIBAN0"]');
    await iban.fill('RO00TEST0000000000000001');
    await iban.blur();
    const err = page.locator('#paymentMeansIBAN0-error');
    await expect(err).toBeVisible();
    await expect(err).toContainText('IBAN invalid');
    expect(await iban.getAttribute('aria-invalid')).toBe('true');
    await iban.pressSequentially('1');
    await expect(err).toHaveCount(0);
  });

  test('IBAN valid: fara mesaj', async ({ page }) => {
    await openWithFixture(page);
    const iban = page.locator('[name="paymentMeansIBAN0"]');
    await iban.fill(IBAN_OK2);
    await iban.blur();
    await expect(page.locator('#paymentMeansIBAN0-error')).toHaveCount(0);
    expect(await iban.getAttribute('aria-invalid')).toBeNull();
  });
});

test.describe('validare CIF in formular', () => {
  for (const f of ['supplierVAT', 'customerVAT']) {
    test(`${f}: CIF cu cifra de control gresita afiseaza eroare, CIF valid nu`, async ({ page }) => {
      await openWithFixture(page);
      const input = page.locator(`[name="${f}"]`);
      await input.fill('RO12345675');
      await input.blur();
      await expect(page.locator(`#${f}-error`)).toContainText('CIF invalid');
      await input.fill('RO12345674');
      await input.blur();
      await expect(page.locator(`#${f}-error`)).toHaveCount(0);
    });
  }

  test('CIF cu litere: mesaj de caractere nepermise', async ({ page }) => {
    await openWithFixture(page);
    const input = page.locator('[name="customerVAT"]');
    await input.fill('ROABC123');
    await input.blur();
    await expect(page.locator('#customerVAT-error')).toContainText('caractere nepermise');
  });
});

test.describe('validatori puri (cif.js / iban.js)', () => {
  test('validateCIF', async ({ page }) => {
    await openApp(page);
    const r = await page.evaluate(async () => {
      const { validateCIF } = await import('/js/validation/cif.js');
      return {
        gol: validateCIF('').valid,
        ro: validateCIF('RO12345674').valid,
        faraRo: validateCIF('12345674').valid,
        spatii: validateCIF(' ro 76543210 ').valid,
        control: validateCIF('12345675').valid,
        scurt: validateCIF('1').valid,
        lung: validateCIF('12345678901').valid,
        litere: validateCIF('12A45674').valid,
        msgControl: validateCIF('12345675').message,
      };
    });
    expect(r).toMatchObject({ gol: true, ro: true, faraRo: true, spatii: true, control: false, scurt: false, lung: false, litere: false });
    expect(r.msgControl).toContain('cifra de control');
  });

  test('validateIBAN', async ({ page }) => {
    await openApp(page);
    const r = await page.evaluate(async () => {
      const { validateIBAN } = await import('/js/validation/iban.js');
      return {
        gol: validateIBAN('').valid,
        ok: validateIBAN('RO08TEST0000000000000001').valid,
        okSpatii: validateIBAN('ro08 test 0000 0000 0000 0001').valid,
        lungimeRO: validateIBAN('RO08TEST000000000000001').valid,
        control: validateIBAN('RO09TEST0000000000000001').valid,
        simboluri: validateIBAN('RO08-TEST0000000000000001').valid,
        scurt: validateIBAN('RO').valid,
        german: validateIBAN('DE89370400440532013000').valid,
      };
    });
    expect(r).toEqual({ gol: true, ok: true, okSpatii: true, lungimeRO: false, control: false, simboluri: false, scurt: false, german: true });
  });
});
