import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { crc32 } from "../zip-archive.js";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

test("stored ZIP uses the standard CRC-32 checksum", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
});

test("production backend image includes the Imagine ZIP writer", async () => {
  const dockerfile = await fs.readFile(path.join(ROOT, "Dockerfile"), "utf8");
  assert.match(dockerfile, /COPY reference-storage\.js canvas-model\.js canvas-storage\.js s3-storage\.js zip-archive\.js \.\//);
});

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

function zipLocalEntries(bytes) {
  const buffer = Buffer.from(bytes);
  const entries = [];
  let offset = 0;
  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    entries.push({
      name: buffer.subarray(nameStart, nameStart + nameLength).toString("utf8"),
      data: buffer.subarray(dataStart, dataStart + compressedSize),
    });
    offset = dataStart + compressedSize;
  }
  return entries;
}

function zipDirectorySummary(bytes) {
  const buffer = Buffer.from(bytes);
  const offset = buffer.length - 22;
  assert.equal(buffer.readUInt32LE(offset), 0x06054b50);
  const count = buffer.readUInt16LE(offset + 10);
  const centralSize = buffer.readUInt32LE(offset + 12);
  const centralOffset = buffer.readUInt32LE(offset + 16);
  assert.equal(buffer.readUInt32LE(centralOffset), 0x02014b50);
  assert.equal(centralOffset + centralSize, offset);
  return { count, centralSize, centralOffset };
}

