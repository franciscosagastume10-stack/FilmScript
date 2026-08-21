import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

test("Budget resolves a complete dark palette inside its Shadow DOM", async () => {
  const workspace = await fs.readFile(path.join(ROOT, "budget-workspace.js"), "utf8");

  assert.match(workspace, /attachShadow\(\{ mode: 'open' \}\)/);
  assert.match(workspace, /:host-context\(html\[data-filmscript-theme="dark"\]\)\{[^}]*--budget-dark-surface:#242422/);
  assert.match(workspace, /--budget-dark-accent:var\(--fs-theme-accent,#FFB703\)/);
  assert.match(workspace, /--bg:var\(--budget-dark-bg\);--surface:var\(--budget-dark-surface\);[^}]*--ink:var\(--budget-dark-ink\)/);
  assert.match(workspace, /--accent:var\(--budget-dark-accent\);[^}]*color-scheme:dark/);
  assert.match(workspace, /:host-context\(html\[data-filmscript-theme="dark"\]\) \.fs-budget\{background:var\(--budget-dark-bg\);color:var\(--budget-dark-ink\)\}/);
});

test("Budget dark mode keeps glass surfaces readable and has a reduced-transparency fallback", async () => {
  const workspace = await fs.readFile(path.join(ROOT, "budget-workspace.js"), "utf8");

  assert.match(workspace, /:host-context\(html\[data-filmscript-theme="dark"\]\) \.kpi,[\s\S]*?\.expense-status-guide\{background:linear-gradient/);
  assert.match(workspace, /:host-context\(html\[data-filmscript-theme="dark"\]\) input,[\s\S]*?\.expense-line-button\{background:var\(--budget-dark-input\);[^}]*color:var\(--budget-dark-ink\)/);
  assert.match(workspace, /:host-context\(html\[data-filmscript-theme="dark"\]\) \.negative\{color:#ff8d86!important\}/);
  assert.match(workspace, /@media\(prefers-reduced-transparency:reduce\)\{[\s\S]*?backdrop-filter:none;-webkit-backdrop-filter:none/);
});
