// T1: messenger-neutral decisions and durable store receipts; no transport or processes.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mirrorOut } from '../src/remote/mirror.ts';
import type { Message } from '../src/protocol.ts';
import { Store } from '../src/hub/store.ts';
import { tempProject } from './harness.ts';
import { join } from 'node:path';
import { FakeClock } from './fake-clock.ts';
import { flushGap } from '../src/remote/gap.ts';
import { pairing } from './telegram-polling-fixture.ts';
import { statusReply, helpReply } from '../src/remote/replies.ts';
import type { HubStatus } from '../src/protocol.ts';
import { inboxPublication } from '../src/remote/cards.ts';
import type { Inbox, InboxApproval } from '../src/protocol.ts';

test('Remote mirror filters human actions and labels cross-messenger authors', () => {
  const message: Message = { id: 'one', from: 'human', fromKind: 'human', via: 'hub', to: [], text: 'Hello', ts: '2026-10-28T00:00:00Z' };
  assert.deepEqual(mirrorOut(message, 'telegram'), { header: 'you · message', text: 'Hello', silent: false });
  assert.equal(mirrorOut({ ...message, via: 'telegram' }, 'discord')?.header, 'you (Telegram) · message');
  assert.equal(mirrorOut({ ...message, via: 'discord' }, 'telegram')?.header, 'you (Discord) · message');
  assert.equal(mirrorOut({ ...message, via: 'telegram' }, 'telegram'), null);
  assert.equal(mirrorOut({ ...message, kind: 'request' }, 'telegram'), null);
  assert.equal(mirrorOut({ ...message, answerTo: 'ask' }, 'telegram'), null);
  assert.equal(mirrorOut({ ...message, ask: { question: 'Choose', options: [], free: true, state: 'open' } }, 'telegram'), null);
  assert.equal(mirrorOut({ ...message, from: 'worker', fromKind: 'agent', kind: 'progress' }, 'telegram')?.silent, true);
  assert.deepEqual(mirrorOut({ ...message, from: 'hub', fromKind: 'hub' }, 'discord'), { header: 'hub · message', text: 'Hello', silent: true });
});

test('Discord gap counts sources once without touching Telegram jobs or captured state', async t => {
  const root = await tempProject(t);
  const db = new Store(join(root, 'neutral.db'));
  try {
    const store = db.remotes.forMessenger('discord');
    store.setPairing(pairing);
    store.set('telegram.gap', 'unchanged');
    const clock = new FakeClock(new Date(2026, 9, 16, 13, 20));
    for (const [id, source, discord] of [['a', 'one', true], ['b', 'one', true], ['c', 'two', true], ['tg', 'three', false]] as const)
      store.putOutbox({ id, source, kind: 'general', state: 'missed', payload: { discord }, created: clock.now().toISOString(), updated: clock.now().toISOString() });
    const calls: string[] = [];
    const options = { stateKey: 'discord.gap', matches: (job: import('../src/remote/state.ts').OutboxJob) => (job.payload as { discord: boolean }).discord };
    assert.equal(await flushGap(store, clock, options, async (_chat, text) => { calls.push(text); }), true);
    assert.deepEqual(calls, ['2 General messages missed since 13:20']);
    assert.equal(store.get('discord.gap'), null);
    assert.equal(store.get('telegram.gap'), 'unchanged');
    assert.deepEqual(store.outbox().map(job => [job.id, job.state]), [['a', 'reported'], ['b', 'reported'], ['c', 'reported'], ['tg', 'missed']]);
    await flushGap(store, clock, options, async () => { assert.fail('no duplicate gap'); });
  } finally { db.close(); }
});

test('Remote mute receipts apply once and keep existing Telegram receipts authoritative', async t => {
  const root = await tempProject(t);
  const db = new Store(join(root, 'mute.db'));
  try {
    const store = db.remotes.forMessenger('telegram');
    assert.equal(store.applyMute('discord.mute:channel:one', true), 'General stream muted');
    store.set('mute.missed', '3');
    assert.equal(store.applyMute('discord.mute:channel:one', false), null);
    assert.equal(store.get('mute'), 'true');
    assert.equal(store.get('mute.missed'), '3');
    store.set('telegram.mute:101:7', '1');
    assert.equal(store.applyTelegramMute('101', 7, false), null);
    assert.equal(store.get('mute.missed'), '3');
    assert.equal(store.applyTelegramMute('101', 8, false), '3 messages arrived while muted');
    assert.equal(store.get('mute'), 'false');
    assert.equal(store.get('mute.missed'), '0');
    assert.equal(store.get('telegram.mute:101:8'), '1');
  } finally { db.close(); }
});

test('Remote phone model uses the requested location label and puts gateway facts last', () => {
  const status: HubStatus = { version: '0.3.0', uptimeMs: 60000, sessions: [], coordinator: null,
    pid: 1, port: 0, socket: '', root: '', startedAt: '2026-10-28T00:00:00Z' };
  for (const label of ['This chat', 'This channel'] as const) {
    const reply = statusReply('Project', status, [], { connected: true, muted: false, outbox: 2, label, extra: ['Remaining: 50'] });
    assert.equal(reply.title, 'Project — Status');
    assert.deepEqual(reply.groups.at(-1), { label, lines: ['Connected', 'General on'] });
    assert.deepEqual(reply.small, ['Outbox: 2', 'Remaining: 50']);
  }
  assert.deepEqual(helpReply('Project', { groups: [{ label: 'Commands', lines: ['/help'] }], small: ['Private'] }),
    { title: 'Project — Help', groups: [{ label: 'Commands', lines: ['/help'] }], small: ['Private'] });
});

test('Remote inbox publication interleaves open asks approvals and notices oldest first with id ties', () => {
  const since = '2026-10-28T00:00:00Z';
  const topic = { id: 'general', title: 'General' };
  const approval: InboxApproval = { id: 'a', since, session: 'worker', sessionId: 'worker', label: 'worker', harness: 'codex', kind: 'command', subject: { command: 'pwd' }, choices: ['once', 'deny'], answerIn: 'hub', attach: null, state: 'pending' };
  const inbox: Inbox = { asks: [{ id: 'b', since, ts: since, topic, question: 'Choose', options: [], free: true, from: 'worker', label: 'worker' }],
    approvals: [approval, { ...approval, id: 'closed', state: 'closed' }, { ...approval, id: 'tui', answerIn: 'tui' }],
    plans: [{ id: 'older', since: '2026-10-27T00:00:00Z', subject: 'Plan', title: 'Plan' }], requests: [], messages: [], waiting: [], needsYou: 4 };
  const rows = inboxPublication(inbox, 'https://example.test');
  assert.deepEqual(rows.map(row => [row.kind, row.id]), [['notice', 'older'], ['approval', 'a'], ['ask', 'b'], ['notice', 'tui']]);
  assert.equal(rows[0]?.kind === 'notice' && rows[0].notice.card.link, 'https://example.test');
});
