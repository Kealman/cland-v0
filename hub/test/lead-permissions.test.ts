// T2: subtree authority is rechecked across explicit adapter and Git callback barriers.
// Native Git is fixture infrastructure; no shell gate, harness binary or spoke process is used.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import childProcess, { execFileSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { ProjectConfiguration } from '../src/hub/configuration.ts';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { AppServerClient } from '../src/adapters/codex/app-server.ts';
import { LaunchFiles } from '../src/adapters/launch-files.ts';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { copyPreparedProject } from './prepared-project.ts';
import { pushDev } from '../src/territory-push.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { onCleanup } from './process-cleanup.ts';
import { testWaitMs } from './harness.ts';

/** Register before fixture setup: release and observe every held operation before peers,
 * hubs or roots close. The timer is a failure bound, never a synchronization wait. */
function heldOperations(t: TestContext) {
  const releases: Array<() => void> = [];
  const pending = new Set<Promise<void>>();
  let closing: Promise<void> | undefined;
  const close = () => closing ??= (async () => {
    for (const release of releases) release();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        Promise.all([...pending]),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('held operations did not settle before fixture teardown')), testWaitMs(30_000)); }),
      ]);
    } finally { clearTimeout(timeout); }
  })();
  onCleanup(t, close);
  return {
    close,
    track<T>(operation: Promise<T>): Promise<T> {
      assert.equal(closing, undefined, 'no operation starts after fixture teardown');
      const receipt = operation.then(() => {}, () => {});
      pending.add(receipt);
      void receipt.then(() => pending.delete(receipt));
      return operation;
    },
    gate() {
      assert.equal(closing, undefined, 'no barrier starts after fixture teardown');
      let enter!: () => void;
      let release!: () => void;
      const entered = new Promise<void>(resolve => { enter = resolve; });
      const released = new Promise<void>(resolve => { release = resolve; });
      releases.push(release);
      return { entered, released, enter, release };
    },
  };
}

test('live subtree authority covers launch, stop, verifier holds and root-only operations', async t => {
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
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

test('a verifier spawned while its item leaves the Lead subtree is refused and cleaned up', async t => {
  const work = heldOperations(t);
  const root = await tempProject(t);
  await copyPreparedProject(root);
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const fake = fakes['claude-code']!;
  const gate = work.gate();
  const spawn = fake.spawn.bind(fake);
  fake.spawn = async (...args) => {
    const process = await spawn(...args);
    if (args[0].name === 'late-verifier') { gate.enter(); await gate.released; }
    return process;
  };
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  const { item: epic } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Own epic', kind: 'epic' });
  const { item: other } = await coord.call<{ item: { id: string } }>('task.create', { title: 'Other epic', kind: 'epic' });
  const { item } = await coord.call<{ item: { id: string } }>('task.create', { size: 'M', title: 'Verifier work', parent: epic.id });
  const launched = await coord.call<{ process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: epic.id, harness: 'claude-code' });
  const lead = await inProcessSpoke(t, { cwd: root, discover: true, name: 'lead-1', sessionId: launched.process.sessionId, assignRole: false });
  t.after(() => lead.close());
  const launching = work.track(lead.call<{ ok: boolean; code: string; reason: string }>('session.launch', { name: 'late-verifier', role: 'reviewer', item: item.id, harness: 'claude-code' }));
  await gate.entered;
  assert.equal((await coord.call<{ ok: boolean }>('task.edit', { id: item.id, state: 'closed' })).ok, true);
  const pruned = await ui.request({ type: 'worktree.prune', items: [item.id] });
  assert.equal(pruned.ok, true);
  const outcome = pruned.value as { removed: unknown[]; failed: Array<{ item: string; error: string }> };
  assert.deepEqual(outcome.removed, []);
  assert.equal(outcome.failed.length, 1);
  assert.equal(outcome.failed[0]!.item, item.id);
  // The spawned verifier may register its presence before the gated adapter returns.
  assert.ok([
    `${item.id}: a session is being launched in its worktree`,
    `${item.id}: late-verifier still stands inside its worktree`,
  ].includes(outcome.failed[0]!.error), outcome.failed[0]!.error);
  assert.equal(existsSync(join(root, '.cland/worktrees', item.id)), true);
  assert.equal((await coord.call<{ ok: boolean }>('task.edit', { id: item.id, state: 'open' })).ok, true);
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: item.id, parent: other.id })).ok, true);
  gate.release();
  const result = await launching;
  assert.equal(result.ok, false);
  assert.equal(result.code, 'forbidden');
  assert.match(result.reason, /Lead level.*subtree/);
  assert.equal(fake.stops.some(p => p.name === 'late-verifier'), true, 'the refused spawned verifier is stopped');
  const listed = (await ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] };
  assert.equal(listed.processes.some(p => p.name === 'late-verifier' && p.status === 'running'), false);
  assert.equal((await coord.call<{ item: { claim: unknown } }>('task.view', { id: item.id })).item.claim, null);
});

