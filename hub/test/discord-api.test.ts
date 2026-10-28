// T2: plain-fetch Discord client against a loopback REST fake; no hub process.
import './cover-quiet.ts';
import { discordExchangeOwner } from './fakes/discord/exchange.ts';
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
  for (const status of [401, 403, 404]) {
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
  assert.equal(state.requests.length, 6, 'no invalid or unproven call is retried');
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
  await fake.control('configure', { sendLimit: 100 });
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

test('Discord follows channel headers for twelve sends and changed bucket limits', async t => {
  const { FakeClock } = await import('./fake-clock.ts');
  const clock = new FakeClock(); const { fake, api } = await discordExchangeOwner(t, { clock }).start();
  const abort = new AbortController(); t.after(() => abort.abort());
  const pending = Array.from({ length: 12 }, (_, i) => api.createMessage(fake.ids.channel, { content: String(i), nonce: `burst-${i}` }, { signal: abort.signal }));
  const all = Promise.all(pending); void all.catch(() => {});
  await Promise.all(pending.slice(0, 5)); // client completion includes the final bucket header
  await clock.advance(5000);
  await Promise.all(pending.slice(5, 10));
  await clock.advance(5000); await all;
  assert.deepEqual((await fake.control('state')).messages.map(m => m.content), Array.from({ length: 12 }, (_, i) => String(i)));
  assert.equal((await fake.control('state')).rateLimits, 0);
  await fake.control('configure', { sendLimit: 2, sendWindow: 700 });
  await api.createMessage(fake.ids.secondChannel, { content: 'a', nonce: 'changed-a' });
  await api.createMessage(fake.ids.secondChannel, { content: 'b', nonce: 'changed-b' });
  const third = api.createMessage(fake.ids.secondChannel, { content: 'c', nonce: 'changed-c' }, { signal: abort.signal });
  await clock.advance(699); assert.equal((await fake.control('state')).messages.length, 14);
  await clock.advance(1); await third;
  assert.equal((await fake.control('state')).rateLimits, 0);
});

for (const seconds of [0.25, 301]) for (const global of [true, false]) test(`Discord 429 waits ${seconds}s capped at five minutes, global=${global}, while callbacks bypass`, async t => {
  const { FakeClock } = await import('./fake-clock.ts'); const { until } = await import('./until.ts');
  const clock = new FakeClock(); const { fake, api } = await discordExchangeOwner(t, { clock }).start();
  const abort = new AbortController(); t.after(() => abort.abort());
  let refused = false; t.after(api.onError(error => { if (error.status === 429) refused = true; }));
  await fake.control('fault', { status: 429, retry_after: seconds, global });
  const first = api.getChannel(fake.ids.channel, { signal: abort.signal }); void first.catch(() => {});
  await until(() => refused, { timeoutMs: 1000, what: 'client received rate-limit refusal' });
  // The callback/edit receipts below ensure client I/O progresses before advancing time.
  const second = api.getChannel(fake.ids.secondChannel, { signal: abort.signal }); void second.catch(() => {});
  const interaction = await fake.control('interact', { command: 'status' });
  await api.callback(interaction.id, `synthetic_interaction_${interaction.id}`, 'callback');
  await api.editOriginal(fake.ids.application, `synthetic_interaction_${interaction.id}`, 'edited');
  assert.equal((await fake.control('state')).interactions[0]!.edits.length, 1);
  const wait = Math.min(300000, seconds * 1000);
  await clock.advance(wait - 1); assert.equal((await fake.control('state')).requests.filter(r => r.path.startsWith('/channels/')).length, global ? 1 : 2);
  await clock.advance(1); await Promise.all([first, second]);
  assert.equal((await fake.control('state')).requests.filter(r => r.path.startsWith('/channels/')).length, 3);
});

test('Discord retries transient errors with bounded backoff but never repeats invalid requests', async t => {
  const { FakeClock } = await import('./fake-clock.ts'); const { until } = await import('./until.ts');
  const clock = new FakeClock(); const { fake, api } = await discordExchangeOwner(t, { clock }).start();
  for (const status of [401, 403, 404]) {
    await fake.control('fault', { status }); await assert.rejects(api.getChannel(fake.ids.channel), (e: unknown) => e instanceof DiscordError && e.status === status);
  }
  assert.equal((await fake.control('state')).requests.length, 3);
  let failures = 0; t.after(api.onError(error => { if (error.status === 503) failures++; }));
  for (let i = 0; i < 4; i++) await fake.control('fault', { status: 503 });
  const call = assert.rejects(api.getChannel(fake.ids.channel), (e: unknown) => e instanceof DiscordError && e.status === 503);
  for (const [i, delay] of [1000, 2000, 4000].entries()) {
    await until(async () => (await fake.control('state')).requests.length === 4 + i, { timeoutMs: 1000, what: 'transient attempt' });
    await until(() => failures === i + 1, { timeoutMs: 1000, what: 'client received transient refusal' });
    await clock.advance(delay);
  }
  await call; assert.equal((await fake.control('state')).requests.length, 7);
});

test('Discord reaction headers pace one per 250ms independently of channel sends', async t => {
  const { FakeClock } = await import('./fake-clock.ts'); const clock = new FakeClock();
  const { fake, api } = await discordExchangeOwner(t, { clock }).start();
  const message = await api.createMessage(fake.ids.channel, { content: 'React', nonce: 'react' });
  await api.addReaction(fake.ids.channel, message.id, '👌');
  const abort = new AbortController(); t.after(() => abort.abort());
  const next = api.addReaction(fake.ids.channel, message.id, '👀', { signal: abort.signal }); void next.catch(() => {});
  await api.createMessage(fake.ids.channel, { content: 'Independent', nonce: 'independent' });
  await clock.advance(249);
  assert.equal((await fake.control('state')).requests.filter(r => r.method === 'PUT').length, 1);
  await clock.advance(1); await next;
  assert.equal((await fake.control('state')).requests.filter(r => r.method === 'PUT').length, 2);
  assert.equal((await fake.control('state')).rateLimits, 0);
});

for (const global of [false, true]) test(`Discord stored timeout then long 429 global=${global} never repeats an expired nonce`, async t => {
  const clock = new FakeClock();
  const { fake, api, run, signal } = await discordExchangeOwner(t, { clock, timeoutMs: 100 }).start();
  let limited = false; t.after(api.onError(error => { if (error.status === 429) limited = true; }));
  const held = run(() => fake.waitForHold(signal));
  await fake.control('fault', { response: 'holdStored' });
  await fake.control('fault', { status: 429, retry_after: 301, global });
  const send = api.createMessage(fake.ids.channel, { content: 'Once', nonce: 'old-proof' });
  const rejected = assert.rejects(send, /nonce proof window/); void rejected.catch(() => {});
  await held; assert.equal((await fake.control('state')).messages.length, 1);
  await clock.advance(100);
  const { until } = await import('./until.ts');
  await until(() => limited, { timeoutMs: 1000, what: 'client received retry limit' });
  await clock.advance(300000); await rejected;
  const state = await fake.control('state');
  assert.equal(state.requests.filter(r => r.method === 'POST').length, 2, 'no expired third POST');
  assert.equal(state.messages.length, 1);
});

test('Discord discovering route owns its shared bucket until body completion, independently per channel', async t => {
  const clock = new FakeClock(); const { fake, api, run, signal } = await discordExchangeOwner(t, { clock }).start();
  const first = await api.createMessage(fake.ids.channel, { content: 'Known', nonce: 'known' });
  const held = run(() => fake.waitForHold(signal));
  await fake.control('fault', { response: 'holdHeaders', bucket: 'message' });
  const edit = api.editMessage(fake.ids.channel, first.id, { content: 'Held discovering route' });
  await held;
  // Let independent I/O finish before observing admission on the already-known route.
  await api.getChannel(fake.ids.secondChannel);
  const queued = api.createMessage(fake.ids.channel, { content: 'After held body', nonce: 'queued' });
  await api.createMessage(fake.ids.secondChannel, { content: 'Other channel progresses', nonce: 'other-channel' });
  const state = await fake.control('state');
  assert.equal(state.messages.filter(m => m.channel_id === fake.ids.channel).length, 1, 'shared bucket excludes the known route until body receipt');
  assert.equal(state.messages.filter(m => m.channel_id === fake.ids.secondChannel).length, 1);
  await fake.control('release', {}); await Promise.all([edit, queued]);
  const final = await fake.control('state');
  assert.deepEqual(final.messages.filter(m => m.channel_id === fake.ids.channel).map(m => m.content), ['Held discovering route', 'After held body']);
});

test('Discord exchange owner drains omitted/aborted setup and frozen pacing waits', async t => {
  for (const mode of ['omitted', 'aborted', 'frozen'] as const) {
    const clock = new FakeClock();
    const owner = discordExchangeOwner(t, { clock, setupClock: clock, publishListening: mode === 'frozen' });
    if (mode !== 'frozen') {
      const starting = owner.start(); const failed = assert.rejects(starting, /deadline|aborted/); void failed.catch(() => {});
      await owner.listening();
      if (mode === 'omitted') await clock.advance(1000); else await owner.close();
      await failed;
    } else {
      const exchange = await owner.start();
      await exchange.fake.control('configure', { sendLimit: 1 });
      await exchange.api.createMessage(exchange.fake.ids.channel, { content: 'first', nonce: 'first' });
      const waiting = exchange.api.createMessage(exchange.fake.ids.channel, { content: 'frozen', nonce: 'frozen' });
      const failed = assert.rejects(waiting); void failed.catch(() => {});
      await exchange.api.getChannel(exchange.fake.ids.secondChannel);
      await owner.close(); await failed;
    }
    await owner.close();
    assert.deepEqual(owner.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, observers: 0, held: 0 });
    assert.equal(owner.pending(), 0); assert.equal(clock.pending, 0);
  }
});

