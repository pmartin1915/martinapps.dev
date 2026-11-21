const TOSS = {t: 12.5, x: 137.88, y: 91.37, ang: -37.2, style: "skate"};
/* The Builder's hammer toss (body of assets/builder.js; gen.py prepends `const TOSS = {...}`).
 *
 * As the figure climbs, he flicks his hammer out of the icon. It falls onto the "U" of the hero headline,
 * bounces off the right-hand stem, drops into the bowl, rocks from side to side and settles at the bottom.
 *
 * How: the headline's first glyph is rendered to a canvas and turned into a signed-distance field, so
 * collisions use the REAL letter shape at the real size (any viewport, any font). A small rigid-body
 * solver (impulses, friction, sleeping) drops a hammer into it. A seeded search tries tosses until one
 * hits the right stem first, bounces into the bowl, crosses it at least 3 times and comes to rest in it;
 * that run is recorded and played back, slowed, against the page's animation clock so it stays in sync
 * with the CSS scene (and with anything that seeks it). Reduced motion: nothing runs.
 *
 * Performance (learned the hard way, 2026-10-30): the search costs ~300 ms on a laptop and froze a phone
 * for seconds right after the cube went in, so ALL of it runs in a Web Worker, started at page load, never
 * during the scene. The main thread only draws one element per frame. If the plan is not ready at release
 * time the hammer simply starts late; it never blocks and never jumps.
 * Two toss styles (TOSS.style, or ?toss=classic|skate|random in the URL; first visit = skate, later visits = random style + random seed):
 *   classic - a high lob, light head, wedges and rocks in the bowl (saved at git tag builder-v1-classic-toss).
 *   skate   - a low sideways flick, heavy head, slippery: hits the right stem, bounces, then slides down the U
 *             like a skateboard in a half-pipe, head down, rocks across and settles in the middle (default).
 * Text mode (2026-11-21, Perry: "falls onto and interacts with whatever text is below it at the time"): the header
 * is sticky, so what lies under the icon depends on the scroll. The words visible under it are drawn into the
 * collision mask (their real font, size and place) and the same physics bounces the hammer off them until it rests
 * on a word. It re-plans when the page stops scrolling (only before the toss), and at release it waits for a plan
 * made at the current scroll rather than jumping. No usable text below in view: the letter target, as before.
 * ?toss=letter forces the letter target. Debug: add ?hammerdebug to the URL to see the mask the physics uses.
 */
