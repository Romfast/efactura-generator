// js/numeric.js
//
// Numeric pipeline canonică pentru editor eFactura (PR-E / Track 1).
//
// Trei reguli fundamentale:
//
//   1. `input.dataset.raw` este unica sursă de adevăr numerică (canonical
//      decimal-dot string). `input.value` este display-only — locale
//      "ro-RO" cu virgulă decimală.
//
//   2. Toate calculele folosesc Big.js (precizie arbitrară), niciodată
//      Number. Rounding mode: HALF_UP (standard fiscal RO).
//
//   3. Parserul este strict-but-pragmatic: acceptă atât canonicul XML
//      ("1234.56") cât și displayul RO ("1234,56" / "1.234,56"). Refuză
//      formele EN ambigue ("1,234.56").
//
// Prefix module exports:
//   - `Big` re-export pentru consumeri (single source of truth pentru
//     pin-ul vendored).
//   - `parseStrict(value)` → Big | null. null pentru NaN / empty / format
//     ambiguu.
//   - `parseStrictOr(value, fallback)` → Big. Fallback la "0" dacă invalid.
//   - `format2`, `format3`, `format4` → string ro-RO display cu zecimale fix.
//   - `formatRaw(big, decimals)` → string canonical decimal-dot pentru XML.
//   - `setRaw(input, value)` → setează dataset.raw + input.value formatted.
//   - `getRaw(input)` → Big citit din dataset.raw, fallback la parseStrict
//     pe input.value.
//   - `lineTotal(qty, price, discount, vatRate)` → { net, vat, gross } cu Big.

import Big from './vendor/big.mjs';

// HALF_UP = 1 în big.js. (HALF_EVEN = 2, HALF_DOWN = 3 — vezi big.mjs).
Big.RM = 1;
// Default decimal places pentru division (suficient pentru calcul intermediar).
Big.DP = 20;

export { Big };

// Locale hardcoded pentru proiectul RO. NU folosim navigator.language —
// vezi DESIGN.md / E2.
export const RO_LOCALE = 'ro-RO';

const _displayFmt = {
    2: new Intl.NumberFormat(RO_LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true }),
    3: new Intl.NumberFormat(RO_LOCALE, { minimumFractionDigits: 3, maximumFractionDigits: 3, useGrouping: true }),
    4: new Intl.NumberFormat(RO_LOCALE, { minimumFractionDigits: 4, maximumFractionDigits: 4, useGrouping: true }),
};

/**
 * Parser strict-but-pragmatic.
 *
 * Acceptă:
 *   - canonical XML / număr cu zecimală pe punct: "1234.56", "0.001"
 *   - RO display cu zecimală pe virgulă: "1234,56", "1.234,56", "1.234.567,89"
 *   - integer: "0", "-12", "  42  "
 *   - Big sau Number: returnate direct (Number → Big via toString).
 *
 * Refuză (returnează null):
 *   - empty string / null / undefined
 *   - NaN (după ce s-a încercat normalizarea)
 *   - format EN cu thousands separator pe virgulă: "1,234.56" (ambiguu pentru RO)
 *   - alte caractere non-numerice: "abc", "1.2.3" cu mai multe puncte și fără virgulă
 *
 * @param {string|number|Big|null|undefined} value
 * @returns {Big|null}
 */
export function parseStrict(value) {
    if (value === null || value === undefined) return null;
    if (value instanceof Big) return value;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) return null;
        return new Big(value.toString());
    }
    if (typeof value !== 'string') return null;

    let s = value.trim();
    if (s === '') return null;

    // Optional leading minus.
    let sign = '';
    if (s.startsWith('-')) { sign = '-'; s = s.slice(1); }
    else if (s.startsWith('+')) { s = s.slice(1); }
    if (s === '') return null;

    const dotCount = (s.match(/\./g) || []).length;
    const commaCount = (s.match(/,/g) || []).length;

    let canonical;
    if (commaCount === 0 && dotCount === 0) {
        // integer
        if (!/^\d+$/.test(s)) return null;
        canonical = s;
    } else if (commaCount === 0 && dotCount === 1) {
        // canonical decimal-dot: "1234.56"
        if (!/^\d+\.\d+$/.test(s)) return null;
        canonical = s;
    } else if (commaCount === 0 && dotCount > 1) {
        // ambigu: "1.2.3" — refuz
        return null;
    } else if (commaCount === 1) {
        // RO: virgula = decimală; punctele = thousands.
        // Forma așteptată: cifre[.cifre[.cifre]]*,cifre+
        if (!/^\d{1,3}(?:\.\d{3})*,\d+$/.test(s) && !/^\d+,\d+$/.test(s)) {
            return null;
        }
        canonical = s.replace(/\./g, '').replace(',', '.');
    } else {
        // commaCount > 1 — nu e RO valid. Refuz (ar putea fi EN "1,234,567.89"
        // dar asta e ambiguu pentru audiența RO).
        return null;
    }

    try {
        return new Big(sign + canonical);
    } catch (_) {
        return null;
    }
}

/**
 * Variantă "or fallback" pentru cazurile unde un fallback la zero e
 * acceptabil (display, sumare). NU folosi pentru validare.
 *
 * @param {*} value
 * @param {string|number|Big} fallback
 * @returns {Big}
 */
