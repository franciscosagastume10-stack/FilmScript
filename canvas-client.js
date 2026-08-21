(function () {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const upgradeErrors = new Set(['filmscript_creator_required', 'image_generation_plan_required', 'image_credits_exhausted', 'filmscript_pro_required']);
  const notifyUpgrade = (data = {}) => {
    const detail = { ...data };
    if (detail.error === 'image_generation_plan_required') {
      detail.message = detail.message || 'Image generation is included with FilmScript Full at $39.99/month. Full includes 1,000 image credits each month; each image uses 3 credits.';
      detail.requiredTier = 'full';
    } else if (detail.error === 'filmscript_creator_required') {
      detail.message = detail.message || 'This Lumiere feature is included with FilmScript Creator at $24.99/month and Full.';
      detail.requiredTier = 'creator';
    }
    window.dispatchEvent(new CustomEvent('filmscript:pro-required', { detail }));
    window.dispatchEvent(new CustomEvent('filmscript:upgrade-required', { detail }));
  };

  async function request(path, options = {}) {
    const response = await fetch(resolve(path), { credentials: 'include', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `Canvas request failed (${response.status})`);
      error.status = response.status;
      error.data = data;
      error.code = data.error || null;
      if (response.status === 401) window.dispatchEvent(new CustomEvent('filmscript:auth-required'));
      if ((response.status === 402 || response.status === 403 || response.status === 429) && upgradeErrors.has(data.error)) {
        notifyUpgrade(data);
        error.entitlementNotified = true;
      }
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
  // Imaging is an account workspace. Its API never receives a screenplay or
  // project identifier, which keeps the gallery available from the dashboard
  // without creating a hidden project or a shared sentinel script.
  const accountImagingPath = (suffix = '') => `/api/me/imaging${suffix}`;

  // Older API deployments expose Canvas but not its dedicated Vault/image
  // routes. Keep a private browser-side mirror only for that 404 case so a
  // visual reference never vanishes while the backend is rolled forward.
  const cacheKey = (scriptId) => `filmscript_canvas_compat_${String(scriptId || '').trim()}`;
  const memoryAssets = new Map();
  const randomId = (prefix) => `${prefix}_${(globalThis.crypto?.randomUUID?.() || `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`).replace(/-/g, '')}`;
  const compatibilityFailure = (error) => Number(error?.status) === 404
    // Legacy API CORS allowed Content-Type but not the image dimension
    // headers. Browsers surface that blocked preflight as a TypeError instead
    // of exposing the server's 404, so treat it as the same safe local path.
    || /failed to fetch|networkerror/i.test(String(error?.message || ''));
  const readCompat = (scriptId) => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(cacheKey(scriptId)) || '{}');
      return { assets: Array.isArray(stored.assets) ? stored.assets : [], vaultItems: Array.isArray(stored.vaultItems) ? stored.vaultItems : [] };
    } catch { return { assets: [], vaultItems: [] }; }
  };
  const writeCompat = (scriptId, value) => {
    try { window.localStorage.setItem(cacheKey(scriptId), JSON.stringify(value)); } catch { /* The active tab still retains its images. */ }
    (value.assets || []).forEach((asset) => { if (asset?.localDataUrl) memoryAssets.set(asset.id, asset.localDataUrl); });
    return value;
  };
  const mergeCompatibility = (scriptId, result) => {
    const local = readCompat(scriptId);
    const workspace = result?.workspace || {};
    const mergeById = (remote = [], additions = []) => {
      const known = new Set(remote.map((entry) => entry?.id));
      return [...remote, ...additions.filter((entry) => entry?.id && !known.has(entry.id))];
    };
    return {
      ...result,
      workspace: {
        ...workspace,
        assets: mergeById(workspace.assets, local.assets).map(({ localDataUrl: _localDataUrl, ...asset }) => asset),
        vaultItems: mergeById(workspace.vaultItems, local.vaultItems),
      },
    };
  };
  const dataUrlFor = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('The image could not be prepared for Vault.'));
    reader.readAsDataURL(file);
  });
  const uploadRemoteAssetTo = async (path, file, dimensions = {}) => {
    const scope = dimensions?.scope === 'imagine' ? 'imagine' : '';
    const response = await fetch(resolve(path), {
      method: 'POST', credentials: 'include',
      headers: {
        'Content-Type': file.type || 'image/jpeg',
        'X-Filename': encodeURIComponent(file.name || 'Canvas image'),
        'X-Image-Width': String(dimensions.width || ''),
        'X-Image-Height': String(dimensions.height || ''),
        ...(scope ? { 'X-Canvas-Scope': scope } : {}),
      },
      body: file,
    });
    const data = await response.json().catch(() => ({}));
    if (response.ok) return data;
    const error = new Error(data.error || `Image upload failed (${response.status})`);
    error.status = response.status;
    error.code = data.error || null;
    if (response.status === 401) window.dispatchEvent(new CustomEvent('filmscript:auth-required'));
    throw error;
  };
  const uploadRemoteAsset = (scriptId, file, dimensions = {}) => uploadRemoteAssetTo(pathFor(scriptId, '/assets'), file, dimensions);
  const remapImageIds = (item, mapping) => {
    const imageIds = (Array.isArray(item?.imageIds) ? item.imageIds : []).map((id) => mapping.get(id) || id);
    const mainImageId = mapping.get(item?.mainImageId) || item?.mainImageId || imageIds[0] || '';
    return { ...item, imageIds, mainImageId };
  };

  // A prior CORS configuration could save the Vault record remotely while its
  // image was kept only in Chrome's localStorage. Once the API is healthy,
  // promote those pending data URLs exactly once and repair every Vault link.
  // This makes the affected assets visible in every signed-in browser.
  const pendingPromotions = new Map();
  const promoteCompatibilityAssets = async (scriptId, result) => {
    if (pendingPromotions.has(scriptId)) return pendingPromotions.get(scriptId);
    const run = (async () => {
      const local = readCompat(scriptId);
      const workspace = result?.workspace;
      const legacyAssets = local.assets.filter((asset) => asset?.id && asset?.localDataUrl);
      if (!workspace || !legacyAssets.length) return result;
      const mapping = new Map();
      for (const legacy of legacyAssets) {
        try {
          const blob = await fetch(legacy.localDataUrl).then((response) => response.blob());
          const file = new File([blob], legacy.filename || 'Vault image', { type: legacy.mimeType || blob.type || 'image/jpeg' });
          const uploaded = await uploadRemoteAsset(scriptId, file, legacy);
          if (!uploaded?.asset?.id) continue;
          mapping.set(legacy.id, uploaded.asset.id);
          workspace.assets = Array.isArray(workspace.assets) ? workspace.assets : [];
          workspace.assets.push(uploaded.asset);
        } catch { /* Keep the local copy and try again on a future visit. */ }
      }
      if (!mapping.size) return result;
      workspace.vaultItems = Array.isArray(workspace.vaultItems) ? workspace.vaultItems : [];
      const committed = new Set();
      for (let index = 0; index < workspace.vaultItems.length; index += 1) {
        const current = workspace.vaultItems[index];
        const repaired = remapImageIds(current, mapping);
        if (repaired.mainImageId === current.mainImageId && repaired.imageIds.every((id, i) => id === current.imageIds?.[i])) continue;
        try {
          const saved = await request(pathFor(scriptId, `/vault/${encodeURIComponent(current.id)}`), jsonOptions('PATCH', { imageIds: repaired.imageIds, mainImageId: repaired.mainImageId }));
          workspace.vaultItems[index] = saved.item || repaired;
          [...(current.imageIds || []), current.mainImageId].forEach((oldId) => { if (mapping.has(oldId)) committed.add(oldId); });
        } catch { /* Leave the original local relation in place until it can be saved. */ }
      }
      if (!committed.size) return result;
      const committedMapping = new Map([...mapping].filter(([oldId]) => committed.has(oldId)));
      const repairedLocal = {
        assets: local.assets.filter((asset) => !committed.has(asset.id)),
        vaultItems: local.vaultItems.map((item) => remapImageIds(item, committedMapping)),
      };
      committed.forEach((oldId) => memoryAssets.delete(oldId));
      writeCompat(scriptId, repairedLocal);
      return result;
    })();
    pendingPromotions.set(scriptId, run);
    try { return await run; } finally { pendingPromotions.delete(scriptId); }
  };

  window.filmscriptCanvas = {
    getAccountImaging: () => request(accountImagingPath()),
    generateAccountImagingImage: (options) => request(
      accountImagingPath('/images/generate'),
      jsonOptions('POST', typeof options === 'string' ? { prompt: options } : (options || {})),
    ),
    uploadAccountImagingAsset: (file, dimensions = {}) => uploadRemoteAssetTo(accountImagingPath('/assets'), file, { ...dimensions, scope: 'imagine' }),
    accountImagingAssetUrl: (assetId) => resolve(accountImagingPath(`/assets/${encodeURIComponent(assetId)}`)),
    get: async (scriptId) => {
      const result = await request(pathFor(scriptId));
      // A browser-side legacy Vault cache must never repopulate a response
      // which the server intentionally limited to Imagine.
      if (result?.workspace?.accessScope === 'imagine') return result;
      return mergeCompatibility(scriptId, await promoteCompatibilityAssets(scriptId, result));
    },
    update: (scriptId, patch) => request(pathFor(scriptId), jsonOptions('PATCH', patch)),
    createVaultItem: async (scriptId, item) => {
      try { return await request(pathFor(scriptId, '/vault'), jsonOptions('POST', item)); }
      catch (error) {
        if (!compatibilityFailure(error)) throw error;
        const local = readCompat(scriptId);
        const now = new Date().toISOString();
        const vaultItem = { ...item, id: randomId('vlt'), name: String(item?.name || 'Untitled item').trim() || 'Untitled item', category: String(item?.category || 'Uncategorized').trim() || 'Uncategorized', imageIds: Array.isArray(item?.imageIds) ? item.imageIds : [], mainImageId: String(item?.mainImageId || item?.imageIds?.[0] || ''), quantityOwned: Number(item?.quantityOwned) || 0, quantityAvailable: Number(item?.quantityAvailable) || 0, availability: item?.availability || 'available', archived: false, createdAt: now, updatedAt: now };
        local.vaultItems.unshift(vaultItem);
        writeCompat(scriptId, local);
        return { item: vaultItem, storage: 'local' };
      }
    },
    updateVaultItem: async (scriptId, itemId, patch) => {
      try { return await request(pathFor(scriptId, `/vault/${encodeURIComponent(itemId)}`), jsonOptions('PATCH', patch)); }
      catch (error) {
        if (!compatibilityFailure(error)) throw error;
        const local = readCompat(scriptId);
        const index = local.vaultItems.findIndex((item) => item.id === itemId);
        if (index < 0) throw error;
        const item = { ...local.vaultItems[index], ...patch, id: itemId, updatedAt: new Date().toISOString() };
        local.vaultItems[index] = item;
        writeCompat(scriptId, local);
        return { item, storage: 'local' };
      }
    },
    deleteVaultItem: async (scriptId, itemId) => {
      try { return await request(pathFor(scriptId, `/vault/${encodeURIComponent(itemId)}`), { method: 'DELETE' }); }
      catch (error) {
        if (!compatibilityFailure(error)) throw error;
        const local = readCompat(scriptId);
        local.vaultItems = local.vaultItems.filter((item) => item.id !== itemId);
        writeCompat(scriptId, local);
        return { ok: true, storage: 'local' };
      }
    },
    createBoard: (scriptId, board) => request(pathFor(scriptId, '/boards'), jsonOptions('POST', board)),
    updateBoard: (scriptId, boardId, patch) => request(pathFor(scriptId, `/boards/${encodeURIComponent(boardId)}`), jsonOptions('PATCH', patch)),
    updateBoardElements: (scriptId, boardId, elementOperations) => request(pathFor(scriptId, `/boards/${encodeURIComponent(boardId)}`), jsonOptions('PATCH', { elementOperations })),
    deleteBoard: (scriptId, boardId) => request(pathFor(scriptId, `/boards/${encodeURIComponent(boardId)}`), { method: 'DELETE' }),
    generateStoryboardImage: (scriptId, options) => request(pathFor(scriptId, '/images/generate'), jsonOptions('POST', typeof options === 'string' ? { prompt: options } : (options || {}))),
    createQuote: (scriptId, quote) => request(pathFor(scriptId, '/quotes'), jsonOptions('POST', quote)),
    updateQuote: (scriptId, quoteId, patch) => request(pathFor(scriptId, `/quotes/${encodeURIComponent(quoteId)}`), jsonOptions('PATCH', patch)),
    deleteQuote: (scriptId, quoteId) => request(pathFor(scriptId, `/quotes/${encodeURIComponent(quoteId)}`), { method: 'DELETE' }),
    uploadAsset: async (scriptId, file, dimensions = {}) => {
      try {
        return await uploadRemoteAsset(scriptId, file, dimensions);
      } catch (error) {
        if (!compatibilityFailure(error)) throw error;
        const local = readCompat(scriptId);
        const localDataUrl = await dataUrlFor(file);
        const savedAsset = { id: randomId('cas'), provider: 'local', key: '', mimeType: file.type || 'image/jpeg', filename: file.name || 'Canvas image', size: file.size || 0, width: Number(dimensions.width) || 0, height: Number(dimensions.height) || 0, source: dimensions?.scope === 'imagine' ? 'imagine_reference' : 'upload', createdAt: new Date().toISOString(), localDataUrl };
        local.assets.push(savedAsset);
        writeCompat(scriptId, local);
        const { localDataUrl: _localDataUrl, ...asset } = savedAsset;
        return { asset, storage: 'local' };
      }
    },
    assetUrl: (scriptId, assetId) => {
      const local = readCompat(scriptId).assets.find((asset) => asset.id === assetId)?.localDataUrl || memoryAssets.get(assetId);
      return local || resolve(pathFor(scriptId, `/assets/${encodeURIComponent(assetId)}`));
    },
    quotePdfUrl: (scriptId, quoteId) => resolve(pathFor(scriptId, `/quotes/${encodeURIComponent(quoteId)}.pdf`)),
  };
})();
