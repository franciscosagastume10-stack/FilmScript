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
  const erpApiUrl = String(
    configured.erpApiUrl
      || window.FILMSCRIPT_ERP_API_URL
      || '',
  ).replace(/\/$/, '');
  const erpEnvironment = String(
    configured.erpEnvironment
      || window.FILMSCRIPT_ERP_ENVIRONMENT
      || '',
  ).trim().toLowerCase();
  const firstPartyApi = configured.firstPartyApi === true || String(configured.firstPartyApi || '').toLowerCase() === 'true';
  const resolveApiUrl = (pathname) => {
    const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
    // Browser privacy tools can block generic `/api/*` paths. Production
    // routes those first-party calls through `/workspace/*`, which Vercel
    // rewrites to the private API without exposing a different browser origin.
    const firstPartyPath = firstPartyApi && (path === '/api' || path.startsWith('/api/'))
      ? `/workspace${path.slice(4)}`
      : path;
    return `${apiUrl}${firstPartyPath}`;
  };
  window.FILMSCRIPT_CONFIG = { ...configured, apiUrl, localApiUrl, erpApiUrl, erpEnvironment, firstPartyApi };
  window.filmscriptApiUrl = resolveApiUrl;
})();
