// Shared, persistent FilmScript color-theme preference.
(() => {
  const STORAGE_KEY = 'filmscript_theme';

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
