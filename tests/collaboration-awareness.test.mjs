import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { permissionsForRole } from '../permissions-model.js';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filmscript-awareness-'));
process.env.FILMSCRIPT_DB_PATH = path.join(dataDir, 'awareness.sqlite');
const platform = await import(`../platform-database.js?awareness=${Date.now()}`);
const db = platform.__platformDb;
const timestamp = new Date().toISOString();

const insertUser = db.prepare(`INSERT INTO users (id,email,name,username,picture_url,email_verified,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)`);
insertUser.run('usr_owner','owner@example.com','Olivia Owner','olivia',null,timestamp,timestamp);
insertUser.run('usr_writer','writer@example.com','Wren Writer','wren',null,timestamp,timestamp);
db.prepare(`INSERT INTO scripts (id,user_id,title,blocks_json,chat_json,title_room_json,character_names_json,created_at,updated_at) VALUES (?,?,?,'[]','[]','{}','{}',?,?)`).run('scr_awareness','usr_owner','Awareness',timestamp,timestamp);
platform.backfillOwners();
db.prepare(`INSERT INTO project_memberships (id,project_id,user_id,project_role,module_permissions_json,financial_permissions_json,financial_department_ids_json,department_ids_json,status,invited_by_user_id,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  .run('mem_writer','scr_awareness','usr_writer','commenter',JSON.stringify(permissionsForRole('commenter')),JSON.stringify(['financial.no_access']),'[]','[]','active','usr_owner',1,timestamp,timestamp);

after(() => { db.close(); fs.rmSync(dataDir, { recursive:true, force:true }); });

test('Phase 1C migration adds semantic aggregation, threaded comments, and mention storage', () => {
  const activityColumns = db.prepare('PRAGMA table_info(activity_events)').all().map((column) => column.name);
  const commentColumns = db.prepare('PRAGMA table_info(project_comments)').all().map((column) => column.name);
  assert.ok(activityColumns.includes('aggregation_key')); assert.ok(activityColumns.includes('aggregation_count')); assert.ok(activityColumns.includes('updated_at'));
  assert.ok(commentColumns.includes('parent_comment_id')); assert.ok(commentColumns.includes('reopened_at'));
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='comment_mentions'").get());
});

test('meaningful Breakdown edits aggregate instead of recording every field write as a separate event', () => {
  platform.recordActivity({ projectId:'scr_awareness', module:'breakdown', actorUserId:'usr_owner', entityType:'breakdown_card', entityId:'scene_12', action:'breakdown.changed', aggregationKey:'breakdown:scene_12', metadata:{sceneLabel:'Scene 12'} });
  platform.recordActivity({ projectId:'scr_awareness', module:'breakdown', actorUserId:'usr_owner', entityType:'breakdown_card', entityId:'scene_12', action:'breakdown.changed', aggregationKey:'breakdown:scene_12', metadata:{sceneLabel:'Scene 12'} });
  const events = platform.listActivity('scr_awareness','usr_owner','breakdown');
  assert.equal(events.length,1); assert.equal(events[0].count,2); assert.equal(events[0].summary,'Updated 2 Breakdown items in Scene 12.');
});

test('activity history filters inaccessible modules and all financial details', () => {
  platform.recordActivity({ projectId:'scr_awareness', module:'budget', actorUserId:'usr_owner', entityType:'budget_line', entityId:'line_1', action:'content.committed', summary:'Changed private rate to GTQ 900.', containsFinancialData:true });
  const visible = platform.listActivity('scr_awareness','usr_writer');
  assert.ok(visible.every((event) => event.module !== 'budget'));
  assert.ok(visible.every((event) => !event.summary.includes('GTQ')));
});

test('comments support replies, mentions, resolve, reopen, and notification creation', () => {
  const root = platform.createComment('scr_awareness','usr_owner',{module:'script',entityType:'script_block',entityId:'blk_1',body:'Please review this scene.'});
  const reply = platform.createComment('scr_awareness','usr_writer',{module:'script',entityType:'script_block',entityId:'blk_1',parentCommentId:root.id,body:'Done, @olivia — the beat is clearer.'});
  assert.equal(reply.parentCommentId,root.id);
  let updated = platform.resolveComment('scr_awareness','usr_owner',root.id,true).comment; assert.equal(updated.resolved,true);
  updated = platform.resolveComment('scr_awareness','usr_owner',root.id,false).comment; assert.equal(updated.resolved,false); assert.ok(updated.reopenedAt);
  const notifications = platform.listNotifications('usr_owner');
  assert.ok(notifications.some((item) => item.type === 'comment_reply'));
  assert.ok(notifications.some((item) => item.type === 'mention'));
  assert.equal(db.prepare('SELECT count(*) AS count FROM comment_mentions WHERE comment_id=?').get(reply.id).count,1);
});

test('notifications group related events and preserve read and unread state', () => {
  platform.createNotification({userId:'usr_writer',projectId:'scr_awareness',type:'important_project_change',title:'Breakdown changed',message:'One item changed.',actorUserId:'usr_owner',aggregationKey:'breakdown:scene_12'});
  platform.createNotification({userId:'usr_writer',projectId:'scr_awareness',type:'important_project_change',title:'Breakdown changed',message:'Two items changed.',actorUserId:'usr_owner',aggregationKey:'breakdown:scene_12'});
  const grouped = platform.listNotifications('usr_writer').find((item) => item.type === 'important_project_change');
  assert.equal(grouped.count,2); assert.equal(grouped.read,false);
  platform.markNotificationsRead('usr_writer',grouped.id,true); assert.equal(platform.listNotifications('usr_writer').find((item) => item.id === grouped.id).read,true);
  platform.markNotificationsRead('usr_writer',grouped.id,false); assert.equal(platform.listNotifications('usr_writer').find((item) => item.id === grouped.id).read,false);
});

test('Phase 1C UI exposes module history, comments, bell state, live updates, and Canvas anchors', () => {
  const client = fs.readFileSync(new URL('../platform-client.js', import.meta.url),'utf8');
  const canvas = fs.readFileSync(new URL('../canvas-workspace.js', import.meta.url),'utf8');
  assert.match(client,/data-module-history/); assert.match(client,/data-module-comments/); assert.match(client,/comment\.updated/); assert.match(client,/notification\.updated/); assert.match(client,/Mark all as read/); assert.match(client,/data-toggle-read/);
  assert.match(canvas,/Version History/); assert.match(canvas,/board-object-comments/); assert.match(canvas,/filmscript:open-comments/);
});
