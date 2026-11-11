import { settledLogin } from './settled-login-fixture.ts';
// T2: pool placement through session frames with provided Hosts and fake harnesses; no children.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { onCleanup } from './process-cleanup.ts';
import { projectHub, tempProject, eventually, inProcessSpoke, cland } from './harness.ts';
import { sessionUi } from './session-credential-fixture.ts';
import { testHost } from '../src/host/test-host.ts';
import { localHost } from '../src/host/local.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { sessionLine } from '../src/cli/session.ts';
import { HostSecretStore } from '../src/host/records.ts';
import { Store } from '../src/hub/store.ts';
import { testWaitMs } from './until.ts';
import { fakeHarness, type FakeHarness } from './fakes/harness.ts';

/** Armed observers belong to the resource phase even if their trigger throws. */
function observe<T>(cleanup: (step: () => void | Promise<void>) => void, what: string, check: () => T | undefined | Promise<T | undefined>): Promise<T> {
  const cancelled = Symbol('observer cancelled');
  let cancel = false, work: Promise<T> | undefined;
  cleanup(async () => { cancel = true; await work?.catch(() => {}); });
  work = eventually<T | typeof cancelled>(what, () => cancel ? cancelled : check()).then(value => {
    if (value === cancelled) throw new Error(`${what}: observer cancelled during cleanup`);
    return value;
  });
  void work.catch(() => {}); // The test still awaits the original promise and keeps its assertion.
  return work;
}

async function fixture(t: test.TestContext, log?: (entry: Record<string, unknown>) => void, nativeEvents?: (host: import('../src/adapters/contract.ts').AdapterHost) => void) {
  const steps: Array<() => void | Promise<void>> = [];
  const cleanup = (step: () => void | Promise<void>) => { steps.push(step); };
  // Own patches/observers before connectUi registers its FIFO close hook.
  onCleanup(t, async () => {
    const errors: unknown[] = [];
    for (const step of steps.reverse()) { try { await step(); } catch (error) { errors.push(error); } }
    if (errors.length) throw new AggregateError(errors, 'waiting fixture cleanup failed');
  });
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nslots=1\n[hosts.other]\nprovider="fake"\nslots=1\n');
  const roles = (pool: string) => writeFile(join(root, '.cland/roles.toml'), `[implementer.launch]\npool="${pool}"\n`);
  await roles('agents');
  const local = localHost(fixtureEnvironment(root, process.env));
  const memoryListeners = new Set<(bytes: number) => void>();
  const reportMemory = (bytes: number) => { for (const listener of memoryListeners) listener(bytes); };
  const hosts = ['a', 'b', 'c'].map(name => ({ ...testHost(name, () => {}), onCapacityChanged: (listener: (bytes: number) => void) => { memoryListeners.add(listener); return () => { memoryListeners.delete(listener); }; }, realpath: local.realpath, statDirectory: async () => ({ refusal: null, identity: null }) }));
  let records: import('../src/host/records.ts').HostRecords;
  let custom: FakeHarness | undefined;
  const adapters = nativeEvents ? [(host: import('../src/adapters/contract.ts').AdapterHost, clock: import('../src/hub/clock.ts').Clock) => { nativeEvents(host); return custom = fakeHarness('codex', { host, clock }); }] : undefined;
  const hub = await projectHub(t, root, {}, { ...(adapters ? { adapters } : {}), createHost: async options => { records = options.records; return records.provisions.get('a')!; }, hosts, ...(log ? { log } : {}) });
  if (custom) hub.fakes.codex = custom;
  const store = new Store(join(root, '.cland/hub.db'));
  onCleanup(t, () => store.close());
  for (const [id, pool] of [['a', 'agents'], ['b', 'agents'], ['c', 'other']] as const) {
    settledLogin(store.hosts.logins,id,'codex',{provider:'provided-fixture',region:'fake'});
    new HostSecretStore(root, store.hosts, () => {}).register({ id, address: id, user: 'fixture', clientKeyPath: '', knownHosts: '' });
    store.hosts.provisions.ready({ id, pool, provider: 'provided-fixture', size: 'fake', region: 'fake', created: new Date().toISOString(), state: 'ready', machine: { id, address: id, architecture: 'x86_64', created: new Date().toISOString() } });
  }
  await writeFile(join(root, '.cland/config.toml'), '# managed by cland\n' + await readFile(join(root, '.cland/config.toml'), 'utf8'));
  const ui = await sessionUi(t, hub.discovery, 'cli');
  const launch = (name: string, host?: string) => ui.request({ type: 'session.launch', name, role: 'implementer', harness: 'codex', ...(host ? { host } : {}) });
  const captured = await ui.request({ type: 'host.create', pool: 'agents' });
  assert.equal(captured.ok, true, captured.error);
  return { root, hub, ui, roles, launch, store, hosts, reportMemory, cleanup, records: records! };
}
test('full pool returns a waiting reply without a process and lists the reserved name', async t => {
  const f = await fixture(t);
  for (const name of ['one','two','three','four']) assert.equal((await f.launch(name)).ok, true);
  const result = await f.launch('waiting-worker');
  assert.equal(result.ok, true, result.error);
  const value = result.value as { waiting: { reason: string; pool: string; since: string }; process?: unknown };
  assert.equal(value.waiting.reason, 'waiting for a login codex');
  assert.equal(value.waiting.pool, 'agents');
  assert.ok(Number.isFinite(Date.parse(value.waiting.since)));
  assert.equal(value.process, undefined);
  const list = (await f.ui.request({ type: 'session.list' })).value as { processes: unknown[]; waiting: Array<{ name: string }> };
  assert.equal(list.processes.length, 4);
  assert.deepEqual(list.waiting.map(w => w.name), ['waiting-worker']);
  assert.equal(f.hub.fakes.codex!.spawns.length, 4);
  const archive = (await f.ui.request({type:'session.list',archived:true})).value as {waiting:unknown[]};
  assert.deepEqual(archive.waiting,[]);
});

