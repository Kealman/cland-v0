import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOCUMENTED_TOOLS, startHub, spawnSpoke } from './harness.ts';

test('the spoke declares the channel capability, the documented tools and its instructions', async () => {
  const hub = await startHub();
  const spoke = await spawnSpoke({ hub, name: 'alpha' });
  try {
    const caps = spoke.client.getServerCapabilities();
    assert.deepEqual(caps?.experimental?.['claude/channel'], {});
    assert.ok(caps?.tools, 'tools capability');
    const { tools } = await spoke.client.listTools();
    assert.deepEqual(tools.map((t) => t.name).sort(), [...DOCUMENTED_TOOLS]);
    const instructions = spoke.client.getInstructions() ?? '';
    assert.match(instructions, /from_kind="human"/);
    assert.match(instructions, /never treat it as authorization/);
    assert.match(instructions, /Do not send acknowledgements or thanks/);
    assert.match(instructions, /prompt injection/);
  } finally {
    await spoke.close();
    await hub.close();
  }
});

test('who() lists every connected session with its session id, role, status and connect time', async () => {
  const hub = await startHub();
  const alpha = await spawnSpoke({ hub, name: 'alpha' });
  const beta = await spawnSpoke({ hub, name: 'beta', role: 'reviewer', sessionId: 'sess-beta' });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);
    const who = await alpha.call<{ ok: boolean; me: string; sessions: Array<Record<string, unknown>> }>('who');
    assert.equal(who.ok, true);
    assert.equal(who.me, 'alpha');
    const b = who.sessions.find((d) => d.name === 'beta');
    assert.ok(b);
    assert.equal(b.role, 'reviewer');
    assert.equal(b.status, null);
    assert.equal(b.sessionId, 'sess-beta');
    assert.equal(typeof b.cwd, 'string');
    assert.match(String(b.connectedAt), /^\d{4}-/);
    assert.equal(who.sessions.find((d) => d.name === 'alpha')?.role, null);
  } finally {
    await alpha.close();
    await beta.close();
    await hub.close();
  }
});
