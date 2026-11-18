// T1: durable suite history and inspection use an isolated store and fake time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { Store } from '../src/hub/store.ts';
import { Suites, releaseT3Cover, suiteSummary, type SuiteJob } from '../src/hub/suites.ts';
import { LocalExecutor } from '../src/executor/local.ts';
import { FakeClock } from './fake-clock.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { heartbeatDigest } from '../src/hub/heartbeat.ts';
import { devT3Result } from '../src/hub/dev-t3-result.ts';
import { stageCase } from './stage-case-fixture.ts';

test('legacy green report without a native finish receipt retains its report-only budget exit', async t => {
  const f = await fixture(t, 1, false, { job: { cleaned: true }, omitFinished: true });
  f.allowReports();
  await unlink(join(f.root, '0/result'));
  await writeFile(join(f.root, '0/log'), '# tests 2\n# pass 2\n');
  await f.clock.advance(1000); await f.suites.settled();
  assert.equal(f.suites.status()[0]!.reported, true);
  assert.deepEqual(f.suites.status()[0]!.outcome, { code: 0, cause: '' });
  assert.doesNotMatch(await readFile(join(f.root, '0/log'), 'utf8'), /missing result receipt/);
});

for (const prior of ['failed', 'green', 'unknown', 'not-run'] as const) test(`missing result recovery preserves execution facts and periodic failure identities (${prior})`, { timeout: 30000 }, async t => {
  const outcome = prior === 'failed' ? { code: 7, cause: 'worker exit 7' }
    : prior === 'green' ? { code: 0, cause: '' }
    : prior === 'not-run' ? { code: 1, cause: 'host gate refused before execution', notRun: 'infrastructure' as const } : null;
  const f = await fixture(t, 1, false, { job: { cleaned: false, occasion: 'dev-t3', outcome } });
  f.allowReports();
  await unlink(join(f.root, '0/result'));
  const surviving = '# tests 2\n# pass 1\n# fail 1\ntest at hub/test/regression.test.ts:10:1\n✖ known failing test (1ms)\n';
  await writeFile(join(f.root, '0/log'), prior === 'not-run' ? 'host gate refused before execution\n' : surviving);
  await f.clock.advance(1000); await f.suites.settled();
  const job = (JSON.parse(f.store.suiteJob('0')!) as { job: SuiteJob }).job;
  assert.equal(job.reported, true);
  assert.equal(job.outcome!.code, prior === 'failed' ? 7 : 1);
  if (prior === 'not-run') assert.deepEqual(job.outcome, outcome, 'first refusal materialization retains the exact producer outcome');
  else assert.match(job.outcome!.cause, /missing result receipt/);
  assert.equal(job.outcome!.notRun, prior === 'not-run' ? 'infrastructure' : undefined);
  const log = await readFile(job.log, 'utf8');
  const periodic = await devT3Result(job, log, { id: 'fixture-artifact', path: job.log }, async () => assert.fail('no previous green range'));
  assert.equal(periodic.result, prior === 'not-run' ? 'not-run' : 'red');
  assert.deepEqual(periodic.failingFiles, prior === 'not-run' ? [] : ['hub/test/regression.test.ts']);
  if (prior !== 'not-run') {
    assert.match(suiteSummary(log), /tests 2; pass 1; fail 1/);
    assert.match(suiteSummary(log), /known failing test/);
  }
});

