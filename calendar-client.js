(() => {
  const resolve = (path) => window.filmscriptApiUrl ? window.filmscriptApiUrl(path) : path;
  const request = async (path, options = {}) => {
    let response;
    try {
      response = await fetch(resolve(path), { credentials: "include", ...options });
    } catch (cause) {
      const error = new Error(window.location?.protocol === "file:"
        ? "Calendar needs the FilmScript local server. Open the app through http://localhost:4173 or start the local server, then try again."
        : "FilmScript could not reach the Calendar service. Check the connection and try again.");
      error.code = "calendar_network_error";
      error.cause = cause;
      throw error;
    }
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
  const cacheKey = (scriptId) => `filmscript_calendar_${String(scriptId || "").trim()}`;
  const cachedCalendar = (scriptId) => {
    try {
      const raw = window.localStorage.getItem(cacheKey(scriptId));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const cacheCalendar = (scriptId, calendar) => {
    try { window.localStorage.setItem(cacheKey(scriptId), JSON.stringify(calendar)); } catch { /* Storage can be unavailable in private browsing. */ }
    return { ok: true, calendar, storage: "local" };
  };
  // Some deployed API revisions expose the production workspace but reject
  // the newer Calendar PATCH route with 405. Treat both responses as an
  // unavailable optional route: the calendar stays fully usable and is saved
  // on the device until account-backed Calendar persistence is available.
  const missingCalendarRoute = (error) => [404, 405].includes(Number(error?.status));

  // Older production API releases did not expose the dedicated Calendar route
  // (or only allowed GET on it).
  // Keep the production workspace usable (and never surface a dead-end 404)
  // while that service is being rolled forward. As soon as the route exists,
  // every request automatically returns to account-backed persistence.
  const getCalendar = async (scriptId) => {
    try {
      return await request(calendarPath(scriptId));
    } catch (error) {
      if (!missingCalendarRoute(error)) throw error;
      return { calendar: cachedCalendar(scriptId), storage: "local" };
    }
  };
  const saveCalendar = async (scriptId, calendar) => {
    try {
      return await request(calendarPath(scriptId), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ calendar }),
      });
    } catch (error) {
      if (!missingCalendarRoute(error)) throw error;
      return cacheCalendar(scriptId, calendar);
    }
  };

  window.filmscriptCalendar = {
    get: getCalendar,
    save: saveCalendar,
  };
})();
