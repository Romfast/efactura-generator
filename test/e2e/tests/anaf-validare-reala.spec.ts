import { test, expect } from '../helpers/test';
import type { APIRequestContext, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import {
  localOnly, openApp, openWithFixture, loadXmlFile, saveXml, setField, recalc, DOCS_DIR,
  newInvoiceFilled, addLine,
} from '../helpers/ui';

localOnly(test);

// Validare REALA la ANAF (fara mock): XML-ul salvat de aplicatie e trimis serviciului public
// https://webservicesp.anaf.ro/prod/FCTEL/rest/validare/FACT1. Necesita internet; ANAF indisponibil = esec.
test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

const ANAF_URL = 'https://webservicesp.anaf.ro/prod/FCTEL/rest/validare/';
const CALL_TIMEOUT = 30_000;
const sleep =(ms: number) => new Promise(r => setTimeout(r, ms));

interface AnafResult { stare: string; errors: { cod: string; text: string; raw: string }[]; body: string; }

/** Standardul ANAF dupa radacina XML: CreditNote -> FCN, altfel FACT1. */
const anafService = (xml: string) => /<(?:\w+:)?CreditNote[\s>]/.test(xml.slice(0, 2000)) ? 'FCN' : 'FACT1';

/** Trimite XML-ul la ANAF; reincearca la eroare de retea / 5xx (max 3 incercari), apoi esueaza cu "ANAF indisponibil:". */
async function anafValidate(request: APIRequestContext, xml: string, service = anafService(xml)): Promise<AnafResult> {
  await sleep(300);
  let last = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await request.post(ANAF_URL + service, {
        data: xml, headers: { 'Content-Type': 'text/plain' }, timeout: CALL_TIMEOUT,
      });
      const status = resp.status();
      const body = await resp.text();
      if (status >= 500) {
        last = `HTTP ${status}`;
      } else {
        let j: any = null;
        try { j = JSON.parse(body); } catch { last = `raspuns neinteligibil (HTTP ${status}): ${body.slice(0, 200)}`; }
        if (j) {
          const errors = (j.Messages || []).map((m: any) => {
            const raw = String(m.message || '');
            return {
              cod: (raw.match(/codEroare=([^;]*)/) || [])[1] || '',
              text: (raw.match(/textEroare=(.*?)(?:; expresieValidata=|$)/) || [])[1] || raw,
              raw,
            };
          });
          return { stare: j.stare, errors, body };
        }
      }
    } catch (e) {
      last = String((e as Error).message || e).split('\n')[0];
    }
    if (attempt < 3) await sleep(1500 * attempt);
  }
  throw new Error(`ANAF indisponibil: ${last} (3 incercari). Fara validare reala nu se publica.`);
}

const fmt = (r: AnafResult) => r.errors.map(e => `${e.cod}: ${e.text}`).join('\n') || r.body;

/** Valideaza si cere stare ok; mesajul de esec listeaza fiecare eroare ANAF (codEroare + textEroare). */
async function expectAnafOk(request: APIRequestContext, xml: string, label: string) {
  const r = await anafValidate(request, xml);
  expect(r.stare, `ANAF a respins "${label}":\n${fmt(r)}`).toBe('ok');
}

async function saveClean(page: Page): Promise<string> {
  const { xml, alerts } = await saveXml(page);
  expect(alerts, `alerte la salvare: ${alerts.join(' | ')}`).toHaveLength(0);
  return xml;
}

async function setAllLines(page: Page, vatType: string) {
  const n = await page.locator('#lineItems .line-item').count();
  for (let i = 0; i < n; i++) await page.locator(`[name="vatType${i}"]`).selectOption(vatType);
  await recalc(page);
}

async function fillDelivery(page: Page) {
  await page.locator('#btnToggleDelivery').click();
  await setField(page, 'deliveryDate', '12.03.2026');
  await page.locator('[name="deliveryCountry"]').selectOption('DE');
  await setField(page, 'deliveryAddress', 'Lagerstrasse 5');
  await setField(page, 'deliveryCity', 'Hamburg');
  await setField(page, 'deliverySubdivision', 'DE-HH');
}

