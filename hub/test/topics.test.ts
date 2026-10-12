// Topics and the UI's frames (spec 4.2, 4.5): a real daemon in a temporary project, a scripted UI client
// on its Unix socket or on a child hub's stdio, and spokes — raw frames on the socket where the frame
// itself is asserted, the real spoke over MCP where the session's view is.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { PROTOCOL_VERSION } from '../src/protocol.ts';
import { CLI_ENTRY, cland, connectSocket, connectUi, frameClient, isolateVerification, killDaemon, readDiscovery, sleep, spawnSpoke, startDaemon, tempProject, type FrameClient } from './harness.ts';

type Topic = { id: string; title: string; status: string; standing: boolean; createdAt: string; updatedAt: string };
type TopicMessage = { id: string; topic: string; from: string; fromKind: string; fromRole?: string; to: string[]; text: string; ts: string; stage?: string };

const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;

async function topics(ui: FrameClient): Promise<Topic[]> {
  const r = await ui.request({ type: 'topic.list' });
  assert.equal(r.ok, true, r.error);
  return (r.value as { topics: Topic[] }).topics;
}

async function history(ui: FrameClient, topic: string): Promise<TopicMessage[]> {
  const r = await ui.request({ type: 'topic.history', topic, limit: 20 });
  assert.equal(r.ok, true, r.error);
  return (r.value as { messages: TopicMessage[] }).messages;
}

test('General and Agents exist after the first start, survive a restart once each, and cannot be renamed or deleted', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  const first = await topics(ui);
  assert.deepEqual(
    first.map((x) => [x.id, x.title, x.status, x.standing]),
    [
      ['general', 'General', 'open', true],
      ['agents', 'Agents', 'open', true],
    ],
  );
  for (const x of first) assert.match(x.createdAt, ISO);

  const rename = await ui.request({ type: 'topic.rename', topic: 'general', title: 'Chat' });
  assert.equal(rename.ok, false);
  assert.equal(rename.error, 'General is a standing topic: it cannot be renamed');
  const del = await ui.request({ type: 'topic.delete', topic: 'agents' });
  assert.equal(del.ok, false);
  assert.equal(del.error, 'Agents is a standing topic: it cannot be deleted');
  const unknown = await ui.request({ type: 'topic.delete', topic: 'nope' });
  assert.equal(unknown.error, 'no topic "nope"');
  assert.deepEqual(await topics(ui), first, 'nothing changed');

  ui.close();
  assert.equal((await cland(root, 'hub', 'stop')).code, 0);
  const again = await startDaemon(t, root);
  const ui2 = await connectUi(t, again.discovery);
  assert.deepEqual(await topics(ui2), first, 'a restart creates nothing twice and keeps the creation times');
});

test('a message from the UI is queued while no session holds the coordinator role, reaches the coordinator as a deliver with the topic, and turns delivered on the ack', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  assert.deepEqual((await ui.request({ type: 'subscribe' })).value, { subscribed: true });

  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'hello' });
  assert.equal(sent.ok, true, sent.error);
  const { message } = sent.value as { message: TopicMessage };
  assert.equal(message.stage, 'queued');
  const event = (await ui.waitFor((f) => f.type === 'message')) as { topic: { id: string; title: string }; message: TopicMessage };
  assert.deepEqual(event.topic, { id: 'general', title: 'General' });
  assert.equal(event.message.id, message.id);
  assert.equal(event.message.from, 'human');
  assert.equal(event.message.fromKind, 'human');
  assert.equal(event.message.text, 'hello');
  assert.equal(event.message.stage, 'queued');
  assert.match(event.message.ts, ISO);

  // a session with no role stays off the hub (spec 4.4), let alone takes the coordinator's queue; asking for the
  // role is not enough either: only a session the hub launched for it gets it that way
  const bystander = await connectSocket(discovery.socket);
  t.after(() => bystander.close());
  bystander.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, sessionId: 'sess-by', cwd: root, name: 'bystander', role: 'coordinator' });
  const refused = await bystander.next();
  assert.equal(refused.code, 'no-role');
  assert.match(String(refused.message), /cland role set bystander/);
  assert.equal((await history(ui, 'general'))[0]?.stage, 'queued');

  // the human assigns the role; the session's first frame after the welcome is its clause
  assert.equal((await ui.request({ type: 'role.set', session: 'coord', role: 'coordinator' })).ok, true);
  const coord = await connectSocket(discovery.socket);
  t.after(() => coord.close());
  coord.send({ type: 'hello', protocol: PROTOCOL_VERSION, secret: discovery.secret, sessionId: 'sess-coord', cwd: root, name: 'coord' });
  assert.equal((await coord.next()).type, 'welcome');
  const clause = await coord.next();
  assert.equal(clause.type, 'role');
  assert.equal(clause.role, 'coordinator');
  coord.send({ type: 'ack', id: clause.id });
  const deliver = (await coord.next()) as { type: string; id: string; topic: { id: string; title: string }; message: TopicMessage };
  assert.equal(deliver.type, 'deliver');
  assert.equal(deliver.id, message.id);
  assert.deepEqual(deliver.topic, { id: 'general', title: 'General' });
  assert.equal(deliver.message.text, 'hello');
  assert.equal(deliver.message.fromKind, 'human');
  assert.equal(deliver.message.topic, 'general');
  // delivered means accepted: not before the ack
  await sleep(100);
  assert.equal(ui.frames.some((f) => f.type === 'delivery'), false);
  assert.equal((await history(ui, 'general'))[0]?.stage, 'queued');

  coord.send({ type: 'ack', id: deliver.id });
  const stage = await ui.waitFor((f) => f.type === 'delivery');
  assert.deepEqual(stage, { type: 'delivery', topic: 'general', message: message.id, stage: 'delivered' });
  assert.equal((await history(ui, 'general'))[0]?.stage, 'delivered');
});

