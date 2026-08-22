import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import Database from "better-sqlite3";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

const freePort = () => new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", () => {
    const { port } = probe.address();
    probe.close(() => resolve(port));
  });
});

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode != null) throw new Error(`FilmScript server exited with ${child.exitCode}.`);
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 75));
  }
  throw new Error("FilmScript server did not become ready.");
}

async function startServer(dataDir, databasePath) {
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
      FILMSCRIPT_DB_PATH: databasePath,
      OPENAI_API_KEY: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForServer(url, child);
  return { child, url };
}

async function stopServer(child) {
  if (!child || child.exitCode != null) return;
  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await exited;
}

test("account migrations restore language and person-name columns on an older database", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-language-migration-"));
  const databasePath = path.join(dataDir, "filmscript.sqlite");
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));

  const seed = spawnSync(process.execPath, ["--input-type=module", "--eval", `
    await import('./database.js');
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(process.env.FILMSCRIPT_DB_PATH);
    db.exec('ALTER TABLE users DROP COLUMN interface_language');
    db.prepare("INSERT OR REPLACE INTO schema_meta(key,value) VALUES('schema_version','16')").run();
    db.close();
  `], {
    cwd: ROOT,
    env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir, FILMSCRIPT_DB_PATH: databasePath },
    encoding: "utf8",
  });
  assert.equal(seed.status, 0, seed.stderr);

  const migrate = spawnSync(process.execPath, ["--input-type=module", "--eval", "await import('./platform-database.js');"], {
    cwd: ROOT,
    env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir, FILMSCRIPT_DB_PATH: databasePath },
    encoding: "utf8",
  });
  assert.equal(migrate.status, 0, migrate.stderr);

  const db = new Database(databasePath, { readonly: true });
  t.after(() => db.close());
  const userColumns = new Set(db.prepare("PRAGMA table_info(users)").all().map((column) => column.name));
  assert.equal(userColumns.has("interface_language"), true);
  assert.equal(userColumns.has("first_name"), true);
  assert.equal(userColumns.has("last_name"), true);
  assert.equal(db.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get().value, "20");
});

test("interface language is isolated per account, validated, and survives restart", async (t) => {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "filmscript-language-persistence-"));
  const databasePath = path.join(dataDir, "filmscript.sqlite");
  const bootstrap = spawnSync(process.execPath, ["--input-type=module", "--eval", `
    import { connectGoogleIdentity, createSession } from './database.js';
    const spanish = createSession();
    connectGoogleIdentity(spanish.session.id, { sub: 'google_language_es', email: 'es@example.com', name: 'ES', email_verified: true });
    const english = createSession();
    connectGoogleIdentity(english.session.id, { sub: 'google_language_en', email: 'en@example.com', name: 'EN', email_verified: true });
    console.log(JSON.stringify({ spanishToken: spanish.token, englishToken: english.token }));
  `], {
    cwd: ROOT,
    env: { ...process.env, FILMSCRIPT_DATA_DIR: dataDir, FILMSCRIPT_DB_PATH: databasePath },
    encoding: "utf8",
  });
  assert.equal(bootstrap.status, 0, bootstrap.stderr);
  const tokens = JSON.parse(bootstrap.stdout.trim().split("\n").at(-1));
  const spanishCookie = `filmscript_sid=${encodeURIComponent(tokens.spanishToken)}`;
  const englishCookie = `filmscript_sid=${encodeURIComponent(tokens.englishToken)}`;
  let running = await startServer(dataDir, databasePath);

  t.after(async () => {
    await stopServer(running?.child);
    await fs.rm(dataDir, { recursive: true, force: true });
  });

  const patchLanguage = (cookie, interfaceLanguage) => fetch(`${running.url}/api/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ interfaceLanguage }),
  });
  const getAccount = async (cookie) => {
    const response = await fetch(`${running.url}/api/me`, { headers: { Cookie: cookie } });
    assert.equal(response.status, 200);
    return response.json();
  };

  assert.equal((await getAccount(spanishCookie)).interfaceLanguage, null);
  assert.equal((await getAccount(englishCookie)).interfaceLanguage, null);

  const spanishSave = await patchLanguage(spanishCookie, "es");
  assert.equal(spanishSave.status, 200);
  assert.equal((await spanishSave.json()).interfaceLanguage, "es");
  const englishSave = await patchLanguage(englishCookie, "en");
  assert.equal(englishSave.status, 200);
  assert.equal((await englishSave.json()).interfaceLanguage, "en");

  const invalidSave = await patchLanguage(spanishCookie, "fr");
  assert.equal(invalidSave.status, 422);
  assert.match((await invalidSave.json()).error, /English or Spanish/);
  assert.equal((await getAccount(spanishCookie)).interfaceLanguage, "es");
  assert.equal((await getAccount(englishCookie)).interfaceLanguage, "en");

  await stopServer(running.child);
  running = await startServer(dataDir, databasePath);

  assert.equal((await getAccount(spanishCookie)).interfaceLanguage, "es");
  assert.equal((await getAccount(englishCookie)).interfaceLanguage, "en");

  const clearSave = await patchLanguage(englishCookie, null);
  assert.equal(clearSave.status, 200);
  assert.equal((await clearSave.json()).interfaceLanguage, null);
  assert.equal((await getAccount(spanishCookie)).interfaceLanguage, "es");
});
