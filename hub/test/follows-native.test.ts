// T3: native Git trailers, rename/deletion bytes and owning Git environment determine epic merge surfaces.
import { fixtureEnvironment } from './fixture-environment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { epicMergeFiles, epicDemoFreshness } from '../src/tracker/epic-surfaces.ts';
import { gitIn, type Git } from '../src/tracker/verdict-git.ts';
import { Freshness } from '../src/tracker/freshness.ts';
import { manualTips } from './freshness-harness.ts';
import { eventually, tempProject } from './harness.ts';
import { preparedProject } from './prepared-project.ts';
const git = (root: string, ...args: string[]) => execFileSync('git', args, { env: fixtureEnvironment(root, process.env), cwd: root, encoding: 'utf8', timeout: 5000 }).trim();

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

test('epic merge surfaces use the owning Git environment for both history and changed paths', async t => {
  const roots = await Promise.all([preparedProject(t, 'repository'), preparedProject(t, 'repository')]);
  for (const [i, root] of roots.entries()) {
    git(root, 'branch', '-m', 'dev');
    await writeFile(join(root, `owner-${i}.txt`), 'owned');
    git(root, 'add', '.');
    git(root, 'commit', '-qm', 'Owned surface\n\nItem: T-9');
  }
  const environments = roots.map(root => ({ ...process.env, GIT_DIR: git(root, 'rev-parse', '--absolute-git-dir'), GIT_WORK_TREE: root }));
  assert.deepEqual(await Promise.all(environments.map(env => epicMergeFiles(roots[0]!, ['T-9'], 'dev', env))), [['owner-0.txt'], ['owner-1.txt']]);
});

test('stage ancestry settles within two seconds while an old thousand-commit demo scan is outstanding', async t => {
  // This test owns every Git setup command (rather than an unbounded seed).
  // Each command has a 5 s setup deadline, separate from the 2 s receipt bound.
  const root = await tempProject(t);
  git(root, 'init', '-q', '-b', 'dev');
  git(root, 'commit', '--allow-empty', '-qm', 'Land\n\nItem: T-9');
  const demo = git(root, 'rev-parse', 'HEAD');
  const data = (value: string) => `data ${Buffer.byteLength(value)}\n${value}\n`;
  const history = Array.from({ length: 1000 }, (_, i) =>
    `commit refs/heads/dev\ncommitter Fixture <fixture@example.test> ${1700000000 + i} +0000\n${data(`Later ${i}`)}${i === 0 ? `from ${demo}\n` : ''}M 100644 inline other.txt\n${data(String(i))}\n`).join('');
  execFileSync('git', ['fast-import', '--quiet'], { env: fixtureEnvironment(root, process.env), cwd: root, input: history, timeout: 5000 });
  const tip = git(root, 'rev-parse', 'dev');
  assert.equal(git(root, 'rev-list', '--count', `${demo}..${tip}`), '1000');
  let entered = false;
  const release = Promise.withResolvers<void>();
  let answered = false;
  const native = gitIn(root);
  const calls: string[][] = [];
  let demoDone = false;
  const tips = manualTips();
  const fresh = new Freshness({
    git: async (args, input, signal) => {
      calls.push(args);
      if (args[0] === 'log') { entered = true; await release.promise; }
      return native(args, input, signal);
    },
    scheduleTips: tips.scheduleTips,
    settled: ids => {
      if (ids.includes('E-1')) demoDone = true;
      if (fresh.ancestor('E-2', demo) === true && fresh.contains('E-2', demo, tip) === true) answered = true;
    },
    tipsMoved: () => {},
  });
  fresh.start();
  try {
    await tips.refresh();
    assert.equal(fresh.demo('E-1', demo, ['T-9']), undefined);
    await eventually('demo scan entered', () => entered ? true : undefined, 5000);
    const started = performance.now();
    assert.equal(fresh.ancestor('E-2', demo), undefined);
    assert.equal(fresh.contains('E-2', demo, tip), undefined);
    await eventually('stage ancestry receipt while demo scan outstanding', () => answered ? true : undefined, 2000);
    t.diagnostic(`foreground ancestor/contains receipt: ${(performance.now() - started).toFixed(3)} ms (bound 2000 ms; setup excluded)`);
    assert.equal(fresh.ancestor('E-2', demo), true);
    assert.equal(fresh.contains('E-2', demo, tip), true);
    assert.equal(demoDone, false, 'foreground receipt precedes completion of the held demo scan');
    release.resolve();
    await eventually('batched demo scan receipt', () => demoDone ? true : undefined, 5000);
    assert.equal(fresh.demo('E-1', demo, ['T-9']), true);
    assert.equal(calls.filter(args => args[0] === 'log').length, 2, 'one surface read and one intervening history read for 1000 commits');
    assert.equal(calls.filter(args => args[0] === 'diff-tree').length, 0);
  } finally { release.resolve(); await fresh.stop(); }
});

test('demo freshness batches Git reads and preserves rename, revert, side-branch and merge conflicts', async t => {
  const root = await tempProject(t);
  git(root, 'init', '-q', '-b', 'dev');
  const unusual = ' spaced\nname.txt';
  await writeFile(join(root, unusual), 'original');
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'Surface\n\nItem: T-9');
  const demo = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '-qb', 'side');
  await writeFile(join(root, unusual), 'side');
  git(root, 'commit', '-qam', 'Side edit');
  const side = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '-q', 'dev');
  git(root, 'merge', '--no-ff', '-qm', 'Merge side', 'side');
  const merge = git(root, 'rev-parse', 'HEAD');
  await writeFile(join(root, unusual), 'original');
  git(root, 'commit', '-qam', 'Revert content');
  const revert = git(root, 'rev-parse', 'HEAD');
  await rename(join(root, unusual), join(root, 'renamed.txt'));
  git(root, 'add', '.'); git(root, 'commit', '-qm', 'Rename');
  const renamed = git(root, 'rev-parse', 'HEAD');
  const calls: string[][] = [];
  const native = gitIn(root);
  const counted: Git = (...args) => { calls.push(args[0]); return native(...args); };
  const actual = await epicDemoFreshness(counted, ['T-9'], demo, renamed);
  assert.equal(actual.current, false);
  assert.deepEqual(actual.conflicts, [side, merge, revert, renamed].map(commit => ({ commit, files: [unusual] })));
  assert.ok(calls.length <= 4, `at most four Git invocations, got ${calls.length}: ${calls.map(c => c[0])}`);
  calls.length = 0;
  assert.deepEqual(await epicDemoFreshness(counted, ['T-99'], demo, renamed), { current: true });
  assert.ok(calls.length <= 4);
});

