// T2: inspect/start use the real socket edge; fake time models expensive full status collection.
// A small control-only hub isolates liveness from the daemon's unrelated project services.
import test from 'node:test';
import { fixtureSocketPath } from '../../test-support/socket-path.ts';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createHubBase } from '../src/hub/server.ts';
import { createSocketEdge } from '../src/hub/socket.ts';
import { inspect, runHub } from '../src/cli/hub.ts';
import { fixtureHubCommand, runFixtureHub } from './fixture-hub-cli.ts';
import { askHub } from '../src/cli/socket-client.ts';
import { layout } from '../src/project.ts';
import { FakeClock } from './fake-clock.ts';
import { tempProject } from './harness.ts';
import { assertStartupReplies } from './startup-replies-fixture.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fixtureWork } from './fixture-work.ts';
import { until } from './until.ts';

test('fixture CLI inspection uses explicit lock identity for status and serving start', async t => {
  const owner = fixtureWork(t);
  const previous = process.env;
  owner.restore(() => { process.env = previous; });
  await owner.run(async work => {
    const { projectHub } = await work.step(() => import('./harness.ts'));
    const root = await work.root(() => tempProject(t));
    process.env = { ...previous };
    const hostIdentity = { hostname: 'isolated-cli-fixture', bootId: 'isolated-boot', pidNamespace: null };
    process.env.CLAND_TEST_LOCK_IDENTITY = JSON.stringify(hostIdentity);
    const hub = await work.acquire(() => projectHub(t, root), hub => hub.dispose());
    const inspection = (l: ReturnType<typeof layout>) => inspect(l, { hostIdentity });
    assert.equal((await inspection(layout(root))).kind, 'live');
    let output = '';
    const io = { out: (text: string) => { output += text; }, err: (text: string) => assert.fail(text) };
    assert.equal(await runHub(['status', '--json'], root, io, { hostIdentity }), 0);
    assert.equal(JSON.parse(output).pid, process.pid);
    output = '';
    assert.equal(await runHub(['start'], root, io, { hostIdentity }), 0);
    assert.match(output, /hub already running/);
    const status = await fixtureHubCommand(root, 'status', '--json');
    assert.equal(status.code, 0, status.stderr);
    assert.equal(JSON.parse(status.stdout).pid, process.pid);
    const start = await fixtureHubCommand(root, 'start');
    assert.equal(start.code, 0, start.stderr);
    assert.match(start.stdout, /hub already running/);
    assert.equal((await inspect(layout(root), { hostIdentity: { ...hostIdentity, hostname: 'other-fixture' } })).kind, 'foreign');
    await writeFile(layout(root).discovery, JSON.stringify({ ...hub.discovery, socket: `${root}/unavailable.sock` }));
    try { assert.equal((await inspection(layout(root))).kind, 'mute', 'unavailable socket keeps explicit identity at the ownership fallback'); }
    finally { await writeFile(layout(root).discovery, JSON.stringify(hub.discovery)); }
  });
});

test('overlapping fixture CLI calls retain captured context and restore the outer environment', async t => {
  const owner = fixtureWork(t);
  const previous = process.env;
  owner.restore(() => { process.env = previous; });
  let replyFirst: (() => void) | undefined, replySecond: (() => void) | undefined;
  owner.release(() => { replyFirst?.(); replySecond?.(); });
  await owner.run(async work => {
    const root = await work.root(() => tempProject(t));
    const env = fixtureEnvironment(root, previous, { CLAND_TEST_LOCK_IDENTITY: JSON.stringify({ hostname: 'overlap-host', bootId: 'overlap-boot', pidNamespace: null }) });
    process.env = env;
    const seen: string[] = [];
    const f = await work.acquire(() => fixture(t, reply => {
      seen.push(process.env.CLAND_TEST_LOCK_IDENTITY ?? 'missing');
      if (seen.length === 1) replyFirst = reply;
      else replySecond = reply;
    }, root), f => f.dispose());
    const first = fixtureHubCommand(root, 'status', '--json');
    let second: ReturnType<typeof fixtureHubCommand> | undefined;
    try {
      await work.step(() => until(() => !!replyFirst, { what: 'first held CLI status receipt', timeoutMs: 5000 }));
      second = fixtureHubCommand(root, 'status', '--json');
      replyFirst!();
      assert.equal((await work.step(() => first)).code, 0);
      await work.step(() => until(() => !!replySecond, { what: 'second held CLI status receipt', timeoutMs: 5000 }));
      replySecond!();
      const result = await work.step(() => second!);
      assert.equal(result.code, 0, result.stderr);
      assert.equal(JSON.parse(result.stdout).pid, f.d.pid);
      assert.ok(process.env === env, 'both settlements restore the original environment object');
      assert.deepEqual(seen, [env.CLAND_TEST_LOCK_IDENTITY, env.CLAND_TEST_LOCK_IDENTITY]);
    } finally {
      replyFirst?.(); replySecond?.();
      await Promise.allSettled([first, ...(second ? [second] : [])]);
    }
  });
});

