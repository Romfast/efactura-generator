// test/assert.js
//
// Mini test framework, ~50 LOC, zero deps, ESM. Folosit de PR-E (numeric)
// și PR-E (regression). Renderizează ✓/✗ în DOM + console.log.
//
// API:
//   - test(name, fn)
//   - assertEqual(a, b, [msg])
//   - assertClose(a, b, eps, [msg])
//   - assertTrue(cond, [msg])
//   - assertThrows(fn, [msg])
//
// La sfârșit, apelează `report()` ca să se afișeze sumarul.

let _passed = 0;
let _failed = 0;
let _container = null;

function _ensureContainer() {
    if (_container) return _container;
    _container = document.getElementById('test-results');
    if (!_container) {
        _container = document.createElement('div');
        _container.id = 'test-results';
        document.body.appendChild(_container);
    }
    return _container;
}

function _row(passed, name, msg) {
    const el = document.createElement('div');
    el.className = passed ? 'test-pass' : 'test-fail';
    el.textContent = (passed ? '✓ ' : '✗ ') + name + (msg ? ' — ' + msg : '');
    _ensureContainer().appendChild(el);
    if (passed) console.log('PASS', name); else console.error('FAIL', name, msg || '');
}

export function test(name, fn) {
    try {
        fn();
        _passed++;
        _row(true, name);
    } catch (err) {
        _failed++;
        _row(false, name, err && err.message ? err.message : String(err));
    }
}

function _stringify(v) {
    if (v === null || v === undefined) return String(v);
    if (typeof v === 'object' && typeof v.toString === 'function') return v.toString();
    return String(v);
}

export function assertEqual(a, b, msg) {
    const sa = _stringify(a), sb = _stringify(b);
    if (sa !== sb) throw new Error((msg || 'assertEqual') + `: expected ${sb}, got ${sa}`);
}

export function assertClose(a, b, eps, msg) {
    const na = Number(_stringify(a)), nb = Number(_stringify(b));
    const e = Number(_stringify(eps));
    if (!Number.isFinite(na) || !Number.isFinite(nb)) {
        throw new Error((msg || 'assertClose') + `: non-finite (a=${a}, b=${b})`);
    }
    if (Math.abs(na - nb) > e) {
        throw new Error((msg || 'assertClose') + `: |${na} - ${nb}| > ${e}`);
    }
}

export function assertTrue(cond, msg) {
    if (!cond) throw new Error(msg || 'assertTrue: condition was falsy');
}

export function assertThrows(fn, msg) {
    let threw = false;
    try { fn(); } catch (_) { threw = true; }
    if (!threw) throw new Error(msg || 'assertThrows: function did not throw');
}

export function report() {
    const total = _passed + _failed;
    const banner = document.createElement('div');
    banner.id = 'test-banner';
    banner.className = _failed === 0 ? 'banner-pass' : 'banner-fail';
    banner.textContent = `${_passed} / ${total} passed` + (_failed > 0 ? ` (${_failed} failed)` : '');
    _ensureContainer().prepend(banner);
    return { passed: _passed, failed: _failed };
}
