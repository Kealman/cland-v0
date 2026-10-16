import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fixture } from './suite-fixture.ts';
import { cacheRepository } from './suite-support.ts';
import { cland, clandWithEnv, connectUi, eventually, projectHub, tempProject } from './harness.ts';
import type { HubStatus } from '../src/protocol.ts';
import { Store } from '../src/hub/store.ts';
import { Suites, type SuiteJob } from '../src/hub/suites.ts';

test('integrated cover records failing test identities at the suite status boundary', async t => {
  const script = `node -e "console.log('ℹ tests 1\\nℹ fail 1\\ntest at /home/runner/cland/hub/test/planned-stage.test.ts:208:1\\n✖ stage landing query budget (6746.271428ms)');process.exit(1)"`;
  const f = await fixture(t, script);
  const git = await cacheRepository(f);
  await git('checkout', 'dev');
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const run = await f.launch();
  await eventually('failed integrated result reported', async () => (await f.results()).find(m => m.id === `suite:${run.id}`));
  const status = (await f.ui.request({ type: 'hub.status' })).value as HubStatus;
  const job = status.suites!.find(job => job.id === run.id)!;
  assert.equal(job.integrated, true);
  assert.deepEqual(job.cover, { status: 'red', cause: 'test-failure', tests: ['hub/test/planned-stage.test.ts::stage landing query budget'] });
  assert.equal((await f.ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(journal.find(entry => entry.event === 'suite-result' && entry.id === run.id).cover, job.cover);
});

test('classification keeps derived evidence, requires Coordinator or human, and survives restart', async t => {
  let running: Awaited<ReturnType<typeof projectHub>>;
  const serve: typeof projectHub = async (...args) => { running = await projectHub(...args); return running; };
  const f = await fixture(t, `node -e "console.log('test at /home/runner/cland/hub/test/planned-stage.test.ts:208:1\\n✖ stage landing query budget (6746.271428ms)');process.exit(1)"`, undefined, '', {}, 1, 1440, serve);
  const git = await cacheRepository(f);
  await git('checkout', 'dev');
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const run = await f.launch();
  await eventually('red cover reported', async () => (await f.results()).find(m => m.id === `suite:${run.id}`));
  const classify = (...args: string[]) => clandWithEnv(f.root, f.env, 'verify', 'classify', run.id, 'load-flake', ...args);
  for (const role of ['implementer', 'reviewer', 'qa', 'aide', 'lead']) {
    assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role })).ok, true);
    const refused = await classify('--note', 'must not change', '--json');
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /Coordinator|coordinator/);
  }
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const missingNote = await classify('--note', '   ', '--json');
  assert.equal(missingNote.code, 1);
  const changed = await classify('--note', 'T-566 confirms a load flake', '--json');
  assert.equal(changed.code, 0, changed.stderr);
  const record = JSON.parse(changed.stdout).cover;
  assert.equal(record.status, 'red');
  assert.equal(record.cause, 'load-flake');
  assert.equal(record.derivedCause, 'test-failure');
  assert.deepEqual(record.tests, ['hub/test/planned-stage.test.ts::stage landing query budget']);
  assert.equal(record.classification.note, 'T-566 confirms a load flake');
  assert.equal(record.classification.by, 'impl');
  assert.ok(Number.isFinite(Date.parse(record.classification.at)));
  const human = await cland(f.root, 'verify', 'classify', run.id, 'load-flake', '--note', 'Human confirms load evidence', '--json');
  assert.equal(human.code, 0, human.stderr);
  assert.equal(JSON.parse(human.stdout).cover.derivedCause, 'test-failure', 'repeat classification preserves the original cause');
  assert.equal((await f.ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const journal = (await readFile(join(f.root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  const changes = journal.filter(entry => entry.event === 'verification-cover-classified' && entry.id === run.id);
  assert.equal(changes.length, 2, 'both Coordinator and human classification are retained in the domain journal');
  assert.deepEqual(changes[0].cover, record);
  assert.deepEqual(changes[1].cover, JSON.parse(human.stdout).cover);
  await running!.stop();
  const restarted = await projectHub(t, f.root);
  const ui = await connectUi(t, restarted.discovery);
  const status = (await ui.request({ type: 'hub.status' })).value as HubStatus;
  assert.deepEqual(status.suites!.find(job => job.id === run.id)!.cover, JSON.parse(human.stdout).cover);
  assert.deepEqual(status.suites!.find(job => job.id === run.id)!.outcome, { code: 1, cause: '' });
});

test('merged shard cover retains failing test and load-gate identities with shard labels', async t => {
  const output = [
    '--- close shards ---', '--- shard-1 ---',
    'test at /home/runner/cland/hub/test/example.test.ts:12:1',
    '✖ fails in first shard (100ms) [shard-1]',
    '✖ load gate: hub/test/example.test.ts::load gate failure 2/5 passed [shard-1]',
    '--- shard-2 ---',
    'test at /home/runner/cland/nvim/test/example.test.ts:8:1',
    '✖ fails in second shard (200ms) [shard-2]',
  ];
  const f = await fixture(t, `node -e 'console.log(${JSON.stringify(output.join('\n'))});process.exit(1)'`);
  const git = await cacheRepository(f);
  await git('checkout', 'dev');
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const run = await f.launch();
  await eventually('merged shard result reported', async () => (await f.results()).find(m => m.id === `suite:${run.id}`));
  const status = (await f.ui.request({ type: 'hub.status' })).value as HubStatus;
  assert.deepEqual(status.suites!.find(job => job.id === run.id)!.cover, { status: 'red', cause: 'test-failure', tests: [
    'hub/test/example.test.ts::fails in first shard',
    'hub/test/example.test.ts::load gate failure',
    'nvim/test/example.test.ts::fails in second shard',
  ] });
});

for (const action of ['head', 'explicit'] as const) test(`cancelled integrated cover records ${action} cancellation`, async t => {
  const f = await fixture(t, 'node -e "process.exit(0)"');
  const git = await cacheRepository(f);
  await git('checkout', 'dev');
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const lock = join(f.root, 'suite.lock');
  await mkdir(lock);
  const run = await f.launch();
  assert.equal(run.pid, null, 'the compatibility holder keeps the candidate queued');
  if (action === 'head') {
    await writeFile(join(f.root, 'source'), 'changed candidate\n');
    await git('add', 'source');
    await git('commit', '-m', 'candidate changed');
    await rm(lock, { recursive: true });
  } else {
    const cancelled = await clandWithEnv(f.root, f.env, 'verify', 'cancel', run.id, '--json');
    assert.equal(cancelled.code, 0, cancelled.stderr);
  }
  const status = await eventually('cancelled cover published', async () => {
    const status = (await f.ui.request({ type: 'hub.status' })).value as HubStatus;
    const job = status.suites!.find(job => job.id === run.id);
    return job?.cover ? job : undefined;
  });
  assert.deepEqual(status.cover, { status: 'cancelled', cause: action === 'head' ? 'cancel-head' : 'cancel-requester', tests: [] });
});

test('a recovered queued cover records requester death before admission', async t => {
  const root = await tempProject(t);
  const store = new Store(join(root, 'cover.db'));
  const log = join(root, 'suite.log');
  await writeFile(log, '');
  const job: SuiteJob = { id: 'dead-requester', mode: 'all', cwd: root, topic: 'general', to: [],
    actor: { name: 'doomed', sessionId: 'dead-session', shell: true }, head: 'a'.repeat(40), branch: 'dev',
    log, result: join(root, 'result.json'), gate: '', pid: null, started: null, outcome: null,
    artifact: null, reported: false, error: null, state: 'queued', executor: 'local', integrated: true };
  store.setMeta('suite-jobs', JSON.stringify([job]));
  const suites = new Suites(store, root, async () => {}, { locks: [join(root, 'lock')] });
  t.after(async () => { await suites.close(); store.close(); });
  suites.requesterExited('dead-session');
  const completed = await eventually('requester death result settled', () => suites.status().find(job => job.reported));
  assert.deepEqual(completed.cover, { status: 'cancelled', cause: 'cancel-requester', tests: [] });
});

test('budget-only integrated cover records the duration identities rather than a test failure', async t => {
  // b5643d32: both package phases passed, then these two budget diagnostics failed the run.
  const output = ['ℹ tests 2', 'ℹ pass 2', 'ℹ fail 0',
    'duration budget: hub/test/remote-fixture-lifecycle.test.ts::remote fixture cleans up after owner watchdog-SIGTERM 6.306 s > 5 s (add to hub/test/durations.json with a reason)',
    'duration budget: hub/test/remote-fixture-lifecycle.test.ts::remote fixture cleans up after owner watchdog-SIGINT 6.282 s > 5 s (add to hub/test/durations.json with a reason)'];
  const f = await fixture(t, `node -e 'console.log(${JSON.stringify(output.join('\n'))});process.exit(1)'`);
  const git = await cacheRepository(f);
  await git('checkout', 'dev');
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  const run = await f.launch();
  await eventually('budget result reported', async () => (await f.results()).find(m => m.id === `suite:${run.id}`));
  const status = (await f.ui.request({ type: 'hub.status' })).value as HubStatus;
  assert.deepEqual(status.suites!.find(job => job.id === run.id)!.cover, { status: 'red', cause: 'budget', tests: [
    'hub/test/remote-fixture-lifecycle.test.ts::remote fixture cleans up after owner watchdog-SIGTERM',
    'hub/test/remote-fixture-lifecycle.test.ts::remote fixture cleans up after owner watchdog-SIGINT',
  ] });
});

test('hub status lists the last ten integrated covers by completion, excluding tasks and pending runs', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), `[verification]\nlock_path=${JSON.stringify(join(root, 'held-lock'))}\n`);
  await mkdir(join(root, 'held-lock'));
  const base: SuiteJob = { id: 'cover-0', mode: 'all', cwd: root, topic: 'general', to: [], actor: null,
    head: 'a'.repeat(40), branch: 'dev', log: '', result: '', gate: '', pid: null, started: null,
    outcome: { code: 0, cause: '' }, artifact: null, reported: true, error: null, state: 'finished',
    integrated: true, executor: 'local', cover: { status: 'green', cause: null, tests: [] } };
  const jobs = Array.from({ length: 12 }, (_, index) => ({ ...base, id: `cover-${index}`,
    completedAt: new Date(Date.UTC(2026, 9, 16, 0, index)).toISOString(),
    ...(index === 11 ? { outcome: { code: 1, cause: '' }, cover: { status: 'red' as const, cause: 'test-failure' as const, tests: ['hub/test/example.test.ts::fails'] } } : {}) }));
  const store = new Store(join(root, '.cland/hub.db'));
  store.setMeta('suite-jobs', JSON.stringify([...jobs.reverse(),
    { ...base, id: 'task-result', integrated: false, branch: 'candidate', cover: undefined, completedAt: '2026-10-16T01:00:00Z' },
    { ...base, id: 'pending-cover', state: 'queued', outcome: null, cover: undefined, reported: false },
  ]));
  store.close();
  const running = await projectHub(t, root);
  const ui = await connectUi(t, running.discovery);
  const status = (await ui.request({ type: 'hub.status' })).value as HubStatus;
  assert.deepEqual(status.covers?.map(run => run.id), ['cover-11', 'cover-10', 'cover-9', 'cover-8', 'cover-7', 'cover-6', 'cover-5', 'cover-4', 'cover-3', 'cover-2']);
  assert.equal(status.covers![0]!.cover.cause, 'test-failure');
  const shown = await cland(root, 'hub', 'status');
  assert.equal(shown.code, 0, shown.stderr);
  assert.match(shown.stdout, /covers: 10/);
  assert.match(shown.stdout, /cover-11.*red.*test-failure/);
  assert.match(shown.stdout, /cover-10.*green.*none/);
  assert.doesNotMatch(shown.stdout, /cover-0\b|cover-1\b|task-result|pending-cover/);
});

