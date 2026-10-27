// T2: production Telegram factory, sealed project frames and loopback fake; fake time owns behavior.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import type { TopicMessage } from '../src/protocol.ts';
import type { TgMessage, TgUpdate } from '../src/remote/telegram-api.ts';
import { until, cland } from './harness.ts';
import { TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { control, pairing } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { telegramLivenessFixture as fixture } from './telegram-liveness-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { Store } from '../src/hub/store.ts';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { frameClient } from './harness.ts';
import { onCleanup } from './process-cleanup.ts';
import { doctor, toolchain } from './doctor-fixture.ts';
import type { Check } from '../src/doctor/report.ts';

async function doctorStop(t: import('node:test').TestContext, root: string) {
  const tools = await toolchain(t);
  const result = await doctor(root, tools.env, '--json');
  const check = (JSON.parse(result.stdout) as { checks: Check[] }).checks.find(row => row.name === 'telegram stopped');
  assert.ok(check, 'doctor names the stopped remote cause');
  assert.equal(check.verdict, 'warn');
  return check;
}

test('Telegram liveness missing startup receipt disposes the owned hub and native connections', async t => {
  const setupClock = new FakeClock();
  const f = await fixture(t, { setupClock, publishReady: false });
  const failed = assert.rejects(f.start(), /Telegram liveness startup receipt deadline reached/);
  const actual = await f.actual();
  await setupClock.advance(1_000);
  await failed;
  await within(actual.stopped, 1_000);
  assert.deepEqual(f.receipts(), { joined: true, stopped: true, listening: true, closed: true, connections: 0, handlers: 0, nativeError: null });
  assert.equal(f.clock.pending, 0);
  assert.equal(setupClock.pending, 0);
  await f.dispose();
});

test('Telegram liveness aborted held startup joins getMe and closes the late hub before disposal', async t => {
  const abort = new AbortController();
  const f = await fixture(t, { signal: abort.signal });
  await control(f.fake.url, 'fault', { method: 'getMe', code: 500, response: 'hold' });
  const held = f.fake.waitForHeldRequest('getMe');
  const failed = assert.rejects(f.start(), /cancel held Telegram startup/);
  const receipt = await within(held, 1_000);
  assert.equal(receipt.method, 'getMe');
  abort.abort(new Error('cancel held Telegram startup'));
  await failed;
  assert.deepEqual(f.receipts(), { joined: true, stopped: true, listening: true, closed: true, connections: 0, handlers: 0, nativeError: null });
  assert.equal(f.clock.now().toISOString(), '2026-10-16T12:00:00.000Z', 'the frozen transport timeout did not supply cleanup');
  assert.equal(f.clock.pending, 0);
  await f.dispose();
});

test('Telegram restarts stalled 40-second and offline zero-timeout polls exactly 15 seconds after their timeout', async t => {
  const f = await fixture(t);
  await control(f.fake.url, 'stall', { enabled: true });
  const polled = f.fake.waitForPoll();
  const { hub, status } = await f.start();
  const poll = await within(polled, 1_000);
  assert.equal(poll.params.timeout, 40);
  assert.equal((await status()).connection, 'connected', 'getMe is a successful exchange');
  await f.clock.advance(54_999);
  const held = await control<{ pendingPolls: Array<{ id: number }> }>(f.fake.url, 'state');
  assert.deepEqual(held.pendingPolls.map(row => row.id), [poll.id], 'the real native poll survives to timeout plus 14999 ms');
  const closed = f.fake.waitForPollClose(poll.id);
  await f.clock.advance(1);
  assert.equal(await within(closed, 1_000), poll.id);
  await f.waitRetry(1);
  const retry = f.fake.waitForPoll();
  await f.clock.advance(1_000);
  const offline = await within(retry, 1_000);
  assert.equal(offline.params.timeout, 0);
  const offlineClosed = f.fake.waitForPollClose(offline.id);
  await f.clock.advance(14_999);
  const stillHeld = await control<{ pendingPolls: Array<{ id: number }> }>(f.fake.url, 'state');
  assert.deepEqual(stillHeld.pendingPolls.map(row => row.id), [offline.id]);
  await f.clock.advance(1);
  assert.equal(await within(offlineClosed, 1_000), offline.id);
  await f.waitRetry(2);
  assert.equal((await status()).connection, 'disconnected', 'failed requests never renew successful traffic');
  await hub.stop();
  assert.equal(f.clock.pending, 0);
});

test('Telegram rides out 409 for 60 seconds then reports another consumer without replacing its lease', async t => {
  const f = await fixture(t);
  for (let i = 0; i <= 60; i++) await control(f.fake.url, 'fault', { method: 'getUpdates', code: 409, echoToken: true, ...(i === 0 ? { retry_after: 300 } : {}) });
  const { hub, ui, status, history } = await f.start();
  await f.waitRetry(1);
  const db = new Store(join(f.root, '.cland/hub.db'));
  const owner = db.remotes.pollerLease();
  assert.ok(owner);
  db.close();
  for (let second = 1; second < 60; second++) {
    await f.clock.advance(1_000);
    await f.waitRetry(second + 1);
  }
  assert.notEqual((await status()).connection, 'disabled', 'startup conflicts get the whole 60-second grace');
  assert.equal((await history()).includes('another consumer of the token'), false);
  const terminal = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).topic === 'general'
    && (frame.message as TopicMessage).text.includes('another consumer of the token'), 1_000);
  const closed = f.fake.waitForConnectionClose('getUpdates');
  await f.clock.advance(1_000);
  await within(terminal, 1_000);
  await within(closed, 1_000);
  const row = await status();
  assert.equal(row.connection, 'disabled');
  assert.equal(row.stopCause, 'other-consumer');
  const stopped = await doctorStop(t, f.root);
  assert.equal(stopped.detail, 'another consumer of the token (409)');
  assert.equal(stopped.fix, 'stop the other token consumer, then run cland hub reload');
  assert.ok((await history()).includes(`${stopped.detail}; ${stopped.fix}`));
  assert.match(row.reason!, /another consumer of the token/);
  const cli = await cland(f.root, 'remote', 'status');
  assert.equal(cli.code, 0, cli.stderr);
  assert.match(cli.stdout, /connection: disabled.*another consumer of the token/);
  assert.match(await history(), /another consumer of the token/);
  assert.equal(JSON.stringify([ui.frames, cli.stdout, cli.stderr]).includes(TELEGRAM_TEST_TOKEN), false);
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  const traffic = await control<{ requests: Array<{ method: string }> }>(f.fake.url, 'state');
  assert.equal(traffic.requests.filter(request => request.method === 'getUpdates').length, 61);
  const after = new Store(join(f.root, '.cland/hub.db'));
  try { assert.deepEqual(after.remotes.pollerLease(), owner, 'conflict never stops or replaces another token consumer'); }
  finally { after.close(); }
  await hub.stop();
  assert.equal(f.clock.pending, 0);
});

