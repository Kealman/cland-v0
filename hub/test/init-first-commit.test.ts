// T3: scratch CLI/Git processes prove the first-commit lifecycle, native hooks and root/territory ref boundaries.
// No hub or harness starts; owned PID/ps capture and close drainage prove safe cleanup on the scratch machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { emptyFolder, gitIn, initIn, scratchMachine, snapshot, type InitMachine } from './init-machine.ts';
import { provision } from '../src/init/provision.ts';

async function git(machine: InitMachine, root: string, ...args: string[]): Promise<string> {
  const result = await gitIn(machine, root, ...args);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout.trim();
}

test('empty-folder init creates one cland-only commit on clean dev', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  const outside = await snapshot(machine.root, { except: root });
  const result = await initIn(machine, root, 'init', '--json');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await git(machine, root, 'rev-list', '--all', '--count'), '1');
  const files = (await git(machine, root, 'ls-tree', '-r', '--name-only', 'HEAD')).split('\n');
  assert.ok(files.length > 30, 'the shipped skills and managed files are committed');
  assert.deepEqual([...new Set(files.map(path => path.split('/')[0]))].sort(), ['.agents', '.cland', '.claude', 'AGENTS.md', 'docs']);
  for (const path of files) assert.match(path, /^(AGENTS\.md$|\.agents\/|\.cland\/|\.claude\/|docs\/agents\/)/);
  assert.deepEqual(files.filter(path => path.startsWith('.cland/')), [
    '.cland/.gitignore', '.cland/RULES.md', '.cland/config.toml', '.cland/crew.toml', '.cland/roles.toml', '.cland/tasks/.gitkeep',
  ]);
  assert.equal(await git(machine, root, 'status', '--porcelain'), '');
  assert.equal(await git(machine, root, 'branch', '--show-current'), 'dev');
  const head = await git(machine, root, 'rev-parse', 'HEAD');
  for (const branch of ['main', 'dev']) {
    assert.equal(await git(machine, root, 'rev-parse', branch), head);
    assert.equal(await git(machine, join(root, '.cland/territory.git'), 'rev-parse', branch), head);
  }
  assert.equal(await git(machine, join(root, '.cland/territory.git'), 'symbolic-ref', 'HEAD'), 'refs/heads/dev');
  assert.equal(await git(machine, root, 'symbolic-ref', 'refs/remotes/origin/HEAD'), 'refs/remotes/origin/dev');
  const report = JSON.parse(result.stdout) as { changes: { path: string; action: string; note?: string }[] };
  assert.equal(report.changes.find(change => change.path === '.git')?.action, 'created');
  assert.match(report.changes.find(change => change.path === '.git')?.note ?? '', /git init -b main/);
  assert.equal(new Set(report.changes.map(change => change.path)).size, report.changes.length, 'one report line per path');
  assert.doesNotMatch(result.stdout, /main has no commit yet/);
  const message = await git(machine, root, 'log', '-1', '--format=%B');
  assert.match(message, /^Initial commit: cland init\n\n/);
  assert.match(message, /AGENTS\.md/);
  assert.deepEqual(await snapshot(machine.root, { except: root }), outside, 'init writes only inside the target');
});

test('a second init preserves the first commit and reports nothing to change', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  const first = await initIn(machine, root, 'init');
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /created\s+\.git\s+\(git init -b main\)/);
  assert.match(first.stdout, /created\s+\.git\/refs\/heads\/main\s+\(first commit [a-f0-9]+: AGENTS\.md, \.cland\/, \.agents\/, \.claude\/, docs\/agents\/ \(\d+ files\)\)/);
  assert.doesNotMatch(first.stdout, /main has no commit yet/);
  const head = await git(machine, root, 'rev-parse', 'HEAD');
  const second = await initIn(machine, root, 'init');
  assert.equal(second.code, 0, second.stderr);
  assert.match(second.stdout, /nothing to change: every managed part is current/);
  assert.equal(await git(machine, root, 'rev-parse', 'HEAD'), head);
  assert.equal(await git(machine, root, 'rev-list', '--all', '--count'), '1');
  assert.equal(await git(machine, root, 'status', '--porcelain'), '');
});