test('login wait card adds one ask and cancellation frees the reserved name', async t => {
  const f = await fixture(t);
  for (const name of ['one','two','three','four']) await f.launch(name);
  const before = (await f.ui.request({ type: 'inbox.list' })).value as import('../src/protocol.ts').Inbox;
  await f.launch('queued');
  const inbox = (await f.ui.request({ type: 'inbox.list' })).value as import('../src/protocol.ts').Inbox;
  assert.equal(inbox.needsYou, before.needsYou + 1);
  assert.equal(inbox.asks.length, before.asks.length + 1);
  assert.equal(inbox.asks.at(-1)!.question, "Not enough codex logins. Create one?");
  assert.deepEqual(inbox.waitingLaunches?.map(w => [w.name, w.role, w.pool, w.reason]), [['queued','implementer','agents','waiting for a login codex']]);
  const duplicate = await f.launch('queued');
  assert.equal(duplicate.ok, false);
  assert.match(String(duplicate.error), /queued.*waiting/);
  const cancelled = await f.ui.request({ type: 'session.stop', session: 'queued' });
  assert.equal(cancelled.ok, true, cancelled.error);
  assert.equal((cancelled.value as { cancelled: { name: string } }).cancelled.name, 'queued');
  assert.deepEqual(((await f.ui.request({ type: 'inbox.list' })).value as import('../src/protocol.ts').Inbox).waitingLaunches, []);
  assert.equal((await f.launch('queued', 'local')).ok, true);
});

test('a positive exit places a waiting launch once and clears its status', async t => {
  const events: Record<string, unknown>[] = [];
  const f = await fixture(t, entry => events.push(entry));
  for (const name of ['one','two','three','four']) await f.launch(name);
  await f.launch('queued');
  const placed = observe(f.cleanup, 'queued process published', async () => {
    const list = (await f.ui.request({ type: 'session.list' })).value as { processes: import('../src/protocol.ts').HarnessProcessView[]; waiting: unknown[] };
    const process = list.processes.find(p => p.name === 'queued');
    return process ? list : undefined;
  });
  f.hub.fakes.codex!.exit('one');
  const list = await placed;
  assert.equal(list.processes.find(p => p.name === 'queued')?.host, 'a');
  assert.deepEqual(list.waiting, []);
  assert.equal(f.hub.fakes.codex!.spawns.filter(p => p.name === 'queued').length, 1);
  assert.deepEqual(events.filter(e => e.event === 'session-waiting').map(e => e.end ?? e.reason), ['waiting for a login codex','placed']);
});

