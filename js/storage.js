// js/storage.js
//
// Helpers de stocare pentru efactura-generator (PR-PROFIL / A12+A13).
//
// Reguli:
//   1. Toate cheile localStorage/sessionStorage încep cu "efactura." —
//      enforced la setter; getJSON acceptă orice cheie pentru compatibilitate
//      retroactivă, dar setJSON/cacheSet aruncă dacă prefixul lipsește.
//   2. Quota errors localStorage → toast vizibil "spațiu local plin".
//   3. Cheile convenționale: efactura.{tip}.v1
//      Ex: efactura.profil.v1, efactura.catalog.v1, efactura.session.v1
//
// Exports:
//   getJSON(key, default)  → valoare parsată sau default
//   setJSON(key, value)    → salvează; toast error dacă QuotaExceeded
//   cacheGet(key)          → sessionStorage (ephemer, null dacă absent)
//   cacheSet(key, value)   → sessionStorage (silențios dacă eșuează)
//   openCatalog()          → Promise<IDBDatabase> pentru catalog produse (A13)

const KEY_PREFIX = 'efactura.';

/**
 * Validează că cheia respectă prefixul obligatoriu.
 * @param {string} key
 */
function _enforcePrefix(key) {
    if (typeof key !== 'string' || !key.startsWith(KEY_PREFIX)) {
        throw new Error(
            `storage.js: cheia "${key}" trebuie să înceapă cu "${KEY_PREFIX}". ` +
            `Convenție: efactura.{tip}.v1`
        );
    }
}

/**
 * Afișează un toast (dacă window.showToast e disponibil) sau loghează.
 * @param {string} msg
 * @param {string} variant 'error'|'warning'|'info'|'success'
 */
function _toast(msg, variant = 'error') {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
        window.showToast(msg, variant);
    } else {
        console.warn('[storage]', msg);
    }
}

/**
 * Citește o valoare JSON din localStorage.
 * Returnează `defaultValue` dacă cheia lipsește sau JSON e invalid.
 *
 * @param {string} key
 * @param {*} defaultValue
 * @returns {*}
 */
export function getJSON(key, defaultValue = null) {
    _enforcePrefix(key);
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        return JSON.parse(raw);
    } catch (_) {
        return defaultValue;
    }
}

/**
 * Scrie o valoare JSON în localStorage.
 * La QuotaExceededError → toast "spațiu local plin".
 *
 * @param {string} key
 * @param {*} value
 */
export function setJSON(key, value) {
    _enforcePrefix(key);
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        // QuotaExceededError: code 22 (Firefox/Chrome), 1014 (Firefox NS), sau name check.
        const isQuota = err && (
            err.name === 'QuotaExceededError' ||
            err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
            err.code === 22 ||
            err.code === 1014
        );
        if (isQuota) {
            _toast(
                'Spațiu local plin — datele nu au putut fi salvate.',
                'error'
            );
        } else {
            _toast(`Eroare la salvare locală: ${err && err.message ? err.message : err}`, 'error');
        }
    }
}

/**
 * Citește din sessionStorage (cache ephemer, valabil doar pe durata sesiunii).
 * Returnează null dacă absent sau invalid.
 *
 * @param {string} key
 * @returns {*|null}
 */
export function cacheGet(key) {
    _enforcePrefix(key);
    try {
        const raw = sessionStorage.getItem(key);
        if (raw === null) return null;
        return JSON.parse(raw);
    } catch (_) {
        return null;
    }
}

/**
 * Scrie în sessionStorage. Erorile sunt ignorate silențios (storage e
 * ephemer și poate fi blocat de browser în incognito / iframe sandboxed).
 *
 * @param {string} key
 * @param {*} value
 */
export function cacheSet(key, value) {
    _enforcePrefix(key);
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch (_) {
        // Ignorat: sessionStorage e ephemer, erorile nu sunt critice.
    }
}

// IndexedDB pentru catalog produse (A13 lazy init).
let _catalogDb = null;

/**
 * Deschide (sau returnează instanța cached a) bazei de date IndexedDB
 * `efactura` v1. Crează object store `products` la prima rulare.
 *
 * Schema v1 (lock per eng review 14A):
 *   - DB name: `efactura`
 *   - store: `products`, keyPath: `id` (uuid v4 generat de caller)
 *   - indexes: `name`, `sellerItemID`, `cpvCode`
 *
 * Dacă IndexedDB lipsește (private browsing), Promise rejectează cu Error
 * `indexeddb-unavailable` — caller-ul trebuie să degradeze la "feature
 * disabled" cu toast (NU să crash-eze).
 *
 * @returns {Promise<IDBDatabase>}
 */
export function openCatalog() {
    if (_catalogDb) return Promise.resolve(_catalogDb);

    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('indexeddb-unavailable'));
            return;
        }
        const req = indexedDB.open('efactura', 1);

        req.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('products')) {
                const store = db.createObjectStore('products', { keyPath: 'id' });
                store.createIndex('name', 'name', { unique: false });
                store.createIndex('sellerItemID', 'sellerItemID', { unique: false });
                store.createIndex('cpvCode', 'cpvCode', { unique: false });
            }
        };

        req.onsuccess = (event) => {
            _catalogDb = event.target.result;
            resolve(_catalogDb);
        };

        req.onerror = (event) => {
            reject(event.target.error);
        };

        req.onblocked = () => {
            reject(new Error('indexeddb-blocked'));
        };
    });
}

// Export prefix pentru tests / consumeri care vor să verifice convenția.
export const STORAGE_PREFIX = KEY_PREFIX;
