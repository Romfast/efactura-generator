/**
 * js/validation/iban.js — PR-VALID-IDS (A10)
 * Validare IBAN internațional prin algoritmul ISO 13616 (mod 97).
 * Funcție pură, fără efecte secundare, fără dependențe externe.
 */

/**
 * Validează un IBAN (orice țară, inclusiv RO).
 *
 * Algoritm ISO 13616:
 *   1. Elimină spații și convertește la uppercase.
 *   2. Verifică lungimea minimă (4 caractere).
 *   3. Mută primele 4 caractere la sfârșitul șirului.
 *   4. Înlocuiește fiecare literă cu echivalentul numeric: A=10, B=11, ..., Z=35.
 *   5. Calculează numărul rezultat modulo 97 — trebuie să fie 1.
 *
 * Lungimi specifice per țară nu sunt forțate (validare structurală generică);
 * IBAN-ul RO are 24 caractere, verificat separat cu mesaj specific.
 *
 * @param {string} value — valoarea brută din câmp
 * @returns {{ valid: boolean, message: string }}
 */
export function validateIBAN(value) {
    if (!value || value.trim() === '') {
        return { valid: true, message: '' }; // câmp gol — valid (nu e required check)
    }

    // Normalizare: elimină spații, uppercase
    const normalized = value.trim().toUpperCase().replace(/\s/g, '');

    // Lungime minimă
    if (normalized.length < 4) {
        return { valid: false, message: 'IBAN invalid: lungime sau check digits' };
    }

    // Verifică că IBAN-ul conține doar litere și cifre
    if (!/^[A-Z0-9]+$/.test(normalized)) {
        return { valid: false, message: 'IBAN invalid: caractere nepermise' };
    }

    // IBAN RO trebuie să aibă exact 24 caractere
    if (normalized.startsWith('RO') && normalized.length !== 24) {
        return { valid: false, message: 'IBAN invalid: lungime sau check digits' };
    }

    // Rearanjare: primele 4 caractere la final
    const rearranged = normalized.slice(4) + normalized.slice(0, 4);

    // Înlocuiește literele cu cifre: A=10 ... Z=35
    const numericString = rearranged.replace(/[A-Z]/g, ch => String(ch.charCodeAt(0) - 55));

    // Calculează mod 97 pe un număr mare (string chunking pentru a evita overflow)
    let remainder = 0;
    for (let i = 0; i < numericString.length; i++) {
        remainder = (remainder * 10 + parseInt(numericString[i], 10)) % 97;
    }

    if (remainder !== 1) {
        return { valid: false, message: 'IBAN invalid: lungime sau check digits' };
    }

    return { valid: true, message: '' };
}
