import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXPORT_FORMAT_VERSION = 1;
export const BUNDLE_FORMAT_VERSION = 1;
export const STORAGE_MANIFEST_VERSION = 1;
export const FILMSCRIPT_PRODUCTION_SUPABASE_PROJECT_REF = "nkuyfryxookojkvductn";
const ALLOWED_MIGRATION_ENVIRONMENTS = new Set(["local", "preview", "staging", "production"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function normalizedEndpointHost(value) {
  const host = String(value || "").trim().toLowerCase();
  return host.startsWith("[") && host.endsWith("]") ? host.slice(1, -1) : host;
}

export function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) throw new Error(`Unexpected positional argument: ${token}`);
    const key = token.slice(2);
    if (!key) throw new Error("Invalid empty option");
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

export function requiredArg(args, name) {
  const value = args[name];
  if (typeof value !== "string" || !value.trim()) throw new Error(`Missing required option --${name}`);
  return value;
}

export function requireProductionConfirmation(args, action = "operation") {
  const environment = normalizeMigrationEnvironment(args.environment || "local");
  const projectRef = typeof args["project-ref"] === "string" ? args["project-ref"].trim() : "";
  if (projectRef === FILMSCRIPT_PRODUCTION_SUPABASE_PROJECT_REF && environment !== "production") {
    throw new Error(`Refusing to label the FilmScript production project as ${environment}; use --environment production`);
  }
  if (environment === "production" && projectRef && projectRef !== FILMSCRIPT_PRODUCTION_SUPABASE_PROJECT_REF) {
    throw new Error(`FilmScript production operations must target project ${FILMSCRIPT_PRODUCTION_SUPABASE_PROJECT_REF}`);
  }
  if (environment === "production" && args.confirm !== "production") {
    throw new Error(`Refusing production ${action}. Re-run with --environment production --confirm production after reviewing the plan.`);
  }
  if (args.confirm && args.confirm !== "production") {
    throw new Error("The only accepted confirmation value is --confirm production");
  }
  return environment;
}

export function normalizeMigrationEnvironment(value, label = "migration environment") {
  const environment = String(value || "").trim().toLowerCase();
  if (!ALLOWED_MIGRATION_ENVIRONMENTS.has(environment)) {
    throw new Error(`Unknown ${label} "${environment}". Use local, preview, staging, or production exactly.`);
  }
  return environment;
}

export function assertRegularFile(filename, label = "file") {
  let stats;
  try { stats = fs.statSync(filename); }
  catch { throw new Error(`${label} does not exist: ${filename}`); }
  if (!stats.isFile()) throw new Error(`${label} is not a regular file: ${filename}`);
  return stats;
}

export function resolvePsqlBin(environment = process.env) {
  const candidates = [];
  if (environment.PSQL_BIN) candidates.push(environment.PSQL_BIN);
  for (const directory of String(environment.PATH || "").split(path.delimiter).filter(Boolean)) {
    candidates.push(path.join(directory, "psql"));
  }
  candidates.push("/opt/homebrew/opt/libpq/bin/psql", "/usr/local/opt/libpq/bin/psql");
  for (const candidate of candidates) {
    try {
      const stats = fs.statSync(candidate);
      fs.accessSync(candidate, fs.constants.X_OK);
      if (stats.isFile()) return candidate;
    } catch {}
  }
  throw new Error("psql was not found. Set PSQL_BIN or install Homebrew libpq; linking it globally is not required.");
}

export function postgresEnvironmentFromUrl(databaseUrl, baseEnvironment = process.env) {
  let parsed;
  try { parsed = new URL(databaseUrl); }
  catch { throw new Error("The configured database URL is invalid"); }
  if (!new Set(["postgres:", "postgresql:"]).has(parsed.protocol)) throw new Error("Database URL must use postgres:// or postgresql://");
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!parsed.hostname || !parsed.username || !database) throw new Error("Database URL must include host, user, and database name");
  const environment = {
    ...baseEnvironment,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGUSER: decodeURIComponent(parsed.username),
    PGDATABASE: database,
  };
  if (parsed.password) environment.PGPASSWORD = decodeURIComponent(parsed.password);
  else delete environment.PGPASSWORD;
  const queryMapping = {
    sslmode: "PGSSLMODE",
    sslrootcert: "PGSSLROOTCERT",
    sslcert: "PGSSLCERT",
    sslkey: "PGSSLKEY",
    application_name: "PGAPPNAME",
    connect_timeout: "PGCONNECT_TIMEOUT",
    options: "PGOPTIONS",
    channel_binding: "PGCHANNELBINDING",
    target_session_attrs: "PGTARGETSESSIONATTRS",
  };
  for (const [query, variable] of Object.entries(queryMapping)) {
    if (parsed.searchParams.has(query)) environment[variable] = parsed.searchParams.get(query);
  }
  return { environment, host: parsed.hostname };
}

