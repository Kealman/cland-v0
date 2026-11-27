// T2: the shared spend ledger and dispatch publication use in-process providers and FakeClock.
import test from 'node:test';
import { fixtureNativeGuard } from './fake-native-guard.ts';
import { scratchMachine } from './init-machine.ts';
import cp from 'node:child_process';
import { promisify } from 'node:util';
import { syncBuiltinESMExports } from 'node:module';
import { suiteCandidate } from '../src/hub/suite-candidate.ts';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { suiteUnit } from './suite-unit-fixture.ts';
import { reserveShardSpend } from '../src/executor/droplet/spend.ts';
import { fixture } from './remote-fixture.ts';
import { drive } from './remote-clock.ts';
import { loadGateRepetitions } from '../src/suite-load-gate-plan.ts';
import { coverageMaps, coverageSelection } from '../src/suite-coverage.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { beforeDirectories, guardDirectoryRemoval } from './process-cleanup.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { suiteCase } from './suite-case-fixture.ts';
import { DigitalOceanError } from '../src/executor/droplet/api.ts';
import type { Artifact, Message } from '../src/protocol.ts';
import { flakyReceiptCase as periodicCase } from './flaky-receipt-fixture.ts';
import { fenceFixtureCleanup } from './process-cleanup.ts';

test('published remote run log points to retained coverage download diagnostics', async t => suiteCase(t, async ({ setup, step }) => {
  const f = await setup(fixtures => suiteUnit(fixtures, { executor: 'droplet' }));
  const job = await step('admission', () => f.launch({ executor: 'droplet', fresh: true }));
  await step('running receipt', () => f.machine.waits.run(f.machine.started(job.id)));
  const diagnostic = join(f.root, '.cland/run/suites', job.id, 'coverage-download.log');
  await step('download diagnostic receipt', () => writeFile(diagnostic, 'coverage download failed: retained transport facts\n'));
  await step('remote completion', () => f.finish(job.id));
  assert.equal(f.reports.length, 1);
  const published = await step('published diagnostic pointer', () => readFile(f.reports[0]!.log, 'utf8'));
  assert.ok(published.includes(`coverage download diagnostics: ${diagnostic}\n`));
  assert.equal(await step('retained bytes', () => readFile(diagnostic, 'utf8')), 'coverage download failed: retained transport facts\n');
}));

test('snapshot disk incompatibility refuses c-4 admission before T0 and names fitting sizes', async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('setup', () => fixture(run.fixtures, { machine: 'scripted' }));
  f.api.sizes.push({ slug: 'c-4', available: true, price_hourly: 0.125, disk: 25, regions: ['lon1'] });
  f.api.regions[0]!.sizes.push('c-4');
  const path = join(f.root, '.cland/run/executor/snapshot.json');
  const snapshot = JSON.parse(await readFile(path, 'utf8'));
  await writeFile(path, JSON.stringify({ ...snapshot, minDiskSize: 50 }));
  const result = await f.ui.request({ type: 'suite.start', as: { name: 'impl', sessionId: 'remote-impl', shell: true }, cwd: f.root, mode: 'auto', report: f.topic, to: ['impl'], size: 'c-4' });
  assert.equal(result.ok, false);
  assert.match(result.error!, /prepared snapshot disk does not fit size c-4; fitting sizes: c-8/);
  const status = (await f.ui.request({ type: 'hub.status', history: true })).value as { suites: unknown[] };
  assert.deepEqual(status.suites, []);
  assert.equal(f.api.requests.some(r => r.method === 'POST'), false);
});

test('periodic cover ancestry requires a positive Git descendant receipt', async t => {
  const cleanup = fenceFixtureCleanup(t);
  return suiteCase(t, async ({ setup, step }) => {
  await step('positive native guard setup', () => fixtureNativeGuard(t, { fenced: true }));
  const machine = await setup(fixtures => scratchMachine(fixtures, { identity: true }));
  const env = fixtureEnvironment(machine.root, machine.env, {});
  machine.env = env;
  const old = 'a'.repeat(40), newer = 'b'.repeat(40), missing = 'f'.repeat(40);
  const guarded = cp.execFile;
  const calls: string[][] = [];
  // Only the promised Git boundary is scripted. Callback calls and every other
  // native entry still hit the positively controlled shared guard.
  // cland-allow-child-env: callback forwarding reaches only the installed throwing native guard; the custom promisifier below is entirely scripted
  const fake = Object.assign((...args: Parameters<typeof cp.execFile>) => Reflect.apply(guarded, cp, args), {
    [promisify.custom]: async (file: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; timeout: number }) => {
      assert.equal(file, 'git');
      assert.equal(options.cwd, machine.root);
      assert.equal(options.env, env);
      assert.equal(options.timeout, 30_000);
      assert.deepEqual(args.slice(0, 4), ['-c', 'gc.auto=0', 'merge-base', '--is-ancestor']);
      calls.push(args.slice(4));
      if (args[4] === old && args[5] === newer) return { stdout: '', stderr: '' };
      throw Object.assign(new Error('scripted Git non-success'), { code: args[5] === missing ? 128 : 1 });
    },
  });
  cleanup.release(() => { cp.execFile = guarded; syncBuiltinESMExports(); });
  cp.execFile = fake as unknown as typeof cp.execFile;
  syncBuiltinESMExports();
  const candidate = suiteCandidate(env);
  assert.equal(await step('positive ancestry', () => candidate.isAncestor!(machine.root, old, newer)), true);
  assert.equal(await step('reverse ancestry', () => candidate.isAncestor!(machine.root, newer, old)), false);
  assert.equal(await step('missing ancestry', () => candidate.isAncestor!(machine.root, old, missing)), false, 'missing Git evidence is not coverage');
  assert.deepEqual(calls, [[old, newer], [newer, old], [old, missing]]);
  }, { native: true }); // The fenced fixtureNativeGuard above owns native denial and restoration.
});

