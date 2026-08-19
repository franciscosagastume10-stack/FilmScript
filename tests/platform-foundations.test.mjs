import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canAccessModule, canEditFinancialData, canUseLumiereAction, canViewFinancialData,
  filterFinancialData, normalizeFinancialPermissions, permissionAtLeast, permissionsForRole,
} from '../permissions-model.js';
import { AI_MODELS, isRetryableAIError, modelForTask, publicAIJob, routeAIRequest } from '../ai-router.js';
import { CollaborationRooms, applyVersionedPatch, collaboratorColor, throttleIntervalForEvent } from '../collaboration-engine.js';
import {
  calibrateScale, canvasToReal, createLocationPlan, detectClosedRooms, pointDistance, pointToSegmentDistance,
  polygonArea, polylineLength, realToCanvas, recommendedCableLength, snapAngle, suggestExtensions,
  updatePinnedMeasurements, wallWithExactLength,
} from '../location-plan-model.js';
import { screenplayTranslationPacket, translatedProjectName, translationCreditCost, validateTranslatedBlocks } from '../translation-policy.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const access = (role, explicit = {}, financial = ['financial.no_access'], departments = []) => ({ status:'active', projectRole:role, modulePermissions:permissionsForRole(role, null, explicit), financialPermissions:financial, financialDepartmentIds:departments });

test('project roles remain separate from cinematic permission presets', () => {
  const dp = permissionsForRole('department_editor', 'director_of_photography', { shot_list:'manage' });
  assert.equal(dp.shot_list, 'manage');
  assert.equal(dp.budget, 'no_access');
  assert.equal(dp.canvas, 'edit');
});

test('viewer and commenter cannot edit while an editor can', () => {
  assert.equal(canAccessModule(access('viewer'), 'script', 'edit'), false);
  assert.equal(canAccessModule(access('commenter'), 'script', 'edit'), false);
  assert.equal(canAccessModule(access('editor'), 'script', 'edit'), true);
  assert.equal(permissionAtLeast('manage', 'view'), true);
});

test('financial access is never granted by a cinematic role', () => {
  assert.deepEqual(normalizeFinancialPermissions([], 'viewer'), ['financial.no_access']);
  assert.equal(canViewFinancialData(access('editor', { budget:'view' })), false);
});

test('department financial access is scoped to assigned departments', () => {
  const dp = access('department_editor', { budget:'edit' }, ['financial.view_department','financial.edit_department'], ['camera']);
  assert.equal(canViewFinancialData(dp, 'camera'), true);
  assert.equal(canViewFinancialData(dp, 'art'), false);
  assert.equal(canEditFinancialData(dp, 'camera'), true);
});

test('financial filtering removes nested costs and totals', () => {
  const value = { title:'Scene', cost:200, element:{ name:'Camera', rate:30 }, rows:[{ name:'Light', total:40 }] };
  assert.deepEqual(filterFinancialData(value, access('viewer')), { title:'Scene', element:{ name:'Camera' }, rows:[{ name:'Light' }] });
});

test('Lumiere actions require both Lumiere and target module edit permission', () => {
  assert.equal(canUseLumiereAction(access('viewer'), 'analysis'), false);
  assert.equal(canUseLumiereAction(access('editor'), 'analysis'), true);
  assert.equal(canUseLumiereAction(access('editor'), 'translation'), true);
});

test('AI routing uses Luna for chat and Sol for structured production work', () => {
  assert.equal(modelForTask('chat', {}), AI_MODELS.luna);
  assert.equal(modelForTask('analysis', {}), AI_MODELS.sol);
  assert.equal(modelForTask('translation', {}), AI_MODELS.sol);
});

test('retryable Sol errors fall back to Terra in the same request', async () => {
  const attempts = [];
  const routed = await routeAIRequest({ task:'breakdown', request:{ value:1 }, onAttempt:(attempt)=>attempts.push(attempt.model), invoke:async ({ model }) => { if (model === AI_MODELS.sol) throw Object.assign(new Error('busy'), { status:503 }); return { ok:true, model }; } });
  assert.equal(routed.usedFallback, true);
  assert.equal(routed.completedModel, AI_MODELS.terra);
  assert.deepEqual(attempts, [AI_MODELS.sol, AI_MODELS.terra]);
});

test('permission and credit failures never trigger Terra fallback', async () => {
  assert.equal(isRetryableAIError({ code:'permission_denied', status:503 }), false);
  await assert.rejects(() => routeAIRequest({ task:'analysis', request:{}, invoke:async () => { throw Object.assign(new Error('denied'), { code:'permission_denied', status:403 }); } }), /denied/);
});

test('public AI jobs hide provider model audit fields', () => {
  assert.deepEqual(publicAIJob({ id:'job_1', status:'complete', internalPrimaryModel:AI_MODELS.sol, internalCompletedModel:AI_MODELS.terra, usedFallback:true }), { id:'job_1', status:'complete' });
});

test('translation pricing follows every configured boundary', () => {
  assert.equal(translationCreditCost(30), 10);
  assert.equal(translationCreditCost(31), 20);
  assert.equal(translationCreditCost(100), 50);
  assert.equal(translationCreditCost(150), 75);
  assert.equal(translationCreditCost(200), 100);
  assert.equal(translationCreditCost(201), 125);
  assert.equal(translationCreditCost(251), 150);
});

