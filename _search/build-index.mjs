// build-index.mjs: build the site search index (assets/search-index.json) from the pages themselves.
// No dependencies. Usage:
//   node _search/build-index.mjs           write assets/search-index.json, the /search/ page list and sitemap.xml
//   node _search/build-index.mjs --check   exit 1 if any of the three is not what a rebuild would write
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
  // inline formatting joins (Board<b>Bound</b>); every other tag is a word break (<span>iPhone</span><span>Android</span>)
  .replace(/<\/?(b|strong|i|em|u|mark|small|sup|sub|abbr|code|s|q|wbr)\b[^>]*>/gi, '')
  .replace(/<[^>]+>/g, ' '))
  .replace(/\s+/g, ' ').replace(/ ([,.;:!?)])/g, '$1').replace(/\( /g, '(').trim();

const PRODUCTS = { boardbound: 'BoardBound', 'burn-wizard': 'Burn Wizard', wilderness: 'Wilderness Survival Companion', shortless: 'Shortless',
  scrollometer: 'Scrollometer', retold: 'Retold', tellfolk: 'Tellfolk' };

// legal = policies and terms; help = support and account pages; company = home and about; hub = the apps list; product = everything else
export function pageType(url) {
  if (/privacy|terms/.test(url)) return 'legal';
  if (/support|delete-account|\/search\//.test(url)) return 'help';
  if (url === '/' || url === '/about/') return 'company';
  if (url === '/apps/') return 'hub';
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
    const rest = hm ? part.slice(hm[0].length) : part;
    const body = plainText(rest);
    // tags: the facts a section states as labels (chips like "iPhone", "Android", "Free") and store badges' alt text
    const tags = [...[...rest.matchAll(/<span[^>]*class="[^"]*\bchip\b[^"]*"[^>]*>([\s\S]*?)<\/span>/gi)].map((m) => plainText(m[1])),
      ...[...rest.matchAll(/<img[^>]*\balt="([^"]+)"/gi)].map((m) => decode(m[1])).filter((a) => /App Store|Google Play/i.test(a))].join(' ');
    if (!out.length || isH1) {
      // the page's own section: the h1 and the text before the first h2 belong to it
      if (!out.length) out.push({ url, anchor: '', title, heading: isH1 ? heading : '', desc, tags, body, product, type, faq: false });
      else { const s0 = out[0]; s0.heading = s0.heading || heading; s0.body = (s0.body + ' ' + body).trim(); s0.tags = (s0.tags + ' ' + tags).trim(); }
      continue;
    }
    if (!heading && !body) continue;
    out.push({ url, anchor, title: '', heading, desc: '', tags, body, product, type, faq: !!hm && hm[1].toLowerCase() === 'p' });
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

// The no-JavaScript list of every page on /search/, grouped by product, between two markers in search/index.html.
export const DIRECTORY_FILE = 'search/index.html';
const ORDER = ['Martin Apps', 'BoardBound', 'Burn Wizard', 'Wilderness Survival Companion', 'Shortless', 'Scrollometer', 'Retold', 'Tellfolk'];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function directoryHtml(index) {
  const groups = new Map();
  for (const d of index.docs) {
    if (d.anchor) continue;
    if (!groups.has(d.product)) groups.set(d.product, []);
    groups.get(d.product).push(d);
  }
  const names = [...groups.keys()].sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b));
  const typeRank = { company: 0, hub: 1, product: 2, help: 3, legal: 4 };
  return names.map((n) => {
    const items = groups.get(n).sort((a, b) => typeRank[a.type] - typeRank[b.type] || a.url.localeCompare(b.url))
      .map((d) => `    <li><a href="${esc(d.url)}">${esc(d.pageTitle)}</a></li>`).join('\n');
    return `  <h3>${esc(n === 'Martin Apps' ? 'The company' : n)}</h3>\n  <ul>\n${items}\n  </ul>`;
  }).join('\n');
}
const DIR_RE = /(<!-- directory:start[^>]*-->\n)[\s\S]*?(<!-- directory:end -->)/;
export function withDirectory(html, dir) { return html.replace(/\r\n/g, '\n').replace(DIR_RE, (m, a, b) => `${a}${dir}\n${b}`); }

// sitemap.xml for search engines: the same pages the search indexes, each at its canonical address. /search/ is left
// out on purpose (it opts out of the index with site-search skip): it only lists other pages, and search engines
// should land on those pages, not on a list of them.
export const SITEMAP_FILE = 'sitemap.xml';
export function sitemapXml(root = SITE) {
  const urls = listContentPages(root).map((p) => (p.html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i) || [, 'https://martinapps.dev' + p.url])[1]);
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + [...new Set(urls)].sort().map((u) => `  <url><loc>${esc(u)}</loc></url>`).join('\n') + '\n</urlset>\n';
}

export function checkIndex(root = SITE) {
  const idx = buildIndex(root);
  const want = serialize(idx);
  const f = path.join(root, INDEX_FILE);
  const have = existsSync(f) ? readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : null;
  const df = path.join(root, DIRECTORY_FILE);
  const page = existsSync(df) ? readFileSync(df, 'utf8').replace(/\r\n/g, '\n') : null;
  const dirFresh = page !== null && DIR_RE.test(page) && withDirectory(page, directoryHtml(idx)) === page;
  const sf = path.join(root, SITEMAP_FILE);
  const sitemapFresh = existsSync(sf) && readFileSync(sf, 'utf8').replace(/\r\n/g, '\n') === sitemapXml(root);
  return { fresh: have === want && dirFresh && sitemapFresh, missing: have === null, indexFresh: have === want, dirFresh, sitemapFresh };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.argv.includes('--check')) {
    const r = checkIndex();
    if (r.fresh) { console.log('search index is up to date'); process.exit(0); }
    if (!r.indexFresh) console.error(r.missing ? `${INDEX_FILE} is missing` : `${INDEX_FILE} is stale: the pages changed since it was built`);
    if (!r.dirFresh) console.error(`the page list on ${DIRECTORY_FILE} is stale`);
    if (!r.sitemapFresh) console.error(`${SITEMAP_FILE} is stale`);
    console.error('fix: node _search/build-index.mjs');
    process.exit(1);
  }
  const idx = buildIndex();
  writeFileSync(path.join(SITE, INDEX_FILE), serialize(idx));
  const df = path.join(SITE, DIRECTORY_FILE);
  if (existsSync(df)) writeFileSync(df, withDirectory(readFileSync(df, 'utf8'), directoryHtml(idx)));
  writeFileSync(path.join(SITE, SITEMAP_FILE), sitemapXml());
  console.log(`wrote ${INDEX_FILE}: ${idx.docs.length} sections from ${new Set(idx.docs.map((d) => d.url)).size} pages, the page list on ${DIRECTORY_FILE}, and ${SITEMAP_FILE}`);
}
