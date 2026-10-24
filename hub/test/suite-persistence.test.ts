// T1: durable suite history and inspection use an isolated store and fake time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { Suites, type SuiteJob } from '../src/hub/suites.ts';
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
