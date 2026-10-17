// T2: shared spend/lease files use real OS ownership locks with scripted provider I/O.
// No hub, machine or worker process; pure scheduling rules stay in T1.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { suiteUnit } from './suite-unit-fixture.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';

type Fixture = Awaited<ReturnType<typeof suiteUnit>>;
async function running(f: Fixture, id: string) {
  await f.machine.waits.run(f.when(() => f.status(id)?.state === 'running' ? true : undefined));
  await f.machine.started(id);
  await f.suites.settled();
}
const remote = (f: Fixture, require = true) => f.launch(require ? { executor: 'droplet', fresh: true } : { fresh: true });

for (const budget of [1, 2]) test(`explicit droplet refuses an uncovered reservation with remote budget ${budget}`, async t => {
  const f = await suiteUnit(t, { remoteBudget: budget }, 'daily_spend_usd=0.1\nlifetime="15m"\nrun_timeout="5m"', true);
  const first = await remote(f); await running(f, first.id);
  await assert.rejects(remote(f), /daily spend cap \$0\.1/);
  assert.equal(f.suites.snapshot().holder, null); assert.deepEqual(f.suites.snapshot().waiters, []); assert.equal(f.api.droplets.length, 1);
  await f.finish(first.id);
});

// Reload crosses only the loaded-config boundary here; CLI reload framing is covered separately.
test('reload preserves an active verification and lease, and new admissions use the new lifetime and spend cap', async t => {
  const f = await suiteUnit(t, { remoteBudget: 1 }, 'lifetime="15m"\nrun_timeout="5m"\nload_gate_workers=1\ndaily_spend_usd=5', true);
  const first = await remote(f); await running(f, first.id);
  const old = (await readLeases(f.root))[0]!;
  const waiting = await remote(f);
  assert.ok(f.suites.snapshot().waiters.some(w => w.id === waiting.id));
  const source = '[verification]\nremote_budget=2\nlifetime="11m"\nrun_timeout="1m"\nload_gate_workers=3\ndaily_spend_usd=0';
  await writeFile(join(f.root, '.cland/config.toml'), source);
  assert.equal(f.config.verification.dailySpendUsd, 5, 'disk edits alone leave loaded admission policy intact');
  f.configure(source); await f.tick();
  await f.machine.waits.run(f.when(() => f.status(waiting.id).outcome ?? undefined)); await f.suites.settled(); await f.tick();
  assert.match((await f.result(waiting.id)).outcome!.cause, /daily spend cap \$0/);
  await assert.rejects(remote(f), /daily spend cap \$0/); assert.equal(f.api.droplets.length, 1);
  assert.equal((await readLeases(f.root)).find(l => l.name === old.name)!.deadline, old.deadline);
  f.configure(source.replace('daily_spend_usd=0', 'daily_spend_usd=5').replace('remote_budget=2', 'remote_budget=1'));
  const second = await remote(f); assert.ok(f.suites.snapshot().waiters.some(w => w.id === second.id));
  f.configure(source.replace('daily_spend_usd=0', 'daily_spend_usd=5').replace('load_gate_workers=3', 'load_gate_workers=4')); await f.tick(); await running(f, second.id);
  const next = (await readLeases(f.root)).find(l => l.name !== old.name)!;
  assert.ok(Date.parse(old.deadline) - Date.parse(next.deadline) > 180000);
  const oldRun = (await f.jobs()).find(j => j.id === first.id)!; const newRun = (await f.jobs()).find(j => j.id === second.id)!;
  assert.equal(oldRun.config!.verification.runTimeoutMs, 300000); assert.equal(newRun.config!.verification.runTimeoutMs, 60000);
  assert.equal(oldRun.limits!.loadGateWorkers, 1); assert.equal(newRun.limits!.loadGateWorkers, 4);
  await f.finish(first.id); await f.finish(second.id); assert.deepEqual(f.api.droplets, []);
});

test('parallel acquires each reserve shared spend; cap refusals stay local without holding remote slots', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 3 }, 'daily_spend_usd=0.1\nlifetime="15m"\nrun_timeout="5m"', true);
  f.hold(true);
  f.api.beforeCreate(async () => {
    const ledger = JSON.parse(await readFile(join(f.root, '.cland/executor-state/spend.json'), 'utf8'));
    assert.equal(ledger.entries.filter((e: { cost: number | null }) => e.cost === null).length, 1);
    assert.equal(ledger.entries.find((e: { cost: number | null }) => e.cost === null).reservation, 0.0625);
  });
  const jobs = await Promise.all([f.launch(), f.launch(), f.launch()]);
  const q = await f.machine.waits.run(f.when(() => {
    const q = f.suites.snapshot(); return q.remote?.length === 1 && q.remote[0]!.machine && q.waiters.length === 2 && f.notices.length === 2 ? q : undefined;
  }));
  const active = q.remote![0]!.id!; await running(f, active);
  assert.equal(f.api.droplets.length, 1); assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  for (const job of jobs) if (job.id !== active) {
    assert.ok(f.notices.includes(job.id)); assert.match((await f.jobs()).find(j => j.id === job.id)!.fallback!, /daily spend cap \$0\.1 reached/);
  }
  await f.finish(active); assert.equal(f.suites.snapshot().remote!.length, 0);
  const later = await f.launch({ fresh: true }); await running(f, later.id); await f.finish(later.id);
  for (const job of jobs) if (job.id !== active) { await f.suites.cancel(job.id, null, () => {}); await f.result(job.id); }
  assert.deepEqual(f.api.droplets, []);
});

test('an unconfirmed acquire cleanup keeps its durable remote budget reservation', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 1 }, '', true);
  f.hold(true); f.api.faults.deleteError = 503;
  const exec = t.mock.method(f.machine.dependencies.machine, 'exec', async () => { throw new Error('scripted readiness failure'); });
  const a = await f.launch();
  await f.machine.waits.run(f.when(() => f.notices.includes(a.id) ? true : undefined));
  assert.equal(f.api.droplets.length, 1);
  const b = await f.launch(); await f.when(() => f.notices.includes(b.id) ? true : undefined);
  assert.equal(f.api.droplets.length, 1); assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  assert.equal((await f.jobs()).find(j => j.id === b.id)!.fallback, 'remote budget full');
  f.api.faults.deleteError = 0; exec.mock.restore();
  // The hub's executor sweep owns retrying an unconfirmed lease. Exercise that
  // same executor seam directly, rather than waiting on a daemon sweep timer.
  const { DropletExecutor } = await import('../src/executor/droplet/droplet.ts');
  const executor = new DropletExecutor(f.root, f.store, undefined, { DIGITALOCEAN_TOKEN: 'suite-unit-token', CLAND_EXECUTOR_STATE: join(f.root, '.cland/executor-state') }, () => f.config, { ...f.machine.dependencies, api: f.api.provider });
  await f.machine.waits.run(executor.sweep()); assert.deepEqual(f.api.droplets, []);
  for (const job of [a, b]) { await f.suites.cancel(job.id, null, () => {}); await f.result(job.id); }
});

