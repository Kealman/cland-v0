// T2: automatic periodic reporting -> detached file probes -> Bug and General/claimant delivery.
// projectHub uses scripted executor/repository facts; no native Git or child processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { verificationFixture } from './verification-fixture.ts';
import { fixture } from './remote-fixture.ts';
import { drive } from './remote-clock.ts';
import { inProcessSpoke } from './harness.ts';
import { TrackerIndex } from '../src/tracker/index-db.ts';
import type { SuiteStatus } from '../src/protocol.ts';
import { caseDeadlines } from './case-deadlines.ts';
import { suiteUnit } from './suite-unit-fixture.ts';
import type { RunRef } from '../src/executor/executor.ts';

const budget = 'duration budget: hub/test/slow.test.ts::slow 2.39 s > 2 s (T2) (add to hub/test/durations.json with a reason)\n';

test('budget-only periodic red names over-budget identities without starting culprit probes', async t => {
  const f = await fixture(t, { machine: 'scripted', config: 'dev_t3_every="1s"\nshards=1\nlifetime="15m"\nrun_timeout="5m"' });
  f.candidate.branch = 'dev';
  f.candidate.selection = { mode: 'full', files: [], reason: 'periodic', fetchedDev: f.candidate.head };
  const jobs = async () => ((await f.ui.request({ type: 'hub.status', history: true })).value as { suites: SuiteStatus[] }).suites;
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const run = (await jobs()).find(job => job.occasion === 'dev-t3')!;
  assert.ok(run); await drive(f, f.machine.started(run.id));
  const log = 'suite test failures []\n# tests 2\n# pass 2\n# fail 0\n' + budget
    + 'duration budget: hub/test/other.test.ts::other 2.06 s > 2 s (T2) (add to hub/test/durations.json with a reason)\n'
    + 'duration budget: hub/test/slow.test.ts::slow 2.39 s > 2 s (T2)\n';
  f.machine.finish(run.id, 1, log);
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  assert.deepEqual((await jobs()).find(job => job.id === run.id)!.cover, { status: 'red', cause: 'budget',
    tests: ['hub/test/slow.test.ts::slow', 'hub/test/other.test.ts::other'] });
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const history = ((await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: { text: string; detail?: { event?: string } }[] }).messages;
  const report = history.find(message => message.detail?.event === 'verification-dev-t3-search');
  assert.ok(report, 'periodic culprit search publishes a diagnosis');
  assert.match(report.text, /budget only: hub\/test\/slow.test.ts::slow, hub\/test\/other.test.ts::other/);
  assert.doesNotMatch(report.text, /inconclusive/);
  assert.equal((await jobs()).filter(job => job.devT3Probe).length, 0, 'budget-only reds do not run failing-file probes');
});

