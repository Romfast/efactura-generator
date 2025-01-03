// Constants
const XML_NAMESPACES = {
    ubl: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
};

const VAT_TYPES = {
    "S": "STANDARD Rate",
    "AE": "TAXARE INVERSA",
    "O": "NEPLATITOR TVA",
    "Z": "COTA 0% TVA",
    "E": "NEIMPOZABIL"
};

const UNIT_CODES = new Map([
    ['EA', 'Bucată (EA)'],
    ['XPP', 'Bucată (XPP)'],
    ['KGM', 'Kg (KGM)'],
    ['MTR', 'Metri (MTR)'],
    ['LTR', 'Litru (LTR)'],
    ['H87', 'Bucată (H87)'],
    ['MTQ', 'Metri cubi (MTQ)']
]);


// Global variables
let currentInvoice = null;
let originalTotals = null;
let vatRates = new Map(); // Store VAT rates for different line items
// Keep track of manually edited VAT rows
let manuallyEditedVatRows = new Set();

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    initializeUI();
    
    // Make totals editable with inline editing
    const totalElements = [
        'subtotal', 'totalAllowances', 'totalCharges', 
        'netAmount', 'vat', 'total'
    ];
    
    totalElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        setupInlineEditing(element);
    });
});


// Inline editing setup function
function setupInlineEditing(element) {
    element.addEventListener('click', function() {
        this.setAttribute('contenteditable', 'true');
        this.focus();
    });

    element.addEventListener('blur', function() {
        this.setAttribute('contenteditable', 'false');
        const value = parseFloat(this.textContent.replace(/[^0-9.-]/g, ''));
        this.textContent = isNaN(value) ? '0.00' : value.toFixed(2);
    });

    element.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.blur();
        }
    });

}

// Event delegation for dynamic elements
document.addEventListener('click', function(event) {
    const target = event.target;
    
    if (target.matches('.delete-line-item')) {
        const lineItem = target.closest('.line-item');
        if (lineItem) {
            removeLineItem(parseInt(lineItem.dataset.index));
        }
    }
    
    if (target.matches('.delete-allowance-charge')) {
        const charge = target.closest('.allowance-charge');
        if (charge) {
            removeAllowanceCharge(parseInt(charge.dataset.index));
        }
    }
});

// File handling functions
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const xmlContent = e.target.result;
            parseXML(xmlContent);
        };
        reader.readAsText(file);
    }
}

function parseXML(xmlContent) {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlContent, "text/xml");
        
        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('XML parsing failed: ' + parserError.textContent);
        }

        // Store the current invoice
        currentInvoice = xmlDoc;

        // Reset manually edited VAT rows
        manuallyEditedVatRows.clear();

        // Parse and populate all sections
        populateBasicDetails(xmlDoc);
        populatePartyDetails(xmlDoc);
        populateAllowanceCharges(xmlDoc);
        populateLineItems(xmlDoc);
        
        // Store original totals from XML
        storeOriginalTotals(xmlDoc);
        
        // Restore totals including VAT breakdown
        restoreOriginalTotals();
        
    } catch (error) {
        handleError(error, 'Error parsing XML file');
    }
}

function storeOriginalTotals(xmlDoc) {
    const taxTotal = xmlDoc.querySelector('cac\\:TaxTotal, TaxTotal');
    const monetaryTotal = xmlDoc.querySelector('cac\\:LegalMonetaryTotal, LegalMonetaryTotal');
    
    originalTotals = {
        subtotal: getXMLValue(monetaryTotal, 'cbc\\:LineExtensionAmount, LineExtensionAmount', '0'),
        allowances: getXMLValue(monetaryTotal, 'cbc\\:AllowanceTotalAmount, AllowanceTotalAmount', '0'),
        charges: getXMLValue(monetaryTotal, 'cbc\\:ChargeTotalAmount, ChargeTotalAmount', '0'),
        netAmount: getXMLValue(monetaryTotal, 'cbc\\:TaxExclusiveAmount, TaxExclusiveAmount', '0'),
        totalVat: getXMLValue(taxTotal, 'cbc\\:TaxAmount, TaxAmount', '0'),
        total: getXMLValue(monetaryTotal, 'cbc\\:TaxInclusiveAmount, TaxInclusiveAmount', '0')
    };

    // Also store VAT breakdown from TaxSubtotals
    const vatBreakdown = [];
    const taxSubtotals = xmlDoc.querySelectorAll('cac\\:TaxSubtotal, TaxSubtotal');
    taxSubtotals.forEach(subtotal => {
        vatBreakdown.push({
            taxableAmount: getXMLValue(subtotal, 'cbc\\:TaxableAmount, TaxableAmount', '0'),
            taxAmount: getXMLValue(subtotal, 'cbc\\:TaxAmount, TaxAmount', '0'),
            percent: getXMLValue(subtotal, 'cac\\:TaxCategory cbc\\:Percent, Percent', '0')
        });
    });
    originalTotals.vatBreakdown = vatBreakdown;
}

function restoreOriginalTotals() {
    if (!originalTotals) return;
    
    document.getElementById('subtotal').textContent = parseFloat(originalTotals.subtotal).toFixed(2);
    document.getElementById('totalAllowances').textContent = parseFloat(originalTotals.allowances || 0).toFixed(2);
    document.getElementById('totalCharges').textContent = parseFloat(originalTotals.charges || 0).toFixed(2);
    document.getElementById('netAmount').textContent = parseFloat(originalTotals.netAmount).toFixed(2);
    document.getElementById('vat').textContent = parseFloat(originalTotals.totalVat).toFixed(2);
    document.getElementById('total').textContent = parseFloat(originalTotals.total).toFixed(2);

    // Clear existing VAT breakdown
    const container = document.getElementById('vatBreakdownRows');
    if (container) {
        container.innerHTML = '';
        
        // Populate VAT breakdown from stored values
        if (originalTotals.vatBreakdown && originalTotals.vatBreakdown.length > 0) {
            originalTotals.vatBreakdown.forEach(vat => {
                const rate = parseFloat(vat.percent);
                const base = parseFloat(vat.taxableAmount);
                const amount = parseFloat(vat.taxAmount);
                addVATBreakdownRow(rate, base, amount);
            });
        } else {
            // If no VAT breakdown found, calculate from line items
            const { vatBreakdown } = calculateVATBreakdown();
            vatBreakdown.forEach((data, vatRate) => {
                addVATBreakdownRow(vatRate, data.baseAmount, data.vatAmount);
            });
        }
    }
}

function populateBasicDetails(xmlDoc) {
    document.querySelector('[name="invoiceNumber"]').value = getXMLValue(xmlDoc, 'cbc\\:ID, ID');
    document.querySelector('[name="issueDate"]').value = getXMLValue(xmlDoc, 'cbc\\:IssueDate, IssueDate');
    document.querySelector('[name="dueDate"]').value = getXMLValue(xmlDoc, 'cbc\\:DueDate, DueDate');
}

