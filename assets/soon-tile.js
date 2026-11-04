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
    for (var i = 0; i < 3; i++) brick(92 + i * 22, G - 13, 21, i % 2 ? '#C0623B' : '#CC6E45');
    for (i = 0; i < 2; i++) brick(103 + i * 22, G - 27, 21, i % 2 ? '#CC6E45' : '#C0623B');
    var top = brick(92, G - 41, 21, '#C0623B');             // the brick he is tapping into place
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
    function draw(t) {
      t = t % LOOP;
      var strikes = [.95, 1.65, 2.35], hit = 0, lift;
      lift = B.win(t, .25, .8, 2.45, 3.1);               // the hammer is up between taps, down at rest
      var swing = 0;                                      // 1 = raised, 0 = on the nail
      for (var s = 0; s < 3; s++) { var c = strikes[s]; swing = Math.max(swing, B.win(t, c - .5, c - .08, c - .08, c + .04) * 1); if (Math.abs(t - c) < .06) hit = 1 - Math.abs(t - c) / .06; }
      var up = Math.max(lift * .35, swing);
      var lean = 6 * B.win(t, .2, .7, 2.6, 3.2) + 1.5 * Math.sin(t * 2.6);
      var hip = [52 + lean * .5, gy - 62], sh = [hip[0] + 7 + lean, hip[1] - 50], hc = [sh[0] + 9, sh[1] - 11 + 1.5 * hit];
      var rest = [sh[0] + 8, sh[1] + 44], tapAt = [(92 + 6) / K - 2, (G - 41) / K + 2], raised = [tapAt[0] - 30, tapAt[1] - 30];
      var h1 = B.lerp2(B.lerp2(rest, tapAt, B.ease(lift)), raised, swing * 1);
      h1 = [h1[0], h1[1]];
      var h2 = [sh[0] + 10, sh[1] + 38];
      var r = who.pose({ hip: hip, sh: sh, head: hc, tilt: 6 + 8 * lift, ff: [hip[0] + 14, gy], fb: [hip[0] - 14, gy], h1: h1, h2: h2, bow: [-2, 0], shadow: 30, ground: gy + 2 });
      // the hammer rides the hand: handle along the forearm's direction, head across its end
      var ex = r.e1 || [r.h1[0] - 20, r.h1[1] + 20], ang = Math.atan2(r.h1[1] - ex[1], r.h1[0] - ex[0]);
      var hx = r.h1[0], hy = r.h1[1];
      hh.setAttribute('x1', hx); hh.setAttribute('y1', hy); hh.setAttribute('x2', hx + 19 * Math.cos(ang)); hh.setAttribute('y2', hy + 19 * Math.sin(ang));
      hammer.setAttribute('transform', '');
      hd.setAttribute('transform', 'translate(' + (hx + 19 * Math.cos(ang)) + ' ' + (hy + 19 * Math.sin(ang)) + ') rotate(' + (ang * 180 / Math.PI) + ')');
      // the brick settles a little on each tap, and a spark flies
      top.setAttribute('y', G - 41 + 1.8 * hit);
      spark.setAttribute('transform', 'translate(' + (94 + 4 * hit) + ' ' + (G - 46) + ') scale(' + (hit * 1.2) + ')'); spark.setAttribute('opacity', hit > 0 ? 1 : 0);
    }
    return draw;
  }
  var tiles = document.querySelectorAll('svg.soon-scene');
  Array.prototype.forEach.call(tiles, function (svg) {
    var draw = build(svg);
    if (q.get('soonT')) { draw(parseFloat(q.get('soonT'))); return; }
    B.play(svg, draw, { loop: LOOP, still: 1.1 });
  });
})();
