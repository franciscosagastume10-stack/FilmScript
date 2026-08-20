(() => {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const upgradeErrors = new Set([
    'filmscript_creator_required',
    'filmscript_pro_required',
    'paid_plan_required',
    'full_plan_required',
    'insufficient_credits',
    'lumiere_credits_exhausted',
  ]);
  const notifyUpgrade = (data = {}) => {
    const detail = { ...data };
    if (detail.error === 'filmscript_creator_required') detail.requiredTier = detail.requiredTier || 'creator';
    window.dispatchEvent(new CustomEvent('filmscript:pro-required', { detail }));
    window.dispatchEvent(new CustomEvent('filmscript:upgrade-required', { detail }));
  };
  const request = async (url, options = {}) => {
    const response = await fetch(resolve(url), { credentials: 'include', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `Analysis error ${response.status}`);
      error.code = data.error || null;
      error.status = response.status;
      error.data = data;
      error.serverValidated = data.serverValidated === true;
      if (response.status === 401) window.dispatchEvent(new CustomEvent('filmscript:auth-required'));
      if ((response.status === 402 || response.status === 403 || response.status === 429) && upgradeErrors.has(data.error)) notifyUpgrade(data);
      throw error;
    }
    return data;
  };

  window.filmscriptAnalysis = {
    get: (scriptId) => request(`/api/scripts/${encodeURIComponent(scriptId)}/analysis`),
    analyze: (scriptId, options = {}) => request(`/api/scripts/${encodeURIComponent(scriptId)}/analysis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options || {}) }),
    update: (scriptId, change) => request(`/api/scripts/${encodeURIComponent(scriptId)}/analysis`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(change || {}),
    }),
    exportUrl: (scriptId) => resolve(`/api/scripts/${encodeURIComponent(scriptId)}/analysis.pdf`),
  };
})();