test('final ready commit wakes waits without polling', async t => {
  const f = await fixture(t);
  for (const id of ['a','b']) f.records.provisions.save({ ...f.records.provisions.get(id)!, state: 'cloning' });
  await f.launch('queued');
  const placed = observe(f.cleanup, 'ready checkpoint publishes queued process', async () => {
    const list = (await f.ui.request({ type: 'session.list' })).value as { processes: import('../src/protocol.ts').HarnessProcessView[] };
    return list.processes.find(p => p.name === 'queued');
  });
  f.records.provisions.ready({ ...f.records.provisions.get('a')!, state: 'ready' });
  assert.equal((await placed).host, 'a');
});

test('memory-floor waits change reason once and recover on the next memory report', async t => {
  const { HostMemoryFloorRefusal } = await import('../src/host/ssh-host.ts');
  const events: Record<string, unknown>[] = [];
  const f = await fixture(t, entry => events.push(entry));
  f.records.provisions.save({ ...f.records.provisions.get('b')!, state: 'cloning' });
  const adapter = f.hub.fakes.codex!, spawn = adapter.spawn.bind(adapter);
  let bytes = 1200000000;
  adapter.spawn = async (...args) => { if (bytes < 1300000000) throw new HostMemoryFloorRefusal(args[0].host!, { code: 'memory-floor', availableBytes: bytes, floorBytes: 1300000000 }); return spawn(...args); };
  f.cleanup(() => { adapter.spawn = spawn; });
  const reply = await f.launch('low-memory');
  assert.equal(reply.ok, true, reply.error);
  assert.match((reply.value as { waiting: { reason: string } }).waiting.reason, /waiting for a host.*host a.*1200000000/);
  assert.equal(adapter.spawns.length, 0);
  const initial = (await f.ui.request({ type: 'session.list' })).value as { processes: unknown[] };
  assert.deepEqual(initial.processes, []);
  // Each observation is followed by a serial config request and a changed-reason receipt.
  bytes = 1250000000;
  f.reportMemory(bytes);
  await eventually('updated available-byte reason', async () => {
    const list = (await f.ui.request({ type: 'session.list' })).value as { waiting: Array<{ reason: string }> };
    return list.waiting[0]?.reason.includes('1250000000') ? true : undefined;
  });
  f.reportMemory(bytes);
  await f.ui.request({ type: 'config.set', key: 'hosts.agents.spread', value: false });
  bytes = 2000000000;
  const placed = observe(f.cleanup, 'memory recovery publishes process', async () => {
    const list = (await f.ui.request({ type: 'session.list' })).value as { processes: import('../src/protocol.ts').HarnessProcessView[]; waiting: unknown[] };
    return list.processes.find(p => p.name === 'low-memory') ? list : undefined;
  });
  f.reportMemory(bytes);
  assert.deepEqual((await placed).waiting, []);
  assert.equal(adapter.spawns.length, 1);
  const history = (await f.ui.request({ type: 'topic.history', topic: 'agents', limit: 100 })).value as { messages: import('../src/protocol.ts').Message[] };
  const notices = history.messages.filter(m => m.kind === 'session-waiting' && m.detail?.session === 'low-memory');
  assert.equal(notices.length, 3);
  assert.deepEqual(notices.map(m => m.detail?.end ?? m.detail?.reason), ['waiting for a host: host a, available memory 1200000000 bytes', 'waiting for a host: host a, available memory 1250000000 bytes', 'placed']);
  assert.deepEqual(events.filter(e => e.event === 'session-waiting').map(e => e.end ?? e.reason), [
    'waiting for a host: host a, available memory 1200000000 bytes',
    'waiting for a host: host a, available memory 1250000000 bytes', 'placed']);
});