for (const restart of [false, true]) for (const refused of [false, true]) test(`terminal remote run without a lease releases capacity and posts missing evidence once (restart=${restart}, refused=${refused})`, { timeout: 30000 }, async t => {
  const outcome = { code: 1, cause: refused ? 'provider refused before execution' : 'collection lost', ...(refused ? { notRun: 'provider-capacity' as const } : {}) };
  const f = await fixture(t, 1, false, { job: { cleaned: false, outcome } });
  const finished = f.clock.now().toISOString();
  f.allowReports();
  await unlink(join(f.root, '0/log'));
  await unlink(join(f.root, '0/result'));
  if (restart) await f.reopen();
  assert.match(heartbeatDigest(f.store, [], 1000, f.clock.now().getTime(), 0, 1000).text, /ended without a posted result/);
  assert.deepEqual((await f.suites.queue()).remote, [], 'terminal report recovery owns no remote slot');
  await f.clock.advance(1000); await f.suites.settled();
  assert.equal(f.suites.status()[0]!.reported, true);
  if (refused) assert.deepEqual(f.suites.status()[0]!.outcome, outcome);
  else assert.match(f.suites.status()[0]!.outcome!.cause, /missing.*receipt/);
  assert.match(await readFile(join(f.root, '0/log'), 'utf8'), /missing.*receipt/);
  const receipt = JSON.parse(await readFile(join(f.root, '0/result'), 'utf8'));
  assert.equal(receipt.finished, finished);
  if (refused) assert.deepEqual(receipt, { ...outcome, finished });
  assert.equal(f.reports(), 1);
  assert.doesNotMatch(heartbeatDigest(f.store, [], 1000, f.clock.now().getTime(), 0, 1000).text, /ended without a posted result/);
  await f.reopen();
  await f.clock.advance(1000); await f.suites.settled();
  assert.deepEqual((await f.suites.queue()).remote, []);
  assert.equal(f.suites.status()[0]!.reported, true);
  assert.equal(f.reports(), 1);
});

async function fixture(t: test.TestContext, count: number, reported: boolean, options: { owner?: ReturnType<typeof stageCase>; stageJobs?: (jobs: readonly SuiteJob[]) => Iterable<Readonly<SuiteJob>>; job?: Partial<SuiteJob>; omitFinished?: boolean; onJob?: (job: Readonly<SuiteJob>) => void; log?: (event: Record<string, unknown>) => void } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'suite-persistence-'));
  options.owner?.adoptRoot(root);
  let suites: Suites | undefined;
  let store: Store | undefined;
  if (options.owner) {
    options.owner.requireClose(async () => { await suites?.close(); store?.close(); });
    t.after(() => rm(root, { recursive: true, force: true }));
  } else t.after(async () => { await suites?.close(); store?.close(); await rm(root, { recursive: true, force: true }); });
  const env = fixtureEnvironment(root, process.env);
  const database = join(root, 'hub.db');
  store = new Store(database); const clock = new FakeClock();
  if (options.owner) {
    options.owner.patch(LocalExecutor.prototype, 'reconcile', async () => {});
    options.owner.patch(LocalExecutor.prototype, 'holder', async () => null);
  } else {
    t.mock.method(LocalExecutor.prototype, 'reconcile', async () => {});
    t.mock.method(LocalExecutor.prototype, 'holder', async () => null);
  }
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
    if (options.omitFinished) delete job.finished;
    if (!reported) { await writeFile(job.result, JSON.stringify({ code: 0, finished })); await writeFile(job.log, ''); }
    jobs.push(job);
  }
  store.setMeta('suite-jobs', JSON.stringify(jobs));
  let reports = 0, allowed = false;
  const make = () => new Suites(store!, root, async () => { reports++; if (!allowed) throw new Error('forbidden: artifact.create (a session with no role has no tools)'); }, { clock, env, ...(options.stageJobs ? { stageJobs: options.stageJobs } : {}), ...(options.log ? { log: options.log } : {}), ...(options.onJob ? { onJob: options.onJob } : {}) });
  suites = make();
  return { root, env, store, get suites() { return suites!; }, clock, database, reports: () => reports, allowReports: () => { allowed = true; },
    async reopen() { await suites!.close(); suites = make(); } };
}

