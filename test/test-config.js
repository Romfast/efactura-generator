// test-config.js
import { JSDOM, VirtualConsole } from 'jsdom';
import { InvoiceFormatter } from '../js/formatter.js';
import * as constants from '../js/constants.js';
import * as invoiceFunctions from '../js/invoice-functions.js';

export function setupDOM(html) {
    const virtualConsole = new VirtualConsole();
    virtualConsole.sendTo(console, { omitJSDOMErrors: true });

    const baseHTML = html || `
        <!DOCTYPE html>
        <html><body>
            <div id="lineItems"></div>
            <div id="subtotal">0,00</div>
            <div id="vat">0,00</div>
            <div id="total">0,00</div>
            <div id="vatBreakdown"></div>
            <div id="allowanceCharges"></div>
            <input type="text" name="invoiceNumber" />
            <input type="text" name="issueDate" />
            <input type="text" name="dueDate" />
            <input type="text" name="documentCurrencyCode" value="RON" />
            <input type="text" name="taxCurrencyCode" />
            <input type="text" name="supplierName" />
            <input type="text" name="supplierVAT" />
            <input type="text" name="customerName" />
            <input type="text" name="customerVAT" />
        </body></html>
    `;

    const dom = new JSDOM(baseHTML, {
        url: "http://localhost",
        runScripts: "dangerously",
        resources: "usable",
        pretendToBeVisual: true,
        virtualConsole
    });

    const { window } = dom;

    // Add constants and utilities to window
    Object.assign(window, constants);
    window.formatter = new InvoiceFormatter();
    window.XMLParser = window.DOMParser;

    // Create unit code options HTML (needed for line items)
    window.createUnitCodeOptionsHTML = (selectedCode = 'EA') => {
        return Array.from(constants.UNIT_CODES.entries())
            .map(([code, description]) => 
                `<option value="${code}" ${code === selectedCode ? 'selected' : ''}>${description}</option>`
            )
            .join('');
    };

    // Add XML parsing function
    window.parseXML = (xmlContent) => {
        const parser = new window.DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('XML parsing error: ' + parserError.textContent);
        }
        return xmlDoc;
    };

    // Setup FileReader mock
    window.FileReader = class FileReader {
        constructor() {
            this.result = null;
            this.onload = null;
        }

        readAsText(blob) {
            setTimeout(() => {
                const xmlDoc = window.parseXML(blob.toString());
                this.onload?.({ target: { result: blob.toString() } });
            }, 0);
        }
    };

    // Setup Blob mock
    window.Blob = class Blob {
        constructor(content) {
            this.content = content;
        }
        toString() {
            return this.content[0];
        }
    };

    // Add Event mock
    window.Event = class Event {
        constructor(type, options = {}) {
            this.type = type;
            this.bubbles = options.bubbles || false;
            this.cancelable = options.cancelable || false;
        }
    };

    // Add test helper
    window.dispatchTestEvent = function(element, eventType) {
        const event = new window.Event(eventType, { 
            bubbles: true, 
            cancelable: true 
        });
        element.dispatchEvent(event);
    };

    // Add invoice functions to window
    window.addLineItem = invoiceFunctions.addLineItem;
    window.removeLineItem = invoiceFunctions.removeLineItem;
    window.refreshTotals = invoiceFunctions.refreshTotals;
    window.handleFileSelect = invoiceFunctions.handleFileSelect;
    window.handleStorno = invoiceFunctions.handleStorno;
    window.formatter = window.formatter;
    window.addAllowanceCharge = invoiceFunctions.addAllowanceCharge;
    window.createAllowanceChargeHTML = invoiceFunctions.createAllowanceChargeHTML;
    window.createReasonCodeOptions = invoiceFunctions.createReasonCodeOptions;
    window.validateForm = invoiceFunctions.validateForm;
    window.saveXML = invoiceFunctions.saveXML;
    window.updateTotals = invoiceFunctions.updateTotals;
    window.handleVatTypeChange = invoiceFunctions.handleVatTypeChange;

    // Set invoice functions context
    invoiceFunctions.setContext(window);

    return dom;
}

// Helper functions for tests
export function createTestLineItem(window, quantity, price, vatType = 'S', vatRate = 19) {
    window.addLineItem();
    const index = window.document.querySelectorAll('.line-item').length - 1;
    
    const quantityInput = window.document.querySelector(`[name="quantity${index}"]`);
    const priceInput = window.document.querySelector(`[name="price${index}"]`);
    const vatTypeSelect = window.document.querySelector(`[name="vatType${index}"]`);
    const vatRateInput = window.document.querySelector(`[name="vatRate${index}"]`);
    
    quantityInput.value = quantity;
    priceInput.value = price;
    vatTypeSelect.value = vatType;
    vatRateInput.value = vatRate;
    
    window.dispatchTestEvent(quantityInput, 'change');
    window.dispatchTestEvent(priceInput, 'change');
    window.dispatchTestEvent(vatTypeSelect, 'change');
    window.refreshTotals();
    
    return {
        quantityInput,
        priceInput,
        vatTypeSelect,
        vatRateInput
    };
}

export function createTestAllowanceCharge(window, amount, isCharge = true, vatType = 'S', vatRate = 19) {
    window.addAllowanceCharge();
    const index = window.document.querySelectorAll('.allowance-charge').length - 1;
    
    const typeSelect = window.document.querySelector(`[name="chargeType${index}"]`);
    const amountInput = window.document.querySelector(`[name="chargeAmount${index}"]`);
    const vatTypeSelect = window.document.querySelector(`[name="chargeVatType${index}"]`);
    const vatRateInput = window.document.querySelector(`[name="chargeVatRate${index}"]`);
    
    typeSelect.value = isCharge.toString();
    amountInput.value = amount;
    vatTypeSelect.value = vatType;
    vatRateInput.value = vatRate;
    
    window.dispatchTestEvent(amountInput, 'change');
    window.dispatchTestEvent(vatTypeSelect, 'change');
    window.refreshTotals();
    
    return {
        typeSelect,
        amountInput,
        vatTypeSelect,
        vatRateInput
    };
}