test('Telegram recovers from a transient 409 inside the startup grace without a fatal notice', async t => {
  const f = await fixture(t);
  await control(f.fake.url, 'fault', { method: 'getUpdates', code: 409 });
  const { hub, status, history } = await f.start();
  await f.waitRetry(1);
  const recovery = f.fake.waitForPoll();
  await f.clock.advance(1_000);
  const active = await within(recovery, 1_000);
  assert.equal(active.params.timeout, 40, 'successful zero-timeout probe resumes ordinary polling');
  assert.equal((await status()).connection, 'connected');
  assert.equal((await status()).reason, null);
  assert.equal((await history()).includes('another consumer of the token'), false);
  const closed = f.fake.waitForPollClose(active.id);
  await hub.stop();
  assert.equal(await within(closed, 1_000), active.id);
  assert.equal(f.clock.pending, 0);
});

for (const code of [401, 403]) {
  test(`Telegram ${code} stops only the remote and reports its fix while hub and web serve`, async t => {
    const f = await fixture(t);
    const polled = f.fake.waitForPoll();
    const { hub, ui, status, history } = await f.start();
    const poll = await within(polled, 1_000);
    await control(f.fake.url, 'fault', { method: 'getUpdates', code, echoToken: true, description: 'Long provider detail. '.repeat(40) });
    const text = code === 401 ? 'wrong or revoked token (401)' : 'bot blocked (403)';
    const notice = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).topic === 'general'
      && (frame.message as TopicMessage).text.includes(text), 1_000);
    const closed = f.fake.waitForPollClose(poll.id);
    await control(f.fake.url, 'release-polls', {});
    await within(notice, 1_000);
    assert.equal(await within(closed, 1_000), poll.id);
    await until(async () => (await status()).connection === 'disabled', { what: 'disabled Telegram status', timeoutMs: 1_000 });
    const row = await status();
    assert.equal(row.connection, 'disabled');
    assert.equal(row.stopCause, code === 401 ? 'token' : 'blocked');
    const stopped = await doctorStop(t, f.root);
    assert.equal(stopped.detail, text);
    assert.equal(stopped.fix, code === 401 ? 'set a new token with cland secret set telegram.token, then run cland hub reload'
      : 'unblock the bot in Telegram, then run cland hub reload');
    assert.ok((await history()).includes(`${stopped.detail}; ${stopped.fix}`));
    assert.ok(row.reason?.includes(text));
    assert.match(row.reason!, code === 401 ? /cland secret set telegram.token/ : /unblock the bot in Telegram/);
    assert.match(row.reason!, /cland hub reload/);
    const cli = await cland(f.root, 'remote', 'status');
    assert.equal(cli.code, 0, cli.stderr);
    assert.ok(cli.stdout.includes(text), 'long provider details cannot hide the cause in CLI status');
    assert.match(cli.stdout, code === 401 ? /cland secret set telegram.token/ : /unblock the bot in Telegram/);
    assert.match(cli.stdout, /cland hub reload/);
    const general = await history();
    assert.ok(general.includes(text));
    assert.match(general, /cland hub reload/);
    assert.equal(general.split(text).length - 1, 1, 'one fatal notice');
    const served = await ui.request({ type: 'hub.status' });
    assert.equal(served.ok, true, served.error);
    assert.equal((served.value as { web: { available: boolean } }).web.available, true);
    const link = await ui.request({ type: 'web.link' });
    assert.equal(link.ok, true, link.error);
    const { url } = link.value as { url: string };
    const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(1_000) });
    await response.arrayBuffer();
    assert.equal(response.status, 302);
    const origin = new URL(url).origin;
    const ws = new WebSocket(`${origin.replace('http:', 'ws:')}/ws`, { origin,
      headers: { Cookie: response.headers.get('set-cookie')!.split(';')[0]! } });
    const socketClosed = once(ws, 'close');
    onCleanup(t, async () => { ws.terminate(); await within(socketClosed, 1_000); });
    ws.on('error', () => {});
    const opened = once(ws, 'open');
    const web = frameClient(line => ws.send(line.trim()), fn => ws.on('message', data => fn(`${data.toString()}\n`)), () => ws.terminate());
    await within(opened, 1_000);
    const welcome = web.waitFor(frame => frame.type === 'welcome', 1_000);
    web.send({ type: 'hello', protocol: 2, client: 'human' });
    assert.equal((await welcome).name, 'human');
    const webStatus = await web.request({ type: 'hub.status' });
    assert.equal(webStatus.ok, true, webStatus.error);
    assert.equal((webStatus.value as { root: string }).root, f.root);
    ws.terminate();
    await within(socketClosed, 1_000);
    const before = await control<{ requests: unknown[] }>(f.fake.url, 'state');
    await f.clock.advance(120_000);
    const after = await control<{ requests: unknown[] }>(f.fake.url, 'state');
    assert.deepEqual(after.requests, before.requests, 'fatal refusal is never retried');
    assert.equal(JSON.stringify([ui.frames, f.logs]).includes(TELEGRAM_TEST_TOKEN), false);
    await hub.stop();
    assert.equal(f.clock.pending, 0);
  });
}

