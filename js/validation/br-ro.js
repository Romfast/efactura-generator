/**
 * js/validation/br-ro.js — PR-BR (A2)
 * Top 30 reguli BR din CIUS-RO Schematron + EN 16931-1.
 * Selecție: severity fatal/error din Schematron + reguli care vizează
 * câmpuri editabile (CIF, date, totale, coduri TVA, articole factură).
 *
 * Fiecare regulă:
 *   { code, severity ('fatal'|'error'|'warning'), message, fieldRef, check(invoiceData) }
 *
 * invoiceData = obiect snapshot din colectInvoiceDataForBR() în script.js.
 * Toate funcțiile sunt pure — fără acces DOM, fără efecte secundare.
 */

import { validateCIF } from './cif.js';
import { validateIBAN } from './iban.js';

// Coduri TVA valide per CIUS-RO
const VALID_VAT_TYPES = ['S', 'AE', 'O', 'Z', 'E'];
// Coduri tip factură valide per CIUS-RO
const VALID_INVOICE_TYPES = ['380', '381', '384', '389'];
// Coduri țară ISO 3166-1 alfa-2 (set parțial — UE + țări comune)
const EU_COUNTRY_CODES = new Set([
    'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
    'IE','IT','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
    'AD','AL','BA','BY','CH','GB','GE','IS','LI','ME','MK','MD','MN','NO',
    'RS','TR','UA','US','CA','AU','JP','CN','KR','BR','IN','ZA','SG','AE',
    'XK','SM','VA','MC','GI','FO','GL','IM','JE','GG'
]);

/**
 * Parsează un număr din string ignorând formatare (punct sau virgulă drept separator mii).
 * Returnează NaN dacă nu e un număr valid.
 */
function parseNum(val) {
    if (val === null || val === undefined || val === '') return NaN;
    const s = String(val).trim().replace(/\s/g, '');
    // Format ro-RO are virgulă ca separator zecimal ("1.234,56" sau "1,5").
    // Doar când există virgulă tratăm punctele drept separator de mii.
    // Altfel: parse canonical decimal-dot (dataset.raw, XML) — "1.000" = 1, NU 1000.
    if (s.includes(',')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.'));
    }
    return parseFloat(s);
}

/** Parsează o dată din format dd.mm.yyyy → Date object (sau null) */
function parseRoDate(str) {
    if (!str || !/^\d{2}\.\d{2}\.\d{4}$/.test(str.trim())) return null;
    const [d, m, y] = str.trim().split('.').map(Number);
    const dt = new Date(y, m - 1, d);
    if (isNaN(dt.getTime())) return null;
    return dt;
}

/** Compară două valori numerice cu toleranță ε */
function approxEqual(a, b, eps = 0.02) {
    if (isNaN(a) || isNaN(b)) return false;
    return Math.abs(a - b) <= eps;
}

// ============================================================================
// REGULILE BR — 30 reguli în ordinea: ID, date, furnizor, client,
// articole, TVA, totaluri, CIUS-RO specifice.
// ============================================================================

