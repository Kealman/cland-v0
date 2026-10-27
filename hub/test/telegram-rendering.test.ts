// T2: production gateway frames to the loopback Telegram API; no real platform.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, projectHub, tempProject, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { Store } from '../src/hub/store.ts';
import { fakeTelegram, telegramControl, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import { onCleanup } from './process-cleanup.ts';
import { TelegramRemote } from '../src/remote/telegram.ts';
import { TelegramApi } from '../src/remote/telegram-api.ts';
import type { HubFrame, TopicMessage } from '../src/protocol.ts';

async function fixture(t: TestContext, format: 'rich' | 'entities' = 'rich') {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram rendering');
  config.remote.telegram = { enabled: true, format };
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = new Store(join(root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Fixture human' }); }
  finally { store.close(); }
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  const ui = await connectUi(t, hub.discovery);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  return { root, fake, hub, ui, coord, clock };
}

test('Telegram mirrors an agent report as Rich Markdown with its author and kind', async t => {
  const { fake, hub, coord } = await fixture(t);
  const text = '# Results\n\n| Check | Result |\n| --- | --- |\n| Build | OK |\n\n```ts\nconst ok = true;\n```';
  const received = fake.waitForRequest('sendRichMessage');
  const closed = fake.waitForConnectionClose('sendRichMessage');
  void closed.catch(() => {});
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', kind: 'report', text })).ok, true);
  const request = await received;
  assert.deepEqual(request.params, { chat_id: '101', rich_message: { markdown: `coord · report\n${text}`, skip_entity_detection: true },
    link_preview_options: { is_disabled: true }, disable_notification: false });
  assert.equal((await closed).id, request.id);
  const state = await telegramControl<{ messages: Array<{ text: string }> }>(fake.url, 'state');
  assert.equal(state.status, 200);
  assert.equal(state.body.messages.at(-1)?.text, `coord · report\n${text}`);
  await hub.stop();
});

test('Telegram falls back after a Rich Message rejection to text and UTF-16 entities', async t => {
  const { fake, hub, coord } = await fixture(t);
  assert.equal((await telegramControl(fake.url, 'fault', { method: 'sendRichMessage', code: 400 })).status, 200);
  const received = fake.waitForRequest('sendMessage');
  const closed = fake.waitForConnectionClose('sendMessage');
  void closed.catch(() => {});
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', kind: 'report', text: '# Check\n\n😀 **ready** and `code`' })).ok, true);
  const request = await received;
  assert.deepEqual(request.params, { chat_id: '101', text: 'coord · report\nCheck\n\n😀 ready and code', entities: [
    { type: 'bold', offset: 0, length: 14 }, { type: 'bold', offset: 15, length: 5 },
    { type: 'bold', offset: 25, length: 5 }, { type: 'code', offset: 35, length: 4 },
  ], disable_notification: false, link_preview_options: { is_disabled: true } });
  assert.equal((await closed).id, request.id);
  const state = await telegramControl<{ messages: Array<{ text: string }> }>(fake.url, 'state');
  assert.equal(state.status, 200);
  assert.deepEqual(state.body.messages.map(message => message.text), ['coord · report\nCheck\n\n😀 ready and code']);
  await hub.stop();
});

test('Telegram entities format sends numbered parts without clipping a styled span', async t => {
  const { root, fake, hub, coord } = await fixture(t, 'entities');
  const paragraph = 'a'.repeat(3500);
  const text = `${paragraph}\n\n**${'😀'.repeat(900)}**`;
  const store = new Store(join(root, '.cland/hub.db'));
  onCleanup(t, async () => { await hub.stop(); store.close(); });
  const persisted = until(async () => {
    const state = await telegramControl<{ messages: Array<{ message_id: number; text: string }> }>(fake.url, 'state');
    const last = state.body.messages.find(message => message.text === `coord · report · 2/2\n${'😀'.repeat(900)}`);
    return !!last && !!store.remotes.forMessenger('telegram').message('101', String(last.message_id));
  }, { what: 'last numbered part accepted and mapping persisted', timeoutMs: 2000 });
  void persisted.catch(() => {});
  const received = fake.waitForRequest('sendMessage', request => String(request.params.text).startsWith('coord · report · 2/2'));
  const closed = fake.waitForConnectionClose('sendMessage');
  void closed.catch(() => {});
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', kind: 'report', text })).ok, true);
  const last = await received;
  await closed;
  await persisted;
  // Shutdown joins the receive writer, including mapping every accepted split part.
  await hub.stop();
  const state = await telegramControl<{ messages: Array<{ message_id: number; text: string }>; requests: Array<{ method: string; params: Record<string, unknown> }> }>(fake.url, 'state');
  assert.equal(state.status, 200);
  const sends = state.body.requests.filter(request => request.method.startsWith('send'));
  assert.deepEqual(sends.map(request => request.method), ['sendMessage', 'sendMessage']);
  assert.equal(last.params.text, `coord · report · 2/2\n${'😀'.repeat(900)}`);
  assert.deepEqual(last.params.entities, [{ type: 'bold', offset: 0, length: 20 }, { type: 'bold', offset: 21, length: 1800 }]);
  assert.equal(state.body.messages.length, 2);
  assert.equal(state.body.messages[0]!.text, `coord · report · 1/2\n${paragraph}\n\n`);
  const mapping = state.body.messages.map(message => store.remotes.forMessenger('telegram').message('101', String(message.message_id)));
  assert.ok(mapping.every(message => message?.topic === 'general' && message.message === mapping[0]!.message));
});

test('Telegram silently sends progress and hub notices and filters echoes answers asks and other topics', async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = new Store(join(root, '.cland/hub.db'));
  const remote = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock,
    { store: store.remotes.forMessenger('telegram') });
  onCleanup(t, async () => { await remote.stop(); store.close(); });
  store.remotes.forMessenger('telegram').setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Fixture human' });
  await remote.start(() => {});
  let sequence = 0;
  const frame = (fields: Partial<TopicMessage>): HubFrame => {
    const message: TopicMessage = { id: `message-${++sequence}`, seq: sequence, topic: 'general', from: 'agent', fromKind: 'agent',
      via: 'session', to: [], text: 'body', ts: clock.now().toISOString(), ...fields };
    return { type: 'message', topic: { id: message.topic, title: message.topic, unread: 0, lastMessageAt: message.ts }, message };
  };
  for (const fields of [
    { kind: 'progress', text: 'working' },
    { from: 'hub', fromKind: 'hub' as const, kind: 'event', text: 'notice' },
    { from: 'human', fromKind: 'human' as const, via: 'hub' as const, text: 'local' },
    { from: 'human', fromKind: 'human' as const, via: 'discord' as const, text: 'other remote' },
    { from: 'human', fromKind: 'human' as const, via: 'telegram' as const, text: 'own echo' },
    { answerTo: 'an-ask', text: 'answer' },
    { ask: { question: 'Ship?', options: ['yes'], free: true, state: 'open' as const }, text: 'human ask' },
    { topic: 'agents', text: 'agents traffic' },
    { topic: 'item-topic', text: 'item traffic' },
  ]) await remote.receive(frame(fields));
  await remote.stop();
  const state = await telegramControl<{ messages: Array<{ text: string }>; requests: Array<{ method: string; params: Record<string, unknown> }> }>(fake.url, 'state');
  assert.equal(state.status, 200);
  assert.deepEqual(state.body.messages.map(message => message.text), [
    'agent · progress\nworking', 'hub · event\nnotice', 'you · message\nlocal', 'you (Discord) · message\nother remote',
  ]);
  assert.deepEqual(state.body.requests.filter(request => request.method.startsWith('send')).map(request => request.params.disable_notification),
    [true, true, false, false]);
  assert.equal(clock.pending, 0);
});

test('Telegram excludes actual General ask and answer frames while mirroring a workbench message', async t => {
  const { fake, hub, coord, ui } = await fixture(t);
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Ship?', options: ['yes'] });
  assert.equal(asked.ok, true);
  assert.equal((await ui.request({ type: 'topic.answer', ask: asked.ask, option: 1 })).ok, true);
  const received = fake.waitForRequest('sendRichMessage', receipt => (receipt.params.rich_message as { markdown: string }).markdown === 'you · message\nfrom workbench');
  const closed = fake.waitForConnectionClose('sendRichMessage');
  void closed.catch(() => {});
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'from workbench' })).ok, true);
  const request = await received;
  assert.equal((await closed).id, request.id);
  const state = await telegramControl<{ messages: Array<{ text: string }> }>(fake.url, 'state');
  assert.equal(state.status, 200);
  assert.deepEqual(state.body.messages.map(message => message.text), ['you · message\nfrom workbench']);
  await hub.stop();
});

