/* Back to top: a round M button in the bottom-right corner. Press it and the Builder climbs the M's stairs while the page scrolls up.
   Needs builder-lite.js first. Canonical source: brand/mascot/lite/to-top.js. Reduced motion: the page just scrolls up, no figure.
   Debug: add ?totop=1 to the URL to keep the button visible, and ?totopT=1.2 to freeze the climb at second 1.2 (for review). */
(function () {
  if (!window.BuilderLite) return;
  var B = window.BuilderLite, q = new URLSearchParams(location.search), reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MARK = 'M0,0 H100 L140,50 L180,0 H280 V280 H0 Z M40,40 H80 L140,110 L200,40 H240 V80 H200 V120 H160 V160 H120 V200 H80 V240 H40 Z';
  var css = document.createElement('style');
  css.textContent = '.to-top{position:fixed;right:18px;bottom:18px;width:60px;height:60px;padding:0;border:0;border-radius:14px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.18),0 0 0 1px rgba(0,0,0,.08);cursor:pointer;opacity:0;transform:translateY(10px);pointer-events:none;transition:opacity .25s,transform .25s;z-index:50}'
    + '.to-top.on{opacity:1;transform:none;pointer-events:auto}.to-top:focus-visible{outline:3px solid #F5B800;outline-offset:2px}.to-top svg{display:block;width:100%;height:100%;overflow:hidden;border-radius:14px}'
    + '@media (max-width:600px){.to-top{right:12px;bottom:12px;width:52px;height:52px}}';
  document.head.appendChild(css);
  var btn = document.createElement('button');
  btn.className = 'to-top'; btn.type = 'button'; btn.setAttribute('aria-label', 'Back to top');
  document.body.appendChild(btn);
  var svg = B.el('svg', { viewBox: '-20 -20 320 320', 'aria-hidden': 'true' }, btn);
  var mark = B.el('path', { d: MARK, 'fill-rule': 'evenodd' }, svg);
  var fig = B.el('g', { 'clip-path': 'url(#ttclip)' }, svg), who = null, markColor = null;
  var defs = B.el('defs', {}, svg), cp = B.el('clipPath', { id: 'ttclip' }, defs);
  B.el('rect', { x: -20, y: -20, width: 320, height: 320 }, cp);
  function tint() { var h = document.querySelector('.site-header .brand svg, .brand svg'); markColor = h ? getComputedStyle(h).color : '#1F3A5F'; mark.setAttribute('fill', markColor); }
  tint();

  // the climb: treads of the M's staircase (foot y, x centre), the figure starts on the floor at the lower left
  var K = 1.3;   // the figure is drawn at this scale: at 1.0 the M's 40-unit stair rise is more than half a leg and he has to squat up every step
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
    if (!who) who = B.create(fig);
    var k = Math.max(0, Math.min(Math.floor((t - TIN) / STEP), 4)), u = t < TIN ? 0 : Math.min((t - TIN) / STEP - k, 1);
    if (t >= TIN + STEP * 4) { k = 4; u = 0; }
    var f = feetAt(k, u), hipY;
    if (k < 4) { var p0 = k === 0 ? planted(0) : planted(k - 1), p1 = planted(k); hipY = B.lerp(p0[1], p1[1], B.ease(u)) - 69; }
    else { hipY = B.lerp(T[2][1], T[3][1], B.ease((t - TIN - STEP * 4) / .4)) - 69; }
    var hip = [(f.a[0] + f.b[0]) / 2 - 3, hipY + (f.sw ? 2.5 * Math.sin(Math.PI * u) : 0)];
    var sh = [hip[0] + 7, hip[1] - 50], hc = [sh[0] + 9, sh[1] - 11];
    var ph = (k + u) * Math.PI;
    var h1 = [sh[0] + 14 + 13 * Math.sin(ph), sh[1] + 40 - 5 * Math.cos(ph)], h2 = [sh[0] + 14 - 13 * Math.sin(ph), sh[1] + 40 + 5 * Math.cos(ph)];
    var wave = B.win(t, TIN + STEP * 4 + .1, TIN + STEP * 4 + .35, DUR - .12, DUR);
    if (wave > 0) h1 = B.lerp2(h1, [hc[0] + 6, hc[1] - 14 + 3 * Math.sin(t * 16)], wave);
    var enter = t < TIN ? B.ease(t / TIN) : 1;
    who.root.setAttribute('transform', 'translate(' + (-46 * (1 - enter)).toFixed(1) + ' 0) scale(' + K + ')');
    who.pose({ hip: hip, sh: sh, head: hc, tilt: 8, ff: f.a, fb: f.b, h1: h1, h2: h2, bow: [-3, 0], shadow: 22, shadowX: (f.a[0] + f.b[0]) / 2, ground: Math.max(f.a[1], f.b[1]) + 1.5 });
  }
  function show(on) { btn.classList.toggle('on', on); }
  function onScroll() { show(q.get('totop') ? true : window.scrollY > 500); }
  addEventListener('scroll', onScroll, { passive: true }); onScroll();
  if (q.get('totopT')) { show(true); draw(parseFloat(q.get('totopT'))); return; }
  var busy = false;
  btn.addEventListener('click', function () {
    if (busy) return;
    var y0 = window.scrollY;
    if (reduce) { window.scrollTo(0, 0); return; }
    busy = true; var t0 = 0;
    function frame(ts) {
      if (!t0) t0 = ts; var t = (ts - t0) / 1000;
      draw(t);
      var u = B.ease((t - TIN * .5) / (DUR - TIN * .5 - .4));
      window.scrollTo(0, y0 * (1 - u));
      if (t < DUR) requestAnimationFrame(frame); else { busy = false; show(window.scrollY > 500); fig.innerHTML = ''; who = null; }
    }
    requestAnimationFrame(frame);
  });
})();
