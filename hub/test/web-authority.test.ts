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
import { connectUi, frameClient, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import type { FrameClient } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { FakeClock } from './fake-clock.ts';
import { testMessenger } from './fakes/messenger.ts';

function withCodes(client: FrameClient) {
  return { ...client, request: (frame: { type: string } & Record<string, unknown>) => client.request(frame) as Promise<{ ok: boolean; value?: unknown; error?: string; code?: string }> };
}

async function clients(t: TestContext, greet = true, largeTraffic = false) {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  const config = defaultConfig('Web authority fixture');
  config.verification.lockPath = join(root, 'suite.lock');
  if (largeTraffic) { config.hygiene.loopBreaker.max = 100; config.hygiene.rateLimit.max = 100; }
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const clock = new FakeClock();
  const hub = await projectHub(t, root, {}, { clock });
  const local = await connectUi(t, hub.discovery);
  const browser = await signIn(t, local, greet);
  return { root, hub, clock, local: withCodes(local), ...browser, newBrowser: () => signIn(t, local) };
}

async function signIn(t: TestContext, local: FrameClient, greet = true) {
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
  return { ...await browserSocket(t, origin, cookie, greet), cookie, origin };
}

async function browserSocket(t: TestContext, origin: string, cookie: string, greet = true) {
  const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin, headers: { Cookie: cookie } });
  onCleanup(t, () => ws.terminate());
  const web = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data.toString()}\n`)), () => ws.terminate());
  await once(ws, 'open', { signal: AbortSignal.timeout(2000) });
  if (greet) {
    const welcome = web.waitFor(frame => frame.type === 'welcome');
    web.send({ type: 'hello', protocol: 2, client: 'pretend-session' });
    assert.equal((await welcome).name, 'human');
  }
  return { web: withCodes(web) };
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

test('the signed-in web edge cannot approve a live pairing even with a Neovim hello', async t => {
  const root = await tempProject(t);
  const remote = testMessenger('telegram');
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [remote], clock: new FakeClock() });
  const nvim = await connectUi(t, hub.discovery, 'nvim');
  const { origin, cookie } = await signIn(t, nvim);
  const { web } = await browserSocket(t, origin, cookie, false);
  const welcome = web.waitFor(frame => frame.type === 'welcome');
  web.send({ type: 'hello', protocol: 2, client: 'nvim' });
  assert.equal((await welcome).name, 'human');
  remote.pair({ userId: '12345', chatId: '12345', guildId: null, name: 'Fixture human' });
  const before = await web.request({ type: 'inbox.list' });
  const row = (before.value as import('../src/protocol.ts').Inbox).pairings![0]!;
  const frame = { type: 'pairing.approve', messenger: row.messenger, code: row.code };
  const denied = await web.request(frame);
  assert.equal(denied.ok, false);
  assert.equal(denied.code, 'cli-neovim-only');
  assert.match(denied.error!, /grants new remote access/);
  const after = await web.request({ type: 'inbox.list' });
  assert.deepEqual((after.value as import('../src/protocol.ts').Inbox).pairings, [row]);
  assert.equal((await nvim.request(frame)).ok, true, 'the refused web request did not consume the code');
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
  { frame: { type: 'remote.status' }, localError: /human CLI or Neovim/ },
  { frame: { type: 'remote.unpair', messenger: 'telegram' }, localError: /human CLI or Neovim/ },
  { frame: { type: 'remote.test', messenger: 'telegram' }, localError: /human CLI or Neovim/ },
  { frame: { type: 'pairing.approve', messenger: 'telegram', code: 'ABCDEFGH' }, localError: /human CLI or Neovim/ },
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


test('human clients page a session’s sent and received traffic across topics without changing its own history', async t => {
  const { root, web, local } = await clients(t, true, true);
  const worker = await inProcessSpoke(t, { cwd: root, discover: true, name: 'worker', role: 'implementer', sessionId: 'worker' });
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  await worker.waitForPresence(['worker', 'coord']);
  const created = await local.request({ type: 'topic.create', title: 'Another topic' });
  assert.equal(created.ok, true, created.error);
  const topic = (created.value as { topic: { id: string } }).topic.id;
  const texts: string[] = [];
  for (let i = 0; i < 55; i++) {
    const sent = i % 2 === 0
      ? await worker.call<{ ok: boolean }>('send', { to: 'coord', text: `sent ${i}`, topic })
      : await coord.call<{ ok: boolean }>('send', { to: 'worker', text: `received ${i}` });
    assert.equal(sent.ok, true);
    texts.push(i % 2 === 0 ? `sent ${i}` : `received ${i}`);
  }
  assert.equal((await local.request({ type: 'topic.send', topic: 'general', to: ['coord'], text: 'unrelated' })).ok, true);
  type Page = { messages: Array<{ id: string; text: string; seq: number; topic: string; kind?: string }>; more: boolean; before?: number };
  const latest = await web.request({ type: 'session.history', session: 'worker', limit: 2 });
  assert.equal(latest.ok, true, latest.error);
  const page = latest.value as Page;
  assert.deepEqual(page.messages.map(m => m.text), texts.slice(-2));
  assert.equal(page.more, true);
  assert.equal(page.before, page.messages[0]!.seq);
  assert.ok(page.messages[0]!.seq < page.messages[1]!.seq);
  const previous = await local.request({ type: 'session.history', session: 'worker', before: page.before, limit: 2 });
  assert.equal(previous.ok, true, previous.error);
  assert.deepEqual((previous.value as Page).messages.map(m => m.text), texts.slice(-4, -2));
  const bounded = await web.request({ type: 'session.history', session: 'worker', limit: 1000 });
  assert.equal(bounded.ok, true, bounded.error);
  assert.deepEqual((bounded.value as Page).messages.map(m => m.text), texts.slice(-50));
  assert.deepEqual(new Set((bounded.value as Page).messages.map(m => m.topic)), new Set([topic, 'agents']));
  const own = await worker.call<{ ok: boolean; messages: Array<{ text: string }> }>('history', { limit: 1000 });
  assert.equal(own.ok, true);
  assert.deepEqual(own.messages.map(m => m.text), texts.slice(-50));
  const oldest = await web.request({ type: 'session.history', session: 'worker', before: (bounded.value as Page).messages[0]!.seq });
  assert.equal(oldest.ok, true, oldest.error);
  assert.deepEqual((oldest.value as Page).messages.filter(m => m.kind !== 'role').map(m => m.text), texts.slice(0, 5));
  assert.equal((oldest.value as Page).more, false);
  const empty = await web.request({ type: 'session.history', session: 'absent' });
  assert.deepEqual(empty.value, { messages: [], more: false });
});


test('web.session exposes only the asking browser’s sign-in and its fixed expiry', async t => {
  const { web, local, clock, newBrowser, origin, cookie } = await clients(t);
  clock.block(1000);
  const other = await newBrowser();
  clock.block(1000);
  const reconnected = await browserSocket(t, origin, cookie);
  const expected = { createdAt: '2026-10-16T12:00:00.000Z', lastUsedAt: '2026-10-16T12:00:02.000Z', expiresAt: '2026-11-15T12:00:00.000Z' };
  const own = await web.request({ type: 'web.session' });
  assert.equal(own.ok, true, own.error);
  assert.deepEqual(own.value, expected);
  assert.deepEqual((await reconnected.web.request({ type: 'web.session' })).value, expected);
  const second = await other.web.request({ type: 'web.session' });
  assert.deepEqual(second.value, { createdAt: '2026-10-16T12:00:01.000Z', lastUsedAt: '2026-10-16T12:00:01.000Z', expiresAt: '2026-11-15T12:00:01.000Z' });
  const listed = await local.request({ type: 'web.sessions' });
  assert.equal(listed.ok, true, listed.error);
  const sessions = (listed.value as { sessions: Array<{ id: string; createdAt: string }> }).sessions;
  assert.equal(sessions.length, 2);
  const otherId = sessions.find(row => row.createdAt === '2026-10-16T12:00:01.000Z')!.id;
  assert.deepEqual((await web.request({ type: 'web.session', session: otherId })).value, expected);
  for (const type of ['web.sessions', 'web.revoke']) {
    const result = await web.request({ type, session: otherId });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'cli-neovim-only');
  }
  const unix = await local.request({ type: 'web.session' });
  assert.equal(unix.ok, false);
  assert.match(unix.error!, /authenticated web edge/);
  // Advance the credential lifetime without running liveness timers: an already
  // admitted socket must not disclose a pruned session's record at its expiry.
  clock.block(30 * 24 * 60 * 60 * 1000 - 2000);
  assert.equal((await web.request({ type: 'web.session' })).ok, false);
  assert.equal((await other.web.request({ type: 'web.session' })).ok, true);
});

test('web launches in the project root and refuses a directory while Unix keeps that field', async t => {
  const { root, web, local } = await clients(t);
  const cwd = join(root, 'local-directory');
  await mkdir(cwd);
  const frame = { type: 'session.launch', name: 'worker', harness: 'codex' };
  const refused = await web.request({ ...frame, cwd });
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'cli-neovim-only');
  assert.match(refused.error!, /CLI and Neovim.*directory/);
  const before = await local.request({ type: 'session.list' });
  assert.equal(before.ok, true, before.error);
  assert.equal((before.value as { processes: unknown[] }).processes.length, 0);
  const launched = await web.request(frame);
  assert.equal(launched.ok, true, launched.error);
  assert.equal((launched.value as { process: { cwd: string } }).process.cwd, root);
  const unix = await local.request({ ...frame, name: 'local-worker', cwd });
  assert.equal(unix.ok, true, unix.error);
  const listed = await local.request({ type: 'session.list' });
  assert.equal(listed.ok, true, listed.error);
  assert.deepEqual((listed.value as { processes: Array<{ name: string; cwd: string }> }).processes.map(p => [p.name, p.cwd]).sort(([a], [b]) => a!.localeCompare(b!)), [['local-worker', cwd], ['worker', root]]);
});

test('session history pages keep whole messages under the byte cap and page back without gaps', async t => {
  const { root, web, local } = await clients(t);
  await inProcessSpoke(t, { cwd: root, discover: true, name: 'worker', role: 'implementer', sessionId: 'worker' });
  const ids: string[] = [];
  for (let i = 0; i < 36; i++) {
    const sent = await local.request({ type: 'topic.send', topic: 'general', to: ['worker'], text: `${i}:`.padEnd(8000, 'x') });
    assert.equal(sent.ok, true, sent.error);
    ids.push((sent.value as { message: { id: string } }).message.id);
  }
  type Page = { messages: Array<{ id: string; fromKind: string; text: string; seq: number }>; more: boolean; before?: number };
  const latest = await web.request({ type: 'session.history', session: 'worker' });
  assert.equal(latest.ok, true, latest.error);
  assert.ok(Buffer.byteLength(JSON.stringify(latest)) < 256 * 1024);
  const page = latest.value as Page;
  assert.equal(page.more, true);
  assert.ok(page.messages.length < ids.length);
  assert.ok(page.messages.every(m => m.text.length === 8000));
  const older = await web.request({ type: 'session.history', session: 'worker', before: page.before });
  assert.equal(older.ok, true, older.error);
  const previous = older.value as Page;
  assert.equal(previous.more, false);
  assert.deepEqual([...previous.messages, ...page.messages].filter(m => m.fromKind === 'human').map(m => m.id), ids);
});

test('session history remains a human-client read even from an Aide’s attributed shell', async t => {
  const { root, local } = await clients(t);
  await inProcessSpoke(t, { cwd: root, discover: true, name: 'helper', role: 'aide', sessionId: 'helper' });
  const result = await local.request({ type: 'session.history', session: 'someone-else', as: { name: 'helper', sessionId: 'helper', shell: true } });
  assert.equal(result.ok, false);
});

test('the authenticated web cookie answers an approval as the human through the common gate', async t => {
  const { web, local, hub } = await clients(t);
  assert.equal((await local.request({ type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' })).ok, true);
  hub.fakes.codex!.raiseApproval('worker', { id: 'browser', kind: 'command', subject: { command: 'echo web' }, choices: ['once', 'always', 'deny'] });
  const pending = await local.request({ type: 'inbox.list' });
  const record = (pending.value as import('../src/protocol.ts').Inbox).approvals[0]!;
  const result = await web.request({ type: 'approval.answer', approval: record.id, choice: 'always', note: 'This command is safe' });
  assert.equal(result.ok, true, result.error);
  const closed = (result.value as { approval: typeof record }).approval;
  assert.equal(closed.state, 'closed');
  assert.equal(closed.outcome?.by, 'human');
  assert.equal(closed.outcome?.via, 'web');
  assert.equal(closed.outcome?.choice, 'always');
  assert.equal(closed.outcome?.note, 'This command is safe');
  assert.deepEqual(hub.fakes.codex!.approvalAnswers.map(a => [a.requestId, a.choice, a.note]), [['browser', 'always', 'This command is safe']]);
  const late = await local.request({ type: 'approval.answer', approval: record.id, choice: 'deny' });
  assert.equal(late.ok, false);
  assert.match(late.error!, /human.*web/);
  assert.ok(late.error!.includes(closed.outcome!.at));
  assert.equal(hub.fakes.codex!.approvalAnswers.length, 1);
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
