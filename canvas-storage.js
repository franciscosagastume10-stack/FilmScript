import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { S3ObjectStorage } from "./s3-storage.js";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.FILMSCRIPT_DATA_DIR
  ? path.resolve(process.env.FILMSCRIPT_DATA_DIR)
  : path.join(ROOT, "data");
const STORAGE_ROOT = path.join(DATA_DIR, "media", "canvas");
const EXTENSIONS = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);

function safePath(key) {
  const clean = String(key || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const resolved = path.resolve(STORAGE_ROOT, clean);
  const prefix = `${path.resolve(STORAGE_ROOT)}${path.sep}`;
  if (!resolved.startsWith(prefix)) throw new Error("invalid Canvas storage key");
  return resolved;
}

class LocalCanvasStorage {
  name = "local";

  async put({ scriptId, assetId, mimeType, data }) {
    const extension = EXTENSIONS.get(mimeType);
    if (!extension) throw new Error("unsupported Canvas image type");
    const key = `${scriptId}/${assetId}${extension}`;
    const destination = safePath(key);
    await fs.mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await fs.writeFile(destination, data, { mode: 0o600 });
    return { provider: this.name, key };
  }

  async get({ key }) {
    return fs.readFile(safePath(key));
  }

  async remove({ key }) {
    if (!key) return;
    try { await fs.unlink(safePath(key)); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

// This adapter boundary keeps Canvas, Vault, and Boards independent from the
// durable object store selected by the backend environment.
function createCanvasStorage(options = {}) {
  const provider = String(
    options.provider || process.env.FILMSCRIPT_CANVAS_STORAGE_PROVIDER || "local",
  ).trim().toLowerCase();
  if (provider === "local") return new LocalCanvasStorage();
  if (provider === "s3") return new S3ObjectStorage({ namespace: "canvas", ...options });
  throw new Error(`Unsupported Canvas storage provider: ${provider}`);
}

const canvasStorage = createCanvasStorage();

export { LocalCanvasStorage, canvasStorage, createCanvasStorage };
