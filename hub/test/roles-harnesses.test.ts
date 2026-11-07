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


test('role pools default to local and accept named pools for built-in and custom workers', async () => {
  const { parseRoles } = await import('../src/roles/config.ts');
  assert.equal(parseRoles('').get('implementer')!.launch.pool, 'local');
  assert.equal(parseRoles('[implementer.launch]\npool = "agents"').get('implementer')!.launch.pool, 'agents');
  assert.equal(parseRoles('[custom.writer]\nclause = "Write"\n[custom.writer.launch]\nharness = "codex"\npool = "agents"').get('writer')!.launch.pool, 'agents');
});


test('role pool validation shares pool-name syntax and the local-only role policy', async () => {
  const { parseRoles } = await import('../src/roles/config.ts');
  for (const pool of ['""', '"bad_pool"', '" leading"', '"-agents"', '42', '"' + 'a'.repeat(65) + '"']) {
    assert.throws(() => parseRoles(`[implementer.launch]\npool = ${pool}`), /invalid host pool/);
  }
  for (const role of ['coordinator', 'aide']) {
    assert.throws(() => parseRoles(`[${role}.launch]\npool = "agents"`), /Coordinator and Aide roles run only on the local host/);
    assert.equal(parseRoles(`[${role}.launch]\npool = "local"`).get(role)!.launch.pool, 'local');
  }
});
