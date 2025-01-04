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
    
    if (!currentInvoice) {
        currentInvoice = createEmptyInvoice();
    }

    const totalElements = [
        'subtotal', 'totalAllowances', 'totalCharges', 
        'netAmount', 'vat', 'total'
    ];
    
    totalElements.forEach(elementId => {
        const element = document.getElementById(elementId);
        setupInlineEditing(element);
    });

    // Add currency code validation
    const currencyInputs = document.querySelectorAll('[name="documentCurrencyCode"], [name="taxCurrencyCode"]');
    currencyInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            // Convert to uppercase
            this.value = this.value.toUpperCase();
            // Remove any non-letter characters
            this.value = this.value.replace(/[^A-Z]/g, '');
            // Limit to 3 characters
            if (this.value.length > 3) {
                this.value = this.value.slice(0, 3);
            }
        });
    });
    
    // Make document currency code required
    const documentCurrencyInput = document.querySelector('[name="documentCurrencyCode"]');
    if (documentCurrencyInput) {
        documentCurrencyInput.required = true;
    }    

    addExchangeRateField();
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


    // Validate exchange rate if tax currency is present
    const taxCurrencyCode = document.querySelector('[name="taxCurrencyCode"]').value.trim();
    const documentCurrencyCode = document.querySelector('[name="documentCurrencyCode"]').value.trim();
    
    if (taxCurrencyCode && taxCurrencyCode !== documentCurrencyCode) {
        const exchangeRate = document.querySelector('[name="exchangeRate"]');
        if (!exchangeRate || !exchangeRate.value || parseFloat(exchangeRate.value) <= 0) {
            exchangeRate.classList.add('invalid');
            isValid = false;
            if (!firstInvalidField) {
                firstInvalidField = exchangeRate;
            }
        } else {
            exchangeRate.classList.remove('invalid');
        }
    }

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

    // Add note counter event listener
    const noteInput = document.querySelector('[name="invoiceNote"]');
    if (noteInput) {
        noteInput.addEventListener('input', updateNoteCounter);
        updateNoteCounter(); // Initial count
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

function updateNoteCounter() {
    const noteInput = document.querySelector('[name="invoiceNote"]');
    const counter = document.querySelector('.note-counter');
    if (noteInput && counter) {
        const length = noteInput.value.length;
        counter.textContent = `${length}/900 caractere`;
    }
}

function splitNoteIntoChunks(text, maxLength) {
    if (!text) return [];
    const chunks = [];
    let remainingText = text;

    while (remainingText.length > 0) {
        if (remainingText.length <= maxLength) {
            chunks.push(remainingText);
            break;
        }

        let splitPoint = remainingText.substr(0, maxLength).lastIndexOf('\n');
        if (splitPoint === -1) {
            splitPoint = remainingText.substr(0, maxLength).lastIndexOf(' ');
        }
        if (splitPoint === -1) splitPoint = maxLength;

        chunks.push(remainingText.substr(0, splitPoint));
        remainingText = remainingText.substr(splitPoint + 1);
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
}

function populateBasicDetails(xmlDoc) {
    document.querySelector('[name="invoiceNumber"]').value = getXMLValue(xmlDoc, 'cbc\\:ID, ID');

    // Get and combine all Note elements
    const notes = xmlDoc.querySelectorAll('cbc\\:Note, Note');
    const combinedNotes = Array.from(notes).map(note => note.textContent).join('\n');
    document.querySelector('[name="invoiceNote"]').value = combinedNotes;
    updateNoteCounter();

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

    // Add currency code handling
    const documentCurrencyCode = getXMLValue(xmlDoc, 'cbc\\:DocumentCurrencyCode, DocumentCurrencyCode', 'RON');
    const taxCurrencyCode = getXMLValue(xmlDoc, 'cbc\\:TaxCurrencyCode, TaxCurrencyCode', '');
    
    document.querySelector('[name="documentCurrencyCode"]').value = documentCurrencyCode;
    document.querySelector('[name="taxCurrencyCode"]').value = taxCurrencyCode;
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

function createEmptyInvoice() {
    const parser = new DOMParser();
    const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
    <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
    <cbc:ID></cbc:ID>
    <cbc:IssueDate></cbc:IssueDate>
    <cbc:DueDate></cbc:DueDate>
    <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
    <cbc:DocumentCurrencyCode>RON</cbc:DocumentCurrencyCode>
    <cac:AccountingSupplierParty>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name></cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName></cbc:StreetName>
                <cbc:CityName></cbc:CityName>
                <cbc:CountrySubentity></cbc:CountrySubentity>
                <cac:Country>
                    <cbc:IdentificationCode>RO</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID>RO</cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName></cbc:RegistrationName>
                <cbc:CompanyID></cbc:CompanyID>
            </cac:PartyLegalEntity>
            <cac:Contact>
                <cbc:Telephone></cbc:Telephone>
            </cac:Contact>
        </cac:Party>
    </cac:AccountingSupplierParty>
    <cac:AccountingCustomerParty>
        <cac:Party>
            <cac:PartyName>
                <cbc:Name></cbc:Name>
            </cac:PartyName>
            <cac:PostalAddress>
                <cbc:StreetName></cbc:StreetName>
                <cbc:CityName></cbc:CityName>
                <cbc:CountrySubentity></cbc:CountrySubentity>
                <cac:Country>
                    <cbc:IdentificationCode>RO</cbc:IdentificationCode>
                </cac:Country>
            </cac:PostalAddress>
            <cac:PartyTaxScheme>
                <cbc:CompanyID></cbc:CompanyID>
                <cac:TaxScheme>
                    <cbc:ID>VAT</cbc:ID>
                </cac:TaxScheme>
            </cac:PartyTaxScheme>
            <cac:PartyLegalEntity>
                <cbc:RegistrationName></cbc:RegistrationName>
                <cbc:CompanyID></cbc:CompanyID>
            </cac:PartyLegalEntity>
            <cac:Contact>
                <cbc:Telephone></cbc:Telephone>
            </cac:Contact>
        </cac:Party>
    </cac:AccountingCustomerParty>
</Invoice>`;
    return parser.parseFromString(xmlString, "text/xml");
}

function saveXML() {
    if (!validateForm()) return;

    try {
        if (!currentInvoice) {
            currentInvoice = createEmptyInvoice();
        }

        const xmlDoc = currentInvoice;
        
        // Update all the data
        updateBasicDetails(xmlDoc);
        updatePartyDetails(xmlDoc);
        updateAllowanceCharges(xmlDoc);
        
        // Remove existing TaxTotal and LegalMonetaryTotal elements
        const existingTaxTotals = xmlDoc.querySelectorAll('cac\\:TaxTotal, TaxTotal');
        existingTaxTotals.forEach(el => el.remove());
        
        const existingMonetaryTotal = xmlDoc.querySelector('cac\\:LegalMonetaryTotal, LegalMonetaryTotal');
        if (existingMonetaryTotal) {
            existingMonetaryTotal.remove();
        }
        
        // Remove existing InvoiceLine elements
        const existingLines = xmlDoc.querySelectorAll('cac\\:InvoiceLine, InvoiceLine');
        existingLines.forEach(el => el.remove());
        
        // Add elements in the correct order
        updateTaxTotals(xmlDoc);
        updateMonetaryTotals(xmlDoc);
        updateLineItems(xmlDoc);
        
        downloadXML(xmlDoc);
    } catch (error) {
        handleError(error, 'Eroare la salvarea fișierului XML');
    }
}

function updateBasicDetails(xmlDoc) {
    setXMLValue(xmlDoc, 'cbc\\:ID, ID', document.querySelector('[name="invoiceNumber"]').value);
    
    // Remove existing Note elements
    const existingNotes = xmlDoc.querySelectorAll('cbc\\:Note, Note');
    existingNotes.forEach(note => note.remove());

    // Split note text and create new Note elements
    const noteText = document.querySelector('[name="invoiceNote"]').value;
    if (noteText) {
        const insertAfter = xmlDoc.querySelector('cbc\\:InvoiceTypeCode, InvoiceTypeCode');
        const chunks = splitNoteIntoChunks(noteText, 300);
        chunks.forEach(chunk => {
            const noteElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Note", chunk);
            if (insertAfter && insertAfter.parentNode) {
                insertAfter.parentNode.insertBefore(noteElement, insertAfter.nextSibling);
            }
        });
    }

    const issueDateValue = document.querySelector('[name="issueDate"]').value;
    const dueDateValue = document.querySelector('[name="dueDate"]').value;
    
    setXMLValue(xmlDoc, 'cbc\\:IssueDate, IssueDate', parseRomanianDate(issueDateValue));
    setXMLValue(xmlDoc, 'cbc\\:DueDate, DueDate', parseRomanianDate(dueDateValue));

   // Update currency codes
   const documentCurrencyCode = document.querySelector('[name="documentCurrencyCode"]').value.toUpperCase() || 'RON';
   setXMLValue(xmlDoc, 'cbc\\:DocumentCurrencyCode, DocumentCurrencyCode', documentCurrencyCode);
   
   const taxCurrencyCode = document.querySelector('[name="taxCurrencyCode"]').value.toUpperCase();
   if (taxCurrencyCode) {
       let taxCurrencyElement = xmlDoc.querySelector('cbc\\:TaxCurrencyCode, TaxCurrencyCode');
       if (!taxCurrencyElement) {
           taxCurrencyElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:TaxCurrencyCode");
           const insertAfter = xmlDoc.querySelector('cbc\\:DocumentCurrencyCode, DocumentCurrencyCode');
           if (insertAfter && insertAfter.parentNode) {
               insertAfter.parentNode.insertBefore(taxCurrencyElement, insertAfter.nextSibling);
           }
       }
       taxCurrencyElement.textContent = taxCurrencyCode;
   } else {
       // Remove TaxCurrencyCode if it exists and is empty
       const taxCurrencyElement = xmlDoc.querySelector('cbc\\:TaxCurrencyCode, TaxCurrencyCode');
       if (taxCurrencyElement) {
           taxCurrencyElement.parentNode.removeChild(taxCurrencyElement);
       }
   }    
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
    const currencyID = document.querySelector('[name="documentCurrencyCode"]').value.toUpperCase() || 'RON';
    const taxCurrencyCode = document.querySelector('[name="taxCurrencyCode"]').value.toUpperCase();
    
    // Remove existing TaxTotal elements
    const existingTaxTotals = xmlDoc.querySelectorAll('cac\\:TaxTotal, TaxTotal');
    existingTaxTotals.forEach(element => element.parentNode.removeChild(element));

    // Create main TaxTotal for document currency
    const taxTotal = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxTotal");
    
    const uiTotalVat = parseFloat(document.getElementById('vat').textContent);
    const taxAmountElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:TaxAmount", 
        uiTotalVat.toFixed(2), { currencyID });
    taxTotal.appendChild(taxAmountElement);

    // Add TaxSubtotal elements to the main TaxTotal
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

    // Find the correct insertion point - after AllowanceCharge elements
    let insertionPoint = xmlDoc.querySelector('cac\\:AllowanceCharge, AllowanceCharge');
    if (insertionPoint) {
        // Find the last AllowanceCharge
        while (insertionPoint.nextElementSibling && 
               (insertionPoint.nextElementSibling.localName === 'AllowanceCharge' ||
                insertionPoint.nextElementSibling.localName === 'TaxTotal')) {
            insertionPoint = insertionPoint.nextElementSibling;
        }
        insertionPoint.parentNode.insertBefore(taxTotal, insertionPoint.nextSibling);
    } else {
        // If no AllowanceCharge, insert before LegalMonetaryTotal
        const monetaryTotal = xmlDoc.querySelector('cac\\:LegalMonetaryTotal, LegalMonetaryTotal');
        if (monetaryTotal) {
            monetaryTotal.parentNode.insertBefore(taxTotal, monetaryTotal);
        } else {
            xmlDoc.documentElement.appendChild(taxTotal);
        }
    }

    // If tax currency is specified, add another TaxTotal element
    if (taxCurrencyCode) {
        const taxCurrencyTotal = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxTotal");
        
        const exchangeRateInput = document.querySelector('[name="exchangeRate"]');
        const exchangeRate = exchangeRateInput ? parseFloat(exchangeRateInput.value) || 1 : 1;
        const taxCurrencyVAT = uiTotalVat * exchangeRate;

        const taxCurrencyAmountElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:TaxAmount",
            taxCurrencyVAT.toFixed(2), { currencyID: taxCurrencyCode });
        taxCurrencyTotal.appendChild(taxCurrencyAmountElement);
        
        // Insert after the main TaxTotal
        taxTotal.parentNode.insertBefore(taxCurrencyTotal, taxTotal.nextSibling);
    }
}



function updateMonetaryTotals(xmlDoc) {
    const currencyID = document.querySelector('[name="documentCurrencyCode"]').value.toUpperCase() || 'RON';

    const subtotal = parseFloat(document.getElementById('subtotal').textContent) || 0;
    const allowances = parseFloat(document.getElementById('totalAllowances').textContent) || 0;
    const charges = parseFloat(document.getElementById('totalCharges').textContent) || 0;
    const netAmount = parseFloat(document.getElementById('netAmount').textContent) || 0;
    const totalVat = parseFloat(document.getElementById('vat').textContent) || 0;
    const total = parseFloat(document.getElementById('total').textContent) || 0;

    // Remove existing LegalMonetaryTotal if present
    const existingMonetaryTotal = xmlDoc.querySelector('cac\\:LegalMonetaryTotal, LegalMonetaryTotal');
    if (existingMonetaryTotal) {
        existingMonetaryTotal.parentNode.removeChild(existingMonetaryTotal);
    }

    // Create new LegalMonetaryTotal
    const monetaryTotal = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:LegalMonetaryTotal");

    // Add all required monetary amounts
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

    // Find the correct insertion point - after last TaxTotal
    let insertionPoint = xmlDoc.querySelector('cac\\:TaxTotal, TaxTotal');
    if (insertionPoint) {
        // Find the last TaxTotal
        while (insertionPoint.nextElementSibling && 
               insertionPoint.nextElementSibling.localName === 'TaxTotal') {
            insertionPoint = insertionPoint.nextElementSibling;
        }
        insertionPoint.parentNode.insertBefore(monetaryTotal, insertionPoint.nextSibling);
    } else {
        // If no TaxTotal, insert before first InvoiceLine
        const firstInvoiceLine = xmlDoc.querySelector('cac\\:InvoiceLine, InvoiceLine');
        if (firstInvoiceLine) {
            firstInvoiceLine.parentNode.insertBefore(monetaryTotal, firstInvoiceLine);
        } else {
            xmlDoc.documentElement.appendChild(monetaryTotal);
        }
    }
}

function getExchangeRate(fromCurrency, toCurrency) {
    // For now, return 1 as default exchange rate
    // TODO: Implement proper exchange rate handling
    return 1;
}

// Update the invoice form to include exchange rate when tax currency is different
function addExchangeRateField() {
    const taxCurrencyInput = document.querySelector('[name="taxCurrencyCode"]');
    const documentCurrencyInput = document.querySelector('[name="documentCurrencyCode"]');
    
    function updateExchangeRateVisibility() {
        const taxCurrency = taxCurrencyInput.value.toUpperCase();
        const documentCurrency = documentCurrencyInput.value.toUpperCase();
        
        let exchangeRateContainer = document.getElementById('exchangeRateContainer');
        if (taxCurrency && taxCurrency !== documentCurrency) {
            if (!exchangeRateContainer) {
                const container = document.createElement('div');
                container.id = 'exchangeRateContainer';
                container.className = 'form-group';
                container.innerHTML = `
                    <label class="form-label">Curs Valutar ${documentCurrency}/${taxCurrency}</label>
                    <input type="number" class="form-input" name="exchangeRate" 
                           step="0.0001" min="0" value="1" 
                           onchange="refreshTotals()">
                `;
                taxCurrencyInput.parentNode.after(container);
            } else {
                // Update label if currencies changed
                const label = exchangeRateContainer.querySelector('label');
                label.textContent = `Curs Valutar ${documentCurrency}/${taxCurrency}`;
            }
        } else if (exchangeRateContainer) {
            exchangeRateContainer.remove();
        }
    }

    taxCurrencyInput.addEventListener('input', updateExchangeRateVisibility);
    documentCurrencyInput.addEventListener('input', updateExchangeRateVisibility);
    
    // Initial check
    updateExchangeRateVisibility();
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

// Currency formatter utility
class InvoiceFormatter {
    constructor() {
        this.locale = navigator.language || 'en-US';
        
        this.currencyFormatter = new Intl.NumberFormat(this.locale, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
        });
        
        this.quantityFormatter = new Intl.NumberFormat(this.locale, {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3,
            useGrouping: true
        });

        this.numberFormatter = new Intl.NumberFormat(this.locale, {
            minimumFractionDigits: 4,
            maximumFractionDigits: 4,
            useGrouping: true
        });
    }

    formatCurrency(value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return '0.00';
        return this.currencyFormatter.format(numValue);
    }

    formatQuantity(value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return '0.000';
        return this.quantityFormatter.format(numValue);
    }

    formatNumber(value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) return '0.0000';
        return this.numberFormatter.format(numValue);
    }
}

// Print handler class
class InvoicePrintHandler {
    constructor() {
        this.printWindow = null;
        this.formatter = new InvoiceFormatter();
    }

    getPrintTemplate() {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Factură</title>
                <style>
                    @media print {
                        @page {
                            size: A4;
                            margin: 1cm;
                        }
                        
                        body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }

                        .no-print {
                            display: none;
                        }

                        .show-in-print {
                            display: flex !important;
                        }
                    }

                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }

                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        line-height: 1.5;
                        color: #1e293b;
                        background: white;
                        font-size: 12px;
                    }

                    .invoice-container {
                        max-width: 210mm;
                        margin: 0 auto;
                        padding: 2cm;
                        background: white;
                    }

                    .invoice-header {
                        margin-bottom: 2rem;
                        padding-bottom: 1rem;
                        border-bottom: 2px solid #2563eb;
                    }

                    .invoice-header-content {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                    }

                    .invoice-title-section {
                        flex: 1;
                    }

                    .invoice-title {
                        color: #2563eb;
                        font-size: 24px;
                        font-weight: bold;
                        margin-bottom: 0.5rem;
                    }

                    .invoice-number {
                        font-size: 16px;
                        color: #64748b;
                        margin-bottom: 0.5rem;
                    }

                    .invoice-dates {
                        color: #64748b;
                        font-size: 14px;
                    }

                    .qr-section {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        margin-left: 2rem;
                    }

                    #qrcode {
                        width: 100px;
                        height: 100px;
                        margin-bottom: 0.5rem;
                    }

                    .e-invoice-info {
                        font-size: 10px;
                        color: #64748b;
                        text-align: center;
                        max-width: 120px;
                    }

                    .party-details {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 2rem;
                        margin-bottom: 2rem;
                    }

                    .party-box {
                        padding: 1rem;
                        background: #f8fafc;
                        border-radius: 4px;
                        border: 1px solid #e2e8f0;
                    }

                    .party-title {
                        font-weight: bold;
                        color: #2563eb;
                        margin-bottom: 0.5rem;
                    }

                    .party-info p {
                        margin: 0.25rem 0;
                    }

                    .items-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 2rem;
                    }

                    .items-table th {
                        background: #f1f5f9;
                        padding: 0.5rem;
                        text-align: left;
                        font-weight: 600;
                        border-bottom: 2px solid #e2e8f0;
                    }

                    .items-table td {
                        padding: 0.5rem;
                        border-bottom: 1px solid #e2e8f0;
                    }

                    .items-table .number-cell {
                        text-align: right;
                    }

                    .totals-container {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        gap: 2rem;
                    }

                    .currency-info {
                        flex: 1;
                        padding: 0.5rem;
                        background: #f8fafc;
                        border-radius: 4px;
                        border: 1px solid #e2e8f0;
                        font-size: 12px;
                    }
                    
                    .currency-info p {
                        margin: 0.25rem 0;
                    }

                    .currency-code {
                        font-weight: bold;
                        color: #2563eb;
                    }

                    .totals-section {
                        width: 300px;
                    }

                    .total-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 0.5rem 0;
                        border-bottom: 1px solid #e2e8f0;
                    }

                    .total-row.final {
                        border-bottom: 2px solid #2563eb;
                        font-weight: bold;
                        font-size: 14px;
                        color: #2563eb;
                    }

                    .vat-breakdown {
                        margin: 1rem 0;
                        padding: 1rem;
                        background: #f8fafc;
                        border-radius: 4px;
                    }

                    .vat-title {
                        font-weight: bold;
                        color: #64748b;
                        margin-bottom: 0.5rem;
                    }

                    .vat-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 0.5rem;
                        font-size: 11px;
                        margin-bottom: 1rem;
                    }

                    .vat-grid-header {
                        font-weight: bold;
                        color: #64748b;
                    }

                    .vat-amount-row {
                        display: flex;
                        justify-content: space-between;
                        padding: 0.5rem 0;
                        border-top: 1px solid #e2e8f0;
                    }

                    #print-vat-secondary {
                        border-top: none;
                    }

                    .footer {
                        margin-top: 2rem;
                        padding-top: 1rem;
                        border-top: 1px solid #e2e8f0;
                        font-size: 10px;
                        color: #64748b;
                        text-align: center;
                    }

                    .note-section {
                        margin: 24px 0;
                        padding: 16px;
                        background-color: #f8fafc;
                        border-radius: 4px;
                        border: 1px solid #e2e8f0;
                        max-width: 100%;
                        overflow-wrap: break-word;
                        word-wrap: break-word;
                        word-break: break-word;
                    }

                    .note-section h3 {
                        font-size: 14px;
                        color: #64748b;
                        margin-bottom: 8px;
                    }

                    .note-section div {
                        white-space: pre-wrap;
                        font-size: 13px;
                        width: 100%;
                        overflow-wrap: break-word;
                        word-wrap: break-word;
                        word-break: break-word;
                    }                    

                    .print-button {
                        position: fixed;
                        top: 20px;
                        right: 20px;
                        padding: 8px 16px;
                        background: #2563eb;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 14px;
                    }

                    .print-button:hover {
                        background: #1e40af;
                    }
                </style>
                <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
            </head>
            <body>
                <button onclick="window.print()" class="print-button no-print">Printează Factura</button>
                <div class="invoice-container">
                    <div class="invoice-header">
                        <div class="invoice-header-content">
                            <div class="invoice-title-section">
                                <h1 class="invoice-title">FACTURĂ ELECTRONICĂ</h1>
                                <div class="invoice-number">Seria & Nr: <span id="print-invoice-number"></span></div>
                                <div class="invoice-dates">
                                    <div>Data emiterii: <span id="print-issue-date"></span></div>
                                    <div>Data scadentă: <span id="print-due-date"></span></div>
                                </div>
                            </div>
                            <div class="qr-section">
                                <div id="qrcode"></div>
                                <div class="e-invoice-info">
                                    
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="party-details">
                        <div class="party-box">
                            <div class="party-title">Furnizor</div>
                            <div class="party-info" id="print-supplier-details"></div>
                        </div>
                        <div class="party-box">
                            <div class="party-title">Client</div>
                            <div class="party-info" id="print-customer-details"></div>
                        </div>
                    </div>

                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Nr.</th>
                                <th>Denumire</th>
                                <th>UM</th>
                                <th>Cant.</th>
                                <th>Preț</th>
                                <th>TVA</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody id="print-items"></tbody>
                    </table>

                    <div class="note-section" id="print-note" style="display: none;">
                        <div></div>
                    </div>                 

                    <div class="totals-container">
                        <div class="currency-info">
                            <p>Monedă Factură: <span class="currency-code" id="print-document-currency"></span></p>
                            <p id="print-tax-currency-container" style="display: none;">
                                Monedă TVA: <span class="currency-code" id="print-tax-currency"></span>
                                <br>
                                Curs valutar: <span id="print-exchange-rate"></span>
                            </p>
                        </div>

                        <div class="totals-section">
                            <div class="total-row">
                                <span>Subtotal:</span>
                                <span id="print-subtotal"></span>
                            </div>
                            <div class="total-row">
                                <span>Total Reduceri:</span>
                                <span id="print-allowances"></span>
                            </div>
                            <div class="total-row">
                                <span>Total Taxe:</span>
                                <span id="print-charges"></span>
                            </div>
                            <div class="total-row">
                                <span>Valoare Netă:</span>
                                <span id="print-net-amount"></span>
                            </div>
                            
                            <div class="vat-breakdown">
                                <div class="vat-title">Defalcare TVA</div>
                                <div class="vat-grid">
                                    <div class="vat-grid-header">Tip TVA</div>
                                    <div class="vat-grid-header">Cotă</div>
                                    <div class="vat-grid-header">Bază</div>
                                    <div class="vat-grid-header">TVA</div>
                                </div>
                                <div class="vat-grid" id="print-vat-breakdown"></div>
                                
                                <div id="print-vat-currencies" class="vat-amount-row">
                                    <span>Total TVA (<span id="print-vat-currency-main"></span>):</span>
                                    <span id="print-vat-main"></span>
                                </div>
                                <div id="print-vat-secondary" class="vat-amount-row" style="display: none;">
                                    <span>Total TVA (<span id="print-vat-currency-secondary"></span>):</span>
                                    <span id="print-vat-secondary-amount"></span>
                                </div>
                            </div>
                            
                            <div class="total-row total-row-final">
                                <span>Total de Plată:</span>
                                <span id="print-total"></span>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        Document generat electronic - www.romfast.ro
                    </div>
                </div>
            </body>
            </html>
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

    createPartyHTML(party) {
        return `
            <p><strong>${party.name}</strong></p>
            <p>CUI: ${party.vat}</p>
            <p>Nr. Reg. Com.: ${party.companyId}</p>
            <p>${party.address}</p>
            <p>${party.city}${party.county ? ', ' + party.county : ''}</p>
            <p>${party.country}</p>
            ${party.phone ? `<p>Tel: ${party.phone}</p>` : ''}
        `;
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
                phone: document.querySelector('[name="supplierPhone"]').value
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
                phone: document.querySelector('[name="customerPhone"]').value
            },

            // Line items
            items: Array.from(document.querySelectorAll('.line-item')).map((item, index) => ({
                number: index + 1,
                description: item.querySelector('[name^="description"]').value,
                quantity: parseFloat(item.querySelector('[name^="quantity"]').value),
                unit: item.querySelector('[name^="unit"]').value,
                price: parseFloat(item.querySelector('[name^="price"]').value),
                vatType: item.querySelector('[name^="vatType"]').value,
                vatRate: parseFloat(item.querySelector('[name^="vatRate"]').value)
            })),

            // Totals
            totals: {
                subtotal: parseFloat(document.getElementById('subtotal').textContent),
                allowances: parseFloat(document.getElementById('totalAllowances').textContent),
                charges: parseFloat(document.getElementById('totalCharges').textContent),
                netAmount: parseFloat(document.getElementById('netAmount').textContent),
                vat: parseFloat(document.getElementById('vat').textContent),
                total: parseFloat(document.getElementById('total').textContent)
            },

            // VAT Breakdown
            vatBreakdown: Array.from(document.querySelectorAll('.vat-row')).map(row => ({
                type: row.querySelector('.vat-type').value,
                rate: parseFloat(row.querySelector('.vat-rate').value),
                base: parseFloat(row.querySelector('.vat-base').value),
                amount: parseFloat(row.querySelector('.vat-amount').value)
            }))
        };
    }

    populatePrintWindow(data) {
        if (!this.printWindow) return;

        const doc = this.printWindow.document;

        // Basic details
        doc.getElementById('print-invoice-number').textContent = data.invoiceNumber;
        doc.getElementById('print-issue-date').textContent = data.issueDate;
        doc.getElementById('print-due-date').textContent = data.dueDate;

        // Currency information
        doc.getElementById('print-document-currency').textContent = data.documentCurrencyCode;
        
        const taxCurrencyContainer = doc.getElementById('print-tax-currency-container');
        if (data.taxCurrencyCode && data.taxCurrencyCode !== data.documentCurrencyCode) {
            taxCurrencyContainer.style.display = 'block';
            doc.getElementById('print-tax-currency').textContent = data.taxCurrencyCode;
            doc.getElementById('print-exchange-rate').textContent = this.formatter.formatNumber(data.exchangeRate);
        } else {
            taxCurrencyContainer.style.display = 'none';
        }

        // Generate QR code
        const qrData = {
            invoiceNumber: data.invoiceNumber,
            issueDate: data.issueDate,
            supplier: data.supplier.name,
            customer: data.customer.name,
            total: this.formatter.formatCurrency(data.totals.total)
        };

        const qrElement = doc.getElementById('qrcode');
        if (qrElement && typeof this.printWindow.QRCode !== 'undefined') {
            new this.printWindow.QRCode(qrElement, {
                text: JSON.stringify(qrData),
                width: 100,
                height: 100,
                colorDark: "#2563eb",
                colorLight: "#ffffff",
                correctLevel: this.printWindow.QRCode.CorrectLevel.L
            });
        }

        // Party details
        doc.getElementById('print-supplier-details').innerHTML = this.createPartyHTML(data.supplier);
        doc.getElementById('print-customer-details').innerHTML = this.createPartyHTML(data.customer);

        const noteText = document.querySelector('[name="invoiceNote"]').value;
        if (noteText) {
            const noteSection = doc.getElementById('print-note');
            noteSection.style.display = 'block';
            noteSection.querySelector('div').textContent = noteText;
        }

        // Line items
        doc.getElementById('print-items').innerHTML = data.items.map(item => `
            <tr>
                <td>${item.number}</td>
                <td>${item.description}</td>
                <td>${item.unit}</td>
                <td class="number-cell">${this.formatter.formatQuantity(item.quantity)}</td>
                <td class="number-cell">${this.formatter.formatCurrency(item.price)}</td>
                <td class="number-cell">${this.formatter.formatCurrency(item.vatRate)}%</td>
                <td class="number-cell">${this.formatter.formatCurrency(item.quantity * item.price)}</td>
            </tr>
        `).join('');

        // Totals
        doc.getElementById('print-subtotal').textContent = this.formatter.formatCurrency(data.totals.subtotal);
        doc.getElementById('print-allowances').textContent = this.formatter.formatCurrency(data.totals.allowances);
        doc.getElementById('print-charges').textContent = this.formatter.formatCurrency(data.totals.charges);
        doc.getElementById('print-net-amount').textContent = this.formatter.formatCurrency(data.totals.netAmount);
        doc.getElementById('print-total').textContent = this.formatter.formatCurrency(data.totals.total);

        // VAT Breakdown grid
        doc.getElementById('print-vat-breakdown').innerHTML = data.vatBreakdown.map(vat => `
            <div>${this.getVATTypeLabel(vat.type)}</div>
            <div>${this.formatter.formatCurrency(vat.rate)}%</div>
            <div>${this.formatter.formatCurrency(vat.base)}</div>
            <div>${this.formatter.formatCurrency(vat.amount)}</div>
        `).join('');

        // VAT amounts in both currencies
        doc.getElementById('print-vat-currency-main').textContent = data.documentCurrencyCode;
        doc.getElementById('print-vat-main').textContent = this.formatter.formatCurrency(data.totals.vat);

        const secondaryVatRow = doc.getElementById('print-vat-secondary');
        if (data.taxCurrencyCode && data.taxCurrencyCode !== data.documentCurrencyCode) {
            secondaryVatRow.style.display = 'flex';
            doc.getElementById('print-vat-currency-secondary').textContent = data.taxCurrencyCode;
            
            // Calculate VAT in tax currency
            const vatInTaxCurrency = data.totals.vat * data.exchangeRate;
            doc.getElementById('print-vat-secondary-amount').textContent = 
                this.formatter.formatCurrency(vatInTaxCurrency);
        } else {
            secondaryVatRow.style.display = 'none';
        }
    }

    async print() {
        try {
            // Collect all the data
            const invoiceData = this.collectInvoiceData();

            // Open new window
            this.printWindow = window.open('', '_blank', 'width=800,height=600');
            
            // Write the template
            this.printWindow.document.write(this.getPrintTemplate());
            
            // Close the document to finish loading
            this.printWindow.document.close();
            
            // Wait for both DOM and QR code script to be ready
            await new Promise(resolve => {
                if (this.printWindow.document.readyState === 'complete') {
                    resolve();
                } else {
                    this.printWindow.onload = resolve;
                }
            });

            // Additional safety delay to ensure DOM is ready
            await new Promise(resolve => setTimeout(resolve, 100));

            // Now populate the data
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
}

// Create instance and export
const formatter = new InvoiceFormatter();
const printHandler = new InvoicePrintHandler();

// Add print button to the UI
function addPrintButton() {
    const headerButtonGroup = document.querySelector('.button-group');
    if (!headerButtonGroup) return;

    const printButton = document.createElement('button');
    printButton.className = 'button';
    printButton.onclick = () => printHandler.print();
    printButton.innerHTML = 'Printează';
    headerButtonGroup.appendChild(printButton);
}

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', addPrintButton);

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        InvoiceFormatter,
        InvoicePrintHandler
    };
}