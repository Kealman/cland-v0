// T2: phone commands through the production gateway and loopback Bot API.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, projectHub, tempProject } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { Store } from '../src/hub/store.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { control, pairing } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { within } from '../src/executor/droplet/deadline.ts';

const menu = [
  { command: 'status', description: 'Hub, sessions and queues' },
  { command: 'inbox', description: 'Show everything that needs you' },
  { command: 'mute', description: 'Mute the General stream' },
  { command: 'unmute', description: 'Resume the General stream' },
  { command: 'decision', description: 'Send a decision' },
  { command: 'question', description: 'Ask a question' },
  { command: 'cancel', description: 'Cancel an answer; keep the ask open' },
  { command: 'help', description: 'Commands and trust' },
  { command: 'start', description: 'Pair or show the project' },
];

test('Telegram registers the private menu on first start and only repairs platform changes', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Phone fixture');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  for (const expectedWrites of [1, 1, 2]) {
    if (expectedWrites === 2) await control(fake.url, 'commands', { commands: [{ command: 'stale', description: 'Old menu' }] });
    const polling = fake.waitForPoll();
    const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
    const poll = await within(polling, 1_000);
    const state = await control<{ requests: Array<{ method: string; params: Record<string, unknown> }> }>(fake.url, 'state');
    const writes = state.requests.filter(request => request.method === 'setMyCommands');
    assert.equal(writes.length, expectedWrites);
    assert.deepEqual(writes.at(-1)!.params, { scope: { type: 'all_private_chats' }, commands: menu });
    const reads = state.requests.filter(request => request.method === 'getMyCommands');
    assert.deepEqual(reads.at(-1)!.params, { scope: { type: 'all_private_chats' } });
    const closed = fake.waitForPollClose(poll.id);
    await hub.stop();
    assert.equal(await within(closed, 1_000), poll.id);
    assert.equal(clock.pending, 0);
  }
});

test('Telegram help is phone text with bold sections, command bullets and trust last', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Phone 📱 fixture');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').setPairing(pairing); } finally { store.close(); }
  const polling = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  await within(polling, 1_000);
  const confirmed = fake.waitForPoll();
  const update = await control<{ update_id: number }>(fake.url, 'say', { text: '/help@cland_fixture_bot' });
  const poll = await within(confirmed, 1_000, undefined, () => new Error('help durable handling receipt missing'));
  assert.equal(poll.params.offset, update.update_id + 1);
  const state = await control<{ requests: Array<{ method: string; params: { text?: string; entities?: Array<{ type: string; offset: number; length: number }>; parse_mode?: string } }> }>(fake.url, 'state');
  const reply = state.requests.filter(request => request.method === 'sendMessage').at(-1)!.params;
  assert.equal(reply.text?.split('\n')[0], 'Phone 📱 fixture — Help');
  const headings = reply.entities!.filter(entity => entity.type === 'bold').map(entity => reply.text!.slice(entity.offset, entity.offset + entity.length));
  assert.deepEqual(headings, ['Follow', 'Send', 'Commands']);
  for (const command of menu) assert.ok(reply.text!.includes(`• /${command.command}`));
  assert.equal(reply.parse_mode, undefined);
  const trust = reply.entities!.filter(entity => entity.type === 'italic');
  assert.ok(trust.length > 0);
  assert.equal(trust.at(-1)!.offset + trust.at(-1)!.length, reply.text!.length);
  assert.match(reply.text!, /Only the paired Telegram user/);
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
  assert.equal(clock.pending, 0);
});

