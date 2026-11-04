/* "Coming soon" tile art: the Builder tapping a brick into a half-built wall, with a cone beside him.
   Put <svg class="soon-scene" viewBox="0 0 160 160" aria-hidden="true"></svg> where an app icon would go. Needs builder-lite.js.
   Canonical source: brand/mascot/lite/soon-tile.js. Debug: ?soonT=1.2 freezes every tile at second 1.2 (for review). */
(function () {
  if (!window.BuilderLite) return;
  var B = window.BuilderLite, q = new URLSearchParams(location.search), K = .58, LOOP = 3.6, G = 148;
  function build(svg) {
    var bg = B.el('rect', { x: 0, y: 0, width: 160, height: 160, rx: 22, fill: '#F1EDE4' }, svg);
    B.el('rect', { x: 0, y: G, width: 160, height: 12, fill: '#CFCBC1' }, svg);
    // the wall: two full courses and a third being built
    var wall = B.el('g', {}, svg), bricks = [];
    [[96, 118, 142], [96, 118, 142]].forEach(function (row, r) { });
    function brick(x, y, w, c) { return B.el('rect', { x: x, y: y, width: w, height: 13, rx: 1.5, fill: c, stroke: '#7A3E26', 'stroke-width': 1 }, wall); }
    for (var i = 0; i < 3; i++) brick(74 + i * 22, G - 13, 21, i % 2 ? '#C0623B' : '#CC6E45');
    for (i = 0; i < 2; i++) brick(85 + i * 22, G - 27, 21, i % 2 ? '#CC6E45' : '#C0623B');
    var top = brick(74, G - 41, 21, '#C0623B');             // the brick he is tapping into place
    var spark = B.el('path', { d: 'M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4 Z', fill: '#F5B800', opacity: 0 }, svg);
    // a cone
    var cone = B.el('g', { transform: 'translate(20 ' + G + ')' }, svg);
    B.el('ellipse', { cx: 0, cy: 1, rx: 10, ry: 2, fill: '#000', 'fill-opacity': .18 }, cone);
    B.el('path', { d: 'M-9 0 L9 0 L9 -3 L-9 -3 Z', fill: '#1A1A1A' }, cone);
    B.el('path', { d: 'M-7 -3 L-2.4 -26 Q0 -28 2.4 -26 L7 -3 Z', fill: '#F26A1B' }, cone);
    B.el('path', { d: 'M-5 -13 L-4 -19 H4 L5 -13 Z', fill: '#F4F1EA' }, cone);
    var g = B.el('g', { transform: 'translate(0 0) scale(' + K + ')' }, svg), who = B.create(g);
    var hammer = B.el('g', {}, g), hh = B.el('line', { stroke: '#7A5A2E', 'stroke-width': 4, 'stroke-linecap': 'round' }, hammer), hd = B.el('rect', { x: -3.5, y: -10, width: 7, height: 20, rx: 2, fill: '#555' }, hammer);
    var gy = G / K;                                    // ground in figure units
    // the hammer arm as an angle and a reach about the shoulder (a swing is an arc, not a poke): REST at his side, RAISED over the shoulder,
    // HIT on the brick. Segments into a HIT ease in (it accelerates), segments out of it ease out (it rebounds).
    var KEYS = [[0, 'rest'], [.35, 'rest'], [.8, 'up'], [.97, 'hit'], [1.2, 'reb'], [1.52, 'up'], [1.66, 'hit'], [1.88, 'reb'], [2.2, 'up'], [2.34, 'hit'], [2.62, 'reb'], [3.15, 'rest'], [3.6, 'rest']];
    function armAt(t, sh, tap) {
      var aHit = Math.atan2(tap[1] - sh[1], tap[0] - sh[0]), rHit = Math.min(Math.hypot(tap[0] - sh[0], tap[1] - sh[1]), 66);
      var P = { rest: [1.35, 52], up: [-1.2, 46], hit: [aHit, rHit], reb: [-.3, 58] };
      var i = 0; while (i < KEYS.length - 2 && t >= KEYS[i + 1][0]) i++;
      var k0 = KEYS[i], k1 = KEYS[i + 1], u = (t - k0[0]) / (k1[0] - k0[0]), e;
      e = k1[1] === 'hit' ? u * u : (k0[1] === 'hit' ? 1 - (1 - u) * (1 - u) : B.ease(u));
      var p0 = P[k0[1]], p1 = P[k1[1]], a1 = p1[0] + (k0[1] === 'rest' && k1[1] === 'up' ? 2 * Math.PI : 0);   // the first raise is a back-swing: hand goes behind him and up
      return { a: B.lerp(p0[0], a1, e), r: B.lerp(p0[1], p1[1], e), hitU: k1[1] === 'hit' ? u : (k0[1] === 'hit' ? 1 - u : 0), segHit: k1[1] === 'hit' ? 1 : (k0[1] === 'hit' ? -1 : 0) };
    }
    function draw(t) {
      t = t % LOOP;
      var hit = 0, ph = 0;
      var hitTimes = [.97, 1.66, 2.34];
      for (var s = 0; s < 3; s++) if (Math.abs(t - hitTimes[s]) < .07) hit = 1 - Math.abs(t - hitTimes[s]) / .07;
      var near = 0; hitTimes.forEach(function (c) { near = Math.max(near, B.win(t, c - .35, c - .03, c + .03, c + .45)); });   // leaning into the work
      var lean = 4.5 * near + 1.2 * Math.sin(t * 2.6) - 1.4 * hit;
      var hip = [58 + lean * .55, gy - 62 + 1.5 * near], sh = [hip[0] + 7 + lean, hip[1] - 50 + .5 * Math.sin(t * 2.6)], hc = [sh[0] + 9 + .8 * near, sh[1] - 11 + 1.8 * hit + 1.2 * near];
      var tap = [(74 + 4) / K - 8, (G - 41) / K + 2];
      var A = armAt(t, sh, tap);
      var h1 = [sh[0] + A.r * Math.cos(A.a), sh[1] + A.r * Math.sin(A.a)];
      var h2 = [sh[0] + 6 - 6 * near, sh[1] + 40 - 5 * near];                      // the free hand comes up to steady the brick
      var r = who.pose({ hip: hip, sh: sh, head: hc, tilt: 6 + 9 * near - 3 * hit, ff: [hip[0] + 15, gy], fb: [hip[0] - 15, gy], h1: h1, h2: h2, bow: [-2 - near, 0], shadow: 30, ground: gy + 2 });
      var ex = r.e1, ang = Math.atan2(r.h1[1] - ex[1], r.h1[0] - ex[0]);
      var hx = r.h1[0], hy = r.h1[1], ex2 = hx + 19 * Math.cos(ang), ey2 = hy + 19 * Math.sin(ang);
      hh.setAttribute('x1', hx); hh.setAttribute('y1', hy); hh.setAttribute('x2', ex2); hh.setAttribute('y2', ey2);
      hd.setAttribute('transform', 'translate(' + ex2 + ' ' + ey2 + ') rotate(' + (ang * 180 / Math.PI) + ')');
      top.setAttribute('y', G - 41 + 1.8 * hit);
      spark.setAttribute('transform', 'translate(' + (77 + 4 * hit) + ' ' + (G - 46) + ') scale(' + (hit * 1.3) + ')'); spark.setAttribute('opacity', hit > 0 ? 1 : 0);
    }
    return draw;
  }
  var tiles = document.querySelectorAll('svg.soon-scene');
  Array.prototype.forEach.call(tiles, function (svg) {
    var draw = build(svg); B.scenes.soon = draw;
    if (q.get('soonT')) { draw(parseFloat(q.get('soonT'))); return; }
    B.play(svg, draw, { loop: LOOP, still: 1.1 });
  });
})();
