// T1: scratch files and injected ledger receipts, no native execution.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { compactLeaseIndex, readDemoLeases, readLease, readLeases, writeLease, type DropletLease } from '../src/executor/droplet/lease.ts';
import { compactLeaseHistory, inspectHostSpend, inspectSpend, settleSpend, spendPath } from '../src/executor/droplet/spend.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fakeOnlyFixture } from './fake-only-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import type { Store } from '../src/hub/store.ts';
import type { Provider, MachineTransport } from '../src/executor/droplet/dependencies.ts';
import { Demos } from '../src/hub/demos.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { fixtureWork, type FixtureStep } from '../../test-support/fixture-work.ts';
import { copyFixtureCase } from './executor-copy-fixture.ts';

test('copy setup deadline retains a late acquired root through guarded cleanup', async t => {
  const hooks: Array<() => Promise<void>> = [];
  const context = { name: t.name, signal: t.signal, after: (hook: () => Promise<void>) => { hooks.push(hook); } } as TestContext;
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const clock = new FakeClock(), mkdtemp = fs.mkdtemp;
  let root: string | undefined, original: Promise<void> | undefined, bodyEntered = false;
  t.after(async () => {
    release.resolve(); await original?.catch(() => {});
    for (const hook of hooks) await hook();
    fs.mkdtemp = mkdtemp; syncBuiltinESMExports();
    if (root) await fs.rm(root, { recursive: true, force: true });
  });
  fs.mkdtemp = (async (...args: Parameters<typeof fs.mkdtemp>) => {
    entered.resolve(); await release.promise;
    root = await mkdtemp(...args);
    assert.ok((await fs.stat(root)).isDirectory(), 'producer observes the acquired directory before returning');
    return root;
  }) as typeof fs.mkdtemp;
  syncBuiltinESMExports();
  original = copyFixtureCase(context, async () => { bodyEntered = true; }, { clock });
  const rejected = assert.rejects(original, /copy fixture root setup: deadline exceeded/);
  await caseDeadlines(t, { timeoutMs: 5000 }).wait('root acquisition entered', () => entered.promise);
  await clock.advance(5001);
  release.resolve();
  await rejected;
  assert.ok(root);
  assert.equal(bodyEntered, false, 'expired setup admits no copy behaviour');
  await assert.rejects(fs.stat(root), { code: 'ENOENT' });
});

const row = (id: string, state: DropletLease['state']): DropletLease => ({ kind: 'droplet', provider: 'digitalocean', lease: id, run: id, name: id, tags: ['cland'], size: 'fixture', region: 'fixture', priceHourly: 1, keyName: id, state, resource: null, keyId: null, created: '2026-11-17T00:00:00Z', deadline: '2026-11-17T01:00:00Z', ...(state === 'released' ? { costUsd: 0, released: '2026-11-17T00:01:00Z' } : {}) });
const environment = (root: string) => fixtureEnvironment(root, { ...process.env, CLAND_EXECUTOR_STATE: join(root, 'ledger') });

/** Native-free normal/abort owner, enrolled before the guarded root acquisition. */
function ownedLeaseCase(t: TestContext, body: (root: string, step: FixtureStep, setup: <T>(name: string, work: () => Promise<T>) => Promise<T>) => Promise<void>, clock?: FakeClock): Promise<void> {
  const owner = fixtureWork();
  const close = () => owner.close();
  t.after(close);
  const abort = () => { void close().catch(() => {}); };
  t.signal.addEventListener('abort', abort, { once: true });
  t.after(() => t.signal.removeEventListener('abort', abort));
  if (t.signal.aborted) abort();
  const deadlines = caseDeadlines(t, { timeoutMs: 5000, ...(clock ? { clock } : {}) });
  return owner.run(async step => {
    const acquired = Promise.withResolvers<void>(), begin = Promise.withResolvers<void>();
    const original = fakeOnlyFixture(t, async root => {
      acquired.resolve(); // The fixture has captured the root and owns its guard.
      await begin.promise;
      await step(() => body(root, step, async (name, work) => {
        const pending = step(work);
        try { return await deadlines.wait(name, () => pending); }
        catch (error) {
          void close().catch(() => {}); // Fence before the original setup resumes.
          await pending.catch(() => {}); // Retain its root and seams through timeout.
          throw error;
        }
      }));
    }, step);
    try {
      await deadlines.wait('lease fixture root setup', () => Promise.race([acquired.promise, original.then(() => { throw new Error('fixture finished without its acquisition receipt'); })]));
      await step(async () => { begin.resolve(); });
      await original;
    } catch (error) {
      void close().catch(() => {});
      throw error;
    } finally {
      begin.resolve();
      // A deadline never detaches the original fixture or restores its guard.
      await original.catch(() => {});
    }
  });
}

