import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'filmscript-access-'));
process.env.FILMSCRIPT_DATA_DIR = testDirectory;
process.env.FILMSCRIPT_DB_PATH = path.join(testDirectory, 'filmscript.sqlite');

const platform = await import(`../platform-database.js?access=${Date.now()}`);
const permissions = await import('../permissions-model.js');
const { invitationEmail } = await import('../invitation-mailer.js');
const Database = (await import('better-sqlite3')).default;
const database = new Database(process.env.FILMSCRIPT_DB_PATH);
database.pragma('foreign_keys = ON');

const timestamp = new Date().toISOString();
function addUser(id, email, username) {
  database.prepare(`INSERT INTO users (id,google_sub,email,name,email_verified,username,created_at,updated_at)
    VALUES (?,?,?,?,1,?,?,?)`).run(id, `google_${id}`, email, username.replaceAll('_',' '), username, timestamp, timestamp);
}
addUser('usr_owner', 'owner@example.com', 'owner');
addUser('usr_writer', 'writer@example.com', 'writer');
addUser('usr_viewer', 'viewer@example.com', 'viewer');
addUser('usr_outsider', 'outsider@example.com', 'outsider');
database.prepare(`INSERT INTO scripts (id,user_id,title,source,text,blocks_json,chat_json,title_room_json,character_names_json,created_at,updated_at)
  VALUES ('scr_access','usr_owner','Access Test','test','','[]','[]','{}','{}',?,?)`).run(timestamp, timestamp);
platform.backfillOwners();

test.after(() => { database.close(); fs.rmSync(testDirectory, { recursive:true, force:true }); });

test('invitation resolves a FilmScript username and account email', () => {
  const username = platform.createInvitation('scr_access','usr_owner',{ username:'writer', projectRole:'editor', cinematicRole:'writer' });
  const email = platform.createInvitation('scr_access','usr_owner',{ email:'viewer@example.com', projectRole:'viewer', cinematicRole:'client' });
  const rows = database.prepare('SELECT invited_user_id, invited_username, invited_email FROM project_invitations WHERE id IN (?,?) ORDER BY id').all(username.id,email.id);
  assert.equal(rows.some((row) => row.invited_user_id === 'usr_writer' && row.invited_username === 'writer'), true);
  assert.equal(rows.some((row) => row.invited_user_id === 'usr_viewer' && row.invited_email === 'viewer@example.com'), true);
});

test('external email invitation connects after account creation', () => {
  const invitation = platform.createInvitation('scr_access','usr_owner',{ email:'external@example.com', projectRole:'commenter', cinematicRole:'client' });
  assert.equal(database.prepare('SELECT invited_user_id FROM project_invitations WHERE id=?').get(invitation.id).invited_user_id, null);
  addUser('usr_external','external@example.com','external');
  const membership = platform.acceptInvitation(invitation.token,'usr_external');
  assert.equal(membership.projectRole,'commenter');
  assert.equal(membership.status,'active');
});