test('occasions keep T4 load tests in the base phase without parallel repetitions', async t => {
  const f = await suiteUnit(t, { executor: 'droplet' }, 'shards=1\nworkers=1\nlifetime="15m"\nrun_timeout="5m"');
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const component = 'hub/test/component.test.ts';
  const tracker = 'hub/test/tracker-load.test.ts';
  const editor = 'nvim/test/soak.test.ts';
  const tiers = { [component]: 'T2', [tracker]: 'T4', [editor]: 'T4' };
  for (const file of Object.keys(tiers)) {
    await mkdir(join(f.root, file, '..'), { recursive: true });
    await writeFile(join(f.root, file), "test('load', () => {});");
  }
  await writeFile(join(f.root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: tiers }));
  await writeFile(join(f.root, 'hub/test/durations.json'), JSON.stringify({ version: 1,
    source: { artifacts: [], commit: f.candidate.head }, budget: { testSeconds: 5, fileSeconds: 60 },
    files: Object.fromEntries(Object.keys(tiers).map(file => [file, { seconds: 1, tests: 1 }])),
    tests: Object.fromEntries(Object.keys(tiers).map(file => [`${file}::load`, 1])), allow: {} }));
  for (const occasion of ['stage', 'epic', 'release', 'soak'] as const) {
    const run = await f.launch({ mode: 'all', integrated: true, occasion, fresh: true });
    const job = (await f.jobs()).find(job => job.id === run.id)!;
    assert.deepEqual(job.tierPlan?.find(row => row.tier === 'T4')?.files, [tracker, editor]);
    assert.equal(loadGateRepetitions(`${tracker}::load`, job.selection, {}), 0, `${occasion}: tracker runs only in its base phase`);
    assert.equal(loadGateRepetitions(`${editor}::unmeasured`, job.selection, {}), 0, `${occasion}: new T4 identities cannot acquire repetitions`);
    assert.equal(loadGateRepetitions(`${component}::load`, job.selection, {}), 5, `${occasion}: lower tiers retain load proof`);
    await f.tick(); await f.suites.settled();
    await f.machine.waits.run(f.machine.started(run.id));
    // A red receipt keeps all identities new for the next occasion in the table.
    await f.finish(run.id, 1);
    assert.match(await f.log(run.id), /load gate: T4 repetitions skipped; 2 files run in base phase only/);
    assert.match(f.reports.find(report => report.id === run.id)!.selection!.reason, /T4 repetitions skipped/);
  }
});

test('nightly skips with one cap notice when another project holds shared spend', async t => {
  const notices: string[] = [];
  const f = await suiteUnit(t, { onSoakNotice: (_id, text) => { notices.push(text); } },
    'soak="12:00"\ndaily_spend_usd=0.1\nlifetime="15m"\nrun_timeout="5m"', true);
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const env = { CLAND_EXECUTOR_STATE: join(f.root, '.cland/executor-state') };
  await reserveShardSpend('/another-project', ['other-run'], 'c-8', 0.25, 900_000, 0.1, env, f.clock, f.machine.dependencies.processes);
  await f.tick(); await f.suites.settled();
  assert.equal(f.suites.status().length, 0);
  assert.deepEqual(notices, ['nightly soak 2026-10-16 skipped; unexecuted coverage: all selected tiers; daily spend cap $0.1 reached']);
  await f.reopen(); await f.tick(); await f.suites.settled();
  assert.equal(notices.length, 1);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
  const ledger = JSON.parse(await readFile(join(env.CLAND_EXECUTOR_STATE, 'spend.json'), 'utf8'));
  assert.equal(ledger.entries.length, 1, 'the declined run adds no spend');
});

