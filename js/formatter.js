// js/formatter.js
//
// Compatibility-layer formatter folosit de print template + script.js
// pentru afișare. Internal delegate la js/numeric.js (PR-E E1+E3+E4).
//
// E2: locale hardcoded "ro-RO" (înlocuit `navigator.language`). Audiența
// țintă e RO; print PDF / display formular trebuie să fie consistent
// între browsere și OS-uri.

import { RO_LOCALE, parseStrict, parseStrictOr, format2, format3, format4 } from './numeric.js';

export class InvoiceFormatter {
    constructor() {
        this.locale = RO_LOCALE;

        this.currencyFormatter = new Intl.NumberFormat(this.locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
        });

        this.quantityFormatter = new Intl.NumberFormat(this.locale, {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
            useGrouping: true
        });

        this.numberFormatter = new Intl.NumberFormat(this.locale, {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
            useGrouping: true
        });
    }

    formatCurrency(value) {
        const big = (value === '' || value === null || value === undefined)
            ? null
            : parseStrict(value);
        return big === null ? '0,00' : format2(big);
    }

    formatQuantity(value) {
        const big = (value === '' || value === null || value === undefined)
            ? null
            : parseStrict(value);
        return big === null ? '0,000' : format3(big);
    }

    formatNumber(value) {
        const big = (value === '' || value === null || value === undefined)
            ? null
            : parseStrict(value);
        return big === null ? '0,0000' : format4(big);
    }

    /**
     * Strict-but-pragmatic parsing → number (pentru consumatorii vechi).
     * Pentru cod nou, preferă `parseStrict` din numeric.js (returnează Big).
     */
    parseCurrency(value) {
        return Number(parseStrictOr(value, '0').toString());
    }

    parseQuantity(value) {
        return Number(parseStrictOr(value, '0').toString());
    }

    parseNumber(value) {
        return Number(parseStrictOr(value, '0').toString());
    }
}
