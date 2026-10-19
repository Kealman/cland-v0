// T2: shared spend/lease files use real OS ownership locks with scripted provider I/O.
// No hub, machine or worker process; pure scheduling rules stay in T1.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { suiteUnit } from './suite-unit-fixture.ts';
import { parseConfig, renderConfig } from '../src/init/config.ts';
import { readLeases } from '../src/executor/droplet/lease.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { machineAccounting, type SuiteJob } from '../src/hub/suites.ts';
import { machineHealthSummary } from '../src/executor/droplet/health.ts';

type Fixture = Awaited<ReturnType<typeof suiteUnit>>;
async function running(f: Fixture, id: string) {
  await f.machine.waits.run(f.when(() => f.status(id)?.state === 'running' ? true : undefined));
  await f.machine.started(id);
  await f.suites.settled();
}
const remote = (f: Fixture, require = true) => f.launch(require ? { executor: 'droplet', fresh: true } : { fresh: true });

test('storage health survives remote collection and receipt recovery with its run attribution', async t => {
  const f = await suiteUnit(t, { executor: 'droplet' });
  const health = { version: 1, temp: { root: '/tmp', kind: 'tmpfs', capBytes: 4294967296, fallback: null },
    storage: { disk: { fsyncMs: 12, sqliteMs: 24 }, temp: { fsyncMs: 1, sqliteMs: 2 } },
    cpu: { totalTicks: 1000, iowaitTicks: 100, stealTicks: 20, iowaitPct: 10, stealPct: 2 } };
  const job = await remote(f); await running(f, job.id);
  await f.finish(job.id, 0, `# tests 1\n# pass 1\nsuite machine health ${JSON.stringify(health)}\n`);
  const receipt = JSON.parse(await readFile(join(f.root, '.cland/run/suites', job.id, 'result.json'), 'utf8'));
  assert.deepEqual(receipt.health, health);
  assert.deepEqual(f.logs.find(entry => entry.event === 'verification-timing' && entry.id === job.id)!.health, health);
  assert.match(machineHealthSummary(f.reports[0]!.health), /disk fsync 12 ms.*SQLite 24 ms.*tmpfs.*iowait 10%.*steal 2%/);
  const jobs = await f.jobs(); delete jobs[0]!.health;
  jobs[0]!.reported = false; jobs[0]!.outcome = null; jobs[0]!.artifact = null;
  await f.reopen(jobs); await f.tick(); await f.machine.waits.run(f.result(job.id));
  assert.deepEqual(f.reports.at(-1)!.health, health, 'durable receipt retains measurements after machine deletion');
});

test('distinct shard storage receipts retain their machine identities through aggregation, cache and recovery', async t => {
  const f = await suiteUnit(t, { executor: 'droplet' });
  f.candidate.selection.mode = 'full';
  const job = await remote(f); await running(f, job.id); await f.finish(job.id);
  const parent = (await f.jobs())[0]!;
  parent.reported = false; parent.outcome = null; parent.artifact = null;
  delete parent.lease; delete parent.completedAt;
  parent.shards = [];
  const expected = [];
  for (const n of [1, 2]) {
    const id = `${job.id}-shard-${n}`, dir = join(f.root, '.cland/run/suites', id);
    const health = { version: 1 as const, temp: { root: '/tmp', kind: 'tmpfs' as const, capBytes: 4294967296, fallback: null },
      storage: { disk: { fsyncMs: n * 10, sqliteMs: n * 20 }, temp: { fsyncMs: n, sqliteMs: n * 2 } }, cpu: null };
    const machine = { name: `machine-${n}`, size: 'c-8', region: 'lon1' };
    const { shards: _shards, ...base } = parent;
    parent.shards.push({ ...base, id, parentRun: job.id, shardName: `shard-${n}`, health, machine: { ...machine, lifetimeMs: 0, costUsd: 0 },
      state: 'finished', outcome: { code: 0, cause: '' }, reported: true, log: join(dir, 'suite.log'), result: join(dir, 'result.json') });
    expected.push({ run: id, shard: `shard-${n}`, machine, health });
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'suite.log'), `# tests 1\n# pass 1\nsuite machine health ${JSON.stringify(health)}\n`);
  }
  // The scripted workers have finished; emulate a crash before group collection.
  await unlink(parent.result);
  await f.reopen([parent]); await f.tick(); await f.machine.waits.run(f.result(job.id));
  const receipt = JSON.parse(await readFile(parent.result, 'utf8'));
  assert.equal(receipt.health, undefined, 'a group must not pretend to be its last machine');
  assert.deepEqual(receipt.shardHealth, expected);
  assert.deepEqual(f.logs.findLast(entry => entry.event === 'verification-timing' && entry.id === job.id)!.shardHealth, expected);
  const cached = await f.launch({ executor: 'droplet' }); assert.equal(cached.cached?.run, job.id); await f.result(cached.id);
  const cachedReport = f.reports.at(-1)!;
  assert.deepEqual(cachedReport.shardHealth, expected, 'cache retains original child run identities');
  for (const item of expected) assert.ok(machineHealthSummary(cachedReport.health, cachedReport.shardHealth).includes(`${item.shard} · ${item.run} · ${item.machine.name}: Machine health: disk fsync ${item.health.storage.disk.fsyncMs} ms`));
  const jobs = await f.jobs(); const restoring = jobs.find(saved => saved.id === job.id)!;
  delete restoring.shards; delete restoring.shardHealth;
  restoring.reported = false; restoring.outcome = null; restoring.artifact = null;
  await f.reopen(jobs); await f.tick(); await f.machine.waits.run(f.result(job.id));
  assert.deepEqual(f.reports.at(-1)!.shardHealth, expected, 'receipt alone recovers every child machine');
  assert.equal(machineHealthSummary(f.reports.at(-1)!.health, f.reports.at(-1)!.shardHealth), machineHealthSummary(cachedReport.health, cachedReport.shardHealth));
});

