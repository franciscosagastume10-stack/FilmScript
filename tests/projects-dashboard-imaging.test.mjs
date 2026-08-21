import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const app = read('App.dc.html');

test('Projects dashboard removes the redundant writing and script-list headings', () => {
  const dashboard = app.slice(
    app.indexOf('<!-- ============ SCRIPTS DASHBOARD'),
    app.indexOf('<!-- ============ SCRIPT EDITOR'),
  );

  assert.doesNotMatch(dashboard, />Writing desk</);
  assert.doesNotMatch(dashboard, />Your scripts</);
  assert.doesNotMatch(dashboard, /scriptSummary/);
  assert.match(dashboard, /<section aria-label="Projects"/);
  assert.match(dashboard, /placeholder="Search projects" aria-label="Search projects"/);
});

test('New project is the white primary action with its plus after the label', () => {
  const action = app.slice(
    app.indexOf('onClick="{{ newScript }}"'),
    app.indexOf('onClick="{{ importScript }}"'),
  );

  assert.match(action, /fs-scripts-action--primary/);
  assert.match(action, /New project/);
  assert.match(action, /color: inherit/);
  assert.ok(action.indexOf('New project') < action.indexOf('aria-hidden="true"'));
  assert.match(app, /\.fs-scripts-action--primary \{ color: #FFFEF9 !important/);
});

test('Imaging is a native third action that opens outside any project', () => {
  const dashboard = app.slice(
    app.indexOf('<!-- ============ SCRIPTS DASHBOARD'),
    app.indexOf('<!-- ============ SCRIPT EDITOR'),
  );
  const importIndex = dashboard.indexOf('onClick="{{ importScript }}"');
  const imagingIndex = dashboard.indexOf('onClick="{{ openImaging }}"');

  assert.ok(importIndex >= 0 && imagingIndex > importIndex);
  assert.match(dashboard, /<button type="button" onClick="\{\{ openImaging \}\}"/);
  assert.match(app, /openImaging: \(\) => \{ window\.location\.href = 'Imaging\.dc\.html'; \}/);
  assert.doesNotMatch(app, /openImaging:[^\n]+script=/);
  assert.match(app, /min-height: 44px !important/);
});

test('Projects dashboard labels are available in English and Spanish', () => {
  const language = read('language-preference.js');

  assert.match(language, /'New project': 'Nuevo proyecto'/);
  assert.match(language, /'Imaging': 'Imaging'/);
  assert.match(language, /'Projects': 'Proyectos'/);
  assert.match(language, /'Search projects': 'Buscar proyectos'/);
  assert.match(language, /'Loading your projects': 'Cargando tus proyectos'/);
  assert.match(language, /'Syncing your projects securely\.': 'Sincronizando tus proyectos de forma segura\.'/);
  assert.match(language, /\^No projects match/);
});