function populatePartyDetails(xmlDoc) {
    // Populate supplier details
    const supplierParty = xmlDoc.querySelector('cac\\:AccountingSupplierParty, AccountingSupplierParty');
    if (supplierParty) {
        // Name from PartyLegalEntity
        document.querySelector('[name="supplierName"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PartyLegalEntity cbc\\:RegistrationName, PartyLegalEntity RegistrationName');
        
        // VAT Number from PartyTaxScheme
        document.querySelector('[name="supplierVAT"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PartyTaxScheme cbc\\:CompanyID, PartyTaxScheme CompanyID');
        
        // Company Registration ID (should get J40/14205/1994)
        document.querySelector('[name="supplierCompanyId"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PartyLegalEntity cbc\\:CompanyID, PartyLegalEntity CompanyID');

        // Address details
        document.querySelector('[name="supplierAddress"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PostalAddress cbc\\:StreetName, PostalAddress StreetName');
        document.querySelector('[name="supplierCity"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PostalAddress cbc\\:CityName, PostalAddress CityName');
        document.querySelector('[name="supplierCountrySubentity"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PostalAddress cbc\\:CountrySubentity, PostalAddress CountrySubentity');
        document.querySelector('[name="supplierCountry"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PostalAddress cac\\:Country cbc\\:IdentificationCode, Country IdentificationCode');
            
        // Phone number
        document.querySelector('[name="supplierPhone"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:Contact cbc\\:Telephone, Contact Telephone');
    }

    // Populate customer details
    const customerParty = xmlDoc.querySelector('cac\\:AccountingCustomerParty, AccountingCustomerParty');
    if (customerParty) {
        // Name from PartyLegalEntity
        document.querySelector('[name="customerName"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PartyLegalEntity cbc\\:RegistrationName, PartyLegalEntity RegistrationName');
        
        // VAT Number from PartyTaxScheme
        document.querySelector('[name="customerVAT"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PartyTaxScheme cbc\\:CompanyID, PartyTaxScheme CompanyID');
        
        // Company Registration ID
        document.querySelector('[name="customerCompanyId"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PartyLegalEntity cbc\\:CompanyID, PartyLegalEntity CompanyID');

        // Address details
        document.querySelector('[name="customerAddress"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PostalAddress cbc\\:StreetName, PostalAddress StreetName');
        document.querySelector('[name="customerCity"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PostalAddress cbc\\:CityName, PostalAddress CityName');
        document.querySelector('[name="customerCountrySubentity"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PostalAddress cbc\\:CountrySubentity, PostalAddress CountrySubentity');
        document.querySelector('[name="customerCountry"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PostalAddress cac\\:Country cbc\\:IdentificationCode, Country IdentificationCode');
            
        // Phone number
        document.querySelector('[name="customerPhone"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:Contact cbc\\:Telephone, Contact Telephone');
    }
}


function populateAllowanceCharges(xmlDoc) {
    const charges = parseAllowanceCharges(xmlDoc);
    displayAllowanceCharges(charges);
    
    // Add event listeners to all charges
    charges.forEach((_, index) => {
        addChargeVatTypeChangeListener(index);
    });
}

function populateLineItems(xmlDoc) {
    const lineItems = xmlDoc.querySelectorAll('cac\\:InvoiceLine, InvoiceLine');
    const lineItemsContainer = document.getElementById('lineItems');
    lineItemsContainer.innerHTML = '<h2 class="section-title">Line Items <button type="button" class="button button-small" onclick="addLineItem()">Add Line Item</button></h2>';

    lineItems.forEach((item, index) => {
        const quantity = getXMLValue(item, 'cbc\\:InvoicedQuantity, InvoicedQuantity', '0');
        const unitCode = item.querySelector('cbc\\:InvoicedQuantity, InvoicedQuantity')?.getAttribute('unitCode') || 'EA';
        const price = getXMLValue(item, 'cac\\:Price cbc\\:PriceAmount, PriceAmount', '0');
        const description = getXMLValue(item, 'cac\\:Item cbc\\:Name, Name', '');
        const itemDescription = getXMLValue(item, 'cac\\:Item cbc\\:Description, Description', '');
        const vatRate = getXMLValue(item, 'cac\\:Item cac\\:ClassifiedTaxCategory cbc\\:Percent, Percent', '19');
        const vatTypeId = getXMLValue(item, 'cac\\:Item cac\\:ClassifiedTaxCategory cbc\\:ID, ID', 'S');
        
        // Get seller's item identification
        const sellersItemIdentification = getXMLValue(item.querySelector('cac\\:Item, Item'), 'cac\\:SellersItemIdentification cbc\\:ID, SellersItemIdentification ID', '');
        
        // Get standard item identification
        const standardItemElement = item.querySelector('cac\\:Item cac\\:StandardItemIdentification cbc\\:ID, StandardItemIdentification ID');
        const standardItemId = standardItemElement ? standardItemElement.textContent : '';
        const standardItemSchemeId = standardItemElement ? standardItemElement.getAttribute('schemeID') || '0160' : '0160';
        
        // Get commodity classification
        const commodityCodeElement = item.querySelector('cac\\:Item cac\\:CommodityClassification cbc\\:ItemClassificationCode, ItemClassificationCode');
        const commodityCode = commodityCodeElement ? commodityCodeElement.textContent : '';
        const commodityListId = commodityCodeElement ? commodityCodeElement.getAttribute('listID') || 'CV' : 'CV';

        addUnitCode(unitCode);
        const lineItemHtml = createLineItemHTML(
            index, description, quantity, price, vatRate, unitCode, vatTypeId,
            commodityCode, commodityListId, itemDescription, 
            sellersItemIdentification, standardItemId, standardItemSchemeId
        );
        lineItemsContainer.insertAdjacentHTML('beforeend', lineItemHtml);
    });
}


function parseAllowanceCharges(xmlDoc) {
    const charges = [];
    const allowanceCharges = xmlDoc.querySelectorAll('cac\\:AllowanceCharge, AllowanceCharge');
    
    allowanceCharges.forEach(ac => {
        const charge = {
            isCharge: getXMLValue(ac, 'cbc\\:ChargeIndicator, ChargeIndicator') === 'true',
            reasonCode: getXMLValue(ac, 'cbc\\:AllowanceChargeReasonCode, AllowanceChargeReasonCode'),
            reason: getXMLValue(ac, 'cbc\\:AllowanceChargeReason, AllowanceChargeReason'),
            amount: parseFloat(getXMLValue(ac, 'cbc\\:Amount, Amount')) || 0,
            vatRate: parseFloat(getXMLValue(ac, 'cac\\:TaxCategory cbc\\:Percent, Percent')) || 19.0,
            vatTypeId: getXMLValue(ac, 'cac\\:TaxCategory cbc\\:ID, ID', 'S')
        };
        charges.push(charge);
    });

    return charges;
}

function displayAllowanceCharges(charges) {
    const container = document.getElementById('allowanceCharges');
    container.innerHTML = '<h2 class="section-title">Allowances and Charges <button type="button" class="button button-small" onclick="addAllowanceCharge()">Add Allowance/Charge</button></h2>';

    charges.forEach((charge, index) => {
        const html = createAllowanceChargeHTML(index, charge);
        container.insertAdjacentHTML('beforeend', html);
    });
}

