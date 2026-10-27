// T2: production Telegram factory, sealed frames and loopback Bot API; fake time owns outages.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { join } from 'node:path';
import { Store } from '../src/hub/store.ts';
import type { TopicMessage } from '../src/protocol.ts';
import { until } from './harness.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { control, pairing } from './telegram-polling-fixture.ts';
import { telegramLivenessFixture as fixture } from './telegram-liveness-fixture.ts';
import { TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';

test('Telegram four-minute outage reports offline only after three minutes and recovery exactly once', async t => {
  const f = await fixture(t);
  pair(f.root);
  const since = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(f.clock.now());
  const initial = f.fake.waitForPoll();
  const { hub, ui, status, history } = await f.start();
  const poll = await within(initial, 1_000);
  await control(f.fake.url, 'fault', { method: 'getUpdates', code: 503, retry_after: 240, echoToken: true });
  const closed = f.fake.waitForPollClose(poll.id);
  await control(f.fake.url, 'release-polls', {});
  await within(closed, 1_000);
  await f.waitRetry(1);
  await f.clock.advance(179_999);
  assert.equal((await history()).includes('Telegram remote offline since'), false);
  assert.equal((await status()).connection, 'disconnected');
  const offline = ui.waitFor(frame => frame.type === 'message'
    && (frame.message as TopicMessage).text.startsWith(`Telegram remote offline since ${since}:`), 1_000);
  await f.clock.advance(1);
  const line = (await within(offline, 1_000)).message as TopicMessage;
  assert.equal(line.topic, 'general');
  assert.ok(line.text.startsWith(`Telegram remote offline since ${since}: `));
  await f.clock.advance(59_999);
  assert.equal((await history()).split('Telegram remote offline since').length - 1, 1);
  assert.equal((await history()).includes('Telegram remote recovered'), false);
  const recovered = ui.waitFor(frame => frame.type === 'message'
    && (frame.message as TopicMessage).text === `Telegram remote recovered; offline since ${since}`, 1_000);
  const resumed = f.fake.waitForPoll();
  await f.clock.advance(1);
  assert.equal(((await within(recovered, 1_000)).message as TopicMessage).topic, 'general');
  const active = await within(resumed, 1_000);
  assert.equal(active.params.timeout, 40);
  assert.equal((await status()).connection, 'connected');
  await until(() => facts(f.root).jobs.some(job => job.state === 'queued' && job.kind === 'general'),
    { what: 'recovery notice queued behind the successful gap', timeoutMs: 1_000 });
  await f.clock.advance(1_000);
  await until(() => facts(f.root).jobs.some(job => job.state === 'sent' && job.kind === 'general'),
    { what: 'recovery General notice has its durable paced send', timeoutMs: 1_000 });
  const native = await control<{ messages: Array<{ text: string }> }>(f.fake.url, 'state');
  assert.deepEqual(native.messages.map(message => message.text), [
    `1 General messages missed since ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(line.ts))}`, `hub · report\nTelegram remote recovered; offline since ${since}`,
  ]);
  const next = f.fake.waitForPoll();
  await control(f.fake.url, 'release-polls', {});
  const repeat = await within(next, 1_000);
  assert.equal((await history()).split('Telegram remote recovered').length - 1, 1);
  assert.equal(JSON.stringify([ui.frames, f.logs]).includes(TELEGRAM_TEST_TOKEN), false);
  const stopped = f.fake.waitForPollClose(repeat.id);
  await hub.stop();
  assert.equal(await within(stopped, 1_000), repeat.id);
  assert.equal(f.clock.pending, 0);
});


test('Telegram ten-second outage marks retained input then sends one gap for three missed General posts', async t => {
  const f = await fixture(t);
  await f.clock.advance(55_000);
  const db = new Store(join(f.root, '.cland/hub.db'));
  try { db.remotes.forMessenger('telegram').setPairing(pairing); } finally { db.close(); }
  const initial = f.fake.waitForPoll();
  const { hub, ui, history } = await f.start();
  const poll = await within(initial, 1_000);
  await control(f.fake.url, 'fault', { method: 'getUpdates', code: 503, retry_after: 10 });
  const initialClosed = f.fake.waitForPollClose(poll.id);
  await control(f.fake.url, 'release-polls', {});
  await within(initialClosed, 1_000);
  await f.waitRetry(1);
  for (const text of ['Missed one', 'Missed two', 'Missed three'])
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text })).ok, true);
  await f.clock.advance(2_000);
  const written = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(f.clock.now());
  await control(f.fake.url, 'update', { message: { message_id: 99, date: Math.floor(f.clock.now().getTime() / 1_000),
    chat: { id: 101, type: 'private' }, from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: 'Retained phone input' } });
  const inbound = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).via === 'telegram', 1_000);
  const gap = f.fake.waitForRequest('sendMessage', row => String(row.params.text).startsWith('3 General messages missed since '));
  void gap.catch(() => {});
  const resumed = f.fake.waitForPoll();
  await f.clock.advance(8_000);
  const recovery = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(f.clock.now());
  const saved = (await within(inbound, 1_000)).message as TopicMessage;
  assert.equal(saved.text, `Retained phone input\n\n(written on Telegram at ${written}; the hub was down until ${recovery})`);
  await until(() => reactionSent(f.root), { what: 'durable stored reaction before the paced gap', timeoutMs: 1_000 });
  await f.clock.advance(1_000);
  const gapReceipt = await within(gap, 1_000, undefined, () => new Error('missing three-message gap after retained inbound input'));
  assert.equal(gapReceipt.params.text, `3 General messages missed since ${written}`);
  const active = await within(resumed, 1_000);
  assert.equal(active.params.offset, 2, 'late text is durable before Telegram confirmation');
  assert.equal((await history()).includes('Telegram remote offline since'), false);
  assert.equal((await history()).includes('Telegram remote recovered'), false);
  const native = await control<{ messages: Array<{ text: string }> }>(f.fake.url, 'state');
  assert.deepEqual(native.messages.map(row => row.text), [`3 General messages missed since ${written}`], 'one gap replaces missed General, without a replay or echo');
  const next = f.fake.waitForPoll();
  await control(f.fake.url, 'release-polls', {});
  const repeat = await within(next, 1_000);
  const again = await control<{ messages: Array<{ text: string }> }>(f.fake.url, 'state');
  assert.deepEqual(again.messages, native.messages, 'later successful exchanges never repeat the gap');
  const stopped = f.fake.waitForPollClose(repeat.id);
  await hub.stop();
  assert.equal(await within(stopped, 1_000), repeat.id);
});

