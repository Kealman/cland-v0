// T2: launch settings and environment through the production adapter's recorded CLI boundary.
// Settings use temporary files; the command edge stays entirely in memory.
// T2 pending T-682: T1 lint matches the mocked child_process import and adapter timer setup;
// no child, socket or wall-clock wait is used. The real binary frame stays in the contract file.
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';
import { FakeClock } from './fake-clock.ts';

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
      const settings = JSON.parse(args[args.indexOf('--settings') + 1]!);
      assert.deepEqual(settings.worktree, row.fallback ? { bgIsolation: 'none' } : undefined, row.name);
      assert.ok(settings.hooks.SessionStart, 'hooks survive');
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
    assert.deepEqual(JSON.parse(args[args.indexOf('--settings') + 1]!).worktree, { bgIsolation: 'none' });
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
    return JSON.parse(args[args.indexOf('--settings') + 1]!);
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
  const host: AdapterHost = { root: '/fixture', discoveryFile: '/fixture/hub.json', node: '/fixture/node', cli: '/fixture/cland', spoke: '/fixture/spoke', log: () => {}, signal: () => {}, recordPid: () => {}, exited: () => {} };
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
    const host: AdapterHost = { root: '/fixture', discoveryFile: '/fixture/hub.json', node: '/fixture/node', cli: '/fixture/cland', spoke: '/fixture/spoke', log: e => { events.push(e); }, signal: () => {}, recordPid: () => {}, exited: () => {} };
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
