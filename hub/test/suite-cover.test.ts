// T1: cover derivation/classification through Suites and persisted Store receipts.
// Role authorization, CLI rendering and domain journal retain one T2 frame proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { shardOutput, shardCover } from './suite-cover-examples.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import type { SuiteJob } from '../src/hub/suites.ts';

const failure = 'test at /home/runner/cland/hub/test/planned-stage.test.ts:208:1\n✖ stage landing query budget (6746.271428ms)';
async function coverRun(t: Parameters<typeof suiteUnit>[0], log: string) {
  const f = await suiteUnit(t); f.candidate.branch = 'dev';
  const run = await f.launch({ integrated: true }); await f.finish(run.id, 1, log);
  return { f, run };
}

test('integrated cover records failing test identities at the suite status boundary', async t => {
  const { f, run } = await coverRun(t, 'ℹ tests 1\nℹ fail 1\n' + failure);
  const job = f.status(run.id); assert.equal(job.integrated, true);
  assert.deepEqual(job.cover, { status: 'red', cause: 'test-failure', tests: ['hub/test/planned-stage.test.ts::stage landing query budget'] });
  assert.deepEqual(f.reports[0]!.cover, job.cover, 'report callback receives the same derived cover');
});

test('classification keeps derived evidence, requires authorization, and survives restart', async t => {
  const { f, run } = await coverRun(t, failure);
  const classify = (note: string, by = 'coordinator', authorize = () => {}) => f.suites.classify(run.id, 'load-flake', note, by, authorize);
  assert.throws(() => classify('must not change', 'impl', () => { throw new Error('forbidden'); }), /forbidden/);
  assert.equal(f.status(run.id).cover!.cause, 'test-failure');
  assert.throws(() => classify('   '), /nonblank/);
  const record = classify('T-566 confirms a load flake').cover;
  assert.equal(record.status, 'red'); assert.equal(record.cause, 'load-flake'); assert.equal(record.derivedCause, 'test-failure');
  assert.deepEqual(record.tests, ['hub/test/planned-stage.test.ts::stage landing query budget']);
  assert.equal(record.classification!.note, 'T-566 confirms a load flake'); assert.equal(record.classification!.by, 'coordinator'); assert.ok(Number.isFinite(Date.parse(record.classification!.at)));
  const human = classify('Human confirms load evidence', 'human').cover; assert.equal(human.derivedCause, 'test-failure');
  const changes = f.logs.filter(e => e.event === 'verification-cover-classified'); assert.equal(changes.length, 2); assert.deepEqual(changes[0]!.cover, record); assert.deepEqual(changes[1]!.cover, human);
  await f.reopen(); assert.deepEqual(f.status(run.id).cover, human); assert.deepEqual(f.status(run.id).outcome, { code: 1, cause: '' });
});

test('merged shard cover retains failing test and load-gate identities with shard labels', async t => {
  const { f, run } = await coverRun(t, shardOutput.join('\n'));
  assert.deepEqual(f.status(run.id).cover, shardCover);
});

for (const action of ['head', 'explicit'] as const) test(`cancelled integrated cover records ${action} cancellation`, async t => {
  const f = await suiteUnit(t); f.candidate.branch = 'dev'; f.hold(true);
  const run = await f.launch({ integrated: true }); assert.equal(run.pid, null);
  if (action === 'head') {
    f.candidate.head = 'b'.repeat(40); f.candidate.tree = 'e'.repeat(40); f.hold(false); await f.tick();
    await f.when(() => f.status(run.id).outcome ?? undefined); await f.tick();
  } else await f.suites.cancel(run.id, null, () => {});
  assert.deepEqual((await f.result(run.id)).cover, { status: 'cancelled', cause: action === 'head' ? 'cancel-head' : 'cancel-requester', tests: [] });
});

test('a recovered queued cover records requester death before admission', async t => {
  const f = await suiteUnit(t); f.candidate.branch = 'dev'; f.hold(true);
  const run = await f.launch({ integrated: true, actor: { name: 'doomed', sessionId: 'dead-session', shell: true } }); await f.reopen();
  f.suites.requesterExited('dead-session');
  assert.deepEqual((await f.result(run.id)).cover, { status: 'cancelled', cause: 'cancel-requester', tests: [] });
});

