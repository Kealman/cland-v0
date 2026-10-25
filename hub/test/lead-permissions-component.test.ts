// T2: Lead authority across in-process adapter, role-read and stop barriers.
// Git's no-territory answer is injected; native worktree/merge proofs stay in T3.
import { sessionUi as connectUi } from './session-credential-fixture.ts';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { ProjectConfiguration } from '../src/hub/configuration.ts';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { AppServerClient } from '../src/adapters/codex/app-server.ts';
import { LaunchFiles } from '../src/adapters/launch-files.ts';
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { heldOperations } from './lead-permissions-support.ts';

// TaskWorktrees has a separate native reader from the tracker's injected Git.
// These fixtures have no territory: answer only that predicate, never forward a child.
function noTerritory(file: string, args: string[], _options: unknown, callback: (...args: unknown[]) => void) {
  assert.equal(file, 'git');
  assert.deepEqual(args, ['config', '--get', 'cland.managed']);
  queueMicrotask(() => callback(new Error('no territory'), '', 'no territory'));
  return new EventEmitter() as childProcess.ChildProcess;
}
async function componentHub(t: TestContext, root: string) {
  const mock = t.mock.method(childProcess, 'execFile', noTerritory as typeof childProcess.execFile);
  syncBuiltinESMExports();
  t.after(() => { mock.mock.restore(); syncBuiltinESMExports(); });
  return projectHub(t, root, {}, { harnesses: 'fake', probes: 'fake', clock: new FakeClock() });
}