export const BR_RULES = [

    // ── Identificare factură ─────────────────────────────────────────────────

    {
        code: 'BR-01',
        severity: 'fatal',
        message: 'Factura trebuie să aibă un număr de identificare (ID).',
        fieldRef: '[name="invoiceNumber"]',
        check: (d) => d.invoiceNumber !== '',
    },

    {
        code: 'BR-02',
        severity: 'fatal',
        message: 'Factura trebuie să aibă o dată de emitere.',
        fieldRef: '[name="issueDate"]',
        check: (d) => d.issueDate !== '' && parseRoDate(d.issueDate) !== null,
    },

    {
        code: 'BR-03',
        severity: 'error',
        message: 'Codul tipului de factură trebuie să fie 380, 381, 384 sau 389.',
        fieldRef: '[name="invoiceTypeCode"]',
        check: (d) => VALID_INVOICE_TYPES.includes(d.invoiceTypeCode),
    },

    {
        code: 'BR-04',
        severity: 'fatal',
        message: 'Factura trebuie să specifice moneda (codul ISO 4217).',
        fieldRef: '[name="documentCurrencyCode"]',
        check: (d) => d.currencyCode !== '' && d.currencyCode.length === 3,
    },

    // ── Date scadență ────────────────────────────────────────────────────────

    {
        code: 'BR-DT-01',
        severity: 'error',
        message: 'Data emiterii nu poate fi în viitor cu mai mult de 30 zile.',
        fieldRef: '[name="issueDate"]',
        check: (d) => {
            const issued = parseRoDate(d.issueDate);
            if (!issued) return true; // BR-02 handles missing date
            const limit = new Date();
            limit.setDate(limit.getDate() + 30);
            return issued <= limit;
        },
    },

    {
        code: 'BR-DT-02',
        severity: 'warning',
        message: 'Data scadenței (dueDate) nu trebuie să fie anterioară datei de emitere.',
        fieldRef: '[name="dueDate"]',
        check: (d) => {
            if (!d.dueDate) return true;
            const issued = parseRoDate(d.issueDate);
            const due = parseRoDate(d.dueDate);
            if (!issued || !due) return true;
            return due >= issued;
        },
    },

    // ── Furnizor ─────────────────────────────────────────────────────────────

    {
        code: 'BR-06',
        severity: 'fatal',
        message: 'Furnizorul trebuie să aibă un nume (RegistrationName).',
        fieldRef: '[name="supplierName"]',
        check: (d) => d.supplierName !== '',
    },

    {
        code: 'BR-07',
        severity: 'fatal',
        message: 'Adresa furnizorului trebuie să includă orașul.',
        fieldRef: '[name="supplierCity"]',
        check: (d) => d.supplierCity !== '',
    },

    {
        code: 'BR-08',
        severity: 'fatal',
        message: 'Țara furnizorului trebuie specificată (cod ISO 3166-1).',
        fieldRef: '[name="supplierCountry"]',
        check: (d) => d.supplierCountry !== '',
    },

    {
        code: 'BR-RO-001',
        severity: 'error',
        message: 'CIF/CUI furnizor invalid: cifra de control nu se potrivește.',
        fieldRef: '[name="supplierVAT"]',
        check: (d) => {
            if (!d.supplierVAT) return true; // gol = alt BR verifică
            return validateCIF(d.supplierVAT).valid;
        },
    },

    {
        code: 'BR-RO-010',
        severity: 'fatal',
        message: 'Furnizorul trebuie să aibă un cod de identificare fiscală (CIF/VAT).',
        fieldRef: '[name="supplierVAT"]',
        check: (d) => d.supplierVAT !== '',
    },

    // ── Client ───────────────────────────────────────────────────────────────

    {
        code: 'BR-07-C',
        severity: 'fatal',
        message: 'Clientul trebuie să aibă un nume (RegistrationName).',
        fieldRef: '[name="customerName"]',
        check: (d) => d.customerName !== '',
    },

    {
        code: 'BR-08-C',
        severity: 'fatal',
        message: 'Țara clientului trebuie specificată (cod ISO 3166-1).',
        fieldRef: '[name="customerCountry"]',
        check: (d) => d.customerCountry !== '',
    },

    {
        code: 'BR-RO-002',
        severity: 'error',
        message: 'CIF/CUI client invalid: cifra de control nu se potrivește.',
        fieldRef: '[name="customerVAT"]',
        check: (d) => {
            if (!d.customerVAT) return true;
            return validateCIF(d.customerVAT).valid;
        },
    },

    // ── Articole factură ─────────────────────────────────────────────────────

    {
        code: 'BR-21',
        severity: 'fatal',
        message: (d) => {
            const bad = d.lineItems.filter(li => !li.description);
            return bad.length === 1
                ? `Linia ${bad[0].index + 1} trebuie să aibă o denumire (descriere).`
                : `${bad.length} linii fără denumire (liniile ${bad.map(l => l.index + 1).join(', ')}).`;
        },
        fieldRef: null, // dinamic — scroll la prima linie cu eroare
        fieldRefDynamic: (d) => {
            const bad = d.lineItems.find(li => !li.description);
            return bad ? `[name="description${bad.index}"]` : null;
        },
        check: (d) => d.lineItems.every(li => li.description !== ''),
    },

    {
        code: 'BR-22',
        severity: 'fatal',
        message: (d) => {
            const bad = d.lineItems.filter(li => isNaN(parseNum(li.quantity)) || parseNum(li.quantity) === 0);
            return bad.length === 1
                ? `Linia ${bad[0].index + 1} trebuie să aibă o cantitate validă (≠ 0).`
                : `${bad.length} linii cu cantitate lipsă sau zero.`;
        },
        fieldRefDynamic: (d) => {
            const bad = d.lineItems.find(li => isNaN(parseNum(li.quantity)) || parseNum(li.quantity) === 0);
            return bad ? `[name="quantity${bad.index}"]` : null;
        },
        check: (d) => d.lineItems.every(li => !isNaN(parseNum(li.quantity)) && parseNum(li.quantity) !== 0),
    },

    {
        code: 'BR-23',
        severity: 'fatal',
        message: (d) => {
            const bad = d.lineItems.filter(li => isNaN(parseNum(li.unitPrice)));
            return `Linia ${bad[0]?.index + 1 || '?'}: prețul unitar trebuie specificat.`;
        },
        fieldRefDynamic: (d) => {
            const bad = d.lineItems.find(li => isNaN(parseNum(li.unitPrice)));
            return bad ? `[name="price${bad.index}"]` : null;
        },
        check: (d) => d.lineItems.every(li => !isNaN(parseNum(li.unitPrice))),
    },

    {
        code: 'BR-24',
        severity: 'fatal',
        message: (d) => {
            const bad = d.lineItems.filter(li => !VALID_VAT_TYPES.includes(li.vatType));
            return `Linia ${bad[0]?.index + 1 || '?'}: codul categoriei TVA trebuie să fie S/AE/O/Z/E.`;
        },
        fieldRefDynamic: (d) => {
            const bad = d.lineItems.find(li => !VALID_VAT_TYPES.includes(li.vatType));
            return bad ? `[name="vatType${bad.index}"]` : null;
        },
        check: (d) => d.lineItems.every(li => VALID_VAT_TYPES.includes(li.vatType)),
    },

    {
        code: 'BR-16',
        severity: 'error',
        message: (d) => {
            const bad = d.lineItems.find(li => {
                const qty = parseNum(li.quantity);
                const price = parseNum(li.unitPrice);
                const disc = parseNum(li.discount) || 0;
                const net = parseNum(li.lineTotal);
                if (isNaN(qty) || isNaN(price) || isNaN(net)) return false;
                return !approxEqual(qty * price - disc, net);
            });
            return bad
                ? `Linia ${bad.index + 1}: total net ≠ cantitate × preț − discount.`
                : 'Total net linie inconsistent.';
        },
        fieldRefDynamic: (d) => {
            const bad = d.lineItems.find(li => {
                const qty = parseNum(li.quantity);
                const price = parseNum(li.unitPrice);
                const disc = parseNum(li.discount) || 0;
                const net = parseNum(li.lineTotal);
                if (isNaN(qty) || isNaN(price) || isNaN(net)) return false;
                return !approxEqual(qty * price - disc, net);
            });
            return bad ? `[data-line-total-index="${bad.index}"]` : null;
        },
        check: (d) => d.lineItems.every(li => {
            const qty = parseNum(li.quantity);
            const price = parseNum(li.unitPrice);
            const disc = parseNum(li.discount) || 0;
            const net = parseNum(li.lineTotal);
            if (isNaN(qty) || isNaN(price) || isNaN(net)) return true; // BR-22/23 handles
            return approxEqual(qty * price - disc, net);
        }),
    },

    // ── Factură cu cel puțin un articol ────────────────────────────────────

    {
        code: 'BR-16-L',
        severity: 'fatal',
        message: 'Factura trebuie să conțină cel puțin un articol (linie factură).',
        fieldRef: null,
        check: (d) => d.lineItems.length > 0,
    },

    // ── TVA breakdown ────────────────────────────────────────────────────────

    {
        code: 'BR-31',
        severity: 'fatal',
        message: 'Defalcarea TVA (TaxTotal/TaxSubtotal) nu poate fi goală.',
        fieldRef: '#vatBreakdownRows',
        check: (d) => d.vatRows.length > 0,
    },

    {
        code: 'BR-32',
        severity: 'error',
        message: (d) => {
            const bad = d.vatRows.find(r => {
                const rt = parseNum(r.rate);
                return isNaN(rt) || rt < 0 || rt > 100;
            });
            return `Cota TVA ${bad?.rate ?? ''} este invalidă (trebuie 0–100%).`;
        },
        fieldRef: '.vat-rate',
        check: (d) => d.vatRows.every(r => {
            const rt = parseNum(r.rate);
            return !isNaN(rt) && rt >= 0 && rt <= 100;
        }),
    },

    {
        code: 'BR-45',
        severity: 'error',
        message: (d) => {
            const bad = d.vatRows.find(r => !VALID_VAT_TYPES.includes(r.type));
            return `Codul categoriei TVA "${bad?.type ?? ''}" este invalid. Valori acceptate: S, AE, O, Z, E.`;
        },
        fieldRef: '.vat-type',
        check: (d) => d.vatRows.every(r => VALID_VAT_TYPES.includes(r.type)),
    },

    {
        code: 'BR-AE-01',
        severity: 'warning',
        message: 'Categoria AE (Taxare Inversă) trebuie să aibă cota TVA 0%.',
        fieldRef: '.vat-rate',
        check: (d) => d.vatRows
            .filter(r => r.type === 'AE')
            .every(r => parseNum(r.rate) === 0),
    },

    {
        code: 'BR-O-01',
        severity: 'warning',
        message: 'Categoria O (Neplătitor TVA) trebuie să aibă cota TVA 0%.',
        fieldRef: '.vat-rate',
        check: (d) => d.vatRows
            .filter(r => r.type === 'O')
            .every(r => parseNum(r.rate) === 0),
    },

    {
        code: 'BR-E-01',
        severity: 'warning',
        message: 'Categoria E (Neimpozabil) trebuie să aibă cota TVA 0%.',
        fieldRef: '.vat-rate',
        check: (d) => d.vatRows
            .filter(r => r.type === 'E')
            .every(r => parseNum(r.rate) === 0),
    },

    // ── Consistență totaluri ─────────────────────────────────────────────────

    {
        code: 'BR-CO-15',
        severity: 'fatal',
        message: (d) => {
            const sumRows = d.vatRows.reduce((s, r) => s + (parseNum(r.amount) || 0), 0);
            const disp = parseNum(d.totalVat);
            const diff = Math.abs(sumRows - disp).toFixed(2);
            return `Total TVA afișat (${disp.toFixed(2)}) ≠ suma rândurilor TVA (${sumRows.toFixed(2)}). Diferență: ${diff} RON.`;
        },
        fieldRef: '#vat',
        check: (d) => {
            if (d.vatRows.length === 0) return true;
            const sumRows = d.vatRows.reduce((s, r) => s + (parseNum(r.amount) || 0), 0);
            const disp = parseNum(d.totalVat);
            return approxEqual(sumRows, disp);
        },
    },

    {
        code: 'BR-CO-16',
        severity: 'fatal',
        message: (d) => {
            const expected = parseNum(d.subtotal) - parseNum(d.allowances) + parseNum(d.charges) + parseNum(d.totalVat);
            const actual = parseNum(d.grandTotal);
            const diff = Math.abs(expected - actual).toFixed(2);
            return `Total factură (${actual.toFixed(2)}) ≠ subtotal − reduceri + adaosuri + TVA (${expected.toFixed(2)}). Diferență: ${diff} RON.`;
        },
        fieldRef: '#total',
        check: (d) => {
            const expected = parseNum(d.subtotal) - parseNum(d.allowances) + parseNum(d.charges) + parseNum(d.totalVat);
            const actual = parseNum(d.grandTotal);
            if (isNaN(expected) || isNaN(actual)) return true;
            return approxEqual(expected, actual);
        },
    },

    // ── CIUS-RO specifice ────────────────────────────────────────────────────

    {
        code: 'BR-RO-180',
        severity: 'error',
        message: 'CIUS-RO: codul tipului de factură trebuie să fie 380 (factură), 381 (credit note), 384 (corectată) sau 389 (autofactură).',
        fieldRef: '[name="invoiceTypeCode"]',
        check: (d) => d.invoiceTypeCode === '' || VALID_INVOICE_TYPES.includes(d.invoiceTypeCode),
    },

    {
        code: 'BR-RO-003',
        severity: 'warning',
        message: 'CIUS-RO: numărul facturii (ID) nu trebuie să fie gol sau să conțină doar spații.',
        fieldRef: '[name="invoiceNumber"]',
        check: (d) => d.invoiceNumber.trim() !== '',
    },

    {
        code: 'BR-IBAN-01',
        severity: 'warning',
        message: (d) => {
            const badIdx = d.ibans.findIndex(ib => ib && !validateIBAN(ib).valid);
            return `IBAN #${badIdx + 1} invalid: verificați lungimea și cifrele de control.`;
        },
        fieldRef: null,
        fieldRefDynamic: (d) => {
            const badIdx = d.ibans.findIndex(ib => ib && !validateIBAN(ib).valid);
            return badIdx >= 0 ? `[name="paymentMeansIBAN${badIdx}"]` : null;
        },
        check: (d) => d.ibans.every(ib => !ib || validateIBAN(ib).valid),
    },

];

/**
 * Rulează toate regulile pe invoiceData și returnează lista de violări.
 * @param {object} invoiceData — snapshot din collectInvoiceDataForBR()
 * @returns {{ code, severity, message, fieldRef }[]}
 */
export function runBRRules(invoiceData) {
    const violations = [];
    for (const rule of BR_RULES) {
        if (!rule.check(invoiceData)) {
            const msg = typeof rule.message === 'function'
                ? rule.message(invoiceData)
                : rule.message;
            const fRef = rule.fieldRefDynamic
                ? rule.fieldRefDynamic(invoiceData)
                : rule.fieldRef;
            violations.push({
                code: rule.code,
                severity: rule.severity,
                message: msg,
                fieldRef: fRef,
            });
        }
    }
    return violations;
}
