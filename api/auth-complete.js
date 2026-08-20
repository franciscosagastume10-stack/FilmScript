const AUTH_BACKEND = "https://api.filmscript.app";

function setCookieHeaders(headers) {
  if (typeof headers?.getSetCookie === "function") return headers.getSetCookie();
  const value = headers?.get?.("set-cookie");
  return value ? [value] : [];
}

// Finish OAuth on filmscript.app itself. External Vercel rewrites can return
// the JSON response while dropping or re-scoping Set-Cookie, which leaves the
// Scripts guard looking at an anonymous session after a successful Google
// callback. This tiny same-origin proxy forwards the one-time exchange and
// writes every cookie on the official app response.
export default async function authComplete(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Allow", "GET");
    return res.end("Method Not Allowed");
  }

  const requestUrl = new URL(req.url || "/api/auth/complete", "https://filmscript.app");
  const handoff = String(requestUrl.searchParams.get("handoff") || "");
  if (!/^[A-Za-z0-9_-]{20,256}$/.test(handoff)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ error: "invalid_auth_handoff" }));
  }

  try {
    const upstream = await fetch(`${AUTH_BACKEND}/api/auth/complete?handoff=${encodeURIComponent(handoff)}`, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(12_000),
      headers: {
        Accept: "application/json",
        "User-Agent": String(req.headers?.["user-agent"] || "FilmScript Auth Handoff"),
      },
    });
    const payload = Buffer.from(await upstream.arrayBuffer());
    const cookies = setCookieHeaders(upstream.headers);

    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Length", String(payload.length));
    if (cookies.length) res.setHeader("Set-Cookie", cookies);
    return res.end(payload);
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ error: "auth_handoff_unavailable" }));
  }
}
