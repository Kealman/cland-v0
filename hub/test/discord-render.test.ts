// T2: production General frames and loopback Discord native receipts.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, inProcessSpoke, until, connectUi } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { Store } from '../src/hub/store.ts';
import { DISCORD_TEST_TOKEN, DISCORD_IDS as ids } from './fakes/discord/fake-api.ts';
import { discordExchangeOwner } from './fakes/discord/exchange.ts';

type StartupControl = {
  hold: (close: () => Promise<void>, state: import('../src/remote/state.ts').RemoteStore) => Promise<void>;
  stopped: () => void;
};
async function fixture(t: TestContext, publishHeld = true, startup?: StartupControl) {
  const exchange = await discordExchangeOwner(t, { publishHeld }).start();
  const { fake, run } = exchange;
  const { root } = await exchange.project();
  const config = defaultConfig('Rendering fixture'); config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true }); await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = new Store(join(root, '.cland/hub.db')); exchange.afterDrain(() => store.close());
  const state = store.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const { messengerFactory } = await import('../src/remote/messenger.ts');
  const { remoteRedactor } = await import('../src/remote/redact.ts');
  const { realClock } = await import('../src/hub/clock.ts');
  const factory = messengerFactory({ CLAND_DISCORD_API_ROOT: fake.url }, remoteRedactor(), realClock, { state: store.remotes });
  let remote: import('../src/remote/gateway.ts').Remote;
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  exchange.stop(() => hub?.stop());
  await run(async () => {
    const acquired = await projectHub(t, root, { CLAND_DISCORD_API_ROOT: fake.url }, { syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN }, gatewayMessenger: (...args) => remote = factory(...args) });
    try { await startup?.hold(exchange.close, state); }
    finally {
      hub = acquired;
      // close() may have run its registered stop before acquisition returned.
      // Keep startup pending until this late subject has actually stopped.
      if (exchange.signal.aborted) { await hub.stop(); startup?.stopped(); }
    }
  });
  exchange.signal.throwIfAborted();
  const subject = hub!;
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const send = (text: string, kind = 'report') => run(async () => {
    assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text, kind })).ok, true);
  });
  const settled = async (count: number) => {
    await until(() => state.outbox().filter(j => j.state === 'sent').length === count, { timeoutMs: 2000, what: 'exact durable rendered part settlements' });
    return fake.control('state');
  };
  const snapshot = () => run(async () => {
    const { DatabaseSync, backup } = await import('node:sqlite');
    const reader = new DatabaseSync(join(root, '.cland/hub.db'), { readOnly: true });
    try { await backup(reader, join(root, 'crash.db')); } finally { reader.close(); }
    return join(root, 'crash.db');
  });
  return { ...exchange, hub: subject, snapshot, state, send, settled, receive: (frame: import('../src/protocol.ts').HubFrame) => run(() => Promise.resolve(remote.receive(frame))), storeClosed: () => { try { state.outbox(); return false; } catch { return true; } } };
}

test('Discord General renders tables, deep headings, rules, task boxes and literal spoilers', async t => {
  const f = await fixture(t);
  await f.send('#### Details\n\n| Name | Count |\n| --- | --- |\n| Ada | 2 |\n| Grace | 10 |\n\n---\n- [ ] Pending\n- [x] Done\nA || B');
  const native = await f.settled(1);
  assert.equal(native.messages[0]!.content, 'coord · report\n**Details**\n\n```\nName  | Count\nAda   | 2\nGrace | 10\n```\n\n──────────\n- ☐ Pending\n- ☑ Done\nA \\|\\| B');
  await f.hub.stop();
});

test('Discord General mentions ping nobody on create and edit', async t => {
  const f = await fixture(t);
  const text = `@everyone <@&${ids.role}> <@${ids.human}>`;
  await f.send(text); const created = await f.settled(1);
  await f.api.editMessage(ids.channel, created.messages[0]!.id, { content: text });
  const native = await f.fake.control('state');
  assert.deepEqual(native.pings, [{ users: [], roles: [], everyone: false }, { users: [], roles: [], everyone: false }]);
  for (const r of native.requests.filter(r => ['POST', 'PATCH'].includes(r.method) && r.path.includes('/messages'))) assert.deepEqual(r.body.allowed_mentions, { parse: [] });
  await f.hub.stop();
});

