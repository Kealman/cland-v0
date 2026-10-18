// T3: stopping via stale discovery preserves a replacement hub's socket and PID.
// Routing checks use isolated in-process hubs; real CLI calls prove cwd/discovery selection.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cland, clandWithEnv, killDaemon, projectHub, inProcessSpoke, startDaemon, connectUi, tempProject, type CliResult } from './harness.ts';
import { runInit } from '../src/cli/init.ts';
import { captureCli } from './cli-in-process.ts';
import { FakeClock } from './fake-clock.ts';
import { caseDeadlines } from './case-deadlines.ts';

const ok = (r: CliResult): CliResult => {
  assert.equal(r.code, 0, `stdout: ${r.stdout}\nstderr: ${r.stderr}`);
  return r;
};

test('CLI commands from linked worktrees find the main project hub and write only its tracker', async (t) => {
  const { wait, fixtures } = caseDeadlines(t);
  const git = (cwd: string, ...args: string[]) => {
    try { return execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 30_000 }); }
    catch (cause) { throw new Error(`${t.name}: git ${args.join(' ')} failed`, { cause }); }
  };
  const root = await wait('create temporary project', () => tempProject(fixtures));
  git(root, 'init');
  const { discovery } = await wait('start routing hub', () => projectHub(fixtures, root, {}, { clock: new FakeClock() }));
  const ui = await wait('connect UI', () => connectUi(fixtures, discovery));
  const created = (await wait('UI task.create', () => ui.request({ type: 'task.create', title: 'Main item', size: 'M' }))).value as { item: { path: string } };
  git(root, 'add', '.cland');
  git(root, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', 'commit', '-m', 'Project fixture');
  const inside = join(root, '.cland', 'worktrees', 'task');
  const outside = join(await wait('create temporary project', () => tempProject(fixtures, 'cland-outside-')), 'task');
  git(root, 'worktree', 'add', '-b', 'inside', inside);
  git(root, 'worktree', 'add', '-b', 'outside', outside);

  for (const worktree of [inside, outside]) {
    const nested = join(worktree, 'src', 'deep');
    await wait('create directory', () => mkdir(join(nested, '.cland'), { recursive: true }));
    for (const cwd of [worktree, nested]) {
      const status = JSON.parse(ok(await wait('CLI hub status --json', () => cland(cwd, 'hub', 'status', '--json'))).stdout) as { root: string; pid: number };
      assert.equal(status.root, root);
      assert.equal(status.pid, discovery.pid);
    }
    ok(await wait('CLI task comment T-1', () => cland(worktree, 'task', 'comment', 'T-1', `Written from ${worktree}`)));
    assert.doesNotMatch(await wait('read fixture file', () => readFile(join(worktree, created.item.path), 'utf8')), /Written from/);
    assert.match(await wait('read fixture file', () => readFile(join(root, created.item.path), 'utf8')), /Written from/);
    assert.deepEqual(await wait('list worktree tracker', () => readdir(join(worktree, '.cland', 'tasks'))), ['T-1-main-item.md']);
    assert.match(ok(await wait('CLI hub start', () => cland(worktree, 'hub', 'start'))).stdout, /hub already running/);
  }
});

test('an initialized non-worktree child remains its own project beside a running parent hub', async (t) => {
  const { wait, fixtures } = caseDeadlines(t);
  const parent = await wait('create temporary project', () => tempProject(fixtures));
  const { discovery } = await wait('start project hub', () => projectHub(fixtures, parent, {}, { clock: new FakeClock(), harnesses: 'fake' }));
  ok(await wait('CLI task create --size', () => cland(parent, 'task', 'create', '--size', 'M', 'Parent item')));
  const child = join(parent, 'child');
  // Init refuses a target discovered as its parent; mark this fixture's
  // independent project boundary before provisioning it (T-609).
  await wait('create directory', () => mkdir(join(child, '.cland'), { recursive: true }));
  ok(await wait('initialize independent child project', () => captureCli(write => runInit([child, '--json'], parent, write))));

  const idle = await wait('CLI hub status --json', () => cland(child, 'hub', 'status', '--json'));
  assert.equal(idle.code, 1, idle.stdout);
  assert.deepEqual(JSON.parse(idle.stdout), { running: false, root: child });
  assert.equal((await wait('CLI task create --size', () => cland(child, 'task', 'create', '--size', 'M', 'Must not reach parent'))).code, 1);
  const childHub = await wait('start project hub', () => projectHub(fixtures, child, {}, { clock: new FakeClock(), harnesses: 'fake' }));
  assert.notEqual(childHub.discovery.socket, discovery.socket);
  ok(await wait('CLI task create --size', () => cland(child, 'task', 'create', '--size', 'M', 'Child item')));
  assert.match(ok(await wait('CLI task view T-1', () => cland(child, 'task', 'view', 'T-1'))).stdout, /Child item/);
  assert.match(ok(await wait('CLI task view T-1', () => cland(parent, 'task', 'view', 'T-1'))).stdout, /Parent item/);
  assert.equal(JSON.parse(ok(await wait('CLI task list --json', () => cland(parent, 'task', 'list', '--json'))).stdout).items.length, 1);
});

