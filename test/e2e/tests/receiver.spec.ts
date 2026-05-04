import { test, expect } from '@playwright/test';
import { RECEIVER_URL } from '../helpers/env';

test.describe('receiver.php', () => {
  test('ping returns pong', async ({ request }, testInfo) => {
    if (testInfo.project.name === 'prod-romfast') {
      test.skip();
      return;
    }
    const r = await request.get(`${RECEIVER_URL}/receiver.php?action=ping`, { timeout: 10000 });
    expect(r.status()).toBe(200);
    expect(await r.json()).toMatchObject({ pong: true });
  });

  test('cif lookup', async ({ request }, testInfo) => {
    if (testInfo.project.name === 'prod-romfast') {
      test.skip();
      return;
    }
    if (testInfo.project.name === 'local') {
      // ANAF API (webservicesp.anaf.ro) inaccesibil din mediul de dev local → skip
      test.skip();
      return;
    }
    if (testInfo.project.name === 'prod-roa') {
      test.fail(true, 'Bug 403: receiver.php IP gate (linia 106) blochează proxy requests via Traefik. REMOTE_ADDR = IP intern proxy, nu user. Fix: $publicActions = [\'ping\', \'cif\']');
    }
    const r = await request.get(`${RECEIVER_URL}/receiver.php?action=cif&cif=1879855`, { timeout: 10000 });
    expect(r.status()).toBe(200);
  });

  test('POST fără X-Api-Key returnează 401 sau 403', async ({ request }, testInfo) => {
    if (testInfo.project.name === 'prod-romfast') {
      test.skip();
      return;
    }
    const r = await request.post(`${RECEIVER_URL}/receiver.php`, {
      data: '<dummy/>',
      headers: { 'Content-Type': 'application/xml' },
      timeout: 10000,
    });
    // local: IP whitelist permite 127.0.0.1 → check X-Api-Key → 401
    // prod-roa: IP gate fails first → 403
    expect([401, 403]).toContain(r.status());
  });
});
