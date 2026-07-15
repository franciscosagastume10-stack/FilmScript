import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.FILMSCRIPT_DATA_DIR
  ? path.resolve(process.env.FILMSCRIPT_DATA_DIR)
  : process.env.VERCEL
    ? path.join("/tmp", "filmscript")
    : path.join(ROOT, "data");
const DATABASE_PATH = process.env.FILMSCRIPT_DB_PATH
  ? path.resolve(process.env.FILMSCRIPT_DB_PATH)
  : path.join(DATA_DIR, "filmscript.sqlite");

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
try { fs.chmodSync(path.dirname(DATABASE_PATH), 0o700); } catch {}

const sqlite = new Database(DATABASE_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");
for (const filename of [DATABASE_PATH, `${DATABASE_PATH}-wal`, `${DATABASE_PATH}-shm`]) {
  try { fs.chmodSync(filename, 0o600); } catch {}
}

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS schema_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_sub TEXT UNIQUE,
    email TEXT,
    name TEXT,
    picture_url TEXT,
    lumiere_preferences_json TEXT NOT NULL DEFAULT '{}',
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    auth_method TEXT NOT NULL DEFAULT 'anonymous',
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

  CREATE TABLE IF NOT EXISTS scripts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    filename TEXT,
    source TEXT,
    text TEXT,
    blocks_json TEXT NOT NULL DEFAULT '[]',
    chat_json TEXT NOT NULL DEFAULT '[]',
    title_room_json TEXT NOT NULL DEFAULT '{}',
    character_names_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS scripts_user_updated_idx ON scripts(user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS preproduction_projects (
    script_id TEXT PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS canvas_workspaces (
    script_id TEXT PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS canvas_workspaces_user_idx ON canvas_workspaces(user_id, updated_at DESC);

  CREATE TABLE IF NOT EXISTS budget_receipts (
    id TEXT PRIMARY KEY,
    script_id TEXT NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    data_blob BLOB NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS budget_receipts_script_idx ON budget_receipts(script_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS subscriptions (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT,
    status TEXT,
    checkout_id TEXT,
    provider_subscription_id TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS checkouts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email TEXT,
    plan TEXT,
    product_id TEXT,
    status TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS checkouts_user_status_idx ON checkouts(user_id, status, created_at DESC);

  CREATE TABLE IF NOT EXISTS oauth_states (
    state_hash TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    return_to TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS processed_events (
    id TEXT PRIMARY KEY,
    processed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  );
`);

const scriptColumns = new Set(sqlite.prepare("PRAGMA table_info(scripts)").all().map((column) => column.name));
if (!scriptColumns.has("title_room_json")) {
  sqlite.exec("ALTER TABLE scripts ADD COLUMN title_room_json TEXT NOT NULL DEFAULT '{}'");
}
if (!scriptColumns.has("character_names_json")) {
  sqlite.exec("ALTER TABLE scripts ADD COLUMN character_names_json TEXT NOT NULL DEFAULT '{}'");
}
const userColumns = new Set(sqlite.prepare("PRAGMA table_info(users)").all().map((column) => column.name));
if (!userColumns.has("lumiere_preferences_json")) {
  sqlite.exec("ALTER TABLE users ADD COLUMN lumiere_preferences_json TEXT NOT NULL DEFAULT '{}'");
}
const checkoutColumns = new Set(sqlite.prepare("PRAGMA table_info(checkouts)").all().map((column) => column.name));
if (!checkoutColumns.has("product_id")) {
  sqlite.exec("ALTER TABLE checkouts ADD COLUMN product_id TEXT");
}

const nowIso = () => new Date().toISOString();
const futureIso = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const hashSecret = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const parseJson = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};
const stringify = (value) => JSON.stringify(value ?? null);
const randomId = (prefix, bytes = 16) => `${prefix}_${crypto.randomBytes(bytes).toString("hex")}`;

function legacyJson(filename, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, filename), "utf8")); }
  catch { return fallback; }
}

function ensureUserRow(id, user = {}) {
  if (!id) return null;
  const timestamp = user.updatedAt || user.createdAt || nowIso();
  sqlite.prepare(`
    INSERT INTO users (id, google_sub, email, name, picture_url, email_verified, created_at, updated_at)
    VALUES (@id, @googleSub, @email, @name, @picture, @emailVerified, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      google_sub = COALESCE(excluded.google_sub, users.google_sub),
      email = COALESCE(excluded.email, users.email),
      name = COALESCE(excluded.name, users.name),
      picture_url = COALESCE(excluded.picture_url, users.picture_url),
      email_verified = MAX(users.email_verified, excluded.email_verified),
      updated_at = excluded.updated_at
  `).run({
    id,
    googleSub: user.googleSub || null,
    email: user.email || null,
    name: user.name || null,
    picture: user.picture || user.pictureUrl || null,
    emailVerified: user.emailVerified === false ? 0 : user.googleSub ? 1 : 0,
    createdAt: user.createdAt || timestamp,
    updatedAt: timestamp,
  });
  return id;
}

function importLegacyData() {
  const imported = sqlite.prepare("SELECT value FROM schema_meta WHERE key = 'legacy_json_imported_v1'").get();
  if (imported) return;

  const billing = legacyJson("billing.json", { users: {}, checkouts: {}, processedEvents: {} });
  const scripts = legacyJson("scripts.json", { scripts: {} });
  const preproduction = legacyJson("preproduction.json", { projects: {} });
  const credits = legacyJson("credits.json", { budget: 5, spent: 0 });

  // Older builds used the cookie/user id as the account id, so the same Google
  // account could appear more than once. Collapse those records before import.
  const allLegacyOwners = new Set([
    ...Object.keys(billing.users || {}),
    ...Object.values(scripts.scripts || {}).map((script) => script?.userId).filter(Boolean),
    ...Object.values(billing.checkouts || {}).map((checkout) => checkout?.userId).filter(Boolean),
  ]);
  const canonicalUserIds = new Map(Array.from(allLegacyOwners, (id) => [id, id]));
  const googleGroups = new Map();
  for (const [id, user] of Object.entries(billing.users || {})) {
    if (!user?.googleSub) continue;
    if (!googleGroups.has(user.googleSub)) googleGroups.set(user.googleSub, []);
    googleGroups.get(user.googleSub).push(id);
  }
  for (const ids of googleGroups.values()) {
    const score = (id) => {
      const user = billing.users?.[id] || {};
      const activeSubscription = user.subscription?.status === "active" ? 9e15 : 0;
      const latestScript = Object.values(scripts.scripts || {})
        .filter((script) => script?.userId === id)
        .reduce((latest, script) => Math.max(latest, Date.parse(script.updatedAt || script.createdAt || 0) || 0), 0);
      return activeSubscription + latestScript;
    };
    const canonical = [...ids].sort((a, b) => score(b) - score(a))[0];
    ids.forEach((id) => canonicalUserIds.set(id, canonical));
  }
  const canonicalId = (id) => canonicalUserIds.get(id) || id;

  sqlite.transaction(() => {
    const owners = new Set(Array.from(allLegacyOwners, canonicalId));

    for (const id of owners) {
      const aliases = Array.from(allLegacyOwners).filter((legacyId) => canonicalId(legacyId) === id);
      const merged = aliases.map((legacyId) => billing.users?.[legacyId]).filter(Boolean)
        .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0] || {};
      ensureUserRow(id, merged);
    }

    for (const [id, user] of Object.entries(billing.users || {})) {
      const ownerId = canonicalId(id);
      ensureUserRow(ownerId, user);
      if (user.subscription) {
        sqlite.prepare(`
          INSERT INTO subscriptions (user_id, plan, status, checkout_id, provider_subscription_id, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan, status=excluded.status,
            checkout_id=excluded.checkout_id, provider_subscription_id=excluded.provider_subscription_id,
            updated_at=excluded.updated_at
        `).run(ownerId, user.subscription.plan || null, user.subscription.status || null,
          user.subscription.checkoutId || null, user.subscription.subscriptionId || null,
          user.subscription.updatedAt || nowIso());
      }
    }

    for (const checkout of Object.values(billing.checkouts || {})) {
      if (!checkout?.id || !checkout.userId) continue;
      const ownerId = canonicalId(checkout.userId);
      ensureUserRow(ownerId, billing.users?.[checkout.userId] || {});
      sqlite.prepare(`
        INSERT OR REPLACE INTO checkouts (id, user_id, email, plan, product_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(checkout.id, ownerId, checkout.email || null, checkout.plan || null,
        checkout.productId || null, checkout.status || "pending", checkout.createdAt || nowIso());
    }

    for (const [eventId, processedAt] of Object.entries(billing.processedEvents || {})) {
      sqlite.prepare("INSERT OR REPLACE INTO processed_events (id, processed_at) VALUES (?, ?)")
        .run(eventId, processedAt || nowIso());
    }

    for (const script of Object.values(scripts.scripts || {})) {
      if (!script?.id || !script.userId) continue;
      const ownerId = canonicalId(script.userId);
      ensureUserRow(ownerId, billing.users?.[script.userId] || {});
      sqlite.prepare(`
        INSERT OR REPLACE INTO scripts
          (id, user_id, title, filename, source, text, blocks_json, chat_json, title_room_json, character_names_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(script.id, ownerId, script.title || "Untitled Screenplay", script.filename || null,
        script.source || null, script.text || "", stringify(script.blocks || []), stringify(script.chat || []), stringify(script.titleRoom || {}), stringify(script.characterNames || {}),
        script.createdAt || nowIso(), script.updatedAt || nowIso());
    }

    for (const [scriptId, project] of Object.entries(preproduction.projects || {})) {
      if (!sqlite.prepare("SELECT 1 FROM scripts WHERE id = ?").get(scriptId)) continue;
      sqlite.prepare(`
        INSERT OR REPLACE INTO preproduction_projects (script_id, data_json, updated_at)
        VALUES (?, ?, ?)
      `).run(scriptId, stringify(project), project?.updatedAt || nowIso());
    }

    sqlite.prepare("INSERT OR REPLACE INTO app_settings (key, value_json) VALUES ('credits', ?)")
      .run(stringify(credits));

    for (const legacyId of allLegacyOwners) {
      const ownerId = canonicalId(legacyId);
      const user = billing.users?.[legacyId] || {};
      const tokenHash = hashSecret(legacyId);
      sqlite.prepare(`
        INSERT OR IGNORE INTO sessions
          (id, token_hash, user_id, auth_method, created_at, expires_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`ses_legacy_${tokenHash.slice(0, 24)}`, tokenHash, ownerId,
        user.googleSub ? "google" : "legacy", nowIso(), futureIso(365), nowIso());
    }

    sqlite.prepare("INSERT INTO schema_meta (key, value) VALUES ('legacy_json_imported_v1', ?)")
      .run(nowIso());
    sqlite.prepare("INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '1')").run();
  })();
}

importLegacyData();

function claimLegacyLocalDataForSingleGoogleUser() {
  const alreadyClaimed = sqlite.prepare("SELECT value FROM schema_meta WHERE key = 'legacy_local_data_claimed_v2'").get();
  const importedLegacyData = sqlite.prepare("SELECT value FROM schema_meta WHERE key = 'legacy_json_imported_v1'").get();
  if (alreadyClaimed || !importedLegacyData) return;
  const googleUsers = sqlite.prepare("SELECT id FROM users WHERE google_sub IS NOT NULL").all();
  if (googleUsers.length !== 1) return;
  const googleUserId = googleUsers[0].id;

  sqlite.transaction(() => {
    const legacyOwners = sqlite.prepare(`
      SELECT DISTINCT users.id
      FROM users
      LEFT JOIN scripts ON scripts.user_id = users.id
      LEFT JOIN checkouts ON checkouts.user_id = users.id
      LEFT JOIN subscriptions ON subscriptions.user_id = users.id
      LEFT JOIN sessions ON sessions.user_id = users.id
      WHERE users.google_sub IS NULL
        AND (scripts.id IS NOT NULL OR checkouts.id IS NOT NULL OR subscriptions.user_id IS NOT NULL OR sessions.auth_method = 'legacy')
    `).all();
    for (const owner of legacyOwners) transferOwnership(owner.id, googleUserId);
    sqlite.prepare("INSERT INTO schema_meta (key, value) VALUES ('legacy_local_data_claimed_v2', ?)").run(nowIso());
    sqlite.prepare("INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '2')").run();
  })();
}

claimLegacyLocalDataForSingleGoogleUser();
sqlite.prepare("INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '6')").run();

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    googleSub: row.google_sub || null,
    email: row.email || null,
    name: row.name || null,
    picture: row.picture_url || null,
    lumierePreferences: parseJson(row.lumiere_preferences_json, {}),
    emailVerified: !!row.email_verified,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getUser(userId) {
  return rowToUser(sqlite.prepare("SELECT * FROM users WHERE id = ?").get(userId));
}

function getSubscription(userId) {
  const row = sqlite.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(userId);
  if (!row) return null;
  return {
    plan: row.plan,
    status: row.status,
    checkoutId: row.checkout_id,
    subscriptionId: row.provider_subscription_id,
    updatedAt: row.updated_at,
  };
}

function loadBillingSnapshot() {
  const users = {};
  for (const row of sqlite.prepare("SELECT * FROM users").all()) {
    const user = rowToUser(row);
    users[user.id] = { ...user, subscription: getSubscription(user.id) };
  }
  const checkouts = {};
  for (const row of sqlite.prepare("SELECT * FROM checkouts").all()) {
    checkouts[row.id] = {
      id: row.id, userId: row.user_id, email: row.email, plan: row.plan,
      productId: row.product_id || null, status: row.status, createdAt: row.created_at,
    };
  }
  const processedEvents = Object.fromEntries(
    sqlite.prepare("SELECT * FROM processed_events").all().map((row) => [row.id, row.processed_at]),
  );
  return { users, checkouts, subscriptions: {}, processedEvents, oauthStates: {} };
}

function saveBillingSnapshot(snapshot) {
  sqlite.transaction(() => {
    for (const [id, user] of Object.entries(snapshot?.users || {})) {
      ensureUserRow(id, user || {});
      if (user?.subscription) {
        const sub = user.subscription;
        sqlite.prepare(`
          INSERT INTO subscriptions (user_id, plan, status, checkout_id, provider_subscription_id, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan, status=excluded.status,
            checkout_id=excluded.checkout_id, provider_subscription_id=excluded.provider_subscription_id,
            updated_at=excluded.updated_at
        `).run(id, sub.plan || null, sub.status || null, sub.checkoutId || null,
          sub.subscriptionId || null, sub.updatedAt || nowIso());
      }
    }
    for (const checkout of Object.values(snapshot?.checkouts || {})) {
      if (!checkout?.id || !checkout.userId) continue;
      ensureUserRow(checkout.userId, snapshot.users?.[checkout.userId] || {});
      sqlite.prepare(`
        INSERT INTO checkouts (id, user_id, email, plan, product_id, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, email=excluded.email,
          plan=excluded.plan, product_id=excluded.product_id, status=excluded.status
      `).run(checkout.id, checkout.userId, checkout.email || null, checkout.plan || null,
        checkout.productId || null, checkout.status || "pending", checkout.createdAt || nowIso());
    }
    for (const [eventId, processedAt] of Object.entries(snapshot?.processedEvents || {})) {
      sqlite.prepare("INSERT OR REPLACE INTO processed_events (id, processed_at) VALUES (?, ?)")
        .run(eventId, processedAt || nowIso());
    }
  })();
}

function rowToScript(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    filename: row.filename,
    source: row.source,
    text: row.text || "",
    blocks: parseJson(row.blocks_json, []),
    chat: parseJson(row.chat_json, []),
    titleRoom: parseJson(row.title_room_json, {}),
    characterNames: parseJson(row.character_names_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function loadScriptsSnapshot() {
  return {
    scripts: Object.fromEntries(sqlite.prepare("SELECT * FROM scripts").all().map((row) => {
      const script = rowToScript(row);
      return [script.id, script];
    })),
  };
}

function saveScriptsSnapshot(snapshot) {
  sqlite.transaction(() => {
    const incoming = new Set();
    for (const script of Object.values(snapshot?.scripts || {})) {
      if (!script?.id || !script.userId) continue;
      incoming.add(script.id);
      ensureUserRow(script.userId, {});
      sqlite.prepare(`
        INSERT INTO scripts
          (id, user_id, title, filename, source, text, blocks_json, chat_json, title_room_json, character_names_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET user_id=excluded.user_id, title=excluded.title,
          filename=excluded.filename, source=excluded.source, text=excluded.text,
          blocks_json=excluded.blocks_json, chat_json=excluded.chat_json,
          title_room_json=excluded.title_room_json, character_names_json=excluded.character_names_json,
          updated_at=excluded.updated_at
      `).run(script.id, script.userId, script.title || "Untitled Screenplay", script.filename || null,
        script.source || null, script.text || "", stringify(script.blocks || []), stringify(script.chat || []), stringify(script.titleRoom || {}), stringify(script.characterNames || {}),
        script.createdAt || nowIso(), script.updatedAt || nowIso());
    }
    for (const { id } of sqlite.prepare("SELECT id FROM scripts").all()) {
      if (!incoming.has(id)) sqlite.prepare("DELETE FROM scripts WHERE id = ?").run(id);
    }
  })();
}

function loadPreproductionSnapshot() {
  return {
    projects: Object.fromEntries(sqlite.prepare("SELECT * FROM preproduction_projects").all()
      .map((row) => [row.script_id, parseJson(row.data_json, {})])),
  };
}

function savePreproductionSnapshot(snapshot) {
  sqlite.transaction(() => {
    const incoming = new Set();
    for (const [scriptId, project] of Object.entries(snapshot?.projects || {})) {
      if (!sqlite.prepare("SELECT 1 FROM scripts WHERE id = ?").get(scriptId)) continue;
      incoming.add(scriptId);
      sqlite.prepare(`
        INSERT INTO preproduction_projects (script_id, data_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(script_id) DO UPDATE SET data_json=excluded.data_json, updated_at=excluded.updated_at
      `).run(scriptId, stringify(project), project?.updatedAt || nowIso());
    }
    for (const { script_id: scriptId } of sqlite.prepare("SELECT script_id FROM preproduction_projects").all()) {
      if (!incoming.has(scriptId)) sqlite.prepare("DELETE FROM preproduction_projects WHERE script_id = ?").run(scriptId);
    }
  })();
}

function getCanvasWorkspace(scriptId, userId) {
  if (!scriptId || !userId) return null;
  const row = sqlite.prepare(`
    SELECT canvas_workspaces.data_json
    FROM canvas_workspaces
    JOIN scripts ON scripts.id = canvas_workspaces.script_id
    WHERE canvas_workspaces.script_id = ?
      AND canvas_workspaces.user_id = ?
      AND scripts.user_id = ?
  `).get(scriptId, userId, userId);
  return row ? parseJson(row.data_json, null) : null;
}

function saveCanvasWorkspace(scriptId, userId, workspace) {
  if (!scriptId || !userId) throw new Error("scriptId and userId are required");
  const owned = sqlite.prepare("SELECT 1 FROM scripts WHERE id = ? AND user_id = ?").get(scriptId, userId);
  if (!owned) return false;
  const updatedAt = workspace?.updatedAt || nowIso();
  sqlite.prepare(`
    INSERT INTO canvas_workspaces (script_id, user_id, data_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(script_id) DO UPDATE SET
      user_id = excluded.user_id,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `).run(scriptId, userId, stringify(workspace || {}), updatedAt);
  return true;
}

function loadCreditsSnapshot() {
  const row = sqlite.prepare("SELECT value_json FROM app_settings WHERE key = 'credits'").get();
  return parseJson(row?.value_json, { budget: 5, spent: 0 });
}

function saveCreditsSnapshot(value) {
  sqlite.prepare("INSERT OR REPLACE INTO app_settings (key, value_json) VALUES ('credits', ?)")
    .run(stringify(value));
}

function saveBudgetReceipt({ id, scriptId, userId, filename, mimeType, data }) {
  const bytes = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
  sqlite.prepare(`
    INSERT INTO budget_receipts
      (id, script_id, user_id, filename, mime_type, size_bytes, data_blob, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, scriptId, userId, filename, mimeType, bytes.length, bytes, nowIso());
  return { id, scriptId, userId, filename, mimeType, size: bytes.length };
}

function getBudgetReceipt(id, scriptId, userId) {
  const row = sqlite.prepare(`
    SELECT id, script_id, user_id, filename, mime_type, size_bytes, data_blob, created_at
    FROM budget_receipts
    WHERE id = ? AND script_id = ? AND user_id = ?
  `).get(id, scriptId, userId);
  if (!row) return null;
  return {
    id: row.id,
    scriptId: row.script_id,
    userId: row.user_id,
    filename: row.filename,
    mimeType: row.mime_type,
    size: row.size_bytes,
    data: row.data_blob,
    createdAt: row.created_at,
  };
}

function getSessionByToken(token) {
  if (!token) return null;
  const row = sqlite.prepare(`
    SELECT sessions.*, users.google_sub, users.email, users.name, users.picture_url
    FROM sessions LEFT JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(hashSecret(token));
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    sqlite.prepare("DELETE FROM sessions WHERE id = ?").run(row.id);
    return null;
  }
  sqlite.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(nowIso(), row.id);
  return {
    id: row.id,
    userId: row.user_id || null,
    authMethod: row.auth_method,
    googleSub: row.google_sub || null,
    email: row.email || null,
    name: row.name || null,
    picture: row.picture_url || null,
    expiresAt: row.expires_at,
  };
}

function getSessionById(sessionId) {
  const row = sqlite.prepare(`
    SELECT sessions.*, users.google_sub, users.email, users.name, users.picture_url
    FROM sessions LEFT JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ?
  `).get(sessionId);
  if (!row) return null;
  return {
    id: row.id, userId: row.user_id || null, authMethod: row.auth_method,
    googleSub: row.google_sub || null, email: row.email || null,
    name: row.name || null, picture: row.picture_url || null, expiresAt: row.expires_at,
  };
}

function createSession({ token = null, userId = null, authMethod = "anonymous" } = {}) {
  const rawToken = token || crypto.randomBytes(32).toString("base64url");
  const id = randomId("ses", 16);
  const timestamp = nowIso();
  sqlite.prepare(`
    INSERT INTO sessions (id, token_hash, user_id, auth_method, created_at, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, hashSecret(rawToken), userId, authMethod, timestamp, futureIso(365), timestamp);
  return { token: rawToken, session: getSessionById(id) };
}

function deleteSessionByToken(token) {
  if (!token) return;
  sqlite.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSecret(token));
}

function createOauthState(state, sessionId, returnTo) {
  sqlite.prepare("DELETE FROM oauth_states WHERE created_at < ?")
    .run(new Date(Date.now() - 10 * 60 * 1000).toISOString());
  sqlite.prepare(`
    INSERT INTO oauth_states (state_hash, session_id, return_to, created_at)
    VALUES (?, ?, ?, ?)
  `).run(hashSecret(state), sessionId, returnTo, nowIso());
}

function consumeOauthState(state) {
  if (!state) return null;
  return sqlite.transaction(() => {
    const key = hashSecret(state);
    const row = sqlite.prepare("SELECT * FROM oauth_states WHERE state_hash = ?").get(key);
    if (row) sqlite.prepare("DELETE FROM oauth_states WHERE state_hash = ?").run(key);
    return row ? { sessionId: row.session_id, returnTo: row.return_to, createdAt: row.created_at } : null;
  })();
}

function transferOwnership(fromUserId, toUserId) {
  if (!fromUserId || !toUserId || fromUserId === toUserId) return;
  sqlite.prepare("UPDATE scripts SET user_id = ? WHERE user_id = ?").run(toUserId, fromUserId);
  sqlite.prepare("UPDATE budget_receipts SET user_id = ? WHERE user_id = ?").run(toUserId, fromUserId);
  sqlite.prepare("UPDATE canvas_workspaces SET user_id = ? WHERE user_id = ?").run(toUserId, fromUserId);
  sqlite.prepare("UPDATE checkouts SET user_id = ? WHERE user_id = ?").run(toUserId, fromUserId);
  sqlite.prepare("UPDATE sessions SET user_id = ?, auth_method = 'google' WHERE user_id = ?").run(toUserId, fromUserId);
  const sourceSubscription = sqlite.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(fromUserId);
  const targetSubscription = sqlite.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(toUserId);
  if (sourceSubscription && !targetSubscription) {
    sqlite.prepare(`
      INSERT INTO subscriptions (user_id, plan, status, checkout_id, provider_subscription_id, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(toUserId, sourceSubscription.plan, sourceSubscription.status, sourceSubscription.checkout_id,
      sourceSubscription.provider_subscription_id, sourceSubscription.updated_at);
  }
  sqlite.prepare("DELETE FROM subscriptions WHERE user_id = ?").run(fromUserId);
  sqlite.prepare("DELETE FROM users WHERE id = ? AND google_sub IS NULL").run(fromUserId);
}

function connectGoogleIdentity(sessionId, profile) {
  return sqlite.transaction(() => {
    const session = getSessionById(sessionId);
    if (!session) throw new Error("login session expired");
    const googleSub = String(profile.sub || "").trim();
    if (!googleSub) throw new Error("Google profile has no subject identifier");
    const existing = sqlite.prepare("SELECT * FROM users WHERE google_sub = ?").get(googleSub);
    const current = session.userId ? sqlite.prepare("SELECT * FROM users WHERE id = ?").get(session.userId) : null;
    let userId;
    if (existing) {
      userId = existing.id;
      if (current && current.id !== userId && !current.google_sub) transferOwnership(current.id, userId);
    } else if (current && !current.google_sub) {
      userId = current.id;
    } else {
      userId = randomId("usr", 16);
      ensureUserRow(userId, { createdAt: nowIso() });
    }
    sqlite.prepare(`
      UPDATE users SET google_sub = ?, email = ?, name = ?, picture_url = ?,
        email_verified = ?, updated_at = ? WHERE id = ?
    `).run(googleSub, profile.email || null, profile.name || profile.email?.split("@")[0] || "Writer",
      profile.picture || null, profile.email_verified === false ? 0 : 1, nowIso(), userId);
    sqlite.prepare("UPDATE sessions SET user_id = ?, auth_method = 'google', last_seen_at = ? WHERE id = ?")
      .run(userId, nowIso(), sessionId);
    return getUser(userId);
  })();
}

function updateUserName(userId, name) {
  sqlite.prepare("UPDATE users SET name = ?, updated_at = ? WHERE id = ?").run(name, nowIso(), userId);
  return getUser(userId);
}

function updateUserLumierePreferences(userId, preferences) {
  sqlite.prepare("UPDATE users SET lumiere_preferences_json = ?, updated_at = ? WHERE id = ?")
    .run(stringify(preferences || {}), nowIso(), userId);
  return getUser(userId);
}

function databaseHealth() {
  const scripts = sqlite.prepare("SELECT COUNT(*) AS count FROM scripts").get().count;
  const users = sqlite.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  return { ok: true, adapter: "sqlite", path: DATABASE_PATH, schemaVersion: 7, users, scripts };
}

export {
  DATABASE_PATH,
  connectGoogleIdentity,
  consumeOauthState,
  createOauthState,
  createSession,
  databaseHealth,
  deleteSessionByToken,
  getSessionById,
  getSessionByToken,
  getBudgetReceipt,
  getCanvasWorkspace,
  getSubscription,
  getUser,
  loadBillingSnapshot,
  loadCreditsSnapshot,
  loadPreproductionSnapshot,
  loadScriptsSnapshot,
  saveBillingSnapshot,
  saveBudgetReceipt,
  saveCanvasWorkspace,
  saveCreditsSnapshot,
  savePreproductionSnapshot,
  saveScriptsSnapshot,
  updateUserLumierePreferences,
  updateUserName,
};
