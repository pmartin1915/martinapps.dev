/* The Builder, lite: one small JS rig for the Builder in any SVG (back-to-top, coming-soon tile, per-app scenes, about page).
   Canonical source: brand/mascot/lite/builder-lite.js; copy to martinapps-site/assets/ with brand/mascot/lite/sync.mjs, never edit the copy.
   Same proportions as the header Builder and the footer scene: 0.88 scale, upper arm 37, forearm 33, thigh 37, shin 35,
   round-capped strokes, black head, yellow hard hat. Tests: node brand/mascot/lite/test/core.test.js.

   var b = BuilderLite.create(svgGroup);
   b.pose({ hip:[x,y], sh:[x,y], head:[x,y], tilt:deg, ff:[x,y], fb:[x,y], h1:[x,y], h2:[x,y], bow:[x,y], shadow:rx })
     h1 = near hand, h2 = far hand, ff/fb = front/back foot, all in the group's own units (y down, he faces +x).
   Elbows bend back-and-down, knees forward (never the other way round); a hand or foot that is out of reach is pulled
   in to the end of the limb, so a limb is never drawn longer than it is.

   Arms by joint angle (opt-in, for new scenes): an arm is { a, f }: a = upper-arm angle from straight down (deg,
   + = forward), f = elbow flex (deg, 0 = straight, only ever bends forward). fk(sh, A) gives the elbow and hand,
   solve(sh, hand) gives the anatomical A that reaches a point, mixA() blends two arms in angle space (hands travel on
   arcs, the elbow never snaps), swing() is a relaxed walking arm, grip() places a held prop across the fist.
   Pass the result as pose({ ..., A1: arm, A2: arm }) instead of h1 / h2. */
