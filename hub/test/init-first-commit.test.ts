// T3: scratch CLI/Git processes prove the first-commit lifecycle, native hooks and root/territory ref boundaries.
// No hub or harness starts; owned PID/ps capture and close drainage prove safe cleanup on the scratch machine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { chmod, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { emptyFolder, gitIn, initIn, scratchMachine, snapshot, type InitMachine } from './init-machine.ts';
import { provision } from '../src/init/provision.ts';
import { Report } from '../src/init/files.ts';
import { commitClandFiles, createRepository } from '../src/init/repository.ts';

async function git(machine: InitMachine, root: string, ...args: string[]): Promise<string> {
  const result = await gitIn(machine, root, ...args);
  assert.equal(result.code, 0, result.stderr);
  return result.stdout.trim();
}

// T3: native Git is the subject; call init's repository boundary directly, without a CLI or hub process.
test('the first commit uses a fallback only on a machine without a Git identity', async t => {
  for (const identity of ['none', 'user', 'roles'] as const) {
    const machine = await scratchMachine(t, { identity: identity === 'user' });
    const root = await emptyFolder(machine);
    await git(machine, root, 'config', '--global', 'user.useConfigOnly', 'true');
    if (identity === 'roles') {
      for (const [key, value] of Object.entries({
        'author.name': 'Explicit Author', 'author.email': 'author@example.test',
        'committer.name': 'Explicit Committer', 'committer.email': 'committer@example.test',
      })) await git(machine, root, 'config', '--global', key, value);
    }
    const globalConfig = await readFile(machine.env.GIT_CONFIG_GLOBAL!, 'utf8');
    const report = new Report(root);
    const originalEnv = process.env;
    try {
      process.env = machine.env;
      assert.equal(createRepository(report, root), true);
    } finally { process.env = originalEnv; }
    const localConfig = await readFile(join(root, '.git/config'), 'utf8');
    await writeFile(join(root, 'AGENTS.md'), '# Managed instructions\n');
    report.add(join(root, 'AGENTS.md'), 'created');
    try {
      process.env = machine.env;
      commitClandFiles(report, root);
    } finally { process.env = originalEnv; }
    const expected = {
      none: 'cland <cland@local>|cland <cland@local>',
      user: 'Init Test <init@example.test>|Init Test <init@example.test>',
      roles: 'Explicit Author <author@example.test>|Explicit Committer <committer@example.test>',
    };
    assert.equal(await git(machine, root, 'log', '-1', '--format=%an <%ae>|%cn <%ce>'), expected[identity]);
    assert.equal(await readFile(join(root, '.git/config'), 'utf8'), localConfig);
    assert.equal(await readFile(machine.env.GIT_CONFIG_GLOBAL!, 'utf8'), globalConfig);
    const note = report.changes.find(change => change.path === '.git/refs/heads/main')?.note ?? '';
    if (identity !== 'none') assert.doesNotMatch(note, /no Git identity|cland@local/);
    else assert.match(note, /as cland <cland@local>: no Git identity is set$/);
  }
});

// T3: Git validates partial identities itself; no CLI or hub process is needed.
test('the first commit leaves explicit partial identities for Git to validate', async t => {
  const machine = await scratchMachine(t, { identity: false });
  await git(machine, machine.home, 'config', '--global', 'user.useConfigOnly', 'true');
  const envKeys = ['GIT_AUTHOR_NAME', 'GIT_AUTHOR_EMAIL', 'GIT_COMMITTER_NAME', 'GIT_COMMITTER_EMAIL', 'EMAIL'];
  for (const key of ['user.name', 'user.email', 'author.name', 'author.email', 'committer.name', 'committer.email', ...envKeys]) {
    const root = await emptyFolder(machine);
    const report = new Report(root);
    await git(machine, root, 'init', '-q', '-b', 'main');
    if (!envKeys.includes(key)) await git(machine, root, 'config', '--local', key, 'explicit');
    else machine.env[key] = 'explicit';
    const localConfig = await readFile(join(root, '.git/config'), 'utf8');
    const globalConfig = await readFile(machine.env.GIT_CONFIG_GLOBAL!, 'utf8');
    await writeFile(join(root, 'AGENTS.md'), '# Managed instructions\n');
    report.add(join(root, 'AGENTS.md'), 'created');
    const originalEnv = process.env;
    try {
      process.env = machine.env;
      assert.throws(() => commitClandFiles(report, root), /identity unknown|empty ident name|no name|no email/i, key);
    } finally { process.env = originalEnv; }
    delete machine.env[key];
    assert.equal((await gitIn(machine, root, 'rev-parse', '--verify', 'HEAD')).code, 128, key);
    assert.equal(await readFile(join(root, '.git/config'), 'utf8'), localConfig);
    assert.equal(await readFile(machine.env.GIT_CONFIG_GLOBAL!, 'utf8'), globalConfig);
    assert.ok(!report.changes.some(change => change.note?.includes('no Git identity')), key);
  }
});