test.describe('validare XML la ANAF real (FACT1)', () => {
  test('control negativ: K fara livrare = nok cu BR-IC-11 (apelul ajunge la ANAF)', async ({ page, request }) => {
    await openWithFixture(page, 'factura-k-g.xml');
    const xml = await saveClean(page);
    const r = await anafValidate(request, xml);
    expect(r.stare).toBe('nok');
    expect(r.errors.map(e => e.cod)).toContain('BR-IC-11');
  });

  test('factura standard S 21%, furnizor RO', async ({ page, request }) => {
    await openWithFixture(page, 'factura-baza-b.xml');
    await expectAnafOk(request, await saveClean(page), 'factura-baza-b');
  });

  test('furnizor CUI fara RO + linii S + linie storno (BT-32)', async ({ page, request }) => {
    await openApp(page);
    await loadXmlFile(page, path.resolve(__dirname, '../../fixtures/cui_fara_ro_storno_tva21.xml'));
    await expectAnafOk(request, await saveClean(page), 'cui_fara_ro_storno_tva21');
  });

  test('mai multe cote TVA (docs, round-trip)', async ({ page, request }) => {
    await openApp(page);
    await loadXmlFile(page, path.join(DOCS_DIR, 'efactura_mai_multe_cote_TVA_si_cod_bare.xml'));
    await expectAnafOk(request, await saveClean(page), 'mai_multe_cote_TVA');
  });

  test('scutiri E si AE cu motive', async ({ page, request }) => {
    await openWithFixture(page, 'factura-scutiri.xml');
    await expectAnafOk(request, await saveClean(page), 'factura-scutiri');
  });

  test('K cu livrare', async ({ page, request }) => {
    await openWithFixture(page, 'factura-k-livrare.xml');
    await expectAnafOk(request, await saveClean(page), 'factura-k-livrare');
  });

  test('K + G completat in formular cu livrare', async ({ page, request }) => {
    await openWithFixture(page, 'factura-k-g.xml');
    await fillDelivery(page);
    await expectAnafOk(request, await saveClean(page), 'K + G cu livrare');
  });

  test('export G (linie G + linie S)', async ({ page, request }) => {
    await openWithFixture(page, 'factura-k-g.xml');
    await fillDelivery(page);
    const n = await page.locator('#lineItems .line-item').count();
    for (let i = 0; i < n; i++) {
      if ((await page.locator(`[name="vatType${i}"]`).inputValue()) === 'K') {
        await page.locator(`[name="vatType${i}"]`).selectOption('S');
        await setField(page, `vatRate${i}`, '21');
      }
    }
    await recalc(page);
    const xml = await saveClean(page);
    expect(xml).toContain('VATEX-EU-G');
    await expectAnafOk(request, xml, 'export G');
  });

  test('nota de credit 381 (fixture)', async ({ page, request }) => {
    await openWithFixture(page, 'nota-credit-381.xml');
    await expectAnafOk(request, await saveClean(page), 'nota-credit-381');
  });

  test('stornare printr-un buton Stornează (380 cu cantitati negative + BillingReference)', async ({ page, request }) => {
    await openWithFixture(page, 'factura-baza.xml');
    await page.getByRole('button', { name: 'Stornează' }).click();
    const xml = await saveClean(page);
    expect(xml).toMatch(/<Invoice\b[\s\S]*<cbc:InvoiceTypeCode>380</);
    expect(xml).toContain('<cac:BillingReference>');
    await expectAnafOk(request, xml, 'stornare factura-baza');
  });

  test('reducere + taxa la nivel de document si discount pe linie', async ({ page, request }) => {
    await openWithFixture(page, 'factura-baza.xml');
    await page.fill('[name="lineDiscount0"]', '20');
    await page.getByRole('button', { name: 'Adaugă Reducere/Taxă' }).click();
    await page.selectOption('[name="chargeType0"]', 'false');
    await setField(page, 'chargeAmount0', '25');
    await page.selectOption('[name="chargeVatType0"]', 'S');
    await setField(page, 'chargeVatRate0', '21');
    await page.getByRole('button', { name: 'Adaugă Reducere/Taxă' }).click();
    await setField(page, 'chargeAmount1', '10');
    await page.selectOption('[name="chargeVatType1"]', 'S');
    await setField(page, 'chargeVatRate1', '11');
    await recalc(page);
    const xml = await saveClean(page);
    expect(xml.match(/<cbc:ChargeIndicator>/g)?.length).toBeGreaterThanOrEqual(3);
    await expectAnafOk(request, xml, 'allowance + charge + discount linie');
  });

  test('moneda straina EUR, TaxCurrencyCode RON, curs 5 (TVA in RON)', async ({ page, request }) => {
    await openWithFixture(page, 'factura-baza.xml');
    await setField(page, 'documentCurrencyCode', 'EUR');
    await setField(page, 'taxCurrencyCode', 'RON');
    await setField(page, 'exchangeRate', '5');
    await expectAnafOk(request, await saveClean(page), 'EUR cu TVA in RON');
  });

  test('furnizor neplatitor de TVA, categoria O', async ({ page, request }) => {
    await openWithFixture(page, 'factura-baza.xml');
    await setField(page, 'supplierVAT', '12345674');
    await setAllLines(page, 'O');
    const xml = await saveClean(page);
    expect(xml).toContain('VATEX-EU-O');
    await expectAnafOk(request, xml, 'furnizor neplatitor O');
  });

  test('factura noua de la zero (Factura Noua + completare)', async ({ page, request }) => {
    await newInvoiceFilled(page);
    await expectAnafOk(request, await saveClean(page), 'factura noua');
  });

  test('factura noua cu rand gol necompletat la final', async ({ page, request }) => {
    await newInvoiceFilled(page);
    await addLine(page);
    const xml = await saveClean(page);
    expect(xml.match(/<cac:InvoiceLine>/g)).toHaveLength(1);
    await expectAnafOk(request, xml, 'factura noua cu rand gol');
  });

  test('factura noua cu mai multe linii si cote diferite', async ({ page, request }) => {
    await newInvoiceFilled(page);
    await addLine(page, { description: 'Produs cota redusa', quantity: '3', price: '10', vatRate: '11' });
    await addLine(page, { description: 'Produs scutit', quantity: '1', price: '40', vatType: 'Z' });
    await expectAnafOk(request, await saveClean(page), 'factura noua multi-cota');
  });
});