test('primary and legacy reconciliation preserve terminal unknown in either duplicate order', async t => ownedLeaseCase(t, async (root, step, setup) => {
  const env = environment(root);
  delete env.CLAND_EXECUTOR_STATE;
  const released = row('unknown', 'released');
  await setup('lease seed setup', () => seedLeases(root, [released]));
  const receipt = { reason: 'ledger-entry-missing', project: root, lease: released.lease, released: released.released };
  const unknown = { ...spendEntry(root, released), cost: null, spendReceipt: receipt };
  const pending = { ...spendEntry(root, released), cost: null, released: undefined };
  const zero = spendEntry(root, released);
  const old = join(env.HOME!, '.cland/executor/spend.json');
  await step(() => fs.mkdir(dirname(old), { recursive: true }));
  await step(() => fs.mkdir(dirname(spendPath(env)), { recursive: true }));
  for (const [primary, legacy] of [[pending, unknown], [unknown, pending], [zero, unknown], [unknown, zero]]) {
    await step(() => fs.writeFile(spendPath(env), JSON.stringify({ version: 1, entries: [primary] })));
    await step(() => fs.writeFile(old, JSON.stringify({ version: 1, entries: [legacy] })));
    assert.equal((await step(() => inspectSpend(10, env, new FakeClock(), undefined, true))).unknownLeases, 1);
    assert.equal((await step(() => inspectSpend(10, env, new FakeClock(), { alive: () => true, started: () => 'fixture identity' }))).unknownLeases, 1);
    const entry = JSON.parse(await step(() => fs.readFile(spendPath(env), 'utf8'))).entries[0];
    assert.equal(entry.cost, null);
    assert.deepEqual(entry.spendReceipt, receipt);
    assert.equal(entry.released, receipt.released);
    assert.equal((await step(() => inspectSpend(10, env, new FakeClock(), undefined, true))).unknownLeases, 1, 'reobservation preserves unknown alongside retained legacy bytes');
    await step(() => compactLeaseHistory(root, env, () => {}, true));
    assert.deepEqual(await step(() => readLeases(root)), []);
  }
}));

test('released leases without accounting settle unknown once across repeated repairs', async t => ownedLeaseCase(t, async (root, step, setup) => {
  const env = environment(root);
  await setup('lease seed setup', () => seedLeases(root, [row('missing-a', 'released'), row('missing-b', 'released'), row('live', 'active')]));
  const events: Record<string, unknown>[] = [];
  const rename = fs.rename;
  fs.rename = async (...args: Parameters<typeof fs.rename>) => {
    if (String(args[1]).endsWith('/lease-index.json')) throw new Error('fixture unknown-spend index interrupted');
    return rename(...args);
  };
  syncBuiltinESMExports();
  try {
    await step(() => assert.rejects(compactLeaseHistory(root, env, event => events.push(event), true, { alive: () => true, started: () => 'fixture identity' }), /unknown-spend index interrupted/));
  } finally { fs.rename = rename; syncBuiltinESMExports(); }
  for (let pass = 0; pass < 4; pass++) await step(() => compactLeaseHistory(root, env, event => events.push(event), pass !== 1, { alive: () => true, started: () => 'fixture identity' }));
  assert.equal(events.filter(e => e.event === 'executor-lease-spend-missing').length, 2);
  assert.deepEqual((await step(() => readLeases(root))).map(l => l.lease), ['live']);
  const ledger = JSON.parse(await step(() => fs.readFile(spendPath(env), 'utf8')));
  assert.equal(ledger.entries.length, 2);
  await step(() => settleSpend([row('missing-a', 'released'), row('missing-b', 'released')], env));
  assert.equal(await step(() => fs.readFile(spendPath(env), 'utf8')), `${JSON.stringify(ledger)}\n`, 'ordinary settlement preserves terminal unknown receipts without locking or writing');
  for (const entry of ledger.entries) {
    assert.equal(entry.cost, null);
    assert.equal(entry.spendReceipt.reason, 'ledger-entry-missing');
    assert.equal(entry.spendReceipt.lease, entry.lease);
    assert.equal(entry.spendReceipt.project, root);
  }
  const spend = await step(() => inspectSpend(10, env, new FakeClock(), undefined, true));
  assert.equal(spend.unknownLeases, 2);
  assert.equal((await step(() => inspectHostSpend(env, new FakeClock()))).categories.verify.unknownLeases, 2);
  const { DropletExecutor } = await step(() => import('../src/executor/droplet/droplet.ts'));
  const executor = new DropletExecutor(root, undefined, () => {}, env, undefined, { clock: new FakeClock(), processes: { alive: () => true, started: () => 'fixture' } });
  try {
    const status = await step(() => executor.inspect());
    assert.equal(status.todayCostUsd, null);
    assert.equal(status.spend.unknownLeases, 2);
    assert.match(status.summary, /unknown spend: 2 released leases/);
  } finally { await executor.close(); }
}));

