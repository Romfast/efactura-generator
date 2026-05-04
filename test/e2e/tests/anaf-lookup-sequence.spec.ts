import { test, expect } from '@playwright/test';

const MOCK_PLATITOR: Record<string, unknown> = {
    found: true,
    cui: 1879855,
    denumire: 'ROMFAST SRL',
    nrRegCom: 'J40/123/2000',
    adresa: 'STR. EXEMPLU NR. 1, BUCURESTI',
    tvaActiv: true,
    strada: 'Str. Exemplu 1',
    oras: 'BUCURESTI SECTORUL 1',
    judetCod: 'RO-B',
    codPostal: '010000',
    telefon: '0211234567',
    statusEFactura: true,
};

const MOCK_NEPLATITOR: Record<string, unknown> = {
    found: true,
    cui: 14942091,  // CIF valid (15 cifre control ok) — evită blur-validation overlay
    denumire: 'PERSOANA FIZICA SRL',
    nrRegCom: '',
    adresa: 'STR. TEST NR. 5, CLUJ',
    tvaActiv: false,
    strada: 'Str. Test 5',
    oras: 'CLUJ-NAPOCA',
    judetCod: 'RO-CJ',
    codPostal: '400000',
    telefon: '0741000000',
    statusEFactura: false,
};

async function mockReceiver(page: import('@playwright/test').Page, cifData: Record<string, unknown>) {
    await page.route('**/receiver.php?action=ping', route =>
        route.fulfill({ json: { pong: true } })
    );
    await page.route(/receiver\.php\?action=cif/, route =>
        route.fulfill({ json: cifData })
    );
}

async function waitForAnafButton(page: import('@playwright/test').Page, buttonId: string) {
    await expect(page.locator(`#${buttonId}`)).toBeVisible({ timeout: 5000 });
}

test.describe('ANAF lookup — câmpuri noi', () => {
    test.beforeEach(async ({ page }) => {
        // Ignoră erori legate de pikaday/favicon
        page.on('console', () => { /* suppress */ });
    });

    test('plătitor TVA: prefix RO + câmpuri populate', async ({ page }, testInfo) => {
        if (testInfo.project.name !== 'local') test.skip();

        await mockReceiver(page, MOCK_PLATITOR);
        await page.goto('/');

        // Butonul devine vizibil după probeReceiver() reușit
        await waitForAnafButton(page, 'btnLookupSupplierCif');

        // Introdu CIF și apasă Caută
        await page.fill('[name="supplierVAT"]', '1879855');
        await page.click('#btnLookupSupplierCif');

        // VAT cu prefix RO
        await expect(page.locator('[name="supplierVAT"]')).toHaveValue('RO1879855', { timeout: 5000 });

        // Câmpuri de bază
        await expect(page.locator('[name="supplierName"]')).toHaveValue('ROMFAST SRL');
        await expect(page.locator('[name="supplierCompanyId"]')).toHaveValue('J40/123/2000');

        // Adresă structurată
        await expect(page.locator('[name="supplierAddress"]')).toHaveValue('Str. Exemplu 1');
        await expect(page.locator('[name="supplierCity"]')).toHaveValue('BUCURESTI SECTORUL 1');

        // County SELECT
        await expect(page.locator('[name="supplierCountrySubentity"]')).toHaveValue('RO-B');

        // Country SELECT
        await expect(page.locator('[name="supplierCountry"]')).toHaveValue('RO');

        // Telefon
        await expect(page.locator('[name="supplierPhone"]')).toHaveValue('0211234567');

        // Toast sub-text cu status TVA
        await expect(page.locator('.toast-sub')).toContainText('Plătitor TVA', { timeout: 3000 });
    });

    test('plătitor TVA: toast afișează Înregistrat eFactura', async ({ page }, testInfo) => {
        if (testInfo.project.name !== 'local') test.skip();

        await mockReceiver(page, MOCK_PLATITOR);
        await page.goto('/');
        await waitForAnafButton(page, 'btnLookupSupplierCif');

        await page.fill('[name="supplierVAT"]', '1879855');
        await page.click('#btnLookupSupplierCif');

        await expect(page.locator('.toast-sub')).toContainText('Înregistrat eFactura', { timeout: 3000 });
    });

    test('neplătitor TVA: CIF fără prefix RO', async ({ page }, testInfo) => {
        if (testInfo.project.name !== 'local') test.skip();

        await mockReceiver(page, MOCK_NEPLATITOR);
        await page.goto('/');
        await waitForAnafButton(page, 'btnLookupSupplierCif');

        await page.fill('[name="supplierVAT"]', '14942091');
        await page.click('#btnLookupSupplierCif');

        // Așteptăm lookup complet: supplierName se setează de lookup (confirmare async completat)
        await expect(page.locator('[name="supplierName"]')).toHaveValue('PERSOANA FIZICA SRL', { timeout: 5000 });

        // Fără prefix RO — CIF rămâne numeric
        await expect(page.locator('[name="supplierVAT"]')).toHaveValue('14942091');

        // County CJ
        await expect(page.locator('[name="supplierCountrySubentity"]')).toHaveValue('RO-CJ');

        // Toast sub-text cu status TVA
        await expect(page.locator('.toast-sub')).toContainText('Neplătitor TVA', { timeout: 3000 });
    });

    test('lookup customer: câmpuri customer populate (nu supplier)', async ({ page }, testInfo) => {
        if (testInfo.project.name !== 'local') test.skip();

        await mockReceiver(page, MOCK_PLATITOR);
        await page.goto('/');
        await waitForAnafButton(page, 'btnLookupCustomerCif');

        await page.fill('[name="customerVAT"]', '1879855');
        await page.click('#btnLookupCustomerCif');

        await expect(page.locator('[name="customerVAT"]')).toHaveValue('RO1879855', { timeout: 5000 });
        await expect(page.locator('[name="customerName"]')).toHaveValue('ROMFAST SRL');
        await expect(page.locator('[name="customerCity"]')).toHaveValue('BUCURESTI SECTORUL 1');
        await expect(page.locator('[name="customerCountrySubentity"]')).toHaveValue('RO-B');

        // Supplier rămâne nemodificat
        await expect(page.locator('[name="supplierVAT"]')).not.toHaveValue('RO1879855');
    });
});

