# Acoperire UI: element / actiune -> test

Fiecare rand e acoperit de un test care foloseste elementul si verifica rezultatul real (DOM, valori, totaluri,
XML salvat, descarcare). Abrevieri de fisiere (in `test/e2e/tests/`): **hdr** = ui-buttons-header, **frm** = ui-buttons-form,
**li** = line-items, **vat** = vat-breakdown, **ac** = allowances-charges, **pay** = payment-iban-cif,
**ni** = new-invoice, **als** = anaf-lookup-sequence, **am** = anaf-mocked, **pp** = print-pdf, **bulk** = bulk-mode,
**cat** = catalog, **sp** = supplier-profile, **cn** = credit-note, **cnx** = credit-note-xml, **empty** = empty-line, **cur** = currency, **br** = br-validation-user-case, **del** = delivery, **anaf-real** = anaf-validare-reala.
Verificare vizuala: `visual/visual.spec.ts` (vezi sectiunea de la sfarsit).

## Antet si butoane globale (index.html)

| # | Element / actiune | Test |
|---|---|---|
| 1 | Logo Romfast (link, tab nou) | hdr: logo-ul si "Aplicatii online" deschid romfast.ro in tab nou |
| 2 | Buton "Alege Fisier XML / ZIP" | hdr: buton "Alege Fisier XML / ZIP"... |
| 3 | Input fisier: XML, XML multiple, ZIP, ZIP gol, XML invalid | hdr: ZIP cu un XML; ZIP fara XML; fisier care nu e XML valid; bulk: doua fisiere... |
| 4 | Drag-and-drop (dragenter/drop, 1 si 2 fisiere) | hdr: drag-and-drop (2 teste) |
| 5 | Buton "Factura Noua" | hdr: buton "Factura Noua"; ni: modalul se deschide |
| 6 | Buton "Stornează" | hdr: buton "Stornează" pe factura completata; cn: stornare...; storno: storno flips quantities |
| 7 | Buton "Salveaza XML" | hdr: buton "Salveaza XML"...; li: Salveaza XML scrie valoarea editata; li: fara nicio linie |
| 8 | Buton "Actiuni" (deschidere/inchidere: click, in afara, Escape) | pp: meniul Actiuni se deschide/inchide |
| 9 | Actiuni > Printeaza Standard / Compact | pp: Printeaza Standard / Compact |
| 10 | Actiuni > Descarca PDF | pp: Descarca PDF |
| 11 | Actiuni > PDF ANAF / Validare ANAF (vizibile doar cu receiver) | am: fara receiver ascunse; Validare ANAF (succes, erori, HTTP 500); PDF ANAF (pdf, respins) |
| 12 | Ctrl+S | hdr: Ctrl+S; li: scurtaturi Ctrl+N / Ctrl+S |
| 13 | Ctrl+O | hdr: Ctrl+O deschide selectorul |
| 14 | Ctrl+N | li: scurtaturi: Ctrl+N adauga linie |
| 15 | Escape (meniu Actiuni, modal, dropdown catalog) | pp: meniul Actiuni...; ni: Anulare si Escape; cat: Escape inchide dropdown |

## Detalii factura

| # | Element / actiune | Test |
|---|---|---|
| 16 | Numar factura | frm: numar factura si moneda editate |
| 17 | Tip factura (380/381/384/389) | frm: tip factura 380/381/384/389; cn: schimbarea tipului in 384/389 |
| 18 | Data emiterii: tastare, mascare, validare | frm: data tastata; data cu format gresit; implicit azi / +30 zile |
| 19 | Data scadenta | frm: buton calendar dueDate; data tastata |
| 20 | Moneda factura | cur: EUR, minuscule; frm: numar factura si moneda |
| 21 | Moneda TVA + curs valutar | cur: moneda TVA diferita; curs 5 EUR->RON; curs 0 blocheaza |
| 22 | Factura referita (nr.) | frm: calendar data factura referita (BillingReference); cn: round-trip 381; br: salvare fara billingRefDate |
| 23 | Data factura referita | frm: calendar data factura referita |
| 24 | 3 butoane calendar (Pikaday): deschidere, alegere zi, luna +/- | frm: buton calendar issueDate / dueDate; calendar data factura referita; butoanele luna anterioara/urmatoare |
| 25 | Data imposibila (31.02) | frm: **BUG** data imposibila (test.fail) |

## Parti

| # | Element / actiune | Test |
|---|---|---|
| 26 | Furnizor: Nume, CUI, Nr. inreg., Adresa, Oras, Judet, Tara, Telefon, Contact, Email | frm: furnizor si client: fiecare camp ajunge in XML si revine dupa reincarcare |
| 27 | Client: aceleasi 10 campuri | frm: idem (client) |
| 28 | Validare CIF (supplierVAT / customerVAT) | pay: validare CIF in formular (3 teste); frm: Cod TVA/CUI |
| 29 | Buton "Cauta" CIF furnizor / client | als: lookup (furnizor, client, platitor/neplatitor); am: lookupCif negasit |
| 30 | Salveaza profil / Foloseste profil / Sterge profil | sp: toate cele 7 teste |
| 31 | Text aditional + contor N/900 + maxlength | frm: text aditional si contor; nota goala |