test('malformed and foreign spend receipts refuse accounting and preserve recovery files', async t => ownedLeaseCase(t, async (root, step, setup) => {
  const env = environment(root), released = row('invalid', 'released');
  await setup('lease seed setup', () => seedLeases(root, [released]));
  await step(() => writeLease(root, released));
  const key = join(root, '.cland/run/executor/leases/invalid/key');
  await step(() => fs.writeFile(key, 'fixture-key'));
  const index = join(root, '.cland/run/executor/lease-index.json');
  const before = await step(() => fs.readFile(index, 'utf8'));
  const valid = { reason: 'ledger-entry-missing', project: root, lease: released.lease, released: released.released };
  const { DropletExecutor } = await step(() => import('../src/executor/droplet/droplet.ts'));
  const executor = new DropletExecutor(root, undefined, () => {}, env, undefined, { clock: new FakeClock() });
  try {
    const cases = [null, true, 'unknown', {}, { ...valid, reason: 'other' }, { ...valid, project: 'foreign' }, { ...valid, lease: 'foreign' }, { ...valid, released: 'invalid' }, { ...valid, released: '2026-11-18T00:00:00Z' }]
      .map(spendReceipt => ({ ...spendEntry(root, released), cost: null as number | null, spendReceipt, category: 'verify' }));
    cases.push({ ...spendEntry(root, released), cost: 0, spendReceipt: valid, category: 'verify' });
    cases.push({ ...spendEntry(root, released), cost: null, spendReceipt: valid, category: 'hosts' });
    for (const entry of cases) {
      await step(() => fs.mkdir(dirname(spendPath(env)), { recursive: true }));
      await step(() => fs.writeFile(spendPath(env), JSON.stringify({ version: 1, legacyRetired: true, entries: [entry] })));
      await step(() => assert.rejects(inspectSpend(10, env, new FakeClock(), undefined, true), /invalid executor spend receipt/));
      await step(() => assert.rejects(inspectHostSpend(env, new FakeClock()), /invalid executor spend receipt/));
      await step(() => assert.rejects(executor.inspect(), /invalid executor spend receipt/));
      await step(() => assert.rejects(compactLeaseHistory(root, env, () => {}, true), /invalid executor spend receipt/));
      await step(() => assert.rejects(settleSpend(released, env), /invalid executor spend receipt/));
      assert.equal(await step(() => fs.readFile(index, 'utf8')), before);
      assert.equal(await step(() => fs.readFile(key, 'utf8')), 'fixture-key');
    }
    await step(() => publishSpend(env, []));
    await step(() => writeLease(root, { ...released, released: 'invalid' }));
    await step(() => assert.rejects(compactLeaseHistory(root, env, () => {}, true, { alive: () => true, started: () => 'fixture identity' }), /invalid executor spend receipt/));
    assert.equal(await step(() => fs.readFile(index, 'utf8')), before);
    assert.equal(await step(() => fs.readFile(key, 'utf8')), 'fixture-key');
    assert.deepEqual(JSON.parse(await step(() => fs.readFile(spendPath(env), 'utf8'))).entries, [], 'the producer validates before admitting a receipt');
  } finally { await executor.close(); }
}));

test('initial index migration logs structured counts only on its first publication', async t => ownedLeaseCase(t, async (root, step, setup) => {
  const env = environment(root), released = row('settled', 'released');
  await setup('lease seed setup', () => seedLeases(root, [released, row('active', 'active')]));
  await step(() => publishSpend(env, [spendEntry(root, released)]));
  const events: Record<string, unknown>[] = [];
  for (let pass = 0; pass < 3; pass++) await step(() => compactLeaseHistory(root, env, event => events.push(event), true));
  assert.deepEqual(events.filter(e => e.event === 'executor-lease-index-migrated'), [{ event: 'executor-lease-index-migrated', read: 2, indexed: 1, settled: 1 }]);
}));

test('first lease writer logs migration once before subsequent compaction and rebuild', async t => ownedLeaseCase(t, async (root, step, setup) => {
  const env = environment(root), events: Record<string, unknown>[] = [];
  await setup('lease seed setup', () => seedLeases(root, [row('legacy', 'active')]));
  await step(() => writeLease(root, row('new', 'active'), event => events.push(event)));
  for (let pass = 0; pass < 3; pass++) {
    await step(() => writeLease(root, row('new', 'active'), event => events.push(event)));
    await step(() => compactLeaseHistory(root, env, event => events.push(event), pass !== 1));
  }
  assert.deepEqual(events.filter(e => e.event === 'executor-lease-index-migrated'), [{ event: 'executor-lease-index-migrated', read: 2, indexed: 2, settled: 0 }]);
  assert.deepEqual((await step(() => readLeases(root))).map(lease => lease.lease).sort(), ['legacy', 'new']);
}));

