# Handoff 2026-11-24 -- hammer bonk

<!-- READ-FIRST:START -->
**State:** Hammer bonk easter egg built and verified in desktop Chrome. Site branch wk/hammer-bonk at 7049d62 (from main b15be66); brand repo branch wk/hammer-bonk at 5497a7f (worktree DevProjects/brand-bonk). Neither pushed. site-check 0 failures; Sonnet reviewer approved.
**Next:** 1. Perry watches C:/Users/perry/Downloads/hammer-bonk.gif and says go. 2. On go, the boss pushes wk/hammer-bonk and merges to main (a push to main publishes the site). 3. Push the brand branch too.
**Waiting on Perry:** go or no-go after the GIF.
**In flight:** nothing running. Local http.server on 127.0.0.1:8765 may still be up (kill it). Other remote branches exist (builder-limbs, site-search, wk/gait-port...), none are mine.
**Traps:** assets/builder.js is generated from brand/mascot/builder/hammer.js (edit both). The brand footer generator has drifted from the site's footer-scene.svg, so do not regenerate that SVG. Not tested on a real phone.
<!-- READ-FIRST:END -->

## Detail
Design and as-built notes: ai/HAMMER-BONK.md. Gag overlay: assets/footer-bonk.js. Hit test, funnel, edge auto-scroll: assets/builder.js. GIF is from an earlier build of the same visuals.
