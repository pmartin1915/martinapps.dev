// search.js: site search for martinapps.dev. Loaded as a module on every page with a header.
// The header's "Search" link goes to /search/ (a plain list of every page). With this script it opens a dialog
// instead. The engine (MiniSearch, the ranking and the index, about 37 KB gzipped) loads only when search is used.
// Nothing leaves the browser: no request goes anywhere but this site, and nothing typed is stored or sent.
// Pattern: WAI-ARIA combobox with a listbox popup inside a native modal <dialog>.

const BASE = '/assets/';
const APPS = [['BoardBound', '/boardbound/'], ['Burn Wizard', '/burn-wizard/'], ['Wilderness', '/wilderness/'], ['Shortless', '/shortless/'], ['Scrollometer', '/scrollometer/']];
let engineP = null, cssP = null, uid = 0;

function loadEngine() {
  if (!engineP) {
    engineP = Promise.all([
      import(BASE + 'vendor/minisearch-7.2.0.min.js'), import(BASE + 'search-core.js'),
      fetch(BASE + 'search-index.json', { credentials: 'same-origin' }).then((r) => { if (!r.ok) throw new Error('index ' + r.status); return r.json(); }),
    ]).then(([ms, core, idx]) => core.createEngine(ms.default, idx.docs));
    engineP.catch(() => { engineP = null; });   // let a later try load it again
  }
  return engineP;
}
function loadCss() {
  if (!cssP) cssP = new Promise((res) => {
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = BASE + 'search.css';
    l.onload = l.onerror = () => res(); document.head.appendChild(l);
  });
  return cssP;
}

const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const k of kids) if (k) e.append(k);
  return e;
};
const icon = () => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = '<circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>';
  return s;
};
const safeHref = (h) => (typeof h === 'string' && h.startsWith('/') && !h.startsWith('//') ? h : '/');

// Build one search box (input, live status, result list, empty state). Used by the dialog and inline.
function createBox({ onClose, inline }) {
  const n = ++uid, listId = `sx-list-${n}`, statusId = `sx-status-${n}`;
  const input = el('input', {
    class: 'sx-input', id: `sx-input-${n}`, type: 'search', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false',
    'aria-controls': listId, 'aria-describedby': statusId, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false',
    enterkeyhint: 'search', maxlength: '120', placeholder: 'Search apps, help and policies',
  });
  const label = el('label', { class: 'sx-visually-hidden', for: input.id, text: 'Search Martin Apps' });
  const status = el('p', { class: 'sx-status', id: statusId, role: 'status', 'aria-live': 'polite' });
  const list = el('ul', { class: 'sx-list', id: listId, role: 'listbox', 'aria-label': 'Results' });
  const empty = el('div', { class: 'sx-empty', hidden: '' });
  const close = onClose ? el('button', { class: 'sx-close', type: 'button', text: 'Close', onclick: onClose }) : null;
  const form = el('form', { class: 'sx-bar', role: 'search', onsubmit: (e) => { e.preventDefault(); activate(); } },
    label, el('div', { class: 'sx-field' }, icon(), input), close);
  const body = el('div', { class: 'sx-body' }, status, list, empty);
  const root = el('div', { class: 'sx' + (inline ? ' sx-inline' : '') }, form, body);

  let results = [], active = -1, timer = 0, seq = 0, shown = null;

  function setActive(i) {
    const opts = list.children;
    if (active >= 0 && opts[active]) opts[active].setAttribute('aria-selected', 'false');
    active = i;
    if (i >= 0 && opts[i]) {
      opts[i].setAttribute('aria-selected', 'true'); input.setAttribute('aria-activedescendant', opts[i].id);
      opts[i].scrollIntoView({ block: 'nearest' });
    } else input.removeAttribute('aria-activedescendant');
  }
  function go(i) { const r = results[i]; if (r) location.assign(safeHref(r.href)); }

  function showEmpty(kind, words) {
    empty.replaceChildren();
    const say = kind === 'filler' ? 'Type a word or two, like an app name.' : `No pages match \u201c${words.join(' ')}\u201d.`;
    empty.append(el('p', { text: say }), el('p', { text: 'Our apps:' }),
      el('ul', {}, ...APPS.map(([t, h]) => el('li', {}, el('a', { href: h, text: t })))),
      el('p', { class: 'sx-more' }, el('a', { href: '/support/', text: 'Get help' }), ' or email ', el('a', { href: 'mailto:support@martinapps.dev', text: 'support@martinapps.dev' }), '.'));
    empty.hidden = false;
  }

  function render(r) {
    results = r.kind === 'results' || r.kind === 'partial' ? r.results : [];
    list.replaceChildren(); setActive(-1);
    results.forEach((x, i) => {
      const snip = el('span', { class: 'sx-snip' });
      for (const s of x.snippet) snip.append(s.mark ? el('mark', { text: s.text }) : document.createTextNode(s.text));
      list.append(el('li', { class: 'sx-opt', role: 'option', id: `${listId}-o${i}`, 'aria-selected': 'false', onclick: () => go(i) },
        el('span', { class: 'sx-title', text: x.title }), x.heading ? el('span', { class: 'sx-where', text: x.heading }) : null, x.snippet.length ? snip : null));
    });
    input.setAttribute('aria-expanded', results.length ? 'true' : 'false');
    if (results.length) setActive(0);   // the first result is selected (and announced) so Enter opens what was shown
    if (results.length) { empty.hidden = true; status.textContent = r.kind === 'partial' ? `No page has all of those words. Closest ${results.length === 1 ? 'match' : 'matches'}:` : results.length === 1 ? '1 result' : `${results.length} results`; }
    else if (r.kind === 'none' || r.kind === 'filler') { showEmpty(r.kind, r.words); status.textContent = r.kind === 'none' ? 'No pages match' : ''; }
  }

  async function run() {
    clearTimeout(timer); timer = 0;
    const q = input.value.trim(), mine = ++seq;
    if (inline && location.pathname === '/search/') history.replaceState(null, '', q ? '#q=' + encodeURIComponent(q) : location.pathname);
    if (!q) { results = []; list.replaceChildren(); setActive(-1); empty.hidden = true; status.textContent = ''; input.setAttribute('aria-expanded', 'false'); shown = ''; return; }
    let engine;
    try {
      if (!engineP) status.textContent = 'Loading search\u2026';
      engine = await loadEngine();
    } catch {
      if (mine !== seq) return;
      status.replaceChildren('Search could not load. ', el('a', { href: '/search/', text: 'See every page' }), ' instead.');
      return;
    }
    if (mine !== seq) return;
    render(engine.search(q));
    shown = q;
  }
  // Enter: if what is shown is not for what is typed yet, search first, then open the selected result
  async function activate() {
    const q = input.value.trim();
    if (shown !== q) { await run(); if (input.value.trim() !== q || shown !== q) return; }   // typing went on: no navigation
    if (active >= 0) go(active);   // only what is selected (and announced) opens
  }

  input.addEventListener('input', () => { clearTimeout(timer); seq++; shown = null; timer = setTimeout(run, 60); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (results.length) setActive(Math.min(active + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (results.length) setActive(active <= 0 ? -1 : active - 1); }
    else if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); activate(); }
    else if (e.key === 'Escape') {
      if (input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; run(); }
      // empty input: the dialog's own Escape handling closes it
    }
  });

  return { root, input, set(q) { input.value = q; run(); } };
}

