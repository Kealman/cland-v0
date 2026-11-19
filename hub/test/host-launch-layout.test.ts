// T2: record the native launch boundary without starting any harness process.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readdir, readFile, realpath, stat, writeFile, lstat } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { ClaudeCodeAdapter, MOD_DIR } from '../src/adapters/claude-code.ts';
import { CodexAdapter } from '../src/adapters/codex.ts';
import { OpenCodeAdapter } from '../src/adapters/opencode.ts';
import { recordingHost } from './recording-host.ts';
import type { HostCommand, HostLaunchLayoutInput } from '../src/host/host.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';
import { tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { enableFixtureHostSockets, removeFixtureSockets } from '../../shared/fixture-sockets.ts';
import { fileOperations } from '../src/host/agent/files.ts';
import { residueControl } from './fixture-residue-control.ts';

test('failed Codex launch keeps its placeholder beneath the owned root', t => residueControl(t).run(async c => {
  const parent = await c.root(), root = join(parent, 'deep'.repeat(40));
  await c.step('deep root setup', () => mkdir(root));
  const previousTmp = process.env.TMPDIR;
  c.restore(() => { if (previousTmp === undefined) delete process.env.TMPDIR; else process.env.TMPDIR = previousTmp; });
  process.env.TMPDIR = parent;
  let disable: (() => void) | undefined;
  c.restore(() => disable?.());
  await c.step('socket opt-in setup', async () => { disable = enableFixtureHostSockets(root); });
  let socket = '';
  const machine = recordingHost(root, { overrides: {
    ...fileOperations,
    run: async () => ({ code: 0, stdout: 'codex 0.160.0', stderr: '' }),
    spawn: async command => {
      socket = command.args.find(arg => arg.startsWith('unix://'))!.slice(7);
      assert.ok((await realpath(dirname(socket))).startsWith(root + '/'), socket);
      await writeFile(socket, 'socket placeholder');
      throw new Error('planted launch failure');
    },
  } });
  const host: AdapterHost = { root, discoveryFile: join(root, '.cland/hub.json'), node: '/fixture/node', cli: '/fixture/cli', spoke: '/fixture/spoke', hostForLaunch: () => machine, log: () => {}, signal: () => {}, exited: () => {}, recordPid: () => {} };
  const adapter = await c.acquire('adapter setup', () => new CodexAdapter(host, { env: fixtureEnvironment(root, {}), bin: '/fixture/codex' }), value => value.close());
  await c.step('failed native boundary receipt', () => assert.rejects(adapter.value.spawn({ name: 'worker', sessionId: 'placeholder', role: null, model: null, cwd: root }), /planted launch failure/));
  assert.ok(socket);
  await c.step('adapter closure', adapter.close);
  await c.step('socket disposal', () => removeFixtureSockets(root));
  await c.step('socket removal observation', () => assert.rejects(lstat(socket), { code: 'ENOENT' }));
}));

for (const mask of [0o022, 0o002]) for (const mapped of [false, true]) for (const [name, Adapter] of Object.entries({ claude: ClaudeCodeAdapter, codex: CodexAdapter, opencode: OpenCodeAdapter })) {
  test(`${mapped ? 'mapped Host' : 'local'} ${name} launch preserves baseline argv, environment and file bytes/modes (umask ${mask.toString(8)})`, async t => {
    const root = await tempProject(t, 'cx-', '/tmp');
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
      if (mapped && name === 'claude') {
        const settings = command.args[command.args.indexOf('--settings') + 1]!;
        assert.equal((await stat(dirname(settings))).mode & 0o777, 0o700);
        for (const flag of ['--settings', '--mcp-config']) assert.equal((await stat(command.args[command.args.indexOf(flag) + 1]!)).mode & 0o777, 0o600);
      }
      await walk(mapped ? join(root, 'host') : join(root, '.cland'));
      captured = { command, disk };
      throw Object.assign(new Error('recorded launch boundary'), mapped && name === 'claude' ? { code: 'CLAND_AGENT_ADMISSION_REFUSED' } : {});
    };
    const machine = { ...recordingHost(root), name: mapped ? 'recording' : 'local',
      layout: (input: HostLaunchLayoutInput) => mapped ? { discoveryFile: join(root, 'host/hub.json'), node: '/host/node', cli: '/host/cli', spoke: '/host/spoke', modDir: '/host/mod', runDirectory: join(root, 'host/runtime'), logDirectory: join(root, 'host/logs') } : recordingHost(root).layout(input),
      freePort: async () => 43210,
      ...(mapped && name === 'claude' ? { launchClaude: record } : {}),
      run: async (command: HostCommand) => command.args[0] === '--version' ? { code: 0, stdout: 'codex 0.160.0', stderr: '' } : record(command), spawn: record };
    const host: AdapterHost = { root, discoveryFile: join(root, '.cland/hub.json'), node: '/fixture/node', cli: '/fixture/cli', spoke: '/fixture/spoke', hostForLaunch: () => machine, ...(mapped && name === 'claude' ? { hostForProcess: () => machine } : {}), log: () => {}, signal: () => {}, exited: () => {}, recordPid: () => {} };
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
      const baselineValue = JSON.parse(expected) as { disk: typeof disk; command: HostCommand };
      if (mapped) {
        baselineValue.command.env = name === 'opencode' ? {CLAND_HUB_FILE:'<ROOT>/host/hub.json',CLAND_ROLE:'implementer',CLAND_SESSION_ID:'fixture-session',CLAND_SESSION_NAME:'worker',OPENCODE_DB:'<ROOT>/account/opencode.db',OPENCODE_CONFIG:'<ROOT>/host/opencode/worker/opencode.json',OPENCODE_PASSWORD:'<PASSWORD>'} : name === 'claude' ? {
          OPENCODE_DB: '<ROOT>/account/opencode.db', DISABLE_AUTOUPDATER: '1',
        } : {
          OPENCODE_DB: '<ROOT>/account/opencode.db', CLAND_SESSION_ID: 'fixture-session', CLAND_SESSION_NAME: 'worker', CLAND_ROLE: 'implementer',
        };
      }
      if (name === 'opencode' && mask === 0o002) {
        const prefix = mapped ? 'host' : '.cland';
        baselineValue.disk[`${prefix}/opencode/.gitignore`]!.mode = 0o664;
        baselineValue.disk[`${prefix}/opencode/worker/opencode.json`]!.mode = 0o664;
      }
      assert.deepEqual(captured, baselineValue);
    } finally { process.umask(previousUmask); await adapter.close(); }
  });
}

