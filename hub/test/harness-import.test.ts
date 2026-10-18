// T1: importing a pure harness helper must not start fixtures or native resources,
// including through global hooks and file cleanup.
import { test, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { assertFirstLaunchClause } from './harness.ts';

const directories = mock.method(fs, 'mkdtemp', () => { throw new Error('a bare harness import must not create a fixture'); });
syncBuiltinESMExports();
const accountKeys = ['XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME', 'PATH', 'OPENCODE_DB', 'CLAND_CLAUDE_BIN', 'CLAND_CODEX_BIN', 'CLAND_OPENCODE_BIN'];
const inherited = accountKeys.map(key => process.env[key]);

test('a bare harness import keeps pure helpers free of native resources', () => {
  assertFirstLaunchClause([
    { event: 'session-launched', session: 'impl' },
    { event: 'hello', name: 'impl' },
    { event: 'role-clause', session: 'impl', reason: 'hello' },
  ].map(event => JSON.stringify(event)).join('\n'), 'impl');
  assert.ok(accountKeys.every((key, index) => process.env[key] === inherited[index]), 'import must preserve inherited account settings');
});

after(() => {
  assert.equal(directories.mock.callCount(), 0, 'no fixture setup in global hooks');
});
