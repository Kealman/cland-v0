// T1: durable suite history and inspection use an isolated store and fake time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../src/hub/store.ts';
import { Suites, releaseT3Cover, type SuiteJob } from '../src/hub/suites.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import { FakeClock } from './fake-clock.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

async function fixture(t: test.TestContext, count: number, reported: boolean, options: { job?: Partial<SuiteJob>; onJob?: (job: Readonly<SuiteJob>) => void } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'suite-persistence-'));
  const env = fixtureEnvironment(root, process.env);
  const database = join(root, 'hub.db');
  const store = new Store(database), clock = new FakeClock();
  t.mock.method(LocalExecutor.prototype, 'reap', async () => {});
  const jobs: SuiteJob[] = [];
  for (let i = 0; i < count; i++) {
    const dir = join(root, String(i));
    if (!reported) await mkdir(dir);
    const finished = clock.now().toISOString();
    const job: SuiteJob = { id: String(i), executor: 'droplet', mode: 'auto', cwd: root, topic: 'topic', to: [], actor: { name: `actor-${i}`, sessionId: `actor-${i}`, shell: true },
      head: 'a'.repeat(40), branch: 'fixture', log: join(dir, 'log'), result: join(dir, 'result'), gate: join(dir, 'gate'),
      pid: null, started: null, outcome: { code: 0, cause: '' }, artifact: null, reported, error: null,
      cleaned: true, progressReported: true, budgetReported: true, finished, state: 'finished',
      selection: { mode: 'hub-only', files: ['x'.repeat(9000)], reason: 'history' }, ...options.job };
    if (!reported) { await writeFile(job.result, JSON.stringify({ code: 0, finished })); await writeFile(job.log, ''); }
    jobs.push(job);
  }
  store.setMeta('suite-jobs', JSON.stringify(jobs));
  let reports = 0, allowed = false;
  const suites = new Suites(store, root, async () => { reports++; if (!allowed) throw new Error('forbidden: artifact.create (a session with no role has no tools)'); }, { clock, env, ...(options.onJob ? { onJob: options.onJob } : {}) });
  t.after(async () => { await suites.close(); store.close(); await rm(root, { recursive: true, force: true }); });
  return { root, env, store, suites, clock, database, reports: () => reports, allowReports: () => { allowed = true; } };
}

test('six permanently forbidden finished reports perform no writes on later inspect ticks', async t => {
  const f = await fixture(t, 6, false);
  await f.clock.advance(1000); await f.suites.settled();
  const writes = t.mock.method(f.store, 'setMeta');
  for (let i = 0; i < 3; i++) { await f.clock.advance(1000); await f.suites.settled(); }
  assert.equal(f.reports(), 6);
  assert.equal(writes.mock.calls.filter(call => call.arguments[0].startsWith('suite-job')).length, 0);
});

test('930 finished jobs migrate out of the hot snapshot and survive reopening', async t => {
  const f = await fixture(t, 930, true);
  assert.ok(Buffer.byteLength(f.store.meta('suite-jobs')!) < 1_000_000);
  const reopened = new Store(f.database);
  t.after(() => reopened.close());
  const suites = new Suites(reopened, f.root, async () => {}, { clock: f.clock, env: f.env });
  t.after(() => suites.close());
  assert.equal(suites.status().length, 930);
});


test('a changed authorization retries a forbidden report once', async t => {
  const f = await fixture(t, 1, false);
  await f.clock.advance(1000); await f.suites.settled();
  assert.equal(f.reports(), 1);
  await f.clock.advance(1000); await f.suites.settled();
  assert.equal(f.reports(), 1, 'unchanged authorization does not retry');
  f.allowReports(); f.suites.reportPermissionsChanged('actor-0');
  await f.suites.settled();
  assert.equal(f.reports(), 2);
  assert.equal(f.suites.status()[0]!.reported, true);
  await f.clock.advance(1000); await f.suites.settled();
  assert.equal(f.reports(), 2);
});


