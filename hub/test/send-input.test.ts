// T1: the MCP recipient schema/input seam and routing run entirely in memory.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sendRecipients, sendToSchema } from '../src/send-input.ts';
import { HubCore } from '../src/hub/core.ts';
import type { Message } from '../src/protocol.ts';
import { FakeClock } from './fake-clock.ts';

test('MCP single-string and array recipients deliver to the same Coordinator', t => {
  assert.deepEqual(sendToSchema, { anyOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }] });
  const core = new HubCore({ clock: new FakeClock(), env: {} });
  t.after(() => { core.close(); core.store.close(); });
  const received: Message[] = [];
  for (const [name, role] of [['coord', 'coordinator'], ['impl', 'implementer']] as const) {
    assert.equal(core.hello({ type: 'hello', protocol: 2, name, role, sessionId: name, cwd: '/virtual/project' }, message => {
      if (name === 'coord') received.push(message);
      return true;
    }).ok, true);
  }
  for (const to of ['coordinator', ['coordinator']]) {
    const sent = core.sendFromSession('impl', sendRecipients(to), 'recipient shape');
    assert.deepEqual(sent.message.to, ['coord']);
    assert.equal(sent.topic.id, 'agents');
    assert.equal(sent.outcomes[0]?.outcome, 'delivered');
    assert.equal(received.at(-1)?.id, sent.message.id);
  }
  assert.equal(received.filter(message => message.text === 'recipient shape').length, 2);
  assert.deepEqual(core.sendFromSession('impl', 'coordinator', 'direct core input').message.to, ['coord']);
  assert.throws(() => core.sendFromSession('impl', 42 as unknown as string[], 'invalid core input'), { message: 'to must be a string or an array of strings' });
});

test('malformed recipient shapes fail validation rather than becoming a human send', () => {
  for (const to of [42, {}, null, true, ['coordinator', 42], [null]]) {
    assert.throws(() => sendRecipients(to), { message: 'to must be a string or an array of strings' });
  }
  assert.deepEqual(sendRecipients(undefined), []);
  assert.deepEqual(sendRecipients([]), []);
});
