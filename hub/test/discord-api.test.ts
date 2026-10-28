// T2: plain-fetch Discord client against a loopback REST fake; no hub process.
import './cover-quiet.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DiscordApi, DiscordError } from '../src/remote/discord-api.ts';
import { FakeClock } from './fake-clock.ts';
import { discordFixtureOwner, fakeDiscordFixture, DISCORD_TEST_TOKEN } from './fakes/discord/fake-api.ts';

test('Discord enforced nonce stores one message and creates and edits suppress every mention', async t => {
  const fake = await fakeDiscordFixture(t);
  const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url });
  const params = { content: `<@${fake.ids.human}> <@&${fake.ids.role}> @everyone`, nonce: 'one-send' };
  const first = await api.createMessage(fake.ids.channel, params);
  const again = await api.createMessage(fake.ids.channel, params);
  assert.equal(first.id, again.id);
  await api.editMessage(fake.ids.channel, first.id, { content: params.content });
  const state = await fake.control('state');
  assert.equal(state.messages.length, 1);
  const writes = state.requests.filter(r => r.method === 'POST' || r.method === 'PATCH');
  assert.equal(writes.length, 3);
  for (const write of writes) {
    assert.deepEqual(write.body.allowed_mentions, { parse: [] });
    if (write.method === 'POST') assert.equal(write.body.enforce_nonce, true);
  }
  assert.deepEqual(state.pings, [{ users: [], roles: [], everyone: false }, { users: [], roles: [], everyone: false }]);
});

test('Discord reads application, gateway, channel and descending history without rounding snowflakes', async t => {
  const fake = await fakeDiscordFixture(t);
  const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url });
  await fake.control('configure', { application: { flags: 32768, bot_public: true, interactions_endpoint_url: 'https://endpoint.invalid' },
    session_start_limit: { total: 1000, remaining: 42, reset_after: 60000, max_concurrency: 1 } });
  assert.deepEqual(await api.getCurrentApplication(), { id: fake.ids.application, flags: 32768, bot_public: true, interactions_endpoint_url: 'https://endpoint.invalid' });
  assert.deepEqual(await api.getGatewayBot(), { url: fake.url.replace('http:', 'ws:'), session_start_limit: { total: 1000, remaining: 42, reset_after: 60000, max_concurrency: 1 } });
  const posted = [];
  for (const user of ['human', 'member', 'bot', 'webhook'] as const) posted.push(await fake.control('say', { user, content: user }));
  const state = await fake.control('state');
  assert.deepEqual(state.members, [
    { user_id: fake.ids.human, guild_id: fake.ids.guild, permissions: '8' },
    { user_id: fake.ids.member, guild_id: fake.ids.guild, permissions: '0' },
  ]);
  const messages = state.messages;
  assert.equal(messages[0]!.author.id, fake.ids.human);
  assert.equal(messages[1]!.author.id, fake.ids.member);
  assert.equal(messages[2]!.author.bot, true);
  assert.equal(messages[3]!.webhook_id, fake.ids.webhook);
  assert.equal((await api.getChannel(fake.ids.channel)).last_message_id, messages[3]!.id);
  const page = await api.listMessages(fake.ids.channel, { limit: 2 });
  assert.deepEqual(page.map(m => m.id), [messages[3]!.id, messages[2]!.id]);
  const older = await api.listMessages(fake.ids.channel, { before: page[1]!.id, limit: 2 });
  assert.deepEqual(older.map(m => m.id), [messages[1]!.id, messages[0]!.id]);
  assert.equal(older[1]!.id, '90071992547410000');
  assert.equal((await api.getChannel(fake.ids.secondChannel)).last_message_id, null);
});


