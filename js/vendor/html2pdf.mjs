/**
 * js/vendor/html2pdf.mjs — ESM wrapper pentru html2pdf.js 0.10.2
 *
 * Încarcă bundle-ul UMD via <script> injection la primul apel.
 * Bundlul include html2canvas + jsPDF — ~900 KB, deci lazy loading.
 *
 * Utilizare:
 *   import getHtml2pdf from './vendor/html2pdf.mjs';
 *   const html2pdf = await getHtml2pdf();
 *   await html2pdf().set({ filename: 'factura.pdf' }).from(element).save();
 *
 * @see https://ekoopmans.github.io/html2pdf.js/
 * @version 0.10.2
 * @license MIT
 */

let _promise = null;

export default function getHtml2pdf() {
    if (globalThis.html2pdf) {
        return Promise.resolve(globalThis.html2pdf);
    }
    if (_promise) return _promise;

    _promise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        // Rezolvă calea relativ la locația fișierului curent (ESM import.meta.url)
        script.src = new URL('./html2pdf.bundle.min.js', import.meta.url).href;
        script.onload = () => {
            if (typeof globalThis.html2pdf === 'function') {
                resolve(globalThis.html2pdf);
            } else {
                reject(new Error('html2pdf.js bundle încărcat dar globalThis.html2pdf este undefined'));
            }
        };
        script.onerror = () => {
            _promise = null; // permite retry
            reject(new Error('Nu s-a putut încărca html2pdf.bundle.min.js'));
        };
        document.head.appendChild(script);
    });

    return _promise;
}
