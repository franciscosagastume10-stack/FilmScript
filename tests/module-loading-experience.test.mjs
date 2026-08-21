import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const budget = read('budget-workspace.js');
const calendar = read('calendar-workspace.js');
const canvas = read('canvas-workspace.js');
const language = read('language-preference.js');

const loadingBranch = (source) => {
  const match = source.match(/if \(this\.loading\) \{([\s\S]*?)\n\s*return;\n\s*\}/);
  assert.ok(match, 'expected an initial loading branch');
  return match[1];
};

test('Budget and Calendar hide unfinished module controls behind accessible loaders', () => {
  const budgetLoading = loadingBranch(budget);
  const calendarLoading = loadingBranch(calendar);

  for (const [name, branch, forbidden] of [
    ['Budget', budgetLoading, ['budget-nav', 'renderQuick', 'computeBudget']],
    ['Calendar', calendarLoading, ['calendar-nav', 'renderOverview', 'computed()']],
  ]) {
    assert.match(branch, /aria-busy="true"/);
    assert.match(branch, /role="status"/);
    assert.match(branch, /aria-live="polite"/);
    assert.match(branch, /aria-atomic="true"/);
    assert.match(branch, /fs-module-loader-mark/);
    assert.match(branch, /fs-module-loader-grid/);
    for (const token of forbidden) {
      assert.doesNotMatch(branch, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${name} leaks ${token} while loading`);
    }
  }
});

test('Budget and Calendar loaders share the FilmScript glass animation family and accessibility fallbacks', () => {
  for (const [name, source, motif] of [
    ['Budget', budget, 'fsBudgetLedger'],
    ['Calendar', calendar, 'fsCalendarDay'],
  ]) {
    assert.match(source, /\.fs-module-loader\{[^}]*backdrop-filter:blur\(28px\) saturate\(145%\)/s, `${name} loader needs Liquid Glass`);
    assert.match(source, /\.fs-module-loader-mark:before\{[^}]*animation:fsModuleOrbit/s, `${name} loader needs the orbital mark`);
    assert.match(source, /\.fs-module-loader-cell\{[^}]*animation:fsModuleCell/s, `${name} loader needs staggered glass cells`);
    assert.ok(source.includes(motif), `${name} loader needs its module-specific motion`);
    assert.match(source, /@media\(prefers-reduced-motion:reduce\)\{[^}]*\.fs-module-loader/s);
    assert.match(source, /@media\(prefers-reduced-transparency:reduce\)\{[^}]*\.fs-module-loader/s);
  }
});

test('Canvas uses the full loader while Imagine keeps a non-blocking skeleton gallery', () => {
  assert.match(canvas, /_isImagineLoadingTarget\(\)/);
  assert.match(canvas, /if \(!this\.state\.loading && this\._canPatchBoard\(\)\)/);
  assert.match(canvas, /this\.state\.loading\s*\? \(this\._isImagineLoadingTarget\(\) \? this\._renderImagineLoading\(\) : this\._renderCanvasLoading\(\)\)/);
  assert.match(canvas, /const overlays = this\.state\.loading \? '' : this\._renderOverlays\(\)/);

  const imagineLoading = canvas.match(/_renderImagineLoading\(\) \{([\s\S]*?)\n\s*\}\n\n\s*render\(\)/)?.[1] || '';
  assert.match(imagineLoading, /cv-imagine-loading-stage/);
  assert.match(imagineLoading, /cv-imagine-skeleton-gallery/);
  assert.match(imagineLoading, /cv-imagine-skeleton/);
  assert.match(imagineLoading, /role="status"/);
  assert.match(imagineLoading, /aria-busy="true"/);
  assert.doesNotMatch(imagineLoading, /cv-module-loader|cv-loading/);

  assert.match(canvas, /\.cv-module-loader\{[^}]*backdrop-filter:blur\(28px\) saturate\(145%\)/s);
  assert.match(canvas, /\.cv-imagine-skeleton\{[^}]*backdrop-filter:blur\(16px\)/s);
  assert.match(canvas, /@media\(prefers-reduced-motion:reduce\)\{[^}]*\.cv-imagine-skeleton/s);
  assert.match(canvas, /@media\(prefers-reduced-transparency:reduce\)\{[^}]*\.cv-module-loader[^}]*\.cv-imagine-skeleton/s);
});

test('Imagine preserves a skeleton until each real gallery image is decoded', () => {
  assert.match(canvas, /class="cv-imagine-tile is-image-loading/);
  assert.match(canvas, /tile\.classList\.remove\('is-image-loading', 'is-image-error'\)/);
  assert.match(canvas, /tile\?\.classList\.remove\('is-image-loading'\)/);
  assert.match(canvas, /\.cv-imagine-tile\.is-image-loading:before/);
  assert.match(canvas, /\.cv-imagine-tile\.is-image-loading img\{opacity:0!important/);
});

test('new loading copy is available in English and Spanish', () => {
  for (const [english, spanish] of [
    ['Loading Canvas', 'Cargando Canvas'],
    ['Connecting your visual references and boards.', 'Conectando tus referencias visuales y tableros.'],
    ['Loading your Imagine gallery', 'Cargando tu galería de Imagine'],
    ['Frames will appear as soon as they are ready.', 'Las imágenes aparecerán en cuanto estén listas.'],
  ]) {
    assert.ok(language.includes(`'${english}': '${spanish}'`), `missing translation for ${english}`);
  }
  assert.match(budget, /displayLabel\('Loading Budget'\)/);
  assert.match(calendar, /displayLabel\("Loading Calendar"\)/);
});

test('Canvas and Budget recover when the runtime hydrates script-id after connection', () => {
  for (const [name, source] of [['Canvas', canvas], ['Budget', budget]]) {
    assert.match(
      source,
      /name === 'script-id' && newValue && oldValue !== newValue && this\.isConnected/,
      `${name} must reload for the initial null-to-script-id transition`,
    );
    assert.doesNotMatch(
      source,
      /name === 'script-id' && oldValue && newValue/,
      `${name} must not require an old script id before loading`,
    );
  }
});

test('Canvas and Budget wait for deferred clients without leaving an endless loader', () => {
  for (const [name, source, client] of [
    ['Canvas', canvas, 'filmscriptCanvas'],
    ['Budget', budget, 'filmscriptBudget'],
  ]) {
    assert.match(source, /_retryLoadWhenClientReady\(\)/, `${name} needs a deferred-client retry path`);
    assert.match(source, /this\._loadRetryCount >= 20/, `${name} retries must have a terminal bound`);
    assert.match(source, /this\.load\(\{ preserveClientRetry: true \}\)/, `${name} must preserve its retry count`);
    assert.match(source, new RegExp(`if \\(!window\\.${client}\\) \\{[\\s\\S]*?this\\._retryLoadWhenClientReady\\(\\)`), `${name} must retry when its client is late`);
    assert.match(source, /this\.(?:state\.)?loading = false;[\s\S]*?this\.(?:state\.)?error = '(?:Canvas|Budget) is not available right now\.'/,
      `${name} must leave the loader for an actionable error after retries`);
    assert.match(source, /disconnectedCallback\(\)[\s\S]*?clearTimeout\(this\._loadRetryTimer\)/,
      `${name} must cancel deferred retries when removed`);
  }
});
