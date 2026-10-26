// T2: real frame receipts, hub.db and fake messenger delivery; no platform or key.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import { Outbox } from '../src/remote/outbox.ts';
import type { Inbox, TopicMessage } from '../src/protocol.ts';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { testMessenger } from './fakes/messenger.ts';
import { FakeClock } from './fake-clock.ts';
import { caseDeadlines } from './case-deadlines.ts';

test('an outage counts three General jobs as missed, drops an answered ask card and never replays them on recovery', async t => {
  const { wait, fixtures } = caseDeadlines(t, { timeoutMs: 2000 });
  const root = await tempProject(fixtures);
  const messenger = testMessenger('telegram');
  const clock = new FakeClock();
  const hub = await projectHub(fixtures, root, {}, { gatewayRemotes: [messenger], clock });
  const db = new Store(join(root, '.cland', 'hub.db'));
  try {
    const remote = db.remotes.forMessenger('telegram');
    const outbox = new Outbox(remote, messenger.delivery, { clock, sourceOpen: async job => {
      const inbox = await messenger.client.request({ type: 'inbox.list' });
      assert.equal(inbox.ok, true, inbox.error);
      return (inbox.value as Inbox).asks.some(ask => ask.id === job.source);
    } });
    messenger.mirror(outbox);
    const local = await wait('local frame client', () => connectUi(fixtures, hub.discovery));
    const coord = await wait('fake Coordinator spoke', () => inProcessSpoke(fixtures, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' }));
    const created = await local.request({ type: 'topic.create', title: 'Outage choice' });
    assert.equal(created.ok, true, created.error);
    const topic = (created.value as { topic: { id: string } }).topic.id;
    const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic, question: 'Ship?', options: ['yes', 'no'] });
    assert.equal(asked.ok, true);
    const card = outbox.enqueue({ kind: 'card', source: asked.ask, payload: { text: 'Ship?' } });
    messenger.delivery.refuse('never-left');
    for (let i = 1; i <= 3; i++) {
      const text = `outage General ${i}`;
      const received = messenger.client.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).text === text);
      const sent = await coord.call<{ ok: boolean }>('send', { topic: 'general', text });
      assert.equal(sent.ok, true);
      await wait('exact General frame queued', () => received);
      await wait('outbox outage settlement', () => outbox.drain());
    }
    assert.deepEqual(outbox.missed(), { count: 3, since: clock.now().toISOString() });
    assert.equal(remote.outbox().filter(job => job.state === 'missed').length, 3);
    const answered = await local.request({ type: 'topic.answer', ask: asked.ask, option: 1 });
    assert.equal(answered.ok, true, answered.error);
    await wait('closed-source settlement while offline', () => outbox.drain());
    assert.equal(remote.outbox().find(job => job.id === card)?.state, 'dropped');
    const next = await coord.call<{ ok: boolean; ask: string }>('ask', { topic, question: 'Next?', options: ['yes'] });
    assert.equal(next.ok, true);
    const open = outbox.enqueue({ kind: 'card', source: next.ask, payload: { text: 'Next?' } });
    messenger.delivery.recover();
    outbox.setAvailable(true);
    await wait('recovery drain receipt', () => outbox.drain());
    await wait('repeat recovery drain receipt', () => outbox.drain());
    assert.deepEqual(messenger.delivery.delivered.map(job => job.id), [open]);
    assert.equal(remote.outbox().find(job => job.id === open)?.state, 'sent');
    assert.equal(outbox.missed().count, 3, 'gap facts remain until explicitly acknowledged');
    assert.deepEqual(db.remotes.forMessenger('discord').outbox(), [], 'missed counts and jobs belong to one remote');
    await hub.stop();
    const reopened = new Store(join(root, '.cland', 'hub.db'));
    try {
      const recovered = new Outbox(reopened.remotes.forMessenger('telegram'), messenger.delivery, { clock });
      assert.equal(recovered.missed().count, 3);
      await recovered.drain();
      assert.deepEqual(messenger.delivery.delivered.map(job => job.id), [open]);
    } finally { reopened.close(); }
  } finally { await hub.stop(); db.close(); }
});
