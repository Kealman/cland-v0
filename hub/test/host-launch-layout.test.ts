// T2: record the native launch boundary without starting any harness process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { ClaudeCodeAdapter, MOD_DIR } from '../src/adapters/claude-code.ts';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import { localHost } from '../src/host/local.ts';
import type { HostCommand, HostLaunchLayoutInput } from '../src/host/host.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';

for (const mask of [0o022, 0o002]) for (const mapped of [false, true]) for (const [name, Adapter] of Object.entries({ claude: ClaudeCodeAdapter, codex: CodexAdapter, opencode: OpenCodeAdapter })) {
  test(`${mapped ? 'mapped Host' : 'local'} ${name} launch preserves baseline argv, environment and file bytes/modes (umask ${mask.toString(8)})`, async t => {
    const root = await tempProject(t);
    const env = fixtureEnvironment(root, {}, { PATH: '/fixture/bin' });
    const disk: Record<string, { mode: number; bytes: string }> = {};
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) await walk(path);
        else disk[relative(root, path)] = { mode: (await stat(path)).mode & 0o777, bytes: await readFile(path, 'utf8') };
      }
    };
    let captured: unknown;
    const record = async (command: HostCommand): Promise<never> => {
      await walk(mapped ? join(root, 'host') : join(root, '.cland'));
      captured = { command, disk };
      throw new Error('recorded launch boundary');
    };
    const machine = { ...localHost(env), name: mapped && name !== 'opencode' ? 'recording' : 'local',
      layout: (input: HostLaunchLayoutInput) => mapped ? { discoveryFile: join(root, 'host/hub.json'), node: '/host/node', cli: '/host/cli', spoke: '/host/spoke', modDir: '/host/mod', runDirectory: join(root, 'host/runtime'), logDirectory: join(root, 'host/logs') } : localHost(env).layout(input),
      freePort: async () => 43210,
      run: async (command: HostCommand) => command.args[0] === '--version' ? { code: 0, stdout: 'codex 0.160.0', stderr: '' } : record(command), spawn: record };
    const host: AdapterHost = { root, discoveryFile: join(root, '.cland/hub.json'), node: '/fixture/node', cli: '/fixture/cli', spoke: '/fixture/spoke', hostForLaunch: () => machine, log: () => {}, signal: () => {}, exited: () => {}, recordPid: () => {} };
    const adapter = new Adapter(host, { env, bin: '/fixture/harness', pollMs: 600_000 });
    const previousUmask = process.umask(mask);
    try {
      await assert.rejects(adapter.spawn({ name: 'worker', sessionId: 'fixture-session', role: 'implementer', model: null, cwd: root, accountEnv: { OPENCODE_DB: join(root, 'account/opencode.db') } }), /recorded launch boundary/);
      assert.ok(captured);
      const normalized = JSON.stringify(captured, null, 2).replaceAll(root, '<ROOT>').replaceAll(MOD_DIR, '<MOD>').replaceAll(await realpath(tmpdir()), '<TMP>').replaceAll(root.replaceAll('/', '\\/'), '<ROOT>')
        .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g, '<UUID>');
      const value = JSON.parse(normalized) as { command: HostCommand; disk: typeof disk };
      if (name === 'opencode') {
        const password = value.command.env.OPENCODE_PASSWORD!;
        assert.match(password, /^[A-Za-z0-9_-]{32}$/);
        const serialized = JSON.stringify(value).replaceAll(password, '<PASSWORD>');
        captured = JSON.parse(serialized);
      } else captured = value;
      const baseline = new URL(`./fixtures/host-launch-${name}.json`, import.meta.url);
      let expected = await readFile(baseline, 'utf8');
      if (!mapped && name === 'codex' && Buffer.byteLength(join(root, '.cland/run/cx-fixturesessi.sock')) <= 100) expected = expected.replaceAll('<TMP>/cland-run/cx-fixturesessi.sock', '<ROOT>/.cland/run/cx-fixturesessi.sock');
      if (mapped) expected = expected.replaceAll('<MOD>', '/host/mod').replaceAll('<TMP>/cland-run/', '<ROOT>/host/runtime/').replaceAll('<ROOT>/.cland/run', '<ROOT>/host/runtime').replaceAll('<ROOT>/.cland/log', '<ROOT>/host/logs')
        .replaceAll('<ROOT>/.cland', '<ROOT>/host').replaceAll('.cland/run', 'host/runtime').replaceAll('.cland/opencode', 'host/opencode')
        .replaceAll('/fixture:/fixture/bin', '/host:/fixture/bin').replaceAll('/fixture/node', '/host/node').replaceAll('/fixture/cli', '/host/cli').replaceAll('/fixture/spoke', '/host/spoke');
      const baselineValue = JSON.parse(expected) as { disk: typeof disk };
      if (name === 'opencode' && mask === 0o002) {
        const prefix = mapped ? 'host' : '.cland';
        baselineValue.disk[`${prefix}/opencode/.gitignore`]!.mode = 0o664;
        baselineValue.disk[`${prefix}/opencode/worker/opencode.json`]!.mode = 0o664;
      }
      assert.deepEqual(captured, baselineValue);
    } finally { process.umask(previousUmask); await adapter.close(); }
  });
}

