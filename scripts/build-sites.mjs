import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Reuse the validated static build used by Vercel/Netlify, then add the
// Cloudflare Worker entrypoint required by Sites.
await import("./build-netlify.mjs");
const workerDirectory = path.join(root, "dist", "server");
const distDirectory = path.join(root, "dist");
const publicDirectory = path.join(distDirectory, "public");
fs.mkdirSync(workerDirectory, { recursive: true });
fs.copyFileSync(path.join(root, "sites-worker.js"), path.join(workerDirectory, "index.js"));
fs.rmSync(publicDirectory, { recursive: true, force: true });
fs.mkdirSync(publicDirectory, { recursive: true });
for (const entry of fs.readdirSync(distDirectory, { withFileTypes: true })) {
  if (["server", "public", ".openai", "wrangler.jsonc"].includes(entry.name)) continue;
  fs.cpSync(path.join(distDirectory, entry.name), path.join(publicDirectory, entry.name), { recursive: true });
}
const wrangler = JSON.stringify(
    {
      main: "./server/index.js",
      compatibility_date: "2026-07-15",
      assets: {
        directory: "./public",
        binding: "ASSETS",
      },
    },
    null,
    2,
  ) + "\n";
fs.writeFileSync(path.join(distDirectory, "wrangler.jsonc"), wrangler);
fs.writeFileSync(path.join(distDirectory, "wrangler.json"), wrangler);
console.log(`FilmScript Sites build ready in ${path.join(root, "dist")}`);
