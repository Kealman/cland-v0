// T2: users-mode Discord through the sealed fake gateway and production hub.
import { nativeReplyHold } from './native-reply-hold.ts';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discordCardsFixture } from './discord-cards-fixture.ts';
import { DISCORD_IDS as ids } from './fakes/discord/fake-api.ts';
import { connectUi, inProcessSpoke, until } from './harness.ts';
import type { TopicMessage } from '../src/protocol.ts';

for (const separate of [false, true]) test(`Discord users in ${separate ? 'separate channels' : 'one channel'} receive General and cards once and fold every copy`, async t => {
  const f = await discordCardsFixture(t, undefined, undefined, undefined, false, undefined, undefined, undefined, undefined, true);
  await f.fake.control('configure', { sendLimit: 10000, sendWindow: 0, reactionWindow: 0 });
  const bob = f.store.users.add('bob', 'Bob', [], f.clock.now().getTime());
  const db = new DatabaseSync(join(f.root, '.cland/hub.db'));
  try { db.prepare("update users set state='active' where id=?").run(bob.id); } finally { db.close(); }
  const channel = separate ? ids.secondChannel : ids.channel;
  f.state.setUserPairing(bob.id, { userId: ids.member, chatId: channel, guildId: ids.guild, name: 'Bob' });
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  await f.coord.call('send', { topic: 'general', text: 'For every channel', kind: 'report' });
  await until(async () => (await f.fake.control('state')).messages.filter(m => m.content.includes('For every channel')).length === (separate ? 2 : 1), { what: 'General native receipts per channel', timeoutMs: 1500 });
  const general = (await f.fake.control('state')).messages.filter(m => m.content.includes('For every channel'));
  assert.deepEqual(general.map(m => m.channel_id).sort(), (separate ? [ids.channel, channel] : [channel]).sort());
  for (const user of ['human', 'member'] as const) {
    const target = user === 'human' ? ids.channel : channel;
    const native = await f.fake.control('say', { user, channel_id: target, content: `Hello from ${user}` });
    await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: native });
    await until(() => !!f.state.message(target, native.id), { what: `durable attributed input ${user}`, timeoutMs: 1500 });
    const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
    const message = history.messages.find(m => m.id === f.state.message(target, native.id)!.message)!;
    assert.equal(message.userId, user === 'human' ? f.store.users.first()!.id : bob.id);
    assert.equal(message.from, user === 'human' ? 'alice' : 'bob');
    if (separate) await until(async () => (await f.fake.control('state')).messages.filter(m => m.content.includes(`Hello from ${user}`)).length === 2, { what: 'cross-channel General receipt', timeoutMs: 1500 });
    const copies = (await f.fake.control('state')).messages.filter(m => m.content.includes(`Hello from ${user}`));
    assert.equal(copies.filter(m => m.channel_id === target).length, 1, 'native sender receives no bot echo');
    if (separate) assert.match(copies.find(m => m.channel_id !== target)!.content, new RegExp(`${message.from} · message`));
    const ask = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: `Choose ${user}`, options: ['Keep'] });
    await f.clock.advance(250);
    await until(() => f.state.messagesForAsk(ask.ask).length === (separate ? 2 : 1), { what: 'durable card copies', timeoutMs: 1500 });
    const copy = f.state.messagesForAsk(ask.ask).find(m => m.chatId === target)!;
    const foreign = await f.fake.control('interact', { user: 'administrator', channel_id: target, message_id: copy.messageId, custom_id: `ask:${ask.ask}:1` });
    await until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === foreign.id)?.callbacks.length, { what: 'foreign native refusal', timeoutMs: 1500 });
    assert.equal(f.frames.filter(r => r.frame.type === 'topic.answer').length, user === 'human' ? 0 : 1);
    await f.fake.control('interact', { user, channel_id: target, message_id: copy.messageId, custom_id: `ask:${ask.ask}:1` });
    await until(async () => {
      const messages = (await f.fake.control('state')).messages;
      return f.state.messagesForAsk(ask.ask).every(c => messages.find(m => m.id === c.messageId)?.content.includes(`${user === 'human' ? 'alice' : 'bob'} via Discord`));
    }, { what: 'named fold on every native copy', timeoutMs: 1500 });
    const answered = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages.find(m => m.id === ask.ask)!;
    assert.equal(answered.ask?.outcome?.userId, message.userId);
    assert.equal(answered.ask?.outcome?.by, message.from);
  }
  // A FIFO accepted message is the positive barrier after ignored foreign text.
  await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { id: '99000000000000001', channel_id: channel, author: { id: ids.administrator }, content: 'Unpaired input', type: 0 } });
  const barrier = await f.fake.control('say', { user: 'member', channel_id: channel, content: 'Accepted barrier' });
  await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: barrier });
  await until(() => !!f.state.message(channel, barrier.id), { what: 'accepted FIFO barrier', timeoutMs: 1500 });
  assert.equal(f.frames.some(r => r.frame.text === 'Unpaired input'), false);
  const pending = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Still open after restart', options: ['Yes'] });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(pending.ask).length === (separate ? 2 : 1), { what: 'open cards before downtime', timeoutMs: 1500 });
  const late: Array<{ id: string; channel: string }> = [];
  const recoveredHub = await f.restart(5000, async () => {
    for (const user of ['human', 'member'] as const) {
      const target = user === 'human' ? ids.channel : channel;
      const native = await f.fake.control('say', { user, channel_id: target, content: `Offline ${user}` });
      late.push({ id: native.id, channel: target });
    }
    f.state.set('discord.session', null);
  });
  await until(() => late.every(m => !!f.state.message(m.channel, m.id)), { what: 'per-channel durable history recovery', timeoutMs: 1500 });
  const reopened = await connectUi(t, recoveredHub.discovery, 'nvim');
  const recovered = (await reopened.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  for (const [index, native] of late.entries()) {
    const message = recovered.messages.find(m => m.id === f.state.message(native.channel, native.id)!.message)!;
    assert.equal(message.userId, index === 0 ? f.store.users.first()!.id : bob.id);
    assert.match(message.text, /written on Discord/);
  }
  for (const message of late) assert.ok(f.state.message(message.channel, message.id));
  await until(() => f.state.messagesForAsk(pending.ask).length === (separate ? 4 : 2), { what: 'replacement card in every recovered channel', timeoutMs: 1500 });
  await recoveredHub.stop();
});

