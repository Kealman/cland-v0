// Verdict freshness off the request path (T-67): the tracker against a real Git repository, with every git process
// counted through the injected runner. `list` and `view` must start none; the answers arrive from the cache.
import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sleep, tempProject } from './harness.ts';
import { Tracker, type Actor, type ItemChange, type ItemSummary } from '../src/tracker/tracker.ts';
import { gitIn, type Git } from '../src/tracker/verdict-git.ts';

const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const REVIEWER: Actor = { id: 'rev-id', name: 'rev-1', role: 'reviewer' };

/** A repository on dev with a feature commit, and `n` task branches whose tips add an empty commit on top of it. */
async function repository(root: string, n: number): Promise<{ feature: string }> {
  git(root, 'init', '-b', 'dev');
  git(root, 'config', 'user.name', 'Test');
  git(root, 'config', 'user.email', 'test@example.com');
  await writeFile(join(root, 'base'), 'base\n');
  git(root, 'add', 'base');
  git(root, 'commit', '-m', 'base');
  git(root, 'checkout', '-b', 'feature');
  await writeFile(join(root, 'feature'), 'feature\n');
  git(root, 'add', 'feature');
  git(root, 'commit', '-m', 'feature');
  const feature = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', 'dev');
  for (let k = 0; k < n; k++) {
    // the same task diff as the reviewed commit, on another tip: current only through the patch-id comparison
    const tip = git(root, 'commit-tree', `${feature}^{tree}`, '-p', feature, '-m', `tip ${k}`);
    git(root, 'update-ref', `refs/heads/t/${k}`, tip);
  }
  return { feature };
}

/** The tracker with a git runner that counts the processes it starts, and those started while `reading` is set. */
function counted(t: TestContext, root: string) {
  const counts = { all: 0, whileReading: 0 };
  let reading = false;
  const real = gitIn(root);
  const run: Git = (args, input) => {
    counts.all++;
    if (reading) counts.whileReading++;
    return real(args, input);
  };
  const tracker = new Tracker({ root, db: join(root, '.cland', 'hub.db'), git: run, tipCheckMs: 50 });
  t.after(() => tracker.stop());
  const read = <T>(fn: () => T): T => {
    reading = true;
    try {
      return fn();
    } finally {
      reading = false;
    }
  };
  return { tracker, counts, read };
}

async function settled(tracker: Tracker, ok: (items: ItemSummary[]) => boolean, ms = 15_000): Promise<ItemSummary[]> {
  const until = Date.now() + ms;
  for (;;) {
    const items = tracker.list();
    if (ok(items)) return items;
    if (Date.now() > until) assert.fail(`freshness did not settle: ${JSON.stringify(items.map((i) => [i.id, i.verdicts.map((v) => v.current)]))}`);
    await sleep(25);
  }
}
const allKnown = (items: ItemSummary[]) => items.every((i) => i.verdicts.every((v) => v.current !== undefined));

test('task.list and task.view start no git process; freshness arrives from the cache, then follows a branch that moves', async (t) => {
  const root = await tempProject(t);
  const N = 20;
  const { feature } = await repository(root, N);
  const { tracker, counts, read } = counted(t, root);
  tracker.start();
  const events: ItemChange[] = [];
  tracker.onChange((c) => events.push(c));
  for (let k = 0; k < N; k++) {
    const { id } = tracker.create(REVIEWER, { title: `Item ${k}`, branch: `t/${k}` });
    await tracker.comment(REVIEWER, id, 'checked', { verdict: 'review', result: 'clear', run: `r-${k}`, commit: feature });
  }

  // a flood of reads, the shape of the incident: none of them starts git, whatever the cache knows yet
  const before = counts.all;
  for (let i = 0; i < 200; i++) {
    read(() => tracker.list());
    read(() => tracker.view(`T-${(i % N) + 1}`));
  }
  assert.equal(counts.whileReading, 0, 'no git inside list or view');
  assert.ok(counts.all >= before, 'the cache works in the background');

  const items = await settled(tracker, allKnown);
  assert.deepEqual(items.map((i) => i.verdicts[0]?.current), Array(N).fill(true), 'a rebased-looking tip with the same diff is current');
  assert.equal(read(() => tracker.view('T-3')).verdicts[0]?.current, true);
  assert.equal(items[0]?.verdictBase, 'dev');
  // the answers were announced as they arrived: the UI hears `current` without asking again
  assert.ok(events.some((e) => e.id === 'T-1' && e.item?.verdicts[0]?.current === true), 'a settled answer is a task event');

  // the task diff of t/3 changes: the timer's tip read sees it and the verdict goes stale, the others stay current
  git(root, 'checkout', 't/3');
  await writeFile(join(root, 'feature'), 'changed\n');
  git(root, 'commit', '-am', 'change the feature');
  git(root, 'checkout', 'dev');
  const after = await settled(tracker, (xs) => xs[3]?.verdicts[0]?.current === false);
  assert.deepEqual(after.filter((i) => i.id !== 'T-4').map((i) => i.verdicts[0]?.current), Array(N - 1).fill(true));
  assert.equal(read(() => tracker.view('T-4')).verdicts[0]?.current, false);
  await sleep(100);
  assert.ok(events.some((e) => e.id === 'T-4' && e.item?.verdicts[0]?.current === false), 'the stale verdict is announced');
  assert.equal(counts.whileReading, 0);
});

test('a verdict on the branch tip is current at once, and an unrelated tip read announces nothing', async (t) => {
  const root = await tempProject(t);
  await repository(root, 1);
  const { tracker, read } = counted(t, root);
  tracker.start();
  const { id } = tracker.create(REVIEWER, { title: 'Reviewed', branch: 't/0' });
  const view = await tracker.comment(REVIEWER, id, 'checked', { verdict: 'qa', result: 'clear', run: 'q-1' });
  assert.equal(view.verdicts[0]?.commit, git(root, 'rev-parse', 't/0'));
  assert.equal(view.verdicts[0]?.current, true);
  const events: ItemChange[] = [];
  tracker.onChange((c) => events.push(c));
  git(root, 'branch', 'unrelated');
  await sleep(300);
  assert.deepEqual(events, [], 'a tip read that changes no answer is no event');
  assert.equal(read(() => tracker.list())[0]?.verdicts[0]?.current, true);
});