export function parseStrictOr(value, fallback = '0') {
    const parsed = parseStrict(value);
    if (parsed !== null) return parsed;
    if (fallback instanceof Big) return fallback;
    return new Big(fallback);
}

/** Format Big → string display ro-RO cu N zecimale fixe. */
function _format(value, decimals) {
    const big = (value instanceof Big) ? value : parseStrictOr(value);
    const fmt = _displayFmt[decimals] || _displayFmt[2];
    // Big.toFixed(decimals) → canonical decimal-dot. Convert la Number
    // doar pentru Intl format (number passes through cu precizie suficientă
    // pentru valori fiscale practice).
    return fmt.format(Number(big.toFixed(decimals)));
}

export function format2(value) { return _format(value, 2); }
export function format3(value) { return _format(value, 3); }
export function format4(value) { return _format(value, 4); }

/**
 * Format pentru ieșirea XML: canonical decimal-dot, fix N zecimale,
 * fără thousands separator. Folosit la serializare UBL.
 *
 * @param {*} value
 * @param {number} decimals
 * @returns {string}
 */
export function formatRaw(value, decimals = 2) {
    const big = (value instanceof Big) ? value : parseStrictOr(value);
    return big.toFixed(decimals);
}

/**
 * Setează valoarea unui input numeric:
 *   - `dataset.raw` ← canonical decimal-dot (sursa de adevăr)
 *   - `input.value` ← display ro-RO cu N zecimale
 *
 * Folosit la populare din XML și la commit-ul user-editat (post-blur).
 *
 * @param {HTMLInputElement} input
 * @param {*} value Big | string | number
 * @param {number} decimals decimale display (2 = currency, 3 = qty, 4 = price)
 */
export function setRaw(input, value, decimals = 2) {
    const big = (value instanceof Big) ? value : parseStrictOr(value);
    input.dataset.raw = big.toFixed(decimals);
    // type="number" acceptă doar punct decimal; type="text" primește display ro-RO
    input.value = (input.type === 'number') ? big.toFixed(decimals) : _format(big, decimals);
}

/**
 * Citește valoarea numerică canonică a unui input.
 *   - Preferă `dataset.raw` (set de noi pe populate / blur).
 *   - Fallback la `parseStrict(input.value)` dacă raw absent.
 *   - Fallback final la Big("0").
 *
 * @param {HTMLInputElement} input
 * @returns {Big}
 */
export function getRaw(input) {
    if (!input) return new Big('0');
    if (input.dataset && input.dataset.raw !== undefined && input.dataset.raw !== '') {
        const parsed = parseStrict(input.dataset.raw);
        if (parsed !== null) return parsed;
    }
    return parseStrictOr(input.value, '0');
}

/**
 * Marchează un input ca dirty (editat de user). PR-A11 va folosi acest
 * flag pentru tolerance switching (zero pe row dirty, ±0.01 RON pe row
 * loaded).
 */
export function markDirty(input) {
    if (input && input.dataset) input.dataset.dirty = '1';
}

/**
 * Atașează handler-ul de blur care:
 *   1. parseStrict pe input.value
 *   2. setRaw cu valoarea normalizată (sau lasă raw existent dacă parse eșuează
 *      și marchează vizual ca invalid).
 *   3. markDirty.
 *
 * @param {HTMLInputElement} input
 * @param {number} decimals
 */
export function wireDatasetRaw(input, decimals = 2) {
    if (!input || input.dataset.rawWired === '1') return;
    input.addEventListener('blur', () => {
        const parsed = parseStrict(input.value);
        if (parsed === null && input.value.trim() !== '') {
            input.classList.add('invalid');
            return;
        }
        input.classList.remove('invalid');
        if (parsed !== null) {
            setRaw(input, parsed, decimals);
            markDirty(input);
        }
    });
    // La input change, marchează dirty (dar nu reformatează — lasă user să tasteze).
    input.addEventListener('input', () => markDirty(input));
    input.dataset.rawWired = '1';
}

/**
 * Calculează totalul pe linia de factură.
 *
 *   net   = (qty * price) - lineDiscount
 *   vat   = round2(net * vatRate / 100)
 *   gross = net + vat
 *
 * @param {*} qty
 * @param {*} price
 * @param {*} discount
 * @param {*} vatRate procent (ex. 19 pentru 19%)
 * @returns {{net: Big, vat: Big, gross: Big}}
 */
export function lineTotal(qty, price, discount, vatRate) {
    const q = parseStrictOr(qty, '0');
    const p = parseStrictOr(price, '0');
    const d = parseStrictOr(discount, '0');
    const r = parseStrictOr(vatRate, '0');

    const gross = q.times(p);
    const net = gross.minus(d);
    const vat = net.times(r).div(100).round(2, 1); // HALF_UP
    const total = net.plus(vat);

    return { net, vat, gross: total };
}

/**
 * Helper: a.eq(b) cu toleranță. Returnează true dacă |a - b| ≤ epsilon.
 * Pentru A11 reconciliation legacy: ±0.01 RON.
 */
export function withinTolerance(a, b, epsilon) {
    const aB = (a instanceof Big) ? a : parseStrictOr(a);
    const bB = (b instanceof Big) ? b : parseStrictOr(b);
    const eB = (epsilon instanceof Big) ? epsilon : parseStrictOr(epsilon);
    return aB.minus(bB).abs().lte(eB);
}
