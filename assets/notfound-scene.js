/* The Builder's 404 scene: load when near, play only while on screen, hold a still frame for reduced motion. */
(function () {
  var box = document.querySelector('.nf-scene');
  if (!box || !('IntersectionObserver' in window)) return;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  fetch(box.getAttribute('data-src')).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
    if (!t) return;
    box.insertAdjacentHTML('beforeend', t);
    var s = box.querySelector('svg');
    if (!s || !s.pauseAnimations) return;
    s.pauseAnimations();
    if (reduce) { s.setCurrentTime(3.0); return; }
    new IntersectionObserver(function (e) { if (e[0].isIntersecting) s.unpauseAnimations(); else s.pauseAnimations(); }, { threshold: .3 }).observe(s);
  }).catch(function () {});
})();
