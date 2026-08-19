(() => {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const upgradeErrors = new Set(['filmscript_creator_required', 'image_generation_plan_required', 'image_credits_exhausted', 'lumiere_credits_exhausted', 'filmscript_pro_required']);
  const notifyUpgrade = (data = {}) => {
    const detail = { ...data };
    if (detail.error === 'image_generation_plan_required') {
      detail.message = detail.message || 'Image generation is included with FilmScript Creator and Full. Creator includes 100 image credits each month; Full includes 1,000; each image uses 3 credits.';
      detail.requiredTier = 'creator';
    } else if (detail.error === 'filmscript_creator_required') {
      detail.message = detail.message || 'This Lumiere feature is included with FilmScript Creator at $24.99/month and Full.';
      detail.requiredTier = 'creator';
    } else if (detail.error === 'lumiere_credits_exhausted') {
      detail.message = detail.message || 'Your included Lumiere credits are used. Creator at $24.99/month or Full unlocks a larger monthly allowance.';
      detail.requiredTier = 'creator';
    }
    window.dispatchEvent(new CustomEvent('filmscript:pro-required', { detail }));
    window.dispatchEvent(new CustomEvent('filmscript:upgrade-required', { detail }));
  };
  const request = async (url, options = {}) => {
    const response = await fetch(resolve(url), { credentials: 'include', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `Preproduction error ${response.status}`);
      error.code = data.error || null;
      error.status = response.status;
      if (response.status === 401) window.dispatchEvent(new CustomEvent('filmscript:auth-required'));
      if ((response.status === 402 || response.status === 403 || response.status === 429) && upgradeErrors.has(data.error)) notifyUpgrade(data);
      throw error;
    }
    return data;
  };
  const interfaceLanguage = () => window.filmscriptLanguage?.get?.() === 'es' ? 'es' : 'en';
  window.filmscriptPreproduction = {
    get: (scriptId) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction`),
    analyze: (scriptId, options = {}) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ language: interfaceLanguage(), ...(options?.includeManual === true ? { includeManual: true } : {}), ...(options?.sceneId ? { sceneId: String(options.sceneId) } : {}) }),
    }),
    createManualBreakdown: (scriptId) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/manual-breakdown`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    }),
    saveScene: (scriptId, sceneId, changes) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/scenes/${encodeURIComponent(sceneId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes || {}),
    }),
    uploadBreakdownImage: (scriptId, { sceneId, elementId, file }) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/breakdown/images`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
        'X-Scene-Id': encodeURIComponent(sceneId),
        'X-Element-Id': encodeURIComponent(elementId),
        'X-Filename': encodeURIComponent(file.name || 'breakdown image'),
      },
      body: file,
    }),
    breakdownImageUrl: (scriptId, assetId) => resolve(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/breakdown/images/${encodeURIComponent(assetId)}`),
    saveStripboard: (scriptId, changes = {}) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/stripboard`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    }),
    generateShotLists: (scriptId, sceneId = null) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/shotlists`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...(sceneId ? { sceneId } : {}), language: interfaceLanguage() }),
    }),
    saveShots: (scriptId, sceneId, shots) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/scenes/${encodeURIComponent(sceneId)}/shots`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shots }),
    }),
    saveShotFields: (scriptId, sceneId, operations) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/scenes/${encodeURIComponent(sceneId)}/shots`, {
      method: 'PATCH', headers: { 'Content-Type':'application/json' }, body:JSON.stringify({ operations }),
    }),
    uploadShotReference: (scriptId, { sceneId, shotId = '', file }) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/shotlist/references`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
        'X-Scene-Id': encodeURIComponent(sceneId),
        ...(shotId ? { 'X-Shot-Id': encodeURIComponent(shotId) } : {}),
        'X-Filename': encodeURIComponent(file.name || 'reference image'),
      },
      body: file,
    }),
    useCanvasShotReference: (scriptId, { sceneId, shotId = '', assetId }) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/shotlist/references/from-canvas`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sceneId, shotId, assetId }),
    }),
    generateShotReference: (scriptId, { sceneId, shotId = '', prompt = '', characterReferenceAssetIds = [] }) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/shotlist/references/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sceneId, ...(shotId ? { shotId } : {}), ...(prompt ? { prompt } : {}), ...(Array.isArray(characterReferenceAssetIds) && characterReferenceAssetIds.length ? { characterReferenceAssetIds } : {}) }),
    }),
    shotReferenceUrl: (scriptId, assetId) => resolve(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/shotlist/references/${encodeURIComponent(assetId)}`),
    addShotScene: (scriptId, title = '') => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/shotlist/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(title ? { title } : {}),
    }),
    renameShotScene: (scriptId, sceneId, title) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/shotlist/scenes/${encodeURIComponent(sceneId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    }),
    deleteShotScene: (scriptId, sceneId) => request(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/shotlist/scenes/${encodeURIComponent(sceneId)}`, {
      method: 'DELETE',
    }),
    exportPdf: async (scriptId) => {
      const response = await fetch(resolve(`/api/project-files/${encodeURIComponent(scriptId)}/preproduction/breakdown.pdf`), { credentials: 'include' });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `PDF export error ${response.status}`);
      }
      return response.blob();
    },
  };
})();
