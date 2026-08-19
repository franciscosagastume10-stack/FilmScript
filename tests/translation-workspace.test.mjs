import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (file) => fs.readFile(path.join(ROOT, file), 'utf8');

test('translation opens a durable, side-by-side comparison without database polling', async () => {
  const [workspace, editor, client, server, build] = await Promise.all([
    read('translation-workspace.js'), read('Editor v5.dc.html'), read('platform-client.js'), read('server.js'), read('scripts/build-netlify.mjs'),
  ]);
  assert.match(workspace, /class FilmScriptTranslation/);
  assert.match(workspace, /compare-grid/);
  assert.match(workspace, /renderLoadingDocument/);
  assert.match(workspace, /translation-loading/);
  assert.match(workspace, /filmscript:ai\.job\.updated/);
  assert.doesNotMatch(workspace, /setInterval\s*\(/);
  assert.match(editor, /film-script-translation/);
  assert.match(editor, /translationJobId/);
  assert.match(editor, /translationMode: workMode === 'translation'/);
  assert.match(client, /translationJob/);
  assert.match(client, /ai\.job\.updated/);
  assert.match(server, /function updateAndBroadcastAIJob/);
  assert.match(server, /"ai\.job\.updated"/);
  assert.match(server, /script=\$\{encodeURIComponent\(translatedId\)\}&view=editor/);
  assert.match(build, /"translation-workspace\.js"/);
});
