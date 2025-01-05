import { InvoiceFormatter } from './formatter.js';

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

const ISO_3166_1_CODES = new Set([
    'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 
    'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 
    'BR', 'BS', 'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 
    'CL', 'CM', 'CN', 'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 
    'DO', 'DZ', 'EC', 'EE', 'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 
    'GA', 'GB', 'GD', 'GE', 'GF', 'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 
    'GT', 'GU', 'GW', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 
    'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 
    'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 
    'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 
    'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NC', 'NE', 'NF', 'NG', 'NI', 
    'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH', 'PK', 'PL', 'PM', 
    'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 
    'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 
    'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO', 'TR', 
    'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 
    'VN', 'VU', 'WF', 'WS', 'XI', 'YE', 'YT', 'ZA', 'ZM', 'ZW'
]);

const ROMANIAN_COUNTY_CODES = new Set([
    'RO-AB', 'RO-AG', 'RO-AR', 'RO-B', 'RO-BC', 'RO-BH', 'RO-BN', 'RO-BR', 'RO-BT', 'RO-BV', 
    'RO-BZ', 'RO-CJ', 'RO-CL', 'RO-CS', 'RO-CT', 'RO-CV', 'RO-DB', 'RO-DJ', 'RO-GJ', 'RO-GL', 
    'RO-GR', 'RO-HD', 'RO-HR', 'RO-IF', 'RO-IL', 'RO-IS', 'RO-MH', 'RO-MM', 'RO-MS', 'RO-NT', 
    'RO-OT', 'RO-PH', 'RO-SB', 'RO-SJ', 'RO-SM', 'RO-SV', 'RO-TL', 'RO-TM', 'RO-TR', 'RO-VL', 
    'RO-VN', 'RO-VS'
]);

const CHARGE_REASON_CODES = {
    'TV': 'Cheltuieli de transport',
    'FC': 'Taxe transport',
    'ZZZ': 'Definite reciproc'
};

const ALLOWANCE_REASON_CODES = {
    '95': 'Reducere',
    '41': 'Bonus lucrări în avans',
    '42': 'Alt bonus',
    '60': 'Reducere volum',
    '62': 'Alte reduceri',
    '63': 'Reducere producător',
    '64': 'Din cauza războiului',
    '65': 'Reducere outlet nou',
    '66': 'Reducere mostre',
    '67': 'Reducere end-of-range',
    '68': 'Cost ambalaj returnabil',
    '70': 'Reducere Incoterm',
    '71': 'Prag vânzări',
    '88': 'Suprataxă/deducere materiale',
    '100': 'Reducere specială',
    '102': 'Termen lung fix',
    '103': 'Temporar',
    '104': 'Standard',
    '105': 'Cifră de afaceri anuală'
};

const formatter = new InvoiceFormatter()

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

    initializeLocationSelectors();    
});

// Initialize event listeners for existing line items
document.querySelectorAll('.line-item').forEach((item, index) => {
    handleLineItemChange(index);
});

// Inline editing setup function
function setupInlineEditing(element) {
    let originalValue;

    element.addEventListener('click', function() {
        this.setAttribute('contenteditable', 'true');
        originalValue = formatter.parseCurrency(this.textContent);
        this.textContent = originalValue.toFixed(2);
        this.focus();
    });

    element.addEventListener('blur', function() {
        this.setAttribute('contenteditable', 'false');
        const value = formatter.parseCurrency(this.textContent);
        this.textContent = formatter.formatCurrency(value);
        if (value !== originalValue) {
            updateTotals();
        }
    });

    element.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.blur();
        }
    });
}

function updateTotalDisplay(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = formatter.formatCurrency(roundNumber(value, 2));
    }
}

function displayTotals(totals) {
    updateTotalDisplay('subtotal', totals.subtotal);
    updateTotalDisplay('totalAllowances', totals.allowances);
    updateTotalDisplay('totalCharges', totals.charges);
    updateTotalDisplay('netAmount', totals.netAmount);
    updateTotalDisplay('vat', totals.totalVat);
    updateTotalDisplay('total', totals.total);
}

function updateVATDisplay(row, amount, type = 'amount') {
    const input = row.querySelector(`.vat-${type}`);
    if (input) {
        input.value = formatter.formatCurrency(amount);
    }
}

