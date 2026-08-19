import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);

test('Phase 5 Breakdown derives scene and department views from one Liquid Glass workspace', async () => {
  const [workspace, editor, build] = await Promise.all([
    fs.readFile(path.join(ROOT, 'breakdown-workspace.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'Editor v5.dc.html'), 'utf8'),
    fs.readFile(path.join(ROOT, 'scripts/build-netlify.mjs'), 'utf8'),
  ]);
  assert.match(editor, /film-script-breakdown/);
  assert.match(build, /"breakdown-workspace\.js"/);
  assert.match(workspace, /By Scene/);
  assert.match(workspace, /By Department/);
  assert.match(workspace, /switching views never makes a copy of it/);
  assert.match(workspace, /backdrop-filter:blur\(22px\)/);
  for (const label of ['Cast', 'Background', 'Props', 'Wardrobe', 'Makeup', 'Locations', 'Vehicles', 'Animals', 'VFX', 'SFX', 'Stunts', 'Sound', 'Camera', 'Lighting', 'Grip', 'Special Equipment', 'Production Notes']) {
    assert.match(workspace, new RegExp(label));
  }
});

test('Breakdown protects structured manual work and updates completed scenes progressively', async () => {
  const [server, workspace, platform] = await Promise.all([
    fs.readFile(path.join(ROOT, 'server.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'breakdown-workspace.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'platform-client.js'), 'utf8'),
  ]);
  assert.match(server, /ensureBreakdownElementIds/);
  assert.match(server, /mergeGeneratedBreakdown/);
  assert.match(server, /manualEditsPreserved/);
  assert.match(server, /Generating Breakdown ·/);
  assert.match(server, /breakdown\.progress/);
  assert.match(workspace, /entityType: 'breakdown_element'/);
  assert.match(workspace, /sendOperation/);
  assert.match(workspace, /uploadBreakdownImage/);
  assert.match(workspace, /scene-loading/);
  assert.match(platform, /breakdown\.progress/);
  assert.doesNotMatch(workspace, /gpt-5\.6-(?:sol|terra|luna)/i);
});

test('Breakdown keeps cards concise while exposing accessible, working detail controls', async () => {
  const workspace = await fs.readFile(path.join(ROOT, 'breakdown-workspace.js'), 'utf8');
  assert.doesNotMatch(workspace, /Unassigned/);
  assert.doesNotMatch(workspace, /<h1>\$\{this\.t\('Breakdown'/);
  assert.match(workspace, /class="element-open" data-action="edit-element"/);
  assert.match(workspace, /aria-label="\$\{escapeHtml\(`\$\{this\.t\('Open details for'/);
  assert.match(workspace, /\.filter\(\(card\) => card\.elements\.length\)/);
  assert.match(workspace, /const populatedDepartments = \[\.\.\.departments\.values\(\)\]\.filter/);
  assert.match(workspace, /min-height:42px/);
  assert.match(workspace, /:focus-visible/);
});

test('Breakdown elements reveal their exact screenplay evidence with a smooth five-second highlight', async () => {
  const [workspace, editor] = await Promise.all([
    fs.readFile(path.join(ROOT, 'breakdown-workspace.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'Editor v5.dc.html'), 'utf8'),
  ]);
  assert.match(workspace, /class="element is-script-link"/);
  assert.match(workspace, /data-action="open-script-reference"/);
  assert.match(workspace, /filmscript:breakdown-open-reference/);
  assert.match(workspace, /role="link" tabindex="0"/);
  assert.match(workspace, /onKeydown/);
  assert.match(workspace, /text-decoration-color:transparent/);
  assert.match(editor, /filmscript:breakdown-open-reference/);
  assert.match(editor, /breakdown-workspace\.js\?v=20260819-breakdown-script-links1/);
  assert.match(editor, /Collect through the next scene heading across every screenplay page/);
  assert.match(editor, /_fadeBreakdownReferenceHighlight/);
  assert.match(editor, /window\.setTimeout\(\(\) => this\._fadeBreakdownReferenceHighlight\(\), 5000\)/);
  assert.match(editor, /v5-breakdown-highlight-fading/);
  assert.match(editor, /v5-breakdown-reference-fallback\.is-fading/);
});