// Fixture-uri INTENTIONAT invalide la ANAF (cazuri de test pentru regulile BR din aplicatie): se verifica doar ca
// round-trip-ul lor ramane nok cu codul asteptat; toate celelalte trebuie sa fie ok.
const INTENTIONAT_INVALIDE: Record<string, string> = {
  'test/e2e/fixtures/factura-k-g.xml': 'BR-IC-11',
  'test/e2e/fixtures/user-brco15-3rows.xml': 'BR-S-08',
};
// Fisiere pe care ANAF le respinge ca XML (nu au prolog valid), deci nu intra in round-trip.
const NEINCARCABILE = new Set<string>(['docs/efactura_cu_BT_descriere.xml']);

const repoRoot = path.resolve(__dirname, '../../..');
function collect(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? collect(p) : e.name.endsWith('.xml') ? [p] : [];
  });
}
const allXml = [
  ...collect(path.join(repoRoot, 'docs')),
  ...collect(path.join(repoRoot, 'test/fixtures')),
  ...collect(path.join(repoRoot, 'test/e2e/fixtures')),
].map(p => path.relative(repoRoot, p).replace(/\\/g, '/')).sort();

test.describe('round-trip fixture -> aplicatie -> ANAF real', () => {
  for (const rel of allXml) {
    if (NEINCARCABILE.has(rel)) continue;
    test(`round-trip ${rel}`, async ({ page, request }) => {
      await openApp(page);
      await loadXmlFile(page, path.join(repoRoot, rel));
      const xml = await saveClean(page);
      const expected = INTENTIONAT_INVALIDE[rel];
      if (expected) {
        const r = await anafValidate(request, xml);
        expect(r.stare, `${rel} ar trebui sa ramana invalid`).toBe('nok');
        expect(r.errors.map(e => e.cod)).toContain(expected);
      } else {
        await expectAnafOk(request, xml, rel);
      }
    });
  }
});
