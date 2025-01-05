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

            // Line items with formatted values
            items: Array.from(document.querySelectorAll('.line-item')).map((item, index) => ({
                number: index + 1,
                description: item.querySelector('[name^="description"]').value,
                quantity: this.formatter.formatQuantity(item.querySelector('[name^="quantity"]').value),
                unit: item.querySelector('[name^="unit"]').value,
                price: this.formatter.formatCurrency(item.querySelector('[name^="price"]').value),
                vatRate: this.formatter.formatCurrency(item.querySelector('[name^="vatRate"]').value),
                totalAmount: this.formatter.formatCurrency(
                    this.formatter.parseQuantity(item.querySelector('[name^="quantity"]').value) * 
                    this.formatter.parseCurrency(item.querySelector('[name^="price"]').value)
                )
            })),

            // Note
            note: document.querySelector('[name="invoiceNote"]')?.value,

            // Get totals directly from the display elements
            totals: {
                subtotal: document.getElementById('subtotal').textContent,
                allowances: document.getElementById('totalAllowances').textContent,
                charges: document.getElementById('totalCharges').textContent,
                netAmount: document.getElementById('netAmount').textContent,
                vat: document.getElementById('vat').textContent,
                total: document.getElementById('total').textContent
            },

            // VAT Breakdown
            vatBreakdown: Array.from(document.querySelectorAll('.vat-row')).map(row => ({
                type: row.querySelector('.vat-type').value,
                rate: row.querySelector('.vat-rate').value,
                base: row.querySelector('.vat-base').value,
                amount: row.querySelector('.vat-amount').value
            }))
        };
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

            // Generate QR code
            const qrData = {
                invoiceNumber: invoiceData.invoiceNumber,
                issueDate: invoiceData.issueDate,
                supplier: invoiceData.supplier.name,
                customer: invoiceData.customer.name,
                total: invoiceData.totals.total
            };

            const qrElement = this.printWindow.document.getElementById('qrcode');
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
        doc.getElementById('print-document-currency').textContent = data.documentCurrencyCode;
        
        // Currency information
        const taxCurrencyContainer = doc.getElementById('print-tax-currency-container');
        if (data.taxCurrencyCode && data.taxCurrencyCode !== data.documentCurrencyCode) {
            taxCurrencyContainer.style.display = 'block';
            doc.getElementById('print-tax-currency').textContent = data.taxCurrencyCode;
            doc.getElementById('print-exchange-rate').textContent = this.formatter.formatNumber(data.exchangeRate);
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

        // Line items - use formatted values from data
        doc.getElementById('print-items').innerHTML = data.items.map(item => `
            <tr>
                <td>${item.number}</td>
                <td>${item.description}</td>
                <td>${item.unit}</td>
                <td class="number-cell">${item.quantity}</td>
                <td class="number-cell">${item.price}</td>
                <td class="number-cell">${item.vatRate}%</td>
                <td class="number-cell">${item.totalAmount}</td>
            </tr>
        `).join('');

        // Totals - use values directly from display
        doc.getElementById('print-subtotal').textContent = data.totals.subtotal;
        doc.getElementById('print-allowances').textContent = data.totals.allowances;
        doc.getElementById('print-charges').textContent = data.totals.charges;
        doc.getElementById('print-net-amount').textContent = data.totals.netAmount;
        doc.getElementById('print-total').textContent = data.totals.total;

        // VAT Breakdown - use values directly from display
        doc.getElementById('print-vat-breakdown').innerHTML = data.vatBreakdown.map(vat => `
            <div>${this.getVATTypeLabel(vat.type)}</div>
            <div>${vat.rate}%</div>
            <div>${vat.base}</div>
            <div>${vat.amount}</div>
        `).join('');

        // VAT totals
        doc.getElementById('print-vat-currency-main').textContent = data.documentCurrencyCode;
        doc.getElementById('print-vat-main').textContent = data.totals.vat;

        const secondaryVatRow = doc.getElementById('print-vat-secondary');
        if (data.taxCurrencyCode && data.taxCurrencyCode !== data.documentCurrencyCode) {
            secondaryVatRow.style.display = 'flex';
            doc.getElementById('print-vat-currency-secondary').textContent = data.taxCurrencyCode;
            const vatInTaxCurrency = this.formatter.parseCurrency(data.totals.vat) * data.exchangeRate;
            doc.getElementById('print-vat-secondary-amount').textContent = 
                this.formatter.formatCurrency(vatInTaxCurrency);
        }
    }
}