/**
 * js/catalog.js — Catalog produse/servicii în IndexedDB (PR-A13)
 *
 * Folosește `openCatalog()` din storage.js (DB `efactura` v1, store `products`,
 * indexes: `name`, `sellerItemID`, `cpvCode`).
 *
 * Schema produs (v1):
 *   id:          string (UUID v4)
 *   name:        string — denumire produs/serviciu (indexed, searched by prefix)
 *   unit:        string — cod UM (EA, KGM, etc.)
 *   price:       string — preț unitar canonical decimal
 *   vatType:     string — cod tip TVA (S, AE, O, Z, E)
 *   vatRate:     string — cotă TVA (19, 9, 5, 0)
 *   description: string — descriere detaliată (opțional)
 *   sellerItemID: string — cod articol furnizor (opțional, indexed)
 *   cpvCode:     string — cod CPV (opțional, indexed)
 */

import { openCatalog } from './storage.js';

/**
 * Adaugă sau actualizează un produs în catalog.
 * Dacă `product.id` lipsește, generează UUID nou.
 * @param {Object} product
 * @returns {Promise<string>} ID-ul produsului salvat
 */
export async function catalogAdd(product) {
    const db    = await openCatalog();
    const entry = {
        id:           product.id || _uuid(),
        name:         (product.name         || '').trim(),
        unit:         (product.unit         || 'EA').trim(),
        price:        (product.price        || '0').trim(),
        vatType:      (product.vatType      || 'S').trim(),
        vatRate:      (product.vatRate      || '19').trim(),
        description:  (product.description  || '').trim(),
        sellerItemID: (product.sellerItemID || '').trim(),
        cpvCode:      (product.cpvCode      || '').trim(),
    };
    return new Promise((resolve, reject) => {
        const tx    = db.transaction('products', 'readwrite');
        const store = tx.objectStore('products');
        const req   = store.put(entry);
        req.onsuccess = () => resolve(entry.id);
        req.onerror   = () => reject(req.error);
    });
}

/**
 * Caută produse după prefix de denumire (case-insensitive prefix match).
 * Returnează max `limit` rezultate, sortate alfabetic.
 * @param {string} prefix
 * @param {number} limit
 * @returns {Promise<Array>}
 */
export async function catalogSearch(prefix, limit = 8) {
    if (!prefix || !prefix.trim()) return [];
    const db      = await openCatalog();
    const lower   = prefix.trim().toLowerCase();
    const results = [];

    return new Promise((resolve, reject) => {
        const tx    = db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const index = store.index('name');

        // Interval IDB: [lower, lower + '￿') pentru prefix match
        const range = IDBKeyRange.bound(lower, lower + '￿', false, false);

        // Scanăm cu cursor pe index name (lowercase nu e direct în IDB —
        // folosim open cursor pe tot și filtrăm client-side pentru robustețe)
        const allReq = index.openCursor();
        allReq.onsuccess = (e) => {
            const cursor = e.target.result;
            if (!cursor || results.length >= limit) {
                resolve(results);
                return;
            }
            const name = (cursor.value.name || '').toLowerCase();
            if (name.startsWith(lower)) {
                results.push(cursor.value);
            }
            cursor.continue();
        };
        allReq.onerror = () => reject(allReq.error);
    });
}

/**
 * Șterge un produs din catalog după ID.
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function catalogDelete(id) {
    const db = await openCatalog();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction('products', 'readwrite');
        const store = tx.objectStore('products');
        const req   = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror   = () => reject(req.error);
    });
}

/**
 * Listează toate produsele (pentru management catalog).
 * @returns {Promise<Array>}
 */
export async function catalogList() {
    const db = await openCatalog();
    return new Promise((resolve, reject) => {
        const tx    = db.transaction('products', 'readonly');
        const store = tx.objectStore('products');
        const req   = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => reject(req.error);
    });
}

/** Generează un UUID v4 simplu (crypto.randomUUID dacă disponibil, fallback manual). */
function _uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}
