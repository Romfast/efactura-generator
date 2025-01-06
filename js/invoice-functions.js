// js/invoice-functions.js
let context = typeof window !== 'undefined' ? window : null;
let manuallyEditedVatRows = new Set();

export function setContext(newContext) {
    context = newContext;
}

// Utility functions
function createLineItemHTML(index, description, quantity, price, vatRate, unitCode = 'EA', vatTypeId = 'S', 
    commodityCode = '', commodityListId = 'CV', itemDescription = '', 
    sellersItemIdentification = '', standardItemId = '', standardItemSchemeId = '0160') {
    return `
        <div class="line-item" data-index="${index}">
            <div class="grid">
                <div class="form-group">
                    <label class="form-label">Denumire</label>
                    <input type="text" class="form-input" name="description${index}" value="${description}">
                </div>
                <div class="form-group">
                    <label class="form-label">Cantitate</label>
                    <input type="number" step="0.001" class="form-input" name="quantity${index}" 
                        value="${quantity}" onchange="updateTotals()">
                </div>
                <div class="form-group">
                    <label class="form-label">UM</label>
                    <select class="form-input" name="unit${index}">
                        ${createUnitCodeOptionsHTML(unitCode)}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Preț</label>
                    <input type="number" step="0.01" class="form-input" name="price${index}" 
                        value="${price}" onchange="updateTotals()">
                </div>
                <div class="form-group">
                    <label class="form-label">Tip TVA</label>
                    <select class="form-input" name="vatType${index}" onchange="handleVatTypeChange(${index})">
                        ${Object.entries(VAT_TYPES).map(([key, value]) => 
                            `<option value="${key}" ${key === vatTypeId ? 'selected' : ''}>${value}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Cotă TVA (%)</label>
                    <input type="number" step="1" class="form-input" name="vatRate${index}" 
                        value="${vatRate}" onchange="updateTotals()">
                </div>
            </div>
            <button type="button" class="button button-danger remove-line-item" onclick="removeLineItem(${index})">
                ✕
            </button>
        </div>
    `;
}

function handleVatTypeChange(index) {
    const vatTypeSelect = context.document.querySelector(`[name="vatType${index}"]`);
    const vatRateInput = context.document.querySelector(`[name="vatRate${index}"]`);
    
    switch(vatTypeSelect.value) {
        case 'AE':
        case 'Z':
        case 'O':
        case 'E':
            vatRateInput.value = '0';
            vatRateInput.disabled = true;
            break;
        case 'S':
            vatRateInput.value = '19';
            vatRateInput.disabled = false;
            break;
    }
    
    refreshTotals();
}

function handleLineItemChange(index) {
    const quantityInput = context.document.querySelector(`[name="quantity${index}"]`);
    const priceInput = context.document.querySelector(`[name="price${index}"]`);
    
    quantityInput.addEventListener('change', refreshTotals);
    priceInput.addEventListener('change', refreshTotals);
    refreshTotals();
}

function calculateTotals() {
    const lineItemTotals = calculateLineItemTotals();
    const chargeTotals = calculateChargeTotals();

    const subtotal = lineItemTotals.subtotal;
    const allowances = chargeTotals.allowances;
    const charges = chargeTotals.charges;
    const netAmount = subtotal - allowances + charges;

    return {
        subtotal: roundNumber(subtotal),
        allowances: roundNumber(allowances),
        charges: roundNumber(charges),
        netAmount: roundNumber(netAmount),
        totalVat: roundNumber(calculateTotalVAT()),
        total: roundNumber(netAmount + calculateTotalVAT())
    };
}

function calculateLineItemTotals() {
    let subtotal = 0;
    context.document.querySelectorAll('.line-item').forEach((item, index) => {
        const quantity = parseFloat(context.document.querySelector(`[name="quantity${index}"]`).value) || 0;
        const price = parseFloat(context.document.querySelector(`[name="price${index}"]`).value) || 0;
        subtotal += quantity * price;
    });
    return { subtotal: roundNumber(subtotal) };
}

function calculateChargeTotals() {
    let allowances = 0;
    let charges = 0;

    context.document.querySelectorAll('.allowance-charge').forEach((item, index) => {
        const isCharge = context.document.querySelector(`[name="chargeType${index}"]`).value === 'true';
        const amount = parseFloat(context.document.querySelector(`[name="chargeAmount${index}"]`).value) || 0;
        if (isCharge) {
            charges += amount;
        } else {
            allowances += amount;
        }
    });

    return {
        allowances: roundNumber(allowances),
        charges: roundNumber(charges)
    };
}

function calculateTotalVAT() {
    let totalVat = Array.from(context.document.querySelectorAll('.vat-amount'))
        .reduce((sum, input) => sum + context.formatter.parseCurrency(input.value), 0);
    return roundNumber(totalVat, 2);
}

// Exported functions
export function addLineItem() {
    const container = context.document.getElementById('lineItems');
    const index = context.document.querySelectorAll('.line-item').length;
    const lineItemHtml = createLineItemHTML(index, '', '1', '0', '19', 'EA', 'S');
    container.insertAdjacentHTML('beforeend', lineItemHtml);
    
    const quantityInput = context.document.querySelector(`[name="quantity${index}"]`);
    const priceInput = context.document.querySelector(`[name="price${index}"]`);
    const vatTypeSelect = context.document.querySelector(`[name="vatType${index}"]`);

    quantityInput.addEventListener('change', refreshTotals);
    priceInput.addEventListener('change', refreshTotals);
    vatTypeSelect.addEventListener('change', () => handleVatTypeChange(index));

    manuallyEditedVatRows.clear();
    handleLineItemChange(index);
}

export function removeLineItem(index) {
    const lineItem = context.document.querySelector(`.line-item[data-index="${index}"]`);
    if (lineItem) {
        lineItem.remove();
        renumberLineItems();
        manuallyEditedVatRows.clear();
        refreshTotals();
    }
}

export function refreshTotals() {
    const totals = calculateTotals();
    displayTotals(totals);
    displayVATBreakdown();
    
    let totalVat = 0;
    context.document.querySelectorAll('.vat-row').forEach(row => {
        const vatAmount = context.formatter.parseCurrency(row.querySelector('.vat-amount').value) || 0;
        totalVat += vatAmount;
    });
    
    context.document.getElementById('vat').textContent = context.formatter.formatCurrency(totalVat);
    context.document.getElementById('total').textContent = context.formatter.formatCurrency(totals.netAmount + totalVat);
}

export function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new context.FileReader();
        reader.onload = function(e) {
            const xmlContent = e.target.result;
            parseXML(xmlContent);
        };
        reader.readAsText(file);
    }
}

export function handleStorno() {
    context.document.querySelectorAll('.line-item').forEach((item, index) => {
        const quantityInput = context.document.querySelector(`[name="quantity${index}"]`);
        const currentValue = parseFloat(quantityInput.value);
        quantityInput.value = -currentValue;
    });

    context.document.querySelectorAll('.allowance-charge').forEach((item, index) => {
        const amountInput = context.document.querySelector(`[name="chargeAmount${index}"]`);
        const currentAmount = parseFloat(amountInput.value);
        amountInput.value = -currentAmount;
    });

    manuallyEditedVatRows.clear();
    refreshTotals();
}


// Export other necessary functions and utilities
export {
    calculateTotals,
    calculateLineItemTotals,
    calculateChargeTotals,
    calculateTotalVAT,
    handleVatTypeChange,
    manuallyEditedVatRows
};