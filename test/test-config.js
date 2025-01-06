// test/test-config.js
import { JSDOM, VirtualConsole } from 'jsdom';

export function setupDOM(html) {
    // Create a virtual console
    const virtualConsole = new VirtualConsole();
    virtualConsole.sendTo(console, { omitJSDOMErrors: true });

    // Create basic HTML structure if not provided
    const baseHTML = html || `
        <!DOCTYPE html>
        <html>
            <body>
                <div id="lineItems"></div>
                <div id="subtotal">0,00</div>
                <div id="vat">0,00</div>
                <div id="total">0,00</div>
                <div id="vatBreakdown"></div>
                <input type="text" name="invoiceNumber" />
                <input type="text" name="issueDate" />
                <input type="text" name="documentCurrencyCode" value="RON" />
                <input type="text" name="taxCurrencyCode" />
                <input type="text" name="exchangeRate" />
                <input type="text" name="supplierName" />
                <input type="text" name="supplierVAT" />
            </body>
        </html>
    `;

    const dom = new JSDOM(baseHTML, {
        url: "http://localhost",
        runScripts: "dangerously",
        resources: "usable",
        pretendToBeVisual: true,
        virtualConsole
    });

    // Add Event constructor to window
    dom.window.Event = class Event {
        constructor(type, options = {}) {
            this.type = type;
            this.bubbles = options.bubbles || false;
            this.cancelable = options.cancelable || false;
        }
    };

    // Mock FileReader
    dom.window.FileReader = class FileReader {
        constructor() {
            this.result = '';
            this.onload = null;
        }

        readAsText(blob) {
            this.result = blob;
            if (this.onload) {
                setTimeout(() => {
                    this.onload({ target: { result: this.result } });
                }, 0);
            }
        }
    };

    // Mock InvoiceFormatter
    dom.window.InvoiceFormatter = class InvoiceFormatter {
        constructor() {
            this.locale = 'ro-RO';
        }

        formatCurrency(value) {
            const num = parseFloat(value);
            return num.toLocaleString('ro-RO', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                useGrouping: true
            });
        }

        formatQuantity(value) {
            const num = parseFloat(value);
            return num.toLocaleString('ro-RO', {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3,
                useGrouping: true
            });
        }

        parseCurrency(value) {
            if (typeof value !== 'string') {
                value = value.toString();
            }
            // Remove all non-digit characters except decimal and minus
            const normalized = value.replace(/[^\d\-.,]/g, '')
                .replace(/[.,](?=.*[.,])/g, '')
                .replace(/[.,]/, '.');
            return parseFloat(normalized) || 0;
        }
    };

    // Mock window functions
    dom.window.addLineItem = function() {
        const lineItemsContainer = dom.window.document.getElementById('lineItems');
        const index = dom.window.document.querySelectorAll('.line-item').length;
        const lineItem = dom.window.document.createElement('div');
        lineItem.className = 'line-item';
        lineItem.dataset.index = index;
        lineItem.innerHTML = `
            <input type="text" name="description${index}" />
            <input type="number" name="quantity${index}" value="0" />
            <input type="number" name="price${index}" value="0" />
            <select name="vatType${index}">
                <option value="S">Standard</option>
                <option value="AE">Taxare Inversă</option>
                <option value="E">Scutit</option>
            </select>
            <input type="number" name="vatRate${index}" value="19" />
        `;
        lineItemsContainer.appendChild(lineItem);
    };

    dom.window.removeLineItem = function(index) {
        const lineItem = dom.window.document.querySelector(`.line-item[data-index="${index}"]`);
        if (lineItem) lineItem.remove();
    };

    dom.window.addAllowanceCharge = function() {
        const container = dom.window.document.getElementById('allowanceCharges');
        if (!container) {
            const newContainer = dom.window.document.createElement('div');
            newContainer.id = 'allowanceCharges';
            dom.window.document.body.appendChild(newContainer);
        }
    };

    dom.window.validateForm = function() {
        return true; // Mock validation
    };

    dom.window.refreshTotals = function() {
        const elements = ['subtotal', 'vat', 'total'];
        elements.forEach(id => {
            const el = dom.window.document.getElementById(id);
            if (el) el.textContent = '0,00';
        });
    };

    dom.window.handleFileSelect = async function(event) {
        const reader = new dom.window.FileReader();
        reader.onload = function(e) {
            // Mock file loading
        };
        if (event.target.files && event.target.files[0]) {
            reader.readAsText(event.target.files[0]);
        }
    };

    // Add missing browser globals
    dom.window.HTMLElement.prototype.scrollIntoView = function() {};

    // Create document range
    dom.window.document.createRange = () => ({
        setStart: () => {},
        setEnd: () => {},
        commonAncestorContainer: {
            nodeName: 'BODY',
            ownerDocument: dom.window.document,
        }
    });

    // Add event creation helper
    dom.window.createEvent = function(type) {
        return new dom.window.Event(type, { bubbles: true });
    };

    return dom;
}