export function assertSupabaseProjectRef(endpoint, projectRef) {
  const expected = String(projectRef || "").trim();
  if (!/^[a-z0-9]{20}$/.test(expected)) throw new Error("--project-ref must be a 20-character Supabase project ref");
  let parsed;
  try { parsed = new URL(endpoint); }
  catch { throw new Error("Supabase endpoint is invalid"); }
  const hostname = parsed.hostname.toLowerCase();
  const username = decodeURIComponent(parsed.username || "");
  const serviceEndpoint = parsed.protocol === "https:" && hostname === `${expected}.supabase.co` && !username;
  const directDatabase = ["postgres:", "postgresql:"].includes(parsed.protocol)
    && hostname === `db.${expected}.supabase.co`
    && username === "postgres";
  const transactionPooler = ["postgres:", "postgresql:"].includes(parsed.protocol)
    && hostname.endsWith(".pooler.supabase.com")
    && hostname !== "pooler.supabase.com"
    && username === `postgres.${expected}`;
  if (!serviceEndpoint && !directDatabase && !transactionPooler) {
    throw new Error(`Refusing endpoint that does not identify Supabase project ${expected} on an official Supabase host`);
  }
  return parsed;
}

export function assertLocalEndpoint(endpoint) {
  let parsed;
  try { parsed = new URL(endpoint); }
  catch { throw new Error("Local endpoint is invalid"); }
  if (!LOOPBACK_HOSTS.has(normalizedEndpointHost(parsed.hostname))) {
    throw new Error("Refusing --environment local with a non-loopback endpoint");
  }
  return parsed;
}

export function assertCaptureTarget(target, { expectedEnvironment, expectedProjectRef } = {}) {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    throw new Error("Capture manifest is missing destination provenance");
  }
  const environment = normalizeMigrationEnvironment(target.environment, "capture environment");
  const host = normalizedEndpointHost(target.host);
  if (!host || host.includes("/") || host.includes("@")) throw new Error("Capture manifest has an invalid destination host");
  const projectRef = target.projectRef == null ? null : String(target.projectRef).trim();
  if (environment === "local") {
    if (!LOOPBACK_HOSTS.has(host)) throw new Error("Local capture provenance must identify a loopback host");
    if (projectRef !== null) throw new Error("Local capture provenance must not contain a Supabase project ref");
  } else if (!/^[a-z0-9]{20}$/.test(projectRef || "")) {
    throw new Error("Remote capture provenance must contain a 20-character Supabase project ref");
  } else {
    const officialServiceHost = host === `${projectRef}.supabase.co`;
    const officialDatabaseHost = host === `db.${projectRef}.supabase.co`;
    const officialPoolerHost = host.endsWith(".pooler.supabase.com") && host !== "pooler.supabase.com";
    if (!officialServiceHost && !officialDatabaseHost && !officialPoolerHost) {
      throw new Error("Remote capture provenance must identify an official Supabase host");
    }
  }

  if (expectedEnvironment != null) {
    const expected = normalizeMigrationEnvironment(expectedEnvironment, "expected capture environment");
    if (environment !== expected) throw new Error(`Capture environment mismatch: expected ${expected}, received ${environment}`);
  }
  if (expectedProjectRef != null) {
    const expected = String(expectedProjectRef).trim();
    if (!/^[a-z0-9]{20}$/.test(expected)) throw new Error("Expected project ref must be a 20-character Supabase project ref");
    if (projectRef !== expected) throw new Error(`Capture project ref mismatch: expected ${expected}, received ${projectRef || "none"}`);
  }
  return { host, projectRef, environment };
}

export function validateSupabaseServiceUrl(endpoint, { allowLocal = true } = {}) {
  let parsed;
  try { parsed = new URL(endpoint); }
  catch { throw new Error("Supabase service URL is invalid"); }
  const local = LOOPBACK_HOSTS.has(normalizedEndpointHost(parsed.hostname));
  if (parsed.protocol !== "https:" && !(allowLocal && local && parsed.protocol === "http:")) {
    throw new Error("Supabase service URL must use HTTPS (HTTP is allowed only for local Supabase)");
  }
  return parsed;
}

export function storageContractDataSha256(entries) {
  const contract = (entries || []).map((entry) => ({
    id: entry.id,
    source: {
      type: entry.source?.type,
      ...(entry.source?.type === "s3" ? { bucket: entry.source?.bucket, key: entry.source?.key } : {}),
      bytes: entry.source?.bytes,
      sha256: entry.source?.sha256,
    },
    target: { bucket: entry.target?.bucket, path: entry.target?.path },
    contentType: entry.contentType,
    metadata: entry.metadata || {},
  }));
  contract.sort((left, right) => String(left.id).localeCompare(String(right.id))
    || String(left.target.bucket).localeCompare(String(right.target.bucket))
    || String(left.target.path).localeCompare(String(right.target.path)));
  return sha256(stableStringify(contract));
}

export function createExclusiveDirectory(directory) {
  const resolved = path.resolve(directory);
  fs.mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
  try { fs.mkdirSync(resolved, { mode: 0o700 }); }
  catch (error) {
    if (error?.code === "EEXIST") throw new Error(`Output directory already exists: ${resolved}`);
    throw error;
  }
  return resolved;
}

