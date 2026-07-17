import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const PRODUCT_ID = "prod_filmscript_pro_test";
const CHECKOUT_ID = "ch_filmscripttest";
const SUBSCRIPTION_ID = "su_filmscripttest";
const EMAIL = "writer@example.com";
const VISITOR_ID = "11111111-1111-4111-8111-111111111111";
const TRACKING_SESSION_ID = "22222222-2222-4222-8222-222222222222";
const WEBHOOK_SECRET_BYTES = Buffer.from("filmscript-webhook-integration-secret");
const WEBHOOK_SECRET = `whsec_${WEBHOOK_SECRET_BYTES.toString("base64")}`;

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

const readJson = async (req) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
};

const send = (res, status, payload = null) => {
  const body = payload == null ? "" : JSON.stringify(payload);
  res.writeHead(status, body ? { "Content-Type": "application/json" } : {});
  res.end(body);
};

const waitForServer = async (url, child) => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode != null) throw new Error(`FilmScript server exited with ${child.exitCode}.`);
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error("FilmScript server did not become ready.");
};

test("Google account checkout activates and cancels the matching Recurrente subscription", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-recurrente-test-"));
  let checkoutCreated = false;
  let subscriptionStatus = "active";
  let checkoutRequest = null;

  const recurrente = http.createServer(async (req, res) => {
    assert.equal(req.headers["x-secret-key"], "sk_test_integration");
    if (req.method === "POST" && req.url === "/api/checkouts") {
      checkoutRequest = await readJson(req);
      checkoutCreated = true;
      return send(res, 201, { id: CHECKOUT_ID, checkout_url: `https://checkout.example/${CHECKOUT_ID}` });
    }
    if (req.method === "GET" && req.url === `/api/checkouts/${CHECKOUT_ID}`) {
      return send(res, 200, {
        id: CHECKOUT_ID,
        status: "paid",
        metadata: { app_user_id: checkoutRequest?.metadata?.app_user_id, plan: "lumiere", product_id: PRODUCT_ID },
      });
    }
    if (req.method === "GET" && req.url?.startsWith("/api/subscriptions?")) {
      return send(res, 200, checkoutCreated ? [{
        id: SUBSCRIPTION_ID,
        status: subscriptionStatus,
        subscriber: { email: EMAIL },
        checkout: { id: CHECKOUT_ID },
        product: { id: PRODUCT_ID },
        created_at: "2026-07-12T00:00:00.000Z",
        updated_at: "2026-07-12T00:00:00.000Z",
      }] : []);
    }
    if (req.method === "GET" && req.url === `/api/subscriptions/${SUBSCRIPTION_ID}`) {
      return send(res, 200, {
        id: SUBSCRIPTION_ID,
        status: subscriptionStatus,
        subscriber: { email: EMAIL },
        checkout: { id: CHECKOUT_ID },
        product: { id: PRODUCT_ID },
      });
    }
    if (req.method === "DELETE" && req.url === `/api/subscriptions/${SUBSCRIPTION_ID}`) {
      subscriptionStatus = "canceled";
      return send(res, 204);
    }
    return send(res, 404, { message: "Not found" });
  });
  await new Promise((resolve) => recurrente.listen(0, "127.0.0.1", resolve));
  const recurrentePort = recurrente.address().port;

  const bootstrap = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import { connectGoogleIdentity, createSession } from "./database.js";
    const created = createSession();
    const user = connectGoogleIdentity(created.session.id, {
      sub: "google_integration_user",
      email: ${JSON.stringify(EMAIL)},
      name: "Writer",
      email_verified: true
    });
    console.log(JSON.stringify({ token: created.token, userId: user.id }));
  `], {
    cwd: ROOT,
    env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir },
    encoding: "utf8",
  });
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  const identity = JSON.parse(bootstrap.stdout.trim().split("\n").at(-1));

  const appPort = await freePort();
  const appUrl = `http://127.0.0.1:${appPort}`;
  const server = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(appPort),
      API_URL: appUrl,
      PUBLIC_APP_URL: appUrl,
      CORS_ORIGINS: appUrl,
      FILMSCRIPT_DATA_DIR: dataDir,
      ANTHROPIC_API_KEY: "test-key",
      RECURRENTE_API_URL: `http://127.0.0.1:${recurrentePort}/api`,
      RECURRENTE_SECRET_KEY: "sk_test_integration",
      RECURRENTE_LUMIERE_PRODUCT_ID: PRODUCT_ID,
      RECURRENTE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(async () => {
    server.kill("SIGTERM");
    await new Promise((resolve) => recurrente.close(resolve));
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  await waitForServer(appUrl, server);
  const headers = {
    "Content-Type": "application/json",
    Cookie: `filmscript_sid=${encodeURIComponent(identity.token)}`,
  };

  const invalidTrackingResponse = await fetch(`${appUrl}/api/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ plan: "lumiere", visitorId: "not-a-uuid" }),
  });
  assert.equal(invalidTrackingResponse.status, 400);
  assert.equal(checkoutRequest, null);

  const attribution = {
    utm_source: "newsletter",
    utm_campaign: "launch",
    landing_path: "/Pricing.dc.html",
    captured_at: "2026-07-16T18:00:00.000Z",
  };
  const checkoutResponse = await fetch(`${appUrl}/api/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      plan: "lumiere",
      email: "attacker@example.com",
      visitorId: VISITOR_ID,
      sessionId: TRACKING_SESSION_ID,
      attribution,
    }),
  });
  assert.equal(checkoutResponse.status, 201);
  assert.deepEqual(checkoutRequest.items, [{ product_id: PRODUCT_ID, quantity: 1 }]);
  assert.equal(checkoutRequest.metadata.product_id, PRODUCT_ID);
  assert.equal(checkoutRequest.metadata.app_user_id, identity.userId);
  assert.equal(checkoutRequest.metadata.visitor_id, VISITOR_ID);
  assert.equal(checkoutRequest.metadata.session_id, TRACKING_SESSION_ID);
  assert.deepEqual(JSON.parse(checkoutRequest.metadata.attribution), attribution);

  const webhookEvent = JSON.stringify({
    id: SUBSCRIPTION_ID,
    event_type: "subscription.create",
    customer_email: EMAIL,
  });
  const webhookId = "msg_filmscriptintegration";
  const webhookTimestamp = String(Math.floor(Date.now() / 1000));
  const webhookSignature = crypto.createHmac("sha256", WEBHOOK_SECRET_BYTES)
    .update(`${webhookId}.${webhookTimestamp}.${webhookEvent}`)
    .digest("base64");
  const webhookResponse = await fetch(`${appUrl}/api/webhooks/recurrente`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "svix-id": webhookId,
      "svix-timestamp": webhookTimestamp,
      "svix-signature": `v1,${webhookSignature}`,
    },
    body: webhookEvent,
  });
  assert.equal(webhookResponse.status, 200);

  const syncResponse = await fetch(`${appUrl}/api/billing/sync`, {
    method: "POST",
    headers,
    body: JSON.stringify({ checkoutId: CHECKOUT_ID }),
  });
  assert.equal(syncResponse.status, 200);
  const synced = await syncResponse.json();
  assert.equal(synced.plan, "lumiere");
  assert.equal(synced.billing.subscriptionLinked, true);

  const manageResponse = await fetch(`${appUrl}/api/subscription/manage`, { headers });
  assert.equal(manageResponse.status, 200);
  const management = await manageResponse.json();
  assert.equal(management.active, true);
  assert.equal(management.cancelMode, "recurrente");
  assert.equal(management.subscriptionLinked, true);
  assert.equal("manageUrl" in management, false);

  const cancelResponse = await fetch(`${appUrl}/api/subscription/cancel`, {
    method: "POST",
    headers,
    body: JSON.stringify({ confirm: true, mode: "recurrente" }),
  });
  assert.equal(cancelResponse.status, 200);
  assert.equal(subscriptionStatus, "canceled");

  const accountResponse = await fetch(`${appUrl}/api/me`, { headers });
  const account = await accountResponse.json();
  assert.equal(account.plan, null);
  assert.equal(account.status, "canceled");

  const lumiereAfterCancel = await fetch(`${appUrl}/api/lumiere`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages: [{ role: "user", content: "Analyze my screenplay." }] }),
  });
  assert.equal(lumiereAfterCancel.status, 403);
  const blocked = await lumiereAfterCancel.json();
  assert.equal(blocked.error, "filmscript_pro_required");
  assert.match(blocked.message, /edit and export/i);
});
