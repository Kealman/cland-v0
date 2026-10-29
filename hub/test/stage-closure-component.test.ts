// T2: plan reads and stage advancement through an in-process hub; Git facts are injected.
// Reopening the tracker proves persistence without a hub process lifecycle.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Tracker, type ItemView } from '../src/tracker/tracker.ts';
import type { StageCover } from '../src/hub/suites.ts';
import { connectWsUi, eventually, startHub, tempProject } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { planStageHub, PlanGit, seedPlanStageCover } from './plan-stage-fixture.ts';
import { connectUi, inProcessSpoke } from './harness.ts';

test('stage QA recorded after restart stays pending then current with restored two-platform covers', async t => {
  const root = await tempProject(t);
  const facts = new PlanGit();
  await mkdir(join(root, '.cland'));
  await seedPlanStageCover(root, facts.head);
  const first = await planStageHub(t, root, facts);
  let ui = await connectUi(t, first.discovery);
  const create = async (kind: string, title: string, parent?: string) => {
    const r = await ui.request({ type: 'task.create', kind, title, parent, ...(kind === 'task' ? { size: 'S' } : {}) });
    assert.equal(r.ok, true, r.error);
    return (r.value as { item: ItemView }).item;
  };
  const epic = await create('epic', 'Restart QA'), child = await create('task', 'Evidence only', epic.id);
  assert.equal((await ui.request({ type: 'task.plan', item: epic.id, op: 'set', yaml: JSON.stringify({ stages: [
    { name: 'build', qa: { scope: 'affected', when: 'after-stage' }, lanes: [[child.id]] },
  ] }) })).ok, true);
  assert.equal((await ui.request({ type: 'task.close', item: child.id })).ok, true);
  const read = async () => {
    const r = await ui.request({ type: 'task.plan', item: epic.id, op: 'show' });
    assert.equal(r.ok, true, r.error);
    return (r.value as { stages: NonNullable<ItemView['stages']> }).stages[0]!;
  };
  const before = await eventually('both covers are counted before restart without a QA closure', async () => {
    const stage = await read();
    return stage.cover?.linux && stage.cover.macos && !stage.cover.pending?.length ? stage : undefined;
  });
  assert.deepEqual(before.cover!.missing, []);
  assert.equal(before.state, 'open', 'no prior QA closure can supply the restart proof');
  ui.close(); await first.stop();
  const tree = Promise.withResolvers<string>();
  let treeStarted = false;
  onCleanup(t, () => tree.resolve('f'.repeat(40)));
  const second = await planStageHub(t, root, facts, { stageTree: async () => { treeStarted = true; return tree.promise; } });
  ui = await connectUi(t, second.discovery);
  const qa = await inProcessSpoke(t, { discover: true, cwd: root, name: 'qa-restart', role: 'qa' });
  onCleanup(t, () => qa.close());
  await eventually('restored cover tree lookup is held', async () => { await read(); return treeStarted ? true : undefined; });
  const verdict = await qa.call<{ ok: boolean; error?: string }>('task.comment', {
    id: epic.id, verdict: 'qa', result: 'clear', run: 'post-restart', stage: 'build',
  });
  assert.equal(verdict.ok, true, verdict.error);
  const pending = await read();
  assert.deepEqual(pending.cover!.missing, []);
  assert.deepEqual(pending.cover!.pending, ['Linux droplet', 'macOS']);
  assert.equal(pending.verdict!.current, undefined, 'unresolved restored evidence is never recorded as stale');
  tree.resolve('f'.repeat(40));
  const after = await eventually('post-restart QA and original covers close the stage', async () => {
    const stage = await read(); return stage.state === 'closed' ? stage : undefined;
  });
  assert.deepEqual(after.cover, before.cover);
  assert.equal(after.verdict!.current, true);
  assert.equal(after.verdict!.run, 'post-restart');
});