for (const code of [401, 403]) {
  test(`Telegram rich send ${code} stops before plain fallback and retains its cause`, async t => {
    const f = await fixture(t);
    const store = new Store(join(f.root, '.cland/hub.db'));
    try { store.remotes.forMessenger('telegram').setPairing(pairing); }
    finally { store.close(); }
    const polled = f.fake.waitForPoll();
    const { hub, ui, status, history } = await f.start();
    const poll = await within(polled, 1_000);
    await control(f.fake.url, 'fault', { method: 'sendRichMessage', code, echoToken: true });
    const cause = code === 401 ? 'wrong or revoked token (401)' : 'bot blocked (403)';
    const notice = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).text.includes(cause), 1_000);
    const closed = f.fake.waitForPollClose(poll.id);
    assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'rich fatal refusal control' })).ok, true);
    await within(notice, 1_000);
    assert.equal(await within(closed, 1_000), poll.id);
    await until(async () => (await status()).connection === 'disabled', { what: 'rich refusal disables Telegram', timeoutMs: 1_000 });
    assert.ok((await status()).reason?.startsWith(cause));
    assert.match((await status()).reason!, /cland hub reload/);
    assert.equal((await history()).split(cause).length - 1, 1);
    const traffic = await control<{ requests: Array<{ method: string }>; messages: TgMessage[] }>(f.fake.url, 'state');
    assert.deepEqual(traffic.requests.filter(row => ['sendRichMessage', 'sendMessage'].includes(row.method)).map(row => row.method), ['sendRichMessage']);
    assert.deepEqual(traffic.messages, [], 'a fatal rich rejection never attempts a plain send or echoes its notice');
    assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
    assert.equal(JSON.stringify([ui.frames, f.logs]).includes(TELEGRAM_TEST_TOKEN), false);
    await hub.stop();
    assert.equal(f.clock.pending, 0);
  });
}