(function () {
  'use strict';
  // The M's staircase build (SMIL, for Safari, which cannot animate CSS `d`): start it unless reduced motion is on.
  if (window.matchMedia && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    [].forEach.call(document.querySelectorAll('.mark-build animate.mb'), function (a) { try { a.beginElement(); } catch (e) {} });
  }
  if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  // First visit: the skate slide. Every later visit: a random style and a fresh random take. The only thing
  // stored is a "seen" flag in localStorage (never sent anywhere). ?toss=classic|skate|random forces one.
  var STYLES = ['skate', 'classic'], STYLE, SEED = 20261030;
  (function () {
    var q = /[?&]toss=(classic|skate|random)/.exec(location.search), returning = false;
    try { returning = !!localStorage.getItem('ma-builder-seen'); localStorage.setItem('ma-builder-seen', '1'); } catch (e) {}
    var want = q ? q[1] : returning ? 'random' : (TOSS.style || 'skate');
    if (want === 'random') { STYLE = STYLES[Math.floor(Math.random() * STYLES.length)]; SEED = (Math.random() * 4294967296) >>> 0; } else STYLE = want;
  })();
  var PLAY = STYLE === 'skate' ? .6 : .5, REC = 1 / 120;
  var mark = document.querySelector('.mark-wrap');
  var h1 = document.querySelector('.hero h1') || document.querySelector('h1');
  if (!mark || !h1 || !h1.firstChild || h1.firstChild.nodeType !== 3) return;
  /* The target letter. Wide layouts (the header icon sits right above the "Our apps" heading): the "u" of "Our",
     provided it is on screen without scrolling. Everything else (phones, short windows): the "U" of the headline. */
  function target() {
    var h2 = document.getElementById('apps-h');
    if (innerWidth >= 900 && h2 && h2.firstChild && h2.firstChild.nodeType === 3 && /^.u/.test(h2.firstChild.data)) {
      var r = document.createRange(); r.setStart(h2.firstChild, 1); r.setEnd(h2.firstChild, 2);
      var rc = r.getClientRects()[0];
      if (rc && rc.width && rc.bottom + scrollY < innerHeight - 40) return { node: h2.firstChild, idx: 1, el: h2, lmin: 8.5 };
    }
    return { node: h1.firstChild, idx: 0, el: h1, lmin: 11 };
  }
  function ss(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
  /* Text mode: the words on screen under the icon right now, as {text, font, size, x, base} in page px. */
  var BAND_L = 110, BAND_R = 250, BAND_H = 620;
  function band() {   // viewport px: a column under the release point, from the header down to the bottom of the screen
    var mr = mark.getBoundingClientRect(), x0 = mr.left + TOSS.x * mr.width / 280, y0 = mr.top + TOSS.y * mr.height / 280, vw = document.documentElement.clientWidth;
    var hdr = mark.closest('header'), T = Math.max((hdr ? hdr.getBoundingClientRect().bottom : mr.bottom) + 4, 0);
    return { L: Math.max(0, x0 - BAND_L), R: Math.min(vw, x0 + BAND_R), T: T, B: Math.min(innerHeight - 6, T + BAND_H), x0: x0, y0: y0 };
  }
  function scanText(bd) {
    var out = [], hdr = mark.closest('header'), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), n, m, re = /\S+/g, fontOf = new Map(), cv = document.createElement('canvas').getContext('2d');
    while ((n = w.nextNode()) && out.length < 400) {
      var pe = n.parentElement; if (!pe || !/\S/.test(n.data)) continue;
      if ((hdr && hdr.contains(pe)) || pe.closest('script,style,noscript,[aria-hidden="true"],svg,button,select,textarea')) continue;
      var pr = pe.getBoundingClientRect(); if (pr.bottom < bd.T || pr.top > bd.B || pr.right < bd.L || pr.left > bd.R) continue;
      var cs = getComputedStyle(pe); if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      var font = fontOf.get(pe); if (!font) { font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily; fontOf.set(pe, font); }
      re.lastIndex = 0;
      while ((m = re.exec(n.data)) && out.length < 400) {
        var r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length);
        var rc = r.getClientRects()[0]; if (!rc || !rc.width || rc.top < bd.T || rc.bottom > bd.B || rc.left < bd.L || rc.right > bd.R) continue;   // whole words only: a sliver cut at the band edge is not something to land on
        cv.font = font; var fm = cv.measureText(m[0]);
        out.push({ text: m[0], font: font, size: parseFloat(cs.fontSize) || 16, x: rc.left + scrollX, base: rc.top + scrollY + fm.fontBoundingBoxAscent });
      }
    }
    return out;
  }

  /* ================= core: pure computation, no DOM. Runs in a Worker (or inline as a fallback). ================= */
  function core() {
    var G = 2300, DT = 1 / 480, REC = 1 / 120, TRIALS = 260, MAXT = 9;
    function rng(seed) {
      var a = seed >>> 0;
      return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }
    function ss(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
    function field(g) {   // signed distance to the ink (negative inside), brute force over boundary pixels
      var W = g.W, H = g.H, ink = g.ink, bx = [], by = [], i, j, k, d, best, dx, dy;
      for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
        if (!ink[j * W + i]) continue;
        if (i === 0 || j === 0 || i === W - 1 || j === H - 1 || !ink[j * W + i - 1] || !ink[j * W + i + 1] || !ink[(j - 1) * W + i] || !ink[(j + 1) * W + i]) { bx.push(i + .5); by.push(j + .5); }
      }
      var sdf = new Float32Array(W * H), n = bx.length;
      for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
        best = 1e9;
        for (k = 0; k < n; k++) { dx = bx[k] - i - .5; dy = by[k] - j - .5; d = dx * dx + dy * dy; if (d < best) best = d; }
        best = Math.sqrt(best); sdf[j * W + i] = ink[j * W + i] ? -best : best;
      }
      g.sdf = sdf;
    }
    function edt(g) {   // exact Euclidean distance transform (Felzenszwalb), O(pixels): a text mask is far bigger than one letter
      var W = g.W, H = g.H, ink = g.ink, INF = 1e20, N = Math.max(W, H), f = new Float64Array(N), d = new Float64Array(N), v = new Int32Array(N), z = new Float64Array(N + 1);
      function one(n) {
        var k = 0, q, s; v[0] = 0; z[0] = -INF; z[1] = INF;
        for (q = 1; q < n; q++) { s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); } k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
        k = 0; for (q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
      }
      function pass(target) {   // squared distance from every pixel to the nearest pixel whose ink === target
        var g2 = new Float64Array(W * H), i, j;
        for (j = 0; j < H; j++) { for (i = 0; i < W; i++) f[i] = ink[j * W + i] === target ? 0 : INF; one(W); for (i = 0; i < W; i++) g2[j * W + i] = d[i]; }
        for (i = 0; i < W; i++) { for (j = 0; j < H; j++) f[j] = g2[j * W + i]; one(H); for (j = 0; j < H; j++) g2[j * W + i] = d[j]; }
        return g2;
      }
      var out = pass(1), inn = pass(0), sdf = new Float32Array(W * H), i;
      for (i = 0; i < W * H; i++) sdf[i] = ink[i] ? -Math.sqrt(inn[i]) : Math.sqrt(out[i]);
      g.sdf = sdf;
    }
    function at(g, i, j) { i = i < 0 ? 0 : i >= g.W ? g.W - 1 : i; j = j < 0 ? 0 : j >= g.H ? g.H - 1 : j; return g.sdf[j * g.W + i]; }
    function dist(g, x, y) {
      var u = x - g.ox - .5, v = y - g.oy - .5;
      if (u < -2 || v < -2 || u > g.W + 1 || v > g.H + 1) return 1e3;
      var i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
      return (at(g, i, j) * (1 - fu) + at(g, i + 1, j) * fu) * (1 - fv) + (at(g, i, j + 1) * (1 - fu) + at(g, i + 1, j + 1) * fu) * fv;
    }
    var STY = {
      classic: { headW: 1.4, mu: .35, e: .5, T0: .55, T1: 1.15, vyMin: -1500, spin: 15 },
      skate:   { headW: 3.2, mu: .1,  e: .42, T0: .26, T1: .5,   vyMin: -650,  spin: 7 }
    };
    function hammer(g, st) {   // weighted contact points around a handle and a head
      var gap = Math.max(10, g.cr - g.cl), L = Math.max(g.lmin || 11, Math.min(70, gap * .72));
      var Lh = L / 1.1, th = .2 * Lh, hh = .62 * Lh, rh = Math.max(1.1, .05 * Lh), pts = [], u;
      for (u = 0; u <= .76 * Lh; u += .25 * Lh) pts.push([u, 0, rh, .5]);
      [[Lh - th / 2, -hh / 2], [Lh - th / 2, hh / 2], [Lh + th / 2, -hh / 2], [Lh + th / 2, hh / 2], [Lh + th / 2, 0], [Lh, -hh / 2], [Lh, hh / 2]].forEach(function (p) { pts.push([p[0], p[1], 1.2, st.headW]); });
      var M = 0, cx = 0; pts.forEach(function (p) { M += p[3]; cx += p[0] * p[3]; }); cx /= M;
      var I = 0; pts.forEach(function (p) { p[0] -= cx; I += p[3] * (p[0] * p[0] + p[1] * p[1]); });
      return { L: L, Lh: Lh, th: th, hh: hh, rh: rh, pts: pts, M: M, I: I, cx: cx };
    }
    function simulate(g, b, s, st) {   // rigid body with impulses + friction; returns the recorded run
      var x = s.x, y = s.y, a = s.a, vx = s.vx, vy = s.vy, w = s.w, frames = [], events = [], still = 0, slide = 0, hit, steps = MAXT / DT, n, i, it, cs, sn, t;
      for (n = 0; n < steps; n++) {
        t = n * DT;
        vy += G * DT; var dr = 1 - .05 * DT, ar = 1 - .3 * DT; vx *= dr; vy *= dr; w *= ar;
        x += vx * DT; y += vy * DT; a += w * DT; hit = false;
        for (it = 0; it < 4; it++) {
          cs = Math.cos(a); sn = Math.sin(a);
          for (i = 0; i < b.pts.length; i++) {
            var p = b.pts[i], rx = cs * p[0] - sn * p[1], ry = sn * p[0] + cs * p[1], px = x + rx, py = y + ry, d = dist(g, px, py) - p[2];
            if (d >= 0) continue;
            hit = true;
            var gx = dist(g, px + 1, py) - dist(g, px - 1, py), gy = dist(g, px, py + 1) - dist(g, px, py - 1), gl = Math.hypot(gx, gy) || 1, nx = gx / gl, ny = gy / gl;
            x += nx * -d * .55; y += ny * -d * .55;
            var vcx = vx - w * ry, vcy = vy + w * rx, vn = vcx * nx + vcy * ny;
            if (vn >= 0) continue;
            var e = -vn > 140 ? st.e : 0, rn = rx * ny - ry * nx, j = -(1 + e) * vn / (1 / b.M + rn * rn / b.I);
            vx += j * nx / b.M; vy += j * ny / b.M; w += j * rn / b.I;
            if (-vn > 90 && it === 0) events.push({ t: t, x: px, y: py, vn: -vn });
            vcx = vx - w * ry; vcy = vy + w * rx;
            var tx = -ny, ty = nx, vt = vcx * tx + vcy * ty, rt = rx * ty - ry * tx, jt = -vt / (1 / b.M + rt * rt / b.I), lim = st.mu * j;
            jt = jt > lim ? lim : jt < -lim ? -lim : jt;
            vx += jt * tx / b.M; vy += jt * ty / b.M; w += jt * rt / b.I;
          }
        }
        if (hit && Math.hypot(vx, vy) > 60 && y > g.top + .4 * (g.bot - g.top)) slide += DT;   // time spent sliding along the bowl
        if (n % Math.round(REC / DT) === 0) frames.push([x, y, a]);
        if (g.vbot && y > g.vbot + 120) break;   // text mode: fell past everything in view
        if (Math.hypot(vx, vy) < 9 && Math.abs(w) < .35 && t > .3 && dist(g, x, y) < 3 * b.L) { still += DT; if (still > .45) return { frames: frames, events: events, slept: t, rest: [x, y, a], slide: slide }; } else still = 0;
      }
      return { frames: frames, events: events, slept: null, rest: [x, y, a], slide: slide };
    }
    function onscreen(g, r) {   // the hammer must stay in view the whole time (no rocketing off the top or sides)
      var i, f; for (i = 0; i < r.frames.length; i++) { f = r.frames[i]; if (f[1] < (g.far ? 6 : Math.min(g.top, g.y0) - 150) || f[0] < -30 || f[0] > g.vw + 30) return false; } return true;
    }
    function judge(g, b, r, style) {   // right stem first, ends in the bowl, crosses it, livelier and longer is better
      if (r.slept === null || !onscreen(g, r)) return -1;
      var h = g.bot - g.top, first = null, i;
      for (i = 0; i < r.events.length; i++) if (r.events[i].vn > 100) { first = r.events[i]; break; }
      if (!first || first.x < g.mid || first.y > g.top + .34 * h) return -1;
      var rx = r.rest[0], ry = r.rest[1];
      if (rx < g.cl + 1 || rx > g.cr - 1 || ry < g.top + .45 * h || ry > g.bot) return -1;
      var cross = 0, side = 0, f, sd;
      for (i = 0; i < r.frames.length; i++) { f = r.frames[i]; if (f[1] < g.top + .35 * h) continue; sd = f[0] > g.mid ? 1 : -1; if (side && sd !== side) cross++; side = sd; }
      if (style === 'skate') {   // a real slide, head (the heavy end) down, settled in the middle
        var a = r.rest[2], headY = ry + Math.sin(a) * (b.Lh - b.cx), tailY = ry - Math.sin(a) * b.cx, gap = g.cr - g.cl;
        if (cross < 2 || r.slide < .45 || headY < tailY - .5 || Math.abs(rx - (g.cl + g.cr) / 2) > .2 * gap || r.slept > 8.5) return -1;
        return r.slide * 5 + cross * 2 + Math.min(r.events.length, 10) * .3 - r.slept * .2;
      }
      if (cross < 3 || r.events.length < 3 || r.slept > 8) return -1;
      return cross * 3 + Math.min(r.slept, 4.5) + Math.min(r.events.length, 12) * .4;
    }
    function judgeLite(g, b, r) {   // second choice: still must hit the right side first and END IN THE BOWL
      if (r.slept === null || !onscreen(g, r)) return -1;
      var h = g.bot - g.top, first = null, i;
      for (i = 0; i < r.events.length; i++) if (r.events[i].vn > 100) { first = r.events[i]; break; }
      if (!first || first.x < g.mid || first.y > g.top + .45 * h) return -1;
      var rx = r.rest[0], ry = r.rest[1];
      if (rx < g.cl + 1 || rx > g.cr - 1 || ry < g.top + .45 * h || ry > g.bot) return -1;
      var cross = 0, side = 0, f, sd;
      for (i = 0; i < r.frames.length; i++) { f = r.frames[i]; if (f[1] < g.top + .35 * h) continue; sd = f[0] > g.mid ? 1 : -1; if (side && sd !== side) cross++; side = sd; }
      if (cross < 1 && r.slide < .2) return -1;
      return r.slide * 3 + cross + Math.min(r.events.length, 10) * .2;
    }
    function judgeAny(g, b, r) {   // last physical resort: it still ends in the bowl, in view, after a bounce
      if (r.slept === null || !onscreen(g, r) || r.events.length < 1) return -1;
      var rx = r.rest[0], ry = r.rest[1], h = g.bot - g.top;
      if (rx < g.cl + 1 || rx > g.cr - 1 || ry < g.top + .45 * h || ry > g.bot) return -1;
      return Math.min(r.events.length, 10) + Math.min(r.slept, 4);
    }
    function judgeText(g, b, r, strict) {   // text mode: bounces off the words and comes to rest ON a word, in view
      if (r.slept === null) return -1;
      var i, f, ev = 0;
      for (i = 0; i < r.frames.length; i++) { f = r.frames[i]; if (f[0] < g.left - 10 || f[0] > g.right + 10 || f[1] > g.vbot - 4 || f[1] < g.y0 - 160) return -1; }
      for (i = 0; i < r.events.length; i++) if (r.events[i].vn > 100) ev++;
      if (ev < (strict ? 2 : 1) || (strict && r.slept > 8)) return -1;
      if (dist(g, r.rest[0], r.rest[1]) > b.L * .9 || r.rest[1] > g.vbot - 8) return -1;
      return Math.min(ev, 8) + r.slide * 2 + Math.min(r.slept, 4) * .3 + (r.rest[1] < g.firstBot ? 1.5 : 0);   // a little extra for staying on the first line it hits
    }
    function searchText(m, name, rnd) {
      var st = STY[name], b = hammer(m, st), best = [null, null], bs = [0, 0], k, stat = { skip: 0, sim: 0, slept: 0 };
      for (k = 0; k < TRIALS; k++) {
        var aim = m.aims[Math.floor(rnd() * m.aims.length)], tx = aim[0], ty = aim[1] - .3 * b.L;
        var Tf = Math.sqrt(2 * Math.max(0, ty - m.y0) / G), T0 = Math.max(st.T0, Tf * .92), T = T0 + rnd() * (Math.max(st.T1, Tf * 1.5) - T0);
        var w0 = (rnd() * 2 - 1) * st.spin + (rnd() < .5 ? -3 : 3), a0 = m.ang * Math.PI / 180 + (rnd() - .5) * 1.2;
        var s = { x: m.x0, y: m.y0, a: a0, vx: (tx - m.x0) / T, vy: (ty - m.y0 - .5 * G * T * T) / T, w: w0 };
        if (s.vy < Math.min(st.vyMin, -120) * 1.6 || s.vy > 400 + 3 * Math.max(0, ty - m.y0)) { stat.skip++; continue; }
        var r = simulate(m, b, s, st); stat.sim++; if (r.slept !== null) stat.slept++;
        var sc = [judgeText(m, b, r, true), judgeText(m, b, r, false)], q;
        for (q = 0; q < 2; q++) if (sc[q] > bs[q]) { bs[q] = sc[q]; best[q] = r; }
      }
      return { b: b, best: best, stat: stat };
    }
    function search(m, name, rnd) {   // all three tiers for one style: strict, relaxed, any
      var st = STY[name]; if (m.far) st = Object.assign({}, st, { vyMin: -120 });
      var b = hammer(m, st), tx = m.rtx - .12 * b.L, ty = m.rty - .28 * b.L, k;
      var best = [null, null, null], bs = [0, 0, 0], stat = { skip: 0, sim: 0, slept: 0, off: 0, any: 0 };
      for (k = 0; k < TRIALS; k++) {
        var Tf = m.far ? Math.sqrt(2 * Math.max(0, ty - m.y0) / G) : 0, T = Math.max(st.T0, Tf * .92) + rnd() * (Math.max(st.T1, Tf * 1.5) - Math.max(st.T0, Tf * .92)), w0 = (rnd() * 2 - 1) * st.spin + (rnd() < .5 ? -3 : 3), a0 = m.ang * Math.PI / 180 + (rnd() - .5) * 1.2;
        var s = { x: m.x0, y: m.y0, a: a0, vx: (tx - m.x0) / T, vy: (ty - m.y0 - .5 * G * T * T) / T, w: w0 };
        if (s.vy < st.vyMin || s.vy > (m.far ? 400 + 3 * Math.max(0, ty - m.y0) : 400)) { stat.skip++; continue; }
        var r = simulate(m, b, s, st); stat.sim++; if (r.slept !== null) stat.slept++; if (onscreen(m, r)) stat.off++;
        var sc = [judge(m, b, r, name), judgeLite(m, b, r), judgeAny(m, b, r)], q;
        for (q = 0; q < 3; q++) if (sc[q] > bs[q]) { bs[q] = sc[q]; best[q] = r; }
      }
      return { b: b, best: best, tx: tx, ty: ty, stat: stat };
    }
    return function plan(m) {
      if (m.mode === 'text') {   // strict tier in either style, then relaxed; nothing at all -> the caller falls back to the letter
        edt(m);
        var ordT = m.style === 'classic' ? ['classic', 'skate'] : ['skate', 'classic'], rT = rng(m.seed || 20261030), runT = [], pk = null, bb = null, tr = 0, o2, q2;
        for (q2 = 0; q2 < 2 && !pk; q2++) for (o2 = 0; o2 < 2 && !pk; o2++) { runT[o2] = runT[o2] || searchText(m, ordT[o2], rT); if (runT[o2].best[q2]) { pk = runT[o2].best[q2]; bb = runT[o2].b; tr = q2; } }
        var stT = runT.map(function (x) { return x && x.stat; });
        if (!pk) return { sig: m.sig, fail: true, stat: stT };
        return { mode: 'text', stat: stT, sig: m.sig, b: { L: bb.L, Lh: bb.Lh, th: bb.th, hh: bb.hh, rh: bb.rh, cx: bb.cx }, frames: pk.frames, scored: true, tier: tr, ox: m.ox, oy: m.oy, sy: m.sy, rest: pk.rest };
      }
      field(m);
      var order = m.style === 'classic' ? ['classic', 'skate'] : ['skate', 'classic'], rnd = rng(m.seed || 20261030), runs = order.map(function (n) { return null; }), pick = null, tier = 0, b = null, q, o, res;
      // requested style: strict, then relaxed; other style: strict, then relaxed; then any physical take; then script
      for (o = 0; o < 2 && !pick; o++) { runs[o] = search(m, order[o], rnd); if (runs[o].best[0]) { pick = runs[o].best[0]; b = runs[o].b; tier = 0; } else if (runs[o].best[1] && o === 0) { pick = runs[o].best[1]; b = runs[o].b; tier = 1; } }
      for (o = 0; o < 2 && !pick; o++) if (runs[o].best[1]) { pick = runs[o].best[1]; b = runs[o].b; tier = 1; }
      for (o = 0; o < 2 && !pick; o++) if (runs[o].best[2]) { pick = runs[o].best[2]; b = runs[o].b; tier = 2; }
      var ok = !!pick;
      if (!ok) {   // last resort: a short scripted drop into the bowl so the gag still lands
        b = runs[0].b; var tx = runs[0].tx, ty = runs[0].ty, fr = [], rest = [(m.cl + m.cr) / 2, m.bot - 1.2 * b.hh, .12], n, u;
        for (n = 0; n <= 180; n++) { u = n / 180; fr.push([m.x0 + (tx - m.x0) * ss(u * 1.6), m.y0 + (ty - m.y0) * ss(Math.min(1, u * 1.6)) + (u > .62 ? (rest[1] - ty) * ss((u - .62) / .38) : 0) - Math.sin(Math.min(1, u * 1.6) * Math.PI) * Math.max(8, Math.min(120, m.y0 - 10)), m.ang * Math.PI / 180 + u * 6]); }
        fr[fr.length - 1] = rest; pick = { frames: fr, slept: 1.5 }; tier = 3;
      }
      return { stat: runs.map(function (r) { return r && r.stat; }), sig: m.sig, b: { L: b.L, Lh: b.Lh, th: b.th, hh: b.hh, rh: b.rh, cx: b.cx }, frames: pick.frames, scored: ok, tier: tier, ox: m.ox, oy: m.oy };
    };
  }

  /* ================= main thread: measure the letter, ask for a plan early, draw the hammer ================= */
  var asked = '', off = [0, 0], sc0 = .3, P = null, el = null, anim = null, done = false, finT = 0, shift = null, loc = null, worker = null, planInline = null;

  function metrics() {   // where the first glyph is on the page (cheap; no pixels)
    var tg = target(), ch = tg.node.data.charAt(tg.idx), cs = getComputedStyle(tg.el), r = document.createRange();
    r.setStart(tg.node, tg.idx); r.setEnd(tg.node, tg.idx + 1);
    var rc = r.getClientRects()[0]; if (!rc || !rc.width) return null;
    var c = document.createElement('canvas').getContext('2d');
    c.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var m = c.measureText(ch), pad = 26;
    return { ch: ch, c: c, pad: pad, lmin: tg.lmin, abl: m.actualBoundingBoxLeft, abr: m.actualBoundingBoxRight, aa: m.actualBoundingBoxAscent, ad: m.actualBoundingBoxDescent,
             ox: rc.left + scrollX - m.actualBoundingBoxLeft - pad, oy: rc.top + scrollY + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent - pad };
  }
  var lettersOnly = false;   // true for one request after text mode found nothing it could land on
  function requestText() {   // text mode: mask the words on screen under the icon; false = nothing usable here
    var bd = band(), words = scanText(bd); if (/hammerdebug/.test(location.search)) window.__hammerScan = { band: bd, words: words.length, sy: scrollY, at: Math.round(performance.now()) };
    if (!words.length) return false;
    var ox = Math.floor(bd.L + scrollX), oy = Math.floor(bd.T + scrollY), W = Math.ceil(bd.R - bd.L), H = Math.ceil(bd.B - bd.T);
    if (W < 40 || H < 40) return false;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var x = cv.getContext('2d'), sizes = [], i, j; x.fillStyle = '#000'; x.textBaseline = 'alphabetic';
    words.forEach(function (w) { x.font = w.font; x.fillText(w.text, w.x - ox, w.base - oy); sizes.push(w.size); });
    var px = x.getImageData(0, 0, W, H).data, ink = new Uint8Array(W * H), aims = [], first = H;
    for (i = 0; i < W * H; i++) ink[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    for (j = 0; j < H && first === H; j++) for (i = 0; i < W; i++) if (ink[j * W + i]) { first = j; break; }
    if (first === H) return false;
    sizes.sort(function (a, b) { return a - b; });
    var fs = sizes[Math.floor(sizes.length / 2)], L = Math.max(16, Math.min(44, 1.5 * fs)), firstBot = Math.min(H, Math.round(first + 1.6 * fs));
    for (i = 0; i < W; i += 2) for (j = first; j < H; j++) if (ink[j * W + i]) { aims.push([ox + i, oy + j]); break; }   // the top surface of the text in every column
    if (aims.length < 4) return false;
    var x0 = bd.x0 + scrollX, y0 = bd.y0 + scrollY, sig = ['t', ox, oy, W, H, words.length, Math.round(x0), Math.round(y0)].join();
    if (sig === asked) return true; asked = sig;
    var mr = mark.getBoundingClientRect(); sc0 = Math.min(1, Math.max(.1, .88 * mr.width / 280 * 58 / L));
    send({ mode: 'text', sig: sig, W: W, H: H, ink: ink, ox: ox, oy: oy, left: ox, right: ox + W, top: oy + first, bot: oy + H, mid: ox + W / 2, cl: 0, cr: 1, lmin: L,
           aims: aims, firstBot: oy + firstBot, vbot: scrollY + bd.B, far: (oy + first) - y0 > 250, ang: TOSS.ang, style: STYLE, seed: SEED,
           vw: document.documentElement.clientWidth, x0: x0, y0: y0, sy: scrollY });
    return true;
  }
  function send(msg) {
    if (/hammerdebug/.test(location.search)) debugMask(msg);
    if (worker) {
      if (pending) { worker.terminate(); worker = makeWorker(); }   // the layout moved again: drop the stale search, start fresh
      if (worker) { pending = msg.sig; worker.postMessage(msg); return; }
    }
    if (!planInline) planInline = core();
    setTimeout(function () { accept(planInline(msg)); }, 0);
  }
  function request() {   // build the ink mask and the toss geometry, hand the heavy part to the worker
    if (!lettersOnly && !/[?&]toss=letter/.test(location.search) && requestText()) return;
    var q = metrics(); if (!q) return;
    var W = Math.ceil(q.abl + q.abr) + 2 * q.pad, H = Math.ceil(q.aa + q.ad) + 2 * q.pad;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var x = cv.getContext('2d'); x.font = q.c.font; x.fillStyle = '#000'; x.textBaseline = 'alphabetic'; x.fillText(q.ch, q.pad + q.abl, q.pad + q.aa);
    var px = x.getImageData(0, 0, W, H).data, ink = new Uint8Array(W * H), i, j, top = H, bot = 0, left = W, right = 0;
    for (i = 0; i < W * H; i++) ink[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    for (j = 0; j < H; j++) for (i = 0; i < W; i++) if (ink[j * W + i]) { if (j < top) top = j; if (j > bot) bot = j; if (i < left) left = i; if (i > right) right = i; }
    var row = Math.round(top + .4 * (bot - top)), runs = [], inRun = false;
    for (i = 0; i < W; i++) { if (ink[row * W + i] && !inRun) { runs.push([i, i]); inRun = true; } else if (ink[row * W + i]) runs[runs.length - 1][1] = i; else inRun = false; }
    var cl = runs.length >= 2 ? runs[0][1] + 1 : left + .3 * (right - left), cr = runs.length >= 2 ? runs[1][0] : right - .3 * (right - left);
    var rtx = right - 4, rty = H;
    for (j = 0; j < H && rty === H; j++) for (i = Math.round((left + right) / 2); i <= right; i++) if (ink[j * W + i]) { rty = j; rtx = i; break; }
    var mr = mark.getBoundingClientRect(), ox = q.ox, oy = q.oy;
    var sig = [Math.round(ox), Math.round(oy), W, H, Math.round(mr.left), Math.round(mr.top), Math.round(mr.width)].join();
    if (sig === asked) return; asked = sig;
    sc0 = Math.min(1, Math.max(.1, .88 * mr.width / 280 * 58 / Math.max(q.lmin, (cr - cl) * .72)));
    var msg = { sig: sig, W: W, H: H, ink: ink, ox: ox, oy: oy, top: oy + top, bot: oy + bot, left: ox + left, right: ox + right, mid: ox + (left + right) / 2,
                lmin: q.lmin, far: (oy + rty) - (mr.top + scrollY + TOSS.y * mr.height / 280) > 250, cl: ox + cl, cr: ox + cr, rtx: ox + rtx, rty: oy + rty, ang: TOSS.ang, style: STYLE, seed: SEED, vw: document.documentElement.clientWidth,
                x0: mr.left + scrollX + TOSS.x * mr.width / 280, y0: mr.top + scrollY + TOSS.y * mr.height / 280, sy: scrollY };
    send(msg);
  }
  var workerUrl = null, pending = null;
  function makeWorker() {
    try {
      workerUrl = workerUrl || URL.createObjectURL(new Blob(['var plan=(' + core.toString() + ')();onmessage=function(e){postMessage(plan(e.data))};'], { type: 'text/javascript' }));
      var w = new Worker(workerUrl);
      w.onmessage = function (e) { if (w === worker) { pending = null; accept(e.data); } };
      w.onerror = function () { if (w === worker) { worker = null; planInline = core(); pending = null; asked = ''; request(); } };
      return w;
    } catch (err) { planInline = core(); return null; }
  }
  worker = makeWorker();

  function accept(r) {
    if (!r || r.sig !== asked) return;
    if (r.fail) { if (/hammerdebug/.test(location.search)) window.__hammerTextFail = r; lettersOnly = true; asked = ''; request(); lettersOnly = false; return; }   // nothing to land on in this text: the letter instead
    if (P && shift !== null) return;                      // already flying (or landed): keep this take
    if (/hammerdebug/.test(location.search)) window.__hammerPlan = r;
    var old = el; P = r; el = build(P.b); if (old) old.remove(); done = false; put(0, 0, 0, 1, false);
  }
  function build(b) {
    var ns = 'http://www.w3.org/2000/svg', L = b.L, s = document.createElementNS(ns, 'svg'), u0 = -b.cx;
    s.setAttribute('viewBox', [-L, -L, 2 * L, 2 * L].join(' ')); s.setAttribute('width', 2 * L); s.setAttribute('height', 2 * L); s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'position:absolute;left:0;top:0;margin:' + (-L) + 'px 0 0 ' + (-L) + 'px;pointer-events:none;z-index:50;opacity:0;will-change:transform';
    s.innerHTML = '<line x1="' + u0 + '" y1="0" x2="' + (u0 + b.Lh) + '" y2="0" stroke="#7A5A2E" stroke-width="' + 2 * b.rh + '" stroke-linecap="round"/>' +
      '<rect x="' + (u0 + b.Lh - b.th / 2) + '" y="' + (-b.hh / 2) + '" width="' + b.th + '" height="' + b.hh + '" rx="' + Math.max(.8, b.th * .18) + '" fill="#555"/>';
    document.body.appendChild(s); return s;
  }
  function put(x, y, a, sc, vis) { if (!el) return; el.style.opacity = vis ? 1 : 0; el.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + a + 'rad) scale(' + sc + ')'; }

  function frame() {
    if (!anim) { anim = document.getAnimations().filter(function (x) { return x.animationName === 'bx-move'; })[0]; if (!anim) return requestAnimationFrame(frame); }
    var ms = anim.currentTime; if (ms == null) return requestAnimationFrame(frame);
    var tt = ms / 1000;
    if (anim.playState === 'finished') { finT = finT || performance.now(); tt += (performance.now() - finT) / 1000; }   // keep going past the end of the scene
    var t = tt - TOSS.t;
    if (P && el) {
      if (t < 0) { shift = null; if (!done) put(0, 0, 0, 1, false); }
      else {
        if (shift === null && Math.abs((P.sy || 0) - scrollY) > 24) {   // the plan was made at another scroll (sticky header: the icon moved on the page)
          put(0, 0, 0, 1, false);
          if (t < 2.5) return requestAnimationFrame(frame);   // the scroll-end re-plan is on its way: start late, never jump
          P = null; return;                                                   // still scrolling after 2.5 s: skip the toss this time
        }
        if (shift === null) shift = Math.max(0, t);   // plan arrived late: start now instead of jumping
        var tp = t - shift, fr = P.frames, k = Math.min(fr.length - 1, Math.max(0, tp) * PLAY / REC), i = Math.floor(k), f = k - i, A = fr[i], B = fr[Math.min(i + 1, fr.length - 1)];
        var sc = sc0 + (1 - sc0) * ss(tp / .55);
        put(off[0] + A[0] + (B[0] - A[0]) * f, off[1] + A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f, sc, true);
        if (k >= fr.length - 1 && !done) { done = true; var rest = fr[fr.length - 1]; loc = [rest[0] - P.ox, rest[1] - P.oy, rest[2]]; }
      }
    }
    if (anim.playState !== 'finished' || !done) requestAnimationFrame(frame);
  }
  function relocate() {   // layout changed: keep a settled hammer in the bowl, and re-plan if it has not flown yet
    if (P && P.mode === 'text') { if (shift === null) { asked = ''; request(); } else if (done && el) el.style.opacity = 0; return; }   // text reflows: re-plan, or quietly drop a landed hammer
    var q = metrics(); if (!q) return;
    if (P && shift !== null) {                            // in flight or landed: slide the whole take with the letter
      off = [q.ox - P.ox, q.oy - P.oy];
      if (done) put(q.ox + loc[0], q.oy + loc[1], loc[2], 1, true);
    } else request();                                      // not thrown yet: plan again for the new layout
  }
  addEventListener('resize', function () { setTimeout(relocate, 120); });
  var scrollT = 0;   // sticky header: a new scroll puts different text under the icon; re-plan once scrolling stops, never after the throw
  addEventListener('scroll', function () { if (shift !== null) return; clearTimeout(scrollT); scrollT = setTimeout(function () { if (shift === null) request(); }, 220); }, { passive: true });
  function debugMask(m) {
    var c = document.createElement('canvas'); c.width = m.W; c.height = m.H; var x = c.getContext('2d'), d = x.createImageData(m.W, m.H), i;
    for (i = 0; i < m.W * m.H; i++) { d.data[i * 4] = 255; d.data[i * 4 + 3] = m.ink[i] ? 150 : 0; } x.putImageData(d, 0, 0);
    c.style.cssText = 'position:absolute;left:' + m.ox + 'px;top:' + m.oy + 'px;pointer-events:none;z-index:49;outline:1px solid #0a0'; document.body.appendChild(c);
  }
  // plan early: once fonts and layout have settled, well before the scene reaches the toss
  var started = false;
  function start() { if (started) return; started = true; requestAnimationFrame(function () { setTimeout(request, 120); }); }
  function early() {
    var gate = document.fonts && document.fonts.ready ? Promise.race([document.fonts.ready, new Promise(function (r) { setTimeout(r, 2500); })]) : Promise.resolve();
    gate.then(start);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', early); else early();
  addEventListener('load', start);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { setTimeout(relocate, 100); });
  requestAnimationFrame(frame);
})();