test('Discord redacts echoed errors and receipts, refuses redirects and validates roots before fetch', async t => {
  const fake = await fakeDiscordFixture(t);
  const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url });
  const logs: unknown[] = [];
  for (const method of ['log', 'warn', 'error'] as const) t.mock.method(console, method, (...args: unknown[]) => logs.push(args));
  for (const status of [401, 403, 404, 429, 500]) {
    await fake.control('fault', { status, code: 50035, retry_after: 7, echoToken: true });
    await assert.rejects(api.getCurrentApplication(), error => {
      assert.ok(error instanceof DiscordError);
      assert.equal(error.route, 'GET /oauth2/applications/@me');
      assert.equal(error.status, status);
      assert.equal(error.code, 50035);
      assert.equal(error.retryAfter, 7);
      assert.equal(JSON.stringify([error, error.stack, String(error)]).includes(DISCORD_TEST_TOKEN), false);
      assert.equal(Object.hasOwn(error, 'cause'), false);
      return true;
    });
  }
  for (const response of ['redirect', 'disconnect']) {
    await fake.control('fault', { response });
    await assert.rejects(api.getCurrentApplication(), DiscordError);
  }
  const sent = await api.createMessage(fake.ids.channel, { content: DISCORD_TEST_TOKEN, nonce: 'safe-receipt' });
  assert.equal(JSON.stringify(sent).includes(DISCORD_TEST_TOKEN), false);
  const state = await fake.control('state');
  assert.equal(state.redirectsFollowed, 0);
  assert.equal(state.requests.length, 8, 'no failed call is retried');
  assert.equal(state.requests[0]!.userAgentValid, true);
  assert.equal(JSON.stringify([state, logs]).includes(DISCORD_TEST_TOKEN), false);
  let requested = 0;
  t.mock.method(globalThis, 'fetch', async () => { requested++; throw new Error('must not request'); });
  for (const apiRoot of ['https://discord.com/api/v10', 'https://example.invalid', 'http://localhost:8123', 'http://127.0.0.1', 'http://127.0.0.1:0',
    'http://127.1:8123', 'http://127.0.0.1:8123?key=x', 'http://user:pass@127.0.0.1:8123', 'broken']) {
    assert.throws(() => new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot }), /explicit loopback HTTP/);
  }
  const previous = process.env.CLAND_DISCORD_API_ROOT;
  try {
    process.env.CLAND_DISCORD_API_ROOT = 'http://example.invalid:8123';
    assert.throws(() => new DiscordApi(DISCORD_TEST_TOKEN), /explicit loopback HTTP/);
  } finally {
    if (previous === undefined) delete process.env.CLAND_DISCORD_API_ROOT;
    else process.env.CLAND_DISCORD_API_ROOT = previous;
  }
  assert.equal(requested, 0);
});

test('Discord nonce expires on the injected clock and rejects missing or overlong nonces before sending', async t => {
  const clock = new FakeClock();
  const fake = await fakeDiscordFixture(t, { clock });
  const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url });
  const first = await api.createMessage(fake.ids.channel, { content: 'first', nonce: 'expiry' });
  await clock.advance(300001);
  const second = await api.createMessage(fake.ids.channel, { content: 'second', nonce: 'expiry' });
  assert.notEqual(second.id, first.id);
  for (const nonce of ['', 'x'.repeat(26)]) await assert.rejects(api.createMessage(fake.ids.channel, { content: 'bad', nonce }), DiscordError);
  assert.equal((await fake.control('state')).requests.length, 2);
});


test('Discord fake enforces Unicode content and legacy component limits on create and edit', async t => {
  const fake = await fakeDiscordFixture(t);
  const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url });
  const button = { type: 2 as const, style: 1, label: '😀'.repeat(80), custom_id: 'a'.repeat(100) };
  const row = { type: 1 as const, components: [button] };
  const valid = await api.createMessage(fake.ids.channel, { content: '😀'.repeat(2000), nonce: 'boundary', components: Array.from({ length: 5 }, () => ({ ...row, components: Array.from({ length: 5 }, () => button) })) });
  for (const input of [
    { content: '😀'.repeat(2001) },
    { components: Array.from({ length: 6 }, () => row) },
    { components: [{ ...row, components: Array.from({ length: 6 }, () => button) }] },
    { components: [{ ...row, components: [{ ...button, label: '😀'.repeat(81) }] }] },
    { components: [{ ...row, components: [{ ...button, custom_id: 'a'.repeat(101) }] }] },
  ]) {
    for (const invoke of [
      () => api.createMessage(fake.ids.channel, { ...input, nonce: 'invalid' }),
      () => api.editMessage(fake.ids.channel, valid.id, input),
    ]) await assert.rejects(invoke(), error => {
      assert.ok(error instanceof DiscordError);
      assert.equal(error.status, 400);
      assert.equal(error.code, 50035);
      return true;
    });
  }
  assert.equal((await fake.control('state')).messages.length, 1);
  assert.equal((await api.listMessages(fake.ids.channel))[0]!.content, valid.content);
});