(function (g) {
  var NS = 'http://www.w3.org/2000/svg', S = .88, UA = 37, FA = 33, TH = 37, SH = 35, INK = '#1A1A1A', HAT = '#F5B800';
  function el(n, a, p) { var e = document.createElementNS(NS, n); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function f1(v) { return (Math.round(v * 10) / 10); }
  // two-bone IK: the joint between p and q for limb lengths l1, l2; bend = +1 / -1 picks the side
  function ik(p, q, l1, l2, bend) {
    var dx = q[0] - p[0], dy = q[1] - p[1], dist = Math.max(Math.hypot(dx, dy), .01), d = Math.min(dist, l1 + l2 - .01);
    var a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(l1 * l1 - a * a, 0)), ux = dx / dist, uy = dy / dist;
    return [p[0] + a * ux - bend * h * uy, p[1] + a * uy + bend * h * ux];
  }
  function reach(p, q, r) { var dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy); return d <= r ? q : [p[0] + dx * r / d, p[1] + dy * r / d]; }
  function setL(e, a, b) { e.setAttribute('x1', f1(a[0])); e.setAttribute('y1', f1(a[1])); e.setAttribute('x2', f1(b[0])); e.setAttribute('y2', f1(b[1])); }

  // ---- arms by joint angle (see header). Degrees; a from straight down, + forward; f elbow flex >= 0.
  var RD = Math.PI / 180;
  function fk(s, A) {
    var e = [s[0] + UA * Math.sin(A.a * RD), s[1] + UA * Math.cos(A.a * RD)], b = (A.a + A.f) * RD;
    return { a: A.a, f: A.f, w: A.w || 0, e: e, h: [e[0] + FA * Math.sin(b), e[1] + FA * Math.cos(b)] };
  }
  function solve(s, q, w) {   // the arm (flex >= 0) whose hand lands on q, or as near as the limb reaches
    var dx = q[0] - s[0], dy = q[1] - s[1], d = Math.min(Math.max(Math.hypot(dx, dy), UA - FA + .01), UA + FA - .01);
    var base = Math.atan2(dx, dy) / RD, al = Math.acos((UA * UA + d * d - FA * FA) / (2 * UA * d)) / RD;
    var inner = Math.acos((UA * UA + FA * FA - d * d) / (2 * UA * FA)) / RD;
    return { a: base - al, f: 180 - inner, w: w || 0 };
  }
  function wrapD(d) { return d - 360 * Math.round(d / 360); }
  // tuck (deg) folds the elbow extra in the middle of a blend, so a hand travelling far stays near the body instead of
  // sweeping out at arm's length (the stiff "zombie reach")
  // lead > 0 makes the elbow fold early (lifting), lead < 0 makes it unfold late (lowering)
  function mixA(A, Bq, u, tuck, lead) {
    var v = !lead ? u : lead > 0 ? 1 - Math.pow(1 - u, 1 + lead) : Math.pow(u, 1 - lead);
    return { a: A.a + wrapD(Bq.a - A.a) * u, f: Math.min(A.f + (Bq.f - A.f) * v + (tuck || 0) * Math.sin(Math.PI * u), 160), w: (A.w || 0) + ((Bq.w || 0) - (A.w || 0)) * u };
  }
  // relaxed walking arm: ph = leg phase in turns (0 = this arm fully back), amp = swing (deg); the elbow bends a little
  // more on the way forward and lags the shoulder (follow-through), so the forearm never moves as one stick with the upper arm
  function swing(ph, amp, rest) {
    var c = -Math.cos(2 * Math.PI * ph), lag = -Math.cos(2 * Math.PI * (ph - .1));
    return { a: (rest == null ? 4 : rest) + amp * c, f: 24 + 18 * (.5 + .5 * lag), w: 0 };
  }
  // a prop held across the fist: side = +1 handle out of the thumb side toward the front when the forearm hangs, -1 the other way;
  // A.w = wrist cock (deg). Returns the handle direction (deg, same convention as a) and the point len along it.
  function grip(K, len, side) { var ang = K.a + K.f + (side || 1) * 90 + (K.w || 0), r = ang * RD; return { ang: ang, end: [K.h[0] + len * Math.sin(r), K.h[1] + len * Math.cos(r)] }; }

  var B_last = null;
  function create(parent, opt) {
    // opt.ink / opt.outline recolour him for a dark background (a light body, the hat keeps its yellow)
    var ink = (opt && opt.ink) || INK, outline = (opt && opt.outline) || INK;
    function line(p, w) { return el('line', { 'stroke': ink, 'stroke-width': w, 'stroke-linecap': 'round' }, p); }
    var root = el('g', {}, parent);
    var shadow = el('ellipse', { ry: 3, fill: '#000', 'fill-opacity': .22 }, root);
    var far = [line(root, 7), line(root, 6)], bleg = [line(root, 7), line(root, 6), line(root, 7)];
    var spine = el('path', { fill: 'none', stroke: ink, 'stroke-width': 7, 'stroke-linecap': 'round' }, root);
    var fleg = [line(root, 7), line(root, 6), line(root, 7)];
    var head = el('g', {}, root);
    el('circle', { r: 15, fill: ink }, head);
    var hat = el('g', { transform: 'scale(' + S + ') translate(0 170)' }, head);
    el('path', { d: 'M-19 -178 A19 19 0 0 1 19 -178 Z', fill: HAT, stroke: outline, 'stroke-width': 3, 'stroke-linejoin': 'round' }, hat);
    el('rect', { x: -21, y: -180, width: 49, height: 6, rx: 3, fill: HAT, stroke: outline, 'stroke-width': 3 }, hat);
    var near = [line(root, 7), line(root, 6)];
    var api = { root: root, el: el, ik: ik };
    api.behind = function (e) { root.insertBefore(e, bleg[0]); return e; };   // a prop held in the far hand: in front of that arm, behind the body
    api.pose = function (P) {
      var hip = P.hip, sh = P.sh, bow = P.bow || [0, 0];
      shadow.setAttribute('cx', f1(P.shadowX == null ? (P.ff[0] + P.fb[0]) / 2 : P.shadowX)); shadow.setAttribute('cy', f1(P.ground == null ? Math.max(P.ff[1], P.fb[1]) + 1.5 : P.ground));
      shadow.setAttribute('rx', P.shadow || 36);
      var s2 = P.sa || sh, K2 = P.A2 && fk(s2, P.A2), h2 = K2 ? K2.h : reach(s2, P.h2, UA + FA - 1), e2 = K2 ? K2.e : ik(s2, h2, UA, FA, 1);
      setL(far[0], s2, e2); setL(far[1], e2, h2);
      var fb = reach(hip, P.fb, TH + SH - 1), kb = ik(hip, fb, TH, SH, -1);
      setL(bleg[0], hip, kb); setL(bleg[1], kb, fb); setL(bleg[2], fb, [fb[0] + 11, fb[1]]);
      spine.setAttribute('d', 'M' + f1(hip[0]) + ' ' + f1(hip[1]) + ' Q' + f1((hip[0] + sh[0]) / 2 + bow[0]) + ' ' + f1((hip[1] + sh[1]) / 2 + bow[1]) + ' ' + f1(sh[0]) + ' ' + f1(sh[1]));
      var ff = reach(hip, P.ff, TH + SH - 1), kf = ik(hip, ff, TH, SH, -1);
      setL(fleg[0], hip, kf); setL(fleg[1], kf, ff); setL(fleg[2], ff, [ff[0] + 11, ff[1]]);
      head.setAttribute('transform', 'translate(' + f1(P.head[0]) + ' ' + f1(P.head[1]) + ') rotate(' + f1(P.tilt || 0) + ')');
      var K1 = P.A1 && fk(s2, P.A1), h1 = K1 ? K1.h : reach(s2, P.h1, UA + FA - 1), e1 = K1 ? K1.e : ik(s2, h1, UA, FA, 1);
      setL(near[0], s2, e1); setL(near[1], e1, h1);
      var D = function (a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); };
      api.lens = { ua: D(s2, e1), fa: D(e1, h1), ua2: D(s2, e2), fa2: D(e2, h2), thF: D(hip, kf), shF: D(kf, ff), thB: D(hip, kb), shB: D(kb, fb),
        reachMissH1: P.h1 ? D(h1, P.h1) : 0, reachMissH2: P.h2 ? D(h2, P.h2) : 0, reachMissFF: D(ff, P.ff), reachMissFB: D(fb, P.fb), ffX: ff[0], fbX: fb[0], ffY: ff[1], fbY: fb[1], lean: Math.atan2(sh[0] - hip[0], hip[1] - sh[1]) * 180 / Math.PI, torso: D(hip, sh), headGap: D(sh, P.head), hipH: Math.max(ff[1], fb[1]) - hip[1], tilt: P.tilt || 0, h1x: h1[0], h1y: h1[1], e1x: e1[0], e1y: e1[1], hipX: hip[0], hipY: hip[1], sx: s2[0], sy: s2[1], e2x: e2[0], e2y: e2[1], h2x: h2[0], h2y: h2[1], headX: P.head[0], headY: P.head[1] };
      B_last = api;
      return { h1: h1, h2: h2, e1: e1, e2: e2, k1: K1, k2: K2 };   // where the hands really are (after the reach limit), for props
    };
    return api;
  }
  // easing helpers shared by the scenes
  function ease(u) { u = Math.min(Math.max(u, 0), 1); return u * u * (3 - 2 * u); }
  function win(t, a, b, c, d) { return ease((t - a) / (b - a)) - ease((t - c) / (d - c)); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function lerp2(a, b, u) { return [lerp(a[0], b[0], u), lerp(a[1], b[1], u)]; }
  // play a pose function only while its element is on screen; reduced motion draws one still frame
  function play(svg, draw, opt) {
    opt = opt || {};
    var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (/[?&]eyes=1/.test(location.search)) { draw(opt.still == null ? 0 : opt.still); return { stop: function () {} }; }   // review harness: it drives time itself
    if (reduce || !('IntersectionObserver' in window)) { draw(opt.still == null ? 0 : opt.still); return { stop: function () {} }; }
    var raf = 0, t0 = 0, on = false, loop = opt.loop || 0, io;
    function tick(ts) { if (!on) return; if (!t0) t0 = ts; var t = (ts - t0) / 1000; if (loop) t = t % loop; draw(t); raf = requestAnimationFrame(tick); }
    // start only on a false -> true change: the observer also fires when the ratio crosses its threshold while still intersecting
    io = new IntersectionObserver(function (e) { var now = e[0].isIntersecting; if (now === on) return; on = now; if (on) { t0 = 0; raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf); }, { threshold: 0 });
    io.observe(svg);
    draw(opt.still == null ? 0 : opt.still);
    return { stop: function () { on = false; cancelAnimationFrame(raf); io.disconnect(); } };
  }
  g.BuilderLite = { scenes: {}, probe: function () { return B_last ? B_last.lens : null; }, create: create, ik: ik, reach: reach, fk: fk, solve: solve, mixA: mixA, swing: swing, grip: grip, UA: UA, FA: FA, ease: ease, win: win, lerp: lerp, lerp2: lerp2, play: play, el: el };
})(window);
