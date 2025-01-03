// Constants
const XML_NAMESPACES = {
    ubl: "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2",
    cbc: "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    cac: "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
};

const VAT_TYPES = {
    "S": "Cotă Standard",
    "AE": "Taxare Inversă",
    "O": "Neplătitor TVA",
    "Z": "Cotă 0% TVA",
    "E": "Neimpozabil"
};

const UNIT_CODES = new Map([
    ['EA', 'Bucată (EA)'],
    ['XPP', 'Bucată (XPP)'],
    ['KGM', 'Kilogram (KGM)'],
    ['MTR', 'Metri (MTR)'],
    ['LTR', 'Litru (LTR)'],
    ['H87', 'Bucată (H87)'],
    ['MTQ', 'Metri cubi (MTQ)']
]);

// Global variables
let currentInvoice = null;
let originalTotals = null;
let vatRates = new Map();
let manuallyEditedVatRows = new Set();

// Initialize event listeners
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    initializeUI();
    
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
        
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Eroare la parsarea XML: ' + parserError.textContent);
        }

        currentInvoice = xmlDoc;
        manuallyEditedVatRows.clear();

        populateBasicDetails(xmlDoc);
        populatePartyDetails(xmlDoc);
        populateAllowanceCharges(xmlDoc);
        populateLineItems(xmlDoc);
        storeOriginalTotals(xmlDoc);
        restoreOriginalTotals();
        
    } catch (error) {
        handleError(error, 'Eroare la parsarea fișierului XML');
    }
}

// Create allowance charge HTML
function createAllowanceChargeHTML(index, charge) {
    return `
        <div class="allowance-charge" data-index="${index}">
            <div class="grid">
                <div class="form-group">
                    <label class="form-label">Tip</label>
                    <select class="form-input" name="chargeType${index}">
                        <option value="true" ${charge.isCharge ? 'selected' : ''}>Taxă</option>
                        <option value="false" ${!charge.isCharge ? 'selected' : ''}>Reducere</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Cod Motiv</label>
                    <input type="text" class="form-input" name="chargeReasonCode${index}" 
                           value="${charge.reasonCode}">
                </div>
                <div class="form-group">
                    <label class="form-label">Motiv</label>
                    <input type="text" class="form-input" name="chargeReason${index}" 
                           value="${charge.reason}">
                </div>
                <div class="form-group">
                    <label class="form-label">Valoare</label>
                    <input type="number" step="0.01" class="form-input" name="chargeAmount${index}" 
                           value="${charge.amount}">
                </div>
                <div class="form-group">
                    <label class="form-label">Tip TVA</label>
                    <select class="form-input" name="chargeVatType${index}">
                        ${Object.entries(VAT_TYPES).map(([key, value]) => 
                            `<option value="${key}" ${key === charge.vatTypeId ? 'selected' : ''}>${value}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Cotă TVA (%)</label>
                    <input type="number" step="0.1" class="form-input" name="chargeVatRate${index}" 
                           value="${charge.vatRate}" ${charge.vatTypeId !== 'S' ? 'disabled' : ''}>
                </div>
            </div>
            <button type="button" class="button button-danger remove-line-item" onclick="removeAllowanceCharge(${index})">
                ✕
            </button>
        </div>
    `;
}

// Create line item HTML
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

            <div class="optional-details-toggle">
                <button type="button" class="button button-secondary" 
                    onclick="toggleOptionalDetails(${index})">
                    ▼ Detalii Suplimentare
                </button>
            </div>

            <div class="optional-details" id="optionalDetails${index}" style="display: none;">
                <div class="grid">
                    <div class="form-group">
                        <label class="form-label">Descriere</label>
                        <textarea class="form-input" name="itemDescription${index}" rows="2">${itemDescription}</textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Cod Intern Furnizor</label>
                        <input type="text" class="form-input" name="sellersItemIdentification${index}" 
                            value="${sellersItemIdentification}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Cod Standard Produs</label>
                        <div class="commodity-group">
                            <input type="text" class="form-input" name="standardItemId${index}" 
                                placeholder="Cod" value="${standardItemId}">
                            <input type="text" class="form-input" name="standardItemSchemeId${index}" 
                                placeholder="Schemă" value="${standardItemSchemeId}">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Clasificare Produs</label>
                        <div class="commodity-group">
                            <input type="text" class="form-input" name="commodityCode${index}" 
                                placeholder="Cod" value="${commodityCode}">
                            <input type="text" class="form-input" name="commodityListId${index}" 
                                placeholder="Listă" value="${commodityListId}">
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

// Add VAT breakdown row
function addVATBreakdownRow(rate, baseAmount, vatAmount, vatType = 'S', existingRowId = null) {
    const container = document.getElementById('vatBreakdownRows');
    const rowId = existingRowId || `vat-row-${Date.now()}`;
    
    const rowHtml = `
        <div class="vat-row" id="${rowId}">
            <div class="total-row">
                <div class="vat-inputs">
                    <label>Tip:</label>
                    <select class="form-input vat-type" onchange="window.updateVATRow('${rowId}', 'manual')">
                        ${Object.entries(VAT_TYPES).map(([key, value]) => 
                            `<option value="${key}" ${key === vatType ? 'selected' : ''}>${value}</option>`
                        ).join('')}
                    </select>
                    <label>Cotă:</label>
                    <input type="number" class="form-input vat-rate" value="${rate}" 
                           onchange="window.updateVATRow('${rowId}', 'manual')" step="0.1" min="0" max="100">%
                    <label>Bază Impozabilă:</label>
                    <input type="number" class="form-input vat-base" value="${baseAmount.toFixed(2)}" 
                           onchange="window.updateVATRow('${rowId}', 'manual')" step="0.01">
                    <label>Valoare TVA:</label>
                    <input type="number" class="form-input vat-amount" value="${vatAmount.toFixed(2)}" 
                           onchange="window.updateVATRowFromAmount('${rowId}')" step="0.01">
                    <button type="button" class="button button-small button-danger" 
                            onclick="window.removeVATRow('${rowId}')">Șterge</button>
                </div>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', rowHtml);
}

