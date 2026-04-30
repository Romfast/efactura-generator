# Design System — Editor eFactura

Sistem de design pentru `efactura-generator`, editorul Romfast de facturi UBL 2.1 / CIUS-RO.

## Product Context

- **What this is:** Editor browser-based, single-page, pentru corectarea facturilor eFactura existente (XML UBL 2.1) și generarea de stornări (credit notes). NU este un sistem de facturare complet.
- **Who it's for:** Contabili, antreprenori și PFA români care primesc/emit facturi prin SPV (sistemul ANAF) și au nevoie să corecteze erori sau să emită stornări fără să deschidă editorul XML brut.
- **Space/industry:** Software fiscal RO. Peers (marketing): SmartBill, Oblio, Saga, FGO. Peers (UBL viewer): B2BRouter, e-invoice.be, invoice-grabber.com, ublinvoiceviewer.com.
- **Project type:** Utility web app static, single-purpose. NU dashboard SaaS, NU marketing site. Posture mai apropiat de Stripe Dashboard / Linear data table / Excel decât de SmartBill/Oblio.
- **Memorable thing:** "Profesional, respectă timpul contabilului." Funcțional, clar, zero fluff. Tipografic strict, paletă calmă, niciun decor inutil. Încredere prin sobrietate.

## Aesthetic Direction

- **Direction:** Industrial / utilitarian, cu disciplină editorială.
- **Decoration level:** Minimal. Tipografia face toată treaba. Niciun gradient, niciun blob, niciun icon decorativ, niciun pattern de fundal.
- **Mood:** Hârtie + cerneală. Materie warm-paper, energie calmă. Aplicația trebuie să arate ca un instrument profesional, nu ca o pagină comercială.
- **Posture diferențiator:** ZERO SaaS chrome — niciun footer marketing, niciun login, niciun pricing CTA, niciun cookie banner intruziv. Header minim (logo Romfast + butoane operaționale) + workspace + footer minim cu versiune și un singur link `romfast.ro`.
- **Reference sites studiate (research 2026-04-30):** B2BRouter, e-invoice.be (closest in spirit — institutional, dark sidebar, professional), SmartBill, Oblio (counterexamples — full SaaS marketing chrome).

## Typography

Single font family: **Geist** (sans + mono). OSS Vercel, free, neutral, tabular-nums excellent.

- **Display / titluri pagină:** Geist 600 / -0.02em letter-spacing, 22px.
- **Titluri secțiuni / carduri:** Geist 600 / -0.005em, 14px.
- **Eyebrow / section labels:** Geist 500, 11px, `text-transform: uppercase`, `letter-spacing: 0.08em`, color `--text-muted`.
- **Form labels:** Geist 500, 12px, color `--text-muted`.
- **Body / valori formular:** Geist 400, 14px, color `--text`.
- **Numere editabile (Price, Quantity, Amount, Total, CIF, IBAN, dates):** Geist Mono 500, 14px, `font-variant-numeric: tabular-nums`. Aplicat prin clasa `.mono` sau `.num`. Niciodată `parseFloat` display nu folosește font-ul UI sans.
- **Total final / valoare prominentă:** Geist Mono 700, 18px.
- **Meta values (sidebar items, hex codes, version):** Geist Mono 500, 11px, color `--text-muted`.
- **Loading:** Bunny Fonts via `<link>`:
  ```html
  <link rel="preconnect" href="https://fonts.bunny.net">
  <link href="https://fonts.bunny.net/css?family=geist:400,500,600,700|geist-mono:400,500,600&display=swap" rel="stylesheet">
  ```
  Privacy-first alternative la Google Fonts. Vendor budget impact: 0 (extern). Fallback: `system-ui, -apple-system, sans-serif`.
- **Scale modular (px):** 11 / 12 / 13 / 14 / 16 / 18 / 22.

## Color

Approach: **restrained**. O singură culoare primary, neutrals warm, semantic colors rare.

