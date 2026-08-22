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
  const officialHost = window.location?.hostname === 'filmscript.app' || window.location?.hostname === 'www.filmscript.app';
  // The official frontend already proxies /api and /auth to AWS through
  // Vercel. Keep browser requests first-party so embedded browsers and privacy
  // tools cannot block the API subdomain or withhold its session cookie.
  const hostedApiDefault = '';
  const apiUrl = officialHost ? '' : String(
    configured.apiUrl
      || window.FILMSCRIPT_API_URL
      || (fileMode ? localApiUrl : hostedApiDefault),
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
  const firstPartyApi = officialHost
    || configured.firstPartyApi === true
    || String(configured.firstPartyApi || '').toLowerCase() === 'true';
  const resolveApiUrl = (pathname) => {
    const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
    // Some browser privacy lists block invitation-related route names even on
    // the official first-party origin. Keep the public browser path neutral
    // and translate it back to the existing AWS invitation API at Vercel.
    if (firstPartyApi && (path === '/api/invitations' || path.startsWith('/api/invitations/'))) {
      return `${apiUrl}/film-data/access-list${path.slice('/api/invitations'.length)}`;
    }
    // Account Imaging is independent from projects. Give it a neutral public
    // browser route, then let Vercel translate it back to the authenticated
    // account API without ever inventing a script identifier.
    if (firstPartyApi && (path === '/api/me/imaging' || path.startsWith('/api/me/imaging/'))) {
      return `${apiUrl}/visual-library${path.slice('/api/me/imaging'.length)}`;
    }
    // Image generation can legitimately take longer than the screenplay
    // serverless proxy allows. Route only this long-running POST through a
    // first-party edge rewrite straight to the API; every other screenplay
    // request keeps using the cookie-preserving screenplay proxy below.
    const projectImagineGeneration = path.match(/^\/api\/scripts\/([^/]+)\/canvas\/images\/generate$/);
    if (firstPartyApi && projectImagineGeneration) {
      return `${apiUrl}/visual-generation/project/${projectImagineGeneration[1]}`;
    }
    // Embedded-browser privacy lists can block nested routes under both
    // `/scripts` and `/workspace`. Use a neutral first-party data route and
    // translate it back to the unchanged AWS API path at Vercel's edge.
    if (firstPartyApi && (path === '/api/scripts' || path.startsWith('/api/scripts/'))) {
      return `${apiUrl}/film-data/document${path.slice('/api/scripts'.length)}`;
    }
    const firstPartyPath = firstPartyApi && (path === '/api' || path.startsWith('/api/'))
      ? `/workspace${path.slice(4)}`
      : path;
    return `${apiUrl}${firstPartyPath}`;
  };
  window.FILMSCRIPT_CONFIG = { ...configured, apiUrl, localApiUrl, erpApiUrl, erpEnvironment, firstPartyApi };
  window.filmscriptApiUrl = resolveApiUrl;
})();
