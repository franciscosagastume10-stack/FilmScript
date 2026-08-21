import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const freePort = () => new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close(() => resolve(port));
  });
});

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child.exitCode != null) throw new Error(`FilmScript server exited with ${child.exitCode}`);
    try { if ((await fetch(`${url}/api/health`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error("FilmScript server did not start");
}

async function startServer(dataDir) {
  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server.js"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      API_URL: url,
      PUBLIC_APP_URL: url,
      CORS_ORIGINS: url,
      FILMSCRIPT_DATA_DIR: dataDir,
      FILMSCRIPT_PREVIEW_MODE: "false",
      FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
      OPENAI_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(url, child);
  return { child, url };
}

async function stopServer(child) {
  if (!child || child.exitCode != null) return;
  const stopped = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await stopped;
}

async function requestJson(url, cookie = "", options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) },
  });
  return { response, data: await response.json().catch(() => ({})) };
}

test("account Imagine works without a project and remains private to its signed-in owner", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-account-imaging-"));
  const bootstrap = spawnSync(process.execPath, ["--input-type=module", "--eval", `
    import {
      claimAccountImagingGeneration,
      completeAccountImagingGeneration,
      connectGoogleIdentity,
      createSession,
      saveCanvasLibrary,
    } from "./database.js";
    import { hashText } from "./analysis-model.js";
    import { __canvasTesting as canvas } from "./server.js";

    const legacyFingerprint = (prompt) => hashText(JSON.stringify({
      prompt,
      size: "1536x1024",
      orientation: "horizontal",
      style: "cinematic",
      quality: "low",
      camera: "",
      lens: "",
      focalLength: "",
      referenceAssetIds: [],
    }));

    const firstSession = createSession();
    const first = connectGoogleIdentity(firstSession.session.id, {
      sub: "account-imaging-a",
      email: "account-imaging-a@example.test",
      name: "Imaging A",
      email_verified: true,
    });
    const secondSession = createSession();
    const second = connectGoogleIdentity(secondSession.session.id, {
      sub: "account-imaging-b",
      email: "account-imaging-b@example.test",
      name: "Imaging B",
      email_verified: true,
    });
    saveCanvasLibrary(first.id, {
      customMarker: "keep-account-library-fields",
      vaultItems: [{ id: "vlt_aaaaaaaa", name: "Private Vault item" }],
      assets: [{
        id: "cas_aaaaaaaa",
        provider: "local",
        key: "private/non-imaging.png",
        mimeType: "image/png",
        filename: "Vault only.png",
        source: "upload",
        createdAt: new Date().toISOString(),
      }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const generatedPrompt = "A private idempotent account image";
    const generated = await canvas.storeGeneratedAccountImagingAsset(
      first.id,
      jpeg,
      generatedPrompt,
      {
        size: "1536x1024",
        generation: {
          requestId: "imagine-job_deadbeef",
          requestFingerprint: legacyFingerprint(generatedPrompt),
          quality: "low",
          style: "cinematic",
        },
      },
    );
    const completedPrompt = "A durable legacy completed account image";
    const completedClaim = claimAccountImagingGeneration({
      userId: first.id,
      requestId: "imagine-job_cafebabe",
      fingerprint: legacyFingerprint(completedPrompt),
    });
    completeAccountImagingGeneration({
      userId: first.id,
      requestId: "imagine-job_cafebabe",
      leaseToken: completedClaim.generation.leaseToken,
      assetId: generated.id,
      result: {
        asset: generated,
        model: "gpt-image-2",
        quality: "low",
      },
    });
    const pendingPrompt = "A durable legacy pending account image";
    claimAccountImagingGeneration({
      userId: first.id,
      requestId: "imagine-job_badc0ffe",
      fingerprint: legacyFingerprint(pendingPrompt),
    });
    console.log(JSON.stringify({
      first: { id: first.id, token: firstSession.token },
      second: { id: second.id, token: secondSession.token },
      generated,
      completedPrompt,
      pendingPrompt,
    }));
  `], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      FILMSCRIPT_DATA_DIR: dataDir,
      FILMSCRIPT_PREVIEW_MODE: "false",
      FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
    },
  });
  assert.equal(bootstrap.status, 0, bootstrap.stderr || bootstrap.stdout);
  const state = JSON.parse(bootstrap.stdout.trim().split("\n").at(-1));
  assert.match(state.generated.filename, /^Imagine — /);
  assert.equal(state.generated.mediaMode, "image");
  assert.equal(state.generated.modelId, "imagine-image-v1");
  assert.equal(state.generated.generation.mediaMode, "image");
  assert.equal(state.generated.generation.modelId, "imagine-image-v1");
  const firstCookie = `filmscript_sid=${encodeURIComponent(state.first.token)}`;
  const secondCookie = `filmscript_sid=${encodeURIComponent(state.second.token)}`;
  let running = await startServer(dataDir);
  t.after(async () => {
    await stopServer(running?.child);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const unauthenticatedWorkspace = await requestJson(`${running.url}/api/me/imaging`);
  assert.equal(unauthenticatedWorkspace.response.status, 401);
  assert.equal(unauthenticatedWorkspace.data.error, "google_sign_in_required");
  const unauthenticatedUpload = await requestJson(`${running.url}/api/me/imaging/assets`, "", {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: Buffer.from("not read without a session"),
  });
  assert.equal(unauthenticatedUpload.response.status, 401);
  assert.equal((await fetch(`${running.url}/api/me/imaging/assets/${state.generated.id}`)).status, 401);
  const unauthenticatedGeneration = await requestJson(`${running.url}/api/me/imaging/images/generate`, "", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "An unauthenticated account image request" }),
  });
  assert.equal(unauthenticatedGeneration.response.status, 401);

  const legacyPage = await fetch(`${running.url}/Imaging.dc.html?from=legacy`, { redirect: "manual" });
  assert.equal(legacyPage.status, 308);
  assert.equal(legacyPage.headers.get("location"), "/Imagine.dc.html?from=legacy");
  assert.equal((await fetch(`${running.url}/Imagine.dc.html`)).status, 200);

  const firstScripts = await requestJson(`${running.url}/api/scripts`, firstCookie);
  assert.equal(firstScripts.response.status, 200);
  assert.deepEqual(firstScripts.data.scripts, []);

  const firstWorkspace = await requestJson(`${running.url}/api/me/imaging`, firstCookie);
  assert.equal(firstWorkspace.response.status, 200);
  assert.equal(firstWorkspace.data.workspace.accessScope, "account_imaging");
  assert.equal(firstWorkspace.data.workspace.productName, "Imagine");
  assert.equal(firstWorkspace.data.workspace.accountScoped, true);
  assert.equal(firstWorkspace.data.workspace.ownerUserId, state.first.id);
  assert.deepEqual(firstWorkspace.data.workspace.capabilities, {
    mediaModes: [{ id: "image", label: "Image", enabled: true }],
    models: [{ id: "imagine-image-v1", label: "Imagine Image", mediaMode: "image", enabled: true }],
    imageModels: [{ id: "imagine-image-v1", label: "Imagine Image", mediaMode: "image", enabled: true }],
    defaults: { mediaMode: "image", modelId: "imagine-image-v1" },
  });
  assert.doesNotMatch(JSON.stringify(firstWorkspace.data.workspace), /gpt-image/i);
  assert.equal("boards" in firstWorkspace.data.workspace, false);
  assert.equal("vaultItems" in firstWorkspace.data.workspace, false);
  assert.deepEqual(firstWorkspace.data.workspace.assets.map((asset) => asset.id), [state.generated.id]);
  assert.equal(firstWorkspace.data.workspace.assets[0].createdBy, state.first.id);
  assert.equal(firstWorkspace.data.workspace.assets[0].ownerUserId, state.first.id);
  assert.equal(firstWorkspace.data.workspace.assets[0].mediaMode, "image");
  assert.equal(firstWorkspace.data.workspace.assets[0].modelId, "imagine-image-v1");
  assert.equal(firstWorkspace.data.workspace.assets[0].generation.mediaMode, "image");
  assert.equal(firstWorkspace.data.workspace.assets[0].generation.modelId, "imagine-image-v1");
  assert.equal("key" in firstWorkspace.data.workspace.assets[0], false);

  const secondWorkspace = await requestJson(`${running.url}/api/me/imaging`, secondCookie);
  assert.equal(secondWorkspace.response.status, 200);
  assert.deepEqual(secondWorkspace.data.workspace.assets, []);
  const crossAccountGeneratedRead = await fetch(
    `${running.url}/api/me/imaging/assets/${state.generated.id}`,
    { headers: { Cookie: secondCookie } },
  );
  assert.equal(crossAccountGeneratedRead.status, 404);

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const upload = await requestJson(`${running.url}/api/me/imaging/assets`, firstCookie, {
    method: "POST",
    headers: {
      "Content-Type": "image/png",
      "X-Filename": encodeURIComponent("account-reference.png"),
      "X-Image-Width": "1",
      "X-Image-Height": "1",
    },
    body: png,
  });
  assert.equal(upload.response.status, 201);
  assert.match(upload.data.asset.id, /^cas_[a-f0-9]+$/);
  assert.equal(upload.data.asset.source, "imagine_reference");
  assert.equal(upload.data.asset.createdBy, state.first.id);
  assert.equal(upload.data.asset.ownerUserId, state.first.id);
  assert.equal(upload.data.asset.mediaMode, "image");
  assert.equal(upload.data.asset.modelId, "");
  assert.equal(upload.data.asset.generation.mediaMode, "image");
  assert.equal(upload.data.asset.generation.modelId, "");
  assert.equal("key" in upload.data.asset, false);

  const uploadedImage = await fetch(
    `${running.url}/api/me/imaging/assets/${upload.data.asset.id}`,
    { headers: { Cookie: firstCookie } },
  );
  assert.equal(uploadedImage.status, 200);
  assert.equal(uploadedImage.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await uploadedImage.arrayBuffer()), png);
  assert.equal((await fetch(
    `${running.url}/api/me/imaging/assets/${upload.data.asset.id}`,
    { headers: { Cookie: secondCookie } },
  )).status, 404);

  const creditsBefore = await requestJson(`${running.url}/api/credits`, firstCookie);
  const unsupportedMode = await requestJson(`${running.url}/api/me/imaging/images/generate`, firstCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: "imagine-job_deadbeef",
      prompt: "A future account-scoped video generation request",
      mediaMode: "video",
    }),
  });
  assert.equal(unsupportedMode.response.status, 422);
  assert.deepEqual(unsupportedMode.data, {
    error: "imaging_media_mode_unsupported",
    message: "Imagine currently supports image generation only.",
    mediaMode: "video",
    supportedMediaModes: ["image"],
  });
  const unsupportedModel = await requestJson(`${running.url}/api/me/imaging/images/generate`, firstCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: "imagine-job_deadbeef",
      prompt: "An account-scoped image using an unavailable model",
      mediaMode: "image",
      modelId: "future-image-model",
    }),
  });
  assert.equal(unsupportedModel.response.status, 422);
  assert.deepEqual(unsupportedModel.data, {
    error: "imaging_model_unsupported",
    message: "This Imagine image model is not supported.",
    modelId: "future-image-model",
    supportedModelIds: ["imagine-image-v1"],
  });
  const creditsAfterUnsupportedRequests = await requestJson(`${running.url}/api/credits`, firstCookie);
  assert.deepEqual(creditsAfterUnsupportedRequests.data.image, creditsBefore.data.image);
  const retry = await requestJson(`${running.url}/api/me/imaging/images/generate`, firstCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: "imagine-job_deadbeef",
      prompt: "A private idempotent account image",
      quality: "low",
      mediaMode: "image",
      modelId: "imagine-image-v1",
    }),
  });
  assert.equal(retry.response.status, 200);
  assert.equal(retry.data.reused, true);
  assert.equal(retry.data.asset.id, state.generated.id);
  assert.equal(retry.data.mediaMode, "image");
  assert.equal(retry.data.modelId, "imagine-image-v1");
  assert.equal("model" in retry.data, false);
  const durableLegacyRetry = await requestJson(`${running.url}/api/me/imaging/images/generate`, firstCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: "imagine-job_cafebabe",
      prompt: state.completedPrompt,
      quality: "low",
      mediaMode: "image",
      modelId: "imagine-image-v1",
    }),
  });
  assert.equal(durableLegacyRetry.response.status, 200);
  assert.equal(durableLegacyRetry.data.reused, true);
  assert.equal(durableLegacyRetry.data.asset.id, state.generated.id);
  assert.equal(durableLegacyRetry.data.mediaMode, "image");
  assert.equal(durableLegacyRetry.data.modelId, "imagine-image-v1");
  assert.equal("model" in durableLegacyRetry.data, false);
  const durableLegacyPending = await requestJson(`${running.url}/api/me/imaging/images/generate`, firstCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: "imagine-job_badc0ffe",
      prompt: state.pendingPrompt,
      quality: "low",
      mediaMode: "image",
      modelId: "imagine-image-v1",
    }),
  });
  assert.equal(durableLegacyPending.response.status, 202);
  assert.equal(durableLegacyPending.data.pending, true);
  const creditsAfter = await requestJson(`${running.url}/api/credits`, firstCookie);
  assert.deepEqual(creditsAfter.data.image, creditsBefore.data.image);

  const newFreeGeneration = await requestJson(`${running.url}/api/me/imaging/images/generate`, firstCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: "A completely new account-scoped cinematic frame", quality: "low" }),
  });
  assert.equal(newFreeGeneration.response.status, 403);
  assert.equal(newFreeGeneration.data.error, "image_generation_plan_required");

  const restoredWorkspace = await requestJson(`${running.url}/api/me/imaging`, firstCookie);
  assert.deepEqual(
    new Set(restoredWorkspace.data.workspace.assets.map((asset) => asset.id)),
    new Set([state.generated.id, upload.data.asset.id]),
  );
  const scriptsAfter = await requestJson(`${running.url}/api/scripts`, firstCookie);
  assert.deepEqual(scriptsAfter.data.scripts, []);

  await stopServer(running.child);
  running = null;
  const inspect = spawnSync(process.execPath, ["--input-type=module", "--eval", `
    import { getCanvasLibrary } from "./database.js";
    const library = getCanvasLibrary(${JSON.stringify(state.first.id)});
    console.log(JSON.stringify({
      customMarker: library.customMarker,
      vaultItems: library.vaultItems,
      assets: library.assets.map((asset) => ({
        id: asset.id,
        source: asset.source,
        key: asset.key,
        mediaMode: asset.mediaMode,
        modelId: asset.modelId,
        generationMediaMode: asset.generation?.mediaMode,
        generationModelId: asset.generation?.modelId,
      })),
    }));
  `], {
    cwd: ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      FILMSCRIPT_DATA_DIR: dataDir,
      FILMSCRIPT_PREVIEW_MODE: "false",
      FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
    },
  });
  assert.equal(inspect.status, 0, inspect.stderr || inspect.stdout);
  const persisted = JSON.parse(inspect.stdout.trim().split("\n").at(-1));
  assert.equal(persisted.customMarker, "keep-account-library-fields");
  assert.equal(persisted.vaultItems[0].name, "Private Vault item");
  assert.ok(persisted.assets.some((asset) => asset.id === "cas_aaaaaaaa" && asset.source === "upload"));
  for (const asset of persisted.assets.filter((entry) => [state.generated.id, upload.data.asset.id].includes(entry.id))) {
    assert.match(asset.key, new RegExp(`^imaging_${state.first.id}/`));
    assert.equal(asset.mediaMode, "image");
    assert.equal(asset.generationMediaMode, "image");
    const expectedModelId = asset.id === state.generated.id ? "imagine-image-v1" : "";
    assert.equal(asset.modelId, expectedModelId);
    assert.equal(asset.generationModelId, expectedModelId);
  }
});

