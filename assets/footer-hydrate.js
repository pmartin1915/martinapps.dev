/* Remember to hydrate (2026-11-25): click or tap the bottle on the parking stop and a magnifying glass swings in over its cap.
   Under the glass a small green caterpillar crawls onto the cap, rears up and raises a sign. Its own file, like footer-bonk.js,
   so regenerating footer-scene.js cannot wipe it. Nothing is added to the SVG file: one invisible tap target goes into the loaded
   scene, and the glass is a throwaway overlay on the page (so it can be big enough to read on a phone). No tracking, nothing
   stored. Reduced motion: the glass appears and goes without moving. __hydrate.at(t) draws second t without timers, for review. */
(function () {
  var box = document.querySelector('.foot-scene');
  if (!box || !('MutationObserver' in window)) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function hydrate(s) {
    if (!s.querySelector('#o-th')) return;
    var NS = 'http://www.w3.org/2000/svg', INK = '#1A1A1A', CAPX = 634, CAPY = 157, T = 8, OUT = .4, ANG = 38;
    var GREEN = '#7CC24A', GREEN2 = '#93D460', DARK = '#2E6B1F';
    var FLAT = [[-66, 34], [-49, 34], [-32, 34], [-15, 34], [2, 34], [19, 34], [36, 32]];
    var REAR = [[-62, 34], [-45, 34], [-28, 34], [-11, 34], [4, 30], [16, 18], [28, 3]];
    var RAD = [9.5, 11, 12, 12, 12, 11.5, 14];
    var ctx = null, running = false, t0 = 0, w0 = 0;
    function mk(n, a, p) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
    function cl(u) { return Math.max(0, Math.min(1, u)); }
    function ss(u) { u = cl(u); return u * u * (3 - 2 * u); }
    function back(u) { u = cl(u) - 1; return 1 + 2.70158 * u * u * u + 1.70158 * u * u; }
    function f1(v) { return v.toFixed(1); }

    /* the tap target: the bottle and a little room round it, never under about 44 px wide */
    var hit = mk('rect', { fill: 'transparent', 'pointer-events': 'all', style: 'cursor:pointer' }, s);
    function place() {
      var m = s.getScreenCTM(), k = m && m.a ? m.a : 1, hw = Math.max(16, 22 / k);
      hit.setAttribute('x', f1(CAPX - hw)); hit.setAttribute('width', f1(2 * hw)); hit.setAttribute('y', 124); hit.setAttribute('height', 72);
    }
    place();

    function setup() {
      var m = s.getScreenCTM(), p = s.createSVGPoint(); p.x = CAPX; p.y = CAPY; p = p.matrixTransform(m);
      var px = p.x + scrollX, py = p.y + scrollY, de = document.documentElement, W = de.clientWidth, H = Math.max(de.scrollHeight, document.body.scrollHeight);
      var R = Math.max(84, Math.min(118, W * .2)), cx = Math.max(R + 12, Math.min(W - R - 12, px + .3 * R)), cy = py - .62 * R;   // up and a little right, so the man eating stays in view
      var left = cx + 1.95 * R * Math.cos(ANG * Math.PI / 180) > W - 6;                      // no room on the right: the handle goes left
      var x0 = Math.max(0, cx - 2.3 * R), x1 = Math.min(W, cx + 2.3 * R), y0 = Math.max(0, cy - 1.5 * R), y1 = Math.min(H, cy + 1.9 * R);
      var wrap = document.createElement('div');
      wrap.style.cssText = 'position:absolute;z-index:60;overflow:hidden;pointer-events:none;left:' + x0 + 'px;top:' + y0 + 'px;width:' + (x1 - x0) + 'px;height:' + (y1 - y0) + 'px';
      var o = mk('svg', { viewBox: x0 + ' ' + y0 + ' ' + (x1 - x0) + ' ' + (y1 - y0), width: x1 - x0, height: y1 - y0, role: 'img', 'aria-label': 'Under a magnifying glass, a small green caterpillar on the bottle cap holds a sign: Remember to hydrate!' });
      o.style.cssText = 'display:block;overflow:visible';
      wrap.appendChild(o);
      var d = mk('defs', {}, o); mk('circle', { r: 93 }, mk('clipPath', { id: 'hyd-clip' }, d));
      var root = mk('g', {}, o); root.style.filter = 'drop-shadow(0 5px 9px rgba(0,0,0,.3))';
      var handle = mk('g', { transform: 'rotate(' + (left ? 180 - ANG : ANG) + ')' }, root);
      mk('rect', { x: 92, y: -12, width: 100, height: 24, rx: 12, fill: '#7A5A2E', stroke: INK, 'stroke-width': 4 }, handle);
      mk('rect', { x: 118, y: -7, width: 64, height: 4, rx: 2, fill: '#fff', 'fill-opacity': .22 }, handle);
      mk('rect', { x: 92, y: -13.5, width: 24, height: 27, rx: 4, fill: '#8C8A85', stroke: INK, 'stroke-width': 4 }, handle);
      mk('circle', { r: 94, fill: '#EDF4F3' }, root);
      var glass = mk('g', { 'clip-path': 'url(#hyd-clip)' }, root), view = mk('g', {}, glass);
      mk('rect', { x: -110, y: 54, width: 220, height: 60, fill: '#D6D3CB' }, view);             // the kerb behind the bottle, out of focus
      /* the cap, big: same steel blue-black as the small one, with a grip band and two beads of water */
      mk('rect', { x: -80, y: 46, width: 160, height: 96, rx: 24, fill: '#2F3B44' }, view);
      mk('rect', { x: -80, y: 46, width: 160, height: 9, rx: 4.5, fill: '#fff', 'fill-opacity': .14 }, view);
      mk('rect', { x: -80, y: 46, width: 44, height: 96, rx: 22, fill: '#fff', 'fill-opacity': .1 }, view);
      for (var i = -3; i <= 3; i++) mk('line', { x1: i * 19 + 6, y1: 66, x2: i * 19 + 6, y2: 104, stroke: '#000', 'stroke-opacity': .22, 'stroke-width': 5, 'stroke-linecap': 'round' }, view);
      [[57, 74, 4.2], [-60, 82, 3.2]].forEach(function (w) {
        mk('path', { d: 'M0 -1.7 C.9 -.5 1 0 1 .3 A1 1 0 1 1 -1 .3 C-1 0 -.9 -.5 0 -1.7Z', fill: '#BFE6F5', stroke: '#fff', 'stroke-opacity': .6, 'stroke-width': .25, transform: 'translate(' + w[0] + ' ' + w[1] + ') scale(' + w[2] + ')' }, view);
      });
      /* the caterpillar: seven round segments, tail first so each one sits in front of the one behind it */
      var cat = mk('g', {}, view), feet = [], segs = [], k;
      for (k = 0; k < 6; k++) feet.push(mk('path', { fill: 'none', stroke: DARK, 'stroke-width': 3, 'stroke-linecap': 'round' }, cat));
      for (k = 0; k < 6; k++) segs.push(mk('circle', { r: RAD[k], fill: k % 2 ? GREEN2 : GREEN, stroke: DARK, 'stroke-width': 2.6 }, cat));
      var sign = mk('g', { opacity: 0 }, cat), sg = mk('g', {}, sign);
      mk('line', { x1: 0, y1: 9, x2: 0, y2: -48, stroke: INK, 'stroke-width': 8, 'stroke-linecap': 'round' }, sg);
      mk('line', { x1: 0, y1: 9, x2: 0, y2: -48, stroke: '#9A7440', 'stroke-width': 4.4, 'stroke-linecap': 'round' }, sg);
      mk('rect', { x: -59, y: -92, width: 112, height: 46, rx: 7, fill: '#FFFDF6', stroke: INK, 'stroke-width': 3.2 }, sg);
      var font = '"Atkinson Hyperlegible Next", system-ui, sans-serif';
      mk('text', { x: -3, y: -73.5, 'text-anchor': 'middle', 'font-family': font, 'font-size': 15, 'font-weight': 700, fill: INK }, sg).textContent = 'Remember to';
      mk('text', { x: -3, y: -54, 'text-anchor': 'middle', 'font-family': font, 'font-size': 21, 'font-weight': 800, fill: '#1B74B4' }, sg).textContent = 'hydrate!';
      var arms = [mk('path', { fill: 'none', stroke: DARK, 'stroke-width': 3.4, 'stroke-linecap': 'round' }, cat), mk('path', { fill: 'none', stroke: DARK, 'stroke-width': 3.4, 'stroke-linecap': 'round' }, cat)];
      var head = mk('g', {}, cat), ant = [];
      for (k = 0; k < 2; k++) { ant.push(mk('path', { fill: 'none', stroke: DARK, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, head)); ant.push(mk('circle', { r: 2.6, fill: DARK }, head)); }
      mk('circle', { r: RAD[6], fill: GREEN2, stroke: DARK, 'stroke-width': 2.6 }, head);
      mk('circle', { cx: -8.6, cy: 4.4, r: 2.7, fill: '#F29CA9', 'fill-opacity': .85 }, head); mk('circle', { cx: 8.6, cy: 4.4, r: 2.7, fill: '#F29CA9', 'fill-opacity': .85 }, head);
      var eyes = mk('g', {}, head);
      [-5, 5].forEach(function (ex) { mk('circle', { cx: ex, cy: -2.2, r: 4.2, fill: '#fff', stroke: DARK, 'stroke-width': 1.3 }, eyes); });
      var pup = [mk('circle', { r: 2.1, fill: INK }, eyes), mk('circle', { r: 2.1, fill: INK }, eyes)];
      mk('path', { d: 'M-4.4 5.6 Q0 9.6 4.4 5.6', fill: 'none', stroke: DARK, 'stroke-width': 2, 'stroke-linecap': 'round' }, head);
      /* the glass itself: a soft tint, two glints, a black rim with a thin steel edge */
      mk('circle', { r: 93, fill: '#BFE6F5', 'fill-opacity': .1 }, root);
      mk('path', { d: 'M-71 -38 A80 80 0 0 1 -30 -74', fill: 'none', stroke: '#fff', 'stroke-opacity': .8, 'stroke-width': 7, 'stroke-linecap': 'round' }, root);
      mk('path', { d: 'M-78 -14 A80 80 0 0 1 -76 -24', fill: 'none', stroke: '#fff', 'stroke-opacity': .7, 'stroke-width': 7, 'stroke-linecap': 'round' }, root);
      mk('circle', { r: 97, fill: 'none', stroke: INK, 'stroke-width': 10 }, root);
      mk('circle', { r: 100.5, fill: 'none', stroke: '#8C8A85', 'stroke-width': 2.2 }, root);
      var tap = mk('circle', { r: 102, fill: 'transparent', 'pointer-events': 'all', style: 'cursor:pointer' }, root);
      tap.addEventListener('click', dismiss);
      document.body.appendChild(wrap);
      return { wrap: wrap, root: root, view: view, cat: cat, feet: feet, segs: segs, sign: sign, sg: sg, arms: arms, head: head, ant: ant, eyes: eyes, pup: pup, px: px, py: py, cx: cx, cy: cy, R: R, left: left };
    }

    function frame(t) {
      if (!ctx) ctx = setup();
      var c = ctx, i;
      /* the glass leaves the cap small and grows as it rises to its place; it goes back the same way */
      var E = back(t / .55) * (1 - ss((t - (T - OUT)) / OUT)), e1 = cl(E), sc = c.R / 100 * (.08 + .92 * E);
      var tip = (c.left ? -1 : 1) * (16 * (1 - ss(t / .7)) + 2.2 * Math.exp(-Math.max(0, t - .55) * 3) * Math.sin(Math.max(0, t - .55) * 11));
      c.root.setAttribute('transform', 'translate(' + f1(c.px + (c.cx - c.px) * e1) + ' ' + f1(c.py + (c.cy - c.py) * e1) + ') rotate(' + tip.toFixed(2) + ') scale(' + Math.max(.001, sc).toFixed(4) + ')');
      c.root.setAttribute('opacity', cl(t / .12).toFixed(2));
      /* what is under it comes up into focus */
      var z = .62 + .38 * ss((t - .1) / .65), blur = 4 * (1 - ss((t - .2) / .6));
      c.view.setAttribute('transform', 'translate(0 56) scale(' + z.toFixed(3) + ') translate(0 -50)');
      c.view.style.filter = blur > .05 ? 'blur(' + blur.toFixed(2) + 'px)' : '';
      /* crawl in along the cap (0.8-1.9 s), rear up (1.9-2.4 s), then just breathe */
      var cu = ss((t - .8) / 1.1), ox = -165 * (1 - cu), gait = Math.sin(Math.PI * cl((t - .8) / 1.1)), up = ss((t - 1.9) / .5), P = [];
      for (i = 0; i < 7; i++) {
        var x = FLAT[i][0] + (REAR[i][0] - FLAT[i][0]) * up + ox, y = FLAT[i][1] + (REAR[i][1] - FLAT[i][1]) * up;
        var hump = Math.max(0, Math.sin(t * 13 - i * .95));
        y -= 8 * hump * gait; x += 3 * Math.cos(t * 13 - i * .95) * gait;
        if (t > 2.4) {
          var lift = Math.max(0, i - 3) / 3;
          x += 1.8 * Math.sin(t * 2.1) * lift; y += 1.1 * Math.sin(t * 2.1 + 1) * lift;
          if (i < 4) y -= 1.6 * Math.max(0, Math.sin(t * 2.6 - i * 1.2));
        }
        P.push([x, y]);
      }
      /* one hop with the sign, so it does not sit still for five seconds */
      var hop = t > 4.9 && t < 5.5 ? -7 * Math.abs(Math.sin((t - 4.9) / .3 * Math.PI)) * (1 - (t - 4.9) / .6) : 0;
      for (i = 4; i < 7; i++) P[i][1] += hop * (i - 3) / 3;
      for (i = 0; i < 6; i++) {
        c.segs[i].setAttribute('cx', f1(P[i][0])); c.segs[i].setAttribute('cy', f1(P[i][1]));
        var on = 1 - cl((34 - P[i][1] - 4) / 6), fx = P[i][0], fy = P[i][1] + RAD[i] - 1.5, sw = 2.2 * Math.sin(t * 13 - i * .95) * gait;
        c.feet[i].setAttribute('d', 'M' + f1(fx - 3.5) + ' ' + f1(fy) + 'l' + f1(-1 + sw) + ' 4.6M' + f1(fx + 3.5) + ' ' + f1(fy) + 'l' + f1(1 + sw) + ' 4.6');
        c.feet[i].setAttribute('opacity', on.toFixed(2));
      }
      var hx = P[6][0], hy = P[6][1], nod = 5 * Math.sin(t * 1.6) * cl((t - 2.4) / .5) - 8 * gait;
      c.head.setAttribute('transform', 'translate(' + f1(hx) + ' ' + f1(hy) + ') rotate(' + nod.toFixed(1) + ')');
      for (i = 0; i < 2; i++) {
        var sgn = i ? 1 : -1, wv = 2.4 * Math.sin(t * 5 + i * 1.7), ax = sgn * 11 + wv, ay = -27 + Math.abs(wv) * .4;
        c.ant[2 * i].setAttribute('d', 'M' + (sgn * 5) + ' -12 Q' + f1(sgn * 6 + wv * .3) + ' -22 ' + f1(ax) + ' ' + f1(ay));
        c.ant[2 * i + 1].setAttribute('cx', f1(ax)); c.ant[2 * i + 1].setAttribute('cy', f1(ay));
      }
      /* eyes: on the way in it looks where it is going, then up at its sign, then out at you; it blinks */
      var look = ss((t - 2.5) / .4) * (1 - ss((t - 3.5) / .5)), lx = 1.4 * (1 - up) - 1.2 * look, ly = -1.6 * look;
      c.pup[0].setAttribute('cx', f1(-5 + lx)); c.pup[0].setAttribute('cy', f1(-2.2 + ly)); c.pup[1].setAttribute('cx', f1(5 + lx)); c.pup[1].setAttribute('cy', f1(-2.2 + ly));
      var bt = (t + .9) % 2.7, bl = bt < .16 ? 1 - .9 * Math.sin(bt / .16 * Math.PI) : 1;
      c.eyes.setAttribute('transform', 'translate(0 -2.2) scale(1 ' + bl.toFixed(2) + ') translate(0 2.2)');
      /* the sign pops up out of its hands (2.45 s), wobbles and settles */
      var v = (t - 2.45) / .5, pop = v <= 0 ? 0 : back(v), tw = Math.max(0, t - 2.95);
      var rot = -24 * (1 - ss(v)) + 5 * Math.exp(-tw * 4) * Math.sin(tw * 13) * (v > 1 ? 1 : 0) + 1.3 * Math.sin(t * 1.7) * cl(v);
      var hd = [P[5][0] - 13, P[5][1] + 2];
      c.sign.setAttribute('opacity', v > 0 ? 1 : 0);
      c.sign.setAttribute('transform', 'translate(' + f1(hd[0]) + ' ' + f1(hd[1]) + ') rotate(' + rot.toFixed(2) + ') scale(' + Math.max(.001, .94 * pop).toFixed(3) + ')');
      var reach = ss((t - 2.2) / .3);
      c.arms[0].setAttribute('d', 'M' + f1(P[5][0] - 7) + ' ' + f1(P[5][1] + 4) + 'L' + f1(P[5][0] - 7 - 6 * reach) + ' ' + f1(P[5][1] + 4 - 1 * reach));
      c.arms[1].setAttribute('d', 'M' + f1(P[5][0] - 8) + ' ' + f1(P[5][1] - 4) + 'L' + f1(P[5][0] - 8 - 5 * reach) + ' ' + f1(P[5][1] - 4 - 3 * reach));
      c.arms[0].setAttribute('opacity', reach.toFixed(2)); c.arms[1].setAttribute('opacity', reach.toFixed(2));
    }
    function clean() { if (ctx) { ctx.wrap.remove(); ctx = null; } }
    function end() { clean(); running = false; s.__act = false; removeEventListener('resize', resized); }
    function resized() { if (innerWidth !== w0) end(); }   // a phone's address bar sliding away is a resize too: only a new width ends it
    function dismiss() { if (!running) return; if (reduce) return end(); var t = (performance.now() - t0) / 1000; if (t < T - OUT) t0 = performance.now() - (T - OUT) * 1000; }
    function play() {
      if (running) return dismiss();
      if (s.__act) return;
      running = true; s.__act = true; t0 = performance.now(); w0 = innerWidth; addEventListener('resize', resized);
      if (reduce) { try { frame(4); } catch (e) { return end(); } var mine = ctx; setTimeout(function () { if (ctx === mine) end(); }, 6500); return; }
      (function tick(now) {
        if (!running) return;
        var t = (now - t0) / 1000;
        try { if (t < T) { frame(Math.max(0, t)); return requestAnimationFrame(tick); } } catch (e) { /* a drawing error must never leave the glass stuck on the page */ }
        end();
      })(t0);
    }
    hit.addEventListener('click', play);
    addEventListener('resize', place);
    window.__hydrate = { play: play, at: function (t) { frame(t); }, reset: function () { end(); }, T: T };
  }
  function go() { var s = box.querySelector('svg'); if (!s || !s.pauseAnimations || window.__hydrate) return !!s; hydrate(s); return true; }
  if (!go()) { var mo = new MutationObserver(function () { if (go()) mo.disconnect(); }); mo.observe(box, { childList: true }); }
})();
