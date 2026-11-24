/* The hammer bonk (2026-11-24): its own file so that regenerating footer-scene.js (brand/mascot/footer/build.py) cannot wipe it.
   Waits for the footer scene to load, then adds the gag. Design: ai/HAMMER-BONK.md. */
(function () {
  var box = document.querySelector('.foot-scene');
  if (!box || !('MutationObserver' in window)) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* Hammer bonk (2026-11-24). Carry the hammer (assets/builder.js) down here and drop it on the sitter's head: it bonks him, the
     street cracks and opens under his parking stop, he drops in and climbs back out, the street closes. Drawn entirely from here
     as a throwaway overlay (nothing is added to the SVG file); off for reduced motion; no tracking. builder.js asks __bonk.box()
     for his head and calls __bonk.play(release). __bonk.at(t) draws second t without timers, for the review harness. Design: ai/HAMMER-BONK.md. */
  function bonk(s) {
    var bar = s.querySelector('#o-bar'), sit = s.querySelector('#o-sit'), th = s.querySelector('#o-th');
    if (!bar || !sit || !th || reduce) return;
    var NS = 'http://www.w3.org/2000/svg', G = 214, CX = 590, RX = 120, RY = 14, PIT_Y = G + 8, HX = 519, HY = 129, FX = 542;
    var L = { x0: 470, x1: 710 }, T = 6.6, HOLD = 1.45, ctx = null, running = false;
    function mk(n, a, p) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
    function ss(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }
    function cl(u) { return Math.max(0, Math.min(1, u)); }
    function defs() { return s.querySelector('defs') || s.insertBefore(mk('defs', {}), s.firstChild); }
    function shadowEls() {
      var o = [], n;
      [].forEach.call(s.querySelectorAll('use'), function (u) { var h = u.getAttribute('href'); if (h === '#o-sit' || h === '#o-bar') o.push(u); });
      n = s.querySelector('ellipse[cx="504"][cy="215.5"]'); if (n) o.push(n);
      return o;
    }
    function wrap(el, extra) {   // clip > move > (squash) > el, in place, so the drawing order does not change
      var c = mk('g', { 'clip-path': 'url(#bonk-clip)' }), m = mk('g', {}, c), q = extra ? mk('g', {}, m) : m;
      el.parentNode.insertBefore(c, el); q.appendChild(el); return { c: c, m: m, q: q, el: el };
    }
    function setup() {
      var clip = mk('clipPath', { id: 'bonk-clip' }, defs());
      mk('path', { 'clip-rule': 'evenodd', d: 'M-400 -100H1400V600H-400Z M' + L.x0 + ' ' + (G + RY + 8) + 'H' + L.x1 + 'V600H' + L.x0 + 'Z' }, clip);
      var under = mk('g', {}), pit = mk('g', {}, under), over = mk('g', {}), i;
      bar.parentNode.insertBefore(under, bar);
      var crack = mk('path', { d: 'M910 ' + (G + 4) + ' l-70 10 l-44 -12 l-56 16 l-46 -9 l-40 12 l-34 -8 l-30 6 l-22 -7', fill: 'none', stroke: '#0E0E12', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, under);
      var len = crack.getTotalLength(); crack.setAttribute('stroke-dasharray', len); crack.setAttribute('stroke-dashoffset', len);
      var branch = mk('path', { d: 'M760 ' + (G + 20) + ' l-12 16 l-14 6 M650 ' + (G + 6) + ' l8 18 l-4 12', fill: 'none', stroke: '#0E0E12', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0 }, under);
      mk('ellipse', { cx: CX, cy: PIT_Y, rx: RX + 7, ry: RY + 5, fill: '#6B6B6F' }, pit);                       // broken lip
      mk('ellipse', { cx: CX, cy: PIT_Y, rx: RX + 3, ry: RY + 2, fill: '#2B2B2F' }, pit);
      mk('ellipse', { cx: CX, cy: PIT_Y, rx: RX, ry: RY, fill: '#0A0A0D' }, pit);
      mk('ellipse', { cx: CX, cy: PIT_Y + 3, rx: RX * .7, ry: RY * .55, fill: '#1B1B21' }, pit);
      var tw = wrap(th.parentNode, false), bw = wrap(bar, false), sw = wrap(sit, true);
      var stars = [], rays = [], puffs = [], P = [];
      for (i = 0; i < 3; i++) stars.push(mk('path', { d: 'M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2Z', fill: '#F5B800', stroke: '#1A1A1A', 'stroke-width': 1.2, 'stroke-linejoin': 'round', opacity: 0 }, over));
      for (i = 0; i < 6; i++) rays.push(mk('line', { stroke: '#1A1A1A', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0 }, over));
      function burst(b, x, y, n, w, r) { for (var k = 0; k < n; k++) { var f = k / (n - 1) - .5; P.push([b, x + f * w, y, f * 70 + (k % 2 ? 6 : -6), -26 - (k % 3) * 9, r + (k % 3) * 2, k % 2]); } }
      burst(2.40, CX, PIT_Y, 9, 2 * RX, 7); burst(3.45, CX - 20, G + 4, 9, 150, 8); burst(5.75, CX, PIT_Y, 9, 2 * RX, 7);
      [1.5, 1.7, 1.9, 2.1, 2.3].forEach(function (b, k) { P.push([b, 820 - k * 85, G + 8, -14, -22, 4, k % 2]); });
      P.forEach(function () { puffs.push(mk('circle', { fill: '#CFCCC4', opacity: 0 }, over)); });
      s.appendChild(over);   // after every figure, so stars and dust are on top
      return { under: under, pit: pit, crack: crack, len: len, branch: branch, over: over, tw: tw, bw: bw, sw: sw, stars: stars, rays: rays, puffs: puffs, P: P, hidden: shadowEls() };
    }
    function dyAt(t) {
      if (t < 2.9) return 0;
      if (t < 3.5) { var u = (t - 2.9) / .6; return 125 * u * u; }
      if (t < 4.4) return 125;
      var K = [[4.4, 125], [4.75, 98], [4.95, 108], [5.3, 62], [5.5, 74], [5.85, 0]];
      for (var i = 1; i < K.length; i++) if (t < K[i][0]) return K[i - 1][1] + (K[i][1] - K[i - 1][1]) * ss((t - K[i - 1][0]) / (K[i][0] - K[i - 1][0]));
      return 0;
    }
    function frame(t) {
      if (!ctx) { ctx = setup(); ctx.hidden.forEach(function (n) { n.setAttribute('opacity', 0); }); }
      var c = ctx, dy = dyAt(t), k = t < .08 ? t / .08 : Math.exp(-(t - .08) * 6) * Math.cos((t - .08) * 20);
      var sway = t > .4 && t < 2.9 ? 2 * Math.sin(t * 5) * cl((t - .4) / .4) * (1 - cl((t - 2.5) / .4)) : 0;
      var tilt = t < 2.9 ? 0 : t < 3.5 ? 10 * ss((t - 2.9) / .3) : t <= 4.4 ? 10 : t < 5.85 ? 10 * (1 - ss((t - 4.4) / 1.4)) : 0;
      var mv = 'translate(0 ' + dy.toFixed(1) + ')';
      c.tw.m.setAttribute('transform', mv); c.bw.m.setAttribute('transform', mv); c.sw.m.setAttribute('transform', mv);
      c.sw.q.setAttribute('transform', 'translate(' + FX + ' ' + G + ') rotate(' + (sway + tilt).toFixed(2) + ') scale(' + (1 + .08 * k).toFixed(3) + ' ' + (1 - .14 * k).toFixed(3) + ') translate(' + (-FX) + ' ' + (-G) + ')');
      var cu = ss((t - 1.4) / 1.0), fade = 1 - ss((t - 5.9) / .7);
      c.crack.setAttribute('stroke-dashoffset', (c.len * (1 - cu)).toFixed(1)); c.crack.setAttribute('opacity', fade.toFixed(2));
      c.branch.setAttribute('opacity', t > 2.2 ? fade.toFixed(2) : 0);
      var pp = t < 2.4 ? 0 : t < 2.9 ? 1 - Math.pow(1 - (t - 2.4) / .5, 2) : t < 5.85 ? 1 : 1 - ss((t - 5.85) / .6);
      c.pit.setAttribute('transform', 'translate(' + CX + ' ' + PIT_Y + ') scale(' + Math.max(.001, pp).toFixed(3) + ') translate(' + (-CX) + ' ' + (-PIT_Y) + ')'); c.pit.setAttribute('opacity', pp > 0 ? 1 : 0);
      var sh = (t > 1.4 && t < 3.7) ? (1 - cl((t - 3.2) / .5)) * 1.6 : 0;   // the street shakes
      s.style.transform = sh ? 'translate(' + (sh * Math.sin(t * 61)).toFixed(2) + 'px,' + (sh * .6 * Math.sin(t * 47)).toFixed(2) + 'px)' : '';
      c.stars.forEach(function (n, i) {
        var a = t * 7 + i * 2.094, hole = t > 3.5 && t < 4.4, on = t < 1.9 || hole;
        var x = hole ? CX - 30 + i * 30 : HX + 24 * Math.cos(a), y = hole ? PIT_Y - 26 + 6 * Math.sin(a * 1.3) : HY - 24 + 8 * Math.sin(a);
        n.setAttribute('opacity', on ? (hole ? Math.min(1, (t - 3.5) * 4, (4.4 - t) * 4) : Math.min(1, (1.9 - t) * 3)).toFixed(2) : 0);
        n.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (a * 40).toFixed(0) + ') scale(' + (hole ? .7 : 1) + ')');
      });
      c.rays.forEach(function (n, i) {
        var a = -Math.PI * (.15 + .7 * i / 5), r0 = 14 + t * 30;
        n.setAttribute('x1', (HX + r0 * Math.cos(a)).toFixed(1)); n.setAttribute('y1', (HY - 18 + r0 * .8 * Math.sin(a)).toFixed(1));
        n.setAttribute('x2', (HX + (r0 + 9) * Math.cos(a)).toFixed(1)); n.setAttribute('y2', (HY - 18 + (r0 + 9) * .8 * Math.sin(a)).toFixed(1));
        n.setAttribute('opacity', t < .35 ? (1 - t / .35).toFixed(2) : 0);
      });
      c.P.forEach(function (q, i) {
        var tau = t - q[0], n = c.puffs[i];
        if (tau < 0 || tau > 1.1) { n.setAttribute('opacity', 0); return; }
        n.setAttribute('cx', (q[1] + q[3] * tau).toFixed(1)); n.setAttribute('cy', (q[2] + q[4] * tau).toFixed(1));
        n.setAttribute('r', (q[5] * (1 + 1.7 * tau)).toFixed(1)); n.setAttribute('fill', q[6] ? '#CFCCC4' : '#B7B3AA'); n.setAttribute('opacity', (.6 * (1 - tau / 1.1)).toFixed(2));
      });
    }
    function clean() {
      if (!ctx) return;
      [ctx.tw, ctx.bw, ctx.sw].forEach(function (w) { w.c.parentNode.insertBefore(w.el, w.c); w.c.remove(); });
      ctx.under.remove(); ctx.over.remove(); ctx.hidden.forEach(function (n) { n.removeAttribute('opacity'); });
      var cp = s.querySelector('#bonk-clip'); if (cp) cp.remove();
      s.style.transform = ''; ctx = null;
    }
    /* the sitter's head in PAGE coordinates: [left, right, top, bottom], or null while a gag is running */
    function box() {
      if (running || s.__act) return null;
      var m = s.getScreenCTM(); if (!m) return null;
      var a = s.createSVGPoint(), b = s.createSVGPoint(); a.x = 497; a.y = 108; b.x = 541; b.y = 142;
      a = a.matrixTransform(m); b = b.matrixTransform(m);
      return [a.x + scrollX, b.x + scrollX, a.y + scrollY, b.y + scrollY];
    }
    function play(release) {
      if (running || s.__act) return false;
      running = true; s.__act = true; s.pauseAnimations();
      var t0 = performance.now(), thawed = false, rel = false;
      (function tick(now) {
        var t = (now - t0) / 1000;
        if (t >= HOLD && !thawed) { thawed = true; s.unpauseAnimations(); }
        if (t >= 2.9 && !rel) { rel = true; try { if (release) release(); } catch (e) {} }
        if (t < T) { frame(t); return requestAnimationFrame(tick); }
        clean(); running = false; s.__act = false;
      })(t0);
      return true;
    }
    window.__bonk = { box: box, play: play, busy: function () { return running; },
      at: function (t) { running = true; frame(t); }, reset: function () { clean(); running = false; s.__act = false; } };
  }
  function go() { var s = box.querySelector("svg"); if (!s || !s.pauseAnimations || window.__bonk) return !!s; bonk(s); return true; }
  if (!go()) { var mo = new MutationObserver(function () { if (go()) mo.disconnect(); }); mo.observe(box, { childList: true }); }
})();
