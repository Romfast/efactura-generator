import { test as base, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export { expect };
export type { Page, Locator, BrowserContext, TestInfo } from '@playwright/test';

// Cache pe disc pentru resursele CDN (fonturi Geist de la bunny.net, Pikaday de la cdnjs):
// prima rulare le descarca, urmatoarele nu mai depind de retea -> teste stabile si rapide.
const CACHE_DIR = path.resolve(__dirname, '../.cdn-cache');
const CDN_RE = /^https:\/\/(fonts\.bunny\.net|cdnjs\.cloudflare\.com)\//;

export async function installCdnCache(context: import('@playwright/test').BrowserContext) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  await context.route(CDN_RE, async route => {
    const url = route.request().url();
    const key = crypto.createHash('sha1').update(url).digest('hex');
    const metaFile = path.join(CACHE_DIR, key + '.json');
    const bodyFile = path.join(CACHE_DIR, key + '.bin');
    if (fs.existsSync(metaFile) && fs.existsSync(bodyFile)) {
      const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
      return route.fulfill({ status: meta.status, headers: meta.headers, body: fs.readFileSync(bodyFile) });
    }
    try {
      const resp = await route.fetch();
      const body = await resp.body();
      if (resp.status() === 200) {
        const headers: Record<string, string> = {
          'content-type': resp.headers()['content-type'] ?? 'application/octet-stream',
          'access-control-allow-origin': '*',
        };
        const tmp = `${bodyFile}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, body);
        fs.renameSync(tmp, bodyFile);
        fs.writeFileSync(metaFile, JSON.stringify({ status: 200, headers }));
      }
      return route.fulfill({ response: resp, body });
    } catch {
      return route.abort();
    }
  });
}

/** `test` cu cache CDN pe fiecare context; folosit de toate spec-urile. */
export const test = base.extend({
  context: async ({ context }, use) => {
    await installCdnCache(context);
    await use(context);
  },
});
