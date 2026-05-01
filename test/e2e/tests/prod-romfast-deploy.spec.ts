import { test, expect } from '@playwright/test';

test.describe('prod-romfast deploy checks', () => {
  test('receiver.php executes PHP — not raw source served', async ({ request }, testInfo) => {
    if (testInfo.project.name !== 'prod-romfast') {
      test.skip();
      return;
    }
    // SECURITY: dacă content-type != json sau body != valid JSON,
    // PHP probabil servit ca text/plain → api_key + config.json path expuse public!
    const r = await request.get('https://romfast.ro/efactura-generator/receiver.php?action=ping', { timeout: 10000 });
    expect(r.status()).toBe(200);
    expect(r.headers()['content-type'] ?? '').toContain('application/json');
    expect(await r.json()).toMatchObject({ pong: true });
  });

  test('static assets reachable', async ({ request }, testInfo) => {
    if (testInfo.project.name !== 'prod-romfast') {
      test.skip();
      return;
    }
    for (const p of ['/index.html', '/js/script.js', '/styles/main.css']) {
      const r = await request.head(`https://romfast.ro/efactura-generator${p}`, { timeout: 10000 });
      expect(r.status(), `Asset ${p} trebuie să returneze 200`).toBe(200);
    }
  });
});