function createAllowanceChargeHTML(index, charge) {
    return `
        <div class="allowance-charge" data-index="${index}">
            <div class="grid">
                <div class="form-group">
                    <label class="form-label">Type</label>
                    <select class="form-input" name="chargeType${index}" onchange="updateTotals()">
                        <option value="true" ${charge.isCharge ? 'selected' : ''}>Charge</option>
                        <option value="false" ${!charge.isCharge ? 'selected' : ''}>Allowance</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Reason Code</label>
                    <input type="text" class="form-input" name="chargeReasonCode${index}" 
                           value="${charge.reasonCode}" onchange="updateTotals()">
                </div>
                <div class="form-group">
                    <label class="form-label">Reason</label>
                    <input type="text" class="form-input" name="chargeReason${index}" 
                           value="${charge.reason}" onchange="updateTotals()">
                </div>
                <div class="form-group">
                    <label class="form-label">Amount</label>
                    <input type="number" step="0.01" class="form-input" name="chargeAmount${index}" 
                           value="${charge.amount}" onchange="updateTotals()">
                </div>
                <div class="form-group">
                    <label class="form-label">VAT Type</label>
                    <select class="form-input" name="chargeVatType${index}" onchange="handleChargeVatTypeChange(${index})">
                        ${Object.entries(VAT_TYPES).map(([key, value]) => 
                            `<option value="${key}" ${key === charge.vatTypeId ? 'selected' : ''}>${value}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">VAT Rate (%)</label>
                    <input type="number" step="0.1" class="form-input" name="chargeVatRate${index}" 
                           value="${charge.vatRate}" onchange="updateTotals()">
                </div>
                <button type="button" class="button button-danger" onclick="removeAllowanceCharge(${index})">
                    Remove
                </button>
            </div>
        </div>
    `;
}

function addUnitCode(code) {
    if (!UNIT_CODES.has(code)) {
        UNIT_CODES.set(code, `${code} (${code})`);
    }
}

// Modified function to create unit code options HTML
function createUnitCodeOptionsHTML(selectedCode = 'EA') {
    return Array.from(UNIT_CODES.entries())
        .map(([code, description]) => 
            `<option value="${code}" ${code === selectedCode ? 'selected' : ''}>${description}</option>`
        )
        .join('');
}

function createLineItemHTML(index, description, quantity, price, vatRate, unitCode = 'EA', vatTypeId = 'S', 
    commodityCode = '', commodityListId = 'CV', itemDescription = '', 
    sellersItemIdentification = '', standardItemId = '', standardItemSchemeId = '0160') {
    return `
        <div class="line-item" data-index="${index}">
            <!-- Essential fields in a compact grid -->
            <div class="grid">
                <div class="form-group">
                    <label class="form-label">Name</label>
                    <input type="text" class="form-input" name="description${index}" value="${description}">
                </div>
                <div class="form-group">
                    <label class="form-label">Quantity</label>
                    <input type="number" step="0.001" class="form-input" name="quantity${index}" 
                        value="${quantity}" onchange="updateTotals()">
                </div>
                <div class="form-group">
                    <label class="form-label">Unit</label>
                    <select class="form-input" name="unit${index}">
                        ${createUnitCodeOptionsHTML(unitCode)}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Price</label>
                    <input type="number" step="0.01" class="form-input" name="price${index}" 
                        value="${price}" onchange="updateTotals()">
                </div>
                <div class="form-group">
                    <label class="form-label">VAT Type</label>
                    <select class="form-input" name="vatType${index}" onchange="handleVatTypeChange(${index})">
                        ${Object.entries(VAT_TYPES).map(([key, value]) => 
                            `<option value="${key}" ${key === vatTypeId ? 'selected' : ''}>${value}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">VAT %</label>
                    <input type="number" step="1" class="form-input" name="vatRate${index}" 
                        value="${vatRate}" onchange="updateTotals()">
                </div>
            </div>

            <!-- Optional details section -->
            <div class="optional-details-toggle">
                <button type="button" class="button button-secondary" 
                    onclick="toggleOptionalDetails(${index})">
                    ▼ Details
                </button>
            </div>

            <div class="optional-details" id="optionalDetails${index}" style="display: none;">
                <div class="grid">
                    <div class="form-group">
                        <label class="form-label">Description</label>
                        <textarea class="form-input" name="itemDescription${index}" rows="2">${itemDescription}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Seller's Item ID</label>
                        <input type="text" class="form-input" name="sellersItemIdentification${index}" 
                            value="${sellersItemIdentification}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Standard Item ID</label>
                        <div class="commodity-group">
                            <input type="text" class="form-input" name="standardItemId${index}" 
                                placeholder="ID" value="${standardItemId}">
                            <input type="text" class="form-input" name="standardItemSchemeId${index}" 
                                placeholder="Scheme" value="${standardItemSchemeId}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Commodity Classification</label>
                        <div class="commodity-group">
                            <input type="text" class="form-input" name="commodityCode${index}" 
                                placeholder="Code" value="${commodityCode}">
                            <input type="text" class="form-input" name="commodityListId${index}" 
                                placeholder="List" value="${commodityListId}">
                        </div>
                    </div>
                </div>
            </div>

            <button type="button" class="button button-danger remove-line-item" onclick="removeLineItem(${index})">
                ✕
            </button>
        </div>
    `;
}

function toggleOptionalDetails(index) {
    const optionalDetails = document.getElementById(`optionalDetails${index}`);
    const button = optionalDetails.previousElementSibling.querySelector('button');
    
    if (optionalDetails.style.display === 'none') {
        optionalDetails.style.display = 'block';
        button.innerHTML = '▲ Details';
    } else {
        optionalDetails.style.display = 'none';
        button.innerHTML = '▼ Details';
    }
}

function addChargeVatTypeChangeListener(index) {
    const vatTypeSelect = document.querySelector(`[name="chargeVatType${index}"]`);
    if (vatTypeSelect) {
        vatTypeSelect.addEventListener('change', function() {
            handleChargeVatTypeChange(index);
            // Force refresh of VAT breakdown
            displayVATBreakdown();
            updateTotals();
        });
    }
}

function addAllowanceCharge() {
    const container = document.getElementById('allowanceCharges');
    const index = document.querySelectorAll('.allowance-charge').length;
    const newCharge = {
        isCharge: true,
        reasonCode: 'TV',
        reason: 'Transportation',
        amount: 0,
        vatRate: 19.0,
        vatTypeId: 'S'
    };
    const html = createAllowanceChargeHTML(index, newCharge);
    container.insertAdjacentHTML('beforeend', html);
    
    // Add event listeners
    addChargeVatTypeChangeListener(index);
    
    const chargeAmountInput = document.querySelector(`[name="chargeAmount${index}"]`);
    const chargeTypeInput = document.querySelector(`[name="chargeType${index}"]`);

    chargeAmountInput.addEventListener('change', refreshTotals);
    chargeTypeInput.addEventListener('change', refreshTotals);
}


function removeAllowanceCharge(index) {
    const charge = document.querySelector(`.allowance-charge[data-index="${index}"]`);
    if (charge) {
        charge.remove();
        renumberAllowanceCharges();
        updateTotals();
    }
}

function addLineItem() {
    const container = document.getElementById('lineItems');
    const index = document.querySelectorAll('.line-item').length;
    const lineItemHtml = createLineItemHTML(index, '', '1', '0', '19', 'EA', 'S');
    container.insertAdjacentHTML('beforeend', lineItemHtml);
    
    // Add event listeners
    const quantityInput = document.querySelector(`[name="quantity${index}"]`);
    const priceInput = document.querySelector(`[name="price${index}"]`);
    const vatTypeSelect = document.querySelector(`[name="vatType${index}"]`);

    quantityInput.addEventListener('change', refreshTotals);
    priceInput.addEventListener('change', refreshTotals);
    vatTypeSelect.addEventListener('change', () => handleVatTypeChange(index));
}


function removeLineItem(index) {
    const lineItem = document.querySelector(`.line-item[data-index="${index}"]`);
    if (lineItem) {
        lineItem.remove();
        renumberLineItems();
        updateTotals();
    }
}

function handleStorno() {
    if (!currentInvoice) {
        alert('Please load an invoice first');
        return;
    }

    // Handle line items
    document.querySelectorAll('.line-item').forEach((item, index) => {
        const quantityInput = document.querySelector(`[name="quantity${index}"]`);
        const currentValue = parseFloat(quantityInput.value);
        // Reverse the sign regardless of current value
        quantityInput.value = -currentValue;
    });

    // Handle allowance charges
    document.querySelectorAll('.allowance-charge').forEach((item, index) => {
        const amountInput = document.querySelector(`[name="chargeAmount${index}"]`);
        const currentAmount = parseFloat(amountInput.value);
        // Reverse the sign regardless of current value
        amountInput.value = -currentAmount;
    });

    // Handle VAT breakdown rows
    document.querySelectorAll('.vat-row').forEach(row => {
        const baseInput = row.querySelector('.vat-base');
        const amountInput = row.querySelector('.vat-amount');
        
        // Reverse the signs for base amount and VAT amount
        if (baseInput) {
            const currentBase = parseFloat(baseInput.value) || 0;
            baseInput.value = (-currentBase).toFixed(2);
        }
        
        if (amountInput) {
            const currentAmount = parseFloat(amountInput.value) || 0;
            amountInput.value = (-currentAmount).toFixed(2);
        }
    });

    // Clear manually edited VAT rows to allow recalculation
    manuallyEditedVatRows.clear();

    // Update totals and VAT breakdown
    refreshTotals();
    
    // Ensure XML TaxTotal is updated
    if (currentInvoice) {
        updateTaxTotals(currentInvoice);
    }
}

function updateTotals() {
    const totals = calculateTotals();
    
    document.getElementById('subtotal').textContent = totals.subtotal.toFixed(2);
    document.getElementById('totalAllowances').textContent = totals.allowances.toFixed(2);
    document.getElementById('totalCharges').textContent = totals.charges.toFixed(2);
    document.getElementById('netAmount').textContent = totals.netAmount.toFixed(2);
    document.getElementById('vat').textContent = totals.totalVat.toFixed(2);
    document.getElementById('total').textContent = totals.total.toFixed(2);

    // Trigger VAT breakdown display
    displayVATBreakdown();
}

// Refresh totals function
function refreshTotals() {
    // Calculate based on line items and charges
    const lineItemTotals = calculateLineItemTotals();
    const chargeTotals = calculateChargeTotals();

    // Update subtotal display
    document.getElementById('subtotal').textContent = lineItemTotals.subtotal.toFixed(2);
    document.getElementById('totalAllowances').textContent = chargeTotals.allowances.toFixed(2);
    document.getElementById('totalCharges').textContent = chargeTotals.charges.toFixed(2);
    
    // Recalculate net amount
    const subtotal = lineItemTotals.subtotal;
    const allowances = parseFloat(document.getElementById('totalAllowances').textContent);
    const charges = parseFloat(document.getElementById('totalCharges').textContent);
    const netAmount = subtotal - allowances + charges;
    
    // Update net amount
    document.getElementById('netAmount').textContent = netAmount.toFixed(2);
    
    // Update VAT breakdown while preserving manual edits
    displayVATBreakdown();
}

// Calculate totals from line items
function calculateLineItemTotals() {
    let subtotal = 0;

    document.querySelectorAll('.line-item').forEach((item, index) => {
        const quantity = parseFloat(document.querySelector(`[name="quantity${index}"]`).value) || 0;
        const price = parseFloat(document.querySelector(`[name="price${index}"]`).value) || 0;

        subtotal += quantity * price;
    });
																								   
    return {
        subtotal: roundNumber(subtotal)
    };
}

// Calculate totals from allowance charges
function calculateChargeTotals() {
    let allowances = 0;
    let charges = 0;

    document.querySelectorAll('.allowance-charge').forEach((item, index) => {
        const isCharge = document.querySelector(`[name="chargeType${index}"]`).value === 'true';
        const amount = parseFloat(document.querySelector(`[name="chargeAmount${index}"]`).value) || 0;
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

// Overriding original calculateTotals to work with refreshTotals
function calculateTotals() {
    const { vatBreakdown, totalVat } = calculateVATBreakdown();
    const lineItemTotals = calculateLineItemTotals();
    const chargeTotals = calculateChargeTotals();

    const subtotal = lineItemTotals.subtotal;
    const allowances = parseFloat(document.getElementById('totalAllowances').textContent);
    const charges = parseFloat(document.getElementById('totalCharges').textContent);
    const netAmount = subtotal - allowances + charges;
    const total = netAmount + totalVat;

    return {
        subtotal: roundNumber(subtotal),
        allowances: roundNumber(allowances),
        charges: roundNumber(charges),
        netAmount: roundNumber(netAmount),
        totalVat: roundNumber(totalVat),
        total: roundNumber(total)
    };
}

function renumberLineItems() {
    document.querySelectorAll('.line-item').forEach((item, newIndex) => {
        item.dataset.index = newIndex;
        item.querySelectorAll('input').forEach(input => {
            const baseName = input.name.replace(/\d+$/, '');
            input.name = baseName + newIndex;
        });
        const removeButton = item.querySelector('.button-danger');
        if (removeButton) {
            removeButton.onclick = () => removeLineItem(newIndex);
        }
    });
}

function renumberAllowanceCharges() {
    document.querySelectorAll('.allowance-charge').forEach((item, newIndex) => {
        item.dataset.index = newIndex;
        item.querySelectorAll('input, select').forEach(input => {
            const baseName = input.name.replace(/\d+$/, '');
            input.name = baseName + newIndex;
        });
        const removeButton = item.querySelector('.button-danger');
        if (removeButton) {
            removeButton.onclick = () => removeAllowanceCharge(newIndex);
        }
    });
}

function getAllowanceCharges() {
    const charges = [];
    document.querySelectorAll('.allowance-charge').forEach((item, index) => {
        charges.push({
            isCharge: document.querySelector(`[name="chargeType${index}"]`).value === 'true',
            reasonCode: document.querySelector(`[name="chargeReasonCode${index}"]`).value,
            reason: document.querySelector(`[name="chargeReason${index}"]`).value,
            amount: parseFloat(document.querySelector(`[name="chargeAmount${index}"]`).value) || 0,
            vatRate: parseFloat(document.querySelector(`[name="chargeVatRate${index}"]`).value) || 19.0,
            vatTypeId: document.querySelector(`[name="chargeVatType${index}"]`).value || 'S'
        });
    });
    return charges;
}

// Saving XML functionality
function saveXML() {
    if (!currentInvoice || !validateForm()) return;

    try {
        const xmlDoc = currentInvoice;
        updateBasicDetails(xmlDoc);
        updatePartyDetails(xmlDoc);
        updateAllowanceCharges(xmlDoc);
        updateLineItems(xmlDoc);
        updateTaxTotals(xmlDoc);
        updateMonetaryTotals(xmlDoc);
        downloadXML(xmlDoc);
    } catch (error) {
        handleError(error, 'Error saving XML file');
    }
}

function updateBasicDetails(xmlDoc) {
    setXMLValue(xmlDoc, 'cbc\\:ID, ID', document.querySelector('[name="invoiceNumber"]').value);
    setXMLValue(xmlDoc, 'cbc\\:IssueDate, IssueDate', document.querySelector('[name="issueDate"]').value);
    setXMLValue(xmlDoc, 'cbc\\:DueDate, DueDate', document.querySelector('[name="dueDate"]').value);
}

function updatePartyDetails(xmlDoc) {
    // Update supplier details
    const supplierParty = xmlDoc.querySelector('cac\\:AccountingSupplierParty, AccountingSupplierParty');
    if (supplierParty) {
        setXMLValue(supplierParty, 'cac\\:Party cac\\:PartyLegalEntity cbc\\:RegistrationName, PartyLegalEntity RegistrationName',
            document.querySelector('[name="supplierName"]').value);
        setXMLValue(supplierParty, 'cac\\:Party cac\\:PartyTaxScheme cbc\\:CompanyID, PartyTaxScheme CompanyID',
            document.querySelector('[name="supplierVAT"]').value);
        setXMLValue(supplierParty, 'cac\\:Party cac\\:PartyLegalEntity cbc\\:CompanyID, PartyLegalEntity CompanyID',
            document.querySelector('[name="supplierCompanyId"]').value);
        setXMLValue(supplierParty, 'cac\\:Party cac\\:PostalAddress cbc\\:StreetName, PostalAddress StreetName',
            document.querySelector('[name="supplierAddress"]').value);
        setXMLValue(supplierParty, 'cac\\:Party cac\\:PostalAddress cbc\\:CityName, PostalAddress CityName',
            document.querySelector('[name="supplierCity"]').value);
        setXMLValue(supplierParty, 'cac\\:Party cac\\:PostalAddress cbc\\:CountrySubentity, PostalAddress CountrySubentity',
            document.querySelector('[name="supplierCountrySubentity"]').value);
        setXMLValue(supplierParty, 'cac\\:Party cac\\:PostalAddress cac\\:Country cbc\\:IdentificationCode, Country IdentificationCode',
            document.querySelector('[name="supplierCountry"]').value);
            
        // Update or create Contact element for phone
        const phone = document.querySelector('[name="supplierPhone"]').value;
        if (phone) {
            let contactElement = supplierParty.querySelector('cac\\:Party cac\\:Contact, Contact');
            if (!contactElement) {
                const partyElement = supplierParty.querySelector('cac\\:Party, Party');
                contactElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:Contact");
                partyElement.appendChild(contactElement);
            }
            
            let telephoneElement = contactElement.querySelector('cbc\\:Telephone, Telephone');
            if (!telephoneElement) {
                telephoneElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Telephone");
                contactElement.appendChild(telephoneElement);
            }
            telephoneElement.textContent = phone;
        }
    }

    // Update customer details
    const customerParty = xmlDoc.querySelector('cac\\:AccountingCustomerParty, AccountingCustomerParty');
    if (customerParty) {
        setXMLValue(customerParty, 'cac\\:Party cac\\:PartyLegalEntity cbc\\:RegistrationName, PartyLegalEntity RegistrationName',
            document.querySelector('[name="customerName"]').value);
        setXMLValue(customerParty, 'cac\\:Party cac\\:PartyTaxScheme cbc\\:CompanyID, PartyTaxScheme CompanyID',
            document.querySelector('[name="customerVAT"]').value);
        setXMLValue(customerParty, 'cac\\:Party cac\\:PartyLegalEntity cbc\\:CompanyID, PartyLegalEntity CompanyID',
            document.querySelector('[name="customerCompanyId"]').value);
        setXMLValue(customerParty, 'cac\\:Party cac\\:PostalAddress cbc\\:StreetName, PostalAddress StreetName',
            document.querySelector('[name="customerAddress"]').value);
        setXMLValue(customerParty, 'cac\\:Party cac\\:PostalAddress cbc\\:CityName, PostalAddress CityName',
            document.querySelector('[name="customerCity"]').value);
        setXMLValue(customerParty, 'cac\\:Party cac\\:PostalAddress cbc\\:CountrySubentity, PostalAddress CountrySubentity',
            document.querySelector('[name="customerCountrySubentity"]').value);
        setXMLValue(customerParty, 'cac\\:Party cac\\:PostalAddress cac\\:Country cbc\\:IdentificationCode, Country IdentificationCode',
            document.querySelector('[name="customerCountry"]').value);

        // Update or create Contact element for phone
        const phone = document.querySelector('[name="customerPhone"]').value;
        if (phone) {
            let contactElement = customerParty.querySelector('cac\\:Party cac\\:Contact, Contact');
            if (!contactElement) {
                const partyElement = customerParty.querySelector('cac\\:Party, Party');
                contactElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:Contact");
                partyElement.appendChild(contactElement);
            }
            
            let telephoneElement = contactElement.querySelector('cbc\\:Telephone, Telephone');
            if (!telephoneElement) {
                telephoneElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Telephone");
                contactElement.appendChild(telephoneElement);
            }
            telephoneElement.textContent = phone;
        }
    }
}

function updateAllowanceCharges(xmlDoc) {
    const currencyID = xmlDoc.querySelector('cbc\\:DocumentCurrencyCode, DocumentCurrencyCode').textContent;
    
    // Remove existing AllowanceCharge elements
    const existingCharges = xmlDoc.querySelectorAll('cac\\:AllowanceCharge, AllowanceCharge');
    existingCharges.forEach(charge => charge.remove());
    
    // Add new AllowanceCharge elements
    const charges = getAllowanceCharges();
    const taxTotalNode = xmlDoc.querySelector('cac\\:TaxTotal, TaxTotal');
    
    charges.forEach(charge => {
        const allowanceCharge = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:AllowanceCharge");
        
        // Add basic charge details
        allowanceCharge.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ChargeIndicator", 
            charge.isCharge.toString()));
        
        if (charge.reasonCode) {
            allowanceCharge.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, 
                "cbc:AllowanceChargeReasonCode", charge.reasonCode));
        }
        
        if (charge.reason) {
            allowanceCharge.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, 
                "cbc:AllowanceChargeReason", charge.reason));
        }
        
        // Add amount
        allowanceCharge.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Amount", 
            charge.amount.toFixed(2), { currencyID }));
        
        // Add tax category with VAT type
        const taxCategory = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxCategory");
        taxCategory.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", charge.vatTypeId));
        
        // Set VAT percent based on type
        const vatPercent = charge.vatTypeId === 'AE' ? '0.00' : charge.vatRate.toString();
        taxCategory.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Percent", vatPercent));
        
        const taxScheme = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxScheme");
        taxScheme.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", "VAT"));
        taxCategory.appendChild(taxScheme);
        
        allowanceCharge.appendChild(taxCategory);
        
        // Insert before TaxTotal
        if (taxTotalNode) {
            xmlDoc.documentElement.insertBefore(allowanceCharge, taxTotalNode);
        } else {
            xmlDoc.documentElement.appendChild(allowanceCharge);
        }
    });
}


