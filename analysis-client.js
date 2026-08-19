(() => {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const request = async (url, options = {}) => {
    const response = await fetch(resolve(url), { credentials: 'include', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `Analysis error ${response.status}`);
      error.code = data.error || null;
      error.status = response.status;
      if (response.status === 401) window.dispatchEvent(new CustomEvent('filmscript:auth-required'));
      if ((response.status === 402 || response.status === 403) && data.error === 'filmscript_pro_required') {
        window.dispatchEvent(new CustomEvent('filmscript:pro-required', { detail: data }));
      }
      throw error;
    }
    return data;
  };

  window.filmscriptAnalysis = {
    get: (scriptId) => request(`/api/project-files/${encodeURIComponent(scriptId)}/analysis`),
    analyze: (scriptId, options = {}) => request(`/api/project-files/${encodeURIComponent(scriptId)}/analysis`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options || {}) }),
    update: (scriptId, change) => request(`/api/project-files/${encodeURIComponent(scriptId)}/analysis`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(change || {}),
    }),
    exportUrl: (scriptId) => resolve(`/api/project-files/${encodeURIComponent(scriptId)}/analysis.pdf`),
  };
})();
