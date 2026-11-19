# TODO

## Backlog

- [ ] Fix 403 receiver.php — aplică Opt A revizuită: `$publicActions = ['ping', 'cif']` (elimină IP gate pentru aceste acțiuni, Bearer ANAF neexpus)
- [ ] Defense-in-depth Opt B — X-Forwarded-For via `trusted_proxies` în config.json (alternativă la Opt A)
- [ ] Investigați rsync delete pe prod-romfast care lasă receiver.php afară din deploy
- [ ] Tests E2E iter 2: acoperire PR-A13 (catalog IndexedDB), PR-A14 (bulk import), PR-A19 (numerotare automată serie)

## Prioritare
- [x] Inițializare și editare discount linie factură

## Funcționalități viitoare
- [ ] Citire și editare modalități de plată
- [ ] Citire și editare referință factură originală pentru factură storno
    
## Erori de rezolvat
- [ ] Corectare formatare Total TVA și Total

## Idei deferate (din review CEO 2026-04-30)

> Plan complet: `~/.gstack/projects/Romfast-efactura-generator/ceo-plans/2026-04-30-track1-track2D.md`

### Static-compatible, defer
- [ ] **A3** Multi-currency + curs BNR — defer până cerere reală pentru EUR/USD
- [ ] **A7** Verificare semnătură read-only — niche, mulți XMLs sunt nesemnate
- [ ] **A15** Diff XML original vs editat — utility nice-to-have
- [ ] **A16** Undo/redo (depinde de E5 state central) — defer
- [ ] **A17** Print multi-limbă (engleză pt clienți internaționali) — defer
- [ ] **A18** Shared link cu XML encoded în URL — UX niche
- [ ] **A21** Import multi-format (CSV/JSON/Saga/SmartBill) — per-format effort, valid appetit
- [ ] **A20 PWA** — drop din Track 2 D (UX contradicție cu A14 ephemeral). Reconsider cu Approach C
- [ ] **A22 OCR/LLM PDF→form** — declined explicit (nu e use case)

### Necesită backend
- [ ] **B2** SPV upload + OAuth USB token — out of scope ("editor", nu submission)

### Approach C (full pivot SQLite-WASM)
- [ ] **D2** Listă facturi cu filtru perioadă/client
- [ ] **D3** Adresar clienți/furnizori CRUD
- [ ] **D4** Catalog produse cu istoric prețuri
- [ ] **D6** Drafts + status lifecycle
- [ ] **D7** Rapoarte (total lunar, top clienți, TVA cumulat)
- [ ] **D8** Backup ZIP (DB + folder XML)
- [ ] **D9** Sync multi-device (manual export/import sau cloud user-keys)
- [ ] **Approach C umbrella** — SQLite-WASM + OPFS, transformațional. Reconsider după Track 2 D ship.

### Approach E extensii
- [ ] **E5** State central + pipeline recompute — activare doar dacă apar bugs post E1+E4 sau dacă A16 (undo/redo) intră în scope

### Infrastructură de calitate (din eng review 2026-04-30)
- [ ] **CI parseFloat guard** — script grep care fail-uiește dacă `parseFloat` reapare în `js/script.js` post-PR-E (E4). Bash one-liner în pre-commit sau GitHub Action. Defer până apare prima regresie sau prima verificare manuală ratează ceva.
  - **Why:** după PR-E full sweep (Issue 8A), invariantul "Big-only în calcule" trebuie protejat. 6 luni mai târziu nimeni nu ține minte regula.
  - **Pros:** invariant codificat, ieftin de adăugat.
  - **Cons:** introduce CI într-un proiect zero-build. Se poate amâna.
  - **Context:** vezi Issue 8A din eng review — toate ~40 call sites parseFloat din script.js sunt înlocuite în PR-E. Guard-ul previne regresie.
  - **Depends on:** PR-E (E4) merged.
- [ ] **Vendor budget CI check** — script gzip + wc -c pentru `/js/vendor/*`, fail dacă > 256000 bytes. Defer până la prima presiune reală pe buget.
  - **Why:** plan setează cap 250KB gzipped. Fără check automat, bugetul devine vibe.
  - **Pros:** cap rămâne număr, nu intuiție.
  - **Cons:** încă un script de menținut.
  - **Context:** vezi Issue 13 din eng review. Currently estimated ~62KB gzipped (big.js + JSZip + html2pdf.js). Headroom OK pentru Track 2 D dar tight dacă apar Tesseract/Workbox.
  - **Depends on:** primul vendor add care depășește 100KB gzipped (probabil html2pdf.js).
- [ ] **PWA reconsider trigger** — re-evaluează A20 când persistență Approach C aterizează (SQLite-WASM + OPFS). Contradicția UX (PWA install + A14 ephemeral) se rezolvă prin schimbarea storage story.
  - **Why:** plan a pus drop pe A20 pentru că A14 e ephemeral. Dacă A14 devine persistent (Approach C), drop-ul nu mai are bază.
  - **Pros:** rationale păstrat, nu uităm WHY.
  - **Cons:** nimic, e un trigger conditional.
  - **Context:** plan line 96 + 183 documentează drop-ul. TODO captures triggerul de re-evaluare.
  - **Depends on:** decizie Approach C (după Track 2 D ship).
