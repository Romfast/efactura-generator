export class InvoiceFormatter {
    constructor() {
        this.locale = navigator.language || 'en-US';
        
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
        if (isNaN(numValue)) return '0.00';
        return this.currencyFormatter.format(numValue);
    }

    formatQuantity(value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return '0.000';
        return this.quantityFormatter.format(numValue);
    }

    formatNumber(value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return '0.0000';
        return this.numberFormatter.format(numValue);
    }
}