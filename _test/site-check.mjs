#!/usr/bin/env node
// site-check.mjs: open every page of martinapps.dev in headless Chrome at phone and desktop width and
// fail on what a visitor would hit. No dependencies (Node 22+, Chrome or Edge), no network unless --live.
//
//   node _test/site-check.mjs                  serve this folder locally and check every page
//   node _test/site-check.mjs --live           check https://martinapps.dev instead (after a push)
//   node _test/site-check.mjs --shots DIR      also save a full-page PNG per page and width
//   node _test/site-check.mjs --only /about/   one page (repeatable, or comma-separated)
//   node _test/site-check.mjs --json           machine-readable report on stdout
//   node _test/site-check.mjs --self-test      run against _test/fixtures (a known-bad mini site) and
//                                             check the checker finds every planted fault
//
// Checks, per page and width (phone 390x844 touch, desktop 1280x800):
//   page errors      uncaught exceptions and console.error
//   bad requests     any same-site request that fails or returns 400+ (fonts, images, scripts, css)
//   sideways scroll  the page is wider than the screen; names the element sticking out
//   broken images    an <img> that finished loading with no pixels
//   basics           exactly one <title>, a meta description, a viewport meta, at least one <h1>,
//                    alt on every <img> (alt="" is fine: decorative)
//   links            every same-site href and #fragment resolves (a file here, or the id on the page)
//   accessibility    axe-core 4.10.2 (vendored in _test/vendor, MPL-2.0), WCAG 2.1 A/AA rules: a serious or critical
//                    finding fails, a moderate or minor one is a note. Light mode only (dark: the one-off audit in
//                    ai/STATE.md).
//
// Exit 0 all clear (notes allowed), 1 failures, 2 could not run. A missing meta description is a note. Store links (App Store, Play) are Store Watch's job
// (dev-ops scripts/store-watch.mjs), so external links are listed but not fetched.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const LIVE = 'https://martinapps.dev';
const WIDTHS = [{ name: 'phone', w: 390, h: 844, mobile: true }, { name: 'desktop', w: 1280, h: 800, mobile: false }];
const SKIP_DIRS = new Set(['ai', 'assets', 'node_modules']);   // and any folder starting with . or _ (GitHub Pages does not publish _ folders)
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4', '.webm': 'video/webm', '.vtt': 'text/vtt', '.txt': 'text/plain', '.xml': 'application/xml', '.pdf': 'application/pdf' };

// ---------- the site on disk ----------
export function listPages(root) {
  const out = [];
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !/^[._]/.test(e.name)) walk(path.join(dir, e.name)); continue; }
      if (!e.name.endsWith('.html')) continue;
      const rel = path.relative(root, path.join(dir, e.name)).split(path.sep).join('/');
      out.push('/' + (rel === 'index.html' ? '' : rel.replace(/(^|\/)index\.html$/, '$1')));
    }
  })(root);
  return out.sort();
}