test('throwing migration sinks preserve lease publication and the observed run status', async t => ownedLeaseCase(t, async (root, step, setup) => {
  const { DropletRun } = await step(() => import('../src/executor/droplet/run.ts'));
  for (const mode of ['migration-only', 'all'] as const) {
    const events: Record<string, unknown>[] = [];
    const log = (event: Record<string, unknown>) => {
      events.push(event);
      if (mode === 'all' || event.event === 'executor-lease-index-migrated') throw new Error('fixture diagnostic sink unavailable');
    };
    const writerRoot = join(root, `writer-${mode}`), statusRoot = join(root, `status-${mode}`);
    await setup('writer and status anchors', async () => {
      await fs.mkdir(join(writerRoot, '.cland/run'), { recursive: true });
      await fs.mkdir(join(statusRoot, '.cland/run'), { recursive: true });
    });
    const lease = row('writer', 'active');
    await step(() => writeLease(writerRoot, lease, log));
    assert.deepEqual(await step(() => readLease(join(writerRoot, '.cland/run/executor/leases/writer'))), lease);
    assert.equal(events.filter(e => e.event === 'executor-lease-index-log-failed').length, 1);
    const clock = new FakeClock();
    const active = { ...row('status', 'active'), resource: 1, execution: { head: 'fixture', unreachableSince: clock.now().toISOString() } };
    await setup('status lease seed', () => seedLeases(statusRoot, [active]));
    const receipt = { state: 'done', code: 0, finished: clock.now().toISOString() };
    let observations = 0;
    const api = { droplet: async () => { observations++; return { id: 1, status: 'active' }; } } as unknown as Provider;
    const machine = { exec: async () => JSON.stringify(receipt) } as unknown as MachineTransport;
    const run = new DropletRun(statusRoot, environment(root), { clock, api, machine }, log);
    assert.deepEqual(await step(() => run.status(active)), receipt);
    assert.equal(observations, 1, 'an ancillary sink failure never enters status recovery');
    const persisted = await step(() => readLease(join(statusRoot, '.cland/run/executor/leases/status')));
    assert.equal(persisted.execution?.unreachableSince, undefined);
    assert.equal(events.filter(e => e.event === 'executor-lease-index-migrated').length, 2);
    assert.equal(events.filter(e => e.event === 'executor-lease-index-log-failed').length, 2);
    await step(() => writeLease(writerRoot, lease, log));
    assert.equal(events.length, 4, 'an existing index never retries migration diagnostics');
    const failedRoot = join(root, `failed-${mode}`);
    await setup('failed writer anchor', () => fs.mkdir(join(failedRoot, '.cland/run'), { recursive: true }));
    const rename = fs.rename;
    fs.rename = async (...args: Parameters<typeof fs.rename>) => {
      if (String(args[1]).endsWith('/lease.json')) throw new Error('fixture lease record publication failed');
      return rename(...args);
    };
    syncBuiltinESMExports();
    try {
      await step(() => assert.rejects(writeLease(failedRoot, lease, log), /fixture lease record publication failed/));
    } finally { fs.rename = rename; syncBuiltinESMExports(); }
    assert.deepEqual(JSON.parse(await step(() => fs.readFile(join(failedRoot, '.cland/run/executor/lease-index.json'), 'utf8'))).leases, ['writer']);
    await step(() => assert.rejects(fs.stat(join(failedRoot, '.cland/run/executor/leases/writer/lease.json')), { code: 'ENOENT' }));
  }
}));

for (const mode of ['normal', 'abort', 'timeout'] as const) test(`lease case ${mode} close joins held setup and fences the next write`, { timeout: 10000 }, async t => {
  const hooks: Array<() => Promise<void>> = [], abort = new AbortController();
  const context = { name: t.name, signal: abort.signal, after: (hook: () => Promise<void>) => { hooks.push(hook); } } as TestContext;
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>(), clock = new FakeClock();
  let root: string | undefined, continued = false, retained = false;
  let work: Promise<void> | undefined, closing: Promise<void> | undefined;
  t.after(async () => {
    release.resolve(); await Promise.allSettled([work, closing]);
    for (const hook of hooks) await hook();
  });
  work = ownedLeaseCase(context, async (acquired, step, setup) => {
    root = acquired;
    await setup('held lease setup', async () => {
      entered.resolve(); await release.promise;
      retained = (await fs.stat(acquired)).isDirectory();
    });
    await step(async () => { continued = true; await fs.writeFile(join(acquired, 'late'), 'unexpected'); });
  }, clock);
  const rejected = assert.rejects(work, mode === 'timeout' ? /held lease setup: deadline exceeded/ : /fixture work admission closed/);
  const deadline = caseDeadlines(t, { timeoutMs: 5000 });
  await deadline.wait('held setup receipt', () => entered.promise);
  if (mode === 'normal') closing = hooks[0]!();
  else if (mode === 'abort') abort.abort();
  else await clock.advance(5001);
  assert.ok(root);
  assert.ok((await fs.stat(root)).isDirectory());
  release.resolve();
  await rejected; await closing;
  assert.equal(retained, true, 'the held original retains its root until it settles');
  assert.equal(continued, false, 'normal and signal closure fence subsequent effects');
  await assert.rejects(fs.stat(root), { code: 'ENOENT' });
});

test('closing after admitted guard setup fences the root acquisition itself', { timeout: 10000 }, async t => {
  const hooks: Array<() => Promise<void>> = [];
  const context = { after: (hook: () => Promise<void>) => { hooks.push(hook); } } as TestContext;
  const owner = fixtureWork(), entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const mkdtemp = fs.mkdtemp;
  let acquisitions = 0, admissions = 0, bodyEntered = false;
  let original: Promise<unknown> | undefined;
  t.after(async () => {
    release.resolve(); await Promise.allSettled([original, owner.close()]);
    for (const hook of hooks) await hook();
    fs.mkdtemp = mkdtemp; syncBuiltinESMExports();
  });
  fs.mkdtemp = (async (...args: Parameters<typeof fs.mkdtemp>) => { acquisitions++; return mkdtemp(...args); }) as typeof fs.mkdtemp;
  syncBuiltinESMExports();
  original = owner.run(step => fakeOnlyFixture(context, async () => { bodyEntered = true; }, async operation => {
    const value = await step(operation);
    if (++admissions === 1) { entered.resolve(); await release.promise; }
    return value;
  }));
  const rejected = assert.rejects(original, /fixture work admission closed/);
  await caseDeadlines(t, { timeoutMs: 5000 }).wait('guard setup receipt', () => entered.promise);
  const closing = owner.close(); release.resolve();
  await rejected; await closing;
  assert.equal(acquisitions, 0);
  assert.equal(bodyEntered, false);
});