## Plati, reduceri/taxe, linii

| # | Element / actiune | Test |
|---|---|---|
| 32 | "+ Adauga" modalitate de plata | pay: adauga al doilea rand |
| 33 | Cod modalitate (select) | frm: alegerea codului modalitatii de plata; pay: fixture cod 42 |
| 34 | IBAN (validare + XML) | pay: IBAN invalid/valid; rand fara IBAN |
| 35 | ✕ plata | pay: stergerea tuturor randurilor |
| 36 | "Adauga Reducere/Taxa" | ac: reducere 25; taxa 10; valori implicite |
| 37 | Tip (Taxa/Reducere), Cod motiv | ac: schimbarea tipului schimba codurile de motiv; reducere 25 / taxa 10 |
| 38 | Motiv, Valoare, Baza, Tip TVA, Cota TVA | frm: reduceri/taxe: campuri; ac: totalurile se actualizeaza dupa Tab |
| 39 | ✕ reducere/taxa | ac: stergerea unei reduceri; round-trip |
| 40 | "Adauga Articol" | li: adauga articol; frm/hdr (addLine in helper) |
| 41 | Denumire (+ dropdown catalog) | cat: autocomplete (3 teste), unitate din catalog |
| 42 | Cantitate, Pret, Discount | li: adauga articol; discount pe linie; pret negativ; totaluri dupa Tab |
| 43 | UM (select) | li: unitate de masura aleasa ajunge in unitCode |
| 44 | Cod motiv reducere (linie) | li: discount pe linie: cod motiv activat |
| 45 | Tip TVA linie + Cota TVA | vat: linie trecuta pe Z / AE; li: furnizor fara RO |
| 46 | "Detalii Suplimentare" (toggle) + Descriere | li: toggleOptionalDetails |
| 47 | "Salveaza in catalog" | cat: Salveaza in catalog (3 teste) |
| 48 | Coduri identificare: butoane + (6 tipuri), select schema, valoare, ✕ | li: buton + Cod Furnizor; addIdentification; frm: coduri de identificare: toate tipurile |
| 49 | ✕ linie | li: stergerea unei linii; dupa stergerea primei linii; linie din mijloc |
| 50 | Badge total linie | li: validateMath si totaluri (4 teste) |

## Totaluri si defalcare TVA

| # | Element / actiune | Test |
|---|---|---|
| 51 | 6 totaluri editabile prin click (subtotal, reduceri, taxe, net, TVA, total) | frm: click pe total il face editabil; toate cele 6 totaluri |
| 52 | "Recalculeaza Totaluri" | frm: Recalculeaza dupa schimbarea pretului; li: dupa Tab, click pe Recalculeaza |
| 53 | Badge total (total-badge) | li: factura incarcata consistenta: badge-uri ok |
| 54 | "Adauga Cota TVA" | vat: Adauga Cota TVA lasa un rand; frm: rand adaugat |
| 55 | Rand TVA: tip, cota, baza, valoare | vat: schimbarea tipului; TVA editat manual; frm: rand adaugat: tip, cota, baza si valoare in XML |
| 56 | Cod scutire (select) + motiv | vat: coduri de scutire (5 teste) |
| 57 | ✕ rand TVA | vat: stergerea unui rand TVA |

## Elemente generate (JS)

