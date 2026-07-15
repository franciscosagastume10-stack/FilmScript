const base = String(process.env.RECURRENTE_API_URL || "https://app.recurrente.com/api").replace(/\/$/, "");
const secretKey = String(process.env.RECURRENTE_SECRET_KEY || "").trim();
const publicApiUrl = String(process.env.API_URL || process.env.PUBLIC_APP_URL || "").replace(/\/$/, "");

if (!secretKey) throw new Error("RECURRENTE_SECRET_KEY is required.");
if (!publicApiUrl) throw new Error("API_URL is required.");

const target = new URL("/api/webhooks/recurrente", publicApiUrl);
const localHosts = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);
if (target.protocol !== "https:" || localHosts.has(target.hostname)) {
  throw new Error("API_URL must be a public HTTPS address before registering the webhook.");
}

const request = async (pathname, options = {}) => {
  const response = await fetch(`${base}${pathname}`, {
    ...options,
    headers: {
      "X-SECRET-KEY": secretKey,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!response.ok) throw new Error(data?.message || data?.error || `Recurrente returned ${response.status}.`);
  return data;
};

const payload = await request("/webhook_endpoints", {
  method: "POST",
  body: JSON.stringify({
    url: target.toString(),
    description: "FilmScript billing events",
    metadata: { application: "filmscript" },
  }),
});

const endpoint = payload?.data || payload;
console.log(`Recurrente webhook created: ${endpoint.id || "created"}`);
console.log(`URL: ${target}`);
if (endpoint.signingSecret) {
  console.log("Save this value immediately in the backend secret manager. Recurrente only returns it once:");
  console.log(`RECURRENTE_WEBHOOK_SECRET=${endpoint.signingSecret}`);
}