for (const separate of [false, true]) test(`Discord users frozen history survives valid Resume in ${separate ? 'two channels' : 'one channel'}`, async t => {
  const f = await discordCardsFixture(t, undefined, undefined, undefined, false, undefined, undefined, undefined, undefined, true);
  await f.fake.control('configure', { sendLimit: 10000, sendWindow: 0, reactionWindow: 0, resumeWindow: 1000000 });
  const alice = f.store.users.first()!;
  const bob = f.store.users.add('bob', 'Bob', [], f.clock.now().getTime());
  const db = new DatabaseSync(join(f.root, '.cland/hub.db'));
  try { db.prepare("update users set state='active' where id=?").run(bob.id); } finally { db.close(); }
  const channel = separate ? ids.secondChannel : ids.channel;
  f.state.setUserPairing(bob.id, { userId: ids.member, chatId: channel, guildId: ids.guild, name: 'Bob' });
  for (const [user, target] of [['human', ids.channel], ['member', channel]] as const) {
    const seed = await f.fake.control('say', { user, channel_id: target, content: `Seed ${user}` });
    await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: seed });
    await until(() => !!f.state.message(target, seed.id), { what: 'durable cursor seed', timeoutMs: 1500 });
  }
  f.holdFrames('topic.send');
  const pending: Array<{ id: string; channel: string; userId: string; text: string }> = [];
  for (const [user, target, userId] of [['human', ids.channel, alice.id], ['member', channel, bob.id]] as const) {
    const text = `Frozen ${user}`;
    const native = await f.fake.control('say', { user, channel_id: target, content: text });
    pending.push({ id: native.id, channel: target, userId, text });
  }
  await f.fake.control('close', { code: 4003 });
  await until(async () => (await f.fake.control('state')).gateway.closes.includes(4003), { what: 'observed session-invalidating close', timeoutMs: 1500 });
  await f.clock.advance(5000);
  await until(() => pending.every(m => {
    const raw = f.state.get(`discord.history:${m.channel}`);
    return raw && (JSON.parse(raw) as { messages: Array<{ id: string }> }).messages.some(row => row.id === m.id);
  }) && f.frames.some(row => String(row.frame.text).startsWith('Frozen ')), { what: 'durable frozen batches and held input before interruption', timeoutMs: 1500 });
  let savedSession: string | null = null;
  const before = (await f.fake.control('state')).gateway;
  assert.equal(before.identifies, 2);
  assert.equal(pending.some(m => f.state.message(m.channel, m.id)), false);
  const recoveredHub = await f.restart(30000, async () => {
    f.discardFrames();
    savedSession = f.state.get('discord.session');
    assert.ok(savedSession, 'resumable stop persisted the valid Gateway session');
  });
  await until(async () => (await f.fake.control('state')).gateway.resumes === before.resumes + 1, { what: 'native Resume receipt', timeoutMs: 1500 });
  await until(() => pending.every(m => !!f.state.message(m.channel, m.id)), { what: 'frozen history durable receipts after Resume', timeoutMs: 1500 });
  const ui = await connectUi(t, recoveredHub.discovery, 'nvim');
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  for (const native of pending) {
    const matches = history.messages.filter(m => m.text.startsWith(native.text));
    assert.equal(matches.length, 1);
    assert.equal(matches[0]!.userId, native.userId);
    assert.equal(f.state.message(native.channel, native.id)!.message, matches[0]!.id);
    assert.equal(f.state.get(`discord.history:${native.channel}`), null);
  }
  const after = (await f.fake.control('state')).gateway;
  assert.equal(after.identifies, before.identifies, 'recovery did not force a fresh Identify');
  assert.equal(after.validResume, true);
  await recoveredHub.stop();
});


