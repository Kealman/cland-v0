// Pure environment table through the production adapter's CLI boundary, entirely in memory.
// T2 pending T-682: T1 lint matches the mocked child_process import and adapter timer setup;
// no child, socket or wall-clock wait is used. The real binary frame stays in the contract file.
import test from 'node:test';
import assert from 'node:assert/strict';
import cp from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { join } from 'node:path';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import type { AdapterHost } from '../src/adapters/contract.ts';

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