test('cleanup-blocked terminal cards wait for the persisted error checkpoint', async t => {
  // T1: delay the error row at the asynchronous executor cleanup boundary.
  // The tracker reads latest() when it builds task frames, including unrelated updates.
  const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  const error = 'suite cleanup waiting for a verified worker identity; process preserved';
  t.mock.method(LocalExecutor.prototype, 'status', async () => ({ state: 'done', code: 1 }));
  t.mock.method(LocalExecutor.prototype, 'release', async () => {
    entered.resolve(); await release.promise; throw new Error(error);
  });
  const announcements: Array<{ state: string | undefined; error: string | null }> = [];
  const f = await fixture(t, 1, false, {
    job: { item: 'T-1', executor: 'local', state: 'running', cleaned: false, outcome: { code: 1, cause: 'fixture admission failed' } },
    onJob: job => {
      const reader = new Store(f.database);
      try {
        const persisted = JSON.parse(reader.meta(`suite-job:${job.id}`)!) as { job: SuiteJob };
        announcements.push({ state: job.state, error: persisted.job.error });
      } finally { reader.close(); }
    },
  });
  try {
    await f.clock.advance(1000); await entered.promise;
    for (const [item, branch] of [['T-1', null], ['T-2', 'fixture']] as const) {
      assert.equal(f.suites.latest(item, branch)?.state, 'running', 'a task frame cannot expose finished while the error row is delayed');
    }
    assert.deepEqual(announcements, [], 'cleanup has not produced a terminal announcement');
  } finally { release.resolve(); await f.suites.settled(); }
  for (const [item, branch] of [['T-1', null], ['T-2', 'fixture']] as const) {
    assert.equal(f.suites.latest(item, branch)?.state, 'finished');
  }
  assert.deepEqual(announcements, [{ state: 'finished', error }], 'the terminal announcement observes the committed cleanup error');
  assert.equal((JSON.parse(f.store.meta('suite-job:0')!) as { job: SuiteJob }).job.cleaned, false);
  assert.equal(f.suites.status()[0]!.reported, false);
});


test('3000 large legacy archives start from bounded summaries and hydrate only by id', async t => {
  const f = await fixture(t, 0, true);
  await f.suites.close();
  const db = new DatabaseSync(f.database);
  // Emulate the previous wire/storage shape, before the summary index existed.
  db.exec('drop trigger suite_summary_insert; drop trigger suite_summary_update; drop trigger suite_summary_delete;');
  db.prepare('delete from meta where key = ?').run('suite-summary-index-v1');
  const insert = db.prepare('insert into meta (key, value) values (?, ?)');
  const payload = 'x'.repeat(20_000);
  let bytes = 0;
  db.exec('begin');
  for (let n = 0; n < 3000; n++) {
    const value = JSON.stringify({ position: n, job: { id: String(n), executor: 'local', state: 'finished', cleaned: true, reported: true,
      outcome: { code: 0, cause: '' }, head: 'head', branch: 'branch', to: [], actor: null, mode: 'auto', topic: 'topic',
      tierPlan: [payload], selection: { mode: 'full', files: [payload], reason: 'legacy', loadGateKnownTests: [payload] },
      timingIdentities: [payload], lease: { resource: payload } } });
    bytes += Buffer.byteLength(value);
    insert.run(`suite-job:${n}`, value);
  }
  db.exec('commit'); db.close();
  const store = new Store(f.database);
  t.after(() => store.close());
  const summaries = t.mock.method(store, 'suiteJobSummaries');
  const full = t.mock.method(store, 'suiteJob');
  const old = t.mock.method(store, 'suiteJobHistory', () => { throw new Error('unbounded history read'); });
  const suites = new Suites(store, f.root, async () => {}, { clock: f.clock, env: f.env });
  t.after(() => suites.close());
  assert.ok(bytes > 250_000_000, 'positive control: large archive input');
  const rows = summaries.mock.calls.flatMap(call => call.result!);
  assert.equal(rows.length, 3000);
  assert.ok(rows.every(row => Buffer.byteLength(row) < 1500));
  assert.ok(rows.reduce((n, row) => n + Buffer.byteLength(row), 0) < 4_500_000);
  assert.equal(full.mock.callCount(), 0, 'startup never loads a finished full record');
  assert.equal(old.mock.callCount(), 0);
  const { MergeBatches } = await import('../src/hub/merge-batches.ts');
  const { DevT3Probes } = await import('../src/hub/dev-t3-probe.ts');
  const member = { item: 'T-1', branch: 'branch', head: 'head', verdictBase: 'dev', enqueued: f.clock.now().toISOString(), by: { id: 'coord', name: 'coord', role: 'coordinator' } };
  store.setMeta('merge-batch', JSON.stringify({ id: 'retained', run: '0', members: [member], failed: 'held' }));
  const unexpected = async (): Promise<never> => { throw new Error('unexpected batch operation'); };
  const batches = new MergeBatches(store, suites, f.clock, { entries: () => [member], isLanded: () => false,
    build: unexpected, checkout: unexpected, cleanup: unexpected, land: unexpected, rebuildReason: unexpected, drop: () => {}, report: () => {}, notice: () => {} },
    () => ({ queue: true, batch: 1, batchWaitMs: 0 }));
  try { await batches.tick(); await batches.tick(); } finally { await batches.close(); }
  const probes = new DevT3Probes(store, suites, f.root, f.env, { contains: async () => false, identity: async () => 'tree', checkout: unexpected, remove: unexpected });
  const probe = await probes.probe({ event: 'verification-dev-t3-result', run: 'red', head: 'head', tree: 'tree', previousGreenHead: null, previousGreenRun: null, merges: null, result: 'red', failingFiles: ['hub/test/example.test.ts'], artifact: 'A-1', path: 'fixture' }, 'head', 'hub/test/example.test.ts');
  assert.equal(probe!.result, 'absent');
  assert.equal(full.mock.callCount(), 0, 'automatic batch/probe searches never hydrate archived plans');
  assert.equal(suites.recentStatus().length, 1);
  const record = JSON.parse(store.suiteJob('0')!) as { job: SuiteJob };
  assert.equal(record.job.selection!.files[0], payload, 'previous full record remains intact');
  assert.equal(full.mock.callCount(), 1, 'explicit retrieval loads only the requested durable id');
  const oldWriter = new DatabaseSync(f.database);
  try {
    oldWriter.prepare('update meta set value = ? where key = ?').run(JSON.stringify({ position: 0, job: { ...record.job, head: 'older-hub-update' } }), 'suite-job:0');
  } finally { oldWriter.close(); }
  assert.equal((JSON.parse(store.suiteJobSummaries().find(row => JSON.parse(row).job.id === '0')!) as { job: SuiteJob }).job.head, 'older-hub-update');
  store.clearMeta('suite-job:0');
  assert.equal(store.suiteJobSummaries().length, 2999, 'deletion maintains index');
});

