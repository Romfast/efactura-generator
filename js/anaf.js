/**
 * js/anaf.js — Proxy ANAF APIs prin receiver.php
 *
 * Toate apelurile merg prin receiver.php (CORS proxy server-side).
 * Pe hosting static (GitHub Pages, fără PHP), apelurile vor eșua cu eroare
 * "receiver indisponibil" — verificați cu probeReceiver() la inițializare.
 *
 * Configurare opțională în config.json (server-side):
 *   "anaf_token": "<Bearer token OAuth ANAF>" — folosește ruta OAuth (api.anaf.ro)
 *   Fără token: receiver folosește ruta publică webservicesp.anaf.ro (fără auth).
 *
 * Endpoints ANAF (proxied):
 *   Validate    : POST /FCTEL/rest/validare/FACT1
 *   XmlToPdf    : POST /FCTEL/rest/transformare/FACT1   (validează default; întoarce PDF)
 *   CIF info    : POST https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva
 */

const RECEIVER = './receiver.php';

/**
 * Verifică dacă receiver.php este disponibil pe server.
 * Returnează true dacă poate răspunde la ?action=ping.
 * @returns {Promise<boolean>}
 */
export async function probeReceiver() {
    try {
        const res = await fetch(`${RECEIVER}?action=ping`, { method: 'GET' });
        if (!res.ok) return false;
        const json = await res.json().catch(() => null);
        return json?.pong === true;
    } catch {
        return false;
    }
}

/**
 * Validează un XML eFactura prin API-ul ANAF (necesită Bearer token în config.json).
 * @param {string} xmlContent - XML ca string UTF-8
 * @returns {Promise<{valid: boolean, messages: Array<{message:string, severity:string, xpathLocation?:string}>}>}
 */
export async function anafValidate(xmlContent) {
    let res;
    try {
        res = await fetch(`${RECEIVER}?action=validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            body: xmlContent
        });
    } catch (e) {
        throw new Error('Receiver.php indisponibil — ' + e.message);
    }
    if (!res.ok) {
        let msg = `ANAF validare: HTTP ${res.status}`;
        try { const t = await res.text(); if (t) msg += ' — ' + t.slice(0, 200); } catch { /* ok */ }
        throw new Error(msg);
    }
    const data = await res.json();
    // Normalizare răspuns ANAF: { Messages: [{message, severity, xpathLocation}] }
    const messages = (data.Messages || data.messages || []).map(m => ({
        message: m.message || m.Message || String(m),
        severity: (m.severity || m.Severity || 'ERROR').toUpperCase(),
        xpathLocation: m.xpathLocation || m.XpathLocation || ''
    }));
    const valid = messages.filter(m => m.severity === 'ERROR' || m.severity === 'FATAL').length === 0;
    return { valid, messages };
}

/**
 * Obține PDF-ul oficial ANAF al facturii (transformare XML → PDF).
 * ANAF /transformare/FACT1 validează XML-ul și întoarce direct PDF binary.
 * Dacă XML-ul nu trece validarea, ANAF întoarce JSON cu erori (status 400).
 *
 * @param {string} xmlContent - XML ca string UTF-8
 * @returns {Promise<{pdf: Blob}|{errors: Array<{message:string,severity:string}>}>}
 *   - pdf: Blob `application/pdf` la succes
 *   - errors: listă mesaje validare la eșec
 */
export async function anafPdf(xmlContent) {
    let res;
    try {
        res = await fetch(`${RECEIVER}?action=pdf`, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            body: xmlContent
        });
    } catch (e) {
        throw new Error('Receiver.php indisponibil — ' + e.message);
    }

    const ct = (res.headers.get('Content-Type') || '').toLowerCase();

    if (res.ok && ct.includes('application/pdf')) {
        return { pdf: await res.blob() };
    }

    // ANAF validation errors come back as JSON (HTTP 400 or 200 with JSON body)
    if (ct.includes('application/json')) {
        const data = await res.json().catch(() => null);
        const messages = (data?.Messages || data?.messages || []).map(m => ({
            message: m.message || m.Message || String(m),
            severity: (m.severity || m.Severity || 'ERROR').toUpperCase()
        }));
        if (messages.length) return { errors: messages };
        if (data?.error) throw new Error(data.error);
    }

    if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`ANAF transformare: HTTP ${res.status}` + (txt ? ' — ' + txt.slice(0, 200) : ''));
    }
    throw new Error(`ANAF transformare: răspuns neașteptat (${ct || 'fără content-type'})`);
}

/**
 * Caută informații contribuabil după CIF prin ANAF.
 * Folosește API-ul sincron ANAF v9 (webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva).
 * Nu necesită token OAuth.
 * @param {string|number} cif - CIF/CUI (cu sau fără prefix RO)
 * @returns {Promise<{
 *   found: boolean,
 *   denumire?: string,
 *   adresa?: string,
 *   nrRegCom?: string,
 *   cui?: number,
 *   tvaActiv?: boolean,
 *   strada?: string,
 *   oras?: string,
 *   judetCod?: string,
 *   codPostal?: string,
 *   telefon?: string,
 *   statusEFactura?: boolean
 * }>}
 * @property {string}  strada        - Strada + număr din adresa_sediu_social ANAF
 * @property {string}  oras          - Localitatea (fără prefix MUN./ORS./COM.)
 * @property {string}  judetCod      - Cod județ ISO format RO-XX (ex: RO-B, RO-CJ)
 * @property {string}  codPostal     - Cod poștal
 * @property {string}  telefon       - Număr telefon din date_generale ANAF
 * @property {boolean} statusEFactura - Înregistrat în sistemul eFactura
 */
export async function anafCifLookup(cif) {
    const cifNum = String(cif).replace(/^RO\s*/i, '').trim();
    let res;
    try {
        res = await fetch(`${RECEIVER}?action=cif&cif=${encodeURIComponent(cifNum)}`);
    } catch (e) {
        throw new Error('Receiver.php indisponibil — ' + e.message);
    }
    if (!res.ok) {
        throw new Error(`ANAF CIF lookup: HTTP ${res.status}`);
    }
    return res.json();
}