test('compaction stops on a missing run directory without recreating it', async t => fakeOnlyFixture(t, async root => {
  const outcome = await compactLeaseHistory(root, environment(root), () => {}, true);
  assert.deepEqual(outcome, { status: 'stopped', reason: 'run-directory-missing' });
  await assert.rejects(() => fs.stat(join(root, '.cland')), { code: 'ENOENT' });
}));

test('an unrelated missing publication file remains a maintenance failure', async t => fakeOnlyFixture(t, async root => {
  await fs.mkdir(join(root, '.cland/run'), { recursive: true });
  await seedLeases(root, [row('live', 'active')]);
  const rename = fs.rename;
  let work: ReturnType<typeof compactLeaseHistory> | undefined;
  fs.rename = async (...args: Parameters<typeof fs.rename>) => {
    if (String(args[1]).endsWith('/lease-index.json')) throw Object.assign(new Error('fixture publication missing'), { code: 'ENOENT' });
    return rename(...args);
  };
  syncBuiltinESMExports();
  try {
    work = compactLeaseHistory(root, environment(root), () => {}, true);
    await assert.rejects(work, /fixture publication missing/);
  } finally {
    await work?.catch(() => {});
    fs.rename = rename; syncBuiltinESMExports();
  }
}));

test('publication seam survives fixture cancellation until its original writer joins', { timeout: 5000 }, async t => {
  const hooks: Array<() => Promise<void>> = [];
  const context = { after: (hook: () => Promise<void>) => { hooks.push(hook); } } as TestContext;
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  let running: Promise<void> | undefined, closing: Promise<void> | undefined;
  t.after(async () => { release.resolve(); await Promise.allSettled([running, closing]); });
  const order: string[] = [];
  running = fakeOnlyFixture(context, async root => {
    await fs.mkdir(join(root, '.cland/run'), { recursive: true });
    await seedLeases(root, [row('live', 'active')]);
    const rename = fs.rename;
    const held: typeof fs.rename = async (...args) => {
      entered.resolve(); await release.promise;
      assert.equal(fs.rename, held, 'cleanup keeps the seam installed at the resumed native boundary');
      await rename(...args); order.push('renamed');
    };
    fs.rename = held; syncBuiltinESMExports();
    let writer: ReturnType<typeof compactLeaseHistory> | undefined;
    try {
      writer = compactLeaseHistory(root, environment(root), () => {}, true);
      await writer; order.push('writer joined');
    } finally {
      await writer?.catch(() => {});
      fs.rename = rename; syncBuiltinESMExports(); order.push('restored');
    }
  });
  await Promise.race([entered.promise, running.then(() => { throw new Error('writer missed the held boundary'); })]);
  closing = hooks[0]!(); // Execute the registered TestContext cleanup while its producer is held.
  release.resolve();
  await Promise.all([running, closing]);
  assert.deepEqual(order, ['renamed', 'writer joined', 'restored']);
});
const spendEntry = (root: string, lease: DropletLease) => ({ project: root, lease: lease.lease, run: lease.run, size: lease.size, reservation: 1, cost: 0 as number | null, created: lease.created, deadline: lease.deadline, released: lease.released });
async function seedLeases(root: string, leases: DropletLease[]): Promise<void> {
  // One batch, without the durable writer/index protocol under test.
  const results = await Promise.allSettled(leases.map(async lease => {
    const dir = join(root, '.cland/run/executor/leases', lease.lease);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, 'lease.json'), JSON.stringify(lease));
  }));
  // A failed seed still joins every writer before fixture cleanup can run.
  for (const result of results) if (result.status === 'rejected') throw result.reason;
}
async function publishSpend(env: NodeJS.ProcessEnv, entries: ReturnType<typeof spendEntry>[]): Promise<void> {
  await fs.mkdir(dirname(spendPath(env)), { recursive: true });
  await fs.writeFile(spendPath(env), JSON.stringify({ version: 1, legacyRetired: true, entries }));
}

test('unchanged compaction creates no temporary file while changed membership is durably published', async t => fakeOnlyFixture(t, async root => {
  await seedLeases(root, [row('live', 'active'), row('settled', 'released')]);
  const index = join(root, '.cland/run/executor/lease-index.json');
  const events: string[] = [];
  const open = fs.open, rename = fs.rename;
  fs.open = async (...args: Parameters<typeof fs.open>) => {
    const file = await open(...args);
    if (String(args[0]).startsWith(`${index}.`)) {
      events.push('temporary open');
      const write = file.writeFile.bind(file), sync = file.sync.bind(file);
      file.writeFile = async (...values: Parameters<typeof file.writeFile>) => { events.push('write'); return write(...values); };
      file.sync = async () => { events.push('file sync'); return sync(); };
    } else if (String(args[0]) === dirname(index)) {
      const sync = file.sync.bind(file);
      file.sync = async () => { events.push('directory sync'); return sync(); };
    }
    return file;
  };
  fs.rename = async (...args: Parameters<typeof fs.rename>) => {
    if (String(args[1]) === index) events.push('rename');
    return rename(...args);
  };
  syncBuiltinESMExports();
  try {
    const durable = ['temporary open', 'write', 'file sync', 'rename', 'directory sync'];
    await compactLeaseIndex(root, new Set(), () => {}, true);
    assert.deepEqual(events, durable, 'migration publishes the initial index durably');
    events.length = 0;
    await compactLeaseIndex(root, new Set(), () => {});
    await compactLeaseIndex(root, new Set(), () => {}, true);
    assert.deepEqual(events, [], 'unchanged periodic and rebuild passes open no temporary file');
    await compactLeaseIndex(root, new Set(['settled']), () => {});
    assert.deepEqual(events, durable, 'changed membership still uses the durable publication boundary');
    assert.deepEqual(JSON.parse(await fs.readFile(index, 'utf8')), { version: 1, leases: ['live'] });
    events.length = 0;
    await compactLeaseIndex(root, new Set(['settled']), () => {});
    assert.deepEqual(events, []);
  } finally {
    fs.open = open; fs.rename = rename; syncBuiltinESMExports();
  }
}));