test('a coordinator already connected gets the message at once, with the topic in its channel event', async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'are you there?' });
  const { message } = sent.value as { message: TopicMessage };
  const event = await coord.waitForEvent((e) => e.params.content === 'are you there?');
  assert.equal(event.params.meta?.topic, 'general');
  assert.equal(event.params.meta?.topic_title, 'General');
  assert.equal(event.params.meta?.from_kind, 'human');
  assert.deepEqual(await ui.waitFor((f) => f.type === 'delivery'), { type: 'delivery', topic: 'general', message: message.id, stage: 'delivered' });
});

test("a spoke's send appears to the subscribed UI as a message event with sender name, kind and time; General is the default topic", async (t) => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const ui = await connectUi(t, discovery);
  await ui.request({ type: 'subscribe' });
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);

  const reply = await coord.call<{ ok: boolean; topic: { id: string; title: string } }>('send', { text: 'hello, human' });
  assert.equal(reply.ok, true, JSON.stringify(reply));
  assert.deepEqual(reply.topic, { id: 'general', title: 'General' });
  // (the role assignment before it is a notice in Agents, #34)
  const event = (await ui.waitFor((f) => f.type === 'message' && (f.message as TopicMessage).from === 'coord')) as { topic: { id: string }; message: TopicMessage };
  assert.equal(event.topic.id, 'general');
  assert.equal(event.message.from, 'coord');
  assert.equal(event.message.fromKind, 'agent');
  assert.equal(event.message.fromRole, 'coordinator');
  assert.equal(event.message.text, 'hello, human');
  assert.match(event.message.ts, ISO);
  assert.deepEqual((await history(ui, 'general')).map((m) => [m.from, m.text]), [['coord', 'hello, human']]);

  const elsewhere = await coord.call<{ ok: boolean; error?: string }>('send', { text: 'x', topic: 'nope' });
  assert.equal(elsewhere.ok, false);
  assert.equal(elsewhere.error, 'no topic "nope"');
  assert.deepEqual((await history(ui, 'agents')).filter((m) => m.from !== 'hub'), [], 'nothing but the hub notices in Agents');
});

test('the same frames over stdio: a UI spawning `cland hub serve --stdio` as its child', async (t) => {
  const root = await tempProject(t);
  await isolateVerification(root);
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined && !k.startsWith('CLAND_')) env[k] = v;
  const child = spawn(process.execPath, [CLI_ENTRY, 'hub', 'serve', '--stdio'], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (c: string) => (stderr += c));
  const exited = new Promise<number | null>((resolve) => child.once('exit', (code) => resolve(code)));
  t.after(() => killDaemon(child.pid as number));
  child.stdout.setEncoding('utf8');
  const ui = frameClient(
    (line) => child.stdin.write(line),
    (fn) => child.stdout.on('data', fn),
    () => child.stdin.end(),
  );
  // the parent spawned the hub: no secret on this edge
  ui.send({ type: 'hello', protocol: PROTOCOL_VERSION, client: 'ui' });
  const welcome = await ui.waitFor((f) => f.type === 'welcome' || f.type === 'error', 15_000).catch((err: Error) => {
    throw new Error(`${err.message}\nstderr:\n${stderr}`);
  });
  assert.equal(welcome.type, 'welcome', JSON.stringify(welcome));
  assert.deepEqual((await topics(ui)).map((x) => x.id), ['general', 'agents']);
  await ui.request({ type: 'subscribe' });
  const sent = await ui.request({ type: 'topic.send', topic: 'general', text: 'over stdio' });
  const { message } = sent.value as { message: TopicMessage };
  assert.equal(message.stage, 'queued');

  // the child is the project's hub: a session finds it through hub.json
  assert.equal((await readDiscovery(root)).pid, child.pid);
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator', sessionId: 'sess-coord' });
  t.after(() => coord.close());
  await coord.waitForEvent((e) => e.params.content === 'over stdio', 15_000);
  assert.deepEqual(await ui.waitFor((f) => f.type === 'delivery'), { type: 'delivery', topic: 'general', message: message.id, stage: 'delivered' });
  await coord.call('send', { text: 'heard you' });
  const event = (await ui.waitFor((f) => f.type === 'message' && (f.message as TopicMessage).from === 'coord')) as { message: TopicMessage };
  assert.equal(event.message.text, 'heard you');

  // the parent closing stdin ends the hub
  child.stdin.end();
  assert.equal(await exited, 0, stderr);
});
