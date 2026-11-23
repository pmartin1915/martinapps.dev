// add-header-link.mjs: put the Search link in the header of every page that has one, and load search.js there.
// Idempotent (a page that already has the link is left alone). Adds markup only; never changes page text.
// Both header styles are handled: redesigned pages (<nav class="desk-nav">) and older pages (<nav class="site-nav">).
// Usage: node _search/add-header-link.mjs [SITE_DIR]
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LINK = '<a class="search-link" href="/search/"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M15.5 15.5L21 21" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg><span class="search-word">Search</span></a>';
// On the narrowest phones (under 360px) the header has no room, so the redesigned pages' phone menu carries it too.
export const MENU_LINK = '<a class="search-link menu-search" href="/search/">Search</a>';
export const SCRIPT = '<script type="module" src="/assets/search.js"></script>';

// the phone menu's links sit on the line after its opening tag; the Search entry goes at the end of that line
const MENU_RE = /(<nav class="phone-menu[^>]*>\r?\n[^\r\n]*<\/a>)(\r?\n\s*<\/nav>)/;
function addMenu(html) { return html.includes('menu-search') ? html : html.replace(MENU_RE, (all, a, c) => a + MENU_LINK + c); }

export function addLink(html) {
  if (!/class="site-header"/.test(html)) return html;
  let out = html;
  if (!out.includes('class="search-link"')) {
    const m = out.match(/^([ \t]*)<nav class="(desk-nav|site-nav)"/m);
    if (!m) return html;
    out = out.replace(m[0], `${m[1]}${LINK}\n${m[0]}`);
  }
  out = addMenu(out);
  if (!out.includes(SCRIPT)) out = out.replace(/<\/body>/i, `${SCRIPT}\n</body>`);
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = path.resolve(process.argv[2] || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) { if (!/^[._]/.test(name) && name !== 'ai') walk(p); continue; }
      if (!name.endsWith('.html')) continue;
      const before = readFileSync(p, 'utf8'), after = addLink(before);
      if (after !== before) { writeFileSync(p, after); console.log('added:', path.relative(root, p)); }
    }
  })(root);
}