test('fresh empty compaction leaves the index absent without a temporary file', async t => fakeOnlyFixture(t, async root => {
  await fs.mkdir(join(root, '.cland/run'), { recursive: true });
  const open = fs.open;
  let writes = 0;
  fs.open = async (...args: Parameters<typeof fs.open>) => {
    if (args[1] === 'wx') writes++;
    return open(...args);
  };
  syncBuiltinESMExports();
  try {
    await compactLeaseIndex(root, new Set(), () => {}, true);
    await compactLeaseIndex(root, new Set(), () => {});
    assert.equal(writes, 0, 'an absent empty index needs no durable publication');
    await assert.rejects(fs.stat(join(root, '.cland/run/executor/lease-index.json')), { code: 'ENOENT' });
    assert.deepEqual(await readLeases(root), []);
    assert.deepEqual(await readDemoLeases(root), []);
  } finally { fs.open = open; syncBuiltinESMExports(); }
}));

test('first append preserves legacy leases discovered without an index', async t => fakeOnlyFixture(t, async root => {
  await seedLeases(root, [row('legacy', 'active')]);
  assert.deepEqual((await readLeases(root)).map(l => l.lease), ['legacy']);
  await writeLease(root, row('new', 'active'));
  assert.deepEqual(JSON.parse(await fs.readFile(join(root, '.cland/run/executor/lease-index.json'), 'utf8')).leases.sort(), ['legacy', 'new']);
}));

test('settled legacy history publishes an empty index that ends directory fallback', async t => fakeOnlyFixture(t, async root => {
  await seedLeases(root, [row('legacy', 'released')]);
  await compactLeaseIndex(root, new Set(['legacy']), () => {}, true);
  assert.deepEqual(JSON.parse(await fs.readFile(join(root, '.cland/run/executor/lease-index.json'), 'utf8')), { version: 1, leases: [] });
  const readdir = fs.readdir;
  fs.readdir = async () => { throw new Error('settled history must not be enumerated'); };
  syncBuiltinESMExports();
  try {
    assert.deepEqual(await readLeases(root), []);
    assert.deepEqual(await readDemoLeases(root), []);
  } finally { fs.readdir = readdir; syncBuiltinESMExports(); }
}));