test('stop through stale copied discovery leaves the replacement hub socket and another project intact', async (t) => {
  const { wait, fixtures } = caseDeadlines(t);
  // A long root puts the socket in the temp directory; the socket path cannot identify the project.
  const root = await wait('create temporary project', () => tempProject(fixtures, 'cland-discovery-root-with-long-name-'));
  const other = await wait('create temporary project', () => tempProject(fixtures));
  const first = await wait('start hub process', () => startDaemon(fixtures, root));
  const otherHub = await wait('start hub process', () => startDaemon(fixtures, other));
  const recorded = join(other, 'recorded.json');
  const legacy = join(other, 'legacy.json');
  await wait('copy discovery file', () => copyFile(join(root, '.cland', 'hub.json'), recorded));
  const old = JSON.parse(await wait('read fixture file', () => readFile(recorded, 'utf8'))) as { root?: string };
  delete old.root;
  await wait('write fixture file', () => writeFile(legacy, JSON.stringify(old)));
  await wait('stop original hub process', () => killDaemon(first.discovery.pid));
  // Rotate the secret so a probe through the old copy fails against the replacement.
  await wait('write fixture file', () => writeFile(join(root, '.cland', 'secret'), `${'a'.repeat(64)}\n`));
  const replacement = await wait('start hub process', () => startDaemon(fixtures, root));
  assert.notEqual(replacement.discovery.pid, first.discovery.pid);
  const socket = await wait('stat replacement socket', () => stat(replacement.discovery.socket));
  for (const file of [recorded, legacy]) {
    ok(await wait(`CLI hub stop via ${file}`, () => clandWithEnv(other, { CLAND_HUB_FILE: file }, 'hub', 'stop')));
    assert.equal((await wait('stat replacement socket', () => stat(replacement.discovery.socket))).ino, socket.ino);
    assert.equal(JSON.parse(ok(await wait('CLI hub status --json', () => cland(root, 'hub', 'status', '--json'))).stdout).pid, replacement.discovery.pid);
    assert.equal(JSON.parse(ok(await wait('CLI hub status --json', () => cland(other, 'hub', 'status', '--json'))).stdout).pid, otherHub.discovery.pid);
    await wait('stale discovery removed', () => assert.rejects(stat(file), { code: 'ENOENT' }));
  }
});