| # | Element / actiune | Test |
|---|---|---|
| 58 | Modal Factura Noua: serie, an, contor, cifre, include an, previzualizare | ni: modalul; previzualizarea urmareste...; fara an si cu 5 cifre; als: checkbox includeAn |
| 59 | Modal: Anulare, Escape, click pe fundal, Genereaza | ni: Anulare si Escape; hdr: click pe fundal; hdr: modal seria cu majuscule |
| 60 | Banner an nou: Continua / Reseteaza la 1 | ni: banner de an nou (3 teste) |
| 61 | Toast + buton × | frm: toast: buton × il inchide; variante |
| 62 | Panou BR: antet (click, Enter, Space), elemente (click -> evidentiere), dispare la corectare | frm: panou validare BR (4 teste) |
| 63 | Sidebar multi-fisier: afisare, click pe fisier, marcaj modificat, salvare, adaugare | bulk: toate cele 8 teste |
| 64 | Linkuri subsol (Aplicatii online, logo) | hdr: logo-ul si "Aplicatii online" |
| 65 | Pagini de test din browser (regression/numeric/fixes) | browser-pages: 3 teste |
| 66 | Sectiunea "Livrare (optional)": restransa implicit, buton Afiseaza/Ascunde | del: sectiunea e restransa implicit; incarcare XML cu Delivery o deschide |
| 67 | Data livrarii (calendar, mascare, validare) | del: calendarul alege data; data imposibila marcata invalida; doar data livrarii |
| 68 | Destinatar, adresa, oras, cod postal, judet/subdiviziune, tara (livrare) | del: completare in formular (RO, Bucuresti); incarcare XML cu Delivery (DE, subdiviziune text) |
| 69 | cac:Delivery in XML: pozitie UBL, fara date = fara element, round-trip | del: round-trip identic in pozitia corecta; fara date nu scrie Delivery |
| 70 | Factura Noua goleste livrarea | del: Factura Noua goleste campurile |
| 71 | Reguli BR-IC-11, BR-IC-12, BR-57, BR-RO-180/201/211 + clic deschide sectiunea | del: linie K fara/cu livrare; linie K adaugata in formular; adresa fara tara; click pe eroare |
| 72 | XML salvat de aplicatie = valid la serviciul ANAF real (FACT1), 17 scenarii: S, CUI fara RO + storno, stornare 380, rand gol la final, mai multe cote, E+AE, K cu livrare, K+G, export G, reducere+taxa+discount linie, EUR cu TVA in RON, categoria O, factura noua | anaf-real: validare XML la ANAF real |
| 73 | Control negativ: K fara livrare = nok cu BR-IC-11 (dovada ca apelul ajunge la ANAF) | anaf-real: control negativ |
| 74 | Round-trip al fiecarui XML din docs/ si test/**/fixtures (incarcare -> salvare -> ANAF); fixture-uri intentionat invalide: factura-k-g (BR-IC-11), user-brco15-3rows (BR-S-08) | anaf-real: round-trip fixture -> aplicatie -> ANAF real |
| 75 | 381 (ales manual) se scrie ca `CreditNote` (CreditNoteTypeCode, CreditNoteLine, CreditedQuantity, fara DueDate la radacina) si trece la ANAF FCN; Invoice ramane la FACT1 (standardul se alege dupa radacina) | anaf-real: nota 381, stornare, round-trip 381 |
| 76 | Nota de credit CreditNote: radacina, linii, cantitati, ordine UBL, scadenta in PaymentMeans; 380/384/389 raman Invoice; incarcare CreditNote; round-trip identic; Invoice vechi cu 381 | cnx: toate cele 6 teste |
| 77 | Stornare = Invoice 380 cu cantitati negative, preturi pozitive si BillingReference (nu CreditNote); la ANAF FACT1 ok | cnx: stornare 380; cn: stornare; hdr: buton Stornează; anaf-real: stornare 380 |
| 78 | Factura noua (si pornirea aplicatiei) are exact un rand gol: S/21% cu furnizor RO, O/0% fara; incarcarea unui XML nu adauga rand gol | empty: primele 4 teste |
| 79 | Rand complet gol ignorat la salvare (1 InvoiceLine, totaluri, toast, randul ramane in formular, indexare); linie partial completata se pastreaza; toate goale = BR-16-L; ANAF real ok cu rand gol la final | empty: ultimele 5 teste; anaf-real: factura noua cu rand gol |
| 80 | Nota 381 cu scadenta si fara modalitate de plata: avertisment BR-CN-DUE in panou (apare/dispare cu plata sau cu alt tip), toast la salvare, fara PaymentDueDate in XML | cnx: scadenta fara modalitate de plata |
| 81 | Tiparire Standard/Compact: blocul Livrare (data, destinatar, adresa pe un rand) apare doar cu date de livrare; PDF direct acelasi bloc | pp: blocul Livrare apare/lipseste (x2 sabloane) |

## Verificare vizuala (visual/visual.spec.ts)

formular gol; factura incarcata; factura noua completata; calendar; detalii+identificari; reduceri/taxe; eroare IBAN;
defalcare cu scutiri; defalcare K/G; sectiune livrare completata; modal Factura Noua; meniul Actiuni; banner an nou; toast; panou BR extins;
sidebar multi-fisier; print standard; print compact; print standard si compact cu livrare; mobil 390x844 (formular gol, factura incarcata, meniu Actiuni).

## Neacoperit

- Butoanele ANAF din aplicatie (Validare ANAF, Cauta CIF, PDF ANAF; cer receiver.php si cont) se simuleaza cu `page.route`; live cu `RUN_ANAF_LIVE=1`. Validarea XML la ANAF e reala (vezi randurile 72-76).
- Dialogul nativ de tiparire al browserului (`window.print` e inlocuit; se verifica doar sablonul si datele).
- Continutul vizual al PDF-ului generat (se verifica doar tipul/dimensiunea fisierului).
