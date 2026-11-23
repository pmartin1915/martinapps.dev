# STATE — martinapps-site (martinapps.dev)

**Last updated:** 2026-11-22
**Branch:** `main`. Static site (plain HTML) served by GitHub Pages from `main`, custom domain via `CNAME`.
The repo is PUBLIC and Pages serves every non-underscore directory, so anything under `ai/` would be
fetchable at martinapps.dev/ai/STATE.md. Keep this file free of anything not meant to be public.

## Shipped

- Homepage `index.html`, redesigned 2026-07-07 (`dd8b7ca`), with app cards and a footer liability clause.
- BoardBound: product page, support, terms, privacy, account deletion (`boardbound/`).
- Wilderness: support page and privacy policy (`wilderness/`). The v1.8.0 privacy wording went live on
  2026-09-29 (`0e140b2`, merged after v1.8.0 reached the App Store).
- Shortless: support page and privacy policy (`shortless/`, `ea00ae2`, 2026-09-30) for the iOS app's
  resubmission.
- LICENSE conformed to Martin Apps LLC (`0b35f04`); copy corrections for unsubstantiated claims
  (`519ba47`, `a5e4394`, `393dc56`) and an FDA-position privacy fix (`72acf2a`).

- Tellfolk: support page and privacy policy (`tellfolk/`). First added as `storycue/` (`cfaa378`,
  2026-10-16), renamed to Tellfolk in `2e1cc77` (2026-10-19); the old `storycue/` pages remain as
  redirects (meta refresh and canonical) to `/tellfolk/`.
- Retold: support page and privacy policy (`retold/`, `7b38619`, 2026-10-19).

- Site refresh 2026-10-12 (`4b5f07b`): one shared stylesheet (`assets/site.css`) for every page, shared
  header/footer and per-product sub-nav, official store badges and app icons, BoardBound marked live,
  Wilderness Google Play link, OG/canonical tags, 404 page. Compliance page text and URLs unchanged.
  New pages should link `/assets/site.css` and copy the header/footer markup from an existing page.
- Logo build animation 2026-10-12: the staircase fills in and resolves into the mark. Plays once in the
  home masthead (`.mark-build`), loops on the 404 page (`.mark-build.loop`). CSS `d` keyframes in
  `assets/site.css`; reduced-motion visitors and Safari (no CSS `d`) see the static mark. Source of truth
  for the geometry is `Brand/martin-apps-mark-build.svg` in the LLC records repo.

- Professional pass 2026-10-12 (from the Gemini web-design benchmark; verdict lives in the LLC repo at
  `Brand/research/WEB_DESIGN_VERDICT_2026-10-12.md`): self-hosted Newsreader + Atkinson Hyperlegible Next
  (`assets/fonts/`, OFL, latin subset, preloaded on every page); per-app OG cards (`assets/og-*.png`);
  `MobileApplication` JSON-LD for all five apps; 24px minimum on standalone text links; phone screenshot
  strips (`assets/shots/`) for BoardBound and Scrollometer.
- Screenshots: since the 2026-10-29 redesign every product page shows three (`assets/shots/`). The 2026-10-12
  note that Wilderness, Shortless and Burn Wizard show none is out of date (corrected 2026-11-22). BoardBound's rationale screens are excluded on purpose:
  the app labels rationales "EXPERT-VERIFIED", which contradicts this site's "not reviewed by a licensed
  clinician" disclosure.

- Redesign 2026-10-29 (branch `site-redesign`): warm multi-page site. New pages /apps/, /about/, /support/,
  /privacy/, /burn-wizard/, /scrollometer/, /wilderness/, /shortless/; /boardbound/ and the home page replaced.
  Old /#burn-wizard, /#scrollometer (and the other home anchors) forward to the new pages by a small script.
  Styles: `assets/base.css` + `theme-a.css` + `extra.css`. Support, privacy and terms pages are unchanged and
  still use `assets/site.css`. No Engineering section yet.
  Correction 2026-11-22: these pages are edited here, by hand. The 2026-10-29 note that they are generated from a
  private source folder no longer holds (about 60 direct edits since). Only the home page's header logo animation and
  `assets/builder.css` come from a generator, in the private brand repo; change those there.

- Site search 2026-11-22: a Search link in every header opens a search dialog (plain link to /search/ without
  JavaScript, which lists every page). Results come from `assets/search-index.json`, a section-by-section index of
  every content page, searched in the visitor's browser by `assets/search-core.js` with MiniSearch 7.2.0 (MIT,
  vendored in `assets/vendor/`). Nothing is sent anywhere and nothing typed is kept. The 404 page searches the words
  of the bad address. Every heading and FAQ question inside a page now has an id, so a result opens at its answer.
  - **After editing any page, run `node _search/build-index.mjs`.** `site-check` fails when the index or the
    /search/ page list is stale, or when a page with a header has no Search link (`node _search/add-header-link.mjs`).
  - Accuracy is measured, not assumed: `node _search/score.mjs` runs the frozen query set (`_search/queries.json`,
    must stay at 68/75 or better with the right page first) plus the development and blind acceptance sets.
    Fix a miss by improving the search, never by editing an expected answer without saying why.
  - `node --test _search/search.test.mjs` (unit tests) and `node _search/harness.mjs [--live]` (drives the real
    dialog in headless Chrome: keyboard, phone widths, dark mode, no JavaScript, no outside requests).
  - `node _search/why.mjs "query"` shows how the top pages were scored.

## Self-test (any model can run it)

- `node _test/site-check.mjs` serves this folder and opens every page in headless Chrome at phone (390 px) and
  desktop (1280 px) width. It fails on page errors, failed same-site requests, sideways scroll (naming the element),
  broken images, a missing title, viewport, h1 or img alt, and dead internal links or #fragments. A missing meta
  description is a note, not a failure. `--live` checks martinapps.dev after a push; `--shots DIR` saves screenshots;
  `--self-test` proves it on a fault-planted mini site in `_test/fixtures/`. Exit 0 clear, 1 failures, 2 could not run.
- It lives in `_test/` because GitHub Pages does not publish underscore folders. `_config.yml` also excludes `ai/`
  and `_test/` from the website (2026-11-21; before that these notes were readable at martinapps.dev/ai/STATE.md).
- Store links and store state are Store Watch's job (dev-ops `scripts/store-watch.mjs`, every morning).
- Accessibility (2026-11-22): site-check also runs axe-core 4.10.2 (vendored in `_test/vendor/`, MPL-2.0) on every page
  at both widths, WCAG 2.1 A/AA rules, light mode; a run takes about 3 minutes. A one-off audit the same day also ran
  dark mode and axe's best-practice rules. It found links told apart by color alone on the older support and privacy
  pages (now underlined in running text, `assets/site.css`) and no `<main>` on the Retold and Tellfolk pages (added).
  After those fixes, nothing is left. Page weight is 200-470 KB a page; the biggest single file is the Newsreader font (129 KB, cached after
  the first page).
- Findability (2026-11-22): `sitemap.xml` is written by `node _search/build-index.mjs` from the same page list as the
  search index (noindex and redirect pages left out, each at its canonical address), and `robots.txt` points to it.
  site-check fails when the sitemap is stale. Submitting it in Google Search Console is a separate step, not done here.
- First run 2026-11-21: 26 pages, all clear locally and live; the 12 support, privacy and terms pages and the 404
  page then got a one-sentence meta description, so the run has no notes either.

## Next

- Keep each app's privacy/support pages in step with the shipped binary: when an app version changes
  its data handling, this repo changes in the same release.
- Credentials wording sweep after Alabama licensure posts (tracked in dev-ops worklist, not here).
