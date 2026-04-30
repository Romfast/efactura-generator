/**
 * js/anaf.js — Proxy ANAF APIs prin receiver.php
 *
 * Toate apelurile merg prin receiver.php (CORS proxy server-side).
 * Pe hosting static (GitHub Pages, fără PHP), apelurile vor eșua cu eroare
 * "receiver indisponibil" — verificați cu probeReceiver() la inițializare.
 *
 * Configurare necesară în config.json (server-side):
 *   "anaf_token": "<Bearer token OAuth ANAF>" — necesar pentru validate + pdf
 *
 * Endpoints ANAF (proxied):
 *   Validate : POST https://api.anaf.ro/prod/FCTEL/rest/validare/FACT1
 *   PDF/HTML : POST https://api.anaf.ro/prod/FCTEL/rest/transformare/FACT1/DA
 *   CIF info : POST https://webservicesp.anaf.ro/AsynchWebService/api/v8/ws/tva
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
 * Obține vizualizarea ANAF a facturii (ZIP cu HTML).
 * Notă: ANAF /transformare returnează ZIP+HTML, nu PDF direct.
 *       PDF-ul real este generat client-side prin PR-PDF / html2pdf.js.
 * @param {string} xmlContent - XML ca string UTF-8
 * @returns {Promise<Blob>} ZIP blob
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
    if (!res.ok) {
        throw new Error(`ANAF vizualizare: HTTP ${res.status}`);
    }
    return res.blob();
}

/**
 * Caută informații contribuabil după CIF prin ANAF.
 * Folosește API-ul async ANAF v8 (webservicesp.anaf.ro).
 * Nu necesită token OAuth.
 * @param {string|number} cif - CIF/CUI (cu sau fără prefix RO)
 * @returns {Promise<{
 *   found: boolean,
 *   denumire?: string,
 *   adresa?: string,
 *   nrRegCom?: string,
 *   cui?: number,
 *   tvaActiv?: boolean
 * }>}
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
