// T1: shared init/update settings provisioning against temporary files; no processes or hub.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { provisionClaudeSettings } from '../src/init/claude-settings.ts';
import { Report } from '../src/init/files.ts';
import { HOOK_EVENTS } from '../src/adapters/claude-code.ts';
import { VERSION } from '../src/version.ts';

function fixture(t: TestContext): string {
  const root = mkdtempSync(join(tmpdir(), 'cland-init-settings-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function provision(root: string): Report {
  const report = new Report(root);
  provisionClaudeSettings(report, root);
  return report;
}

test('fresh settings disable background worktree isolation beside the cland hooks', { timeout: 5000 }, t => {
  const root = fixture(t);
  assert.deepEqual(provision(root).changes, [{ path: '.claude/settings.json', action: 'created' }]);
  const settings = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));
  assert.deepEqual(settings.worktree, { bgIsolation: 'none' });
  assert.deepEqual(Object.keys(settings.hooks).sort(), Object.keys(HOOK_EVENTS).sort());
});

test('init and update provision one synchronous managed Bash literal-rm guard', t => {
  const root = fixture(t);
  for (const action of ['created', 'unchanged']) {
    assert.equal(provision(root).changes[0]?.action, action);
    const settings = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));
    assert.deepEqual(settings.hooks.PreToolUse, [{
      matcher: 'Bash',
      hooks: [{ type: 'command', command: `[ -n "$CLAND_SESSION_NAME" ] || ! command -v cland >/dev/null 2>&1 || cland hook literal-rm # managed by cland ${VERSION}`, timeout: 10 }],
    }]);
  }
});

test('provisioning restores edited isolation once, then preserves current settings bytes and mtime', { timeout: 5000 }, t => {
  const root = fixture(t);
  provision(root);
  const path = join(root, '.claude/settings.json');
  const edited = JSON.parse(readFileSync(path, 'utf8'));
  edited.worktree.bgIsolation = 'worktree';
  writeFileSync(path, JSON.stringify(edited));
  assert.deepEqual(provision(root).changes, [{ path: '.claude/settings.json', action: 'updated' }]);
  const restored = JSON.parse(readFileSync(path, 'utf8'));
  assert.equal(restored.worktree.bgIsolation, 'none');

  // An old mtime makes even an immediate unnecessary rewrite observable, without a clock wait.
  const formatted = `${JSON.stringify(restored, null, '\t')}\n`;
  writeFileSync(path, formatted);
  utimesSync(path, 946684800, 946684800);
  const before = statSync(path, { bigint: true });
  assert.deepEqual(provision(root).changes, [{ path: '.claude/settings.json', action: 'unchanged' }]);
  assert.equal(readFileSync(path, 'utf8'), formatted);
  assert.equal(statSync(path, { bigint: true }).mtimeNs, before.mtimeNs);
});

test('provisioning preserves the project hooks, model and other worktree settings', { timeout: 5000 }, t => {
  const root = fixture(t);
  mkdirSync(join(root, '.claude'));
  const path = join(root, '.claude/settings.json');
  const ownHook = { matcher: 'Write', hooks: [{ type: 'command', command: './observe.sh' }] };
  writeFileSync(path, JSON.stringify({
    hooks: { PostToolUse: [ownHook] },
    model: 'opus',
    worktree: { baseRef: 'fresh', symlinkDirectories: ['node_modules'], bgIsolation: 'worktree' },
    permissions: { deny: ['Read(.env)'] },
  }));
  for (const action of ['updated', 'unchanged']) {
    assert.equal(provision(root).changes[0]?.action, action);
    const settings = JSON.parse(readFileSync(path, 'utf8'));
    assert.deepEqual(settings.hooks.PostToolUse[0], ownHook);
    assert.equal(settings.hooks.PostToolUse.length, 2);
    assert.equal(settings.model, 'opus');
    assert.deepEqual(settings.worktree, { baseRef: 'fresh', symlinkDirectories: ['node_modules'], bgIsolation: 'none' });
    assert.deepEqual(settings.permissions, { deny: ['Read(.env)'] });
  }
});

test('provisioning leaves the local isolation override byte-identical with the same mtime', { timeout: 5000 }, t => {
  const root = fixture(t);
  mkdirSync(join(root, '.claude'));
  const path = join(root, '.claude/settings.local.json');
  const local = '{ "worktree": { "bgIsolation": "worktree" } }\n';
  writeFileSync(path, local);
  utimesSync(path, 946684800, 946684800);
  const before = statSync(path, { bigint: true });
  for (const action of ['created', 'unchanged']) {
    assert.deepEqual(provision(root).changes, [{ path: '.claude/settings.json', action }]);
    assert.equal(readFileSync(path, 'utf8'), local);
    assert.equal(statSync(path, { bigint: true }).mtimeNs, before.mtimeNs);
  }
});