test.beforeEach(async context => {
  assert.ok('after' in context, 'beforeEach runs in a test context');
  const t = context;
  const root = await tempProject(t);
  const previous = process.env;
  // Exercise the same outer-session boundary in suite workers and standalone
  // runs. The CLI and askHub read process.env rather than accepting an env.
  process.env = fixtureEnvironment(root, {
    ...previous, CLAND_SESSION_NAME: 'outer-status-fixture', CLAND_SESSION_ID: 'outer-status-id',
    CLAND_LAUNCH_TOKEN: 'synthetic-invalid-credential', CLAND_HUB_FILE: `${root}/outer-hub.json`,
  });
  t.after(() => { process.env = previous; });
});

async function fixture(t: test.TestContext, holdStatus?: (reply: () => void) => void, ownedRoot?: string) {
  const root = ownedRoot ?? await tempProject(t), l = { ...layout(root), socket: fixtureSocketPath(root, 'status.sock') }, clock = new FakeClock();
  const base = { pid: process.pid, port: 0, socket: l.socket, version: 'test', root, startedAt: clock.now().toISOString(), uptimeMs: 0 };
  let statusCalls = 0;
  const control = {
    status: () => { statusCalls++; clock.block(4000); return base; }, stop: () => assert.fail('must not stop the hub'),
  };
  const hub = createHubBase({ secret: 'test', clock, control });
  let closing: Promise<void> | undefined;
  const closeHub = () => closing ??= hub.close();
  t.after(closeHub);
  if (holdStatus) {
    const open = hub.dispatcher.open.bind(hub.dispatcher);
    t.mock.method(hub.dispatcher, 'open', (...args: Parameters<typeof open>) => {
      const conversation = open(...args);
      return { ...conversation, receive: (line: string) => {
        if (JSON.parse(line).type === 'hub.status') holdStatus(() => conversation.receive(line));
        else conversation.receive(line);
      } };
    });
  }
  const d = { ...base, secret: 'test' };
  let edge: Awaited<ReturnType<typeof createSocketEdge>> | undefined;
  try {
    await mkdir(l.dir, { recursive: true });
    edge = await createSocketEdge({ path: l.socket, dispatcher: hub.dispatcher });
    t.after(() => edge!.close());
    await writeFile(l.discovery, JSON.stringify(d));
  } catch (error) {
    try { await edge?.close(); } finally { await closeHub(); }
    throw error;
  }
  statusCalls = 0;
  return { root, l, clock, d, base, control, statusCalls: () => statusCalls, dispose: async () => { await edge!.close(); await closeHub(); } };
}

test('inspect and start recognise a serving hub without collecting slow status', async t => {
  const f = await fixture(t);
  assert.equal((await inspect(f.l)).kind, 'live');
  let out = '', err = '';
  assert.equal(await runHub(['start'], f.root, { out: s => { out += s; }, err: s => { err += s; } }), 0, err);
  assert.match(out, /hub already running/);
  assert.equal(f.statusCalls(), 0, 'liveness must not depend on full status');
  const before = f.clock.now().getTime();
  assert.equal((await askHub(f.d, 'hub.status') as { pid: number }).pid, process.pid);
  assert.equal(f.clock.now().getTime() - before, 4000, 'status collection exceeds the 3000 ms probe budget');
});

test('status preserves liveness when full status collection times out', async t => {
  let entered = Promise.withResolvers<void>();
  const f = await fixture(t, () => entered.resolve());
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const json of [false, true]) {
    let out = '', err = '';
    entered = Promise.withResolvers<void>();
    const result = runHub(['status', ...(json ? ['--json'] : [])], f.root, { out: s => { out += s; }, err: s => { err += s; } });
    await entered.promise;
    t.mock.timers.tick(3000);
    assert.equal(await result, 0, err);
    assert.equal(err, '');
    if (json) assert.deepEqual(JSON.parse(out), { running: true, root: f.root, pid: process.pid, statusError: `the hub did not answer on ${f.l.socket} within 3000 ms` });
    else {
      assert.match(out, /hub running for/);
      assert.match(out, /full status unavailable: .*within 3000 ms/);
      assert.doesNotMatch(out, /does not answer/);
    }
  }
});

