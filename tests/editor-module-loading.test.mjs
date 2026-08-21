import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);

test('Editor and preproduction routes gate unfinished content behind one accessible loader family', async () => {
  const editor = await fs.readFile(path.join(ROOT, 'Editor v5.dc.html'), 'utf8');

  assert.match(editor, /scriptLoading: Boolean\(new URLSearchParams\(window\.location\.search\)\.get\('script'\)\)/);
  assert.match(editor, /editorDisplay: workMode === 'editor' && !this\.state\.scriptLoading && !this\.state\.scriptLoadError \? 'flex' : 'none'/);
  assert.match(editor, /editorLoadGate: workMode === 'editor' && \(this\.state\.scriptLoading \|\| this\.state\.scriptLoadError\)/);
  assert.match(editor, /data-testid="editor-loading-stage"/);
  assert.match(editor, /role="status" aria-live="polite" data-loader-kind="editor" aria-atomic="true"/);

  assert.match(editor, /return \['breakdown', 'stripboard', 'shotlist'\]\.includes\(view\)/);
  assert.match(editor, /productionModuleLoading: this\.state\.productionLoading && \['breakdown', 'stripboard', 'shotlist'\]\.includes\(moduleLoaderMode\)/);
  assert.match(editor, /breakdownHasData: workMode === 'breakdown' && productionHasData && !this\.state\.productionLoading/);
  assert.match(editor, /stripboardHasData: workMode === 'stripboard' && productionHasData && !this\.state\.productionLoading/);
  assert.match(editor, /shotListHasData: shotListMode && productionHasData && !this\.state\.productionLoading/);
  assert.match(editor, /productionHeaderVisible:[^\n]+!this\.state\.productionLoading/);
  assert.match(editor, /data-testid="production-loading-stage"/);
  assert.match(editor, /aria-label="\{\{ moduleLoaderAriaLabel \}\}"/);
});

test('Breakdown, Stripboard and Shot List loaders have localized module-specific identity', async () => {
  const editor = await fs.readFile(path.join(ROOT, 'Editor v5.dc.html'), 'utf8');

  for (const [kind, english, spanish] of [
    ['breakdown', 'Preparing your Breakdown', 'Preparando tu desglose'],
    ['stripboard', 'Preparing your Stripboard', 'Preparando tu plan de rodaje'],
    ['shotlist', 'Preparing your Shot List', 'Preparando tu lista de planos'],
  ]) {
    assert.match(editor, new RegExp(`${kind}: \\{[\\s\\S]*?title: ui\\('${english}', '${spanish}'\\)`));
    assert.match(editor, new RegExp(`moduleLoaderKind: moduleLoader\\.kind`));
  }

  assert.match(editor, /moduleLoaderBreakdown: moduleLoader\.kind === 'breakdown'/);
  assert.match(editor, /moduleLoaderStripboard: moduleLoader\.kind === 'stripboard'/);
  assert.match(editor, /moduleLoaderShotList: moduleLoader\.kind === 'shotlist'/);
  assert.match(editor, /prefers-reduced-transparency: reduce/);
  assert.match(editor, /prefers-reduced-motion: reduce/);
});

test('Analysis hides prior or partial results for every initial load and uses localized accessible motion', async () => {
  const analysis = await fs.readFile(path.join(ROOT, 'analysis-workspace.js'), 'utf8');

  assert.match(analysis, /if \(this\.loading\) \{/);
  assert.doesNotMatch(analysis, /if \(this\.loading && !this\.analysis\)/);
  assert.match(analysis, /class="analysis-processing" role="status" aria-live="polite" aria-atomic="true"/);
  assert.match(analysis, /class="analysis-processing-glass analysis-boot-glass"/);
  assert.match(analysis, /'Preparing your Analysis'/);
  assert.match(analysis, /'Preparando tu análisis'/);
  assert.match(analysis, /'Reading screenplay structure…'/);
  assert.match(analysis, /'Leyendo la estructura del guion…'/);
  assert.match(analysis, /prefers-reduced-transparency:reduce/);
  assert.match(analysis, /prefers-reduced-motion:reduce/);
});

test('Imagine remains outside the blocking preproduction loader', async () => {
  const editor = await fs.readFile(path.join(ROOT, 'Editor v5.dc.html'), 'utf8');
  const loadingGate = editor.match(/productionModuleLoading:([^\n]+)/)?.[1] || '';

  assert.doesNotMatch(loadingGate, /imagine/);
  assert.match(editor, /canvasWorkspaceVisible: \(workMode === 'canvas' && !shotListMode\) \|\| workMode === 'imagine'/);
});

test('direct preproduction routes retry a deferred client and always leave the loader', async () => {
  const editor = await fs.readFile(path.join(ROOT, 'Editor v5.dc.html'), 'utf8');

  assert.match(editor, /_retryWorkModeWhenClientReady\(mode, options = \{\}\)/);
  assert.match(editor, /this\._workModeDependencyRetryCount >= 20/);
  assert.match(editor, /this\.switchWorkMode\(mode, \{ \.\.\.options, canvasTool, force: true, dependencyRetry: true \}\)/);
  assert.match(editor, /if \(!window\.filmscriptPreproduction\) \{\s*this\._retryWorkModeWhenClientReady\(mode, \{ canvasTool: requestedCanvasTool \}\);\s*return;\s*\}/);
  assert.match(editor, /this\._clearWorkModeDependencyRetry\(\);\s*\n\s*const productionMode/);
  assert.match(editor, /this\.setState\(\{ productionLoading: false \}\);\s*\n\s*this\._toast\('Preproduction is not available right now\. Please try again\.'/);
  assert.match(editor, /componentWillUnmount\(\)[\s\S]*?clearTimeout\(this\._workModeDependencyRetryTimer\)/);
});