test('red soak proposes each unchanged failing identity while a batch can still run', async t => {
  const f = await fixture(t, { machine: 'scripted', config: 'shards=1\nlifetime="15m"\nrun_timeout="5m"' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const file = 'hub/test/example.test.ts';
  const green = await f.launch('all', '--fresh', '--occasion', 'soak');
  await drive(f, f.machine.started(green.id));
  const invalid = ['skipped', 'todo', 'cancelled', 'quarantined', 'timing only', 'mixed repetitions', 'failed child', 'incomplete', 'finish-only cancellation', 'legacy parent'];
  const names = ['first', 'second', ...invalid];
  const legacyFile = 'hub/test/legacy.test.ts';
  const progress = (name: string, outcome: string, nesting = 0, event = 'finish', receiptFile = file) => `suite progress ${JSON.stringify({ event, id: `${name}:${outcome}`, file: receiptFile, name, at: 1, nesting, outcome, seconds: 0.01 })}\n`;
  const receipts = progress('first', 'pass') + progress('second', 'pass')
    + progress('skipped', 'skip') + progress('todo', 'todo')
    + progress('cancelled', 'cancelled', 0, 'start') + progress('cancelled', 'cancelled')
    + progress('quarantined', 'pass')
    + progress('mixed repetitions', 'pass') + progress('mixed repetitions', 'fail')
    + progress('failed child', 'pass') + progress('failed child > child', 'fail', 1)
    + progress('incomplete', 'pass') + progress('incomplete', 'pass', 0, 'start')
    + progress('finish-only cancellation', 'pass') + progress('finish-only cancellation', 'cancelled')
    + progress('legacy parent', 'pass', 0, 'finish', legacyFile)
    + progress('child without parentId', 'fail', 1, 'finish', legacyFile);
  const quarantine = `suite quarantine ${JSON.stringify({ file, name: 'quarantined', outcome: 'fail', entry: { owner: 'T-1', reason: 'known flake', added: '2026-10-16', expires: '2026-10-23' } })}\n`;
  const timing = names.map(name => `suite timing ${JSON.stringify({ file, name, seconds: 0.01 })}\n`).join('');
  f.machine.finish(green.id, 0, '# tests 2\n# pass 2\n' + timing + receipts + quarantine);
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  f.candidate.head = 'b'.repeat(40); f.candidate.tree = 'e'.repeat(40);
  f.candidate.selection.fetchedDev = f.candidate.head;
  const red = await f.launch('all', '--fresh', '--occasion', 'soak');
  await drive(f, f.machine.started(red.id));
  f.machine.finish(red.id, 1, '# tests 2\n# fail 2\nsuite test failures ' + JSON.stringify(names.map(name => ({ file: name === 'legacy parent' ? legacyFile : file, name }))) + '\n');
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const history = ((await f.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: { kind: string; text: string; detail?: { event: string; identity: string; tree: string; lastGreen: { run: string }; log: { artifact: string } } }[] }).messages;
  const proposals = history.filter(m => m.detail?.event === 'quarantine-proposal');
  assert.equal(proposals.length, 2);
  assert.deepEqual(proposals.map(m => m.detail!.identity).sort(), [`${file}::first`, `${file}::second`]);
  for (const proposal of proposals) {
    assert.equal(proposal.kind, 'report');
    assert.equal(proposal.detail!.tree, f.candidate.tree);
    assert.equal(proposal.detail!.lastGreen.run, green.id);
    assert.match(proposal.detail!.log.artifact, /^A-/);
  }
  const batch = await f.launch('all', '--fresh');
  await drive(f, f.machine.started(batch.id));
  f.machine.finish(batch.id);
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  assert.match((await f.result(batch.id))!.text, /all exit 0/);
});

for (const occasion of ['soak', 'dev-t3'] as const) test(`green ${occasion === 'soak' ? 'nightly' : 'periodic dev T3'} publishes a coverage map that selects task tests`, async t => {
  const run = caseDeadlines(t);
  const schedule = occasion === 'soak' ? 'soak="12:00"' : 'shards=1\ndev_t3_every="1s"';
  const f = await run.wait('setup', () => fixture(run.fixtures, { machine: 'scripted', config: `${schedule}\nlifetime="15m"\nrun_timeout="5m"` }));
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await writeFile(join(f.root, 'hub/test/run-suite.ts'), '// reduceCoverage');
  const testFile = 'hub/test/example.test.ts';
  await writeFile(join(f.root, testFile), '');
  const source = 'hub/src/tracker/change.ts';
  let recordedAt: string | undefined;
  t.mock.method(f.dependencies.run!, 'collectCoverage', async (_lease: unknown, path: string) => {
    recordedAt = f.clock.now().toISOString();
    await writeFile(path, JSON.stringify({ version: 1, head: f.candidate.head, tree: f.candidate.tree,
      created: recordedAt, testFiles: [testFile], files: {
        [source]: { functions: [{ name: 'example', start: 0, end: 40, startLine: 1, endLine: 3, tests: [testFile] }] },
      } }));
  });
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  if (occasion === 'dev-t3') { await f.clock.advance(1000); await drive(f, f.verificationSettled()); }
  const jobs = ((await f.ui.request({ type: 'hub.status', history: true })).value as { suites: { id: string; occasion: string }[] }).suites;
  const job = jobs.find(job => job.occasion === occasion); assert.ok(job);
  await run.wait('execution receipt', () => drive(f, f.machine.started(job.id)));
  f.machine.finish(job.id);
  await f.clock.advance(1000); await run.wait('completion publication', () => drive(f, f.verificationSettled()));
  const history = ((await f.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: Message[] }).messages;
  const result = history.find(message => message.id === `suite:${job.id}`); assert.ok(result);
  assert.equal(result.fromKind, 'hub');
  assert.deepEqual(result.to, ['impl']);
  const general = await f.ui.request({ type: 'topic.history', topic: 'general' });
  assert.deepEqual((general.value as { messages: unknown[] }).messages, [], 'nightly result and chips leave General empty');
  const generalArtifacts = await f.ui.request({ type: 'artifact.list', topic: 'general' });
  assert.deepEqual((generalArtifacts.value as { artifacts: unknown[] }).artifacts, []);
  const artifacts = ((await f.ui.request({ type: 'artifact.list', topic: 'agents' })).value as { artifacts: Artifact[] }).artifacts;
  const log = artifacts.find(artifact => artifact.title.startsWith(`Suite ${job.id} `));
  assert.ok(log);
  assert.ok(history.some(message => message.id !== result.id && message.text.startsWith(`▣ ${log.id} `)), 'nightly log chip follows its report');
  const maps = await coverageMaps(f.root);
  assert.equal(maps.length, 1);
  const coverage = artifacts.find(artifact => artifact.id === maps[0]!.pointer.artifact);
  assert.ok(coverage);
  for (const artifact of [log, coverage]) {
    assert.equal(artifact.creator, 'hub');
    assert.equal(artifact.creatorKind, 'agent');
    const chip = history.find(message => message.text.startsWith(`▣ ${artifact.id} `));
    assert.ok(chip, `durable chip for ${artifact.title}`);
    assert.equal(chip.from, 'hub');
    assert.equal(chip.fromKind, 'hub');
  }
  assert.equal(maps[0]!.pointer.head, f.candidate.head);
  await f.clock.advance(25);
  assert.ok(recordedAt, 'coverage producer recorded its publication time');
  assert.equal(maps[0]!.pointer.created, recordedAt);
  const selected = await coverageSelection(f.root, [source], f.candidate.head, async (...args) => {
    if (args[0] === 'merge-base') return '';
    return args.length === 8
      ? '@@ -2 +2 @@\n-old\n+new' : '';
  }, 172_800_000, { maps, at: f.clock.now().getTime(), nearest: false });
  assert.ok('tests' in selected);
  assert.deepEqual(selected.tests, [testFile]);
  assert.equal(selected.map.artifact, maps[0]!.pointer.artifact);
});

test('human shell verification keeps human queue and artifact authors in General and Agents', async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('setup', () => fixture(run.fixtures, { machine: 'scripted' }));
  for (const topic of ['general', 'agents']) {
    // A shell without session identity sends suite.start without an as field.
    const submitted = await f.ui.request({ type: 'suite.start', cwd: f.root, mode: 'auto', report: topic, fresh: true });
    assert.equal(submitted.ok, true, submitted.error);
    const job = submitted.value as { id: string };
    await run.wait(`${topic} execution receipt`, () => drive(f, f.machine.started(job.id)));
    const queue = (await f.ui.request({ type: 'suite.queue' })).value as import('../src/protocol.ts').VerificationQueue;
    assert.equal(queue.remote?.find(row => row.id === job.id)?.session, 'human');
    f.machine.finish(job.id);
    await f.clock.advance(1000);
    await run.wait(`${topic} completion publication`, () => drive(f, f.verificationSettled()));
    const history = ((await f.ui.request({ type: 'topic.history', topic })).value as { messages: Message[] }).messages;
    assert.ok(history.find(message => message.id === `suite:${job.id}`), 'durable result receipt');
    const artifacts = ((await f.ui.request({ type: 'artifact.list', topic })).value as { artifacts: Artifact[] }).artifacts;
    const log = artifacts.find(artifact => artifact.title.startsWith(`Suite ${job.id} `));
    assert.ok(log);
    assert.equal(log.creator, 'human');
    assert.equal(log.creatorKind, 'human');
    const chip = history.find(message => message.text.startsWith(`▣ ${log.id} `));
    assert.ok(chip);
    // Agents is read-only to human sends; its automatic report chip remains a hub notice.
    assert.equal(chip.from, topic === 'agents' ? 'hub' : 'human');
    assert.equal(chip.fromKind, topic === 'agents' ? 'hub' : 'human');
  }
});

// T2: the admitted deadline plan crosses the scripted provider without real time.
test('nightly trims repetitions to the manifest projection before creating its machine', async t => {
  const f = await suiteUnit(t, { executor: 'droplet' }, 'workers=1\nsoak="12:00"\nlifetime="18m"\nrun_timeout="8m"');
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const file = 'hub/test/example.test.ts';
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await writeFile(join(f.root, file), "test('first', () => {}); test('second', () => {});");
  const unmeasured = 'hub/test/unmeasured.test.ts';
  await writeFile(join(f.root, unmeasured), '');
  await writeFile(join(f.root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: { [file]: 'T2', [unmeasured]: 'T2' } }));
  await writeFile(join(f.root, 'hub/test/durations.json'), JSON.stringify({ version: 1,
    source: { artifacts: [], commit: f.candidate.head }, budget: { testSeconds: 5, fileSeconds: 60 },
    files: { [file]: { seconds: 20, tests: 2 } }, tests: { [`${file}::first`]: 10, [`${file}::second`]: 10 }, allow: {} }));
  await f.tick(); await f.suites.settled();
  const job = (await f.jobs())[0]!;
  assert.ok(job, 'the trimmed soak is admitted');
  assert.deepEqual(job.selection?.loadGateTests, [`${file}::first`]);
  assert.equal(loadGateRepetitions(`${file}::first`, job.selection, {}), 5);
  assert.equal(loadGateRepetitions(`${file}::second`, job.selection, {}), 0);
  assert.equal(loadGateRepetitions(`${file}::unmeasured`, job.selection, {}), 0, 'unknown identities cannot grow the admitted plan');
  assert.match(await f.log(job.id), /soak deadline plan:.*1.*2.*20%.*1 files use median base projection/);
  await f.machine.waits.run(f.machine.started(job.id));
  await f.finish(job.id);
  assert.equal(f.status(job.id).outcome?.code, 0);
});

