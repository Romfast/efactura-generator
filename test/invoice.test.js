// invoice.test.js
import { expect } from 'chai';
import { setupDOM, createTestLineItem } from './test-config.js';
import { loadFixture } from './test-utils.js';

describe('eInvoice Application Tests', () => {
    let dom;
    let window;
    
    beforeEach(() => {
        dom = setupDOM();
        window = dom.window;
    });

    describe('XML Loading Tests', () => {
        it('should correctly load an invoice XML file', async () => {
            const sampleXML = await loadFixture('factura_1_emag_taxa_transport.xml');
            const file = new window.Blob([sampleXML], { type: 'application/xml' });
            Object.defineProperty(file, 'name', { value: 'invoice.xml' });
            
            await window.handleFileSelect({ target: { files: [file] } });
            await new Promise(resolve => setTimeout(resolve, 100));
            
            expect(window.document.querySelector('[name="invoiceNumber"]').value).to.equal('1');
            expect(window.document.querySelector('[name="issueDate"]').value).to.equal('01.01.2025');
            expect(window.document.querySelector('[name="supplierName"]').value).to.equal('DANTE INTERNATIONAL SA');
            expect(window.document.querySelector('[name="supplierVAT"]').value).to.equal('RO14399840');
            
            const lineItem = window.document.querySelector('.line-item');
            expect(lineItem).to.exist;
            expect(window.document.querySelector('[name="quantity0"]').value).to.equal('1.0');
            expect(window.document.querySelector('[name="price0"]').value).to.equal('1260.5');
            
            expect(window.document.getElementById('subtotal').textContent).to.equal('1.260,50');
            expect(window.document.getElementById('total').textContent).to.equal('1.518,99');
        });
    });

    describe('Line Item Tests', () => {
        it('should add a new line item correctly', () => {
            const initialCount = window.document.querySelectorAll('.line-item').length;
            window.addLineItem();
            const newCount = window.document.querySelectorAll('.line-item').length;
            expect(newCount).to.equal(initialCount + 1);

            const newItem = window.document.querySelector('.line-item:last-child');
            expect(newItem.querySelector('[name^="quantity"]')).to.exist;
            expect(newItem.querySelector('[name^="price"]')).to.exist;
            expect(newItem.querySelector('[name^="vatType"]')).to.exist;
            expect(newItem.querySelector('[name^="unit"]')).to.exist;
        });

        it('should delete a line item correctly', () => {
            window.addLineItem();
            const initialCount = window.document.querySelectorAll('.line-item').length;
            
            window.removeLineItem(0);
            const newCount = window.document.querySelectorAll('.line-item').length;
            expect(newCount).to.equal(initialCount - 1);
            window.refreshTotals();
            expect(window.document.getElementById('subtotal').textContent).to.equal('0,00');
        });

        it('should update totals when modifying line items', () => {
            const { quantityInput, priceInput } = createTestLineItem(window, '2', '100');
            
            window.dispatchTestEvent(quantityInput, 'change');
            window.dispatchTestEvent(priceInput, 'change');
            window.refreshTotals();

            const subtotal = window.document.getElementById('subtotal').textContent;
            expect(subtotal).to.equal('200,00');
            
            const vat = window.formatter.parseCurrency(window.document.getElementById('vat').textContent);
            expect(vat).to.equal(38);
            
            const total = window.formatter.parseCurrency(window.document.getElementById('total').textContent);
            expect(total).to.equal(238);
        });
    });

    describe('XML Generation Tests', () => {
        it('should generate correct XML structure', async () => {
            const sampleXML = await loadFixture('factura_1_emag_taxa_transport.xml');
            const expectedXML = await loadFixture('factura_1_emag_taxa_transport_expected.xml');
            
            const file = new window.Blob([sampleXML], { type: 'application/xml' });
            await window.handleFileSelect({ target: { files: [file] } });
            
            const { quantityInput } = createTestLineItem(window, '2', '100');
            window.dispatchTestEvent(quantityInput, 'change');
            window.refreshTotals();
            
            const generatedXML = await window.saveXML();
            expect(normalizeXML(generatedXML)).to.equal(normalizeXML(expectedXML));
        });
    });
});

function normalizeXML(xml) {
    return xml.replace(/>\s+</g, '><')
              .replace(/\s+/g, ' ')
              .replace(/"\s+/g, '"')
              .trim();
}