test('OpenCode password reads use the supplied Host', async t => {
  const root = await tempProject(t);
  const { readPassword, serverFiles } = await import('../src/adapters/opencode/server.ts');
  const reads: string[] = [];
  const machine = { ...recordingHost(root), name: 'recording', readFile: async (path: string) => { reads.push(path); return Buffer.from('remote-password\n'); } };
  assert.equal(await readPassword(serverFiles('/host', 'worker'), undefined, machine), 'remote-password');
  assert.deepEqual(reads, ['/host/opencode/worker/password']);
});

test('nonlocal rollback restores overwritten bytes and mode and truncates appended logs', async t => {
  const { LaunchFiles } = await import('../src/adapters/launch-files.ts');
  const { writeFile } = await import('node:fs/promises');
  const root = await tempProject(t); const path = join(root, 'existing');
  await writeFile(path, 'before', {mode: 0o640});
  const machine = {...recordingHost(root), name: 'remote'};
  const files = new LaunchFiles(undefined, machine);
  await files.write(path, Buffer.from('after'), 0o600);
  await files.rollback();
  assert.equal(await readFile(path, 'utf8'), 'before');
  assert.equal((await stat(path)).mode & 0o777, 0o640);
  const logs = new LaunchFiles(undefined, machine); await logs.file(path, true);
  await machine.appendFile(path, Buffer.from('tail')); await logs.rollback();
  assert.equal(await readFile(path, 'utf8'), 'before');
});

test('nonlocal OpenCode prepares shared ignore through supplied Host', async t => {
  const { prepareFiles, serverFiles } = await import('../src/adapters/opencode/server.ts');
  const { LaunchFiles } = await import('../src/adapters/launch-files.ts');
  const root = await tempProject(t, 'cx-', '/tmp');
  const machine = { ...recordingHost(root), name: 'remote' };
  const files = new LaunchFiles(undefined, machine);
  await prepareFiles(root, serverFiles(root, 'worker'), {}, true, files, undefined, undefined, machine);
  assert.equal(await readFile(join(root, 'opencode/.gitignore'), 'utf8'), '# managed by cland: generated OpenCode configs and server passwords, never committed\n*\n');
  await files.rollback();
});

test('Claude nonlocal layout without a mod directory refuses before native launch', async t => {
  const root = await tempProject(t, 'cx-', '/tmp');
  const env = fixtureEnvironment(root, {});
  const machine = { ...recordingHost(root), name: 'remote', layout: (input: HostLaunchLayoutInput) => ({ ...input, runDirectory: '/remote/run', logDirectory: '/remote/log' }), run: async () => { assert.fail('no native launch'); } };
  const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '/node', cli: '/cli', spoke: '/spoke', hostForLaunch: () => machine, log: () => {}, signal: () => {}, exited: () => {}, recordPid: () => {} };
  const adapter = new ClaudeCodeAdapter(host, { env, bin: '/fixture/claude' });
  try { await assert.rejects(adapter.spawn({ name: 'worker', role: null, model: null, cwd: root }), /remote layout has no mod directory yet/); }
  finally { await adapter.close(); }
});

for (const existing of [false, true]) test(`OpenCode ignore preserves concurrent editor bytes (${existing ? 'before read' : 'at publish'})`, async t => {
  const {prepareIgnore} = await import('../src/adapters/opencode/ignore.ts');
  const {writeFile, readdir} = await import('node:fs/promises');
  const {untimed} = await import('../src/adapters/continuations.ts');
  const root = await tempProject(t), path = join(root, '.gitignore');
  const machine = recordingHost(root); let publishCalls = 0;
  if (existing) await writeFile(path, 'user-rule');
  const host = {...machine, name: 'remote', publishFile: async (...args: Parameters<typeof machine.publishFile>) => {
    publishCalls++; await writeFile(path, 'user-rule'); return machine.publishFile(...args);
  }};
  await prepareIgnore(root, untimed, () => {}, host);
  assert.equal(publishCalls, existing ? 0 : 1);
  assert.equal(await readFile(path, 'utf8'), 'user-rule\n*\n');
  assert.deepEqual((await readdir(root)).filter(n => n.startsWith('.stage-')), []);
});
