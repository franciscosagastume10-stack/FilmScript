(function () {
  const base = () => String(window.FILMSCRIPT_CONFIG?.apiUrl || '').replace(/\/$/, '');
  const resolve = (path) => `${base()}${path}`;

  async function request(path, options = {}) {
    const response = await fetch(resolve(path), { credentials: 'include', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || data.message || `Canvas request failed (${response.status})`);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  const jsonOptions = (method, body) => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const pathFor = (scriptId, suffix = '') => `/api/scripts/${encodeURIComponent(scriptId)}/canvas${suffix}`;

  window.filmscriptCanvas = {
    get: (scriptId) => request(pathFor(scriptId)),
    update: (scriptId, patch) => request(pathFor(scriptId), jsonOptions('PATCH', patch)),
    createVaultItem: (scriptId, item) => request(pathFor(scriptId, '/vault'), jsonOptions('POST', item)),
    updateVaultItem: (scriptId, itemId, patch) => request(pathFor(scriptId, `/vault/${encodeURIComponent(itemId)}`), jsonOptions('PATCH', patch)),
    deleteVaultItem: (scriptId, itemId) => request(pathFor(scriptId, `/vault/${encodeURIComponent(itemId)}`), { method: 'DELETE' }),
    createBoard: (scriptId, board) => request(pathFor(scriptId, '/boards'), jsonOptions('POST', board)),
    updateBoard: (scriptId, boardId, patch) => request(pathFor(scriptId, `/boards/${encodeURIComponent(boardId)}`), jsonOptions('PATCH', patch)),
    deleteBoard: (scriptId, boardId) => request(pathFor(scriptId, `/boards/${encodeURIComponent(boardId)}`), { method: 'DELETE' }),
    createQuote: (scriptId, quote) => request(pathFor(scriptId, '/quotes'), jsonOptions('POST', quote)),
    updateQuote: (scriptId, quoteId, patch) => request(pathFor(scriptId, `/quotes/${encodeURIComponent(quoteId)}`), jsonOptions('PATCH', patch)),
    deleteQuote: (scriptId, quoteId) => request(pathFor(scriptId, `/quotes/${encodeURIComponent(quoteId)}`), { method: 'DELETE' }),
    uploadAsset: async (scriptId, file, dimensions = {}) => {
      const response = await fetch(resolve(pathFor(scriptId, '/assets')), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': file.type || 'image/jpeg',
          'X-Filename': encodeURIComponent(file.name || 'Canvas image'),
          'X-Image-Width': String(dimensions.width || ''),
          'X-Image-Height': String(dimensions.height || ''),
        },
        body: file,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Image upload failed (${response.status})`);
      return data;
    },
    assetUrl: (scriptId, assetId) => resolve(pathFor(scriptId, `/assets/${encodeURIComponent(assetId)}`)),
    quotePdfUrl: (scriptId, quoteId) => resolve(pathFor(scriptId, `/quotes/${encodeURIComponent(quoteId)}.pdf`)),
  };
})();