function updateLineItems(xmlDoc) {
    const currencyID = xmlDoc.querySelector('cbc\\:DocumentCurrencyCode, DocumentCurrencyCode').textContent;
    
    // Remove existing line items
    const existingLines = xmlDoc.querySelectorAll('cac\\:InvoiceLine, InvoiceLine');
    existingLines.forEach(line => line.remove());
    
    // Add updated line items
    document.querySelectorAll('.line-item').forEach((item, index) => {
        const invoiceLine = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:InvoiceLine");
        
        // Get basic line item details
        const quantity = document.querySelector(`[name="quantity${index}"]`).value;
        const unitCode = document.querySelector(`[name="unit${index}"]`).value;
        const price = document.querySelector(`[name="price${index}"]`).value;
        const description = document.querySelector(`[name="description${index}"]`).value;
        const itemDescription = document.querySelector(`[name="itemDescription${index}"]`).value;
        const vatType = document.querySelector(`[name="vatType${index}"]`).value;
        const vatRate = vatType === 'AE' ? '0.00' : document.querySelector(`[name="vatRate${index}"]`).value;
        const lineAmount = roundNumber(parseFloat(quantity) * parseFloat(price));

        // Add line elements
        invoiceLine.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", (index + 1).toString()));
        
        const quantityElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:InvoicedQuantity", quantity.toString());
        quantityElement.setAttribute('unitCode', unitCode);
        invoiceLine.appendChild(quantityElement);
        
        invoiceLine.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:LineExtensionAmount", 
            lineAmount.toFixed(2), { currencyID }));

        // Create Item element
        const itemElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:Item");

        // Add Description if present (must come before Name)
        if (itemDescription) {
            itemElement.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Description", itemDescription));
        }

        // Add Name
        itemElement.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Name", description));

        // Add Seller's Item Identification if present
        const sellersItemIdentification = document.querySelector(`[name="sellersItemIdentification${index}"]`).value;
        if (sellersItemIdentification) {
            const sellersItemElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:SellersItemIdentification");
            sellersItemElement.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", sellersItemIdentification));
            itemElement.appendChild(sellersItemElement);
        }

        // Add Standard Item Identification if present
        const standardItemId = document.querySelector(`[name="standardItemId${index}"]`).value;
        if (standardItemId) {
            const standardItemElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:StandardItemIdentification");
            const standardIdElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", standardItemId);
            standardIdElement.setAttribute('schemeID', 
                document.querySelector(`[name="standardItemSchemeId${index}"]`).value || '0160');
            standardItemElement.appendChild(standardIdElement);
            itemElement.appendChild(standardItemElement);
        }

        // Add Commodity Classification if present
        const commodityCode = document.querySelector(`[name="commodityCode${index}"]`).value;
        if (commodityCode) {
            const commodityElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:CommodityClassification");
            const classificationElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ItemClassificationCode", commodityCode);
            classificationElement.setAttribute('listID', 
                document.querySelector(`[name="commodityListId${index}"]`).value || 'CV');
            commodityElement.appendChild(classificationElement);
            itemElement.appendChild(commodityElement);
        }

        // Add Tax Category
        const taxCategory = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:ClassifiedTaxCategory");
        taxCategory.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", vatType));
        taxCategory.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Percent", vatRate));
        
        const taxScheme = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxScheme");
        taxScheme.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", "VAT"));
        taxCategory.appendChild(taxScheme);
        itemElement.appendChild(taxCategory);

        invoiceLine.appendChild(itemElement);

        // Add Price element
        const priceElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:Price");
        priceElement.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:PriceAmount", 
            price.toString(), { currencyID }));
        invoiceLine.appendChild(priceElement);

        xmlDoc.documentElement.appendChild(invoiceLine);
    });
}

