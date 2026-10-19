// T2: provider-list races and foreign lease/key ownership use scripted machines.
// Candidate, snapshot and process facts are injected; no hub, spoke, SSH or watchdog child.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './remote-fixture.ts';
import { projectHub, tempProject, eventually, flushProjectLogs } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { cancelAndDrain, type OwnedRemoteRun } from './remote-cleanup.ts';
import type { TestContext } from 'node:test';
import { drive } from './remote-clock.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import type { Lease, RunRef } from '../src/executor/executor.ts';
import { warningSeverity } from '../src/hub/visibility.ts';
import type { HubStatus } from '../src/protocol.ts';
import { projectTag } from '../src/executor/droplet/droplet.ts';
import { readLeases, writeLease, type DropletLease } from '../src/executor/droplet/lease.ts';

async function lease(root: string): Promise<{ value: DropletLease; path: string }> {
  const dir = join(root, '.cland/run/executor/leases');
  const ids = await readdir(dir);
  const records = await Promise.all(ids.map(async id => { const path = join(dir, id, 'lease.json'); return { path, value: JSON.parse(await readFile(path, 'utf8')) as DropletLease }; }));
  return records.sort((a, b) => a.value.created.localeCompare(b.value.created)).at(-1)!;
}
// Bound native receipts independently of downstream report publication.
async function receipt<T>(what: string, work: Promise<T>): Promise<T> {
  let done = false;
  const completed = work.finally(() => { done = true; });
  void completed.catch(() => {});
  await eventually(what, () => done ? true : undefined);
  return completed;
}
async function finish(f: Awaited<ReturnType<typeof fixture>>, id: string) {
  await receipt('remote start persisted', f.machine.started(id));
  await receipt('remote admission settled', f.verificationSettled());
  // Complete the scripted worker explicitly, then observe its done receipt.
  // A scheduler tick is permission to collect that receipt, not worker completion.
  f.machine.finish(id);
  const record = (await readLeases(f.root)).find(lease => lease.run === id)!;
  const completed = await receipt('remote worker completion', f.dependencies.run!.status(record));
  assert.equal(completed.state, 'done');
  await f.clock.advance(1000);
  await receipt('remote completion collected', f.verificationSettled());
  return f.result(id);
}

