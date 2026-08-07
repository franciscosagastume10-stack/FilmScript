import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

test("Calendar is a first-class editor workspace beside Budget", async () => {
  const [editor, build] = await Promise.all([
    fs.readFile(path.join(ROOT, "Editor v5.dc.html"), "utf8"),
    fs.readFile(path.join(ROOT, "scripts", "build-netlify.mjs"), "utf8"),
  ]);

  assert.match(editor, /calendar-client\.js/);
  assert.match(editor, /calendar-workspace\.js/);
  assert.match(editor, /<filmscript-calendar script-id="\{\{ activeScriptId \}\}"/);
  assert.match(editor, /budgetHasData: workMode === 'budget',\s+calendarHasData: workMode === 'calendar'/);
  assert.match(editor, /'budget', 'calendar'/);

  const budgetMode = editor.indexOf("{ id: 'budget', label: 'Budget' }");
  const calendarMode = editor.indexOf("{ id: 'calendar', label: 'Calendar' }");
  assert.ok(budgetMode >= 0);
  assert.ok(calendarMode > budgetMode);

  for (const file of ["calendar-model.js", "calendar-client.js", "calendar-workspace.js"]) {
    assert.match(build, new RegExp(`"${file.replace(".", "\\.")}"`));
  }
});

test("Calendar exposes critical-path planning, protected Sundays and accessible editing", async () => {
  const [workspace, model, client, server, budget, language] = await Promise.all([
    fs.readFile(path.join(ROOT, "calendar-workspace.js"), "utf8"),
    fs.readFile(path.join(ROOT, "calendar-model.js"), "utf8"),
    fs.readFile(path.join(ROOT, "calendar-client.js"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
    fs.readFile(path.join(ROOT, "budget-workspace.js"), "utf8"),
    fs.readFile(path.join(ROOT, "language-preference.js"), "utf8"),
  ]);

  assert.match(workspace, /Critical path/);
  assert.match(workspace, /Monday–Saturday workweek/);
  assert.match(workspace, /Sundays stay protected/);
  assert.match(workspace, /Dependencies/);
  assert.match(workspace, /FilmScript prevents circular links/);
  assert.match(workspace, /role="dialog" aria-modal="true"/);
  assert.match(workspace, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(workspace, /\.kpi:after,.panel:after,.timeline-card:after/);

  assert.match(model, /const PHASES = \[/);
  assert.match(model, /function computeCalendar/);
  assert.match(model, /slackDays/);
  assert.match(model, /critical = slackDays === 0/);
  assert.match(model, /workweek: \[1, 2, 3, 4, 5, 6\]/);

  assert.match(client, /preproduction\/calendar/);
  assert.match(server, /async function handleCalendar/);
  assert.match(server, /calendarShootingDates/);
  assert.match(server, /calendarConnected/);
  assert.match(budget, /Managed in Calendar/);
  assert.match(language, /'Calendar': 'Calendario'/);
  assert.match(language, /'Critical path': 'Ruta crítica'/);
});

test("Calendar recovers from deferred DC hydration and gives auth failures a next step", async () => {
  const [workspace, client, server] = await Promise.all([
    fs.readFile(path.join(ROOT, "calendar-workspace.js"), "utf8"),
    fs.readFile(path.join(ROOT, "calendar-client.js"), "utf8"),
    fs.readFile(path.join(ROOT, "server.js"), "utf8"),
  ]);

  assert.match(workspace, /name === "script-id" && newValue && oldValue !== newValue && this\.isConnected/);
  assert.match(workspace, /data-action="sign-in"/);
  assert.match(workspace, /googleSignInUrl/);
  assert.match(client, /calendar_network_error/);
  assert.match(server, /origin === "null"/);
  assert.match(server, /localFilePreview/);
});
