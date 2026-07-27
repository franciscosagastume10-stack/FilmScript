// Shared, persistent FilmScript color-theme preference.
(() => {
  const STORAGE_KEY = 'filmscript_theme';
  const THEME_SURFACES = 'film-script-canvas, filmscript-budget, filmscript-calendar';
  let surfaceTransitionActive = false;
  let surfaceTransitionTimer = 0;

  // These workspaces render inside open Shadow DOM roots, so the document
  // transition selector cannot reach their cards, tracks and controls. Mirror
  // the short-lived transition classes onto each surface host as well.
  const syncThemeSurfaces = () => {
    document.querySelectorAll(THEME_SURFACES).forEach((surface) => {
      surface.classList.toggle('filmscript-theme-transition', surfaceTransitionActive);
      surface.classList.toggle('filmscript-theme-fading', surfaceTransitionActive);
    });
  };

  const beginSurfaceTransition = () => {
    surfaceTransitionActive = true;
    syncThemeSurfaces();
    window.requestAnimationFrame(() => window.setTimeout(() => {
      document.querySelectorAll(THEME_SURFACES).forEach((surface) => surface.classList.remove('filmscript-theme-fading'));
    }, 26));
    window.clearTimeout(surfaceTransitionTimer);
    surfaceTransitionTimer = window.setTimeout(() => {
      surfaceTransitionActive = false;
      syncThemeSurfaces();
    }, 290);
  };

  // A theme toggle can cause the editor shell to replace a workspace host.
  // Re-apply the classes to a newly mounted host while the fade is active.
  const surfaceObserver = new MutationObserver(() => {
    if (surfaceTransitionActive) syncThemeSurfaces();
  });
  surfaceObserver.observe(document.documentElement, { childList: true, subtree: true });

  const normalize = (value) => value === 'dark' ? 'dark' : 'light';

  const installTransitionStyles = () => {
    if (document.getElementById('filmscript-theme-transition-styles')) return;
    const style = document.createElement('style');
    style.id = 'filmscript-theme-transition-styles';
    style.textContent = `
      html.filmscript-theme-transition body,
      html.filmscript-theme-transition body * {
        transition-property: color, background-color, border-color, box-shadow, opacity, fill, stroke !important;
        transition-duration: 220ms !important;
        transition-timing-function: cubic-bezier(.22,.7,.25,1) !important;
      }
      html.filmscript-theme-fading body { opacity: .72; }
      @media (prefers-reduced-motion: reduce) {
        html.filmscript-theme-transition body,
        html.filmscript-theme-transition body * { transition-duration: .01ms !important; }
      }
    `;
    document.head.appendChild(style);
  };

  const get = () => {
    try { return normalize(localStorage.getItem(STORAGE_KEY)); }
    catch (e) { return 'light'; }
  };

  const apply = (theme, animate = false) => {
    const next = normalize(theme);
    if (animate) {
      installTransitionStyles();
      beginSurfaceTransition();
      document.documentElement.classList.add('filmscript-theme-transition', 'filmscript-theme-fading');
      requestAnimationFrame(() => window.setTimeout(() => document.documentElement.classList.remove('filmscript-theme-fading'), 24));
      window.setTimeout(() => document.documentElement.classList.remove('filmscript-theme-transition'), 260);
    }
    document.documentElement.setAttribute('data-filmscript-theme', next);
    document.documentElement.style.colorScheme = next;
    return next;
  };

  const set = (theme) => {
    const next = normalize(theme);
    try { localStorage.setItem(STORAGE_KEY, next); } catch (e) {}
    apply(next, true);
    window.dispatchEvent(new CustomEvent('filmscript:theme-change', { detail: { theme: next } }));
    return next;
  };

  const isDark = () => get() === 'dark';
  const toggle = () => set(isDark() ? 'light' : 'dark') === 'dark';

  apply(get());
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) apply(get(), true);
  });

  window.filmscriptTheme = Object.freeze({
    key: STORAGE_KEY,
    get,
    isDark,
    set,
    setDark: (dark) => set(dark ? 'dark' : 'light') === 'dark',
    toggle,
  });
})();