test('five thousand stage receipts retain the recorded cover oracle across thirty stage reads and reload', t => {
  const owner = stageCase(t);
  return owner.run(async step => {
  let visits = 0;
  const f = await owner.wait('fixture setup', () => step(() => fixture(owner.fixtures, 5000, true, { owner, stageJobs: function* (jobs) { for (const job of jobs) { visits++; yield job; } }, job: {
    branch: 'dev', integrated: true, tree: 'tree', head: 'head', occasion: 'stage',
    platform: { os: 'linux', arch: 'x64', release: 'fixture', node: process.version, nvim: 'fixture' }, shardingSkipped: 'fixture',
    selection: { mode: 'full', files: [], reason: 'synthetic stage history', soak: true },
  } })));
  const covers = f.suites.stageCovers();
  // Recorded against the pre-index implementation on this synthetic history.
  assert.equal(createHash('sha256').update(JSON.stringify(covers)).digest('hex'), 'dd0e96b39e2e7e98b74aac2e8080611f91364f71491382e3f903cdc79874e8cd');
  for (let epic = 0; epic < 10; epic++) for (let stage = 0; stage < 3; stage++) {
    assert.strictEqual(f.suites.stageCovers(), covers);
    assert.deepEqual(f.suites.stageMissing('tree'), ['macOS']);
  }
  assert.equal(visits, 5000);
  await f.reopen();
  assert.deepEqual(f.suites.stageCovers(), covers);
  assert.equal(visits, 10000, 'reloaded history really traverses the instrumented source again');
  });
});

test('stage cover reload drops pruned receipts and temporary reporting includes never enter the index', t => {
  const owner = stageCase(t);
  return owner.run(async step => {
  const f = await owner.wait('fixture setup', () => step(() => fixture(owner.fixtures, 2, true, { owner, job: { executor: 'local', branch: 'dev', integrated: true, tree: 'tree', head: 'head',
    platform: { os: 'darwin', arch: 'arm64', release: 'fixture', node: process.version, nvim: 'fixture' }, selection: { mode: 'full', files: [], reason: 'stage', soak: true } } })));
  const covers = f.suites.stageCovers();
  assert.deepEqual(covers.map(cover => cover.id), ['0', '1']);
  const included = { ...(JSON.parse(f.store.suiteJob('1')!) as { job: SuiteJob }).job, reported: false, tree: 'temporary' };
  assert.deepEqual(f.suites.stageMissing('temporary', included), ['Linux droplet']);
  assert.strictEqual(f.suites.stageCovers(), covers);
  await f.suites.close();
  f.store.clearMeta('suite-job:1');
  await f.reopen();
  assert.deepEqual(f.suites.stageCovers(), [covers[0]]);
  assert.deepEqual(f.suites.stageMissing('temporary'), ['Linux droplet', 'macOS']);
  // Exercise the actual registered cleanup/restoration owner with a rejected
  // Suites close, then recover through that same owner before leaving the case.
  let nested: ReturnType<typeof stageCase> | undefined;
  let refuseClose = true;
  owner.releaseOnClose(() => { refuseClose = false; });
  owner.fixtures.after(async () => { refuseClose = false; await nested?.close(); await nested?.restore(); });
  const outerBoundary = owner.nativeBoundary(), outerReconcile = LocalExecutor.prototype.reconcile;
  nested = stageCase(owner.fixtures);
  owner.requireClose(async () => { await nested!.close(); await nested!.restore(); });
  let child: Awaited<ReturnType<typeof fixture>> | undefined;
  await nested.run(async admit => {
    child = await nested!.wait('refusal fixture setup', () => admit(() => fixture(nested!.fixtures, 1, true, { owner: nested! })));
    const actualClose = child.suites.close.bind(child.suites);
    nested!.patch(child.suites, 'close', async () => {
      if (refuseClose) throw new Error('controlled Suites close refusal');
      await actualClose();
    });
  });
  assert.ok(child);
  const heldBoundary = nested.nativeBoundary(), heldReconcile = LocalExecutor.prototype.reconcile;
  await assert.rejects(nested.close(), /controlled Suites close refusal/);
  let restorationError: unknown;
  try { await nested.restore(); } catch (error) { restorationError = error; }
  assert.equal(nested.nativeBoundary(), heldBoundary, 'failed close retains the actual positive-controlled native guard');
  assert.equal(LocalExecutor.prototype.reconcile, heldReconcile, 'failed close retains the actual executor seam');
  assert.match(String(restorationError), /resource close unconfirmed/);
  assert.notEqual(child.store.meta('suite-jobs'), null, 'storage remains usable while closure is unconfirmed');
  assert.ok((await readFile(child.database)).length > 0, 'the fixture root and database remain retained');
  refuseClose = false;
  await nested.close();
  await nested.restore();
  assert.equal(nested.nativeBoundary(), outerBoundary, 'successful original-work and resource close releases the nested guard');
  assert.equal(LocalExecutor.prototype.reconcile, outerReconcile);
  let ancillary: ReturnType<typeof stageCase> | undefined;
  owner.fixtures.after(async () => { await ancillary?.restore(); });
  ancillary = stageCase(owner.fixtures);
  owner.requireClose(async () => { await ancillary!.close(); await ancillary!.restore(); });
  let positiveCloses = 0;
  ancillary.requireClose(async () => { positiveCloses++; });
  await ancillary.run(async () => {});
  ancillary.fixtures.after(() => { throw new Error('controlled post-close diagnostic failure'); });
  await assert.rejects(ancillary.close(), /ancillary cleanup failed after confirmed writer close/);
  assert.equal(positiveCloses, 1);
  await ancillary.restore();
  assert.equal(ancillary.nativeBoundary(), outerBoundary, 'an ancillary diagnostic preserves positive close authority');
  });
});

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
      tierPlan: [payload], selection: { mode: 'full', files: [payload], reason: 'legacy', loadGateKnownTests: [payload], loadGateRerun: { head: 'head', recent: [payload], passed: [payload] } },
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

