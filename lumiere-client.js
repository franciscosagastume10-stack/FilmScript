// Lumiere connection: every browser-side Lumiere action uses this one safe
// proxy. The OpenRouter credential never leaves the FilmScript server.
(() => {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const entitlementEnabled = (value) => value === true || value?.allowed === true;
  let account = null;
  let accountRequest = null;
  const upgradeErrors = new Set([
    'filmscript_creator_required',
    'paid_plan_required',
    'full_plan_required',
    'image_generation_plan_required',
    'image_credits_exhausted',
    'lumiere_credits_exhausted',
    'insufficient_credits',
    // Keep this for an in-flight deployment where an older API is still
    // answering requests while the new entitlement model rolls out.
    'filmscript_pro_required',
  ]);
  const notifyUpgrade = (data = {}) => {
    const detail = { ...data };
    if (detail.error === 'image_generation_plan_required') {
      detail.message = detail.message || 'Image generation is included with FilmScript Full at $39.99/month. Full includes 1,000 image credits each month; each image uses 3 credits.';
      detail.requiredTier = 'full';
    } else if (detail.error === 'filmscript_creator_required') {
      detail.message = detail.message || 'This Lumiere feature is included with FilmScript Creator at $24.99/month and Full.';
      detail.requiredTier = 'creator';
    } else if (detail.error === 'lumiere_credits_exhausted') {
      detail.message = detail.message || 'Your included Lumiere prompts are used. Creator at $24.99/month unlocks ongoing Lumiere work.';
      detail.requiredTier = detail.requiredTier || detail.upgrade || (detail.plan === 'creator' ? 'full' : 'creator');
    }
    window.dispatchEvent(new CustomEvent('filmscript:pro-required', { detail }));
    window.dispatchEvent(new CustomEvent('filmscript:upgrade-required', { detail }));
  };
  const idempotencyKey = () => {
    try {
      if (typeof crypto?.randomUUID === 'function') return `lchat_${crypto.randomUUID()}`;
      const bytes = new Uint8Array(18);
      crypto.getRandomValues(bytes);
      return `lchat_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
    } catch {
      return `lchat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 16)}`;
    }
  };
  const getAccount = async ({ refresh = false } = {}) => {
    if (!refresh && account) return account;
    if (!refresh && accountRequest) return accountRequest;
    accountRequest = fetch(resolve('/api/me'), { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.message || `Account request failed (${response.status})`);
        account = data || null;
        return account;
      })
      .finally(() => { accountRequest = null; });
    return accountRequest;
  };
  // Shared entitlement reader for feature workspaces. It only reads the
  // signed-in account payload; enforcement remains on the server.
  window.filmscriptEntitlements = window.filmscriptEntitlements || {
    get: getAccount,
    refresh: () => getAccount({ refresh: true }),
    enabled: entitlementEnabled,
    has(key, value = account) { return entitlementEnabled(value?.entitlements?.[key]); },
    clear() { account = null; },
  };
  const interfaceLanguage = () => {
    const language = window.filmscriptLanguage?.get?.();
    if (language === 'es' || language === 'en') return language;
    try { return localStorage.getItem('filmscript_language') === 'es' ? 'es' : 'en'; } catch { return 'en'; }
  };
  const currentProjectId = () => {
    try {
      const params = new URLSearchParams(window.location.search);
      const value = params.get('script') || params.get('id') || '';
      return /^scr_[a-f0-9]+$/i.test(value) ? value : null;
    } catch { return null; }
  };
  const lumiere = window.lumiere || {};
  window.lumiere = lumiere;
  lumiere.complete = async ({ messages, maxTokens, surface = 'workspace', projectId = currentProjectId(), module, sceneId } = {}) => {
    // Every deliberate tool press gets one stable request identity. The API
    // reserves and settles exactly one Lumiere use for this id, so a replayed
    // browser request can never spend the same action twice.
    const requestId = idempotencyKey();
    const res = await fetch(resolve("/api/lumiere"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "Idempotency-Key": requestId },
      body: JSON.stringify({ messages, maxTokens, surface, projectId, module, sceneId, language: interfaceLanguage(), idempotencyKey: requestId }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data?.credits && typeof data.credits === 'object') {
        window.dispatchEvent(new CustomEvent('filmscript:credits-updated', { detail: data.credits }));
      }
      if (res.status === 401) window.dispatchEvent(new CustomEvent('filmscript:auth-required'));
      if ((res.status === 402 || res.status === 403 || res.status === 429) && upgradeErrors.has(data.error)) notifyUpgrade(data);
      const error = new Error(data.message || data.error || "Lumiere proxy error " + res.status);
      error.code = data.error || null;
      error.status = res.status;
      error.credits = data.credits || null;
      error.requiredCredits = data.requiredCredits ?? null;
      error.availableCredits = data.availableCredits ?? null;
      error.serverValidated = data.serverValidated === true;
      throw error;
    }
    const data = await res.json();
    if (data?.credits && typeof data.credits === 'object') {
      window.dispatchEvent(new CustomEvent('filmscript:credits-updated', { detail: data.credits }));
    }
    return data.reply || "";
  };
})();
