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
import { writeLease, type DropletLease } from '../src/executor/droplet/lease.ts';

async function lease(root: string): Promise<{ value: DropletLease; path: string }> {
  const dir = join(root, '.cland/run/executor/leases');
  const ids = await readdir(dir);
  const records = await Promise.all(ids.map(async id => { const path = join(dir, id, 'lease.json'); return { path, value: JSON.parse(await readFile(path, 'utf8')) as DropletLease }; }));
  return records.sort((a, b) => a.value.created.localeCompare(b.value.created)).at(-1)!;
}
async function finish(f: Awaited<ReturnType<typeof fixture>>, id: string) {
  await drive(f, f.machine.started(id));
  await eventually('remote execution is durably queued', async () => {
    const status = (await f.ui.request({ type: 'hub.status' })).value as { suites: { id: string; state: string }[] };
    return status.suites.some(run => run.id === id && (run.state === 'running' || run.state === 'finished')) ? true : undefined;
  });
  await f.clock.advance(1000);
  return f.result(id);
}

async function sameNameCase(t: TestContext, failBeforeRelease = false) {
  const state = await tempProject(t, 'key-host-state-');
  const first = await fixture(t, { machine: 'scripted', name: 'same', env: { CLAND_EXECUTOR_STATE: state, CLAND_TEST_EXECUTOR_SWEEP_MS: '200' } });
  const second = await fixture(t, { machine: 'scripted', name: 'same', api: first.api, env: { CLAND_EXECUTOR_STATE: state, CLAND_TEST_EXECUTOR_SWEEP_MS: '200' } });
  let resume!: () => void;
  const blocked = new Promise<void>(resolve => { resume = resolve; });
  let creates = 0;
  first.api.beforeCreate(() => { creates++; return blocked; });
  const runs: OwnedRemoteRun[] = [];
  let cleanupWork: ReturnType<typeof cancelAndDrain> | undefined;
  const cleanup = () => cleanupWork ??= cancelAndDrain(runs, resume);
  onCleanup(t, cleanup);
  try {
    const a = await first.launch(); runs.push({ fixture: first, id: a.id });
    const b = await second.launch(); runs.push({ fixture: second, id: b.id });
    // Both acquisitions can admit a shared-spend-lock retry. Drive only those
    // product-requested delays while observing both pre-release create receipts.
    await drive(first, drive(second, eventually('both creates blocked with durable key identities', () => creates === 2 ? true : undefined)));
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
    resume();
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
function localReceipts(t: TestContext) {
  t.mock.method(LocalExecutor.prototype, 'occupied', async () => false);
  t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  const completed = new Set<string>();
  t.mock.method(LocalExecutor.prototype, 'start', async (_lease: Lease, run: RunRef) => {
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
  await writeFile(join(root, '.cland/config.toml'), '[verification]\nlifetime="15m"\nrun_timeout="6m"');
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
  await second.clock.advance(1000);
  assert.match((await second.result(refused.id)).text, /Executor local/);
  const history = JSON.stringify((await second.ui.request({ type: 'topic.history', topic: second.topic })).value);
  assert.match(history, /daily spend cap \$0.063 reached/);
  assert.equal(second.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
  first.api.faults.deleteError = 503;
  first.machine.finish(run.id);
  await first.clock.advance(1000);
  await drive(first, eventually('release stays reserved', async () => (await lease(first.root)).value.state === 'releasing' ? true : undefined));
  assert.equal((await ledger(state)).entries[0]!.cost, null);
  first.api.faults.deleteError = 0;
  await first.clock.advance(1000);
  await drive(first, first.result(run.id));
  const entry = (await ledger(state)).entries[0]!;
  assert.ok(entry.cost! > 0 && entry.cost! < entry.reservation);
  const status = (await second.ui.request({ type: 'executor.status' })).value as { spend: { path: string; spent: number; reserved: number; cap: number } };
  assert.equal(status.spend.path, join(state, 'spend.json'));
  assert.equal(status.spend.spent, entry.cost); assert.equal(status.spend.reserved, 0); assert.equal(status.spend.cap, 0.063);
});

