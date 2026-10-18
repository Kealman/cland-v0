// T2: same-title hub rules through real socket/MCP edges and in-process peers; native flow in scenarios/message-tracer and crew-launch.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { isClientRequest, isSpokeRequest, type Artifact, type TopicMessage } from '../src/protocol.ts';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';

test('only the human can delete artifact bytes; the index and topic chip retain the deletion', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({type:'subscribe'});
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const a = (await coord.call<{artifact: Artifact}>('artifact.create', {kind:'note', title:'Delete me', topic:'general', content:'original'})).artifact;
  await ui.request({type:'topic.send', topic:'general', text:'Attached notes', artifacts:[a.id]});
  const refused = await ui.request({type:'artifact.delete', artifact:a.id, as:{name:'coord'}});
  assert.equal(refused.ok, false);
  assert.match(refused.error!, /only the human/);
  const spokeRefused = await coord.call<{ok:boolean}>('artifact.delete', {artifact:a.id});
  assert.equal(spokeRefused.ok, false);
  assert.equal(await readFile(a.path, 'utf8'), 'original');
  const deleted = await ui.request({type:'artifact.delete', artifact:a.id});
  assert.equal(deleted.ok, true, JSON.stringify(deleted));
  await assert.rejects(readFile(a.path), {code:'ENOENT'});
  const event = await ui.waitFor(f => f.type === 'artifact' && (f.artifact as Artifact).id === a.id && (f.artifact as Artifact).fileDeleted === true);
  assert.equal((event.artifact as Artifact).fileDeleted, true);
  const list = (await ui.request({type:'artifact.list'})).value as {artifacts:Artifact[]};
  assert.equal(list.artifacts.find(x => x.id === a.id)?.fileDeleted, true);
  const history = (await ui.request({type:'topic.history',topic:'general'})).value as {messages:TopicMessage[]};
  assert.equal(history.messages.find(m => m.artifact?.id === a.id)?.artifact?.fileDeleted, true);
  assert.equal(history.messages.find(m => m.text === 'Attached notes')?.artifacts?.[0]?.fileDeleted, true);
});

test('deleting an absorbed id removes only its moved file and preserves its deleted chip after restart', async t => {
  let stopHub = async () => {};
  const serve = async (...args: Parameters<typeof projectHub>) => {
    const hub = await projectHub(...args);
    stopHub = hub.stop;
    return hub;
  };
  const root = await tempProject(t);
  const { discovery } = await serve(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({type:'subscribe'});
  const make = async (title: string, folder = false) => ((await ui.request({type:'artifact.create', kind:'note', title, topic:'general', content:title, folder})).value as {artifact:Artifact}).artifact;
  const folder = await make('Folder', true), source = await make('Moved');
  assert.equal((await ui.request({type:'artifact.move', artifact:source.id, folder:folder.id, name:'moved.md'})).ok, true);
  const moved = ((await ui.request({type:'artifact.list', artifact:source.id})).value as {artifact:Artifact}).artifact;
  assert.equal((await ui.request({type:'artifact.delete',artifact:source.id})).ok, true);
  await assert.rejects(readFile(moved.path), {code:'ENOENT'});
  assert.equal(await readFile(folder.path + '/' + folder.entry, 'utf8'), 'Folder');
  const history = (await ui.request({type:'topic.history',topic:'general'})).value as {messages:TopicMessage[]};
  assert.equal(history.messages.find(m => m.artifact?.id === source.id)?.artifact?.fileDeleted, true);
  const listing = (await ui.request({type:'artifact.list',artifact:folder.id})).value as {files:string[]};
  assert.deepEqual(listing.files, [folder.entry]);
  await ui.waitFor(f => f.type === 'artifact' && (f.artifact as Artifact).id === folder.id);
  assert.equal((await ui.request({type:'artifact.delete',artifact:source.id})).ok, false);
  await stopHub();
  const restarted = await serve(t, root);
  const reconnected = await connectUi(t, restarted.discovery);
  const replayed = (await reconnected.request({type:'topic.history',topic:'general'})).value as {messages:TopicMessage[]};
  assert.equal(replayed.messages.find(m => m.artifact?.id === source.id)?.artifact?.fileDeleted, true);
});

test('deleting a folder notifies old-topic moved chips and leaves promoted project files alone', async t => {
  const root = await tempProject(t);
  const { discovery } = await projectHub(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({type:'subscribe'});
  const topic = ((await ui.request({type:'topic.create',title:'Folder topic'})).value as {topic:{id:string}}).topic.id;
  const source = ((await ui.request({type:'artifact.create',kind:'note',title:'Old topic chip',topic:'general',content:'moved content'})).value as {artifact:Artifact}).artifact;
  const folder = ((await ui.request({type:'artifact.create',kind:'note',title:'Folder',topic,folder:true,content:'entry content'})).value as {artifact:Artifact}).artifact;
  assert.equal((await ui.request({type:'artifact.move',artifact:source.id,folder:folder.id,name:'moved.md'})).ok, true);
  assert.equal((await ui.request({type:'artifact.promote',artifact:folder.id,path:'docs/published'})).ok, true);
  assert.equal((await ui.request({type:'artifact.delete',artifact:folder.id})).ok, true);
  await assert.rejects(readFile(folder.path + '/' + folder.entry), {code:'ENOENT'});
  assert.equal(await readFile(root + '/docs/published/moved.md', 'utf8'), 'moved content');
  const changed = await ui.waitFor(f => f.type === 'artifact' && (f.artifact as Artifact).id === source.id && (f.artifact as Artifact).fileDeleted === true);
  assert.equal((changed.artifact as Artifact).topic, 'general');
  const history = (await ui.request({type:'topic.history',topic:'general'})).value as {messages:TopicMessage[]};
  assert.equal(history.messages.find(m => m.artifact?.id === source.id)?.artifact?.fileDeleted, true);
});

test('the delete frame is UI-only and its validation preserves create and list requests', (t) => {
  assert.equal(isClientRequest({type:'artifact.delete',id:'delete',artifact:'A-1'}), true);
  assert.equal(isSpokeRequest({type:'artifact.delete',id:'delete',artifact:'A-1'}), false);
  assert.equal(isClientRequest({type:'artifact.delete',id:'delete'}), false);
  assert.equal(isClientRequest({type:'artifact.delete',id:'delete',artifact:'../outside'}), false);
  assert.equal(isClientRequest({type:'artifact.create',id:'create',kind:'note',title:'New',topic:'general',content:'New'}), true);
  assert.equal(isClientRequest({type:'artifact.list',id:'list'}), true);
});