test('nightly refuses a base run beyond the deadline before reserving a droplet', async t => {
  const notices: string[] = [];
  const f = await suiteUnit(t, { onSoakNotice: (_id, text) => { notices.push(text); } },
    'soak="12:00"\nlifetime="15m"\nrun_timeout="5m"');
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const file = 'hub/test/example.test.ts';
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await writeFile(join(f.root, file), "test('slow', () => {});");
  await writeFile(join(f.root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: { [file]: 'T4' } }));
  await writeFile(join(f.root, 'hub/test/durations.json'), JSON.stringify({ version: 1,
    source: { artifacts: [], commit: f.candidate.head }, budget: { testSeconds: 5, fileSeconds: 60 },
    files: { [file]: { seconds: 300, tests: 1 } }, tests: { [`${file}::slow`]: 300 }, allow: {} }));
  await f.tick(); await f.suites.settled();
  assert.equal(f.suites.status().length, 0);
  assert.equal(notices.length, 1);
  assert.match(notices[0]!, /soak deadline plan refused: base projection 652.0 s exceeds 180.0 s/);
  assert.match(f.store.meta('soak-coverage')!, /unexecuted coverage/);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
});

test('nightly rotates files durably across restarts and reports omitted coverage', async t => {
  const run = caseDeadlines(t, { ownership: { beforeDirectories, guardDirectoryRemoval } });
  return run.run(async step => {
    const f = await step(() => run.wait('fixture setup', async () => {
      const fixture = await suiteUnit(run.fixtures, {}, 'workers=1\nsoak="12:00"\nlifetime="15m"\nrun_timeout="175s"');
      run.adoptRoot(fixture.root);
      return fixture;
    }));
    f.candidate.branch = 'dev';
    f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
    const files = ['hub/test/first.test.ts', 'hub/test/second.test.ts'];
    await step(() => mkdir(join(f.root, 'hub/test'), { recursive: true }));
    for (const file of files) await step(() => writeFile(join(f.root, file), "test('case', () => {});"));
    await step(() => writeFile(join(f.root, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: Object.fromEntries(files.map(file => [file, 'T4'])) })));
    await step(() => writeFile(join(f.root, 'hub/test/durations.json'), JSON.stringify({ version: 1, source: { artifacts: [], commit: f.candidate.head }, budget: { testSeconds: 5, fileSeconds: 60 }, files: Object.fromEntries(files.map(file => [file, { seconds: 30, tests: 1 }])), tests: {}, allow: {} })));
    await step(() => run.wait('first admission', async () => { await f.tick(); await f.suites.settled(); }));
    const first = (await step(() => f.jobs()))[0]!;
    assert.deepEqual(first.selection?.shard?.files, [files[0]]);
    assert.equal(JSON.parse(f.store.meta('soak-cursors')!).T4, 1);
    assert.match(f.store.meta('soak-coverage')!, /unexecuted coverage/);
    assert.ok((await step(() => f.log(first.id))).includes(`unexecuted tier T4: ${files[1]}`));
    await step(() => run.wait('first machine started', () => f.machine.waits.run(f.machine.started(first.id))));
    await step(() => run.wait('first completion', () => f.finish(first.id)));
    assert.equal(f.store.meta('soak-calibration'), null, 'exit zero without file completion cannot calibrate');
    f.clock.block(86400000);
    await step(() => run.wait('reopen', () => f.reopen()));
    await step(() => run.wait('second admission', async () => { await f.tick(); await f.suites.settled(); }));
    const second = (await step(() => f.jobs())).find(job => job.id !== first.id)!;
    assert.deepEqual(second.selection?.shard?.files, [files[1]]);
    assert.equal(JSON.parse(f.store.meta('soak-cursors')!).T4, 2);
    await step(() => run.wait('second machine started', () => f.machine.waits.run(f.machine.started(second.id))));
    const remoteStart = f.clock.now().toISOString().replace(/\.\d{3}Z$/, 'Z');
    f.clock.block(1000);
    await step(() => run.wait('second completion', () => f.finish(second.id, 0, `suite runner started ${remoteStart}\n# tests 1\n# pass 1\nsuite progress ` + JSON.stringify({ event: 'finish', id: 'file', type: 'file', file: files[1], name: files[1], nesting: 0, at: 1, outcome: 'pass', seconds: 1 }) + '\n')));
    assert.equal(JSON.parse(f.store.meta('soak-calibration')!).run, second.id);
  });
});

