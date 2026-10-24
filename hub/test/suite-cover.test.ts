// T1: cover derivation/classification through Suites and persisted Store receipts.
// Role authorization, CLI rendering and domain journal retain one T2 frame proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { shardOutput, shardCover } from './suite-cover-examples.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import { suiteSummary, type SuiteJob } from '../src/hub/suites.ts';
import { DropletExecutor, ProviderCapacityUnavailable } from '../src/executor/droplet/droplet.ts';
import { serializeTierManifest } from '../src/suite-shards.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { devT3Result } from '../src/hub/dev-t3-result.ts';
import { DevT3Search } from '../src/hub/dev-t3-search.ts';

async function shardedCover(t: Parameters<typeof suiteUnit>[0], options: Parameters<typeof suiteUnit>[1] = {}) {
  const f = await suiteUnit(t, { executor: 'droplet', machineReceiptsOnly: true, ...options });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated close', fetchedDev: f.candidate.head };
  for (const name of ['one', 'two']) await writeFile(join(f.root, `hub/test/${name}.test.ts`), '');
  await writeFile(join(f.root, 'hub/test/tiers.json'), serializeTierManifest({ version: 1, tests: {
    'hub/test/one.test.ts': 'T1', 'hub/test/two.test.ts': 'T1',
  } }));
  // Spend arithmetic has its own executor tests; this seam consumes reservation receipts.
  t.mock.method(DropletExecutor.prototype, 'reserveShards', async () => {});
  t.mock.method(DropletExecutor.prototype, 'releaseShardReservations', async () => {});
  return f;
}

for (const refusal of ['capacity', 'delivery', 'mixed causes', 'acquisition', 'mixed acquisition'] as const) test(`all ${refusal}-refused shards preserve a not-run cover receipt and never start culprit search`, async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('sealed shard fixture', () => shardedCover(run.fixtures));
  const acquire = DropletExecutor.prototype.acquire;
  t.mock.method(DropletExecutor.prototype, 'acquire', async function (this: DropletExecutor, ...args: Parameters<typeof acquire>) {
    const [ref] = args;
    if (refusal === 'acquisition' || refusal === 'mixed acquisition' && ref.id.endsWith('shard-2')) throw new Error(`snapshot unavailable for ${ref.id.endsWith('shard-1') ? 'one' : 'two'}`);
    if (refusal === 'delivery' || refusal === 'mixed causes' && ref.id.endsWith('shard-2')) return acquire.apply(this, args);
    throw new ProviderCapacityUnavailable(ref.id.endsWith('shard-1') ? 'size c-8 unavailable in lon1' : 'size c-8 unavailable in nyc1');
  });
  t.mock.method(f.machine.dependencies.run, 'deliver', async (...[_lease, ref]: Parameters<typeof f.machine.dependencies.run.deliver>) => { throw new Error(`bundle unavailable for ${ref.id.endsWith('shard-1') ? 'one' : 'two'}`); });
  const occasion = refusal === 'capacity' ? 'stage' : refusal === 'delivery' ? 'epic' : 'release';
  const notRun = refusal === 'capacity' ? 'provider-capacity' : 'infrastructure';
  const job = await run.wait('close admission', () => f.launch({ mode: 'all', integrated: true, occasion, fresh: true }));
  await run.wait('shard refusal I/O', () => f.suites.settled());
  const reported = f.result(job.id);
  await run.wait('collect refused shards', async () => { await f.tick(); await f.suites.settled(); });
  await run.wait('durable merged refusal', () => reported);
  const receipt = await f.suites.receipt(job.id);
  assert.deepEqual(receipt.job.outcome, { code: 1, notRun,
    cause: refusal === 'capacity' ? 'shard-1: size c-8 unavailable in lon1; shard-2: size c-8 unavailable in nyc1'
      : refusal === 'delivery' ? 'shard-1: bundle unavailable for one; shard-2: bundle unavailable for two'
        : refusal === 'mixed causes' ? 'shard-1: size c-8 unavailable in lon1; shard-2: bundle unavailable for two'
          : refusal === 'acquisition' ? 'shard-1: snapshot unavailable for one; shard-2: snapshot unavailable for two'
            : 'shard-1: size c-8 unavailable in lon1; shard-2: snapshot unavailable for two' });
  assert.equal(JSON.parse(await readFile(receipt.job.result, 'utf8')).notRun, notRun);
  assert.equal(f.machine.calls.some(call => call.step === 'start'), false);
  assert.deepEqual(f.suites.covers(), []);
  assert.deepEqual(f.suites.stageCovers(), []);
  assert.doesNotMatch(receipt.log, /shard failure|\bred\b/);
  assert.match(receipt.log, /shard not run shard-1:/);
  assert.match(receipt.log, /shard not run shard-2:/);
  const result = await devT3Result(receipt.job, receipt.log, { id: 'A-1', path: '/durable/log' }, async () => null);
  assert.equal(result.result, 'not-run');
  const search = new DevT3Search(f.store, { probe: async () => assert.fail('no culprit probes for refused shards'), report: async () => assert.fail('no culprit search for refused shards') });
  search.accept(result); await search.tick();
  assert.equal(f.store.meta('dev-t3-searches'), null);
  await f.reopen();
  assert.equal((await f.suites.receipt(job.id)).job.outcome?.notRun, notRun);
  assert.deepEqual(f.suites.covers(), []);
});