test('Telegram status reads gateway facts with six session bullets and transport numbers last', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Phone 📱 fixture');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').setPairing(pairing); } finally { store.close(); }
  const polling = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  await within(polling, 1_000);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  for (let n = 1; n <= 6; n++) await inProcessSpoke(t, { cwd: root, discover: true, name: `worker-${n}`, sessionId: `worker-${n}` });
  const release = await coord.call<{ item: { id: string } }>('task.create', { title: 'Phone release', kind: 'release', version: '3.0.0' });
  const asked = await coord.call<{ ok: boolean }>('ask', { question: 'Keep this ask?', options: ['Keep', 'Wait'], topic: 'general' });
  assert.equal(asked.ok, true);
  const confirmed = fake.waitForPoll();
  const update = await control<{ update_id: number }>(fake.url, 'say', { text: '/status' });
  const poll = await within(confirmed, 1_000, undefined, () => new Error('status durable handling receipt missing'));
  assert.equal(poll.params.offset, update.update_id + 1);
  const state = await control<{ requests: Array<{ method: string; params: { text: string; entities: Array<{ type: string; offset: number; length: number }>; parse_mode?: string } }> }>(fake.url, 'state');
  const reply = state.requests.filter(request => request.method === 'sendMessage').at(-1)!.params;
  assert.equal(reply.text.split('\n')[0], 'Phone 📱 fixture — Status');
  const headings = reply.entities.filter(entity => entity.type === 'bold').map(entity => reply.text.slice(entity.offset, entity.offset + entity.length));
  assert.deepEqual(headings, ['Hub', 'Coordinator', 'Sessions (7)', 'Queues', 'Release', 'This chat']);
  assert.match(reply.text, /Hub\nVersion [^\n]+\nUp 0 min/);
  assert.match(reply.text, /Coordinator\ncoord\nNeeds you: 1/);
  assert.equal(reply.text.split('\n').filter(line => line.startsWith('• ')).length, 6);
  assert.match(reply.text, /1 more session/);
  assert.match(reply.text, new RegExp(`${release.item.id} Phone release`));
  assert.match(reply.text, /Queues\nVerification: idle\nWaiting: 0\nMerge queue: 0/);
  const small = reply.entities.filter(entity => entity.type === 'italic').at(-1)!;
  assert.equal(small.offset + small.length, reply.text.length);
  assert.match(reply.text.slice(small.offset), /Outbox: 0/);
  assert.equal(reply.parse_mode, undefined);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
  assert.equal(clock.pending, 0);
});

test('Telegram inbox repeats open asks and cancel leaves them open while start names the project', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Phone fixture');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').setPairing(pairing); } finally { store.close(); }
  const polling = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  let poll = await within(polling, 1_000);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const say = async (text: string) => {
    const confirmed = fake.waitForPoll();
    const update = await control<{ update_id: number }>(fake.url, 'say', { text });
    poll = await within(confirmed, 1_000, undefined, () => new Error(`${text} durable handling receipt missing`));
    assert.equal(poll.params.offset, update.update_id + 1);
    const state = await control<{ requests: Array<{ method: string; params: { text: string; entities?: unknown[]; parse_mode?: string } }> }>(fake.url, 'state');
    return state.requests.filter(request => request.method === 'sendMessage').map(request => request.params);
  };
  let replies = await say('/inbox');
  assert.equal(replies.at(-1)!.text, 'Phone fixture — Inbox\n\nNothing needs you');
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { question: 'Ship 📦 now?', options: ['Ship', 'Wait'], topic: 'general' });
  assert.equal(asked.ok, true);
  const strangerConfirmed = fake.waitForPoll();
  const stranger = await control<{ update_id: number }>(fake.url, 'say', { user: 'stranger', text: '/start' });
  poll = await within(strangerConfirmed, 1_000);
  assert.equal(poll.params.offset, stranger.update_id + 1);
  replies = await say('/inbox');
  const inboxReply = replies.at(-1)!;
  assert.match(inboxReply.text, /Ship 📦 now\?/);
  assert.match(inboxReply.text, /• Ship\n• Wait/);
  assert.ok(inboxReply.entities!.length > 0);
  assert.equal(inboxReply.parse_mode, undefined);
  assert.equal(inboxReply.text.includes('approve telegram'), false, 'remote inbox never exposes local pairing grants');
  const repeated = await say('/inbox');
  assert.equal(repeated.at(-1)!.text, inboxReply.text);
  replies = await say('/cancel');
  assert.equal(replies.at(-1)!.text, 'Phone fixture — Cancel\n\nCancelled. The ask stays open.');
  const inbox = (await ui.request({ type: 'inbox.list' })).value as import('../src/protocol.ts').Inbox;
  assert.equal(inbox.asks.find(ask => ask.id === asked.ask)!.question, 'Ship 📦 now?');
  replies = await say('/start');
  assert.equal(replies.at(-1)!.text, 'Paired with Phone fixture.');
  assert.ok(Array.isArray(replies.at(-1)!.entities));
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
  assert.equal(clock.pending, 0);
});

