/* About page: the founder's photo hangs a little crooked. The Builder walks in, raises his hammer overhead and taps its raised right edge level (two blows), steps back, tips his hat, turns round and walks back out the way he came.
   Markup: <div class="founder-row has-scene"><img ...><p>..</p></div> followed by <svg class="frame-stage" viewBox="0 0 300 116" aria-hidden="true"></svg>.
   The svg's top edge is the photo's bottom edge. Needs builder-lite.js first. Canonical source: brand/mascot/lite/about-frame.js (sync.mjs copies it to the site).
   Arms are joint angles (BuilderLite.fk/solve/mixA): keys blend in angle space, the strike is solved so the hammer face meets the photo's edge.
   Plays once when the stage scrolls into view, then holds. Reduced motion: the photo is simply level and he stands there. */
(function () {
  if (!window.BuilderLite) return;
  var B = window.BuilderLite, svg = document.querySelector('svg.frame-stage'), img = document.querySelector('.founder-row.has-scene img');
  if (!svg || !img) return;
  svg.style.visibility = 'visible';
  var K = .62, W = 300, GY = 112, gy = GY / K, XO = W;                       // the figure faces screen-left: group = translate(XO,0) scale(-K,K), local u = (XO - X) / K
  var T_WALK = 3.33, T_CLOSE = .5, T_STAND = T_WALK + T_CLOSE, CYC = 80, A = 20;   // 5 cycles of 80 units; stride half-length 20
  var HIT = [4.75, 5.55], TILT0 = -5, TAPS = [2.8, 2.2];                    // the photo starts 5 deg crooked; each tap swings it back by this much
  var ZETA = .2, OMEGA = 13;
  var T_TURN = 9.35, T_OUT = 9.65, OUT_CYC = 4, T_END = T_OUT + OUT_CYC * T_WALK / 5;   // turn round (cartoon flip about the hips), then 4 strides off stage right

  B.el('line', { x1: 0, x2: W, y1: GY + 1.5, y2: GY + 1.5, stroke: '#1A1A1A', 'stroke-opacity': .12, 'stroke-width': 1.5 }, svg);
  var spark = B.el('path', { d: 'M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z', fill: '#F5B800', opacity: 0 }, svg);
  var g = B.el('g', { transform: 'translate(' + XO + ' 0) scale(' + (-K) + ' ' + K + ')' }, svg), who = B.create(g);
  var hammer = who.behind(B.el('g', {})), hh = B.el('line', { stroke: '#7A5A2E', 'stroke-width': 4, 'stroke-linecap': 'round' }, hammer), hd = B.el('rect', { x: -3.5, y: -10, width: 7, height: 20, rx: 2, fill: '#555' }, hammer);

  var pw = 132, sc = 1;
  function measure() { pw = img.offsetWidth || 132; sc = (svg.getBoundingClientRect().width || W) / W; pw = pw / sc; }   // photo width in stage units
  measure(); window.addEventListener('resize', measure);

  function theta(t) {   // photo angle (deg): rest tilt plus a damped swing for each tap (a picture on a nail)
    var th = TILT0, wd = OMEGA * Math.sqrt(1 - ZETA * ZETA);
    for (var i = 0; i < HIT.length; i++) {
      var s = t - HIT[i]; if (s <= 0) continue;
      th += TAPS[i] * (1 - Math.exp(-ZETA * OMEGA * s) * (Math.cos(wd * s) + (ZETA * OMEGA / wd) * Math.sin(wd * s)));
    }
    return th;
  }
  function corner(th) {   // the tapped spot: the photo's right edge just above its (raised) lower corner, in stage units
    var r = th * Math.PI / 180, rx = pw / 2 + 1.5, ry = pw / 2 - 2, c = [pw / 2, -pw / 2];
    return [c[0] + rx * Math.cos(r) - ry * Math.sin(r), c[1] + rx * Math.sin(r) + ry * Math.cos(r)];
  }
  var KEYS = [[0, 'rest'], [T_STAND, 'rest'], [4.5, 'wind'], [HIT[0], 'hit'], [4.97, 'reb'], [5.3, 'wind'], [HIT[1], 'hit'], [5.8, 'reb'], [6.35, 'rest'], [99, 'rest']];
  // a normal grip: the handle leaves the thumb side of the fist, so the head is carried forward and rides on top when the arm is up
  var H_HIT = 200, GRIP = 1, HL = 19, FACE = 10, REACH = 40;   // handle angle at contact (deg from down; 200 = up, tipped back a little), grip side, handle, head half-length, shoulder-to-edge distance
  var REST = { a: 14, f: 44, w: -20 };                         // hammer carried head forward
  function strike(sa, tap) {   // the arm that puts the hammer's FRONT face on the photo's edge: a forward blow above his head
    var r = H_HIT * Math.PI / 180, d = [Math.sin(r), Math.cos(r)], fw = d[1] > 0 ? [d[1], -d[0]] : [-d[1], d[0]];
    var A = B.solve(sa, [tap[0] - HL * d[0] - FACE * fw[0], tap[1] - HL * d[1] - FACE * fw[1]]);
    A.w = H_HIT - (A.a + A.f) - GRIP * 90; A.w -= 360 * Math.round(A.w / 360); return A;
  }
  function armAt(t, sa, tap) {   // hammer arm: into a hit it accelerates, out of it it rebounds
    var hit = strike(sa, tap);
    var P = { rest: REST, wind: { a: hit.a + 8, f: hit.f + 42, w: hit.w + 55 }, hit: hit, reb: { a: hit.a - 6, f: hit.f + 14, w: hit.w + 22 } };   // wind = cocked back over the shoulder
    var i = 0; while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
    var k0 = KEYS[i], k1 = KEYS[i + 1], u = Math.min(Math.max((t - k0[0]) / (k1[0] - k0[0]), 0), 1), e;
    e = k1[1] === 'hit' ? u * u : (k0[1] === 'hit' ? 1 - (1 - u) * (1 - u) : B.ease(u));
    if (k0[1] === k1[1]) return P[k0[1]];   // holding a pose: no tuck, no drift
    return B.mixA(P[k0[1]], P[k1[1]], e, (k0[1] === 'rest' || k1[1] === 'rest') ? 30 : 0, k0[1] === 'rest' ? 1.5 : k1[1] === 'rest' ? -1.5 : 0);
  }
  function footOff(q) {
    q = q - Math.floor(q);
    if (q < .5) return [A - 80 * q, 0];                                          // stance: planted on the ground, slides back relative to the hip
    var s = (q - .5) / .5; return [-A + 2 * A * B.ease(s), -9 * Math.sin(Math.PI * s)];   // swing: forward with a lift
  }
  // The walk from the stickman workshop (brand/mascot/workshop, rounds 2, 5 and 7): heel-to-toe roll, the swing foot leaving and
  // landing at ground speed, pelvis and shoulders turning against each other, and a head that rides steadier than the body.
  // footRoll returns [x, y, pitch]; the scene blends it in and out with the walk (rw), so the stops and starts stay as they were.
  var FL = 11, RA = .16, RB = .58, RHS = -16, RTO = 38;
  function herm(x0, x1, m0, m1, u) { var u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * x0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * x1 + (u3 - u2) * m1; }
  function stanceRoll(u) {
    var hx = A - 2 * A * u, th;
    if (u < RA) return [hx, 0, RHS * (1 - B.ease(u / RA))];                     // on the heel, toe coming down
    if (u < RB) return [hx, 0, 0];                                               // flat
    th = RTO * B.ease((u - RB) / (1 - RB)) * Math.PI / 180;                      // on the toe, heel rising
    return [hx + FL - FL * Math.cos(th), -FL * Math.sin(th), th * 180 / Math.PI];
  }
  function footRoll(q) {
    q = q - Math.floor(q);
    if (q < .5) return stanceRoll(q / .5);
    var w = (q - .5) / .5, A0 = stanceRoll(1), m = -2 * A, lift = 9;
    var y = herm(A0[1], 0, -lift * 1.6, lift * 1.4, w) - lift * Math.pow(Math.sin(Math.PI * w), 1.4);
    return [herm(A0[0], A, m, m, w), Math.min(y, 0), w < .55 ? RHS + (RTO - RHS) * (1 - B.ease(w / .55)) : RHS];
  }
  function foot(q, rw) { var a = footOff(q), b = footRoll(q); return [B.lerp(a[0], b[0], rw), B.lerp(a[1], b[1], rw), b[2] * rw]; }

  var handle = null;
  function hEnd() { var c0 = corner(TILT0); return (XO - c0[0]) / K - REACH - 2 - 22; }   // where his hips stop after the two steps back
  function draw(t) {
    var c0 = corner(TILT0), u1 = (XO - c0[0]) / K - REACH - 2, u0 = u1 - 5 * CYC,   // he stops one arm's reach from the photo's right edge
      hu, offA, offB, walkW = 0, fa, fb, rw = 0, pa = 0, pb = 0;
    var inWalk = t < T_WALK, p = Math.min(t, T_WALK) / T_WALK * 5;
    // --- where is the hip and where are the feet (local units, world)
    var stepBack = B.win(t, 6.4, 6.85, 99, 100), stepBack2 = B.win(t, 6.85, 7.3, 99, 100);
    var out = t > T_OUT, q = out ? Math.min(t - T_OUT, T_END - T_OUT) / (T_WALK / 5) : 0;   // strides walked on the way out
    if (inWalk) {
      hu = B.lerp(u0, u1, t / T_WALK);
      rw = 1 - B.ease((p - 4.5) / .5);                                      // the last half stride settles back to the plain gait for the stop
      var oA = foot(p, rw), oB = foot(p + .5, rw);
      fa = [hu + oA[0], gy + oA[1]]; fb = [hu + oB[0], gy + oB[1]]; pa = oA[2]; pb = oB[2];
      walkW = 1;
    } else {
      hu = u1 - 10 * stepBack - 12 * stepBack2;
      var c = B.ease((t - T_WALK) / T_CLOSE);                      // closing step: the rear foot comes up beside the front one, the front foot stays planted
      var bx = B.lerp(u1 - A, u1 - 4, c), by = -7 * Math.sin(Math.PI * Math.min(c, 1));
      var sb = B.win(t, 6.4, 6.85, 99, 100), sa = B.win(t, 6.85, 7.3, 99, 100);
      fa = [u1 + A - 22 * sa, gy - 7 * Math.sin(Math.PI * Math.min(Math.max((t - 6.85) / .45, 0), 1))];
      fb = [bx - 22 * sb, gy + by - 7 * Math.sin(Math.PI * Math.min(Math.max((t - 6.4) / .45, 0), 1))];
      if (out) {   // walking out: the front foot is planted where it stands, the back foot eases into the gait's first swing
        var lift = B.ease(q / .5); rw = lift;
        var h0 = hu, oA2 = foot(q, rw), oB2 = foot(q + .5, rw);
        hu = h0 + CYC * q;
        fa = [hu + oA2[0], gy + oA2[1]]; pa = oA2[2];
        fb = [hu + B.lerp(fb[0] - h0, oB2[0], lift), gy + oB2[1]]; pb = oB2[2];
      }
    }
    var walking = inWalk || out, pp = inWalk ? p : q, bob = walking ? 1.5 * Math.cos(4 * Math.PI * pp) * (out ? B.ease(q / .5) : 1) : 0;
    var th = theta(t), tapP = corner(th);
    // stage px -> local units
    var tap = [(XO - tapP[0]) / K, tapP[1] / K];
    var hit = 0; for (var i = 0; i < HIT.length; i++) if (Math.abs(t - HIT[i]) < .07) hit = 1 - Math.abs(t - HIT[i]) / .07;
    var near = 0; HIT.forEach(function (c) { near = Math.max(near, B.win(t, c - .3, c - .03, c + .03, c + .4)); });
    var lean = inWalk ? 0 : 3.5 * near - 1.2 * hit;
    var hip = [hu + lean * .5, gy - 67 + bob + 1.2 * near], sh = [hip[0] + 3 + lean + (walking ? 1 : 0), hip[1] - 50 + (walking ? .4 * Math.cos(4 * Math.PI * pp) : 0)];
    var lookUp = B.win(t, 3.9, 4.3, 6.4, 6.8), lookBack = B.win(t, 6.4, 6.8, 8.3, 8.8), nod = B.win(t, 8.2, 8.5, 8.6, 9);
    var tilt = -12 * lookUp - 6 * lookBack + 5 * nod + (walking ? 2 * Math.sin(4 * Math.PI * pp) : 0);
    var hc = [sh[0] + 6 + .8 * near, sh[1] - 11 + 1.5 * hit - .65 * bob];   // the neck soaks up most of the bob
    // pelvis turns with the forward leg, shoulders against it; the swing-side hip dips (all scaled by rw: none when standing)
    var tc = Math.cos(2 * Math.PI * pp) * rw, dip = function (x) { x = x - Math.floor(x); return x < .5 ? 0 : 1.2 * rw * Math.sin(Math.PI * (x - .5) / .5); };
    var hf = [hip[0] + 2.2 * tc, hip[1] + dip(pp)], hb = [hip[0] - 2.2 * tc, hip[1] + dip(pp + .5)];
    // --- arms (joint angles; the shoulder joint sits a little below the neck so the arms leave the body under the chin)
    var sa = [sh[0] - 1, sh[1] + 2], s1 = [sa[0] - 2.8 * tc, sa[1]], s2 = [sa[0] + 2.8 * tc, sa[1]];
    // the hammer is in the FAR hand: raised toward the photo, that arm passes behind his head instead of across his face
    var A1 = B.swing(p, 16), A2 = B.swing(p + .5, 16);       // each arm swings against its own leg
    A2.w = REST.w; A2.a += 6; A2.f += 6;
    if (!inWalk) {
      var cl = B.ease((t - T_WALK) / T_CLOSE);
      A2 = B.mixA(A2, armAt(t, sa, tap), cl);
      A1 = B.mixA(A1, { a: -12 - 10 * near, f: 30 + 12 * near }, cl);   // the free arm counterbalances each tap
      var tip = B.win(t, 7.4, 8.1, 8.45, 9.05);                      // free hand to the brim of the hat
      A1 = B.mixA(A1, B.solve(sa, [hc[0] + 20, hc[1] - 6]), tip, 30, .8);
      if (t > T_TURN) {   // arms fall back into the walking swing on the way out
        var sw = B.ease((t - T_TURN) / (T_OUT - T_TURN + .35)), W1 = B.swing(q, 16), W2 = B.swing(q + .5, 16);
        W2.w = REST.w; W2.a += 6; W2.f += 6;
        A1 = B.mixA(A1, W1, sw); A2 = B.mixA(A2, W2, sw);
      }
    }
        // facing: screen-left until the turn, then a quick flip about the hips to face screen-right (local +u always points the way he faces)
    var face = -Math.cos(Math.PI * B.ease((t - T_TURN) / (T_OUT - T_TURN))), he = hEnd(), hipX = t > T_TURN ? XO - K * he + K * (hu - he) : XO - K * hu;
    g.setAttribute('transform', 'translate(' + hipX.toFixed(2) + ' 0) scale(' + (face * K).toFixed(4) + ' ' + K + ') translate(' + (-hu).toFixed(2) + ' 0)');
    var r = who.pose({ hip: hip, sh: sh, sa: sa, head: hc, tilt: tilt, ff: fa, fb: fb, ffa: pa, fba: pb, hf: hf, hb: hb, s1: s1, s2: s2, A1: A1, A2: A2, bow: [-2 - near, 0], shadow: 30, ground: gy + 2, shadowX: hu });
    var G = B.grip(r.k2, HL, GRIP), hx = r.h2[0], hy = r.h2[1], ex = G.end[0], ey = G.end[1];
    hh.setAttribute('x1', hx.toFixed(1)); hh.setAttribute('y1', hy.toFixed(1)); hh.setAttribute('x2', ex.toFixed(1)); hh.setAttribute('y2', ey.toFixed(1));
    hd.setAttribute('transform', 'translate(' + ex.toFixed(1) + ' ' + ey.toFixed(1) + ') rotate(' + (90 - G.ang).toFixed(1) + ')');
    var gr = G.ang * Math.PI / 180;
    B.scenes.aboutProbe = { t: t, arm: r.k2, free: r.k1, face: [ex + FACE * Math.cos(gr), ey - FACE * Math.sin(gr)], tap: tap, hammer: G };
    img.style.transformOrigin = '50% 50%'; img.style.transform = 'rotate(' + th.toFixed(3) + 'deg)';
    spark.setAttribute('transform', 'translate(' + (tapP[0] + 3) + ' ' + (tapP[1] + 4) + ') scale(' + (hit * 1.2) + ')'); spark.setAttribute('opacity', hit > 0 ? 1 : 0);
    if (t > T_END + .3 && handle && handle.stop) { handle.stop(); }
  }
  B.scenes.about = draw;
  B.scenes.aboutMeasure = function () { measure(); return { pw: pw, sc: sc }; };
  handle = B.play(svg, draw, { loop: 0, still: 9.25 });   // reduced motion: standing beside the levelled photo
  if (!/[?&]eyes=1/.test(location.search) && !(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) draw(0);   // the photo hangs crooked from the first paint, before he arrives
})();