test('a ready host leaving capacity changes a memory wait without polling', async t => {
  const { HostMemoryFloorRefusal } = await import('../src/host/ssh-host.ts');
  const events: Record<string, unknown>[] = [];
  const f = await fixture(t, entry => events.push(entry));
  f.records.provisions.save({ ...f.records.provisions.get('b')!, state: 'cloning' });
  const adapter = f.hub.fakes.codex!, spawn = adapter.spawn.bind(adapter);
  adapter.spawn = async () => { throw new HostMemoryFloorRefusal('a', { code: 'memory-floor', availableBytes: 1, floorBytes: 1300000000 }); };
  f.cleanup(() => { adapter.spawn = spawn; });
  await f.launch('queued');
  const changed = observe(f.cleanup, 'departure reason observed', () => events.find(e => e.event === 'session-waiting' && e.reason === 'waiting for host b to boot'));
  f.records.provisions.save({ ...f.records.provisions.get('a')!, state: 'destroying' });
  await changed;
  const list = (await f.ui.request({ type: 'session.list' })).value as { waiting: Array<{reason:string}> };
  assert.equal(list.waiting[0]?.reason, 'waiting for host b to boot');
  assert.equal(adapter.spawns.length, 0);
});

test('CLI prints waiting, lists its status and cancels with stop', async t => {
  const f = await fixture(t);
  for (const name of ['one','two','three','four']) await f.launch(name);
  const result = await cland(f.root, 'session', 'launch', 'queued-cli', '--role', 'implementer', '--harness', 'codex');
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /waiting: waiting for a login codex/);
  const list = await cland(f.root, 'session', 'list');
  assert.equal(list.code, 0, list.stderr);
  assert.match(list.stdout, /queued-cli.*pool agents: waiting for a login codex/);
  const stop = await cland(f.root, 'session', 'stop', 'queued-cli');
  assert.equal(stop.code, 0, stop.stderr);
  assert.match(stop.stdout, /cancelled queued-cli/);
});

test('a placed waiting launch admits its credential-proven early hello', async t => {
  const failures: unknown[] = [];
  const f = await fixture(t, entry => { if (/refus|fail/.test(String(entry.event))) failures.push(entry); });
  for (const name of ['one','two','three','four']) await f.launch(name);
  await f.launch('queued');
  const adapter = f.hub.fakes.codex!, spawn = adapter.spawn.bind(adapter);
  let earlyPeer: Awaited<ReturnType<typeof inProcessSpoke>> | undefined;
  adapter.spawn = async (request, ...rest) => {
    const row = await spawn(request, ...rest);
    if (request.name === 'queued') {
      const peer = earlyPeer = await inProcessSpoke(t, { discover: true, cwd: f.root, name: request.name, assignRole: false, sessionId: row.sessionId, launchToken: request.launchToken! });
      await peer.waitForPresence(['queued']);
    }
    return row;
  };
  f.cleanup(async () => { try { await earlyPeer?.close(); await f.ui.request({ type: 'session.stop', session: 'queued' }); } finally { adapter.spawn = spawn; } });
  const placed = observe(f.cleanup, 'credentialed waiting process published', async () => {
    const list = (await f.ui.request({ type: 'session.list' })).value as { processes: import('../src/protocol.ts').HarnessProcessView[] };
    return list.processes.find(p => p.name === 'queued');
  });
  f.hub.fakes.codex!.exit('one');
  try { assert.equal((await placed).name, 'queued'); } catch (error) { throw new Error(`${String(error)}: ${JSON.stringify(failures)}`); }
});

