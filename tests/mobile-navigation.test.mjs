import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFile(path.join(ROOT, file), 'utf8');

test('mobile navigation has one owner and exposes every project module in canonical order', async () => {
  const client = await read('platform-client.js');
  assert.equal((client.match(/document\.createElement\('nav'\)/g) || []).length, 1);
  assert.doesNotMatch(client, /fs-mobile-(?:global|project)|data-more/);
  const projectItems = client.slice(client.indexOf('const projectItems = ['), client.indexOf('];', client.indexOf('const projectItems = [')) + 2);
  const expected = ['editor', 'lumiere', 'analysis', 'breakdown', 'stripboard', 'imagine', 'canvas', 'shotlist', 'budget', 'calendar'];
  let cursor = -1;
  for (const mode of expected) {
    const next = projectItems.indexOf(`['${mode}'`);
    assert.ok(next > cursor, `${mode} must follow the previous project destination`);
    cursor = next;
  }
  assert.match(client, /data-project-view/);
  assert.match(client, /filmscript:navigate-work-mode/);
  assert.match(client, /filmscript:work-mode-change/);
  assert.match(client, /window\.addEventListener\('popstate'/);
  assert.match(client, /scrollIntoView\(\{ behavior:/);
});

test('mobile work-mode aliases resolve dynamically to editor canonical values', async () => {
  const client = await read('platform-client.js');
  const source = client.match(/const canonicalMobileWorkMode = \(value\) => \{[\s\S]*?\n  \};/)?.[0];
  assert.ok(source, 'canonical work-mode resolver must be present');
  const context = {};
  vm.runInNewContext(`${source}\nglobalThis.resolveMode = canonicalMobileWorkMode;`, context);
  assert.equal(context.resolveMode('script'), 'editor');
  assert.equal(context.resolveMode('shot-list'), 'shotlist');
  assert.equal(context.resolveMode('shot_list'), 'shotlist');
  assert.equal(context.resolveMode('budget'), 'budget');
  assert.equal(context.resolveMode('unknown'), 'editor');
});

test('global mobile destinations remain root-safe from rewritten workspace routes', async () => {
  const client = await read('platform-client.js');
  assert.match(client, /href="\/App\.dc\.html"/);
  assert.match(client, /href="\/Imagine\.dc\.html"/);
  assert.equal(new URL('/App.dc.html', 'https://filmscript.app/workspace/scripts?diagnostic=1').pathname, '/App.dc.html');
  assert.equal(new URL('/Imagine.dc.html', 'https://filmscript.app/workspace/scripts?diagnostic=1').pathname, '/Imagine.dc.html');
});

test('standalone Imagine receives only Projects, Imagine, Activity, and Account', async () => {
  const [client, imagine] = await Promise.all([read('platform-client.js'), read('Imagine.dc.html')]);
  const standalone = client.slice(client.indexOf('const standaloneImagine'), client.indexOf('document.body.appendChild(nav)'));
  for (const destination of ['Projects', 'Imagine', 'Activity', 'Account']) assert.ok(standalone.includes(destination), `missing ${destination}`);
  assert.doesNotMatch(standalone, /Breakdown|Shot List|Budget|Calendar|data-more/);
  assert.match(imagine, /class="imaging-account-workspace"/);
  assert.doesNotMatch(imagine, /fs-mobile-(?:global|project)/);
});

test('single mobile bar is scrollable Liquid Glass with safe-area spacing and 44px targets', async () => {
  const css = await read('platform-ui.css');
  assert.match(css, /--fs-mobile-nav-height:\s*0px/);
  assert.match(css, /--fs-mobile-nav-height:calc\(62px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.fs-mobile-nav \{[^}]*display:flex[^}]*overflow-x:auto[^}]*scroll-snap-type:x proximity/s);
  assert.match(css, /\.fs-mobile-nav a, \.fs-mobile-nav button \{[^}]*flex:0 0 auto[^}]*min-height:44px/s);
  assert.match(css, /backdrop-filter:blur\(30px\) saturate\(1\.38\)/);
  assert.match(css, /padding-bottom:var\(--fs-mobile-nav-height\)/);
  assert.doesNotMatch(css, /grid-template-columns:repeat\(5,1fr\)|fs-mobile-project/);
});

test('Editor owns mode state while platform navigation owns mobile markup', async () => {
  const editor = await read('Editor v5.dc.html');
  assert.match(editor, /viewport-fit=cover/);
  assert.match(editor, /window\.addEventListener\('filmscript:navigate-work-mode', this\._mobileWorkModeHandler\)/);
  assert.match(editor, /window\.removeEventListener\('filmscript:navigate-work-mode', this\._mobileWorkModeHandler\)/);
  assert.match(editor, /event\?\.detail\?\.lumiere === true[\s\S]*?lumiereOpen: true/);
  assert.match(editor, /filmscript:work-mode-change/);
  assert.doesNotMatch(editor, /<nav class="v5-mobile-nav"|mobileMoreOpen|mobileMoreModes|mobileMenuOpen/);
  assert.match(editor, /\.v5-work-modes \{ display: none !important; \}/);
});
