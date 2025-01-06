// advanced.test.js
import { expect } from 'chai';
import { setupDOM, createTestLineItem, createTestAllowanceCharge } from './test-config.js';

describe('Advanced eInvoice Tests', () => {
    let dom;
    let window;
    
    beforeEach(() => {
        dom = setupDOM();
        window = dom.window;
    });

    describe('Edge Case Tests', () => {
        it('should handle zero-value invoices correctly', () => {
            createTestLineItem(window, '0', '0');
            expect(window.document.getElementById('subtotal').textContent).to.equal('0,00');
            expect(window.document.getElementById('vat').textContent).to.equal('0,00');
            expect(window.document.getElementById('total').textContent).to.equal('0,00');
        });

        it('should handle negative quantities for return invoices', () => {
            createTestLineItem(window, '-2', '100');
            const subtotal = window.formatter.parseCurrency(
                window.document.getElementById('subtotal').textContent
            );
            expect(subtotal).to.be.below(0);
        });
    });

    describe('VAT Calculation Tests', () => {
        it('should handle multiple VAT rates correctly', () => {
            // Standard rate (19%)
            createTestLineItem(window, '1', '100', 'S', '19');
            
            // Reduced rate (9%)
            createTestLineItem(window, '1', '100', 'S', '9');

            const totalVat = window.formatter.parseCurrency(
                window.document.getElementById('vat').textContent
            );
            expect(totalVat).to.be.closeTo(28, 0.01);
        });

        it('should handle reverse charge VAT correctly', () => {
            createTestLineItem(window, '1', '100', 'AE', '0');
            
            const vatAmount = window.formatter.parseCurrency(
                window.document.getElementById('vat').textContent
            );
            expect(vatAmount).to.equal(0);
        });
    });

    describe('Complex VAT Scenarios', () => {
        it('should handle mixed VAT types in one invoice', () => {
            // Standard VAT
            createTestLineItem(window, '1', '100', 'S', '19');
            
            // Reverse Charge
            createTestLineItem(window, '1', '200', 'AE', '0');
            
            // VAT Exempt
            createTestLineItem(window, '1', '300', 'E', '0');

            const vatAmount = window.formatter.parseCurrency(
                window.document.getElementById('vat').textContent
            );
            expect(vatAmount).to.equal(19);

            const total = window.formatter.parseCurrency(
                window.document.getElementById('total').textContent
            );
            expect(total).to.equal(619);
        });

        it('should handle VAT for allowances and charges', () => {
            // Item with standard VAT
            createTestLineItem(window, '1', '1000', 'S', '19');
            
            // Add transport charge
            createTestAllowanceCharge(window, '50', true, 'S', '19');

            const vatAmount = window.formatter.parseCurrency(
                window.document.getElementById('vat').textContent
            );
            const expectedVAT = (1000 + 50) * 0.19;
            expect(vatAmount).to.be.closeTo(expectedVAT, 0.01);
        });
    });
});