test('Telegram retries interrupted inbound feedback without duplicating its stored human message', async t => {
  const f = await fixture(t);
  const db = new Store(join(f.root, '.cland/hub.db'));
  try { db.remotes.forMessenger('telegram').setPairing(pairing); } finally { db.close(); }
  const initial = f.fake.waitForPoll();
  const { hub, ui, status } = await f.start();
  await within(initial, 1_000);
  await control(f.fake.url, 'fault', { method: 'setMessageReaction', code: 503 });
  await control(f.fake.url, 'say', { text: 'Durable before transient feedback failure' });
  await f.waitRetry(1);
  assert.equal((await status()).connection, 'disconnected');
  const resumed = f.fake.waitForPoll();
  await f.clock.advance(1_000);
  await until(() => reactionSent(f.root), { what: 'durable retried feedback before recovery', timeoutMs: 1_000 });
  await f.clock.advance(1_000);
  const active = await within(resumed, 1_000);
  assert.equal(active.params.offset, 2);
  const result = await ui.request({ type: 'topic.history', topic: 'general' });
  assert.equal(result.ok, true, result.error);
  const messages = (result.value as { messages: TopicMessage[] }).messages.filter(row => row.via === 'telegram');
  assert.deepEqual(messages.map(row => row.text), ['Durable before transient feedback failure']);
  const stopped = f.fake.waitForPollClose(active.id);
  await hub.stop();
  assert.equal(await within(stopped, 1_000), active.id);
});

function reactionSent(root: string): boolean {
  const db = new Store(join(root, '.cland/hub.db'));
  try { return db.remotes.forMessenger('telegram').outbox().some(job => job.state === 'sent'
    && (job.payload as { method?: string }).method === 'setMessageReaction'); }
  finally { db.close(); }
}

