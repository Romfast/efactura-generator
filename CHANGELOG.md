# Changelog

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
