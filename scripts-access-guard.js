// Scripts is private UI. The server session is the only source of truth.
(() => {
  const PENDING_ATTRIBUTE = 'data-filmscript-auth-pending';
  const root = document.documentElement;
  const landingUrl = new URL('./Features.dc.html', window.location.href).toString();
  let redirecting = false;

  const conceal = () => root?.setAttribute(PENDING_ATTRIBUTE, '');
  const reveal = () => root?.removeAttribute(PENDING_ATTRIBUTE);
  const redirectToLanding = () => {
    if (!redirecting) {
      redirecting = true;
      window.location.replace(landingUrl);
    }
    return false;
  };
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;

  const validate = async () => {
    conceal();
    try {
      const response = await fetch(resolve('/api/me'), {
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) return redirectToLanding();
      const account = await response.json().catch(() => null);
      const localPreview = account?.preview === true || account?.provider === 'preview';
      if (!account?.authenticated || (!localPreview && account.provider !== 'google') || !account.email) {
        return redirectToLanding();
      }
      reveal();
      return true;
    } catch (_error) {
      return redirectToLanding();
    }
  };

  let ready = validate();
  window.filmscriptScriptsAccess = {
    get ready() { return ready; },
    validate,
  };

  window.addEventListener('filmscript:auth-required', redirectToLanding);
  window.addEventListener('pageshow', (event) => {
    if (!event.persisted) return;
    redirecting = false;
    ready = validate();
  });
})();