test('a finished run waits for confirmed lease accounting before publishing its receipt', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 1 }, '', true);
  const log = '# tests 1\n# pass 1\nshard duration Neovim smoke 1s\n';
  f.machine.script({ outcome: 'slow', log });
  const job = await remote(f); await running(f, job.id);
  const waiting = await remote(f);
  f.api.faults.deleteError = 503;
  await f.machine.waits.run(f.finish(job.id, 0, log, false));
  assert.ok(f.logs.some(entry => entry.event === 'executor-release-unconfirmed'));
  assert.equal(f.status(job.id).reported, false, 'an unconfirmed release cannot publish unknown lifetime/cost');
  assert.deepEqual(f.suites.snapshot().waiters.map(waiter => waiter.id), [waiting.id], 'the durable lease still guards remote admission');
  assert.equal(f.api.droplets.length, 1);
  await f.reopen();
  f.api.faults.deleteError = 0;
  await f.tick();
  await f.machine.waits.run(f.result(job.id));
  const report = f.reports.find(report => report.id === job.id)!;
  const lease = (await readLeases(f.root)).find(lease => lease.run === job.id)!;
  const ledger = JSON.parse(await readFile(join(f.root, '.cland/executor-state/spend.json'), 'utf8'));
  assert.equal(lease.state, 'released');
  assert.equal(report.machine!.lifetimeMs, lease.lifetimeMs);
  assert.equal(report.machine!.costUsd, ledger.entries.find((entry: { run: string }) => entry.run === job.id).cost);
  assert.equal(typeof report.machine!.lifetimeMs, 'number');
  assert.equal(typeof report.machine!.costUsd, 'number');
  assert.match(await f.log(job.id), /shard duration Neovim smoke 1s/);
  assert.equal(f.reports.length, 1);
  await running(f, waiting.id);
  await f.finish(waiting.id);
});