test('budget-only integrated cover records the duration identities rather than a test failure', async t => {
  const output = ['ℹ tests 2', 'ℹ pass 2', 'ℹ fail 0',
    'duration budget: hub/test/remote-fixture-lifecycle.test.ts::remote fixture cleans up after owner watchdog-SIGTERM 6.306 s > 5 s (add to hub/test/durations.json with a reason)',
    'duration budget: hub/test/remote-fixture-lifecycle.test.ts::remote fixture cleans up after owner watchdog-SIGINT 6.282 s > 5 s (add to hub/test/durations.json with a reason)'];
  const { f, run } = await coverRun(t, output.join('\n'));
  assert.deepEqual(f.status(run.id).cover, { status: 'red', cause: 'budget', tests: ['hub/test/remote-fixture-lifecycle.test.ts::remote fixture cleans up after owner watchdog-SIGTERM', 'hub/test/remote-fixture-lifecycle.test.ts::remote fixture cleans up after owner watchdog-SIGINT'] });
});

test('suite status lists the last ten integrated covers by completion, excluding tasks and pending runs', async t => {
  const f = await suiteUnit(t); f.candidate.branch = 'dev';
  const run = await f.launch({ integrated: true }); await f.finish(run.id); const base = (await f.jobs())[0]!;
  const jobs: SuiteJob[] = Array.from({ length: 12 }, (_, i) => ({ ...base, id: `cover-${i}`, completedAt: new Date(Date.UTC(2026, 9, 16, 0, i)).toISOString(),
    ...(i === 11 ? { outcome: { code: 1, cause: '' }, cover: { status: 'red' as const, cause: 'test-failure' as const, tests: ['hub/test/example.test.ts::fails'] } } : {}) }));
  await f.reopen([...jobs.reverse(), { ...base, id: 'task-result', integrated: false, branch: 'candidate', cover: undefined, completedAt: '2026-10-16T01:00:00Z' },
    { ...base, id: 'pending-cover', state: 'queued', outcome: null, cover: undefined, reported: false }] as SuiteJob[]);
  assert.deepEqual(f.suites.covers().map(j => j.id), ['cover-11', 'cover-10', 'cover-9', 'cover-8', 'cover-7', 'cover-6', 'cover-5', 'cover-4', 'cover-3', 'cover-2']);
  assert.equal(f.suites.covers()[0]!.cover.cause, 'test-failure');
});

test('recovered covers distinguish timeouts, worker head cancellations, mixed failures and green outcomes', async t => {
  const f = await suiteUnit(t); const root = f.root;
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
    const log = join(root, `${example.id}.log`); await writeFile(log, example.log);
    jobs.push({ id: example.id, mode: 'all', cwd: root, topic: 'general', to: [], actor: null, head: 'a'.repeat(40), branch: example.id === 'task' ? 'candidate' : 'dev', log, result: '', gate: '', pid: null, started: null,
      outcome: { code: example.code, cause: example.cause }, artifact: null, reported: false, error: null, state: 'queued', cleaned: true, integrated: example.id !== 'task', executor: 'local' });
  }
  await f.reopen(jobs); await f.tick();
  await f.when(() => f.suites.status().every(job => job.reported) ? true : undefined);
  for (const example of cases) assert.deepEqual(f.status(example.id).cover, example.expected, example.id);
  assert.throws(() => f.suites.classify('green', 'load-flake', 'not red', 'human', () => {}), /red/);
  assert.throws(() => f.suites.classify('worker-head', 'load-flake', 'cancelled', 'human', () => {}), /red/);
  assert.throws(() => f.suites.classify('task', 'load-flake', 'not integrated', 'human', () => {}), /integrated/);
  assert.throws(() => f.suites.classify('missing', 'load-flake', 'unknown', 'human', () => {}), /no suite/);
});