test('live subtree authority covers launch, stop, verifier holds and root-only operations', async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await componentHub(t, root);
  const fake = fakes['claude-code']!;
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const create = async (title: string, kind = 'task', parent?: string) => (await coord.call<{ item: { id: string } }>('task.create', { ...(['task'].includes(kind) ? { size: 'M' } : {}), title, kind, parent })).item.id;
  const epic = await create('Own epic', 'epic');
  const other = await create('Other epic', 'epic');
  const own = await create('Own task', 'task', epic);
  const foreign = await create('Foreign task', 'task', other);
  const launched = await coord.call<{ ok: boolean; process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: epic, harness: 'claude-code' });
  assert.equal(launched.ok, true);
  const lead = await inProcessSpoke(t, { cwd: root, discover: true, name: 'lead-1', sessionId: launched.process.sessionId, assignRole: false });
  t.after(() => lead.close());
  const stop = async (name: string) => {
    const result = await ui.request({ type: 'session.stop', session: name, as: { name: 'lead-1' } });
    return { code: result.ok ? 0 : 1, stderr: result.error ?? '' };
  };
  await lead.waitForPresence(['coord', 'lead-1']);
  const launch = (name: string, item?: string) => lead.call<{ ok: boolean; code?: string; reason?: string; process: HarnessProcessView }>('session.launch', { name, role: 'implementer', harness: 'claude-code', item });
  const worker = await launch('own-worker', own);
  assert.equal(worker.ok, true, worker.reason);
  assert.equal(worker.process.item, own);
  for (const [name, item] of [['foreign-worker', foreign], ['unbound-worker', undefined]]) {
    const denied = await launch(name!, item);
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 'forbidden');
    assert.match(denied.reason!, new RegExp(`Lead.*epic ${epic}.*subtree`));
  }
  const elsewhere = await coord.call<{ ok: boolean }>('session.launch', { name: 'foreign-worker', role: 'implementer', item: foreign, harness: 'claude-code' });
  assert.equal(elsewhere.ok, true);
  const stopForeign = await ui.request({ type: 'session.stop', session: 'foreign-worker', as: { name: 'lead-1' } });
  assert.equal(stopForeign.ok, false);
  assert.match(stopForeign.error!, /subtree/);
  assert.equal((await stop('own-worker')).code, 0);
  // Reparenting takes effect on the next request; launch history grants nothing.
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: foreign, parent: epic })).ok, true);
  assert.equal((await stop('foreign-worker')).code, 0);
  assert.equal(fake.spawns.some(s => s.name === 'unbound-worker'), false);
  const outsideRelease = await lead.call<{ ok: boolean; code: string; reason: string }>('merge', { item: own });
  assert.equal(outsideRelease.ok, false);
  assert.equal(outsideRelease.code, 'forbidden');
  assert.match(outsideRelease.reason, /root level.*Coordinator.*outside a release subtree/);
  const foreignAgain = await create('Foreign verification', 'task', other);
  const verifier = await lead.call<{ ok: boolean; process: HarnessProcessView }>('session.launch', { name: 'qa-pool', role: 'qa', item: own, harness: 'claude-code' });
  assert.equal(verifier.ok, true);
  const qa = await inProcessSpoke(t, { cwd: root, discover: true, name: 'qa-pool', sessionId: verifier.process.sessionId, assignRole: false });
  t.after(() => qa.close());
  await qa.waitForPresence(['qa-pool']);
  for (const item of [own, foreignAgain]) {
    const hold = await qa.call<{ ok: boolean; error?: string }>('task.hold', { id: item });
    assert.equal(hold.ok, true, hold.error);
  }
  const held = await coord.call<{ items: Array<{ id: string; holds: Array<{ sessionId: string }> }> }>('task.list', {});
  assert.equal(held.items.find(i => i.id === foreignAgain)?.holds[0]?.sessionId, verifier.process.sessionId, JSON.stringify(held));
  // A continued first line is the same request: a trailing detail neither escapes the Lead's subtree
  // check nor turns a refused item into an ordinary send.
  const ownedRequest = await lead.call<{ ok: boolean; error?: string }>('send', { to: ['qa-pool'], text: `qa request ${own} — check the reviewed build` });
  assert.equal(ownedRequest.ok, true, ownedRequest.error);
  const nearMiss = await lead.call<{ ok: boolean; code: string; reason: string }>('send', { to: ['qa-pool'], text: `qa request ${foreignAgain} — check the reviewed build` });
  assert.equal(nearMiss.ok, false);
  assert.equal(nearMiss.code, 'forbidden');
  assert.match(nearMiss.reason, /subtree/);
  const mixed = await stop('qa-pool');
  assert.notEqual(mixed.code, 0);
  assert.match(mixed.stderr, /subtree/);
  assert.equal((await qa.call<{ ok: boolean }>('task.hold', { id: foreignAgain, release: true })).ok, true);
  assert.equal((await stop('qa-pool')).code, 0);
  const path = join(root, '.cland/roles.toml');
  await writeFile(path, (await readFile(path, 'utf8')).replace('[lead.permissions]\ntools = [', '[lead.permissions]\ntools = ["release", "sync", "push", "hub.stop", "session.resume", '));
  for (const type of ['release', 'sync', 'push', 'hub.stop', 'session.resume']) {
    const denied = await ui.request({ type, session: 'own-worker', as: { name: 'lead-1' } });
    assert.equal(denied.ok, false);
    assert.match(denied.error!, /root level.*Coordinator/);
  }
  const newLead = await lead.call<{ ok: boolean; reason: string }>('session.launch', { name: 'lead-2', role: 'lead', item: other, harness: 'claude-code' });
  assert.equal(newLead.ok, false);
  assert.match(newLead.reason, /root level.*Coordinator or an Aide.*launches Leads/);
  assert.equal((await ui.request({ type: 'task.claim', item: epic, release: true, force: true })).ok, true);
  const unclaimed = await launch('claimless-worker', own);
  assert.equal(unclaimed.ok, false);
  assert.match(unclaimed.reason!, /Lead level.*no live container claim/);
});