// Toggle optional details
function toggleOptionalDetails(index) {
    const optionalDetails = document.getElementById(`optionalDetails${index}`);
    const button = optionalDetails.previousElementSibling.querySelector('button');
    
    if (optionalDetails.style.display === 'none') {
        optionalDetails.style.display = 'block';
        button.innerHTML = '▲ Detalii Suplimentare';
    } else {
        optionalDetails.style.display = 'none';
        button.innerHTML = '▼ Detalii Suplimentare';
    }
}

// Form validation
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
            if (!firstInvalidField)
                firstInvalidField = field;
        } else {
            field.classList.remove('invalid');
        }
    });

    const lineItems = document.querySelectorAll('.line-item');
    if (lineItems.length === 0) {
        isValid = false;
        if (!silent) {
            alert('Este necesară cel puțin o linie în factură');
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

    const dateInputs = document.querySelectorAll('.date-input');
    dateInputs.forEach(input => {
        if (!validateDateInput(input)) {
            isValid = false;
            if (!firstInvalidField) firstInvalidField = input;
        }
    });

    if (!isValid && !silent) {
        if (firstInvalidField) {
            firstInvalidField.focus();
        }
        alert('Vă rugăm să completați toate câmpurile obligatorii');
    }

    return isValid;
}

function handleError(error, message) {
    console.error(message, error);
    alert(`${message}\nVă rugăm să verificați consola pentru detalii.`);
}

function formatDateToRomanian(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

function parseRomanianDate(dateStr) {
    const [day, month, year] = dateStr.split('.');
    return `${year}-${month}-${day}`;
}

function createDatePicker(input, button) {
    const picker = new Pikaday({
        field: input,
        trigger: button,
        format: 'DD.MM.YYYY',
        i18n: {
            previousMonth: 'Luna anterioară',
            nextMonth: 'Luna următoare',
            months: ['Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie', 'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie'],
            weekdays: ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'],
            weekdaysShort: ['Dum', 'Lun', 'Mar', 'Mie', 'Joi', 'Vin', 'Sâm']
        },
        firstDay: 1,
        onSelect: function(date) {
            input.value = formatDateToRomanian(date);
            validateDateInput(input);
        }
    });
    return picker;
}

function validateDateInput(input) {
    const value = input.value;
    const regex = /^(\d{2})\.(\d{2})\.(\d{4})$/;
    const match = value.match(regex);
    
    if (match) {
        const day = parseInt(match[1]);
        const month = parseInt(match[2]);
        const year = parseInt(match[3]);
        
        // Create date object and verify if it's valid
        const date = new Date(year, month - 1, day);
        if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
            input.classList.remove('invalid');
            return true;
        }
    }
    
    if (value !== '') {
        input.classList.add('invalid');
    }
    return false;
}

function restrictDateInput(input) {
    input.addEventListener('input', function(e) {
        let value = e.target.value;
        
        // Remove any non-digit characters except dots
        value = value.replace(/[^\d.]/g, '');
        
        // Auto-add dots after day and month
        if (value.length >= 2 && value.charAt(2) !== '.') {
            value = value.slice(0, 2) + '.' + value.slice(2);
        }
        if (value.length >= 5 && value.charAt(5) !== '.') {
            value = value.slice(0, 5) + '.' + value.slice(5);
        }
        
        // Restrict to exactly 10 characters (dd.mm.yyyy)
        value = value.slice(0, 10);
        
        e.target.value = value;
    });

    input.addEventListener('blur', function() {
        validateDateInput(input);
    });
}

function initializeUI() {
    document.querySelectorAll('.form-input').forEach(input => {
        input.addEventListener('input', function() {
            this.classList.remove('invalid');
            updateTotals();
        });
    });

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

    // Initialize date pickers
    const dateInputs = document.querySelectorAll('.date-input');
    dateInputs.forEach(input => {
        const button = input.parentElement.querySelector('.calendar-button');
        createDatePicker(input, button);
        restrictDateInput(input);
    });

    if (!currentInvoice) {
        const today = new Date();
        const dueDate = new Date();
        dueDate.setDate(today.getDate() + 30);

        document.querySelector('[name="issueDate"]').value = formatDateToRomanian(today);
        document.querySelector('[name="dueDate"]').value = formatDateToRomanian(dueDate);
    }

    window.addLineItem = addLineItem;
    window.removeLineItem = removeLineItem;
    window.addAllowanceCharge = addAllowanceCharge;
    window.removeAllowanceCharge = removeAllowanceCharge;
    window.handleStorno = handleStorno;
    window.updateTotals = updateTotals;
    window.saveXML = saveXML;
    window.refreshTotals = refreshTotals;
    window.displayVATBreakdown = displayVATBreakdown;    
}

// Handling VAT type changes
function handleVatTypeChange(index) {
    const vatTypeSelect = document.querySelector(`[name="vatType${index}"]`);
    const vatRateInput = document.querySelector(`[name="vatRate${index}"]`);
    
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

function handleChargeVatTypeChange(index) {
    const vatTypeSelect = document.querySelector(`[name="chargeVatType${index}"]`);
    const vatRateInput = document.querySelector(`[name="chargeVatRate${index}"]`);
    
    if (!vatTypeSelect || !vatRateInput) return;
    
    const vatType = vatTypeSelect.value;
    switch(vatType) {
        case 'S': // Standard rate
            vatRateInput.value = '19.00';
            vatRateInput.disabled = false;
            break;
        case 'AE': // Reverse charge
        case 'Z':  // Zero rate
        case 'O':  // Out of scope
        case 'E':  // Exempt
            vatRateInput.value = '0.00';
            vatRateInput.disabled = true;
            break;
    }
    
    // Clear manual edits and refresh
    manuallyEditedVatRows.clear();
    refreshTotals();
}

// XML modifications
function addUnitCode(code) {
    if (!UNIT_CODES.has(code)) {
        UNIT_CODES.set(code, `${code} (${code})`);
    }
}

function createUnitCodeOptionsHTML(selectedCode = 'EA') {
    return Array.from(UNIT_CODES.entries())
        .map(([code, description]) => 
            `<option value="${code}" ${code === selectedCode ? 'selected' : ''}>${description}</option>`
        )
        .join('');
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

    const container = document.getElementById('vatBreakdownRows');
    if (container) {
        container.innerHTML = '';
        
        if (originalTotals.vatBreakdown && originalTotals.vatBreakdown.length > 0) {
            originalTotals.vatBreakdown.forEach(vat => {
                const rate = parseFloat(vat.percent);
                const base = parseFloat(vat.taxableAmount);
                const amount = parseFloat(vat.taxAmount);
                addVATBreakdownRow(rate, base, amount);
            });
        } else {
            const { vatBreakdown } = calculateVATBreakdown();
            vatBreakdown.forEach((data, vatRate) => {
                addVATBreakdownRow(vatRate, data.baseAmount, data.vatAmount);
            });
        }
    }
}

function populateBasicDetails(xmlDoc) {
    document.querySelector('[name="invoiceNumber"]').value = getXMLValue(xmlDoc, 'cbc\\:ID, ID');
    
    const issueDate = getXMLValue(xmlDoc, 'cbc\\:IssueDate, IssueDate');
    const dueDate = getXMLValue(xmlDoc, 'cbc\\:DueDate, DueDate');
    
    if (issueDate) {
        const [year, month, day] = issueDate.split('-');
        document.querySelector('[name="issueDate"]').value = `${day}.${month}.${year}`;
    }
    
    if (dueDate) {
        const [year, month, day] = dueDate.split('-');
        document.querySelector('[name="dueDate"]').value = `${day}.${month}.${year}`;
    }
}

function populatePartyDetails(xmlDoc) {
    const supplierParty = xmlDoc.querySelector('cac\\:AccountingSupplierParty, AccountingSupplierParty');
    if (supplierParty) {
        document.querySelector('[name="supplierName"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PartyLegalEntity cbc\\:RegistrationName, PartyLegalEntity RegistrationName');
        
        document.querySelector('[name="supplierVAT"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PartyTaxScheme cbc\\:CompanyID, PartyTaxScheme CompanyID');
        
        document.querySelector('[name="supplierCompanyId"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PartyLegalEntity cbc\\:CompanyID, PartyLegalEntity CompanyID');

        document.querySelector('[name="supplierAddress"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PostalAddress cbc\\:StreetName, PostalAddress StreetName');
        document.querySelector('[name="supplierCity"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PostalAddress cbc\\:CityName, PostalAddress CityName');
        document.querySelector('[name="supplierCountrySubentity"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PostalAddress cbc\\:CountrySubentity, PostalAddress CountrySubentity');
        document.querySelector('[name="supplierCountry"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:PostalAddress cac\\:Country cbc\\:IdentificationCode, Country IdentificationCode');
            
        document.querySelector('[name="supplierPhone"]').value = 
            getXMLValue(supplierParty, 'cac\\:Party cac\\:Contact cbc\\:Telephone, Contact Telephone');
    }

    const customerParty = xmlDoc.querySelector('cac\\:AccountingCustomerParty, AccountingCustomerParty');
    if (customerParty) {
        document.querySelector('[name="customerName"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PartyLegalEntity cbc\\:RegistrationName, PartyLegalEntity RegistrationName');
        
        document.querySelector('[name="customerVAT"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PartyTaxScheme cbc\\:CompanyID, PartyTaxScheme CompanyID');
        
        document.querySelector('[name="customerCompanyId"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PartyLegalEntity cbc\\:CompanyID, PartyLegalEntity CompanyID');

        document.querySelector('[name="customerAddress"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PostalAddress cbc\\:StreetName, PostalAddress StreetName');
        document.querySelector('[name="customerCity"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PostalAddress cbc\\:CityName, PostalAddress CityName');
        document.querySelector('[name="customerCountrySubentity"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PostalAddress cbc\\:CountrySubentity, PostalAddress CountrySubentity');
        document.querySelector('[name="customerCountry"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:PostalAddress cac\\:Country cbc\\:IdentificationCode, Country IdentificationCode');
        
        document.querySelector('[name="customerPhone"]').value = 
            getXMLValue(customerParty, 'cac\\:Party cac\\:Contact cbc\\:Telephone, Contact Telephone');
    }
}

function populateAllowanceCharges(xmlDoc) {
    const charges = parseAllowanceCharges(xmlDoc);
    displayAllowanceCharges(charges);
    
    charges.forEach((_, index) => {
        addChargeVatTypeChangeListener(index);
    });
}

function populateLineItems(xmlDoc) {
    const lineItems = xmlDoc.querySelectorAll('cac\\:InvoiceLine, InvoiceLine');
    const lineItemsContainer = document.getElementById('lineItems');
    lineItemsContainer.innerHTML = '<h2 class="section-title">Articole Factură <button type="button" class="button button-small" onclick="addLineItem()">Adaugă Articol</button></h2>';

    lineItems.forEach((item, index) => {
        const quantity = getXMLValue(item, 'cbc\\:InvoicedQuantity, InvoicedQuantity', '0');
        const unitCode = item.querySelector('cbc\\:InvoicedQuantity, InvoicedQuantity')?.getAttribute('unitCode') || 'EA';
        const price = getXMLValue(item, 'cac\\:Price cbc\\:PriceAmount, PriceAmount', '0');
        const description = getXMLValue(item, 'cac\\:Item cbc\\:Name, Name', '');
        const itemDescription = getXMLValue(item, 'cac\\:Item cbc\\:Description, Description', '');
        const vatRate = getXMLValue(item, 'cac\\:Item cac\\:ClassifiedTaxCategory cbc\\:Percent, Percent', '19');
        const vatTypeId = getXMLValue(item, 'cac\\:Item cac\\:ClassifiedTaxCategory cbc\\:ID, ID', 'S');
        
        const sellersItemIdentification = getXMLValue(item.querySelector('cac\\:Item, Item'), 'cac\\:SellersItemIdentification cbc\\:ID, SellersItemIdentification ID', '');
        
        const standardItemElement = item.querySelector('cac\\:Item cac\\:StandardItemIdentification cbc\\:ID, StandardItemIdentification ID');
        const standardItemId = standardItemElement ? standardItemElement.textContent : '';
        const standardItemSchemeId = standardItemElement ? standardItemElement.getAttribute('schemeID') || '0160' : '0160';
        
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

function setupAllowanceChargeListeners(index) {
    const chargeAmountInput = document.querySelector(`[name="chargeAmount${index}"]`);
    const chargeTypeInput = document.querySelector(`[name="chargeType${index}"]`);
    const chargeVatTypeInput = document.querySelector(`[name="chargeVatType${index}"]`);
    const chargeVatRateInput = document.querySelector(`[name="chargeVatRate${index}"]`);
    
    // Add change listeners to all inputs
    [chargeAmountInput, chargeTypeInput, chargeVatTypeInput, chargeVatRateInput].forEach(input => {
        if (input) {
            input.addEventListener('change', () => {
                manuallyEditedVatRows.clear();
                refreshTotals();
            });
        }
    });
    
    // Special handling for VAT type changes
    if (chargeVatTypeInput) {
        chargeVatTypeInput.addEventListener('change', () => handleChargeVatTypeChange(index));
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
    container.innerHTML = '<h2 class="section-title">Reduceri și Taxe Suplimentare <button type="button" class="button button-small" onclick="addAllowanceCharge()">Adaugă Reducere/Taxă</button></h2>';

    charges.forEach((charge, index) => {
        const html = createAllowanceChargeHTML(index, charge);
        container.insertAdjacentHTML('beforeend', html);
    });
}

function addAllowanceCharge() {
    const container = document.getElementById('allowanceCharges');
    const index = document.querySelectorAll('.allowance-charge').length;
    
    // Create new charge with default values
    const newCharge = {
        isCharge: true,
        reasonCode: 'TV',
        reason: 'Transport',
        amount: 0,
        vatRate: 19.0,
        vatTypeId: 'S'
    };
    
    // Add the HTML
    const html = createAllowanceChargeHTML(index, newCharge);
    container.insertAdjacentHTML('beforeend', html);
    
    // Setup event listeners
    setupAllowanceChargeListeners(index);
    
    // Force refresh of totals and VAT
    refreshTotals();
}

function removeAllowanceCharge(index) {
    const charge = document.querySelector(`.allowance-charge[data-index="${index}"]`);
    if (charge) {
        // Remove the element
        charge.remove();
        
        // Renumber remaining charges
        renumberAllowanceCharges();
        
        // Clear manual edits and refresh totals
        manuallyEditedVatRows.clear();
        refreshTotals();
    }
}

function renumberAllowanceCharges() {
    document.querySelectorAll('.allowance-charge').forEach((charge, newIndex) => {
        // Update data-index
        charge.dataset.index = newIndex;
        
        // Update all input names
        charge.querySelectorAll('input, select').forEach(input => {
            const name = input.getAttribute('name');
            if (name) {
                const baseName = name.replace(/\d+$/, '');
                input.setAttribute('name', baseName + newIndex);
            }
        });
    });
}


function addLineItem() {
    const container = document.getElementById('lineItems');
    const index = document.querySelectorAll('.line-item').length;
    const lineItemHtml = createLineItemHTML(index, '', '1', '0', '19', 'EA', 'S');
    container.insertAdjacentHTML('beforeend', lineItemHtml);
    
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
        alert('Vă rugăm să încărcați mai întâi o factură');
        return;
    }

    document.querySelectorAll('.line-item').forEach((item, index) => {
        const quantityInput = document.querySelector(`[name="quantity${index}"]`);
        const currentValue = parseFloat(quantityInput.value);
        quantityInput.value = -currentValue;
    });

    document.querySelectorAll('.allowance-charge').forEach((item, index) => {
        const amountInput = document.querySelector(`[name="chargeAmount${index}"]`);
        const currentAmount = parseFloat(amountInput.value);
        amountInput.value = -currentAmount;
    });

    document.querySelectorAll('.vat-row').forEach(row => {
        const baseInput = row.querySelector('.vat-base');
        const amountInput = row.querySelector('.vat-amount');
        
        if (baseInput) {
            const currentBase = parseFloat(baseInput.value) || 0;
            baseInput.value = (-currentBase).toFixed(2);
        }
        
        if (amountInput) {
            const currentAmount = parseFloat(amountInput.value) || 0;
            amountInput.value = (-currentAmount).toFixed(2);
        }
    });

    manuallyEditedVatRows.clear();
    refreshTotals();
    
    if (currentInvoice) {
        updateTaxTotals(currentInvoice);
    }
}

function updateTotals() {
    const totals = calculateTotals();
    const { vatBreakdown, totalVat } = calculateVATBreakdown();

    document.getElementById('subtotal').textContent = totals.subtotal.toFixed(2);
    document.getElementById('totalAllowances').textContent = totals.allowances.toFixed(2);
    document.getElementById('totalCharges').textContent = totals.charges.toFixed(2);
    document.getElementById('netAmount').textContent = totals.netAmount.toFixed(2);
    document.getElementById('vat').textContent = totalVat.toFixed(2);
    document.getElementById('total').textContent = (totals.netAmount + totalVat).toFixed(2);

    displayVATBreakdown();
}

function refreshTotals() {
    // Calculate base totals
    const lineItemTotals = calculateLineItemTotals();
    const chargeTotals = calculateChargeTotals();

    const subtotal = lineItemTotals.subtotal;
    const allowances = chargeTotals.allowances;
    const charges = chargeTotals.charges;
    const netAmount = subtotal - allowances + charges;

    // Update display
    document.getElementById('subtotal').textContent = subtotal.toFixed(2);
    document.getElementById('totalAllowances').textContent = allowances.toFixed(2);
    document.getElementById('totalCharges').textContent = charges.toFixed(2);
    document.getElementById('netAmount').textContent = netAmount.toFixed(2);

    // Do not clear manual edits, preserve them
    displayVATBreakdown();
    
    // Calculate total VAT from the actual displayed rows, including manual edits
    let totalVat = 0;
    document.querySelectorAll('.vat-row').forEach(row => {
        const vatAmount = parseFloat(row.querySelector('.vat-amount').value) || 0;
        totalVat += vatAmount;
    });
    
    // Update final totals
    document.getElementById('vat').textContent = roundNumber(totalVat).toFixed(2);
    document.getElementById('total').textContent = roundNumber(netAmount + totalVat).toFixed(2);
}

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

function calculateVATBreakdown() {
    let vatBreakdown = new Map();
    let totalVat = 0;

    // Process line items first
    document.querySelectorAll('.line-item').forEach((item, index) => {
        const quantity = parseFloat(document.querySelector(`[name="quantity${index}"]`).value) || 0;
        const price = parseFloat(document.querySelector(`[name="price${index}"]`).value) || 0;
        const vatType = document.querySelector(`[name="vatType${index}"]`).value;
        const vatRate = parseFloat(document.querySelector(`[name="vatRate${index}"]`).value) || 0;
        
        const lineAmount = quantity * price;
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
        entry.baseAmount += lineAmount;
        if (vatType === 'S') {
            entry.vatAmount += lineAmount * vatRate / 100;
        }
    });

    // Then process allowances and charges
    document.querySelectorAll('.allowance-charge').forEach((charge, index) => {
        const amount = parseFloat(document.querySelector(`[name="chargeAmount${index}"]`).value) || 0;
        const vatType = document.querySelector(`[name="chargeVatType${index}"]`).value;
        const vatRate = parseFloat(document.querySelector(`[name="chargeVatRate${index}"]`).value) || 0;
        const isCharge = document.querySelector(`[name="chargeType${index}"]`).value === 'true';
        
        // Skip if amount is 0
        if (amount === 0) return;

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
        entry.baseAmount += amount;
        if (vatType === 'S') {
            entry.vatAmount += amount * vatRate / 100;
        }
    });

    // Calculate total VAT
    vatBreakdown.forEach(entry => {
        totalVat += entry.vatAmount;
    });

    return { vatBreakdown, totalVat: roundNumber(totalVat) };
}

window.updateVATRow = function(rowId, source) {
    const row = document.getElementById(rowId);
    if (!row) return;

    const typeSelect = row.querySelector('.vat-type');
    const rateInput = row.querySelector('.vat-rate');
    const baseInput = row.querySelector('.vat-base');
    const amountInput = row.querySelector('.vat-amount');
    
    if (source === 'manual') {
        manuallyEditedVatRows.add(rowId);
    }
    
    if (!manuallyEditedVatRows.has(rowId) || source === 'manual') {
        const type = typeSelect.value;
        const rate = parseFloat(rateInput.value) || 0;
        const base = parseFloat(baseInput.value) || 0;
        
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
    addVATBreakdownRow(19, 0, 0);
    refreshTotals();
};

function updateTotalVAT() {
    const totalVat = Array.from(document.querySelectorAll('.vat-amount'))
        .reduce((sum, input) => sum + (parseFloat(input.value) || 0), 0);
    
    document.getElementById('vat').textContent = totalVat.toFixed(2);
    
    const netAmount = parseFloat(document.getElementById('netAmount').textContent) || 0;
    const total = netAmount + totalVat;
    document.getElementById('total').textContent = total.toFixed(2);
}

function displayVATBreakdown() {
    const container = document.getElementById('vatBreakdownRows');
    if (!container) return;

    // Calculate current VAT breakdown
    const { vatBreakdown } = calculateVATBreakdown();
    
    // Store existing manually edited values before clearing the container
    const existingValues = new Map();
    manuallyEditedVatRows.forEach(rowId => {
        const row = document.getElementById(rowId);
        if (row) {
            existingValues.set(rowId, {
                rate: parseFloat(row.querySelector('.vat-rate').value),
                base: parseFloat(row.querySelector('.vat-base').value),
                amount: parseFloat(row.querySelector('.vat-amount').value),
                type: row.querySelector('.vat-type').value
            });
        }
    });
    
    // Clear container
    container.innerHTML = '';
    
    // First restore manually edited rows with their original values
    existingValues.forEach((values, rowId) => {
        addVATBreakdownRow(
            values.rate,
            values.base,
            values.amount,
            values.type,
            rowId
        );
    });
    
    // Then add any new VAT breakdown rows that don't correspond to manual edits
    vatBreakdown.forEach((data, key) => {
        // Check if this rate/type combination already exists in manual edits
        const exists = Array.from(existingValues.values()).some(values => 
            values.rate === data.rate && values.type === data.type
        );
        
        if (!exists) {
            addVATBreakdownRow(
                data.rate,
                roundNumber(data.baseAmount),
                roundNumber(data.vatAmount),
                data.type
            );
        }
    });
    
    updateTotalVAT();
}

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
        handleError(error, 'Eroare la salvarea fișierului XML');
    }
}

function updateBasicDetails(xmlDoc) {
    setXMLValue(xmlDoc, 'cbc\\:ID, ID', document.querySelector('[name="invoiceNumber"]').value);
    
    const issueDateValue = document.querySelector('[name="issueDate"]').value;
    const dueDateValue = document.querySelector('[name="dueDate"]').value;
    
    setXMLValue(xmlDoc, 'cbc\\:IssueDate, IssueDate', parseRomanianDate(issueDateValue));
    setXMLValue(xmlDoc, 'cbc\\:DueDate, DueDate', parseRomanianDate(dueDateValue));
}

function updatePartyDetails(xmlDoc) {
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

function updateAllowanceCharges(xmlDoc) {
    const currencyID = xmlDoc.querySelector('cbc\\:DocumentCurrencyCode, DocumentCurrencyCode').textContent;
    
    const existingCharges = xmlDoc.querySelectorAll('cac\\:AllowanceCharge, AllowanceCharge');
    existingCharges.forEach(charge => charge.remove());
    
    const charges = getAllowanceCharges();
    const taxTotalNode = xmlDoc.querySelector('cac\\:TaxTotal, TaxTotal');
    
    charges.forEach(charge => {
        const allowanceCharge = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:AllowanceCharge");
        
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
        
        allowanceCharge.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Amount", 
            charge.amount.toFixed(2), { currencyID }));
        
        const taxCategory = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxCategory");
        taxCategory.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", charge.vatTypeId));
        
        const vatPercent = charge.vatTypeId === 'AE' ? '0.00' : charge.vatRate.toString();
        taxCategory.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Percent", vatPercent));
        
        const taxScheme = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxScheme");
        taxScheme.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", "VAT"));
        taxCategory.appendChild(taxScheme);
        
        allowanceCharge.appendChild(taxCategory);
        
        if (taxTotalNode) {
            xmlDoc.documentElement.insertBefore(allowanceCharge, taxTotalNode);
        } else {
            xmlDoc.documentElement.appendChild(allowanceCharge);
        }
    });
}

function updateLineItems(xmlDoc) {
    const currencyID = xmlDoc.querySelector('cbc\\:DocumentCurrencyCode, DocumentCurrencyCode').textContent;
    
    const existingLines = xmlDoc.querySelectorAll('cac\\:InvoiceLine, InvoiceLine');
    existingLines.forEach(line => line.remove());
    
    document.querySelectorAll('.line-item').forEach((item, index) => {
        const invoiceLine = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:InvoiceLine");
        
        const quantity = document.querySelector(`[name="quantity${index}"]`).value;
        const unitCode = document.querySelector(`[name="unit${index}"]`).value;
        const price = document.querySelector(`[name="price${index}"]`).value;
        const description = document.querySelector(`[name="description${index}"]`).value;
        const itemDescription = document.querySelector(`[name="itemDescription${index}"]`).value;
        const vatType = document.querySelector(`[name="vatType${index}"]`).value;
        const vatRate = vatType === 'AE' ? '0.00' : document.querySelector(`[name="vatRate${index}"]`).value;
        const lineAmount = roundNumber(parseFloat(quantity) * parseFloat(price));

        invoiceLine.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", (index + 1).toString()));
        
        const quantityElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:InvoicedQuantity", quantity.toString());
        quantityElement.setAttribute('unitCode', unitCode);
        invoiceLine.appendChild(quantityElement);
        
        invoiceLine.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:LineExtensionAmount", 
            lineAmount.toFixed(2), { currencyID }));

        const itemElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:Item");

        if (itemDescription) {
            itemElement.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Description", itemDescription));
        }

        itemElement.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Name", description));

        const sellersItemIdentification = document.querySelector(`[name="sellersItemIdentification${index}"]`).value;
        if (sellersItemIdentification) {
            const sellersItemElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:SellersItemIdentification");
            sellersItemElement.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", sellersItemIdentification));
            itemElement.appendChild(sellersItemElement);
        }

        const standardItemId = document.querySelector(`[name="standardItemId${index}"]`).value;
        if (standardItemId) {
            const standardItemElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:StandardItemIdentification");
            const standardIdElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", standardItemId);
            standardIdElement.setAttribute('schemeID', 
                document.querySelector(`[name="standardItemSchemeId${index}"]`).value || '0160');
            standardItemElement.appendChild(standardIdElement);
            itemElement.appendChild(standardItemElement);
        }

        const commodityCode = document.querySelector(`[name="commodityCode${index}"]`).value;
        if (commodityCode) {
            const commodityElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:CommodityClassification");
            const classificationElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ItemClassificationCode", commodityCode);
            classificationElement.setAttribute('listID', 
                document.querySelector(`[name="commodityListId${index}"]`).value || 'CV');
            commodityElement.appendChild(classificationElement);
            itemElement.appendChild(commodityElement);
        }

        const taxCategory = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:ClassifiedTaxCategory");
        taxCategory.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", vatType));
        taxCategory.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Percent", vatRate));
        
        const taxScheme = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxScheme");
        taxScheme.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", "VAT"));
        taxCategory.appendChild(taxScheme);
        itemElement.appendChild(taxCategory);

        invoiceLine.appendChild(itemElement);

        const priceElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:Price");
        priceElement.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:PriceAmount", 
            price.toString(), { currencyID }));
        invoiceLine.appendChild(priceElement);

        xmlDoc.documentElement.appendChild(invoiceLine);
    });
}