test('publication landings survive tracker reopen and require covers containing the published dev merge', async t => {
  const root = await tempProject(t);
  const landing = 'a'.repeat(40), head = 'b'.repeat(40), tree = 'c'.repeat(40), before = 'd'.repeat(40);
  const options = { root, db: join(root, '.cland/hub.db'),
    git: async (args: string[]) => {
      if (args[0] === 'for-each-ref') return `${head} refs/heads/dev`;
      if (args[0] === 'rev-parse') return args.at(-1)!.replace(/\^\{commit\}$/, '');
      if (args[0] === 'merge-base' && args[2] === landing && args[3] === before) return null;
      return '';
    }, readBase: async () => 'dev', stageTree: async () => tree,
    scheduleTips: () => ({ poke() {}, stop() {} }),
  };
  let tracker = new Tracker(options);
  tracker.start(); onCleanup(t, () => tracker.stop());
  const actor = { id: 'human', name: 'human', role: null };
  const epic = await tracker.create(actor, { kind: 'epic', title: 'Published stage' });
  const child = await tracker.create(actor, { size: 'S', title: 'Published', branch: 'marketing', parent: epic.id });
  await tracker.setPlan(actor, epic.id, JSON.stringify({ stages: [
    { name: 'marketing', qa: { scope: 'none', when: 'after-stage' }, lanes: [[child.id]] },
  ] }));
  tracker.recordPublication(child.id, { branch: 'marketing', tip: 'e'.repeat(40), commit: landing, base: 'dev' });
  assert.equal((await tracker.viewAsync(child.id)).merged, false, 'publication leaves the item open');
  assert.equal(tracker.mergeReceipt(child.id), null, 'publication does not create merge recovery');
  await tracker.close(actor, child.id);
  await tracker.stop();
  tracker = new Tracker(options); tracker.start();
  await tracker.refreshFreshness();
  assert.equal((await tracker.viewAsync(child.id)).merged, true);
  assert.equal(tracker.mergeReceipt(child.id), null);
  let covers: StageCover[] = [
    { id: 'linux-before', head: before, tree, platform: 'Linux droplet' },
    { id: 'mac', head, tree, platform: 'macOS' },
  ];
  tracker.useVerify(() => null, () => covers);
  const stage = async () => (await tracker.viewAsync(epic.id)).stages![0]!;
  const uncontained = await eventually('old cover is rejected after ancestry resolves', async () => {
    const value = await stage();
    return value.cover?.tree === tree && !value.cover.pending?.length ? value : undefined;
  });
  assert.equal(uncontained.merged, 1);
  assert.equal(uncontained.state, 'open');
  assert.deepEqual(uncontained.cover?.missing, ['Linux droplet']);
  covers = [covers[1]!, { id: 'linux', head, tree, platform: 'Linux droplet' }];
  const closed = await eventually('matching cover pair closes the published stage', async () => {
    const value = await stage(); return value.state === 'closed' ? value : undefined;
  });
  assert.equal(closed.merged, 1);
  assert.deepEqual(closed.cover, { tree, missing: [], linux: 'linux', macos: 'mac' });
});

test('a pending stage build tree keeps QA currency unknown until a mismatching tree is observed', async t => {
  const root = await tempProject(t);
  const head = 'a'.repeat(40), coveredTree = 'b'.repeat(40), actualTree = 'c'.repeat(40);
  const tree = Promise.withResolvers<string>();
  let readingTree = false;
  let coverReads = 0;
  onCleanup(t, () => tree.resolve(actualTree));
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'),
    git: async args => {
      if (args[0] === 'rev-parse' && args.at(-1) === `${'d'.repeat(40)}^{commit}`) coverReads++;
      return args[0] === 'for-each-ref' ? `${head} refs/heads/dev` : args[0] === 'rev-parse' ? head : '';
    },
    readBase: async () => 'dev', stageTree: async () => { readingTree = true; return tree.promise; },
    scheduleTips: () => ({ poke() {}, stop() {} }),
  });
  tracker.start(); onCleanup(t, () => tracker.stop());
  const actor = { id: 'human', name: 'human', role: null };
  const epic = await tracker.create(actor, { kind: 'epic', title: 'Pending build' });
  const child = await tracker.create(actor, { size: 'S', title: 'Landed', parent: epic.id });
  await tracker.setPlan(actor, epic.id, JSON.stringify({ stages: [{ name: 'build', qa: { scope: 'affected', when: 'after-stage' }, lanes: [[child.id]] }] }));
  await tracker.close(actor, child.id);
  tracker.recordMerge(child.id, { branch: 't/landed', tip: head, commit: head, base: 'dev' });
  tracker.useVerify(() => null, () => [
    { id: 'linux', head: 'd'.repeat(40), tree: coveredTree, platform: 'Linux droplet' },
    { id: 'mac', head, tree: coveredTree, platform: 'macOS' },
  ]);
  await tracker.refreshFreshness();
  await tracker.comment({ id: 'qa-session', name: 'qa', role: 'qa' }, epic.id, '', { verdict: 'qa', result: 'clear', run: 'qa', stage: 'build' });
  const stage = async () => (await tracker.viewAsync(epic.id)).stages![0]!;
  await eventually('stage tree lookup entered', () => readingTree ? true : undefined);
  const pending = await stage();
  assert.deepEqual(pending.cover, { tree: null, missing: [], pending: ['Linux droplet', 'macOS'] });
  assert.equal(pending.verdict!.current, undefined);
  assert.equal(pending.state, 'open');
  tree.resolve(actualTree);
  const missing = await eventually('observed build tree rejects both covers', async () => {
    const value = await stage();
    return value.cover?.tree === actualTree ? value : undefined;
  });
  assert.deepEqual(missing.cover, { tree: actualTree, missing: ['Linux droplet', 'macOS'] });
  assert.equal(missing.verdict!.current, false);
  assert.equal(missing.state, 'open');
  assert.equal(coverReads, 0, 'a cover with an unobserved then mismatching tree never requests ancestry');
});