test('adapter preparation rechecks Lead authority before native work is admitted', async t => {
  const work = heldOperations(t);
  const root = await tempProject(t);
  const { discovery, fakes } = await componentHub(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  const create = async (title: string, kind = 'task', parent?: string) => (await coord.call<{ item: { id: string } }>('task.create', { ...(kind === 'task' ? { size: 'M' } : {}), title, kind, parent })).item.id;
  const epic = await create('Own epic', 'epic');
  const other = await create('Other epic', 'epic');
  const item = await create('Native work', 'task', epic);
  const launched = await coord.call<{ process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: epic, harness: 'claude-code' });
  const lead = await inProcessSpoke(t, { cwd: root, discover: true, name: 'lead-1', assignRole: false, sessionId: launched.process.sessionId });
  // Run the production Codex adapter with native edges replaced in memory. These gates
  // exercise its own authorization calls after version and thread/start, rather than
  // adding authorization to the test adapter (which would mask a missing production check).
  let boundary = '';
  let gate = work.gate();
  let serverStarts = 0;
  let serverClosed = false;
  const requests: string[] = [];
  const client = Object.assign(new EventEmitter(), {
    request: async (method: string) => {
      requests.push(method);
      if (method === 'thread/start') { gate.enter(); await gate.released; return { thread: { id: 'fake-thread', status: { type: 'idle' } } }; }
      return {};
    },
    close: () => { serverClosed = true; },
  });
  const execMock = t.mock.method(childProcess, 'execFile', ((file: string, args: string[], options: unknown, callback: (...args: unknown[]) => void) => {
    if (file !== 'codex-in-memory') return noTerritory(file, args, options, callback);
    assert.deepEqual(args, ['--version']);
    if (boundary === 'version') { gate.enter(); void gate.released.then(() => callback(null, 'codex 0.160.0', '')); }
    else queueMicrotask(() => callback(null, 'codex 0.160.0', ''));
    return new EventEmitter() as childProcess.ChildProcess;
  }) as typeof childProcess.execFile);
  const spawnMock = t.mock.method(childProcess, 'spawn', ((file: string, ...args: unknown[]) => {
    assert.equal(file, 'codex-in-memory');
    serverStarts++;
    return Object.assign(new EventEmitter(), { pid: 42, unref() {} }) as childProcess.ChildProcess;
  }) as typeof childProcess.spawn);
  t.mock.method(AppServerClient, 'connect', async () => client as unknown as AppServerClient);
  // No OS process exists at this edge. The production rollback still closes its RPC
  // client and removes launch files; OS child reaping is the retained T3 proof's job.
  t.mock.method(LaunchFiles.prototype, 'child', () => {});
  syncBuiltinESMExports();
  t.after(() => { execMock.mock.restore(); spawnMock.mock.restore(); syncBuiltinESMExports(); });
  for (boundary of ['version', 'thread-start']) {
    gate = work.gate();
    serverStarts = 0;
    serverClosed = false;
    requests.length = 0;
    const adapter = new CodexAdapter({ root, discoveryFile: join(root, '.cland/hub.json'), node: process.execPath, cli: 'unused', spoke: 'unused', log() {}, signal() {}, recordPid() {}, exited() {} }, { bin: 'codex-in-memory', env: {} });
    t.after(() => adapter.close());
    fakes.codex!.spawn = adapter.spawn.bind(adapter);
    const launching = work.track(lead.call<{ ok: boolean; code: string; reason: string }>('session.launch', { name: `native-${boundary}`, role: 'reviewer', item, harness: 'codex', brief: 'Review the native launch permission boundary.' }));
    await gate.entered;
    if (boundary === 'version') assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: item, parent: other })).ok, true);
    else assert.equal((await ui.request({ type: 'task.claim', item: epic, release: true, force: true })).ok, true);
    gate.release();
    const result = await launching;
    assert.equal(result.ok, false);
    assert.equal(result.code, 'forbidden');
    assert.match(result.reason, /Lead level.*(?:subtree|no live container claim)/);
    assert.equal(serverStarts, boundary === 'thread-start' ? 1 : 0);
    assert.equal(requests.includes('turn/start'), false, 'the clause and brief never start a native turn');
    if (boundary === 'thread-start') assert.equal(serverClosed, true, 'rollback closes the app-server client');
    const listed = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
    assert.equal(listed.processes.some(p => p.name === `native-${boundary}` && p.status === 'running'), false);
    assert.equal((await coord.call<{ item: { claim: unknown } }>('task.view', { id: item })).item.claim, null);
    if (boundary === 'version') assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: item, parent: epic })).ok, true);
  }
});