| Token | Hex | Rol |
|---|---|---|
| `--bg` | `#fafaf9` | background pagină (stone-50, hârtie caldă) |
| `--surface` | `#ffffff` | card, modal, input |
| `--surface-muted` | `#f5f5f4` | section-head, hover row, totals box |
| `--border` | `#e7e5e4` | card border, table row separator |
| `--border-strong` | `#d6d3d1` | input border, table heading |
| `--text` | `#1c1917` | corp text, valori input (stone-900, near-black) |
| `--text-muted` | `#57534e` | labels, helper text (stone-600) |
| `--text-faint` | `#a8a29e` | placeholder, disabled, contoare (stone-400) |
| `--header-bg` | `#0f172a` | header aplicație (slate-900) |
| `--header-text` | `#f8fafc` | text pe header |
| `--header-sub` | `#94a3b8` | subtitlu pe header |
| `--primary` | `#1e40af` | CTA salvare, focus ring, link, sidebar item activ (blue-700) |
| `--primary-hover` | `#1e3a8a` | hover pe primary |
| `--primary-soft` | `#dbeafe` | sidebar item active background, alert info bg |
| `--success` | `#15803d` | badge ✓, validare ANAF ok (green-700) |
| `--success-soft` | `#dcfce7` | badge-ok background |
| `--warning` | `#d97706` | badge ±, BR atenționare (amber-600) |
| `--warning-soft` | `#fef3c7` | badge-warn background, alert warn bg |
| `--danger` | `#b91c1c` | stornare, eroare BR/CIF (red-700) |
| `--danger-soft` | `#fee2e2` | badge-error background, alert error bg |

**Semantic mapping:**
- `success` = match exact, validare trecută, profil salvat.
- `warning` = math diff în toleranță, BR atenționare neblocantă, quota apropiat de plin.
- `danger` = stornare, BR critic, CIF/IBAN invalid, quota plin.
- `primary` = NU se folosește pentru status. Doar pentru navigație/acțiune principală.

**Dark mode:** redesign surfaces, nu inversiune cu invert. Vezi tokens dark în preview.

## Spacing

- **Base unit:** 4px.
- **Density:** comfortable (nici compact, nici spacious — contabilul are nevoie de scan rapid și loc de citit).
- **Scale:** `--space-1: 4px`, `2: 8px`, `3: 12px`, `4: 16px`, `5: 20px`, `6: 24px`, `8: 32px`, `12: 48px`, `16: 64px`.
- **Card padding:** 18px–20px (md) / 24px (lg).
- **Form-grid gap:** 14px row × 16px col.
- **Workspace gap între carduri:** 14–16px.
- **Header padding:** 14px vertical × 24px horizontal.

## Layout

- **Approach:** grid-disciplined pentru formular + asymmetric (left-rail sidebar) doar când A14 bulk activ.
- **Max content width:** 1200px, centrat.
- **Form grid:** 3 coloane desktop (≥720px), 1 coloană mobil. 2 coloane pentru carduri side-by-side (Furnizor + Client).
- **Sidebar (A14):** 240px stânga + workspace dreapta. Collapsing pe mobil (≤720px → vertical stack).
- **Border radius hierarchy:** `--radius-sm: 4px` (input, button, badge), `--radius-md: 6px` (card, totals-box), `--radius-lg: 8px` (modal). NICIODATĂ uniform peste tot.
- **Box shadow:** subtil. `--shadow-card: 0 1px 2px rgba(0,0,0,0.03)`. Border face treaba principală; shadow rezident e doar lift suttle.

## Motion

- **Approach:** minimal-functional. Animațiile aid comprehension, nu decor.
- **Easing:** entrare `ease-out`, ieșire `ease-in`, mișcare `ease-in-out`. Default tot ease-out.
- **Duration:** micro 100ms (button hover), short 150ms (default tranzitii), medium 250ms (modal open/close), long evitat.
- **NO entrance animations on form load.** Pagina apare instant. Animările sunt rezervate pentru state changes (badge apar, modal open, alert toast slide-in).

## Components — reguli de bază

### Butoane