test('periodic dev T3 skips tracker-only commits and runs a changed verification tree', async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('setup', () => fixture(run.fixtures, { machine: 'scripted',
    config: 'shards=1\ndev_t3_every="1s"\nlifetime="6h"\nrun_timeout="5h"' }));
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  const tick = () => run.wait('periodic admission settled', async () => {
    await f.clock.advance(1000);
    await drive(f, f.verificationSettled());
  });
  const jobs = async () => ((await f.ui.request({ type: 'hub.status', history: true })).value as {
    suites: { id: string; occasion: string; head: string; tree: string }[];
  }).suites.filter(job => job.occasion === 'dev-t3');
  await tick(); // Establish the activation cursor.
  await tick();
  const first = (await jobs())[0]!;
  assert.ok(first);
  await run.wait('first execution started', () => drive(f, f.machine.started(first.id)));
  f.machine.finish(first.id, 0, '# tests 1\n# pass 1\n');
  await tick();

  // Candidate facts model commits after the shared verification-tree exclusion:
  // tracker/rulebook commits change HEAD while retaining the tested tree.
  f.candidate.head = 'b'.repeat(40);
  f.candidate.selection.fetchedDev = f.candidate.head;
  await tick();
  assert.equal((await jobs()).length, 1, 'tracker-only commit after the interval starts no run');

  f.candidate.head = 'c'.repeat(40);
  f.candidate.tree = 'e'.repeat(40);
  f.candidate.selection.fetchedDev = f.candidate.head;
  await tick();
  const admitted = await jobs();
  assert.equal(admitted.length, 2, 'code commit starts the next due run');
  assert.equal(admitted[1]!.head, f.candidate.head);
  assert.equal(admitted[1]!.tree, f.candidate.tree);
  await run.wait('changed tree execution started', () => drive(f, f.machine.started(admitted[1]!.id)));
  f.machine.finish(admitted[1]!.id, 0, '# tests 1\n# pass 1\n');
  await tick();
});