for (const boundary of ['history', 'gap', 'card'] as const) test(`Discord users isolate channel403 during ${boundary} recovery`, async t => {
  const f = await discordCardsFixture(t, undefined, undefined, undefined, false, undefined, undefined, undefined, undefined, true);
  await f.fake.control('configure', { sendLimit: 10000, sendWindow: 0, reactionWindow: 0 });
  const bob = f.store.users.add('bob', 'Bob', [], f.clock.now().getTime());
  const db = new DatabaseSync(join(f.root, '.cland/hub.db'));
  try { db.prepare("update users set state='active' where id=?").run(bob.id); } finally { db.close(); }
  f.state.setUserPairing(bob.id, { userId: ids.member, chatId: ids.secondChannel, guildId: ids.guild, name: 'Bob' });
  for (const [user, channel] of [['human', ids.channel], ['member', ids.secondChannel]] as const) {
    const seed = await f.fake.control('say', { user, channel_id: channel, content: `Seed ${user}` });
    await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: seed });
    await until(() => !!f.state.message(channel, seed.id), { what: 'durable channel cursor seed', timeoutMs: 1500 });
  }
  const open = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Recover this card', options: ['Yes'] });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(open.ask).length === 2, { what: 'both initial cards durable', timeoutMs: 1500 });
  if (boundary === 'gap') {
    const at = f.clock.now().toISOString();
    f.state.putOutbox({ id: 'blocked-gap-job', kind: 'general', source: 'blocked-gap-source', state: 'missed', created: at, updated: at,
      payload: { discord: true, channel: ids.channel, user: ids.human, content: 'Missed while offline' } });
  }
  let healthyId = '';
  const recoveredHub = await f.restart(5000, async () => {
    const native = await f.fake.control('say', { user: 'member', channel_id: ids.secondChannel, content: 'Healthy offline history' });
    healthyId = native.id;
    await f.fake.control('fault', { method: boundary === 'history' ? 'GET' : 'POST', path: `/channels/${ids.channel}${boundary === 'history' ? '' : '/messages'}`, status: 403, ...(boundary === 'gap' ? { contentIncludes: 'General messages missed' } : boundary === 'card' ? { contentIncludes: 'Recover this card' } : {}) });
    f.state.set('discord.session', null);
  });
  await until(() => !!f.state.message(ids.secondChannel, healthyId), { what: 'healthy channel history after peer403', timeoutMs: 1500 });
  await until(() => f.state.messagesForAsk(open.ask).filter(m => m.chatId === ids.secondChannel).length === 2, { what: 'healthy replacement card after peer403', timeoutMs: 1500 });
  const live = await f.fake.control('say', { user: 'member', channel_id: ids.secondChannel, content: 'Healthy live input' });
  await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: live });
  await until(() => !!f.state.message(ids.secondChannel, live.id), { what: 'healthy durable live input after peer403', timeoutMs: 1500 });
  const coord = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  await coord.call('send', { topic: 'general', text: 'General continues after peer403', kind: 'report' });
  await until(async () => (await f.fake.control('state')).messages.some(m => m.channel_id === ids.secondChannel && m.content.includes('General continues after peer403')), { what: 'healthy General after peer403', timeoutMs: 1500 });
  const next = await coord.call<{ ask: string }>('ask', { topic: 'general', question: 'New card after peer403', options: ['Yes'] });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(next.ask).some(m => m.chatId === ids.secondChannel), { what: 'healthy new card after peer403', timeoutMs: 1500 });
  assert.equal(f.state.status().disabled, false);
  if (boundary === 'card') assert.ok(f.state.outbox().some(job => job.kind === 'card' && job.state === 'dropped'
    && (job.payload as { channel?: string }).channel === ids.channel), 'native refused card has a durable dropped receipt');
  if (boundary === 'gap') {
    assert.ok(f.state.get(`discord.gap:${ids.channel}`), 'failed gap checkpoint remains owned');
    assert.equal(f.state.outbox().find(job => job.id === 'blocked-gap-job')!.state, 'missed');
    const restored = await f.restart(5000);
    await until(() => f.state.outbox().find(job => job.id === 'blocked-gap-job')!.state === 'reported', { what: 'restored channel confirms retained gap', timeoutMs: 1500 });
    assert.equal(f.state.get(`discord.gap:${ids.channel}`), null);
    assert.equal(f.state.status().disabled, false);
    await restored.stop();
  } else await recoveredHub.stop();
});

