// search-core.js: the ranking behind martinapps.dev search. Plain ES module with no DOM use, so the browser
// and the Node tests (_search/) run exactly the same code. Design and reasoning: dev-ops docs/proposals/site-search.md.
//
//   import MiniSearch from './vendor/minisearch-7.2.0.min.js';
//   const engine = createEngine(MiniSearch, indexJson.docs);
//   engine.search('refund')  ->  { kind: 'results' | 'partial' | 'none' | 'filler', words: [...], results: [...] }
//   'partial': no page has all the words, these have at least half of them (shown as closest matches)
//
// A result is { url, href, title, heading, type, snippet: [{ text, mark }] }. The snippet is plain text pieces
// (mark = true for matched words) so the page builds it with textContent, never innerHTML.

// Words that carry no meaning in a search box. Dropped from the query (and from the index).
const STOP = new Set(('a an and are as at be been but by can could did do does doing for from had has have how i if in into is it its ' +
  'me my of on or our please so than that the their them then there these they this those to too us was we were what when where ' +
  'which who whom why will with would you your yours am any some just very much many per i\'m im').split(' '));

// Generic words: searched (they help ranking) but not required to match, so "does it work without internet" is
// judged by "internet", not by "work".
const WEAK = new Set(('work works working use using used need needs get getting want wants still show shows showing make made ' +
  'find thing things way ways keep go going try know see new one all like also again back number ' +
  'without anymore ever never not no off out up down over about here app apps').split(' '));

// Visitor word -> words the site uses. Applied to the query only, and weighted below the visitor's own word.
// A mapping goes in only if it is right in every context on this site: "stop" is not here because "stop paying"
// and "stop doomscrolling" want different pages, and NCLEX is not here because it is a different exam.
const SYN = {
  refund: ['refunds', 'billing'], refunds: ['refund', 'billing'], reimburse: ['refund'], money: ['refund', 'billing'],
  unsubscribe: ['cancel', 'subscription'], cancellation: ['cancel'], paying: ['subscription', 'billing'], charged: ['billing', 'subscription'],
  billing: ['subscription'], renew: ['renewal'],
  remove: ['delete'], erase: ['delete'], wipe: ['delete'], deactivate: ['delete'],
  contact: ['email', 'support'], phone: ['email'], call: ['email'], talk: ['email', 'person'], someone: ['person'], reach: ['email'],
  message: ['email'], customer: ['support'], service: ['support'], helpdesk: ['support'], help: ['support'],
  android: ['google', 'play'], ios: ['iphone'], ipad: ['iphone'],
  price: ['$', 'cost', 'free'], cost: ['free', '$'], pricing: ['cost', 'free', '$'], expensive: ['cost', '$'], paid: ['subscription', 'free'],
  nurse: ['fnp'], practitioner: ['fnp'], np: ['fnp'],
  kid: ['children', 'child'], kids: ['children', 'child'], pediatric: ['children'], calculator: ['math', 'formula', 'calculate'],
  blocker: ['hide'], block: ['hide'], blocking: ['hide'], doomscrolling: ['scrolling', 'scroll'], doomscroll: ['scroll'],
  offline: ['internet', 'signal'], wifi: ['internet', 'signal'], reception: ['signal'],
  resuscitation: ['fluid', 'parkland'],
  owner: ['founder'], creator: ['founder'], developer: ['founder'], author: ['founder'],
  located: ['alabama'], headquarters: ['alabama'],
  sell: ['sell', 'privacy'], selling: ['sell', 'privacy'], tracking: ['analytics', 'track'],
  hiking: ['hikers'], hike: ['hikers'], camping: ['outdoors'], survive: ['survival'],
  policy: ['privacy'], gdpr: ['privacy'], tos: ['terms'],
  bug: ['issue', 'error'], broken: ['issue'], crashes: ['crash'],
};
const SYN_WEIGHT = 0.3;
const synOf = (w) => (Object.hasOwn(SYN, w) ? SYN[w] : []);   // own keys only: "constructor" is a word, not a lookup

