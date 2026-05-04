import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'local',        use: { baseURL: 'http://localhost:3000' } },
    { name: 'prod-roa',     use: { baseURL: 'https://efactura.roa.romfast.ro' } },
    { name: 'prod-romfast', use: { baseURL: 'https://romfast.ro/efactura-generator' } },
  ],
  webServer: [
    {
      command: 'node js/server.js',
      url: 'http://localhost:3000',
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
