// T1: stage-cache supersession at Suites; semantic worker/report receipts use a fake clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { authorizeVerifyOccasion } from '../src/verification-occasion.ts';
import { suiteUnit } from './suite-unit-fixture.ts';

test('fresh failed or unreported stage attempts supersede the older green cache', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 1, machineReceiptsOnly: true });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated stage', fetchedDev: f.candidate.head };
  const submit = (fresh: boolean) => f.launch({ mode: 'all', integrated: true, occasion: 'stage', executor: 'droplet', fresh });
  const running = async (id: string) => {
    await f.machine.waits.run(f.when(() => f.status(id).state === 'running' ? true : undefined));
    await f.machine.started(id);
  };
  let green = await submit(true); await running(green.id); await f.finish(green.id);
  assert.deepEqual(f.suites.stageMissing(f.candidate.tree), ['macOS']);
  for (const state of ['failed', 'unreported'] as const) {
    const hit = await submit(false); assert.equal(hit.cached?.run, green.id); await f.result(hit.id);
    let withheld = false;
    f.beforeReport(async () => { if (withheld) throw new Error('loop breaker: controlled undeliverable report'); });
    withheld = state === 'unreported';
    const fresh = await submit(true); assert.equal(fresh.cached, undefined); await running(fresh.id);
    await f.finish(fresh.id, state === 'failed' ? 1 : 0, '# tests 1\n# pass 1\n', !withheld);
    if (withheld) {
      await f.when(() => f.status(fresh.id).error?.includes('loop breaker') ? true : undefined);
      assert.equal(f.status(fresh.id).outcome!.code, 0); assert.equal(f.status(fresh.id).reported, false);
    } else assert.equal(f.status(fresh.id).outcome!.code, 1);
    const next = await submit(false);
    assert.equal(next.cached, undefined, `newer ${state} evidence blocks the older green`);
    withheld = false; await running(next.id); await f.finish(next.id);
    await f.tick(); await f.result(fresh.id);
    assert.equal(f.status(next.id).outcome!.code, 0);
    assert.doesNotMatch(await f.log(next.id), /Original run/);
    assert.deepEqual(f.api.droplets, []);
    green = next;
  }
});

test('occasions require integrated dev, full selection and a fresh fetch at the admitted head', async t => {
  const f = await suiteUnit(t, { machineReceiptsOnly: true });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated stage', fetchedDev: f.candidate.head };
  const base = { mode: 'all', integrated: true, occasion: 'stage' as const };
  for (const invalid of [
    { input: { integrated: false } },
    { input: {}, branch: 'task-candidate' },
    { input: { mode: 'hub' } },
    { input: {}, fetched: 'b'.repeat(40) },
    { input: {}, fetched: undefined },
  ]) {
    f.candidate.branch = invalid.branch ?? 'dev';
    const fetched = 'fetched' in invalid ? invalid.fetched : f.candidate.head;
    if (fetched === undefined) delete f.candidate.selection.fetchedDev;
    else f.candidate.selection.fetchedDev = fetched;
    await assert.rejects(f.launch({ ...base, ...invalid.input }), /integrated dev full request.*fresh origin\/dev fetch proof/);
  }
  assert.deepEqual(f.suites.snapshot().waiters, []); assert.deepEqual(f.suites.snapshot().remote, []);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
});

// The representative occasion frame remains in suite-close; permutations are pure.
test('occasion roles allow Coordinator closes and only QA epic closes', () => {
  for (const occasion of ['stage', 'epic', 'release'] as const) {
    for (const role of ['implementer', 'reviewer', 'qa', 'coordinator', null] as const) {
      if (role === 'coordinator' || role === 'qa' && occasion === 'epic') assert.doesNotThrow(() => authorizeVerifyOccasion(role, occasion));
      else assert.throws(() => authorizeVerifyOccasion(role, occasion), /occasion requires the Coordinator, or QA with occasion epic/);
    }
  }
});

// Reservation arithmetic is covered at the spend boundary; here its refusal is an executor receipt.
test('batch and close runs fall back whole with one warning for cap or slots', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 2, machineReceiptsOnly: true });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated close', fetchedDev: f.candidate.head };
  // A cap rejection comes from the executor's public reservation seam.
  const { DropletExecutor } = await import('../src/executor/droplet/droplet.ts');
  t.mock.method(DropletExecutor.prototype, 'reserveShards', async () => { throw new Error('daily spend cap $0.1 would be exceeded'); });
  for (const [cause, occasion] of [['cap', undefined], ['cap', 'stage'], ['slots', undefined], ['slots', 'stage']] as const) {
    if (cause === 'slots') f.configure('[verification]\nexecutor="droplet"\nremote_budget=1');
    const before = f.acquisitions.length, notices = f.shardingNotices.length;
    const job = await f.launch({ mode: 'all', integrated: true, ...(occasion ? { occasion } : {}), fresh: true });
    await f.machine.waits.run(f.when(() => f.status(job.id).state === 'running' ? true : undefined));
    await f.machine.started(job.id); await f.finish(job.id);
    assert.equal(f.status(job.id).outcome!.code, 0);
    assert.equal(f.acquisitions.length - before, 1, 'one whole run, with no shard acquisitions');
    const expected = cause === 'cap' ? 'sharding skipped: daily spend cap $0.1 would be exceeded' : 'sharding skipped: fewer than 2 remote slots free';
    assert.deepEqual(f.shardingNotices.slice(notices), [expected]);
    assert.equal(f.logs.filter(row => row.event === 'verification-sharding-skipped' && row.id === job.id).length, 1);
    assert.deepEqual(f.api.droplets, []);
  }
});
