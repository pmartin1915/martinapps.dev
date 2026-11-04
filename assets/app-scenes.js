/* Outdoor-line product pages: one small wordless Builder scene each, tied to the app.
     wilderness   he drives a tent peg in with three taps and the guy line goes taut
     shortless    he knocks out the prop and a barrier arm drops across a feed that was scrolling
     scrollometer he walks a tape measure out to a flag (distance, in feet)
   Markup: <svg class="app-stage" data-scene="wilderness" viewBox="0 0 360 120" aria-hidden="true" style="display:none"></svg>. Needs builder-lite.js.
   Canonical source: brand/mascot/lite/app-scenes.js. Each plays once when it scrolls into view and then holds. Reduced motion / ?eyes=1: the final still.
   Harness: BuilderLite.scenes.wilderness(t) etc. */
(function () {
  if (!window.BuilderLite) return;
  var B = window.BuilderLite, K = .62, W = 360, H = 120, GY = 108, gy = GY / K, INK = '#1A1A1A';
  var CYC = 80, A = 20, WALKHZ = 1.5, CLOSE = .5;

  function footOff(q) {
    q = q - Math.floor(q);
    if (q < .5) return [A - 80 * q, 0];
    var s = (q - .5) / .5; return [-A + 2 * A * B.ease(s), -9 * Math.sin(Math.PI * s)];
  }
  // generic stage: ground line, figure group (not mirrored: he faces right), hammer prop
  function stage(svg) {
    svg.style.display = 'block';
    B.el('rect', { x: 0, y: 0, width: W, height: H, fill: 'none' }, svg);
    B.el('line', { x1: 0, x2: W, y1: GY + 1.5, y2: GY + 1.5, stroke: INK, 'stroke-opacity': .14, 'stroke-width': 1.5 }, svg);
    return svg;
  }
  function figure(svg) {
    var g = B.el('g', { transform: 'scale(' + K + ')' }, svg), who = B.create(g);
    var hammer = B.el('g', {}, g), hh = B.el('line', { stroke: '#7A5A2E', 'stroke-width': 4, 'stroke-linecap': 'round' }, hammer), hd = B.el('rect', { x: -3.5, y: -10, width: 7, height: 20, rx: 2, fill: '#555' }, hammer);
    function put(r) {
      var ang = Math.atan2(r.h1[1] - r.e1[1], r.h1[0] - r.e1[0]), hx = r.h1[0], hy = r.h1[1], ex = hx + 19 * Math.cos(ang), ey = hy + 19 * Math.sin(ang);
      hh.setAttribute('x1', hx); hh.setAttribute('y1', hy); hh.setAttribute('x2', ex); hh.setAttribute('y2', ey);
      hd.setAttribute('transform', 'translate(' + ex + ' ' + ey + ') rotate(' + (ang * 180 / Math.PI) + ')');
    }
    return { g: g, who: who, put: put };
  }
  // the walk-in: returns hip/feet/arms for t < tw, or null after
  function walk(t, x0u, x1u, N) {
    var tw = N / WALKHZ; if (t >= tw) return null;
    var p = t * WALKHZ, hu = B.lerp(x0u, x1u, t / tw), oA = footOff(p), oB = footOff(p + .5);
    return { hu: hu, fa: [hu + oA[0], gy + oA[1]], fb: [hu + oB[0], gy + oB[1]], bob: 1.5 * Math.cos(4 * Math.PI * p), oa: oA[0] / A, p: p, tw: tw };
  }
  // arm as angle + reach about the shoulder; keys = [[time, name]...], P = pose table; 'hit' eases in, the segment after it eases out
  function armAt(t, KEYS, P) {
    var i = 0; while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
    var k0 = KEYS[i], k1 = KEYS[i + 1], u = Math.min(Math.max((t - k0[0]) / (k1[0] - k0[0]), 0), 1), e;
    e = k1[1] === 'hit' ? u * u : (k0[1] === 'hit' ? 1 - (1 - u) * (1 - u) : B.ease(u));
    return { a: B.lerp(P[k0[1]][0], P[k1[1]][0], e), r: B.lerp(P[k0[1]][1], P[k1[1]][1], e) };
  }
  function hitAim(sh, tap) { return [Math.atan2(tap[1] - sh[1], tap[0] - sh[0]), Math.min(Math.hypot(tap[0] - sh[0], tap[1] - sh[1]) - 17, 66)]; }
  function spikeNear(t, c, w) { return Math.abs(t - c) < w ? 1 - Math.abs(t - c) / w : 0; }
  function polar(sh, a, r) { return [sh[0] + r * Math.cos(a), sh[1] + r * Math.sin(a)]; }

  // ------------------------------------------------------------------ Wilderness: tent peg
  function wilderness(svg) {
    stage(svg);
    var TIP = [300, 50], L = [248, GY], R = [352, GY], E = [270.5, 82], PEGX = 196, HITS = [4.6, 5.35, 6.1];
    var tent = B.el('g', {}, svg);
    B.el('path', { d: 'M' + L + ' L' + TIP + ' L' + R + ' Z', fill: '#D9822B', stroke: INK, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, tent);
    B.el('path', { d: 'M293 ' + GY + ' L300 74 L307 ' + GY + ' Z', fill: '#7A4A18' }, tent);
    B.el('line', { x1: 300, y1: 50, x2: 300, y2: 40, stroke: INK, 'stroke-width': 2.5, 'stroke-linecap': 'round' }, tent);
    var rope = B.el('path', { fill: 'none', stroke: '#7A5A2E', 'stroke-width': 1.8, 'stroke-linecap': 'round' }, svg);
    var peg = B.el('g', {}, svg);
    B.el('rect', { x: -2.6, y: -2, width: 5.2, height: 30, rx: 1, fill: '#A9743A', stroke: INK, 'stroke-width': 1.2 }, peg);
    B.el('rect', { x: -4.4, y: -4, width: 8.8, height: 4, rx: 1.2, fill: '#8C5F2D', stroke: INK, 'stroke-width': 1.2 }, peg);
    var spark = B.el('path', { d: 'M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z', fill: '#F5B800', opacity: 0 }, svg);
    var f = figure(svg), HX = 172, N = 5, u1 = HX / K, u0 = u1 - N * CYC, TS = N / WALKHZ + CLOSE;
    var KEYS = [[0, 'rest'], [TS, 'rest'], [4.2, 'wind'], [HITS[0], 'hit'], [4.85, 'reb'], [5.1, 'wind'], [HITS[1], 'hit'], [5.6, 'reb'], [5.85, 'wind'], [HITS[2], 'hit'], [6.35, 'reb'], [6.9, 'rest'], [99, 'rest']];
    function draw(t) {
      var sinks = 0; HITS.forEach(function (c) { sinks += B.ease((t - c) / .08); });
      var pegH = 22 - 6.5 * sinks, sag = Math.max(18 - 6.2 * sinks, 0) + (t > HITS[2] + .1 ? 0 : 0);
      var shiver = t > HITS[2] ? Math.exp(-(t - HITS[2]) * 6) * Math.sin((t - HITS[2]) * 40) * 1.2 : 0;
      peg.setAttribute('transform', 'translate(' + PEGX + ' ' + (GY - pegH) + ')');
      var tip = [PEGX, GY - pegH - 1];
      rope.setAttribute('d', 'M' + tip[0] + ' ' + tip[1] + ' Q' + ((tip[0] + E[0]) / 2) + ' ' + ((tip[1] + E[1]) / 2 + sag) + ' ' + (E[0] + shiver) + ' ' + E[1]);
      tent.setAttribute('transform', 'translate(' + (shiver * .6) + ' 0)');
      var w = walk(t, u0, u1, N), hip, fa, fb, drop = 0, lean = 0, near = 0, hit = 0, tilt = 0, oa = 0, bob = 0, h1, h2;
      var work = B.win(t, 3.9, 4.3, 6.5, 7.0);
      HITS.forEach(function (c) { hit = Math.max(hit, spikeNear(t, c, .07)); });
      if (w) { hip = w.hu; fa = w.fa; fb = w.fb; bob = w.bob; oa = w.oa; }
      else {
        hip = u1; var c = B.ease((t - N / WALKHZ) / CLOSE);
        fa = [u1 + A, gy]; fb = [B.lerp(u1 - A, u1 - 4, c), gy - 7 * Math.sin(Math.PI * Math.min(c, 1))];
      }
      drop = 24 * work; lean = 12 * work - 2 * hit;
      var hp = [hip + lean * .35, gy - 67 + bob + drop], sh = [hp[0] + 7 + lean + (w ? 2 : 0), hp[1] - 50 + (w ? .4 * Math.cos(4 * Math.PI * (w.p)) : 0) + 4 * work];
      var hc = [sh[0] + 9 + 4 * work, sh[1] - 11 + 6 * work + 1.5 * hit];
      var tap = [PEGX / K, (GY - pegH) / K - 2], aim = hitAim(sh, tap);
      var P = { rest: [1.35, 52], wind: [-1.9, 52], hit: aim, reb: [aim[0] - .75, 56] };
      var walkH1 = [sh[0] - 13 * oa + 4, sh[1] + 42 - 3 * Math.abs(oa)], walkH2 = [sh[0] + 13 * oa + 4, sh[1] + 42 - 3 * (1 - Math.abs(oa))];
      if (w) { h1 = walkH1; h2 = walkH2; }
      else {
        var A1 = armAt(t, KEYS, P), s1 = polar(sh, A1.a, A1.r), s2 = [sh[0] + 6 + 8 * work, sh[1] + 36 + 4 * work], k = B.ease((t - N / WALKHZ) / CLOSE);
        h1 = [B.lerp(walkH1[0], s1[0], k), B.lerp(walkH1[1], s1[1], k)]; h2 = [B.lerp(walkH2[0], s2[0], k), B.lerp(walkH2[1], s2[1], k)];
        var tipH = B.win(t, 7.4, 7.9, 8.3, 8.8), brim = [hc[0] + 22, hc[1] - 8];
        h2 = [B.lerp(h2[0], brim[0], tipH), B.lerp(h2[1], brim[1], tipH)];
        tilt = 8 * work * 1 - 6 * B.win(t, 6.9, 7.3, 8.2, 8.7) + 5 * B.win(t, 8.2, 8.5, 8.7, 9.0);
      }
      var r = f.who.pose({ hip: hp, sh: sh, head: hc, tilt: tilt, ff: fa, fb: fb, h1: h1, h2: h2, bow: [-2 - 6 * work, 0], shadow: 30, ground: gy + 2, shadowX: hip });
      f.put(r);
      spark.setAttribute('transform', 'translate(' + (PEGX + 3) + ' ' + (GY - pegH - 5) + ') scale(' + (hit * 1.2) + ')'); spark.setAttribute('opacity', hit > 0 ? 1 : 0);
    }
    return { draw: draw, end: 10 };
  }

  // ------------------------------------------------------------------ Shortless: two planks nailed across the feed
  function shortless(svg) {
    stage(svg);
    var PX = 250, PY = 8, PW = 58, PH = GY - 8, HITS = [4.5, 5.3], FREEZE = .4;
    var cp = B.el('clipPath', { id: 'slclip' }, B.el('defs', {}, svg)); B.el('rect', { x: PX + 4, y: PY + 8, width: PW - 8, height: PH - 16, rx: 4 }, cp);
    B.el('rect', { x: PX, y: PY, width: PW, height: PH, rx: 9, fill: INK }, svg);
    var scr = B.el('g', { 'clip-path': 'url(#slclip)' }, svg);
    B.el('rect', { x: PX + 4, y: PY + 8, width: PW - 8, height: PH - 16, fill: '#F1EDE4' }, scr);
    var feed = B.el('g', {}, scr), cols = ['#C0623B', '#2F6F6A', '#E3A72F', '#5B4B8A'];
    for (var i = 0; i < 6; i++) { var y0 = PY + 8 + i * 70; B.el('rect', { x: PX + 8, y: y0, width: PW - 16, height: 62, rx: 5, fill: cols[i % 4] }, feed); B.el('path', { d: 'M' + (PX + PW / 2 - 6) + ' ' + (y0 + 22) + ' l14 9 l-14 9 z', fill: '#fff', 'fill-opacity': .9 }, feed); }
    function plank(x1, y1, x2, y2) {   // a hazard-striped plank, nailed at its first end
      var L = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI, g = B.el('g', {}, svg), body = B.el('g', {}, g);
      B.el('rect', { x: -2, y: -4.5, width: L + 4, height: 9, rx: 1.5, fill: '#F5B800', stroke: INK, 'stroke-width': 1.8 }, body);
      for (var x = 6; x < L - 6; x += 12) B.el('path', { d: 'M' + x + ' -4.5 L' + (x + 5) + ' -4.5 L' + (x - 1) + ' 4.5 L' + (x - 6) + ' 4.5 Z', fill: INK }, body);
      B.el('circle', { cx: 2.5, cy: 0, r: 2.1, fill: '#999', stroke: INK, 'stroke-width': 1 }, body);
      return { set: function (drop, show) { g.setAttribute('transform', 'translate(' + x1 + ' ' + (y1 - drop) + ') rotate(' + ang + ')'); g.setAttribute('opacity', show ? 1 : 0); } };
    }
    var N1 = [PX + 7, 32], N2 = [PX + 7, 66];
    var pa = plank(N1[0], N1[1], PX + PW - 7, 66), pb = plank(N2[0], N2[1], PX + PW - 7, 32);
    var spark = B.el('path', { d: 'M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z', fill: '#F5B800', opacity: 0 }, svg);
    var f = figure(svg), HX = 205, N = 5, u1 = HX / K, u0 = u1 - N * CYC, TW = N / WALKHZ, TS = TW + CLOSE;
    var KEYS = [[0, 'rest'], [TS, 'rest'], [4.2, 'wind'], [HITS[0], 'hit'], [4.72, 'reb'], [5.05, 'wind'], [HITS[1], 'hit'], [5.52, 'reb'], [6.0, 'rest'], [99, 'rest']];
    function drop(t, c) { var u = (t - (c - .28)) / .28; return u < 0 ? 36 : (u > 1 ? 0 : 36 * (1 - u * u)); }
    function draw(t) {
      pa.set(drop(t, HITS[0]), t > HITS[0] - .28); pb.set(drop(t, HITS[1]), t > HITS[1] - .28);
      var s = t - HITS[1], pos = s <= 0 ? 36 * t : 36 * (HITS[1] + Math.min(s, FREEZE) - Math.min(s, FREEZE) * Math.min(s, FREEZE) / (2 * FREEZE));
      feed.setAttribute('transform', 'translate(0 ' + (-(pos % 70)) + ')');
      var w = walk(t, u0, u1, N), hip, fa, fb, bob = 0, oa = 0, h1, h2, near = 0, hit = 0;
      HITS.forEach(function (c) { near = Math.max(near, B.win(t, c - .35, c - .03, c + .03, c + .45)); hit = Math.max(hit, spikeNear(t, c, .07)); });
      if (w) { hip = w.hu; fa = w.fa; fb = w.fb; bob = w.bob; oa = w.oa; }
      else { hip = u1; var c = B.ease((t - TW) / CLOSE); fa = [u1 + A, gy]; fb = [B.lerp(u1 - A, u1 - 4, c), gy - 7 * Math.sin(Math.PI * Math.min(c, 1))]; }
      var lean = 5 * near - 1.2 * hit, hp = [hip + lean * .5, gy - 67 + bob + 1.2 * near], sh = [hp[0] + 7 + lean + (w ? 2 : 0), hp[1] - 50 + (w ? .4 * Math.cos(4 * Math.PI * w.p) : 0)];
      var hc = [sh[0] + 9 + .8 * near, sh[1] - 11 + 1.5 * hit];
      var cur = t < (HITS[0] + HITS[1]) / 2 ? N1 : N2, aim = hitAim(sh, [cur[0] / K - 3, cur[1] / K]);
      var P = { rest: [1.35, 52], wind: [-1.5 + (cur === N2 ? .5 : 0), 50], hit: aim, reb: [aim[0] - .7, 56] };
      var walkH1 = [sh[0] - 13 * oa + 4, sh[1] + 42 - 3 * Math.abs(oa)], walkH2 = [sh[0] + 13 * oa + 4, sh[1] + 42 - 3 * (1 - Math.abs(oa))];
      if (w) { h1 = walkH1; h2 = walkH2; }
      else {
        var A1 = armAt(t, KEYS, P), s1 = polar(sh, A1.a, A1.r), s2 = [sh[0] + 5, sh[1] + 40], k = B.ease((t - TW) / CLOSE);
        h1 = [B.lerp(walkH1[0], s1[0], k), B.lerp(walkH1[1], s1[1], k)]; h2 = [B.lerp(walkH2[0], s2[0], k), B.lerp(walkH2[1], s2[1], k)];
        var tipH = B.win(t, 6.5, 7.0, 7.4, 7.9), brim = [hc[0] + 22, hc[1] - 8];
        h2 = [B.lerp(h2[0], brim[0], tipH), B.lerp(h2[1], brim[1], tipH)];
      }
      var tilt = (w ? 2 * Math.sin(4 * Math.PI * w.p) : 0) + 7 * near - 3 * hit;
      var r = f.who.pose({ hip: hp, sh: sh, head: hc, tilt: tilt, ff: fa, fb: fb, h1: h1, h2: h2, bow: [-2 - near, 0], shadow: 30, ground: gy + 2, shadowX: hip });
      f.put(r);
      var hn = t < (HITS[0] + HITS[1]) / 2 ? N1 : N2;
      spark.setAttribute('transform', 'translate(' + (hn[0] + 2) + ' ' + hn[1] + ') scale(' + (hit * 1.2) + ')'); spark.setAttribute('opacity', hit > 0 ? 1 : 0);
    }
    return { draw: draw, end: 9.5 };
  }

  // ------------------------------------------------------------------ Scrollometer: tape measure out to a flag
  function scrollometer(svg) {
    stage(svg);
    var X0 = 22, FX = 316, N = 5;
    var tape = B.el('g', {}, svg);
    var band = B.el('line', { y1: GY - 2, y2: GY - 2, stroke: '#F5B800', 'stroke-width': 5, 'stroke-linecap': 'butt' }, tape), ticks = B.el('line', { y1: GY - 2, y2: GY - 2, stroke: INK, 'stroke-width': 5, 'stroke-dasharray': '1.4 10.6' }, tape);
    var casing = B.el('g', { transform: 'translate(' + X0 + ' ' + (GY - 11) + ')' }, svg);
    B.el('rect', { x: -11, y: -2, width: 22, height: 13, rx: 4, fill: '#F5B800', stroke: INK, 'stroke-width': 2 }, casing); B.el('circle', { cx: 0, cy: 5, r: 3, fill: INK }, casing);
    var flag = B.el('g', { transform: 'translate(' + FX + ' ' + GY + ')' }, svg);
    B.el('line', { x1: 0, y1: 0, x2: 0, y2: -46, stroke: INK, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, flag);
    var cloth = B.el('path', { fill: '#C0623B', stroke: INK, 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, flag);
    var f = figure(svg), HX = FX - 34, u1 = HX / K, u0 = u1 - N * CYC, TW = N / WALKHZ, TS = TW + CLOSE;
    function wave(t, amp) { var d = 'M1 -46 '; var pts = []; for (var i = 0; i <= 6; i++) { var x = 1 + i * 5, y = -46 + Math.sin(t * 7 - i * .9) * amp * (i / 6); pts.push([x, y]); }
      var top = pts.map(function (p) { return 'L' + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' '), bot = pts.slice().reverse().map(function (p) { return 'L' + p[0].toFixed(1) + ' ' + (p[1] + 14).toFixed(1); }).join(' ');
      return d + top + ' ' + bot + ' Z'; }
    function draw(t) {
      var w = walk(t, u0, u1, N), hip, fa, fb, bob = 0, oa = 0, h1, h2;
      if (w) { hip = w.hu; fa = w.fa; fb = w.fb; bob = w.bob; oa = w.oa; }
      else { hip = u1; var c = B.ease((t - TW) / CLOSE); fa = [u1 + A, gy]; fb = [B.lerp(u1 - A, u1 - 4, c), gy - 7 * Math.sin(Math.PI * Math.min(c, 1))]; }
      var hp = [hip, gy - 67 + bob], sh = [hp[0] + 7 + 2, hp[1] - 50 + (w ? .4 * Math.cos(4 * Math.PI * w.p) : 0)], hc = [sh[0] + 9, sh[1] - 11];
      var walkH1 = [sh[0] - 13 * oa + 4, sh[1] + 42 - 3 * Math.abs(oa)];
      // the tape is gripped in the far hand, held out low in front of him while he walks
      var grip = [sh[0] + 20, sh[1] + 36 - 3 * Math.abs(oa)];
      if (w) { h1 = walkH1; h2 = grip; }
      else {
        var k = B.ease((t - TW) / CLOSE), s1 = [sh[0] + 5, sh[1] + 40], s2 = [sh[0] + 17, sh[1] + 62], pull = B.win(t, TW + .1, TW + .7, 99, 100);
        h1 = [B.lerp(walkH1[0], s1[0], k), B.lerp(walkH1[1], s1[1], k)]; h2 = [B.lerp(grip[0], s2[0], pull), B.lerp(grip[1], s2[1], pull)];   // he lowers the tape's hook to the foot of the flag
        var tipH = B.win(t, 4.6, 5.1, 5.5, 6.0), brim = [hc[0] + 22, hc[1] - 8];
        h2 = [B.lerp(h2[0], brim[0], tipH), B.lerp(h2[1], brim[1], tipH)];
      }
      var tilt = (w ? 2 * Math.sin(4 * Math.PI * w.p) : 0) + B.win(t, TS, TS + .4, 99, 100) * 6;
      var r = f.who.pose({ hip: hp, sh: sh, head: hc, tilt: tilt, ff: fa, fb: fb, h1: h1, h2: h2, bow: [-2, 0], shadow: 30, ground: gy + 2, shadowX: hip });
      f.put(r);
      // the tape: from the case along the ground to where his far hand holds the end (until he sets the hook at the flag)
      var hx = r.h2[0] * K, endX = Math.min(Math.max(hx, X0 + 12), FX - 4), end = t < TW ? hx : FX - 6;
      band.setAttribute('x1', X0 + 11); band.setAttribute('x2', Math.max(end, X0 + 11)); ticks.setAttribute('x1', X0 + 11); ticks.setAttribute('x2', Math.max(end, X0 + 11));
      // while he carries the end it rides at hand height at his side; show it as a line to the hand, else flat on the ground
      var lift = t < TW + .7 ? Math.min(1, Math.max(0, 1 - (t - TW) / .7)) : 0;
      tape.setAttribute('transform', 'translate(0 0)');
      cloth.setAttribute('d', wave(t, 2.4 + 2 * B.ease((t - TS) / 1)));
      if (w || lift > 0) { band.setAttribute('y1', GY - 2); band.setAttribute('y2', GY - 2 - (GY - 2 - (r.h2[1] * K)) * lift); ticks.setAttribute('y1', GY - 2); ticks.setAttribute('y2', GY - 2 - (GY - 2 - (r.h2[1] * K)) * lift); }
      else { band.setAttribute('y2', GY - 2); ticks.setAttribute('y2', GY - 2); }
    }
    return { draw: draw, end: 7 };
  }

  var scenes = { wilderness: wilderness, shortless: shortless, scrollometer: scrollometer };
  Array.prototype.forEach.call(document.querySelectorAll('svg.app-stage'), function (svg) {
    var mk = scenes[svg.getAttribute('data-scene')]; if (!mk) return;
    var s = mk(svg), handle = null;
    B.scenes[svg.getAttribute('data-scene')] = s.draw;
    function frame(t) { s.draw(Math.min(t, s.end)); if (t > s.end && handle && handle.stop) handle.stop(); }
    handle = B.play(svg, frame, { loop: 0, still: s.end });
  });
})();
