// T2: automatic periodic reporting -> detached file probes -> Bug and General/claimant delivery.
// projectHub uses scripted executor/repository facts; no native Git or child processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { verificationFixture } from './verification-fixture.ts';
import { fixture } from './remote-fixture.ts';
import { drive } from './remote-clock.ts';
import { inProcessSpoke } from './harness.ts';
import { TrackerIndex } from '../src/tracker/index-db.ts';
import type { SuiteStatus } from '../src/protocol.ts';

const file = 'hub/test/example.test.ts';
const failed = `suite test failures ${JSON.stringify([{ file, name: 'regression' }])}\n# tests 1\n# fail 1\n`;
const passed = `suite progress ${JSON.stringify({ event: 'finish', id: 'test', file, name: 'regression', at: 1, nesting: 0, outcome: 'pass', seconds: 0.01 })}\nsuite test failures []\n# tests 1\n# pass 1\n`;

for (const flake of [false, true]) test(`red periodic run ${flake ? 'reports a passing rerun as a flake without filing' : 'files one Bug with live last-claimant delivery'}`, async t => {
  const baseline = 'a'.repeat(40), redHead = 'b'.repeat(40), baselineTree = 'd'.repeat(40), redTree = 'e'.repeat(40);
  const checked: string[] = [], removed: string[] = [];
  const f = await fixture(t, { machine: 'scripted', config: 'dev_t3_every="1s"\nshards=1\nlifetime="15m"\nrun_timeout="5m"',
    git: async args => args[0] === 'log' && args.includes('--first-parent') ? `${redHead}\0Merge regression` : null,
    devT3Repository: {
      identity: async head => head === baseline ? baselineTree : redTree,
      checkout: async candidate => {
        // Historical cland checkouts carry their package runner, like the live fixture.
        await mkdir(candidate.cwd, { recursive: true });
        await verificationFixture(candidate.cwd);
        checked.push(candidate.head); f.candidate.head = candidate.head; f.candidate.tree = candidate.tree; f.candidate.branch = 'probe';
      },
      remove: async candidate => { removed.push(candidate.head); f.candidate.head = redHead; f.candidate.tree = redTree; f.candidate.branch = 'dev'; f.candidate.selection.fetchedDev = redHead; },
    } });
  const coordinator = await inProcessSpoke(t, { discover: true, cwd: f.root, name: 'coord', sessionId: 'coord-id', role: 'coordinator' });
  t.after(() => coordinator.close());
  // A real claim is released on close; the persisted last claimant must still receive blame.
  assert.equal((await f.spoke.call<{ ok: boolean }>('task.claim', { id: f.item })).ok, true);
  assert.equal((await f.ui.request({ type: 'task.close', item: f.item })).ok, true);
  const index = new TrackerIndex(join(f.root, '.cland/hub.db'));
  index.recordMerge(f.item, { branch: 'task', tip: redHead, base: 'dev', commit: redHead }); index.close();
  f.candidate.branch = 'dev'; f.candidate.head = baseline; f.candidate.tree = baselineTree;
  f.candidate.selection = { mode: 'full', files: [], reason: 'periodic', fetchedDev: baseline };
  const jobs = async () => ((await f.ui.request({ type: 'hub.status' })).value as { suites: SuiteStatus[] }).suites;
  const finish = async (job: SuiteStatus, code: number, log: string) => {
    await drive(f, f.machine.started(job.id)); f.machine.finish(job.id, code, log);
    await f.clock.advance(1000); await drive(f, f.verificationSettled());
  };
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const green = (await jobs()).find(job => job.occasion === 'dev-t3')!;
  assert.ok(green); await finish(green, 0, passed);
  f.candidate.head = redHead; f.candidate.tree = redTree; f.candidate.selection.fetchedDev = redHead;
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const red = (await jobs()).findLast(job => job.occasion === 'dev-t3')!;
  assert.notEqual(red.id, green.id); await finish(red, 1, failed);
  type SearchMessage = { detail: { input: { run: string; head: string; previousGreenHead: string }; bugs: { item: string; merge: string }[]; files: { result: string; receipts: { run: string }[] }[] }; to: string[]; text: string };
  let search: SearchMessage | undefined;
  for (let i = 0; i < 12 && !search; i++) {
    const probe = (await jobs()).find(job => job.devT3Probe && !job.reported);
    if (probe) {
      assert.deepEqual(probe.selection!.files, [file]);
      assert.deepEqual(probe.selection!.shard, { files: [file], nvim: false });
      assert.equal(probe.selection!.loadGate, false);
      await finish(probe, flake || probe.head === baseline ? 0 : 1, flake || probe.head === baseline ? passed : failed);
    } else { await f.clock.advance(1000); await drive(f, f.verificationSettled()); }
    const history = ((await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: SearchMessage[] }).messages;
    search = history.find(message => (message.detail as unknown as { event?: string })?.event === 'verification-dev-t3-search');
  }
  assert.ok(search, 'search completes with a General report');
  assert.equal(search.detail.input.run, red.id); assert.equal(search.detail.input.head, redHead); assert.equal(search.detail.input.previousGreenHead, baseline);
  assert.equal(search.detail.files[0]!.result, flake ? 'flake' : 'culprit', JSON.stringify(search.detail));
  assert.equal(search.detail.bugs.length, flake ? 0 : 1);
  const items = ((await f.ui.request({ type: 'task.list' })).value as { items: { id: string; title: string; parent: string; labels: string[] }[] }).items;
  const bugs = items.filter(item => item.labels.includes(`dev-t3-${redHead}`));
  assert.equal(bugs.length, flake ? 0 : 1);
  if (!flake) {
    assert.equal(items.find(item => item.id === bugs[0]!.parent)!.title, 'Bugs');
    const bug = ((await f.ui.request({ type: 'task.view', item: bugs[0]!.id })).value as { item: { body: string } }).item;
    for (const value of [file, red.id, green.id, redHead, baseline, ...search.detail.files[0]!.receipts.map(receipt => receipt.run)]) assert.ok(bug.body.includes(value), value);
    assert.ok(search.to.includes('coord')); assert.ok(search.to.includes('impl'), 'live claimant survives task closure');
  }
  assert.deepEqual(checked, flake ? [redHead] : [redHead, baseline]); assert.deepEqual(removed, checked);
  await f.clock.advance(1000); await drive(f, f.verificationSettled());
  const later = ((await f.ui.request({ type: 'task.list' })).value as { items: { labels: string[] }[] }).items;
  assert.equal(later.filter(item => item.labels.includes(`dev-t3-${redHead}`)).length, flake ? 0 : 1);
});
