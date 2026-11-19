import { Page, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

export const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');
export const DOCS_DIR = path.resolve(__dirname, '../../../docs');
export const fx = (name: string) => path.join(FIXTURES_DIR, name);

/** Deschide aplicatia (formular gol) si asteapta initializarea UI. */
export async function openApp(page: Page) {
  await page.goto('/');
  await page.waitForFunction(() => typeof (window as any).saveXML === 'function' && !!(window as any).addLineItem);
}

/** Incarca un XML prin input-ul de fisiere si asteapta liniile. */
export async function loadXmlFile(page: Page, file: string | string[]) {
  await page.locator('#fileInput').setInputFiles(file);
  await page.locator('#lineItems .line-item').first().waitFor({ state: 'visible', timeout: 15000 });
}

/** Deschide aplicatia si incarca o fixture din test/e2e/fixtures. */
export async function openWithFixture(page: Page, name = 'factura-baza.xml') {
  await openApp(page);
  await loadXmlFile(page, fx(name));
}

export interface SaveResult { xml: string; alerts: string[]; }

/** Click pe "Salveaza XML"; intoarce continutul XML descarcat. */
export async function saveXml(page: Page): Promise<SaveResult> {
  const alerts: string[] = [];
  const onDialog = async (d: any) => { alerts.push(d.message()); await d.dismiss(); };
  page.on('dialog', onDialog);
  try {
    const dl = page.waitForEvent('download', { timeout: 8000 });
    await page.getByRole('button', { name: 'Salvează XML' }).click();
    const download = await dl;
    const p = await download.path();
    return { xml: fs.readFileSync(p!, 'utf8'), alerts };
  } finally {
    page.off('dialog', onDialog);
  }
}

export interface XmlNode { text: string; attrs: Record<string, string>; }

/** Interogare CSS pe un XML; selectoarele folosesc numele locale, fara prefix (ex. 'AllowanceCharge > Amount'). */
export async function xmlQuery(page: Page, xml: string, selector: string): Promise<XmlNode[]> {
  return page.evaluate(([x, sel]) => {
    const doc = new DOMParser().parseFromString(x, 'text/xml');
    return Array.from(doc.querySelectorAll(sel)).map(e => ({
      text: (e.textContent || '').trim(),
      attrs: Object.fromEntries(Array.from(e.attributes).map(a => [a.name, a.value])),
    }));
  }, [xml, selector] as [string, string]);
}

export async function xmlTexts(page: Page, xml: string, selector: string): Promise<string[]> {
  return (await xmlQuery(page, xml, selector)).map(n => n.text);
}

/** Parseaza un numar afisat in format local (1.234,56 sau 1,234.56 sau 12,50). */
export function parseDisplayed(s: string): number {
  const t = s.replace(/[\s ]/g, '');
  const m = t.match(/^(-?[\d.,]*?)([.,](\d{1,4}))?$/);
  if (!m) return NaN;
  const intPart = (m[1] || '').replace(/[.,]/g, '');
  return parseFloat(intPart + (m[3] ? '.' + m[3] : ''));
}

export interface Totals { subtotal: number; allowances: number; charges: number; net: number; vat: number; total: number; }

export async function readTotals(page: Page): Promise<Totals> {
  const get = async (id: string) => parseDisplayed((await page.locator('#' + id).textContent()) || '');
  return {
    subtotal: await get('subtotal'),
    allowances: await get('totalAllowances'),
    charges: await get('totalCharges'),
    net: await get('netAmount'),
    vat: await get('vat'),
    total: await get('total'),
  };
}

/** Seteaza valoarea unui camp (name=) si declanseaza input+change+blur. */
export async function setField(page: Page, name: string, value: string) {
  const loc = page.locator(`[name="${name}"]`);
  await loc.fill(value);
  await loc.dispatchEvent('change');
  await loc.blur();
}

export const getField = (page: Page, name: string) => page.locator(`[name="${name}"]`).inputValue();

/** Colecteaza erorile JS necontrolate de pe pagina. */
export function trackPageErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on('pageerror', e => errs.push(String(e)));
  return errs;
}

export function expectNoErrors(errs: string[]) {
  expect(errs, `Erori JS: ${errs.join('; ')}`).toHaveLength(0);
}

/** Ruleaza specificatia doar pe proiectul local (nu pe prod). */
export function localOnly(t: { beforeEach: (fn: (args: any, testInfo: any) => void) => void; skip: (...a: any[]) => void }) {
  t.beforeEach(async ({}, testInfo) => {
    if (testInfo.project.name !== 'local') t.skip();
  });
}

/** Apasa "Recalculeaza Totaluri" (ocoleste totalurile intarziate dupa change, vezi BUG din allowances-charges.spec). */
export async function recalc(page: Page) {
  await page.getByRole('button', { name: 'Recalculează Totaluri' }).click();
}

/** Seteaza un camp numeric (linie/reducere) si forteaza recalcularea prin butonul "Recalculeaza Totaluri". */
export async function setNum(page: Page, name: string, value: string) {
  await setField(page, name, value);
  await recalc(page);
}
