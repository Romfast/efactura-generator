# Changelog

## 0.9-beta-13 - 04.05.2026

### Bugfixes
- Fixed: la încărcarea unui XML cu furnizor sau client neplătitor de TVA, codul fiscal apărea în câmpul „Nr. înregistrare" iar „Cod TVA" rămânea gol. Acum, dacă firma nu e plătitoare TVA, CIF-ul se completează în „Cod TVA" și numărul de la Registrul Comerțului în „Nr. înregistrare" (simetric cu modul în care se salvează XML-ul).
- Fixed: deploy în Docker/Dokploy returna „Acces interzis" la căutare CIF și validare ANAF, deoarece request-urile veneau prin reverse proxy și apăreau ca venind dintr-un IP intern, nu de la utilizator. Lista de IP-uri permise se poate dezactiva acum (gol sau `*`).

### Modifications
- Configurare receiver prin variabile de mediu (`ANAF_API_KEY`, `ANAF_ALLOWED_IPS`, `ANAF_TOKEN`, `ANAF_TEMP_LIFETIME`) — suprascriu valorile din `config.json`. Util pentru deploy în container fără rebuild la schimbare configurație.
- Dockerfile: setează implicit `ANAF_ALLOWED_IPS=*` (verificare IP dezactivată), potrivit pentru deploy behind reverse proxy unde same-origin asigură deja protecția.

## 0.9-beta-12 - 04.05.2026

### Bugfixes
- Fixed: eroare BR-CO-15 falsă după click pe „Recalculează Totaluri" — defalcarea TVA părea să nu corespundă cu Total TVA, deși matematica era corectă.
- Fixed: eroare BR-16 falsă pe linii cu cantitate fracționară (ex. 1,000 buc) — totalul liniei era marcat greșit ca incorect.
- Fixed: la salvare apărea „completați toate câmpurile obligatorii" chiar când nu se referențiază altă factură. Câmpul „Data factură referită" e opțional și nu mai blochează salvarea când e gol.
- Fixed: „Factură Nouă" — eroare XML declaration duplicată la parsare (`XMLSerializer` include deja `<?xml?>`, codul o prefixa din nou). Strip declaration înainte de concatenare.

### Modifications
- ANAF lookup CIF: completare automată oraș, județ, telefon și prefix `RO` la CIF-ul plătitorilor TVA. Toast indică acum statusul `Plătitor/Neplătitor TVA · Înregistrat eFactura`. Câmpurile `CountrySubentity` (SELECT RO-XX) și `Country` se populează automat.
- Număr factură: pre-populare din secvența localStorage la deschiderea aplicației (fără incrementare contor).
- Număr factură: format configurabil — serie + spațiu + an opțional + contor cu N cifre (1–8). Exemple: `RFT 20260001` (cu an) sau `RFT 0001` (fără an). Modal „Factură Nouă" extins cu checkbox „Include an în număr" și input „Cifre contor".

## 0.9-beta-11 - 04.05.2026

### Bugfixes
- Fixed: Lookup CIF ANAF nu mai funcționa — migrat la API v9 (PlatitorTvaRest) care a înlocuit v8-ul async.

### Modifications
- Added: Documentație rulare locală și Docker în README.
- Added: Script `start.sh` pentru pornire dev (Node :3000 + PHP :8000) cu auto-stop al proceselor existente pe aceste porturi. Banner-ul indică explicit `:8000` pentru testare cu ANAF/receiver, `:3000` pentru testare statică.

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