async function secondPress(t: import('node:test').TestContext, f: Awaited<ReturnType<typeof discordCardsFixture>>, fields: { message_id: string; custom_id: string }) {
  const hold = nativeReplyHold(t), callback = f.api.callback.bind(f.api);
  f.api.callback = async (...args) => {
    const result = await callback(...args);
    if (args[2] === 'Already answered') await hold.pause();
    return result;
  };
  let id = '', completed = false;
  const completion = until(() => !!id && f.state.get(`discord.interaction:${id}`) === '1', { what: 'exact owned interaction durably completed', timeoutMs: 1500 }).then(() => { completed = true; });
  try {
    id = (await f.fake.control('interact', { user: 'human', channel_id: ids.channel, ...fields })).id;
    await hold.entered();
    assert.equal(f.state.get(`discord.interaction:${id}`), null, 'post-ack handler remains unfinished');
    assert.equal(completed, false, 'completion observer must wait past native acknowledgement');
    hold.release();
    await completion;
    assert.equal(f.state.get(`discord.interaction:${id}`), '1');
    return { id };
  } finally { hold.release(); await completion; f.api.callback = callback; }
}

// Separate channels make the invoking-channel boundary observable.
test('Discord users slash commands preserve invocation attribution and first answer across inbox copies', async t => {
  const f = await discordCardsFixture(t, undefined, undefined, undefined, false, undefined, undefined, undefined, undefined, true, true);
  await f.fake.control('configure', { sendLimit: 10000, sendWindow: 0, reactionWindow: 0 });
  const bob = f.store.users.add('bob', 'Bob', [], f.clock.now().getTime());
  const invite = f.store.users.mintInvite(bob.id, f.clock.now().getTime());
  f.store.users.registerPassword(invite, 'fixture-hash', f.clock.now().getTime(), () => {});
  f.state.setUserPairing(bob.id, { userId: ids.member, chatId: ids.secondChannel, guildId: ids.guild, name: 'Bob' });
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  const command = async (user: 'human' | 'member', command: string, text?: string) => {
    const { id } = await f.fake.control('interact', { user, channel_id: user === 'human' ? ids.channel : ids.secondChannel, command, ...(text ? { text } : {}) });
    await until(async () => !!(await f.fake.control('state')).interactions.find(r => r.id === id)?.callbacks.length, { what: 'native slash completion', timeoutMs: 1500 });
    return (await f.fake.control('state')).interactions.find(r => r.id === id)!;
  };
  for (const user of ['human', 'member'] as const) {
    const help = await command(user, 'help');
    assert.match(JSON.stringify(help.callbacks), /Only paired Discord users in this channel can act\./);
    for (const kind of ['decision', 'question']) {
      const row = await command(user, kind, `${user} ${kind}`);
      assert.equal((row.callbacks[0] as { data: { content: string } }).data.content, 'Sent');
    }
  }
  const history = async () => ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  for (const [user, userId, from] of [['human', f.store.users.first()!.id, 'alice'], ['member', bob.id, 'bob']]) {
    for (const kind of ['decision', 'question']) {
      const rows = (await history()).filter(m => m.text === `${user} ${kind}`);
      assert.equal(rows.length, 1); assert.equal(rows[0]!.userId, userId); assert.equal(rows[0]!.from, from); assert.equal(rows[0]!.kind, kind);
    }
  }
  const ask = await f.coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Inbox first winner', options: ['Ship', 'Wait'] });
  await f.clock.advance(250);
  await until(() => f.state.messagesForAsk(ask.ask).length === 2, { what: 'initial durable copies', timeoutMs: 1500 });
  for (const user of ['human', 'member'] as const) {
    const before = f.state.messagesForAsk(ask.ask);
    await command(user, 'inbox');
    const copies = f.state.messagesForAsk(ask.ask);
    const added = copies.filter(c => !before.some(b => b.messageId === c.messageId));
    assert.equal(added.length, 1); assert.equal(added[0]!.chatId, user === 'human' ? ids.channel : ids.secondChannel);
  }
  const copies = f.state.messagesForAsk(ask.ask);
  const first = copies.find(c => c.chatId === ids.secondChannel)!;
  const folded = until(async () => { const native = await f.fake.control('state'); return copies.every(c => native.messages.find(m => m.id === c.messageId)?.content.includes('bob via Discord')); }, { what: 'all four copies folded', timeoutMs: 1500 });
  await f.fake.control('interact', { user: 'member', channel_id: ids.secondChannel, message_id: first.messageId, custom_id: `ask:${ask.ask}:1` });
  await folded;
  const before = await f.fake.control('state');
  const saved = (await history()).find(m => m.id === ask.ask)!.ask!.outcome;
  const second = copies.find(c => c.chatId === ids.channel)!;
  const press = await secondPress(t, f, { message_id: second.messageId, custom_id: `ask:${ask.ask}:2` });
  const finalHistory = await history();
  assert.deepEqual(finalHistory.find(m => m.id === ask.ask)!.ask!.outcome, saved);
  assert.equal(finalHistory.filter(m => m.answerTo === ask.ask).length, 1);
  const after = await f.fake.control('state');
  assert.equal((after.interactions.find(r => r.id === press.id)!.callbacks[0] as { data: { content: string } }).data.content, 'Already answered');
  assert.equal(f.frames.filter(r => r.frame.type === 'topic.answer').length, 1);
  assert.equal(saved!.userId, bob.id);
  // History contains one durable answer, not merely one attempted native send.
  for (const copy of copies) {
    const native = after.messages.find(m => m.id === copy.messageId)!;
    assert.match(native.content, /Ship.*bob via Discord/); assert.deepEqual(native.components, []);
    assert.equal(native.content, before.messages.find(m => m.id === copy.messageId)!.content);
    const edits = (state: typeof after) => state.requests.filter(r => r.method === 'PATCH' && r.path.endsWith(`/messages/${copy.messageId}`));
    assert.equal(edits(after).length, 1, 'one durable fold per copy');
    assert.deepEqual(edits(after), edits(before), 'second press does not fold again');
  }
  await f.hub.stop();
});