test('stop joins a waiting retry held before native admission', async t => {
  const f = await fixture(t);
  for (const name of ['one','two','three','four']) await f.launch(name);
  await f.launch('queued');
  const adapter = f.hub.fakes.codex!, spawn = adapter.spawn.bind(adapter), gate = Promise.withResolvers<void>();
  let entered = false, stop: ReturnType<typeof f.ui.request> | undefined;
  adapter.spawn = async (...args) => { if (args[0].name === 'queued') { entered = true; await gate.promise; args[2]?.(); } return spawn(...args); };
  f.cleanup(async () => { gate.resolve(); try { await (stop ?? f.ui.request({ type: 'session.stop', session: 'queued' })); } finally { adapter.spawn = spawn; } });
  f.hub.fakes.codex!.exit('one');
  await eventually('queued adapter preparation entered', () => entered ? true : undefined);
  stop = f.ui.request({ type: 'session.stop', session: 'queued' });
  const during = await f.launch('queued');
  assert.equal(during.ok, false);
  gate.resolve();
  assert.equal((await stop).ok, true);
  const listed = (await f.ui.request({ type: 'session.list' })).value as { waiting: unknown[]; processes: Array<{ name: string }> };
  assert.deepEqual(listed.waiting, []);
  assert.equal(listed.processes.some(p => p.name === 'queued'), false);
  assert.equal(adapter.spawns.some(p => p.name === 'queued'), false);
});

test('Coordinator tools return waiting and cancel it through session.stop', async t => {
  const f = await fixture(t);
  for (const name of ['one','two','three','four']) await f.launch(name);
  const coordinator = await inProcessSpoke(t, { discover: true, cwd: f.root, name: 'coord', role: 'coordinator', sessionId: 'waiting-coordinator' });
  await coordinator.waitForPresence(['coord']);
  const reply = await coordinator.call<{ok:boolean;error?:string;waiting?:unknown}>('session.launch', { name:'tool-wait', role:'implementer', harness:'codex' });
  assert.equal(reply.ok, true, reply.error);
  assert.ok(reply.waiting);
  const stop = await coordinator.call<{ok:boolean;error?:string;cancelled?:{name:string}}>('session.stop', {session:'tool-wait'});
  assert.equal(stop.ok, true, stop.error);
  assert.equal(stop.cancelled?.name,'tool-wait');
});

test('capacity released between selection failure and wait insertion is rechecked', async t => {
  let release = false;
  const f = await fixture(t, entry => {
    if (release && entry.event === 'role-admission-released' && entry.session === 'queued') {
      release = false;
      f.hub.fakes.codex!.exit('one');
    }
  });
  for (const name of ['one','two','three','four']) await f.launch(name);
  const placed = observe(f.cleanup, 'insertion recheck publishes process', async () => {
    const list = (await f.ui.request({ type: 'session.list' })).value as { processes: Array<{name:string}> };
    return list.processes.find(p => p.name === 'queued');
  });
  release = true;
  const reply = await f.launch('queued');
  assert.equal(reply.ok, true, reply.error);
  assert.equal((await placed).name, 'queued');
});

test('failed unpublished placement releases its promise and wakes a waiting launch', async t => {
  let rechecks = 0;
  const f = await fixture(t, entry => { if (entry.event === 'role-admission-released' && entry.session === 'queued') rechecks++; });
  f.records.provisions.save({ ...f.records.provisions.get('b')!, state: 'cloning' });
  await f.ui.request({ type: 'config.set', key: 'hosts.agents.slots', value: 0.5 });
  const adapter = f.hub.fakes.codex!, spawn = adapter.spawn.bind(adapter), gate = Promise.withResolvers<void>();
  let entered = false, first: ReturnType<typeof f.launch> | undefined;
  adapter.spawn = async (...args) => {
    if (args[0].name === 'held') { entered = true; await gate.promise; throw new Error('unpublished fixture refusal'); }
    return spawn(...args);
  };
  f.cleanup(async () => { gate.resolve(); try { await first; await f.ui.request({ type: 'session.stop', session: 'queued' }); } finally { adapter.spawn = spawn; } });
  first = f.launch('held');
  await eventually('placement promise held in adapter', () => entered ? true : undefined);
  assert.equal((await f.launch('queued')).ok, true);
  await eventually('queued selection retried while promise remains held', () => rechecks >= 2 ? true : undefined);
  const placed = observe(f.cleanup, 'promise release publishes queued process', async () => {
    const list = (await f.ui.request({ type: 'session.list' })).value as { processes: Array<{name:string}> };
    return list.processes.find(p => p.name === 'queued');
  });
  gate.resolve();
  assert.equal((await first).ok, false);
  assert.equal((await placed).name, 'queued');
});