test('account invitation actions securely accept a notification and are idempotent', () => {
  database.prepare(`INSERT INTO scripts (id,user_id,title,source,text,blocks_json,chat_json,title_room_json,character_names_json,created_at,updated_at)
    VALUES ('scr_notification','usr_owner','Shared Story','test','','[]','[]','{}','{}',?,?)`).run(timestamp, timestamp);
  platform.backfillOwners();
  const created = platform.createInvitation('scr_notification','usr_owner',{
    email:'writer@example.com', projectRole:'editor', cinematicRole:'writer', modulePermissions:{ script:'edit', breakdown:'edit' },
  });

  assert.throws(() => platform.acceptAccountInvitation(created.id,'usr_outsider'), /not found/i);
  const pending = platform.listAccountInvitations('usr_writer');
  assert.equal(pending.some((invitation) => invitation.id === created.id), true);
  assert.equal(pending.find((invitation) => invitation.id === created.id).project.ownerName, 'owner');

  const notification = platform.listNotifications('usr_writer').find((item) => item.invitation?.id === created.id);
  assert.equal(notification.invitation.projectTitle, 'Shared Story');
  assert.equal(notification.invitation.projectRole, 'editor');
  assert.equal(notification.deepLink, '/App.dc.html');

  const first = platform.acceptAccountInvitation(created.id,'usr_writer');
  database.prepare("UPDATE project_invitations SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(created.id);
  const second = platform.acceptAccountInvitation(created.id,'usr_writer');
  assert.equal(second.membership.id, first.membership.id);
  assert.equal(second.membership.version, first.membership.version);
  assert.equal(first.membership.projectRole, 'editor');
  assert.equal(first.membership.modulePermissions.breakdown, 'edit');
  assert.equal(first.project.title, 'Shared Story');
  assert.equal(platform.listAccessibleProjectIds('usr_writer').includes('scr_notification'), true);
  assert.equal(platform.listAccountInvitations('usr_writer').some((invitation) => invitation.id === created.id), false);
  const resolvedNotification = platform.listNotifications('usr_writer').find((item) => item.id === notification.id);
  assert.equal(resolvedNotification.invitation.status, 'accepted');
  assert.equal(resolvedNotification.read, true);
  assert.match(resolvedNotification.deepLink, /acceptedProject=scr_notification/);
});

test('active members and the billing owner cannot be reinvited or degraded by a stale invitation', () => {
  database.prepare(`INSERT INTO scripts (id,user_id,title,source,text,blocks_json,chat_json,title_room_json,character_names_json,created_at,updated_at)
    VALUES ('scr_member_guard','usr_owner','Membership Guard','test','','[]','[]','{}','{}',?,?)`).run(timestamp, timestamp);
  platform.backfillOwners();

  assert.throws(
    () => platform.createInvitation('scr_member_guard','usr_owner',{ email:'owner@example.com', projectRole:'viewer' }),
    (error) => error?.status === 409 && error?.code === 'already_project_member',
  );

  const writerInvitation = platform.createInvitation('scr_member_guard','usr_owner',{ email:'writer@example.com', projectRole:'editor', modulePermissions:{ script:'edit' } });
  const writerMembership = platform.acceptAccountInvitation(writerInvitation.id,'usr_writer').membership;
  assert.throws(
    () => platform.createInvitation('scr_member_guard','usr_owner',{ email:'writer@example.com', projectRole:'viewer' }),
    (error) => error?.status === 409 && error?.code === 'already_project_member',
  );
  const writerAccess = platform.projectAccess('usr_writer','scr_member_guard');
  assert.equal(writerAccess.id, writerMembership.id);
  assert.equal(writerAccess.projectRole, 'editor');
  assert.equal(writerAccess.modulePermissions.script, 'edit');

  // Simulate an invitation persisted before this guard existed. Accepting it
  // must resolve the notification without rewriting canonical owner access.
  const staleOwnerInvitation = platform.createInvitation('scr_member_guard','usr_owner',{ email:'outsider@example.com', projectRole:'viewer' });
  database.prepare(`UPDATE project_invitations
    SET invited_user_id='usr_owner', invited_email='owner@example.com'
    WHERE id=?`).run(staleOwnerInvitation.id);
  const ownerBefore = platform.projectAccess('usr_owner','scr_member_guard');
  const accepted = platform.acceptAccountInvitation(staleOwnerInvitation.id,'usr_owner');
  const ownerAfter = platform.projectAccess('usr_owner','scr_member_guard');
  assert.equal(accepted.invitation.status, 'accepted');
  assert.equal(ownerAfter.id, ownerBefore.id);
  assert.equal(ownerAfter.version, ownerBefore.version);
  assert.equal(ownerAfter.projectRole, 'owner');
  assert.equal(ownerAfter.modulePermissions.members, 'manage');
  assert.equal(ownerAfter.financialPermissions.includes('financial.edit_all'), true);
  assert.equal(database.prepare("SELECT count(*) AS count FROM activity_events WHERE project_id='scr_member_guard' AND action='project.member.joined' AND actor_user_id='usr_owner'").get().count, 0);
});

test('account invitation rejection is secure, idempotent, and never creates access', () => {
  database.prepare(`INSERT INTO scripts (id,user_id,title,source,text,blocks_json,chat_json,title_room_json,character_names_json,created_at,updated_at)
    VALUES ('scr_decline','usr_owner','Declined Story','test','','[]','[]','{}','{}',?,?)`).run(timestamp, timestamp);
  platform.backfillOwners();
  const created = platform.createInvitation('scr_decline','usr_owner',{ email:'viewer@example.com', projectRole:'viewer' });
  const first = platform.declineAccountInvitation(created.id,'usr_viewer');
  const second = platform.declineAccountInvitation(created.id,'usr_viewer');
  assert.equal(first.status, 'declined');
  assert.equal(second.status, 'declined');
  assert.equal(platform.projectAccess('usr_viewer','scr_decline'), null);
  assert.equal(database.prepare("SELECT count(*) AS count FROM activity_events WHERE entity_id=? AND action='project.invitation.declined'").get(created.id).count, 1);
  assert.throws(() => platform.acceptAccountInvitation(created.id,'usr_viewer'), /no longer available/i);
  assert.throws(() => platform.declineAccountInvitation(created.id,'usr_outsider'), /not found/i);
});

test('email-only account actions require a verified matching email', () => {
  const created = platform.createInvitation('scr_access','usr_owner',{ email:'unverified@example.com', projectRole:'viewer' });
  database.prepare(`INSERT INTO users (id,google_sub,email,name,email_verified,username,created_at,updated_at)
    VALUES ('usr_unverified','google_unverified','unverified@example.com','Unverified',0,'unverified',?,?)`).run(timestamp, timestamp);
  assert.equal(platform.listAccountInvitations('usr_unverified').some((item) => item.id === created.id), false);
  assert.throws(() => platform.acceptInvitation(created.token,'usr_unverified'), /another account/i);
});

test('legacy invitation notifications resolve actions without exposing invitation tokens', () => {
  const created = platform.createInvitation('scr_access','usr_owner',{ email:'outsider@example.com', projectRole:'commenter' });
  database.prepare("UPDATE notifications SET metadata_json='{}', deep_link='/App.dc.html?project=scr_access' WHERE user_id='usr_outsider' AND type='project_invitation'").run();
  const notification = platform.listNotifications('usr_outsider').find((item) => item.invitation?.id === created.id);
  assert.equal(notification.invitation.status, 'pending');
  assert.doesNotMatch(notification.deepLink, /[?&]invitation=/);
  assert.equal(JSON.stringify(notification).includes(created.token), false);
});

test('secure invitation links store only hashes and rotation invalidates the old token', () => {
  const invitation = platform.createInvitation('scr_access','usr_owner',{ email:'new@example.com', projectRole:'viewer' });
  const stored = database.prepare('SELECT token_hash FROM project_invitations WHERE id=?').get(invitation.id).token_hash;
  assert.notEqual(stored, invitation.token);
  assert.equal(stored.length, 64);
  const rotated = platform.rotateInvitationToken('scr_access',invitation.id,'usr_owner');
  assert.throws(() => platform.acceptInvitation(invitation.token,'usr_writer'), /no longer available/i);
  assert.notEqual(rotated.token, invitation.token);
});

test('expired and revoked invitations cannot be accepted', () => {
  const expired = platform.createInvitation('scr_access','usr_owner',{ email:'expired@example.com', projectRole:'viewer' });
  database.prepare("UPDATE project_invitations SET expires_at='2000-01-01T00:00:00.000Z' WHERE id=?").run(expired.id);
  assert.throws(() => platform.acceptInvitation(expired.token,'usr_writer'), /no longer available/i);
  const revoked = platform.createInvitation('scr_access','usr_owner',{ email:'revoked@example.com', projectRole:'viewer' });
  platform.revokeInvitation('scr_access',revoked.id,'usr_owner');
  assert.throws(() => platform.acceptInvitation(revoked.token,'usr_writer'), /no longer available/i);
});

test('temporary guest is read only and cannot receive financial access', () => {
  const invitation = platform.createInvitation('scr_access','usr_owner',{ projectRole:'temporary_guest', cinematicRole:'producer', modulePermissions:{ script:'view', breakdown:'view', budget:'manage' }, financialPermissions:['financial.view_all'] });
  const session = platform.createGuestSession(invitation.token);
  const access = platform.guestProjectAccess(session.token);
  assert.equal(permissions.canAccessModule(access,'script','view'),true);
  assert.equal(permissions.canAccessModule(access,'script','edit'),false);
  assert.equal(permissions.canAccessModule(access,'budget','view'),false);
  assert.deepEqual(access.financialPermissions,['financial.no_access']);
});

test('viewer and commenter role caps reject edit access', () => {
  const viewer = { status:'active', modulePermissions:permissions.permissionsForRole('viewer',null,{ script:'manage' }) };
  const commenter = { status:'active', modulePermissions:permissions.permissionsForRole('commenter',null,{ script:'edit' }) };
  assert.equal(permissions.canEditModule(viewer,'script'),false);
  assert.equal(permissions.canEditModule(commenter,'script'),false);
  assert.equal(permissions.canCommentOnModule(commenter,'script'),true);
});

test('department editor remains restricted to assigned module permissions', () => {
  const access = { status:'active', modulePermissions:permissions.permissionsForRole('department_editor',null,{ breakdown:'edit' }) };
  assert.equal(permissions.canEditModule(access,'breakdown'),true);
  assert.equal(permissions.canViewModule(access,'shot_list'),false);
  assert.equal(permissions.canViewModule(access,'budget'),false);
});

test('financial filtering removes all costs without access and scopes department costs', () => {
  const value = { total:300, accounts:[{ id:'camera', name:'Camera', items:[{ name:'Lens', cost:100 }] },{ id:'art', name:'Art', items:[{ name:'Paint', cost:200 }] }] };
  const none = { status:'active', financialPermissions:['financial.no_access'], financialDepartmentIds:[] };
  assert.deepEqual(permissions.filterFinancialData(value,none),{ accounts:[{ id:'camera', name:'Camera', items:[{ name:'Lens' }] },{ id:'art', name:'Art', items:[{ name:'Paint' }] }] });
  const camera = { status:'active', financialPermissions:['financial.view_department'], financialDepartmentIds:['camera'] };
  const filtered = permissions.filterDepartmentFinancialData(value,camera);
  assert.equal(filtered.accounts[0].items[0].cost,100);
  assert.equal('cost' in filtered.accounts[1].items[0],false);
  assert.equal('total' in filtered,false);
});

test('unauthorized exports automatically remove rates and totals', () => {
  const access = { status:'active', financialPermissions:['financial.no_access'], financialDepartmentIds:[] };
  const exported = permissions.filterFinancialData({ title:'Breakdown', cast:[{ name:'Alex', rate:900 }], projectTotal:900 },access);
  assert.deepEqual(exported,{ title:'Breakdown', cast:[{ name:'Alex' }] });
});

test('member removal revokes project access immediately', () => {
  const invitation = platform.createInvitation('scr_access','usr_owner',{ username:'writer', projectRole:'editor', modulePermissions:{ script:'edit' } });
  const membership = platform.acceptInvitation(invitation.token,'usr_writer');
  assert.equal(platform.projectAccess('usr_writer','scr_access').status,'active');
  platform.updateMembership('scr_access',membership.id,'usr_owner',{ status:'removed' });
  assert.equal(platform.projectAccess('usr_writer','scr_access'),null);
});

test('ownership transfer is atomic and leaves exactly one billing owner', () => {
  const invitation = platform.createInvitation('scr_access','usr_owner',{ username:'viewer', projectRole:'co_owner' });
  const target = platform.acceptInvitation(invitation.token,'usr_viewer');
  platform.transferProjectOwnership('scr_access','usr_owner',target.id);
  const owners = database.prepare("SELECT user_id FROM project_memberships WHERE project_id='scr_access' AND project_role='owner' AND status='active'").all();
  assert.deepEqual(owners.map((row) => row.user_id),['usr_viewer']);
  assert.equal(platform.projectBillingOwnerId('scr_access'),'usr_viewer');
  assert.equal(platform.projectAccess('usr_owner','scr_access').projectRole,'co_owner');
});

test('owner subscription controls project features while collaborators need no matching plan', () => {
  database.prepare("INSERT OR REPLACE INTO subscriptions (user_id,plan,status,updated_at) VALUES ('usr_viewer','full','active',?)").run(timestamp);
  assert.equal(platform.projectBillingOwnerId('scr_access'),'usr_viewer');
  assert.equal(database.prepare("SELECT plan FROM subscriptions WHERE user_id=?").get(platform.projectBillingOwnerId('scr_access')).plan,'full');
  assert.equal(database.prepare("SELECT plan FROM subscriptions WHERE user_id='usr_owner'").get(),undefined);
  assert.equal(platform.projectAccess('usr_owner','scr_access').status,'active');
});

test('invitation email includes project roles, expiration, and secure action', () => {
  const email = invitationEmail({ inviterName:'Morgan', projectName:'Night Exterior', cinematicRole:'director', projectRole:'editor', invitationUrl:'https://filmscript.example/Invitation.html?invitation=secret', expiresAt:'2026-08-26T16:00:00.000Z' });
  assert.match(email.subject,/Morgan invited you to collaborate on Night Exterior in FilmScript/);
  assert.match(email.html,/Cinematic role:<\/strong> director/i);
  assert.match(email.html,/Open invitation/);
  assert.match(email.text,/expires/i);
});
