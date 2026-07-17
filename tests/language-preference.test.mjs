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

test('first workspace entry asks for a language and persists the choice', () => {
  const language = read('language-preference.js');
  assert.match(language, /INITIAL_CHOICE_ID = 'filmscript-language-initial-choice'/);
  assert.match(language, /const hasStoredLanguage = \(\) =>/);
  assert.match(language, /const shouldOfferInitialChoice = \(\) =>/);
  assert.match(language, /return \/\^\(App\|Editor v5\|Subscription\)\\\.dc/);
  assert.match(language, /Choose your language<br><span>Elige tu idioma<\/span>/);
  assert.match(language, /data-initial-language-option="en"/);
  assert.match(language, /data-initial-language-option="es"/);
  assert.match(language, /window\.setTimeout\(openInitialChoice, 80\)/);
  assert.match(language, /needsInitialChoice: shouldOfferInitialChoice/);
  assert.match(language, /closeInitialChoice\(\);/);
  for (const page of ['App.dc.html', 'Editor v5.dc.html', 'Subscription.dc.html']) {
    assert.match(read(page), /language-preference\.js\?v=20260716-language-choice1/, page);
  }
});

test('language selector shows one clean label per option', () => {
  const language = read('language-preference.js');
  const options = (language.match(/<button type="button" class="fs-language-option"[\s\S]*?<\/button>/g) || [])
    .filter((option) => option.includes('data-language-option'));
  assert.equal(options.length, 2);
  assert.match(options[0], /data-language-option="en"[\s\S]*?<strong>English<\/strong><\/span>/);
  assert.match(options[1], /data-language-option="es"[\s\S]*?<strong>Español<\/strong><\/span>/);
  assert.equal(options.some((option) => option.includes('<small>')), false);
});

test('Spanish profile theme labels use night and day language', () => {
  const language = read('language-preference.js');
  assert.match(language, /'Dark theme': 'Modo noche'/);
  assert.match(language, /'Light theme': 'Modo día'/);
  assert.match(language, /'Switch to dark mode': 'Cambiar a modo noche'/);
  assert.match(language, /'Switch to light mode': 'Cambiar a modo día'/);
});

