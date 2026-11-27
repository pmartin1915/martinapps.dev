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
    '@keyframes hd-fall{0%{transform:translate(var(--sx),var(--sy,-215px));opacity:0}8%{opacity:1}86%{transform:translate(0,0);opacity:1}96%{transform:translate(0,0);opacity:1}100%{transform:translate(0,0);opacity:0}}' +
    '@media (prefers-reduced-motion: no-preference){.hd-bob{animation:hd-bob 2.6s ease-in-out infinite alternate}.hd-blink{animation:hd-blink 1.3s steps(1) infinite}.hd-blink2{animation:hd-blink 1.3s steps(1) -.65s infinite}' +
    '.hd-burst>g{animation:hd-burst 3.6s ease-out var(--del) infinite;opacity:0}.hd-fly{animation:hd-fly 11s linear var(--del) infinite}.hd-flap{animation:hd-flap .32s ease-in-out infinite alternate}}' +
    '@keyframes hd-bob{to{transform:translateY(-7px)}}@keyframes hd-blink{50%{opacity:.25}}' +
    '@keyframes hd-burst{0%{transform:scale(.1);opacity:0}8%{opacity:1}55%{transform:scale(1);opacity:1}85%{transform:scale(1.12);opacity:0}100%{opacity:0}}' +
    '@keyframes hd-fly{from{transform:translateX(-80px)}to{transform:translateX(1060px)}}@keyframes hd-flap{to{transform:scaleY(.45)}}' +
    '.hd-burst.hd-still>g{opacity:.9;transform:scale(.8)}' +
    '@keyframes hd-sway{from{transform:translateX(-14px) rotate(-35deg)}to{transform:translateX(14px) rotate(40deg)}}';
  var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);

  /* ---- Thanksgiving ---- */
  var LEAF = 'M0 -9 C6 -7 8 0 0 9 C-8 0 -6 -7 0 -9 Z', LC = ['#C2571A', '#D98A1F', '#A63D1B', '#E0A82E', '#8C4A1E'];
  function leg(p, scale, ang, at) {   // a turkey leg gripped at the shank (the origin), meat toward -x, bone toward +x; ang turns it (the held one is also under the sandwich group's own -22 deg)
    var l = mk('g', { 'data-hd': 1, transform: (at ? 'translate(' + at + ') ' : '') + 'rotate(' + ang + ') scale(' + scale + ') translate(-8 0)' }, p);
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
  // held upright in his fist by the bone (knob below the hand), meat up toward his mouth; under the sandwich group's own -22 deg
  var LEG = { s: 1.1, a: 137, at: '2.3 6.3' };
  function thanksgivingFooter(s) {
    var sw = s.querySelector('#o-sw'), art = s.querySelector('#o-swart');
    if (sw) {   // the sandwich becomes a turkey leg (its group keeps its own motion, and the pigeon still steals it)
      var rot = sw.querySelector(':scope > g');
      if (rot) { for (var i = 0; i < rot.children.length; i++) { var c = rot.children[i]; if (!/^animate/.test(c.localName)) c.style.display = 'none'; } leg(rot, LEG.s, LEG.a, LEG.at); }
    }
    if (art) { for (var j = art.children.length - 1; j >= 0; j--) art.removeChild(art.children[j]); leg(art, 2.1, LEG.a - 14); }   // the beak group turns -8 and the held one sits under -22: both read 100 deg on screen
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

  /* ---- shared pieces ---- */
  var INK2 = '#1A1A1A';
  function P(parent, d, fill, extra) { var a = { d: d, fill: fill }; for (var k in (extra || {})) a[k] = extra[k]; return mk('path', a, parent); }
  function OUT(w) { return { stroke: INK2, 'stroke-width': w || 2, 'stroke-linejoin': 'round' }; }
  var HEART = 'M0 7 C-12 -2 -7 -12 0 -5 C7 -12 12 -2 0 7 Z', CLOVER = 'M0 0 C-5 -7 -11 -3 -6 2 C-11 4 -6 10 0 4 C6 10 11 4 6 2 C11 -3 5 -7 0 0 Z';
  var CONF = 'M-3 -1.6 H3 V1.6 H-3 Z';

  // drifting things: items = [[restX, restY, shapePath, fill, scale]]; startY < 0 falls from the sky, > 0 rises to its rest spot
  function drift(s, items, startY, dur) {
    var fx = mk('g', { 'data-hd': 1, 'pointer-events': 'none' }, s);
    items.forEach(function (r, i) {
      var o = mk('g', { class: 'hd-leaf', transform: 'translate(' + r[0] + ' ' + r[1] + ')' }, fx);
      var a = mk('g', { style: '--sx:' + ((i % 2 ? 1 : -1) * (14 + i * 3)) + 'px;--sy:' + startY + 'px;--dur:' + ((dur || 9) + (i * 7) % 6) + 's;--del:-' + ((i * 2.3) % 9).toFixed(1) + 's' }, o);
      var b = mk('g', {}, a);
      mk('path', { d: r[2], fill: r[3], transform: 'rotate(' + (i * 47 % 360) + ') scale(' + (r[4] || 1) + ')' }, b);
    });
  }
  var FLAKE = 'M-3 0 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0';
  function rests(n, y0, y1) { var o = []; for (var i = 0; i < n; i++) o.push([-90 + i * (950 / n) + (i * 37) % 40, y0 + (i * 53) % (y1 - y0)]); return o; }
  function mound(parent, x, y, w, fill) { return mk('ellipse', { cx: x, cy: y, rx: w, ry: w * .32, fill: fill }, parent); }

  function bulbs(parent, pts, cols) { pts.forEach(function (q, i) { mk('circle', { cx: q[0], cy: q[1], r: 3.2, fill: cols[i % cols.length], class: i % 2 ? 'hd-blink' : 'hd-blink2' }, parent); }); }
  function tree(parent, x, y) {
    var g = mk('g', { 'data-hd': 1, transform: 'translate(' + x + ' ' + y + ')' }, parent);
    mk('ellipse', { cx: 0, cy: 1, rx: 16, ry: 4, fill: '#000', opacity: .18 }, g);
    mk('rect', { x: -3, y: -8, width: 6, height: 9, fill: '#6B4423' }, g);
    P(g, 'M-17 -7 L0 -30 L17 -7 Z', '#2F7D4A', OUT(1.6)); P(g, 'M-14 -22 L0 -44 L14 -22 Z', '#3B9159', OUT(1.6)); P(g, 'M-10 -36 L0 -54 L10 -36 Z', '#46A367', OUT(1.6));
    P(g, 'M0 -62 L2 -57 L7 -57 L3 -54 L5 -49 L0 -52 L-5 -49 L-3 -54 L-7 -57 L-2 -57 Z', '#F5C518', { stroke: '#B8860B', 'stroke-width': .8 });
    bulbs(g, [[-6, -14], [7, -17], [-3, -28], [6, -33], [0, -44], [-4, -40]], ['#E8453C', '#F5C518', '#3C8DDE', '#F28AC0']);
    return g;
  }
  function jack(parent, x, y) {
    var g = pumpkin(parent, x, y);
    P(g, 'M-9 -14 L-4 -14 L-6.5 -9.5 Z M4 -14 L9 -14 L6.5 -9.5 Z', '#FFE066');
    P(g, 'M-8 -5 L-4 -7.5 L0 -5.5 L4 -7.5 L8 -5 L5 -2 L0 -4 L-5 -2 Z', '#FFE066');
    return g;
  }
  var BAT = 'M0 0 C-3 -5 -8 -5 -14 -2 C-11 -1 -10 1 -9 3 C-7 1 -4 2 -2 5 C-1 3 1 3 2 5 C4 2 7 1 9 3 C10 1 11 -1 14 -2 C8 -5 3 -5 0 0 Z';
  function burst(parent, x, y, col, del) {
    var o = mk('g', { class: 'hd-burst' + (reduce ? ' hd-still' : ''), transform: 'translate(' + x + ' ' + y + ')' }, parent), a = mk('g', { style: '--del:' + del + 's' }, o);
    for (var i = 0; i < 12; i++) {
      var r = i * 30 * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r);
      mk('line', { x1: (7 * c).toFixed(1), y1: (7 * sn).toFixed(1), x2: (24 * c).toFixed(1), y2: (24 * sn).toFixed(1), stroke: col, 'stroke-width': 2.4, 'stroke-linecap': 'round' }, a);
      mk('circle', { cx: (31 * c).toFixed(1), cy: (31 * sn).toFixed(1), r: 2, fill: i % 2 ? '#F5C518' : col }, a);
    }
  }
  function balloon(parent, x, y, col, ty) {
    var o = mk('g', { 'data-hd': 1, transform: 'translate(' + x + ' ' + y + ')' }, parent), b = mk('g', { class: 'hd-bob', style: 'animation-delay:-' + (x % 3) + 's' }, o);
    mk('path', { d: 'M0 12 C2 26 -3 38 1 ' + ty, fill: 'none', stroke: '#8A8A8A', 'stroke-width': 1 }, b);
    mk('ellipse', { cx: 0, cy: -2, rx: 11, ry: 14, fill: col, stroke: INK2, 'stroke-width': 1.6 }, b);
    mk('path', { d: 'M-3.5 12 L3.5 12 L0 16 Z', fill: col, stroke: INK2, 'stroke-width': 1.2 }, b);
    mk('ellipse', { cx: -4, cy: -8, rx: 2.4, ry: 4, fill: '#fff', opacity: .55 }, b);
  }
  function egg(parent, x, y, c1, c2) {
    var g = mk('g', { transform: 'translate(' + x + ' ' + y + ')' }, parent);
    mk('ellipse', { cx: 0, cy: 1, rx: 8, ry: 2.4, fill: '#000', opacity: .18 }, g);
    P(g, 'M0 -17 C8 -17 10 -6 10 -3 C10 2 6 3 0 3 C-6 3 -10 2 -10 -3 C-10 -6 -8 -17 0 -17 Z', c1, OUT(1.6));
    P(g, 'M-9.6 -6 Q-5 -9 0 -6 T9.6 -6 V-2 Q5 -5 0 -2 T-9.6 -2 Z', c2);
  }
  function potOfGold(parent, x, y) {
    var g = mk('g', { transform: 'translate(' + x + ' ' + y + ')' }, parent);
    mk('ellipse', { cx: 0, cy: 1, rx: 17, ry: 4, fill: '#000', opacity: .18 }, g);
    [-9, -3, 4, 9, 0].forEach(function (c, i) { mk('ellipse', { cx: c, cy: -15 - (i === 4 ? 4 : 0), rx: 5, ry: 3, fill: '#F5C518', stroke: '#B8860B', 'stroke-width': 1 }, g); });
    P(g, 'M-15 -14 Q-17 2 -9 2 H9 Q17 2 15 -14 Z', '#2B2B30', OUT(1.4)); mk('rect', { x: -16, y: -16, width: 32, height: 4, rx: 2, fill: '#3A3A42', stroke: INK2, 'stroke-width': 1.2 }, g);
  }
  function beforeBar(s, el) { var bar = s.querySelector('#o-bar'); if (bar && bar.parentNode) bar.parentNode.insertBefore(el, bar); else s.appendChild(el); }

  /* ---- footer scene, per holiday ---- */
  var FOOT = {
    thanksgiving: thanksgivingFooter,
    christmas: function (s) {
      beforeBar(s, tree(s, 722, 214));
      var str = mk('g', { 'data-hd': 1 }, s);   // a lit string between the two standing cones
      mk('path', { d: 'M273 169 Q330 200 387 167', fill: 'none', stroke: '#2F7D4A', 'stroke-width': 1.8 }, str);
      bulbs(str, [[291, 183], [310, 192], [330, 195], [350, 192], [369, 183]], ['#E8453C', '#F5C518', '#3C8DDE', '#7BD36B', '#F28AC0']);
      drift(s, rests(16, 215, 240).map(function (r) { return [r[0], r[1], FLAKE, '#FFFFFF', 1.1]; }), -230, 11);
    },
    newyear: function (s) {
      var b = mk('g', { 'data-hd': 1 }, s);
      balloon(b, 706, 118, '#7B52D6', 88); balloon(b, 726, 104, '#F5C518', 108); balloon(b, 746, 122, '#E0436B', 90);
      var C = ['#E8453C', '#F5C518', '#3C8DDE', '#7BD36B', '#F28AC0', '#7B52D6'];
      drift(s, rests(18, 215, 240).map(function (r, i) { return [r[0], r[1], CONF, C[i % C.length], 1.2]; }), -230, 10);
    },
    halloween: function (s) {
      beforeBar(s, jack(s, 722, 214));
      var fx = mk('g', { 'data-hd': 1, 'pointer-events': 'none' }, s);
      [[60, 44, 0], [-180, 78, -5], [-500, 30, -8]].forEach(function (b, i) {
        var o = mk('g', { transform: 'translate(0 ' + b[1] + ')' }, fx), f = mk('g', { class: 'hd-fly', style: '--del:' + b[2] + 's' }, o);
        var w = mk('g', { transform: 'translate(' + (reduce ? 200 + i * 260 : 0) + ' 0)' }, f), a = mk('g', { class: 'hd-flap' }, w);
        P(a, BAT, '#2B2233', { transform: 'scale(2.2)' });
      });
    },
    july4: function (s) {
      var fx = mk('g', { 'data-hd': 1, 'pointer-events': 'none' }, s);
      burst(fx, 140, 62, '#D6342C', 0); burst(fx, 420, 40, '#2F6FD6', -1.2); burst(fx, 690, 70, '#D6342C', -2.4); burst(fx, 820, 34, '#2F6FD6', -3);
    },
    valentines: function (s) {
      var b = mk('g', { 'data-hd': 1 }, s); balloon(b, 724, 108, '#E0436B', 100);
      drift(s, rests(10, 50, 170).map(function (r, i) { return [r[0], r[1], HEART, i % 3 ? '#E0436B' : '#F28AA8', .95]; }), 120, 8);
    },
    stpatricks: function (s) {
      var g = mk('g', { 'data-hd': 1 }, s); potOfGold(g, 722, 214); beforeBar(s, g);
      drift(s, rests(11, 215, 240).map(function (r, i) { return [r[0], r[1], CLOVER, i % 2 ? '#2F9E57' : '#52B66E', .85]; }), -230, 10);
    },
    easter: function (s) {
      var g = mk('g', { 'data-hd': 1 }, s);
      egg(g, 250, 232, '#F28AC0', '#FFF'); egg(g, 330, 226, '#7BD3E0', '#F5C518'); egg(g, 560, 236, '#B49AF0', '#FFF'); egg(g, 740, 232, '#F5C518', '#E8453C'); egg(g, 830, 224, '#7BD36B', '#FFF');
    }
  };
  function dressFooter(s) { if (!s.querySelector('[data-hd]') && FOOT[today]) FOOT[today](s); }

  /* ---- hats: every Builder (footer scene, header, 404, product and about scenes, back-to-top) wears the day's hat ---- */
  var HAT = {
    thanksgiving: function (h) { P(h, LEAF, '#D9731A', { transform: 'translate(-9 -187) rotate(-35) scale(.9)', stroke: INK2, 'stroke-width': 1 }); },
    christmas: function (h) {
      P(h, 'M-20 -178 C-20 -204 -4 -218 14 -214 C24 -212 32 -204 34 -190 C27 -200 18 -200 10 -196 C14 -190 18 -184 19 -178 Z', '#D6342C', OUT(2));
      mk('rect', { x: -22, y: -185, width: 46, height: 9, rx: 4.5, fill: '#F6F3EE', stroke: INK2, 'stroke-width': 2 }, h);
      mk('circle', { cx: 34, cy: -188, r: 6, fill: '#F6F3EE', stroke: INK2, 'stroke-width': 2 }, h);
    },
    newyear: function (h) {
      var g = mk('g', { transform: 'rotate(12 0 -196)' }, h);
      P(g, 'M-11 -196 L11 -196 L0 -228 Z', '#7B52D6', OUT(2));
      mk('circle', { cx: -1, cy: -208, r: 2.2, fill: '#F5C518' }, g); mk('circle', { cx: 3, cy: -200, r: 2.2, fill: '#F28AC0' }, g); mk('circle', { cx: -4, cy: -199, r: 2, fill: '#7BD3E0' }, g);
      mk('circle', { cx: 0, cy: -230, r: 4.4, fill: '#F5C518', stroke: INK2, 'stroke-width': 1.6 }, g);
    },
    halloween: function (h) {
      mk('ellipse', { cx: 2, cy: -196, rx: 25, ry: 5, fill: '#2B2233', stroke: INK2, 'stroke-width': 2 }, h);
      P(h, 'M-12 -196 C-8 -214 -2 -224 8 -236 C8 -226 12 -216 12 -196 Z', '#2B2233', OUT(2));
      mk('rect', { x: -12, y: -204, width: 24, height: 6, fill: '#E8841A', stroke: INK2, 'stroke-width': 1.6 }, h);
    },
    july4: function (h) {
      mk('line', { x1: 3, y1: -196, x2: 3, y2: -230, stroke: INK2, 'stroke-width': 2, 'stroke-linecap': 'round' }, h);
      mk('rect', { x: 3, y: -230, width: 24, height: 14, fill: '#D6342C', stroke: INK2, 'stroke-width': 1.6 }, h);
      mk('rect', { x: 4, y: -226.5, width: 22, height: 3, fill: '#fff' }, h); mk('rect', { x: 4, y: -220, width: 22, height: 3, fill: '#fff' }, h);
      mk('rect', { x: 3, y: -230, width: 10, height: 7.5, fill: '#2F6FD6', stroke: INK2, 'stroke-width': 1.2 }, h);
    },
    valentines: function (h) { P(h, 'M0 -192 C-15 -202 -9 -217 0 -209 C9 -217 15 -202 0 -192 Z', '#E0436B', OUT(2)); },
    stpatricks: function (h) {
      for (var i = 0; i < h.children.length; i++) if (h.children[i].getAttribute('fill') === '#F5B800') h.children[i].setAttribute('fill', '#2F9E57');
      [[0, -199], [-5.5, -191], [5.5, -191]].forEach(function (c) { mk('circle', { cx: c[0], cy: c[1], r: 4.4, fill: '#E8F7E4', stroke: INK2, 'stroke-width': 1.2 }, h); });
      mk('line', { x1: 0, y1: -190, x2: -2, y2: -182, stroke: '#E8F7E4', 'stroke-width': 1.6, 'stroke-linecap': 'round' }, h);
    },
    easter: function (h) {
      [[-6, -14], [8, 16]].forEach(function (e) {
        var g = mk('g', { transform: 'translate(' + e[0] + ' -196) rotate(' + e[1] + ')' }, h);
        mk('ellipse', { cx: 0, cy: -12, rx: 5.4, ry: 14, fill: '#F7F1EA', stroke: INK2, 'stroke-width': 2 }, g); mk('ellipse', { cx: 0, cy: -11, rx: 2.4, ry: 9, fill: '#F2A7B8' }, g);
      });
    }
  };
  function hats(root) {
    var f = HAT[today]; if (!f) return;
    var ps = (root || document).querySelectorAll('path[d^="M-19 -178"]');
    for (var i = 0; i < ps.length; i++) { var h = ps[i].parentNode; if (h.getAttribute('data-hd')) continue; h.setAttribute('data-hd', 1); f(h); }
  }
  if (window.BuilderLite && BuilderLite.create) {   // scenes that build a Builder later (product pages, back-to-top) get the hat as they make him
    var mkB = BuilderLite.create;
    BuilderLite.create = function () { var r = mkB.apply(this, arguments); hats(r.root); return r; };
  }

  function dress(s, isFoot) { if (isFoot) dressFooter(s); hats(s); }
  function watch() {
    hats(document);
    var box = document.querySelector('.foot-scene') || document.querySelector('.nf-scene'); if (!box) return;
    var foot = box.classList.contains('foot-scene'), s = box.querySelector('svg'); if (s) return dress(s, foot);
    var mo = new MutationObserver(function () { var v = box.querySelector('svg'); if (v) { mo.disconnect(); dress(v, foot); } });
    mo.observe(box, { childList: true });
  }
  g.__holiday = { today: today };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch); else watch();
})(typeof window !== 'undefined' ? window : globalThis);
