import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('notifications and chat expose complete Spanish and English dynamic copy', async () => {
  const client = await fs.readFile(path.join(ROOT, 'platform-client.js'), 'utf8');
  assert.match(client, /const localize = \(english, spanish\).*uiText/);
  for (const copy of ['Notificaciones', 'Nuevas', 'Anteriores', 'Estás al día', 'Eliminar notificación', 'Leer todas', 'Chat con colaboradores', 'Abriendo conversación…', 'Escribe un mensaje…', 'Enviar mensaje', 'Aún no hay mensajes. Saluda.']) assert.ok(client.includes(copy), `missing dynamic Spanish copy: ${copy}`);
  assert.match(client, /const localizeNotificationSystemText/);
  assert.match(client, /userAuthoredMessage \? String\(item\.message \|\| ''\)/);
  assert.match(client, /<p data-project-content data-i18n-skip>\$\{escapeHtml\(item\.body\)\}/);
  assert.match(client, /data-chat-copy="loading"/);
  assert.match(client, /data-chat-copy="empty"/);
  assert.match(client, /data-chat-copy="error"/);
});

test('hub and mobile navigation localize labels without translating collaborator names', async () => {
  const client = await fs.readFile(path.join(ROOT, 'platform-client.js'), 'utf8');
  for (const copy of ['Colaboradores activos', 'Personas y acceso', 'Navegación de FilmScript', 'Navegación del proyecto', 'Proyectos', 'Actividad', 'Cuenta', 'Guion', 'Análisis', 'Desglose', 'Plan de rodaje', 'Lista de planos', 'Presupuesto', 'Calendario']) assert.ok(client.includes(copy), `missing navigation Spanish copy: ${copy}`);
  assert.match(client, /data-project-content data-i18n-skip style="--collaborator-color/);
  assert.match(client, /window\.addEventListener\('filmscript:language-change', syncDynamicLanguage\)/);
  assert.match(client, /syncHubLanguage\(\); renderPresence\(\)/);
});

test('floating chat is keyboard reachable and restores focus when dismissed', async () => {
  const [client, css] = await Promise.all([
    fs.readFile(path.join(ROOT, 'platform-client.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'platform-ui.css'), 'utf8'),
  ]);
  assert.match(client, /panel\.setAttribute\('role', 'dialog'\)/);
  assert.match(client, /panel\.setAttribute\('aria-labelledby', 'fs-chat-peer-name'\)/);
  assert.match(client, /aria-live="polite" aria-busy="true"/);
  assert.match(client, /event\.key === 'Escape'.*closeChatPanel\(panel\)/);
  assert.match(client, /returnFocus\?\.isConnected.*returnFocus\.focus/);
  assert.match(css, /\.fs-chat-close:focus-visible[^\{]*\.fs-mobile-nav button:focus-visible/);
  assert.match(css, /prefers-reduced-motion: reduce[^\}]*\.fs-chat-panel/);
});
