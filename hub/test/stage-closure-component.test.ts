// T2: plan reads and stage advancement through an in-process hub; Git facts are injected.
// Reopening the tracker proves persistence without a hub process lifecycle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { Tracker, type ItemView } from '../src/tracker/tracker.ts';
import type { StageCover } from '../src/hub/suites.ts';
import { connectWsUi, eventually, startHub, tempProject } from './harness.ts';

test('a covered stage records its tested build durably while later stages advance on their own cover', async t => {
  const root = await tempProject(t);
  const tested = 'a'.repeat(40), later = 'b'.repeat(40);
  const testedTree = 'c'.repeat(40), laterTree = 'd'.repeat(40);
  let head = tested;
  const ancestryStarted = Promise.withResolvers<void>();
  const ancestry = Promise.withResolvers<string | null>();
  t.after(() => ancestry.resolve(''));
  let covers: StageCover[] = [
    { id: 'linux-stage-1', head: tested, tree: testedTree, platform: 'Linux droplet' },
    { id: 'mac-stage-1', head: tested, tree: testedTree, platform: 'macOS' },
  ];
  const actor = { id: 'human', name: 'human', role: null };
  const options = {
    root, db: join(root, '.cland/hub.db'),
    git: async (args: string[]) => {
      if (args[0] === 'for-each-ref') return `${head} refs/heads/dev`;
      if (args[0] === 'rev-parse') return args.at(-1)!.replace(/\^\{commit\}$/, '');
      if (args[0] === 'merge-base') {
        if (args[3] === later) { ancestryStarted.resolve(); return ancestry.promise; }
        return '';
      }
      return null;
    },
    readBase: async () => 'dev',
    stageTree: async (build: string) => build === tested ? testedTree : laterTree,
    scheduleTips: () => ({ poke() {}, stop() {} }),
  };
  let tracker = new Tracker(options);
  tracker.start();
  t.after(() => tracker.stop());
  const epic = await tracker.create(actor, { kind: 'epic', title: 'Stage closure' });
  const first = await tracker.create(actor, { size: 'S', title: 'First', parent: epic.id });
  const second = await tracker.create(actor, { size: 'S', title: 'Second', parent: epic.id });
  const plan = { stages: [
    { name: 'first', qa: { scope: 'none', when: 'after-stage' }, lanes: [[first.id]] },
    { name: 'second', qa: { scope: 'none', when: 'after-stage' }, lanes: [[second.id]] },
  ] };
  const hub = await startHub({ tracker });
  let hubClosed = false;
  t.after(async () => { if (!hubClosed) await hub.close(); });
  tracker.useVerify(() => null, () => covers);
  const ui = await connectWsUi(t, hub);
  const set = await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: JSON.stringify(plan) });
  assert.equal(set.ok, true, set.error);
  await tracker.close(actor, first.id);
  tracker.recordMerge(first.id, { branch: 't/first', tip: tested, commit: tested, base: 'dev' });
  await tracker.refreshFreshness();
  const read = async () => {
    const response = await ui.request({ type: 'task.plan', item: epic.id, op: 'show' });
    assert.equal(response.ok, true, response.error);
    return (response.value as { stages: NonNullable<ItemView['stages']> }).stages;
  };
  const closed = await eventually('both receipts close first stage', async () => {
    const stages = await read();
    return stages[0]?.state === 'closed' ? stages[0] : undefined;
  });
  const closure = { head: tested, tree: testedTree, linux: 'linux-stage-1', macos: 'mac-stage-1' };
  assert.deepEqual(closed.cover, { tree: testedTree, missing: [], linux: 'linux-stage-1', macos: 'mac-stage-1' });
  head = later;
  covers = [];
  await tracker.refreshFreshness();
  await ancestryStarted.promise;
  try {
    assert.equal((await read())[0]!.state, 'closed', 'pending ancestry and retired suite history cannot reopen a completed stage');
  } finally { ancestry.resolve(''); }
  // Completed suite history is not needed to retain an already recorded closure.
  ui.close(); await hub.close(); hubClosed = true; await tracker.stop();
  tracker = new Tracker(options); tracker.start();
  tracker.useVerify(() => null, () => covers);
  await tracker.refreshFreshness();
  const restored = await eventually('later stage has its own resolved tree', async () => {
    const view = await tracker.viewAsync(epic.id);
    return view.stages?.[1]?.cover?.tree === laterTree ? view.stages : undefined;
  });
  assert.deepEqual(restored.map(stage => stage.state), ['closed', 'open']);
  assert.deepEqual(restored[0]!.cover, { tree: testedTree, missing: [], linux: 'linux-stage-1', macos: 'mac-stage-1' });
  assert.deepEqual(restored[0]!.closure, closure);
  assert.deepEqual(restored[1]!.cover, { tree: laterTree, missing: ['Linux droplet', 'macOS'] });
  const joined = await tracker.create(actor, { size: 'S', title: 'Joined second stage', parent: epic.id });
  plan.stages[1]!.lanes[0]!.push(joined.id);
  await tracker.setPlan(actor, epic.id, JSON.stringify(plan));
  await eventually('recorded closure advances a new second-stage item after reopen', async () =>
    (await tracker.viewAsync(joined.id)).status === 'planned' ? true : undefined);
});