function handleVatTypeChange(index) {
    const vatTypeSelect = document.querySelector(`[name="vatType${index}"]`);
    const vatRateInput = document.querySelector(`[name="vatRate${index}"]`);
    
    // Set VAT rate based on type
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
    
    updateTotals();
}

// Update calculateVATBreakdown function to properly handle allowances and charges
function calculateVATBreakdown() {
    const vatBreakdown = new Map();
    let totalVat = 0;

    // Get values from VAT breakdown UI
    const vatRows = document.querySelectorAll('.vat-row');
    vatRows.forEach(row => {
        const type = row.querySelector('.vat-type').value;
        const rate = parseFloat(row.querySelector('.vat-rate').value) || 0;
        const baseAmount = parseFloat(row.querySelector('.vat-base').value) || 0;
        const vatAmount = parseFloat(row.querySelector('.vat-amount').value) || 0;

        const key = `${rate}-${type}`;
        vatBreakdown.set(key, {
            baseAmount: baseAmount,
            vatAmount: vatAmount,
            rate: rate,
            type: type
        });

        totalVat += vatAmount;
    });

    // If no VAT rows exist, calculate from line items (fallback)
    if (vatRows.length === 0) {
        // Original calculation logic here
        document.querySelectorAll('.line-item').forEach((item, index) => {
            const quantity = parseFloat(document.querySelector(`[name="quantity${index}"]`).value) || 0;
            const price = parseFloat(document.querySelector(`[name="price${index}"]`).value) || 0;
            const vatType = document.querySelector(`[name="vatType${index}"]`).value;
            const vatRate = parseFloat(document.querySelector(`[name="vatRate${index}"]`).value) || 0;
            
            const lineTotal = quantity * price;
            const key = `${vatRate}-${vatType}`;
            
            if (!vatBreakdown.has(key)) {
                vatBreakdown.set(key, {
                    baseAmount: 0,
                    vatAmount: 0,
                    rate: vatRate,
                    type: vatType
                });
            }
            
            const entry = vatBreakdown.get(key);
            entry.baseAmount += lineTotal;
            if (vatType === 'S') {
                entry.vatAmount += lineTotal * vatRate / 100;
            }
        });
    }

    return { vatBreakdown, totalVat };
}


