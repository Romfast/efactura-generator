# TODO

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
