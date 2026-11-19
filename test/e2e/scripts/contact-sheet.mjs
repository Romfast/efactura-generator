// Genereaza visual-baselines.html: toate baseline-urile PNG cu numele testului (pentru revizuire).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'visual-baselines');
const spec = fs.readFileSync(path.join(root, 'visual', 'visual.spec.ts'), 'utf8');

// nume baseline -> titlul testului (primul test( ... ) care mentioneaza numele)
const titles = {};
const blocks = spec.split(/\n\s*test\(/).slice(1);
for (const b of blocks) {
  const title = (/^[`'"](.+?)[`'"]/.exec(b) || [])[1] || '';
  for (const m of b.matchAll(/['"]([a-z0-9-]+)(?:\.png)?['"]/g)) titles[m[1]] ??= title;
}
titles['print-standard'] = 'print standard';
titles['print-compact'] = 'print compact';

const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort() : [];
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cards = files.map(f => {
  const n = f.replace(/\.png$/, '');
  const kb = Math.round(fs.statSync(path.join(dir, f)).size / 1024);
  return `<figure><figcaption><b>${esc(n)}</b><span>${esc(titles[n] || '')} &middot; ${kb} KB</span></figcaption>` +
    `<a href="visual-baselines/${f}" target="_blank"><img loading="lazy" src="visual-baselines/${f}" alt="${esc(n)}"></a></figure>`;
}).join('\n');

fs.writeFileSync(path.join(root, 'visual-baselines.html'), `<!doctype html><html lang="ro"><meta charset="utf-8">
<title>Baseline-uri vizuale (${files.length})</title>
<style>body{font:14px system-ui;margin:16px;background:#f4f4f2;color:#111}h1{font-size:18px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:16px;align-items:start}
figure{margin:0;background:#fff;border:1px solid #ccc;padding:8px}figcaption{display:flex;flex-direction:column;margin-bottom:6px}
figcaption span{color:#666;font-size:12px}img{max-width:100%;border:1px solid #ddd;display:block}</style>
<h1>Baseline-uri vizuale: ${files.length} imagini</h1><div class="grid">${cards}</div></html>`);
console.log(`visual-baselines.html: ${files.length} imagini`);