function removeVATRow(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
        updateTotalVAT();
        refreshTotals();
    }
}

// Global functions for VAT handling
window.updateVATRow = function(rowId, source) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const typeSelect = row.querySelector('.vat-type');
    const rateInput = row.querySelector('.vat-rate');
    const baseInput = row.querySelector('.vat-base');
    const amountInput = row.querySelector('.vat-amount');
    
    // If the update is from manual input, mark this row as manually edited
    if (source === 'manual') {
        manuallyEditedVatRows.add(rowId);
    }
    
    // Only calculate if not manually edited or if this is a manual update
    if (!manuallyEditedVatRows.has(rowId) || source === 'manual') {
        const type = typeSelect.value;
        const rate = parseFloat(rateInput.value) || 0;
        const base = parseFloat(baseInput.value) || 0;
        
        // Only calculate VAT for standard rate
        const calculatedAmount = type === 'S' ? roundNumber(base * rate / 100) : 0;
        amountInput.value = calculatedAmount.toFixed(2);
    }
    
    updateTotalVAT();
    refreshTotals();
};

window.updateVATRowFromAmount = function(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;

    manuallyEditedVatRows.add(rowId);
    
    const rateInput = row.querySelector('.vat-rate');
    const baseInput = row.querySelector('.vat-base');
    const amountInput = row.querySelector('.vat-amount');
    
    const rate = parseFloat(rateInput.value) || 0;
    const amount = parseFloat(amountInput.value) || 0;
    
    if (rate !== 0) {
        const calculatedBase = roundNumber((amount * 100) / rate);
        baseInput.value = calculatedBase.toFixed(2);
    }
    
    updateTotalVAT();
    refreshTotals();
};