test('recovered covers distinguish timeouts, worker head cancellations, mixed failures and green outcomes', async t => {
  const root = await tempProject(t);
  const store = new Store(join(root, 'cover.db'));
  const failure = 'test at /home/runner/cland/hub/test/example.test.ts:1:1\n✖ hangs (1000ms)';
  const cases = [
    { id: 'run-timeout', code: 124, cause: 'run timeout 75m', log: '', expected: { status: 'red', cause: 'timeout', tests: [] } },
    { id: 'stall', code: 1, cause: 'stalled: no output for 10 min; last started tests: (none reported)', log: '', expected: { status: 'red', cause: 'timeout', tests: [] } },
    { id: 'test-timeout', code: 1, cause: '', log: `${failure}\n  [Error: test timed out after 1000ms] { failureType: 'testTimeoutFailure' }`, expected: { status: 'red', cause: 'timeout', tests: ['hub/test/example.test.ts::hangs'] } },
    { id: 'timeout-title', code: 1, cause: '', log: 'test at /home/runner/cland/hub/test/example.test.ts:1:1\n✖ test timed out after 1000ms (20ms)\n  AssertionError: expected true', expected: { status: 'red', cause: 'test-failure', tests: ['hub/test/example.test.ts::test timed out after 1000ms'] } },
    { id: 'worker-head', code: 1, cause: 'cancelled: submitted head aaa changed to bbb; submit verification again', log: '', expected: { status: 'cancelled', cause: 'cancel-head', tests: [] } },
    { id: 'mixed', code: 1, cause: '', log: `${failure}\nduration budget: hub/test/slow.test.ts::slow 6.306 s > 5 s (add to hub/test/durations.json with a reason)`, expected: { status: 'red', cause: 'test-failure', tests: ['hub/test/example.test.ts::hangs', 'hub/test/slow.test.ts::slow'] } },
    { id: 'green', code: 0, cause: '', log: '✔ verifies test timed out after 1000ms (1000ms)\nℹ fail 0', expected: { status: 'green', cause: null, tests: [] } },
    { id: 'task', code: 1, cause: '', log: failure, expected: undefined },
  ];
  const jobs: SuiteJob[] = [];
  for (const example of cases) {
    const log = join(root, `${example.id}.log`);
    await writeFile(log, example.log);
    jobs.push({ id: example.id, mode: 'all', cwd: root, topic: 'general', to: [], actor: null,
      head: 'a'.repeat(40), branch: example.id === 'task' ? 'candidate' : 'dev', log, result: '', gate: '',
      pid: null, started: null, outcome: { code: example.code, cause: example.cause },
      artifact: null, reported: false, error: null, state: 'queued', cleaned: true,
      integrated: example.id !== 'task', executor: 'local' });
  }
  store.setMeta('suite-jobs', JSON.stringify(jobs));
  const suites = new Suites(store, root, async () => {}, { locks: [join(root, 'lock')] });
  t.after(async () => { await suites.close(); store.close(); });
  const status = await eventually('all recovered receipts reported', () => suites.status().every(job => job.reported) ? suites.status() : undefined);
  for (const example of cases) assert.deepEqual(status.find(job => job.id === example.id)!.cover, example.expected, example.id);
  assert.throws(() => suites.classify('green', 'load-flake', 'not red', 'human', () => {}), /red/);
  assert.throws(() => suites.classify('worker-head', 'load-flake', 'cancelled', 'human', () => {}), /red/);
  assert.throws(() => suites.classify('task', 'load-flake', 'not integrated', 'human', () => {}), /integrated/);
  assert.throws(() => suites.classify('missing', 'load-flake', 'unknown', 'human', () => {}), /no suite/);
});