test('status keeps available and unavailable web details in the hub block before sessions', async t => {
  const f = await fixture(t);
  for (const web of [{ available: true, port: 4321 }, { available: false, port: 4321, reason: 'address in use' }]) {
    f.control.status = () => ({
      ...f.base, web,
      priority: { warning: { detail: 'priority unavailable', fix: 'check permissions' } },
    });
    let out = '', err = '';
    assert.equal(await runHub(['status'], f.root, { out: s => { out += s; }, err: s => { err += s; } }), 0, err);
    assert.equal(err, '');
    const detail = web.available ? 'http://127.0.0.1:4321/' : 'unavailable on 127.0.0.1:4321: address in use';
    assert.ok(out.includes(`  version  test\n  web      ${detail}\n`), out);
    assert.match(out, /warning: priority unavailable; fix: check permissions\nsessions: 0\n/);
  }
});

test('full status retains a large fragmented response', async t => {
  const f = await fixture(t);
  // Historical suite selections produced a 13 MB reply in the incident. The
  // transport must join fragments once, retaining Unicode and the final frame.
  const payload = 'status 🐈\n'.repeat(1_000_000);
  f.control.status = () => ({ ...f.base, keys: { layouts: [payload] } });
  const full = await askHub(f.d, 'hub.status') as { keys: { layouts: string[] } };
  assert.deepEqual(full.keys.layouts, [payload]);
});

test('default hub status bounds completed suite history and preserves explicit historical diagnostics', async t => {
  const { Store } = await import('../src/hub/store.ts');
  const { projectHub, connectUi } = await import('./harness.ts');
  const { join } = await import('node:path');
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = new Store(join(root, '.cland/hub.db'));
  for (let n = 0; n < 30; n++) store.setMeta(`suite-job:done-${n}`, JSON.stringify({ position: n, job: {
    id: `done-${n}`, mode: 'hub', cwd: root, topic: 'general', to: [], actor: null,
    executor: 'local', state: 'finished', reported: true, cleaned: true,
    head: `head-${n}`, branch: 'dev', integrated: true, occasion: n % 2 ? 'stage' : 'epic',
    finished: `2026-10-16T12:00:${String(n).padStart(2, '0')}.000Z`,
    completedAt: `2026-10-16T12:00:${String(n).padStart(2, '0')}.000Z`,
    outcome: { code: 0, cause: 'passed', output: 'private output tail' }, artifact: `A-${n + 1}`,
    selection: { mode: 'full', reason: 'x'.repeat(32_000), files: [] },
    pid: null, log: join(root, 'suite.log'), result: join(root, 'result.json'), gate: join(root, 'ready'),
  } }));
  const queued = JSON.parse(store.suiteJobHistory()[0]!).job;
  store.setMeta('suite-jobs', JSON.stringify([{ ...queued, id: 'queued', state: 'queued', reported: false,
    outcome: null, finished: null, completedAt: null, artifact: null }]));
  store.close();
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, hub.discovery);
  const reply = await ui.request({ type: 'hub.status' });
  assert.equal(reply.ok, true, reply.error);
  assert.ok(Buffer.byteLength(JSON.stringify(reply)) <= 64 * 1024, 'default status stays below 64 kB');
  const status = reply.value as import('../src/protocol.ts').HubStatus;
  assert.deepEqual(status.suites?.map(s => s.id), ['queued']);
  assert.equal(status.suites?.[0]?.selection?.reason, 'x'.repeat(32_000), 'queued suite keeps its full selection');
  assert.deepEqual((status as { recentSuites?: Array<{ id: string }> }).recentSuites?.map(s => s.id), ['done-29', 'done-28']);
  assert.equal(Object.hasOwn(status, 'harnesses'), false);
  assert.equal(Object.hasOwn(status, 'covers'), false);
  assert.equal(JSON.stringify(status).includes('private output tail'), false);
  const history = await ui.request({ type: 'hub.status', history: true });
  assert.equal((history.value as import('../src/protocol.ts').HubStatus).suites?.length, 31);
  assert.ok(Buffer.byteLength(JSON.stringify(history)) > 256 * 1024);
  let output = '';
  assert.equal(await runFixtureHub(['status', '--json', '--history'], root, { out: text => { output += text; }, err: text => assert.fail(text) }), 0);
  assert.equal(JSON.parse(output).suites.length, 31, 'CLI explicitly opts into historical diagnostics');
});

