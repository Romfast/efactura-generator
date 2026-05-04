# Changelog

## 0.9-beta-11 - 04.05.2026

### Bugfixes
- Fixed: Lookup CIF ANAF nu mai funcționa — migrat la API v9 (PlatitorTvaRest) care a înlocuit v8-ul async.

### Modifications
- Added: Documentație rulare locală și Docker în README.

## 0.9-beta-10 - 30.04.2026

### New Features
- Added: Import bulk — se pot încărca mai multe fișiere XML (sau ZIP) simultan. Un sidebar afișează lista fișierelor deschise; fișierele modificate sunt marcate vizual. Limită 50 fișiere.

## 0.9-beta-9 - 30.04.2026

### New Features
- Added: Catalog produse local — articolele pot fi salvate în catalogul browserului și refolosite prin autocomplete la câmpul „Denumire" pe orice linie factură.

## 0.9-beta-8 - 30.04.2026

### New Features
- Added: Numerotare automată facturi — buton „Factură Nouă" generează numărul următor din serie configurată (ex. `RFT2026-0042`). La trecerea anului, aplicația întreabă dacă se continuă seria sau se resetează contorul la 1.

## 0.9-beta-7 - 30.04.2026

### New Features
- Added: Descărcare PDF direct din browser, fără server — buton „Descarcă PDF" în header și în paginile de printare.

## 0.9-beta-6 - 30.04.2026

### New Features
- Added: Validare XML la ANAF — buton „Validare ANAF" trimite factura la serverul ANAF și afișează erorile returnate (disponibil doar când receiver.php este activ).
- Added: Lookup CIF ANAF — buton „Caută CIF" lângă câmpurile cod TVA completează automat numele, adresa și numărul de înregistrare al firmei.

## 0.9-beta-5 - 30.04.2026

### New Features
- Added: Încărcare ZIP — fișierele ZIP cu XML eFactura pot fi încărcate direct (prin buton sau drag-and-drop); primul XML din arhivă este extras automat.
- Added: Redesign vizual complet — font Geist, paletă warm-paper cu header slate, spațiere și contrast îmbunătățite.
- Added: Profil furnizor — datele furnizorului pot fi salvate în browser și refolosite la facturi noi cu un singur click.
- Added: Tip factură — câmp nou pentru tipul documentului: factură comercială, notă de credit, factură corectată sau autofactură.
- Added: Modalități de plată — secțiune nouă cu unul sau mai multe rânduri cod plată + IBAN.
- Added: Referință factură originală — câmpuri pentru numărul și data facturii la care se referă storno-ul; completate automat la apăsarea „Stornează".
- Added: Validare matematică inline — badge verde/roșu pe fiecare linie și la total, arată dacă valorile sunt consistente. La salvare apare un avertisment dacă există diferențe.
- Added: Validare CIF/CUI pe blur — eroare inline dacă cifra de control nu este corectă.
- Added: Validare IBAN pe blur — eroare inline dacă IBAN-ul are lungime sau check digits incorecte.
- Added: Panel reguli CIUS-RO — panou flotant cu lista erorilor de conformitate față de standardul eFactura, actualizat în timp real. Click pe o eroare navighează la câmpul problematic.

### Bugfixes
- Fixed: Funcția „Stornează" lăsa valorile interne inconsistente față de ce era afișat în formular.

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