test('Discord exchange owner joins missing heldStored observer and control aborted before launch', async t => {
  for (const launch of [true, false]) {
    const clock = new FakeClock(); const owner = discordExchangeOwner(t, { clock, publishHeld: false });
    const { fake, api, run, signal } = await owner.start();
    const observed = run(() => fake.waitForHold(signal)); const missing = assert.rejects(observed, /disposed|abort/i); void missing.catch(() => {});
    if (launch) {
      await run(() => fake.control('fault', { response: 'holdStored' }));
      const send = api.createMessage(fake.ids.channel, { content: 'held', nonce: 'held' });
      const failed = assert.rejects(send); void failed.catch(() => {});
      await run(() => fake.held()); await owner.close(); await failed;
    } else {
      await owner.close();
      await assert.rejects(run(() => fake.control('fault', { response: 'holdStored' })), /disposed/);
    }
    await missing; await owner.close();
    assert.equal(owner.pending(), 0); assert.equal(clock.pending, 0);
    assert.deepEqual(owner.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, observers: 0, held: 0 });
  }
});

test('Discord settled exchange subscription adds only channel health and preserves legacy error observers', async t => {
  const owner = discordExchangeOwner(t); const { fake, api, run } = await owner.start();
  const health: Array<{ channel: string; ok: boolean }> = [];
  const errors: string[] = [];
  const detach = api.onExchange((channel, ok) => health.push({ channel, ok }));
  const detachError = api.onError(error => errors.push(error.message));
  await run(() => fake.control('fault', { status: 400, code: 50035, echoToken: true }));
  await assert.rejects(api.createMessage(fake.ids.channel, { content: 'fails', nonce: 'health-fails' }), DiscordError);
  assert.deepEqual(health, [{ channel: fake.ids.channel, ok: false }]);
  assert.equal(errors.length, 1); assert.equal(errors[0]!.includes(DISCORD_TEST_TOKEN), false);
  await api.getChannel(fake.ids.channel);
  assert.equal(health.length, 1, 'reads do not heal failed sends');
  await api.createMessage(fake.ids.channel, { content: 'recovers', nonce: 'health-recovers' });
  assert.deepEqual(health, [{ channel: fake.ids.channel, ok: false }, { channel: fake.ids.channel, ok: true }]);
  detach(); detachError();
  await api.createMessage(fake.ids.secondChannel, { content: 'unsubscribed', nonce: 'health-detached' });
  assert.equal(health.length, 2);
  assert.equal(JSON.stringify(health).includes(DISCORD_TEST_TOKEN), false);
  await owner.close();
});
