// T3: native Git trailers, rename/deletion bytes and owning Git environment determine epic merge surfaces.
import { fixtureEnvironment } from './fixture-environment.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { epicMergeFiles } from '../src/tracker/epic-surfaces.ts';
import { preparedProject } from './prepared-project.ts';
const git = (root: string, ...args: string[]) => execFileSync('git', args, { env: fixtureEnvironment(root, process.env), cwd: root, encoding: 'utf8' }).trim();

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

