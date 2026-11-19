import { defineConfig } from '@playwright/test';

const E2E_PORT = process.env.E2E_PORT ?? '3917';
const LOCAL_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: './tests',
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'local',        use: { baseURL: LOCAL_URL } },
    { name: 'prod-roa',     use: { baseURL: 'https://efactura.roa.romfast.ro' } },
    { name: 'prod-romfast', use: { baseURL: 'https://romfast.ro/efactura-generator' } },
  ],
  webServer: [
    {
      command: 'node js/server.js',
      url: LOCAL_URL,
      env: { PORT: E2E_PORT },
      reuseExistingServer: true,
      cwd: '../..',
    },
    {
      command: 'php -S localhost:8000',
      url: 'http://localhost:8000/receiver.php?action=ping',
      reuseExistingServer: true,
      cwd: '../..',
    },
  ],
});
