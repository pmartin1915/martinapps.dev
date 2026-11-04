/* About page: the founder's photo hangs a little crooked. The Builder walks in, taps the low corner twice with his hammer, steps back and tips his hat.
   Markup: <div class="founder-row has-scene"><img ...><p>..</p></div> followed by <svg class="frame-stage" viewBox="0 0 300 116" aria-hidden="true"></svg>.
   The svg's top edge is the photo's bottom edge. Needs builder-lite.js first. Canonical source: brand/mascot/lite/about-frame.js.
   Plays once when the stage scrolls into view, then holds. Reduced motion: the photo is simply level and he stands there. */
(function () {
  if (!window.BuilderLite) return;
  var B = window.BuilderLite, svg = document.querySelector('svg.frame-stage'), img = document.querySelector('.founder-row.has-scene img');
  if (!svg || !img) return;
  svg.style.display = 'block';
  var K = .62, W = 300, GY = 112, gy = GY / K, XO = W;                       // the figure faces screen-left: group = translate(XO,0) scale(-K,K), local u = (XO - X) / K
  var T_WALK = 3.33, T_CLOSE = .5, T_STAND = T_WALK + T_CLOSE, CYC = 80, A = 20;   // 5 cycles of 80 units; stride half-length 20
  var HIT = [4.75, 5.55], TILT0 = -5, TAPS = [2.8, 2.2];                    // the photo starts 5 deg crooked; each tap swings it back by this much
  var ZETA = .2, OMEGA = 13;

  B.el('line', { x1: 0, x2: W, y1: GY + 1.5, y2: GY + 1.5, stroke: '#1A1A1A', 'stroke-opacity': .12, 'stroke-width': 1.5 }, svg);
  var spark = B.el('path', { d: 'M0 -6 L1.6 -1.6 L6 0 L1.6 1.6 L0 6 L-1.6 1.6 L-6 0 L-1.6 -1.6 Z', fill: '#F5B800', opacity: 0 }, svg);
  var g = B.el('g', { transform: 'translate(' + XO + ' 0) scale(' + (-K) + ' ' + K + ')' }, svg), who = B.create(g);
  var hammer = B.el('g', {}, g), hh = B.el('line', { stroke: '#7A5A2E', 'stroke-width': 4, 'stroke-linecap': 'round' }, hammer), hd = B.el('rect', { x: -3.5, y: -10, width: 7, height: 20, rx: 2, fill: '#555' }, hammer);

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
  function corner(th) {   // where the tapped spot on the photo's bottom edge is, in stage units
    var r = th * Math.PI / 180, rx = -pw / 2 + 20, ry = pw / 2 + 1, c = [pw / 2, -pw / 2];
    return [c[0] + rx * Math.cos(r) - ry * Math.sin(r), c[1] + rx * Math.sin(r) + ry * Math.cos(r)];
  }
  var KEYS = [[0, 'rest'], [T_STAND, 'rest'], [4.55, 'wind'], [HIT[0], 'hit'], [4.97, 'reb'], [5.35, 'wind'], [HIT[1], 'hit'], [5.8, 'reb'], [6.3, 'rest'], [99, 'rest']];
  function armAt(t, sh, tap) {   // hammer arm as an angle and a reach about the shoulder; into a hit it accelerates, out of it it rebounds
    var aHit = Math.atan2(tap[1] - sh[1], tap[0] - sh[0]), rHit = Math.min(Math.hypot(tap[0] - sh[0], tap[1] - sh[1]) - 17, 66);
    var P = { rest: [1.35, 52], wind: [1.7, 48], hit: [aHit, rHit], reb: [aHit + .5, 55] };
    var i = 0; while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
    var k0 = KEYS[i], k1 = KEYS[i + 1], u = Math.min(Math.max((t - k0[0]) / (k1[0] - k0[0]), 0), 1), e;
    e = k1[1] === 'hit' ? u * u : (k0[1] === 'hit' ? 1 - (1 - u) * (1 - u) : B.ease(u));
    return { a: B.lerp(P[k0[1]][0], P[k1[1]][0], e), r: B.lerp(P[k0[1]][1], P[k1[1]][1], e) };
  }
  function footOff(q) {
    q = q - Math.floor(q);
    if (q < .5) return [A - 80 * q, 0];                                          // stance: planted on the ground, slides back relative to the hip
    var s = (q - .5) / .5; return [-A + 2 * A * B.ease(s), -9 * Math.sin(Math.PI * s)];   // swing: forward with a lift
  }

  var handle = null;
  function draw(t) {
    var u1 = (XO - 46) / K, u0 = u1 - 5 * CYC, hu, offA, offB, walkW = 0, fa, fb;
    var inWalk = t < T_WALK, p = Math.min(t, T_WALK) / T_WALK * 5;
    // --- where is the hip and where are the feet (local units, world)
    var stepBack = B.win(t, 6.4, 6.85, 99, 100), stepBack2 = B.win(t, 6.85, 7.3, 99, 100);
    if (inWalk) {
      hu = B.lerp(u0, u1, t / T_WALK);
      var oA = footOff(p), oB = footOff(p + .5);
      fa = [hu + oA[0], gy + oA[1]]; fb = [hu + oB[0], gy + oB[1]];
      walkW = 1;
    } else {
      hu = u1 - 10 * stepBack - 12 * stepBack2;
      var c = B.ease((t - T_WALK) / T_CLOSE);                      // closing step: the rear foot comes up beside the front one, the front foot stays planted
      var bx = B.lerp(u1 - A, u1 - 4, c), by = -7 * Math.sin(Math.PI * Math.min(c, 1));
      var sb = B.win(t, 6.4, 6.85, 99, 100), sa = B.win(t, 6.85, 7.3, 99, 100);
      fa = [u1 + A - 22 * sa, gy - 7 * Math.sin(Math.PI * Math.min(Math.max((t - 6.85) / .45, 0), 1))];
      fb = [bx - 22 * sb, gy + by - 7 * Math.sin(Math.PI * Math.min(Math.max((t - 6.4) / .45, 0), 1))];
    }
    var bob = inWalk ? 1.5 * Math.cos(4 * Math.PI * p) : 0;
    var th = theta(t), tapP = corner(th);
    // stage px -> local units
    var tap = [(XO - tapP[0]) / K, tapP[1] / K];
    var hit = 0; for (var i = 0; i < HIT.length; i++) if (Math.abs(t - HIT[i]) < .07) hit = 1 - Math.abs(t - HIT[i]) / .07;
    var near = 0; HIT.forEach(function (c) { near = Math.max(near, B.win(t, c - .3, c - .03, c + .03, c + .4)); });
    var lean = inWalk ? 0 : 3.5 * near - 1.2 * hit;
    var hip = [hu + lean * .5, gy - 67 + bob + 1.2 * near], sh = [hip[0] + 7 + lean + (inWalk ? 2 : 0), hip[1] - 50 + (inWalk ? .4 * Math.cos(4 * Math.PI * p) : 0)];
    var lookUp = B.win(t, 3.9, 4.3, 6.4, 6.8), lookBack = B.win(t, 6.4, 6.8, 8.3, 8.8), nod = B.win(t, 8.2, 8.5, 8.6, 9);
    var tilt = -12 * lookUp - 6 * lookBack + 5 * nod + (inWalk ? 2 * Math.sin(4 * Math.PI * p) : 0);
    var hc = [sh[0] + 9 + .8 * near, sh[1] - 11 + 1.5 * hit];
    // --- arms
    var oa = inWalk ? footOff(p)[0] / A : 0;                         // near arm swings against the near leg
    var walkH1 = [sh[0] - 13 * oa + 4, sh[1] + 42 - 3 * Math.abs(oa)], walkH2 = [sh[0] + 13 * oa + 4, sh[1] + 42 - 3 * (1 - Math.abs(oa))];
    var h1, h2;
    if (t < T_WALK) { h1 = walkH1; h2 = walkH2; }
    else {
      var A1 = armAt(t, sh, tap), standH1 = [sh[0] + A1.r * Math.cos(A1.a), sh[1] + A1.r * Math.sin(A1.a)], standH2 = [sh[0] + 5 - 4 * near, sh[1] + 40 - 4 * near];
      var w = B.ease((t - T_WALK) / T_CLOSE);
      h1 = [B.lerp(walkH1[0], standH1[0], w), B.lerp(walkH1[1], standH1[1], w)];
      h2 = [B.lerp(walkH2[0], standH2[0], w), B.lerp(walkH2[1], standH2[1], w)];
      var tip = B.win(t, 7.6, 8.1, 8.45, 8.95);                      // far hand to the brim of the hat
      var brim = [hc[0] + 22, hc[1] - 8];
      h2 = [B.lerp(h2[0], brim[0], tip), B.lerp(h2[1], brim[1], tip)];
    }
    var r = who.pose({ hip: hip, sh: sh, head: hc, tilt: tilt, ff: fa, fb: fb, h1: h1, h2: h2, bow: [-2 - near, 0], shadow: 30, ground: gy + 2, shadowX: hu });
    var ang = Math.atan2(r.h1[1] - r.e1[1], r.h1[0] - r.e1[0]), hx = r.h1[0], hy = r.h1[1], ex = hx + 19 * Math.cos(ang), ey = hy + 19 * Math.sin(ang);
    hh.setAttribute('x1', hx); hh.setAttribute('y1', hy); hh.setAttribute('x2', ex); hh.setAttribute('y2', ey);
    hd.setAttribute('transform', 'translate(' + ex + ' ' + ey + ') rotate(' + (ang * 180 / Math.PI) + ')');
    img.style.transformOrigin = '50% 50%'; img.style.transform = 'rotate(' + th.toFixed(3) + 'deg)';
    spark.setAttribute('transform', 'translate(' + (tapP[0] + 3) + ' ' + (tapP[1] + 4) + ') scale(' + (hit * 1.2) + ')'); spark.setAttribute('opacity', hit > 0 ? 1 : 0);
    if (t > 10 && handle && handle.stop) { handle.stop(); }
  }
  B.scenes.about = draw;
  B.scenes.aboutMeasure = function () { measure(); return { pw: pw, sc: sc }; };
  handle = B.play(svg, draw, { loop: 0, still: 12 });
})();