test('Discord sanitizes a successful provider body containing the credential', async t => {
  const fake = await fakeDiscordFixture(t);
  const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url });
  await fake.control('fault', { status: 200, echoToken: true });
  assert.equal(JSON.stringify(await api.getCurrentApplication()).includes(DISCORD_TEST_TOKEN), false);
});

test('Discord fake default mention behavior is a positive control for suppressed client mentions', async t => {
  const fake = await fakeDiscordFixture(t);
  const content = `<@${fake.ids.human}> <@&${fake.ids.role}> @everyone`;
  const response = await fetch(`${fake.url}/channels/${fake.ids.channel}/messages`, {
    method: 'POST', headers: { authorization: `Bot ${DISCORD_TEST_TOKEN}`, connection: 'close', 'content-type': 'application/json' },
    body: JSON.stringify({ content, nonce: 'raw' }), signal: AbortSignal.timeout(2000),
  });
  assert.equal(response.status, 200);
  await response.json();
  assert.deepEqual((await fake.control('state')).pings, [{ users: [fake.ids.human], roles: [fake.ids.role], everyone: true }]);
});

test('Discord held requests release or abort with bounded cleanup', async t => {
  const fake = await fakeDiscordFixture(t);
  const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url });
  for (const abort of [false, true]) {
    await fake.control('fault', { response: 'hold' });
    const held = fake.waitForHold();
    const controller = new AbortController();
    const call = api.getCurrentApplication({ signal: controller.signal });
    const outcome = abort ? assert.rejects(call, DiscordError) : call;
    try {
      assert.ok(await held);
      if (abort) controller.abort();
      else await fake.control('release', {});
      const result = await outcome;
      if (!abort) assert.equal(result!.id, fake.ids.application);
    } finally {
      controller.abort();
      await Promise.allSettled([held, outcome]);
    }
  }
});


test('Discord fake omitted and aborted serving receipts close the acquisition owner', async t => {
  for (const mode of ['omitted', 'aborted'] as const) {
    const setupClock = new FakeClock();
    const abort = new AbortController();
    const owner = discordFixtureOwner(t, { setupClock, publishListening: false, signal: abort.signal });
    const nativeListening = owner.listening();
    const starting = owner.start();
    const rejected = assert.rejects(starting, mode === 'omitted' ? /listening receipt deadline/ : /setup aborted/);
    try {
      await nativeListening;
      if (mode === 'omitted') await setupClock.advance(1000);
      else abort.abort();
      await rejected;
    } finally {
      abort.abort();
      const closed = owner.close();
      assert.equal(owner.close(), closed, 'disposal is idempotent');
      await closed;
      await Promise.allSettled([starting, rejected, nativeListening]);
    }
    assert.deepEqual(owner.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, observers: 0, held: 0 });
    assert.equal(setupClock.pending, 0);
  }
});