test('archived unfinished reporting hydrates its full execution plan on restart', async t => {
  const f = await fixture(t, 1, false);
  await f.suites.close();
  const reads = t.mock.method(f.store, 'suiteJob');
  const restored = new Suites(f.store, f.root, async () => {}, { clock: f.clock, env: f.env });
  t.after(() => restored.close());
  assert.equal(reads.mock.callCount(), 1);
  assert.equal(restored.status()[0]!.selection!.files[0]!.length, 9000);
});

test('active snapshot wins over an archived summary at the same durable id', async t => {
  const f = await fixture(t, 1, true);
  await f.suites.close();
  const archived = JSON.parse(f.store.suiteJob('0')!) as { job: SuiteJob };
  const active = { ...archived.job, state: 'queued', reported: false, outcome: null, cleaned: false };
  f.store.setMeta('suite-jobs', JSON.stringify([active]));
  const restored = new Suites(f.store, f.root, async () => {}, { clock: f.clock, env: f.env });
  t.after(() => restored.close());
  assert.equal(restored.status(false)[0]!.state, 'queued');
  assert.equal(restored.status(false)[0]!.selection!.files[0]!.length, 9000);
});

for (const mode of ['finished', 'message', 'cached']) test(`archived ${mode} timing repair survives reopening without hydrating plans`, async t => {
  const f = await fixture(t, 0, true);
  await f.suites.close();
  const queued = new Date(f.clock.now().getTime() - 5000).toISOString();
  const started = new Date(f.clock.now().getTime() - 3000).toISOString();
  const finished = f.clock.now().toISOString();
  if (mode !== 'finished') f.store.record({ id: 'suite:legacy', from: 'hub', fromKind: 'hub', via: 'hub', to: [], text: 'result', ts: finished }, [], f.clock.now().getTime());
  f.store.setMeta('suite-job:legacy', JSON.stringify({ position: 0, job: { id: 'legacy', executor: 'local', reported: true, cleaned: true,
    state: 'finished', pid: 123, queued, started, ...(mode === 'finished' ? { finished } : {}), ...(mode === 'cached' ? { cached: { run: 'original', head: 'old', tree: 'tree' } } : {}), outcome: { code: 0, cause: '' }, head: 'head', branch: 'branch', mode: 'auto', to: [], actor: null,
    selection: { mode: 'full', files: ['large plan must remain'], reason: 'legacy' } } }));
  const repairs = t.mock.method(f.store, 'repairSuiteJobTiming');
  const reads = t.mock.method(f.store, 'suiteJob');
  const suites = new Suites(f.store, f.root, async () => {}, { clock: f.clock, env: f.env });
  await suites.close();
  assert.equal(suites.snapshot().metrics.run.medianMs, mode === 'cached' ? 0 : 3000);
  assert.equal(suites.snapshot().metrics.wait.medianMs, mode === 'cached' ? 0 : 2000);
  assert.equal(reads.mock.callCount(), 0, 'repair uses compact facts only');
  const record = JSON.parse(f.store.suiteJob('legacy')!) as { job: SuiteJob };
  assert.equal(record.job.admittedAt, started);
  assert.equal(record.job.completedAt, finished);
  assert.equal(record.job.timingEstimated, true);
  assert.deepEqual(record.job.selection!.files, ['large plan must remain']);
  const reopened = new Suites(f.store, f.root, async () => {}, { clock: f.clock, env: f.env });
  t.after(() => reopened.close());
  assert.equal(reopened.snapshot().metrics.run.medianMs, mode === 'cached' ? 0 : 3000);
  assert.equal(reads.mock.callCount(), 1, 'reopen needs no full read');
  assert.equal(repairs.mock.callCount(), 1, 'timing patch is checkpointed once');
});


