import { Page, BrowserContext, Locator, expect } from '@playwright/test';
import * as path from 'path';
import { openApp, loadXmlFile, fx } from './app';

export const FIXED_NOW = new Date('2026-03-15T10:00:00+02:00');
export const STABLE_CSS = path.resolve(__dirname, '../visual/stable.css');

/** Optiuni comune pentru toHaveScreenshot (versiunea si toast-urile sunt ascunse prin stable.css). */
export const shotOpts = { stylePath: STABLE_CSS, animations: 'disabled' as const, caret: 'hide' as const };

/** Ingheata ceasul, blocheaza window.print, deschide aplicatia si asteapta fonturile. */
export async function openStable(page: Page, context: BrowserContext) {
  await context.clock.setFixedTime(FIXED_NOW);
  await context.addInitScript(() => { window.print = () => {}; });
  await openApp(page);
  await waitFonts(page);
}

export async function waitFonts(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([
      document.fonts.load('400 14px Geist'), document.fonts.load('600 14px Geist'), document.fonts.load('500 14px "Geist Mono"'),
    ].map(p => p.catch(() => [])));
    await document.fonts.ready;
  });
  // doua cadre de redesenare, ca layout-ul sa se stabilizeze
  await page.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
}

export async function openStableWithFixture(page: Page, context: BrowserContext, name = 'factura-baza.xml') {
  await openStable(page, context);
  await loadXmlFile(page, fx(name));
  await waitFonts(page);
}

export async function shot(page: Page | Locator, name: string, opts: { fullPage?: boolean } = {}) {
  if ('goto' in page) await waitFonts(page as Page);
  await expect(page as any).toHaveScreenshot(name + '.png', { ...shotOpts, ...opts });
}