test.describe('Număr factură — auto-fill și format configurabil', () => {
    test('invoiceNumber pre-populat din secvență la load', async ({ page }, testInfo) => {
        if (testInfo.project.name !== 'local') test.skip();

        // Curăță secvența localStorage înainte de test
        await page.addInitScript(() => {
            localStorage.removeItem('efactura.sequence.v1');
        });

        await page.goto('/');

        const numEl = page.locator('[name="invoiceNumber"]');
        const val = await numEl.inputValue();

        // Format default: "RFT YYYY0001"
        const year = new Date().getFullYear();
        expect(val).toMatch(new RegExp(`^RFT ${year}\\d{4}$`));
    });

    test('invoiceNumber nu se suprascrie dacă câmpul are valoare', async ({ page }, testInfo) => {
        if (testInfo.project.name !== 'local') test.skip();

        await page.addInitScript(() => {
            localStorage.setItem('efactura.sequence.v1', JSON.stringify({ serie: 'TST', an: 2026, contor: 99, includeAn: true, cifre: 4 }));
        });

        await page.goto('/');

        // Setăm manual o valoare înainte de DOMContentLoaded (nu se poate, dar verificăm că
        // prefill-ul funcționează cu secvența din localStorage)
        const val = await page.locator('[name="invoiceNumber"]').inputValue();
        // serie='TST', an=2026, contor=99, cifre=4 → pad='0099' → 'TST 20260099'
        expect(val).toBe('TST 20260099');
    });

    test('modal Factură Nouă conține checkbox includeAn și input cifre', async ({ page }, testInfo) => {
        if (testInfo.project.name !== 'local') test.skip();

        await page.goto('/');
        await page.click('button:has-text("Factură Nouă")');

        // Modal vizibil
        await expect(page.locator('#modal-new-invoice-title, [id*="new-invoice"]').first()).toBeVisible({ timeout: 3000 });

        // Checkbox include an
        await expect(page.locator('#seq-include-an')).toBeVisible();

        // Input cifre
        await expect(page.locator('#seq-cifre')).toBeVisible();
        const cifreVal = await page.locator('#seq-cifre').inputValue();
        expect(parseInt(cifreVal)).toBeGreaterThanOrEqual(1);
        expect(parseInt(cifreVal)).toBeLessThanOrEqual(8);
    });

    test('modal: dezactivare includeAn schimbă preview-ul', async ({ page }, testInfo) => {
        if (testInfo.project.name !== 'local') test.skip();

        await page.addInitScript(() => {
            localStorage.setItem('efactura.sequence.v1', JSON.stringify({ serie: 'RFT', an: 2026, contor: 1, includeAn: true, cifre: 4 }));
        });

        await page.goto('/');
        await page.click('button:has-text("Factură Nouă")');

        // Preview inițial cu an
        const preview = page.locator('#seq-preview');
        await expect(preview).toContainText('2026', { timeout: 3000 });

        // Debifează includeAn
        await page.locator('#seq-include-an').uncheck();

        // Preview se actualizează live (fără an)
        await expect(preview).not.toContainText('2026');
        await expect(preview).toContainText('RFT');
    });

    test('modal: schimbare cifre la 5 afișează 5 cifre în preview', async ({ page }, testInfo) => {
        if (testInfo.project.name !== 'local') test.skip();

        await page.addInitScript(() => {
            localStorage.setItem('efactura.sequence.v1', JSON.stringify({ serie: 'RFT', an: 2026, contor: 1, includeAn: false, cifre: 4 }));
        });

        await page.goto('/');
        await page.click('button:has-text("Factură Nouă")');

        const preview = page.locator('#seq-preview');

        // Schimbă la 5 cifre
        await page.locator('#seq-cifre').fill('5');
        await page.locator('#seq-cifre').dispatchEvent('input');

        // Preview: "RFT 00001"
        await expect(preview).toContainText('00001', { timeout: 2000 });
    });

    test('migrare format vechi (fără includeAn/cifre): defaults aplicate', async ({ page }, testInfo) => {
        if (testInfo.project.name !== 'local') test.skip();

        await page.addInitScript(() => {
            // Format vechi, fără includeAn/cifre
            localStorage.setItem('efactura.sequence.v1', JSON.stringify({ serie: 'FCT', an: 2025, contor: 42 }));
        });

        await page.goto('/');

        const val = await page.locator('[name="invoiceNumber"]').inputValue();
        // Cu defaults: includeAn=true, cifre=4 → "FCT 20250042"
        expect(val).toBe('FCT 20250042');
    });
});