test('periodic deadline publishes inconclusive timeout and missing tiers without a culprit search', t => periodicCase(t, async ({ setup, step }) => {
  const f = await setup(fixtures => {
    fenceFixtureCleanup(fixtures);
    return fixture(fixtures, { machine: 'scripted', script: { outcome: 'slow' }, config: 'shards=1\ndev_t3_every="1s"\nrun_timeout="1s"' });
  });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'periodic', fetchedDev: f.candidate.head };
  await step('schedule periodic run', async () => {
    await f.clock.advance(1000); await drive(f, f.verificationSettled());
    await f.clock.advance(1000); await drive(f, f.verificationSettled());
  });
  const jobs = ((await step('read admitted jobs', () => f.ui.request({ type: 'hub.status', history: true }))).value as { suites: { id: string; occasion: string }[] }).suites;
  const job = jobs.find(job => job.occasion === 'dev-t3')!;
  await step('worker execution receipt', () => drive(f, f.machine.started(job.id)));
  await step('expire admitted owner deadline and collect receipt', async () => { await f.clock.advance(123_000); await drive(f, f.verificationSettled()); });
  const history = ((await step('read timeout notices', () => f.ui.request({ type: 'topic.history', topic: 'agents' }))).value as { messages: Message[] }).messages;
  const result = history.find(message => message.detail?.event === 'verification-dev-t3-result')!;
  assert.ok(result);
  assert.match(result.text, /Periodic dev T3 inconclusive \(timeout\)/);
  assert.match(result.text, /Unexecuted or incomplete tiers: T2, T3, Web/);
  assert.doesNotMatch(result.text, /Periodic dev T3 red/);
  assert.equal((result.detail as { result: string }).result, 'inconclusive');
  assert.equal(history.some(message => message.detail?.event === 'verification-dev-t3-search'), false);
}));

test('periodic dev T3 posts a hub-owned structured red result to the Coordinator', async t => {
  // Reporting uses a short interval; exact two-hour admission is proved in T1.
  const log = 'suite test failures [{"file":"hub/test/example.test.ts","name":"failed"}]\n# tests 1\n# fail 1\n';
  const f = await fixture(t, { machine: 'scripted', script: { outcome: 'slow', log },
    config: 'shards=1\ndev_t3_every="1s"\nlifetime="6h"\nrun_timeout="5h"' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const jobs = ((await f.ui.request({ type: 'hub.status', history: true })).value as { suites: { id: string; occasion: string }[] }).suites;
  const job = jobs.find(job => job.occasion === 'dev-t3'); assert.ok(job);
  await drive(f, f.machine.started(job.id));
  // The hub reports the current project manifest, including a renewal made while
  // the detached periodic candidate was running. No worker checkout is required.
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await writeFile(join(f.root, 'hub/test/durations.json'), JSON.stringify({ version: 1,
    source: { artifacts: [], commit: 'fixture' }, budget: { testSeconds: 5, fileSeconds: 60 }, files: {}, tests: {}, allow: {
      'hub/test/example.test.ts::expiring': { seconds: 6, reason: 'Expiry fixture.', owner: 'E-41', added: '2026-10-16', expires: '2026-10-18' },
      'hub/test/example.test.ts::later': { seconds: 6, reason: 'Later fixture.', owner: 'E-42', added: '2026-10-16', expires: '2026-10-23' },
      'hub/test/example.test.ts::legacy': { seconds: 6, reason: 'Legacy fixture.', owner: 'E-677', legacy: true },
    } }));
  f.machine.finish(job.id, 1, log);
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const history = ((await f.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: { fromKind: string; to: string[]; text: string; detail?: { event: string; head: string; previousGreenHead: string | null; result: string; failingFiles: string[] } }[] }).messages;
  const result = history.find(m => m.detail?.event === 'verification-dev-t3-result'); assert.ok(result);
  assert.equal(result.fromKind, 'hub');
  assert.deepEqual(result.to, ['impl']);
  assert.equal(result.detail!.head, f.candidate.head);
  assert.equal(result.detail!.previousGreenHead, null);
  assert.equal(result.detail!.result, 'red');
  assert.deepEqual(result.detail!.failingFiles, ['hub/test/example.test.ts']);
  assert.match(result.text, /Periodic dev T3 red/);
  assert.match(result.text, /duration allowance expiring within 5d: hub\/test\/example.test.ts::expiring · owner E-41 · expires 2026-10-18/);
  assert.doesNotMatch(result.text, /owner E-42|::legacy/);
});

for (const occasion of ['dev-t3', 'soak'] as const) test(`${occasion} delivery failure publishes infrastructure rather than a red headline or culprit search`, t => suiteCase(t, async ({ setup, step }) => {
  const f = await setup(fixtures => fixture(fixtures, { machine: 'scripted', config: occasion === 'soak' ? 'soak="12:00"' : 'shards=1\ndev_t3_every="1s"' }));
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'periodic', fetchedDev: f.candidate.head };
  t.mock.method(f.dependencies.run!, 'deliver', async () => { throw new Error('bundle: captured object missing'); });
  const tick = () => step('periodic I/O settled', async () => { await f.clock.advance(1000); await drive(f, f.verificationSettled()); });
  await tick(); await tick(); await tick();
  const history = ((await step('published message history', () => f.ui.request({ type: 'topic.history', topic: 'agents' }))).value as { messages: { text: string; detail?: { event: string; run: string; result: string; notRun?: string; cause?: string } }[] }).messages;
  const message = history.find(message => message.detail?.event === `verification-${occasion}-result`);
  assert.ok(message, 'durable periodic result published');
  if (occasion === 'dev-t3') {
    assert.equal(message.detail!.result, 'not-run');
    assert.equal(message.detail!.notRun, 'infrastructure');
    assert.equal(message.detail!.cause, 'bundle: captured object missing');
    assert.match(message.text, /Periodic dev T3 not run · infrastructure/);
  } else {
    assert.match(message.text, /all unavailable: infrastructure/);
    assert.match(message.text, /bundle: captured object missing/);
    assert.doesNotMatch(message.text, /all exit 1/);
  }
  assert.doesNotMatch(message.text, /Periodic dev T3 red/);
  assert.equal(history.some(message => message.detail?.event === 'verification-dev-t3-search'), false);
  assert.equal(f.machine.calls.some(call => call.step === 'start'), false);
  const status = (await step('durable status', () => f.ui.request({ type: 'hub.status', history: true }))).value as { suites: { id: string; outcome: { notRun?: string } }[]; covers: { id: string }[] };
  assert.equal(status.suites.find(job => job.id === message.detail!.run)!.outcome.notRun, 'infrastructure');
  assert.equal(status.covers.some(cover => cover.id === message.detail!.run), false);
}));

for (const capacity of ['regions', 'unavailable-size', 'absent-size'] as const) test(`periodic provider capacity refusal publishes not run with no red headline or culprit search (${capacity})`, async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('setup', () => fixture(run.fixtures, { machine: 'scripted', config: 'shards=1\ndev_t3_every="1s"' }));
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'periodic', fetchedDev: f.candidate.head };
  if (capacity === 'regions') for (const region of f.api.regions) region.available = false;
  else if (capacity === 'unavailable-size') f.api.sizes[0]!.available = false;
  else f.api.sizes.length = 0;
  const cause = capacity === 'regions' ? 'droplet size c-8 unavailable in regions lon1, nyc1, sfo2; use cland verify executor local' : 'droplet size c-8 is unavailable';
  const tick = () => run.wait('periodic I/O settled', async () => { await f.clock.advance(1000); await drive(f, f.verificationSettled()); });
  await tick(); await tick(); await tick();
  const history = ((await f.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: { text: string; detail?: { event: string; run: string; result: string; notRun?: string; cause?: string } }[] }).messages;
  const message = history.find(message => message.detail?.event === 'verification-dev-t3-result');
  assert.ok(message, 'durable periodic result published');
  assert.equal(message.detail!.result, 'not-run', message.text);
  assert.equal(message.detail!.notRun, 'provider-capacity');
  assert.equal(message.detail!.cause, cause);
  assert.match(message.text, /Periodic dev T3 not run: provider capacity/);
  assert.ok(message.text.includes(cause), message.text);
  assert.doesNotMatch(message.text, /\bred\b/i);
  assert.equal(history.some(message => message.detail?.event === 'verification-dev-t3-search'), false);
  assert.equal(f.machine.calls.some(call => call.step === 'start' || call.step === 'deliver'), false);
  assert.equal(f.api.requests.some(request => request.method === 'POST'), false, 'no provider resources created');
  const status = (await f.ui.request({ type: 'hub.status', history: true })).value as { suites: { id: string; outcome: { notRun?: string } }[]; covers: { id: string }[] };
  assert.equal(status.suites.find(job => job.id === message.detail!.run)!.outcome.notRun, 'provider-capacity');
  assert.equal(status.covers.some(cover => cover.id === message.detail!.run), false);
});

