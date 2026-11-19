import { test, expect } from '../helpers/test';
import { localOnly, openApp, openWithFixture, saveXml, xmlQuery, setField, fx } from '../helpers/app';
import { newInvoiceFilled, addLine } from '../helpers/ui';
import type { Page } from '@playwright/test';

localOnly(test);

/** Elementele din Invoice > Delivery ca lista "cale=text" (ordinea contează) + ordinea copiilor lui Invoice. */
async function deliveryShape(page: Page, xml: string) {
  return page.evaluate((x) => {
    const doc = new DOMParser().parseFromString(x, 'text/xml');
    const del = Array.from(doc.documentElement.children).find(e => e.localName === 'Delivery');
    const paths: string[] = [];
    const walk = (e: Element, p: string) => {
      const here = p + '/' + e.localName;
      if (e.children.length === 0) paths.push(here + '=' + (e.textContent || '').trim());
      Array.from(e.children).forEach(c => walk(c, here));
    };
    if (del) walk(del, '');
    return { paths, order: Array.from(doc.documentElement.children).map(e => e.localName) };
  }, xml);
}

async function brCodes(page: Page): Promise<string[]> {
  return page.locator('#br-panel-body .br-panel__item-code').allTextContents();
}

async function loadXmlText(page: Page, xml: string) {
  await page.locator('#fileInput').setInputFiles({ name: 'rt.xml', mimeType: 'text/xml', buffer: Buffer.from(xml, 'utf8') });
  await page.locator('#lineItems .line-item').first().waitFor({ state: 'visible', timeout: 15000 });
}

const DELIVERY_EXPECTED = [
  '/Delivery/ActualDeliveryDate=2026-03-12',
  '/Delivery/DeliveryLocation/Address/StreetName=Lagerstrasse 5',
  '/Delivery/DeliveryLocation/Address/CityName=Hamburg',
  '/Delivery/DeliveryLocation/Address/PostalZone=20095',
  '/Delivery/DeliveryLocation/Address/CountrySubentity=DE-HH',
  '/Delivery/DeliveryLocation/Address/Country/IdentificationCode=DE',
  '/Delivery/DeliveryParty/PartyName/Name=Depozit Test',
];

test.describe('livrare (cac:Delivery)', () => {
  test('sectiunea e restransa implicit si fara date nu scrie Delivery', async ({ page }) => {
    await openWithFixture(page);
    await expect(page.locator('#deliveryFields')).toBeHidden();
    const { xml } = await saveXml(page);
    expect(await xmlQuery(page, xml, 'Invoice > Delivery')).toHaveLength(0);
  });

  test('incarcare XML cu Delivery: campurile se completa, sectiunea se deschide', async ({ page }) => {
    await openWithFixture(page, 'factura-k-livrare.xml');
    await expect(page.locator('#deliveryFields')).toBeVisible();
    expect(await page.locator('[name="deliveryDate"]').inputValue()).toBe('12.03.2026');
    expect(await page.locator('[name="deliveryName"]').inputValue()).toBe('Depozit Test');
    expect(await page.locator('[name="deliveryAddress"]').inputValue()).toBe('Lagerstrasse 5');
    expect(await page.locator('[name="deliveryCity"]').inputValue()).toBe('Hamburg');
    expect(await page.locator('[name="deliveryPostalZone"]').inputValue()).toBe('20095');
    expect(await page.locator('[name="deliveryCountry"]').inputValue()).toBe('DE');
    expect(await page.locator('[name="deliverySubdivision"]').inputValue()).toBe('DE-HH');
    await expect(page.locator('[name="deliverySubdivision"]')).toBeVisible();
    await expect(page.locator('[name="deliveryCountrySubentity"]')).toBeHidden();
  });

  test('round-trip: Delivery salvat identic, in pozitia UBL corecta', async ({ page }) => {
    await openWithFixture(page, 'factura-k-livrare.xml');
    const { xml } = await saveXml(page);
    const shape = await deliveryShape(page, xml);
    expect(shape.paths).toEqual(DELIVERY_EXPECTED);
    const o = shape.order;
    expect(o.indexOf('Delivery')).toBe(o.indexOf('AccountingCustomerParty') + 1);
    expect(o.indexOf('PaymentMeans')).toBe(o.indexOf('Delivery') + 1);
    // al doilea tur: reincarcarea XML-ului salvat si salvarea lui da acelasi Delivery
    await loadXmlText(page, xml);
    const again = await saveXml(page);
    expect((await deliveryShape(page, again.xml)).paths).toEqual(DELIVERY_EXPECTED);
  });

  test('completare in formular (adresa RO, Bucuresti): XML corect + round-trip', async ({ page }) => {
    await newInvoiceFilled(page);
    await page.locator('#btnToggleDelivery').click();
    await expect(page.locator('#deliveryFields')).toBeVisible();
    await setField(page, 'deliveryDate', '15.03.2030');
    await setField(page, 'deliveryName', 'Depozit Central');
    await setField(page, 'deliveryAddress', 'Str. Livrarii 7');
    await page.locator('[name="deliveryCountry"]').selectOption('RO');
    await page.locator('[name="deliveryCountrySubentity"]').selectOption('RO-B');
    await page.locator('select[name="deliveryCity"]').selectOption('SECTOR3');
    await setField(page, 'deliveryPostalZone', '030001');
    const { xml } = await saveXml(page);
    const expected = [
      '/Delivery/ActualDeliveryDate=2030-03-15',
      '/Delivery/DeliveryLocation/Address/StreetName=Str. Livrarii 7',
      '/Delivery/DeliveryLocation/Address/CityName=SECTOR3',
      '/Delivery/DeliveryLocation/Address/PostalZone=030001',
      '/Delivery/DeliveryLocation/Address/CountrySubentity=RO-B',
      '/Delivery/DeliveryLocation/Address/Country/IdentificationCode=RO',
      '/Delivery/DeliveryParty/PartyName/Name=Depozit Central',
    ];
    const shape = await deliveryShape(page, xml);
    expect(shape.paths).toEqual(expected);
    expect(shape.order.indexOf('Delivery')).toBe(shape.order.indexOf('AccountingCustomerParty') + 1);
    await loadXmlText(page, xml);
    expect(await page.locator('select[name="deliveryCity"]').inputValue()).toBe('SECTOR3');
    expect(await page.locator('[name="deliveryCountrySubentity"]').inputValue()).toBe('RO-B');
    expect((await deliveryShape(page, (await saveXml(page)).xml)).paths).toEqual(expected);
  });

  test('doar data livrarii: Delivery fara adresa', async ({ page }) => {
    await newInvoiceFilled(page);
    await page.locator('#btnToggleDelivery').click();
    await setField(page, 'deliveryDate', '01.02.2030');
    const { xml } = await saveXml(page);
    expect((await deliveryShape(page, xml)).paths).toEqual(['/Delivery/ActualDeliveryDate=2030-02-01']);
  });

  test('calendarul alege data livrarii; data imposibila e marcata invalida', async ({ page }) => {
    await openApp(page);
    await page.locator('#btnToggleDelivery').click();
    await page.locator('[name="deliveryDate"]').locator('xpath=..').locator('.calendar-button').click();
    await page.locator('.pika-single:not(.is-hidden) .pika-button.pika-day:not(.is-outside-current-month)[data-pika-day="20"]').click();
    expect(await page.locator('[name="deliveryDate"]').inputValue()).toMatch(/^20\.\d{2}\.\d{4}$/);
    await setField(page, 'deliveryDate', '31.02.2030');
    await expect(page.locator('[name="deliveryDate"]')).toHaveClass(/invalid/);
  });

  test('Factura Noua goleste campurile de livrare', async ({ page }) => {
    await openWithFixture(page, 'factura-k-livrare.xml');
    await page.getByRole('button', { name: 'Factură Nouă' }).click();
    await page.locator('#btnGenerateInvoice').click();
    await expect(page.locator('#modal-new-invoice')).not.toHaveClass(/is-open/);
    for (const n of ['deliveryDate', 'deliveryName', 'deliveryAddress', 'deliveryCity', 'deliveryPostalZone', 'deliveryCountry']) {
      expect(await page.locator(`[name="${n}"]`).inputValue(), n).toBe('');
    }
    await expect(page.locator('#deliveryFields')).toBeHidden();
  });
});