function getDisplayValue(elementId) {
    const element = document.getElementById(elementId);
    return element ? formatter.parseCurrency(element.textContent) : 0;
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

        initializeLocationSelectors();

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
                    <select class="form-input" name="chargeType${index}" onchange="updateReasonCodeOptions(${index})">
                        <option value="true" ${charge.isCharge ? 'selected' : ''}>Taxă</option>
                        <option value="false" ${!charge.isCharge ? 'selected' : ''}>Reducere</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Cod Motiv</label>
                    <select class="form-input" name="chargeReasonCode${index}">
                        ${createReasonCodeOptions(charge.isCharge, charge.reasonCode)}
                    </select>
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

function createReasonCodeOptions(isCharge, selectedCode = '') {
    const codes = isCharge ? CHARGE_REASON_CODES : ALLOWANCE_REASON_CODES;
    return Object.entries(codes)
        .map(([code, description]) => 
            `<option value="${code}" ${code === selectedCode ? 'selected' : ''}>${description} (${code})</option>`
        ).join('');
}

window.updateReasonCodeOptions = function(index) {
    const chargeTypeSelect = document.querySelector(`[name="chargeType${index}"]`);
    const reasonCodeSelect = document.querySelector(`[name="chargeReasonCode${index}"]`);
    const reasonInput = document.querySelector(`[name="chargeReason${index}"]`);
    
    const isCharge = chargeTypeSelect.value === 'true';
    reasonCodeSelect.innerHTML = createReasonCodeOptions(isCharge);
    
    // Update reason text based on selected code
    const selectedCode = reasonCodeSelect.value;
    const codes = isCharge ? CHARGE_REASON_CODES : ALLOWANCE_REASON_CODES;
    reasonInput.value = codes[selectedCode] || '';
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
                    <input type="text" class="form-input vat-rate" value="${formatter.formatNumber(rate)}" 
                           onchange="window.updateVATRow('${rowId}', 'manual')">%
                    <label>Bază Impozabilă:</label>
                    <input type="text" class="form-input vat-base" value="${formatter.formatCurrency(baseAmount)}" 
                           onchange="window.updateVATRow('${rowId}', 'manual')">
                    <label>Valoare TVA:</label>
                    <input type="text" class="form-input vat-amount" value="${formatter.formatCurrency(vatAmount)}" 
                           onchange="window.updateVATRowFromAmount('${rowId}')">
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

function createCountryOptions() {
    return Array.from(ISO_3166_1_CODES).map(code => 
        `<option value="${code}" ${code === 'RO' ? 'selected' : ''}>${code}</option>`
    ).join('');
}

function createCountyOptions() {
    return Array.from(ROMANIAN_COUNTY_CODES).map(code => {
        const label = code.replace('RO-', '');
        const counties = {
            'AB': 'Alba', 'AR': 'Arad', 'AG': 'Argeș', 'BC': 'Bacău', 'BH': 'Bihor', 
            'BN': 'Bistrița-Năsăud', 'BT': 'Botoșani', 'BV': 'Brașov', 'BR': 'Brăila', 
            'B': 'București', 'BZ': 'Buzău', 'CS': 'Caraș-Severin', 'CL': 'Călărași', 
            'CJ': 'Cluj', 'CT': 'Constanța', 'CV': 'Covasna', 'DB': 'Dâmbovița', 
            'DJ': 'Dolj', 'GL': 'Galați', 'GR': 'Giurgiu', 'GJ': 'Gorj', 'HR': 'Harghita', 
            'HD': 'Hunedoara', 'IL': 'Ialomița', 'IS': 'Iași', 'IF': 'Ilfov', 
            'MM': 'Maramureș', 'MH': 'Mehedinți', 'MS': 'Mureș', 'NT': 'Neamț', 
            'OT': 'Olt', 'PH': 'Prahova', 'SM': 'Satu Mare', 'SJ': 'Sălaj', 
            'SB': 'Sibiu', 'SV': 'Suceava', 'TR': 'Teleorman', 'TM': 'Timiș', 
            'TL': 'Tulcea', 'VS': 'Vaslui', 'VL': 'Vâlcea', 'VN': 'Vrancea'
        };
        return `<option value="${code}">${counties[label] || label} (${label})</option>`;
    }).join('');
}

function initializeLocationSelectors() {
    // Replace country inputs with selects
    document.querySelectorAll('[name$="Country"]').forEach(input => {
        const select = document.createElement('select');
        select.className = 'form-input';
        select.name = input.name;
        select.innerHTML = createCountryOptions();
        
        const xmlValue = input.dataset.xmlValue || input.value || 'RO';
        select.value = xmlValue;
        
        if (input.parentNode) {
            input.parentNode.replaceChild(select, input);
        }
    });

    // Replace county inputs with selects
    document.querySelectorAll('[name$="CountrySubentity"]').forEach(input => {
        const select = document.createElement('select');
        select.className = 'form-input';
        select.name = input.name;
        select.innerHTML = createCountyOptions();
        
        const xmlValue = input.dataset.xmlValue || input.value || '';
        select.value = xmlValue;
        
        if (input.parentNode) {
            input.parentNode.replaceChild(select, input);
        }
    });

    // Set up event listeners for each party details section
    document.querySelectorAll('.party-details').forEach(partyDetails => {
        const countrySelect = partyDetails.querySelector('[name$="Country"]');
        const countySelect = partyDetails.querySelector('[name$="CountrySubentity"]');
        const cityElement = partyDetails.querySelector('[name$="City"]');

        if (countrySelect && countySelect && cityElement) {
            // Add event listeners
            countrySelect.addEventListener('change', () => {
                updateCountyVisibility(countrySelect, countySelect);
                updateBucharestSectorVisibility(countrySelect, countySelect, cityElement);
            });

            countySelect.addEventListener('change', () => {
                console.log("County changed:", countySelect.value);
                updateBucharestSectorVisibility(countrySelect, countySelect, cityElement);
            });

            // Initial update
            updateCountyVisibility(countrySelect, countySelect);
            updateBucharestSectorVisibility(countrySelect, countySelect, cityElement);
        } else {
            console.log("Missing elements in party details", {
                countrySelect: !!countrySelect,
                countySelect: !!countySelect,
                cityElement: !!cityElement
            });
        }
    });
}

function updateCountyVisibility(countrySelect, countySelect) {
    if (!countrySelect || !countySelect) return;
    
    const showCounty = countrySelect.value === 'RO';
    countySelect.style.display = showCounty ? 'block' : 'none';
    countySelect.required = showCounty;
}

function updateBucharestSectorVisibility(countrySelect, countySelect, cityElement) {
    if (!countrySelect || !countySelect || !cityElement) {
        console.log("Missing required elements");
        return;
    }

    const isBucharest = countrySelect.value === 'RO' && countySelect.value === 'RO-B';
    const currentValue = cityElement.value || '';
    const isCurrentlySector = cityElement.tagName.toLowerCase() === 'select';
    
    console.log("Checking Bucharest condition:", { 
        isBucharest, 
        country: countrySelect.value, 
        county: countySelect.value 
    });

    if (isBucharest && !isCurrentlySector) {
        // Create sector dropdown
        const sectorSelect = document.createElement('select');
        sectorSelect.className = 'form-input';
        sectorSelect.name = cityElement.name;
        sectorSelect.innerHTML = `
            <option value="">Selectați sectorul</option>
            <option value="SECTOR1">Sectorul 1</option>
            <option value="SECTOR2">Sectorul 2</option>
            <option value="SECTOR3">Sectorul 3</option>
            <option value="SECTOR4">Sectorul 4</option>
            <option value="SECTOR5">Sectorul 5</option>
            <option value="SECTOR6">Sectorul 6</option>
        `;
        
        // Try to preserve the sector value if it exists
        if (currentValue.toUpperCase().includes('SECTOR')) {
            sectorSelect.value = currentValue.toUpperCase().replace(/\s+/g, '');
        }
        
        if (cityElement.parentNode) {
            cityElement.parentNode.replaceChild(sectorSelect, cityElement);
        }
        
        console.log("Replaced input with sector select");
    } else if (!isBucharest && isCurrentlySector) {
        // Switch back to text input
        const cityInput = document.createElement('input');
        cityInput.type = 'text';
        cityInput.className = 'form-input';
        cityInput.name = cityElement.name;
        
        // Preserve the value only if it's not a sector
        if (!currentValue.toUpperCase().includes('SECTOR')) {
            cityInput.value = currentValue;
        }
        
        if (cityElement.parentNode) {
            cityElement.parentNode.replaceChild(cityInput, cityElement);
        }
        
        console.log("Replaced sector select with input");
    }
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

    // Initialize location selectors
    initializeLocationSelectors();

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
    
    displayTotals({
        subtotal: parseFloat(originalTotals.subtotal),
        allowances: parseFloat(originalTotals.allowances || 0),
        charges: parseFloat(originalTotals.charges || 0),
        netAmount: parseFloat(originalTotals.netAmount),
        totalVat: parseFloat(originalTotals.totalVat),
        total: parseFloat(originalTotals.total)
    });

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
    function extractPartyDetails(party, prefix) {
        // Extract contact information
        const contact = party.querySelector('cac\\:Contact, Contact');
        const phone = contact?.querySelector('cbc\\:Telephone, Telephone')?.textContent || '';
        const contactName = contact?.querySelector('cbc\\:Name, Name')?.textContent || '';
        const email = contact?.querySelector('cbc\\:ElectronicMail, ElectronicMail')?.textContent || '';
    
        // Country Code Extraction
        const countryCodeElement = party.querySelector('cac\\:Country cbc\\:IdentificationCode, Country IdentificationCode');
        const countryCode = countryCodeElement ? countryCodeElement.textContent.trim() : 'RO';
     
        // Postal Address Details
        const postalAddress = party.querySelector('cac\\:PostalAddress, PostalAddress');
        const streetName = postalAddress ? 
            getXMLValue(postalAddress, 'cbc\\:StreetName, StreetName') : '';
        const cityName = postalAddress ? 
            getXMLValue(postalAddress, 'cbc\\:CityName, CityName') : '';
        const countyCode = postalAddress ? 
            getXMLValue(postalAddress, 'cbc\\:CountrySubentity, CountrySubentity') : '';
     
        // Set inputs
        document.querySelector(`[name="${prefix}Name"]`).value = 
            getXMLValue(party, 'cac\\:PartyLegalEntity cbc\\:RegistrationName, PartyLegalEntity RegistrationName');
        document.querySelector(`[name="${prefix}VAT"]`).value = 
            getXMLValue(party, 'cac\\:PartyTaxScheme cbc\\:CompanyID, PartyTaxScheme CompanyID');
        document.querySelector(`[name="${prefix}CompanyId"]`).value = 
            getXMLValue(party, 'cac\\:PartyLegalEntity cbc\\:CompanyID, PartyLegalEntity CompanyID');
        document.querySelector(`[name="${prefix}Address"]`).value = streetName;
        document.querySelector(`[name="${prefix}City"]`).value = cityName;
        document.querySelector(`[name="${prefix}Phone"]`).value = phone;
        document.querySelector(`[name="${prefix}ContactName"]`).value = contactName;
        document.querySelector(`[name="${prefix}Email"]`).value = email;
     
        // Country Select
        const countrySelect = document.querySelector(`[name="${prefix}Country"]`);
        if (countrySelect) {
            countrySelect.value = countryCode;
            countrySelect.dataset.xmlValue = countryCode;
        }
     
        // County Select
        const countySelect = document.querySelector(`[name="${prefix}CountrySubentity"]`);
        if (countySelect) {
            countySelect.value = countyCode;
            countySelect.dataset.xmlValue = countyCode;
        }
    }
 
    const supplierParty = xmlDoc.querySelector('cac\\:AccountingSupplierParty, AccountingSupplierParty');
    if (supplierParty) {
        const supplierPartyDetails = supplierParty.querySelector('cac\\:Party, Party');
        if (supplierPartyDetails) {
            extractPartyDetails(supplierPartyDetails, 'supplier');
        }
    }
 
    const customerParty = xmlDoc.querySelector('cac\\:AccountingCustomerParty, AccountingCustomerParty');
    if (customerParty) {
        const customerPartyDetails = customerParty.querySelector('cac\\:Party, Party');
        if (customerPartyDetails) {
            extractPartyDetails(customerPartyDetails, 'customer');
        }
    }
 
    initializeLocationSelectors();
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
    const reasonCodeSelect = document.querySelector(`[name="chargeReasonCode${index}"]`);
    const reasonInput = document.querySelector(`[name="chargeReason${index}"]`);
    
    // Add change listeners to all inputs
    [chargeAmountInput, chargeTypeInput, chargeVatTypeInput, chargeVatRateInput].forEach(input => {
        if (input) {
            input.addEventListener('change', () => {
                manuallyEditedVatRows.clear();
                refreshTotals();
            });
        }
    });
    
    // Add reason code change listener
    if (reasonCodeSelect) {
        reasonCodeSelect.addEventListener('change', () => {
            const isCharge = chargeTypeInput.value === 'true';
            const codes = isCharge ? CHARGE_REASON_CODES : ALLOWANCE_REASON_CODES;
            reasonInput.value = codes[reasonCodeSelect.value] || '';
        });
    }
    
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
        reason: 'Cheltuieli transport',
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

    manuallyEditedVatRows.clear(); // Clear manual edits
    
    handleLineItemChange(index);
}

function removeLineItem(index) {
    const lineItem = document.querySelector(`.line-item[data-index="${index}"]`);
    if (lineItem) {
        lineItem.remove();
        renumberLineItems();
        manuallyEditedVatRows.clear(); // Clear manual edits
        refreshTotals(); // Recalculate all totals
    }
}

function handleLineItemChange(index) {
    const quantityInput = document.querySelector(`[name="quantity${index}"]`);
    const priceInput = document.querySelector(`[name="price${index}"]`);
    
    quantityInput.addEventListener('change', refreshTotals);
    priceInput.addEventListener('change', refreshTotals);
    
    // Force refresh when input changes
    refreshTotals();
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

    // Calculate total VAT from VAT breakdown
    let calculatedVAT = 0;
    vatBreakdown.forEach(entry => {
        calculatedVAT += entry.vatAmount;
    });

    displayTotals({
        subtotal: totals.subtotal,
        allowances: totals.allowances,
        charges: totals.charges,
        netAmount: totals.netAmount,
        totalVat: calculatedVAT,
        total: totals.netAmount + calculatedVAT
    });

    displayVATBreakdown();
    
    // Update VAT and total displays with proper formatting
    document.getElementById('vat').textContent = formatter.formatCurrency(calculatedVAT);
    document.getElementById('total').textContent = formatter.formatCurrency(totals.netAmount + calculatedVAT);
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
    displayTotals({
        subtotal: subtotal,
        allowances: allowances,
        charges: charges,
        netAmount: netAmount,
        totalVat: calculateTotalVAT(),
        total: netAmount + calculateTotalVAT()
    });

    displayVATBreakdown();
    
    // Calculate total VAT from the actual displayed rows, including manual edits
    let totalVat = 0;
    document.querySelectorAll('.vat-row').forEach(row => {
        const vatAmount = formatter.parseCurrency(row.querySelector('.vat-amount').value) || 0;
        totalVat += vatAmount;
    });
    
    // Update final totals with proper formatting
    document.getElementById('vat').textContent = formatter.formatCurrency(totalVat);
    document.getElementById('total').textContent = formatter.formatCurrency(netAmount + totalVat);
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
    const allowances = chargeTotals.allowances;
    const charges = chargeTotals.charges;
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

function calculateTotalVAT() {
    let totalVat = Array.from(document.querySelectorAll('.vat-amount'))
        .reduce((sum, input) => sum + formatter.parseCurrency(input.value), 0);
    return roundNumber(totalVat, 2);
}

function calculateVATBreakdown() {
    let vatBreakdown = new Map();
    let totalVat = 0;

    // Process line items 
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
            entry.vatAmount += roundNumber(lineAmount * vatRate / 100, 2);
        }
    });

    // Process allowances and charges
    document.querySelectorAll('.allowance-charge').forEach((charge, index) => {
        const amount = parseFloat(document.querySelector(`[name="chargeAmount${index}"]`).value) || 0;
        const vatType = document.querySelector(`[name="chargeVatType${index}"]`).value;
        const vatRate = parseFloat(document.querySelector(`[name="chargeVatRate${index}"]`).value) || 0;
        const isCharge = document.querySelector(`[name="chargeType${index}"]`).value === 'true';
        
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
        const adjustedAmount = isCharge ? amount : -amount;
        entry.baseAmount += adjustedAmount;
        if (vatType === 'S') {
            entry.vatAmount += roundNumber(adjustedAmount * vatRate / 100, 2);
        }
    });

    // Calculate total VAT
    vatBreakdown.forEach(entry => {
        totalVat += entry.vatAmount;
    });

    return { vatBreakdown, totalVat: roundNumber(totalVat, 2) };
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
        // Keep existing values, just update totals
        updateTotalVAT();
        refreshTotals();
        return;
    }
    
    // Only calculate VAT amount for non-manual updates
    if (!manuallyEditedVatRows.has(rowId)) {
        const type = typeSelect.value;
        const rate = parseFloat(rateInput.value) || 0;
        const base = formatter.parseCurrency(baseInput.value) || 0;
        
        const calculatedAmount = type === 'S' ? roundNumber(base * rate / 100, 2) : 0;
        amountInput.value = formatter.formatCurrency(calculatedAmount);
        
        updateTotalVAT();
        refreshTotals();
    }
};