// ---------- the dialog ----------
let dialog = null, box = null, opener = null;
async function openDialog(from, query = '') {
  opener = from || document.activeElement;
  await loadCss();
  if (!dialog) {
    dialog = el('dialog', { class: 'sx sx-dialog', 'aria-label': 'Search Martin Apps' });
    box = createBox({ onClose: () => dialog.close() });
    dialog.append(...box.root.childNodes);
    dialog.addEventListener('close', () => { if (opener && opener.isConnected) opener.focus(); });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });   // a tap on the backdrop
    document.body.append(dialog);
  }
  if (!dialog.open) dialog.showModal();
  box.input.focus();
  if (query) box.set(query); else box.input.select();
  loadEngine().catch(() => {});
}

// ---------- wiring ----------
function inlineMounts() {
  for (const host of document.querySelectorAll('[data-search-inline]')) {
    if (host.dataset.mounted) continue;
    host.dataset.mounted = '1';
    loadCss();
    const b = createBox({ inline: true });
    host.replaceChildren(b.root);
    host.hidden = false;
    let q = '';
    if (host.dataset.searchPrefill === 'path') {
      // a 404: "/boardbond/" or "/wilderness/suport.html" becomes the words to search
      let p = location.pathname; try { p = decodeURIComponent(p); } catch { /* a malformed address: search its raw words */ }
      q = p.replace(/\.html?$/i, '').replace(/index$/i, '').split(/[/_\-.+]+/).filter(Boolean).join(' ').slice(0, 80);
    } else {
      const m = location.hash.match(/^#q=(.*)$/); if (m) { try { q = decodeURIComponent(m[1]); } catch { q = ''; } }
    }
    if (q) b.set(q);
    if (host.dataset.searchFocus !== undefined && !q) b.input.focus({ preventScroll: true });
    host.__box = b;
  }
}

document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a.search-link');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  const here = document.querySelector('[data-search-inline]');
  if (here && here.__box) { here.__box.input.focus(); here.__box.input.select(); return; }
  openDialog(a);
});
// start loading the engine when someone heads for the link, so the first results are quick
const warm = (e) => { if (e.target.closest && e.target.closest('a.search-link')) { loadEngine().catch(() => {}); loadCss(); } };
document.addEventListener('pointerover', warm, { passive: true });
document.addEventListener('focusin', warm);


inlineMounts();
