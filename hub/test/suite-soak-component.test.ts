// T2: the shared spend ledger and dispatch publication use in-process providers and FakeClock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { suiteUnit } from './suite-unit-fixture.ts';
import { reserveShardSpend } from '../src/executor/droplet/spend.ts';
import { fixture } from './remote-fixture.ts';
import { drive } from './remote-clock.ts';
import { coverageMaps, coverageSelection } from '../src/suite-coverage.ts';

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
