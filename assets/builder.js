const TOSS = {t: 12.5, x: 137.88, y: 91.37, ang: -37.2};
/* The Builder's hammer toss (body of assets/builder.js; gen.py prepends `const TOSS = {...}`).
 *
 * As the figure climbs, he flicks his hammer out of the icon. It falls onto the "U" of the hero headline,
 * bounces off the right-hand stem, drops into the bowl, rocks from side to side and settles at the bottom.
 *
 * How: the headline's first glyph is rendered to a canvas and turned into a signed-distance field, so
 * collisions use the REAL letter shape at the real size (any viewport, any font). A small rigid-body
 * solver (impulses, friction, sleeping) drops a hammer into it. At load a seeded search tries tosses until
 * one hits the right stem first, bounces into the bowl, crosses it at least twice and comes to rest in it;
 * that run is recorded and played back against the page's animation clock, so it stays in sync with the
 * CSS scene (and with anything that seeks it). Reduced motion: nothing runs.
 * Debug: add ?hammerdebug to the URL to see the glyph mask the physics uses.
 */
(function () {
  'use strict';
  if (!window.matchMedia || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var G = 2300, DT = 1 / 480, REC = 1 / 120, TRIALS = 200, MAXT = 9, PLAY = .5;   // PLAY < 1 plays the recorded run in slow motion
  var mark = document.querySelector('.mark-wrap');
  var h1 = document.querySelector('.hero h1') || document.querySelector('h1');
  if (!mark || !h1 || !h1.firstChild || h1.firstChild.nodeType !== 3) return;

  function ss(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
  function rng(seed) {
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  /* ---------- the letter: ink mask -> signed distance field (page coordinates) ---------- */
  function glyph() {
    var ch = h1.firstChild.data.charAt(0), cs = getComputedStyle(h1);
    var r = document.createRange(); r.setStart(h1.firstChild, 0); r.setEnd(h1.firstChild, 1);
    var rc = r.getClientRects()[0]; if (!rc || !rc.width) return null;
    var c = document.createElement('canvas').getContext('2d');
    c.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var m = c.measureText(ch), pad = 26;
    var abl = m.actualBoundingBoxLeft, abr = m.actualBoundingBoxRight, aa = m.actualBoundingBoxAscent, ad = m.actualBoundingBoxDescent;
    var W = Math.ceil(abl + abr) + 2 * pad, H = Math.ceil(aa + ad) + 2 * pad;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var x = cv.getContext('2d'); x.font = c.font; x.fillStyle = '#000'; x.textBaseline = 'alphabetic'; x.fillText(ch, pad + abl, pad + aa);
    var px = x.getImageData(0, 0, W, H).data, ink = new Uint8Array(W * H), i, j;
    for (i = 0; i < W * H; i++) ink[i] = px[i * 4 + 3] > 127 ? 1 : 0;
    var ox = rc.left + scrollX - abl - pad, oy = rc.top + scrollY + m.fontBoundingBoxAscent - aa - pad;
    var bx = [], by = [], top = H, bot = 0, left = W, right = 0;
    for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
      if (!ink[j * W + i]) continue;
      if (j < top) top = j; if (j > bot) bot = j; if (i < left) left = i; if (i > right) right = i;
      if (i === 0 || j === 0 || i === W - 1 || j === H - 1 || !ink[j * W + i - 1] || !ink[j * W + i + 1] || !ink[(j - 1) * W + i] || !ink[(j + 1) * W + i]) { bx.push(i + .5); by.push(j + .5); }
    }
    var sdf = new Float32Array(W * H), n = bx.length, k, d, best, dx, dy;
    for (j = 0; j < H; j++) for (i = 0; i < W; i++) {
      best = 1e9;
      for (k = 0; k < n; k++) { dx = bx[k] - i - .5; dy = by[k] - j - .5; d = dx * dx + dy * dy; if (d < best) best = d; }
      best = Math.sqrt(best); sdf[j * W + i] = ink[j * W + i] ? -best : best;
    }
    // the counter (the gap between the stems) on a row 40% down the letter
    var row = Math.round(top + .4 * (bot - top)), runs = [], inRun = false;
    for (i = 0; i < W; i++) { if (ink[row * W + i] && !inRun) { runs.push([i, i]); inRun = true; } else if (ink[row * W + i]) runs[runs.length - 1][1] = i; else inRun = false; }
    var cl = runs.length >= 2 ? runs[0][1] + 1 : left + .3 * (right - left), cr = runs.length >= 2 ? runs[1][0] : right - .3 * (right - left);
    // top of the right-hand stem
    var rtx = right - 4, rty = H;
    for (j = 0; j < H && rty === H; j++) for (i = Math.round((left + right) / 2); i <= right; i++) if (ink[j * W + i]) { rty = j; rtx = i; break; }
    return { W: W, H: H, ox: ox, oy: oy, sdf: sdf, top: oy + top, bot: oy + bot, left: ox + left, right: ox + right, mid: ox + (left + right) / 2,
             cl: ox + cl, cr: ox + cr, rtx: ox + rtx, rty: oy + rty, ink: ink, sig: [ox, oy, W, H].map(Math.round).join() };
  }
  function at(g, i, j) { i = i < 0 ? 0 : i >= g.W ? g.W - 1 : i; j = j < 0 ? 0 : j >= g.H ? g.H - 1 : j; return g.sdf[j * g.W + i]; }
  function dist(g, x, y) {
    var u = x - g.ox - .5, v = y - g.oy - .5;
    if (u < -2 || v < -2 || u > g.W + 1 || v > g.H + 1) return 1e3;
    var i = Math.floor(u), j = Math.floor(v), fu = u - i, fv = v - j;
    return (at(g, i, j) * (1 - fu) + at(g, i + 1, j) * fu) * (1 - fv) + (at(g, i, j + 1) * (1 - fu) + at(g, i + 1, j + 1) * fu) * fv;
  }

  /* ---------- the hammer: weighted contact points around a handle and a head ---------- */
  function hammer(g) {
    var gap = Math.max(10, g.cr - g.cl), L = Math.max(11, Math.min(70, gap * .72));
    var Lh = L / 1.1, th = .2 * Lh, hh = .62 * Lh, rh = Math.max(1.1, .05 * Lh), pts = [], u;
    for (u = 0; u <= .76 * Lh; u += .25 * Lh) pts.push([u, 0, rh, .5]);
    [[Lh - th / 2, -hh / 2], [Lh - th / 2, hh / 2], [Lh + th / 2, -hh / 2], [Lh + th / 2, hh / 2], [Lh + th / 2, 0], [Lh, -hh / 2], [Lh, hh / 2]].forEach(function (p) { pts.push([p[0], p[1], 1.2, 1.4]); });
    var M = 0, cx = 0; pts.forEach(function (p) { M += p[3]; cx += p[0] * p[3]; }); cx /= M;
    var I = 0; pts.forEach(function (p) { p[0] -= cx; I += p[3] * (p[0] * p[0] + p[1] * p[1]); });
    return { L: L, Lh: Lh, th: th, hh: hh, rh: rh, pts: pts, M: M, I: I, cx: cx };
  }

  /* ---------- rigid-body solver (impulses + friction), returns the recorded run ---------- */
  function simulate(g, b, s) {
    var x = s.x, y = s.y, a = s.a, vx = s.vx, vy = s.vy, w = s.w, frames = [], events = [], still = 0, steps = MAXT / DT, nrec = 0, t, n, i, it, cs, sn;
    for (n = 0; n < steps; n++) {
      t = n * DT;
      vy += G * DT; var dr = 1 - .05 * DT, ar = 1 - .3 * DT; vx *= dr; vy *= dr; w *= ar;
      x += vx * DT; y += vy * DT; a += w * DT;
      for (it = 0; it < 4; it++) {
        cs = Math.cos(a); sn = Math.sin(a);
        for (i = 0; i < b.pts.length; i++) {
          var p = b.pts[i], rx = cs * p[0] - sn * p[1], ry = sn * p[0] + cs * p[1], px = x + rx, py = y + ry, d = dist(g, px, py) - p[2];
          if (d >= 0) continue;
          var gx = dist(g, px + 1, py) - dist(g, px - 1, py), gy = dist(g, px, py + 1) - dist(g, px, py - 1), gl = Math.hypot(gx, gy) || 1, nx = gx / gl, ny = gy / gl;
          x += nx * -d * .55; y += ny * -d * .55;
          var vcx = vx - w * ry, vcy = vy + w * rx, vn = vcx * nx + vcy * ny;
          if (vn >= 0) continue;
          var e = -vn > 140 ? .5 : 0, rn = rx * ny - ry * nx, j = -(1 + e) * vn / (1 / b.M + rn * rn / b.I);
          vx += j * nx / b.M; vy += j * ny / b.M; w += j * rn / b.I;
          if (-vn > 90 && it === 0) events.push({ t: t, x: px, y: py, vn: -vn });
          vcx = vx - w * ry; vcy = vy + w * rx;
          var tx = -ny, ty = nx, vt = vcx * tx + vcy * ty, rt = rx * ty - ry * tx, jt = -vt / (1 / b.M + rt * rt / b.I), lim = .35 * j;
          jt = jt > lim ? lim : jt < -lim ? -lim : jt;
          vx += jt * tx / b.M; vy += jt * ty / b.M; w += jt * rt / b.I;
        }
      }
      if (n % Math.round(REC / DT) === 0) frames.push([x, y, a]);
      if (Math.hypot(vx, vy) < 9 && Math.abs(w) < .35 && t > .3 && dist(g, x, y + b.cx * 0) < 3 * b.L) { still += DT; if (still > .45) return { frames: frames, events: events, slept: t, rest: [x, y, a] }; } else still = 0;
    }
    return { frames: frames, events: events, slept: null, rest: [x, y, a] };
  }

  /* ---------- the director: find a toss that reads well ---------- */
  function judge(g, b, r) {
    if (r.slept === null) return -1;
    var h = g.bot - g.top, first = null, i;
    for (i = 0; i < r.events.length; i++) if (r.events[i].vn > 100) { first = r.events[i]; break; }
    if (!first || first.x < g.mid || first.y > g.top + .34 * h) return -1;      // must strike the right-hand stem first
    var rx = r.rest[0], ry = r.rest[1];
    if (rx < g.cl + 1 || rx > g.cr - 1 || ry < g.top + .45 * h || ry > g.bot) return -1;   // must end in the bowl
    var cross = 0, side = 0, f, sd;
    for (i = 0; i < r.frames.length; i++) { f = r.frames[i]; if (f[1] < g.top + .35 * h) continue; sd = f[0] > g.mid ? 1 : -1; if (side && sd !== side) cross++; side = sd; }
    if (cross < 3 || r.events.length < 3 || r.slept > 8) return -1;
    return cross * 3 + Math.min(r.slept, 4.5) + Math.min(r.events.length, 12) * .4;   // livelier and longer reads better
  }
  function plan() {
    var g = glyph(); if (!g) return null;
    var b = hammer(g), mr = mark.getBoundingClientRect();
    var x0 = mr.left + scrollX + TOSS.x * mr.width / 280, y0 = mr.top + scrollY + TOSS.y * mr.height / 280;
    var rnd = rng(20261030), best = null, bs = -1e9, k;
    var tx = g.rtx - .12 * b.L, ty = g.rty - .28 * b.L;
    for (k = 0; k < TRIALS; k++) {
      var T = .55 + rnd() * .6, w0 = (rnd() * 2 - 1) * 15 + (rnd() < .5 ? -4 : 4), a0 = TOSS.ang * Math.PI / 180 + (rnd() - .5) * 1.2;
      var s = { x: x0, y: y0, a: a0, vx: (tx - x0) / T, vy: (ty - y0 - .5 * G * T * T) / T, w: w0 };
      if (s.vy < -1500 || s.vy > 400) continue;
      var r = simulate(g, b, s), sc = judge(g, b, r);
      if (sc > bs) { bs = sc; best = r; }
    }
    var ok = best && bs > -1e8;
    if (!ok) {   // fallback: a short scripted drop into the bowl so the gag still lands
      var fr = [], rest = [(g.cl + g.cr) / 2, g.bot - 1.2 * b.hh, .12], n, u;
      for (n = 0; n <= 180; n++) { u = n / 180; fr.push([x0 + (tx - x0) * ss(u * 1.6), y0 + (ty - y0) * ss(Math.min(1, u * 1.6)) + (u > .62 ? (rest[1] - ty) * ss((u - .62) / .38) : 0) - Math.sin(Math.min(1, u * 1.6) * Math.PI) * 120, a0 + u * 6]); }
      best = { frames: fr, events: [], slept: 1.5, rest: rest }; fr[fr.length - 1] = rest;
    }
    return { g: g, b: b, run: best, sig: g.sig + '|' + Math.round(mr.left) + ',' + Math.round(mr.top) + ',' + Math.round(mr.width), x0: x0, y0: y0, scored: ok };
  }

  /* ---------- the picture ---------- */
  var el = null, P = null, loc = null;
  function build(b) {
    var ns = 'http://www.w3.org/2000/svg', L = b.L, s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', [-L, -L, 2 * L, 2 * L].join(' ')); s.setAttribute('width', 2 * L); s.setAttribute('height', 2 * L); s.setAttribute('aria-hidden', 'true');
    s.style.cssText = 'position:absolute;left:0;top:0;margin:' + (-L) + 'px 0 0 ' + (-L) + 'px;pointer-events:none;z-index:50;opacity:0;will-change:transform';
    var u0 = -b.cx;
    s.innerHTML = '<line x1="' + u0 + '" y1="0" x2="' + (u0 + b.Lh) + '" y2="0" stroke="#7A5A2E" stroke-width="' + 2 * b.rh + '" stroke-linecap="round"/>' +
      '<rect x="' + (u0 + b.Lh - b.th / 2) + '" y="' + (-b.hh / 2) + '" width="' + b.th + '" height="' + b.hh + '" rx="' + Math.max(.8, b.th * .18) + '" fill="#555"/>';
    document.body.appendChild(s); return s;
  }
  function put(x, y, a, sc, vis) { el.style.opacity = vis ? 1 : 0; el.style.transform = 'translate(' + x + 'px,' + y + 'px) rotate(' + a + 'rad) scale(' + sc + ')'; }
  var anim = null, done = false, finT = 0;
  function frame() {
    if (!anim) { anim = document.getAnimations().filter(function (x) { return x.animationName === 'bx-move'; })[0]; if (!anim) return requestAnimationFrame(frame); }
    var ms = anim.currentTime;
    if (ms == null) return requestAnimationFrame(frame);
    var tt = ms / 1000;
    if (anim.playState === 'finished') { finT = finT || performance.now(); tt += (performance.now() - finT) / 1000; }   // keep going past the end of the scene
    var t = tt - TOSS.t;
    if (!P && t > -4) { P = plan(); if (P) el = build(P.b); }
    if (P && t > -.6) {
      var mr = mark.getBoundingClientRect(), sig = P.g.sig + '|' + Math.round(mr.left) + ',' + Math.round(mr.top) + ',' + Math.round(mr.width);
      if (t < 0 && sig !== P.sig) { var old = el; P = plan(); if (old) old.remove(); el = build(P.b); }
    }
    if (P && el) {
      if (t < 0) put(0, 0, 0, 1, false);
      else {
        var fr = P.run.frames, k = Math.min(fr.length - 1, t * PLAY / REC), i = Math.floor(k), f = k - i, A = fr[i], B = fr[Math.min(i + 1, fr.length - 1)];
        var sc0 = Math.min(1, Math.max(.1, .88 * mark.getBoundingClientRect().width / 280 * 58 / P.b.L)), sc = sc0 + (1 - sc0) * ss(t / .55);
        put(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f, A[2] + (B[2] - A[2]) * f, sc, true);
        if (k >= fr.length - 1 && !done) { done = true; var rest = fr[fr.length - 1]; loc = [rest[0] - P.g.ox, rest[1] - P.g.oy, rest[2]]; }
      }
    }
    if (anim.playState !== 'finished' || !done) requestAnimationFrame(frame);
  }
  function relocate() {   // after the run: keep the hammer in the bowl when the layout changes
    if (!done || !el) return; var g = glyph(); if (g) put(g.ox + loc[0], g.oy + loc[1], loc[2], 1, true);
  }
  addEventListener('resize', relocate);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relocate);

  if (/hammerdebug/.test(location.search)) window.addEventListener('load', function () {
    var g = glyph(), c = document.createElement('canvas'); c.width = g.W; c.height = g.H; var x = c.getContext('2d'), d = x.createImageData(g.W, g.H), i;
    for (i = 0; i < g.W * g.H; i++) { d.data[i * 4] = 255; d.data[i * 4 + 3] = g.ink[i] ? 150 : 0; } x.putImageData(d, 0, 0);
    c.style.cssText = 'position:absolute;left:' + g.ox + 'px;top:' + g.oy + 'px;pointer-events:none;z-index:49;outline:1px solid #0a0'; document.body.appendChild(c);
  });
  requestAnimationFrame(frame);
})();