test('Telegram unblocked after 403 resumes on unchanged reload while configuration-disabled stays stopped', async t => {
  const f = await fixture(t);
  const polled = f.fake.waitForPoll();
  const { hub, ui, status } = await f.start();
  const poll = await within(polled, 1_000);
  await control(f.fake.url, 'fault', { method: 'getUpdates', code: 403 });
  const notice = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).text.includes('bot blocked (403)'), 1_000);
  const closed = f.fake.waitForPollClose(poll.id);
  await control(f.fake.url, 'release-polls', {});
  await within(notice, 1_000);
  await within(closed, 1_000);
  await until(async () => (await status()).connection === 'disabled', { what: 'blocked remote stopped', timeoutMs: 1_000 });
  // The queued fake 403 is consumed; the bot is now unblocked, without any config or secret change.
  const resumed = f.fake.waitForPoll();
  const reload = await ui.request({ type: 'hub.reload' });
  assert.equal(reload.ok, true, reload.error);
  const active = await within(resumed, 1_000);
  assert.equal((await status()).connection, 'connected');
  assert.equal((await status()).reason, null);
  assert.equal((await status()).stopCause, undefined, 'reload clears the terminal cause after recovery');
  const config = defaultConfig('Telegram liveness fixture');
  config.verification.lockPath = join(f.root, 'suite.lock');
  await writeFile(join(f.root, '.cland/config.toml'), renderConfig(config));
  const stopped = f.fake.waitForPollClose(active.id);
  assert.equal((await ui.request({ type: 'hub.reload' })).ok, true);
  await within(stopped, 1_000);
  const traffic = await control<{ requests: unknown[] }>(f.fake.url, 'state');
  assert.equal((await ui.request({ type: 'hub.reload' })).ok, true);
  assert.deepEqual((await control<{ requests: unknown[] }>(f.fake.url, 'state')).requests, traffic.requests);
  assert.equal((await status()).connection, 'disconnected');
  await hub.stop();
});

test('Telegram membership unblock and queued paired start survive unchanged reload without replaying the kick', async t => {
  const f = await fixture(t);
  const store = new Store(join(f.root, '.cland/hub.db'));
  try { store.remotes.forMessenger('telegram').setPairing(pairing); }
  finally { store.close(); }
  const initial = f.fake.waitForPoll();
  const { hub, ui, status, history } = await f.start();
  const poll = await within(initial, 1_000);
  const blockedLine = 'Telegram remote: bot blocked (403); unblock the bot in Telegram, then run cland hub reload';
  const blocked = ui.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).text === blockedLine, 1_000);
  const closed = f.fake.waitForPollClose(poll.id);
  await control(f.fake.url, 'membership', { status: 'kicked' });
  await within(blocked, 1_000);
  assert.equal(await within(closed, 1_000), poll.id);
  await until(async () => (await status()).connection === 'disabled', { what: 'membership kick disables Telegram', timeoutMs: 1_000 });
  await control(f.fake.url, 'membership', { status: 'member' });
  const start = await control<TgUpdate>(f.fake.url, 'say', { text: '/start' });
  const resumed = f.fake.waitForPoll();
  const reload = await ui.request({ type: 'hub.reload' });
  assert.equal(reload.ok, true, reload.error);
  const active = await within(resumed, 1_000);
  assert.equal(active.params.offset, start.update_id + 1, 'the durable kick is not replayed; unblock and start are handled');
  assert.equal((await status()).connection, 'connected');
  assert.equal((await status()).reason, null);
  const messages = await control<{ messages: TgMessage[] }>(f.fake.url, 'state');
  assert.equal(messages.messages.at(-1)!.text, 'Paired with Telegram liveness fixture.');
  assert.equal((await history()).split(blockedLine).length - 1, 1, 'reload adds no duplicate blocked notice');
  const resumedClosed = f.fake.waitForPollClose(active.id);
  await hub.stop();
  assert.equal(await within(resumedClosed, 1_000), active.id);
  assert.equal(f.clock.pending, 0);
});
