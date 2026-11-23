// why.mjs: show how the top pages for a query were scored.  node _search/why.mjs "fnp"
import MiniSearch from '../assets/vendor/minisearch-7.2.0.min.js';
import { createEngine } from '../assets/search-core.js';
import { buildIndex } from './build-index.mjs';
const e = createEngine(MiniSearch, buildIndex().docs);
for (const q of process.argv.slice(2)) { const r = e.search(q, true); console.log(`\n${JSON.stringify(q)} -> ${r.kind}`); console.table(r.debug || []); }
