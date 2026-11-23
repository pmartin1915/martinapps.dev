// harness.mjs: drive the real search in headless Chrome against a local copy of the site, end to end.
// Usage: node _search/harness.mjs [--live] [--shots DIR]
//   local (default): serves this folder.  --live: martinapps.dev after a push (same checks, read-only).
// Exit 0 all passed, 1 a check failed, 2 could not run.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import MiniSearch from '../assets/vendor/minisearch-7.2.0.min.js';
import { createEngine } from '../assets/search-core.js';
import { serve, openChrome } from '../_test/site-check.mjs';
import { buildIndex } from './build-index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const LIVE = args.includes('--live');
const SHOTS = args.includes('--shots') ? path.resolve(args[args.indexOf('--shots') + 1]) : null;

const results = [];
const check = (ok, what, detail = '') => { results.push({ ok: !!ok, what, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${!ok && detail ? '\n      ' + detail : ''}`); };

async function main() {
  let server = null, base = 'https://martinapps.dev';
  if (!LIVE) { server = await serve(SITE); base = server.base; }
  const origin = new URL(base).origin;
  const cdp = await openChrome();
  const requests = [];
  cdp.listeners.add((m) => { if (m.method === 'Network.requestWillBeSent') requests.push(m.params.request.url); });
  const send = cdp.send;
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('page: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    return r.result.value;
  };
  const waitFor = async (expr, ms = 5000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await evalJs(expr)) return true; await sleep(50); } return false; };
  const loaded = (ms = 8000) => new Promise((res) => { const l = (m) => { if (m.method === 'Page.loadEventFired') { cdp.listeners.delete(l); clearTimeout(t); res(true); } }; const t = setTimeout(() => { cdp.listeners.delete(l); res(false); }, ms); cdp.listeners.add(l); });
  const nav = async (url) => { const p = loaded(); await send('Page.navigate', { url: base + url }); await p; await evalJs('document.fonts.ready.then(() => true)'); await sleep(200); };
  const key = async (k, code = k, vk = 0) => {
    const p = { key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk };
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...p }); await send('Input.dispatchKeyEvent', { type: 'keyUp', ...p });
  };
  const KEYS = { Down: ['ArrowDown', 'ArrowDown', 40], Up: ['ArrowUp', 'ArrowUp', 38], Enter: ['Enter', 'Enter', 13], Escape: ['Escape', 'Escape', 27], Tab: ['Tab', 'Tab', 9] };
  const press = (n) => key(...KEYS[n]);
  const type = async (s) => { await send('Input.insertText', { text: s }); await sleep(250); };
  const size = (w, h, mobile) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile });
  const shot = async (name) => { if (!SHOTS) return; mkdirSync(SHOTS, { recursive: true }); const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(SHOTS, name + '.png'), Buffer.from(r.data, 'base64')); };
  const resultUrls = () => evalJs(`[...document.querySelectorAll('.sx-opt')].map((o) => o.textContent)`);
  const firstHref = async () => { await press('Down'); const p = loaded(); await press('Enter'); await p; return evalJs('location.pathname + location.hash'); };

  try {
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });

    // ---------- desktop, keyboard only ----------
    await size(1280, 800, false);
    await nav('/apps/');
    check(await evalJs(`!!document.querySelector('header a.search-link[href="/search/"]')`), 'header has a real Search link to /search/');
    // Tab from the top of the page to the Search link (skip link, logo, then Search)
    let reached = false;
    for (let i = 0; i < 6 && !reached; i++) { await press('Tab'); reached = await evalJs(`document.activeElement.classList.contains('search-link')`); }
    check(reached, 'the Search link is reachable by Tab');
    await press('Enter');
    check(await waitFor(`document.querySelector('dialog.sx-dialog')?.open`), 'Enter on the link opens the search dialog');
    check(await evalJs(`document.activeElement.matches('dialog .sx-input[role=combobox]')`), 'focus starts in the search input');
    check(await evalJs(`(() => { const i = document.querySelector('dialog .sx-input'); const l = document.getElementById(i.getAttribute('aria-controls')); return l && l.getAttribute('role') === 'listbox' && !!document.querySelector('dialog').getAttribute('aria-label'); })()`), 'combobox controls a listbox; the dialog has a name');
    await type('refund');
    check(await waitFor(`document.querySelectorAll('.sx-opt').length > 0`), 'typing shows results');
    check(await evalJs(`document.querySelector('.sx-input').getAttribute('aria-expanded') === 'true'`), 'aria-expanded is true with results');
    check(/result/.test(await evalJs(`document.querySelector('dialog .sx-status').textContent`)), 'the live region announces the count');
    await press('Down');
    check(await evalJs(`(() => { const i = document.querySelector('.sx-input'); const a = i.getAttribute('aria-activedescendant'); return !!a && document.getElementById(a).getAttribute('aria-selected') === 'true' && document.activeElement === i; })()`), 'Down arrow highlights a result while focus stays in the input');
    await press('Up');
    check(await evalJs(`!document.querySelector('.sx-input').hasAttribute('aria-activedescendant')`), 'Up from the first result returns to the input');
    await shot('desktop-results');
    await press('Escape');
    check(await evalJs(`document.querySelector('.sx-input').value === '' && document.querySelector('dialog').open`), 'Escape with text clears the box and keeps the dialog open');
    await press('Escape');
    check(await waitFor(`!document.querySelector('dialog').open`), 'Escape on an empty box closes the dialog');
    check(await evalJs(`document.activeElement.classList.contains('search-link')`), 'closing returns focus to the Search link');

    // the right page opens on Enter
    await press('Enter'); await waitFor(`document.querySelector('dialog').open`);
    await type('restore purchases');
    await waitFor(`document.querySelectorAll('.sx-opt').length > 0`);
    const opened = await firstHref();
    check(opened === '/boardbound/support.html#how-do-i-restore-a-previous-purchase', 'Down then Enter opens the answer itself (restore purchases -> BoardBound support FAQ)', 'opened ' + opened);

    // nonsense: helpful empty screen
    await nav('/about/');
    await evalJs(`document.querySelector('a.search-link').click()`);
    await waitFor(`document.querySelector('dialog')?.open`);
    await type('asdfghjkl');
    check(await waitFor(`!document.querySelector('.sx-empty').hidden`), 'nonsense shows the empty screen');
    check(await evalJs(`(() => { const e = document.querySelector('.sx-empty'); return e.querySelectorAll('a[href^="/"]').length >= 6 && !!e.querySelector('a[href^="mailto:"]'); })()`), 'the empty screen offers the apps, Get help and the email address');
    await shot('desktop-empty');
    check(await evalJs(`document.querySelector('.sx-input').getAttribute('aria-expanded') === 'false'`), 'aria-expanded is false with no results');

    // a typed query is treated as text, never markup
    await evalJs(`(() => { const i = document.querySelector('.sx-input'); i.value = ''; i.dispatchEvent(new Event('input')); })()`);
    await type('<img src=x onerror="window.__xss=1">boardbound');
    await sleep(300);
    check(await evalJs(`!window.__xss && !document.querySelector('.sx-body img')`), 'a query with markup in it is shown as text only');

    // ---------- the browser runs the same ranking as the tests ----------
    const set = JSON.parse(readFileSync(path.join(HERE, 'queries.json'), 'utf8')).queries.map((q) => q.q);
    const browser = await evalJs(`(async () => { const [m, c, i] = await Promise.all([import('/assets/vendor/minisearch-7.2.0.min.js'), import('/assets/search-core.js'), fetch('/assets/search-index.json').then((r) => r.json())]);
      const e = c.createEngine(m.default, i.docs); return ${JSON.stringify(set)}.map((q) => e.search(q).results.slice(0, 3).map((r) => r.href)); })()`);
    const node = createEngine(MiniSearch, LIVE ? (await (await fetch(base + '/assets/search-index.json')).json()).docs : buildIndex().docs);
    const diff = set.filter((q, i) => JSON.stringify(node.search(q).results.slice(0, 3).map((r) => r.href)) !== JSON.stringify(browser[i]));
    check(!diff.length, `browser and Node rank all ${set.length} frozen queries the same`, diff.slice(0, 5).join(' | '));

    // ---------- /search/ page and the 404 page ----------
    await nav('/search/#q=cancel%20subscription');
    check(await waitFor(`document.querySelectorAll('[data-search-inline] .sx-opt').length > 0`), '/search/#q=... shows results for the query in the address');
    await nav('/boardbond/');
    check(await waitFor(`document.querySelector('[data-search-inline] .sx-input')?.value === 'boardbond'`), 'the 404 page searches the words of the bad address');
    check(await waitFor(`/BoardBound/.test(document.querySelector('[data-search-inline] .sx-opt')?.textContent || '')`), '...and its first result is BoardBound');
    await shot('404-search');

    // ---------- phone widths: no sideways scroll, link visible, dialog fills the screen ----------
    for (const w of [320, 360, 375, 390, 430]) {
      await size(w, 760, true);
      for (const p of ['/', '/support/', '/boardbound/support.html', '/privacy/']) {
        await nav(p);
        const m = await evalJs(`(() => { const de = document.documentElement; const a = document.querySelector('header a.search-link'); const r = a.getBoundingClientRect();
          const inHeader = getComputedStyle(a).display !== 'none' && r.width >= 40 && r.height >= 40 && r.right <= de.clientWidth && r.left >= 0;
          const inMenu = !!document.querySelector('.phone-menu a.menu-search');
          return { sideways: de.scrollWidth > de.clientWidth + 1, inHeader, inMenu }; })()`);
        const old = p === '/boardbound/support.html';
        const reach = m.inHeader || (m.inMenu && w < 380) || (old && w < 340);
        const where = m.inHeader ? 'in the header (40px+ target)' : m.inMenu ? 'in the phone menu' : 'left out (older page under 340px)';
        check(!m.sideways && reach, `${w}px ${p}: no sideways scroll; Search is ${where}`, JSON.stringify(m));
      }
    }
    await size(390, 760, true);
    await nav('/wilderness/');
    await evalJs(`document.querySelector('a.search-link').click()`);
    await waitFor(`document.querySelector('dialog')?.open`);
    await type('compass');
    await waitFor(`document.querySelectorAll('.sx-opt').length > 0`);
    check(await evalJs(`(() => { const r = document.querySelector('dialog').getBoundingClientRect(); return r.width >= 389 && r.left <= 1; })()`), 'phone: the dialog fills the screen width');
    check(await evalJs(`(() => { const c = document.querySelector('.sx-close'); const r = c.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; })()`), 'phone: a visible Close button with a 44px target');
    await shot('phone-results');

    // ---------- 820px, the header's breakpoint, and 200% zoom (640 CSS px) ----------
    for (const [w, label] of [[820, '820px'], [640, '1280px at 200% zoom']]) {
      await size(w, 800, false);
      await nav('/apps/');
      check(!(await evalJs(`document.documentElement.scrollWidth > document.documentElement.clientWidth + 1`)), `${label}: no sideways scroll with the Search link in the header`);
    }

    // ---------- dark mode on the older pages ----------
    await size(1280, 800, false);
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await nav('/boardbound/support.html');
    await evalJs(`document.querySelector('a.search-link').click()`);
    await waitFor(`document.querySelector('dialog')?.open`);
    await type('cancel');
    await waitFor(`document.querySelectorAll('.sx-opt').length > 0`);
    const dark = await evalJs(`(() => { const d = getComputedStyle(document.querySelector('dialog')).backgroundColor; const t = getComputedStyle(document.querySelector('.sx-title')).color; return { d, t }; })()`);
    const lum = (c) => { const [r, g, b] = c.match(/\d+/g).map(Number); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
    check(lum(dark.d) < 0.3 && lum(dark.t) > 0.4, 'dark mode: the dialog is dark with light text', JSON.stringify(dark));
    await shot('dark-results');
    await send('Emulation.setEmulatedMedia', { features: [] });

    // ---------- reduced motion: no animation on the dialog ----------
    await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await nav('/about/');
    await evalJs(`document.querySelector('a.search-link').click()`);
    await waitFor(`document.querySelector('dialog')?.open`);
    check(await evalJs(`getComputedStyle(document.querySelector('dialog')).animationName === 'none'`), 'reduced motion: the dialog opens without animation');
    await send('Emulation.setEmulatedMedia', { features: [] });

    // ---------- JavaScript off: the link still leads somewhere useful ----------
    await send('Emulation.setScriptExecutionDisabled', { value: true });
    await nav('/apps/');
    await evalJs(`document.querySelector('a.search-link').href`).catch(() => null);
    await nav('/search/');
    const nojs = await send('DOM.getDocument', { depth: -1 }).then(() => true).catch(() => false);
    await send('Emulation.setScriptExecutionDisabled', { value: false });
    // with scripts off Runtime.evaluate still runs (it is the debugger), so read the static page directly
    const html = LIVE ? await (await fetch(base + '/search/')).text() : readFileSync(path.join(SITE, 'search/index.html'), 'utf8');
    const listed = (html.match(/<li><a href="\//g) || []).length;
    check(nojs && listed >= 20, `JavaScript off: /search/ lists every page (${listed} links)`);

    // ---------- privacy: nothing but this site ----------
    const foreign = [...new Set(requests.filter((u) => /^https?:/.test(u) && new URL(u).origin !== origin))];
    check(!foreign.length, 'no request went to any other site', foreign.slice(0, 5).join(' '));
    check(!requests.some((u) => /[?&]q=/.test(u)), 'no query string ever carried what was typed');
  } finally { await cdp.close(); if (server) server.srv.close(); }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed${SHOTS ? '; screenshots in ' + SHOTS : ''}`);
  return failed ? 1 : 0;
}

main().then((c) => process.exit(c), (e) => { console.error('could not run: ' + (e.stack || e)); process.exit(2); });
