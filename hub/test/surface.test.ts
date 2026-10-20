// T3: contract with the real stdio spoke binary, including parity with its in-process transport.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOCUMENTED_TOOLS, startHub, spawnSpoke, inProcessSpoke } from './harness.ts';

test('the spoke declares the channel capability, the documented tools and its instructions', async t => {
  const hub = await startHub();
  const spoke = await spawnSpoke({ hub, name: 'alpha' });
  try {
    const inProcess = await inProcessSpoke(t, { hub, name: 'in-process', sessionId: 'sess-in-process' });
    assert.deepEqual(await inProcess.client.listTools(), await spoke.client.listTools());
    assert.equal(inProcess.client.getInstructions(), spoke.client.getInstructions());
    assert.deepEqual(inProcess.client.getServerCapabilities(), spoke.client.getServerCapabilities());
    await inProcess.close();
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
    // Questions climb one lead at a time (spec 3.7); the Coordinator owns the human boundary.
    assert.match(instructions, /Send an item question with kind question to lead T-<n> in its item topic/);
    assert.match(instructions, /The receiving lead answers with ask.answer .* or forwards unchanged one level with ask.forward/);
    assert.match(instructions, /The Coordinator alone forwards to the human, or asks with ask/);
    assert.match(instructions, /Questions without an item go to coordinator in General/);
    assert.match(instructions, /Topics are opened by the Coordinator or an Aide, or by an Implementer for its own item/);
    assert.match(instructions, /the human's latest message mentioned you \(`@your-role` or `@your-name`\)/);
    assert.doesNotMatch(instructions, /a question for the human has no fitting topic/i);
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
