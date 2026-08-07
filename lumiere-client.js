// Lumiere connection: every browser-side Lumiere action uses this one safe
// proxy. The OpenRouter credential never leaves the FilmScript server.
(() => {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const interfaceLanguage = () => {
    const language = window.filmscriptLanguage?.get?.();
    if (language === 'es' || language === 'en') return language;
    try { return localStorage.getItem('filmscript_language') === 'es' ? 'es' : 'en'; } catch { return 'en'; }
  };
  const lumiere = window.lumiere || {};
  window.lumiere = lumiere;
  lumiere.complete = async ({ messages, maxTokens, surface = 'workspace' } = {}) => {
    const res = await fetch(resolve("/api/lumiere"), {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, maxTokens, surface, language: interfaceLanguage() }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) window.dispatchEvent(new CustomEvent('filmscript:auth-required'));
      if ((res.status === 402 || res.status === 403) && data.error === 'filmscript_pro_required') {
        window.dispatchEvent(new CustomEvent('filmscript:pro-required', { detail: data }));
      }
      throw new Error(data.message || data.error || "Lumiere proxy error " + res.status);
    }
    const data = await res.json();
    return data.reply || "";
  };
})();
