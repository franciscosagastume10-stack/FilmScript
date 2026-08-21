import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "dist");
const frontendFiles = [
  "App.dc.html",
  "Imaging.dc.html",
  "auth-complete.html",
  "auth-google.html",
  "Editor v5.dc.html",
  "Features.dc.html",
  "Pricing.dc.html",
  "Subscription.dc.html",
  "index.html",
  "SharedProject.html",
  "GuestAccess.html",
  "guest-access.js",
  "Invitation.html",
  "invitation-access.js",
  "support.js",
  "seamless-navigation.js",
  "scripts-access-guard.js",
  "theme-preference.js",
  "language-preference.js",
  "ui-sounds.js",
  "writing-idle.js",
  "character-name-tools.js",
  "funnel-tracking.js",
  "billing-client.js",
  "credit-indicator.js",
  "profile-onboarding.js",
  "lumiere-client.js",
  "lumiere-access-modal.js",
  "lumiere-preferences.js",
  "pdf-import.js",
  "scripts-client.js",
  "project-client.js",
  "preproduction-client.js",
  "canvas-client.js",
  "canvas-workspace.js",
  "analysis-model.js",
  "analysis-client.js",
  "analysis-workspace.js",
  "breakdown-workspace.js",
  "translation-workspace.js",
  "budget-model.js",
  "budget-client.js",
  "budget-workspace.js",
  "calendar-model.js",
  "calendar-client.js",
  "calendar-workspace.js",
  "auth-modal.css",
  "filmscript-controls.css",
  "filmscript-landing.css",
  "platform-client.js",
  "platform-ui.css",
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const filename of frontendFiles) {
  fs.copyFileSync(path.join(root, filename), path.join(output, filename));
}

// FilmScript is a static HTML application, so Vercel Analytics is installed at
// build time rather than through the React component shown in Vercel's setup
// screen. Keep the tracker present on every public entry point.
const vercelAnalyticsSnippet = '<script defer src="/_vercel/insights/script.js"></script>';
for (const filename of frontendFiles.filter((filename) => filename.endsWith(".html"))) {
  const destination = path.join(output, filename);
  const html = fs.readFileSync(destination, "utf8");
  if (html.includes("/_vercel/insights/script.js")) continue;
  if (!/<\/head>/i.test(html)) {
    throw new Error(`Could not install Vercel Analytics in ${filename}: missing </head>`);
  }
  fs.writeFileSync(
    destination,
    html.replace(/<\/head>/i, `${vercelAnalyticsSnippet}\n</head>`),
  );
}

// Publish only assets that the shipped frontend actually references. This
// keeps old mockups, superseded sounds, and internal samples out of the public
// deployment without relying on a manually maintained second asset list.
const frontendAssets = new Set();
for (const filename of frontendFiles) {
  const source = fs.readFileSync(path.join(root, filename), "utf8");
  for (const match of source.matchAll(/(?:(?:\.\/)|\/)?assets\/[A-Za-z0-9._/-]+/g)) {
    frontendAssets.add(match[0].replace(/^\.?\//, ""));
  }
}
for (const filename of [...frontendAssets].sort()) {
  const source = path.join(root, filename);
  if (!fs.existsSync(source)) throw new Error(`Missing frontend asset: ${filename}`);
  const destination = path.join(output, filename);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

const sourceConfig = fs.readFileSync(path.join(root, "runtime-config.js"), "utf8");
const firstPartyApi = String(process.env.FILMSCRIPT_FIRST_PARTY_API || "").toLowerCase() === "true";
const apiUrl = firstPartyApi ? "" : String(process.env.API_URL || "").replace(/\/$/, "");
const erpApiUrl = String(process.env.ERP_API_URL || "").replace(/\/$/, "");
const erpEnvironment = String(process.env.ERP_ENVIRONMENT || "").trim().toLowerCase();
fs.writeFileSync(
  path.join(output, "runtime-config.js"),
  `window.FILMSCRIPT_CONFIG = { apiUrl: ${JSON.stringify(apiUrl)}, firstPartyApi: ${JSON.stringify(firstPartyApi)}, erpApiUrl: ${JSON.stringify(erpApiUrl)}, erpEnvironment: ${JSON.stringify(erpEnvironment)} };\n${sourceConfig}`,
);
// Sites accepts both Wrangler config extensions; keep a JSON copy so the
// static asset binding is discovered consistently by the production adapter.
const wranglerConfig = path.join(output, "wrangler.jsonc");
if (fs.existsSync(wranglerConfig)) fs.copyFileSync(wranglerConfig, path.join(output, "wrangler.json"));

const outputFiles = fs.readdirSync(output, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(entry.parentPath || entry.path, entry.name));
const forbidden = outputFiles.filter((filename) => /(?:^|[/\\])erp(?:-shell)?\.(?:html|js|css)$/i.test(filename));
if (forbidden.length) throw new Error(`Forbidden ERP files in FilmScript build: ${forbidden.join(", ")}`);
for (const required of ["Features.dc.html", "App.dc.html", "Imaging.dc.html", "Editor v5.dc.html", "SharedProject.html", "GuestAccess.html", "guest-access.js", "Invitation.html", "invitation-access.js", "seamless-navigation.js", "platform-client.js", "platform-ui.css"]) {
  if (!fs.existsSync(path.join(output, required))) throw new Error(`Incomplete frontend build: ${required} is missing`);
}
const outputBytes = outputFiles.reduce((total, filename) => total + fs.statSync(filename).size, 0);

console.log(`FilmScript frontend built in ${output}`);
console.log(`API URL: ${apiUrl || "same origin (set API_URL for Netlify)"}`);
console.log(`ERP API URL: ${erpApiUrl || "disabled (set ERP_API_URL to enable funnel tracking)"}`);
console.log(`Published ${outputFiles.length} files (${(outputBytes / 1024 / 1024).toFixed(2)} MiB)`);
