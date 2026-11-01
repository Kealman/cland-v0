// T2: artifact attribution through authenticated human frames and durable journal receipts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { testMessenger } from './fakes/messenger.ts';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { frameClient, cland, connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import type { Artifact } from '../src/protocol.ts';

test('users-mode human creation and upload retain creator identity in index, audit and journal; agents stay sessions', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Artifacts');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const records: Record<string, unknown>[] = [];
  const remote = testMessenger();
  const hub = await projectHub(t, root, {}, { git: async args => args.includes('user.name') ? 'Jane Doe\n' : '', log: row => records.push(row), gatewayRemotes: [remote] });
  const ui = await connectUi(t, hub.discovery);
  const switched = await cland(root, 'auth', 'mode', 'users');
  assert.equal(switched.code, 0, switched.stderr);
  const users = (await ui.request({ type: 'user.list' })).value as { users: { id: string }[] };
  const userId = users.users[0]!.id;
  for (const type of ['artifact.create', 'artifact.upload'] as const) {
    const result = await ui.request(type === 'artifact.create'
      ? { type, kind: 'note', title: 'Human note', content: 'hello', topic: 'general', creatorUserId: 'forged' }
      : { type, topic: 'general', files: [{ name: 'hello.txt', mime: 'text/plain', data: 'aGVsbG8=' }], creatorUserId: 'forged' });
    assert.equal(result.ok, true, result.error);
    const value = result.value as { artifact: Artifact; artifacts: Artifact[] };
    const artifact = type === 'artifact.create' ? value.artifact : value.artifacts[0]!;
    assert.equal(artifact.creator, 'jane-doe');
    assert.equal((artifact as Artifact & { creatorUserId?: string }).creatorUserId, userId);
    const stored = (await ui.request({ type: 'artifact.list', artifact: artifact.id })).value as { artifact: Artifact };
    assert.deepEqual(stored.artifact, artifact);
    assert.ok(records.some(row => row.event === 'audit' && row.tool === type && row.userId === userId));
    assert.ok(records.some(row => row.event === 'event-announced' && row.kind === 'artifact' && row.artifact === artifact.id && row.userId === userId));
  }
  const cli = await cland(root, 'artifact', 'create', '--kind', 'note', '--title', 'CLI', '--content', 'cli', '--topic', 'general', '--json');
  assert.equal(cli.code, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).artifact.creatorUserId, userId);
  const remoteResult = await remote.client.request({ type: 'artifact.upload', topic: 'general', files: [{ name: 'remote.txt', mime: 'text/plain', data: 'YQ==' }] });
  assert.equal(remoteResult.ok, true, String(remoteResult.error));
  const remoteArtifact = (remoteResult.value as { artifacts: (Artifact & { creatorUserId?: string })[] }).artifacts[0]!;
  assert.equal(remoteArtifact.creator, 'jane-doe');
  assert.equal(remoteArtifact.creatorUserId, userId);
  const coord = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const agent = await coord.call<{ artifact: Artifact & { creatorUserId?: string } }>('artifact.create', { kind: 'note', title: 'Agent', content: 'agent', topic: 'general' });
  assert.equal(agent.artifact.creator, 'coord');
  assert.equal(Object.hasOwn(agent.artifact, 'creatorUserId'), false);
});

test('single-mode human artifacts preserve the previous wire shape without a creator user id', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const ui = await connectUi(t, hub.discovery);
  for (const request of [
    { type: 'artifact.create', kind: 'note', title: 'Single', content: 'single', topic: 'general' },
    { type: 'artifact.upload', topic: 'general', files: [{ name: 'single.txt', mime: 'text/plain', data: 'YQ==' }] },
  ]) {
    const result = await ui.request(request);
    assert.equal(result.ok, true, result.error);
    const value = result.value as { artifact?: Artifact; artifacts?: Artifact[] };
    const artifact = value.artifact ?? value.artifacts![0]!;
    assert.equal(artifact.creator, 'human');
    assert.equal(Object.hasOwn(artifact, 'creatorUserId'), false);
  }
});


for (const layer of ['watch', 'now'] as const) test(`cookie-authenticated artifacts use the second user and human ${layer} placement, ignoring forged creator fields`, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Web artifacts');
  if (layer === 'now') config.visibility = { artifacts: { human: 'now' } };
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const records: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { git: async args => args.includes('user.name') ? 'Jane Doe\n' : '', log: row => records.push(row) });
  const ui = await connectUi(t, hub.discovery);
  const switched = await cland(root, 'auth', 'mode', 'users');
  assert.equal(switched.code, 0, switched.stderr);
  const link = (await ui.request({ type: 'web.link' })).value as { url: string };
  const response = await fetch(link.url, { redirect: 'manual' });
  assert.equal(response.status, 302);
  const db = new DatabaseSync(join(root, '.cland/hub.db'));
  try {
    db.prepare('insert into users values (?,?,?,?,?,?)').run('second-user', 'alex', 'Alex Smith', 'admin', 'active', Date.now());
    db.prepare('insert into web_sessions (id,cookie_hash,created_at,last_used_at,user_id) values (?,?,?,?,?)')
      .run('second-session', createHash('sha256').update('second-cookie').digest('hex'), Date.now(), Date.now(), 'second-user');
  } finally { db.close(); }
  const origin = new URL(link.url).origin;
  const cookieName = response.headers.get('set-cookie')!.split('=')[0]!;
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: `${cookieName}=second-cookie` } });
  t.after(() => ws.terminate());
  const client = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data}\n`)), () => ws.terminate());
  await once(ws, 'open', { signal: AbortSignal.timeout(3000) });
  const welcome = client.waitFor(f => f.type === 'welcome');
  client.send({ type: 'hello', protocol: 2, client: 'web' });
  await welcome;
  assert.equal((await client.request({ type: 'subscribe' })).ok, true);
  for (const request of [
    { type: 'artifact.create', kind: 'prompt', status: 'draft', title: 'Web draft', content: 'hello', topic: 'general', creator: 'jane-doe', creatorUserId: 'forged' },
    { type: 'artifact.upload', topic: 'general', files: [{ name: 'web.txt', mime: 'text/plain', data: 'YQ==' }], creatorUserId: 'forged' },
  ]) {
    const event = client.waitFor(f => f.type === 'artifact' && (f.artifact as Artifact).title === (request.type === 'artifact.create' ? 'Web draft' : 'web.txt'));
    const result = await client.request(request);
    assert.equal(result.ok, true, String(result.error));
    const value = result.value as { artifact?: Artifact; artifacts?: Artifact[] };
    const artifact = (value.artifact ?? value.artifacts![0]!) as Artifact & { creatorUserId?: string };
    assert.equal(artifact.layer, layer, 'creation reply uses human placement');
    assert.equal(((await event).artifact as Artifact).layer, layer, 'live artifact uses human placement');
    const listed = (await client.request({ type: 'artifact.list', topic: 'general' })).value as { artifacts: Artifact[] };
    assert.equal(listed.artifacts.find(a => a.id === artifact.id)?.layer, layer, 'list uses human placement');
    assert.equal(artifact.creator, 'alex');
    assert.equal(artifact.creatorUserId, 'second-user');
    assert.ok(records.some(row => row.event === 'audit' && row.tool === request.type && row.userId === 'second-user'));
    assert.ok(records.some(row => row.event === 'event-announced' && row.kind === 'artifact' && row.artifact === artifact.id && row.userId === 'second-user'));
    if (request.type === 'artifact.create') {
      const sent = await client.request({ type: 'prompt.send', artifact: artifact.id });
      assert.equal(sent.ok, true, String(sent.error));
    }
  }
});
