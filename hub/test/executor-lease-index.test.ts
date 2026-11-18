// T1: scratch files and injected ledger receipts, no native execution.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { basename, dirname, join } from 'node:path';
import { compactLeaseIndex, readDemoLeases, readLeases, writeLease, type DropletLease } from '../src/executor/droplet/lease.ts';
import { compactLeaseHistory, spendPath } from '../src/executor/droplet/spend.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fakeOnlyFixture } from './fake-only-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import type { Store } from '../src/hub/store.ts';
import type { Provider } from '../src/executor/droplet/dependencies.ts';
import { Demos } from '../src/hub/demos.ts';

const row = (id: string, state: DropletLease['state']): DropletLease => ({ kind: 'droplet', provider: 'digitalocean', lease: id, run: id, name: id, tags: ['cland'], size: 'fixture', region: 'fixture', priceHourly: 1, keyName: id, state, resource: null, keyId: null, created: '2026-11-17T00:00:00Z', deadline: '2026-11-17T01:00:00Z', ...(state === 'released' ? { costUsd: 0, released: '2026-11-17T00:01:00Z' } : {}) });
const environment = (root: string) => fixtureEnvironment(root, { ...process.env, CLAND_EXECUTOR_STATE: join(root, 'ledger') });

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
  // Missing and pending accounting both fail closed at the startup repair.
  entries.shift(); entries[0]!.cost = null;
  await publishSpend(env, entries);
  await compactLeaseHistory(root, env, event => events.push(event), true);
  assert.ok(events.some(e => e.event === 'executor-lease-spend-missing' && e.lease === 'old-0'));
  assert.ok(events.some(e => e.event === 'executor-lease-spend-missing' && e.lease === 'old-1'));
  assert.equal((await readLeases(root)).length, 4);
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
  assert.deepEqual((await readLeases(root)).map(l => l.lease).sort(), ['live-a', 'live-b', 'old-0'], 'retry publishes the changed membership');
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