// Two-word phrases (the second word may come up to three words later) whose meaning neither word carries alone.
const PHRASES = [
  ['who', 'made', ['founder', 'about']], ['who', 'built', ['founder', 'about']], ['who', 'owns', ['founder', 'about']],
  ['who', 'runs', ['founder', 'about']], ['who', 'created', ['founder', 'about']], ['who', 'behind', ['founder', 'about']],
  ['stop', 'paying', ['cancel', 'subscription']], ['stop', 'subscription', ['cancel', 'subscription']], ['stop', 'billing', ['cancel', 'subscription']],
  ['stop', 'charging', ['cancel', 'subscription']], ['phone', 'number', ['email', 'support']], ['call', 'you', ['email', 'support']],
];
const PHRASE_PARTS = new Set(PHRASES.flatMap(([a, b]) => [a, b]));

// What kind of page a query is after. A query that names one of these gets that kind of page ranked higher.
const INTENT = {
  help: ['help', 'support', 'contact', 'problem', 'issue', 'trouble', 'faq', 'question', 'questions', 'email'],
  legal: ['privacy', 'policy', 'terms', 'legal', 'gdpr', 'tos', 'conditions', 'agreement'],
  apps: ['android', 'iphone', 'ipad', 'ios', 'play', 'store', 'download', 'install', 'apps', 'all'],
};
// The site's general page for each need. A query with that need that names no product goes there first.
const HUB = { help: '/support/', legal: '/privacy/', apps: '/apps/' };
const PRIOR = { product: 1.35, help: 1.2, company: 1.1, hub: 0.7, legal: 0.6 };
const INTENT_PRIOR = 1.7;
const BOOST = { title: 6, heading: 3, tags: 3, product: 1.5, desc: 2, body: 1 };
const MAX_RESULTS = 8;

