import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startHub, spawnSpoke } from './harness.ts';

test('a message from one session arrives in the other session as a channel event', async () => {
  const hub = await startHub();
  const alpha = await spawnSpoke({ hub, name: 'alpha', role: 'coordinator' });
  const beta = await spawnSpoke({ hub, name: 'beta', sessionId: 'sess-beta' });
  try {
    await alpha.waitForPresence(['alpha', 'beta']);

    const outcome = await alpha.call<{ ok: boolean; outcomes: Array<{ to: string; outcome: string }> }>('send', {
      to: ['beta'],
      text: 'is the branch ready for review?',
    });
    assert.deepEqual(outcome, { ok: true, outcomes: [{ to: 'beta', outcome: 'delivered' }] });

    const event = await beta.waitForEvent((e) => e.params.content === 'is the branch ready for review?');
    const meta = event.params.meta ?? {};
    assert.equal(meta.from, 'alpha');
    assert.equal(meta.from_kind, 'agent');
    assert.equal(meta.from_role, 'coordinator');
    assert.equal(meta.via, 'session');
    assert.equal(meta.to, 'beta');
    assert.match(meta.msg_id ?? '', /^[0-9a-f-]{36}$/);
    assert.match(meta.ts ?? '', /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(meta.reply_to, undefined);

    const reply = await beta.call<{ ok: boolean }>('send', { to: ['alpha'], text: 'yes', reply_to: meta.msg_id });
    assert.equal(reply.ok, true);
    const back = await alpha.waitForEvent((e) => e.params.content === 'yes');
    assert.equal(back.params.meta?.reply_to, meta.msg_id);
    assert.equal(back.params.meta?.from_role, undefined, 'a session with no role sends none');
  } finally {
    await alpha.close();
    await beta.close();
    await hub.close();
  }
});