async function demoHistory(t: TestContext, root: string, count: number) {
  const env = environment(root);
  // Each fixture builds its history once. The scale control never mutates it
  // after repair; report mutations use a separate, small root.
  const released = Array.from({ length: count }, (_, i) => ({ ...row(`old-${i}`, 'released'), demo: { epic: `E-${i}`, commit: 'fixture' } }));
  await seedLeases(root, [row('live-a', 'active'), row('live-b', 'creating')]);
  const native = fs.readFile, nativeReaddir = fs.readdir;
  const history = new Map(released.map(l => [join(root, '.cland/run/executor/leases', l.lease, 'lease.json'), JSON.stringify(l)]));
  let reads = 0, enumerations = 0, decodedBytes = 0;
  t.mock.method(fs, 'readFile', async (...args: Parameters<typeof fs.readFile>) => {
    reads++;
    const path = String(args[0]);
    if (virtual(path) && !history.has(path)) throw Object.assign(new Error('virtual file absent'), { code: 'ENOENT' });
    const value = history.get(path) ?? await native(...args); decodedBytes += Buffer.byteLength(value); return value;
  });
  t.mock.method(fs, 'readdir', async (...args: Parameters<typeof fs.readdir>) => {
    enumerations++;
    const real = await nativeReaddir(...args);
    return String(args[0]) === join(root, '.cland/run/executor/leases') ? [...real, ...released.map(l => ({ name: l.lease, isDirectory: () => true }))] : real;
  });
  // Cold lookup/report files are an in-memory filesystem; only live/index/ledger
  // files use scratch storage. Large history never adds native fixture work.
  const virtual = (path: string) => /\/(demo-leases|demo-reports)(\/|$)/.test(path) || /\/leases\/old-\d+(\/|$)/.test(path);
  const nativeOpen = fs.open, nativeRename = fs.rename, nativeRm = fs.rm, nativeOpendir = fs.opendir;
  t.mock.method(fs, 'open', async (...args: Parameters<typeof fs.open>) => virtual(String(args[0])) ? {
    writeFile: async (value: string) => { history.set(String(args[0]), value); }, sync: async () => {}, close: async () => {},
  } : nativeOpen(...args));
  t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
    if (!virtual(String(args[1]))) return nativeRename(...args);
    history.set(String(args[1]), history.get(String(args[0]))!); history.delete(String(args[0]));
  });
  t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
    if (!virtual(String(args[0]))) return nativeRm(...args);
    history.delete(String(args[0]));
  });
  t.mock.method(fs, 'opendir', async (...args: Parameters<typeof fs.opendir>) => {
    if (!String(args[0]).endsWith('/demo-reports')) return nativeOpendir(...args);
    return { async *[Symbol.asyncIterator]() { for (const path of [...history.keys()]) if (dirname(path) === String(args[0])) yield { name: basename(path), isFile: (): boolean => true }; } };
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  await publishSpend(env, released.map(lease => spendEntry(root, lease)));
  await compactLeaseHistory(root, env, () => {}, true);
  return {
    env,
    resetCounts() { reads = 0; enumerations = 0; decodedBytes = 0; },
    counts: () => ({ fileReads: reads, enumerations, decodedBytes }),
  };
}

test('settled history keeps lease reads bounded across 5000 distinct demo epics', async t => fakeOnlyFixture(t, async root => {
  const fixture = await demoHistory(t, root, 5000);
  fixture.resetCounts();
  assert.deepEqual((await readLeases(root)).map(l => l.lease).sort(), ['live-a', 'live-b']);
  const { fileReads: reads, decodedBytes, enumerations } = fixture.counts();
  assert.equal(reads, 3, 'two live files plus one bounded index');
  assert.ok(decodedBytes < 2048, `hot decoded bytes ${decodedBytes} include no historical epic map`);
  t.diagnostic(JSON.stringify({ historicalDemoEpics: 5000, liveLeases: 2, fileReads: reads, decodedBytes }));
  assert.equal(enumerations, 0);
  assert.equal((await readDemoLeases(root, 'E-1'))[0]!.state, 'released');
  const demos = new Demos(root,
    { view: () => ({ id: 'E-1', kind: 'epic', state: 'open', comments: [], verdicts: [] }), isPlanContainer: () => true } as unknown as ConstructorParameters<typeof Demos>[1],
    { clock: new FakeClock() } as unknown as ConstructorParameters<typeof Demos>[2], fixture.env);
  assert.equal((await demos.status('E-1')).state, 'released');
  assert.equal(fixture.counts().enumerations, 0, 'released demo status never enumerates history');
}));

test('released demo reports drain bounded batches and recover interrupted acknowledgement', async t => fakeOnlyFixture(t, async root => {
  const fixture = await demoHistory(t, root, 65);
  fixture.resetCounts();
  const comments: Array<{ author: string; text: string }> = [];
  const demos = new Demos(root,
    { view: () => ({ id: 'E-1', kind: 'epic', state: 'open', comments, verdicts: [] }), isPlanContainer: () => true,
      comment: async (_actor: unknown, _epic: string, text: string) => { comments.push({ author: 'hub', text }); } } as unknown as ConstructorParameters<typeof Demos>[1],
    { clock: new FakeClock() } as unknown as ConstructorParameters<typeof Demos>[2], fixture.env);
  assert.equal((await demos.status('E-1')).state, 'released');
  const renameBeforeReport = fs.rename;
  const reportFault = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
    if (String(args[1]).endsWith('/demo-reported.json')) throw new Error('fixture report checkpoint interrupted');
    return renameBeforeReport(...args);
  });
  syncBuiltinESMExports();
  try { await assert.rejects(demos.reconcile(), /report checkpoint interrupted/); }
  finally { reportFault.mock.restore(); syncBuiltinESMExports(); }
  assert.equal(comments.length, 1, 'the report exists before its queue acknowledgement');
  await demos.reconcile();
  assert.ok(comments.length > 0 && comments.length <= 32, 'restart drains a bounded released-demo report batch');
  const firstBatch = comments.map(c => c.text);
  await demos.reconcile();
  assert.equal(comments.length, 64, 'a later pass advances the durable report queue');
  assert.equal(new Set(comments.map(c => c.text)).size, 64, 'acknowledged reports are not replayed');
  assert.ok(firstBatch.every(text => comments.some(c => c.text === text)));
  assert.equal(fixture.counts().enumerations, 0, 'released demo lookup uses only the index');
}));

test('missing spend and interrupted repair retain recoverable lease membership', async t => fakeOnlyFixture(t, async root => {
  const env = environment(root);
  const released = [row('old-0', 'released'), row('old-1', 'released')];
  await seedLeases(root, [...released, row('live-a', 'active'), row('live-b', 'creating')]);
  const entries = released.map(lease => spendEntry(root, lease));
  await publishSpend(env, entries);
  await compactLeaseHistory(root, env, () => {}, true);
  assert.deepEqual((await readLeases(root)).map(l => l.lease).sort(), ['live-a', 'live-b']);
  const events: Record<string, unknown>[] = [];
  // Missing accounting settles unknown; a pending reservation stays recoverable.
  entries.shift(); entries[0]!.cost = null;
  await publishSpend(env, entries);
  await compactLeaseHistory(root, env, event => events.push(event), true, { alive: () => true, started: () => 'fixture identity' });
  assert.ok(events.some(e => e.event === 'executor-lease-spend-missing' && e.lease === 'old-0'));
  assert.ok(!events.some(e => e.event === 'executor-lease-spend-missing' && e.lease === 'old-1'));
  assert.equal((await readLeases(root)).length, 3);
  entries.push(JSON.parse(await fs.readFile(spendPath(env), 'utf8')).entries.find((entry: { lease: string }) => entry.lease === 'old-0'));
  // Fail publication after scanning; the earlier checkpoint remains usable.
  const before = await fs.readFile(join(root, '.cland/run/executor/lease-index.json'), 'utf8');
  entries[0]!.cost = 0;
  await publishSpend(env, entries);
  const renameAfterColdMock = fs.rename;
  const fault = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
    if (String(args[1]).endsWith('lease-index.json')) throw new Error('fixture index publication interrupted');
    return renameAfterColdMock(...args);
  });
  syncBuiltinESMExports();
  await assert.rejects(compactLeaseHistory(root, env, () => {}, true), /publication interrupted/);
  assert.equal(await fs.readFile(join(root, '.cland/run/executor/lease-index.json'), 'utf8'), before);
  fault.mock.restore(); syncBuiltinESMExports();
  await compactLeaseHistory(root, env, () => {}, true);
  assert.deepEqual((await readLeases(root)).map(l => l.lease).sort(), ['live-a', 'live-b'], 'retry publishes the changed membership');
  // A startup repair recovers a file missed by an interrupted/older writer.
  const extra = row('interrupted', 'active');
  await seedLeases(root, [extra]);
  await compactLeaseHistory(root, env, () => {}, true);
  assert.ok((await readLeases(root)).some(l => l.lease === 'interrupted'));
  await writeLease(root, row('new', 'active'));
  assert.ok((await readLeases(root)).some(l => l.lease === 'new'));
}));

