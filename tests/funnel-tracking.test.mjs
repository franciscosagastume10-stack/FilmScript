import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trackerSource = fs.readFileSync(path.join(root, "funnel-tracking.js"), "utf8");
const billingSource = fs.readFileSync(path.join(root, "billing-client.js"), "utf8");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function trackerHarness({
  pathname = "/Features.dc.html",
  search = "",
  referrer = "",
  localStorage = memoryStorage(),
  sessionStorage = memoryStorage(),
  erpApiUrl = "https://erp.filmscript.test",
  uuids = [
    "11111111-1111-4111-8111-111111111111",
    "22222222-2222-4222-8222-222222222222",
    "33333333-3333-4333-8333-333333333333",
    "44444444-4444-4444-8444-444444444444",
  ],
} = {}) {
  const requests = [];
  let uuidIndex = 0;
  const window = {
    FILMSCRIPT_CONFIG: { erpApiUrl, erpEnvironment: "test" },
    location: {
      pathname,
      search,
      hostname: "filmscript.test",
      href: `https://filmscript.test${pathname}${search}`,
    },
    localStorage,
    sessionStorage,
    crypto: { randomUUID: () => uuids[uuidIndex++] },
    fetch: async (url, options) => {
      requests.push({ url, options, payload: JSON.parse(options.body) });
      return { ok: true };
    },
  };
  vm.runInNewContext(trackerSource, {
    window,
    document: { referrer },
    URL,
    URLSearchParams,
    Uint8Array,
  });
  return { window, requests };
}

test("landing and pricing tracking use anonymous stable IDs and first-touch attribution", () => {
  const localStorage = memoryStorage();
  const sessionStorage = memoryStorage();
  const landing = trackerHarness({
    pathname: "/Features.dc.html",
    search: "?utm_source=instagram&utm_campaign=launch",
    referrer: "https://search.example/results?q=screenplay",
    localStorage,
    sessionStorage,
  });

  assert.equal(landing.requests.length, 1);
  assert.equal(landing.requests[0].url, "https://erp.filmscript.test/api/v1/funnel-events");
  assert.equal(landing.requests[0].options.keepalive, true);
  assert.deepEqual(landing.requests[0].payload, {
    event_id: "33333333-3333-4333-8333-333333333333",
    visitor_id: "11111111-1111-4111-8111-111111111111",
    session_id: "22222222-2222-4222-8222-222222222222",
    event_type: "landing",
    occurred_at: landing.requests[0].payload.occurred_at,
    path: "/Features.dc.html",
    referrer: "https://search.example/results",
    utm: { utm_source: "instagram", utm_campaign: "launch" },
    plan: null,
    cycle: null,
    environment: "test",
  });

  landing.window.filmscriptFunnel.track("plan_selected", { plan: "lumiere", cycle: "monthly" });
  assert.equal(landing.requests[1].payload.event_type, "plan_selected");
  assert.equal(landing.requests[1].payload.plan, "lumiere");

  const pricing = trackerHarness({
    pathname: "/Pricing.dc.html",
    localStorage,
    sessionStorage,
    uuids: [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    ],
  });
  assert.equal(pricing.requests[0].payload.event_type, "pricing");
  assert.equal(pricing.requests[0].payload.visitor_id, "11111111-1111-4111-8111-111111111111");
  assert.equal(pricing.requests[0].payload.session_id, "22222222-2222-4222-8222-222222222222");
  assert.deepEqual(pricing.requests[0].payload.utm, { utm_source: "instagram", utm_campaign: "launch" });
});

test("a direct pricing visit starts the funnel once before recording pricing", () => {
  const direct = trackerHarness({ pathname: "/Pricing.dc.html" });
  assert.deepEqual(
    direct.requests.map(({ payload }) => payload.event_type),
    ["landing", "pricing"],
  );
});

test("tracking is a silent no-op when the ERP URL is absent", () => {
  const tracking = trackerHarness({ erpApiUrl: "" });
  assert.equal(tracking.requests.length, 0);
  const payload = tracking.window.filmscriptFunnel.track("checkout_requested", {
    plan: "lumiere",
    cycle: "monthly",
  });
  assert.equal(payload.event_type, "checkout_requested");
  assert.equal(tracking.requests.length, 0);
});

test("checkout preserves its response while forwarding tracking context", async () => {
  const funnelEvents = [];
  const apiRequests = [];
  const tracking = {
    visitorId: "11111111-1111-4111-8111-111111111111",
    sessionId: "22222222-2222-4222-8222-222222222222",
    attribution: {
      utm_source: "newsletter",
      landing_path: "/Features.dc.html",
      captured_at: "2026-07-16T12:00:00.000Z",
    },
  };
  const window = {
    location: {
      pathname: "/Pricing.dc.html",
      search: "",
      href: "https://filmscript.test/Pricing.dc.html",
    },
    history: { replaceState: () => {} },
    dispatchEvent: () => {},
    filmscriptFunnel: {
      context: () => tracking,
      track: (eventType, details) => funnelEvents.push({ eventType, details }),
    },
    filmscriptApiUrl: (pathname) => `https://api.filmscript.test${pathname}`,
  };
  vm.runInNewContext(billingSource, {
    window,
    URLSearchParams,
    CustomEvent: class CustomEvent {},
    fetch: async (url, options) => {
      apiRequests.push({ url, body: JSON.parse(options.body) });
      return {
        ok: true,
        status: 201,
        json: async () => ({
          checkoutId: "ch_test",
          checkoutUrl: "https://checkout.example/ch_test",
        }),
      };
    },
  });

  const result = await window.filmscriptBilling.checkout("lumiere", "writer@example.com");
  assert.equal(result.checkoutId, "ch_test");
  assert.deepEqual(apiRequests[0].body, {
    plan: "lumiere",
    email: "writer@example.com",
    visitorId: tracking.visitorId,
    sessionId: tracking.sessionId,
    attribution: tracking.attribution,
  });
  assert.deepEqual(JSON.parse(JSON.stringify(funnelEvents[0])), {
    eventType: "checkout_requested",
    details: { plan: "lumiere", cycle: "monthly" },
  });

  window.filmscriptBilling.trackCheckoutRedirected("lumiere");
  assert.deepEqual(JSON.parse(JSON.stringify(funnelEvents[1])), {
    eventType: "checkout_redirected",
    details: { plan: "lumiere", cycle: "monthly" },
  });
});

test("all checkout surfaces load and emit shared funnel events", () => {
  for (const page of ["Features.dc.html", "Pricing.dc.html", "App.dc.html"]) {
    const source = read(page);
    assert.match(source, /funnel-tracking\.js\?v=/, page);
    assert.match(source, /track\?\.\('plan_selected'/, page);
    assert.match(source, /billing-client\.js\?v=20260717-erp2/, page);
    assert.match(source, /trackCheckoutRedirected\?\.\(this\.state\.checkoutPlan\)/, page);
  }
  assert.match(read("scripts/build-netlify.mjs"), /"funnel-tracking\.js"/);
  assert.match(read("scripts/build-netlify.mjs"), /process\.env\.ERP_API_URL/);
});
