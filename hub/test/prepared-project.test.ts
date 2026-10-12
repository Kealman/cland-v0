import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, startDaemon } from './harness.ts';
import { preparedProject } from './prepared-project.ts';

const git = (root: string, ...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

test('prepared projects own their refs, index, config, hooks, worktrees, objects and hub state', async t => {
  const first = await preparedProject(t);
  const second = await preparedProject(t);
  const head = git(second, 'rev-parse', 'HEAD');
  const objects = git(second, 'count-objects', '-v');
  const hook = await readFile(join(second, '.cland/territory.git/hooks/update'), 'utf8');
  const { discovery } = await startDaemon(t, first);
  const ui = await connectUi(t, discovery);
  const made = await ui.request({ type: 'task.create', title: 'Private task' });
  assert.equal(made.ok, true, made.error);
  const claimed = await ui.request({ type: 'task.claim', item: 'T-1' });
  assert.equal(claimed.ok, true, claimed.error);
  git(first, 'branch', 'private-ref');
  git(first, 'config', 'user.name', 'Private');
  await writeFile(join(first, 'private-file'), 'private object\n');
  git(first, 'add', 'private-file');
  git(first, 'commit', '-qm', 'Private commit');
  await writeFile(join(first, 'staged-file'), 'staged\n');
  git(first, 'add', 'staged-file');
  await writeFile(join(first, '.cland/territory.git/hooks/update'), '#!/bin/sh\nexit 1\n');
  await writeFile(join(first, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 1\n');
  await writeFile(join(first, '.cland/config.toml'), '[plan]\n');
  // A later copy also proves mutations did not reach the worker's prepared fixture.
  const third = await preparedProject(t);
  for (const root of [second, third]) {
    assert.equal(git(root, 'rev-parse', 'HEAD'), head);
    assert.equal(git(root, 'branch', '--list', 'private-ref'), '');
    assert.equal(git(root, 'diff', '--cached', '--name-only'), '');
    assert.equal(git(root, 'config', 'user.name'), 'Test');
    assert.equal(git(root, 'count-objects', '-v'), objects);
    assert.equal(git(root, 'worktree', 'list', '--porcelain').match(/^worktree /gm)?.length, 1);
    assert.equal(await readFile(join(root, '.cland/territory.git/hooks/update'), 'utf8'), hook);
    assert.equal((await readdir(join(root, '.git/hooks'))).includes('pre-commit'), false);
    assert.deepEqual(await readdir(join(root, '.cland/tasks')), ['.gitkeep']);
    assert.match(await readFile(join(root, '.cland/config.toml'), 'utf8'), /managed by cland/);
    assert.equal(git(root, 'remote', 'get-url', 'origin'), join(root, '.cland/territory.git'));
    const daemon = await startDaemon(t, root);
    const other = await connectUi(t, daemon.discovery);
    const listed = await other.request({ type: 'task.list' });
    assert.equal(listed.ok, true, listed.error);
    assert.deepEqual((listed.value as { items: unknown[] }).items, []);
  }
});
