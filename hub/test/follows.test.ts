import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Tracker, type ItemView } from '../src/tracker/tracker.ts';
import { parseItem } from '../src/tracker/item.ts';
import { TaskWorktrees } from '../src/hub/worktrees.ts';
import { TaskMerges } from '../src/hub/merge.ts';
import { epicMergeFiles } from '../src/tracker/epic-surfaces.ts';
import { preparedProject } from './prepared-project.ts';
import { cland, eventually, spawnSpoke, startDaemon, tempProject } from './harness.ts';

const human = { id: 'human', name: 'human', role: null, human: true };
const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const resumed = <T>(work: () => T): T => work();

async function fixture(t: TestContext) {
  const root = await preparedProject(t);
  const tracker = new Tracker({ root, db: join(root, '.cland/hub.db') });
  const worktrees = new TaskWorktrees({ tracker });
  const merges = new TaskMerges(tracker, worktrees, () => {});
  t.after(async () => { merges.stop(); await tracker.stop(); });
  const e1 = await tracker.create(human, { title: 'Predecessor', kind: 'epic' });
  const e2 = await tracker.create(human, { title: 'Follower', kind: 'epic', follows: [e1.id] });
  async function ticket(parent: string, file: string) {
    const item = await tracker.create(human, { title: `Change ${file}`, parent });
    const { worktree } = await worktrees.afterClaim(item.id, null);
    assert.ok(worktree);
    await writeFile(join(worktree.path, file), `${item.id}\n`);
    git(worktree.path, 'add', file); git(worktree.path, 'commit', '-qm', 'Task change');
    return { ...item, branch: worktree.branch };
  }
  const merge = (item: ItemView) => merges.merge(item.id, human, resumed, 'fixture: exercise lane hold independently of verdict gate');
  return { root, tracker, e1, e2, ticket, merge, merges };
}

