// T2: authenticated web and Unix-socket authority against an in-process hub.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { get } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHubBase } from '../src/hub/server.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { WebSocket } from 'ws';
import { connectUi, frameClient, projectHub, tempProject } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import type { FrameClient } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { FakeClock } from './fake-clock.ts';

function withCodes(client: FrameClient) {
  return { ...client, request: (frame: { type: string } & Record<string, unknown>) => client.request(frame) as Promise<{ ok: boolean; value?: unknown; error?: string; code?: string }> };
}

async function clients(t: TestContext, greet = true) {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  const config = defaultConfig('Web authority fixture');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const local = await connectUi(t, hub.discovery);
  const link = await local.request({ type: 'web.link' });
  assert.equal(link.ok, true, link.error);
  const { url } = link.value as { url: string };
  const cookie = await new Promise<string>((resolve, reject) => {
    const req = get(url, { agent: false }, response => {
      response.resume();
      response.on('end', () => resolve(response.headers['set-cookie']![0]!.split(';')[0]!));
      response.on('error', reject);
    });
    req.setTimeout(2000, () => req.destroy(new Error('sign-in timed out')));
    req.on('error', reject);
  });
  const origin = new URL(url).origin;
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
  onCleanup(t, () => ws.terminate());
  const web = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data.toString()}\n`)), () => ws.terminate());
  await once(ws, 'open', { signal: AbortSignal.timeout(2000) });
  if (greet) {
    const welcome = web.waitFor(frame => frame.type === 'welcome');
    web.send({ type: 'hello', protocol: 2, client: 'pretend-session' });
    assert.equal((await welcome).name, 'human');
  }
  return { root, hub, local: withCodes(local), web: withCodes(web) };
}

test('web refuses hub.reload with CLI and Neovim guidance; the Unix socket still reloads', async t => {
  const { web, local } = await clients(t);
  const refused = await web.request({ type: 'hub.reload' });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'cli-neovim-only');
  assert.match(refused.error!, /CLI and Neovim/);
  const allowed = await local.request({ type: 'hub.reload' });
  assert.equal(allowed.ok, true, allowed.error);
});

// Local preconditions stay intact: these cases prove entry to the existing
// handler, without publishing, invoking Git or acquiring provider resources.
const refusedCases: Array<{ frame: { type: string } & Record<string, unknown>; localError?: RegExp }> = [
  { frame: { type: 'release', item: 'R-999', dryRun: true }, localError: /^no item T-999$/ },
  { frame: { type: 'publish', branch: 'marketing', item: 'T-999', dryRun: true }, localError: /^no item T-999$/ },
  { frame: { type: 'config.set', key: 'plan.approval', value: 'human' } },
  { frame: { type: 'crew.set', key: 'reviewer.keep_context', value: true } },
  { frame: { type: 'executor.prepare' }, localError: /DIGITALOCEAN_TOKEN is required/ },
  { frame: { type: 'executor.reap' }, localError: /DIGITALOCEAN_TOKEN is required/ },
  { frame: { type: 'executor.retire-legacy', confirmRegisteredHubs: false }, localError: /legacy retirement requires the default user ledger/ },
  { frame: { type: 'task.migrate', dryRun: true }, localError: /the hub is running; stop the hub and run cland task migrate/ },
  { frame: { type: 'web.link' } },
  { frame: { type: 'artifact.delete', artifact: 'A-999' }, localError: /^no artifact file is available$/ },
  { frame: { type: 'task.import', repo: 'example/project', issues: [] } },
  { frame: { type: 'session.signal', session: 'absent', event: 'idle' } },
  { frame: { type: 'worktree.prune', dryRun: true } },
  { frame: { type: 'suite.forced', mode: 'full', cwd: '/fixture', head: 'abc', pid: 1, token: 'fixture' } },
  ...['start', 'exec', 'stop', 'status'].map(action => ({ frame: { type: `demo.${action}`, epic: 'E-999', command: ['true'] }, localError: /^no item T-999$/ })),
];

for (const { frame, localError } of refusedCases) {
  test(`web refuses ${frame.type}; Unix retains its normal handler`, async t => {
    const { root, web, local } = await clients(t);
    const input = frame.type === 'suite.forced' ? { ...frame, cwd: root, pid: process.pid } : frame;
    const refused = await web.request(input);
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'cli-neovim-only');
    assert.match(refused.error!, /CLI and Neovim/);
    const result = await local.request(input);
    if (localError) {
      assert.equal(result.ok, false);
      assert.match(result.error!, localError);
    } else assert.equal(result.ok, true, result.error);
  });
}

test('web refuses artifact.create paths without reading them; Unix creates from the path', async t => {
  const { root, web, local } = await clients(t);
  const path = join(root, 'source.md');
  await writeFile(path, 'local artifact bytes');
  const frame = { type: 'artifact.create', kind: 'note', title: 'Local source', topic: 'general', path };
  const refused = await web.request(frame);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'cli-neovim-only');
  assert.match(refused.error!, /CLI and Neovim/);
  const result = await local.request(frame);
  assert.equal(result.ok, true, result.error);
  const created = result.value as { artifact: { path: string } };
  assert.equal(await readFile(created.artifact.path, 'utf8'), 'local artifact bytes');
});

for (const type of ['push', 'sync']) {
  test(`web refuses ${type}; Unix retains its tracker precondition without running Git`, async t => {
    const { root, web } = await clients(t);
    const refused = await web.request({ type });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'cli-neovim-only');
    assert.match(refused.error!, /CLI and Neovim/);
    // A socket on a projectless hub proves admission without a Git subprocess.
    const base = createHubBase({ secret: 'fixture', clock: new FakeClock() });
    const socket = join(root, 'projectless.sock');
    const edge = await createSocketEdge({ path: socket, dispatcher: base.dispatcher });
    onCleanup(t, async () => { await edge.close(); await base.close(); });
    const local = withCodes(await connectUi(t, { socket, secret: 'fixture' }));
    const result = await local.request({ type });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'release-state');
    assert.equal(result.error, 'release-state: this hub has no tracker');
  });
}

test('web cannot stop the hub; Unix can stop the in-process hub', async t => {
  const { wait, fixtures } = caseDeadlines(t, { timeoutMs: 2000 });
  const { web, local, hub } = await clients(fixtures);
  const refused = await web.request({ type: 'hub.stop' });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'cli-neovim-only');
  assert.match(refused.error!, /CLI and Neovim/);
  assert.equal((await web.request({ type: 'hub.status' })).ok, true);
  const stopped = wait('in-process hub shutdown', () => hub.stopped);
  assert.equal((await local.request({ type: 'hub.stop' })).ok, true);
  await stopped;
});

for (const as of [null, false, '', {}, { name: 'human' }, { name: 'pretend-session', sessionId: 'unknown', shell: true }]) {
  test(`web refuses an own as field (${JSON.stringify(as)}) before replay and attribution`, async t => {
    const { web } = await clients(t);
    assert.equal((await web.request({ type: 'hub.status' })).ok, true);
    const refused = await web.request({ type: 'hub.status', as });
    assert.equal(refused.ok, false);
    assert.equal(refused.code, 'cli-neovim-only');
    assert.match(refused.error!, /CLI and Neovim/);
  });
}

test('web topic messages and inline artifacts are recorded as the human', async t => {
  const { web, local } = await clients(t);
  const sent = await web.request({ type: 'topic.send', topic: 'general', text: 'from the browser' });
  assert.equal(sent.ok, true, sent.error);
  const message = (sent.value as { message: { id: string; from: string; fromKind: string } }).message;
  assert.equal(message.from, 'human');
  assert.equal(message.fromKind, 'human');
  const history = await local.request({ type: 'topic.history', topic: 'general' });
  assert.equal(history.ok, true, history.error);
  assert.ok((history.value as { messages: Array<{ id: string; from: string; fromKind: string }> }).messages.some(row => row.id === message.id && row.from === 'human' && row.fromKind === 'human'));
  const result = await web.request({ type: 'artifact.create', kind: 'note', title: 'Web note', topic: 'general', content: 'browser bytes' });
  assert.equal(result.ok, true, result.error);
  const artifact = (result.value as { artifact: { id: string; path: string; creator: string; creatorKind: string } }).artifact;
  assert.equal(artifact.creator, 'human');
  assert.equal(artifact.creatorKind, 'human');
  const listed = await local.request({ type: 'artifact.list', artifact: artifact.id });
  assert.equal(listed.ok, true, listed.error);
  assert.equal(await readFile(artifact.path, 'utf8'), 'browser bytes');
  const stored = (listed.value as { artifact: { id: string; creator: string; creatorKind: string } }).artifact;
  assert.equal(stored.id, artifact.id);
  assert.equal(stored.creator, 'human');
  assert.equal(stored.creatorKind, 'human');
});

test('web refuses unknown and prototype frame names by default', async t => {
  const { web } = await clients(t);
  for (const type of ['future.frame', 'toString', '__proto__', 'constructor']) {
    const result = await web.request({ type });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'cli-neovim-only');
  }
});


test('web refuses as on the initial hello and still requires a valid human hello', async t => {
  const { web } = await clients(t, false);
  const refused = web.waitFor(frame => frame.type === 'result');
  web.send({ type: 'hello', protocol: 2, client: 'web', as: { name: 'pretend-session' } });
  const result = await refused;
  assert.equal(result.ok, false);
  assert.equal(result.code, 'cli-neovim-only');
  assert.match(String(result.error), /CLI and Neovim/);
  const welcome = web.waitFor(frame => frame.type === 'welcome');
  web.send({ type: 'hello', protocol: 2, client: 'web' });
  assert.equal((await welcome).name, 'human');
});

test('the authenticated web human can withdraw a queued message and receives its text', async t => {
  const { web, local } = await clients(t);
  const sent = await web.request({ type: 'topic.send', topic: 'general', text: 'restore web composer', kind: 'decision' });
  assert.equal(sent.ok, true, sent.error);
  const message = (sent.value as { message: { id: string; kind: string } }).message;
  assert.equal(message.kind, 'decision');
  const withdrawn = await web.request({ type: 'topic.withdraw', topic: 'general', message: message.id });
  assert.equal(withdrawn.ok, true, withdrawn.error);
  assert.equal((withdrawn.value as { text: string }).text, 'restore web composer');
  const history = await local.request({ type: 'topic.history', topic: 'general' });
  assert.equal((history.value as { messages: Array<{ id: string; stage: string }> }).messages.find(m => m.id === message.id)?.stage, 'withdrawn');
});
