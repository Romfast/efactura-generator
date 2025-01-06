// test/invoice.test.js
import { expect } from 'chai';
import { loadTestFile, loadFixture } from './test-utils.js';
import { setupDOM } from './test-config.js';

describe('eInvoice Application Tests', () => {
    let dom;
    let document;
    let window;
    
    beforeEach(async () => {
        const html = await loadTestFile('index.html');
        dom = setupDOM(html);
        document = dom.window.document;
        window = dom.window;
        
        // Mock event dispatch
        window.dispatchTestEvent = (element, eventType) => {
            const event = new dom.window.Event(eventType, { bubbles: true });
            element.dispatchEvent(event);
        };
    });

    describe('XML Loading Tests', () => {
        it('should correctly load an invoice XML file', async () => {
            const sampleXML = await loadFixture('factura_1_emag_taxa_transport.xml');
            
            // Create file and trigger load
            const file = new Blob([sampleXML], { type: 'application/xml' });
            Object.defineProperty(file, 'name', { value: 'invoice.xml' });
            
            // Call the file handler
            await window.handleFileSelect({ target: { files: [file] } });

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Verify loaded data
            expect(document.querySelector('[name="invoiceNumber"]').value).to.equal('1');
            expect(document.querySelector('[name="issueDate"]').value).to.equal('01.01.2025');
            expect(document.querySelector('[name="supplierName"]').value).to.equal('DANTE INTERNATIONAL SA');
            expect(document.querySelector('[name="supplierVAT"]').value).to.equal('RO14399840');
            
            // Check line items
            const lineItem = document.querySelector('.line-item');
            expect(lineItem).to.exist;
            expect(document.querySelector('[name="quantity0"]').value).to.equal('1.0');
            expect(document.querySelector('[name="price0"]').value).to.equal('1260.5');
            
            // Check totals
            expect(document.getElementById('subtotal').textContent).to.equal('1.260,50');
            expect(document.getElementById('total').textContent).to.equal('1.518,99');
        });
    });

    describe('Line Item Tests', () => {
        it('should add a new line item correctly', () => {
            const initialCount = document.querySelectorAll('.line-item').length;
            window.addLineItem();
            const newCount = document.querySelectorAll('.line-item').length;
            expect(newCount).to.equal(initialCount + 1);

            // Verify the new line item structure
            const newItem = document.querySelector('.line-item:last-child');
            expect(newItem.querySelector('[name^="quantity"]')).to.exist;
            expect(newItem.querySelector('[name^="price"]')).to.exist;
            expect(newItem.querySelector('[name^="vatType"]')).to.exist;
        });

        it('should delete a line item correctly', () => {
            // Add item first
            window.addLineItem();
            const initialCount = document.querySelectorAll('.line-item').length;
            
            // Remove item
            window.removeLineItem(0);
            const newCount = document.querySelectorAll('.line-item').length;
            expect(newCount).to.equal(initialCount - 1);
        });

        it('should update totals when modifying line items', async () => {
            // Add line item
            window.addLineItem();
            
            // Set values
            const quantityInput = document.querySelector('[name="quantity0"]');
            const priceInput = document.querySelector('[name="price0"]');
            
            quantityInput.value = '2';
            priceInput.value = '100';
            
            // Trigger updates
            window.dispatchTestEvent(quantityInput, 'change');
            window.dispatchTestEvent(priceInput, 'change');
            window.refreshTotals();

            // Check totals
            const subtotal = document.getElementById('subtotal').textContent;
            expect(subtotal).to.equal('200,00');
        });
    });

    describe('XML Generation Tests', () => {
        it('should generate correct XML structure', async () => {
            // Load and compare XMLs
            const sampleXML = await loadFixture('factura_1_emag_taxa_transport.xml');
            const expectedXML = await loadFixture('factura_1_emag_taxa_transport_expected.xml');
            
            // Load initial invoice
            const file = new File([sampleXML], 'invoice.xml', { type: 'application/xml' });
            await window.handleFileSelect({ target: { files: [file] } });
            
            // Modify values
            const quantityInput = document.querySelector('[name="quantity0"]');
            const chargeInput = document.querySelector('[name="chargeAmount0"]');
            
            quantityInput.value = '2';
            chargeInput.value = '20.00';
            
            // Trigger updates
            window.dispatchTestEvent(quantityInput, 'change');
            window.dispatchTestEvent(chargeInput, 'change');
            window.refreshTotals();
            
            // Generate and compare
            const generatedXML = await window.saveXML();
            expect(normalizeXML(generatedXML)).to.equal(normalizeXML(expectedXML));
        });
    });
});

// Helper function to normalize XML for comparison
function normalizeXML(xml) {
    return xml.replace(/>\s+</g, '><')
              .replace(/\s+/g, ' ')
              .replace(/"\s+/g, '"')
              .trim();
}