for (const [boundary, unchangedReads] of [['parent validation', 0], ['child bundle admission', 1], ['child bundle recheck', 3]] as const) test(`tree changes at ${boundary} refuse unstarted shards without red cover or search`, async t => {
  const run = caseDeadlines(t);
  let f: Awaited<ReturnType<typeof shardedCover>>;
  let reads = 0;
  const firstChildChecks = Promise.withResolvers<void>();
  // Candidate facts: optional valid parent read, then both children's first
  // bundle checks when exercising their second check. Later reads see dirt.
  f = await run.wait('sealed changing-candidate fixture', () => shardedCover(run.fixtures, { candidate: {
    head: async () => f.candidate.head,
    tree: async () => {
      const read = ++reads;
      if (unchangedReads === 3 && read > 1 && read <= 3) {
        if (read === 3) firstChildChecks.resolve();
        await firstChildChecks.promise;
      }
      return read <= unchangedReads ? f.candidate.tree : null;
    },
    inspect: async () => ({ ...structuredClone(f.candidate), tierPlan: [], budgetBase: undefined }),
  } }));
  let acquisitions = 0;
  t.mock.method(DropletExecutor.prototype, 'acquire', async () => { acquisitions++; throw new Error('unexpected acquisition'); });
  const job = await run.wait('stage admission', () => f.launch({ mode: 'all', integrated: true, occasion: 'stage', fresh: true }));
  await run.wait('bundle admission I/O', () => f.suites.settled());
  const reported = f.result(job.id);
  await run.wait('collect bundle refusals', async () => { await f.tick(); await f.suites.settled(); });
  await run.wait('durable bundle refusal', () => reported);
  const receipt = await f.suites.receipt(job.id);
  assert.equal(acquisitions, 0);
  assert.equal(f.machine.calls.some(call => call.step === 'start'), false);
  assert.equal(receipt.job.outcome?.notRun, 'infrastructure');
  for (const shard of ['shard-1', 'shard-2']) assert.ok(receipt.job.outcome!.cause.includes(`${shard}: dirty or changed`), receipt.job.outcome!.cause);
  assert.equal(JSON.parse(await readFile(receipt.job.result, 'utf8')).notRun, 'infrastructure');
  assert.deepEqual(f.suites.covers(), []);
  assert.deepEqual(f.suites.stageCovers(), []);
  assert.doesNotMatch(receipt.log, /shard failure|\bred\b/);
  const result = await devT3Result(receipt.job, receipt.log, { id: 'A-1', path: '/durable/log' }, async () => null);
  assert.equal(result.result, 'not-run');
  const search = new DevT3Search(f.store, { probe: async () => assert.fail('no bundle-refusal culprit probe'), report: async () => assert.fail('no bundle-refusal culprit search') });
  search.accept(result); await search.tick();
  assert.equal(f.store.meta('dev-t3-searches'), null);
  await f.reopen();
  assert.equal((await f.suites.receipt(job.id)).job.outcome?.notRun, 'infrastructure');
  assert.deepEqual(f.suites.covers(), []);
});

test('a recovered group with submitted workers keeps failure when its candidate changes', async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('sealed shard fixture', () => shardedCover(run.fixtures));
  const job = await run.wait('stage admission', () => f.launch({ mode: 'all', integrated: true, occasion: 'stage', fresh: true }));
  await run.wait('both workers started', () => f.machine.waits.run(Promise.all([1, 2].map(n => f.machine.started(`${job.id}-shard-${n}`)))));
  await run.wait('launch I/O settled', () => f.suites.settled());
  const parent = (await f.jobs()).find(saved => saved.id === job.id)!;
  parent.state = 'launching';
  f.candidate.tree = null;
  await f.reopen([parent]);
  const reported = f.result(job.id);
  await run.wait('recovered launch I/O', async () => { await f.tick(); await f.suites.settled(); });
  await run.wait('recovered collection I/O', async () => { await f.tick(); await f.suites.settled(); });
  await run.wait('durable recovered failure', () => f.machine.waits.run(reported));
  const receipt = await f.suites.receipt(job.id);
  assert.equal(receipt.job.outcome?.notRun, undefined);
  assert.equal(receipt.job.outcome?.code, 1);
  assert.equal(receipt.job.cover?.status, 'red');
  assert.match(receipt.job.outcome!.cause, /dirty or changed integrated dev candidate/);
});