test('cancelling idle B does not join unrelated held retry A', async t => {
  const f = await fixture(t);
  for (const name of ['one','two','three','four']) await f.launch(name);
  await f.launch('queued-a'); await f.launch('queued-b');
  const adapter = f.hub.fakes.codex!, spawn = adapter.spawn.bind(adapter), gate = Promise.withResolvers<void>();
  let entered = false, stopping: ReturnType<typeof f.ui.request> | undefined;
  adapter.spawn = async (...args) => { if (args[0].name === 'queued-a') { entered = true; await gate.promise; args[2]?.(); } return spawn(...args); };
  f.cleanup(async () => { gate.resolve(); try { await stopping?.catch(() => {}); await f.ui.request({ type:'session.stop', session:'queued-a' }); } finally { adapter.spawn = spawn; } });
  f.hub.fakes.codex!.exit('one');
  await eventually('A retry held before native admission', () => entered ? true : undefined);
  stopping = f.ui.request({ type:'session.stop', session:'queued-b' });
  const result = await stopping;
  assert.equal(result.ok, true, result.error);
  const list = (await f.ui.request({ type:'session.list' })).value as { waiting: Array<{name:string}> };
  assert.deepEqual(list.waiting.map(row => row.name), ['queued-a']);
  gate.resolve();
});

const WAITING_SHUTDOWN_BOUND_MS = testWaitMs() + 5_000;
test('shutdown closes the registered adapter before joining its held waiting retry', { timeout: WAITING_SHUTDOWN_BOUND_MS }, async t => {
  const f = await fixture(t);
  for (const name of ['one','two','three','four']) await f.launch(name);
  await f.launch('queued');
  const adapter = f.hub.fakes.codex!, spawn = adapter.spawn.bind(adapter), close = adapter.close.bind(adapter), gate = Promise.withResolvers<void>();
  let entered = false, closed = false, stopping: Promise<void> | undefined;
  adapter.spawn = async (...args) => { if (args[0].name === 'queued') { entered = true; await gate.promise; args[2]?.(); } return spawn(...args); };
  adapter.close = () => { closed = true; gate.resolve(); return close(); };
  // The test deadline abort is an incomplete outcome; it still releases and joins every writer.
  const abort = () => gate.resolve();
  t.signal.addEventListener('abort', abort, { once: true });
  f.cleanup(async () => { gate.resolve(); try { await stopping; } finally { t.signal.removeEventListener('abort', abort); adapter.spawn = spawn; adapter.close = close; } });
  f.hub.fakes.codex!.exit('one');
  await eventually('waiting retry admitted into adapter preparation', () => entered ? true : undefined);
  stopping = f.hub.stop();
  await stopping;
  assert.equal(closed, true);
  assert.equal(adapter.spawns.some(row => row.name === 'queued'), false);
});