export function writeJsonExclusive(filename, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filename, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx", mode });
}

export function writeTextExclusive(filename, value, mode = 0o600) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filename, value, { encoding: "utf8", flag: "wx", mode });
}

export function readJson(filename, label = "JSON file") {
  assertRegularFile(filename, label);
  try { return JSON.parse(fs.readFileSync(filename, "utf8")); }
  catch (error) { throw new Error(`${label} is not valid JSON (${filename}): ${error.message}`); }
}

export function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function sha256File(filename) {
  const hash = crypto.createHash("sha256");
  const descriptor = fs.openSync(filename, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead;
    do {
      bytesRead = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (bytesRead) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead);
  } finally {
    fs.closeSync(descriptor);
  }
  return hash.digest("hex");
}

export function canonicalize(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Non-finite numbers cannot be canonicalized");
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value === "bigint") return { $type: "bigint", value: String(value) };
  if (Buffer.isBuffer(value)) {
    return { $type: "blob", bytes: value.length, sha256: sha256(value) };
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  throw new Error(`Unsupported value type: ${typeof value}`);
}

export function stableStringify(value) {
  return JSON.stringify(canonicalize(value));
}

export function databaseCanonicalize(value) {
  if (value?.$type === "blob") return { $type: "blob", bytes: value.bytes, sha256: value.sha256 };
  if (Array.isArray(value)) return value.map(databaseCanonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, databaseCanonicalize(value[key])]));
  }
  return canonicalize(value);
}

export function databaseStableStringify(value) {
  return JSON.stringify(databaseCanonicalize(value));
}

export function rowDigest(row) {
  return sha256(stableStringify(row));
}

export function tableDigest(rows) {
  const hash = crypto.createHash("sha256");
  for (const row of rows) hash.update(stableStringify(row)).update("\n");
  return hash.digest("hex");
}

export function quoteIdentifier(identifier) {
  if (typeof identifier !== "string" || !identifier) throw new Error("SQL identifier cannot be empty");
  if (identifier.includes("\0")) throw new Error("SQL identifier cannot contain a NUL byte");
  return `"${identifier.replaceAll('"', '""')}"`;
}

export function parseQualifiedName(value, fallbackSchema = "public") {
  const parts = String(value || "").split(".");
  if (parts.length === 1 && parts[0]) return { schema: fallbackSchema, table: parts[0] };
  if (parts.length === 2 && parts.every(Boolean)) return { schema: parts[0], table: parts[1] };
  throw new Error(`Invalid qualified table name: ${value}`);
}

export function quoteQualifiedName(value) {
  const { schema, table } = typeof value === "string" ? parseQualifiedName(value) : value;
  return `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
}

export function normalizeRelativePath(value, label = "relative path") {
  const normalized = path.posix.normalize(String(value || "").replaceAll("\\", "/"));
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.startsWith("/") || normalized.includes("\0")) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return normalized;
}

export function resolveInside(root, relative, label = "path") {
  const safe = normalizeRelativePath(relative, label);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, safe);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error(`${label} escapes its root: ${relative}`);
  }
  return resolved;
}

export function sanitizeObjectSegment(value, fallback = "file") {
  const clean = String(value || "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f/\\]+/g, "_")
    .replace(/^\.+$/, "_")
    .trim()
    .slice(0, 160);
  return clean || fallback;
}

export function assertNoNullBytes(value, context = "value") {
  if (typeof value === "string" && value.includes("\0")) throw new Error(`${context} contains a NUL byte`);
  if (Array.isArray(value)) value.forEach((entry, index) => assertNoNullBytes(entry, `${context}[${index}]`));
  else if (value && typeof value === "object" && !Buffer.isBuffer(value)) {
    for (const [key, entry] of Object.entries(value)) assertNoNullBytes(entry, `${context}.${key}`);
  }
}

export function readNdjson(filename) {
  assertRegularFile(filename, "NDJSON file");
  const text = fs.readFileSync(filename, "utf8");
  const rows = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); }
    catch (error) { throw new Error(`Invalid NDJSON at ${filename}:${index + 1}: ${error.message}`); }
  }
  return rows;
}

export function isMain(importMetaUrl) {
  if (!process.argv[1]) return false;
  return path.resolve(process.argv[1]) === path.resolve(fileURLToPath(importMetaUrl));
}

export function normalizeTimestamp(value, context = "timestamp") {
  if (value == null || value === "") return null;
  const milliseconds = Date.parse(String(value));
  if (!Number.isFinite(milliseconds)) throw new Error(`${context} is not a valid timestamp: ${value}`);
  return new Date(milliseconds).toISOString();
}

export function normalizeDate(value, context = "date") {
  if (value == null || value === "") return null;
  const text = String(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new Error(`${context} is not a YYYY-MM-DD date: ${value}`);
  const candidate = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (candidate.toISOString().slice(0, 10) !== text) throw new Error(`${context} is not a real date: ${value}`);
  return text;
}
