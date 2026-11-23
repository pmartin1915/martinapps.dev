// score.mjs: run the search against the query sets and report how often the right page comes first.
// Uses the same assets/search-core.js and a fresh in-memory index, so it scores what visitors would get.
// Usage: node _search/score.mjs [queries.json ...] [--show]  (default: every *.json query set in _search/)
//        exit 0 when the frozen set (queries.json) meets the bar, 1 when it does not.
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MiniSearch from '../assets/vendor/minisearch-7.2.0.min.js';
import { createEngine } from '../assets/search-core.js';
import { buildIndex } from './build-index.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const BAR = { top1: 68, top3: 73 };   // of 75; see "Done means" in the plan

export function scoreSet(engine, set, excludedAlways = []) {
  const rows = [], cats = {};
  for (const q of set.queries) {
    const r = engine.search(q.q), urls = r.results.map((x) => x.url);
    const ok1 = q.top === null ? urls.length === 0 : urls[0] === q.top;
    const ok3 = q.top === null ? urls.length === 0 : urls.slice(0, 3).some((u) => u === q.top || (q.alsoOk || []).includes(u));
    const banned = [...(q.never || []), ...excludedAlways].filter((n) => urls.includes(n));
    const sectionOk = !q.section || (urls[0] === q.top && r.results[0].heading === q.section);
    const c = (cats[q.category] ??= { n: 0, top1: 0, top3: 0 }); c.n++; if (ok1) c.top1++; if (ok3) c.top3++;
    rows.push({ q, r, ok1, ok3, banned, sectionOk });
  }
  const sum = (k) => rows.filter((x) => x[k]).length;
  return { rows, cats, n: rows.length, top1: sum('ok1'), top3: sum('ok3'), banned: rows.filter((x) => x.banned.length).length, sections: rows.filter((x) => x.q.section).length, sectionsOk: rows.filter((x) => x.q.section && x.sectionOk).length };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const show = process.argv.includes('--show');
  let files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!files.length) files = readdirSync(HERE).filter((f) => f.endsWith('.json')).sort((a, b) => (a === 'queries.json' ? -1 : b === 'queries.json' ? 1 : a.localeCompare(b))).map((f) => path.join(HERE, f));
  const engine = createEngine(MiniSearch, buildIndex().docs);
  let pass = true;
  for (const f of files) {
    const set = JSON.parse(readFileSync(f, 'utf8'));
    const s = scoreSet(engine, set, set.excludedAlways || []);
    console.log(`\n== ${path.basename(f)}: right page first ${s.top1}/${s.n} (${Math.round(100 * s.top1 / s.n)}%), in top 3 ${s.top3}/${s.n}, must-not-appear broken ${s.banned}, section right ${s.sectionsOk}/${s.sections}`);
    for (const [k, c] of Object.entries(s.cats)) console.log(`   ${k.padEnd(9)} first ${c.top1}/${c.n}   top 3 ${c.top3}/${c.n}`);
    for (const x of s.rows) {
      if (x.ok1 && !x.banned.length && x.sectionOk && !show) continue;
      const got = x.r.results.slice(0, 3).map((r) => r.href).join('  ') || `(${x.r.kind})`;
      const tag = !x.ok1 ? 'MISS ' : x.banned.length ? 'NEVER' : !x.sectionOk ? 'SECT ' : 'ok   ';
      console.log(`   ${tag} ${x.q.category.padEnd(8)} ${JSON.stringify(x.q.q).padEnd(42)} want ${x.q.top ?? '(nothing)'}${x.q.section ? ' [' + x.q.section + ']' : ''}\n${' '.repeat(18)}got  ${got}${x.banned.length ? '  BANNED: ' + x.banned.join(' ') : ''}`);
    }
    if (path.basename(f) === 'queries.json') pass = s.top1 >= BAR.top1 && s.top3 >= BAR.top3 && s.banned === 0 && s.cats.empty.top1 === s.cats.empty.n;
  }
  console.log(pass ? '\nfrozen set: meets the bar' : `\nfrozen set: below the bar (needs ${BAR.top1} first, ${BAR.top3} in top 3, no must-not breaks, every empty query empty)`);
  process.exit(pass ? 0 : 1);
}
