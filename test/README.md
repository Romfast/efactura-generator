# Teste efactura-generator

Aplicatia ramane statica; testele stau in `test/` si `test/e2e/`.

## Rulare

Din radacina repo (instaleaza singur dependintele la prima rulare; porneste si opreste serverele node + php):

```
bash test/run.sh                                          # Linux/Mac/Git Bash
powershell -ExecutionPolicy Bypass -File test\run.ps1     # Windows
```

Sau direct: `cd test/e2e && npm test`. Ruleaza: paginile din browser (`test/*.html`), testele functionale
si cele vizuale. Iese cu cod nenul la orice esec. Argumente suplimentare ajung la Playwright
(ex. `bash test/run.sh --grep catalog`).

Porturi (libere, configurabile): `E2E_PORT` (implicit 3917, node), `E2E_PHP_PORT` (implicit 8917, php `receiver.php`).
Nu folosi 3000/8000 (ocupate pe unele masini). Necesita internet la prima rulare (fonturi Geist, Pikaday);
dupa aceea resursele CDN se tin in `test/e2e/.cdn-cache/` (ignorat de git).

Rapoarte: `cd test/e2e && npx playwright show-report` (HTML cu capturi si diferente vizuale, in `playwright-report/`).
Revizuire baseline-uri: `test/e2e/visual-baselines.html` (generat, ignorat de git; `npm run sheet`).

## Smoke dupa deploy (doar citire)

```
cd test/e2e && npm run smoke:live                                   # GitHub Pages
LIVE_URL=https://romfast.ro/efactura-generator/ npm run smoke:live
```

Verifica versiunea (din `index.html`, sau `EXPECT_VERSION`), incarcarea paginii, `?v=` pe css/js, incarcarea unui XML
si totalurile. Cererile non-GET si ANAF sunt blocate. Nu rula proiectele `prod-*` fara cerere explicita.

## Cum adaug un test

Un fisier nou in `test/e2e/tests/*.spec.ts`. Importa `test`/`expect` din `../helpers/test` (adauga cache CDN) si
helperii din `../helpers/ui`:

```ts
import { test, expect } from '../helpers/test';
import { localOnly, openWithFixture, addLine, savedXml, xmlTexts } from '../helpers/ui';
localOnly(test);

test('linie noua ajunge in XML', async ({ page }) => {
  await openWithFixture(page);                       // sau newInvoiceFilled(page), loadZipOf(page, [...])
  await addLine(page, { description: 'X', quantity: '2', price: '10' });
  const xml = await savedXml(page);                  // descarca si intoarce XML-ul salvat
  expect(await xmlTexts(page, xml, 'InvoiceLine > Item > Name')).toContain('X');
});
```

Helperi utili: `fillHeader`, `fillParty`, `addLine`/`fillLine`, `mockReceiver` (ping + ANAF simulat), `makeZip`,
`collectDialogs`, `readTotals`. Fixturi anonimizate in `test/e2e/fixtures` (CUI 12345674 / RO76543210).
ANAF se simuleaza cu `page.route`; apeluri reale doar cu `RUN_ANAF_LIVE=1`. Bug cunoscut = `test.fail(true, 'BUG: ...')`;
cand il repari, scoate `test.fail`. Dupa teste noi actualizeaza `test/e2e/COVERAGE.md`.

## Teste vizuale

`test/e2e/visual/visual.spec.ts`; ceas inghetat (15.03.2026), viewport 1280x900 (mobil 390x844), fonturi asteptate,
versiunea si toast-urile ascunse prin `visual/stable.css`. Baseline-uri comise in `test/e2e/visual-baselines/<nume>.png`
(generate pe Windows/Chromium; alt SO poate da diferente de randare).

Actualizare baseline-uri: `cd test/e2e && npm run test:visual:update` (sau `--update-snapshots -g "<nume test>"`).
Legitim doar cand schimbarea de aspect e intentionata (UI/CSS modificat deliberat): deschide
`visual-baselines.html` si verifica imaginile inainte de commit. Niciodata ca sa "treaca" o diferenta neexplicata.
