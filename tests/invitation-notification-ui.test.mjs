import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const client = read('platform-client.js');
const styles = read('platform-ui.css');
const language = read('language-preference.js');
const app = read('App.dc.html');

test('project invitation notifications expose real accept and decline operations', () => {
  assert.match(client, /acceptInvitation: \(id\) => request\(`\/api\/invitations\/\$\{encodeURIComponent\(id\)\}\/accept`/);
  assert.match(client, /declineInvitation: \(id\) => request\(`\/api\/invitations\/\$\{encodeURIComponent\(id\)\}\/decline`/);
  assert.match(client, /data-invitation-accept/);
  assert.match(client, /data-invitation-decline/);
  assert.match(client, /data-notification-delete/);
  assert.match(client, /role="group" aria-label=/);
  assert.match(client, /aria-busy/);
  assert.match(client, /role="status" aria-live="polite"/);
});

test('accepting an invitation refreshes Scripts instead of following a dead deep link', () => {
  assert.match(client, /data-link="\$\{escapeHtml\(invitation \? '' : item\.deepLink \|\| ''\)\}"/);
  assert.match(client, /filmscript:project-membership-changed/);
  assert.match(client, /detail:\{ projectId:acceptedProjectId \|\| null, membership:result\?\.membership \|\| null, project:result\?\.project \|\| null \}/);
  assert.match(client, /workspace\\\/scripts/);
  assert.match(client, /destination\.searchParams\.set\('acceptedProject', acceptedProjectId\)/);
});

test('invitation actions use a responsive accessible Liquid Glass tray', () => {
  assert.match(styles, /\.fs-notification-actions \{[^}]*backdrop-filter:blur\(24px\) saturate\(1\.2\)/s);
  assert.match(styles, /\.fs-notification-card\.has-invitation-actions:hover \.fs-notification-actions/);
  assert.match(styles, /\.fs-notification-card\.has-invitation-actions:focus-within \.fs-notification-actions/);
  assert.match(styles, /\.fs-notification-action\[data-kind="accept"\]/);
  assert.match(styles, /\.fs-notification-action\[data-kind="decline"\]/);
  assert.match(styles, /\.fs-notification-action\[data-kind="delete"\]/);
  assert.match(styles, /\.fs-notification-actions \{ opacity:1; pointer-events:auto;/);
  assert.match(styles, /prefers-reduced-transparency:reduce[\s\S]*\.fs-notification-actions/);
  assert.match(styles, /prefers-reduced-motion:reduce[\s\S]*\.fs-notification-actions/);
  assert.match(styles, /\.fs-notification-actions \.fs-notification-action,[^{]+\{[^}]*width:44px;[^}]*height:44px;/s);
});

test('accepted projects refresh Scripts and expose only the modules granted by the owner', () => {
  assert.match(app, /filmscript:project-membership-changed/);
  assert.match(app, /acceptedProject/);
  assert.match(app, /await this\._loadScripts\(\{ retries: 3 \}\)/);
  assert.match(app, /const sharedAccess = role !== 'owner'/);
  assert.match(app, /const canDelete = role === 'owner'/);
  assert.match(app, /s\.owner\?\.name/);
  assert.match(app, /_preferredProjectView\(access\)/);
  assert.match(app, /Object\.prototype\.hasOwnProperty\.call\(script, 'preferredView'\)/);
  assert.match(app, /\['script', 'editor'\][\s\S]*\['breakdown', 'breakdown'\][\s\S]*\['calendar', 'calendar'\]/);
  assert.match(app, /preferredView === 'location_plan'[\s\S]*App\.dc\.html\?project=\$\{encodeURIComponent\(script\.id\)\}&openLocationPlan=1/);
  assert.match(app, /preferredView && preferredView !== 'editor'/);
  assert.match(client, /params\.get\('openLocationPlan'\) === '1'/);
});

test('invitation action copy is complete in English and Spanish', () => {
  for (const [english, spanish] of [
    ['Project invitation actions', 'Acciones de invitación al proyecto'],
    ['Show project invitation actions', 'Mostrar acciones de invitación al proyecto'],
    ['Accept project invitation', 'Aceptar invitación al proyecto'],
    ['Decline project invitation', 'Rechazar invitación al proyecto'],
    ['Invitation accepted. Opening your scripts…', 'Invitación aceptada. Abriendo tus guiones…'],
    ['Invitation declined.', 'Invitación rechazada.'],
    ['The invitation could not be updated.', 'No se pudo actualizar la invitación.'],
  ]) {
    assert.ok(language.includes(`'${english}': '${spanish}'`), `missing translation for ${english}`);
  }
});
