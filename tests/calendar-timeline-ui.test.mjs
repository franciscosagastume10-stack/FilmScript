import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);

test("Calendar timeline supports pointer move and resize from both edges", async () => {
  const workspace = await fs.readFile(path.join(ROOT, "calendar-workspace.js"), "utf8");

  assert.match(workspace, /adjustCalendarTaskTiming/);
  assert.match(workspace, /pointerdown/);
  assert.match(workspace, /pointermove/);
  assert.match(workspace, /pointerup/);
  assert.match(workspace, /pointercancel/);
  assert.match(workspace, /setPointerCapture/);
  assert.match(workspace, /releasePointerCapture/);
  assert.match(workspace, /["']move["']/);
  assert.match(workspace, /["']resize-start["']/);
  assert.match(workspace, /["']resize-end["']/);

  const hasStartHandle = /class="[^"]*(?:resize|edge|handle)[^"]*(?:start|left)[^"]*"/.test(workspace)
    || /data-(?:operation|resize|timeline-action)="resize-start"/.test(workspace);
  const hasEndHandle = /class="[^"]*(?:resize|edge|handle)[^"]*(?:end|right)[^"]*"/.test(workspace)
    || /data-(?:operation|resize|timeline-action)="resize-end"/.test(workspace);
  assert.equal(hasStartHandle, true, "Timeline tasks need a left/start resize handle");
  assert.equal(hasEndHandle, true, "Timeline tasks need a right/end resize handle");

  assert.match(workspace, /weekWidth\s*\/\s*6|\/\s*\(\s*weekWidth\s*\/\s*6\s*\)/);
  assert.match(workspace, /pointerId/);
});

test("Calendar timeline exposes usable zoom controls without scaling the task rail", async () => {
  const workspace = await fs.readFile(path.join(ROOT, "calendar-workspace.js"), "utf8");

  assert.match(workspace, /timelineZoom/);
  assert.match(workspace, /data-action="zoom-(?:out|in)"/);
  assert.match(workspace, /data-action="zoom-(?:fit|reset)"/);
  assert.match(workspace, /type="range"[^>]*(?:zoom|Zoom)|(?:zoom|Zoom)[^>]*type="range"/);
  assert.match(workspace, />Fit</);
  assert.match(workspace, /timelineWeekWidth\(value = this\.timelineZoom\)|weekWidth\s*=\s*[^;]*timelineZoom/);
  assert.match(workspace, /aria-label="[^"]*[Zz]oom[^"]*"/);
});

test("Calendar Fit uses the full timeline viewport and scroll position stays synchronized live", async () => {
  const workspace = await fs.readFile(path.join(ROOT, "calendar-workspace.js"), "utf8");

  assert.match(workspace, /available\s*\/\s*\(weekCount\s*\*\s*TIMELINE_BASE_WEEK_WIDTH\)/);
  assert.match(workspace, /finite\(scroll\?\.clientWidth, 960\)\s*-\s*taskColumnWidth/);
  assert.doesNotMatch(workspace, /Math\.max\(52,\s*\(finite\(scroll\?\.clientWidth/);
  assert.match(workspace, /TIMELINE_MIN_ZOOM\s*=\s*0\.01/);
  assert.match(workspace, /data-timeline-pan/);
  assert.match(workspace, /scroll\.scrollLeft\s*=\s*Math\.max\(0,\s*finite\(pan\.value\)\)/);
  assert.match(workspace, /scroll\.scrollWidth\s*-\s*scroll\.clientWidth/);
  assert.match(workspace, /addEventListener\("scroll",\s*this\._onScroll,\s*true\)/);
  assert.match(workspace, /if \(zoom\) \{\s*this\.setTimelineZoom\(zoom\.value\)/);
  assert.match(workspace, /fit \? 0 : Math\.max\(0, anchorWeeks \* weekWidth - anchorX\)/);
});

test("Calendar timeline preserves linked task positions and surfaces dependency overlaps", async () => {
  const [workspace, model] = await Promise.all([
    fs.readFile(path.join(ROOT, "calendar-workspace.js"), "utf8"),
    fs.readFile(path.join(ROOT, "calendar-model.js"), "utf8"),
  ]);

  assert.match(model, /manualStartDate/);
  assert.match(model, /pinCalendarSuccessors/);
  assert.match(model, /dependencyConflictIds/);
  assert.match(workspace, /pinCalendarSuccessors/);
  assert.match(workspace, /is-conflict/);
  assert.match(workspace, /Linked overlaps are flagged without shifting the rest/);
});

test("Calendar timeline distinguishes three schedule zones and uses cream-orange task bars", async () => {
  const workspace = await fs.readFile(path.join(ROOT, "calendar-workspace.js"), "utf8");

  assert.match(workspace, /Week 0/);
  assert.match(workspace, /--zone-pre/);
  assert.match(workspace, /--zone-zero/);
  assert.match(workspace, /--zone-post/);
  assert.match(workspace, /\.timeline-track\{[^}]*--zone|\.timeline-track[^}]*var\(--zone-/);

  assert.match(workspace, /\.task-bar\{[^}]*background:color-mix\(in srgb,var\(--accent,#FFB703\)/);
  assert.match(workspace, /\.task-bar\{[^}]*border[^;}]*#A96A23/);
  assert.match(workspace, /\.milestone[^}]*var\(--accent,#FFB703\)|\.milestone[^}]*#A96A23/);
  assert.doesNotMatch(workspace, /\.task-bar\.is-critical\{[^}]*background:var\(--cal-critical\)/);
  assert.doesNotMatch(workspace, /\.task-bar\.is-complete\{[^}]*repeating-linear-gradient/);
});
