import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { openApp, loadXmlFile, setField, fx, saveXml } from './app';

export * from './app';

/** Construieste un ZIP (in memorie) cu fisierele date {nume: continut}, folosind JSZip-ul aplicatiei. */
export async function makeZip(files: Record<string, string>): Promise<Buffer> {
  const JSZip = (await import(pathToFileURL(path.resolve(__dirname, '../../../js/vendor/jszip.mjs')).href)).default;
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return Buffer.from(await zip.generateAsync({ type: 'uint8array' }));
}

/** Incarca un ZIP creat din fixture-urile date (nume fisier din fixtures) pe #fileInput. */
export async function loadZipOf(page: Page, fixtures: string[], zipName = 'arhiva.zip') {
  const files: Record<string, string> = {};
  for (const f of fixtures) files[f] = fs.readFileSync(fx(f), 'utf8');
  const buffer = await makeZip(files);
  await page.locator('#fileInput').setInputFiles({ name: zipName, mimeType: 'application/zip', buffer });
  await page.locator('#lineItems .line-item').first().waitFor({ state: 'visible', timeout: 15000 });
}

/** Completeaza antetul facturii (numar, tip, date). Datele in format dd.mm.yyyy. */
export async function fillHeader(page: Page, h: { number?: string; type?: string; issueDate?: string; dueDate?: string; currency?: string }) {
  if (h.number !== undefined) await setField(page, 'invoiceNumber', h.number);
  if (h.type !== undefined) await page.locator('[name="invoiceTypeCode"]').selectOption(h.type);
  if (h.issueDate !== undefined) await setField(page, 'issueDate', h.issueDate);
  if (h.dueDate !== undefined) await setField(page, 'dueDate', h.dueDate);
  if (h.currency !== undefined) await setField(page, 'documentCurrencyCode', h.currency);
}

export const SUPPLIER_TEST = {
  Name: 'Furnizor Test SRL', VAT: 'RO12345674', CompanyId: 'J40/1234/2020', Address: 'Str. Exemplu 1',
  Country: 'RO', CountrySubentity: 'RO-B', City: 'SECTOR1', Phone: '0211234567', ContactName: 'Ion Test', Email: 'furnizor@example.test',
};
export const CUSTOMER_TEST = {
  Name: 'Client Test SRL', VAT: 'RO76543210', CompanyId: 'J12/99/2019', Address: 'Bd. Client 2',
  Country: 'RO', CountrySubentity: 'RO-CJ', City: 'Cluj-Napoca', Phone: '0264123456', ContactName: 'Maria Client', Email: 'client@example.test',
};

/** Completeaza campurile unei parti (supplier|customer). */
export async function fillParty(page: Page, party: 'supplier' | 'customer', data: Partial<typeof SUPPLIER_TEST> = party === 'supplier' ? SUPPLIER_TEST : CUSTOMER_TEST) {
  for (const [k, v] of Object.entries(data)) {
    const loc = page.locator(`[name="${party + k}"]`);
    if ((await loc.evaluate(e => e.tagName)) === 'SELECT') await loc.selectOption(v as string);
    else await setField(page, party + k, v as string);
  }
}

export interface LineData { description?: string; quantity?: string; price?: string; discount?: string; unit?: string; vatType?: string; vatRate?: string; }

/** Adauga o linie (buton "Adauga Articol") si o completeaza; intoarce indexul liniei. */
export async function addLine(page: Page, d: LineData = {}): Promise<number> {
  const before = await page.locator('#lineItems .line-item').count();
  await page.getByRole('button', { name: 'Adaugă Articol' }).click();
  await expect(page.locator('#lineItems .line-item')).toHaveCount(before + 1);
  const idx = Number(await page.locator('#lineItems .line-item').last().getAttribute('data-index'));
  await fillLine(page, idx, d);
  return idx;
}

export async function fillLine(page: Page, idx: number, d: LineData) {
  if (d.description !== undefined) await setField(page, `description${idx}`, d.description);
  if (d.unit !== undefined) await page.locator(`[name="unit${idx}"]`).selectOption(d.unit);
  if (d.vatType !== undefined) await page.locator(`[name="vatType${idx}"]`).selectOption(d.vatType);
  if (d.quantity !== undefined) await setField(page, `quantity${idx}`, d.quantity);
  if (d.price !== undefined) await setField(page, `price${idx}`, d.price);
  if (d.discount !== undefined) await setField(page, `lineDiscount${idx}`, d.discount);
  if (d.vatRate !== undefined) await setField(page, `vatRate${idx}`, d.vatRate);
  await page.getByRole('button', { name: 'Recalculează Totaluri' }).click();
}

/** Factura noua minimala, completa si valida: modal -> Genereaza -> parti -> o linie. */
export async function newInvoiceFilled(page: Page) {
  await openApp(page);
  await page.getByRole('button', { name: 'Factură Nouă' }).click();
  await page.locator('#btnGenerateInvoice').click();
  await expect(page.locator('#modal-new-invoice')).not.toHaveClass(/is-open/);
  await fillHeader(page, { dueDate: '31.12.2030' });
  await fillParty(page, 'supplier');
  await fillParty(page, 'customer');
  await addLine(page, { description: 'Serviciu test', quantity: '2', price: '100', vatRate: '21' });
}

/** Simuleaza receiver.php disponibil (ping) + raspunsuri pentru validare/PDF/CIF. */
export async function mockReceiver(page: Page, handlers: { validate?: object; cif?: object } = {}) {
  await page.route(/https?:\/\/[^/]*anaf\.ro\//, r => r.abort());
  await page.route(/receiver\.php\?action=ping/, r => r.fulfill({ json: { pong: true } }));
  if (handlers.validate) await page.route(/receiver\.php\?action=validate/, r => r.fulfill({ json: handlers.validate }));
  if (handlers.cif) await page.route(/receiver\.php\?action=cif/, r => r.fulfill({ json: handlers.cif }));
}

/** Salveaza si intoarce XML-ul parsat ca text; scurtatura pentru verificari pe continut. */
export async function savedXml(page: Page): Promise<string> {
  const r = await saveXml(page);
  expect(r.alerts, `alerte la salvare: ${r.alerts.join(' | ')}`).toHaveLength(0);
  return r.xml;
}

/** Colecteaza dialogurile (alert/confirm) aparute in timpul unei actiuni; le inchide. */
export function collectDialogs(page: Page): string[] {
  const msgs: string[] = [];
  page.on('dialog', d => { msgs.push(d.message()); d.dismiss().catch(() => {}); });
  return msgs;
}

