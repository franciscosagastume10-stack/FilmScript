import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modal = fs.readFileSync(path.join(root, 'lumiere-access-modal.js'), 'utf8');

test('the Lumiere upgrade modal only opens for validated server entitlement failures', () => {
  assert.match(modal, /detail\?\.serverValidated === true/);
  assert.match(modal, /\[402, 403, 429\]\.includes\(status\)/);
  assert.match(modal, /window\.addEventListener\('filmscript:upgrade-required'/);
  assert.match(modal, /lumiere_credits_exhausted/);
  assert.match(modal, /image_credits_exhausted/);
  assert.match(modal, /insufficient_credits/);
});

test('the Lumiere upgrade modal is bilingual, accessible, and uses restrained Liquid Glass', () => {
  for (const copy of [
    'Ya usaste tus usos de Lumiere',
    'You have used your Lumiere uses',
    'Cada acción de Lumiere consume un uso',
    'Each Lumiere action uses one use',
    'Volver',
    'Back',
    'Ver planes',
    'View plans',
  ]) assert.match(modal, new RegExp(copy));
  assert.match(modal, /role="dialog" aria-modal="true"/);
  assert.match(modal, /event\.key === 'Escape'/);
  assert.match(modal, /backdrop-filter: blur\(64px\) saturate\(1\.38\)/);
  assert.match(modal, /prefers-reduced-transparency: reduce/);
  assert.match(modal, /prefers-reduced-motion: reduce/);
});

test('every Lumiere entry point ships the same access modal', () => {
  for (const page of ['App.dc.html', 'Editor v5.dc.html', 'Features.dc.html', 'Pricing.dc.html']) {
    const source = fs.readFileSync(path.join(root, page), 'utf8');
    assert.match(source, /lumiere-access-modal\.js\?v=20260820-access-modal1/);
  }
  const build = fs.readFileSync(path.join(root, 'scripts/build-netlify.mjs'), 'utf8');
  assert.match(build, /"lumiere-access-modal\.js"/);
});
