// T1: project requirements from injected role text and account metadata; no processes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { harnessesInUse } from '../src/roles/harnesses.ts';
import { rolesTemplate } from '../src/roles/template.ts';

test('role harness requirements include named accounts but exclude unused accounts', async () => {
  const roles = rolesTemplate(['claude-code']).replace('[reviewer.launch]', '[reviewer.launch]\naccount = "review"');
  const found = await harnessesInUse('/project', {}, {
    roles: async () => roles,
    accounts: async () => ({ registry: '/accounts', accounts: [
      { name: 'review', harness: 'codex', path: null, variable: 'CODEX_HOME' },
      { name: 'unused', harness: 'opencode', path: null, variable: 'XDG_DATA_HOME' },
    ] }),
  });
  assert.deepEqual(found, ['claude-code', 'codex']);
});

test('omitted role launch harnesses take the built-in defaults', async () => {
  assert.deepEqual(await harnessesInUse('/project', {}, { roles: async () => '[aide]\nclause = "hello"' }), ['claude-code', 'codex', 'opencode']);
});

test('no roles file requires no particular harness or account lookup', async () => {
  assert.deepEqual(await harnessesInUse('/empty', {}, {
    roles: async () => null,
    accounts: async () => { throw new Error('must not read accounts'); },
  }), []);
});
