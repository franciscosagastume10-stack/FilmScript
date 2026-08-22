import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFile(path.join(ROOT, file), 'utf8');

test('desktop project navigation exposes every function without a horizontal scroller', async () => {
  const [editor, css] = await Promise.all([
    read('Editor v5.dc.html'),
    read('platform-ui.css'),
  ]);
  const navigationStart = editor.indexOf('<div class="v5-work-modes"');
  const navigationEnd = editor.indexOf('</div>', navigationStart);
  const navigation = editor.slice(navigationStart, navigationEnd);
  const desktopRules = css.slice(css.indexOf('@media (min-width:901px) {'), css.indexOf('.fs-platform-scrim'));

  assert.ok(navigationStart >= 0, 'desktop work navigation must exist');
  assert.doesNotMatch(navigation, /overflow-x\s*:\s*(?:auto|scroll)/);
  assert.match(editor, /\.v5-work-modes \{ justify-content: center !important; gap: 2px !important; \}/);
  assert.match(desktopRules, /\.v5-topbar \.v5-work-modes \{[^}]*width:calc\(100% - 500px\)[^}]*flex-wrap:wrap[^}]*overflow:visible!important/s);
  assert.match(desktopRules, /@media \(min-width:901px\) and \(max-width:1180px\)/);
  assert.match(desktopRules, /\.v5-topbar \.v5-work-mode \{[^}]*min-height:28px[^}]*font-size:10px/s);
});

test('mobile keeps the only horizontally scrollable project navigation', async () => {
  const css = await read('platform-ui.css');
  const desktopRules = css.slice(css.indexOf('@media (min-width:901px) {'), css.indexOf('.fs-platform-scrim'));
  const mobileRules = css.slice(css.indexOf('@media (max-width:900px) {'));

  assert.doesNotMatch(desktopRules, /overflow-x\s*:\s*(?:auto|scroll)/);
  assert.match(mobileRules, /\.fs-mobile-nav \{[^}]*overflow-x:auto/s);
  assert.match(mobileRules, /\.v5-work-modes \{ display:none!important; \}/);
});
