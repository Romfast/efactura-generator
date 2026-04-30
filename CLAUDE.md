# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Browser-based editor for Romanian eFactura UBL 2.1 invoice XML files. Loads XML, lets the user edit invoice/supplier/customer/line/VAT/allowance data in a form, and writes a new compliant XML back. Also generates a printable HTML view from the same form state.

### Scope and design intent

The application is intentionally **static**. The primary use cases are:
- **Minor corrections** to an existing eFactura XML (fix a typo, address, line item, VAT row).
- **Generating a storno (credit note) XML** from an existing invoice via the "Stornează" button.

It is **not** a full invoicing system — it edits a single XML at a time and writes a single XML back.

Keeping the app static is a deliberate constraint so it can be hosted as plain files (the canonical deploy is GitHub Pages: https://romfast.github.io/efactura-generator/). When editing, prefer solutions that stay static (no server-side state, no build step). The PHP `receiver.php` is the one optional escape hatch — it exists only for integrations where another system POSTs an XML in and then redirects the user to `index.html?xml=<filename>` to edit it. Static hosts (GitHub Pages) work without it; the receiver flow is only available where PHP is actually running.

UI text and most domain code (variable names, comments, validation messages) are in Romanian. Keep new UI strings in Romanian to match.

## Run / serve

No build, no package manager, no tests. Three ways to serve:

```bash
# Local dev: tiny Node static server on :3000 (no deps)
node js/server.js

# Or just open the static files via any web server (Apache/nginx/etc.)
# Production hosts use the .htaccess.template at the repo root.

# PHP receiver (only if integrating with an external system that POSTs XML):
php -S localhost:8000        # then POST XML to /receiver.php, GET /index.html?xml=<filename>
```

`receiver.php` accepts a POSTed XML file (auth via `X-Api-Key` from `config.json` and IP allowlist), saves it to `temp/xml_<id>.xml`, and returns the filename. The frontend then loads `?xml=<filename>` and fetches it from `temp/`. `test-config.php` is a diagnostics page for that flow.

## Architecture

### Entry points and module graph

- `index.html` — single-page form. Loads `styles/main.css`, Pikaday from a CDN, and `js/script.js` as an ES module. Buttons call globals (`saveXML`, `handleStorno`, `addLineItem`, etc.) that `script.js` attaches to `window` inside `initializeUI()`.
- `js/script.js` (~3200 lines) — the entire app: XML parse, form rendering, event wiring, totals, validation, XML serialization. Uses ES module imports.
- `js/formatter.js` — `InvoiceFormatter` class. Locale-aware number/currency/quantity formatting and parsing helpers used by both the editor and the print view.
- `js/print.js` — `InvoicePrintHandler`. Collects current form state, loads a template from `templates/`, fills it, opens a print window. Two templates: `print.html` (standard) and `print-compact.html`.
- `js/server.js` — bare `http` static server, no dependencies. Only needed for local dev without Apache/nginx.
- `receiver.php` — XML upload endpoint + temp-file cleanup. Validates UBL namespaces, enforces IP allowlist + API key, auto-deletes files older than `temp_file_lifetime` hours.

### Data model (UBL 2.1)

The XML is UBL Invoice with three namespaces, defined once at the top of `script.js`:

```
ubl = urn:oasis:names:specification:ubl:schema:xsd:Invoice-2
cbc = urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2
cac = urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2
```

A namespace `resolver` object near the top (`script.js:145`) is used with `evaluate()` for XPath against parsed XML.

Domain enums also live at the top of `script.js` and are the source of truth for dropdowns and XML serialization:
- `VAT_TYPES` — UBL category codes (`S`, `AE`, `O`, `Z`, `E`).
- `VAT_EXEMPTION_CODES` — exemption code/reason pairs per VAT type, including the multi-option `E` (Neimpozabil) list.
- `UNIT_CODES` — UN/ECE Rec 20 unit codes (`EA`, `KGM`, `MTR`, ...).
- `ISO_3166_1_CODES`, `ROMANIAN_COUNTY_CODES` — country/judet validation sets.
- `CHARGE_REASON_CODES`, `ALLOWANCE_REASON_CODES` — UBL reason codes for invoice-level charges/discounts.
- `IDENTIFICATION_TYPES` — per-line item identifier kinds (seller, buyer, barcode, CPV, NC8, vamal).

When adding a new VAT type, exemption code, unit, or reason code, update the relevant constant — the form options, validation, and XML output all derive from it.

### Lifecycle of an invoice

1. **Load**: `handleFileSelect` (file input) or auto-load from `?xml=<filename>` URL param (used by the PHP receiver flow). Both call `parseXML(xmlContent)` (`script.js:401`).
2. **Populate form**: `parseXML` calls `populateBasicDetails`, `populatePartyDetails`, `populateLineItems`, `parseAllowanceCharges` → `displayAllowanceCharges`, plus VAT-breakdown and totals reconstruction. Original total values are stashed via `storeOriginalTotals` so they can be restored if recomputation drifts.
3. **Edit**: form inputs and inline-editable totals (`setupInlineEditing`) trigger `updateTotals` / `refreshTotals`. Line items, allowances/charges, and VAT-breakdown rows are dynamically created from `createLineItemHTML`, `createAllowanceChargeHTML`, `addVATBreakdownRow`.
4. **Storno**: `handleStorno` (`script.js:1737`) flips quantities/totals to negative for credit-note generation.
5. **Save**: `saveXML` (`script.js:2280`) rebuilds a fresh UBL DOM from form state and triggers a download.
6. **Print**: `InvoicePrintHandler.collectInvoiceData()` snapshots form state into a plain object, then renders into one of the `templates/print*.html` files.

### Known structural quirks

- `index.html` has a duplicate `</head>` tag (line 11) — preserve formatting when editing nearby unless intentionally fixing it.
- Globals on `window` are how inline `onclick=` handlers in generated HTML reach module-scope functions. When adding a new dynamically-rendered button, attach its handler to `window` inside `initializeUI()` (see `script.js:1099-1107` for the pattern).
- `formatter.js` uses `navigator.language` for locale, so number formatting depends on the browser. The XML always uses dot decimals; the form/UI uses locale display, and `parseCurrency`/`parseQuantity`/`parseNumber` normalize back.
- `config.json` ships with a placeholder `api_key` (`"1234567890."`). It's only consulted by `receiver.php`; replace it before exposing the PHP endpoint.

## Changelog (obligatoriu)

**Orice modificare la cod trebuie să fie însoțită de o intrare în `CHANGELOG.md`.** Fără excepții — bugfix, feature nou, refactor, ajustare UI, schimbare de șablon, totul ajunge în changelog. Adăugați intrarea sub o secțiune de versiune (vezi convenția existentă: `## 0.9-beta-X - DD.MM.YYYY`) cu sub-titluri `### Bugfixes`, `### New Features`, `### Modifications` după caz. Textul rămâne în română pentru consistență cu istoricul.

## Versioning

Bumping a release means three coordinated edits:
- `index.html` — the `<span id="app-version">` in the footer.
- `CHANGELOG.md` — new section at the top (vezi regula de mai sus — changelog-ul se actualizează la fiecare modificare, nu doar la bump).
- `TODO.md` — move completed items.

There's no automated version source.

## Workspace rules (from /workspace/CLAUDE.md)

When invoked non-interactively (`claude -p` / `claudep.sh`), put new scratch files under `/workspace/.claude-work/<timestamp>_<task>/` rather than this repo. Modifications to existing files in this repo stay in place.