window.updateVATRowFromAmount = function(rowId) {
    const row = document.getElementById(rowId);
    if (!row) return;

    // Just mark as manually edited and update the totals
    // Do not recalculate base amount
    manuallyEditedVatRows.add(rowId);
    
    const amountInput = row.querySelector('.vat-amount');
    if (amountInput) {
        const value = formatter.parseCurrency(amountInput.value);
        amountInput.value = formatter.formatCurrency(value);
    }

    let totalVat = 0;
    document.querySelectorAll('.vat-row').forEach(vatRow => {
        const vatAmount = formatter.parseCurrency(vatRow.querySelector('.vat-amount').value) || 0;
        totalVat += vatAmount;
    });

    // Update just total VAT and final total
    const netAmount = formatter.parseCurrency(document.getElementById('netAmount').textContent);
    document.getElementById('vat').textContent = formatter.formatCurrency(totalVat);
    document.getElementById('total').textContent = formatter.formatCurrency(netAmount + totalVat);
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
    
    // Store existing manually edited values
    const existingValues = new Map();
    manuallyEditedVatRows.forEach(rowId => {
        const row = document.getElementById(rowId);
        if (row) {
            existingValues.set(rowId, {
                rate: formatter.parseCurrency(row.querySelector('.vat-rate').value),
                base: formatter.parseCurrency(row.querySelector('.vat-base').value),
                amount: formatter.parseCurrency(row.querySelector('.vat-amount').value),
                type: row.querySelector('.vat-type').value
            });
        }
    });
    
    // Clear container
    container.innerHTML = '';
    
    // Restore manually edited rows
    existingValues.forEach((values, rowId) => {
        addVATBreakdownRow(
            values.rate,
            values.base,
            values.amount,
            values.type,
            rowId
        );
    });
    
    // Add new VAT breakdown rows
    vatBreakdown.forEach((data, key) => {
        const exists = Array.from(existingValues.values()).some(values => 
            values.rate === data.rate && values.type === data.type
        );
        
        if (!exists) {
            addVATBreakdownRow(
                data.rate,
                data.baseAmount,
                data.vatAmount,
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

function createPartyElement(xmlDoc, isSupplier, partyData) {
    const party = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:Party");
    const hasVatPrefix = /^[A-Z]{2}/.test(partyData.vat?.trim() || '');
    
    // Add PartyIdentification for customers without VAT prefix
    if (!isSupplier && !hasVatPrefix && partyData.companyId) {
        const partyIdentification = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:PartyIdentification");
        partyIdentification.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", partyData.companyId));
        party.appendChild(partyIdentification);
    }

    function validateCountryCode(countryCode) {
        const code = countryCode?.trim().toUpperCase() || 'RO';
        return ISO_3166_1_CODES.has(code) ? code : 'RO';
    }

    function validateCountyCode(countryCode, countyCode) {
        if (countryCode === 'RO') {
            return ROMANIAN_COUNTY_CODES.has(countyCode) ? countyCode : 'RO-B';
        }
        return countyCode;
    }

    const postalAddress = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:PostalAddress");
    postalAddress.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:StreetName", partyData.address));
    postalAddress.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:CityName", partyData.city));
    postalAddress.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:CountrySubentity", partyData.county));
    
    const country = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:Country");
    // Ensure country code is valid ISO 3166-1 format (2 uppercase letters)
    const countryCode = partyData.country?.trim().toUpperCase() || 'RO';
    country.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:IdentificationCode", countryCode));
    postalAddress.appendChild(country);
    party.appendChild(postalAddress);

    // Add PartyTaxScheme
    const partyTaxScheme = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:PartyTaxScheme");
    
    if (hasVatPrefix) {
        // For VAT registered parties (with prefix)
        partyTaxScheme.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:CompanyID", partyData.vat));
        const taxScheme = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxScheme");
        taxScheme.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", "VAT"));
        partyTaxScheme.appendChild(taxScheme);
    } else if (isSupplier) {
        // For non-VAT registered supplier
        partyTaxScheme.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:CompanyID", partyData.vat || ''));
        partyTaxScheme.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxScheme"));
    } else {
        // For non-VAT registered customer
        partyTaxScheme.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:CompanyID", ''));
        const taxScheme = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxScheme");
        taxScheme.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ID", "VAT"));
        partyTaxScheme.appendChild(taxScheme);
    }
    
    party.appendChild(partyTaxScheme);

    // Add PartyLegalEntity
    const partyLegalEntity = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:PartyLegalEntity");
    partyLegalEntity.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:RegistrationName", partyData.name));
    
    // Add CompanyID for both supplier and customer
    if (isSupplier) {
        // For supplier always add CompanyID from companyId field
        partyLegalEntity.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:CompanyID", partyData.companyId));
    } else {
        // For customer, add VAT number if no prefix, otherwise add companyId
        partyLegalEntity.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:CompanyID", 
            hasVatPrefix ? partyData.companyId : partyData.vat));
    }
    
    party.appendChild(partyLegalEntity);

    // Add Contact if phone, email or contactName exists
    if (partyData.phone || partyData.email || partyData.contactName) {
        const contact = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:Contact");
        
        if (partyData.contactName) {
            contact.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Name", partyData.contactName));
        }
        if (partyData.phone) {
            contact.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:Telephone", partyData.phone));
        }
        if (partyData.email) {
            contact.appendChild(createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:ElectronicMail", partyData.email));
        }
        party.appendChild(contact);
    }
    return party;
}

function updatePartyDetails(xmlDoc) {
    // Update supplier details
    const supplierData = {
        name: document.querySelector('[name="supplierName"]').value,
        vat: document.querySelector('[name="supplierVAT"]').value,
        companyId: document.querySelector('[name="supplierCompanyId"]').value,
        address: document.querySelector('[name="supplierAddress"]').value,
        city: document.querySelector('[name="supplierCity"]').value,
        county: document.querySelector('[name="supplierCountrySubentity"]').value,
        country: document.querySelector('[name="supplierCountry"]').value,
        phone: document.querySelector('[name="supplierPhone"]').value,
        contactName: document.querySelector('[name="supplierContactName"]').value,
        email: document.querySelector('[name="supplierEmail"]').value
    };
    
    updatePartyXML(xmlDoc, true, supplierData);

    // Update customer details
    const customerData = {
        name: document.querySelector('[name="customerName"]').value,
        vat: document.querySelector('[name="customerVAT"]').value,
        companyId: document.querySelector('[name="customerCompanyId"]').value,
        address: document.querySelector('[name="customerAddress"]').value,
        city: document.querySelector('[name="customerCity"]').value,
        county: document.querySelector('[name="customerCountrySubentity"]').value,
        country: document.querySelector('[name="customerCountry"]').value,
        phone: document.querySelector('[name="customerPhone"]').value,
        contactName: document.querySelector('[name="customerContactName"]').value,
        email: document.querySelector('[name="customerEmail"]').value
    };
    
    updatePartyXML(xmlDoc, false, customerData);
}

function updatePartyXML(xmlDoc, isSupplier, partyData) {
    const partyElement = createPartyElement(xmlDoc, isSupplier, partyData);
    const parentTag = isSupplier ? 'AccountingSupplierParty' : 'AccountingCustomerParty';
    let parentElement = xmlDoc.querySelector(`cac\\:${parentTag}, ${parentTag}`);
    
    if (!parentElement) {
        parentElement = createXMLElement(xmlDoc, XML_NAMESPACES.cac, `cac:${parentTag}`);
        const insertPoint = isSupplier ? 
            xmlDoc.querySelector('cbc\\:DocumentCurrencyCode, DocumentCurrencyCode') : 
            xmlDoc.querySelector('cac\\:AccountingSupplierParty, AccountingSupplierParty');
            
        if (insertPoint && insertPoint.parentNode) {
            insertPoint.parentNode.insertBefore(parentElement, insertPoint.nextSibling);
        } else {
            xmlDoc.documentElement.appendChild(parentElement);
        }
    }

    // Remove existing Party element if it exists
    const existingParty = parentElement.querySelector('cac\\:Party, Party');
    if (existingParty) {
        existingParty.remove();
    }

    parentElement.appendChild(partyElement);
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
    
    // Use precise currency parsing for total VAT
    const uiTotalVat = formatter.parseCurrency(document.getElementById('vat').textContent);
    const taxAmountElement = createXMLElement(xmlDoc, XML_NAMESPACES.cbc, "cbc:TaxAmount", 
        uiTotalVat.toFixed(2), { currencyID });
    taxTotal.appendChild(taxAmountElement);

    // Add TaxSubtotal elements to the main TaxTotal
    const vatRows = document.querySelectorAll('.vat-row');
    vatRows.forEach(row => {
        const taxSubtotal = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:TaxSubtotal");
        
        const baseAmount = formatter.parseCurrency(row.querySelector('.vat-base').value) || 0;
        const vatAmount = formatter.parseCurrency(row.querySelector('.vat-amount').value) || 0;
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

    // Insertion point logic remains the same as in previous implementation
    let insertionPoint = xmlDoc.querySelector('cac\\:AllowanceCharge, AllowanceCharge');
    if (insertionPoint) {
        while (insertionPoint.nextElementSibling && 
               (insertionPoint.nextElementSibling.localName === 'AllowanceCharge' ||
                insertionPoint.nextElementSibling.localName === 'TaxTotal')) {
            insertionPoint = insertionPoint.nextElementSibling;
        }
        insertionPoint.parentNode.insertBefore(taxTotal, insertionPoint.nextSibling);
    } else {
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

    // Use direct parsing to preserve full precision and manual edits
    const subtotal = formatter.parseCurrency(document.getElementById('subtotal').textContent);
    const allowances = formatter.parseCurrency(document.getElementById('totalAllowances').textContent);
    const charges = formatter.parseCurrency(document.getElementById('totalCharges').textContent);
    const netAmount = formatter.parseCurrency(document.getElementById('netAmount').textContent);
    const totalVat = formatter.parseCurrency(document.getElementById('vat').textContent);
    const total = formatter.parseCurrency(document.getElementById('total').textContent);

    // Rest of the function remains the same...
    const existingMonetaryTotal = xmlDoc.querySelector('cac\\:LegalMonetaryTotal, LegalMonetaryTotal');
    if (existingMonetaryTotal) {
        existingMonetaryTotal.parentNode.removeChild(existingMonetaryTotal);
    }

    const monetaryTotal = createXMLElement(xmlDoc, XML_NAMESPACES.cac, "cac:LegalMonetaryTotal");

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

    // Insertion logic remains the same
    let insertionPoint = xmlDoc.querySelector('cac\\:TaxTotal, TaxTotal');
    if (insertionPoint) {
        while (insertionPoint.nextElementSibling && 
               insertionPoint.nextElementSibling.localName === 'TaxTotal') {
            insertionPoint = insertionPoint.nextElementSibling;
        }
        insertionPoint.parentNode.insertBefore(monetaryTotal, insertionPoint.nextSibling);
    } else {
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

function renumberLineItems() {
    document.querySelectorAll('.line-item').forEach((item, newIndex) => {
        item.dataset.index = newIndex;
        
        item.querySelectorAll('input, select').forEach(input => {
            const name = input.getAttribute('name');
            if (name) {
                const baseName = name.replace(/\d+$/, '');
                input.setAttribute('name', baseName + newIndex);
            }
        });
    });
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
        setXMLValue,
        formatter,
        setupInlineEditing,
        updateTotalDisplay,
        displayTotals,
        updateVATDisplay,
        getDisplayValue
    };
}                

import { InvoicePrintHandler } from './print.js';

// Create print handler instance
const printHandler = new InvoicePrintHandler();

// Initialize when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    // Add print controls to the UI
    const headerButtonGroup = document.querySelector('.button-group');
    if (headerButtonGroup) {
        const printControls = document.createElement('div');
        printControls.className = 'print-controls';
        printControls.style.display = 'flex';
        printControls.style.gap = '8px';
        printControls.style.alignItems = 'center';
        
        // Create template selector
        const templateSelect = document.createElement('select');
        templateSelect.className = 'form-input';
        templateSelect.style.width = 'auto';
        templateSelect.innerHTML = `
            <option value="standard">Standard</option>
            <option value="compact">Compact</option>
        `;
        templateSelect.addEventListener('change', (e) => {
            printHandler.setTemplate(e.target.value);
        });

        // Create print button
        const printButton = document.createElement('button');
        printButton.className = 'button';
        printButton.onclick = () => printHandler.print();
        printButton.innerHTML = 'Printează';

        // Add elements to controls
        printControls.appendChild(templateSelect);
        printControls.appendChild(printButton);
        
        // Add controls to header
        headerButtonGroup.appendChild(printControls);
    }
});