for (const capacity of ['regions', 'unavailable-size', 'absent-size'] as const)
for (const executor of [undefined, 'droplet', 'size', 'droplet-size'] as const) test(`${capacity === 'absent-size' && (executor === 'size' || executor === 'droplet-size') ? 'task unknown size override refuses admission' : 'task capacity refusal reports unavailable without executor fallback'} (${executor ?? 'default'}, ${capacity})`, async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('setup', () => fixture(run.fixtures, { machine: 'scripted' }));
  if (capacity === 'regions') for (const region of f.api.regions) region.available = false;
  else if (capacity === 'unavailable-size') f.api.sizes[0]!.available = false;
  else f.api.sizes.length = 0;
  const explicitSize = executor === 'size' || executor === 'droplet-size';
  if (capacity === 'absent-size' && explicitSize) {
    const submitted = await run.wait('unknown size refusal', () => f.ui.request({ type: 'suite.start',
      as: { name: 'impl', sessionId: 'remote-impl', shell: true }, cwd: f.root, mode: 'auto', report: f.topic, to: ['impl'],
      ...(executor === 'droplet-size' ? { executor: 'droplet' as const } : {}), size: 'c-8' }));
    assert.equal(submitted.ok, false);
    assert.match(submitted.error!, /droplet size c-8 is unavailable/);
    const status = (await f.ui.request({ type: 'hub.status', history: true })).value as { suites: unknown[] };
    assert.deepEqual(status.suites, [], 'unknown override creates no suite job');
    assert.equal(f.api.requests.some(request => request.method === 'POST'), false, 'unknown override creates no provider resource');
    return;
  }
  const cause = capacity === 'regions' ? explicitSize ? 'droplet size c-8 unavailable in configured regions' : 'droplet size c-8 unavailable in regions lon1, nyc1, sfo2; use cland verify executor local' : 'droplet size c-8 is unavailable';
  const job = await run.wait('submission', () => f.launch(...(executor === 'droplet' || executor === 'droplet-size' ? ['--executor', 'droplet'] : []), ...(explicitSize ? ['--size', 'c-8'] : [])));
  await run.wait('acquisition settled', () => drive(f, f.verificationSettled()));
  await f.clock.advance(1000);
  await run.wait('report settled', () => drive(f, f.verificationSettled()));
  const message = (await f.messages(job.id))[0];
  assert.ok(message, 'durable task suite result published');
  const result = JSON.parse(await readFile(join(f.root, '.cland/run/suites', job.id, 'result.json'), 'utf8'));
  assert.equal(result.notRun, 'provider-capacity');
  assert.equal(result.cause, cause);
  assert.match(message.text, /^suite result .*\nauto unavailable: provider capacity\n/);
  assert.ok(message.text.includes(cause), message.text);
  assert.doesNotMatch(message.text, /exit 1|\bred\b|fallback|# fail/i);
  const status = (await f.ui.request({ type: 'hub.status', history: true })).value as { suites: { id: string; executor: string; outcome: { notRun?: string; cause: string }; fallback?: string }[] };
  const completed = status.suites.find(suite => suite.id === job.id)!;
  assert.equal(completed.outcome.notRun, 'provider-capacity');
  assert.equal(completed.outcome.cause, result.cause);
  assert.equal(completed.executor, 'droplet');
  assert.equal(completed.fallback, undefined);
  const card = (await f.ui.request({ type: 'task.view', item: f.item })).value as { item: { verify: { result: string } } };
  assert.equal(card.item.verify.result, 'unavailable');
  assert.equal(f.machine.calls.some(call => call.step === 'start' || call.step === 'deliver'), false);
  assert.equal(f.api.requests.some(request => request.method === 'POST'), false);
});

