// Unit tests for site search. Run: node --test _search/
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import MiniSearch from '../assets/vendor/minisearch-7.2.0.min.js';
import { createEngine, stem, words, snippet } from '../assets/search-core.js';
import { buildIndex, checkIndex, contentRange, listContentPages, pageType, plainText, sectionsOf, SITE } from './build-index.mjs';
import { addIds } from './add-ids.mjs';
import { addLink, LINK } from './add-header-link.mjs';
import { scoreSet, BAR } from './score.mjs';

const page = (body, head = '') => `<!doctype html><html><head><title>Thing - Martin Apps</title><meta name="description" content="About a thing.">${head}</head><body><header class="site-header"><nav>Nav words</nav></header><main id="main">${body}</main><footer>Footer words</footer></body></html>`;

test('text extraction keeps words apart and drops scripts, forms and markup', () => {
  assert.equal(plainText('<span class="chip">iPhone</span><span class="chip">Android</span>'), 'iPhone Android');
  assert.equal(plainText('Board<b>Bound</b> &amp; <a href="/">more</a>.'), 'BoardBound & more.');
  assert.equal(plainText('<p>a</p><script>var x = "secret"</script><form><input></form><button>Send</button>b'), 'a b');
});

test('sections: split at headings and FAQ questions; header, nav and footer are never indexed', () => {
  const s = sectionsOf({ url: '/thing/', html: page('<h1>Thing</h1><p>Intro.</p><h2 id="how">How</h2><p>Steps.</p><p class="faq-q" id="q1">Can I?</p><p>Yes.</p>') });
  assert.deepEqual(s.map((x) => [x.anchor, x.heading, x.body]), [['', 'Thing', 'Intro.'], ['how', 'How', 'Steps.'], ['q1', 'Can I?', 'Yes.']]);
  assert.equal(s[0].title, 'Thing'); assert.equal(s[1].title, '', 'the title weighs on the first section only');
  assert.ok(s.every((x) => !/Nav words|Footer words/.test(x.body)));
  assert.equal(s[2].faq, true);
});

test('pages without <main> (Retold, Tellfolk) are read from <body> up to their footer', () => {
  const html = '<html><body><h1>T</h1><p>Text</p><div class="footer">Foot</div></body></html>';
  const [a, b] = contentRange(html);
  assert.equal(plainText(html.slice(a, b)), 'T Text');
});

test('left out by rule: underscore folders, ai/, noindex, redirects, opt-out; nothing else', () => {
  const urls = listContentPages().map((p) => p.url);
  for (const u of ['/404.html', '/sting/', '/storycue/support.html', '/storycue/privacy-policy.html', '/search/']) assert.ok(!urls.includes(u), u);
  for (const u of ['/', '/apps/', '/boardbound/terms.html', '/retold/support.html', '/tellfolk/privacy-policy.html']) assert.ok(urls.includes(u), u);
  assert.ok(!urls.some((u) => /^\/(_|ai\/)/.test(u)));
});

test('page types', () => {
  assert.equal(pageType('/boardbound/privacy.html'), 'legal');
  assert.equal(pageType('/boardbound/terms.html'), 'legal');
  assert.equal(pageType('/boardbound/delete-account.html'), 'help');
  assert.equal(pageType('/support/'), 'help');
  assert.equal(pageType('/about/'), 'company');
  assert.equal(pageType('/apps/'), 'hub');
  assert.equal(pageType('/wilderness/'), 'product');
});

test('word folding: plurals and possessives, not real words', () => {
  assert.equal(stem('subscriptions'), 'subscription'); assert.equal(stem('policies'), 'policy'); assert.equal(stem("app's"), 'app');
  assert.equal(stem('access'), 'access'); assert.equal(stem('status'), 'status'); assert.equal(stem('this'), 'this');
  assert.deepEqual(words('How do I DELETE my Account?'), ['how', 'do', 'i', 'delete', 'my', 'account']);
});

const engine = createEngine(MiniSearch, buildIndex().docs);
const first = (q) => (engine.search(q).results[0] || {}).url;

test('filler and nonsense get the empty screen, never random pages', () => {
  for (const q of ['', '   ', 'the', '?!', 'how do i']) assert.equal(engine.search(q).kind, 'filler', q);
  for (const q of ['asdfghjkl', 'xyzzy', 'pizza delivery', 'chocolate cake recipe', 'nclex']) assert.equal(engine.search(q).kind, 'none', q);
});

test('typos, swapped letters, glued and split names', () => {
  assert.equal(first('bordbound'), '/boardbound/');
  assert.equal(first('wildreness'), '/wilderness/');
  assert.equal(first('burnwizard'), '/burn-wizard/');
  assert.equal(first('board bound'), '/boardbound/');
  assert.equal(first('cancle subscription'), '/boardbound/support.html');
});

test('visitor words the pages do not use', () => {
  assert.equal(first('unsubscribe'), '/boardbound/support.html');
  assert.equal(first('contact'), '/support/');
  assert.equal(first('remove my account'), '/boardbound/delete-account.html');
});

