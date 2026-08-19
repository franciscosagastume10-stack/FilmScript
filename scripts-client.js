(() => {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const request = async (url, options = {}) => {
    // A Google sign-in can return to Scripts immediately after the session cookie is
    // created. Never reuse a pre-login response for a user-scoped request.
    const response = await fetch(resolve(url), { credentials: 'include', ...options, cache: 'no-store', headers: { ...(options.headers || {}), ...(window.filmscriptPlatform?.clientId ? { 'X-FilmScript-Client-Id': window.filmscriptPlatform.clientId } : {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `Script error ${response.status}`);
      error.code = data.error || null;
      error.status = response.status;
      if (response.status === 401) window.dispatchEvent(new CustomEvent('filmscript:auth-required'));
      throw error;
    }
    return data;
  };
  window.filmscriptScripts = {
    list: () => request('/api/scripts'),
    create: (title = 'Untitled screenplay') => request('/api/scripts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) }),
    import: (file) => request('/api/scripts/import', { method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Filename': encodeURIComponent(file.name) }, body: file }),
    saveBlocks: (id, blocks) => request(`/api/scripts/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ blocks }) }),
    rename: (id, title) => request(`/api/scripts/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) }),
    saveChat: (id, chat) => request(`/api/scripts/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat }) }),
    saveChatKeepalive: (id, chat) => request(`/api/scripts/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat }), keepalive: true }),
    saveTitleRoom: (id, titleRoom) => request(`/api/scripts/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ titleRoom }) }),
    saveCharacterNames: (id, characterNames) => request(`/api/scripts/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ characterNames }) }),
    get: (id) => request(`/api/scripts/${encodeURIComponent(id)}`),
    remove: (id) => request(`/api/scripts/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };
})();