for (const contained of [true, false]) test(`pending landing ancestry holds advancement until it resolves ${contained}`, async t => {
  const root = await tempProject(t);
  const landing = 'a'.repeat(40), head = 'b'.repeat(40), tree = 'c'.repeat(40);
  const ancestry = Promise.withResolvers<string | null>();
  let checkingLanding = false;
  onCleanup(t, () => ancestry.resolve(contained ? '' : null));
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'),
    git: async args => {
      if (args[0] === 'for-each-ref') return `${head} refs/heads/dev`;
      if (args[0] === 'rev-parse') return args.at(-1)!.replace(/\^\{commit\}$/, '');
      if (args[0] === 'merge-base' && args[2] === landing && args[3] === head) { checkingLanding = true; return ancestry.promise; }
      return '';
    }, readBase: async () => 'dev', stageTree: async () => tree,
    scheduleTips: () => ({ poke() {}, stop() {} }),
  });
  tracker.start(); onCleanup(t, () => tracker.stop());
  const actor = { id: 'human', name: 'human', role: null };
  const epic = await tracker.create(actor, { kind: 'epic', title: 'Pending landing' });
  const child = await tracker.create(actor, { size: 'S', title: 'Landed', parent: epic.id });
  const next = await tracker.create(actor, { size: 'S', title: 'Next', parent: epic.id });
  await tracker.setPlan(actor, epic.id, JSON.stringify({ stages: [
    { name: 'build', qa: { scope: 'none', when: 'after-stage' }, lanes: [[child.id]] },
    { name: 'next', qa: { scope: 'none', when: 'per-item' }, lanes: [[next.id]] },
  ] }));
  await tracker.close(actor, child.id);
  tracker.recordMerge(child.id, { branch: 't/landed', tip: landing, commit: landing, base: 'dev' });
  tracker.useVerify(() => null, () => [
    { id: 'linux', head, tree, platform: 'Linux droplet' },
    { id: 'mac', head, tree, platform: 'macOS' },
  ]);
  await tracker.refreshFreshness();
  const stage = async () => (await tracker.viewAsync(epic.id)).stages![0]!;
  const pending = await eventually('landing check entered and build tree resolved', async () => {
    const value = await stage();
    return checkingLanding && value.cover?.tree === tree ? value : undefined;
  });
  assert.deepEqual(pending.cover, { tree, missing: [], pending: ['Linux droplet'], macos: 'mac' });
  assert.equal(pending.state, 'open');
  assert.equal((await tracker.viewAsync(next.id)).status, 'backlog');
  ancestry.resolve(contained ? '' : null);
  const settled = await eventually('landing ancestry settles platform evidence', async () => {
    const value = await stage();
    return !value.cover?.pending?.length ? value : undefined;
  });
  assert.deepEqual(settled.cover, contained ? { tree, missing: [], linux: 'linux', macos: 'mac' } : { tree, missing: ['Linux droplet'], macos: 'mac' });
  assert.equal(settled.state, contained ? 'closed' : 'open');
  await eventually('next stage follows resolved landing evidence', async () =>
    (await tracker.viewAsync(next.id)).status === (contained ? 'planned' : 'backlog') ? true : undefined);
});

