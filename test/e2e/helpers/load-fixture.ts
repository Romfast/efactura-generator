import { Page } from '@playwright/test';
import * as path from 'path';

const DOCS_DIR = path.resolve(__dirname, '../../../docs');

export async function loadFixture(page: Page, filename: string): Promise<void> {
  const fixturePath = path.join(DOCS_DIR, filename);
  await page.locator('#fileInput').setInputFiles(fixturePath);
  // Wait for parse to complete: form sections become visible
  await page.locator('#basicDetails').waitFor({ state: 'visible', timeout: 10000 });
}
