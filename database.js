import Database from "better-sqlite3";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
// Local Preview deliberately uses its own SQLite directory. This keeps a
// preview session and its demo workspace separate from a developer's local
// data, while production continues to use FILMSCRIPT_DATA_DIR as before.
const PREVIEW_MODE = process.env.FILMSCRIPT_PREVIEW_MODE === "true";
const DATA_DIR = PREVIEW_MODE
  ? path.resolve(process.env.FILMSCRIPT_PREVIEW_DATA_DIR || path.join(ROOT, "data-preview"))
  : process.env.FILMSCRIPT_DATA_DIR
    ? path.resolve(process.env.FILMSCRIPT_DATA_DIR)
    : process.env.VERCEL
      ? path.join("/tmp", "filmscript")
      : path.join(ROOT, "data");
const DATABASE_PATH = PREVIEW_MODE
  ? path.resolve(process.env.FILMSCRIPT_PREVIEW_DB_PATH || path.join(DATA_DIR, "filmscript.sqlite"))
  : process.env.FILMSCRIPT_DB_PATH
    ? path.resolve(process.env.FILMSCRIPT_DB_PATH)
    : path.join(DATA_DIR, "filmscript.sqlite");

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
try { fs.chmodSync(path.dirname(DATABASE_PATH), 0o700); } catch {}

const sqlite = new Database(DATABASE_PATH);
const SESSION_TOUCH_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.FILMSCRIPT_SESSION_TOUCH_INTERVAL_MS) || 15 * 60 * 1000,
);
// SQLite's WAL sidecar files are not safe on shared network filesystems such as
// the production EFS volume. Keep local development fast with WAL, but use the
// rollback journal when explicitly configured for shared persistent storage.
const configuredJournalMode = String(process.env.FILMSCRIPT_SQLITE_JOURNAL_MODE || "WAL").toUpperCase();
const SQLITE_JOURNAL_MODE = ["WAL", "DELETE", "TRUNCATE", "PERSIST"].includes(configuredJournalMode)
  ? configuredJournalMode
  : "WAL";
sqlite.pragma(`journal_mode = ${SQLITE_JOURNAL_MODE}`);
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
    first_name TEXT,
    last_name TEXT,
    picture_url TEXT,
    lumiere_preferences_json TEXT NOT NULL DEFAULT '{}',
    gender TEXT,
    birth_date TEXT,
    profile_completed_at TEXT,
    interface_language TEXT,
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

  CREATE TABLE IF NOT EXISTS canvas_libraries (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

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
    billing_cycle_key TEXT,
    current_period_start TEXT,
    current_period_end TEXT,
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

  -- A switch preview is an authorization to apply one exact provider mutation,
  -- not a payment record. Tokens are hashed at rest and expire quickly so an
  -- old browser confirmation can never silently change a subscription later.
  CREATE TABLE IF NOT EXISTS subscription_switch_previews (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subscription_id TEXT NOT NULL,
    from_plan TEXT NOT NULL,
    to_plan TEXT NOT NULL,
    mode TEXT NOT NULL,
    request_json TEXT NOT NULL,
    preview_json TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    claimed_at TEXT,
    completed_at TEXT,
    provider_result_json TEXT,
    error_code TEXT
  );
  CREATE INDEX IF NOT EXISTS subscription_switch_previews_user_idx
    ON subscription_switch_previews(user_id, expires_at DESC);

  CREATE TABLE IF NOT EXISTS oauth_states (
    state_hash TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    return_to TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS auth_handoffs (
    token_hash TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    return_to TEXT NOT NULL,
    expires_at TEXT NOT NULL
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
if (!userColumns.has("gender")) {
  sqlite.exec("ALTER TABLE users ADD COLUMN gender TEXT");
}
if (!userColumns.has("birth_date")) {
  sqlite.exec("ALTER TABLE users ADD COLUMN birth_date TEXT");
}
if (!userColumns.has("profile_completed_at")) {
  sqlite.exec("ALTER TABLE users ADD COLUMN profile_completed_at TEXT");
}
if (!userColumns.has("first_name")) {
  sqlite.exec("ALTER TABLE users ADD COLUMN first_name TEXT");
}
if (!userColumns.has("last_name")) {
  sqlite.exec("ALTER TABLE users ADD COLUMN last_name TEXT");
}
const checkoutColumns = new Set(sqlite.prepare("PRAGMA table_info(checkouts)").all().map((column) => column.name));
if (!checkoutColumns.has("product_id")) {
  sqlite.exec("ALTER TABLE checkouts ADD COLUMN product_id TEXT");
}
const subscriptionColumns = new Set(sqlite.prepare("PRAGMA table_info(subscriptions)").all().map((column) => column.name));
if (!subscriptionColumns.has("billing_cycle_key")) {
  sqlite.exec("ALTER TABLE subscriptions ADD COLUMN billing_cycle_key TEXT");
}
if (!subscriptionColumns.has("current_period_start")) {
  sqlite.exec("ALTER TABLE subscriptions ADD COLUMN current_period_start TEXT");
}
if (!subscriptionColumns.has("current_period_end")) {
  sqlite.exec("ALTER TABLE subscriptions ADD COLUMN current_period_end TEXT");
}

const nowIso = () => new Date().toISOString();
const futureIso = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const hashSecret = (value) => crypto.createHash("sha256").update(String(value || "")).digest("hex");
const parseJson = (value, fallback) => {
  try { return JSON.parse(value); } catch { return fallback; }
};
const stringify = (value) => JSON.stringify(value ?? null);
const randomId = (prefix, bytes = 16) => `${prefix}_${crypto.randomBytes(bytes).toString("hex")}`;

function splitPersonName(value) {
  const parts = String(value || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  return {
    firstName: parts[0] || null,
    lastName: parts.length >= 2 ? parts.slice(1).join(" ") : null,
  };
}

function isEmailDerivedName(name, email) {
  const normalizedName = String(name || "").replace(/\s+/g, " ").trim().toLowerCase();
  const emailPrefix = String(email || "").trim().split("@")[0]?.toLowerCase() || "";
  return Boolean(normalizedName && emailPrefix && normalizedName === emailPrefix);
}

function legacyJson(filename, fallback) {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, filename), "utf8")); }
  catch { return fallback; }
}