test('Discord fake omitted and aborted hold observations always join the call and observers', async t => {
  for (const mode of ['omitted', 'aborted'] as const) {
    const setupClock = new FakeClock();
    const fake = await fakeDiscordFixture(t, { setupClock, publishHeld: false });
    const api = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url });
    await fake.control('fault', { response: 'hold' });
    const controller = new AbortController();
    const observer = new AbortController();
    const held = fake.waitForHold(observer.signal);
    const missing = assert.rejects(held, mode === 'omitted' ? /hold receipt deadline/ : /observation aborted/);
    const call = api.getCurrentApplication({ signal: controller.signal });
    const failedCall = assert.rejects(call, DiscordError);
    try {
      // This native receipt is separate from the deliberately omitted public observer.
      await fake.held();
      if (mode === 'omitted') await setupClock.advance(1000);
      else observer.abort();
      await missing;
    } finally {
      controller.abort();
      observer.abort();
      await fake.close();
      await Promise.allSettled([held, missing, call, failedCall]);
    }
    assert.equal(setupClock.pending, 0);
    assert.deepEqual(fake.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, observers: 0, held: 0 });
  }
});

test('Discord fake closed before acquisition cancels native observers and refuses later start', async t => {
  const owner = discordFixtureOwner(t);
  const native = owner.listening();
  const rejected = assert.rejects(native, /abort/i);
  await owner.close();
  await rejected;
  await assert.rejects(owner.start(), /setup aborted/);
  assert.deepEqual(owner.receipts(), { listening: false, closed: true, connections: 0, handlers: 0, observers: 0, held: 0 });
});

test('Discord fake omitted and aborted websocket setup receipts dispose the same native owner', async t => {
  for (const mode of ['omitted', 'aborted'] as const) {
    const setupClock = new FakeClock(); const abort = new AbortController();
    const owner = discordFixtureOwner(t, { setupClock, publishGatewayListening: false, signal: abort.signal });
    const native = owner.gatewayListening(); const starting = owner.start();
    const failed = assert.rejects(starting, mode === 'omitted' ? /gateway listening receipt deadline/ : /setup aborted/);
    try {
      await native;
      if (mode === 'omitted') await setupClock.advance(1000); else abort.abort();
      await failed;
    } finally {
      abort.abort(); await owner.close(); await Promise.allSettled([native, starting, failed]);
    }
    assert.deepEqual(owner.gatewayReceipts(), { listening: true, closed: true, clients: 0 });
    assert.deepEqual(owner.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, observers: 0, held: 0 });
    assert.equal(setupClock.pending, 0);
  }
});

test('Discord fake omitted and aborted websocket close observers retain held REST drainage', async t => {
  const { WebSocket } = await import('ws');
  const { within } = await import('../src/executor/droplet/deadline.ts');
  for (const mode of ['omitted', 'aborted'] as const) {
    const setupClock = new FakeClock();
    const fake = await fakeDiscordFixture(t, { setupClock, publishGatewayClose: false });
    const socket = new WebSocket(fake.url.replace('http:', 'ws:'));
    const closed = new Promise<void>(resolve => socket.once('close', () => resolve()));
    socket.on('error', () => {});
    const hello = new Promise<void>(resolve => socket.once('message', () => resolve()));
    const observerAbort = new AbortController();
    const observer = fake.waitForGatewayClose(observerAbort.signal);
    const missing = assert.rejects(observer, mode === 'omitted' ? /gateway close receipt deadline/ : /abort/i);
    await fake.control('fault', { response: 'hold' });
    const held = fake.waitForHold();
    const callAbort = new AbortController();
    const call = new DiscordApi(DISCORD_TEST_TOKEN, { apiRoot: fake.url }).getCurrentApplication({ signal: callAbort.signal });
    void call.catch(() => {});
    try {
      await within(hello, 1000); await held;
      await within(fake.closeGateway(), 1000); await within(closed, 1000);
      assert.deepEqual(fake.gatewayReceipts(), { listening: true, closed: true, clients: 0 });
      if (mode === 'omitted') await setupClock.advance(1000); else observerAbort.abort();
      await missing;
      await fake.close();
    } finally {
      callAbort.abort(); observerAbort.abort(); socket.terminate();
      await fake.close(); await Promise.allSettled([call, observer, missing, held, closed]);
    }
    assert.deepEqual(fake.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, observers: 0, held: 0 });
    assert.equal(setupClock.pending, 0);
  }
});
