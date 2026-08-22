import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (file) => fs.readFile(path.join(ROOT, file), 'utf8');

test('translation creates a durable independent project with a tracked Scripts placeholder', async () => {
  const [app, client, server] = await Promise.all([
    read('App.dc.html'), read('platform-client.js'), read('server.js'),
  ]);
  assert.match(client, /translationPreview:\s*\(id, targetLanguage, idempotencyKey\)/);
  assert.match(client, /translate:\s*\(id, targetLanguage, idempotencyKey\)/);
  assert.match(client, /aiJob:\s*\(id\) => request\(`\/api\/ai-jobs\/\$\{encodeURIComponent\(id\)\}`\)/);
  assert.match(client, /trackTranslationJob\(result\.job, context\)/);
  assert.match(client, /emitTranslation\('started'/);
  assert.match(client, /job\.status === 'completed'\) \{ finish\('completed', job\)/);
  assert.match(app, /translatingScripts:\s*\[\]/);
  assert.match(app, /filmscript:translation-started/);
  assert.match(app, /filmscript:translation-completed/);
  assert.match(app, /fs-script-translation-progress/);
  assert.match(app, /scripts\.some\(\(item\) => String\(item\.id\) === translatedId\)/);
  assert.match(server, /translationRelationship:\s*\{ mode: "independent", synchronization: "none" \}/);
  assert.match(server, /output:\s*\{ projectId: translatedId, scriptId: translatedId, title, targetLanguage: language, translationVersion \}/);
  assert.match(server, /script=\$\{encodeURIComponent\(translatedId\)\}&view=editor/);
});
