// T4: macOS-only synthetic Seatbelt write limits around real scratch Git operations.
// This proves Git's required paths, not native Codex enforcement or Linux Landlock parity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'smol-toml';
import { fixtureEnvironment } from './fixture-environment.ts';
import { connectUi, projectHub, tempProject } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { rolesTemplate } from '../src/roles/template.ts';
import { threadPolicy } from '../src/adapters/codex.ts';
import { TERRITORY_HOOK } from '../src/territory.ts';

const run = promisify(execFile);

test('synthetic Seatbelt permits task commit fetch push with exact Implementer roots and protects Git hooks/config (T-1222)', {
  skip: process.platform !== 'darwin' || !existsSync('/usr/bin/sandbox-exec') ? 'needs macOS sandbox-exec; Linux parity is out of scope' : false,
}, async t => {
  const root = await tempProject(t);
  const worktree = join(root, '.cland/worktrees/T-1');
  const territory = join(root, '.cland/territory.git');
  const git = async (cwd: string, ...args: string[]) => (await run('git', ['-C', cwd, ...args], {
    env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 10_000,
  })).stdout.trim();
  await mkdir(join(root, 'home'));
  await mkdir(join(root, '.cland'), { recursive: true });
  await git(root, 'init', '-b', 'dev');
  await git(root, 'config', 'gc.auto', '0');
  await writeFile(join(root, 'tracked'), 'base\n');
  await git(root, 'add', 'tracked');
  await git(root, 'commit', '-m', 'scratch base');
  await git(root, 'init', '--bare', territory);
  await git(territory, 'config', 'gc.auto', '0');
  await git(territory, 'config', 'core.hooksPath', 'hooks');
  await writeFile(join(territory, 'hooks/update'), TERRITORY_HOOK, { mode: 0o755 });
  await git(root, 'remote', 'add', 'origin', territory);
  await git(root, 'worktree', 'add', '-b', 't/T-1', worktree);
  await writeFile(join(root, '.cland/roles.toml'), rolesTemplate(['codex']));
  const { discovery, fakes } = await projectHub(t, root, {}, { clock: new FakeClock() });
  const ui = await connectUi(t, discovery);
  const launched = await ui.request({ type: 'session.launch', name: 'impl', role: 'implementer', harness: 'codex', cwd: worktree });
  assert.equal(launched.ok, true, launched.error);
  const policy = await threadPolicy({ discoveryFile: join(root, '.cland/hub.json') }, worktree, fakes.codex!.spawns[0]!);
  assert.deepEqual(policy.thread, { approvalPolicy: 'never', permissions: 'cland' });
  const profile = (parse(policy.overrides.find(value => value.startsWith('permissions.cland='))!).permissions as {
    cland: { filesystem: Record<string, string> };
  }).cland;
  assert.ok(profile.filesystem, 'the generated Implementer policy grants the narrow Git roots');
  const roots = Object.entries(profile.filesystem).filter(([, permission]) => permission === 'write').map(([path]) => path);
  assert.deepEqual(roots, [
    join(root, '.git/objects'), join(root, '.git/refs'), join(root, '.git/logs'), join(root, '.git/worktrees'),
    join(territory, 'objects'), join(territory, 'refs'), join(territory, 'logs'), join(root, '.cland/artifacts'),
  ]);
  // Deliberately grant no whole temp-directory root: the scratch repository lives there,
  // so that would silently make the protected paths writable too.
  const seatbelt = `(version 1)(allow default)(deny file-write*)(allow file-write* ${[worktree, ...roots].map(path => `(subpath ${JSON.stringify(path)})`).join(' ')} (literal "/dev/null"))`;
  const sandboxed = (command: string, args: string[]) => run('/usr/bin/sandbox-exec', ['-p', seatbelt, command, ...args], {
    cwd: worktree, env: fixtureEnvironment(root, process.env), encoding: 'utf8', timeout: 10_000,
  });
  for (const repository of [join(root, '.git'), territory]) {
    const config = await readFile(join(repository, 'config'), 'utf8');
    for (const target of [join(repository, 'config'), join(repository, 'hooks/forbidden')]) {
      await assert.rejects(sandboxed('/bin/sh', ['-c', 'printf forbidden > "$1"', 'write-probe', target]), /Operation not permitted|Permission denied/);
    }
    assert.equal(await readFile(join(repository, 'config'), 'utf8'), config);
    await assert.rejects(readFile(join(repository, 'hooks/forbidden')), { code: 'ENOENT' });
  }
  await writeFile(join(worktree, 'tracked'), 'task change\n');
  await sandboxed('/usr/bin/git', ['add', 'tracked']);
  await sandboxed('/usr/bin/git', ['commit', '-m', 'scratch task']);
  const commit = await git(worktree, 'rev-parse', 'HEAD');
  await sandboxed('/usr/bin/git', ['push', 'origin', 'HEAD:refs/heads/t/T-1']);
  assert.equal(await git(territory, 'rev-parse', 'refs/heads/t/T-1'), commit, 'the exact task commit reached the territory');
  await sandboxed('/usr/bin/git', ['fetch', 'origin']);
  assert.equal(await git(worktree, 'rev-parse', 'refs/remotes/origin/t/T-1'), commit, 'fetch updated the tracking ref');
  await assert.rejects(sandboxed('/usr/bin/git', ['push', 'origin', 'HEAD:refs/heads/dev']), /protected|hook declined/);
  assert.equal(await readFile(join(territory, 'hooks/update'), 'utf8'), TERRITORY_HOOK);
  assert.equal((await ui.request({ type: 'session.stop', session: 'impl' })).ok, true);
});
