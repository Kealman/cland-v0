// T1: hub cards reuse the complete pre-existing remote authority table.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GATEWAY_AUTHORITY, gatewayAuthorityRefusal } from '../src/remote/authority.ts';

test('hub cards keep every remote authority entry at its previous classification', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(GATEWAY_AUTHORITY).map(([key, value]) => [key, value === true ? true : 'conditional'])), {
    'topic.send': 'conditional', 'artifact.upload': 'conditional', 'topic.answer': true,
    'approval.answer': true, 'hub.status': true, 'task.list': true, 'inbox.list': true,
  });
  for (const type of ['topic.send', 'artifact.upload']) {
    assert.equal(gatewayAuthorityRefusal({ type, topic: 'general' }, () => null), null);
    assert.equal(gatewayAuthorityRefusal({ type, topic: 'other' }, () => null)?.ok, false);
    assert.equal(gatewayAuthorityRefusal({ type, topic: 'other', replyTo: 'known' }, () => 'other'), null);
  }
  assert.equal(gatewayAuthorityRefusal({ type: 'hub.card.raise' }, () => null)?.ok, false);
});