test('Telegram General arriving during a held gap stays missed until its own successful gap', async t => {
  const f = await fixture(t);
  pair(f.root);
  const initial = f.fake.waitForPoll();
  const { hub, ui } = await f.start();
  const poll = await within(initial, 1_000);
  await control(f.fake.url, 'fault', { method: 'getUpdates', code: 503, retry_after: 10 });
  await control(f.fake.url, 'release-polls', {});
  await f.waitRetry(1);
  const first = await ui.request({ type: 'topic.send', topic: 'general', text: 'Before recovery' });
  assert.equal(first.ok, true, first.error);
  const firstId = (first.value as { message: TopicMessage }).message.id;
  await control(f.fake.url, 'fault', { method: 'sendMessage', code: 500, response: 'hold' });
  const entered = f.fake.waitForHeldRequest('sendMessage');
  await f.clock.advance(10_000);
  const held = await within(entered, 1_000);
  assert.equal(facts(f.root).jobs.find(job => job.source === firstId)!.state, 'missed');
  const second = await ui.request({ type: 'topic.send', topic: 'general', text: 'During gap send' });
  assert.equal(second.ok, true, second.error);
  const secondId = (second.value as { message: TopicMessage }).message.id;
  await until(() => facts(f.root).jobs.some(job => job.source === secondId), { what: 'new General durably counted during gap', timeoutMs: 1_000 });
  assert.equal(facts(f.root).jobs.find(job => job.source === secondId)!.state, 'missed');
  const secondGap = f.fake.waitForRequest('sendMessage', row => String(row.params.text).startsWith('1 General messages missed since '));
  const resumed = f.fake.waitForPoll();
  await control(f.fake.url, 'release-requests', { ids: [held.id] });
  await until(() => facts(f.root).jobs.find(job => job.source === firstId)?.state === 'reported',
    { what: 'first captured source acknowledged after actual native gap success', timeoutMs: 1_000 });
  assert.equal(facts(f.root).jobs.find(job => job.source === secondId)!.state, 'missed');
  await until(() => facts(f.root).jobs.some(job => job.state === 'queued' && (job.payload as { key?: string }).key),
    { what: 'second immutable gap queued before advancing its pacing boundary', timeoutMs: 1_000 });
  await f.clock.advance(1_000);
  await within(secondGap, 1_000);
  const active = await within(resumed, 1_000);
  assert.equal(active.params.timeout, 40);
  assert.equal(facts(f.root).jobs.find(job => job.source === secondId)!.state, 'reported');
  const native = await control<{ messages: Array<{ text: string }> }>(f.fake.url, 'state');
  assert.equal(native.messages.length, 2);
  assert.ok(native.messages.every(message => message.text.startsWith('1 General messages missed since ')));
  const stopped = f.fake.waitForPollClose(active.id);
  await hub.stop();
  assert.equal(await within(stopped, 1_000), active.id);
  assert.equal(f.clock.pending, 0);
  assert.equal(await f.fake.waitForPollClose(poll.id), poll.id);
});

test('Telegram uncertain native gap stays fenced across successful recovery polls', async t => {
  const f = await fixture(t);
  pair(f.root);
  const initial = f.fake.waitForPoll();
  const { hub, ui } = await f.start();
  const poll = await within(initial, 1_000);
  await control(f.fake.url, 'fault', { method: 'getUpdates', code: 503, retry_after: 10 });
  await control(f.fake.url, 'release-polls', {});
  await f.waitRetry(1);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Missed before unknown gap' })).ok, true);
  await control(f.fake.url, 'fault', { method: 'sendMessage', code: 500, response: 'accept-disconnect' });
  const accepted = f.fake.waitForRequest('sendMessage', row => String(row.params.text).startsWith('1 General messages missed since '));
  await f.clock.advance(10_000);
  await within(accepted, 1_000);
  await f.waitRetry(2);
  const snapshot = facts(f.root);
  const gap = snapshot.jobs.find(job => (job.payload as { key?: string }).key)!;
  assert.equal(gap.state, 'uncertain');
  assert.equal(snapshot.jobs.find(job => job.kind === 'general')!.state, 'missed');
  assert.ok(snapshot.gap);
  await f.clock.advance(1_000);
  await f.waitRetry(3);
  const later = facts(f.root);
  assert.equal(later.gap, snapshot.gap);
  assert.equal(later.jobs.filter(job => (job.payload as { key?: string }).key).length, 1);
  assert.equal(later.jobs.find(job => job.id === gap.id)!.state, 'uncertain');
  const native = await control<{ messages: Array<{ text: string }>; requests: Array<{ method: string }> }>(f.fake.url, 'state');
  assert.equal(native.messages.length, 1, 'accepted-but-unknown gap is never sent again');
  assert.equal(native.requests.filter(row => row.method === 'sendMessage').length, 1);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  await hub.stop();
  assert.equal(await f.fake.waitForPollClose(poll.id), poll.id);
  assert.equal(f.clock.pending, 0);
});

