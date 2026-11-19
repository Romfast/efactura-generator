import { defineConfig } from '@playwright/test';

const E2E_PORT = process.env.E2E_PORT ?? '3917';
const E2E_PHP_PORT = process.env.E2E_PHP_PORT ?? '8917';
const LOCAL_URL = `http://localhost:${E2E_PORT}`;
// Tinta suitei post-deploy (smoke-live). Implicit: GitHub Pages. Se poate suprascrie cu LIVE_URL.
const LIVE_URL = process.env.LIVE_URL ?? 'https://romfast.github.io/efactura-generator/';

// receiver.spec.ts citeste RECEIVER_URL din helpers/env.ts (derivat din E2E_PHP_PORT)
process.env.E2E_PHP_PORT = E2E_PHP_PORT;

// smoke-live singur, pe alta tinta decat localhost: nu porni serverele locale
const projArgs = process.argv.filter(a => a.startsWith("--project="));
const LIVE_ONLY = projArgs.length > 0 && projArgs.every(a => a === "--project=smoke-live") && !/localhost|127.0.0.1/.test(LIVE_URL);

const VISUAL_VIEWPORT = { width: 1280, height: 900 };

export default defineConfig({
  testDir: './tests',
  // baseline-urile vizuale: test/e2e/visual-baselines/<nume>.png (fara sufix de proiect/OS, citibil)
  snapshotPathTemplate: '{snapshotDir}/../visual-baselines/{arg}{ext}',
  workers: process.env.E2E_WORKERS ? Number(process.env.E2E_WORKERS) : 4,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.002,
    },
  },
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    // functional + pagini de browser (test/*.html prin browser-pages.spec.ts)
    { name: 'local', use: { baseURL: LOCAL_URL } },
    // regresie vizuala: viewport/locale/fus orar fixe
    {
      name: 'visual',
      testDir: './visual',
      use: {
        baseURL: LOCAL_URL,
        viewport: VISUAL_VIEWPORT,
        locale: 'ro-RO',
        timezoneId: 'Europe/Bucharest',
        deviceScaleFactor: 1,
        colorScheme: 'light',
      },
    },
    // post-deploy, DOAR citire: ruleaza explicit cu `npm run smoke:live` (tinta: LIVE_URL)
    { name: 'smoke-live', testDir: './live', use: { baseURL: LIVE_URL } },
    { name: 'prod-roa',     use: { baseURL: 'https://efactura.roa.romfast.ro' } },
    { name: 'prod-romfast', use: { baseURL: 'https://romfast.ro/efactura-generator' } },
  ],
  webServer: LIVE_ONLY ? undefined : [
    {
      command: 'node js/server.js',
      url: LOCAL_URL,
      env: { PORT: E2E_PORT },
      reuseExistingServer: true,
      cwd: '../..',
    },
    {
      command: `php -S localhost:${E2E_PHP_PORT}`,
      url: `http://localhost:${E2E_PHP_PORT}/receiver.php?action=ping`,
      reuseExistingServer: true,
      cwd: '../..',
    },
  ],
});