test('lead-1 requests verifiers and merges its scheduled item through the ordinary gate; other levels refuse', async t => {
  const work = heldOperations(t);
  const root = await tempProject(t);
  const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  await copyPreparedProject(root, 'native-territory');
  await writeFile(join(root, 'feature.txt'), 'initial\n');
  git(root, 'add', 'feature.txt');
  git(root, 'commit', '-qm', 'Initial feature');
  await pushDev(root, work => work(), () => {});
  let gateKind = '';
  let writeTrees = 0;
  let gate = work.gate();
  const nativeExec = childProcess.execFile;
  const mock = t.mock.method(childProcess, 'execFile', ((file: string, args: string[], options: unknown, callback: (...args: unknown[]) => void) => {
    return nativeExec(file, args, options as childProcess.ExecFileOptions, (...result: unknown[]) => {
      const waiting = file === 'git' && ((gateKind === 'preparation' && args[0] === 'merge-tree' && args.includes('--name-only'))
        || (gateKind === 'landing' && args[0] === 'write-tree' && writeTrees++ === 1)
        || (gateKind === 'recovery' && args[0] === 'rev-parse' && args.some(a => a.endsWith('^'))));
      if (!waiting) { callback(...result); return; }
      gate.enter();
      void gate.released.then(() => callback(...result));
    });
  }) as typeof childProcess.execFile);
  syncBuiltinESMExports();
  t.after(() => { mock.mock.restore(); syncBuiltinESMExports(); });
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  assert.equal((await ui.request({ type: 'subscribe' })).ok, true);
  // The direct verdict writer and the launched verifier each occupy a Reviewer slot.
  assert.equal((await ui.request({ type: 'crew.set', key: 'reviewer.size', value: 2 })).ok, true);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator' });
  const rev = await inProcessSpoke(t, { cwd: root, discover: true, name: 'rev', role: 'reviewer' });
  t.after(async () => { await coord.close(); await rev.close(); });
  const create = async (title: string, kind = 'task', parent?: string) => (await coord.call<{ item: { id: string } }>('task.create', { ...(['task'].includes(kind) ? { size: 'M' } : {}), title, kind, parent })).item.id;
  const release = await create('Release', 'release');
  const epic = await create('Own epic', 'epic', release);
  const other = await create('Other epic', 'epic', release);
  const own = await create('Own task', 'task', epic);
  const foreign = await create('Other task', 'task', other);
  const launched = await coord.call<{ process: HarnessProcessView }>('session.launch', { name: 'lead-1', role: 'lead', item: epic, harness: 'claude-code' });
  const lead = await inProcessSpoke(t, { cwd: root, discover: true, name: 'lead-1', sessionId: launched.process.sessionId, assignRole: false });
  t.after(() => lead.close());
  const stop = async (name: string) => ({ code: (await ui.request({ type: 'session.stop', session: name, as: { name: 'lead-1' } })).ok ? 0 : 1 });
  const claimed = await ui.request({ type: 'task.claim', item: own });
  assert.equal(claimed.ok, true, claimed.error);
  const worktree = (claimed.value as { worktree: { path: string; branch: string } }).worktree;
  await writeFile(join(worktree.path, 'feature.txt'), 'shipped\n');
  git(worktree.path, 'add', 'feature.txt');
  git(worktree.path, 'commit', '-qm', 'Implement own item');
  git(worktree.path, 'push', 'origin', worktree.branch);
  for (const role of ['reviewer', 'qa']) {
    const verifier = await lead.call<{ ok: boolean; reason?: string; error?: string; claim: unknown; process: HarnessProcessView }>('session.launch', { name: `${role}-pool`, role, item: own, harness: 'claude-code' });
    assert.equal(verifier.ok, true, verifier.error ?? verifier.reason);
    assert.equal(verifier.claim, null);
    assert.equal(verifier.process.item, own);
    const request = await lead.call<{ ok: boolean }>('send', { to: [`${role}-pool`], text: `${role === 'qa' ? 'qa' : 'review'} request ${own}\nCheck the build.` });
    assert.equal(request.ok, true);
    const denied = await lead.call<{ ok: boolean; code: string; reason: string }>('send', { to: [`${role}-pool`], text: `${role === 'qa' ? 'qa' : 'review'} request ${foreign}\nCheck the build.` });
    assert.equal(denied.ok, false);
    assert.match(denied.reason, /subtree/);
    assert.equal((await stop(`${role}-pool`)).code, 0);
  }
  const before = git(root, 'rev-parse', 'dev');
  const outside = await lead.call<{ ok: boolean; code: string; reason: string }>('merge', { item: foreign });
  assert.equal(outside.ok, false);
  assert.equal(outside.code, 'forbidden');
  assert.match(outside.reason, new RegExp(`epic ${epic}.*${foreign}.*subtree`));
  const gated = await lead.call<{ ok: boolean; code: string }>('merge', { item: own });
  assert.equal(gated.ok, false);
  assert.equal(gated.code, 'review-missing');
  assert.equal(git(root, 'rev-parse', 'dev'), before);
  // A disjoint dev change keeps real Git mergeable; the callback barrier controls preparation exactly.
  await writeFile(join(root, 'dev.txt'), 'dev version\n');
  git(root, 'add', 'dev.txt');
  git(root, 'commit', '-qm', 'Dev changes another file');
  await pushDev(root, work => work(), () => {});
  gateKind = 'preparation';
  assert.equal((await rev.call<{ ok: boolean }>('task.comment', { id: own, verdict: 'review', scope: 'full', result: 'clear', run: 'lead-demo' })).ok, true);
  const refs = git(root, 'show-ref');
  let preparationResult: unknown;
  const preparing = work.track(lead.call<{ ok: boolean; code: string; reason: string }>('merge', { item: own }).then(result => { preparationResult = result; return result; }));
  await gate.entered;
  assert.equal(preparationResult, undefined, 'the merge has not finished before reparenting');
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: other })).ok, true);
  gate.release();
  const moved = await preparing;
  assert.equal(moved.ok, false);
  assert.equal(moved.code, 'forbidden');
  assert.match(moved.reason, /Lead level.*subtree/);
  assert.equal(git(root, 'show-ref'), refs);
  assert.equal(await readFile(join(root, 'feature.txt'), 'utf8'), 'initial\n');
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: epic })).ok, true);
  gateKind = 'landing';
  gate = work.gate();
  writeTrees = 0;
  let landingResult: unknown;
  const landing = work.track(lead.call<{ ok: boolean; code: string; reason: string }>('merge', { item: own }).then(result => { landingResult = result; return result; }));
  await gate.entered;
  assert.equal(landingResult, undefined, 'the index changed but the ref has not moved');
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: other })).ok, true);
  gate.release();
  const late = await landing;
  assert.equal(late.ok, false);
  assert.equal(late.code, 'forbidden');
  assert.match(late.reason, /Lead level.*subtree/);
  assert.equal(git(root, 'show-ref'), refs);
  assert.equal(await readFile(join(root, 'feature.txt'), 'utf8'), 'initial\n');
  gateKind = '';
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: epic })).ok, true);
  const obstruction = join(root, '.cland/tasks', `.${own}-own-task.md.${discovery.pid}.tmp`);
  await mkdir(obstruction);
  const merged = await lead.call<{ ok: boolean; error?: string; commit: string; followUp?: { step: string; error: string } }>('merge', { item: own });
  assert.equal(merged.ok, true, merged.error);
  assert.equal(merged.followUp?.step, 'close');
  assert.equal(git(root, 'rev-parse', 'dev'), merged.commit);
  assert.equal(await readFile(join(root, 'feature.txt'), 'utf8'), 'shipped\n');
  await rm(obstruction, { recursive: true });
  gateKind = 'recovery';
  gate = work.gate();
  const recovering = work.track(lead.call<{ ok: boolean; commit: string; followUp?: { error: string } }>('merge', { item: own }));
  await gate.entered;
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: other })).ok, true);
  gate.release();
  const recovery = await recovering;
  assert.equal(recovery.commit, merged.commit);
  assert.match(recovery.followUp?.error ?? '', /Lead level.*subtree/);
  assert.equal((await coord.call<{ item: { state: string } }>('task.view', { id: own })).item.state, 'open');
  assert.equal(git(root, 'rev-parse', 'dev'), merged.commit);
  gateKind = '';
  assert.equal((await coord.call<{ ok: boolean }>('task.link', { id: own, parent: epic })).ok, true);
  const finished = await lead.call<{ ok: boolean; followUp?: unknown }>('merge', { item: own });
  assert.equal(finished.ok, true);
  assert.equal(finished.followUp, undefined);
  const closed = await coord.call<{ item: { state: string } }>('task.view', { id: own });
  assert.equal(closed.item.state, 'closed');
  for (const type of ['release', 'sync', 'push', 'hub.stop']) {
    const denied = await ui.request({ type, as: { name: 'lead-1' } });
    assert.equal(denied.ok, false);
    assert.match(denied.error!, /root level.*Coordinator/);
  }
});