test('recorded cover cannot close a changed stage or a build removed from dev ancestry', async t => {
  // Rule permutations use the tracker directly; the first test supplies the frame proof.
  const root = await tempProject(t);
  const tested = 'a'.repeat(40), before = 'b'.repeat(40), tree = 'c'.repeat(40), later = 'd'.repeat(40);
  let head = tested;
  const ancestryStarted = Promise.withResolvers<void>();
  const ancestry = Promise.withResolvers<string | null>();
  t.after(() => ancestry.resolve(''));
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'),
    git: async args => {
      if (args[0] === 'for-each-ref') return `${head} refs/heads/dev`;
      if (args[0] === 'rev-parse') return tested;
      if (args[0] === 'merge-base') {
        if (args[3] === later) { ancestryStarted.resolve(); return ancestry.promise; }
        return args[3] === before ? null : '';
      }
      return null;
    }, readBase: async () => 'dev', stageTree: async () => tree,
    scheduleTips: () => ({ poke() {}, stop() {} }),
  });
  tracker.start(); t.after(() => tracker.stop());
  const actor = { id: 'human', name: 'human', role: null };
  const epic = await tracker.create(actor, { kind: 'epic', title: 'Closure invalidation' });
  const child = await tracker.create(actor, { size: 'S', title: 'Landed', parent: epic.id });
  const plan = { stages: [{ name: 'build', qa: { scope: 'none', when: 'after-stage' }, lanes: [[child.id]] }] };
  await tracker.setPlan(actor, epic.id, JSON.stringify(plan));
  await tracker.close(actor, child.id);
  tracker.recordMerge(child.id, { branch: 't/landed', tip: tested, commit: tested, base: 'dev' });
  let covers: StageCover[] = [
    { id: 'linux', head: tested, tree, platform: 'Linux droplet' },
    { id: 'mac', head: tested, tree, platform: 'macOS' },
  ];
  tracker.useVerify(() => null, () => covers);
  await tracker.refreshFreshness();
  const stage = async () => (await tracker.viewAsync(epic.id)).stages![0]!;
  await eventually('stage closes before invalidation', async () => (await stage()).state === 'closed' ? true : undefined);
  covers = [];
  head = before; await tracker.refreshFreshness();
  await eventually('confirmed rollback opens recorded stage', async () => (await stage()).state === 'open' ? true : undefined);
  assert.equal((await stage()).closure?.head, tested, 'rollback retains the historical record');
  head = tested; await tracker.refreshFreshness();
  assert.equal((await stage()).state, 'closed');
  plan.stages[0]!.qa.scope = 'affected';
  await tracker.setPlan(actor, epic.id, JSON.stringify(plan));
  assert.equal((await stage()).state, 'open');
  assert.equal((await stage()).closure, undefined, 'changed policy cannot borrow the old closure');
  covers = [
    { id: 'linux', head: tested, tree, platform: 'Linux droplet' },
    { id: 'mac', head: tested, tree, platform: 'macOS' },
  ];
  const qa = { id: 'qa-session', name: 'qa', role: 'qa' };
  await tracker.comment(qa, epic.id, '', { verdict: 'qa', result: 'clear', run: 'qa-build', stage: 'build' });
  await eventually('new QA policy closes with its own verdict', async () => (await stage()).state === 'closed' ? true : undefined);
  covers = [];
  head = later; await tracker.refreshFreshness();
  await ancestryStarted.promise;
  try {
    assert.equal((await stage()).state, 'closed', 'a recorded QA closure also survives pending ancestry');
  } finally { ancestry.resolve(''); }
  head = tested; await tracker.refreshFreshness();
  await tracker.comment(qa, epic.id, '', { verdict: 'qa', result: 'not clear', run: 'qa-rejected', stage: 'build' });
  assert.equal((await stage()).state, 'open', 'a later QA refusal overrides recorded cover');
});