test('a covered stage records its tested build durably while later stages advance on their own cover', async t => {
  const root = await tempProject(t);
  const tested = 'a'.repeat(40), later = 'b'.repeat(40);
  const testedTree = 'c'.repeat(40), laterTree = 'd'.repeat(40);
  let head = tested;
  let ancestryStarted = false;
  const ancestry = Promise.withResolvers<string | null>();
  onCleanup(t, () => ancestry.resolve(''));
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
        if (args[3] === later) { ancestryStarted = true; return ancestry.promise; }
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
  await eventually('later dev ancestry read entered', () => ancestryStarted ? true : undefined);
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
  let ancestryStarted = false;
  const ancestry = Promise.withResolvers<string | null>();
  onCleanup(t, () => ancestry.resolve(''));
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'),
    git: async args => {
      if (args[0] === 'for-each-ref') return `${head} refs/heads/dev`;
      if (args[0] === 'rev-parse') return tested;
      if (args[0] === 'merge-base') {
        if (args[3] === later) { ancestryStarted = true; return ancestry.promise; }
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
  await eventually('later QA build ancestry read entered', () => ancestryStarted ? true : undefined);
  try {
    assert.equal((await stage()).state, 'closed', 'a recorded QA closure also survives pending ancestry');
  } finally { ancestry.resolve(''); }
  head = tested; await tracker.refreshFreshness();
  await tracker.comment(qa, epic.id, '', { verdict: 'qa', result: 'not clear', run: 'qa-rejected', stage: 'build' });
  assert.equal((await stage()).state, 'open', 'a later QA refusal overrides recorded cover');
});

test('forced closure recompute on copied tracker skips historical covers and preserves recorded closure', async t => {
  const { copyPinnedTracker } = await import('./pinned-tracker.ts');
  const root = await tempProject(t);
  await copyPinnedTracker(root);
  const head = 'a'.repeat(40), tree = 'b'.repeat(40);
  const calls = new Set<string>();
  const covers: StageCover[] = Array.from({ length: 1200 }, (_, n) => ({
    id: `historical-${n}`, head: (n + 1).toString(16).padStart(40, '0'), tree,
    platform: 'Linux droplet',
  }));
  covers.push({ id: 'latest', head: 'c'.repeat(40), tree, platform: 'Linux droplet' }, { id: 'mac', head, tree, platform: 'macOS' });
  const options = { root, db: join(root, '.cland/hub.db'),
    git: async (args: string[]) => {
      if (args[0] === 'for-each-ref') return `${head} refs/heads/dev`;
      if (args[0] === 'rev-parse') return args.at(-1)!.replace(/\^\{commit\}$/, '');
      if (args[0] === 'merge-base') {
        calls.add(`${args[2]}:${args[3]}`);
        if (args[2] !== 'c'.repeat(40)) return null;
      }
      return '';
    }, readBase: async () => 'dev', stageTree: async () => tree,
    scheduleTips: () => ({ poke() {}, stop() {} }),
  };
  let tracker = new Tracker(options);
  tracker.start(); onCleanup(t, () => tracker.stop());
  const actor = { id: 'human', name: 'human', role: null };
  const epic = await tracker.create(actor, { kind: 'epic', title: 'Recompute history' });
  const child = await tracker.create(actor, { title: 'Evidence', size: 'S', parent: epic.id });
  await tracker.setPlan(actor, epic.id, JSON.stringify({ stages: [
    { name: 'build', qa: { scope: 'none', when: 'after-stage' }, lanes: [[child.id]] },
  ] }));
  await tracker.close(actor, child.id);
  // No closure checkpoint exists: supply historical covers only after setup.
  const started = performance.now();
  tracker.useVerify(() => null, () => covers);
  await tracker.refreshFreshness();
  const closed = await eventually('forced recompute records its selected cover pair', async () => {
    const stage = (await tracker.viewAsync(epic.id)).stages![0]!;
    return stage.closure ? stage : undefined;
  });
  const elapsed = performance.now() - started;
  assert.deepEqual(closed.cover, { tree, missing: [], linux: 'latest', macos: 'mac' });
  assert.equal(calls.size, 1, 'only the newest deciding cover needs ancestry');
  t.diagnostic(`copied tracker recompute ${elapsed.toFixed(1)} ms; ${calls.size} ancestry pair; injected Git, ${process.platform}/${process.arch}`);
  await tracker.stop(); calls.clear();
  tracker = new Tracker(options); tracker.start();
  tracker.useVerify(() => null, () => covers);
  await tracker.refreshFreshness();
  const restored = (await tracker.viewAsync(epic.id)).stages![0]!;
  assert.deepEqual(restored.closure, closed.closure);
  assert.deepEqual(restored.cover, closed.cover);
  await tracker.stop();
  assert.ok(calls.size <= 1, 'saved closure only rechecks its recorded head');
});

test('open stage results match the full recompute across paired, rejected and incomplete history', async t => {
  const root = await tempProject(t);
  const head = 'a'.repeat(40), expected = 'b'.repeat(40), other = 'c'.repeat(40);
  const valid = new Set<string>();
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db'),
    git: async args => {
      if (args[0] === 'for-each-ref') return `${head} refs/heads/dev`;
      if (args[0] === 'rev-parse') return args.at(-1)!.replace(/\^\{commit\}$/, '');
      if (args[0] === 'merge-base') return valid.has(args[2]!) ? '' : null;
      return '';
    }, readBase: async () => 'dev', stageTree: async () => expected,
    scheduleTips: () => ({ poke() {}, stop() {} }),
  });
  tracker.start(); onCleanup(t, () => tracker.stop());
  const actor = { id: 'human', name: 'human', role: null };
  const epic = await tracker.create(actor, { kind: 'epic', title: 'Differential recompute' });
  const child = await tracker.create(actor, { title: 'Still open', size: 'S', parent: epic.id });
  await tracker.setPlan(actor, epic.id, JSON.stringify({ stages: [
    { name: 'build', qa: { scope: 'none', when: 'after-stage' }, lanes: [[child.id]] },
  ] }));
  await tracker.refreshFreshness();
  // Previous eager algorithm with independently known, fully settled Git facts.
  const fullRecompute = (covers: StageCover[]) => {
    const eligible = covers.filter(c => c.platform === 'Linux droplet' && valid.has(c.head));
    const pair = eligible.findLast(linux => covers.some(mac => mac.platform === 'macOS' && mac.tree === linux.tree));
    const tree = pair?.tree ?? expected;
    const linux = pair ?? eligible.findLast(c => c.tree === tree);
    const mac = covers.findLast(c => c.platform === 'macOS' && c.tree === tree);
    return { tree, missing: [...(!linux ? ['Linux droplet'] : []), ...(!mac ? ['macOS'] : [])],
      ...(linux ? { linux: linux.id } : {}), ...(mac ? { macos: mac.id } : {}) };
  };
  for (let scenario = 0; scenario < 16; scenario++) {
    const covers: StageCover[] = [];
    for (let n = 0; n < 4; n++) {
      const commit = (scenario * 4 + n + 1).toString(16).padStart(40, '0');
      if (scenario & (1 << n)) valid.add(commit);
      covers.push({ id: `linux-${scenario}-${n}`, head: commit, tree: n % 2 ? other : expected, platform: 'Linux droplet' });
    }
    if (scenario % 3) covers.push({ id: 'mac-expected', head, tree: expected, platform: 'macOS' });
    if (scenario % 2) covers.push({ id: 'mac-other', head, tree: other, platform: 'macOS' });
    tracker.useVerify(() => null, () => covers);
    const actual = await eventually(`scenario ${scenario} settles all deciding evidence`, async () => {
      const stage = (await tracker.viewAsync(epic.id)).stages![0]!;
      return stage.cover?.tree && !stage.cover.pending?.length ? stage : undefined;
    });
    assert.equal(actual.state, 'open');
    assert.deepEqual(actual.cover, fullRecompute(covers), `scenario ${scenario}`);
  }
});
