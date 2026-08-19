import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Y from 'yjs';
import { CollaborationRooms, applyVersionedPatch, collaboratorColor } from '../collaboration-engine.js';
import { ScriptDocumentRegistry, createScriptDocument, scriptBlocksFromDocument } from '../realtime-collaboration.js';

test('presence keeps a stable collaborator color and exposes active idle and disconnected states', () => {
  let now = 0; const rooms = new CollaborationRooms({ now:() => now, idleMs:100, expireMs:300 });
  const active = rooms.join('project', { clientId:'one', userId:'user', module:'script' });
  assert.equal(active.color, collaboratorColor('user')); assert.equal(active.state, 'active');
  now = 101; rooms.sweep(); assert.equal(rooms.presence('project')[0].state, 'idle');
  rooms.update('project', 'one', { module:'canvas' }); assert.equal(rooms.presence('project')[0].state, 'active');
  rooms.disconnect('project', 'one'); assert.equal(rooms.presence('project')[0].state, 'disconnected');
});

test('simultaneous screenplay edits merge through Yjs instead of last write wins', () => {
  const original = createScriptDocument([{ id:'blk_a', type:'action', text:'Hello world' }]); const snapshot = Y.encodeStateAsUpdate(original);
  const left = createScriptDocument([], snapshot); const right = createScriptDocument([], snapshot);
  const leftBefore = Y.encodeStateVector(left); const rightBefore = Y.encodeStateVector(right);
  left.getArray('blocks').get(0).get('text').insert(5, ' brave'); right.getArray('blocks').get(0).get('text').insert(11, '!');
  Y.applyUpdate(left, Y.encodeStateAsUpdate(right, rightBefore)); Y.applyUpdate(right, Y.encodeStateAsUpdate(left, leftBefore));
  assert.equal(scriptBlocksFromDocument(left)[0].text, 'Hello brave world!'); assert.equal(scriptBlocksFromDocument(right)[0].text, 'Hello brave world!');
});

test('a screenplay reconnect restores the durable CRDT snapshot', () => {
  const store = new Map(); const options = { load:(p,d) => store.get(`${p}:${d}`), save:(p,d,module,snapshot) => { store.set(`${p}:${d}`,{snapshot}); return {version:1}; }, initialBlocks:() => [{id:'blk_a',type:'action',text:'Start'}], materialize:() => {} };
  const first = new ScriptDocumentRegistry(options); const entry = first.open('project','script:project'); const vector = Y.encodeStateVector(entry.doc); entry.doc.getArray('blocks').get(0).get('text').insert(5,' again'); first.apply('project','script:project',Y.encodeStateAsUpdate(entry.doc,vector));
  const reconnected = new ScriptDocumentRegistry(options); assert.equal(scriptBlocksFromDocument(reconnected.open('project','script:project').doc)[0].text,'Start again');
});

for (const module of ['breakdown','shot_list','canvas']) test(`${module} collaboration merges separate fields and detects destructive same field conflicts`, () => {
  const first = applyVersionedPatch({id:'entity',version:1,label:'A',note:'Old'},{entityId:'entity',baseVersion:1,patch:{label:'B'},previous:{label:'A'}});
  const separate = applyVersionedPatch(first.entity,{entityId:'entity',baseVersion:1,patch:{note:'New'},previous:{note:'Old'}});
  assert.deepEqual(separate.conflicts,[]); assert.equal(separate.entity.note,'New');
  const destructive = applyVersionedPatch(separate.entity,{entityId:'entity',baseVersion:1,patch:{label:'C'},previous:{label:'A'}});
  assert.equal(destructive.conflicts[0].field,'label'); assert.equal(destructive.entity.label,'B');
});

test('every durable realtime operation enforces module permission and filters financial payloads', () => {
  const server = fs.readFileSync(new URL('../server.js', import.meta.url),'utf8');
  assert.match(server,/requireProjectPermission\(sid, projectId, body\.module, "edit"\)/); assert.match(server,/filterFinancialData\(payload, subscriber\.access\)/); assert.match(server,/canAccessModule\(subscriber\.access, module, "view"\)/);
});

test('Canvas broadcasts transient drag positions and persists only the final pointer result', () => {
  const canvas = fs.readFileSync(new URL('../canvas-workspace.js', import.meta.url),'utf8');
  assert.match(canvas,/type:'canvas\.drag'/); assert.match(canvas,/_commitCanvasPointer\(pointer\)/); assert.doesNotMatch(canvas,/_onPointerMove[\s\S]{0,250}queueBoardSave/);
});

test('an empty collaboration room expires after five minutes without deleting durable content', () => {
  let now = 0; const rooms = new CollaborationRooms({ now:() => now, expireMs:300_000 }); rooms.join('project',{clientId:'one',userId:'user'}); rooms.disconnect('project','one'); now=300_001;
  assert.deepEqual(rooms.sweep(),['project']); assert.deepEqual(rooms.presence('project'),[]);
  const migration = fs.readFileSync(new URL('../migrations/012_realtime_collaboration.sql', import.meta.url),'utf8'); assert.match(migration,/collaboration_documents/);
});