test("account Imagine gallery state is private, persistent, atomic, and ZIP downloads are bounded", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-imaging-gallery-"));
  const bootstrap = spawnSync(process.execPath, ["--input-type=module", "--eval", `
    import "./platform-database.js";
    import { connectGoogleIdentity, createSession } from "./database.js";
    import { hashText } from "./analysis-model.js";
    import { __canvasTesting as canvas } from "./server.js";

    const ownerSession = createSession();
    const owner = connectGoogleIdentity(ownerSession.session.id, {
      sub: "gallery-owner",
      email: "gallery-owner@example.test",
      name: "Gallery Owner",
      email_verified: true,
    });
    const strangerSession = createSession();
    const stranger = connectGoogleIdentity(strangerSession.session.id, {
      sub: "gallery-stranger",
      email: "gallery-stranger@example.test",
      name: "Gallery Stranger",
      email_verified: true,
    });
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const first = await canvas.storeGeneratedAccountImagingAsset(owner.id, jpeg, "First private frame", {
      size: "1536x1024",
      generation: { quality: "low", style: "cinematic" },
    });
    const second = await canvas.storeGeneratedAccountImagingAsset(owner.id, jpeg, "Second private frame", {
      size: "1536x1024",
      generation: { quality: "low", style: "cinematic" },
    });
    const nonePrompt = "Faithfully adjust this private reference";
    const nonePayload = {
      mediaMode: "image",
      modelId: "imagine-image-v1",
      prompt: nonePrompt,
      size: "1536x1024",
      orientation: "horizontal",
      style: "none",
      quality: "low",
      camera: "",
      lens: "",
      focalLength: "",
      referenceAssetIds: [],
    };
    const none = await canvas.storeGeneratedAccountImagingAsset(owner.id, jpeg, nonePrompt, {
      size: "1536x1024",
      generation: {
        requestId: "imagine-job_eeeeeeee",
        requestFingerprint: hashText(JSON.stringify(nonePayload)),
        quality: "low",
        style: "none",
      },
    });
    const foreign = await canvas.storeGeneratedAccountImagingAsset(stranger.id, jpeg, "Foreign frame", {
      size: "1536x1024",
      generation: { quality: "low", style: "cinematic" },
    });
    console.log(JSON.stringify({
      owner: { id: owner.id, token: ownerSession.token },
      stranger: { id: stranger.id, token: strangerSession.token },
      first,
      second,
      none,
      foreign,
      nonePrompt,
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
  const ownerCookie = `filmscript_sid=${encodeURIComponent(state.owner.token)}`;
  const strangerCookie = `filmscript_sid=${encodeURIComponent(state.stranger.token)}`;
  let running = await startServer(dataDir);
  t.after(async () => {
    await stopServer(running?.child);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const unauthenticated = await requestJson(`${running.url}/api/me/imaging/assets/${state.first.id}`, "", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ liked: true }),
  });
  assert.equal(unauthenticated.response.status, 401);

  const crossAccount = await requestJson(`${running.url}/api/me/imaging/assets/${state.first.id}`, strangerCookie, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ liked: true }),
  });
  assert.equal(crossAccount.response.status, 404);
  assert.equal(crossAccount.data.error, "imaging_asset_not_found");

  const liked = await requestJson(`${running.url}/api/me/imaging/assets/${state.first.id}`, ownerCookie, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ liked: true }),
  });
  assert.equal(liked.response.status, 200);
  assert.equal(liked.data.asset.liked, true);
  assert.match(liked.data.asset.likedAt, /^\d{4}-\d{2}-\d{2}T/);
  const likedAgain = await requestJson(`${running.url}/api/me/imaging/assets/${state.first.id}/like`, ownerCookie, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ liked: true }),
  });
  assert.equal(likedAgain.response.status, 200);
  assert.equal(likedAgain.data.asset.likedAt, liked.data.asset.likedAt);

  const referencePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64");
  const reference = await requestJson(`${running.url}/api/me/imaging/assets`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "image/png", "X-Filename": "private-reference.png" },
    body: referencePng,
  });
  assert.equal(reference.response.status, 201);

  const failedAtomicBatch = await requestJson(`${running.url}/api/me/imaging/assets/batch`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation: "like", assetIds: [state.second.id, state.foreign.id] }),
  });
  assert.equal(failedAtomicBatch.response.status, 404);
  let workspace = await requestJson(`${running.url}/api/me/imaging`, ownerCookie);
  assert.equal(workspace.data.workspace.assets.find((asset) => asset.id === state.second.id).liked, false);

  const referenceBatch = await requestJson(`${running.url}/api/me/imaging/assets/batch`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation: "like", assetIds: [state.second.id, reference.data.asset.id] }),
  });
  assert.equal(referenceBatch.response.status, 404);
  workspace = await requestJson(`${running.url}/api/me/imaging`, ownerCookie);
  assert.equal(workspace.data.workspace.assets.find((asset) => asset.id === state.second.id).liked, false);

  const successfulBatch = await requestJson(`${running.url}/api/me/imaging/assets/batch`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operation: "like", assetIds: [state.second.id, state.none.id] }),
  });
  assert.equal(successfulBatch.response.status, 200);
  assert.deepEqual(successfulBatch.data.assets.map((asset) => asset.liked), [true, true]);

  const archiveResponse = await fetch(`${running.url}/api/me/imaging/downloads`, {
    method: "POST",
    headers: { Cookie: ownerCookie, "Content-Type": "application/json" },
    body: JSON.stringify({ assetIds: [state.second.id, state.none.id] }),
  });
  assert.equal(archiveResponse.status, 200);
  assert.equal(archiveResponse.headers.get("content-type"), "application/zip");
  assert.match(archiveResponse.headers.get("content-disposition"), /^attachment; filename="FilmScript-Imagine-/);
  assert.match(archiveResponse.headers.get("cache-control"), /no-store/);
  const archiveBytes = await archiveResponse.arrayBuffer();
  const zipEntries = zipLocalEntries(archiveBytes);
  assert.equal(zipEntries.length, 2);
  assert.equal(zipDirectorySummary(archiveBytes).count, 2);
  assert.ok(zipEntries[0].name.startsWith("01-Second private frame"));
  assert.ok(zipEntries[1].name.startsWith("02-Faithfully adjust this private reference"));
  assert.deepEqual(zipEntries.map((entry) => [...entry.data]), [[0xff, 0xd8, 0xff, 0xd9], [0xff, 0xd8, 0xff, 0xd9]]);

  const foreignArchive = await requestJson(`${running.url}/api/me/imaging/downloads`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetIds: [state.second.id, state.foreign.id] }),
  });
  assert.equal(foreignArchive.response.status, 404);
  const tooManyIds = Array.from({ length: 26 }, (_, index) => `cas_${(index + 100).toString(16).padStart(8, "0")}`);
  const tooMany = await requestJson(`${running.url}/api/me/imaging/downloads`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ assetIds: tooManyIds }),
  });
  assert.equal(tooMany.response.status, 422);

  const replayNone = await requestJson(`${running.url}/api/me/imaging/images/generate`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: "imagine-job_eeeeeeee",
      prompt: state.nonePrompt,
      style: "none",
      quality: "low",
      mediaMode: "image",
      modelId: "imagine-image-v1",
    }),
  });
  assert.equal(replayNone.response.status, 200);
  assert.equal(replayNone.data.reused, true);
  assert.equal(replayNone.data.asset.id, state.none.id);
  assert.equal(replayNone.data.asset.generation.style, "none");
  const collision = await requestJson(`${running.url}/api/me/imaging/images/generate`, ownerCookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestId: "imagine-job_eeeeeeee",
      prompt: state.nonePrompt,
      style: "cinematic",
      quality: "low",
      mediaMode: "image",
      modelId: "imagine-image-v1",
    }),
  });
  assert.equal(collision.response.status, 409);

  const removed = await requestJson(`${running.url}/api/me/imaging/assets/${state.first.id}`, ownerCookie, {
    method: "DELETE",
  });
  assert.equal(removed.response.status, 200);
  assert.equal(removed.data.asset.trashed, true);
  const removedAgain = await requestJson(`${running.url}/api/me/imaging/assets/${state.first.id}`, ownerCookie, {
    method: "DELETE",
  });
  assert.equal(removedAgain.response.status, 200);
  assert.equal(removedAgain.data.asset.trashedAt, removed.data.asset.trashedAt);
  assert.equal((await fetch(`${running.url}/api/me/imaging/assets/${state.first.id}`, { headers: { Cookie: ownerCookie } })).status, 404);
  const likeTrashed = await requestJson(`${running.url}/api/me/imaging/assets/${state.first.id}`, ownerCookie, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ liked: true }),
  });
  assert.equal(likeTrashed.response.status, 404);
  workspace = await requestJson(`${running.url}/api/me/imaging`, ownerCookie);
  assert.equal(workspace.data.workspace.assets.some((asset) => asset.id === state.first.id), false);

  await stopServer(running.child);
  running = await startServer(dataDir);
  const persisted = await requestJson(`${running.url}/api/me/imaging`, ownerCookie);
  assert.equal(persisted.data.workspace.assets.some((asset) => asset.id === state.first.id), false);
  assert.equal(persisted.data.workspace.assets.find((asset) => asset.id === state.second.id).liked, true);
  const strangerWorkspace = await requestJson(`${running.url}/api/me/imaging`, strangerCookie);
  assert.deepEqual(strangerWorkspace.data.workspace.assets.map((asset) => asset.id), [state.foreign.id]);

  const inspect = spawnSync(process.execPath, ["--input-type=module", "--eval", `
    import "./platform-database.js";
    import { getCanvasLibrary } from "./database.js";
    const library = getCanvasLibrary(${JSON.stringify(state.owner.id)});
    console.log(JSON.stringify({ stillStored: library.assets.some((asset) => asset.id === ${JSON.stringify(state.first.id)}) }));
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
  assert.equal(JSON.parse(inspect.stdout.trim().split("\n").at(-1)).stillStored, true);
});

test("Imagine style none is explicit, neutral, and preserves reference camera choices", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-imaging-style-none-"));
  try {
    const serverSource = await fs.readFile(path.join(ROOT, "server.js"), "utf8");
    assert.ok((serverSource.match(/const visualStyle = normalizeImagineVisualStyle\(body\?\.style\);/g) || []).length >= 2);
    assert.match(serverSource, /legacyFingerprintPayload = \{[\s\S]*?style: visualStyle,/);
    assert.match(serverSource, /generation: \{ orientation, size, style: visualStyle,/);
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", `
      import "./platform-database.js";
      import { __canvasTesting as canvas } from "./server.js";
      console.log(JSON.stringify({
        normalized: canvas.normalizeImagineVisualStyle("none"),
        fallback: canvas.normalizeImagineVisualStyle("unknown"),
        lead: canvas.imagineStyleLead("none"),
        withReference: canvas.imagineCameraDirection({ visualStyle: "none", camera: "", lens: "", focalLength: "", hasReferences: true, standalone: true }),
        withoutReference: canvas.imagineCameraDirection({ visualStyle: "none", camera: "", lens: "", focalLength: "", hasReferences: false, standalone: true }),
        explicit: canvas.imagineCameraDirection({ visualStyle: "none", camera: "eye level", lens: "prime", focalLength: "50mm", hasReferences: true, standalone: true }),
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
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const value = JSON.parse(result.stdout.trim().split("\n").at(-1));
    assert.equal(value.normalized, "none");
    assert.equal(value.fallback, "cinematic");
    assert.match(value.lead, /no preset visual style/i);
    assert.doesNotMatch(value.lead, /cinematic photographic|animated film frame|anime frame/i);
    assert.match(value.withReference, /Preserve the camera position, lens character, framing, composition, lighting, palette, and finish/i);
    assert.match(value.withoutReference, /Do not add a house style/i);
    assert.equal(value.explicit, "camera eye level, lens prime, 50mm focal length");
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});

test("concurrent Like and Delete mutations retain the soft-delete invariant", async () => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-imaging-state-race-"));
  const env = {
    ...process.env,
    FILMSCRIPT_DATA_DIR: dataDir,
    FILMSCRIPT_PREVIEW_MODE: "false",
    FILMSCRIPT_SQLITE_JOURNAL_MODE: "DELETE",
  };
  try {
    const bootstrap = spawnSync(process.execPath, ["--input-type=module", "--eval", `
      import "./platform-database.js";
      import { connectGoogleIdentity, createSession } from "./database.js";
      const session = createSession();
      const user = connectGoogleIdentity(session.session.id, {
        sub: "gallery-state-race",
        email: "gallery-state-race@example.test",
        name: "Gallery State Race",
        email_verified: true,
      });
      console.log(JSON.stringify({ userId: user.id }));
    `], { cwd: ROOT, encoding: "utf8", env });
    assert.equal(bootstrap.status, 0, bootstrap.stderr || bootstrap.stdout);
    const { userId } = JSON.parse(bootstrap.stdout.trim().split("\n").at(-1));
    const assetId = "cas_abcdef1234567890";
    const operations = ["like", "like", "trash", "like", "unlike", "trash", "like", "like"];
    const workers = operations.map((operation, index) => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["--input-type=module", "--eval", `
        import { mutateAccountImagingAssetStates } from "./database.js";
        await new Promise((resolve) => setTimeout(resolve, ${index % 3}));
        const [state] = mutateAccountImagingAssetStates({
          userId: ${JSON.stringify(userId)},
          assetIds: [${JSON.stringify(assetId)}],
          operation: ${JSON.stringify(operation)},
        });
        console.log(JSON.stringify(state));
      `], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code !== 0) reject(new Error(stderr || stdout || `worker exited ${code}`));
        else resolve(JSON.parse(stdout.trim().split("\n").at(-1)));
      });
    }));
    await Promise.all(workers);
    const inspect = spawnSync(process.execPath, ["--input-type=module", "--eval", `
      import "./platform-database.js";
      import { getAccountImagingAssetStates } from "./database.js";
      const state = getAccountImagingAssetStates(${JSON.stringify(userId)}, [${JSON.stringify(assetId)}]).get(${JSON.stringify(assetId)});
      console.log(JSON.stringify(state));
    `], { cwd: ROOT, encoding: "utf8", env });
    assert.equal(inspect.status, 0, inspect.stderr || inspect.stdout);
    const state = JSON.parse(inspect.stdout.trim().split("\n").at(-1));
    assert.equal(state.trashed, true);
    assert.equal(state.liked, false);
    assert.equal(state.likedAt, null);
  } finally {
    await fs.rm(dataDir, { recursive: true, force: true });
  }
});
