// The CLI's discovery seam: real Git worktrees, a real project hub, and child-process commands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cland, clandWithEnv, spawnSpoke, startDaemon, tempProject, type CliResult } from './harness.ts';

const ok = (r: CliResult): CliResult => {
  assert.equal(r.code, 0, `stdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return r;
};
const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' });

test('CLI commands from linked worktrees find the main project hub and write only its tracker', async (t) => {
  const root = await tempProject(t);
  git(root, 'init');
  const { discovery } = await startDaemon(t, root);
  const created = JSON.parse(ok(await cland(root, 'task', 'create', 'Main item', '--json')).stdout) as { item: { path: string } };
  git(root, 'add', '.cland');
  git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Project fixture');
  const inside = join(root, '.cland', 'worktrees', 'task');
  const outside = join(await tempProject(t, 'cland-outside-'), 'task');
  git(root, 'worktree', 'add', '-b', 'inside', inside);
  git(root, 'worktree', 'add', '-b', 'outside', outside);

  for (const worktree of [inside, outside]) {
    const nested = join(worktree, 'src', 'deep');
    await mkdir(join(nested, '.cland'), { recursive: true });
    for (const cwd of [worktree, nested]) {
      const status = JSON.parse(ok(await cland(cwd, 'hub', 'status', '--json')).stdout) as { root: string; pid: number };
      assert.equal(status.root, root);
      assert.equal(status.pid, discovery.pid);
      for (const args of [['task', 'view', 'T-1', '--json'], ['session', 'list', '--json'], ['role', 'list', '--json'], ['inbox', '--json']]) {
        assert.equal(ok(await cland(cwd, ...args)).stdout, ok(await cland(root, ...args)).stdout, args.join(' '));
      }
    }
    ok(await cland(worktree, 'task', 'comment', 'T-1', `Written from ${worktree}`));
    assert.doesNotMatch(await readFile(join(worktree, created.item.path), 'utf8'), /Written from/);
    assert.match(await readFile(join(root, created.item.path), 'utf8'), /Written from/);
    ok(await cland(worktree, 'task', 'create', 'Worktree item'));
    assert.deepEqual(await readdir(join(worktree, '.cland', 'tasks')), ['T-1-main-item.md']);
    assert.match(ok(await cland(worktree, 'hub', 'start')).stdout, /hub already running/);
  }
  ok(await cland(outside, 'hub', 'stop'));
  assert.equal((await cland(root, 'hub', 'status')).code, 1);
});

test('CLAND_HUB_FILE selects the named hub from another project, including a copied discovery file', async (t) => {
  const root = await tempProject(t);
  const other = await tempProject(t);
  const { discovery } = await startDaemon(t, root);
  const otherHub = await startDaemon(t, other);
  ok(await cland(root, 'task', 'create', 'Target item'));
  const coord = await spawnSpoke({ discover: true, cwd: root, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  ok(await cland(root, 'role', 'set', 'alpha', 'implementer'));
  ok(await cland(root, 'role', 'set', 'beta', 'qa'));
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Which hub?', options: ['this one'] });
  assert.equal(asked.ok, true);
  const copied = join(other, 'discovery.json');
  await copyFile(join(root, '.cland', 'hub.json'), copied);

  for (const file of [join(root, '.cland', 'hub.json'), 'discovery.json']) {
    const env = { CLAND_HUB_FILE: file };
    const status = JSON.parse(ok(await clandWithEnv(other, env, 'hub', 'status', '--json')).stdout) as { root: string; pid: number };
    assert.equal(status.root, root);
    assert.equal(status.pid, discovery.pid);
    assert.match(ok(await clandWithEnv(other, env, 'hub', 'status')).stdout, new RegExp(`^hub running for ${root}`));
    for (const args of [['task', 'view', 'T-1', '--json'], ['session', 'list', '--json'], ['role', 'list', '--json'], ['inbox', '--json']]) {
      assert.equal(ok(await clandWithEnv(other, env, ...args)).stdout, ok(await cland(root, ...args)).stdout, args.join(' '));
    }
    ok(await clandWithEnv(other, env, 'task', 'comment', 'T-1', 'Through the named hub'));
    assert.match(ok(await cland(root, 'task', 'view', 'T-1')).stdout, /Through the named hub/);
    assert.match(ok(await clandWithEnv(other, env, 'hub', 'unmute', 'alpha', 'beta')).stdout, /was not muted/);
    const started = ok(await clandWithEnv(other, env, 'hub', 'start'));
    assert.match(started.stdout, new RegExp(`hub already running for ${other}`));
    assert.match(started.stdout, new RegExp(`pid +${otherHub.discovery.pid}\\b`));
  }
  const env = { CLAND_HUB_FILE: copied };
  ok(await clandWithEnv(other, env, 'topic', 'answer', asked.ask, '1'));
  await coord.waitForEvent((e) => e.params.meta?.answer_to === asked.ask);
  const imported = JSON.parse(ok(await clandWithEnv(other, {
    ...env,
    PATH: `${fileURLToPath(new URL('./fixtures/fake-gh', import.meta.url))}:${process.env.PATH ?? ''}`,
    FAKE_GH_FIXTURE: fileURLToPath(new URL('./fixtures/github-acme-widgets.json', import.meta.url)),
  }, 'task', 'import-github', '--repo', 'acme/widgets', '--json')).stdout) as { created: number };
  assert.equal(imported.created, 4);
  assert.deepEqual(JSON.parse(ok(await cland(other, 'task', 'list', '--json')).stdout), { items: [] });

  // Explicit absent/invalid files must fail rather than silently selecting the cwd's running hub.
  const invalid = join(other, 'invalid.json');
  await writeFile(invalid, '{}');
  for (const file of [join(other, 'absent.json'), invalid]) {
    for (const args of [['hub', 'status', '--json'], ['session', 'list'], ['task', 'list']]) {
      assert.equal((await clandWithEnv(other, { CLAND_HUB_FILE: file }, ...args)).code, 1, args.join(' '));
    }
  }
  ok(await clandWithEnv(other, env, 'hub', 'stop'));
  assert.equal((await cland(root, 'hub', 'status')).code, 1);
  assert.equal(JSON.parse(ok(await cland(other, 'hub', 'status', '--json')).stdout).pid, otherHub.discovery.pid);
});