test('executor recovery publishes only live meta rows and keeps direct released lookups', async t => fakeOnlyFixture(t, async root => {
  const { DropletExecutor } = await import('../src/executor/droplet/droplet.ts');
  const { spendPath } = await import('../src/executor/droplet/spend.ts');
  const { readLease, leaseDir } = await import('../src/executor/droplet/lease.ts');
  const env = fixtureEnvironment(root, { ...process.env, CLAND_EXECUTOR_STATE: join(root, 'ledger') });
  const released: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: 'released', run: 'run', name: 'fixture', tags: ['cland'], size: 'fixture', region: 'fixture', priceHourly: 1, keyName: 'fixture', state: 'released', resource: null, keyId: null, costUsd: 0, released: '2026-11-17T00:01:00Z', created: '2026-11-17T00:00:00Z', deadline: '2026-11-17T01:00:00Z' };
  const live = { ...released, lease: 'live', state: 'creating' as const };
  await fs.mkdir(join(root, '.cland/run'), { recursive: true });
  await writeLease(root, released); await writeLease(root, live);
  await fs.mkdir(dirname(spendPath(env)), { recursive: true });
  await fs.writeFile(spendPath(env), JSON.stringify({ version: 1, legacyRetired: true, entries: [{ project: root, lease: released.lease, run: released.run, size: released.size, reservation: 1, cost: 0, created: released.created, deadline: released.deadline, released: released.released }] }));
  const meta = new Map<string, string>();
  const store = { meta: (key: string) => meta.get(key) ?? null, setMeta: (key: string, value: string) => meta.set(key, value) } as unknown as Store;
  const api = new Proxy({} as Provider, { get: () => () => assert.fail('provider call in index recovery') });
  const executor = new DropletExecutor(root, store, () => {}, env, undefined, { clock: new FakeClock(), api });
  try {
    // Crash window: spend is settled but the local keys have not been removed.
    const privateKey = join(leaseDir(root, released), 'key'), publicKey = `${privateKey}.pub`;
    await fs.writeFile(privateKey, 'fixture private key'); await fs.writeFile(publicKey, 'fixture public key');
    const nativeRm = fs.rm;
    const cleanupFault = t.mock.method(fs, 'rm', async (...args: Parameters<typeof fs.rm>) => {
      if (String(args[0]) === publicKey) throw new Error('fixture cleanup interrupted');
      return nativeRm(...args);
    });
    syncBuiltinESMExports();
    try { await assert.rejects(executor.reconcile(true), /cleanup interrupted/); }
    finally { cleanupFault.mock.restore(); syncBuiltinESMExports(); }
    assert.ok((await readLeases(root)).some(l => l.lease === released.lease), 'failed key cleanup keeps recovery membership');
    await executor.reconcile(false);
    await assert.rejects(fs.readFile(privateKey), { code: 'ENOENT' });
    await assert.rejects(fs.readFile(publicKey), { code: 'ENOENT' });
    await executor.reconcile(true);
    assert.deepEqual(JSON.parse(meta.get('executor-leases')!).map((l: DropletLease) => l.lease), ['live']);
    assert.equal((await readLease(leaseDir(root, released))).state, 'released');
    const unindexed = { ...live, lease: 'interrupted' };
    await fs.mkdir(leaseDir(root, unindexed));
    await fs.writeFile(join(leaseDir(root, unindexed), 'lease.json'), JSON.stringify(unindexed));
    const nativeRename = fs.rename;
    const fault = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
      if (String(args[1]).endsWith('lease-index.json')) throw new Error('fixture repair interrupted');
      return nativeRename(...args);
    });
    syncBuiltinESMExports();
    await assert.rejects(executor.reconcile(true), /repair interrupted/);
    fault.mock.restore(); syncBuiltinESMExports();
    await executor.reconcile(false);
    assert.deepEqual(JSON.parse(meta.get('executor-leases')!).map((l: DropletLease) => l.lease).sort(), ['interrupted', 'live'], 'periodic retry completes a failed startup repair');
  } finally { await executor.close(); }
}));
