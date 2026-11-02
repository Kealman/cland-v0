// T2: Codex sandbox serialization through the public threadPolicy/Host seam.
// Lifecycle: disposable files only; no native process or browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { CodexAdapter, threadPolicy } from '../src/adapters/codex.ts';
import { localHost } from '../src/host/local.ts';
import type { Host, HostCommand } from '../src/host/host.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { ScriptedCodex } from './fakes/scripted-codex.ts';
import { tempProject } from './harness.ts';

const fixture = new URL('./fixtures/codex-sandbox-local.json', import.meta.url);

test('local Codex policies retain the captured byte-identical overrides', async t => {
  const root = await tempProject(t);
  const canonical = await realpath(root);
  const temp = await realpath(tmpdir());
  await mkdir(join(root, '.git/worktrees/task'), { recursive: true });
  await mkdir(join(root, 'task'));
  await writeFile(join(root, 'task/.git'), 'gitdir: ../.git/worktrees/task\n');
  await symlink(root, join(root, 'alias'));
  const results = [];
  for (const [cwd, writable, network] of [
    [root, root, 'none'],
    [join(root, 'task'), root, 'none'],
    [join(root, 'alias/task'), join(root, 'alias'), 'none'],
    [join(root, 'task'), root, 'local'],
  ] as const) {
    results.push(await threadPolicy({ discoveryFile: join(root, '.cland/hub.json') }, cwd, {
      sandbox: { mode: 'workspace-write', writableRoots: [writable], network },
    }));
  }
  const bytes = JSON.stringify(results, null, 2).replaceAll(canonical, '<root>').replaceAll(temp, '<temp>') + '\n';
  assert.equal(bytes, await readFile(fixture, 'utf8'));
});

test('Codex takes roots, linked git bytes and socket paths from the selected Host', async t => {
  const root = await tempProject(t);
  const calls: string[] = [];
  const machine: Host = {
    ...localHost(fixtureEnvironment(root, process.env)),
    name: 'mapped',
    async realpath(path) {
      calls.push(`real:${path}`);
      if (path === root) return '/host/project';
      if (path === join(root, '.cland')) return '/host/state';
      if (path === join(root, 'task')) return '/host/task';
      if (path === tmpdir()) return '/host/temp';
      if (path === join(root, '.git/worktrees/task')) return '/host/project/.git/worktrees/task';
      throw new Error(`unexpected realpath: ${path}`);
    },
    async statDirectory(path) {
      calls.push(`stat:${path}`);
      assert.equal(path, '/host/project/.git');
      return { refusal: null, identity: { dev: 1, ino: 2 } };
    },
    async readFile(path) {
      calls.push(`read:${path}`);
      assert.equal(path, join(root, 'task/.git'));
      return Buffer.from('gitdir: ../.git/worktrees/task\n');
    },
  };
  const result = await threadPolicy({ discoveryFile: join(root, '.cland/hub.json') }, join(root, 'task'), {
    sandbox: { mode: 'workspace-write', writableRoots: [root], network: 'local' },
  }, undefined, machine);
  assert.deepEqual(result, {
    thread: { approvalPolicy: 'never', permissions: 'cland' },
    overrides: [
      'default_permissions="cland"',
      'permissions.cland={"extends"=":workspace","filesystem"={"/host/project"="write","/host/project/.git"="write","/host/project/.git/worktrees/task"="write"},"network"={"enabled"=true,"allow_local_binding"=true,"unix_sockets"={"/host/state"="allow","/host/task"="allow","/host/temp"="allow","/host/state/run"="deny","/host/temp/cland-run"="deny"}}}',
      'features.network_proxy=true',
    ],
  });
  for (const expected of [`real:${root}`, `real:${join(root, 'task')}`, `real:${join(root, '.cland')}`, `real:${tmpdir()}`, `stat:/host/project/.git`, `read:${join(root, 'task/.git')}`, `real:${join(root, '.git/worktrees/task')}`])
    assert.ok(calls.includes(expected), expected);
});

test('spawn and relaunch serialize the captured session Host policy', async t => {
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, process.env);
  const commands: HostCommand[] = [];
  const machine: Host = {
    ...localHost(env), name: 'mapped',
    async statDirectory() { return { refusal: null, identity: { dev: 1, ino: 2 } }; },
    async realpath() { return '/host/project'; },
    async readFile() { throw new Error('no linked worktree'); },
    async run() { return { code: 0, stdout: 'codex 0.160.0', stderr: '' }; },
    async spawn(command) { commands.push(command); return { pid: 987654, exited: new Promise(() => {}) }; },
    async identity(pid) { return { pid, pidStarted: 'start', pidIdentity: 'birth' }; },
    async alive() { return false; },
    async stop() { return true; },
  };
  const natives: ScriptedCodex[] = [];
  const adapter = new CodexAdapter({
    root, discoveryFile: join(root, '.cland/hub.json'), node: process.execPath, cli: '', spoke: 'spoke.ts',
    log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {},
    hostForLaunch: () => machine, hostForProcess: () => machine,
  }, { env, connect: async () => {
    const native = new ScriptedCodex();
    native.thread = 'host-thread';
    native.handlers.set('thread/start', () => ({ thread: { id: native.thread, status: { type: 'idle' } } }));
    natives.push(native);
    return native;
  } });
  t.after(() => adapter.close());
  const sandbox = { mode: 'workspace-write' as const, writableRoots: [root], network: 'none' as const };
  const row = await adapter.spawn({ name: 'worker', role: null, model: null, cwd: root, sandbox });
  const resumed = await adapter.resume(row, { relaunch: true, policy: { sandbox } });
  assert.equal(resumed.found, true);
  assert.equal(commands.length, 2);
  const expected = 'permissions.cland={"extends"=":workspace","filesystem"={"/host/project"="write","/host/project/.git"="write"}}';
  for (const command of commands) assert.ok(command.args.includes(expected));
  assert.equal(natives[0]!.calls.find(call => call.method === 'thread/start')?.params.permissions, 'cland');
  assert.equal(natives[1]!.calls.find(call => call.method === 'thread/resume')?.params.permissions, 'cland');
});
