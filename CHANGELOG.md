# Changelog

## 0.9-beta-5 (în pregătire) - 30.04.2026

### New Features
- Added: Încărcare ZIP cu XML eFactura prin drag-and-drop sau prin câmpul de fișier (PR-ZIP / A1). Detecție pe magic bytes `PK\x03\x04` în primele 4 octeți; primul `.xml` din arhivă (sortat alfabetic) este extras și pasat către `parseXML`. Fallback la încărcarea XML simplu rămâne intact. Vendored `js/vendor/jszip.mjs` (JSZip 3.10.1, build ESM jsdelivr, ~117KB raw / ~35KB gzipped) — import nativ ESM fără bundler. Drag-and-drop wireuit pe `document.body` cu clasa `.drag-over` disponibilă pentru styling. Mesajele de eroare (alert) în română. Atributul `accept` pe `#fileInput` extins cu `.zip,application/zip,application/x-zip-compressed`. `.htaccess.template` extins cu MIME `text/javascript` pentru `.mjs` și `js/server.js` ditto, pentru import ESM corect peste Apache și dev server.

### Modifications
- Added: `DESIGN.md` — sistem de design formal pentru editor (industrial/utilitarian, Geist + Geist Mono, paletă warm-paper + slate-900 header, border-radius hierarchic, anti-SaaS-chrome posture). Decizii bazate pe research competitive (SmartBill, Oblio, B2BRouter, e-invoice.be) și principiul "respectă timpul contabilului".
- Modified: `CLAUDE.md` — adăugată secțiunea "Design System" care indică DESIGN.md ca sursă autoritativă pentru orice decizie UI înainte de implementarea Track 1 + Track 2 D.

## 0.9-beta-4 - 07.02.2025

### Bugfixes
- Fixed: Al doilea tag TaxTotal se generează doar când valuta documentului diferă de valuta TVA.

## 0.9-beta-3 - 14.01.2025

### Bugfixes
- Fixed: Discounturile de pe articole nu se mai cumulează în discount global pe factură.

### New Features
- Added: Se completează valoare reducere și cod reducere pe fiecare articol.

## 0.9-beta-2 - 07.01.2025

### Bugfixes
- Fixed: Selecția judet București și afișare oraș.

### New Features
- Added: Se completează codul și motivul scutirii în secțiunea "Defalcare TVA" pentru articole cu Tip TVA "E" Neimpozabil.
- Added: S-a tratat cazul în care furnizorul nu este plătitor de TVA (codul fiscal nu are atributul fiscal "RO").
- Added: Citire din xml coduri identificare articole (vânzător, cumpărător, cod de bare, CPV, NC8, vamal).
- Added: Editare, adăugare, ștergere coduri identificare articole.

### Modifications
- Modified: Afișare responsive pentru ecrane de diferite dimensiuni.

### TODO
- Implement: citire și editare referință factura originală pentru factura storno.
- Implement: citire și editare modalități de plată.

## 0.9-beta-1 - 06.01.2025
- Initial beta release.
