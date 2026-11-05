/* Back to top: a round M button in the bottom-right corner. Press it and the Builder climbs the M's stairs while the page scrolls up.
   Needs builder-lite.js first. Canonical source: brand/mascot/lite/to-top.js. Reduced motion: the page just scrolls up, no figure.
   Debug: add ?totop=1 to the URL to keep the button visible, and ?totopT=1.2 to freeze the climb at second 1.2 (for review). */
(function () {
  if (!window.BuilderLite) return;
  var B = window.BuilderLite, q = new URLSearchParams(location.search), reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var MARK = 'M0,0 H100 L140,50 L180,0 H280 V280 H0 Z M40,40 H80 L140,110 L200,40 H240 V80 H200 V120 H160 V160 H120 V200 H80 V240 H40 Z';
  var css = document.createElement('style');
  css.textContent = '.to-top{position:fixed;right:18px;bottom:18px;width:60px;height:60px;padding:0;border:0;border-radius:14px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.08);cursor:pointer;opacity:0;transform:translateY(10px);pointer-events:none;visibility:hidden;transition:opacity .25s,transform .25s,visibility 0s .25s;z-index:50}'
    + '.to-top.on{opacity:1;transform:none;pointer-events:auto;visibility:visible;transition-delay:0s}.to-top:focus-visible{outline:3px solid #F5B800;outline-offset:2px}.to-top svg{display:block;width:100%;height:100%;overflow:hidden;border-radius:14px}'
    + '@media (max-width:600px){.to-top{right:12px;bottom:12px;width:52px;height:52px}}';
  document.head.appendChild(css);
  var btn = document.createElement('button');
  btn.className = 'to-top'; btn.type = 'button'; btn.setAttribute('aria-label', 'Back to top');
  document.body.appendChild(btn);
  var svg = B.el('svg', { viewBox: '-20 -20 320 320', 'aria-hidden': 'true' }, btn);
  var mark = B.el('path', { d: MARK, 'fill-rule': 'evenodd' }, svg);
  var fig = B.el('g', { 'clip-path': 'url(#ttclip)' }, svg), who = null, markColor = null, puffs = null;
  var defs = B.el('defs', {}, svg), cp = B.el('clipPath', { id: 'ttclip' }, defs);
  B.el('path', { d: 'M40,40 H80 L140,110 L200,40 H240 V80 H200 V120 H160 V160 H120 V200 H80 V240 H40 Z' }, cp);   // the counter of the M: he is only seen through it
  function tint() { var h = document.querySelector('.site-header .brand svg, .brand svg'); markColor = h ? getComputedStyle(h).color : '#1F3A5F'; mark.setAttribute('fill', markColor); }
  tint();

  // the climb: treads of the M's staircase (foot y, x centre), the figure starts on the floor at the lower left
  var K = 1.0;   // the figure is drawn at this scale: at 1.0 the M's 40-unit stair rise is more than half a leg and he has to squat up every step
  var T = [[100, 200], [140, 160], [180, 120], [220, 80]].map(function (p) { return [p[0] / K, p[1] / K]; }), F0 = [[62, 240], [40, 240]].map(function (p) { return [p[0] / K, p[1] / K]; });   // front foot, rear foot at the start
  var TIN = .35, STEP = .46, TOUT = .55, DUR = TIN + STEP * 4 + TOUT;
  function feetAt(k, u) {
    // k completed steps (+ a swing of progress u when k < 4). Steps alternate the rear foot b, then a, onto the next tread.
    var a = F0[0].slice(), bb = F0[1].slice(), i;
    for (i = 0; i < Math.min(k, 4); i++) { if (i % 2 === 0) bb = T[i].slice(); else a = T[i].slice(); }
    var sw = null;
    if (k < 4) {
      var mine = (k % 2 === 0) ? bb : a, to = T[k], s = B.ease(u);
      var pos = [B.lerp(mine[0], to[0], s), B.lerp(mine[1], to[1], s) - 24 * Math.sin(Math.PI * u)];
      if (k % 2 === 0) bb = pos; else a = pos;
      sw = (k % 2 === 0) ? 'b' : 'a';
    }
    return { a: a, b: bb, sw: sw };
  }
  function planted(k) { var f = feetAt(k, 0); return (k % 2 === 0) ? f.a : f.b; }   // the foot that carries him during step k
  function draw(t) {
    if (!who) { who = B.create(fig); puffs = []; for (var i = 0; i < 4; i++) puffs.push(B.el('circle', { r: 0, fill: '#B9C6D8', opacity: 0 }, fig)); }
    var k = Math.max(0, Math.min(Math.floor((t - TIN) / STEP), 4)), u = t < TIN ? 0 : Math.min((t - TIN) / STEP - k, 1);
    if (t >= TIN + STEP * 4) { k = 4; u = 0; }
    var f = feetAt(k, u), hipY;
    if (k < 4) { var p0 = k === 0 ? planted(0) : planted(k - 1), p1 = planted(k); hipY = B.lerp(p0[1], p1[1], B.ease(u)) - 69; }
    else { hipY = T[2][1] - 69; }
    var land = 0, kl;
    for (kl = 0; kl < 4; kl++) land = Math.max(land, Math.exp(-Math.pow((t - (TIN + STEP * (kl + 1)) - .05) / .07, 2)));    // each foot lands with a small give in the knees
    var hip = [(f.a[0] + f.b[0]) / 2 - 3, hipY + (f.sw ? 2.5 * Math.sin(Math.PI * u) : 0) + 2.4 * land];
    mark.setAttribute('transform', 'translate(0 ' + (1.1 * land).toFixed(2) + ')');
    for (kl = 0; kl < 4; kl++) {                  // a puff of dust off the tread where each foot came down
      var pu = (t - (TIN + STEP * (kl + 1))) / .5, pc = puffs[kl];
      if (pu > 0 && pu < 1) { pc.setAttribute('cx', (T[kl][0] + 2 + 5 * pu).toFixed(1)); pc.setAttribute('cy', (T[kl][1] - 3 - 9 * pu).toFixed(1)); pc.setAttribute('r', (2.5 + 6 * pu).toFixed(1)); pc.setAttribute('opacity', (.7 * (1 - pu)).toFixed(2)); } else pc.setAttribute('opacity', 0);
    }
    var sh = [hip[0] + 3, hip[1] - 50], hc = [sh[0] + 6, sh[1] - 11];
    var ph = (k + u) * Math.PI;
    var h1 = [sh[0] + 14 + 13 * Math.sin(ph), sh[1] + 40 - 5 * Math.cos(ph)], h2 = [sh[0] + 14 - 13 * Math.sin(ph), sh[1] + 40 + 5 * Math.cos(ph)];
    var ex = B.ease((t - TIN - STEP * 4 - .05) / .42);            // after the last tread he steps up and back into the wall, behind the glyph
    var enter = t < TIN ? B.ease(t / TIN) : 1;
    who.root.setAttribute('transform', 'translate(' + (-46 * (1 - enter) + 34 * ex).toFixed(1) + ' ' + (-26 * ex).toFixed(1) + ') scale(' + K + ')');
    who.pose({ hip: hip, sh: sh, head: hc, tilt: 8, ff: f.a, fb: f.b, h1: h1, h2: h2, bow: [-3, 0], shadow: 22, shadowX: (f.a[0] + f.b[0]) / 2, ground: Math.max(f.a[1], f.b[1]) + 1.5 });
  }
  function show(on) { btn.classList.toggle('on', on); }
  var busy = false, rafId = 0;
  function onScroll() { if (!busy) show(q.get('totop') ? true : window.scrollY > 500); }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  B.scenes.totop = function (tt) { show(true); draw(tt); };   // for the review harness (brand/mascot/eyes): BuilderLite.scenes.totop(seconds)
  if (q.get('totopT')) { show(true); draw(parseFloat(q.get('totopT'))); return; }
  function jump(y) { try { window.scrollTo({ top: y, left: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, y); } }   // not the page's smooth-scroll setting
  function finish() { busy = false; cancelAnimationFrame(rafId); removeEventListener('wheel', finish); removeEventListener('touchstart', finish); removeEventListener('keydown', finish); if (fig) fig.innerHTML = ''; who = null; puffs = null; mark.setAttribute('transform', ''); show(window.scrollY > 500); }
  btn.addEventListener('click', function () {
    if (busy) return;
    var y0 = window.scrollY;
    if (reduce) { jump(0); return; }
    busy = true; var t0 = 0;
    addEventListener('wheel', finish, { passive: true, once: true }); addEventListener('touchstart', finish, { passive: true, once: true }); addEventListener('keydown', finish, { once: true });   // the reader takes over: stop driving the scroll
    function frame(ts) {
      if (!busy) return;
      if (!t0) t0 = ts; var t = (ts - t0) / 1000;
      draw(t);
      var u = B.ease((t - TIN * .5) / (DUR - TIN * .5 - .4));
      jump(y0 * (1 - u));
      if (t < DUR) rafId = requestAnimationFrame(frame); else { finish(); btn.blur(); }
    }
    rafId = requestAnimationFrame(frame);
  });
})();
