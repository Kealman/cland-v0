// T1: a fake request boundary supplies recorded JSON; no server or harness runs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenCodeClient } from '../src/adapters/opencode/client.ts';

test('OpenCode snapshots refuse inherited prototype keys as active sessions', async t => {
  const client = new OpenCodeClient('http://unused.invalid', 'fixture-password');
  let active: Record<string, unknown> | undefined = {};
  t.mock.method(client, 'request', async (_method: string, path: string) => ({
    data: path === '/api/session/active' ? active : [],
  }));
  for (const key of ['constructor', 'toString', '__proto__']) {
    assert.deepEqual(await client.snapshot(key), { running: false, permissions: [], forms: [] }, key);
  }
  // An own JSON entry with the same spelling is a real active session.
  active = JSON.parse('{"constructor":{},"ses_live":{}}');
  assert.equal((await client.snapshot('constructor')).running, true);
  assert.equal((await client.snapshot('ses_live')).running, true);
  assert.equal((await client.snapshot('ses_missing')).running, false);
  active = undefined;
  assert.equal((await client.snapshot('constructor')).running, false);
});