test('summary release eligibility preserves legacy soak booleans and selected-test presence', async t => {
  const f = await fixture(t, 0, true);
  const artifact = f.store.registerArtifact(id => ({ id, title: 'receipt', kind: 'file', path: join(f.root, 'receipt.log'), creator: 'hub', time: f.clock.now().toISOString(), topic: 'topic', status: 'shared' }), () => {});
  const job = { id: 'cover', head: 'head', tree: 'tree', integrated: true, branch: 'dev', occasion: 'soak', state: 'finished',
    reported: true, cleaned: true, artifact: artifact.id, outcome: { code: 0, cause: '' }, selection: { mode: 'full', soak: true, files: [] } };
  f.store.setMeta('suite-job:cover', JSON.stringify({ position: 0, job }));
  assert.deepEqual(releaseT3Cover(f.store, 'tree'), { run: 'cover', head: 'head' });
  for (const selection of [{ ...job.selection, soak: false }, { ...job.selection, tests: [] }]) {
    f.store.setMeta('suite-job:cover', JSON.stringify({ position: 0, job: { ...job, selection } }));
    assert.equal(releaseT3Cover(f.store, 'tree'), null);
  }
});

test('archived two-shard Linux stage summaries preserve their cover after restart', async t => {
  const f = await fixture(t, 0, true);
  await f.suites.close();
  const job = { id: 'original', executor: 'droplet', state: 'finished', reported: true, cleaned: true,
    head: 'head', tree: 'tree', branch: 'dev', integrated: true, occasion: 'stage', outcome: { code: 0, cause: '' },
    selection: { mode: 'full', soak: true, files: [] }, platform: { os: 'linux' },
    shards: [1, 2].map(n => ({ id: `shard-${n}`, outcome: { code: 0, cause: '' }, platform: { os: 'linux' } })) };
  f.store.setMeta('suite-job:original', JSON.stringify({ position: 0, job }));
  f.store.setMeta('suite-job:cached', JSON.stringify({ position: 1, job: { ...job, id: 'cached', shards: undefined, cached: { run: 'original', head: 'head', tree: 'tree' } } }));
  const restored = new Suites(f.store, f.root, async () => {}, { clock: f.clock, env: f.env });
  t.after(() => restored.close());
  assert.deepEqual(restored.stageCovers(), ['original', 'cached'].map(id => ({ id, head: 'head', tree: 'tree', platform: 'Linux droplet' })));
  assert.deepEqual(restored.stageMissing('tree'), ['macOS']);
});
