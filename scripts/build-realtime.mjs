import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await build({ entryPoints:[path.join(root, "realtime-client-source.js")], bundle:true, minify:true, format:"iife", target:["es2022"], outfile:path.join(root, "assets/vendor/realtime-collaboration.bundle.js") });