const fold = (s) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[\u2019\u2018]/g, "'");
export const words = (s) => fold(s).match(/[a-z0-9$]+(?:'[a-z]+)?/g) || [];

// Fold simple English plural and possessive endings, identically for pages and queries.
export function stem(t) {
  t = t.replace(/'s$/, '').replace(/'$/, '');
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y';
  if (t.length > 4 && /(ss|x|ch|sh)es$/.test(t)) return t.slice(0, -2);
  if (t.length > 3 && t.endsWith('s') && !/(ss|us|is)$/.test(t)) return t.slice(0, -1);
  return t;
}
const processTerm = (t) => { t = fold(t); return STOP.has(t) ? null : stem(t); };

// Typo tolerance: none under 5 letters (4-letter words have too many 1-letter neighbours: "cake" ~ "make"),
// 1 letter for 5-7, 2 letters from 8 ("compass" must not reach "company"). Swapped letters are handled by unswap().
const fuzzyFor = (t) => (t.length >= 8 ? 2 : t.length >= 5 ? 1 : false);
const prefixFor = (t) => t.length >= 3 || t === '$';

function editDistance(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const same = (w, target) => { const f = fuzzyFor(target); return w === target || (!!f && editDistance(w, target, f) <= f); };
const near = (w, target) => { const f = fuzzyFor(target); return w === target || (f && editDistance(w, target, f) <= f) || (w.length >= 4 && target.startsWith(w)); };

export function createEngine(MiniSearch, docs) {
  const ms = new MiniSearch({
    fields: ['title', 'heading', 'tags', 'product', 'desc', 'body'],
    storeFields: [],
    processTerm,
    extractField: (doc, f) => (f === 'product' ? doc.product + ' ' + doc.product.replace(/\s+/g, '') : doc[f]),
  });
  ms.addAll(docs);
  const byId = new Map(docs.map((d) => [d.id, d]));
  const vocab = new Set();
  for (const d of docs) for (const f of ['title', 'heading', 'product', 'desc', 'body']) for (const w of words(d[f] || '')) vocab.add(stem(w));
  // per page: its title words, its product's words, and whether it is that product's home page
  const pageInfo = new Map();
  for (const d of docs) {
    if (pageInfo.has(d.url)) continue;
    const productWords = words(d.product).map(stem).concat([stem(fold(d.product.replace(/\s+/g, '')))]);
    pageInfo.set(d.url, {
      titleWords: words(d.pageTitle).map(stem).filter((w) => !STOP.has(w) && w !== 'martin' && w !== 'app'),
      productWords, home: d.type === 'product' && /^\/[^/]+\/$/.test(d.url) && d.product !== 'Martin Apps',
    });
  }
  const productNames = [...new Set(docs.filter((d) => d.product !== 'Martin Apps').flatMap((d) => [stem(fold(d.product.replace(/\s+/g, ''))), ...words(d.product).map(stem)]))];

  function unglue(t) {   // "burnwizard" -> "burn", "wizard"
    if (t.length < 7 || vocab.has(stem(t))) return [];
    for (let i = 3; i <= t.length - 3; i++) {
      const a = t.slice(0, i), b = t.slice(i);
      if (vocab.has(stem(a)) && vocab.has(stem(b))) return [a, b];
    }
    return [];
  }

  // "cancle" -> "cancel", "blokcer" -> "blocker": one pair of neighbouring letters swapped (edit distance counts that as 2)
  function unswap(t) {
    if (t.length < 4 || vocab.has(stem(t))) return [];
    const out = [];
    for (let i = 0; i + 1 < t.length; i++) {
      const s = t.slice(0, i) + t[i + 1] + t[i] + t.slice(i + 2);
      if (vocab.has(stem(s))) out.push(s);
    }
    return out;
  }
  // "scroll meter" -> "scrollometer": two words that are one word on the site, give or take a letter
  const vocabList = [...vocab];
  function glueNear(g) {
    if (vocab.has(stem(g))) return [g];
    if (g.length < 8) return [];
    return vocabList.filter((v) => Math.abs(v.length - g.length) <= 1 && editDistance(g, v, 1) <= 1).slice(0, 2);
  }

  function search(query, debug = false) {
    const raw = words(String(query || '').slice(0, 200));
    const all = raw.filter((w) => !STOP.has(w));
    // short phrases whose meaning is not in either word alone
    const extra = [];
    for (const [a, b, adds] of PHRASES) { const i = raw.indexOf(a); if (i >= 0 && raw.slice(i + 1, i + 4).includes(b)) extra.push(...adds); }
    if (!all.length && !extra.length) return { kind: 'filler', words: [], results: [] };
    let strongIdx = all.map((w, i) => (WEAK.has(w) || PHRASE_PARTS.has(w) && extra.length ? -1 : i)).filter((i) => i >= 0);
    // a phrase ("who made", "stop paying") stands for its words: it becomes one required word of its own
    if (extra.length) { all.push('\u0000phrase'); strongIdx.push(all.length - 1); }
    if (!strongIdx.length) strongIdx = all.map((_, i) => i);
    const strong = new Set(strongIdx);
    // every strong word must match when there are up to three; from four on, one may miss
    const need = strong.size <= 3 ? strong.size : strong.size - 1;

    // each query term remembers which visitor word it came from, and whether it is the visitor's own word
    const origin = new Map(), own = new Set();
    const add = (term, i, isOwn) => { const p = processTerm(term); if (!p) return; if (!origin.has(p)) origin.set(p, new Set()); origin.get(p).add(i); if (isOwn) own.add(p); };
    all.forEach((w, i) => {
      if (w === '\u0000phrase') { for (const s of extra) add(s, i, true); return; }
      add(w, i, true);
      for (const s of synOf(w)) add(s, i, false);
      for (const s of unglue(w)) add(s, i, true);
      for (const s of unswap(w)) add(s, i, true);
    });
    for (let i = 0; i + 1 < all.length; i++) for (const g of glueNear(all[i] + all[i + 1])) { add(g, i, true); add(g, i + 1, true); }

    const terms = [...origin.keys()];
    const otherWords = [...strong].some((i) => all[i] !== '\u0000phrase' && !productNames.some((n) => near(all[i], n))) && [...strong].some((i) => productNames.some((n) => near(all[i], n)));
    const hits = ms.search({ combineWith: 'OR', queries: terms }, {
      boost: BOOST, prefix: prefixFor, fuzzy: fuzzyFor, maxFuzzy: 2, weights: { fuzzy: 0.35, prefix: 0.6 },
      // once the visitor gives words besides an app's name, the name only picks the app and the other words pick the page
      boostTerm: (t) => (own.has(t) ? (otherWords && productNames.some((n) => near(t, n)) ? 0.35 : 1) : SYN_WEIGHT),
    });

    const intents = Object.entries(INTENT).filter(([, ws]) => all.some((w) => ws.some((t) => near(w, t)))).map(([k]) => k);
    const namedAny = all.some((w) => productNames.some((t) => near(w, t))) ||
      all.some((w, i) => i + 1 < all.length && productNames.some((t) => near(w + all[i + 1], t)));
    // two of the visitor's words side by side in a section's text ("app store", "screen time") count extra
    const pairs = [];
    for (let i = 0; i + 1 < raw.length; i++) if (raw[i].length > 1 && raw[i + 1].length > 1) pairs.push(raw[i] + ' ' + raw[i + 1]);
    const phraseBonus = (doc) => {
      if (!pairs.length) return 1;
      const t = ' ' + words([doc.title, doc.heading, doc.desc, doc.body].join(' ')).join(' ') + ' ';
      return pairs.some((p) => t.includes(' ' + p + ' ')) ? 1.4 : 1;
    };

    const strongWords = [...strong].map((i) => all[i]);
    const pages = new Map();
    for (const h of hits) {
      const doc = byId.get(h.id);
      const covered = new Set();
      for (const qt of h.queryTerms) for (const i of origin.get(qt) || []) covered.add(i);
      let p = pages.get(doc.url);
      if (!p) { p = { url: doc.url, type: doc.type, title: doc.pageTitle, secs: [], covered: new Set(), terms: new Set() }; pages.set(doc.url, p); }
      p.secs.push({ doc, covered, score: h.score * phraseBonus(doc) });
      for (const i of covered) p.covered.add(i);
      for (const t of h.terms) p.terms.add(t);
    }
    const qwords = [...new Set([...all.map(stem), ...all.flatMap((w) => (synOf(w)).map(stem)), ...extra.map(stem)])];
    const scored = [], close = [];
    // no page has (nearly) all the words: pages with at least half of them are shown as closest matches, never a dead end
    const half = Math.max(1, Math.ceil(strong.size / 2));
    for (const p of pages.values()) {
      const cov = [...p.covered].filter((i) => strong.has(i)).length;
      if (cov < half) continue;
      const info = pageInfo.get(p.url);
      p.secs.sort((a, b) => b.score - a.score);
      const best = p.secs[0], rest = p.secs.slice(1).reduce((s, x) => s + x.score, 0);
      const bestCov = [...best.covered].filter((i) => strong.has(i)).length;
      let score = (best.score + Math.min(0.1 * rest, 0.2 * best.score)) * (cov / strong.size) ** 2 * (0.75 + 0.25 * bestCov / strong.size);
      score *= intents.includes(p.type) ? INTENT_PRIOR : PRIOR[p.type];
      if (!namedAny && intents.some((k) => HUB[k] === p.url)) score *= 2.5;
      // the visitor named a product and nothing else: that product's own page comes first
      const glued = strongWords.join('');
      const namesProduct = strongWords.every((w) => info.productWords.some((t) => near(w, t))) || info.productWords.some((t) => near(glued, t));
      if (namesProduct && info.home) score *= 1.8;
      // every word of the page's title is in the query: "privacy" -> Privacy, "contact" -> Support
      if (info.titleWords.length && info.titleWords.every((t) => qwords.some((w) => same(w, t)))) score *= 2;
      // the section to link to: the one that answers the words other than the product's name, then the best scorer
      const answers = (s) => [...s.covered].filter((i) => strong.has(i) && !info.productWords.some((t) => near(all[i], t))).length;
      p.target = p.secs.reduce((a, b) => (answers(b) > answers(a) || (answers(b) === answers(a) && b.score > a.score) ? b : a)).doc;
      if (p.target.anchor === '' && best.doc.anchor === '' && p.secs.length > 1 && answers(p.secs[1]) >= answers(best) && answers(best) > 0 && p.secs[1].score > 0.6 * best.score) p.target = p.secs[1].doc;
      p.score = score; p.cov = cov; p.info = info;
      p.faqAnswers = p.target.faq && [...strong].every((i) => all[i] === '\u0000phrase' || info.productWords.some((t) => near(all[i], t)) ||
        words(p.target.heading).map(stem).some((w) => near(stem(all[i]), w)));
      if (debug) p.why = { best: +best.score.toFixed(2), bestSec: best.doc.heading.slice(0, 30), rest: +rest.toFixed(1), cov, type: p.type, named: namesProduct && info.home };
      (cov >= need ? scored : close).push(p);
    }
    // closest matches must still belong to the app the visitor named: "wilderness cancel" never answers with BoardBound
    const namedIdx = [...strong].filter((i) => productNames.some((n) => near(all[i], n)));
    const onTopic = (p) => !namedIdx.length || namedIdx.some((i) => p.covered.has(i) && p.info.productWords.some((t) => near(all[i], t)));
    const closeOk = close.filter(onTopic);
    const partial = !scored.length && closeOk.length > 0;
    if (partial) scored.push(...closeOk);
    // An app's own page leads its family unless the visitor asked for help or a policy, or a help page's FAQ
    // question matches every word: "tiktok blocker" -> Shortless, "restore purchases" stays on the support FAQ.
    if (!intents.includes('help') && !intents.includes('legal')) {
      for (const p of scored) {
        if (p.type !== 'help' && p.type !== 'legal') continue;
        if (p.faqAnswers) continue;
        const home = scored.find((h) => h.info.home && h.info.productWords[0] === p.info.productWords[0] && h.url.split('/')[1] === p.url.split('/')[1]);
        if (home && home.cov === strong.size && home.score >= 0.25 * p.score && home.score < p.score) home.score = p.score * 1.001;
      }
    }
    scored.sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
    if (!scored.length) return { kind: 'none', words: all.filter((w) => w !== '\u0000phrase'), results: [] };
    const cut = scored[0].score * 0.08;
    const results = scored.filter((p) => p.score >= cut).slice(0, MAX_RESULTS).map((p) => {
      const d = p.target;
      return {
        url: p.url, href: d.anchor ? `${p.url}#${d.anchor}` : p.url, title: p.title, type: p.type,
        heading: d.anchor ? d.heading : '', snippet: snippet(d, [...p.terms], 150, [...p.terms].filter((t) => [...own].some((o) => same(t, o) || (o.length >= 3 && t.startsWith(o))))),
      };
    });
    const out = { kind: partial ? 'partial' : 'results', words: all.filter((w) => w !== '\u0000phrase'), results };
    if (debug) out.debug = scored.slice(0, 5).map((p) => ({ url: p.url, score: +p.score.toFixed(2), ...p.why }));
    return out;
  }

  return { search, size: docs.length };
}

// A short piece of the section's text around the first matched word, split into marked and plain parts.
export function snippet(doc, terms, width = 150, prefer = []) {
  const text = doc.body || doc.desc || '';
  if (!text) return [];
  const toks = [...text.matchAll(/[A-Za-z0-9$\u00c0-\u024f]+(?:['\u2019][A-Za-z]+)?/g)];
  const matches = (w) => { const s = stem(fold(w)); return terms.some((t) => s === t || (t.length >= 3 && s.startsWith(t))); };
  const hit = (list) => (w) => { const s = stem(fold(w)); return list.some((t) => s === t || (t.length >= 3 && s.startsWith(t))); };
  const first = toks.find((m) => hit(prefer)(m[0])) || toks.find((m) => matches(m[0]));
  let start = 0;
  if (first && first.index > width / 3) { start = text.lastIndexOf(' ', first.index - Math.floor(width / 3)); start = start < 0 ? 0 : start + 1; }
  let end = Math.min(text.length, start + width);
  if (end < text.length) { const sp = text.lastIndexOf(' ', end); if (sp > start + width / 2) end = sp; }
  const out = [];
  if (start > 0) out.push({ text: '\u2026', mark: false });
  let at = start;
  for (const m of toks) {
    if (m.index < start || m.index + m[0].length > end) continue;
    if (!matches(m[0])) continue;
    if (m.index > at) out.push({ text: text.slice(at, m.index), mark: false });
    out.push({ text: m[0], mark: true });
    at = m.index + m[0].length;
  }
  if (at < end) out.push({ text: text.slice(at, end), mark: false });
  if (end < text.length) out.push({ text: '\u2026', mark: false });
  return out;
}
