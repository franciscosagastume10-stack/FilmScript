import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');

function languageApi(language = 'en') {
  const values = new Map([['filmscript_language', language]]);
  const document = {
    readyState: 'loading',
    documentElement: { setAttribute() {} },
    addEventListener() {},
    querySelectorAll() { return []; },
  };
  const window = {
    location: { search: '', pathname: '/App.dc.html' },
    addEventListener() {},
    dispatchEvent() {},
  };
  const context = vm.createContext({
    window,
    document,
    localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) },
    URLSearchParams,
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3, DOCUMENT_NODE: 9, DOCUMENT_FRAGMENT_NODE: 11 },
    NodeFilter: { SHOW_ELEMENT: 1, SHOW_TEXT: 4 },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    setTimeout() {},
    clearTimeout() {},
  });
  vm.runInContext(read('language-preference.js'), context);
  return window.filmscriptLanguage;
}

test('Scripts home system copy and accessibility are complete in Spanish and unchanged in English', () => {
  const spanish = languageApi('es').t;
  const english = languageApi('en').t;
  const expected = new Map([
    ['Choose a plan →', 'Elegir un plan →'],
    ['Syncing your scripts securely.', 'Sincronizando tus guiones de forma segura.'],
    ['Rename', 'Renombrar'],
    ['Rename screenplay', 'Renombrar guion'],
    ['Translate Script', 'Traducir guion'],
    ['Importing screenplay', 'Importando guion'],
    ['No scripts yet. Start a new page when you’re ready.', 'Todavía no hay guiones. Empieza una página nueva cuando quieras.'],
    ['Sign in to sync your scripts.', 'Inicia sesión para sincronizar tus guiones.'],
    ['Your session has ended. Please sign in again.', 'Tu sesión terminó. Inicia sesión de nuevo.'],
    ['We could not sync your scripts. Please try again.', 'No pudimos sincronizar tus guiones. Inténtalo de nuevo.'],
    ['Could not create a new screenplay.', 'No se pudo crear un guion nuevo.'],
    ['Could not rename that script. Please try again.', 'No se pudo renombrar ese guion. Inténtalo de nuevo.'],
    ['Typewriter sound', 'Sonido de máquina de escribir'],
    ['Close Lumiere', 'Cerrar Lumiere'],
    ['Ask Lumiere anything…', 'Pregúntale lo que quieras a Lumiere…'],
    ['Send message', 'Enviar mensaje'],
  ]);

  for (const [source, translated] of expected) {
    assert.equal(spanish(source), translated, source);
    assert.equal(english(source), source, source);
  }
});

test('dynamic platform modals choose explicit Spanish copy and protect durable project content', () => {
  const client = read('platform-client.js');

  for (const pair of [
    ["'Translate Script', 'Traducir guion'", 'translation title'],
    ["'Source script', 'Guion de origen'", 'translation source'],
    ["'Target language', 'Idioma de destino'", 'translation target'],
    ["'Starting translation', 'Iniciando traducción'", 'translation progress'],
    ["'Create Shared Project', 'Crear Proyecto compartido'", 'shared project'],
    ["'Anyone with the link', 'Cualquiera con el enlace'", 'public access'],
    ["'Project activity', 'Actividad del proyecto'", 'activity'],
    ["'Current profile image', 'Imagen de perfil actual'", 'account aria'],
    ["'Photo unavailable', 'Foto no disponible'", 'photo error'],
    ["'Location Plan tools', 'Herramientas del Plan de locaciones'", 'location aria'],
    ["'Department view', 'Vista por departamento'", 'location view'],
  ]) assert.ok(client.includes(pair[0]), `missing ${pair[1]} bilingual contract`);

  assert.match(client, /const localizedError = \(error,/);
  assert.match(client, /data-project-content data-i18n-skip>\$\{escapeHtml\(preview\.newProjectName\)\}/);
  assert.match(client, /<strong data-project-content data-i18n-skip>\$\{escapeHtml\(item\.summary\)\}/);
  assert.match(client, /data-project-content data-i18n-skip value="\$\{escapeHtml\(result\.sharedProject\.url\)\}"/);
  assert.doesNotMatch(client, /\[data-translation-summary\]'\)\.textContent = error\.message/);
  assert.doesNotMatch(client, /\[data-share-result\]'\)\.textContent = error\.message/);
  assert.doesNotMatch(client, /data-plan-status\]'\)\.textContent=error\.message/);
});

test('People and Access dynamic permission aria is bilingual', () => {
  const client = read('platform-client.js');
  assert.match(client, /const localizedLabel = \(value\)/);
  assert.match(client, /localize\(`\$\{englishModule\} permission`, `Permiso de \$\{moduleLabel\}`\)/);
  assert.match(client, /'Choose a role preset, then customize each project area\.', 'Elige un rol base y luego personaliza cada área del proyecto\.'/);
  assert.doesNotMatch(client, /aria-label="\$\{label\(module\)\} permission"/);
});
