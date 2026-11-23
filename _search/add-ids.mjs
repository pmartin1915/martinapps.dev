// add-ids.mjs: give every h2, h3 and FAQ question in a page's content (see contentRange) an id, so a search result can link straight to it.
// Adds attributes only; never changes text. Idempotent: elements that already have an id are left alone.
// Usage: node _search/add-ids.mjs [SITE_DIR]   (prints what it changed)
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contentRange, listContentPages, plainText } from './build-index.mjs';

const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));

export function slug(s) {
  return plainText(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48).replace(/-$/, '') || 'section';
}

export function addIds(html) {
  const r = contentRange(html);
  if (!r) return { html, added: 0 };
  const m = [html.slice(r[0], r[1])]; m.index = r[0];
  const taken = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((x) => x[1]));
  let added = 0;
  const main = m[0].replace(/<(h2|h3|p)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, (all, tag, attrs = '', inner) => {
    if (tag.toLowerCase() === 'p' && !/class="[^"]*\bfaq-q\b/.test(attrs)) return all;
    if (/\sid="/.test(attrs)) return all;
    let id = slug(inner), n = 2;
    while (taken.has(id)) id = slug(inner) + '-' + n++;
    taken.add(id); added++;
    return `<${tag} id="${id}"${attrs}>${inner}</${tag}>`;
  });
  return { html: html.slice(0, m.index) + main + html.slice(m.index + m[0].length), added };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (const p of listContentPages(root)) {
    const before = readFileSync(p.file, 'utf8');
    const { html, added } = addIds(before);
    if (added) { writeFileSync(p.file, html); console.log(`${p.url}: ${added} ids`); }
  }
}