test('past-window accounting publishes pending confirmation then corrects once from the released lease', async t => {
  const corrections: SuiteJob[] = [];
  const f = await suiteUnit(t, { executor: 'droplet', onAccountingConfirmed: job => { corrections.push(structuredClone(job)); } }, '', true);
  const job = await remote(f); await running(f, job.id);
  f.api.faults.deleteError = 503;
  await f.machine.waits.run(f.finish(job.id, 0, undefined, false));
  assert.equal(f.status(job.id).reported, false);
  const waitStarted = (await f.jobs()).find(saved => saved.id === job.id)!.accountingWaitStarted;
  await f.reopen();
  assert.equal((await f.jobs()).find(saved => saved.id === job.id)!.accountingWaitStarted, waitStarted);
  await f.tick(119000); await f.machine.waits.run(f.suites.settled());
  assert.equal(f.status(job.id).reported, false, 'restart retains the full confirmation window');
  await f.tick(1001);
  await f.machine.waits.run(f.result(job.id));
  assert.equal(f.reports.length, 1);
  assert.equal(f.reports[0]!.accountingPending, true);
  assert.equal(machineAccounting(f.reports[0]!.machine!), 'lifetime pending confirmation · cost pending confirmation');
  assert.equal(corrections.length, 0);
  await f.reopen();
  f.api.faults.deleteError = 0;
  // Only the executor owns provider deletion; the correction reads its durable
  // released lease rather than querying a machine whose worker is already gone.
  const executor = new DropletExecutor(f.root, f.store, undefined, { DIGITALOCEAN_TOKEN: 'suite-unit-token', CLAND_EXECUTOR_STATE: join(f.root, '.cland/executor-state') }, () => f.config, { ...f.machine.dependencies, api: f.api.provider });
  await f.machine.waits.run(executor.sweep());
  await f.tick(); await f.suites.settled();
  assert.equal(corrections.length, 1);
  const lease = (await readLeases(f.root)).find(lease => lease.run === job.id)!;
  assert.equal(corrections[0]!.machine!.lifetimeMs, lease.lifetimeMs);
  assert.equal(corrections[0]!.machine!.costUsd, lease.costUsd);
  assert.doesNotMatch(machineAccounting(corrections[0]!.machine!), /unknown|pending/);
  await f.reopen(); await f.tick(); await f.suites.settled();
  assert.equal(corrections.length, 1, 'restart must not duplicate the correction');
  assert.equal(f.reports.length, 1, 'correction does not re-run or re-post the suite result');
});

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
  const source = '[verification]\ncheck="true"\ntest="true"\nremote_budget=2\nlifetime="11m"\nrun_timeout="1m"\nload_gate_workers=3\ndaily_spend_usd=0';
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

test('50 parallel acquirers refuse the spend cap after a stalled budget publication', async t => {
  const f = await suiteUnit(t, { executor: 'droplet', remoteBudget: 51 }, 'daily_spend_usd=0.1\nlifetime="15m"\nrun_timeout="5m"', true);
  const first = await remote(f); await running(f, first.id);
  // Durable leases/spend are the subject; omit the optional hub-status mirror.
  const executor = new DropletExecutor(f.root, undefined, undefined, {
    DIGITALOCEAN_TOKEN: 'suite-unit-token', CLAND_EXECUTOR_STATE: join(f.root, '.cland/executor-state'),
  }, () => f.config, { ...f.machine.dependencies, api: f.api.provider });
  // Read the actual lease bytes without one thread-pool trip per peer for
  // each inventory. Writes, main locks and guard contention remain native.
  const read = fs.readFile;
  const leaseRoot = join(executor.root, '.cland/run/executor/leases') + '/';
  const leaseReads = t.mock.method(fs, 'readFile', (async (...args: Parameters<typeof fs.readFile>) => {
    if (args[1] === 'utf8' && String(args[0]).startsWith(leaseRoot) && String(args[0]).endsWith('/lease.json')) return readFileSync(String(args[0]), 'utf8');
    return read(...args);
  }) as typeof fs.readFile);
  // Atomic bytes/rename are observed here; power-loss flushes are not.
  const open = fs.open;
  const fixtureOpen = t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => {
    const handle = await open(...args);
    if ([f.root, executor.root].some(root => String(args[0]).startsWith(join(root, '.cland') + '/'))) t.mock.method(handle, 'sync', async () => {});
    return handle;
  });
  const publishing = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const rename = fs.rename;
  let stalled = false;
  const fault = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
    if (!stalled && String(args[1]).endsWith('/lease.json')) {
      stalled = true; publishing.resolve(); await release.promise;
    }
    return rename(...args);
  });
  syncBuiltinESMExports();
  const before = f.clock.now().getTime();
  const deadline = new Date(before + 300000).toISOString();
  const attempts = Array.from({ length: 50 }, (_, n) => executor.acquire({ id: `cap-${n}` }, deadline));
  const completed = f.machine.waits.run(Promise.allSettled(attempts));
  try {
    await publishing.promise; await f.machine.waits.waiting();
    await f.machine.waits.run(Promise.resolve());
    assert.equal(f.clock.now().getTime(), before, 'retry time cannot outrun the native lock holder');
  } finally {
    release.resolve();
    try { await completed; }
    finally { fault.mock.restore(); fixtureOpen.mock.restore(); leaseReads.mock.restore(); syncBuiltinESMExports(); }
  }
  const outcomes = await completed;
  assert.equal(outcomes.length, 50);
  for (const outcome of outcomes) {
    assert.equal(outcome.status, 'rejected');
    if (outcome.status === 'rejected') assert.equal(outcome.reason.message, 'daily spend cap $0.1 reached');
  }
  assert.equal(f.api.droplets.length, 1, 'cap refusals create no provider machines');
  assert.equal((await readLeases(f.root)).filter(lease => lease.state !== 'released').length, 1);
  await f.finish(first.id);
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

