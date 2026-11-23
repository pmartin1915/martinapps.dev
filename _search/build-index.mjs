// build-index.mjs: build the site search index (assets/search-index.json) from the pages themselves.
// No dependencies. Usage:
//   node _search/build-index.mjs           write assets/search-index.json
//   node _search/build-index.mjs --check   exit 1 if the committed index is not what a rebuild would write
//
// What is indexed: the <main> of every served .html page, split into sections at each h1, h2, h3 and FAQ question.
// Left out by rule, never by a list: folders starting with . or _ (not served), ai/, pages with a robots noindex,
// pages that redirect (meta refresh), and pages that opt out with
// <meta name="site-search" content="skip">.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SITE = path.resolve(HERE, '..');
export const INDEX_FILE = 'assets/search-index.json';

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rarr: '→', larr: '←',
  middot: '·', trade: '', reg: '', copy: '©', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', hellip: '…', deg: '°', times: '×', bull: '•' };
export const decode = (s) => s.replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENT[e.toLowerCase()] ?? m));
export const plainText = (html) => decode(html
  .replace(/<!--[\s\S]*?-->/g, ' ')
  .replace(/<(script|style|svg|template|noscript|button|form|dialog)\b[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ''))
  .replace(/\s+/g, ' ').trim();

const PRODUCTS = { boardbound: 'BoardBound', 'burn-wizard': 'Burn Wizard', wilderness: 'Wilderness Survival Companion', shortless: 'Shortless',
  scrollometer: 'Scrollometer', retold: 'Retold', tellfolk: 'Tellfolk' };

// legal = policies and terms; help = support and account pages; company = home and about; product = everything else
export function pageType(url) {
  if (/privacy|terms/.test(url)) return 'legal';
  if (/support|delete-account|\/search\//.test(url)) return 'help';
  if (url === '/' || url === '/about/') return 'company';
  return 'product';
}

// The part of a page that is its content: <main>, or on the few pages without one (Retold, Tellfolk) the <body>
// from its start up to the page footer (<footer> or <div class="footer">). Returns [start, end] offsets or null.
export function contentRange(html) {
  const m = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html);
  if (m) return [m.index + m[0].indexOf('>') + 1, m.index + m[0].length - 7];
  const b = /<body\b[^>]*>/i.exec(html); if (!b) return null;
  const start = b.index + b[0].length;
  const rest = html.slice(start);
  const end = rest.search(/<footer\b|<div\s+class="footer"|<\/body>/i);
  return end < 0 ? null : [start, start + end];
}

export function listContentPages(root = SITE) {
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) { if (!/^[._]/.test(name) && name !== 'ai' && name !== 'node_modules') walk(p); continue; }
      if (!name.endsWith('.html')) continue;
      const html = readFileSync(p, 'utf8');
      if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html) || /<meta[^>]+http-equiv="refresh"/i.test(html)) continue;
      if (/<meta[^>]+name="site-search"[^>]+content="skip"/i.test(html)) continue;
      if (!contentRange(html)) continue;
      const rel = path.relative(root, p).split(path.sep).join('/');
      out.push({ file: p, url: '/' + rel.replace(/(^|\/)index\.html$/, '$1'), html });
    }
  })(root);
  return out;
}

const meta = (html, name) => decode((html.match(new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]*)"`, 'i')) || [, ''])[1]).trim();
// "BoardBound - Martin Apps" -> "BoardBound"; "Privacy Policy — Wilderness" stays
export const cleanTitle = (t) => decode(t).replace(/\s*[-—|]\s*Martin Apps( LLC)?\s*$/i, '').trim();

// One page -> its sections. Section 0 is the page itself (title, description and any text before the first heading).
export function sectionsOf(page) {
  const { html, url } = page;
  const [a, b] = contentRange(html);
  const main = html.slice(a, b).replace(/<(header|nav)\b[\s\S]*?<\/\1>/gi, ' ');
  const title = cleanTitle((html.match(/<title>([^<]*)<\/title>/i) || [, ''])[1]);
  const desc = meta(html, 'description');
  const seg = url.split('/')[1];
  const product = PRODUCTS[seg] || 'Martin Apps';
  const type = pageType(url);
  const parts = main.split(/(?=<h[1-3][\s>])|(?=<p\s[^>]*class="[^"]*\bfaq-q\b)/i);
  const out = [];
  for (const part of parts) {
    const hm = part.match(/^<(h[1-3]|p)(\s[^>]*)?>([\s\S]*?)<\/\1>/i);
    const heading = hm ? plainText(hm[3]) : '';
    const anchor = hm ? ((hm[2] || '').match(/\sid="([^"]+)"/) || [, ''])[1] : '';
    const isH1 = hm && hm[1].toLowerCase() === 'h1';
    const body = plainText(hm ? part.slice(hm[0].length) : part);
    if (!out.length || isH1) {
      // the page's own section: the h1 and the text before the first h2 belong to it
      if (!out.length) out.push({ url, anchor: '', title, heading: isH1 ? heading : '', desc, body, product, type, faq: false });
      else { const s0 = out[0]; s0.heading = s0.heading || heading; s0.body = (s0.body + ' ' + body).trim(); }
      continue;
    }
    if (!heading && !body) continue;
    out.push({ url, anchor, title: '', heading, desc: '', body, product, type, faq: !!hm && hm[1].toLowerCase() === 'p' });
  }
  return out;
}

export function buildIndex(root = SITE) {
  const pages = listContentPages(root);
  const docs = [];
  for (const p of pages) for (const s of sectionsOf(p)) docs.push({ id: docs.length, pageTitle: cleanTitle((p.html.match(/<title>([^<]*)<\/title>/i) || [, ''])[1]), ...s });
  return { v: 1, docs };
}

// Stable text, one section per line, so a diff of the index reads well.
export function serialize(index) {
  return '{"v":' + index.v + ',"docs":[\n' + index.docs.map((d) => JSON.stringify(d)).join(',\n') + '\n]}\n';
}

export function checkIndex(root = SITE) {
  const want = serialize(buildIndex(root));
  const f = path.join(root, INDEX_FILE);
  const have = existsSync(f) ? readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : null;
  return { fresh: have === want, missing: have === null };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--check')) {
    const r = checkIndex();
    if (r.fresh) { console.log('search index is up to date'); process.exit(0); }
    console.error(r.missing ? `${INDEX_FILE} is missing` : `${INDEX_FILE} is stale: the pages changed since it was built`);
    console.error('fix: node _search/build-index.mjs');
    process.exit(1);
  }
  const idx = buildIndex();
  writeFileSync(path.join(SITE, INDEX_FILE), serialize(idx));
  console.log(`wrote ${INDEX_FILE}: ${idx.docs.length} sections from ${new Set(idx.docs.map((d) => d.url)).size} pages`);
}
