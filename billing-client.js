// Billing client. Payment state comes from the server, never from localStorage.
(() => {
  const signinResult = new URLSearchParams(window.location.search).get('signin');
  const currentPage = window.location.pathname.split('/').pop();
  // OAuth may return through the canonical .html route or the legacy
  // extensionless route. In both cases, authenticated users belong in the
  // app workspace rather than staying on the landing page.
  const isLandingPage = /^(Features|Pricing)\.dc(?:\.html)?$/i.test(currentPage);
  if (signinResult === 'success' && isLandingPage) {
    window.location.replace(new URL('./App.dc.html', window.location.href).toString());
    return;
  }
  if (signinResult === 'success' && currentPage === 'App.dc.html') {
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('signin');
    window.history.replaceState({}, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  }

  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const api = async (url, options = {}) => {
    const response = await fetch(resolve(url), { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `Account error ${response.status}`);
      error.code = data.error || null;
      error.status = response.status;
      if (response.status === 401) window.dispatchEvent(new CustomEvent('filmscript:auth-required'));
      throw error;
    }
    return data;
  };
  window.filmscriptBilling = {
    me: () => api('/api/me'),
    updateProfile: (name) => api('/api/me', { method: 'PATCH', body: JSON.stringify({ name }) }),
    getLumierePreferences: () => api('/api/me/lumiere-preferences'),
    updateLumierePreferences: (preferences) => api('/api/me/lumiere-preferences', { method: 'PATCH', body: JSON.stringify(preferences || {}) }),
    sync: (checkoutId = null) => api('/api/billing/sync', { method: 'POST', body: JSON.stringify(checkoutId ? { checkoutId } : {}) }),
    checkout: async (plan, email) => {
      const tracking = window.filmscriptFunnel?.context?.() || {};
      window.filmscriptFunnel?.track?.('checkout_requested', { plan, cycle: 'monthly' });
      const payload = { plan, email };
      if (tracking.visitorId) payload.visitorId = tracking.visitorId;
      if (tracking.sessionId) payload.sessionId = tracking.sessionId;
      if (tracking.attribution) payload.attribution = tracking.attribution;
      return api('/api/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    trackCheckoutRedirected: (plan) => window.filmscriptFunnel?.track?.('checkout_redirected', { plan, cycle: 'monthly' }),
    manageSubscription: () => api('/api/subscription/manage'),
    cancel: (mode = 'recurrente') => api('/api/subscription/cancel', { method: 'POST', body: JSON.stringify({ confirm: true, mode }) }),
    logout: () => api('/auth/logout', { method: 'POST', body: '{}' }),
    googleSignInUrl: (returnTo = '/App.dc.html') => `${resolve('/auth/google')}?returnTo=${encodeURIComponent(returnTo)}`,
  };
})();