test('a result links to the answer, not just the page', () => {
  const r = engine.search('restore purchases').results[0];
  assert.equal(r.href, '/boardbound/support.html#how-do-i-restore-a-previous-purchase');
  assert.equal(r.heading, 'How do I restore a previous purchase?');
});

test('snippets are plain text pieces with the matched words marked', () => {
  const doc = { body: 'You can cancel anytime and keep access until the end of the period.' };
  const s = snippet(doc, ['cancel']);
  assert.ok(s.some((x) => x.mark && x.text === 'cancel'));
  assert.equal(s.map((x) => x.text).join(''), doc.body);
  // a query is never echoed into markup: the engine returns text, and words with markup characters are just words
  assert.equal(engine.search('<img src=x onerror=alert(1)>').kind, 'none');
});

test('ids: added to headings and FAQ questions only, text untouched, idempotent', () => {
  const before = page('<h2>Hello there</h2><p class="faq-q">Why?</p><p>Plain</p><h2 id="kept">Kept</h2>');
  const { html, added } = addIds(before);
  assert.equal(added, 2);
  assert.match(html, /<h2 id="hello-there">Hello there<\/h2>/);
  assert.match(html, /<p id="why" class="faq-q">Why\?<\/p>/);
  assert.equal(html.replace(/ id="(hello-there|why)"/g, ''), before);
  assert.equal(addIds(html).added, 0);
});

test('header link: added once to each header style, script loaded once', () => {
  const a = addLink(page('', '').replace('<nav>', '\n  <nav class="desk-nav">'));
  assert.ok(a.includes(LINK)); assert.equal(addLink(a), a);
  const old = addLink(page('', '').replace('<nav>', '\n    <nav class="site-nav" aria-label="Site">'));
  assert.ok(old.includes(LINK));
  assert.equal((a.match(/search\.js/g) || []).length, 1);
  const noHeader = '<html><body><h1>x</h1></body></html>';
  assert.equal(addLink(noHeader), noHeader);
});

test('the stale-index check catches a hand edit, a new page and a page turned noindex', () => {
  const tmp = mkdtempSync(path.join(tmpdir(), 'sx-'));
  try {
    for (const d of ['index.html', 'apps', 'about', 'boardbound', 'search', 'assets']) cpSync(path.join(SITE, d), path.join(tmp, d), { recursive: true });
    // the copy's own index and list, built for exactly these pages
    const fresh = () => checkIndex(tmp).fresh;
    const rebuild = async () => {
      const { buildIndex: b, serialize, directoryHtml, withDirectory } = await import('./build-index.mjs');
      const idx = b(tmp);
      writeFileSync(path.join(tmp, 'assets/search-index.json'), serialize(idx));
      const df = path.join(tmp, 'search/index.html');
      writeFileSync(df, withDirectory(readFileSync(df, 'utf8'), directoryHtml(idx)));
    };
    return (async () => {
      await rebuild(); assert.equal(fresh(), true);
      const f = path.join(tmp, 'about/index.html');
      writeFileSync(f, readFileSync(f, 'utf8').replace('What we believe', 'What we think'));
      assert.equal(fresh(), false, 'hand edit');
      await rebuild(); assert.equal(fresh(), true);
      cpSync(path.join(tmp, 'about'), path.join(tmp, 'about2'), { recursive: true });
      assert.equal(fresh(), false, 'new page');
      await rebuild();
      writeFileSync(path.join(tmp, 'about2/index.html'), readFileSync(path.join(tmp, 'about2/index.html'), 'utf8').replace('<head>', '<head><meta name="robots" content="noindex">'));
      assert.equal(fresh(), false, 'page turned noindex');
    })();
  } finally { setTimeout(() => rmSync(tmp, { recursive: true, force: true }), 2000); }
});

test('the committed index matches the pages', () => assert.equal(checkIndex().fresh, true, 'run: node _search/build-index.mjs'));

test(`frozen query set meets the bar (${BAR.top1} first, ${BAR.top3} in top 3, no must-not breaks, empty stays empty)`, () => {
  const set = JSON.parse(readFileSync(new URL('./queries.json', import.meta.url), 'utf8'));
  const s = scoreSet(engine, set, set.excludedAlways);
  assert.ok(s.top1 >= BAR.top1, `first ${s.top1}/${s.n}`);
  assert.ok(s.top3 >= BAR.top3, `top 3 ${s.top3}/${s.n}`);
  assert.equal(s.banned, 0);
  assert.equal(s.cats.empty.top1, s.cats.empty.n);
});

test('words that are names of built-in object properties are just words (review finding)', () => {
  for (const q of ['constructor', 'boardbound constructor', 'toString', '__proto__ hasOwnProperty']) assert.doesNotThrow(() => engine.search(q), q);
});

test('no page has every word: closest matches with at least half the words, labelled partial; nonsense stays empty', () => {
  const r = engine.search('cancel membership');
  assert.equal(r.kind, 'partial'); assert.equal(r.results[0].url, '/boardbound/support.html');
  assert.equal(engine.search('asdfghjkl qwertyuiop').kind, 'none');
});