test('Telegram command replay does not repeat a reply committed before its lost HTTP receipt', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Replay fixture');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').setPairing(pairing); } finally { store.close(); }
  const polling = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  await within(polling, 1_000);
  await control(fake.url, 'fault', { method: 'sendMessage', code: 503, response: 'hold-after-send' });
  const committed = fake.waitForHeldRequest('sendMessage');
  const update = await control<{ update_id: number }>(fake.url, 'say', { text: '/cancel' });
  const commit = await within(committed, 1_000);
  const state = await control<{ messages: Array<{ text: string }> }>(fake.url, 'state');
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0]!.text, 'Replay fixture — Cancel\n\nCancelled. The ask stays open.');
  const responseClosed = fake.waitForConnectionClose('sendMessage');
  await hub.stop();
  assert.equal((await within(responseClosed, 1_000)).id, commit.id);
  const replayed = fake.waitForPoll();
  const restarted = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  const poll = await within(replayed, 1_000);
  assert.equal(poll.params.offset, update.update_id + 1, 'replayed command reaches its durable confirmation');
  const after = await control<typeof state>(fake.url, 'state');
  // Direct command replies have no outbox. A crash-lost reply is not replayed;
  // the human runs the command again. Native chat/message identity fences effects.
  assert.equal(after.messages.length, 1);
  const closed = fake.waitForPollClose(poll.id);
  await restarted.stop();
  assert.equal(await within(closed, 1_000), poll.id);
  assert.equal(clock.pending, 0);
});

test('Telegram command replies split long literal card text without treating it as Markdown', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Literal **📱** fixture');
  config.remote.telegram.enabled = true;
  config.remote.telegram.format = 'rich';
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').setPairing(pairing); } finally { store.close(); }
  const polling = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  await within(polling, 1_000);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const question = '**literal** _text_ [link](target)\n' + '📦'.repeat(1000) + 'q'.repeat(3500);
  const asked = await coord.call<{ ok: boolean }>('ask', { question, options: ['Keep'], topic: 'general' });
  assert.equal(asked.ok, true);
  const before = await control<{ requests: unknown[] }>(fake.url, 'state');
  const confirmed = fake.waitForPoll();
  const update = await control<{ update_id: number }>(fake.url, 'say', { text: '/inbox' });
  const poll = await within(confirmed, 1_000);
  assert.equal(poll.params.offset, update.update_id + 1);
  const state = await control<{ requests: Array<{ method: string; params: { text: string; entities: Array<{ type: string; offset: number; length: number }> } }> }>(fake.url, 'state');
  const replies = state.requests.slice(before.requests.length).filter(request => request.method === 'sendMessage').map(request => request.params);
  assert.ok(replies.length > 1, 'long command replies must split despite rich mirror format');
  let body = '';
  for (let index = 0; index < replies.length; index++) {
    const reply = replies[index]!;
    assert.ok([...reply.text].length <= 4096);
    assert.ok(reply.entities.length <= 100);
    assert.match(reply.text.split('\n')[0]!, new RegExp(`${index + 1}/${replies.length}$`));
    assert.ok(reply.text.startsWith('Literal **📱** fixture — Ask'));
    for (const entity of reply.entities) {
      assert.ok(entity.offset >= 0 && entity.offset + entity.length <= reply.text.length);
      assert.ok(['bold', 'italic'].includes(entity.type), 'literal links and formatting must stay literal');
    }
    body += reply.text.slice(reply.text.indexOf('\n') + 1);
  }
  assert.ok(body.includes(question), JSON.stringify({ beginning: body.slice(0, 160), actualLength: body.length, questionLength: question.length }));
  const closed = fake.waitForPollClose(poll.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), poll.id);
  assert.equal(clock.pending, 0);
});