test.describe('livrare: reguli BR-IC-11 / BR-IC-12 / BR-57', () => {
  test('linie K fara livrare: BR-IC-11 si BR-IC-12; cu livrare dispar', async ({ page }) => {
    await openWithFixture(page, 'factura-k-g.xml');
    let codes = await brCodes(page);
    expect(codes).toContain('BR-IC-11');
    expect(codes).toContain('BR-IC-12');

    await page.locator('#btnToggleDelivery').click();
    await setField(page, 'deliveryDate', '12.03.2026');
    codes = await brCodes(page);
    expect(codes).not.toContain('BR-IC-11');
    expect(codes).toContain('BR-IC-12');

    await page.locator('[name="deliveryCountry"]').selectOption('DE');
    codes = await brCodes(page);
    expect(codes).not.toContain('BR-IC-12');
    expect(codes).not.toContain('BR-IC-11');
    // tara singura formeaza o adresa: ANAF cere si strada, localitatea, subdiviziunea
    expect(codes).toEqual(expect.arrayContaining(['BR-RO-180', 'BR-RO-201', 'BR-RO-211']));
    await setField(page, 'deliveryAddress', 'Lagerstrasse 5');
    await setField(page, 'deliveryCity', 'Hamburg');
    await setField(page, 'deliverySubdivision', 'DE-HH');
    expect((await brCodes(page)).filter(c => /^BR-(IC|RO-(180|201|211)|57)/.test(c))).toEqual([]);
  });

  test('fixture K cu livrare completa: fara BR-IC si fara BR-45 pentru K', async ({ page }) => {
    await openWithFixture(page, 'factura-k-livrare.xml');
    const codes = await brCodes(page);
    expect(codes.filter(c => /^BR-IC|^BR-57|^BR-45/.test(c))).toEqual([]);
  });

  test('fara linii K nu se cere livrare', async ({ page }) => {
    await openWithFixture(page);
    expect((await brCodes(page)).filter(c => /^BR-IC/.test(c))).toEqual([]);
  });

  test('linie K adaugata in formular declanseaza regulile', async ({ page }) => {
    await newInvoiceFilled(page);
    await addLine(page, { description: 'Livrare UE', quantity: '1', price: '50', vatType: 'K' });
    const codes = await brCodes(page);
    expect(codes).toContain('BR-IC-11');
    expect(codes).toContain('BR-IC-12');
  });

  test('adresa de livrare fara tara: BR-57', async ({ page }) => {
    await openApp(page);
    await page.locator('#btnToggleDelivery').click();
    await setField(page, 'deliveryAddress', 'Str. Test 1');
    expect(await brCodes(page)).toContain('BR-57');
  });

  test('click pe eroare BR-IC-11 deschide sectiunea restransa', async ({ page }) => {
    await openWithFixture(page, 'factura-k-g.xml');
    await expect(page.locator('#deliveryFields')).toBeHidden();
    await page.locator('#br-panel-header').click();
    await page.locator('#br-panel-body .br-panel__item', { hasText: 'BR-IC-11' }).click();
    await expect(page.locator('#deliveryFields')).toBeVisible();
  });
});