test('translation packets preserve screenplay structure and reject malformed output', () => {
  const source = [{ id:'a', type:'scene', text:'INT. CASA DE NILA' }, { id:'b', type:'character', text:'NILA' }];
  const packet = screenplayTranslationPacket(source);
  assert.equal(packet[1].preserve, true);
  assert.deepEqual(validateTranslatedBlocks([{ id:'a',type:'scene',text:"INT. NILA'S HOUSE" },{ id:'b',type:'character',text:'NILA' }], packet).map((block)=>block.type), ['scene','character']);
  assert.throws(() => validateTranslatedBlocks([{ id:'wrong',type:'scene',text:'x' }], packet), /structure/);
  assert.match(translatedProjectName('Test Script','French'), /French Version/);
});

test('separate field edits merge while incompatible scalar writes create a conflict', () => {
  const merged = applyVersionedPatch({ id:'card', version:2, name:'Chair', status:'pending' }, { entityId:'card', baseVersion:1, previous:{ status:'pending' }, patch:{ status:'confirmed' } });
  assert.equal(merged.entity.name, 'Chair'); assert.equal(merged.entity.status, 'confirmed'); assert.equal(merged.conflicts.length, 0);
  const conflict = applyVersionedPatch({ id:'card', version:2, status:'confirmed' }, { entityId:'card', baseVersion:1, previous:{ status:'pending' }, patch:{ status:'removed' } });
  assert.equal(conflict.conflicts[0].currentValue, 'confirmed'); assert.equal(conflict.entity.status, 'confirmed');
});

test('collaborator colors are stable and cursor events are throttled', () => {
  assert.equal(collaboratorColor('usr_one'), collaboratorColor('usr_one'));
  assert.notEqual(throttleIntervalForEvent('cursor.updated'), 0);
  assert.equal(throttleIntervalForEvent('content.operation'), 0);
});

test('presence becomes idle and an empty room expires after five minutes', () => {
  let now = 0; const rooms = new CollaborationRooms({ idleMs:90_000, expireMs:300_000, now:()=>now });
  rooms.join('project',{ clientId:'one',userId:'u1' }); now=90_001; rooms.sweep(); assert.equal(rooms.presence('project')[0].state,'idle');
  rooms.leave('project','one'); now=390_002; assert.deepEqual(rooms.sweep(),['project']);
});

test('geometry utilities preserve distance, scale, and exact wall length', () => {
  const wall={start:{x:0,y:0},end:{x:100,y:0}}; const scale=calibrateScale(wall,5,{locked:false});
  assert.equal(canvasToReal(100,scale),5); assert.equal(realToCanvas(5,scale),100);
  assert.equal(pointDistance(wall.start,wall.end),100); assert.equal(pointToSegmentDistance({x:50,y:20},wall.start,wall.end),20);
  assert.equal(pointDistance(wallWithExactLength(wall,10,scale).start,wallWithExactLength(wall,10,scale).end),200);
});

test('angle snapping is helpful within its threshold', () => {
  const snapped=snapAngle({x:0,y:0},{x:99,y:3}); assert.ok(Math.abs(snapped.y)<.001);
  const free=snapAngle({x:0,y:0},{x:80,y:20}); assert.equal(free.y,20);
});

test('closed wall polygons produce rooms with area', () => {
  const walls=[['a',{x:0,y:0},{x:100,y:0}],['b',{x:100,y:0},{x:100,y:80}],['c',{x:100,y:80},{x:0,y:80}],['d',{x:0,y:80},{x:0,y:0}]].map(([id,start,end])=>({id,start,end}));
  const rooms=detectClosedRooms(walls); assert.ok(rooms.length>=1); assert.equal(rooms[0].area,8000); assert.equal(polygonArea(rooms[0].points),8000);
});

test('cable routes use every segment, slack, and extension suggestions', () => {
  const points=[{x:0,y:0},{x:3,y:4},{x:6,y:4}]; assert.equal(polylineLength(points),8);
  assert.equal(recommendedCableLength(points,10).recommendedLength,8.8);
  const suggestion=suggestExtensions(18.4,[5,10,15,25])[0]; assert.equal(suggestion.total,20); assert.equal(suggestion.lengths.length,2);
});

test('pinned measurements follow referenced equipment', () => {
  const plan=createLocationPlan({id:'loc_1',projectId:'scr_1'}); plan.equipment=[{id:'camera',position:{x:0,y:0}},{id:'actor',position:{x:3,y:4}}]; plan.measurements=[{id:'m1',pinned:true,startRef:{entityId:'camera'},endRef:{entityId:'actor'}}];
  assert.equal(updatePinnedMeasurements(plan).measurements[0].distance,5);
});

test('migration, UI, responsive, and security surfaces are shipped together', async () => {
  const [migration,server,ui,css,app,editor,build]=await Promise.all(['migrations/010_collaboration_platform.sql','server.js','platform-client.js','platform-ui.css','App.dc.html','Editor v5.dc.html','scripts/build-netlify.mjs'].map((file)=>fs.readFile(path.join(ROOT,file),'utf8')));
  for (const table of ['project_memberships','project_invitations','shared_projects','activity_events','notifications','ai_jobs','collaboration_operations','location_plans']) assert.match(migration,new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  assert.match(server,/financial_permission_denied/); assert.match(server,/text\/event-stream/); assert.match(server,/translationCreditCost/);
  for (const theme of ['filmscript','dark','mint','tangerine','lavender','sky','rose','sun']) assert.match(ui,new RegExp(`'${theme}'`));
  assert.match(css,/prefers-reduced-transparency/); assert.match(css,/safe-area-inset-bottom/); assert.match(css,/fs-mobile-nav/);
  assert.match(app,/Translate Script/); assert.match(editor,/platform-client\.js/); assert.match(build,/SharedProject\.html/);
});
