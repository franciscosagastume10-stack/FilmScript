// Billing client. Payment state comes from the server, never from localStorage.
(() => {
  const signinResult = new URLSearchParams(window.location.search).get('signin');
  const currentPage = window.location.pathname.split('/').pop();
  // OAuth can return through either the .html route or the legacy extensionless
  // route used by some Vercel deployments. Always land authenticated users in
  // the app workspace instead of leaving them on the landing page.
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
  const normalizeLanguage = (value) => String(value || '').trim().toLowerCase().startsWith('es') ? 'es' : 'en';
  const checkoutUrlForLanguage = (url, language) => {
    if (!url) return url;
    try {
      const next = new URL(url, window.location.href);
      if (normalizeLanguage(language) === 'es') {
        // Recurrente currently owns the hosted checkout UI. Keep the language
        // hint on the URL so supported checkout versions can honor it without
        // changing the payment session or its signature.
        next.searchParams.set('lang', 'es');
        next.searchParams.set('locale', 'es');
      }
      return next.toString();
    } catch (error) {
      return url;
    }
  };
  const api = async (url, options = {}) => {
    const response = await fetch(resolve(url), { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `Account error ${response.status}`);
      error.code = data.error || null;
      error.status = response.status;
      // Keep structured server decisions available to the checkout surface.
      // In particular, an inactive subscription may safely fall back to a
      // normal hosted checkout instead of pretending it can be prorated.
      error.data = data;
      if (response.status === 401) window.dispatchEvent(new CustomEvent('filmscript:auth-required'));
      throw error;
    }
    return data;
  };
  window.filmscriptBilling = {
    me: () => api('/api/me'),
    // A deliberately small, read-only endpoint used by the persistent credit
    // indicator next to the account avatar. Keeping it here means every
    // screen reads the same entitlement state as Lumiere itself.
    credits: () => api('/api/credits'),
    updateProfile: (nameOrPayload) => {
      const payload = typeof nameOrPayload === 'string' ? { name: nameOrPayload } : { ...(nameOrPayload || {}) };
      // Ignore a blank combined name accidentally carried by an older account
      // form. Current onboarding sends explicit first and last names.
      if (Object.prototype.hasOwnProperty.call(payload, 'name') && !String(payload.name || '').trim()) delete payload.name;
      return api('/api/me', { method: 'PATCH', body: JSON.stringify(payload) });
    },
    getLumierePreferences: () => api('/api/me/lumiere-preferences'),
    updateLumierePreferences: (preferences) => api('/api/me/lumiere-preferences', { method: 'PATCH', body: JSON.stringify(preferences || {}) }),
    sync: (checkoutId = null) => api('/api/billing/sync', { method: 'POST', body: JSON.stringify(checkoutId ? { checkoutId } : {}) }),
    checkout: async (plan, email, language = null) => {
      const nextLanguage = normalizeLanguage(language || document.documentElement.lang || window.filmscriptLanguage?.get?.());
      const tracking = window.filmscriptFunnel?.context?.() || {};
      window.filmscriptFunnel?.track?.('checkout_requested', { plan, cycle: 'monthly' });
      const payload = { plan, email, language: nextLanguage };
      if (tracking.visitorId) payload.visitorId = tracking.visitorId;
      if (tracking.sessionId) payload.sessionId = tracking.sessionId;
      if (tracking.attribution) payload.attribution = tracking.attribution;
      const result = await api('/api/checkout', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      return { ...result, checkoutUrl: checkoutUrlForLanguage(result.checkoutUrl, nextLanguage) };
    },
    previewPlanSwitch: async (plan, language = null) => {
      const nextLanguage = normalizeLanguage(language || document.documentElement.lang || window.filmscriptLanguage?.get?.());
      const tracking = window.filmscriptFunnel?.context?.() || {};
      const payload = { plan, language: nextLanguage };
      if (tracking.visitorId) payload.visitorId = tracking.visitorId;
      if (tracking.sessionId) payload.sessionId = tracking.sessionId;
      if (tracking.attribution) payload.attribution = tracking.attribution;
      return api('/api/subscription/switch/preview', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    switchPlan: async (plan, language = null, switchToken = '') => {
      const nextLanguage = normalizeLanguage(language || document.documentElement.lang || window.filmscriptLanguage?.get?.());
      const tracking = window.filmscriptFunnel?.context?.() || {};
      const payload = { plan, language: nextLanguage, confirm: true, switchToken };
      if (tracking.visitorId) payload.visitorId = tracking.visitorId;
      if (tracking.sessionId) payload.sessionId = tracking.sessionId;
      if (tracking.attribution) payload.attribution = tracking.attribution;
      return api('/api/subscription/switch', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    trackCheckoutRedirected: (plan) => window.filmscriptFunnel?.track?.('checkout_redirected', { plan, cycle: 'monthly' }),
    createCreditsResetCheckout: async (language = null) => {
      const nextLanguage = normalizeLanguage(language || document.documentElement.lang || window.filmscriptLanguage?.get?.());
      const result = await api('/api/credits/checkout', {
        method: 'POST',
        body: JSON.stringify({ language: nextLanguage }),
      });
      return { ...result, checkoutUrl: checkoutUrlForLanguage(result.checkoutUrl, nextLanguage) };
    },
    confirmCreditsReset: (checkoutId = null) => api('/api/credits/confirm', {
      method: 'POST',
      body: JSON.stringify(checkoutId ? { checkoutId } : {}),
    }),
    manageSubscription: () => api('/api/subscription/manage'),
    cancel: (mode = 'recurrente') => api('/api/subscription/cancel', { method: 'POST', body: JSON.stringify({ confirm: true, mode }) }),
    logout: async () => {
      try { return await api('/auth/logout', { method: 'POST', body: '{}' }); }
      finally {
        // A different account must never see the previous person's greeting
        // while its authenticated profile is being hydrated.
        try {
          localStorage.removeItem('filmscript_account_first_name');
          sessionStorage.removeItem('filmscript_auth_handoff_identity_v1');
        } catch {}
      }
    },
    googleSignInUrl: (returnTo = '/App.dc.html') => `${resolve('/auth/google')}?returnTo=${encodeURIComponent(returnTo)}`,
  };
})();