test('OpenCode password reads use the supplied Host', async () => {
  const { readPassword, serverFiles } = await import('../src/adapters/opencode/server.ts');
  const reads: string[] = [];
  const machine = { ...localHost(), name: 'recording', readFile: async (path: string) => { reads.push(path); return Buffer.from('remote-password\n'); } };
  assert.equal(await readPassword(serverFiles('/host', 'worker'), undefined, machine), 'remote-password');
  assert.deepEqual(reads, ['/host/opencode/worker/password']);
});

test('nonlocal file replacement refuses missing rollback metadata and new files undo through their Host', async () => {
  const { LaunchFiles } = await import('../src/adapters/launch-files.ts');
  const writes: string[] = [];
  const removed: string[] = [];
  const machine = { ...localHost(), name: 'recording', fileType: async (path: string) => path === '/existing' ? 'file' as const : 'missing' as const,
    writeFile: async (path: string) => { writes.push(path); }, removePath: async (path: string) => { removed.push(path); } };
  const files = new LaunchFiles(undefined, machine);
  await assert.rejects(files.write('/existing', Buffer.from('new')), /T-1644/);
  await files.write('/new', Buffer.from('new'));
  await files.rollback();
  assert.deepEqual(writes, ['/new']);
  assert.deepEqual(removed, ['/new']);
});

test('nonlocal OpenCode shared-ignore preparation refuses the unsupported atomic boundary', async t => {
  const { prepareFiles, serverFiles } = await import('../src/adapters/opencode/server.ts');
  const { LaunchFiles } = await import('../src/adapters/launch-files.ts');
  const root = await tempProject(t);
  const machine = { ...localHost(), name: 'remote' };
  const files = new LaunchFiles(undefined, machine);
  try { await assert.rejects(prepareFiles(root, serverFiles(root, 'worker'), {}, true, files, undefined, undefined, machine), /T-1644/); }
  finally { await files.rollback(); }
});

test('Claude nonlocal layout without a mod directory refuses before native launch', async t => {
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, {});
  const machine = { ...localHost(env), name: 'remote', layout: (input: HostLaunchLayoutInput) => ({ ...input, runDirectory: '/remote/run', logDirectory: '/remote/log' }), run: async () => { assert.fail('no native launch'); } };
  const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '/node', cli: '/cli', spoke: '/spoke', hostForLaunch: () => machine, log: () => {}, signal: () => {}, exited: () => {}, recordPid: () => {} };
  const adapter = new ClaudeCodeAdapter(host, { env, bin: '/fixture/claude' });
  try { await assert.rejects(adapter.spawn({ name: 'worker', role: null, model: null, cwd: root }), /remote layout has no mod directory yet/); }
  finally { await adapter.close(); }
});
