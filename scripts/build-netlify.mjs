import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const frontendFiles = [
  "App.dc.html",
  "Editor v5.dc.html",
  "Features.dc.html",
  "Pricing.dc.html",
  "Subscription.dc.html",
  "index.html",
  "support.js",
  "scripts-access-guard.js",
  "theme-preference.js",
  "language-preference.js",
  "ui-sounds.js",
  "writing-idle.js",
  "character-name-tools.js",
  "funnel-tracking.js",
  "billing-client.js",
  "lumiere-client.js",
  "lumiere-preferences.js",
  "pdf-import.js",
  "scripts-client.js",
  "preproduction-client.js",
  "canvas-client.js",
  "canvas-workspace.js",
  "analysis-model.js",
  "analysis-client.js",
  "analysis-workspace.js",
  "budget-model.js",
  "budget-client.js",
  "budget-workspace.js",
  "auth-modal.css",
  "filmscript-controls.css",
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const filename of frontendFiles) {
  fs.copyFileSync(path.join(root, filename), path.join(output, filename));
}
fs.cpSync(path.join(root, "assets"), path.join(output, "assets"), { recursive: true });

const sourceConfig = fs.readFileSync(path.join(root, "runtime-config.js"), "utf8");
const apiUrl = String(process.env.API_URL || "").replace(/\/$/, "");
const erpApiUrl = String(process.env.ERP_API_URL || "").replace(/\/$/, "");
const erpEnvironment = String(process.env.ERP_ENVIRONMENT || "").trim().toLowerCase();
fs.writeFileSync(
  path.join(output, "runtime-config.js"),
  `window.FILMSCRIPT_CONFIG = { apiUrl: ${JSON.stringify(apiUrl)}, erpApiUrl: ${JSON.stringify(erpApiUrl)}, erpEnvironment: ${JSON.stringify(erpEnvironment)} };\n${sourceConfig}`,
);

console.log(`FilmScript frontend built in ${output}`);
console.log(`API URL: ${apiUrl || "same origin (set API_URL for Netlify)"}`);
console.log(`ERP API URL: ${erpApiUrl || "disabled (set ERP_API_URL to enable funnel tracking)"}`);
