import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('English and Spanish are available from one persistent FilmScript setting', () => {
  const language = read('language-preference.js');
  assert.match(language, /filmscript_language/);
  assert.match(language, /languages: Object\.freeze\(\['en', 'es'\]\)/);
  assert.match(language, /data-filmscript-language-settings/);
  assert.match(language, /fs-language-profile-item/);
  assert.match(language, /Language belongs to the profile menu/);
  assert.match(language, /data-language-option="en"/);
  assert.match(language, /data-language-option="es"/);
  assert.match(language, /filmscript:language-change/);
});

test('every user-facing FilmScript page loads the shared language preference', () => {
  for (const page of ['App.dc.html', 'Editor v5.dc.html', 'Features.dc.html', 'Pricing.dc.html', 'Subscription.dc.html']) {
    assert.match(read(page), /language-preference\.js/, page);
  }
  assert.match(read('scripts/build-netlify.mjs'), /"language-preference\.js"/);
});

test('authored screenplay titles and saved conversations are excluded from UI translation', () => {
  assert.match(read('App.dc.html'), /fs-script-card-title" data-i18n-skip/);
  assert.match(read('App.dc.html'), /data-i18n-skip style="\{\{ m\.bubbleStyle \}\}"/);
  assert.match(read('Editor v5.dc.html'), /data-i18n-skip[^>]*>\{\{ m\.text \}\}/);
  assert.match(read('language-preference.js'), /\[data-fs-page\], \[data-v5-cover\]/);
});

test('editor workflows and destructive confirmations use the shared language layer', () => {
  const language = read('language-preference.js');
  assert.match(language, /'Title Page Designer': 'Diseñador de portada'/);
  assert.match(language, /'Adjust all pending': 'Ajustar todas las pendientes'/);
  assert.match(language, /Page \(\\d\+\) of \(\\d\+\)/);
  assert.match(read('App.dc.html'), /filmscriptLanguage\?\.t\(confirmation\)/);
});