test('empty-folder init creates one cland-only commit on clean dev', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const root = await emptyFolder(machine);
  await git(machine, root, 'config', '--global', 'user.useConfigOnly', 'true');
  const outside = await snapshot(machine.root, { except: root });
  const result = await initIn(machine, root, 'init', '--json');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await git(machine, root, 'log', '-1', '--format=%an <%ae>|%cn <%ce>'), 'cland <cland@local>|cland <cland@local>');
  assert.match(result.stdout, /as cland <cland@local>: no Git identity is set/);
  assert.equal(await git(machine, root, 'rev-list', '--all', '--count'), '1');
  const files = (await git(machine, root, 'ls-tree', '-r', '--name-only', 'HEAD')).split('\n');
  assert.ok(files.length > 30, 'the shipped skills and managed files are committed');
  assert.deepEqual([...new Set(files.map(path => path.split('/')[0]))].sort(), ['.agents', '.cland', '.claude', 'AGENTS.md', 'docs']);
  for (const path of files) assert.match(path, /^(AGENTS\.md$|\.agents\/|\.cland\/|\.claude\/|docs\/agents\/)/);
  assert.deepEqual(files.filter(path => path.startsWith('.cland/')), [
    '.cland/.gitignore', '.cland/RULES.md', '.cland/config.toml', '.cland/crew.toml', '.cland/roles.toml', '.cland/tasks/.gitkeep',
    '.cland/tasks/C-1-bugs.md', '.cland/tasks/C-2-tech-debt.md', '.cland/tasks/C-3-follow-ups.md', '.cland/tasks/C-4-ideas.md',
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
  assert.match(second.stdout, /unchanged\s+\.cland\/tasks\s+\(the four categories are present\)/);
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
    assert.deepEqual(await readdir(join(root, '.cland/tasks')), ['.gitkeep'], 'update does not seed categories');
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

test('legacy skill refresh commits only newly created leaves', async t => {
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
  assert.equal(await git(machine, root, 'ls-tree', '--name-only', 'HEAD', '--', '.agents/skills/tdd/SKILL.md', '.agents/skills/.cland-manifest.json'), '');
  assert.match(await readFile(join(root, '.agents/skills/tdd/SKILL.md'), 'utf8'), /Test-Driven Development/);
  assert.match(await git(machine, root, 'show', 'HEAD:.agents/skills/tdd/mocking.md'), /When to Mock/);
});

test('init does not adopt pre-existing managed files in a previously provisioned folder', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  await provision(root, { territory: false, categories: true, env: machine.env });
  await rm(join(root, '.cland/crew.toml'));
  assert.equal((await gitIn(machine, root, 'rev-parse', '--git-dir')).code, 128);
  const result = await initIn(machine, root, 'init');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await git(machine, root, 'rev-list', '--all', '--count'), '1');
  assert.equal(await git(machine, root, 'branch', '--show-current'), 'dev');
  assert.equal(await git(machine, root, 'ls-tree', '-r', '--name-only', 'HEAD'), '.cland/crew.toml');
  assert.match(await readFile(join(root, 'AGENTS.md'), 'utf8'), /managed by cland/);
});

// Native Git is required to prove the committed tree, untouched files and identical root/territory refs.
test('a folder with project files receives only cland files in its first commit', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'README.md'), '# My project\n');
  await writeFile(join(root, 'src/app.js'), 'console.log("hello");\n');
  const before = await snapshot(root);
  const mtimes = await Promise.all(['README.md', 'src/app.js'].map(path => stat(join(root, path)).then(s => s.mtimeMs)));
  const result = await initIn(machine, root, 'init');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await git(machine, root, 'rev-list', '--all', '--count'), '1');
  assert.equal(await git(machine, root, 'status', '--porcelain'), '?? README.md\n?? src/');
  const after = await snapshot(root);
  assert.deepEqual(Object.fromEntries(Object.keys(before).map(path => [path, after[path]])), before);
  assert.deepEqual(await Promise.all(['README.md', 'src/app.js'].map(path => stat(join(root, path)).then(s => s.mtimeMs))), mtimes);
  assert.equal(await git(machine, root, 'ls-tree', '-r', '--name-only', 'HEAD', '--', 'README.md', 'src'), '');
  assert.equal(await git(machine, root, 'branch', '--show-current'), 'dev');
  const head = await git(machine, root, 'rev-parse', 'HEAD');
  for (const branch of ['main', 'dev']) {
    assert.equal(await git(machine, root, 'rev-parse', branch), head);
    assert.equal(await git(machine, join(root, '.cland/territory.git'), 'rev-parse', branch), head);
  }
});

