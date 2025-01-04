import { InvoiceFormatter } from './formatter.js';

export class InvoicePrintHandler {
    constructor() {
        this.printWindow = null;
        this.formatter = new InvoiceFormatter();
        this.templates = {
            standard: './templates/print.html',
            compact: './templates/print-compact.html'
        };
        this.currentTemplate = 'standard';
    }

    setTemplate(templateName) {
        if (this.templates[templateName]) {
            this.currentTemplate = templateName;
        }
    }    

    collectInvoiceData() {
        return {
            // Basic details
            invoiceNumber: document.querySelector('[name="invoiceNumber"]').value,
            issueDate: document.querySelector('[name="issueDate"]').value,
            dueDate: document.querySelector('[name="dueDate"]').value,
            documentCurrencyCode: document.querySelector('[name="documentCurrencyCode"]').value.toUpperCase() || 'RON',
            taxCurrencyCode: document.querySelector('[name="taxCurrencyCode"]').value.toUpperCase(),
            exchangeRate: parseFloat(document.querySelector('[name="exchangeRate"]')?.value || 1),

            // Supplier details
            supplier: {
                name: document.querySelector('[name="supplierName"]').value,
                vat: document.querySelector('[name="supplierVAT"]').value,
                companyId: document.querySelector('[name="supplierCompanyId"]').value,
                address: document.querySelector('[name="supplierAddress"]').value,
                city: document.querySelector('[name="supplierCity"]').value,
                county: document.querySelector('[name="supplierCountrySubentity"]').value,
                country: document.querySelector('[name="supplierCountry"]').value,
                phone: document.querySelector('[name="supplierPhone"]').value,
                contactName: document.querySelector('[name="supplierContactName"]').value,
                email: document.querySelector('[name="supplierEmail"]').value                
            },

            // Customer details
            customer: {
                name: document.querySelector('[name="customerName"]').value,
                vat: document.querySelector('[name="customerVAT"]').value,
                companyId: document.querySelector('[name="customerCompanyId"]').value,
                address: document.querySelector('[name="customerAddress"]').value,
                city: document.querySelector('[name="customerCity"]').value,
                county: document.querySelector('[name="customerCountrySubentity"]').value,
                country: document.querySelector('[name="customerCountry"]').value,
                phone: document.querySelector('[name="customerPhone"]').value,
                contactName: document.querySelector('[name="customerContactName"]').value,
                email: document.querySelector('[name="customerEmail"]').value
            },

            // Line items
            items: Array.from(document.querySelectorAll('.line-item')).map((item, index) => ({
                number: index + 1,
                description: item.querySelector('[name^="description"]').value,
                quantity: parseFloat(item.querySelector('[name^="quantity"]').value),
                unit: item.querySelector('[name^="unit"]').value,
                price: parseFloat(item.querySelector('[name^="price"]').value),
                vatType: item.querySelector('[name^="vatType"]').value,
                vatRate: parseFloat(item.querySelector('[name^="vatRate"]').value)
            })),

            // Note
            note: document.querySelector('[name="invoiceNote"]')?.value,

            // Totals
            totals: {
                subtotal: parseFloat(document.getElementById('subtotal').textContent),
                allowances: parseFloat(document.getElementById('totalAllowances').textContent),
                charges: parseFloat(document.getElementById('totalCharges').textContent),
                netAmount: parseFloat(document.getElementById('netAmount').textContent),
                vat: parseFloat(document.getElementById('vat').textContent),
                total: parseFloat(document.getElementById('total').textContent)
            },

            // VAT Breakdown
            vatBreakdown: Array.from(document.querySelectorAll('.vat-row')).map(row => ({
                type: row.querySelector('.vat-type').value,
                rate: parseFloat(row.querySelector('.vat-rate').value),
                base: parseFloat(row.querySelector('.vat-base').value),
                amount: parseFloat(row.querySelector('.vat-amount').value)
            }))
        };
    }

    getVATTypeLabel(type) {
        const labels = {
            'S': 'Standard',
            'AE': 'Taxare Inversă',
            'O': 'Neplătitor TVA',
            'Z': 'Cotă 0%',
            'E': 'Scutit'
        };
        return labels[type] || type;
    }

    createPartyHTML(party) {
        return `
            <p><strong>${party.name}</strong></p>
            <p>CUI: ${party.vat}</p>
            <p>Nr. Reg. Com.: ${party.companyId}</p>
            <p>${party.address}</p>
            <p>${party.city}${party.county ? ', ' + party.county : ''}</p>
            <p>${party.country}</p>
            ${party.phone ? `<p>Tel: ${party.phone}</p>` : ''}
            ${party.contactName ? `<p>Contact: ${party.contactName}</p>` : ''}
            ${party.email ? `<p>Email: ${party.email}</p>` : ''}
        `;
    }

