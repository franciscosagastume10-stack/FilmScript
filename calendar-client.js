(() => {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const request = async (path, options = {}) => {
    const response = await fetch(resolve(path), { credentials: "include", ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `Calendar error ${response.status}`);
      error.code = data.error || null;
      error.status = response.status;
      if (response.status === 401) window.dispatchEvent(new CustomEvent("filmscript:auth-required"));
      throw error;
    }
    return data;
  };

  const calendarPath = (scriptId) => `/api/scripts/${encodeURIComponent(scriptId)}/preproduction/calendar`;
  window.filmscriptCalendar = {
    get: (scriptId) => request(calendarPath(scriptId)),
    save: (scriptId, calendar) => request(calendarPath(scriptId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendar }),
    }),
  };
})();
