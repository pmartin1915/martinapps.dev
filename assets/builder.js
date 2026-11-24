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
 * Debug: add ?hammerdebug to the URL to see the glyph mask the physics uses.
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
    // Other pages name their own letter: data-hammer="<index of the letter in the element's first text>" (pick a bowl: u, U, w...)
    var own = document.querySelector('[data-hammer]');
    if (own && own.firstChild && own.firstChild.nodeType === 3) return { node: own.firstChild, idx: +own.getAttribute('data-hammer') || 0, el: own, lmin: +own.getAttribute('data-hammer-lmin') || 11, floor: +own.getAttribute('data-hammer-floor') || 0 };
    var h2 = document.getElementById('apps-h');
    if (innerWidth >= 900 && h2 && h2.firstChild && h2.firstChild.nodeType === 3 && /^.u/.test(h2.firstChild.data)) {
      var r = document.createRange(); r.setStart(h2.firstChild, 1); r.setEnd(h2.firstChild, 2);
      var rc = r.getClientRects()[0];
      if (rc && rc.width && rc.bottom + scrollY < innerHeight - 40) return { node: h2.firstChild, idx: 1, el: h2, lmin: 8.5 };
    }
    return { node: h1.firstChild, idx: 0, el: h1, lmin: 11 };
  }
  function ss(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }

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
      if (rx < g.cl + 1 || rx > g.cr - 1 || ry < g.top + (g.floor || .45) * h || ry > g.bot) return -1;
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
      if (rx < g.cl + 1 || rx > g.cr - 1 || ry < g.top + (g.floor || .45) * h || ry > g.bot) return -1;
      var cross = 0, side = 0, f, sd;
      for (i = 0; i < r.frames.length; i++) { f = r.frames[i]; if (f[1] < g.top + .35 * h) continue; sd = f[0] > g.mid ? 1 : -1; if (side && sd !== side) cross++; side = sd; }
      if (cross < 1 && r.slide < .2) return -1;
      return r.slide * 3 + cross + Math.min(r.events.length, 10) * .2;
    }
    function judgeAny(g, b, r) {   // last physical resort: it still ends in the bowl, in view, after a bounce
      if (r.slept === null || !onscreen(g, r) || r.events.length < 1) return -1;
      var rx = r.rest[0], ry = r.rest[1], h = g.bot - g.top;
      if (rx < g.cl + 1 || rx > g.cr - 1 || ry < g.top + (g.floor || .45) * h || ry > g.bot) return -1;
      return Math.min(r.events.length, 10) + Math.min(r.slept, 4);
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
  var asked = '', off = [0, 0], sc0 = .3, P = null, el = null, anim = null, done = false, finT = 0, shift = null, loc = null, home = null, worker = null, planInline = null;

  function metrics() {   // where the first glyph is on the page (cheap; no pixels)
    var tg = target(), ch = tg.node.data.charAt(tg.idx), cs = getComputedStyle(tg.el), r = document.createRange();
    r.setStart(tg.node, tg.idx); r.setEnd(tg.node, tg.idx + 1);
    var rc = r.getClientRects()[0]; if (!rc || !rc.width) return null;
    var c = document.createElement('canvas').getContext('2d');
    c.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var m = c.measureText(ch), pad = 26;
    return { ch: ch, c: c, pad: pad, lmin: tg.lmin, floor: tg.floor, abl: m.actualBoundingBoxLeft, abr: m.actualBoundingBoxRight, aa: m.actualBoundingBoxAscent, ad: m.actualBoundingBoxDescent,
             ox: rc.left + scrollX - m.actualBoundingBoxLeft - pad, oy: rc.top + scrollY + m.fontBoundingBoxAscent - m.actualBoundingBoxAscent - pad };
  }
  function request() {   // build the ink mask and the toss geometry, hand the heavy part to the worker
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
                lmin: q.lmin, floor: q.floor, far: (oy + rty) - (mr.top + scrollY + TOSS.y * mr.height / 280) > 250, cl: ox + cl, cr: ox + cr, rtx: ox + rtx, rty: oy + rty, ang: TOSS.ang, style: STYLE, seed: SEED, vw: document.documentElement.clientWidth,
                x0: mr.left + scrollX + TOSS.x * mr.width / 280, y0: mr.top + scrollY + TOSS.y * mr.height / 280 };
    if (worker) {
      if (pending) { worker.terminate(); worker = makeWorker(); }   // the layout moved again: drop the stale search, start fresh
      if (worker) { pending = sig; worker.postMessage(msg); return; }
    }
    if (!planInline) planInline = core();
    setTimeout(function () { accept(planInline(msg)); }, 0);
    if (/hammerdebug/.test(location.search)) debugMask(msg);
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
    if (P && shift !== null) return;                      // already flying (or landed): keep this take
    if (/hammerdebug/.test(location.search)) window.__hammerPlan = r;
    var old = el; P = r; el = build(P.b); if (old) old.remove(); done = false; put(0, 0, 0, 1, false);
  }
  function build(b) {
    var ns = 'http://www.w3.org/2000/svg', L = b.L, s = document.createElementNS(ns, 'svg'), u0 = -b.cx;
    s.setAttribute('viewBox', [-L, -L, 2 * L, 2 * L].join(' ')); s.setAttribute('width', 2 * L); s.setAttribute('height', 2 * L); s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'position:absolute;left:0;top:0;margin:' + (-L) + 'px 0 0 ' + (-L) + 'px;pointer-events:none;z-index:50;opacity:0;will-change:transform';
    s.innerHTML = '<line x1="' + u0 + '" y1="0" x2="' + (u0 + b.Lh) + '" y2="0" stroke="#7A5A2E" stroke-width="' + 2 * b.rh + '" stroke-linecap="round"/>' +
      '<rect x="' + (u0 + b.Lh - b.th / 2) + '" y="' + (-b.hh / 2) + '" width="' + b.th + '" height="' + b.hh + '" rx="' + Math.max(.8, b.th * .18) + '" fill="#555"/>' +
      // the finger target: an invisible fat stroke along the whole hammer, live only once it has landed (see grabbable)
      '<line class="hm-hit" x1="' + (u0 - 4) + '" y1="0" x2="' + (u0 + b.Lh + b.th / 2 + 4) + '" y2="0" stroke="transparent" stroke-width="' + Math.max(30, b.hh + 14) + '" stroke-linecap="round" style="pointer-events:none"/>';
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
      else if (!done) {                                    // once landed, the hammer is the visitor's (see grabbable): stop drawing the take
        if (shift === null) shift = Math.max(0, t);   // plan arrived late: start now instead of jumping
        var tp = t - shift, fr = P.frames, k = Math.min(fr.length - 1, Math.max(0, tp) * PLAY / REC), i = Math.floor(k), f = k - i, A = fr[i], B = fr[Math.min(i + 1, fr.length - 1)];
        var sc = sc0 + (1 - sc0) * ss(tp / .55);
        put(off[0] + A[0] + (B[0] - A[0]) * f, off[1] + A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f, sc, true);
        if (k >= fr.length - 1 && !done) { done = true; var rest = fr[fr.length - 1]; loc = [rest[0] - P.ox, rest[1] - P.oy, rest[2]]; home = loc.slice(); grabbable(); }
      }
    }
    if (anim.playState !== 'finished' || !done) requestAnimationFrame(frame);
  }
  /* Pick it up (2026-11-21). Once it has landed, the hammer can be grabbed with a finger or the mouse. It hangs from the
     spot you hold and swings like a loosely held hammer as you carry it (a pendulum driven by the hand's acceleration).
     Let go and it lies down flat where it is; let go near where it landed and it slides home into the letter.
     Its place is kept relative to the letter, so a resize carries it along. Nothing is stored. */
  var drag = null, hooked = false, ease = null, G = 2400, DAMP = 3.2;
  function base() { return [P.ox + off[0], P.oy + off[1]]; }
  function edge() { return Math.max(P.b.L, .7 * P.b.Lh, 10); }   // how close the centre may come to the page's edges
  function place(c, a) {                                   // c in page coordinates; kept on the page so it never widens it
    var R = edge(), cw = document.documentElement.clientWidth, dh = document.documentElement.scrollHeight, o = base();
    c = [Math.max(R, Math.min(cw - R, c[0])), Math.max(R, Math.min(dh - R, c[1]))];
    loc = [c[0] - o[0], c[1] - o[1], a]; put(c[0], c[1], a, 1, true); return c;
  }
  function grabbable() {
    if (!el || hooked) return;
    var hit = el.querySelector('.hm-hit'); if (!hit) return;
    hooked = true;
    hit.style.pointerEvents = 'stroke'; hit.style.cursor = 'grab'; hit.style.touchAction = 'none';
    hit.addEventListener('pointerdown', down);
    hit.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });   // a drag on the hammer must not scroll the page (iOS)
  }
  function down(e) {
    if (drag || e.button > 0) return;
    e.preventDefault(); ease = null; sim = null; clearTimeout(fallT);   // caught: no fall
    var tg = e.currentTarget; try { tg.setPointerCapture(e.pointerId); } catch (x) {}
    var o = base(), c = [o[0] + loc[0], o[1] + loc[1]], p = [e.pageX, e.pageY], psi = Math.atan2(c[1] - p[1], c[0] - p[0]);
    drag = { p0: p, cy: e.clientY, id: e.pointerId, tg: tg, l: Math.hypot(c[0] - p[0], c[1] - p[1]), psi: psi, psi0: psi, a0: loc[2], w: 0, p: p, np: p, v: [0, 0], A: [0, 0], t: performance.now() };
    tg.style.cursor = 'grabbing'; document.documentElement.style.cursor = 'grabbing';
    tg.addEventListener('pointermove', move); tg.addEventListener('pointerup', up); tg.addEventListener('pointercancel', up);
    requestAnimationFrame(swing);
  }
  function move(e) { if (drag && e.pointerId === drag.id) { drag.np = [e.pageX, e.pageY]; drag.cy = e.clientY; if (Math.hypot(e.pageX - drag.p0[0], e.pageY - drag.p0[1]) > 14) drag.moved = true; } }
  function swing(now) {
    var d = drag; if (!d) return;
    var dt = Math.min(.05, Math.max(.004, (now - d.t) / 1000)); d.t = now;
    /* Carrying it to the foot of the page (2026-11-24): a finger or mouse held in the top or bottom 64 px of the window scrolls the
       page, so the hammer can be carried a whole page without letting go (it is only a held hammer; nothing scrolls otherwise). */
    var zn = 64, ch = innerHeight, sp = !d.moved ? 0 : d.cy > ch - zn ? Math.min(1, (d.cy - (ch - zn)) / zn) * 900 : d.cy < zn ? -Math.min(1, (zn - d.cy) / zn) * 900 : 0;
    if (sp) { var y0 = scrollY; scrollBy({ top: sp * dt, behavior: 'instant' }); if (scrollY !== y0) d.np = [d.np[0], d.cy + scrollY]; }
    var np = d.np, v = [(np[0] - d.p[0]) / dt, (np[1] - d.p[1]) / dt], k = Math.min(1, dt * 20);
    d.A = [d.A[0] + ((v[0] - d.v[0]) / dt - d.A[0]) * k, d.A[1] + ((v[1] - d.v[1]) / dt - d.A[1]) * k];   // the hand's acceleration, smoothed
    var am = Math.hypot(d.A[0], d.A[1]); if (am > 30000) { d.A[0] *= 30000 / am; d.A[1] *= 30000 / am; }
    d.v = v; d.p = np;
    if (d.l > 3) {                                         // held off its balance point: it swings; held at the balance point it just follows
      var ke = .28 * P.b.Lh, le = d.l + ke * ke / d.l, n = 4, h = dt / n, i;
      for (i = 0; i < n; i++) { d.w += ((Math.cos(d.psi) * (G - d.A[1]) + Math.sin(d.psi) * d.A[0]) / le - DAMP * d.w) * h; d.psi += d.w * h; }
    }
    place([np[0] + d.l * Math.cos(d.psi), np[1] + d.l * Math.sin(d.psi)], d.a0 + d.psi - d.psi0);
    requestAnimationFrame(swing);
  }
  function up(e) {
    var d = drag; if (!d || e.pointerId !== d.id) return;
    drag = null;
    d.tg.removeEventListener('pointermove', move); d.tg.removeEventListener('pointerup', up); d.tg.removeEventListener('pointercancel', up);
    d.tg.style.cursor = 'grab'; document.documentElement.style.cursor = '';
    var near = Math.hypot(loc[0] - home[0], loc[1] - home[1]) < Math.max(36, .8 * P.b.Lh);
    settle(near ? home : [loc[0], loc[1], Math.round(loc[2] / Math.PI) * Math.PI], near ? 420 : 260);   // home into the bowl, or down flat
    if (!near) fallT = setTimeout(function () { if (!drag) fall(); }, WAIT);   // then, unless something holds it up, gravity
  }

  /* Gravity (2026-11-21). A moment after it is let go anywhere but its letter, the hammer falls onto whatever is beneath
     it: the tops of lines of text, buttons, cards, pictures, or the bottom of the page. A small rigid body: the handle is
     wood, the head is steel and carries most of the weight (the balance point is the drawing's rotation centre, so the
     head's share follows from it); impulses with friction, a little bounce, rocking, then sleep. Every ledge is one-way
     (it only stops something coming down from above), so the hammer never wedges inside a paragraph. */
  var WAIT = 1000, VMAX = 1300, BOUNCE = 5, WMAX = 12, fallT = null, sim = null;   // ms, px/s, hammer lengths/s, rad/s
  function ledges() {   // page-coordinate tops the hammer can land on, measured when the fall starts
    var out = [], sx = scrollX, sy = scrollY, cw = document.documentElement.clientWidth, n, rg = document.createRange();
    function pinned(e) { for (; e && e !== document.body; e = e.parentElement) { var p = getComputedStyle(e).position; if (p === 'fixed' || p === 'sticky') return true; } return false; }
    function hidden(cs) { return cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0; }
    function add(r, inset) { if (r.width >= 4 && r.height >= 2) out.push([r.left + sx, r.right + sx, r.top + sy + inset * r.height]); }
    var tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while ((n = tw.nextNode())) {                          // text: one ledge per line, at about the top of the lowercase letters
      if (!/\S/.test(n.data) || !n.parentElement || el.contains(n.parentElement) || hidden(getComputedStyle(n.parentElement)) || pinned(n.parentElement)) continue;
      rg.selectNodeContents(n); [].forEach.call(rg.getClientRects(), function (r) { add(r, .22); });
    }
    var hb = window.__bonk && window.__bonk.box();   // the footer sitter's head, while the gag is free to play (assets/footer-scene.js)
    if (hb) out.push([hb[0] - 22, hb[1] + 22, hb[2], 'head']);   // a little wider than his head: hat and shoulders count
    [].forEach.call(document.body.querySelectorAll('*'), function (e) {   // boxes you can see the edge of
      if (e === el || el.contains(e) || (e.parentElement && e.parentElement.closest('svg'))) return;
      if (hb && e.tagName === 'svg' && e.closest('.foot-scene')) return;   // the footer picture is not a shelf: his head is (below)
      var cs = getComputedStyle(e), r;
      var solid = /^(IMG|svg|VIDEO|CANVAS|BUTTON|INPUT|SELECT|TEXTAREA|HR|IFRAME|PICTURE)$/.test(e.tagName) ||
        !/rgba\(\d+, \d+, \d+, 0\)|transparent/.test(cs.backgroundColor) || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none';
      if (!solid || hidden(cs) || pinned(e)) return;
      r = e.getBoundingClientRect();
      if (r.width > .95 * cw) return;                      // full-width bands are background, not a shelf
      add(r, 0);
    });
    var dh = document.documentElement.scrollHeight; out.push([0, cw, dh - edge()]);   // the floor: just above the bottom of the page (it must not stretch the page)
    if (/hammerdebug/.test(location.search)) out.forEach(function (q) { var d = document.createElement('div'); d.style.cssText = 'position:absolute;z-index:49;pointer-events:none;height:0;border-top:1px solid rgba(220,0,0,.6);left:' + q[0] + 'px;top:' + q[2] + 'px;width:' + (q[1] - q[0]) + 'px'; document.body.appendChild(d); });
    return out;
  }
  function fall() {
    var b = P.b, u0 = -b.cx, o = base(), pts = [], i, mH = 1;
    var mHd = Math.max(.25, mH * (b.cx - b.Lh / 2) / Math.max(1, b.Lh - b.cx));   // head mass that puts the balance point where the drawing has it
    var dc = b.Lh / 2 - b.cx, M = mH + mHd, I = mH * (b.Lh * b.Lh / 12 + dc * dc) + mHd * (b.Lh - b.cx) * (b.Lh - b.cx) + mHd * b.hh * b.hh / 12;
    for (i = 0; i <= 6; i++) { var x = u0 + (b.Lh - b.th / 2) * i / 6; pts.push([x, -b.rh, .18], [x, b.rh, .18]); }   // wooden handle
    pts.push([u0 - b.rh, 0, .18]);
    [[-1, -1], [1, -1], [-1, 1], [1, 1], [1, 0]].forEach(function (s) { pts.push([u0 + b.Lh + s[0] * b.th / 2, s[1] * b.hh / 2, .32]); });   // steel head
    var S = ledges(), hb = S.filter(function (q) { return q[3] === 'head'; })[0], cy0 = o[1] + loc[1], cx0 = o[0] + loc[0];
    if (hb && Math.abs(cx0 - (hb[0] + hb[1]) / 2) < 70 + (hb[1] - hb[0]) / 2 && cy0 > hb[2] - 330 && cy0 < hb[2])   // dropped right above his head: the lines of text in between are not in the way
      S = S.filter(function (q) { return q === hb || q[2] <= cy0 || q[2] >= hb[2] - 1; });
    sim = { c: [cx0, cy0], a: loc[2], v: [0, 0], w: 0, pts: pts, M: M, I: I, S: S, still: 0, t: 0, last: performance.now() };
    requestAnimationFrame(tick);
  }
  function tick(now) {
    var s = sim; if (!s || drag) { sim = null; return; }
    var dt = Math.min(.05, (now - s.last) / 1000), h = 1 / 240, k; s.last = now;
    for (k = 0; k < Math.round(dt / h); k++) { var vy0 = s.v[1]; stepBody(s, h); if (vy0 > 250 && !s.bonked) bonkCheck(s); }   // falling fast and touching his head: the first contact is the bonk, however it lands
    var c = place(s.c, s.a); if (c[0] !== s.c[0]) s.v[0] *= -.3; s.c = c;      // the page sides stop it too
    var calm = Math.hypot(s.v[0], s.v[1]) < 8 && Math.abs(s.w) < .4;
    s.still = calm ? s.still + dt : 0; s.t += dt;
    if (s.still > .35 || s.t > 8) { if (!s.bonked) bonkCheck(s); if (!s.bonked || s.still > .35) sim = null; if (s.bonked && sim) return requestAnimationFrame(tick); return; }
    requestAnimationFrame(tick);
  }
  /* The bonk (2026-11-24): a hard stop (it was falling fast and lost speed in one step) with the steel head on the ledge that is the
     footer sitter's head. The ledge stays until the gag lets it go, so the hammer rests on his head, then falls with him. */
  function bonkCheck(s) {
    var q = null, i, ca = Math.cos(s.a), sa = Math.sin(s.a), on = false;
    for (i = 0; i < s.S.length; i++) if (s.S[i][3] === 'head') q = s.S[i];
    if (!q) return;
    for (i = 0; i < s.pts.length; i++) {                     // any part of the hammer that is on his head box, at the ledge
      var r = s.pts[i], px = s.c[0] + ca * r[0] - sa * r[1], py = s.c[1] + sa * r[0] + ca * r[1];
      if (px >= q[0] - 4 && px <= q[1] + 4 && Math.abs(py - q[2]) < 10) on = true;
    }
    if (!on) return;
    if (!window.__bonk.play(function () {
      var j = s.S.indexOf(q); if (j >= 0) s.S.splice(j, 1);
      if (!sim && !drag) fall();                           // it had gone to sleep on his head: let it drop with him
    })) { var j = s.S.indexOf(q); if (j >= 0) s.S.splice(j, 1); return; }   // a pigeon got there first: no gag, no ledge
    s.bonked = true;
  }
  function stepBody(s, h) {   // one step: gravity, find the points touching a ledge, solve them together, move
    var ca = Math.cos(s.a), sa = Math.sin(s.a), C = [], i, k, it, q, c;
    s.v[1] = Math.min(VMAX, s.v[1] + G * h);                // air drag: a top speed, so a long drop is not a cannon shot
    for (i = 0; i < s.pts.length; i++) {
      var r = s.pts[i], rx = ca * r[0] - sa * r[1], ry = sa * r[0] + ca * r[1], px = s.c[0] + rx, py = s.c[1] + ry, vy = s.v[1] + s.w * rx;
      for (k = 0; k < s.S.length; k++) {
        q = s.S[k];
        if (px < q[0] || px > q[1] || py > q[2] + 3 || py + vy * h < q[2] - .3) continue;   // only from above: about to cross (or resting on) this top
        if (s.c[1] > q[2] + 1) continue;                    // its balance point has gone below this ledge: it is tipping off, not resting on it
        var e = vy > 60 ? Math.min(r[2], BOUNCE * P.b.Lh / vy) : 0;   // a slight bounce for its size, never a trampoline; none when resting
        C.push({ rx: rx, ry: ry, go: -Math.max(e * vy, .2 * Math.max(0, py - q[2] - .2) / h), kn: 1 / (1 / s.M + rx * rx / s.I), kt: 1 / (1 / s.M + ry * ry / s.I), jn: 0, jt: 0 });
        break;
      }
    }
    for (it = 0; it < 8; it++) for (i = 0; i < C.length; i++) {   // sequential impulses, accumulated and clamped (contacts push, never pull)
      c = C[i];
      var dn = (s.v[1] + s.w * c.rx - c.go) * c.kn, jn = Math.max(0, c.jn + dn); dn = jn - c.jn; c.jn = jn;
      s.v[1] -= dn / s.M; s.w -= dn * c.rx / s.I;
      var dt = -(s.v[0] - s.w * c.ry) * c.kt, jt = Math.max(-.45 * c.jn, Math.min(.45 * c.jn, c.jt + dt)); dt = jt - c.jt; c.jt = jt;   // friction, wood and steel on paint
      s.v[0] += dt / s.M; s.w -= dt * c.ry / s.I;
    }
    if (C.length) s.w *= 1 - 4 * h;                         // rolling on a surface loses spin
    s.w = Math.max(-WMAX, Math.min(WMAX, s.w));
    s.c[0] += s.v[0] * h; s.c[1] += s.v[1] * h; s.a += s.w * h;
  }

  function settle(to, ms) {
    var from = loc.slice(), da = to[2] - from[2], t0 = performance.now();
    da -= 2 * Math.PI * Math.round(da / (2 * Math.PI));     // the short way round
    var step = function (now) {
      if (ease !== step || drag) return;
      var u = ss((now - t0) / ms), o = base();
      loc = [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + da * u];
      put(o[0] + loc[0], o[1] + loc[1], loc[2], 1, true);
      if (u < 1) requestAnimationFrame(step);
    };
    ease = step; requestAnimationFrame(step);
  }
  function relocate() {   // layout changed: keep a settled hammer in the bowl, and re-plan if it has not flown yet
    var q = metrics(); if (!q) return;
    if (P && shift !== null) {                            // in flight or landed: slide the whole take with the letter
      off = [q.ox - P.ox, q.oy - P.oy];
      if (done) put(q.ox + loc[0], q.oy + loc[1], loc[2], 1, true);
    } else request();                                      // not thrown yet: plan again for the new layout
  }
  addEventListener('resize', function () { setTimeout(relocate, 120); });
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