function pair(root: string): void {
  const db = new Store(join(root, '.cland/hub.db'));
  try { db.remotes.forMessenger('telegram').setPairing(pairing); } finally { db.close(); }
}
function facts(root: string) {
  const db = new Store(join(root, '.cland/hub.db'));
  try { const store = db.remotes.forMessenger('telegram'); return { jobs: store.outbox(), gap: store.get('telegram.gap') }; }
  finally { db.close(); }
}

for (const code of [401, 403]) {
  test(`Telegram gap ${code} stops the remote without acknowledging missed sources`, async t => {
    const f = await fixture(t);
    pair(f.root);
    const initial = f.fake.waitForPoll();
    const { hub, ui, status, history } = await f.start();
    const poll = await within(initial, 1_000);
    await control(f.fake.url, 'fault', { method: 'getUpdates', code: 503, retry_after: 10 });
    await control(f.fake.url, 'release-polls', {});
    await f.waitRetry(1);
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Missed before fatal gap' })).ok, true);
    await control(f.fake.url, 'fault', { method: 'sendMessage', code, echoToken: true });
    const cause = code === 401 ? 'wrong or revoked token (401)' : 'bot blocked (403)';
    const terminal = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).text.includes(cause), 1_000);
    await f.clock.advance(10_000);
    await within(terminal, 1_000);
    await until(async () => (await status()).connection === 'disabled', { what: 'fatal gap disables only Telegram', timeoutMs: 1_000 });
    assert.equal(facts(f.root).jobs.find(job => job.kind === 'general')!.state, 'missed');
    assert.ok(facts(f.root).gap);
    assert.match((await status()).reason!, /cland hub reload/);
    assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
    assert.equal((await history()).split(cause).length - 1, 1);
    const before = await control<{ messages: unknown[]; requests: unknown[] }>(f.fake.url, 'state');
    assert.deepEqual(before.messages, []);
    await f.clock.advance(180_000);
    const after = await control<{ requests: unknown[] }>(f.fake.url, 'state');
    assert.deepEqual(after.requests, before.requests, 'fatal gap is not retried');
    assert.equal((await history()).includes('Telegram remote offline since'), false, 'fatal stop cancels the outage timer');
    assert.equal(JSON.stringify([ui.frames, f.logs]).includes(TELEGRAM_TEST_TOKEN), false);
    await hub.stop();
    assert.equal(await f.fake.waitForPollClose(poll.id), poll.id);
    assert.equal(f.clock.pending, 0);
  });
}

test('Telegram membership kick during catch-up retains fatal reload recovery', async t => {
  const f = await fixture(t);
  pair(f.root);
  const initial = f.fake.waitForPoll();
  const { hub, ui, status } = await f.start();
  const poll = await within(initial, 1_000);
  await control(f.fake.url, 'fault', { method: 'getUpdates', code: 503 });
  await control(f.fake.url, 'release-polls', {});
  await f.waitRetry(1);
  await control(f.fake.url, 'membership', { status: 'kicked' });
  await f.clock.advance(1_000);
  await until(async () => (await status()).connection === 'disabled', { what: 'catch-up kick disabled receipt', timeoutMs: 1_000 });
  const resumed = f.fake.waitForPoll();
  const reloaded = await ui.request({ type: 'hub.reload' });
  assert.equal(reloaded.ok, true, reloaded.error);
  const active = await within(resumed, 1_000);
  assert.equal(active.params.offset, 2, 'the kicked update was confirmed before disable');
  assert.equal((await status()).connection, 'connected');
  const stopped = f.fake.waitForPollClose(active.id);
  await hub.stop();
  assert.equal(await within(stopped, 1_000), active.id);
  assert.equal(await f.fake.waitForPollClose(poll.id), poll.id);
  assert.equal(f.clock.pending, 0);
});
