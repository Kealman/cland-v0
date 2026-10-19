// T1: injected Git result and argv contract; no native Git, hub, sockets or real time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { projectKind, type ProjectGit } from '../src/setup/project-kind.ts';

test('project kind counts untracked project files and excludes ignored files', async t => {
  const root = mkdtempSync(join(tmpdir(), 'setup-kind-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // An unborn Git repository needs no index or commit; fixture creation is file-only.
  for (const dir of ['objects', 'refs', 'info']) mkdirSync(join(root, '.git', dir), { recursive: true });
  writeFileSync(join(root, '.git/HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(join(root, '.git/config'), '[core]\nrepositoryformatversion = 0\nbare = false\n');
  mkdirSync(join(root, '.cland'));
  writeFileSync(join(root, '.cland/config.toml'), '');
  writeFileSync(join(root, 'AGENTS.md'), '');
  writeFileSync(join(root, '.git/info/exclude'), 'ignored.txt\n');
  writeFileSync(join(root, 'ignored.txt'), 'ignored');
  const env = { PATH: '/never-executed' };
  const calls: string[][] = [];
  // Literal Git receipts: ignored.txt is absent with --exclude-standard, app.ts is untracked.
  let stdout = 'AGENTS.md\0.cland/config.toml\0';
  const git: ProjectGit = async (args, options) => {
    calls.push([...args]);
    assert.equal(options.cwd, root);
    assert.equal(options.env, env);
    return { stdout };
  };
  assert.equal(await projectKind(root, env, git), 'empty');
  writeFileSync(join(root, 'app.ts'), 'export const app = true;');
  stdout = 'AGENTS.md\0.cland/config.toml\0app.ts\0';
  assert.equal(await projectKind(root, env, git), 'existing');
  // A cached file counts even when the working-tree copy is gone.
  rmSync(join(root, 'app.ts'));
  assert.equal(await projectKind(root, env, git), 'existing');
  assert.deepEqual(calls, Array.from({ length: 3 }, () => ['ls-files', '--cached', '--others', '--exclude-standard', '-z']));
});

test('an unavailable Git inventory falls back to root entries without counting .git', async t => {
  const root = mkdtempSync(join(tmpdir(), 'setup-kind-fallback-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.git'));
  mkdirSync(join(root, '.cland'));
  const unavailable: ProjectGit = async () => { throw new Error('git unavailable'); };
  assert.equal(await projectKind(root, {}, unavailable), 'empty');
  writeFileSync(join(root, 'app.ts'), 'project file');
  assert.equal(await projectKind(root, {}, unavailable), 'existing');
});