| Variantă | Background | Border | Text | Folosire |
|---|---|---|---|---|
| `.btn-primary` | `--primary` | none | `#fff` | CTA principal (Salvează XML, Înlocuiește cu ANAF) |
| `.btn-secondary` | `--surface` | 1px `--border-strong` | `--text` | Acțiune secundară (Folosește profil, Caută CIF) |
| `.btn-danger` | transparent | 1px `--danger` | `--danger` | Stornare, ștergere |
| `.btn-add` | transparent | 1px dashed `--border-strong` | `--text-muted` | Adaugă articol/rând |
| `.btn-ghost` (header) | transparent | 1px `rgba(255,255,255,0.18)` | `#f1f5f9` | Pe slate-900 background |
| `.btn-success-ghost` (header) | transparent | 1px `rgba(134,239,172,0.35)` | `#86efac` | Validare ANAF pe header |
| `.btn-danger-ghost` (header) | transparent | 1px `rgba(252,165,165,0.35)` | `#fca5a5` | Stornare pe header |

Sizes: default `padding: 7px 14px; font-size: 13px;`. Small: `padding: 5px 10px; font-size: 12px;`.

### Inputs

- Default: 1px `--border-strong`, padding 7px 10px, font-size 14px, radius `--radius-sm`.
- Focus: border `--primary`, box-shadow `0 0 0 2px rgba(30,64,175,0.15)`.
- Invalid: border `--danger`, background `--danger-soft`, helper text below `font-size: 11px; color: --danger`.
- Numeric: clasa `.num` sau `.mono` → `font-family: 'Geist Mono'`, `text-align: right`, `tabular-nums`.

### Badges (validare matematică A11)

- `.badge-ok`: `--success-soft` bg, dark green text. Conținut: `✓` sau `✓ exact`.
- `.badge-warn`: `--warning-soft` bg, dark amber text. Conținut: `±0.01 RON` sau `+5.00`.
- `.badge-error`: `--danger-soft` bg, dark red text. Conținut: `-12.45 diferență`.
- Format: `padding: 1px 6px; border-radius: 3px; font-size: 11px; font-family: Geist Mono`.

### Alerts (validare BR / sistem)

Border-left 3px solid (color = severitate), background semantic-soft, padding 12px 16px, radius `--radius-sm`, font-size 13px. Format: `<strong>BR-CO-15:</strong> mesaj. <em>context.</em>`.

### Cards

`background: --surface; border: 1px solid --border; border-radius: --radius-md; padding: 18px 20px; box-shadow: --shadow-card;`. Card-head conține eyebrow + card-title pe stânga, card-actions (buttons-sm) pe dreapta.

### Tables

Headings: `text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px; color: --text-muted; font-weight: 500;`. Rows: `padding: 10px; border-bottom: 1px solid --border;`. Hover row: `background: --surface-muted`. Coloanele numerice: `text-align: right; font-family: Geist Mono; tabular-nums`.

### Modals

`background: --surface; border-radius: --radius-lg; padding: 24px; max-width: 480px; box-shadow: 0 8px 24px rgba(0,0,0,0.08);`. Title 16px / 600. Sub 13px / `--text-muted`. Actions justify-end, gap 8px.

### Sidebar (A14 bulk only)

`background: --surface-muted; border-right: 1px solid --border; padding: 16px 14px; width: 240px;`. Items: 8px 10px padding, `--radius-sm`, hover `--bg`, active `--primary-soft` (text `--primary`).

## Responsive

- **Breakpoint principal:** 720px.
- **Sub 720px:**
  - Form grids: 3-col / 2-col → 1-col.
  - Totaluri: 2-col (notes + box) → 1-col stack.
  - Sidebar: vertical stack deasupra workspace, `border-bottom` în loc de `border-right`.
  - Header actions: `flex-wrap: wrap`, butoanele se mută pe a doua linie dacă nu încap.
  - Tables: `font-size: 12px`. Considerare scroll orizontal vs collapse rows pentru lățimi extreme.
- **Touch targets:** minim 44×44px pentru butoane primary/danger, 32×32px pentru btn-add și icon buttons.

## Accessibility

