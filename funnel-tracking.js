// Anonymous, first party funnel tracking for the FilmScript business ERP.
(() => {
  const config = window.FILMSCRIPT_CONFIG || {};
  const configuredUrl = String(
    config.erpApiUrl
      || window.FILMSCRIPT_ERP_API_URL
      || "",
  ).trim().replace(/\/$/, "");
  const endpoint = configuredUrl
    ? (configuredUrl.endsWith("/api/v1/funnel-events")
        ? configuredUrl
        : `${configuredUrl}/api/v1/funnel-events`)
    : "";
  const allowedEvents = new Set([
    "landing",
    "pricing",
    "plan_selected",
    "checkout_requested",
    "checkout_redirected",
  ]);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const visitorKey = "filmscript_visitor_id";
  const sessionKey = "filmscript_session_id";
  const attributionKey = "filmscript_first_touch_attribution";
  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

  const createUuid = () => {
    if (typeof window.crypto?.randomUUID === "function") return window.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (typeof window.crypto?.getRandomValues === "function") window.crypto.getRandomValues(bytes);
    else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };

  const persistentUuid = (storage, key) => {
    try {
      const existing = storage.getItem(key);
      if (uuidPattern.test(existing || "")) return existing;
      const created = createUuid();
      storage.setItem(key, created);
      return created;
    } catch {
      return createUuid();
    }
  };

  const cleanText = (value, maxLength = 255) => {
    const text = String(value || "").trim();
    return text ? text.slice(0, maxLength) : null;
  };

  const cleanReferrer = (value) => {
    const raw = cleanText(value, 2048);
    if (!raw) return null;
    try {
      const parsed = new URL(raw, window.location.href);
      return `${parsed.origin}${parsed.pathname}`.slice(0, 1024);
    } catch {
      return null;
    }
  };

  const query = new URLSearchParams(window.location.search || "");
  const storage = (name) => {
    try { return window[name]; } catch { return null; }
  };
  const localStorage = storage("localStorage");
  const sessionStorage = storage("sessionStorage");
  const currentUtm = Object.fromEntries(
    utmKeys
      .map((key) => [key, cleanText(query.get(key), 160)])
      .filter(([, value]) => value),
  );
  const freshAttribution = {
    ...currentUtm,
    referrer: cleanReferrer(document.referrer),
    landing_path: cleanText(window.location.pathname, 512) || "/",
    captured_at: new Date().toISOString(),
  };

  const readAttribution = () => {
    try {
      const stored = JSON.parse(localStorage?.getItem(attributionKey) || "null");
      if (stored && typeof stored === "object" && !Array.isArray(stored)) return stored;
      localStorage?.setItem(attributionKey, JSON.stringify(freshAttribution));
    } catch {}
    return freshAttribution;
  };

  const visitorId = persistentUuid(localStorage, visitorKey);
  const sessionId = persistentUuid(sessionStorage, sessionKey);
  const attribution = readAttribution();
  const environment = String(
    config.erpEnvironment
      || window.FILMSCRIPT_ERP_ENVIRONMENT
      || (/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || "") ? "test" : "live"),
  ).toLowerCase() === "test" ? "test" : "live";

  const context = () => ({
    visitorId,
    sessionId,
    attribution: { ...attribution },
  });

  const track = (eventType, details = {}) => {
    const normalizedType = String(eventType || "").trim().toLowerCase();
    if (!allowedEvents.has(normalizedType)) return null;
    const payload = {
      event_id: createUuid(),
      visitor_id: visitorId,
      session_id: sessionId,
      event_type: normalizedType,
      occurred_at: new Date().toISOString(),
      path: cleanText(window.location.pathname, 512) || "/",
      referrer: cleanReferrer(document.referrer),
      utm: Object.fromEntries(utmKeys.filter((key) => attribution[key]).map((key) => [key, attribution[key]])),
      plan: cleanText(details.plan, 64),
      cycle: cleanText(details.cycle, 32),
      environment,
    };
    if (endpoint && typeof window.fetch === "function") {
      try {
        Promise.resolve(window.fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "omit",
          keepalive: true,
        })).catch(() => {});
      } catch {}
    }
    return payload;
  };

  window.filmscriptFunnel = Object.freeze({ context, track });

  const page = (window.location.pathname.split("/").pop() || "").toLowerCase();
  if (/^features\.dc(?:\.html)?$/.test(page)) track("landing");
  if (/^pricing\.dc(?:\.html)?$/.test(page)) track("pricing");
})();
