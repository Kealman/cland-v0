// T2: follows graph, durable receipts and concurrent merge holds with injected Git; CLI formatting retains its real frame.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { type ItemView } from '../src/tracker/tracker.ts';
import { parseItem } from '../src/tracker/item.ts';
import { epicMergeFiles } from '../src/tracker/epic-surfaces.ts';
import { cland, inProcessSpoke, projectHub, tempProject, until } from './harness.ts';
import { componentProject } from './merge-component-support.ts';

const human = { id: 'human', name: 'human', role: null, human: true };
const resumed = <T>(work: () => T): T => work();

async function fixture(t: TestContext) {
  const f = await componentProject(t);
  const e1 = await f.tracker.create(human, { title: 'Predecessor', kind: 'epic' });
  const e2 = await f.tracker.create(human, { title: 'Follower', kind: 'epic', follows: [e1.id] });
  return { ...f, e1, e2 };
}

test('CLI and in-process MCP maintain canonical follows independently of blockers', async t => {
  const root = await tempProject(t);
  await projectHub(t, root);
  const one = await cland(root, 'task', 'create', 'First', '--kind', 'epic', '--json');
  assert.equal(one.code, 0, one.stderr);
  const two = await cland(root, 'task', 'create', 'Second', '--kind', 'epic', '--follows', 'T-1', '--json');
  assert.equal(two.code, 0, two.stderr);
  const item: ItemView = JSON.parse(two.stdout).item;
  assert.deepEqual(item.follows, ['E-1']);
  assert.deepEqual(parseItem(await readFile(join(root, item.path), 'utf8')).fm.follows, ['E-1']);
  assert.match((await cland(root, 'task', 'view', '2')).stdout, /follows E-1: no task children/);
  const listed: { items: ItemView[] } = JSON.parse((await cland(root, 'task', 'list', '--json')).stdout);
  assert.deepEqual(listed.items.find(i => i.id === item.id)?.blocked_by, []);
  assert.deepEqual(listed.items.find(i => i.id === item.id)?.follows, ['E-1']);
  assert.equal((await cland(root, 'task', 'link', '2', '--unfollow', 'R-1')).code, 0);
  const spoke = await inProcessSpoke(t, { discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => spoke.close());
  await spoke.waitForPresence(['coord']);
  const linked = await spoke.call<{ item: ItemView }>('task.link', { id: '2', follows: ['1'] });
  assert.deepEqual(linked.item.follows, ['E-1']);
  const unlinked = await spoke.call<{ item: ItemView }>('task.link', { id: '2', unfollow: ['T-1'] });
  assert.deepEqual(unlinked.item.follows, []);
  assert.equal((await cland(root, 'task', 'link', '2', '--follows', '1')).code, 0);
  const tools = await spoke.client.listTools();
  assert.ok(tools.tools.find(tool => tool.name === 'task.link')?.inputSchema.properties?.unfollow);
});

test('in-process follows rejects cycles, non-epic endpoints and invalid kind changes', async t => {
  const { tracker, e1, e2 } = await fixture(t);
  const e3 = await tracker.create(human, { title: 'Third', kind: 'epic', follows: [e2.id] });
  const task = await tracker.create(human, { title: 'Leaf' });
  await assert.rejects(tracker.link(human, e1.id, { follows: [e3.id] }), /follows cycle/);
  await assert.rejects(tracker.link(human, e1.id, { follows: [e1.id] }), /reference itself/);
  await assert.rejects(tracker.create(human, { title: 'Bad leaf', follows: [e1.id] }), /only to epics/);
  await assert.rejects(tracker.create(human, { title: 'Bad epic', kind: 'epic', follows: [task.id] }), /must be an epic/);
  await assert.rejects(tracker.link(human, task.id, { follows: [e1.id] }), /only to epics/);
  await assert.rejects(tracker.link(human, e1.id, { follows: [task.id] }), /must be an epic/);
  await assert.rejects(tracker.edit(human, e2.id, { kind: 'task' }), /only to epics/);
  await assert.rejects(tracker.edit(human, e1.id, { kind: 'task' }), /incoming follows/);
  assert.deepEqual(tracker.view(e1.id).follows ?? [], []);
});

test('injected landings satisfy follows and hold only overlapping follower merges', async t => {
  const { root, tracker, facts, e1, e2, ticket, merge } = await fixture(t);
  const first = await ticket(e1.id, 'README.md');
  assert.deepEqual(tracker.view(e2.id).followStatus, [{ id: e1.id, met: false, open: [first.id] }]);
  await merge(first);
  assert.deepEqual(tracker.view(e2.id).followStatus, [{ id: e1.id, met: true, open: [] }]);
  assert.equal(tracker.view(e1.id).state, 'open');
  assert.deepEqual(await epicMergeFiles(root, [first.id], 'dev', undefined, facts.git), ['README.md']);
  const overlap = await ticket(e2.id, 'README.md');
  const before = facts.heads.get('dev')!;
  await assert.rejects(merge(overlap), /merge-hold:.*E-1 demo pending.*README.md/);
  assert.equal(facts.heads.get('dev')!, before);
  const other = await ticket(e2.id, 'GLOSSARY.md');
  await merge(other);
  assert.equal(tracker.view(other.id).state, 'closed');
  await assert.rejects(merge(overlap), /merge-hold/);
});

for (const result of ['clear', 'not clear'] as const) test(`a ${result} hub demo verdict releases the injected merge hold`, async t => {
  const { root, tracker, facts, e1, e2, ticket, merge } = await fixture(t);
  await merge(await ticket(e1.id, 'README.md'));
  const next = await ticket(e2.id, 'README.md');
  await assert.rejects(merge(next), /merge-hold/);
  await tracker.comment({ id: 'qa', name: 'qa', role: 'qa' }, e1.id, 'Demo completed', { verdict: 'qa', result, run: `demo-${result}`, commit: facts.heads.get('dev')! });
  await merge(next);
  assert.equal(tracker.view(next.id).state, 'closed');
});

test('predecessor closure releases the injected merge hold and satisfies an empty epic', async t => {
  const { tracker, e1, e2, ticket, merge } = await fixture(t);
  const empty = await tracker.create(human, { title: 'Empty closed epic', kind: 'epic' });
  await tracker.close(human, empty.id, undefined, resumed, () => {}, 'fixture: no demo needed');
  assert.equal(tracker.followStatus(empty.id).met, true);
  await merge(await ticket(e1.id, 'README.md'));
  const next = await ticket(e2.id, 'README.md');
  await assert.rejects(merge(next), /merge-hold/);
  await tracker.close(human, e1.id, undefined, resumed, () => {}, 'fixture: exercise closed predecessor');
  await merge(next);
  assert.equal(tracker.view(next.id).state, 'closed');
});

test('plain task view shows follows met after reopening the tracker store', async t => {
  const { root, tracker, facts, stop, e1, e2, ticket, merge } = await fixture(t);
  await merge(await ticket(e1.id, 'README.md'));
  await stop();
  await projectHub(t, root, {}, { git: facts.git });
  const view = await cland(root, 'task', 'view', e2.id);
  assert.equal(view.code, 0, view.stderr);
  assert.match(view.stdout, /follows E-1: met/);
  const listed = await cland(root, 'task', 'list', '--json');
  const items: ItemView[] = JSON.parse(listed.stdout).items;
  assert.deepEqual(items.find(i => i.id === e2.id)?.follows, ['E-1']);
  assert.deepEqual(items.find(i => i.id === e2.id)?.blocked_by, []);
});

for (const change of ['follows', 'verdict'] as const) test(`injected final surface lookup revalidates a concurrent ${change} change before publication`, async t => {
  const { tracker, facts, e1, e2, ticket, merge, merges } = await fixture(t);
  await merge(await ticket(e1.id, 'README.md'));
  const e3 = change === 'follows' ? await tracker.create(human, { title: 'Another predecessor', kind: 'epic' }) : undefined;
  if (e3) await merge(await ticket(e3.id, 'GLOSSARY.md'));
  const next = await ticket(e2.id, 'GLOSSARY.md');
  const reviewer = { id: 'reviewer', name: 'reviewer', role: 'reviewer' };
  await tracker.comment(reviewer, next.id, 'Source clear', { verdict: 'review', result: 'clear', run: 'before-barrier', scope: 'full', commit: facts.heads.get(next.branch!)! });
  const before = [...facts.heads];
  const release = Promise.withResolvers<void>();
  let reached = false, lookups = 0;
  facts.beforeSurface = async () => { if (++lookups === 2) { reached = true; await release.promise; } };
  let pending: Promise<unknown> | undefined;
  try {
    pending = merges.merge(next.id, human, resumed);
    // Attach the rejection handler immediately; assertion waits until after the concurrent write.
    const rejected = assert.rejects(pending, /merge-changed:.*(?:lane|gate).*changed/);
    await until(() => reached, { what: 'foreground final surface read paused' });
    if (change === 'follows') await tracker.link(human, e2.id, { follows: [e3!.id] });
    else await tracker.comment(reviewer, next.id, 'New blocking finding', { verdict: 'review', result: 'not clear', run: 'during-barrier', scope: 'full', commit: facts.heads.get(next.branch!)! });
    release.resolve();
    await rejected;
    assert.deepEqual([...facts.heads], before, 'concurrent gate edits leave all refs unchanged');
    if (change === 'follows') await assert.rejects(merge(next), /merge-hold:.*E-4 demo pending.*GLOSSARY.md/);
  } finally {
    release.resolve();
    await pending?.catch(() => {});
  }
});