// How GitHub Pages answers a path: the file, dir/index.html, or name.html. Returns the file or null.
export function resolveFile(root, urlPath) {
  let p; try { p = decodeURIComponent(urlPath.split(/[?#]/)[0]); } catch { return null; }
  const abs = path.join(root, p);
  if (!abs.startsWith(root)) return null;
  const tries = p.endsWith('/') ? [path.join(abs, 'index.html')] : [abs, path.join(abs, 'index.html'), abs + '.html'];
  return tries.find((f) => existsSync(f) && statSync(f).isFile()) || null;
}

export function serve(root) {
  const srv = createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const f = resolveFile(root, u.pathname);
    if (f && !u.pathname.endsWith('/') && existsSync(path.join(root, decodeURIComponent(u.pathname), 'index.html'))) {
      res.writeHead(301, { Location: u.pathname + '/' + u.search }); return res.end();   // GitHub Pages adds the slash to a folder
    }
    if (!f) { const nf = path.join(root, '404.html'); res.writeHead(404, { 'Content-Type': TYPES['.html'] }); return res.end(existsSync(nf) ? readFileSync(nf) : 'not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream' }); res.end(readFileSync(f));
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r({ srv, base: `http://127.0.0.1:${srv.address().port}` })));
}

const AXE_FILE = path.join(HERE, 'vendor', 'axe-4.10.2.min.js');
const AXE = existsSync(AXE_FILE) ? readFileSync(AXE_FILE, 'utf8') : null;   // checked in run(): a missing file stops the run, never skips the check quietly
const AXE_RUN = `axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
  .then((r) => r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, n: v.nodes.length, at: v.nodes[0].target.join(' ') })))`;

// ---------- Chrome over the DevTools protocol (same approach as brand/mascot/lite/tools/eyes.mjs) ----------
// child.kill() ends only Chrome's browser process on Windows; its GPU, renderer and utility children keep running
// with the temp profile locked (2026-11-27: ~22 orphan headless Chromes held ~11 GB). taskkill /T takes the whole tree.
export function killTree(child) {
  if (!child || child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === 'win32') {
    try { spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch {}
  }
  try { child.kill(); } catch {} // POSIX (and a fallback if taskkill was missing): the process itself
}

export async function openChrome() {
  const BROWSERS = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'];
  const exe = process.env.CHROME || BROWSERS.find(existsSync);
  if (!exe) throw new Error('no Chrome or Edge found (set CHROME=path)');
  const prof = mkdtempSync(path.join(tmpdir(), 'site-check-'));
  const child = spawn(exe, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--mute-audio',
    '--remote-debugging-port=0', '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
  let port = null;
  for (let i = 0; i < 200 && !port; i++) { const f = path.join(prof, 'DevToolsActivePort'); if (existsSync(f)) port = Number(readFileSync(f, 'utf8').split('\n')[0]); else await sleep(100); }
  if (!port) { killTree(child); throw new Error('Chrome did not open a debug port'); }
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  let id = 0; const pend = new Map(), listeners = new Set();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else for (const l of listeners) l(m);
  });
  const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
  const close = async () => { try { ws.close(); } catch {} killTree(child); await sleep(300); try { rmSync(prof, { recursive: true, force: true }); } catch {} };
  return { send, listeners, close };
}

// Runs inside the page after load. Returns plain JSON.
const PROBE = `(() => {
  const de = document.documentElement, cw = de.clientWidth, out = {};
  out.scrollW = Math.max(de.scrollWidth, document.body ? document.body.scrollWidth : 0); out.clientW = cw;
  const wide = [];
  if (out.scrollW > cw + 1) for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.right <= cw + 1) continue;
    let clipped = false;   // ignore anything inside a box that hides or scrolls its own overflow
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== 'visible') { clipped = true; break; } }
    if (clipped || [...el.children].some((c) => c.getBoundingClientRect().right > cw + 1)) continue;   // report the deepest one
    wide.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).join('.') : '') + ' (right edge ' + Math.round(r.right) + 'px)');
    if (wide.length >= 3) break;
  }
  out.wide = wide;
  out.titles = document.querySelectorAll('head > title').length; out.title = document.title.trim();
  out.desc = (document.querySelector('meta[name="description"]') || {}).content || '';
  out.viewport = !!document.querySelector('meta[name="viewport"]');
  out.refresh = !!document.querySelector('meta[http-equiv="refresh" i]'); out.path = location.pathname;
  out.h1 = document.querySelectorAll('h1').length;
  out.noAlt = [...document.images].filter((i) => !i.hasAttribute('alt')).map((i) => i.getAttribute('src'));
  out.brokenImg = [...document.images].filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src') && i.loading !== 'lazy').map((i) => i.getAttribute('src'));
  out.ids = [...document.querySelectorAll('[id]')].map((e) => e.id).concat([...document.querySelectorAll('a[name]')].map((a) => a.name));
  out.links = [...document.querySelectorAll('a[href], link[href], img[src], script[src], source[src], video[poster], track[src]')]
    .map((e) => e.getAttribute('href') || e.getAttribute('src') || e.getAttribute('poster')).filter(Boolean);
  return out;
})()`;

async function checkPage(cdp, base, page, width, shotsDir) {
  const { send, listeners } = cdp;
  const errors = [], bad = [];
  const origin = new URL(base).origin;
  const on = (m) => {
    if (m.method === 'Runtime.exceptionThrown') { const d = m.params.exceptionDetails; errors.push(d.exception?.description?.split('\n')[0] || d.text); }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map((a) => a.value ?? a.description).join(' '));
    if (m.method === 'Network.responseReceived') { const r = m.params.response; if (r.url.startsWith(origin) && r.status >= 400 && m.params.type !== 'Document') bad.push(`${r.status} ${r.url.slice(origin.length)}`); }
    if (m.method === 'Network.loadingFailed' && !m.params.canceled && reqs.get(m.params.requestId)?.startsWith(origin)) bad.push(`${m.params.errorText} ${reqs.get(m.params.requestId).slice(origin.length)}`);
    if (m.method === 'Network.requestWillBeSent') reqs.set(m.params.requestId, m.params.request.url);
  };
  const reqs = new Map();
  listeners.add(on);
  try {
    await send('Emulation.setDeviceMetricsOverride', { width: width.w, height: width.h, deviceScaleFactor: 1, mobile: width.mobile });
    await send('Emulation.setTouchEmulationEnabled', { enabled: width.mobile });
    const nav = await send('Page.navigate', { url: base + page });
    if (nav.errorText) return { errors: [nav.errorText], bad, probe: null };
    for (let i = 0; i < 150; i++) { const r = await send('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }); if (r.result.value === 'complete') break; await sleep(100); }
    await sleep(700);   // let scripts settle (the Builder scenes, the hammer toss)
    const r = await send('Runtime.evaluate', { expression: PROBE, returnByValue: true });
    const probe = r.result.value || null;
    if (!probe) errors.push('probe failed: ' + JSON.stringify(r.exceptionDetails?.text));
    let axe = null;
    if (AXE && probe && !probe.refresh) {
      await sleep(1500);   // entrance animations finish first, so contrast is measured on the settled page
      await send('Runtime.evaluate', { expression: AXE });
      const a = await send('Runtime.evaluate', { expression: AXE_RUN, awaitPromise: true, returnByValue: true });
      axe = a.result.value || null;
      if (!axe) errors.push('axe failed: ' + JSON.stringify(a.exceptionDetails?.text));
    }
    if (shotsDir) {
      const m = await send('Page.getLayoutMetrics');
      const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: Math.ceil(m.cssContentSize.width), height: Math.min(Math.ceil(m.cssContentSize.height), 12000), scale: 1 } });
      const name = (page.replace(/^\/|\/$/g, '').replace(/[\/.]/g, '_') || 'home') + '.' + width.name + '.png';
      writeFileSync(path.join(shotsDir, name), Buffer.from(s.data, 'base64'));
    }
    return { errors, bad, probe, axe };
  } finally { listeners.delete(on); }
}

