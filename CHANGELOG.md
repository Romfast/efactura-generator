# Changelog

## 0.9-beta-5 (în pregătire) - 30.04.2026

### New Features
- Added: Componente vizuale noi documentate în `DESIGN.md` și implementate în `styles/main.css` (PR-CSS / D17): `.toast` / `.toast-container` (notificări sistem cu border-left semantic), `.drop-zone` (empty state pentru încărcare XML cu hover state primary-soft), `.spinner-mono` (spinner inline braille `⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏` la 80ms/frame pentru stările loading ANAF). Toate respectă posture industrial / utilitarian — zero icons, text-only.

### Modifications
- Refactored: `styles/main.css` migrat integral la sistemul de tokens DESIGN.md (PR-CSS / D16). Înlocuită paleta legacy (`#0056b3` primary, `#f0f2f5` cool gray bg) cu `:root` tokens (`--bg: #fafaf9` warm paper, `--header-bg: #0f172a` slate-900, `--primary: #1e40af` blue-700, plus full warm stone neutrals și semantic colors). Border-radius ierarhic (`--radius-sm` 4px input/button/badge, `--radius-md` 6px card, `--radius-lg` 8px modal) — eliminat 8px uniform legacy. Header migrat la slate-900 cu butoane ghost. Cards pe `border + --shadow-card` subtle (eliminat heavy box-shadow SaaS-style). Adăugate clasele utilitare `.mono` / `.num` cu `font-family: 'Geist Mono'` + `tabular-nums` + `text-align: right`. `:focus-visible` ring `2px var(--primary)` pe toate interactive. Adăugate `.badge` (ok/warn/error), `.alert` (info/success/warn/error border-left 3px), responsive ≤720px breakpoint cu touch-targets 40px+.
- Modified: `index.html` (PR-CSS) — adăugate Bunny Fonts (`<link rel="preconnect">` + Geist 400/500/600/700 + Geist Mono 400/500/600). Eliminat tag duplicat `</head>` legacy. Aplicate clase `.num` pe câmpurile de date (issueDate, dueDate) și `.mono` pe câmpurile cu valori cod / identificare (invoiceNumber, supplierVAT, supplierCompanyId, supplierPhone, customerVAT, customerCompanyId, customerPhone, documentCurrencyCode, taxCurrencyCode).
- Modified: `js/script.js` (PR-CSS) — markup-ul dinamic generat în `createLineItemHTML`, `createAllowanceChargeHTML` și `addVATBreakdownRow` a primit clasa `.num` pe toate input-urile numerice (quantity, price, lineDiscount, vatRate, chargeAmount, chargeBaseAmount, chargeVatRate, vat-rate, vat-base, vat-amount). Niciun parseFloat / format logic atins — refactorul afectează doar prezentarea (mono + tabular-nums + right align).
- Added: `DESIGN.md` (PR-CSS) — secțiuni noi pentru Toast, Drop-zone și Spinner Mono cycle (per D17). Tabel decisions log extins.
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