for (const scenario of ['culprit', 'flake', 'Web culprit'] as const) test(`red periodic run ${scenario === 'Web culprit' ? 'runs Web probes and names the first red merge' : scenario === 'flake' ? 'reports a passing rerun as a flake without filing' : 'files one Bug with live last-claimant delivery'}`, async t => {
  const flake = scenario === 'flake', web = scenario === 'Web culprit';
  const file = web ? 'web/test/palette.test.ts' : 'hub/test/example.test.ts';
  const failed = `suite test failures ${JSON.stringify([{ file, name: 'regression' }])}\n# tests 1\n# fail 1\n`;
  const passed = `suite progress ${JSON.stringify({ event: 'finish', id: 'test', file, name: 'regression', at: 1, nesting: 0, outcome: 'pass', seconds: 0.01 })}\nsuite test failures []\n# tests 1\n# pass 1\n`;
  const run = caseDeadlines(t);
  const firstMerge = 'c'.repeat(40), culprit = web ? 'f'.repeat(40) : 'b'.repeat(40);
  const baseline = 'a'.repeat(40), redHead = 'b'.repeat(40), baselineTree = 'd'.repeat(40), redTree = 'e'.repeat(40);
  const checked: string[] = [], removed: string[] = [];
  const f = await run.wait('setup', () => fixture(run.fixtures, { machine: 'scripted', config: 'dev_t3_every="1s"\nshards=1\nlifetime="15m"\nrun_timeout="5m"',
    git: async args => args[0] === 'log' && args.includes('--first-parent')
      ? web ? `${firstMerge}\0Merge green\n${culprit}\0Merge regression\n${redHead}\0Merge later` : `${redHead}\0Merge regression` : null,
    devT3Repository: {
      identity: async head => head === baseline ? baselineTree : redTree,
      checkout: async candidate => {
        // Historical cland checkouts carry their package runner, like the live fixture.
        await mkdir(candidate.cwd, { recursive: true });
        await verificationFixture(candidate.cwd);
        if (web) {
          await mkdir(join(candidate.cwd, 'web/test'), { recursive: true });
          await writeFile(join(candidate.cwd, file), "test('regression', () => {});\n");
          await writeFile(join(candidate.cwd, 'hub/test/run-suite.ts'), '// supportsWebPhase = true; inheritedLease\n');
          await writeFile(join(candidate.cwd, 'hub/test/tiers.json'), JSON.stringify({ version: 1, tests: { [file]: 'Web' } }));
          await mkdir(join(candidate.cwd, '.cland'), { recursive: true });
          await writeFile(join(candidate.cwd, '.cland/config.toml'), '[verification]\ntest_unit="node hub/test/run-suite.ts --tier T1"\ntest_integration="node hub/test/run-suite.ts --tier T3"\n');
        }
        checked.push(candidate.head); f.candidate.head = candidate.head; f.candidate.tree = candidate.tree; f.candidate.branch = 'probe';
      },
      remove: async candidate => { removed.push(candidate.head); f.candidate.head = redHead; f.candidate.tree = redTree; f.candidate.branch = 'dev'; f.candidate.selection.fetchedDev = redHead; },
    } }));
  const delivered = new Map<string, RunRef>();
  const deliver = f.dependencies.run!.deliver.bind(f.dependencies.run!);
  t.mock.method(f.dependencies.run!, 'deliver', async (...args: Parameters<typeof deliver>) => {
    delivered.set(args[1].id, args[1]);
    return deliver(...args);
  });
  const coordinator = await inProcessSpoke(t, { discover: true, cwd: f.root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  t.after(() => coordinator.close());
  // A real claim is released on close; the persisted last claimant must still receive blame.
  assert.equal((await f.spoke.call<{ ok: boolean }>('task.claim', { id: f.item })).ok, true);
  assert.equal((await f.ui.request({ type: 'task.close', item: f.item })).ok, true);
  const index = new TrackerIndex(join(f.root, '.cland/hub.db'));
  index.recordMerge(f.item, { branch: 'task', tip: redHead, base: 'dev', commit: culprit }); index.close();
  f.candidate.branch = 'dev'; f.candidate.head = baseline; f.candidate.tree = baselineTree;
  f.candidate.selection = { mode: 'full', files: [], reason: 'periodic', fetchedDev: baseline };
  const jobs = async () => ((await f.ui.request({ type: 'hub.status', history: true })).value as { suites: SuiteStatus[] }).suites;
  const finish = async (job: SuiteStatus, code: number, log: string) => {
    await run.wait('executor started', () => drive(f, f.machine.started(job.id)));
    if (web && job.devT3Probe) assert.deepEqual(delivered.get(job.id)!.commands!.plan!.map(step => step.name), ['check', 'Web']);
    f.machine.finish(job.id, code, log);
    await run.wait('completion reported', async () => { await f.clock.advance(1000); await drive(f, f.verificationSettled()); });
  };
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const green = (await jobs()).find(job => job.occasion === 'dev-t3')!;
  assert.ok(green); await finish(green, 0, passed);
  f.candidate.head = redHead; f.candidate.tree = redTree; f.candidate.selection.fetchedDev = redHead;
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const red = (await jobs()).findLast(job => job.occasion === 'dev-t3')!;
  assert.notEqual(red.id, green.id); await finish(red, 1, failed + budget);
  assert.deepEqual((await jobs()).find(job => job.id === red.id)!.cover, { status: 'red', cause: 'test-failure',
    tests: [`${file}::regression`, 'hub/test/slow.test.ts::slow'] });
  type SearchMessage = { detail: { input: { run: string; head: string; previousGreenHead: string; failingFiles: string[]; budgetIdentities?: string[] }; bugs: { item: string; merge: string }[]; files: { result: string; culprit?: { head: string }; receipts: { run: string }[] }[] }; to: string[]; text: string };
  let search: SearchMessage | undefined;
  for (let i = 0; i < 24 && !search; i++) {
    const probe = (await jobs()).find(job => job.devT3Probe && !job.reported);
    if (probe) {
      assert.deepEqual(probe.selection!.files, [file]);
      assert.deepEqual(probe.selection!.shard, { files: web ? [] : [file], nvim: web });
      if (web) {
        assert.equal(probe.selection!.web, 'all');
        assert.deepEqual(probe.selection!.tiers, []);
      }
      assert.equal(probe.selection!.loadGate, false);
      const green = flake || probe.head === baseline || web && probe.head === firstMerge;
      await finish(probe, green ? 0 : 1, green ? passed : failed);
    } else { await f.clock.advance(1000); await drive(f, f.verificationSettled()); }
    const history = ((await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: SearchMessage[] }).messages;
    search = history.find(message => (message.detail as unknown as { event?: string })?.event === 'verification-dev-t3-search');
  }
  assert.ok(search, 'search completes with a General report');
  assert.equal(search.detail.input.run, red.id); assert.equal(search.detail.input.head, redHead); assert.equal(search.detail.input.previousGreenHead, baseline);
  assert.deepEqual(search.detail.input.failingFiles, [file]); assert.equal(search.detail.input.budgetIdentities, undefined);
  assert.doesNotMatch(search.text, /budget only:/);
  assert.equal(search.detail.files[0]!.result, flake ? 'flake' : 'culprit', JSON.stringify(search.detail));
  assert.equal(search.detail.bugs.length, flake ? 0 : 1);
  const items = ((await f.ui.request({ type: 'task.list' })).value as { items: { id: string; title: string; parent: string; labels: string[] }[] }).items;
  const bugs = items.filter(item => item.labels.includes(`dev-t3-${culprit}`));
  assert.equal(bugs.length, flake ? 0 : 1);
  if (!flake) {
    assert.equal(search.detail.files[0]!.culprit!.head, culprit);
    assert.equal(search.detail.bugs[0]!.merge, culprit);
    assert.equal(items.find(item => item.id === bugs[0]!.parent)!.title, 'Bugs');
    const bug = ((await f.ui.request({ type: 'task.view', item: bugs[0]!.id })).value as { item: { body: string } }).item;
    for (const value of [file, red.id, green.id, redHead, baseline, ...search.detail.files[0]!.receipts.map(receipt => receipt.run)]) assert.ok(bug.body.includes(value), value);
    assert.ok(search.to.includes('coord')); assert.ok(search.to.includes('impl'), 'live claimant survives task closure');
  }
  assert.deepEqual(checked, flake ? [redHead] : web ? [redHead, baseline, firstMerge, culprit] : [redHead, baseline]); assert.deepEqual(removed, checked);
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const later = ((await f.ui.request({ type: 'task.list' })).value as { items: { labels: string[] }[] }).items;
  assert.equal(later.filter(item => item.labels.includes(`dev-t3-${culprit}`)).length, flake ? 0 : 1);
});

test('diagnostic files outside allowed test roots or with parent traversal are refused', async t => {
  const run = caseDeadlines(t);
  const f = await run.wait('setup', () => suiteUnit(run.fixtures));
  for (const file of ['other/test/example.test.ts', '/web/test/palette.test.ts', 'web/src/palette.test.ts',
    'web/test/palette.ts', 'web/test/../palette.test.ts', 'web/test/nested/../../palette.test.ts']) {
    await assert.rejects(run.wait('diagnostic refusal', () => f.launch({
      devT3Probe: { key: `invalid:${file}`, files: [file] }, executor: 'droplet',
    })), /invalid batch diagnostic files/, file);
  }
  assert.deepEqual(await f.jobs(), [], 'invalid paths create no jobs');
  assert.deepEqual(f.acquisitions, [], 'invalid paths acquire no executor');
});