// Native Git owns unborn refs and the staged blob/index contract; no hub is needed.
test('an unborn repository keeps the human staged file out of its first commit', async t => {
  const machine = await scratchMachine(t, { identity: true });
  for (const branch of ['main', 'master']) {
    const root = await emptyFolder(machine);
    await git(machine, root, 'init', '-q', '-b', branch);
    await writeFile(join(root, 'notes.txt'), 'staged notes\n');
    await git(machine, root, 'add', 'notes.txt');
    const staged = await git(machine, root, 'ls-files', '--stage', '--', 'notes.txt');
    await writeFile(join(root, 'notes.txt'), 'working notes\n');
    const result = await initIn(machine, root, 'init', '--json');
    assert.equal(result.code, 0, result.stderr);
    assert.equal(await git(machine, root, 'rev-list', '--all', '--count'), '1');
    assert.equal(await git(machine, root, 'ls-tree', '--name-only', 'HEAD', '--', 'notes.txt'), '');
    assert.equal(await git(machine, root, 'ls-files', '--stage', '--', 'notes.txt'), staged);
    assert.equal(await git(machine, root, 'show', ':notes.txt'), 'staged notes');
    assert.equal(await readFile(join(root, 'notes.txt'), 'utf8'), 'working notes\n');
    assert.equal(await git(machine, root, 'status', '--porcelain'), 'AM notes.txt');
    assert.equal(await git(machine, root, 'branch', '--show-current'), 'dev');
    const head = await git(machine, root, 'rev-parse', 'HEAD');
    assert.equal(await git(machine, root, 'rev-parse', branch), head);
    assert.equal(await git(machine, join(root, '.cland/territory.git'), 'rev-parse', 'dev'), head);
    const report = JSON.parse(result.stdout) as { changes: { path: string; note?: string }[] };
    assert.match(report.changes.find(change => change.path === `.git/refs/heads/${branch}`)?.note ?? '', /first commit/);
  }
});

// Native Git proves pre-existing merged files never enter the initial tree or lose their staged blobs.
test('init leaves pre-existing instructions and settings outside its first commit', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  await git(machine, root, 'init', '-q', '-b', 'main');
  await mkdir(join(root, '.claude'));
  await mkdir(join(root, 'docs/agents'), { recursive: true });
  await writeFile(join(root, 'AGENTS.md'), '# My instructions\n');
  await writeFile(join(root, 'CLAUDE.md'), '# Claude instructions\n');
  await writeFile(join(root, '.claude/settings.json'), '{"env":{"MY_SETTING":"yes"}}\n');
  await writeFile(join(root, '.claude/private.txt'), 'private\n');
  await writeFile(join(root, 'docs/agents/private.md'), 'private docs\n');
  await git(machine, root, 'add', '.claude/settings.json');
  const staged = await git(machine, root, 'ls-files', '--stage');
  const result = await initIn(machine, root, 'init');
  assert.equal(result.code, 0, result.stderr);
  const own = ['AGENTS.md', 'CLAUDE.md', '.claude/settings.json', '.claude/private.txt', 'docs/agents/private.md'];
  assert.equal(await git(machine, root, 'ls-tree', '-r', '--name-only', 'HEAD', '--', ...own), '');
  assert.equal(await git(machine, root, 'ls-files', '--stage', '--', 'AGENTS.md', '.claude/settings.json'), staged);
  assert.match(await readFile(join(root, 'AGENTS.md'), 'utf8'), /^# My instructions[\s\S]*cland:begin/);
  assert.match(await readFile(join(root, 'CLAUDE.md'), 'utf8'), /@AGENTS.md/);
  const settings = JSON.parse(await readFile(join(root, '.claude/settings.json'), 'utf8'));
  assert.deepEqual(settings.env, { MY_SETTING: 'yes' });
  assert.ok(settings.hooks.SessionStart.length > 0);
  assert.equal(await git(machine, root, 'branch', '--show-current'), 'dev');
});

// Native Git's ignore matching must agree with the reported initial tree; no hub process is involved.
test('init reports ignored managed paths without forcing them into the first commit', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  await writeFile(join(root, '.gitignore'), '/AGENTS.md\n');
  const result = await initIn(machine, root, 'init', '--json');
  assert.equal(result.code, 0, result.stderr);
  assert.equal(await git(machine, root, 'ls-tree', '--name-only', 'HEAD', '--', 'AGENTS.md'), '');
  assert.match(await readFile(join(root, 'AGENTS.md'), 'utf8'), /cland:begin/);
  const report = JSON.parse(result.stdout) as { changes: { path: string; note?: string }[] };
  assert.match(report.changes.find(change => change.path === 'AGENTS.md')?.note ?? '', /not committed: ignored by Git/);
  assert.equal(await git(machine, root, 'status', '--porcelain'), '?? .gitignore');
  assert.equal(await git(machine, root, 'branch', '--show-current'), 'dev');
});

test('init with no root category includes the task placeholder in its first commit', async t => {
  const machine = await scratchMachine(t, { identity: true });
  const root = await emptyFolder(machine);
  await mkdir(join(root, '.cland'));
  await writeFile(join(root, '.cland/config.toml'), '[tracker]\nlevels = []\n');
  const result = await initIn(machine, root, 'init');
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /categories skipped: the ladder has no root category/);
  assert.deepEqual(await readdir(join(root, '.cland/tasks')), ['.gitkeep']);
  assert.equal(await git(machine, root, 'ls-tree', '-r', '--name-only', 'HEAD', '.cland/tasks'), '.cland/tasks/.gitkeep');
  assert.equal(await git(machine, root, 'status', '--porcelain'), '?? .cland/config.toml');
  assert.equal(await git(machine, root, 'branch', '--show-current'), 'dev');
});