// ---------- judging ----------
export function judge(page, width, res, ctx) {
  const f = [], add = (kind, msg) => f.push({ page, width: width.name, kind, msg });
  // a page that forwarded (the old storycue/ stubs) is judged only on where it landed; that page is crawled on its own
  if (res.probe && res.probe.path !== new URL(ctx.base + page).pathname) {
    if (width.name === 'phone' && !resolveFile(ctx.root, res.probe.path)) add('link', `forwards to ${res.probe.path}, which does not exist`);
    return f;
  }
  for (const e of res.errors) add('page error', e);
  for (const b of new Set(res.bad)) add('bad request', b);
  const p = res.probe; if (!p) return f;
  if (p.scrollW > p.clientW + 1) add('sideways scroll', `page is ${p.scrollW}px wide on a ${p.clientW}px screen` + (p.wide.length ? '; sticking out: ' + p.wide.join(', ') : ''));
  for (const s of p.brokenImg) add('broken image', s);
  for (const v of res.axe || []) add(/serious|critical/.test(v.impact) ? 'accessibility' : 'note', `${v.id} (${v.impact}): ${v.help}; ${v.n} element(s), first: ${v.at}`);
  if (width.name !== 'phone') return f;   // the rest does not depend on width: check once
  if (p.refresh) return f;   // a slow redirect stub: only errors and requests matter
  if (p.titles !== 1 || !p.title) add('basics', p.titles === 0 || !p.title ? 'no <title>' : `${p.titles} <title> tags`);
  if (!p.desc.trim()) add('note', 'no meta description (search results show a scrap of page text instead)');
  if (!p.viewport) add('basics', 'no viewport meta (phones will zoom out)');
  if (p.h1 < 1) add('basics', 'no <h1>');
  for (const s of p.noAlt) add('basics', `<img src="${s}"> has no alt attribute`);
  for (const href of new Set(p.links)) {
    let u; try { u = new URL(href, ctx.base + page); } catch { add('link', `unparseable href "${href}"`); continue; }
    if (!/^https?:$/.test(u.protocol)) continue;   // mailto:, tel:, data:
    if (u.origin !== new URL(ctx.base).origin && u.origin !== LIVE) { ctx.external.add(u.href); continue; }
    const samePage = u.pathname === new URL(ctx.base + page).pathname;
    if (!samePage && !resolveFile(ctx.root, u.pathname)) { add('link', `${href} -> nothing at ${u.pathname}`); continue; }
    if (u.hash && u.hash.length > 1) {
      const frag = decodeURIComponent(u.hash.slice(1));
      if (samePage) { if (!p.ids.includes(frag)) add('link', `${href} -> no id "${frag}" on this page`); }
      else ctx.fragments.push({ page, href, target: u.pathname, frag });
    }
  }
  return f;
}