- **Contrast minim:** `--text` pe `--surface` = 16.4:1 (AAA). `--text-muted` pe `--surface` = 7.2:1 (AAA). `--primary` pe `--surface` = 7.0:1 (AA Large + AAA Small). `--header-text` pe `--header-bg` = 16.0:1 (AAA).
- **Focus visible:** 2px outline cu offset 2px sau box-shadow 2px ring `--primary` la 15% opacity. NICIODATĂ `outline: none` fără înlocuitor.
- **Keyboard nav:** tab order = layout order (header → form sections de sus în jos → footer). Modale capturează focus. Esc închide modale. Enter = primary action în modal.
- **Form labels:** întotdeauna `<label>` asociat cu `<input>` (nu placeholder-as-label). Helper text inline cu `aria-describedby`.
- **Error states:** `aria-invalid="true"` + helper text vizibil cu eroare. Niciodată "doar culoare roșie" — culoarea suplimentează, nu transmite.
- **Tabular nums:** read by screen reader corect (cifrele se aliniază vizual fără să strice ordinea logică).

## Anti-patterns (NEVER do)

- ❌ Purple/violet/indigo gradient bg (SaaS slop)
- ❌ 3-column feature grid cu icon-in-circle
- ❌ Centered everything (text-align: center peste tot)
- ❌ Border-radius uniform mare (bubbly)
- ❌ Decorative blobs, floating circles, wavy SVG dividers
- ❌ Emoji ca element de design (rachete, stele, etc.)
- ❌ Generic hero copy ("Welcome to...", "Unlock the power of...")
- ❌ system-ui ca PRIMARY display font (= "am renunțat la tipografie")
- ❌ Hover-only affordances (cursor change is not enough indicator)
- ❌ Placeholder-as-label (label trebuie vizibil când input are conținut)
- ❌ Stacked cards SaaS-style cu shadow heavy (`0 4px 12px rgba(0,0,0,0.15)`)

## Dogfood checklist (apply before each PR)

- [ ] Toate cifrele numerice (Price, Qty, Amount, Total, CIF, IBAN, date) folosesc `.mono` sau `.num`?
- [ ] Toate text-urile sunt în română?
- [ ] Niciun `parseFloat()` în display path, doar `Big(input.dataset.raw).toFixed()`?
- [ ] Border + 1px subtle shadow, nu shadow heavy?
- [ ] Border-radius hierarchic (sm/md/lg), nu uniform?
- [ ] Niciun nou `font-family:` declarat în CSS — totul cade pe Geist via clasa `body` sau `.mono`?
- [ ] Niciun gradient/blob/decor adăugat?
- [ ] Focus visible pe toate input-urile și butoanele interactive?
- [ ] Mobil ≤720px: form-grid 1-col, sidebar vertical?
- [ ] Empty/loading/error state specificate pentru orice nouă feature UI?

## Decisions Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-04-30 | Initial design system created | `/design-consultation` rezultă în primul DESIGN.md formal pentru proiect. Plan Track 1 + Track 2 D adaugă 8+ componente UI noi (BR panel, ANAF buttons, profil, sidebar bulk, modal CIF, A11 badges). DESIGN.md elimină ambiguitatea înainte de implementare. |
| 2026-04-30 | Geist + Geist Mono ales over Inter / system-ui | Inter e blacklist (overused). Geist neutral, OSS Vercel, free, tabular-nums excellent. Single family = vendor budget mic + sistem coherent. Mono pe cifre = aliniere verticală scan rapid = "respect timpul contabilului". |
| 2026-04-30 | Header slate-900 (#0f172a) over blue card | Tool posture, nu SaaS marketing posture. Diferențiator ferm vs SmartBill/Oblio (toate au blue/purple SaaS chrome). Comunică "instrument", nu "pagină comercială". |
| 2026-04-30 | bg #fafaf9 warm paper over #f0f2f5 cool gray | Vibrație contabilitate paper-based RO. Warm stone-50 = mai uman, mai aproape de hârtie de imprimată. Subtil dar perceptibil. |
| 2026-04-30 | Border + subtle shadow over heavy box-shadow | Modernă convenție 2025+. Heavy shadow = SaaS 2010s. Border = clean editorial. Shadow rezidual `0 1px 2px rgba(0,0,0,0.03)` doar pentru lift sutil. |
| 2026-04-30 | Bunny Fonts over Google Fonts CDN | Privacy-first (GDPR-friendly pentru audiența RO). Aceeași API ca Google Fonts. Fallback: system-ui dacă CDN cade. |