for (const refusal of ['invalid-price', 'auth', 'spend', 'malformed-slug'] as const)
for (const explicitSize of [false, true]) test(`non-capacity admission remains a refusal (${refusal}, size ${explicitSize})`, async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('setup', () => fixture(run.fixtures, { machine: 'scripted',
    config: refusal === 'spend' ? 'daily_spend_usd=0.001\nlifetime="15m"\nrun_timeout="5m"' : '' }));
  if (refusal === 'invalid-price') f.api.sizes[0]!.price_hourly = -1;
  if (refusal === 'auth') t.mock.method(f.api.provider, 'sizes', async () => { throw new DigitalOceanError(401, 'unauthorized', 'test auth refused'); });
  const submitted = await run.wait('admission refusal', () => f.ui.request({ type: 'suite.start',
    as: { name: 'impl', sessionId: 'remote-impl', shell: true }, cwd: f.root, mode: 'auto', report: f.topic, to: ['impl'], executor: 'droplet',
    ...(refusal === 'malformed-slug' ? { size: 'bad slug' } : explicitSize ? { size: 'c-8' } : {}) }));
  assert.equal(submitted.ok, false);
  const reason = { 'invalid-price': /no valid price/, auth: /401 unauthorized/, spend: /daily spend cap/, 'malformed-slug': /size must be a slug/ }[refusal];
  assert.match(submitted.error!, reason);
  const status = (await f.ui.request({ type: 'hub.status', history: true })).value as { suites: unknown[] };
  assert.deepEqual(status.suites, [], 'no capacity run fabricated for a different admission refusal');
  assert.equal(f.api.requests.some(request => request.method === 'POST'), false);
});

test('periodic T3 obeys the shared daily cap without changing the merge queue', async t => {
  const notices: string[] = [];
  const f = await suiteUnit(t, { onSoakNotice: (_id, text) => { notices.push(text); } },
    'shards=1\ndev_t3_every="2h"\ndaily_spend_usd=0.1\nlifetime="15m"\nrun_timeout="5m"', true);
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  await f.tick(); await f.suites.settled();
  f.clock.block(7_200_000);
  const env = { CLAND_EXECUTOR_STATE: join(f.root, '.cland/executor-state') };
  await reserveShardSpend('/another-project', ['other-run'], 'c-8', 0.25, 900_000, 0.1, env, f.clock, f.machine.dependencies.processes);
  await f.tick(); await f.suites.settled();
  assert.equal(f.suites.status().length, 0);
  assert.deepEqual(notices, ['periodic dev T3 skipped: daily spend cap $0.1 reached']);
  await f.reopen(); await f.tick(); await f.suites.settled();
  assert.equal(notices.length, 1, 'restart preserves admission throttling');
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
  assert.deepEqual(f.store.mergeQueue(), []);
});

test('unavailable periodic merge range still publishes its result and permits the next run', async t => {
  let rangeCalls = 0;
  // The two-hour admission boundary has its own T1 proof; this tests reporting.
  const f = await fixture(t, { machine: 'scripted',
    config: 'shards=1\ndev_t3_every="1s"\nlifetime="6h"\nrun_timeout="5h"',
    git: async args => {
      if (args[0] === 'log' && args.includes('--first-parent')) { rangeCalls++; throw new Error('Git timed out'); }
      return null;
    } });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  for (const [index, head] of ['a', 'b', 'c'].entries()) {
    f.candidate.head = head.repeat(40); f.candidate.tree = ['d', 'e', 'f'][index]!.repeat(40);
    f.candidate.selection.fetchedDev = f.candidate.head;
    const log = index === 1 ? 'suite test failures [{"file":"hub/test/example.test.ts","name":"failed"}]\n# tests 1\n# fail 1\n' : '# tests 1\n# pass 1\n';
    f.machine.script({ outcome: 'slow', log });
    await f.clock.advance(1000); await drive(f, f.verificationSettled());
    const jobs = ((await f.ui.request({ type: 'hub.status', history: true })).value as { suites: { id: string; occasion: string }[] }).suites.filter(job => job.occasion === 'dev-t3');
    assert.equal(jobs.length, index + 1, 'each completed report releases periodic eligibility');
    const job = jobs[index]!;
    await drive(f, f.machine.started(job.id));
    f.machine.finish(job.id, index === 1 ? 1 : 0, log);
    await f.clock.advance(1000); await drive(f, f.verificationSettled());
  }
  const history = ((await f.ui.request({ type: 'topic.history', topic: 'agents' })).value as { messages: { detail?: { event: string; head: string; previousGreenHead: string; merges: unknown; result: string; failingFiles: string[]; artifact: string } }[] }).messages;
  const results = history.filter(m => m.detail?.event === 'verification-dev-t3-result');
  assert.equal(results.length, 3);
  const red = results.find(m => m.detail!.head === 'b'.repeat(40))!.detail!;
  assert.equal(red.previousGreenHead, 'a'.repeat(40));
  assert.equal(red.merges, null);
  assert.equal(red.result, 'red');
  assert.deepEqual(red.failingFiles, ['hub/test/example.test.ts']);
  assert.match(red.artifact, /^A-/);
  assert.equal(rangeCalls, 2);
});