test('ambiguous shard start errors remain executed-or-unknown failures rather than not-run', async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('sealed shard fixture', () => shardedCover(run.fixtures));
  f.machine.script({ outcome: 'slow', log: '' }, { outcome: 'slow', log: '' });
  const attempted: string[] = [];
  t.mock.method(f.machine.dependencies.run, 'start', async (...[lease]: Parameters<typeof f.machine.dependencies.run.start>) => {
    attempted.push(lease.run);
    throw new Error('start acknowledgement lost');
  });
  const job = await run.wait('stage admission', () => f.launch({ mode: 'all', integrated: true, occasion: 'stage', fresh: true }));
  await run.wait('start attempt I/O', () => f.suites.settled());
  const reported = f.result(job.id);
  await run.wait('collect ambiguous failures', async () => { await f.tick(); await f.suites.settled(); });
  await run.wait('durable ambiguous receipt', () => reported);
  const receipt = await f.suites.receipt(job.id);
  assert.deepEqual(attempted.sort(), [`${job.id}-shard-1`, `${job.id}-shard-2`]);
  assert.equal(receipt.job.outcome?.notRun, undefined, 'a failed start acknowledgement cannot prove non-execution');
  assert.deepEqual(receipt.job.outcome, { code: 1, cause: 'shard-1: start acknowledgement lost; shard-2: start acknowledgement lost' });
  assert.equal(receipt.job.cover?.status, 'red');
  assert.match(receipt.log, /shard failure shard-1: start acknowledgement lost/);
  assert.match(receipt.log, /shard failure shard-2: start acknowledgement lost/);
  assert.doesNotMatch(receipt.log, /shard not run/);
});

for (const code of [0, 1]) test(`partly executed shards retain exit ${code} results and name unexecuted shards without passing`, async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('sealed shard fixture', () => shardedCover(run.fixtures));
  const acquire = DropletExecutor.prototype.acquire;
  t.mock.method(DropletExecutor.prototype, 'acquire', async function (this: DropletExecutor, ...args: Parameters<typeof acquire>) {
    const [ref] = args;
    if (ref.id.endsWith('shard-2')) throw new ProviderCapacityUnavailable('size c-8 unavailable in nyc1');
    return acquire.apply(this, args);
  });
  const job = await run.wait('stage admission', () => f.launch({ mode: 'all', integrated: true, occasion: 'stage', fresh: true }));
  await run.wait('executed shard start', () => f.machine.waits.run(f.machine.started(`${job.id}-shard-1`)));
  await run.wait('shard launch I/O', () => f.suites.settled());
  const reported = f.result(job.id);
  f.machine.finish(`${job.id}-shard-1`, code, code
    ? '# tests 1\n# fail 1\ntest at /home/runner/cland/hub/test/one.test.ts:1:1\n✖ executed failure (1ms)\n'
    : '# tests 1\n# pass 1\n');
  await run.wait('collect partial execution', async () => { await f.tick(); await f.suites.settled(); });
  await run.wait('durable merged partial receipt', () => reported);
  const receipt = await f.suites.receipt(job.id);
  assert.equal(receipt.job.outcome?.code, 1);
  assert.equal(receipt.job.outcome?.notRun, undefined, 'an executed shard is not an entirely unexecuted cover');
  assert.equal(receipt.job.cover?.status, 'red');
  assert.deepEqual(receipt.job.cover?.tests, code ? ['hub/test/one.test.ts::executed failure'] : []);
  assert.deepEqual(f.suites.stageCovers(), []);
  assert.match(receipt.log, code ? /# fail 1/ : /# pass 1/);
  const summary = suiteSummary(receipt.log);
  assert.match(summary, code ? /tests 1; fail 1/ : /tests 1; pass 1/);
  assert.match(summary, /shard not run shard-2: provider-capacity; size c-8 unavailable in nyc1/);
  assert.match(suiteSummary(receipt.log, [], { priorityOnly: true }), /shard not run shard-2: provider-capacity; size c-8 unavailable in nyc1/);
  assert.doesNotMatch(receipt.log, /shard failure shard-2/);
  assert.equal(JSON.parse(await readFile(receipt.job.result, 'utf8')).code, 1);
});

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
