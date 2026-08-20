import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const EMAIL = "upgrade-writer@example.com";
const CREATOR_PRODUCT_ID = "prod_filmscript_creator_proration_test";
const FULL_PRODUCT_ID = "prod_filmscript_full_proration_test";
const SUBSCRIPTION_ID = "sub_filmscript_proration_test";

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

const stopServer = async (child) => {
  if (!child || child.exitCode != null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await exited;
};

test("subscription switches use a one-time native Recurrente proration update and keep credit usage", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-proration-test-"));
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const cycleKey = `provider:${periodStart.getTime()}:${periodEnd.getTime()}`;
  const textPeriod = now.toISOString().slice(0, 7);
  const bootstrap = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import {
      connectGoogleIdentity,
      createSession,
      loadBillingSnapshot,
      saveBillingSnapshot,
      saveLumiereCreditsSnapshot,
    } from "./database.js";
    const created = createSession();
    const user = connectGoogleIdentity(created.session.id, {
      sub: "google_proration_user",
      email: ${JSON.stringify(EMAIL)},
      name: "Upgrade Writer",
      email_verified: true,
    });
    const billing = loadBillingSnapshot();
    billing.users[user.id].subscription = {
      plan: "creator",
      status: "active",
      checkoutId: null,
      subscriptionId: ${JSON.stringify(SUBSCRIPTION_ID)},
      billingCycleKey: ${JSON.stringify(cycleKey)},
      currentPeriodStart: ${JSON.stringify(periodStart.toISOString())},
      currentPeriodEnd: ${JSON.stringify(periodEnd.toISOString())},
      updatedAt: new Date().toISOString(),
    };
    saveBillingSnapshot(billing);
    saveLumiereCreditsSnapshot({
      [user.id]: {
        period: ${JSON.stringify(textPeriod)},
        used: 12,
        imageCredits: {
          period: ${JSON.stringify(cycleKey)},
          used: 20,
          usageByPeriod: { ${JSON.stringify(cycleKey)}: 20 },
          reservations: {},
        },
      },
    });
    console.log(JSON.stringify({ token: created.token, userId: user.id }));
  `], {
    cwd: ROOT,
    env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir },
    encoding: "utf8",
  });
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  const identity = JSON.parse(bootstrap.stdout.trim().split("\n").at(-1));

  let activeProductId = CREATOR_PRODUCT_ID;
  let previewChargeable = true;
  let previewCalls = 0;
  let updateCalls = 0;
  let deleteCalls = 0;
  const updates = [];
  const subscription = () => ({
    id: SUBSCRIPTION_ID,
    status: "active",
    subscriber: { email: EMAIL },
    product: { id: activeProductId },
    current_period_start: periodStart.toISOString(),
    current_period_end: periodEnd.toISOString(),
    updated_at: new Date().toISOString(),
  });
  const recurrente = http.createServer(async (req, res) => {
    assert.equal(req.headers["x-secret-key"], "sk_test_proration");
    if (req.method === "GET" && req.url === `/api/subscriptions/${SUBSCRIPTION_ID}`) return send(res, 200, subscription());
    if (req.method === "GET" && req.url?.startsWith("/api/subscriptions?")) return send(res, 200, [subscription()]);
    if (req.method === "POST" && req.url === `/api/subscriptions/${SUBSCRIPTION_ID}/proration_preview`) {
      const payload = await readJson(req);
      previewCalls += 1;
      assert.deepEqual(payload.items, [
        { product_id: activeProductId, deleted: true },
        { product_id: activeProductId === CREATOR_PRODUCT_ID ? FULL_PRODUCT_ID : CREATOR_PRODUCT_ID, quantity: 1 },
      ]);
      assert.equal(payload.mode, "now_and_charge");
      return send(res, 200, {
        net_amount_in_cents: previewChargeable ? 750 : 0,
        currency: "USD",
        chargeable: previewChargeable,
      });
    }
    if (req.method === "PUT" && req.url === `/api/subscriptions/${SUBSCRIPTION_ID}`) {
      const payload = await readJson(req);
      updateCalls += 1;
      updates.push({ payload, idempotencyKey: req.headers["idempotency-key"] });
      assert.ok(req.headers["idempotency-key"]);
      const target = payload.items.find((item) => item.quantity === 1)?.product_id;
      assert.ok([CREATOR_PRODUCT_ID, FULL_PRODUCT_ID].includes(target));
      activeProductId = target;
      return send(res, 200, subscription());
    }
    if (req.method === "DELETE" && req.url === `/api/subscriptions/${SUBSCRIPTION_ID}`) {
      deleteCalls += 1;
      return send(res, 204);
    }
    return send(res, 404, { message: "Not found" });
  });
  await new Promise((resolve) => recurrente.listen(0, "127.0.0.1", resolve));
  const recurrentePort = recurrente.address().port;

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
      OPENAI_API_KEY: "",
      RECURRENTE_API_URL: `http://127.0.0.1:${recurrentePort}/api`,
      RECURRENTE_SECRET_KEY: "sk_test_proration",
      RECURRENTE_CREATOR_PRODUCT_ID: CREATOR_PRODUCT_ID,
      RECURRENTE_FULL_PRODUCT_ID: FULL_PRODUCT_ID,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    await stopServer(server);
    await new Promise((resolve) => recurrente.close(resolve));
    await fs.rm(dataDir, { recursive: true, force: true });
  });
  await waitForServer(appUrl, server);
  const headers = {
    "Content-Type": "application/json",
    Cookie: `filmscript_sid=${encodeURIComponent(identity.token)}`,
  };

  const beforeCredits = await fetch(`${appUrl}/api/credits`, { headers });
  assert.equal(beforeCredits.status, 200);
  const before = await beforeCredits.json();
  assert.equal(before.text.month.used, 12);
  assert.equal(before.image.used, 20);
  assert.equal(before.image.limit, 100);

  const upgradePreviewResponse = await fetch(`${appUrl}/api/subscription/switch/preview`, {
    method: "POST",
    headers,
    body: JSON.stringify({ plan: "full" }),
  });
  assert.equal(upgradePreviewResponse.status, 200);
  const upgradePreview = await upgradePreviewResponse.json();
  assert.equal(upgradePreview.fromPlan, "creator");
  assert.equal(upgradePreview.toPlan, "full");
  assert.equal(upgradePreview.mode, "now_and_charge");
  assert.deepEqual(upgradePreview.charge, { chargeable: true, amountInCents: 750, currency: "USD" });
  assert.equal(upgradePreview.creditUsagePreserved, true);
  assert.ok(upgradePreview.switchToken);
  assert.equal(previewCalls, 1);
  assert.equal(updateCalls, 0);
  assert.equal(deleteCalls, 0);

  const unconfirmedResponse = await fetch(`${appUrl}/api/subscription/switch`, {
    method: "POST",
    headers,
    body: JSON.stringify({ switchToken: upgradePreview.switchToken }),
  });
  assert.equal(unconfirmedResponse.status, 400);
  assert.equal(updateCalls, 0);

  const upgradeResponse = await fetch(`${appUrl}/api/subscription/switch`, {
    method: "POST",
    headers,
    body: JSON.stringify({ confirm: true, plan: "full", switchToken: upgradePreview.switchToken }),
  });
  assert.equal(upgradeResponse.status, 200);
  const upgraded = await upgradeResponse.json();
  assert.equal(upgraded.applied, true);
  assert.equal(upgraded.idempotent, false);
  assert.equal(upgraded.mode, "now_and_charge");
  assert.equal(updateCalls, 1);
  assert.equal(deleteCalls, 0);
  assert.deepEqual(updates[0].payload, {
    items: [
      { product_id: CREATOR_PRODUCT_ID, deleted: true },
      { product_id: FULL_PRODUCT_ID, quantity: 1 },
    ],
    mode: "now_and_charge",
  });

  const duplicateConfirm = await fetch(`${appUrl}/api/subscription/switch`, {
    method: "POST",
    headers,
    body: JSON.stringify({ confirm: true, switchToken: upgradePreview.switchToken }),
  });
  assert.equal(duplicateConfirm.status, 200);
  assert.equal((await duplicateConfirm.json()).idempotent, true);
  assert.equal(updateCalls, 1);
  assert.equal(deleteCalls, 0);

  const afterUpgradeCredits = await fetch(`${appUrl}/api/credits`, { headers });
  const afterUpgrade = await afterUpgradeCredits.json();
  assert.equal(afterUpgrade.text.month.used, 12);
  assert.equal(afterUpgrade.image.used, 20);
  assert.equal(afterUpgrade.image.limit, 1000);

  // A provider preview that is not chargeable must still update the existing
  // subscription with native `now`; it must never create a full-price checkout.
  previewChargeable = false;
  const downgradePreviewResponse = await fetch(`${appUrl}/api/subscription/switch/preview`, {
    method: "POST",
    headers,
    body: JSON.stringify({ plan: "creator" }),
  });
  assert.equal(downgradePreviewResponse.status, 200);
  const downgradePreview = await downgradePreviewResponse.json();
  assert.equal(downgradePreview.mode, "now");
  assert.deepEqual(downgradePreview.charge, { chargeable: false, amountInCents: 0, currency: "USD" });

  const downgradeResponse = await fetch(`${appUrl}/api/subscription/switch`, {
    method: "POST",
    headers,
    body: JSON.stringify({ confirm: true, switchToken: downgradePreview.switchToken }),
  });
  assert.equal(downgradeResponse.status, 200);
  assert.equal(updateCalls, 2);
  assert.equal(deleteCalls, 0);
  assert.equal(updates[1].payload.mode, "now");
  assert.equal(updates[1].payload.items[1].product_id, CREATOR_PRODUCT_ID);

  const afterDowngradeCredits = await fetch(`${appUrl}/api/credits`, { headers });
  const afterDowngrade = await afterDowngradeCredits.json();
  assert.equal(afterDowngrade.text.month.used, 12);
  assert.equal(afterDowngrade.image.used, 20);
  assert.equal(afterDowngrade.image.limit, 100);
});