test('Discord General splits 4500 code points into three numbered language-preserving fenced parts', async t => {
  const f = await fixture(t);
  const text = '```ts\n' + 'x'.repeat(4389) + '😀'.repeat(100) + '\n```\n';
  assert.equal(Array.from(text).length, 4500);
  await f.send(text);
  const native = await f.settled(3);
  assert.equal(native.messages.length, 3);
  for (const [i, m] of native.messages.entries()) {
    assert.ok(Array.from(m.content).length <= 2000);
    assert.ok(m.content.startsWith(`coord · report ${i + 1}/3\n`));
    assert.equal((m.content.match(/^```ts$/gm) ?? []).length, 1);
    assert.equal((m.content.match(/^```$/gm) ?? []).length, 1);
    assert.equal(f.state.message(ids.channel, m.id)?.message, f.state.outbox()[0]!.source!.split(':part:')[0]);
  }
  assert.equal(native.messages.map(m => m.content.match(/[x😀]/gu)?.join('') ?? '').join(''), 'x'.repeat(4389) + '😀'.repeat(100));
  await f.hub.stop();
});

test('Discord progress and hub notices are silent and author headers preserve workbench and Telegram origins', async t => {
  const f = await fixture(t);
  await f.send('Ordinary'); await f.send('Progress', 'progress');
  const topic = { id: 'general', title: 'General', unread: 0, lastMessageAt: null };
  for (const [id, fromKind, via, text] of [
    ['notice', 'hub', 'hub', 'Notice'],
  ] as const) await f.receive({ type: 'message', topic, message: { id, seq: 100, topic: 'general', from: fromKind === 'hub' ? 'hub' : 'human', fromKind, via, to: [], kind: 'message', text, ts: new Date().toISOString() } });
  const ui = await connectUi(t, f.hub.discovery, 'nvim');
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Workbench' })).ok, true);
  await f.receive({ type: 'message', topic, message: { id: 'cross', seq: 101, topic: 'general', from: 'human', fromKind: 'human', via: 'telegram', to: [], kind: 'message', text: 'Cross remote', ts: new Date().toISOString() } });
  const native = await f.settled(5);
  const posts = native.requests.filter(r => r.method === 'POST' && r.path.includes('/messages'));
  assert.deepEqual(posts.map(r => r.body.flags), [4, 4100, 4100, 4, 4]);
  assert.deepEqual(f.state.outbox().map(j => (j.payload as { silent?: boolean }).silent), [false, true, true, false, false]);
  assert.deepEqual(f.state.outbox().map(j => (j.payload as { content: string }).content), native.messages.map(m => m.content));
  assert.deepEqual(native.messages.map(m => m.content), ['coord · report\nOrdinary', 'coord · progress\nProgress', 'hub · message\nNotice', 'you · message\nWorkbench', 'you (Telegram) · message\nCross remote']);
  await f.hub.stop();
});

test('Discord conversion failure retains the plain source and durable native receipt', async t => {
  const f = await fixture(t);
  const text = '#### Leave this plain\n```ts\nunclosed input';
  await f.send(text); const native = await f.settled(1);
  assert.equal(native.messages[0]!.content, `coord · report\n${text}`);
  assert.equal(f.state.message(ids.channel, native.messages[0]!.id)?.topic, 'general');
  await f.hub.stop();
});

test('Discord splitting prefers whole paragraph blocks', async t => {
  const f = await fixture(t);
  await f.send('a'.repeat(400) + '\n\n' + 'b'.repeat(1000) + '\n' + 'c'.repeat(700));
  const native = await f.settled(2);
  assert.equal(native.messages[0]!.content, 'coord · report 1/2\n' + 'a'.repeat(400) + '\n\n');
  assert.equal(native.messages[1]!.content, 'coord · report 2/2\n' + 'b'.repeat(1000) + '\n' + 'c'.repeat(700));
  await f.hub.stop();
});

