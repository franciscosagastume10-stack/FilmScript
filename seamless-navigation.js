/* FilmScript route transitions: make the two application shells feel continuous.
   Native cross-document View Transitions are used where available; the tiny
   fallback prevents a white flash while the next shell is already prefetched. */
(function () {
  'use strict';

  var marker = 'filmscript:route-transition';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function enter() {
    if (reduced) return;
    try {
      if (sessionStorage.getItem(marker) !== '1') return;
      sessionStorage.removeItem(marker);
    } catch (_) { return; }
    document.documentElement.classList.add('fs-route-enter');
    requestAnimationFrame(function () {
      document.documentElement.classList.add('fs-route-enter-active');
    });
    window.setTimeout(function () {
      document.documentElement.classList.remove('fs-route-enter', 'fs-route-enter-active');
    }, 280);
  }

  function go(url, replace) {
    if (!url) return;
    if (reduced) {
      if (replace) window.location.replace(url); else window.location.assign(url);
      return;
    }
    try { sessionStorage.setItem(marker, '1'); } catch (_) {}
    document.documentElement.classList.add('fs-route-leave');
    window.setTimeout(function () {
      if (replace) window.location.replace(url); else window.location.assign(url);
    }, 135);
  }

  window.filmscriptNavigate = go;
  enter();
})();
