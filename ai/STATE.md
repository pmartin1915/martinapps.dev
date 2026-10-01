# STATE — martinapps-site (martinapps.dev)

**Last updated:** 2026-10-01
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

## Next

- Keep each app's privacy/support pages in step with the shipped binary: when an app version changes
  its data handling, this repo changes in the same release.
- Credentials wording sweep after Alabama licensure posts (tracked in dev-ops worklist, not here).