function ensureUserRow(id, user = {}) {
  if (!id) return null;
  const timestamp = user.updatedAt || user.createdAt || nowIso();
  const parsedName = splitPersonName(user.name);
  sqlite.prepare(`
    INSERT INTO users (id, google_sub, email, name, first_name, last_name, picture_url, lumiere_preferences_json, gender, birth_date, profile_completed_at, email_verified, created_at, updated_at)
    VALUES (@id, @googleSub, @email, @name, @firstName, @lastName, @picture, @lumierePreferences, @gender, @birthDate, @profileCompletedAt, @emailVerified, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      google_sub = COALESCE(excluded.google_sub, users.google_sub),
      email = COALESCE(excluded.email, users.email),
      name = COALESCE(excluded.name, users.name),
      first_name = COALESCE(excluded.first_name, users.first_name),
      last_name = COALESCE(excluded.last_name, users.last_name),
      picture_url = COALESCE(excluded.picture_url, users.picture_url),
      lumiere_preferences_json = CASE WHEN excluded.lumiere_preferences_json = '{}' THEN users.lumiere_preferences_json ELSE excluded.lumiere_preferences_json END,
      gender = COALESCE(excluded.gender, users.gender),
      birth_date = COALESCE(excluded.birth_date, users.birth_date),
      profile_completed_at = COALESCE(excluded.profile_completed_at, users.profile_completed_at),
      email_verified = MAX(users.email_verified, excluded.email_verified),
      updated_at = excluded.updated_at
  `).run({
    id,
    googleSub: user.googleSub || null,
    email: user.email || null,
    name: user.name || null,
    firstName: user.firstName || parsedName.firstName,
    lastName: user.lastName || parsedName.lastName,
    picture: user.picture || user.pictureUrl || null,
    lumierePreferences: user.lumierePreferences ? stringify(user.lumierePreferences) : "{}",
    gender: user.gender || null,
    birthDate: user.birthDate || null,
    profileCompletedAt: user.profileCompletedAt || null,
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
          INSERT INTO subscriptions (
            user_id, plan, status, checkout_id, provider_subscription_id,
            billing_cycle_key, current_period_start, current_period_end, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan, status=excluded.status,
            checkout_id=excluded.checkout_id, provider_subscription_id=excluded.provider_subscription_id,
            billing_cycle_key=excluded.billing_cycle_key,
            current_period_start=excluded.current_period_start,
            current_period_end=excluded.current_period_end,
            updated_at=excluded.updated_at
        `).run(ownerId, user.subscription.plan || null, user.subscription.status || null,
          user.subscription.checkoutId || null, user.subscription.subscriptionId || null,
          user.subscription.billingCycleKey || null, user.subscription.currentPeriodStart || null,
          user.subscription.currentPeriodEnd || null,
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
  const claim = sqlite.transaction(() => {
    const alreadyClaimed = sqlite.prepare("SELECT value FROM schema_meta WHERE key = 'legacy_local_data_claimed_v2'").get();
    const importedLegacyData = sqlite.prepare("SELECT value FROM schema_meta WHERE key = 'legacy_json_imported_v1'").get();
    if (alreadyClaimed || !importedLegacyData) return;
    const googleUsers = sqlite.prepare("SELECT id FROM users WHERE google_sub IS NOT NULL").all();
    if (googleUsers.length !== 1) return;
    const googleUserId = googleUsers[0].id;
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
  });
  // Multiple backend tasks can overlap briefly during a rolling deployment.
  // Acquire the write lock before reading the marker so the second process
  // waits, then observes the completed claim instead of failing on promotion.
  claim.immediate();
}

claimLegacyLocalDataForSingleGoogleUser();
sqlite.prepare("INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', '9')").run();

function rowToUser(row) {
  if (!row) return null;
  const gender = row.gender === "man" || row.gender === "woman" || row.gender === "unspecified"
    ? row.gender
    : null;
  const birthDate = typeof row.birth_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.birth_date)
    ? row.birth_date
    : null;
  const interfaceLanguage = row.interface_language === "en" || row.interface_language === "es"
    ? row.interface_language
    : null;
  const storedName = String(row.name || "").replace(/\s+/g, " ").trim() || null;
  const emailDerivedName = isEmailDerivedName(storedName, row.email);
  const safeStoredName = emailDerivedName ? null : storedName;
  const parsedName = splitPersonName(safeStoredName);
  const firstName = String((emailDerivedName ? null : row.first_name) || parsedName.firstName || "").trim() || null;
  const lastName = String((emailDerivedName ? null : row.last_name) || parsedName.lastName || "").trim() || null;
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : safeStoredName;
  return {
    id: row.id,
    googleSub: row.google_sub || null,
    email: row.email || null,
    // Keep the long-standing `name` response for older clients, but derive it
    // from the authoritative person fields whenever they are complete.
    name: fullName || null,
    firstName,
    lastName,
    picture: row.picture_url || null,
    lumierePreferences: parseJson(row.lumiere_preferences_json, {}),
    gender,
    birthDate,
    profileCompletedAt: row.profile_completed_at || null,
    profileComplete: Boolean(firstName && lastName && (row.profile_completed_at || (gender && birthDate))),
    interfaceLanguage,
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
    billingCycleKey: row.billing_cycle_key || null,
    currentPeriodStart: row.current_period_start || null,
    currentPeriodEnd: row.current_period_end || null,
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
          INSERT INTO subscriptions (
            user_id, plan, status, checkout_id, provider_subscription_id,
            billing_cycle_key, current_period_start, current_period_end, updated_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan, status=excluded.status,
            checkout_id=excluded.checkout_id, provider_subscription_id=excluded.provider_subscription_id,
            billing_cycle_key=excluded.billing_cycle_key,
            current_period_start=excluded.current_period_start,
            current_period_end=excluded.current_period_end,
            updated_at=excluded.updated_at
        `).run(id, sub.plan || null, sub.status || null, sub.checkoutId || null,
          sub.subscriptionId || null, sub.billingCycleKey || null,
          sub.currentPeriodStart || null, sub.currentPeriodEnd || null,
          sub.updatedAt || nowIso());
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
      AND (scripts.user_id = ? OR EXISTS (
        SELECT 1 FROM project_memberships
        WHERE project_id = scripts.id AND user_id = ? AND status = 'active'
      ))
  `).get(scriptId, userId, userId);
  return row ? parseJson(row.data_json, null) : null;
}

function saveCanvasWorkspace(scriptId, userId, workspace) {
  if (!scriptId || !userId) throw new Error("scriptId and userId are required");
  const project = sqlite.prepare(`SELECT user_id FROM scripts WHERE id = ? AND (user_id = ? OR EXISTS (
    SELECT 1 FROM project_memberships WHERE project_id = scripts.id AND user_id = ? AND status = 'active'
  ))`).get(scriptId, userId, userId);
  if (!project) return false;
  const updatedAt = workspace?.updatedAt || nowIso();
  sqlite.prepare(`
    INSERT INTO canvas_workspaces (script_id, user_id, data_json, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(script_id) DO UPDATE SET
      user_id = excluded.user_id,
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `).run(scriptId, project.user_id, stringify(workspace || {}), updatedAt);
  return true;
}

function getCanvasLibrary(userId) {
  if (!userId) return null;
  const row = sqlite.prepare("SELECT data_json FROM canvas_libraries WHERE user_id = ?").get(userId);
  return row ? parseJson(row.data_json, null) : null;
}

function saveCanvasLibrary(userId, library) {
  if (!userId) throw new Error("userId is required");
  const owned = sqlite.prepare("SELECT 1 FROM users WHERE id = ?").get(userId);
  if (!owned) return false;
  const updatedAt = library?.updatedAt || nowIso();
  sqlite.prepare(`
    INSERT INTO canvas_libraries (user_id, data_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      data_json = excluded.data_json,
      updated_at = excluded.updated_at
  `).run(userId, stringify(library || {}), updatedAt);
  return true;
}

function rowToAccountImagingAssetState(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    assetId: row.asset_id,
    liked: row.liked === 1,
    likedAt: row.liked === 1 ? (row.liked_at || null) : null,
    trashed: Boolean(row.trashed_at),
    trashedAt: row.trashed_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getAccountImagingAssetStates(userId, assetIds = []) {
  if (!userId) return new Map();
  const ids = [...new Set((Array.isArray(assetIds) ? assetIds : []).map(String).filter(Boolean))];
  if (!ids.length) return new Map();
  const result = new Map();
  for (let offset = 0; offset < ids.length; offset += 500) {
    const chunk = ids.slice(offset, offset + 500);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = sqlite.prepare(`
      SELECT user_id, asset_id, liked, liked_at, trashed_at, created_at, updated_at
      FROM account_imaging_asset_state
      WHERE user_id = ? AND asset_id IN (${placeholders})
    `).all(userId, ...chunk);
    for (const row of rows) result.set(row.asset_id, rowToAccountImagingAssetState(row));
  }
  return result;
}

function mutateAccountImagingAssetStates({ userId, assetIds = [], operation }) {
  if (!userId) throw new Error("userId is required");
  const ids = [...new Set((Array.isArray(assetIds) ? assetIds : []).map(String).filter(Boolean))];
  if (!ids.length) return [];
  if (!["like", "unlike", "trash"].includes(operation)) {
    throw new Error("unsupported account Imagine asset-state operation");
  }
  const timestamp = nowIso();
  const like = sqlite.prepare(`
    INSERT INTO account_imaging_asset_state
      (user_id, asset_id, liked, liked_at, trashed_at, created_at, updated_at)
    VALUES (?, ?, 1, ?, NULL, ?, ?)
    ON CONFLICT(user_id, asset_id) DO UPDATE SET
      liked = CASE
        WHEN account_imaging_asset_state.trashed_at IS NULL THEN 1
        ELSE account_imaging_asset_state.liked
      END,
      liked_at = CASE
        WHEN account_imaging_asset_state.trashed_at IS NOT NULL THEN account_imaging_asset_state.liked_at
        WHEN account_imaging_asset_state.liked = 1 THEN account_imaging_asset_state.liked_at
        ELSE excluded.liked_at
      END,
      updated_at = CASE
        WHEN account_imaging_asset_state.trashed_at IS NOT NULL THEN account_imaging_asset_state.updated_at
        WHEN account_imaging_asset_state.liked = 1 THEN account_imaging_asset_state.updated_at
        ELSE excluded.updated_at
      END
  `);
  const unlike = sqlite.prepare(`
    INSERT INTO account_imaging_asset_state
      (user_id, asset_id, liked, liked_at, trashed_at, created_at, updated_at)
    VALUES (?, ?, 0, NULL, NULL, ?, ?)
    ON CONFLICT(user_id, asset_id) DO UPDATE SET
      liked = 0,
      liked_at = NULL,
      updated_at = CASE
        WHEN account_imaging_asset_state.liked = 0 THEN account_imaging_asset_state.updated_at
        ELSE excluded.updated_at
      END
  `);
  const trash = sqlite.prepare(`
    INSERT INTO account_imaging_asset_state
      (user_id, asset_id, liked, liked_at, trashed_at, created_at, updated_at)
    VALUES (?, ?, 0, NULL, ?, ?, ?)
    ON CONFLICT(user_id, asset_id) DO UPDATE SET
      liked = 0,
      liked_at = NULL,
      trashed_at = COALESCE(account_imaging_asset_state.trashed_at, excluded.trashed_at),
      updated_at = CASE
        WHEN account_imaging_asset_state.trashed_at IS NOT NULL
          AND account_imaging_asset_state.liked = 0
          THEN account_imaging_asset_state.updated_at
        ELSE excluded.updated_at
      END
  `);
  const mutation = sqlite.transaction(() => {
    for (const assetId of ids) {
      if (operation === "like") like.run(userId, assetId, timestamp, timestamp, timestamp);
      else if (operation === "unlike") unlike.run(userId, assetId, timestamp, timestamp);
      else trash.run(userId, assetId, timestamp, timestamp, timestamp);
    }
    const states = getAccountImagingAssetStates(userId, ids);
    return ids.map((assetId) => states.get(assetId));
  });
  return mutation.immediate();
}

function rowToAccountImagingGeneration(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    requestId: row.request_id,
    fingerprint: row.fingerprint,
    status: row.status,
    leaseToken: row.lease_token || null,
    leaseExpiresAt: row.lease_expires_at || null,
    assetId: row.asset_id || null,
    result: parseJson(row.result_json, null),
    errorCode: row.error_code || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || null,
  };
}

function claimAccountImagingGeneration({ userId, requestId, fingerprint, leaseMs = 15 * 60 * 1000 }) {
  if (!userId || !requestId || !fingerprint) return { state: "missing", generation: null };
  const timestamp = nowIso();
  const leaseToken = `imaging_lease_${crypto.randomBytes(16).toString("hex")}`;
  const leaseExpiresAt = new Date(Date.now() + Math.max(60_000, Number(leaseMs) || 0)).toISOString();
  const claim = sqlite.transaction(() => {
    const current = sqlite.prepare(`
      SELECT * FROM account_imaging_generations WHERE user_id = ? AND request_id = ?
    `).get(userId, requestId);
    if (current?.fingerprint && current.fingerprint !== fingerprint) {
      return { state: "conflict", generation: rowToAccountImagingGeneration(current) };
    }
    if (current?.status === "completed") {
      return { state: "completed", generation: rowToAccountImagingGeneration(current) };
    }
    if (current?.status === "pending" && Date.parse(current.lease_expires_at || "") > Date.now()) {
      return { state: "pending", generation: rowToAccountImagingGeneration(current) };
    }
    if (!current) {
      sqlite.prepare(`
        INSERT INTO account_imaging_generations
          (user_id, request_id, fingerprint, status, lease_token, lease_expires_at, created_at, updated_at)
        VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)
      `).run(userId, requestId, fingerprint, leaseToken, leaseExpiresAt, timestamp, timestamp);
    } else {
      sqlite.prepare(`
        UPDATE account_imaging_generations
        SET fingerprint = ?, status = 'pending', lease_token = ?, lease_expires_at = ?,
          asset_id = NULL, result_json = NULL, error_code = NULL, updated_at = ?, completed_at = NULL
        WHERE user_id = ? AND request_id = ?
      `).run(fingerprint, leaseToken, leaseExpiresAt, timestamp, userId, requestId);
    }
    const generation = sqlite.prepare(`
      SELECT * FROM account_imaging_generations WHERE user_id = ? AND request_id = ?
    `).get(userId, requestId);
    return { state: "claimed", generation: rowToAccountImagingGeneration(generation) };
  });
  // Acquire the write lock before inspecting the receipt. A deferred
  // transaction can deadlock when two already-running ECS tasks both read and
  // then attempt to upgrade at the same moment.
  return claim.immediate();
}

function completeAccountImagingGeneration({ userId, requestId, leaseToken, assetId, result }) {
  if (!userId || !requestId || !leaseToken) return null;
  const timestamp = nowIso();
  const update = sqlite.prepare(`
    UPDATE account_imaging_generations
    SET status = 'completed', lease_token = NULL, lease_expires_at = NULL,
      asset_id = ?, result_json = ?, error_code = NULL, updated_at = ?, completed_at = ?
    WHERE user_id = ? AND request_id = ? AND status = 'pending' AND lease_token = ?
  `).run(assetId || null, stringify(result || null), timestamp, timestamp, userId, requestId, leaseToken);
  if (update.changes !== 1) return null;
  return rowToAccountImagingGeneration(sqlite.prepare(`
    SELECT * FROM account_imaging_generations WHERE user_id = ? AND request_id = ?
  `).get(userId, requestId));
}

function failAccountImagingGeneration({ userId, requestId, leaseToken, errorCode = "generation_failed" }) {
  if (!userId || !requestId || !leaseToken) return null;
  const timestamp = nowIso();
  sqlite.prepare(`
    UPDATE account_imaging_generations
    SET status = 'failed', lease_token = NULL, lease_expires_at = NULL,
      error_code = ?, updated_at = ?
    WHERE user_id = ? AND request_id = ? AND status = 'pending' AND lease_token = ?
  `).run(String(errorCode || "generation_failed").slice(0, 160), timestamp, userId, requestId, leaseToken);
  return rowToAccountImagingGeneration(sqlite.prepare(`
    SELECT * FROM account_imaging_generations WHERE user_id = ? AND request_id = ?
  `).get(userId, requestId));
}

function loadCreditsSnapshot() {
  const row = sqlite.prepare("SELECT value_json FROM app_settings WHERE key = 'credits'").get();
  return parseJson(row?.value_json, { budget: 5, spent: 0 });
}

function saveCreditsSnapshot(value) {
  sqlite.prepare("INSERT OR REPLACE INTO app_settings (key, value_json) VALUES ('credits', ?)")
    .run(stringify(value));
}

// Per-account Lumiere allowance. This lives in app_settings so existing
// installations can adopt monthly credits without a schema migration.
function loadLumiereCreditsSnapshot() {
  const row = sqlite.prepare("SELECT value_json FROM app_settings WHERE key = 'lumiere_credits'").get();
  return parseJson(row?.value_json, {});
}

function saveLumiereCreditsSnapshot(value) {
  sqlite.prepare("INSERT OR REPLACE INTO app_settings (key, value_json) VALUES ('lumiere_credits', ?)")
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
    WHERE id = ? AND script_id = ?
  `).get(id, scriptId);
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
  // Authentication is checked on every protected request. Touching SQLite on
  // every read turns harmless polling into constant EFS journal writes, so a
  // session is refreshed at most once per interval.
  const lastSeenAt = Date.parse(row.last_seen_at || "");
  if (!Number.isFinite(lastSeenAt) || Date.now() - lastSeenAt >= SESSION_TOUCH_INTERVAL_MS) {
    sqlite.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(nowIso(), row.id);
  }
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
  // Keep the session table bounded and avoid year-long bearer cookies.
  sqlite.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(timestamp);
  const durationDays = authMethod === "google" ? 30 : 1;
  sqlite.prepare(`
    INSERT INTO sessions (id, token_hash, user_id, auth_method, created_at, expires_at, last_seen_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, hashSecret(rawToken), userId, authMethod, timestamp, futureIso(durationDays), timestamp);
  return { token: rawToken, session: getSessionById(id) };
}

function deleteSessionByToken(token) {
  if (!token) return;
  sqlite.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSecret(token));
}

function rotateSessionToken(sessionId) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const timestamp = nowIso();
  const result = sqlite.prepare(`
    UPDATE sessions
    SET token_hash = ?, expires_at = ?, last_seen_at = ?
    WHERE id = ?
  `).run(hashSecret(rawToken), futureIso(30), timestamp, sessionId);
  return result.changes ? rawToken : null;
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

// The OAuth callback is hosted on the API subdomain while the workspace is
// hosted on filmscript.app. A short-lived, one-time handoff lets the workspace
// establish its own first-party cookie before it loads private data. This
// avoids relying on browser-specific subdomain cookie propagation after Google
// returns from its account chooser.
function createAuthHandoff(sessionId, returnTo) {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  sqlite.prepare("DELETE FROM auth_handoffs WHERE expires_at <= ?").run(new Date(now).toISOString());
  sqlite.prepare(`
    INSERT INTO auth_handoffs (token_hash, session_id, return_to, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(hashSecret(token), sessionId, returnTo, new Date(now + 2 * 60 * 1000).toISOString());
  return token;
}

function consumeAuthHandoff(token) {
  if (!token) return null;
  return sqlite.transaction(() => {
    const key = hashSecret(token);
    const row = sqlite.prepare("SELECT * FROM auth_handoffs WHERE token_hash = ?").get(key);
    if (row) sqlite.prepare("DELETE FROM auth_handoffs WHERE token_hash = ?").run(key);
    if (!row || Date.parse(row.expires_at) <= Date.now()) return null;
    return { sessionId: row.session_id, returnTo: row.return_to };
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
      INSERT INTO subscriptions (
        user_id, plan, status, checkout_id, provider_subscription_id,
        billing_cycle_key, current_period_start, current_period_end, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(toUserId, sourceSubscription.plan, sourceSubscription.status, sourceSubscription.checkout_id,
      sourceSubscription.provider_subscription_id, sourceSubscription.billing_cycle_key,
      sourceSubscription.current_period_start, sourceSubscription.current_period_end,
      sourceSubscription.updated_at);
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
    const googleName = String(profile.name || "").replace(/\s+/g, " ").trim() || null;
    const parsedGoogleName = splitPersonName(googleName);
    const googleFirstName = String(profile.given_name || parsedGoogleName.firstName || "").trim() || null;
    const googleLastName = String(profile.family_name || parsedGoogleName.lastName || "").trim() || null;
    const emailPrefix = String(profile.email || "").trim().split("@")[0]?.toLowerCase() || null;
    sqlite.prepare(`
      UPDATE users SET google_sub = ?, email = ?,
        name = CASE
          WHEN name IS NULL OR TRIM(name) = '' OR LOWER(TRIM(name)) = ?
          THEN COALESCE(?, name)
          ELSE name
        END,
        first_name = CASE
          WHEN first_name IS NULL OR TRIM(first_name) = '' OR LOWER(TRIM(name)) = ?
          THEN COALESCE(?, first_name)
          ELSE first_name
        END,
        last_name = CASE
          WHEN last_name IS NULL OR TRIM(last_name) = '' OR LOWER(TRIM(name)) = ?
          THEN COALESCE(?, last_name)
          ELSE last_name
        END,
        picture_url = ?, email_verified = ?, updated_at = ? WHERE id = ?
    `).run(googleSub, profile.email || null, emailPrefix, googleName,
      emailPrefix, googleFirstName, emailPrefix, googleLastName,
      profile.picture || null, profile.email_verified === false ? 0 : 1, nowIso(), userId);
    sqlite.prepare("UPDATE sessions SET user_id = ?, auth_method = 'google', expires_at = ?, last_seen_at = ? WHERE id = ?")
      .run(userId, futureIso(30), nowIso(), sessionId);
    return getUser(userId);
  })();
}

function updateUserName(userId, name, identity = {}) {
  const parsedName = splitPersonName(name);
  const firstName = String(identity.firstName || parsedName.firstName || "").replace(/\s+/g, " ").trim() || null;
  const lastName = String(identity.lastName || parsedName.lastName || "").replace(/\s+/g, " ").trim() || null;
  sqlite.prepare("UPDATE users SET name = ?, first_name = ?, last_name = ?, updated_at = ? WHERE id = ?")
    .run(name, firstName, lastName, nowIso(), userId);
  return getUser(userId);
}

const PROFILE_GENDERS = new Set(["man", "woman", "unspecified"]);

function profileError(message) {
  const error = new Error(message);
  error.status = 422;
  return error;
}

function normalizeProfileGender(value) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  const normalized = String(value).trim().toLowerCase();
  if (!PROFILE_GENDERS.has(normalized)) {
    throw profileError("Choose man, woman, or prefer not to say.");
  }
  return normalized;
}

function rowToSubscriptionSwitchPreview(row) {
  if (!row) return null;
  return {
    tokenHash: row.token_hash,
    userId: row.user_id,
    subscriptionId: row.subscription_id,
    fromPlan: row.from_plan,
    toPlan: row.to_plan,
    mode: row.mode,
    request: parseJson(row.request_json, {}),
    preview: parseJson(row.preview_json, {}),
    idempotencyKey: row.idempotency_key,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    claimedAt: row.claimed_at || null,
    completedAt: row.completed_at || null,
    providerResult: parseJson(row.provider_result_json, null),
    errorCode: row.error_code || null,
  };
}

// Keep a durable, one-time server authorization between the read-only
// proration preview and the paid provider mutation. The opaque token itself is
// never stored, and the idempotency key is bound to this exact request.
function createSubscriptionSwitchPreview({
  token,
  userId,
  subscriptionId,
  fromPlan,
  toPlan,
  mode,
  request,
  preview,
  idempotencyKey,
  expiresAt,
}) {
  if (!token || !userId || !subscriptionId || !fromPlan || !toPlan || !mode || !idempotencyKey || !expiresAt) {
    throw new Error("Invalid subscription switch preview");
  }
  const createdAt = nowIso();
  const tokenHash = hashSecret(token);
  sqlite.transaction(() => {
    // A timeout after the provider mutation is deliberately left in
    // `processing` so a second browser action cannot charge twice. Once the
    // short authorization window expires, the API must re-check provider state
    // before it can issue a new preview.
    sqlite.prepare(`
      UPDATE subscription_switch_previews
      SET status = 'expired', completed_at = ?
      WHERE user_id = ? AND subscription_id = ? AND status = 'processing' AND expires_at <= ?
    `).run(createdAt, userId, subscriptionId, createdAt);
    const inFlight = sqlite.prepare(`
      SELECT expires_at FROM subscription_switch_previews
      WHERE user_id = ? AND subscription_id = ? AND status = 'processing'
      LIMIT 1
    `).get(userId, subscriptionId);
    if (inFlight) {
      const error = Object.assign(new Error("A plan change is still being reconciled."), {
        code: "subscription_switch_in_progress",
        expiresAt: inFlight.expires_at,
      });
      throw error;
    }
    sqlite.prepare(`
      UPDATE subscription_switch_previews
      SET status = 'superseded', completed_at = ?
      WHERE user_id = ? AND subscription_id = ? AND status = 'issued'
    `).run(createdAt, userId, subscriptionId);
    sqlite.prepare("DELETE FROM subscription_switch_previews WHERE expires_at <= ? AND status IN ('issued', 'failed', 'superseded', 'expired')")
      .run(createdAt);
    sqlite.prepare(`
      INSERT INTO subscription_switch_previews (
        token_hash, user_id, subscription_id, from_plan, to_plan, mode,
        request_json, preview_json, idempotency_key, status, created_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?, ?)
    `).run(
      tokenHash,
      userId,
      subscriptionId,
      fromPlan,
      toPlan,
      mode,
      stringify(request),
      stringify(preview),
      idempotencyKey,
      createdAt,
      expiresAt,
    );
  })();
  return rowToSubscriptionSwitchPreview(
    sqlite.prepare("SELECT * FROM subscription_switch_previews WHERE token_hash = ?").get(tokenHash),
  );
}

function claimSubscriptionSwitchPreview({ token, userId }) {
  if (!token || !userId) return { state: "missing", preview: null };
  const tokenHash = hashSecret(token);
  const timestamp = nowIso();
  return sqlite.transaction(() => {
    const row = sqlite.prepare("SELECT * FROM subscription_switch_previews WHERE token_hash = ?").get(tokenHash);
    if (!row || row.user_id !== userId) return { state: "missing", preview: null };
    if (Date.parse(row.expires_at) <= Date.now() && ["issued", "processing"].includes(row.status)) {
      sqlite.prepare(`
        UPDATE subscription_switch_previews
        SET status = 'expired', completed_at = ?
        WHERE token_hash = ? AND status IN ('issued', 'processing')
      `).run(timestamp, tokenHash);
      return {
        state: "expired",
        preview: rowToSubscriptionSwitchPreview(sqlite.prepare("SELECT * FROM subscription_switch_previews WHERE token_hash = ?").get(tokenHash)),
      };
    }
    const preview = rowToSubscriptionSwitchPreview(row);
    if (row.status === "applied") return { state: "applied", preview };
    if (row.status === "processing") return { state: "processing", preview };
    if (row.status !== "issued") return { state: row.status, preview };
    const result = sqlite.prepare(`
      UPDATE subscription_switch_previews
      SET status = 'processing', claimed_at = ?
      WHERE token_hash = ? AND user_id = ? AND status = 'issued'
    `).run(timestamp, tokenHash, userId);
    if (result.changes !== 1) return { state: "processing", preview };
    return {
      state: "claimed",
      preview: rowToSubscriptionSwitchPreview(sqlite.prepare("SELECT * FROM subscription_switch_previews WHERE token_hash = ?").get(tokenHash)),
    };
  })();
}

function completeSubscriptionSwitchPreview({ token, userId, providerResult = null }) {
  if (!token || !userId) return null;
  const tokenHash = hashSecret(token);
  sqlite.prepare(`
    UPDATE subscription_switch_previews
    SET status = 'applied', completed_at = ?, provider_result_json = ?, error_code = NULL
    WHERE token_hash = ? AND user_id = ? AND status = 'processing'
  `).run(nowIso(), stringify(providerResult), tokenHash, userId);
  return rowToSubscriptionSwitchPreview(
    sqlite.prepare("SELECT * FROM subscription_switch_previews WHERE token_hash = ? AND user_id = ?").get(tokenHash, userId),
  );
}

function failSubscriptionSwitchPreview({ token, userId, errorCode = "provider_error", retryable = false }) {
  if (!token || !userId) return null;
  const tokenHash = hashSecret(token);
  const status = retryable ? "issued" : "failed";
  sqlite.prepare(`
    UPDATE subscription_switch_previews
    SET status = ?, claimed_at = CASE WHEN ? = 'issued' THEN NULL ELSE claimed_at END,
      completed_at = CASE WHEN ? = 'issued' THEN NULL ELSE ? END,
      error_code = ?
    WHERE token_hash = ? AND user_id = ? AND status = 'processing'
  `).run(status, status, status, nowIso(), String(errorCode || "provider_error").slice(0, 160), tokenHash, userId);
  return rowToSubscriptionSwitchPreview(
    sqlite.prepare("SELECT * FROM subscription_switch_previews WHERE token_hash = ? AND user_id = ?").get(tokenHash, userId),
  );
}

function normalizeBirthDate(value) {
  if (value === undefined) return undefined;
  if (value === null || String(value).trim() === "") return null;
  const normalized = String(value).trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
  if (!match) throw profileError("Birthday must use a valid date.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  const today = new Date().toISOString().slice(0, 10);
  if (year < 1900 || candidate.toISOString().slice(0, 10) !== normalized || normalized > today) {
    throw profileError("Birthday must be a real date between 1900 and today.");
  }
  return normalized;
}

function normalizeInterfaceLanguage(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (value !== "en" && value !== "es") {
    throw profileError("Interface language must be English or Spanish.");
  }
  return value;
}

function updateUserProfile(userId, profile = {}) {
  const current = getUser(userId);
  if (!current) return null;
  const nextGender = Object.prototype.hasOwnProperty.call(profile, "gender")
    ? normalizeProfileGender(profile.gender)
    : current.gender;
  const nextBirthDate = Object.prototype.hasOwnProperty.call(profile, "birthDate")
    ? normalizeBirthDate(profile.birthDate)
    : current.birthDate;
  const nextInterfaceLanguage = Object.prototype.hasOwnProperty.call(profile, "interfaceLanguage")
    ? normalizeInterfaceLanguage(profile.interfaceLanguage)
    : current.interfaceLanguage;
  const complete = Boolean(nextGender && nextBirthDate);
  const completedAt = complete ? (current.profileCompletedAt || nowIso()) : null;
  sqlite.prepare(`
    UPDATE users
    SET gender = ?, birth_date = ?, profile_completed_at = ?, interface_language = ?, updated_at = ?
    WHERE id = ?
  `).run(nextGender, nextBirthDate, completedAt, nextInterfaceLanguage, nowIso(), userId);
  return getUser(userId);
}

function updateUserLumierePreferences(userId, preferences) {
  sqlite.prepare("UPDATE users SET lumiere_preferences_json = ?, updated_at = ? WHERE id = ?")
    .run(stringify(preferences || {}), nowIso(), userId);
  return getUser(userId);
}

function databaseHealth() {
  sqlite.prepare("SELECT 1 AS ok").get();
  const schemaVersion = Number(sqlite.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get()?.value || 9);
  return { ok: true, adapter: "sqlite", path: DATABASE_PATH, schemaVersion };
}

export {
  DATABASE_PATH,
  claimAccountImagingGeneration,
  claimSubscriptionSwitchPreview,
  connectGoogleIdentity,
  completeSubscriptionSwitchPreview,
  completeAccountImagingGeneration,
  consumeAuthHandoff,
  consumeOauthState,
  createAuthHandoff,
  createOauthState,
  createSession,
  createSubscriptionSwitchPreview,
  databaseHealth,
  deleteSessionByToken,
  getSessionById,
  getSessionByToken,
  getBudgetReceipt,
  getCanvasLibrary,
  getCanvasWorkspace,
  getAccountImagingAssetStates,
  failSubscriptionSwitchPreview,
  failAccountImagingGeneration,
  getSubscription,
  getUser,
  loadBillingSnapshot,
  loadCreditsSnapshot,
  loadLumiereCreditsSnapshot,
  loadPreproductionSnapshot,
  loadScriptsSnapshot,
  mutateAccountImagingAssetStates,
  saveBillingSnapshot,
  saveBudgetReceipt,
  saveCanvasLibrary,
  saveCanvasWorkspace,
  saveCreditsSnapshot,
  saveLumiereCreditsSnapshot,
  savePreproductionSnapshot,
  saveScriptsSnapshot,
  rotateSessionToken,
  updateUserLumierePreferences,
  updateUserName,
  updateUserProfile,
};