test('Telegram quoted code passes provider nesting checks and leaves the remote serving', async t => {
  const { fake, hub, coord, clock } = await fixture(t, 'entities');
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock });
  const codeRejected = fake.waitForRequest('sendMessage');
  const codeClosed = fake.waitForConnectionClose('sendMessage');
  void codeClosed.catch(() => {});
  await assert.rejects(api.sendMessage({ chat_id: '101', text: 'run cmd', entities: [
    { type: 'blockquote', offset: 0, length: 7 }, { type: 'code', offset: 4, length: 3 },
  ] }), /400 Invalid Telegram entity nesting/, 'the provider rejects the previous unsupported shape');
  assert.equal((await codeClosed).id, (await codeRejected).id);
  const linkRejected = fake.waitForRequest('sendMessage');
  const linkClosed = fake.waitForConnectionClose('sendMessage');
  void linkClosed.catch(() => {});
  await assert.rejects(api.sendMessage({ chat_id: '101', text: 'see docs', entities: [
    { type: 'blockquote', offset: 0, length: 8 }, { type: 'text_link', offset: 4, length: 4, url: 'https://example.test' },
  ] }), /400 Invalid Telegram entity nesting/, 'the same provider boundary rejects a quoted link');
  assert.equal((await linkClosed).id, (await linkRejected).id);
  const quoted = fake.waitForRequest('sendMessage');
  const quoteClosed = fake.waitForConnectionClose('sendMessage');
  void quoteClosed.catch(() => {});
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: '> run `cmd`\n> keep *care*' })).ok, true);
  const quoteRequest = await quoted;
  assert.equal(quoteRequest.params.text, 'coord · report\nrun cmd\nkeep care');
  assert.equal((await quoteClosed).id, quoteRequest.id);
  const quotedState = await telegramControl<{ messages: Array<{ text: string }> }>(fake.url, 'state');
  assert.deepEqual(quotedState.body.messages.map(message => message.text), ['coord · report\nrun cmd\nkeep care']);
  const next = fake.waitForRequest('sendMessage', request => request.params.text === 'coord · report\nstill serving');
  const closed = fake.waitForConnectionClose('sendMessage');
  void closed.catch(() => {});
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'still serving' })).ok, true);
  const receipt = await next;
  assert.equal((await closed).id, receipt.id);
  const state = await telegramControl<{ messages: Array<{ text: string }> }>(fake.url, 'state');
  assert.deepEqual(state.body.messages.map(message => message.text), ['coord · report\nrun cmd\nkeep care', 'coord · report\nstill serving']);
  const status = await ui.request({ type: 'remote.status' });
  assert.equal(status.ok, true, status.error);
  assert.equal((status.value as { remotes: Array<{ connection: string }> }).remotes[0]!.connection, 'connected');
  await hub.stop();
});