for (const crash of [false, true]) test(`Discord persists complete groups before held I/O and preserves order on ${crash ? 'crash snapshot replay' : 'release'}`, async t => {
  const f = await fixture(t);
  await f.fake.control('configure', { sendLimit: 50 });
  const held = f.run(signal => f.fake.waitForHold(signal)); void held.catch(() => {});
  await f.fake.control('fault', { response: 'hold' });
  await f.send('```ts\n' + 'x'.repeat(4489) + '\n```\n');
  await held;
  // The native hold is the boundary: every part must already be durable here.
  const parts = f.state.outbox();
  assert.equal(parts.length, 3);
  assert.equal(parts[0]!.state, 'sending');
  assert.deepEqual(parts.slice(1).map(j => j.state), ['queued', 'queued']);
  await f.send('Later source');
  await until(() => f.state.outbox().length === 4, { timeoutMs: 2000, what: 'later source durably queued behind complete group' });
  let state = f.state;
  let native;
  if (crash) {
    // A consistent independent SQLite reader captures the exact persisted I/O boundary.
    // Graceful hub stop classifies an aborted General send as missed; it is not a crash.
    const path = await f.snapshot();
    await f.hub.stop();
    await until(() => f.fake.receipts().held === 0 && f.fake.receipts().handlers === 0, { timeoutMs: 2000, what: 'aborted native create and handler drained before snapshot replay' });
    const recovered = new Store(path); f.afterDrain(() => recovered.close()); state = recovered.remotes.forMessenger('discord');
    const { DiscordOutbox } = await import('../src/remote/discord-outbox.ts');
    const { realClock } = await import('../src/hub/clock.ts');
    const box = new DiscordOutbox(f.api, state, realClock, f.signal);
    f.stop(() => box.stop());
    await f.run(() => box.resume());
    assert.equal(state.outbox().filter(j => j.state === 'sent').length, 4);
    native = await f.fake.control('state');
  } else {
    await f.fake.control('release', {});
    native = await f.settled(4);
  }
  assert.deepEqual(native.messages.map(m => m.content), [...parts.map(j => (j.payload as { content: string }).content), 'coord · report\nLater source']);
  for (const m of native.messages.slice(0, 3)) assert.equal(state.message(ids.channel, m.id)?.message, parts[0]!.source!.split(':part:')[0]);
  await f.hub.stop();
});

for (const omitted of [false, true]) test(`Discord render owner drains ${omitted ? 'omitted held publication' : 'aborted held setup'} before Store close`, async t => {
  const f = await fixture(t, !omitted);
  const held = f.run(signal => f.fake.waitForHold(signal));
  const rejected = assert.rejects(held, /aborted|disposed/); void rejected.catch(() => {});
  try {
    if (omitted) {
      await f.run(() => f.fake.control('fault', { response: 'hold' }));
      await f.send('Held owner control');
      await f.run(() => f.fake.held());
      assert.equal(f.state.outbox()[0]!.state, 'sending');
      assert.equal(f.storeClosed(), false);
    }
    await f.close();
    await rejected;
    assert.equal(f.pending(), 0);
    const native = f.fake.receipts();
    assert.equal(native.observers, 0); assert.equal(native.held, 0);
    assert.equal(native.handlers, 0); assert.equal(native.connections, 0);
    assert.equal(f.storeClosed(), true);
  } finally { await f.close(); }
});

test('Discord render owner stops late subject acquisition before closing its Store', async t => {
  const acquired = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
  let close = async () => {}, state: import('../src/remote/state.ts').RemoteStore | undefined;
  let stopped = false;
  const starting = fixture(t, true, {
    hold: async (dispose, store) => { close = dispose; state = store; acquired.resolve(); await release.promise; },
    stopped: () => { assert.doesNotThrow(() => state!.outbox()); stopped = true; },
  });
  const rejected = assert.rejects(starting, /aborted|disposed/); void rejected.catch(() => {});
  let closing: Promise<void> | undefined;
  try {
    const { within } = await import('../src/executor/droplet/deadline.ts');
    await within(acquired.promise, 1000);
    closing = close(); void closing.catch(() => {});
    assert.doesNotThrow(() => state!.outbox(), 'Store remains usable during unresolved startup');
    release.resolve();
    await closing; await rejected;
    assert.equal(stopped, true, 'late acquired hub stop receipt precedes Store closure');
    assert.throws(() => state!.outbox(), /not open|closed/);
  } finally {
    release.resolve(); await close(); await Promise.allSettled([starting, closing]);
  }
});
