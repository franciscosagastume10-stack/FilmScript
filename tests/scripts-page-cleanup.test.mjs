import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const app = fs.readFileSync(path.join(root, 'App.dc.html'), 'utf8');

test('Scripts header has no decorative three-line menu', () => {
  assert.doesNotMatch(app, /flex-direction: column; gap: 3px; cursor: pointer; padding: 6px/);
});

test('Scripts does not show the default PDF format helper', () => {
  assert.doesNotMatch(app, /PDF or \.fs, the FilmScript text format\./);
  assert.match(app, /importNoteOn: !!String\(this\.state\.importNote/);
});

test('PDF imports classify scene headings independently of their horizontal position', () => {
  const extractor = fs.readFileSync(path.join(root, 'pdf_extract.py'), 'utf8');
  assert.match(extractor, /Scene headings are the source of truth/);
  assert.match(extractor, /if re\.match\(r"\^\(INT\|EXT\|INT\/EXT\|I\/E\)/);
  assert.doesNotMatch(extractor, /if x < 100 and re\.match\(r"\^\(INT\|EXT\|INT\/EXT\|I\/E\)/);
});

test('PDF imports keep the uploaded filename as the screenplay title', () => {
  const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
  const editor = fs.readFileSync(path.join(root, 'Editor v5.dc.html'), 'utf8');
  assert.match(server, /Only remove the transport extension/);
  assert.doesNotMatch(server, /replace\(\/_-\+\/g, " "\)/);
  assert.match(editor, /stored\.source === 'pdf' \? \(stored\.title \|\| 'Untitled screenplay'\)/);
});

test('PDF opening transition formats long underscore titles without changing the stored title', () => {
  const app = fs.readFileSync(path.join(root, 'App.dc.html'), 'utf8');
  assert.match(app, /overflow-wrap: anywhere/);
  assert.match(app, /-webkit-line-clamp: 3/);
  assert.match(app, /_formatOpeningTitle\(title\)/);
  assert.match(app, /value\.replace\(\/\[_\]\+\/g, ' '\)\.replace\(\/\\s\+\/g, ' '\)/);
  assert.match(app, /openingScriptTitle: this\._formatOpeningTitle\(this\.state\.openingScriptTitle\)/);
  assert.match(app, /this\._enterScript\(`Editor v5\.dc\.html\?script=\$\{encodeURIComponent\(imported\.script\.id\)\}`, imported\.script\.title/);
});