test('positive failed-launch cleanup frees capacity without another process status', async t => {
  const { ProcessTable } = await import('../src/adapters/processes.ts');
  let rechecks = 0;
  const f = await fixture(t, entry => { if (entry.event === 'role-admission-released' && entry.session === 'queued') rechecks++; if (entry.event === 'session-launched' && entry.session === 'failed') throw new Error('publication fixture fault'); });
  f.records.provisions.save({ ...f.records.provisions.get('b')!, state: 'cloning' });
  await f.ui.request({ type:'config.set', key:'hosts.agents.slots', value:0.5 });
  const adapter = f.hub.fakes.codex!, spawn = adapter.spawn.bind(adapter), stop = adapter.stop.bind(adapter);
  let present = true;
  f.hosts[0]!.processes = async () => present ? [{ pid:4242, parent:1, rssBytes:0, cpuPercent:0 }] : [];
  adapter.spawn = async (...args) => ({ ...await spawn(...args), pid:4242, pidStarted:null, pidIdentity:'linux:waiting-fixture:4242' });
  adapter.stop = async () => { throw new Error('native stop initially unknown'); };
  f.cleanup(() => { adapter.spawn = spawn; adapter.stop = stop; });
  assert.equal((await f.launch('failed')).ok, false);
  adapter.spawn = spawn;
  assert.equal((await f.launch('queued')).ok, true);
  await eventually('failed native generation still holds capacity after recheck', () => rechecks >= 2 ? true : undefined);
  const table = new ProcessTable(join(f.root,'.cland/hub.db'));
  f.cleanup(() => table.close());
  const placed = observe(f.cleanup, 'native cleanup checkpoint places queued launch', async () => {
    const list = (await f.ui.request({ type:'session.list' })).value as { processes:Array<{name:string}> };
    return list.processes.find(p => p.name === 'queued');
  });
  present = false;
  adapter.exit('failed');
  assert.equal((await placed).name,'queued');
  await eventually('pending cleanup durable removal', () => table.pendingStops().length === 0 ? true : undefined);
  assert.deepEqual(table.pendingStops(), []);
});

test('retained-generation positive closure wakes a launch after the earlier exit', async t => {
  const { ProcessTable } = await import('../src/adapters/processes.ts');
  let native: import('../src/adapters/contract.ts').AdapterHost | undefined, rechecks = 0;
  const f = await fixture(t, entry => { if (entry.event === 'role-admission-released' && entry.session === 'queued') rechecks++; }, host => { native = host; });
  f.records.provisions.save({ ...f.records.provisions.get('b')!, state:'cloning' });
  await f.ui.request({ type:'config.set', key:'hosts.agents.slots', value:0.5 });
  const adapter = f.hub.fakes.codex!;
  Object.assign(adapter, { releaseHostGeneration: async () => {} });
  assert.equal((await f.launch('retained')).ok,true);
  const table = new ProcessTable(join(f.root,'.cland/hub.db'));
  f.cleanup(() => table.close());
  const process = table.get('retained')!;
  table.retainHostGeneration(process,'unknown');
  adapter.exit('retained');
  assert.equal((await f.launch('queued')).ok,true);
  await eventually('unknown generation still holds capacity after recheck', () => rechecks >= 2 ? true : undefined);
  const placed = observe(f.cleanup, 'retained native closure places queued launch', async () => {
    const list = (await f.ui.request({ type:'session.list' })).value as { processes:Array<{name:string}> };
    return list.processes.find(p => p.name === 'queued');
  });
  native!.hostGenerationClosed!(process);
  assert.equal((await placed).name,'queued');
});

test('an admitted Coordinator wait survives its requesting spoke disconnecting', async t => {
  const f = await fixture(t);
  for (const name of ['one','two','three','four']) await f.launch(name);
  const coordinator = await inProcessSpoke(t, { discover:true, cwd:f.root, name:'coord', role:'coordinator', sessionId:'waiting-disconnected-coordinator' });
  await coordinator.waitForPresence(['coord']);
  const reply = await coordinator.call<{ok:boolean;error?:string;waiting?:unknown}>('session.launch', {name:'queued',role:'implementer',harness:'codex'});
  assert.equal(reply.ok,true,reply.error); assert.ok(reply.waiting);
  await coordinator.close();
  const placed = observe(f.cleanup, 'admitted disconnected actor launch published', async () => {
    const list = (await f.ui.request({type:'session.list'})).value as {processes:Array<{name:string}>};
    return list.processes.find(p => p.name === 'queued');
  });
  f.hub.fakes.codex!.exit('one');
  assert.equal((await placed).name,'queued');
});