    async print() {
        try {
            // Collect all the data
            const invoiceData = this.collectInvoiceData();

            // Open new window and load the selected print template
            this.printWindow = window.open(
                this.templates[this.currentTemplate], 
                '_blank', 
                'width=800,height=600'
            );
            
            // Wait for the window to load
            await new Promise(resolve => {
                this.printWindow.onload = resolve;
            });

            // Populate the template with data
            this.populatePrintWindow(invoiceData);

            // Print the window
            this.printWindow.print();

            // Clean up
            this.printWindow.onafterprint = () => {
                this.printWindow.close();
                this.printWindow = null;
            };

        } catch (error) {
            console.error('Print failed:', error);
            if (this.printWindow) {
                this.printWindow.close();
                this.printWindow = null;
            }
            alert('A apărut o eroare la printare. Vă rugăm să încercați din nou.');
        }
    }

    populatePrintWindow(data) {
        if (!this.printWindow) return;

        const doc = this.printWindow.document;

        // Basic details
        doc.getElementById('print-invoice-number').textContent = data.invoiceNumber;
        doc.getElementById('print-issue-date').textContent = data.issueDate;
        doc.getElementById('print-due-date').textContent = data.dueDate;

        // Currency information
        doc.getElementById('print-document-currency').textContent = data.documentCurrencyCode;
        
        const taxCurrencyContainer = doc.getElementById('print-tax-currency-container');
        if (data.taxCurrencyCode && data.taxCurrencyCode !== data.documentCurrencyCode) {
            taxCurrencyContainer.style.display = 'block';
            doc.getElementById('print-tax-currency').textContent = data.taxCurrencyCode;
            doc.getElementById('print-exchange-rate').textContent = 
                this.formatter.formatNumber(data.exchangeRate);
        }

        // Generate QR code
        const qrData = {
            invoiceNumber: data.invoiceNumber,
            issueDate: data.issueDate,
            supplier: data.supplier.name,
            customer: data.customer.name,
            total: this.formatter.formatCurrency(data.totals.total)
        };

        const qrElement = doc.getElementById('qrcode');
        if (qrElement) {
            new this.printWindow.QRCode(qrElement, {
                text: JSON.stringify(qrData),
                width: 100,
                height: 100,
                colorDark: "#2563eb",
                colorLight: "#ffffff",
                correctLevel: this.printWindow.QRCode.CorrectLevel.L
            });
        }

        // Party details
        doc.getElementById('print-supplier-details').innerHTML = this.createPartyHTML(data.supplier);
        doc.getElementById('print-customer-details').innerHTML = this.createPartyHTML(data.customer);

        // Note
        if (data.note) {
            const noteSection = doc.getElementById('print-note');
            noteSection.style.display = 'block';
            noteSection.querySelector('div').textContent = data.note;
        }

        // Line items
        doc.getElementById('print-items').innerHTML = data.items.map(item => `
            <tr>
                <td>${item.number}</td>
                <td>${item.description}</td>
                <td>${item.unit}</td>
                <td class="number-cell">${this.formatter.formatQuantity(item.quantity)}</td>
                <td class="number-cell">${this.formatter.formatCurrency(item.price)}</td>
                <td class="number-cell">${this.formatter.formatCurrency(item.vatRate)}%</td>
                <td class="number-cell">${this.formatter.formatCurrency(item.quantity * item.price)}</td>
            </tr>
        `).join('');

        // Totals
        doc.getElementById('print-subtotal').textContent = 
            this.formatter.formatCurrency(data.totals.subtotal);
        doc.getElementById('print-allowances').textContent = 
            this.formatter.formatCurrency(data.totals.allowances);
        doc.getElementById('print-charges').textContent = 
            this.formatter.formatCurrency(data.totals.charges);
        doc.getElementById('print-net-amount').textContent = 
            this.formatter.formatCurrency(data.totals.netAmount);
        doc.getElementById('print-total').textContent = 
            this.formatter.formatCurrency(data.totals.total);

        // VAT Breakdown
        doc.getElementById('print-vat-breakdown').innerHTML = data.vatBreakdown.map(vat => `
            <div>${this.getVATTypeLabel(vat.type)}</div>
            <div>${this.formatter.formatCurrency(vat.rate)}%</div>
            <div>${this.formatter.formatCurrency(vat.base)}</div>
            <div>${this.formatter.formatCurrency(vat.amount)}</div>
        `).join('');

        // VAT totals
        doc.getElementById('print-vat-currency-main').textContent = data.documentCurrencyCode;
        doc.getElementById('print-vat-main').textContent = 
            this.formatter.formatCurrency(data.totals.vat);

        const secondaryVatRow = doc.getElementById('print-vat-secondary');
        if (data.taxCurrencyCode && data.taxCurrencyCode !== data.documentCurrencyCode) {
            secondaryVatRow.style.display = 'flex';
            doc.getElementById('print-vat-currency-secondary').textContent = data.taxCurrencyCode;
            const vatInTaxCurrency = data.totals.vat * data.exchangeRate;
            doc.getElementById('print-vat-secondary-amount').textContent = 
                this.formatter.formatCurrency(vatInTaxCurrency);
        }
    }
}