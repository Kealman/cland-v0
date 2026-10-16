import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdtemp, rm, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);
const modules = dirname(dirname(require.resolve('typescript/package.json')));

test('typecheck resolves pinned compilers in roots and linked worktrees', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-typecheck-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  // Copy the actual projects/configs/scripts, not a substitute compiler command.
  for (const path of ['package.json', 'hub', 'nvim']) {
    await cp(join(source, path), join(root, path), {
      recursive: true,
      filter: path => !path.split('/').includes('node_modules'),
    });
  }
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', timeout: 30_000 });
  git('init', '-q');
  git('add', 'package.json', 'hub', 'nvim');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'Typecheck fixture');
  await symlink(modules, join(root, 'node_modules'), 'dir');
  const worktree = join(root, '.cland', 'worktrees', 'T-1');
  git('worktree', 'add', '--detach', worktree, 'HEAD');
  assert.equal(existsSync(join(worktree, 'node_modules')), false);
  const check = (cwd: string, ...args: string[]) => {
    const result = spawnSync('npm', ['run', 'typecheck', ...args], { cwd, encoding: 'utf8', timeout: 60_000 });
    assert.equal(result.status, 0, `${cwd}\n${result.error ?? ''}\n${result.stdout}\n${result.stderr}`);
    return result.stdout;
  };
  check(root);
  check(worktree);
  // The two aliases share a bin name: prove this is 7, while API imports stay 5.9.
  assert.match(check(worktree, '--workspace', 'hub', '--', '--version'), /Version 7\.0\.2/);
  const api = createRequire(join(worktree, 'hub', 'package.json'))('typescript');
  assert.equal(api.version, '5.9.3');
  assert.equal(typeof api.createProgram, 'function');
  await symlink(modules, join(worktree, 'node_modules'), 'dir');
  check(worktree);
});
