(() => {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const request = async (path, options = {}) => {
    const response = await fetch(resolve(path), { credentials: 'include', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `Budget error ${response.status}`);
      error.code = data.error || null;
      error.status = response.status;
      if (response.status === 401) window.dispatchEvent(new CustomEvent('filmscript:auth-required'));
      throw error;
    }
    return data;
  };
  const budgetPath = (scriptId, suffix = '') => `/api/scripts/${encodeURIComponent(scriptId)}/preproduction/budget${suffix}`;
  window.filmscriptBudget = {
    get: (scriptId) => request(budgetPath(scriptId)),
    save: (scriptId, budget) => request(budgetPath(scriptId), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget }),
    }),
    uploadReceipt: async (scriptId, blob, filename) => {
      const response = await fetch(resolve(budgetPath(scriptId, '/receipts')), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': blob.type || 'image/webp',
          'X-Filename': encodeURIComponent(filename || 'receipt.webp'),
        },
        body: blob,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || `Receipt error ${response.status}`);
      return data;
    },
    receiptUrl: (scriptId, receiptId) => resolve(budgetPath(scriptId, `/receipts/${encodeURIComponent(receiptId)}`)),
    exportUrl: (scriptId) => resolve(budgetPath(scriptId, '.pdf')),
  };
})();
