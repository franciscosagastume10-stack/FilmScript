import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = (file) => fs.readFile(path.join(ROOT, file), 'utf8');

const luminance = (hex) => {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const linear = channels.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
};

const contrastWithWhite = (hex) => 1.05 / (luminance(hex) + 0.05);

test('translation confirmation uses one idempotency key, ignores stale previews, and closes into a tracked job', async () => {
  const client = await read('platform-client.js');
  assert.match(client, /const idempotencyKey = translationAttemptKey\(\)/);
  assert.match(client, /translationPreview\(script\.id, targetLanguage, idempotencyKey\)/);
  assert.match(client, /translate\(script\.id, selectedLanguage, idempotencyKey\)/);
  assert.match(client, /sequence !== previewSequence \|\| targetLanguage !== select\.value/);
  assert.match(client, /closeDialog\(\);\s*emitTranslation\('started'/);
  assert.match(client, /trackTranslationJob\(result\.job, context\)/);
  assert.match(client, /api\.aiJob\(jobId\)/);
});

test('translation modal is localized, accessible Liquid Glass with a white-on-orange action', async () => {
  const [client, css] = await Promise.all([read('platform-client.js'), read('platform-ui.css')]);
  assert.match(client, /'Translate Script', 'Traducir guion'/);
  assert.match(client, /'Translate to', 'Traducir a'/);
  assert.match(client, /role="status" aria-live="polite" aria-busy="true"/);
  assert.match(client, /'You can keep working while Lumiere translates in the background\.', 'Puedes seguir trabajando mientras Lumiere traduce en segundo plano\.'/);
  assert.match(css, /\.fs-translation-dialog \{[^}]*backdrop-filter:blur\(42px\)/s);
  assert.match(css, /\.fs-translation-start \{[^}]*color:#fff!important/s);
  assert.match(css, /\.fs-translation-start span,\.fs-translation-start i \{ color:#fff!important; \}/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test('orange primary actions keep white text and icons with accessible contrast in FilmScript themes', async () => {
  const css = await read('platform-ui.css');
  const lightAmber = css.match(/--accent-button-background:\s*(#[0-9a-f]{6})/i)?.[1];
  const darkAmber = css.match(/data-filmscript-theme="dark"[^}]*--accent-button-background:(#[0-9a-f]{6})/i)?.[1];
  assert.ok(lightAmber, 'FilmScript should define a dedicated amber button background');
  assert.ok(darkAmber, 'dark mode should define a dedicated amber button background');
  assert.ok(contrastWithWhite(lightAmber) >= 4.5, `${lightAmber} must retain AA contrast with white`);
  assert.ok(contrastWithWhite(darkAmber) >= 4.5, `${darkAmber} must retain AA contrast with white`);
  assert.match(css, /--accent-button-foreground:\s*#fff/);
  assert.match(css, /\.fs-action-primary \{[^}]*background:var\(--accent-button-background\);[^}]*color:var\(--accent-button-foreground\)/s);
  assert.match(css, /\.fs-action-primary > \*, \.fs-action-primary svg \{ color:inherit!important; \}/);
  assert.doesNotMatch(css, /button[^{}]*\{[^}]*background:var\(--accent\);[^}]*color:var\(--accent-foreground\)/s);
  assert.match(css, /data-filmscript-theme="mint"[^}]*--accent-button-background:var\(--accent\)/);
});

test('Scripts inserts a live translation card and atomically replaces it when the translated project is listed', async () => {
  const app = await read('App.dc.html');
  assert.match(app, /translatingScripts: \[\]/);
  assert.match(app, /filmscript:translation-started/);
  assert.match(app, /filmscript:translation-updated/);
  assert.match(app, /filmscript:translation-completed/);
  assert.match(app, /\.\.\.translatingCards,\s*\.\.\.importingCard/s);
  assert.match(app, /fs-script-translation-progress/);
  assert.match(app, /is-translation-arrival/);
  assert.match(app, /is-translation-shifted/);
  assert.match(app, /scripts\.some\(\(item\) => String\(item\.id\) === translatedId\)/);
  assert.match(app, /role:c\.translating \? 'status' : 'button'/);
  assert.match(app, /removeEventListener\('filmscript:translation-completed'/);
});

test('opening notifications marks only the notifications that were actually loaded as seen', async () => {
  const client = await read('platform-client.js');
  assert.match(client, /seenNotificationIds = state\.notifications\.filter\(\(item\) => !item\.read\)/);
  assert.match(client, /seenNotificationIds\.map\(\(id\) => api\.markRead\(id\)\)/);
  assert.match(client, /badge\.textContent = ''; badge\.hidden = true/);
  assert.doesNotMatch(client, /loadedUnreadCount[\s\S]{0,500}api\.markRead\(\)\.then/);
});

test('translation tracking survives bfcache restores and cleans up only on a real unload', async () => {
  const client = await read('platform-client.js');
  assert.match(client, /pagehide', \(event\) => \{/);
  assert.match(client, /if \(event\.persisted\) \{[\s\S]*tracker\.paused = true[\s\S]*return;/);
  assert.match(client, /pageshow', \(event\) => \{/);
  assert.match(client, /if \(!event\.persisted\) return;/);
  assert.match(client, /tracker\.paused = false;[\s\S]*window\.setTimeout\(tracker\.poll, 120\)/);
  assert.match(client, /if \(tracker\.stopped \|\| tracker\.paused\) return;/);
});

test('a completed translation keeps retrying the scripts list with capped backoff until its project appears', async () => {
  const app = await read('App.dc.html');
  assert.match(app, /const immediateAttempts = syncAttempt === 0 \? 6 : 1/);
  assert.match(app, /retryDelay = Math\.min\(60_000, 5000 \* \(2 \*\* Math\.min\(syncAttempt, 4\)\)\)/);
  assert.match(app, /syncAttempt:syncAttempt \+ 1/);
  assert.doesNotMatch(app, /if \(syncAttempt < 3\)/);
  assert.match(app, /_translationSyncTimers\?\.forEach\(\(timer\) => window\.clearTimeout\(timer\)\)/);
});
