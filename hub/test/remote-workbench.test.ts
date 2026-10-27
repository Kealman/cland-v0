// T2: safe workbench frames over the production Telegram/fake Bot API boundary.
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Inbox, RemoteStateRow, RemoteStatusResult } from '../src/protocol.ts';
import { TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { control } from './telegram-polling-fixture.ts';
import { until, connectSocket } from './harness.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { telegramLivenessFixture as fixture } from './telegram-liveness-fixture.ts';

test('workbenches receive an allowlisted remote state on a previous-shape hello', async t => {
  const f = await fixture(t);
  const { ui, hub } = await f.start();
  const frame = await ui.waitFor(frame => frame.type === 'remote.state', 1_000);
  assert.deepEqual(frame.remotes, [
    { messenger: 'telegram', enabled: true, connection: 'connected', offlineSince: null,
      pairedName: null, mute: false, outboxDepth: 0, lastError: null },
    { messenger: 'discord', enabled: false, connection: 'disabled', offlineSince: null,
      pairedName: null, mute: false, outboxDepth: 0, lastError: null },
  ]);
  // connectUi sends the literal pre-extension protocol-2 hello, with no features.
  // Its established request/result flow remains usable beside the unknown event.
  assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  assert.equal((await ui.request({ type: 'topic.list' })).ok, true);
  const featured = await connectSocket(hub.discovery.socket);
  t.after(() => featured.close());
  featured.send({ type: 'hello', protocol: 2, client: 'ui', secret: hub.discovery.secret,
    features: ['snapshot', 'numbered-deltas', 'slim-frames'] });
  let remotes: unknown;
  for (;;) {
    const next = await featured.next(1_000);
    assert.notEqual(next.type, 'snapshot.refused');
    if (next.type === 'snapshot' && next.domain === 'sessions') remotes = (next.value as { remotes: unknown }).remotes;
    if (next.type === 'snapshot.end') break;
  }
  assert.deepEqual(remotes, frame.remotes, 'featured clients receive the same projection in the atomic snapshot');
});

test('failed Telegram exchange pushes offline immediately and a successful poll pushes connected', async t => {
  const f = await fixture(t);
  await control(f.fake.url, 'stall', { enabled: true });
  const polled = f.fake.waitForPoll();
  const { ui, history } = await f.start();
  const poll = await within(polled, 1_000);
  const offline = ui.waitFor(frame => frame.type === 'remote.state'
    && (frame.remotes as RemoteStateRow[])[0]?.connection === 'offline', 1_000);
  void offline.catch(() => {});
  await control(f.fake.url, 'fault', { method: 'getUpdates', code: 500, description: 'fake outage', echoToken: true });
  const closed = f.fake.waitForPollClose(poll.id);
  await control(f.fake.url, 'release-polls', {});
  await within(closed, 1_000);
  await f.waitRetry(1);
  const failed = (await offline).remotes as RemoteStateRow[];
  assert.equal(failed[0]!.offlineSince, f.clock.now().toISOString());
  assert.match(failed[0]!.lastError!, /fake outage/);
  assert.equal((await history()).includes('remote offline since'), false, 'the frame precedes the three-minute General notice');
  assert.equal(JSON.stringify(failed).includes(TELEGRAM_TEST_TOKEN), false);
  const boundary = ui.frames.length;
  const recovered = ui.waitFor(frame => ui.frames.indexOf(frame) >= boundary && frame.type === 'remote.state'
    && (frame.remotes as RemoteStateRow[])[0]?.connection === 'connected', 1_000);
  void recovered.catch(() => {});
  await control(f.fake.url, 'stall', { enabled: false });
  await f.clock.advance(1_000);
  const healthy = (await recovered).remotes as RemoteStateRow[];
  assert.equal(healthy[0]!.offlineSince, null);
  assert.equal(healthy[0]!.lastError, null);
});

test('pairing, mute, outbox depth, unpair and configuration disable push safe replacements', async t => {
  const f = await fixture(t);
  const { ui } = await f.start();
  const observe = (predicate: (row: RemoteStateRow) => boolean) => {
    const boundary = ui.frames.length;
    const result = ui.waitFor(frame => ui.frames.indexOf(frame) >= boundary && frame.type === 'remote.state'
      && predicate((frame.remotes as RemoteStateRow[])[0]!), 1_000);
    void result.catch(() => {});
    return result;
  };
  let request: NonNullable<Inbox['pairings']>[number] | undefined;
  const offered = until(async () => {
    request = ((await ui.request({ type: 'inbox.list' })).value as Inbox).pairings?.[0];
    return !!request;
  }, { what: 'durable pairing request through frames', timeoutMs: 1_000 });
  void offered.catch(() => {});
  await control(f.fake.url, 'say', { text: '/start' });
  await offered;
  assert.ok(request);
  const pairingRequest = request;
  const paired = observe(row => row.pairedName === pairingRequest.name);
  assert.equal((await ui.request({ type: 'pairing.approve', messenger: 'telegram', code: pairingRequest.code })).ok, true);
  await paired;
  const muting = observe(row => row.mute);
  await control(f.fake.url, 'say', { text: '/mute' });
  await muting;
  const quiet = f.clock.now().getTime();
  const unmuting = observe(row => !row.mute);
  // The prior /start reply used this chat's first send slot; /mute queues its reply.
  await f.clock.advance(1_000);
  await control(f.fake.url, 'say', { text: '/unmute' });
  await unmuting;
  assert.equal(f.clock.now().getTime() - quiet, 1_000);
  const baseline = ui.frames.length;
  const before = await ui.request({ type: 'remote.status' });
  const depth = ((before.value as RemoteStatusResult).remotes[0]!).outboxDepth;
  for (const text of ['depth one', 'depth two', 'depth three']) assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text })).ok, true);
  const queued = await ui.request({ type: 'remote.status' });
  assert.equal((queued.value as RemoteStatusResult).remotes[0]!.outboxDepth, depth + 3, 'all three public sends are durably queued');
  await f.clock.advance(999);
  assert.equal(ui.frames.slice(baseline).filter(frame => frame.type === 'remote.state').length, 0, 'depth-only changes coalesce for the whole second');
  const pushed = observe(row => row.outboxDepth > 0);
  await f.clock.advance(1);
  await pushed;
  assert.equal(ui.frames.slice(baseline).filter(frame => frame.type === 'remote.state').length, 1);
  const unpaired = observe(row => row.pairedName === null);
  assert.equal((await ui.request({ type: 'remote.unpair', messenger: 'telegram' })).ok, true);
  await unpaired;
  const disabled = observe(row => !row.enabled && row.connection === 'disabled');
  assert.equal((await ui.request({ type: 'config.set', key: 'remote.telegram.enabled', value: false })).ok, true);
  await disabled;
  const frames = ui.frames.filter(frame => frame.type === 'remote.state');
  const text = JSON.stringify(frames);
  assert.equal(text.includes(TELEGRAM_TEST_TOKEN), false);
  assert.doesNotMatch(text, /fingerprint|chatId|userId|guildId|botLink|"token"/);
});

for (const [code, stopCause, cause] of [[401, 'token', 'wrong or revoked token (401)'], [403, 'blocked', 'bot blocked (403)']] as const) {
  test(`Telegram ${code} pushes its shared stopped cause without credentials`, async t => {
    const f = await fixture(t);
    const polled = f.fake.waitForPoll();
    const { ui } = await f.start();
    const poll = await within(polled, 1_000);
    const stopped = ui.waitFor(frame => frame.type === 'remote.state' && (frame.remotes as RemoteStateRow[])[0]?.connection === 'stopped', 1_000);
    void stopped.catch(() => {});
    await control(f.fake.url, 'fault', { method: 'getUpdates', code, echoToken: true });
    const closed = f.fake.waitForPollClose(poll.id);
    await control(f.fake.url, 'release-polls', {});
    await within(closed, 1_000);
    const rows = (await stopped).remotes as RemoteStateRow[];
    assert.equal(rows[0]!.enabled, true);
    assert.equal(rows[0]!.stopCause, stopCause);
    assert.equal(rows[0]!.lastError, cause);
    assert.equal(JSON.stringify(rows).includes(TELEGRAM_TEST_TOKEN), false);
    assert.equal((await ui.request({ type: 'hub.status' })).ok, true);
  });
}