async function sameNameCase(t: TestContext, failBeforeRelease = false) {
  const state = await tempProject(t, 'key-host-state-');
  // Ownership is swept explicitly below; periodic sweeps must not race the
  // native spend-ledger writes while this test controls worker completion.
  const first = await fixture(t, { machine: 'scripted', script: { afterMs: 5000 }, name: 'same', env: { CLAND_EXECUTOR_STATE: state, CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  const second = await fixture(t, { machine: 'scripted', script: { outcome: 'slow' }, clock: first.clock, name: 'same', api: first.api, env: { CLAND_EXECUTOR_STATE: state, CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
  const startEntered = Promise.withResolvers<void>();
  const startRelease = Promise.withResolvers<void>();
  const start = second.dependencies.run!.start;
  t.mock.method(second.dependencies.run!, 'start', async (...args: Parameters<typeof start>) => {
    startEntered.resolve();
    await startRelease.promise;
    return start(...args);
  });
  let resume!: () => void;
  const blocked = new Promise<void>(resolve => { resume = resolve; });
  let creates = 0;
  first.api.beforeCreate(() => { creates++; return blocked; });
  const runs: OwnedRemoteRun[] = [];
  let cleanupWork: ReturnType<typeof cancelAndDrain> | undefined;
  const cleanup = () => cleanupWork ??= cancelAndDrain(runs, () => { resume(); startRelease.resolve(); });
  onCleanup(t, cleanup);
  try {
    const a = await first.launch(); runs.push({ fixture: first, id: a.id });
    // Leave the first acquisition in flight at provider create before admitting
    // the second, so neither needs a shared spend-lock retry during native I/O.
    await eventually('first create blocked', () => creates === 1 ? true : undefined);
    const b = await second.launch(); runs.push({ fixture: second, id: b.id });
    await eventually('both creates blocked with durable key identities', () => creates === 2 ? true : undefined);
    const left = await lease(first.root); const right = await lease(second.root);
    const tagA = projectTag(first.root, 'same'), tagB = projectTag(second.root, 'same');
    assert.ok(left.value.keyName.startsWith(`${tagA}-`)); assert.ok(right.value.keyName.startsWith(`${tagB}-`));
    assert.notEqual(tagA, tagB);
    for (const f of [first, second]) assert.equal((await f.ui.request({ type: 'executor.reap' })).ok, true);
    assert.equal(first.api.keys.length, 2);
    if (failBeforeRelease) assert.fail('controlled pre-start assertion failure');

    // The other project's live legacy lease is old enough but still protects its key.
    const foreignKey = first.api.keys.find(key => key.name === right.value.keyName)!;
    const originalName = foreignKey.name;
    right.value.keyName = 'cland-same-live'; right.value.keyImportStarted = new Date(first.clock.now().getTime() - 3600000).toISOString();
    await writeLease(second.root, right.value);
    // A list taken before the rename can still carry the old name. The imported
    // key's stable provider id must protect it across that observation window.
    assert.equal((await first.ui.request({ type: 'executor.reap' })).ok, true);
    assert.ok(first.api.keys.some(key => key.id === foreignKey.id), 'a live key survives a stale provider name');
    foreignKey.name = right.value.keyName;
    const old = new Date(first.clock.now().getTime() - 3600000).toISOString();
    for (const [id, name, created] of [[8100, 'cland-same-old', old], [8101, 'cland-same-young', first.clock.now().toISOString()]] as const) {
      first.api.keys.push({ id, name, public_key: 'public' });
      const history: DropletLease = { ...left.value, lease: `legacy-${id}`, keyName: name, keyImportStarted: created, created, state: 'released', resource: null, costUsd: 0, released: created };
      delete history.watchdog; delete history.execution;
      await writeLease(second.root, history);
    }
    first.api.keys.push({ id: 8102, name: 'cland-same-unknown-age', public_key: 'public' });
    assert.equal((await first.ui.request({ type: 'executor.reap' })).ok, true);
    assert.ok(!first.api.keys.some(key => key.id === 8100));
    assert.ok(first.api.keys.some(key => key.id === 8101)); assert.ok(first.api.keys.some(key => key.id === 8102));
    assert.ok(first.api.keys.some(key => key.name === 'cland-same-live'));
    foreignKey.name = originalName; right.value.keyName = originalName; delete right.value.keyImportStarted;
    await writeLease(second.root, right.value);
    const beforeStarts = first.clock.now().getTime();
    resume();
    let ready = false;
    const readiness = Promise.all([first.machine.started(a.id), second.machine.started(b.id)])
      .then(() => Promise.all([first.verificationSettled(), second.verificationSettled()]))
      .then(() => { ready = true; });
    try {
      await receipt('second native start entered', startEntered.promise);
      await receipt('first start persisted while second is held', first.machine.started(a.id));
      // A native socket round trip progresses both hubs while second's admitted
      // start remains held. Readiness must not drive their shared product clock.
      assert.equal((await first.ui.request({ type: 'suite.queue' })).ok, true);
      assert.equal(ready, false);
      assert.equal(first.clock.now().getTime(), beforeStarts);
    } finally { startRelease.resolve(); }
    await receipt('both starts and admission persisted', readiness);
    await finish(first, a.id); await finish(second, b.id);
    assert.deepEqual(first.api.droplets, []);
  } catch (error) {
    if (!failBeforeRelease) for (const f of [first, second]) {
      await flushProjectLogs(t, f.root);
      t.diagnostic((await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).split('\n').filter(line => /executor-|suite-/.test(line)).join('\n'));
    }
    throw error;
  } finally {
    const reports = await cleanup();
    if (failBeforeRelease) {
      for (const f of [first, second]) assert.equal(f.machine.calls.filter(call => call.step === 'start').length, 0);
      assert.equal(reports.length, 2);
      for (const report of reports) assert.match(report.text, /cancelled/);
      assert.deepEqual(first.api.droplets, []);
      assert.deepEqual(first.api.keys, []);
    }
  }
}

test('same-name hubs preserve each other’s in-flight keys and conservatively age legacy keys', t => sameNameCase(t));

test('a pre-start assertion failure drains both same-name acquisitions without start receipts', { timeout: 30000 }, async t => {
  await assert.rejects(sameNameCase(t, true), /controlled pre-start assertion failure/);
});

test('a short-lived hub preserves a foreign live lease beyond its own lifetime threshold', async t => {
  const state = await tempProject(t, 'foreign-lifetime-');
  const short = await fixture(t, { machine: 'scripted', env: { CLAND_EXECUTOR_STATE: state } });
  const long = await fixture(t, { machine: 'scripted', api: short.api, config: 'lifetime="110m"\nrun_timeout="75m"', env: { CLAND_EXECUTOR_STATE: state } });
  const run = await long.launch(); await drive(long, long.machine.started(run.id));
  const record = await lease(long.root);
  const droplet = short.api.droplets.find(d => d.id === record.value.resource)!;
  droplet.created_at = new Date(short.clock.now().getTime() - 30 * 60000).toISOString();
  assert.equal((await short.ui.request({ type: 'executor.reap' })).ok, true);
  assert.ok(short.api.droplets.some(d => d.id === droplet.id));
  assert.ok(!short.api.requests.some(r => r.method === 'DELETE' && r.path === `/v2/droplets/${droplet.id}`));
  await finish(long, run.id);
});

test('provider list awaits cannot turn a concurrently acquired droplet or key into an orphan', async t => {
  for (const kind of ['droplet', 'key'] as const) await t.test(kind, async t => {
    const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_EXECUTOR_SWEEP_MS: '600000' } });
    let entered = false, resume!: () => void, allowCreate!: () => void;
    const blocked = new Promise<void>(resolve => { resume = resolve; });
    const create = new Promise<void>(resolve => { allowCreate = resolve; });
    t.after(() => { resume(); allowCreate(); });
    const barrier = async () => { if (entered) return; entered = true; await blocked; };
    if (kind === 'droplet') f.api.beforeDropletList(barrier);
    else { f.api.beforeKeyList(barrier); f.api.beforeCreate(() => create); }
    let run: Awaited<ReturnType<typeof f.launch>> | undefined;
    try {
      const reap = f.ui.request({ type: 'executor.reap' });
      await eventually('provider list is in flight', () => entered ? true : undefined);
      run = await f.launch();
      if (kind === 'key') await eventually('new key imported during list', () => f.api.keys.length === 1 ? true : undefined);
      else await drive(f, f.machine.started(run.id));
      const record = await lease(f.root);
      resume();
      assert.equal((await reap).ok, true);
      if (kind === 'key') {
        assert.ok(f.api.keys.some(key => key.name === record.value.keyName));
        assert.ok(!f.api.requests.some(r => r.method === 'DELETE' && r.path === `/v2/account/keys/${record.value.keyId}`));
        allowCreate();
      } else {
        assert.ok(f.api.droplets.some(d => d.id === record.value.resource));
        assert.ok(!f.api.requests.some(r => r.method === 'DELETE' && r.path === `/v2/droplets/${record.value.resource}`));
      }
      await finish(f, run.id);
      assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
    } finally {
      resume(); allowCreate();
      if (run) await f.ui.request({ type: 'suite.cancel', suite: run.id });
      await f.stop();
    }
  });
});


// Fallback policy consumes a completed local executor receipt; worker execution is T3.
function localReceipts(t: TestContext, beforeReceipt?: () => Promise<void>) {
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => false);
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  const completed = new Set<string>();
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => {
    await beforeReceipt?.();
    await writeFile(run.result, JSON.stringify({ code: 0, finished: new Date('2026-10-16T12:00:00Z').toISOString() }));
    completed.add(run.id);
  });
  return (id: string) => completed.has(id);
}
type Ledger = { entries: { run: string; reservation: number; cost: number | null }[] };
const ledger = async (state: string): Promise<Ledger> => JSON.parse(await readFile(join(state, 'spend.json'), 'utf8'));

test('invalid timeout margins refuse hub startup with both values', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[verification]\ntest="true"\nlifetime="15m"\nrun_timeout="6m"');
  await assert.rejects(projectHub(t, root), /lifetime 15m.*run_timeout 6m/);
});