for (const executor of ['local', 'droplet'] as const) test(`${executor} suite log ends with one complete provenance footer`, async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('isolated suite setup', async () => {
    const { suiteUnit } = await import('./suite-unit-fixture.ts');
    return suiteUnit(run.fixtures, { executor });
  });
  const job = await run.wait('admitted suite', () => f.launch({ executor }));
  const finished = await run.wait('completed reported suite', () => f.finish(job.id, 0, 'suite browser {"binary":"/fixture/chrome-headless-shell","version":"Chromium 150.0"}\nsuite skip {"file":"platform.test.ts","name":"platform case","reason":"requires Linux"}\nsuite skip {"file":"missing.test.ts","name":"missing reason","reason":"test marked skip without a reason"}\n# tests 2\n# pass 2\n'));
  const log = await run.wait('finalized suite log', () => readFile(join(f.root, '.cland/run/suites', job.id, 'suite.log'), 'utf8'));
  const footers = log.trimEnd().split('\n').filter(line => line.startsWith('suite provenance '));
  assert.equal(footers.length, 1);
  assert.equal(log.trimEnd().split('\n').at(-1), footers[0]);
  const footer = JSON.parse(footers[0]!.slice('suite provenance '.length));
  assert.equal(footer.head, 'a'.repeat(40));
  assert.equal(footer.tree, 'd'.repeat(40));
  assert.equal(footer.executor, executor);
  assert.equal(footer.platform.os, executor === 'local' ? 'darwin' : 'linux');
  assert.equal(footer.occasion, null);
  assert.deepEqual(footer.browser, { binary: '/fixture/chrome-headless-shell', version: 'Chromium 150.0' });
  assert.equal(footer.skips[0].reason, 'requires Linux');
  assert.equal(footer.skipReasonCheck.mode, 'report');
  assert.equal(footer.skipReasonCheck.missing, 1);
  assert.equal(finished!.outcome!.code, 0, 'missing skip reason is advisory');
  const cached = await run.wait('cached admission', () => f.launch({ executor }));
  assert.equal(cached.cached?.run, job.id);
  await run.wait('reported cached suite', () => f.result(cached.id));
  const cachedLog = await run.wait('finalized cached log', () => f.log(cached.id));
  assert.equal(cachedLog.split('suite provenance ').length - 1, 1, 'cache replaces original footer');
  const cachedFooter = JSON.parse(cachedLog.trimEnd().split('\n').at(-1)!.slice('suite provenance '.length));
  assert.equal(cachedFooter.cached.run, job.id);
  assert.equal(cachedFooter.browser.version, 'Chromium 150.0');
});
