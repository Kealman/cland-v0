// T2: launch settings and environment through the production adapter's recorded CLI boundary.
// Settings use temporary files; the command edge stays entirely in memory.
// T2 pending T-682: T1 lint matches the mocked child_process import and adapter timer setup;
// no child, socket or wall-clock wait is used. The real binary frame stays in the contract file.
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { readFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import type { AdapterHost, HarnessProcess } from '../src/adapters/contract.ts';
import { parseRoles } from '../src/roles/config.ts';
import { rolesTemplate } from '../src/roles/template.ts';
import { installedHarnesses } from '../src/doctor/harnesses.ts';
import { FakeClock } from './fake-clock.ts';
import { eventually } from './harness.ts';

test('Claude launch settings defer to either project settings file', { timeout: 2000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-claude-settings-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls: string[][] = [];
  t.mock.method(cp, 'execFile', (_bin: string, args: string[], _options: cp.ExecFileOptions, callback: (error: null, stdout: string, stderr: string) => void) => {
    calls.push(args);
    queueMicrotask(() => callback(null, args[0] === 'agents' ? '[]' : 'claude attach abcdef12', ''));
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '/fixture/node', cli: '/fixture/cland', spoke: '/fixture/spoke', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} };
  const adapter = new ClaudeCodeAdapter(host, { clock: new FakeClock(), agentsMs: 0, env: { HOME: root } });
  try {
    await mkdir(join(root, '.claude'));
    const settingsFile = join(root, '.claude/settings.json');
    const localFile = join(root, '.claude/settings.local.json');
    const cases = [
      { name: 'missing', settings: undefined, local: undefined, fallback: true },
      { name: 'unrelated worktree setting', settings: '{"worktree":{"baseRef":"fresh"}}', local: '{}', fallback: true },
      { name: 'project key', settings: '{"worktree":{"bgIsolation":"none"}}', local: undefined, fallback: false },
      { name: 'local override', settings: '{}', local: ' { "worktree": { "bgIsolation": "worktree" } }\n', fallback: false },
      { name: 'both keys', settings: '{"worktree":{"bgIsolation":"none"}}', local: '{"worktree":{"bgIsolation":"worktree"}}', fallback: false },
      { name: 'null is an explicit key', settings: '{"worktree":{"bgIsolation":null}}', local: undefined, fallback: false },
      { name: 'malformed files', settings: '{', local: '[', fallback: true },
      { name: 'non-object values', settings: 'null', local: '{"worktree":null}', fallback: true },
      { name: 'malformed project with local override', settings: '{', local: '{"worktree":{"bgIsolation":"worktree"}}', fallback: false },
    ];
    for (const row of cases) {
      for (const [path, content] of [[settingsFile, row.settings], [localFile, row.local]] as const) {
        if (content === undefined) await rm(path, { force: true });
        else await writeFile(path, content);
      }
      calls.length = 0;
      await adapter.spawn({ name: 'plain', cwd: root, role: null, model: null });
      const args = calls.find(args => args[0] === '--bg')!;
      const settings = JSON.parse(readFileSync(args[args.indexOf('--settings') + 1]!, 'utf8'));
      assert.deepEqual(settings.worktree, row.fallback ? { bgIsolation: 'none' } : undefined, row.name);
      assert.ok(settings.hooks.SessionStart, 'hooks survive');
      assert.deepEqual(settings.hooks.PreToolUse, [{ matcher: 'Bash', hooks: [{
        type: 'command', command: "'/fixture/node' '/fixture/cland' 'hook' 'literal-rm' '--session' 'plain' '--launch' '" + settings.env.CLAND_LAUNCH_ID + "' '--hub-file' '" + host.discoveryFile + "'", timeout: 10,
      }] }], 'launch injects the same synchronous Bash guard');
      assert.equal(settings.env.CLAND_SESSION_NAME, 'plain');
      if (row.settings !== undefined) assert.equal(await readFile(settingsFile, 'utf8'), row.settings);
      if (row.local !== undefined) assert.equal(await readFile(localFile, 'utf8'), row.local);
    }
    // A directory at the settings path is deterministically unreadable as JSON, even under root.
    await rm(settingsFile);
    await rm(localFile);
    await mkdir(settingsFile);
    await mkdir(localFile);
    calls.length = 0;
    await adapter.spawn({ name: 'plain', cwd: root, role: null, model: null });
    const args = calls.find(args => args[0] === '--bg')!;
    assert.deepEqual(JSON.parse(readFileSync(args[args.indexOf('--settings') + 1]!, 'utf8')).worktree, { bgIsolation: 'none' });
  } finally { adapter.close(); }
});

test('Claude rereads task worktree settings on launch and resume', { timeout: 2000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-claude-cwd-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cwd = join(root, 'task');
  await mkdir(join(root, '.claude'));
  await mkdir(join(cwd, '.claude'), { recursive: true });
  const projectFile = join(root, '.claude/settings.json');
  const taskFile = join(cwd, '.claude/settings.local.json');
  await writeFile(projectFile, '{"worktree":{"bgIsolation":"worktree"}}');
  const calls: string[][] = [];
  t.mock.method(cp, 'execFile', (_bin: string, args: string[], options: cp.ExecFileOptions, callback: (error: null, stdout: string, stderr: string) => void) => {
    if (args[0] === '--bg') { assert.equal(options.cwd, cwd); calls.push(args); }
    queueMicrotask(() => callback(null, args[0] === 'agents' ? '[]' : 'claude attach abcdef12', ''));
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '/fixture/node', cli: '/fixture/cland', spoke: '/fixture/spoke', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} };
  const adapter = new ClaudeCodeAdapter(host, { clock: new FakeClock(), agentsMs: 0, env: { HOME: root } });
  const settings = () => {
    const args = calls.at(-1)!;
    return JSON.parse(readFileSync(args[args.indexOf('--settings') + 1]!, 'utf8'));
  };
  try {
    const request = { name: 'impl', cwd, role: 'implementer', item: 'T-1', model: null };
    const launched = await adapter.spawn(request);
    assert.deepEqual(settings().worktree, { bgIsolation: 'none' }, 'root key does not suppress the task fallback');
    assert.ok(settings().hooks.WorktreeCreate, 'task worktree refusal remains installed');
    await writeFile(projectFile, '{}');
    const local = ' { "worktree": { "bgIsolation": "worktree" } }\n';
    await writeFile(taskFile, local);
    await adapter.spawn({ ...request, resumeConversation: 'native-conversation' });
    assert.ok(calls.at(-1)!.includes('--resume'));
    assert.equal(settings().worktree, undefined, 'fresh resume sees the new task override despite absent root key');
    assert.equal(await readFile(taskFile, 'utf8'), local);
    await rm(taskFile);
    const resumed = await adapter.resume({ ...launched, status: 'stopped' }, { relaunch: true });
    assert.equal(resumed.found, true);
    assert.ok(calls.at(-1)!.includes('--resume'));
    assert.deepEqual(settings().worktree, { bgIsolation: 'none' }, 'relaunch sees the removed override');
    await writeFile(taskFile, local);
    await adapter.resume({ ...launched, status: 'stopped' }, { relaunch: true });
    assert.equal(settings().worktree, undefined, 'relaunch sees a newly added override');
    assert.equal(await readFile(taskFile, 'utf8'), local);
    assert.equal(calls.length, 4);
  } finally { adapter.close(); }
});

test('Claude permission flags stay exclusive across launch, fresh resume and relaunch', { timeout: 2000 }, async t => {
  const calls: string[][] = [];
  t.mock.method(cp, 'execFile', (_bin: string, args: string[], _options: cp.ExecFileOptions, callback: (error: null, stdout: string, stderr: string) => void) => {
    calls.push(args);
    queueMicrotask(() => callback(null, args[0] === 'agents' ? '[]' : 'claude attach abcdef12', ''));
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const launchRoot = await mkdtemp(join(tmpdir(), 'cland-native-settings-'));
  t.after(() => rm(launchRoot, { recursive: true, force: true }));
  const host: AdapterHost = { root: '/fixture', discoveryFile: join(launchRoot, 'hub.json'), node: '/fixture/node', cli: '/fixture/cland', spoke: '/fixture/spoke', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} };
  const adapter = new ClaudeCodeAdapter(host, { agentsMs: 0, env: { HOME: '/fixture/home' } });
  try {
    for (const permissions of ['auto', 'skip', null, undefined] as const) {
      calls.length = 0;
      const policy = permissions === undefined ? {} : { permissions };
      const request = { name: 'plain', cwd: '/fixture', role: null, model: null, ...policy };
      const launched = await adapter.spawn(request);
      await adapter.stop(launched);
      await adapter.spawn({ ...request, resumeConversation: 'native-conversation' });
      const resumed = await adapter.resume({ ...launched, status: 'stopped' }, { relaunch: true, policy });
      assert.equal(resumed.found, true);
      const bg = calls.filter(args => args[0] === '--bg');
      assert.equal(bg.length, 3);
      assert.ok(!bg[0]!.includes('--resume'));
      assert.ok(bg[1]!.includes('--resume'));
      assert.ok(bg[2]!.includes('--resume'));
      for (const args of bg) {
        assert.equal(args.includes('--dangerously-skip-permissions'), permissions === 'skip');
        assert.equal(args.includes('--permission-mode'), permissions === 'auto');
        if (permissions === 'auto') assert.equal(args[args.indexOf('--permission-mode') + 1], 'auto');
      }
    }
  } finally { adapter.close(); }
});

test('Claude environment composition preserves implicit, pathless, pinned and inherited selections (T-603)', async t => {
  const home = '/fixture/home';
  const pinned = "/fixture/account's directory";
  const inherited = '/fixture/inherited';
  const calls: Array<{ args: string[]; env: NodeJS.ProcessEnv }> = [];
  let loggedOut = false;
  t.mock.method(cp, 'execFile', (_bin: string, args: string[], options: cp.ExecFileOptions, callback: (error: { code: number } | null, stdout: string, stderr: string) => void) => {
    calls.push({ args, env: { ...options.env } });
    queueMicrotask(() => callback(loggedOut && args[0] === '--bg' ? { code: 1 } : null, args[0] === 'agents' ? '[]' : 'claude attach abcdef12', loggedOut ? 'authentication expired' : ''));
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  for (const selection of ['unpinned', 'pathless account', 'pinned account', 'inherited directory'] as const) {
    calls.length = 0;
    loggedOut = false;
    const expected = selection === 'pinned account' ? pinned : selection === 'inherited directory' ? inherited : null;
    const events: Array<Record<string, unknown>> = [];
    const launchRoot = await mkdtemp(join(tmpdir(), 'cland-native-settings-'));
    t.after(() => rm(launchRoot, { recursive: true, force: true }));
    const host: AdapterHost = { root: '/fixture', discoveryFile: join(launchRoot, 'hub.json'), node: '/fixture/node', cli: '/fixture/cland', spoke: '/fixture/spoke', log: e => { events.push(e); }, signal: () => {}, recordPid: () => {}, exited: () => {} };
    const adapter = new ClaudeCodeAdapter(host, { agentsMs: 0, env: { HOME: home, ...(selection === 'inherited directory' ? { CLAUDE_CONFIG_DIR: inherited } : {}) } });
    try {
      const account = selection.includes('account') ? selection === 'pinned account' ? 'pinned' : 'pathless' : null;
      const request = { name: 'plain', cwd: '/fixture', role: null, model: null, account, ...(selection === 'pinned account' ? { accountEnv: { CLAUDE_CONFIG_DIR: pinned } } : {}) };
      const process = await adapter.spawn(request);
      assert.equal(process.status, 'running', selection);
      assert.equal(process.accountEnv?.CLAUDE_CONFIG_DIR ?? null, expected, selection);
      if (selection !== 'inherited directory') assert.equal(adapter.attachCommand(process).includes('CLAUDE_CONFIG_DIR='), expected !== null, selection);
      await adapter.stop(process);
      const resumed = await adapter.resume({ ...process, status: 'stopped' }, { relaunch: true });
      assert.equal(resumed.found, true, selection);
      await adapter.stop(process);
      const bg = calls.filter(c => c.args[0] === '--bg');
      assert.equal(bg.length, 2, 'launch and relaunch both reach the command boundary');
      assert.ok(bg[1]!.args.includes('--resume'), 'relaunch retains the native conversation');
      assert.ok(calls.some(c => c.args[0] === 'agents'), 'discovery uses the same environment');
      assert.ok(calls.some(c => c.args[0] === 'stop'));
      assert.ok(calls.every(c => (c.env.CLAUDE_CONFIG_DIR ?? null) === expected), selection);
      loggedOut = true;
      await assert.rejects(adapter.spawn({ ...request, name: 'failed' }), error => {
        assert.ok(error instanceof Error);
        if (account) {
          assert.ok(error.message.includes('claude auth login'));
          assert.ok(error.message.includes('trust the project'));
          assert.equal(error.message.includes('CLAUDE_CONFIG_DIR='), expected !== null);
        }
        return true;
      });
      const notice = events.find(e => e.event === 'claude-signed-out');
      assert.ok(notice, selection);
      assert.equal(notice.configDir, expected ?? join(home, '.claude'), 'bookkeeping retains its fallback');
      assert.ok(String(notice.login).includes('claude auth login'));
      assert.equal(String(notice.login).includes('CLAUDE_CONFIG_DIR='), expected !== null);
      if (selection === 'pinned account') assert.ok(String(notice.login).includes("account'\\''s directory"), 'remedies quote apostrophes');
    } finally { adapter.close(); }
  }
});

test('Claude relaunch repairs a pre-T-603 default-directory row without changing explicit account selections', async t => {
  const calls: Array<{ args: string[]; env: NodeJS.ProcessEnv }> = [];
  let rejectExplicitDefault = false;
  t.mock.method(cp, 'execFile', (_bin: string, args: string[], options: cp.ExecFileOptions, callback: (error: { code: number } | null, stdout: string, stderr: string) => void) => {
    calls.push({ args, env: { ...options.env } });
    const untrusted = rejectExplicitDefault && args[0] === '--bg' && options.env?.CLAUDE_CONFIG_DIR === '/fixture/home/.claude';
    queueMicrotask(() => callback(untrusted ? { code: 1 } : null, args[0] === 'agents' ? '[]' : 'claude attach abcdef12', untrusted ? 'Workspace not trusted' : ''));
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const launchRoot = await mkdtemp(join(tmpdir(), 'cland-native-settings-'));
  t.after(() => rm(launchRoot, { recursive: true, force: true }));
  const host: AdapterHost = { root: '/fixture', discoveryFile: join(launchRoot, 'hub.json'), node: '/fixture/node', cli: '/fixture/cland', spoke: '/fixture/spoke', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} };
  const legacy: HarnessProcess = {
    name: 'coord', harness: 'claude-code', account: null, accountEnv: { CLAUDE_CONFIG_DIR: '/fixture/home/.claude' },
    role: 'coordinator', model: null, cwd: '/fixture', pid: null, harnessId: 'old-background',
    sessionId: 'cland-session', harnessSessionId: 'native-conversation', startedAt: '2026-10-01T00:00:00.000Z', status: 'exited',
  };
  const cases = [
    { name: 'gone pid', process: { ...legacy, pid: 2147483647 }, inherited: undefined, expected: undefined, repair: true },
    { name: 'legacy default', process: legacy, inherited: undefined, expected: undefined, repair: true },
    { name: 'normalized default path', process: { ...legacy, accountEnv: { CLAUDE_CONFIG_DIR: '/fixture/home/.claude/.' } }, inherited: undefined, expected: undefined, repair: true },
    { name: 'named account at default path', process: { ...legacy, account: 'explicit-default' }, inherited: undefined, expected: '/fixture/home/.claude', repair: false },
    { name: 'other directory', process: { ...legacy, accountEnv: { CLAUDE_CONFIG_DIR: '/fixture/other' } }, inherited: undefined, expected: '/fixture/other', repair: false },
    { name: 'additional overlay', process: { ...legacy, accountEnv: { ...legacy.accountEnv, CUSTOM: 'kept' } }, inherited: undefined, expected: '/fixture/home/.claude', repair: false },
    { name: 'inherited directory', process: legacy, inherited: '/fixture/inherited', expected: '/fixture/inherited', repair: true },
    { name: 'explicit inherited default', process: legacy, inherited: '/fixture/home/.claude', expected: '/fixture/home/.claude', repair: false },
  ];
  for (const row of cases) {
    calls.length = 0;
    rejectExplicitDefault = row.repair;
    const adapter = new ClaudeCodeAdapter(host, { clock: new FakeClock(), agentsMs: 0, env: { HOME: '/fixture/home', ...(row.inherited ? { CLAUDE_CONFIG_DIR: row.inherited } : {}) } });
    try {
      const resumed = await adapter.resume(structuredClone(row.process), { relaunch: true });
      assert.equal(resumed.found, true, row.name);
      if (!resumed.found) continue;
      assert.equal(resumed.process.status, 'running', row.name);
      assert.equal(resumed.process.accountEnv?.CLAUDE_CONFIG_DIR, row.expected, row.name);
      assert.equal(resumed.process.accountEnv?.CUSTOM, row.name === 'additional overlay' ? 'kept' : undefined);
      assert.equal(resumed.process.account, row.process.account);
      const bg = calls.filter(c => c.args[0] === '--bg');
      assert.equal(bg.length, 1, row.name);
      assert.equal(bg[0]!.args[bg[0]!.args.indexOf('--resume') + 1], 'native-conversation');
      assert.ok(calls.some(c => c.args[0] === 'agents'), 'discovery reaches the fake CLI');
      const stopIndex = calls.findIndex(c => c.args[0] === 'stop');
      assert.ok(stopIndex >= 0, 'stale background handle is stopped');
      assert.equal(calls[stopIndex]!.args[1], 'old-background');
      assert.ok(stopIndex < calls.findIndex(c => c.args[0] === '--bg'), 'native stop precedes replacement launch');
      assert.ok(calls.every(c => c.env.CLAUDE_CONFIG_DIR === row.expected), row.name);
    } finally { adapter.close(); }
  }
});

test('an installer-only Claude selection launches the executable found outside PATH', { timeout: 2000 }, async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-claude-installer-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = join(root, '.local/bin/claude');
  await mkdir(join(root, '.local/bin'), { recursive: true });
  await writeFile(bin, '', { mode: 0o755 });
  const env = { HOME: root, XDG_CONFIG_HOME: join(root, 'config'), PATH: '' };
  const launch = parseRoles(rolesTemplate(installedHarnesses(env))).get('aide')!.launch;
  assert.equal(launch.harness, 'claude-code');
  const commands: string[] = [];
  t.mock.method(cp, 'execFile', (command: string, args: string[], _options: cp.ExecFileOptions, callback: (error: null, stdout: string, stderr: string) => void) => {
    commands.push(command);
    queueMicrotask(() => callback(null, args[0] === 'agents' ? '[]' : 'claude attach abcdef12', ''));
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '/fixture/node', cli: '/fixture/cland', spoke: '/fixture/spoke', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} };
  const adapter = new ClaudeCodeAdapter(host, { clock: new FakeClock(), agentsMs: 0, env });
  try {
    await adapter.spawn({ name: 'aide', cwd: root, role: 'aide', model: launch.model, effort: launch.effort, permissions: launch.permissions });
    assert.ok(commands.length > 0);
    assert.ok(commands.every(command => command === bin), `launched ${commands.join(', ')} instead of discovered ${bin}`);
  } finally { adapter.close(); }
});

test('Claude background settings carry only their own shell credential through launch and relaunch', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-claude-credential-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const calls: string[][] = [];
  t.mock.method(cp, 'execFile', (_bin: string, args: string[], _options: cp.ExecFileOptions, callback: (error: null, stdout: string, stderr: string) => void) => {
    calls.push(args);
    queueMicrotask(() => callback(null, args[0] === 'agents' ? '[]' : 'claude attach abcdef12', ''));
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '/fixture/node', cli: '/fixture/cland', spoke: '/fixture/spoke', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} };
  const adapter = new ClaudeCodeAdapter(host, { clock: new FakeClock(), agentsMs: 0, env: { HOME: root, CLAND_LAUNCH_TOKEN: 'unrelated-parent-credential' } });
  try {
    for (const name of ['one', 'two']) {
      const credential = `fixture-${name}-credential`;
      const launched = await adapter.spawn({ name, cwd: root, role: 'implementer', model: null, launchToken: credential });
      const resumed = await adapter.resume(launched, { relaunch: true, launchToken: credential });
      assert.equal(resumed.found, true);
      const bg = calls.filter(args => args[0] === '--bg' && args[args.indexOf('--name') + 1] === name);
      assert.notEqual(bg[0]![bg[0]!.indexOf('--settings') + 1], bg[1]![bg[1]!.indexOf('--settings') + 1]);
      assert.notEqual(bg[0]![bg[0]!.indexOf('--mcp-config') + 1], bg[1]![bg[1]!.indexOf('--mcp-config') + 1]);
      const settings = await Promise.all(bg.map(args => readFile(args[args.indexOf('--settings') + 1]!, 'utf8').then(bytes => JSON.parse(bytes))));
      assert.notEqual(settings[0].env.CLAND_LAUNCH_ID, settings[1].env.CLAND_LAUNCH_ID);
      assert.equal(settings[0].env.CLAND_SESSION_ID, settings[1].env.CLAND_SESSION_ID);
      for (const args of calls.filter(args => args[0] === '--bg' && args[args.indexOf('--name') + 1] === name)) {
        assert.equal(args.some(arg => arg.includes(credential)), false, 'credentials never enter argv');
        const settings = JSON.parse(await readFile(args[args.indexOf('--settings') + 1]!, 'utf8'));
        assert.equal(settings.env.CLAND_LAUNCH_TOKEN === credential, true, 'background shells inherit the owned credential');
        const mcp = JSON.parse(await readFile(args[args.indexOf('--mcp-config') + 1]!, 'utf8'));
        assert.equal(mcp.mcpServers.cland.env.CLAND_LAUNCH_TOKEN === credential, true, 'the own spoke receives the same credential');
      }
    }
  } finally { adapter.close(); }
});

test('Claude duplicate inspection requires two native job identities and shares concurrent native reads', async t => {
  let calls = 0;
  let entries = [{ id: 'own', sessionId: 'original', pid: 101 }, { id: 'other', sessionId: 'foreign', pid: 202 }];
  t.mock.method(cp, 'execFile', (_bin: string, args: string[], _options: cp.ExecFileOptions, callback: (error: null, stdout: string, stderr: string) => void) => {
    assert.equal(args[0], 'agents');
    calls++;
    queueMicrotask(() => callback(null, JSON.stringify(entries), ''));
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  const host: AdapterHost = { root: '/fixture', discoveryFile: '/fixture/hub.json', node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} };
  const adapter = new ClaudeCodeAdapter(host, { clock: new FakeClock(), env: { HOME: '/fixture' } });
  t.after(() => adapter.close());
  const process: HarnessProcess = { name: 'coord', harness: 'claude-code', role: null, model: null, cwd: '/fixture', pid: 101, harnessId: 'own', sessionId: 'stable', harnessSessionId: 'original', startedAt: '', status: 'running' };
  adapter.watch(process);
  const pair = await Promise.all([adapter.duplicateHarness(process, 'foreign'), adapter.duplicateHarness(process, 'foreign')]);
  assert.deepEqual(pair, [{ kind: 'duplicate', job: { id: 'other', pid: 202 } }, { kind: 'duplicate', job: { id: 'other', pid: 202 } }]);
  assert.equal(calls, 1);
  entries = [{ id: 'own', sessionId: 'cleared', pid: 101 }];
  assert.deepEqual(await adapter.duplicateHarness(process, 'cleared'), { kind: 'same-job' }, '/clear alone is not a second job');
  entries = [];
  assert.deepEqual(await adapter.duplicateHarness(process, 'foreign'), { kind: 'unavailable' }, 'missing captured job is not proof of a safe conversation change');
});

test('Claude relaunch retains the native job fence after failed stop and awaits held stop settlement', async t => {
  for (const pid of [null, 2147483647]) for (const stop of ['nonzero', 'throw', 'held', 'absent'] as const) await t.test(`${pid === null ? 'exited row' : 'gone PID'}: ${stop}`, async t => {
    const root = await mkdtemp(join(tmpdir(), 'cland-claude-stop-receipt-'));
    const calls: string[][] = [];
    let release: (() => void) | undefined;
    let ownedAdapter: ClaudeCodeAdapter | undefined;
    let work: ReturnType<ClaudeCodeAdapter['resume']> | undefined;
    t.after(async () => {
      release?.();
      await work?.catch(() => {});
      await ownedAdapter?.close();
      t.mock.restoreAll();
      syncBuiltinESMExports();
      await rm(root, { recursive: true, force: true });
    });
    t.mock.method(cp, 'execFile', (_bin: string, args: string[], _options: cp.ExecFileOptions, callback: (error: { code: number } | null, stdout: string, stderr: string) => void) => {
      calls.push(args);
      if (args[0] === 'stop') {
        if (stop === 'throw') throw new Error('synthetic native stop transport failure');
        if (stop === 'held') { release = () => { release = undefined; callback(null, '', ''); }; return; }
        queueMicrotask(() => callback({ code: 1 }, '', 'synthetic native stop failure'));
      } else queueMicrotask(() => callback(null, args[0] === 'agents' ? JSON.stringify(stop === 'absent' ? [] : [{ id: 'old-job', sessionId: 'native' }]) : args[0] === '--bg' ? 'claude attach abcdef12' : '', ''));
    });
    syncBuiltinESMExports();
    const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} };
    const adapter = ownedAdapter = new ClaudeCodeAdapter(host, { clock: new FakeClock(), agentsMs: 0, env: { HOME: root } });
    const process: HarnessProcess = { name: 'coord', harness: 'claude-code', role: null, model: null, cwd: root, pid, harnessId: 'old-job', sessionId: 'stable', harnessSessionId: 'native', startedAt: '', status: 'exited' };
    let stopReceipts = 0;
    work = adapter.resume(process, { relaunch: true, stopped: () => {
      stopReceipts++;
      assert.equal(calls.some(c => c[0] === '--bg'), false, 'stop receipt precedes replacement');
    } });
    if (stop === 'held') {
      await eventually('held native stop entered', () => release ? true : undefined);
      assert.equal(calls.some(c => c[0] === '--bg'), false, 'no replacement before native stop callback');
      assert.equal(stopReceipts, 0);
      release!();
      assert.equal((await work).found, true);
      assert.equal(calls.filter(c => c[0] === '--bg').length, 1);
      assert.equal(stopReceipts, 1);
    } else if (stop === 'absent') {
      assert.equal((await work).found, true, 'fresh successful listing confirms the old job absent');
      assert.equal(stopReceipts, 1);
      assert.ok(calls.findIndex(c => c[0] === 'agents') < calls.findIndex(c => c[0] === '--bg'));
    } else {
      await assert.rejects(work, /native job stop is unconfirmed/);
      assert.equal(stopReceipts, 0);
      assert.equal(calls.some(c => c[0] === '--bg'), false, 'failed stop retains the daemon job fence');
    }
  });
});

test('Claude bridge use fences its captured generation and old disconnect cannot remove a new bridge', async t => {
  const state = new Map<string, string>();
  const host: AdapterHost = { root: '/fixture', discoveryFile: '/fixture/hub.json', node: '', cli: '', spoke: '', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {}, adapterState: { read: key => state.get(key) ?? null, write: (key, value) => { state.set(key, value); } } };
  const adapter = new ClaudeCodeAdapter(host, { clock: new FakeClock(), env: { HOME: '/fixture' } });
  t.after(() => adapter.close());
  const process: HarnessProcess = { name: 'coord', harness: 'claude-code', role: null, model: null, cwd: '/fixture', pid: null, harnessId: 'job', sessionId: 'stable', harnessSessionId: 'native', startedAt: '', status: 'running' };
  const old: string[] = [], current: string[] = [];
  const oldDisconnect = adapter.bridge(process, frame => { old.push(frame.message); return true; });
  const message: import('../src/protocol.ts').Message = { id: 'input', from: 'human', fromKind: 'human', via: 'hub', to: ['coord'], text: 'generation input', ts: '2026-10-30T00:00:00Z' };
  state.set('claude-launch:stable', 'new-generation');
  assert.equal(adapter.hasBridge(process), false);
  await assert.rejects(adapter.inject(process, message, null), /mod of this session is not connected/);
  assert.deepEqual(old, []);
  adapter.bridge(process, frame => { current.push(frame.message); return true; });
  oldDisconnect();
  assert.equal(adapter.hasBridge(process), true);
  const receipt = adapter.inject(process, message, null);
  adapter.confirm(process, message.id);
  await receipt;
  assert.deepEqual(current, [message.id]);
  assert.deepEqual(old, []);
});

test('failed native stop cannot use a held pre-stop empty snapshot as fresh captured-job absence', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-claude-post-stop-'));
  const calls: string[][] = [];
  const logs: Array<Record<string, unknown>> = [];
  let releaseEarlier: (() => void) | undefined;
  let listCount = 0;
  let jobListed = false;
  let inspection: ReturnType<ClaudeCodeAdapter['duplicateHarness']> | undefined;
  let resuming: ReturnType<ClaudeCodeAdapter['resume']> | undefined;
  let adapter: ClaudeCodeAdapter | undefined;
  t.after(async () => {
    releaseEarlier?.();
    await inspection?.catch(() => {});
    await resuming?.catch(() => {});
    await adapter?.close();
    t.mock.restoreAll();
    syncBuiltinESMExports();
    await rm(root, { recursive: true, force: true });
  });
  t.mock.method(cp, 'execFile', (_bin: string, args: string[], _options: cp.ExecFileOptions, callback: (error: { code: number } | null, stdout: string, stderr: string) => void) => {
    calls.push(args);
    if (args[0] === 'agents') {
      const snapshot = JSON.stringify(jobListed ? [{ id: 'old-job', sessionId: 'native' }] : []);
      if (++listCount === 1) releaseEarlier = () => { releaseEarlier = undefined; callback(null, snapshot, ''); };
      else queueMicrotask(() => callback(null, snapshot, ''));
    } else if (args[0] === 'stop') queueMicrotask(() => callback({ code: 1 }, '', 'synthetic failed native stop'));
    else throw new Error(`unexpected replacement command ${args[0]}`);
  });
  syncBuiltinESMExports();
  const host: AdapterHost = { root, discoveryFile: join(root, 'hub.json'), node: '', cli: '', spoke: '', log: e => { logs.push(e); }, signal: () => {}, recordPid: () => {}, exited: () => {} };
  adapter = new ClaudeCodeAdapter(host, { clock: new FakeClock(), env: { HOME: root } });
  const process: HarnessProcess = { name: 'coord', harness: 'claude-code', role: null, model: null, cwd: root, pid: null, harnessId: 'old-job', sessionId: 'stable', harnessSessionId: 'native', startedAt: '', status: 'exited' };
  adapter.watch(process);
  inspection = adapter.duplicateHarness(process, 'foreign');
  await eventually('pre-stop native snapshot captured', () => releaseEarlier ? true : undefined);
  jobListed = true;
  resuming = adapter.resume(process, { relaunch: true });
  const refused = assert.rejects(resuming, /native job stop is unconfirmed/);
  await eventually('failed stop observes the earlier query boundary', () => logs.some(e => e.event === 'harness-stop-await-query') || undefined);
  assert.equal(calls.some(c => c[0] === '--bg'), false);
  releaseEarlier!();
  await inspection;
  await refused;
  assert.equal(listCount, 2, 'absence proof invokes a new native query after the failed stop');
  assert.equal(calls.some(c => c[0] === '--bg'), false, 'old empty result never authorizes replacement');
  assert.equal(logs.some(e => e.event === 'harness-stop-failed'), true);
});