test('all remote admission refusals persist a local job, one warn notice and one journal event', async t => {
  const localDone = localReceipts(t);
  const f = await fixture(t, { machine: 'scripted' });
  f.api.faults.create = 422; f.api.faults.echoToken = true;
  const run = await f.launch();
  await drive(f, eventually('fallback is durably local', async () => { const status = (await f.ui.request({ type: 'hub.status' })).value as HubStatus; return status.suites!.find(job => job.id === run.id)?.executor === 'local' ? true : undefined; }));
  await f.clock.advance(1000);
  await drive(f, eventually('local completion receipt', async () => { await f.ui.request({ type: 'suite.queue' }); return localDone(run.id) ? true : undefined; }));
  await f.clock.advance(1000);
  assert.match((await f.result(run.id)).text, /Executor local/);
  const status = (await f.ui.request({ type: 'hub.status', flushLogs: true })).value as HubStatus;
  assert.equal(status.suites!.find(s => s.id === run.id)!.executor, 'local');
  const history = ((await f.ui.request({ type: 'topic.history', topic: f.topic })).value as { messages: { text: string; severity?: string }[] }).messages;
  const notices = history.filter(m => m.text.includes('droplet unavailable'));
  assert.equal(notices.length, 1); assert.equal(notices[0]!.severity, 'warn');
  assert.match(notices[0]!.text, /422/);
  const journal = (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(journal.filter(r => r.event === 'verification-executor-fallback' && r.id === run.id).length, 1);
  assert.equal(warningSeverity('inbox', { kind: 'executor-fallback' }), 'warn');
  const events = JSON.stringify((await f.ui.request({ type: 'events.list' })).value);
  assert.ok(events.includes('droplet unavailable')); assert.ok(events.includes('"warning":true'));
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  assert.deepEqual(f.api.droplets, []); assert.deepEqual(f.api.keys, []);
});

// Each step follows the previous scheduler/sweep completion receipt. Topic reads
// alone cannot admit time: persistence may still be pending on either shared hub.
async function scriptedResult(f: Awaited<ReturnType<typeof fixture>>, id: string, peers = [f]) {
  const settled = async () => {
    let before: number;
    do {
      before = f.clock.now().getTime();
      for (const peer of peers) await drive(peer, peer.verificationSettled());
      // A product-requested delay on a later peer can admit work on an earlier one.
    } while (f.clock.now().getTime() !== before);
  };
  return eventually('scripted suite report', async () => {
    await settled();
    const prior = (await f.messages(id))[0];
    if (prior) return prior;
    await f.clock.advance(1000);
    await settled();
    return (await f.messages(id))[0];
  });
}

test('scripted report steps freeze time while an admitted worker receipt is held', async t => {
  const receipt = Promise.withResolvers<void>();
  let entered = false;
  localReceipts(t, () => { entered = true; return receipt.promise; });
  const f = await fixture(t, { machine: 'scripted', executor: 'local' });
  onCleanup(t, () => receipt.resolve());
  const launching = f.launch();
  await eventually('worker receipt is held', () => entered ? true : undefined);
  const status = (await f.ui.request({ type: 'hub.status' })).value as HubStatus;
  const id = status.suites![0]!.id;
  const settle = f.verificationSettled;
  let joined = false, completed = false;
  t.mock.method(f, 'verificationSettled', async () => { joined = true; await settle(); completed = true; });
  const before = f.clock.now().getTime();
  const reporting = scriptedResult(f, id);
  try {
    assert.equal(joined, true, 'report driver joins admitted scheduler I/O before stepping');
    // A native socket round trip progresses I/O while the scheduler remains held.
    assert.equal((await f.ui.request({ type: 'suite.queue' })).ok, true);
    assert.equal(completed, false);
    assert.equal(f.clock.now().getTime(), before);
    assert.deepEqual(await f.messages(id), []);
  } finally { receipt.resolve(); await Promise.allSettled([launching, reporting]); }
  await launching;
  assert.match((await reporting).text, /Executor local/);
  assert.equal(completed, true);
});

test('two protocol projects reserve against one cap and confirmed release replaces the reservation', async t => {
  const localDone = localReceipts(t);
  const state = await tempProject(t, 'shared-spend-');
  const first = await fixture(t, { machine: 'scripted', script: { outcome: 'slow' }, config: 'lifetime="15m"\nrun_timeout="5m"\ndaily_spend_usd=0.063', env: { CLAND_EXECUTOR_STATE: state } });
  const run = await first.launch(); await drive(first, first.machine.started(run.id));
  assert.equal((await ledger(state)).entries[0]!.reservation, 0.0625);
  assert.equal((await ledger(state)).entries[0]!.cost, null);
  const second = await fixture(t, { machine: 'scripted', clock: first.clock, config: 'lifetime="15m"\nrun_timeout="5m"\ndaily_spend_usd=0.063', env: { CLAND_EXECUTOR_STATE: state } });
  const refused = await second.launch();
  await drive(second, eventually('fallback is durably local', async () => { const status = (await second.ui.request({ type: 'hub.status' })).value as HubStatus; return status.suites!.find(job => job.id === refused.id)?.executor === 'local' ? true : undefined; }));
  await second.clock.advance(1000);
  await drive(second, eventually('refused project local completion receipt', async () => { await second.ui.request({ type: 'suite.queue' }); return localDone(refused.id) ? true : undefined; }));
  assert.match((await scriptedResult(second, refused.id, [first, second])).text, /Executor local/);
  const history = JSON.stringify((await second.ui.request({ type: 'topic.history', topic: second.topic })).value);
  assert.match(history, /daily spend cap \$0.063 reached/);
  assert.equal(second.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
  first.api.faults.deleteError = 503;
  first.machine.finish(run.id);
  await first.clock.advance(1000);
  await drive(first, eventually('release stays reserved', async () => (await lease(first.root)).value.state === 'releasing' ? true : undefined));
  assert.equal((await ledger(state)).entries[0]!.cost, null);
  first.api.faults.deleteError = 0;
  await scriptedResult(first, run.id, [first, second]);
  const entry = (await ledger(state)).entries[0]!;
  assert.ok(entry.cost! > 0 && entry.cost! < entry.reservation);
  const status = (await second.ui.request({ type: 'executor.status' })).value as { spend: { path: string; spent: number; reserved: number; cap: number } };
  assert.equal(status.spend.path, join(state, 'spend.json'));
  assert.equal(status.spend.spent, entry.cost); assert.equal(status.spend.reserved, 0); assert.equal(status.spend.cap, 0.063);
});