test("parallel account Imagine completions retain every generated image", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-account-imaging-parallel-"));
  try {
    const scenario = spawnSync(process.execPath, ["--input-type=module", "--eval", `
      import {
        connectGoogleIdentity,
        createSession,
        getCanvasLibrary,
      } from "./database.js";
      import { __canvasTesting as canvas } from "./server.js";

      const session = createSession();
      const user = connectGoogleIdentity(session.session.id, {
        sub: "account-imaging-parallel",
        email: "account-imaging-parallel@example.test",
        name: "Parallel Imaging",
        email_verified: true,
      });
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
      const [first, second] = await Promise.all([
        canvas.storeGeneratedAccountImagingAsset(user.id, jpeg, "First account image", {
          size: "1536x1024",
          generation: { requestId: "imagine-job_11111111", quality: "low" },
        }),
        canvas.storeGeneratedAccountImagingAsset(user.id, jpeg, "Second account image", {
          size: "1024x1536",
          generation: { requestId: "imagine-job_22222222", quality: "low" },
        }),
      ]);
      const library = getCanvasLibrary(user.id);
      console.log(JSON.stringify({
        returned: [first.id, second.id],
        stored: library.assets.map((asset) => asset.id),
      }));
    `], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        FILMSCRIPT_DATA_DIR: dataDir,
        FILMSCRIPT_PREVIEW_MODE: "false",
        FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
      },
    });
    assert.equal(scenario.status, 0, scenario.stderr || scenario.stdout);
    const result = JSON.parse(scenario.stdout.trim().split("\n").at(-1));
    assert.equal(new Set(result.returned).size, 2);
    assert.deepEqual(new Set(result.stored), new Set(result.returned));
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("parallel retries share one active account Imagine generation and reject request-id collisions", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-account-imaging-active-"));
  try {
    const scenario = spawnSync(process.execPath, ["--input-type=module", "--eval", `
      import { __canvasTesting as canvas } from "./server.js";
      let providerCalls = 0;
      const work = async () => {
        providerCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 40));
        return { asset: { id: "cas_deadbeef" } };
      };
      const first = canvas.startAccountImagingGeneration("usr_a:imagine-job_aaaaaaaa", "fingerprint-a", work);
      const second = canvas.startAccountImagingGeneration("usr_a:imagine-job_aaaaaaaa", "fingerprint-a", work);
      const values = await Promise.all([first.promise, second.promise]);
      let collision = null;
      const held = canvas.startAccountImagingGeneration("usr_a:imagine-job_bbbbbbbb", "fingerprint-a", async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        return { ok: true };
      });
      try {
        canvas.startAccountImagingGeneration("usr_a:imagine-job_bbbbbbbb", "fingerprint-b", work);
      } catch (error) {
        collision = { status: error.status, code: error.code };
      }
      await held.promise;
      console.log(JSON.stringify({ providerCalls, firstReused: first.reused, secondReused: second.reused, values, collision }));
    `], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        FILMSCRIPT_DATA_DIR: dataDir,
        FILMSCRIPT_PREVIEW_MODE: "false",
        FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
      },
    });
    assert.equal(scenario.status, 0, scenario.stderr || scenario.stdout);
    const result = JSON.parse(scenario.stdout.trim().split("\n").at(-1));
    assert.equal(result.providerCalls, 1);
    assert.equal(result.firstReused, false);
    assert.equal(result.secondReused, true);
    assert.deepEqual(result.values, [{ asset: { id: "cas_deadbeef" } }, { asset: { id: "cas_deadbeef" } }]);
    assert.deepEqual(result.collision, { status: 409, code: "imaging_request_id_conflict" });
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("durable account Imagine claims coordinate separate server processes", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-account-imaging-claim-"));
  const env = {
    ...process.env,
    FILMSCRIPT_DATA_DIR: dataDir,
    FILMSCRIPT_PREVIEW_MODE: "false",
    FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
  };
  const runNode = (source) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "--eval", source], {
      cwd: ROOT,
      env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin.end("run\n");
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) return reject(new Error(stderr || stdout || `child exited ${code}`));
      resolve(JSON.parse(stdout.trim().split("\n").at(-1)));
    });
  });
  try {
    const bootstrap = spawnSync(process.execPath, ["--input-type=module", "--eval", `
      import { connectGoogleIdentity, createSession } from "./database.js";
      await import("./platform-database.js");
      const session = createSession();
      const user = connectGoogleIdentity(session.session.id, {
        sub: "account-imaging-durable-claim",
        email: "account-imaging-durable-claim@example.test",
        name: "Durable Claim",
        email_verified: true,
      });
      console.log(JSON.stringify({ userId: user.id }));
    `], { cwd: ROOT, encoding: "utf8", env });
    assert.equal(bootstrap.status, 0, bootstrap.stderr || bootstrap.stdout);
    const { userId } = JSON.parse(bootstrap.stdout.trim().split("\n").at(-1));
    const claimSource = `
      import "./platform-database.js";
      import { claimAccountImagingGeneration } from "./database.js";
      console.log("READY");
      await new Promise((resolve) => process.stdin.once("data", resolve));
      const claim = claimAccountImagingGeneration({
        userId: ${JSON.stringify(userId)},
        requestId: "imagine-job_dddddddd",
        fingerprint: "durable-fingerprint",
      });
      console.log(JSON.stringify(claim));
    `;
    const startClaimWorker = () => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--input-type=module", "--eval", claimSource], {
        cwd: ROOT,
        env,
        stdio: ["pipe", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      let ready = false;
      const result = new Promise((resolveResult, rejectResult) => {
        child.stderr.on("data", (chunk) => { stderr += chunk; });
        child.once("error", rejectResult);
        child.once("exit", (code) => {
          if (code !== 0) return rejectResult(new Error(stderr || stdout || `child exited ${code}`));
          resolveResult(JSON.parse(stdout.trim().split("\n").at(-1)));
        });
      });
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        if (!ready && stdout.includes("READY")) {
          ready = true;
          resolve({ child, result });
        }
      });
      child.once("error", reject);
    });
    // Start both long-lived workers before releasing either claim. This models
    // two healthy ECS tasks without racing their normal boot migrations.
    const firstWorker = await startClaimWorker();
    const secondWorker = await startClaimWorker();
    firstWorker.child.stdin.end("claim\n");
    secondWorker.child.stdin.end("claim\n");
    const claims = await Promise.all([firstWorker.result, secondWorker.result]);
    assert.deepEqual(claims.map((claim) => claim.state).sort(), ["claimed", "pending"]);
    const claimed = claims.find((claim) => claim.state === "claimed");
    const completed = await runNode(`
      import "./platform-database.js";
      import { completeAccountImagingGeneration } from "./database.js";
      const generation = completeAccountImagingGeneration({
        userId: ${JSON.stringify(userId)},
        requestId: "imagine-job_dddddddd",
        leaseToken: ${JSON.stringify(claimed.generation.leaseToken)},
        assetId: "cas_dddddddd",
        result: {
          asset: { id: "cas_dddddddd", mediaMode: "image", modelId: "imagine-image-v1" },
          mediaMode: "image",
          modelId: "imagine-image-v1",
          quality: "low",
        },
      });
      console.log(JSON.stringify(generation));
    `);
    assert.equal(completed.status, "completed");
    const replay = await runNode(claimSource);
    assert.equal(replay.state, "completed");
    assert.equal(replay.generation.result.asset.id, "cas_dddddddd");
    const conflict = await runNode(`
      import "./platform-database.js";
      import { claimAccountImagingGeneration } from "./database.js";
      console.log(JSON.stringify(claimAccountImagingGeneration({
        userId: ${JSON.stringify(userId)},
        requestId: "imagine-job_dddddddd",
        fingerprint: "different-fingerprint",
      })));
    `);
    assert.equal(conflict.state, "conflict");
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("standalone account Imagine assets never merge into a shared project Canvas", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-account-imaging-private-"));
  try {
    const scenario = spawnSync(process.execPath, ["--input-type=module", "--eval", `
      import {
        connectGoogleIdentity,
        createSession,
        getCanvasLibrary,
        getCanvasWorkspace,
        saveScriptsSnapshot,
      } from "./database.js";
      import * as platform from "./platform-database.js";
      import { __canvasTesting as canvas } from "./server.js";

      const ownerSession = createSession();
      const owner = connectGoogleIdentity(ownerSession.session.id, {
        sub: "account-imaging-private-owner",
        email: "account-imaging-private-owner@example.test",
        name: "Private Owner",
        email_verified: true,
      });
      const peerSession = createSession();
      const peer = connectGoogleIdentity(peerSession.session.id, {
        sub: "account-imaging-private-peer",
        email: "account-imaging-private-peer@example.test",
        name: "Canvas Peer",
        email_verified: true,
      });
      const timestamp = new Date().toISOString();
      saveScriptsSnapshot({ scripts: { scr_aaaaaaaaaaaaaaaaaaaa: {
        id: "scr_aaaaaaaaaaaaaaaaaaaa",
        userId: owner.id,
        title: "Shared Canvas",
        filename: null,
        source: "new",
        text: "",
        blocks: [],
        chat: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      } } });
      platform.backfillOwners();
      const invitation = platform.createInvitation("scr_aaaaaaaaaaaaaaaaaaaa", owner.id, {
        email: peer.email,
        projectRole: "viewer",
        modulePermissions: { canvas: "view", script: "no_access" },
      });
      platform.acceptInvitation(invitation.token, peer.id);
      const privateAsset = await canvas.storeGeneratedAccountImagingAsset(
        owner.id,
        Buffer.from([0xff, 0xd8, 0xff, 0xd9]),
        "PRIVATE ACCOUNT IMAGING PROMPT",
        { generation: { requestId: "imagine-job_cccccccc", quality: "low" } },
      );
      const ownerContext = canvas.canvasContext("scr_aaaaaaaaaaaaaaaaaaaa", owner.id);
      canvas.saveCanvasContext(ownerContext);
      const peerContext = canvas.canvasContext("scr_aaaaaaaaaaaaaaaaaaaa", peer.id);
      const library = getCanvasLibrary(owner.id);
      const workspace = getCanvasWorkspace("scr_aaaaaaaaaaaaaaaaaaaa", owner.id);
      console.log(JSON.stringify({
        privateAssetId: privateAsset.id,
        ownerProjectAssets: ownerContext.workspace.assets.map((asset) => asset.id),
        peerProjectAssets: peerContext.workspace.assets.map((asset) => asset.id),
        storedProjectAssets: workspace.assets.map((asset) => asset.id),
        privateStillPersonal: library.assets.some((asset) => asset.id === privateAsset.id && asset.generation?.accessScope === "account_imaging"),
      }));
    `], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        FILMSCRIPT_DATA_DIR: dataDir,
        FILMSCRIPT_PREVIEW_MODE: "false",
        FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
      },
    });
    assert.equal(scenario.status, 0, scenario.stderr || scenario.stdout);
    const result = JSON.parse(scenario.stdout.trim().split("\n").at(-1));
    assert.equal(result.privateStillPersonal, true);
    assert.equal(result.ownerProjectAssets.includes(result.privateAssetId), false);
    assert.equal(result.peerProjectAssets.includes(result.privateAssetId), false);
    assert.equal(result.storedProjectAssets.includes(result.privateAssetId), false);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
