(() => {
  const configured = window.FILMSCRIPT_CONFIG || {};
  // When a local HTML file is opened directly, root-relative URLs resolve to
  // `file:///...` instead of the FilmScript API. Google OAuth (and every
  // account request) needs the local server, so use its origin in file mode.
  const localApiUrl = String(
    configured.localApiUrl
      || window.FILMSCRIPT_LOCAL_API_URL
      || 'http://localhost:4173',
  ).replace(/\/$/, '');
  const fileMode = window.location?.protocol === 'file:';
  const apiUrl = String(
    configured.apiUrl
      || window.FILMSCRIPT_API_URL
      || (fileMode ? localApiUrl : ''),
  ).replace(/\/$/, '');
  const resolveApiUrl = (pathname) => {
    const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
    return `${apiUrl}${path}`;
  };
  window.FILMSCRIPT_CONFIG = { ...configured, apiUrl, localApiUrl };
  window.filmscriptApiUrl = resolveApiUrl;
})();