test('Spanish afternoon greetings use natural, playful copy', () => {
  const app = read('App.dc.html');
  const language = read('language-preference.js');
  for (const copy of [
    'El café ya hizo su parte. Ahora toca rescatar ese segundo acto antes de que pida vacaciones.',
    'La tarde está dorada y ese tercer acto sigue pidiendo auxilio. Vamos a darle una vuelta.',
  ]) {
    assert.match(app, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(language, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(app, /Una hora perfecta para los segundos actos/);
  assert.doesNotMatch(app, /La luz se vuelve dorada\. Un buen momento/);
});

test('every user-facing FilmScript page loads the shared language preference', () => {
  for (const page of ['App.dc.html', 'Editor v5.dc.html', 'Features.dc.html', 'Pricing.dc.html', 'Subscription.dc.html']) {
    assert.match(read(page), /language-preference\.js/, page);
  }
  assert.match(read('scripts/build-netlify.mjs'), /"language-preference\.js"/);
});

test('terms disclose the Lumiere credit limit and what happens when it is reached', () => {
  for (const page of ['App.dc.html', 'Features.dc.html', 'Pricing.dc.html']) {
    const source = read(page);
    assert.match(source, /Lumiere credits and usage limits\./, page);
    assert.match(source, /100 Lumiere credits per monthly billing period\./, page);
    assert.match(source, /new Lumiere generations pause until the next reset/, page);
  }
  const language = read('language-preference.js');
  assert.match(language, /'Lumiere credits and usage limits\.': 'Créditos y límites de uso de Lumiere\.'/);
  assert.match(language, /FilmScript Pro incluye 100 créditos de Lumiere/);
});

test('the Lumiere brand name is never accented in the interface', () => {
  for (const file of ['language-preference.js', 'lumiere-preferences.js', 'analysis-workspace.js', 'server.js', 'Editor v5.dc.html']) {
    assert.equal(read(file).includes('Lumière'), false, `${file} still contains accented Lumiere copy`);
  }
});

test('Analysis has Spanish copy for its empty state, focus cards, drawers, and dynamic labels', () => {
  const language = read('language-preference.js');
  const analysis = read('analysis-workspace.js');
  for (const [english, spanish] of [
    ['Choose how to read your screenplay', 'Elige cómo leer tu guion'],
    ['Quick analysis', 'Análisis rápido'],
    ['Deep analysis', 'Análisis profundo'],
    ['Lumiere focus', 'Enfoque de Lumiere'],
    ['Analysis summary', 'Resumen del análisis'],
    ['Explore further', 'Explorar más'],
    ['Production lens', 'Perspectiva de producción'],
    ['Refresh', 'Actualizar'],
    ['Try again', 'Intentar de nuevo'],
    ['No scenes are associated with this selection.', 'No hay escenas asociadas con esta selección.'],
  ]) {
    assert.match(analysis, new RegExp(english.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')), english);
    assert.match(language, new RegExp(`'${english.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}': '${spanish.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}'`), spanish);
  }
  assert.match(language, /More screenplay context is needed before Lumiere can interpret/);
  assert.match(language, /FilmScript Pro is required for new Lumiere/);
  assert.match(language, /value\.match\(\/\^\(\\d\+\) scenes · current draft\$/);
  assert.match(language, /value\.match\(\/\^Updated \(\.\+\)\$/);
  assert.match(analysis, /window\.filmscriptLanguage\?\.get\?\.\(\) === 'es'/);
  assert.match(analysis, /filmscript:language-change/);
  assert.match(analysis, /filmscriptLanguage\?\.t\?\.\(sourceQuestion, 'es'\)/);
  for (const status of [
    'Lumiere is finding the story priorities and production impact',
    'The screenplay changed while Lumiere was reading it',
    'The previous analysis was interrupted. Start it again when ready.',
    'Preparing the current screenplay for Lumiere',
  ]) assert.match(language, new RegExp(`'${status.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}'`));
});

test('Budget translates every primary view, cash-flow title, expense state, and default account label', () => {
  const language = read('language-preference.js');
  const budget = read('budget-workspace.js');
  const budgetModel = read('budget-model.js');
  for (const [english, spanish] of [
    ['Budget Quick View', 'Vista rápida del presupuesto'],
    ['Budget Summary', 'Resumen del presupuesto'],
    ['Budget Breakdown', 'Desglose del presupuesto'],
    ['Cash Flow', 'Flujo de caja'],
    ['Weekly profile', 'Perfil semanal'],
    ['Finance Plan', 'Plan financiero'],
    ['Expense Report', 'Informe de gastos'],
    ['Budget Settings', 'Ajustes del presupuesto'],
    ['Loading Budget', 'Cargando presupuesto'],
    ['Budget could not be opened', 'No se pudo abrir el presupuesto'],
    ['No expenses yet', 'Aún no hay gastos'],
    ['Choose a budget line', 'Elegir una partida presupuestaria'],
    ['Record as unexpected cost', 'Registrar como costo inesperado'],
    ['Project Development', 'Desarrollo del proyecto'],
    ['Camera Equipment', 'Equipo de cámara'],
    ['Picture Postproduction', 'Postproducción de imagen'],
  ]) {
    assert.match(`${budget}\n${budgetModel}`, new RegExp(english.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')), english);
    assert.match(language, new RegExp(`'${english.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}': '${spanish.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}'`), spanish);
  }
  assert.match(language, /value\.match\(\/\^Prep Week/);
  assert.match(language, /value\.match\(\/\^\(\\d\+\) payments\? need a date/);
  assert.match(language, /value\.match\(\/\^Preview of/);
  assert.match(budget, /filmscript:language-change/);
  assert.match(budget, /displayLabel\(value\)/);
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
