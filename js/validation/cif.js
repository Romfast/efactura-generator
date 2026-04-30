/**
 * js/validation/cif.js — PR-VALID-IDS (A9)
 * Validare CIF/CUI românesc prin sumă ponderată (mod 11, mod 10).
 * Funcție pură, fără efecte secundare, fără dependențe externe.
 */

// Greutățile pentru cifrele 1-9 (se aplică pe primele 9 cifre ale CIF-ului).
const WEIGHTS = [7, 5, 3, 2, 1, 7, 5, 3, 2];

/**
 * Validează un CIF/CUI românesc.
 *
 * Algoritm:
 *   1. Elimină prefixul "RO" dacă există (case-insensitive).
 *   2. Elimină spații.
 *   3. Verifică că are între 2 și 10 cifre.
 *   4. Completează cu zerouri la stânga până la 10 cifre.
 *   5. Calculează suma ponderată pe primele 9 cifre cu WEIGHTS.
 *   6. (sumă * 10) % 11 % 10 trebuie să fie egal cu cifra de control (ultima).
 *
 * @param {string} value — valoarea brută din câmp (poate fi goală, poate conține "RO")
 * @returns {{ valid: boolean, message: string }}
 */
export function validateCIF(value) {
    if (!value || value.trim() === '') {
        return { valid: true, message: '' }; // câmp gol — valid (nu e required check)
    }

    let normalized = value.trim().toUpperCase();

    // Elimină prefixul RO
    if (normalized.startsWith('RO')) {
        normalized = normalized.slice(2).trim();
    }

    // Elimină spații și cratime rămase
    normalized = normalized.replace(/[\s\-]/g, '');

    // Trebuie să conțină doar cifre
    if (!/^\d+$/.test(normalized)) {
        return { valid: false, message: 'CIF invalid: conține caractere nepermise' };
    }

    // Lungime: minim 2, maxim 10 cifre
    if (normalized.length < 2 || normalized.length > 10) {
        return { valid: false, message: 'CIF invalid: lungimea trebuie să fie între 2 și 10 cifre' };
    }

    // Completează cu zerouri la stânga până la 10 cifre
    const padded = normalized.padStart(10, '0');

    // Extrage primele 9 cifre (pentru ponderare) și cifra de control (ultima)
    const digits = padded.split('').map(Number);
    const checkDigit = digits[9];
    const controlDigits = digits.slice(0, 9);

    // Calculează suma ponderată
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += controlDigits[i] * WEIGHTS[i];
    }

    // Cifra de control calculată
    const computed = (sum * 10) % 11 % 10;

    if (computed !== checkDigit) {
        return { valid: false, message: 'CIF invalid: cifra de control nu se potrivește' };
    }

    return { valid: true, message: '' };
}
