// T2: the shared spend ledger and dispatch publication use in-process providers and FakeClock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { suiteUnit } from './suite-unit-fixture.ts';
import { reserveShardSpend } from '../src/executor/droplet/spend.ts';
import { fixture } from './remote-fixture.ts';
import { drive } from './remote-clock.ts';
import { loadGateRepetitions } from '../src/suite-load-gate-plan.ts';
import { coverageMaps, coverageSelection } from '../src/suite-coverage.ts';

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
  assert.deepEqual(notices, ['nightly soak 2026-10-16 skipped: daily spend cap $0.1 reached']);
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
  const history = ((await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: { kind: string; text: string; detail?: { event: string; identity: string; tree: string; lastGreen: { run: string }; log: { artifact: string } } }[] }).messages;
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

test('green nightly publishes a coverage map that selects task tests', async t => {
  const f = await fixture(t, { machine: 'scripted', config: 'soak="12:00"\nlifetime="15m"\nrun_timeout="5m"' });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  await mkdir(join(f.root, 'hub/test'), { recursive: true });
  await writeFile(join(f.root, 'hub/test/run-suite.ts'), '// reduceCoverage');
  const testFile = 'hub/test/example.test.ts';
  await writeFile(join(f.root, testFile), '');
  const source = 'hub/src/tracker/change.ts';
  t.mock.method(f.dependencies.run!, 'collectCoverage', async (_lease: unknown, path: string) => {
    await writeFile(path, JSON.stringify({ version: 1, head: f.candidate.head, tree: f.candidate.tree,
      created: f.clock.now().toISOString(), testFiles: [testFile], files: {
        [source]: { functions: [{ name: 'example', start: 0, end: 40, startLine: 1, endLine: 3, tests: [testFile] }] },
      } }));
  });
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const jobs = ((await f.ui.request({ type: 'hub.status' })).value as { suites: { id: string; occasion: string }[] }).suites;
  const job = jobs.find(job => job.occasion === 'soak'); assert.ok(job);
  await drive(f, f.machine.started(job.id));
  f.machine.finish(job.id);
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const history = ((await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: { id: string; fromKind: string; to: string[] }[] }).messages;
  const result = history.find(message => message.id === `suite:${job.id}`); assert.ok(result);
  assert.equal(result.fromKind, 'hub');
  assert.deepEqual(result.to, ['impl']);
  const maps = await coverageMaps(f.root);
  assert.equal(maps.length, 1);
  const selected = await coverageSelection(f.root, [source], f.candidate.head, async (...args) => {
    if (args[0] === 'merge-base') return '';
    return args.length === 8
      ? '@@ -2 +2 @@\n-old\n+new' : '';
  }, 172_800_000, { maps, at: f.clock.now().getTime(), nearest: false });
  assert.ok('tests' in selected);
  assert.deepEqual(selected.tests, [testFile]);
  assert.equal(selected.map.artifact, maps[0]!.pointer.artifact);
});

// T2: the admitted deadline plan crosses the scripted provider without real time.
test('nightly trims repetitions to the manifest projection before creating its machine', async t => {
  const f = await suiteUnit(t, { executor: 'droplet' }, 'workers=1\nsoak="12:00"\nlifetime="15m"\nrun_timeout="5m"');
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
  assert.match(notices[0]!, /soak deadline plan refused: base projection 301.0 s exceeds 180.0 s/);
  assert.equal(f.api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
});

test('periodic dev T3 posts a hub-owned structured red result to the Coordinator', async t => {
  // Reporting uses a short interval; exact two-hour admission is proved in T1.
  const log = 'suite test failures [{"file":"hub/test/example.test.ts","name":"failed"}]\n# tests 1\n# fail 1\n';
  const f = await fixture(t, { machine: 'scripted', script: { outcome: 'slow', log },
    config: 'dev_t3_every="1s"\nlifetime="6h"\nrun_timeout="5h"' });
  assert.equal((await f.ui.request({ type: 'role.set', session: 'impl', role: 'coordinator' })).ok, true);
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'integrated', fetchedDev: f.candidate.head };
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const jobs = ((await f.ui.request({ type: 'hub.status' })).value as { suites: { id: string; occasion: string }[] }).suites;
  const job = jobs.find(job => job.occasion === 'dev-t3'); assert.ok(job);
  await drive(f, f.machine.started(job.id));
  f.machine.finish(job.id, 1, log);
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const history = ((await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: { fromKind: string; to: string[]; text: string; detail?: { event: string; head: string; previousGreenHead: string | null; result: string; failingFiles: string[] } }[] }).messages;
  const result = history.find(m => m.detail?.event === 'verification-dev-t3-result'); assert.ok(result);
  assert.equal(result.fromKind, 'hub');
  assert.deepEqual(result.to, ['impl']);
  assert.equal(result.detail!.head, f.candidate.head);
  assert.equal(result.detail!.previousGreenHead, null);
  assert.equal(result.detail!.result, 'red');
  assert.deepEqual(result.detail!.failingFiles, ['hub/test/example.test.ts']);
  assert.match(result.text, /Periodic dev T3 red/);
});

test('periodic T3 obeys the shared daily cap without changing the merge queue', async t => {
  const notices: string[] = [];
  const f = await suiteUnit(t, { onSoakNotice: (_id, text) => { notices.push(text); } },
    'dev_t3_every="2h"\ndaily_spend_usd=0.1\nlifetime="15m"\nrun_timeout="5m"', true);
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
    config: 'dev_t3_every="1s"\nlifetime="6h"\nrun_timeout="5h"',
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
    const jobs = ((await f.ui.request({ type: 'hub.status' })).value as { suites: { id: string; occasion: string }[] }).suites.filter(job => job.occasion === 'dev-t3');
    assert.equal(jobs.length, index + 1, 'each completed report releases periodic eligibility');
    const job = jobs[index]!;
    await drive(f, f.machine.started(job.id));
    f.machine.finish(job.id, index === 1 ? 1 : 0, log);
    await f.clock.advance(1000); await drive(f, f.verificationSettled());
  }
  const history = ((await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: { detail?: { event: string; head: string; previousGreenHead: string; merges: unknown; result: string; failingFiles: string[]; artifact: string } }[] }).messages;
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
