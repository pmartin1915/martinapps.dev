/* Holiday dress: on a few days of the year the Builders get small, charming touches. By the visitor's own clock, in the browser.
   No network, no cookies, nothing stored, nothing sent. Preview any day: ?holiday=thanksgiving (or ?holiday=none to force plain).
   pickHoliday(date) is pure and tested in _test/holiday.test.mjs. Props are drawn here, as overlays; no scene file is edited
   except for the one-line hooks that call window.__holiday. Reduced motion: props show, nothing moves. */
(function (g) {
  var NAMES = ['valentines', 'stpatricks', 'easter', 'july4', 'halloween', 'thanksgiving', 'christmas', 'newyear'];

  function easter(y) {   // Gregorian computus (Meeus/Jones/Butcher): [month 1-12, day]
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25),
      h = Math.floor((b - f + 1) / 3), i = (19 * a + b - d - h + 15) % 30, k = Math.floor(c / 4), l = c % 4,
      m = (32 + 2 * e + 2 * k - i - l) % 7, n = Math.floor((a + 11 * i + 22 * m) / 451), t = i + m - 7 * n + 114;
    return [Math.floor(t / 31), t % 31 + 1];
  }
  function thanksgiving(y) {   // 4th Thursday of November
    var first = new Date(y, 10, 1).getDay();             // 0 = Sunday
    return 1 + (4 - first + 7) % 7 + 21;
  }
  function dayNum(y, m, d) { return Math.round(Date.UTC(y, m - 1, d) / 864e5); }

  function pickHoliday(date) {
    var y = date.getFullYear(), m = date.getMonth() + 1, d = date.getDate(), n = dayNum(y, m, d);
    if ((m === 12 && d >= 31) || (m === 1 && d <= 2)) return 'newyear';
    var t = dayNum(y, 11, thanksgiving(y));
    if (n >= t && n <= t + 3) return 'thanksgiving';   // before Christmas: in 2030 the weekend runs into Dec 1
    if (m === 12 && d <= 26) return 'christmas';
    if (m === 2 && (d === 13 || d === 14)) return 'valentines';
    if (m === 3 && d === 17) return 'stpatricks';
    if (m === 7 && d >= 3 && d <= 5) return 'july4';
    if (m === 10 && d >= 25) return 'halloween';
    var e = easter(y), en = dayNum(y, e[0], e[1]);
    if (n >= en - 2 && n <= en + 1) return 'easter';
    return null;
  }

  if (typeof module !== 'undefined' && module.exports) { module.exports = { pickHoliday: pickHoliday, easter: easter, thanksgiving: thanksgiving, NAMES: NAMES }; return; }
  if (typeof document === 'undefined') return;

  var q = /[?&]holiday=([a-z0-9]+)/.exec(location.search), pick = q ? q[1] : null, today;
  if (pick === 'none') today = null; else if (pick && NAMES.indexOf(pick) >= 0) today = pick; else today = pickHoliday(new Date());
  if (!today) return;
  document.documentElement.dataset.holiday = today;

  var NS = 'http://www.w3.org/2000/svg', reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function mk(n, a, p) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }

  var CSS = '@media (prefers-reduced-motion: no-preference){' +
    '.hd-leaf>g{animation:hd-fall var(--dur) linear var(--del) infinite;opacity:0}' +
    '.hd-leaf>g>g{animation:hd-sway calc(var(--dur) / 5) ease-in-out var(--del) infinite alternate}}' +
    '@keyframes hd-fall{0%{transform:translate(var(--sx),-215px);opacity:0}8%{opacity:1}86%{transform:translate(0,0);opacity:1}96%{transform:translate(0,0);opacity:1}100%{transform:translate(0,0);opacity:0}}' +
    '@keyframes hd-sway{from{transform:translateX(-14px) rotate(-35deg)}to{transform:translateX(14px) rotate(40deg)}}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  /* ---- Thanksgiving ---- */
  var LEAF = 'M0 -9 C6 -7 8 0 0 9 C-8 0 -6 -7 0 -9 Z', LC = ['#C2571A', '#D98A1F', '#A63D1B', '#E0A82E', '#8C4A1E'];
  function leg(p, scale) {   // a turkey leg in the sandwich's own space (about 28 wide, 18 tall): meat bulb, shank, bone
    var l = mk('g', { 'data-hd': 1, transform: 'rotate(-18) scale(' + (scale || 1) + ')' }, p);
    mk('path', { d: 'M2 -3 L13 -1.4 L13 2.4 L2 4 Z', fill: '#B5651D' }, l);
    mk('ellipse', { cx: -4.5, cy: 0, rx: 10, ry: 8, fill: '#B5651D' }, l);
    mk('path', { d: 'M-12 -3 Q-8 -8 -2 -7.4 Q-7 -5 -8 -1 Z', fill: '#D98A3D' }, l);
    mk('path', { d: 'M-9 4.6 Q-3 7.6 3 5', fill: 'none', stroke: '#8C4A1E', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, l);
    mk('rect', { x: 12, y: -1.2, width: 6, height: 3.4, rx: 1.6, fill: '#F3E9D2' }, l);
    mk('circle', { cx: 18.4, cy: -1.6, r: 2.4, fill: '#F3E9D2' }, l);
    mk('circle', { cx: 18.4, cy: 2.6, r: 2.4, fill: '#F3E9D2' }, l);
    return l;
  }
  function pumpkin(parent, x, y) {
    var p = mk('g', { 'data-hd': 1, transform: 'translate(' + x + ' ' + y + ')' }, parent);
    mk('ellipse', { cx: 1, cy: 1, rx: 17, ry: 4, fill: '#000', opacity: .18 }, p);
    mk('ellipse', { cx: -7, cy: -9, rx: 9, ry: 10, fill: '#D9731A' }, p);
    mk('ellipse', { cx: 7, cy: -9, rx: 9, ry: 10, fill: '#D9731A' }, p);
    mk('ellipse', { cx: 0, cy: -9, rx: 8, ry: 11, fill: '#EE8A2B' }, p);
    mk('path', { d: 'M0 -19 V0 M-8 -17 Q-12 -9 -8 -1 M8 -17 Q12 -9 8 -1', fill: 'none', stroke: '#B85A10', 'stroke-width': 1.3, 'stroke-linecap': 'round' }, p);
    mk('path', { d: 'M-1 -19 Q-1 -24 3 -26 L5 -24 Q2 -22 2 -19 Z', fill: '#5E7B2E' }, p);
    return p;
  }
  function dressFooter(s) {
    if (today !== 'thanksgiving' || s.querySelector('[data-hd]')) return;
    var sw = s.querySelector('#o-sw'), art = s.querySelector('#o-swart');
    if (sw) {   // the sandwich becomes a turkey leg (its group keeps its own motion, and the pigeon still steals it)
      var rot = sw.querySelector(':scope > g');
      if (rot) { for (var i = 0; i < rot.children.length; i++) { var c = rot.children[i]; if (!/^animate/.test(c.localName)) c.style.display = 'none'; } leg(rot, 1.4); }
    }
    if (art) { for (var j = art.children.length - 1; j >= 0; j--) art.removeChild(art.children[j]); leg(art, 1.7); }
    var bar = s.querySelector('#o-bar'); if (bar && bar.parentNode) { var pk = pumpkin(s, 722, 214); bar.parentNode.insertBefore(pk, bar); }
    var fx = mk('g', { 'data-hd': 1, 'pointer-events': 'none', class: 'hd-leaves' }, s);
    var rest = [[-60, 222], [150, 232], [330, 226], [470, 238], [650, 230], [790, 224], [20, 236], [250, 220], [590, 240], [850, 232]];
    rest.forEach(function (r, i) {
      var o = mk('g', { class: 'hd-leaf', transform: 'translate(' + r[0] + ' ' + r[1] + ')' }, fx);
      var a = mk('g', { style: '--sx:' + ((i % 2 ? 1 : -1) * (20 + i * 4)) + 'px;--dur:' + (9 + (i * 7) % 6) + 's;--del:-' + ((i * 2.3) % 9).toFixed(1) + 's' }, o);
      var b = mk('g', {}, a);
      mk('path', { d: LEAF, fill: LC[i % LC.length], transform: 'rotate(' + (i * 47 % 360) + ') scale(1.35)' }, b);
      mk('path', { d: 'M0 -7 V8', stroke: '#6B3410', 'stroke-width': .8, fill: 'none', transform: 'rotate(' + (i * 47 % 360) + ') scale(1.35)' }, b);
    });
  }

  function dress(s) { dressFooter(s); }
  function watch() {
    var box = document.querySelector('.foot-scene'); if (!box) return;
    var s = box.querySelector('svg'); if (s) return dress(s);
    var mo = new MutationObserver(function () { var v = box.querySelector('svg'); if (v) { mo.disconnect(); dress(v); } });
    mo.observe(box, { childList: true });
  }
  g.__holiday = { today: today };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})(typeof window !== 'undefined' ? window : globalThis);