test('init bypasses globally configured commit hooks and signing', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  const hooks = join(machine.home, 'hooks');
  await mkdir(hooks);
  const marker = join(machine.home, 'hook-ran');
  // Relative to HOME via the shell: no machine path is interpolated into executable shell text.
  await writeFile(join(hooks, 'pre-commit'), '#!/bin/sh\nprintf ran > "$HOME/hook-ran"\nexit 1\n');
  await chmod(join(hooks, 'pre-commit'), 0o755);
  await git(machine, root, 'config', '--global', 'core.hooksPath', hooks);
  await git(machine, root, 'config', '--global', 'commit.gpgsign', 'true');
  const outside = await snapshot(machine.root, { except: root });
  const result = await initIn(machine, root, 'init');
  assert.equal(result.code, 0, result.stderr);
  await assert.rejects(readFile(marker), { code: 'ENOENT' });
  assert.equal(await git(machine, root, 'log', '-1', '--format=%s'), 'Initial commit: cland init');
  assert.deepEqual(await snapshot(machine.root, { except: root }), outside);
});

test('update never creates a repository or a first commit', async t => {
  const machine = await scratchMachine(t, { identity: true });
  for (const repository of [false, true]) {
    const root = await emptyFolder(machine);
    await mkdir(repository ? join(root, '.cland') : join(root, '.cland', 'territory.git'), { recursive: true });
    if (repository) await git(machine, root, 'init', '-q', '-b', 'main');
    const result = await initIn(machine, root, 'update');
    assert.equal(result.code, 0, result.stderr);
    const head = await gitIn(machine, root, 'rev-parse', '--verify', 'HEAD');
    assert.equal(head.code, 128);
    if (!repository) assert.equal((await gitIn(machine, root, 'rev-parse', '--git-dir')).code, 128);
  }
});

test('a root .DS_Store stays out of the first commit on clean dev', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  await writeFile(join(root, '.DS_Store'), 'Finder metadata');
  const result = await initIn(machine, root, 'init');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await git(machine, root, 'branch', '--show-current'), 'dev');
  assert.equal(await git(machine, root, 'status', '--porcelain'), '');
  assert.equal(await git(machine, root, 'ls-tree', '--name-only', 'HEAD', '.DS_Store'), '');
  assert.equal(await readFile(join(root, '.DS_Store'), 'utf8'), 'Finder metadata');
});

test('first commit omits pre-existing files in managed directories', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  await mkdir(join(root, '.agents/skills/custom'), { recursive: true });
  await mkdir(join(root, 'docs/agents'), { recursive: true });
  const own = ['.agents/skills/custom/SKILL.md', 'docs/agents/private.md'];
  for (const path of own) await writeFile(join(root, path), 'private content');
  const result = await initIn(machine, root, 'init');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await git(machine, root, 'ls-tree', '-r', '--name-only', 'HEAD', '--', ...own), '');
  for (const path of own) assert.equal(await readFile(join(root, path), 'utf8'), 'private content');
});

test('legacy skill refresh commits owned leaves without adopting an unlisted private file', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  await mkdir(join(root, '.agents/skills/tdd'), { recursive: true });
  await writeFile(join(root, '.agents/skills/tdd/SKILL.md'), 'old managed skill');
  const privateFile = '.agents/skills/tdd/private.md';
  await writeFile(join(root, privateFile), 'private content');
  await writeFile(join(root, '.agents/skills/.cland-manifest.json'), JSON.stringify({
    managed: 'managed by cland 0.0.1', skills: { tdd: ['SKILL.md'] },
  }));
  const result = await initIn(machine, root, 'init', '--json');
  assert.equal(result.code, 0, result.stderr);
  const report = JSON.parse(result.stdout) as { changes: { path: string; action: string }[] };
  assert.ok(report.changes.some(change => change.path === '.agents/skills/tdd' && change.action === 'updated'));
  assert.equal(await git(machine, root, 'ls-tree', '-r', '--name-only', 'HEAD', '--', privateFile), '');
  assert.equal(await readFile(join(root, privateFile), 'utf8'), 'private content');
  assert.match(await git(machine, root, 'show', 'HEAD:.agents/skills/tdd/SKILL.md'), /Test-Driven Development/);
});

test('init commits already current managed files in a previously provisioned non-Git folder', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  provision(root, { territory: false, env: machine.env });
  assert.equal((await gitIn(machine, root, 'rev-parse', '--git-dir')).code, 128);
  const result = await initIn(machine, root, 'init');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await git(machine, root, 'rev-list', '--all', '--count'), '1');
  assert.equal(await git(machine, root, 'branch', '--show-current'), 'dev');
  assert.equal(await git(machine, root, 'status', '--porcelain'), '');
  assert.match(await git(machine, root, 'show', 'HEAD:AGENTS.md'), /managed by cland/);
});