window.removeVATRow = function(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        manuallyEditedVatRows.delete(rowId);
        row.remove();
        updateTotalVAT();
        refreshTotals();
    }
};

window.addVATRate = function() {
    const container = document.getElementById('vatBreakdownRows');
    addVATBreakdownRow(19, 0, 0); // Default rate 19%
    refreshTotals();
};

function addVATBreakdownRow(rate, baseAmount, vatAmount, vatType = 'S', existingRowId = null) {
    const container = document.getElementById('vatBreakdownRows');
    const rowId = existingRowId || `vat-row-${Date.now()}`;
    
    const rowHtml = `
        <div class="vat-row" id="${rowId}">
            <div class="total-row">
                <div class="vat-inputs">
                    <label>Type:</label>
                    <select class="form-input vat-type" onchange="window.updateVATRow('${rowId}', 'manual')">
                        ${Object.entries(VAT_TYPES).map(([key, value]) => 
                            `<option value="${key}" ${key === vatType ? 'selected' : ''}>${value}</option>`
                        ).join('')}
                    </select>
                    <label>Rate:</label>
                    <input type="number" class="form-input vat-rate" value="${rate}" 
                           onchange="window.updateVATRow('${rowId}', 'manual')" step="0.1" min="0" max="100">%
                    <label>Base Amount:</label>
                    <input type="number" class="form-input vat-base" value="${baseAmount.toFixed(2)}" 
                           onchange="window.updateVATRow('${rowId}', 'manual')" step="0.01">
                    <label>VAT Amount:</label>
                    <input type="number" class="form-input vat-amount" value="${vatAmount.toFixed(2)}" 
                           onchange="window.updateVATRowFromAmount('${rowId}')" step="0.01">
                    <button type="button" class="button button-small button-danger" 
                            onclick="window.removeVATRow('${rowId}')">Remove</button>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', rowHtml);
    
    // Handle VAT type change
    const typeSelect = document.querySelector(`#${rowId} .vat-type`);
    const rateInput = document.querySelector(`#${rowId} .vat-rate`);
    const amountInput = document.querySelector(`#${rowId} .vat-amount`);
    
    typeSelect.addEventListener('change', function() {
        if (this.value !== 'S') {
            rateInput.value = '0';
            amountInput.value = '0';
            rateInput.disabled = true;
            amountInput.disabled = true;
        } else {
            rateInput.disabled = false;
            amountInput.disabled = false;
        }
        window.updateVATRow(rowId, 'manual');
    });
    
    // Initialize disabled state
    if (vatType !== 'S') {
        rateInput.disabled = true;
        amountInput.disabled = true;
    }
}

function updateTotalVAT() {
    const totalVat = Array.from(document.querySelectorAll('.vat-amount'))
        .reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
    
    document.getElementById('vat').textContent = totalVat.toFixed(2);
    
    // Update total invoice amount
    const netAmount = parseFloat(document.getElementById('netAmount').textContent) || 0;
    const total = netAmount + totalVat;
    document.getElementById('total').textContent = total.toFixed(2);
}

function displayVATBreakdown() {
    const container = document.getElementById('vatBreakdownRows');
    if (!container) return;
    
    // Save existing manually edited values
    const existingValues = new Map();
    manuallyEditedVatRows.forEach(rowId => {
        const row = document.getElementById(rowId);
        if (row) {
            existingValues.set(rowId, {
                rate: row.querySelector('.vat-rate').value,
                base: row.querySelector('.vat-base').value,
                amount: row.querySelector('.vat-amount').value,
                type: row.querySelector('.vat-type').value
            });
        }
    });
    
    // Clear container
    container.innerHTML = '';
    
    // Calculate VAT breakdown
    const { vatBreakdown } = calculateVATBreakdown();
    
    // Restore manually edited rows
    existingValues.forEach((values, rowId) => {
        addVATBreakdownRow(
            parseFloat(values.rate),
            parseFloat(values.base),
            parseFloat(values.amount),
            values.type,
            rowId
        );
    });
    
    // Add new rows for calculated values
    vatBreakdown.forEach((data, key) => {
        // Only add if there isn't already a row with this rate and type
        const existingRow = Array.from(document.querySelectorAll('.vat-row')).some(row => {
            const rate = row.querySelector('.vat-rate').value;
            const type = row.querySelector('.vat-type').value;
            return parseFloat(rate) === data.rate && type === data.type;
        });
            
        if (!existingRow) {
            addVATBreakdownRow(data.rate, data.baseAmount, data.vatAmount, data.type);
        }
    });
    
    // Update totals
    updateTotalVAT();
}
    
function handleChargeVatTypeChange(index) {
    const vatTypeSelect = document.querySelector(`[name="chargeVatType${index}"]`);
    const vatRateInput = document.querySelector(`[name="chargeVatRate${index}"]`);
    
    // Set VAT rate based on type
    switch(vatTypeSelect.value) {
        case 'AE':
        case 'Z':
        case 'O':
        case 'E':
            vatRateInput.value = '0.00';
            vatRateInput.disabled = true;
            break;
        case 'S':
            vatRateInput.value = '19.00';
            vatRateInput.disabled = false;
            break;
    }
    
    updateTotals();
}

function updateTaxTotals(xmlDoc) {
    const currencyID = xmlDoc.querySelector('cbc\\:DocumentCurrencyCode, DocumentCurrencyCode').textContent;
    
    // Get VAT breakdown from UI
    const { vatBreakdown, totalVat } = calculateVATBreakdown();
    
    // Get or create TaxTotal element
    let taxTotal = xmlDoc.querySelector('cac\\:TaxTotal, TaxTotal');
    if (!taxTotal) {
        taxTotal = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxTotal");
        xmlDoc.documentElement.appendChild(taxTotal);
    } else {
        while (taxTotal.firstChild) {
            taxTotal.removeChild(taxTotal.firstChild);
        }
    }

    // Add total TaxAmount using the value from UI
    const uiTotalVat = parseFloat(document.getElementById('vat').textContent);
    taxTotal.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:TaxAmount", 
        uiTotalVat.toFixed(2), { currencyID }));

    // Get all VAT rows from the UI
    const vatRows = document.querySelectorAll('.vat-row');
    vatRows.forEach(row => {
        const taxSubtotal = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxSubtotal");
        
        // Get values directly from UI inputs
        const baseAmount = parseFloat(row.querySelector('.vat-base').value) || 0;
        const vatAmount = parseFloat(row.querySelector('.vat-amount').value) || 0;
        const vatType = row.querySelector('.vat-type').value;
        const vatRate = parseFloat(row.querySelector('.vat-rate').value) || 0;

        // Add TaxableAmount and TaxAmount directly from UI values
        taxSubtotal.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:TaxableAmount", 
            baseAmount.toFixed(2), { currencyID }));
        taxSubtotal.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:TaxAmount", 
            vatAmount.toFixed(2), { currencyID }));

        const taxCategory = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxCategory");
        taxCategory.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", vatType));
        
        const percent = vatType === 'AE' ? 0 : vatRate;
        taxCategory.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Percent", 
            percent.toFixed(2)));
        
        if (vatType === 'AE') {
            taxCategory.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, 
                "cbc:TaxExemptionReasonCode", "VATEX-EU-AE"));
        }
        
        const taxScheme = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxScheme");
        taxScheme.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", "VAT"));
        taxCategory.appendChild(taxScheme);
        
        taxSubtotal.appendChild(taxCategory);
        taxTotal.appendChild(taxSubtotal);
    });
}