test('adapter preparation rechecks Lead authority before native work is admitted', async t => {
  const work = heldOperations(t);
  const root = await tempProject(t);
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
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
  const nativeExec = childProcess.execFile;
  const nativeSpawn = childProcess.spawn;
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
    if (file !== 'codex-in-memory') return nativeExec(file, args, options as childProcess.ExecFileOptions, callback);
    assert.deepEqual(args, ['--version']);
    if (boundary === 'version') { gate.enter(); void gate.released.then(() => callback(null, 'codex 0.160.0', '')); }
    else queueMicrotask(() => callback(null, 'codex 0.160.0', ''));
    return new EventEmitter() as childProcess.ChildProcess;
  }) as typeof childProcess.execFile);
  const spawnMock = t.mock.method(childProcess, 'spawn', ((file: string, ...args: unknown[]) => {
    if (file !== 'codex-in-memory') return (nativeSpawn as (...args: unknown[]) => childProcess.ChildProcess)(file, ...args);
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
  const { discovery, fakes } = await projectHub(t, root, {}, { harnesses: 'fake', clock: new FakeClock() });
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
  const fixture = { after: (hook: () => unknown) => { hooks.push(hook); } } as unknown as TestContext;
  let cleanup: Promise<void> | undefined;
  const dispose = () => cleanup ??= (async () => { for (const hook of hooks) await hook(); })();
  t.after(dispose);
  const work = heldOperations(fixture);
  const root = await tempProject(fixture);
  const { fakes } = await projectHub(fixture, root, {}, { harnesses: 'fake', clock: new FakeClock() });
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