test('an admitted wait rechecks its durable actor grant after disconnect', async t => {
  const events: Record<string, unknown>[] = [];
  const f = await fixture(t, entry => events.push(entry));
  for (const name of ['one','two','three','four']) await f.launch(name);
  const coordinator = await inProcessSpoke(t, { discover:true, cwd:f.root, name:'coord', role:'coordinator', sessionId:'waiting-revoked-coordinator' });
  await coordinator.waitForPresence(['coord']);
  assert.equal((await coordinator.call<{ok:boolean}>('session.launch', {name:'queued',role:'implementer',harness:'codex'})).ok,true);
  await coordinator.close();
  assert.equal((await f.ui.request({type:'role.clear',session:'coord'})).ok,true);
  const refused = observe(f.cleanup, 'revoked admitted actor refusal recorded', () => events.find(e => e.event === 'waiting-launch-refused' && e.session === 'queued'));
  f.hub.fakes.codex!.exit('one');
  await refused;
  const list = (await f.ui.request({type:'session.list'})).value as {waiting:unknown[];processes:Array<{name:string}>};
  assert.deepEqual(list.waiting,[]);
  assert.equal(list.processes.some(p => p.name === 'queued'),false);
  assert.equal(f.hub.fakes.codex!.spawns.some(p => p.name === 'queued'),false);
});

test('an accepted wait pins its admitted pool after the role default changes', async t => {
  const events: Record<string, unknown>[] = [];
  const f = await fixture(t, entry => events.push(entry));
  for (const name of ['one','two','three','four']) await f.launch(name);
  const queued = await f.launch('queued');
  assert.equal((queued.value as {waiting:{pool:string}}).waiting.pool,'agents');
  await f.roles('other');
  const placed = observe(f.cleanup, 'admitted pool placement published', async () => {
    const list = (await f.ui.request({type:'session.list'})).value as {processes:import('../src/protocol.ts').HarnessProcessView[]};
    return list.processes.find(p => p.name === 'queued');
  });
  f.hub.fakes.codex!.exit('one');
  assert.equal((await placed).host,'a');
  const waiting = events.filter(e => e.event === 'session-waiting' && e.session === 'queued');
  assert.ok(waiting.every(e => e.pool === 'agents' && !String(e.reason).includes('other')));
  assert.equal((await f.launch('new-worker')).ok,true);
  assert.equal(f.hub.fakes.codex!.spawns.at(-1)!.host,'c');
});

test('removing the pinned pool ends a wait once with its named notice', async t => {
  const f = await fixture(t);
  for (const name of ['one','two','three','four']) await f.launch(name);
  await f.launch('queued');
  const ended = observe(f.cleanup, 'removed pool terminal notice published', async () => {
    const history = (await f.ui.request({type:'topic.history',topic:'agents',limit:100})).value as {messages:import('../src/protocol.ts').Message[]};
    return history.messages.find(m => m.kind === 'session-waiting' && m.detail?.session === 'queued' && /agents/.test(m.text) && /removed/.test(m.text));
  });
  const configPath = join(f.root,'.cland/config.toml');
  const before = await readFile(configPath,'utf8');
  assert.match(before, /\[hosts\.agents\]/);
  await writeFile(configPath, before.replace(/\[hosts\.agents\][\s\S]*?(?=\n\[|$)/, ''));
  const reload = await f.ui.request({type:'hub.reload'});
  assert.equal(reload.ok,true,reload.error);
  await ended;
  const list = (await f.ui.request({type:'session.list'})).value as {waiting:unknown[]};
  assert.deepEqual(list.waiting,[]);
  assert.deepEqual(((await f.ui.request({type:'inbox.list'})).value as import('../src/protocol.ts').Inbox).waitingLaunches,[]);
  await f.roles('other');
  assert.equal((await f.launch('queued')).ok,true);
  assert.equal(f.hub.fakes.codex!.spawns.at(-1)!.host,'c');
  await f.ui.request({type:'config.set',key:'hosts.other.spread',value:true});
  const history = (await f.ui.request({type:'topic.history',topic:'agents',limit:100})).value as {messages:import('../src/protocol.ts').Message[]};
  const endedNotices = history.messages.filter(m => m.kind === 'session-waiting' && m.detail?.session === 'queued' && /removed/.test(m.text));
  assert.equal(endedNotices.length,1);
  assert.match(endedNotices[0]!.text,/queued.*agents.*removed/);
});