function updateMonetaryTotals(xmlDoc) {
    const currencyID = xmlDoc.querySelector('cbc\\:DocumentCurrencyCode, DocumentCurrencyCode').textContent;

    // Get values directly from UI to ensure we use manually edited values
    const subtotal = parseFloat(document.getElementById('subtotal').textContent) || 0;
    const allowances = parseFloat(document.getElementById('totalAllowances').textContent) || 0;
    const charges = parseFloat(document.getElementById('totalCharges').textContent) || 0;
    const netAmount = parseFloat(document.getElementById('netAmount').textContent) || 0;
    const totalVat = parseFloat(document.getElementById('vat').textContent) || 0;
    const total = parseFloat(document.getElementById('total').textContent) || 0;

    let monetaryTotal = xmlDoc.querySelector('cac\\:LegalMonetaryTotal, LegalMonetaryTotal');
    if (!monetaryTotal) {
        monetaryTotal = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:LegalMonetaryTotal");
        xmlDoc.documentElement.appendChild(monetaryTotal);
    } else {
        // Remove existing elements
        while (monetaryTotal.firstChild) {
            monetaryTotal.removeChild(monetaryTotal.firstChild);
        }
    }

    // Add all monetary amounts with current values
    const amounts = {
        "LineExtensionAmount": subtotal,
        "TaxExclusiveAmount": netAmount,
        "TaxInclusiveAmount": total,
        "AllowanceTotalAmount": allowances,
        "ChargeTotalAmount": charges,
        "PayableAmount": total
    };

    Object.entries(amounts).forEach(([elementName, value]) => {
        monetaryTotal.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, 
            `cbc:${elementName}`, value.toFixed(2), { currencyID }));
    });
}

// Utility functions
function getXMLValue(xmlDoc, selector, defaultValue = '') {
    if (!xmlDoc) return defaultValue;
    try {
        const element = xmlDoc.querySelector(selector);
        return element ? element.textContent : defaultValue;
    } catch (error) {
        console.warn(`Error getting value for selector ${selector}:`, error);
        return defaultValue;
    }
}

function setXMLValue(xmlDoc, selector, value) {
    try {
        const element = xmlDoc.querySelector(selector);
        if (element) {
            element.textContent = value;
            return true;
        }
        return false;
    } catch (error) {
        console.warn(`Error setting value for selector ${selector}:`, error);
        return false;
    }
}

function createXMLElement(xmlDoc, namespace, elementName, value = '', attributes = {}) {
    const element = xmlDoc.createElementNS(namespace, elementName);
    if (value) {
        element.textContent = value;
    }
    Object.entries(attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
    });
    return element;
}

function formatXML(xmlString) {
    let formatted = '';
    let indent = '';
    const tab = '  '; // 2 spaces for indentation
    
    xmlString.split(/>\s*</).forEach(node => {
        if (node.match(/^\/\w/)) {
            indent = indent.substring(tab.length);
        }
        formatted += indent + '<' + node + '>\r\n';
        if (node.match(/^<?\w[^>]*[^\/]$/) && !node.startsWith("?")) {
            indent += tab;
        }
    });
    
    return formatted.substring(1, formatted.length - 3);
}

function downloadXML(xmlDoc) {
    const serializer = new XMLSerializer();
    let xmlString = serializer.serializeToString(xmlDoc);
    
    // Add XML declaration if missing
    if (!xmlString.startsWith('<?xml')) {
        xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlString;
    }

    xmlString = formatXML(xmlString);

    const blob = new Blob([xmlString], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoice_' + document.querySelector('[name="invoiceNumber"]').value + '.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function roundNumber(number, decimals = 2) {
    return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

function handleError(error, message) {
    console.error(message, error);
    alert(`${message}\nPlease check the console for details.`);
}

function validateForm(silent = false) {
    const requiredFields = [
        'invoiceNumber',
        'issueDate',
        'dueDate',
        'supplierName',
        'supplierVAT',
        'customerName',
        'customerVAT'
    ];

    let isValid = true;
    let firstInvalidField = null;

    requiredFields.forEach(fieldName => {
        const field = document.querySelector(`[name="${fieldName}"]`);
        if (!field || !field.value.trim()) {
            field.classList.add('invalid');
            isValid = false;
            if (!firstInvalidField) firstInvalidField = field;
        } else {
            field.classList.remove('invalid');
        }
    });

    // Validate line items
    const lineItems = document.querySelectorAll('.line-item');
    if (lineItems.length === 0) {
        isValid = false;
        if (!silent) {
            alert('At least one line item is required');
        }
        return false;
    }

    lineItems.forEach((item, index) => {
        const quantity = parseFloat(document.querySelector(`[name="quantity${index}"]`).value);
        const price = parseFloat(document.querySelector(`[name="price${index}"]`).value);
        const description = document.querySelector(`[name="description${index}"]`).value;

        if (!description.trim()) {
            document.querySelector(`[name="description${index}"]`).classList.add('invalid');
            isValid = false;
        }
        if (isNaN(quantity)) {
            document.querySelector(`[name="quantity${index}"]`).classList.add('invalid');
            isValid = false;
        }
        if (isNaN(price)) {
            document.querySelector(`[name="price${index}"]`).classList.add('invalid');
            isValid = false;
        }
    });

    if (!isValid && !silent) {
        if (firstInvalidField) {
            firstInvalidField.focus();
        }
        alert('Please fill in all required fields correctly');
    }

    return isValid;
}

// Initialize UI
function initializeUI() {
    // Add event listeners for form inputs
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('input', function() {
            this.classList.remove('invalid');
            updateTotals();
        });
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 's':
                    event.preventDefault();
                    saveXML();
                    break;
                case 'o':
                    event.preventDefault();
                    document.getElementById('fileInput').click();
                    break;
                case 'n':
                    event.preventDefault();
                    addLineItem();
                    break;
            }
        }
    });

    // Initialize with current date and default due date
    if (!currentInvoice) {
        const today = new Date();
        const dueDate = new Date();
        dueDate.setDate(today.getDate() + 30);

        document.querySelector('[name="issueDate"]').value = today.toISOString().split('T')[0];
        document.querySelector('[name="dueDate"]').value = dueDate.toISOString().split('T')[0];
    }

    // Make functions globally available for onclick events
    window.addLineItem = addLineItem;
    window.removeLineItem = removeLineItem;
    window.addAllowanceCharge = addAllowanceCharge;
    window.removeAllowanceCharge = removeAllowanceCharge;
    window.handleStorno = handleStorno;
    window.updateTotals = updateTotals;
    window.saveXML = saveXML;
	
	// Add the new functions to the global window object
	window.refreshTotals = refreshTotals;

    // Add method to show VAT breakdown
    window.displayVATBreakdown = displayVATBreakdown;    
}

// Export functions for testing if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateTotals,
        validateForm,
        roundNumber,
        formatXML,
        createXMLElement,
        getXMLValue,
        setXMLValue
    };
}