test('Discord users refuse a second paired approval answer and preserve every folded copy', async t => {
  const f = await discordCardsFixture(t, undefined, undefined, undefined, false, undefined, undefined, undefined, undefined, true, true);
  await f.fake.control('configure', { sendLimit: 10000, sendWindow: 0, reactionWindow: 0 });
  const bob = f.store.users.add('bob', 'Bob', [], f.clock.now().getTime());
  const invite = f.store.users.mintInvite(bob.id, f.clock.now().getTime());
  f.store.users.registerPassword(invite, 'fixture-hash', f.clock.now().getTime(), () => {});
  f.state.setUserPairing(bob.id, { userId: ids.member, chatId: ids.secondChannel, guildId: ids.guild, name: 'Bob' });
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  await ui.request({ type: 'subscribe' });
  assert.equal((await ui.request({ type: 'session.launch', name: 'approval-worker', harness: 'codex', role: 'implementer' })).ok, true);
  const raised = ui.waitFor(frame => frame.type === 'approval' && (frame.approval as { session: string }).session === 'approval-worker', 1500);
  f.hub.fakes.codex!.raiseApproval('approval-worker', { id: 'remote', kind: 'command', subject: { command: 'echo users' }, choices: ['once', 'deny'] });
  const id = ((await raised).approval as { id: string }).id;
  await f.clock.advance(250);
  await until(() => f.state.messagesForApproval(id).length === 2, { what: 'both approval mappings', timeoutMs: 1500 });
  const copies = f.state.messagesForApproval(id);
  const bobCopy = copies.find(c => c.chatId === ids.secondChannel)!;
  const folded = until(async () => { const native = await f.fake.control('state'); return copies.every(c => native.messages.find(m => m.id === c.messageId)?.content.includes('Approved once · bob via Discord')); }, { what: 'both named approval folds', timeoutMs: 1500 });
  await f.fake.control('interact', { user: 'member', channel_id: ids.secondChannel, message_id: bobCopy.messageId, custom_id: `approval:${id}:once` });
  await folded;
  const saved = f.store.inboxOutcome('approval', id)!;
  const before = await f.fake.control('state');
  const aliceCopy = copies.find(c => c.chatId === ids.channel)!;
  const press = await secondPress(t, f, { message_id: aliceCopy.messageId, custom_id: `approval:${id}:deny` });
  const after = await f.fake.control('state');
  assert.equal((after.interactions.find(r => r.id === press.id)!.callbacks[0] as { data: { content: string } }).data.content, 'Already answered');
  assert.equal(f.frames.filter(r => r.frame.type === 'approval.answer').length, 1);
  assert.equal(saved.userId, bob.id); assert.deepEqual(f.store.inboxOutcome('approval', id), saved);
  for (const copy of copies) {
    const native = after.messages.find(m => m.id === copy.messageId)!;
    assert.match(native.content, /Approved once · bob via Discord/); assert.deepEqual(native.components, []);
    assert.equal(native.content, before.messages.find(m => m.id === copy.messageId)!.content);
    const edits = (state: typeof after) => state.requests.filter(r => r.method === 'PATCH' && r.path.endsWith(`/messages/${copy.messageId}`));
    assert.equal(edits(after).length, 1, 'one durable fold per copy');
    assert.deepEqual(edits(after), edits(before), 'second press does not fold again');
  }
  await f.hub.stop();
});