// Notes are printed but do not fail the run: worth fixing, nothing a visitor trips over.
export const isFail = (x) => x.kind !== 'note';

function report(findings, ctx, pages, mode) {
  const fails = findings.filter(isFail).length, notes = findings.length - fails;
  const lines = [`site-check (${mode}): ${pages.length} pages x ${WIDTHS.length} widths`];
  if (!fails) lines.push('All clear' + (notes ? ` (${notes} note${notes > 1 ? 's' : ''} below).` : '.'));
  const byPage = new Map();
  for (const x of findings) { if (!byPage.has(x.page)) byPage.set(x.page, []); byPage.get(x.page).push(x); }
  for (const [pg, list] of byPage) { lines.push('', pg); for (const x of list) lines.push(`  [${x.width}] ${x.kind}: ${x.msg}`); }
  lines.push('', `${fails} failure(s), ${notes} note(s). External links seen (not fetched; store links are Store Watch's job): ${ctx.external.size}.`);
  return lines.join('\n');
}

export async function run({ root = SITE, live = false, only = [], shots = null } = {}) {
  if (!AXE) throw new Error('the accessibility checker is missing: ' + AXE_FILE + ' (restore it from git)');
  let server = null, base = LIVE;
  if (!live) { server = await serve(root); base = server.base; }
  let pages = listPages(root);
  if (only.length) pages = pages.filter((p) => only.includes(p));
  if (shots) mkdirSync(shots, { recursive: true });
  const cdp = await openChrome();
  const ctx = { root, base, external: new Set(), fragments: [] };
  const findings = [], idsByPage = new Map();
  try {
    await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    for (const page of pages) for (const width of WIDTHS) {
      const res = await checkPage(cdp, base, page, width, shots);
      if (res.probe) idsByPage.set(page, res.probe.ids);
      findings.push(...judge(page, width, res, ctx));
    }
    // fragments that point at another page: check the id exists there (open it if it was not crawled)
    for (const fr of ctx.fragments) {
      const target = listPages(root).find((p) => resolveFile(root, p) === resolveFile(root, fr.target));
      if (target && !idsByPage.has(target)) { const r = await checkPage(cdp, base, target, WIDTHS[1], null); idsByPage.set(target, r.probe?.ids || []); }
      const ids = target ? idsByPage.get(target) : [];
      if (!ids.includes(fr.frag)) {
        // the redesign forwards old home anchors (/#burn-wizard) with a script, so only flag it when the page has no forwarder for it
        const html = readFileSync(resolveFile(root, fr.target), 'utf8');
        if (![`'${fr.frag}'`, `"${fr.frag}"`, `'#${fr.frag}'`, `"#${fr.frag}"`].some((q) => html.includes(q))) findings.push({ page: fr.page, width: 'phone', kind: 'link', msg: `${fr.href} -> no id "${fr.frag}" on ${fr.target}` });
      }
    }
  } finally { await cdp.close(); if (server) server.srv.close(); }
  // site search: the index and the /search/ page list must match the pages, and every header carries the Search link
  const indexer = path.join(root, '_search', 'build-index.mjs');
  if (!live && existsSync(indexer)) {
    const { checkIndex } = await import(pathToFileURL(indexer).href);
    const r = checkIndex(root);
    if (!r.indexFresh) findings.push({ page: '/assets/search-index.json', width: '-', kind: 'search', msg: (r.missing ? 'missing' : 'stale: pages changed since it was built') + ' (fix: node _search/build-index.mjs)' });
    if (!r.dirFresh) findings.push({ page: '/search/', width: '-', kind: 'search', msg: 'the list of every page is stale (fix: node _search/build-index.mjs)' });
    if (r.sitemapFresh === false) findings.push({ page: '/sitemap.xml', width: '-', kind: 'search', msg: 'missing or stale (fix: node _search/build-index.mjs)' });
    for (const p of pages) {
      const f = resolveFile(root, p), h = f ? readFileSync(f, 'utf8') : '';
      if (/class="site-header"/.test(h) && !/class="search-link"/.test(h)) findings.push({ page: p, width: '-', kind: 'search', msg: 'the header has no Search link (fix: node _search/add-header-link.mjs)' });
    }
  }
  return { pages, findings, ctx, mode: live ? 'live ' + LIVE : 'local ' + root };
}

