export class InvoiceFormatter {
    constructor() {
        this.locale = navigator.language;
        
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
        const numValue = parseFloat(value);
        return isNaN(numValue) ? '0,00' : this.currencyFormatter.format(numValue);
    }

    formatQuantity(value) {
        const numValue = parseFloat(value);
        return isNaN(numValue) ? '0,000' : this.quantityFormatter.format(numValue);
    }

    formatNumber(value) {
        const numValue = parseFloat(value);
        return isNaN(numValue) ? '0,0000' : this.numberFormatter.format(numValue);
    }

    parseCurrency(value) {
        if (typeof value !== 'string') {
            value = value.toString();
        }
        // Remove all non-digit characters except decimal and minus
        const normalized = value.replace(/[^\d\-.,]/g, '')
                              // Replace thousands separator
                              .replace(/[.,](?=.*[.,])/g, '')
                              // Last dot/comma is decimal separator
                              .replace(/[.,]/, '.');
        return parseFloat(normalized) || 0;
    }

    parseQuantity(value) {
        if (typeof value !== 'string') {
            value = value.toString();
        }
        const normalized = value.replace(/[^\d\-.,]/g, '')
                              .replace(/[.,](?=.*[.,])/g, '')
                              .replace(/[.,]/, '.');
        return parseFloat(normalized) || 0;
    }

    parseNumber(value) {
        if (typeof value !== 'string') {
            value = value.toString();
        }
        const normalized = value.replace(/[^\d\-.,]/g, '')
                              .replace(/[.,](?=.*[.,])/g, '')
                              .replace(/[.,]/, '.');
        return parseFloat(normalized) || 0;
    }
}