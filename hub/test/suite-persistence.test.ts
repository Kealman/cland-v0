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

async function fixture(t: test.TestContext, count: number, reported: boolean) {
  const root = await mkdtemp(join(tmpdir(), 'suite-persistence-'));
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
      selection: { mode: 'hub-only', files: ['x'.repeat(9000)], reason: 'history' } };
    if (!reported) { await writeFile(job.result, JSON.stringify({ code: 0, finished })); await writeFile(job.log, ''); }
    jobs.push(job);
  }
  store.setMeta('suite-jobs', JSON.stringify(jobs));
  let reports = 0, allowed = false;
  const suites = new Suites(store, root, async () => { reports++; if (!allowed) throw new Error('forbidden: artifact.create (a session with no role has no tools)'); }, { clock, env: { CLAND_EXECUTOR_STATE: join(root, 'state') } });
  t.after(async () => { await suites.close(); store.close(); await rm(root, { recursive: true, force: true }); });
  return { store, suites, clock, database, reports: () => reports, allowReports: () => { allowed = true; } };
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
  const suites = new Suites(reopened, '/', async () => {}, { clock: f.clock, env: {} });
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