test('CLAND_HUB_FILE selects the named hub from another project, including a copied discovery file', async (t) => {
  const { wait, fixtures } = caseDeadlines(t);
  const root = await wait('create temporary project', () => tempProject(fixtures));
  const other = await wait('create temporary project', () => tempProject(fixtures));
  const { discovery } = await wait('start hub process', () => startDaemon(fixtures, root));
  const otherHub = await wait('start project hub', () => projectHub(fixtures, other, {}, { clock: new FakeClock(), harnesses: 'fake' }));
  ok(await wait('CLI task create --size', () => cland(root, 'task', 'create', '--size', 'M', 'Target item')));
  const coord = await wait('connect coordinator spoke', () => inProcessSpoke(fixtures, { discover: true, cwd: root, name: 'coord', role: 'coordinator' }));
  fixtures.after(() => wait('coordinator spoke close', () => coord.close()));
  await wait('coordinator presence', () => coord.waitForPresence(['coord']));
  ok(await wait('CLI role set alpha', () => cland(root, 'role', 'set', 'alpha', 'implementer')));
  ok(await wait('CLI role set beta', () => cland(root, 'role', 'set', 'beta', 'qa')));
  const asked = await wait('coordinator ask', () => coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Which hub?', options: ['this one'] }));
  assert.equal(asked.ok, true);
  const copied = join(other, 'discovery.json');
  await wait('copy discovery file', () => copyFile(join(root, '.cland', 'hub.json'), copied));

  for (const file of [join(root, '.cland', 'hub.json'), 'discovery.json']) {
    const env = { CLAND_HUB_FILE: file };
    const status = JSON.parse(ok(await wait(`CLI hub status --json via ${file}`, () => clandWithEnv(other, env, 'hub', 'status', '--json'))).stdout) as { root: string; pid: number };
    assert.equal(status.root, root);
    assert.equal(status.pid, discovery.pid);
    assert.match(ok(await wait(`CLI hub status via ${file}`, () => clandWithEnv(other, env, 'hub', 'status'))).stdout, new RegExp(`^hub running for ${root}`));
    ok(await wait(`CLI task comment T-1 via ${file}`, () => clandWithEnv(other, env, 'task', 'comment', 'T-1', 'Through the named hub')));
    assert.match(ok(await wait(`CLI task view T-1 via ${file}`, () => cland(root, 'task', 'view', 'T-1'))).stdout, /Through the named hub/);
    assert.match(ok(await wait(`CLI hub unmute alpha via ${file}`, () => clandWithEnv(other, env, 'hub', 'unmute', 'alpha', 'beta'))).stdout, /was not muted/);
    const started = ok(await wait(`CLI hub start via ${file}`, () => clandWithEnv(other, env, 'hub', 'start')));
    assert.match(started.stdout, new RegExp(`hub already running for ${other}`));
    assert.match(started.stdout, new RegExp(`pid +${otherHub.discovery.pid}\\b`));
  }
  const env = { CLAND_HUB_FILE: copied };
  ok(await wait('CLI topic answer 1', () => clandWithEnv(other, env, 'topic', 'answer', asked.ask, '1')));
  await wait('coordinator answer event', () => coord.waitForEvent((e) => e.params.meta?.answer_to === asked.ask));
  const imported = JSON.parse(ok(await wait('CLI task import-github --repo', () => clandWithEnv(other, {
    ...env,
    PATH: `${fileURLToPath(new URL('./fixtures/fake-gh', import.meta.url))}:${process.env.PATH ?? ''}`,
    FAKE_GH_FIXTURE: fileURLToPath(new URL('./fixtures/github-acme-widgets.json', import.meta.url)),
  }, 'task', 'import-github', '--repo', 'acme/widgets', '--json'))).stdout) as { created: number };
  assert.equal(imported.created, 4);
  assert.deepEqual(JSON.parse(ok(await wait('CLI task list --json', () => cland(other, 'task', 'list', '--json'))).stdout), { items: [] });

  // Explicit absent/invalid files must fail rather than silently selecting the cwd's running hub.
  const invalid = join(other, 'invalid.json');
  await wait('write fixture file', () => writeFile(invalid, '{}'));
  for (const file of [join(other, 'absent.json'), invalid]) {
    assert.equal((await wait('CLI hub status --json', () => clandWithEnv(other, { CLAND_HUB_FILE: file }, 'hub', 'status', '--json'))).code, 1);
  }
  // A live legacy discovery still supplies its root through a successful status probe.
  const liveLegacy = JSON.parse(await wait('read fixture file', () => readFile(copied, 'utf8'))) as { root?: string };
  delete liveLegacy.root;
  await wait('write fixture file', () => writeFile(copied, JSON.stringify(liveLegacy)));
  ok(await wait('CLI hub stop', () => clandWithEnv(other, env, 'hub', 'stop')));
  assert.equal((await wait('CLI hub status', () => cland(root, 'hub', 'status'))).code, 1);
  assert.equal(JSON.parse(ok(await wait('CLI hub status --json', () => cland(other, 'hub', 'status', '--json'))).stdout).pid, otherHub.discovery.pid);
});