// ---------- self-test: a mini site with one of each fault planted ----------
async function selfTest() {
  const FIX = path.join(HERE, 'fixtures', 'bad-site');
  const { findings } = await run({ root: FIX });
  const has = (pg, kind, re) => findings.some((x) => x.page === pg && x.kind === kind && re.test(x.msg));
  const checks = [
    [has('/', 'page error', /boom/), 'finds an uncaught exception'],
    [has('/', 'bad request', /404 \/missing\.css/), 'finds a stylesheet that 404s'],
    [findings.some((x) => x.page === '/' && x.width === 'phone' && x.kind === 'sideways scroll' && /div\.too-wide/.test(x.msg)), 'finds sideways scroll at phone width and names the element'],
    [!findings.some((x) => x.page === '/' && x.width === 'desktop' && x.kind === 'sideways scroll'), 'no sideways scroll at desktop for a 600px box'],
    [has('/', 'link', /\/nowhere\/ -> nothing/), 'finds a dead internal link'],
    [has('/', 'link', /#nope -> no id "nope" on this page/), 'finds a dead #fragment'],
    [has('/', 'link', /\/good\/#absent -> no id "absent"/), 'finds a dead #fragment on another page'],
    [has('/', 'broken image', /missing\.png/), 'finds a broken image'],
    [has('/', 'basics', /no alt attribute/), 'finds an image with no alt'],
    [has('/', 'accessibility', /color-contrast \(serious\)/), 'finds text that fails the contrast minimum (axe)'],
    [has('/', 'note', /no meta description/), 'notes a missing meta description (a note, not a failure)'],
    [has('/good/', 'basics', /./) === false && !findings.some((x) => x.page === '/good/'), 'a clean page has no findings'],
    [!findings.some((x) => x.page === '/redirect.html' && x.kind !== 'page error'), 'a meta-refresh stub that forwards is not judged as the page it lands on'],
  ];
  let fails = 0;
  for (const [ok, what] of checks) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`); if (!ok) fails++; }
  if (fails) console.log('\nwhat it found:\n' + findings.map((x) => `  ${x.page} [${x.width}] ${x.kind}: ${x.msg}`).join('\n'));
  console.log(fails ? `\n${fails} FAILED` : '\nall passed');
  return fails ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), opt = { only: [] };
  for (let i = 0; i < a.length; i++) {
    if (a[i] === '--live') opt.live = true; else if (a[i] === '--json') opt.json = true; else if (a[i] === '--self-test') opt.self = true;
    else if (a[i] === '--shots') opt.shots = path.resolve(a[++i]); else if (a[i] === '--only') opt.only.push(...a[++i].split(','));
    else { console.error('unknown argument ' + a[i]); process.exit(2); }
  }
  try {
    if (opt.self) process.exit(await selfTest());
    const r = await run(opt);
    if (opt.json) console.log(JSON.stringify({ mode: r.mode, pages: r.pages, findings: r.findings, external: [...r.ctx.external].sort() }, null, 1));
    else console.log(report(r.findings, r.ctx, r.pages, r.mode));
    if (opt.shots) console.error('screenshots in ' + opt.shots);
    process.exit(r.findings.some(isFail) ? 1 : 0);
  } catch (e) { console.error('could not run: ' + (e.stack || e)); process.exit(2); }
}