test('topic history pages complete messages by bytes and reads the next before-id page', async t => {
  const { Store } = await import('../src/hub/store.ts');
  const { projectHub, connectUi } = await import('./harness.ts');
  const { join } = await import('node:path');
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = new Store(join(root, '.cland/hub.db'));
  store.createTopic('general', 'General', null, '2026-10-16T12:00:00.000Z');
  const texts = Array.from({ length: 200 }, (_, i) => `${i}:` + 'Complete 🐈 message. '.repeat(170));
  store.transaction(() => {
    for (const [i, text] of texts.entries()) store.record({ id: `m${i}`, from: 'human', fromKind: 'human', via: 'hub', to: [], text,
      ts: '2026-10-16T12:00:00.000Z', topic: 'general' }, [], Date.parse('2026-10-16T12:00:00.000Z'));
  });
  store.close();
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, hub.discovery);
  const received: string[] = [];
  let before: string | undefined;
  let pages = 0;
  do {
    const reply = await ui.request({ type: 'topic.history', topic: 'general', limit: 200, ...(before ? { before } : {}) });
    assert.equal(reply.ok, true, reply.error);
    assert.ok(Buffer.byteLength(JSON.stringify(reply)) <= 256 * 1024, 'each history reply fits the byte budget');
    const value = reply.value as { messages: Array<{ id: string; text: string }>; more?: boolean; before?: string };
    received.unshift(...value.messages.map(m => m.text));
    before = value.more ? value.before : undefined;
    pages++;
  } while (before);
  assert.ok(pages > 1);
  assert.deepEqual(received, texts, 'complete bodies survive pagination with no gaps or duplicates');
});

test('artifact pages are newest first and an exclusive cursor reaches the next page', async t => {
  const { Store } = await import('../src/hub/store.ts');
  const { projectHub, connectUi } = await import('./harness.ts');
  const { join } = await import('node:path');
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = new Store(join(root, '.cland/hub.db'));
  store.transaction(() => {
    for (let n = 1; n <= 205; n++) store.registerArtifact(id => ({ id, kind: 'note', title: `Note ${n}`, creator: 'human', creatorKind: 'human',
      time: '2026-10-16T12:00:00.000Z', topic: 'general', status: 'shared', path: join(root, `note-${n}.md`) }), () => {});
  });
  store.close();
  const hub = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, hub.discovery);
  const ids: string[] = [];
  let before: string | undefined;
  let pages = 0;
  do {
    const reply = await ui.request({ type: 'artifact.list', ...(before ? { before } : {}) });
    assert.equal(reply.ok, true, reply.error);
    const value = reply.value as { artifacts: Array<{ id: string }>; more?: boolean; before?: string };
    assert.ok(value.artifacts.length <= 100);
    assert.ok(Buffer.byteLength(JSON.stringify(reply)) <= 256 * 1024);
    ids.push(...value.artifacts.map(a => a.id));
    before = value.more ? value.before : undefined;
    pages++;
  } while (before);
  assert.equal(pages, 3);
  assert.deepEqual(ids, Array.from({ length: 205 }, (_, i) => `A-${205 - i}`));
});

test('eight startup replies and byte guards work on a small durable fixture', async t => {
  const { serializeItem } = await import('../src/tracker/item.ts');
  const { join } = await import('node:path');
  const root = await tempProject(t), at = '2026-10-16T12:00:00.000Z';
  await mkdir(join(root, '.cland/tasks'), { recursive: true });
  await Promise.all(Array.from({ length: 12 }, (_, i) => writeFile(join(root, `.cland/tasks/T-${i + 1}-fixture.md`), serializeItem({
    fm: { id: `T-${i + 1}`, kind: 'task', size: 'S', title: `Startup item ${i + 1}`, state: i < 6 ? 'open' : 'closed',
      status: i < 6 ? 'planned' : 'done', labels: [], assignee: null, parent: null, blocked_by: [], topic: null, branch: null, created: at, updated: at },
    body: '## Summary\n\nA realistic startup item.\n\n## Implementation\n\n' + 'Detailed item body stays on demand. '.repeat(50), comments: [],
  }))));
  await assertStartupReplies(t, root, 'synthetic', 12, 6);
});