test('CLI and MCP set and remove canonical follows independently of blockers', async t => {
  const root = await tempProject(t);
  await startDaemon(t, root);
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
  const spoke = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
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

test('follows rejects cycles, non-epic endpoints and kind changes that break edges', async t => {
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

test('follow becomes met on the last merge and blocks only overlapping follower merges', async t => {
  const { root, tracker, e1, e2, ticket, merge } = await fixture(t);
  const first = await ticket(e1.id, 'README.md');
  assert.deepEqual(tracker.view(e2.id).followStatus, [{ id: e1.id, met: false, open: [first.id] }]);
  await merge(first);
  assert.deepEqual(tracker.view(e2.id).followStatus, [{ id: e1.id, met: true, open: [] }]);
  assert.equal(tracker.view(e1.id).state, 'open');
  assert.deepEqual(await epicMergeFiles(root, [first.id]), ['README.md']);
  const overlap = await ticket(e2.id, 'README.md');
  const before = git(root, 'rev-parse', 'dev');
  await assert.rejects(merge(overlap), /merge-hold:.*E-1 demo pending.*README.md/);
  assert.equal(git(root, 'rev-parse', 'dev'), before);
  const other = await ticket(e2.id, 'other.txt');
  await merge(other);
  assert.equal(tracker.view(other.id).state, 'closed');
  await assert.rejects(merge(overlap), /merge-hold/);
});

for (const result of ['clear', 'not clear'] as const) test(`a ${result} hub demo verdict releases the merge hold`, async t => {
  const { root, tracker, e1, e2, ticket, merge } = await fixture(t);
  await merge(await ticket(e1.id, 'README.md'));
  const next = await ticket(e2.id, 'README.md');
  await assert.rejects(merge(next), /merge-hold/);
  await tracker.comment({ id: 'qa', name: 'qa', role: 'qa' }, e1.id, 'Demo completed', { verdict: 'qa', result, run: `demo-${result}`, commit: git(root, 'rev-parse', 'dev') });
  await merge(next);
  assert.equal(tracker.view(next.id).state, 'closed');
});

test('closing the predecessor releases the merge hold and an empty closed epic is met', async t => {
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

test('plain task view shows follows met after the last merge across a hub restart', async t => {
  const { root, tracker, e1, e2, ticket, merge } = await fixture(t);
  await merge(await ticket(e1.id, 'README.md'));
  await tracker.stop();
  await startDaemon(t, root);
  const view = await cland(root, 'task', 'view', e2.id);
  assert.equal(view.code, 0, view.stderr);
  assert.match(view.stdout, /follows E-1: met/);
  const listed = await cland(root, 'task', 'list', '--json');
  const items: ItemView[] = JSON.parse(listed.stdout).items;
  assert.deepEqual(items.find(i => i.id === e2.id)?.follows, ['E-1']);
  assert.deepEqual(items.find(i => i.id === e2.id)?.blocked_by, []);
});

test('epic merge surfaces use trailers and retain rename and deletion paths exactly', async t => {
  const root = await preparedProject(t, 'repository');
  git(root, 'branch', '-m', 'dev');
  await rename(join(root, 'README.md'), join(root, 'renamed.txt'));
  const unusual = ' spaced\nname.txt';
  await writeFile(join(root, unusual), 'present');
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'Rename\n\nItem: T-9');
  const renameHead = git(root, 'rev-parse', 'HEAD');
  await rm(join(root, 'renamed.txt'));
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'Delete\n\nItem: E-9');
  await writeFile(join(root, 'unrelated.txt'), 'other');
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'Mention in body\n\nItem: T-9\n\nThis paragraph is not a trailer.');
  assert.deepEqual(await epicMergeFiles(root, ['T-9']), [unusual, 'README.md', 'renamed.txt']);
  assert.deepEqual(await epicMergeFiles(root, ['T-9'], renameHead), [unusual, 'README.md', 'renamed.txt']);
  assert.deepEqual(await epicMergeFiles(root, []), []);
});

for (const change of ['follows', 'verdict'] as const) test(`final surface lookup revalidates a concurrent ${change} change before publication`, async t => {
  const { root, tracker, e1, e2, ticket, merge, merges } = await fixture(t);
  await merge(await ticket(e1.id, 'README.md'));
  const e3 = change === 'follows' ? await tracker.create(human, { title: 'Another predecessor', kind: 'epic' }) : undefined;
  if (e3) await merge(await ticket(e3.id, 'protected.txt'));
  const next = await ticket(e2.id, 'protected.txt');
  const reviewer = { id: 'reviewer', name: 'reviewer', role: 'reviewer' };
  await tracker.comment(reviewer, next.id, 'Source clear', { verdict: 'review', result: 'clear', run: 'before-barrier', scope: 'full', commit: git(root, 'rev-parse', next.branch) });
  const before = git(root, 'show-ref');
  const bin = await tempProject(t, 'cland-follows-git-barrier-');
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const quote = (s: string) => "'" + s.replaceAll("'", "'\\''") + "'";
  const count = join(bin, 'count'), reached = join(bin, 'reached'), release = join(bin, 'release');
  await writeFile(join(bin, 'git'), `#!/bin/sh
if [ "$1" = log ] && [ "$3" = '--format=%H%x00%(trailers:key=Item,valueonly)%x00' ]; then
  n=0
  if [ -f ${quote(count)} ]; then n=$(cat ${quote(count)}); fi
  n=$((n + 1))
  echo "$n" > ${quote(count)}
  if [ "$n" -eq 2 ]; then
    touch ${quote(reached)}
    while [ ! -f ${quote(release)} ]; do sleep 0.02; done
  fi
fi
exec ${quote(realGit)} "$@"
`, { mode: 0o755 });
  const pathBefore = process.env.PATH;
  process.env.PATH = `${bin}:${pathBefore}`;
  let pending: Promise<unknown> | undefined;
  try {
    pending = merges.merge(next.id, human, resumed);
    // Attach the rejection handler immediately; assertion waits until after the concurrent write.
    const rejected = assert.rejects(pending, /merge-changed:.*(?:lane|gate).*changed/);
    await eventually('final surface Git read paused', async () => await readFile(reached, 'utf8').then(() => true, () => undefined));
    if (change === 'follows') await tracker.link(human, e2.id, { follows: [e3!.id] });
    else await tracker.comment(reviewer, next.id, 'New blocking finding', { verdict: 'review', result: 'not clear', run: 'during-barrier', scope: 'full', commit: git(root, 'rev-parse', next.branch) });
    await writeFile(release, 'continue');
    await rejected;
    assert.equal(git(root, 'show-ref'), before, 'concurrent gate edits leave all refs unchanged');
    if (change === 'follows') await assert.rejects(merge(next), /merge-hold:.*E-4 demo pending.*protected.txt/);
  } finally {
    await writeFile(release, 'cleanup');
    await pending?.catch(() => {});
    if (pathBefore === undefined) delete process.env.PATH; else process.env.PATH = pathBefore;
  }
});
