import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = process.env.FILMSCRIPT_DATA_DIR
  ? path.resolve(process.env.FILMSCRIPT_DATA_DIR)
  : path.join(ROOT, "data");

const STORAGE_ROOT = path.join(DATA_DIR, "media", "shot-references");
const MIME_EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function safeStoragePath(key) {
  const cleanKey = String(key || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = path.resolve(STORAGE_ROOT, cleanKey);
  const rootPrefix = `${path.resolve(STORAGE_ROOT)}${path.sep}`;
  if (!resolved.startsWith(rootPrefix)) throw new Error("invalid reference storage key");
  return resolved;
}

class LocalReferenceStorage {
  name = "local";

  async put({ scriptId, assetId, mimeType, data }) {
    const extension = MIME_EXTENSIONS.get(mimeType);
    if (!extension) throw new Error("unsupported reference image type");
    const key = `${scriptId}/${assetId}${extension}`;
    const destination = safeStoragePath(key);
    await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await fs.writeFile(destination, data, { mode: 0o600 });
    return { provider: this.name, key };
  }

  async get({ key }) {
    return fs.readFile(safeStoragePath(key));
  }

  async remove({ key }) {
    if (!key) return;
    await fs.rm(safeStoragePath(key), { force: true });
  }
}

// The app stores only provider-neutral asset metadata on the screenplay.
// A future S3 adapter only needs to implement put/get/remove with this contract;
// no Shot List UI or project schema changes are required.
const adapters = new Map([["local", new LocalReferenceStorage()]]);
const configuredProvider = String(process.env.FILMSCRIPT_REFERENCE_STORAGE || "local").trim().toLowerCase();

function adapterFor(provider = configuredProvider) {
  const adapter = adapters.get(provider);
  if (!adapter) throw new Error(`reference storage provider is not configured: ${provider}`);
  return adapter;
}

export const referenceStorage = {
  provider: configuredProvider,
  put: (input) => adapterFor().put(input),
  get: (asset) => adapterFor(asset?.provider).get(asset),
  remove: (asset) => adapterFor(asset?.provider).remove(asset),
};