test('subtree authority is rechecked after a fresh roles read and a deferred stop', async t => {
  const work = heldOperations(t);
  const root = await tempProject(t);
  const fresh = ProjectConfiguration.prototype.fresh;
  const launchGate = work.gate();
  let armed = false;
  t.mock.method(ProjectConfiguration.prototype, 'fresh', async function (this: ProjectConfiguration, ...args: Parameters<ProjectConfiguration['fresh']>) {
    await fresh.apply(this, args);
    if (armed && args.length) { launchGate.enter(); await launchGate.released; }
  });
  const { discovery, fakes } = await componentHub(t, root);
  const ui = await connectUi(t, discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  const create = async (title: string, kind = 'task', parent?: string) => (await coord.call<{ item: { id: string } }>('task.create', { ...(kind === 'task' ? { size: 'M' } : {}), title, kind, parent })).item.id;
  const epic = await create('Owned node', 'epic');
  const other = await create('Foreign node', 'epic');
  const item = await create('Moving work', 'task', epic);
  const launched = await coord.call<{ process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: epic, harness: 'claude-code' });
  const lead = await inProcessSpoke(t, { cwd: root, discover: true, name: 'lead-1', assignRole: false, sessionId: launched.process.sessionId });
  const fake = fakes['claude-code']!;
  armed = true;
  const starting = work.track(lead.call<{ ok: boolean; code: string; reason: string }>('session.launch', { name: 'revoked-worker', role: 'implementer', item, harness: 'claude-code' }));
  await launchGate.entered;
  assert.equal(fake.spawns.some(p => p.name === 'revoked-worker'), false, 'fresh roles are still being read');
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: item, parent: other })).ok, true);
  armed = false;
  launchGate.release();
  const refused = await starting;
  assert.equal(refused.code, 'forbidden');
  assert.match(refused.reason, /Lead level.*subtree/);
  assert.equal(fake.spawns.some(p => p.name === 'revoked-worker'), false, 'scope loss refuses before spawning');
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: item, parent: epic })).ok, true);
  assert.equal((await lead.call<{ ok: boolean }>('session.launch', { name: 'own-worker', role: 'implementer', item, harness: 'claude-code' })).ok, true);
  const stopGate = work.gate();
  const stop = fake.stop.bind(fake);
  fake.stop = async (...args) => { stopGate.enter(); await stopGate.released; return stop(...args); };
  const stopping = work.track(ui.request({ type: 'session.stop', session: 'own-worker', as: { name: 'lead-1' } }));
  await stopGate.entered;
  assert.equal(fake.stops.length, 0, 'no stop before the adapter await completes');
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: item, parent: other })).ok, true);
  stopGate.release();
  const denied = await stopping;
  assert.equal(denied.ok, false);
  assert.match(denied.error!, /Lead level.*subtree/);
  assert.equal(fake.stops.length, 0, 'the stop authorization callback sees the current subtree');
  const listed = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
  assert.equal(listed.processes.find(p => p.name === 'own-worker')?.status, 'running');
});

test('a pre-release assertion failure drains held work before fixture resources close', async t => {
  // Capture the fixture's native after hooks so the test can simulate a failing body
  // and run the same ownership cleanup that Node would run, without failing a child test.
  const hooks: Array<() => unknown> = [];
  const fixture = { mock: t.mock, after: (hook: () => unknown) => { hooks.push(hook); } } as unknown as TestContext;
  let cleanup: Promise<void> | undefined;
  const dispose = () => cleanup ??= (async () => { for (const hook of hooks) await hook(); })();
  t.after(dispose);
  const work = heldOperations(fixture);
  const root = await tempProject(fixture);
  const { fakes } = await componentHub(fixture, root);
  const coord = await inProcessSpoke(fixture, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  const fake = fakes['claude-code']!;
  const gate = work.gate();
  const spawn = fake.spawn.bind(fake);
  fake.spawn = async (...args) => { gate.enter(); await gate.released; return spawn(...args); };
  let settled = false;
  const launching = work.track(coord.call<{ ok: boolean }>('session.launch', { name: 'held-worker', role: 'implementer', harness: 'claude-code' }).then(async result => {
    assert.equal(result.ok, true);
    assert.equal(existsSync(root), true, 'the operation completes while its root exists');
    assert.equal((await coord.call<{ ok: boolean }>('who')).ok, true, 'its peer and hub remain usable until settlement');
    settled = true;
    return result;
  }));
  await gate.entered;
  assert.equal(settled, false, 'the operation is held before the controlled failure');
  assert.equal(fake.spawns.length, 0);
  await assert.rejects(async () => {
    try { assert.fail('controlled pre-release assertion failure'); }
    finally { await dispose(); }
  }, /controlled pre-release assertion failure/);
  await launching;
  assert.equal(settled, true, 'early cleanup observed operation completion');
  assert.equal(existsSync(root), false, 'directory cleanup follows settlement');
});