function updateTaxTotals(xmlDoc) {
    const currencyID = xmlDoc.querySelector('cbc\\:DocumentCurrencyCode, DocumentCurrencyCode').textContent;
    
    const { vatBreakdown, totalVat } = calculateVATBreakdown();
    
    let taxTotal = xmlDoc.querySelector('cac\\:TaxTotal, TaxTotal');
    if (!taxTotal) {
        taxTotal = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxTotal");
        xmlDoc.documentElement.appendChild(taxTotal);
    } else {
        while (taxTotal.firstChild) {
            taxTotal.removeChild(taxTotal.firstChild);
        }
    }

    const uiTotalVat = parseFloat(document.getElementById('vat').textContent);
    taxTotal.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:TaxAmount", 
        uiTotalVat.toFixed(2), { currencyID }));

    const vatRows = document.querySelectorAll('.vat-row');
    vatRows.forEach(row => {
        const taxSubtotal = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxSubtotal");
        
        const baseAmount = parseFloat(row.querySelector('.vat-base').value) || 0;
        const vatAmount = parseFloat(row.querySelector('.vat-amount').value) || 0;
        const vatType = row.querySelector('.vat-type').value;
        const vatRate = parseFloat(row.querySelector('.vat-rate').value) || 0;

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
        while (monetaryTotal.firstChild) {
            monetaryTotal.removeChild(monetaryTotal.firstChild);
        }
    }

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
        console.warn(`Eroare la obținerea valorii pentru selectorul ${selector}:`, error);
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
        console.warn(`Eroare la setarea valorii pentru selectorul ${selector}:`, error);
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
    const tab = '  ';
    
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
    
    if (!xmlString.startsWith('<?xml')) {
        xmlString = '<?xml version="1.0" encoding="UTF-8"?>\n' + xmlString;
    }

    xmlString = formatXML(xmlString);

    const blob = new Blob([xmlString], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'factura_' + document.querySelector('[name="invoiceNumber"]').value + '.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function roundNumber(number, decimals = 2) {
    return Math.round(number * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// Export for testing if needed
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