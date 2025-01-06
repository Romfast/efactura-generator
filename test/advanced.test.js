// test/advanced.test.js
import { expect } from 'chai';
import { loadTestFile, loadFixture } from './test-utils.js';
import { setupDOM } from './test-config.js';

describe('Advanced eInvoice Tests', () => {
    let dom;
    let document;
    let window;
    let formatter;

    beforeEach(async () => {
        const html = await loadTestFile('index.html');
        dom = setupDOM(html);
        document = dom.window.document;
        window = dom.window;

        // Setup formatter
        formatter = window.InvoiceFormatter ? new window.InvoiceFormatter() : {
            formatCurrency: (value) => value.toLocaleString('ro-RO', { 
                minimumFractionDigits: 2, 
                maximumFractionDigits: 2 
            }),
            parseCurrency: (value) => parseFloat(value.replace(/\./g, '').replace(',', '.')) || 0
        };

        // Add helper for dispatching test events
        window.dispatchTestEvent = (element, eventType) => {
            const event = new dom.window.Event(eventType, { bubbles: true });
            element.dispatchEvent(event);
        };
    });

    describe('Edge Case Tests', () => {
        it('should handle zero-value invoices correctly', async () => {
            window.addLineItem();
            const quantityInput = document.querySelector('[name="quantity0"]');
            const priceInput = document.querySelector('[name="price0"]');
            
            quantityInput.value = '0';
            priceInput.value = '0';
            
            window.dispatchTestEvent(quantityInput, 'change');
            window.dispatchTestEvent(priceInput, 'change');
            window.refreshTotals();

            expect(document.getElementById('subtotal').textContent).to.equal('0,00');
            expect(document.getElementById('vat').textContent).to.equal('0,00');
            expect(document.getElementById('total').textContent).to.equal('0,00');
        });

        it('should handle negative quantities for return invoices', async () => {
            window.addLineItem();
            const quantityInput = document.querySelector('[name="quantity0"]');
            const priceInput = document.querySelector('[name="price0"]');
            
            quantityInput.value = '-2';
            priceInput.value = '100';
            
            window.dispatchTestEvent(quantityInput, 'change');
            window.dispatchTestEvent(priceInput, 'change');
            window.refreshTotals();

            const subtotal = formatter.parseCurrency(document.getElementById('subtotal').textContent);
            expect(subtotal).to.be.below(0);
        });

        it('should handle maximum value limits', async () => {
            window.addLineItem();
            const quantityInput = document.querySelector('[name="quantity0"]');
            const priceInput = document.querySelector('[name="price0"]');
            
            quantityInput.value = '999999.999';
            priceInput.value = '999999.99';
            
            window.dispatchTestEvent(quantityInput, 'change');
            window.dispatchTestEvent(priceInput, 'change');
            window.refreshTotals();

            const total = document.getElementById('total').textContent;
            expect(total).to.not.include('Infinity');
            expect(total).to.not.include('NaN');
        });
    });

    describe('VAT Calculation Tests', () => {
        it('should handle multiple VAT rates correctly', async () => {
            // Standard rate (19%)
            window.addLineItem();
            const item1 = {
                quantity: document.querySelector('[name="quantity0"]'),
                price: document.querySelector('[name="price0"]'),
                vatType: document.querySelector('[name="vatType0"]'),
                vatRate: document.querySelector('[name="vatRate0"]')
            };
            
            item1.quantity.value = '1';
            item1.price.value = '100';
            item1.vatType.value = 'S';
            item1.vatRate.value = '19';

            // Reduced rate (9%)
            window.addLineItem();
            const item2 = {
                quantity: document.querySelector('[name="quantity1"]'),
                price: document.querySelector('[name="price1"]'),
                vatType: document.querySelector('[name="vatType1"]'),
                vatRate: document.querySelector('[name="vatRate1"]')
            };
            
            item2.quantity.value = '1';
            item2.price.value = '100';
            item2.vatType.value = 'S';
            item2.vatRate.value = '9';

            window.refreshTotals();

            const totalVat = formatter.parseCurrency(document.getElementById('vat').textContent);
            expect(totalVat).to.be.closeTo(28, 0.01); // 19 + 9
        });

        it('should handle reverse charge VAT correctly', async () => {
            window.addLineItem();
            const vatTypeSelect = document.querySelector('[name="vatType0"]');
            const quantityInput = document.querySelector('[name="quantity0"]');
            const priceInput = document.querySelector('[name="price0"]');
            
            vatTypeSelect.value = 'AE';
            quantityInput.value = '1';
            priceInput.value = '100';
            
            window.dispatchTestEvent(vatTypeSelect, 'change');
            window.refreshTotals();

            const vatAmount = formatter.parseCurrency(document.getElementById('vat').textContent);
            expect(vatAmount).to.equal(0);
        });

        it('should handle VAT exemption correctly', async () => {
            window.addLineItem();
            const vatTypeSelect = document.querySelector('[name="vatType0"]');
            const quantityInput = document.querySelector('[name="quantity0"]');
            const priceInput = document.querySelector('[name="price0"]');
            
            vatTypeSelect.value = 'E';
            quantityInput.value = '1';
            priceInput.value = '100';
            
            window.dispatchTestEvent(vatTypeSelect, 'change');
            window.refreshTotals();

            const vatAmount = formatter.parseCurrency(document.getElementById('vat').textContent);
            expect(vatAmount).to.equal(0);
        });
    });

    describe('Complex VAT Scenarios', () => {
        it('should handle mixed VAT types in one invoice', async () => {
            // Standard VAT
            window.addLineItem();
            document.querySelector('[name="quantity0"]').value = '1';
            document.querySelector('[name="price0"]').value = '100';
            document.querySelector('[name="vatType0"]').value = 'S';
            document.querySelector('[name="vatRate0"]').value = '19';

            // Reverse Charge
            window.addLineItem();
            document.querySelector('[name="quantity1"]').value = '1';
            document.querySelector('[name="price1"]').value = '200';
            document.querySelector('[name="vatType1"]').value = 'AE';

            // VAT Exempt
            window.addLineItem();
            document.querySelector('[name="quantity2"]').value = '1';
            document.querySelector('[name="price2"]').value = '300';
            document.querySelector('[name="vatType2"]').value = 'E';

            window.refreshTotals();

            const vatAmount = formatter.parseCurrency(document.getElementById('vat').textContent);
            expect(vatAmount).to.equal(19);

            const total = formatter.parseCurrency(document.getElementById('total').textContent);
            expect(total).to.equal(619);
        });

        it('should handle VAT for allowances and charges', async () => {
            // Item with standard VAT
            window.addLineItem();
            document.querySelector('[name="quantity0"]').value = '1';
            document.querySelector('[name="price0"]').value = '1000';
            document.querySelector('[name="vatType0"]').value = 'S';
            document.querySelector('[name="vatRate0"]').value = '19';

            // Add transport charge
            window.addAllowanceCharge();
            const charge = {
                type: document.querySelector('[name="chargeType0"]'),
                amount: document.querySelector('[name="chargeAmount0"]'),
                vatType: document.querySelector('[name="chargeVatType0"]'),
                vatRate: document.querySelector('[name="chargeVatRate0"]')
            };

            charge.type.value = 'true';
            charge.amount.value = '50';
            charge.vatType.value = 'S';
            charge.vatRate.value = '19';

            window.refreshTotals();

            const vatAmount = formatter.parseCurrency(document.getElementById('vat').textContent);
            const expectedVAT = (1000 + 50) * 0.19;
            expect(vatAmount).to.be.closeTo(expectedVAT, 0.01);
        });
    });

    describe('Number Formatting Tests', () => {
        it('should format numbers according to locale', () => {
            const testCases = [
                { input: 1234.56, expected: '1.234,56' },
                { input: 1234, expected: '1.234,00' },
                { input: 0.1, expected: '0,10' },
                { input: -1234.56, expected: '-1.234,56' }
            ];

            testCases.forEach(({ input, expected }) => {
                const formatted = formatter.formatCurrency(input);
                expect(formatted).to.equal(expected);
            });
        });

        it('should parse formatted numbers correctly', () => {
            const testCases = [
                { input: '1.234,56', expected: 1234.56 },
                { input: '1.234', expected: 1234 },
                { input: '0,10', expected: 0.10 },
                { input: '-1.234,56', expected: -1234.56 }
            ];

            testCases.forEach(({ input, expected }) => {
                const parsed = formatter.parseCurrency(input);
                expect(parsed).to.equal(expected);
            });
        });

        it('should handle special number formats', () => {
            const testCases = [
                { input: '1.234.567,89', expected: 1234567.89 },
                { input: '1 234 567,89', expected: 1234567.89 },
                { input: '1,234,567.89', expected: 1234567.89 },
                { input: '(1.234,56)', expected: -1234.56 },
                { input: '+1.234,56', expected: 1234.56 }
            ];

            testCases.forEach(({ input, expected }) => {
                const parsed = formatter.parseCurrency(input);
                expect(parsed).to.be.closeTo(expected, 0.01);
            });
        });
    });

    describe('Validation Tests', () => {
        it('should validate invoice dates', async () => {
            const issueDateInput = document.querySelector('[name="issueDate"]');

            const invalidDates = [
                '32.01.2024',
                '00.01.2024',
                '15.13.2024',
                '15.00.2024',
                '2024-01-15'
            ];

            for (const date of invalidDates) {
                issueDateInput.value = date;
                window.dispatchTestEvent(issueDateInput, 'blur');
                expect(issueDateInput.classList.contains('invalid')).to.be.true;
            }

            // Test valid date
            issueDateInput.value = '15.01.2024';
            window.dispatchTestEvent(issueDateInput, 'blur');
            expect(issueDateInput.classList.contains('invalid')).to.be.false;
        });

        it('should validate VAT numbers', async () => {
            const vatInput = document.querySelector('[name="supplierVAT"]');
            
            const validVAT = ['RO1234567', 'RO12345678', 'RO123456789'];
            const invalidVAT = ['RO123456', 'XX12345678', '12345678'];

            for (const vat of validVAT) {
                vatInput.value = vat;
                window.dispatchTestEvent(vatInput, 'blur');
                expect(vatInput.classList.contains('invalid')).to.be.false;
            }

            for (const vat of invalidVAT) {
                vatInput.value = vat;
                window.dispatchTestEvent(vatInput, 'blur');
                expect(vatInput.classList.contains('invalid')).to.be.true;
            }
        });
    });
});