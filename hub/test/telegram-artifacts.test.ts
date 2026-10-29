// T2: sealed production frames and fake Bot API, with durable outbox receipts.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, tempProject, until, inProcessSpoke, testWaitMs } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { Store } from '../src/hub/store.ts';
import { fakeTelegram, fakeTelegramFixture, telegramControl, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import { pacingOwner, driveTelegram } from './telegram-pacing-fixture.ts';
import { within, abortable } from '../src/executor/droplet/deadline.ts';
import type { Clock } from '../src/hub/clock.ts';


/** Own the exact receipt and its independent deadline, cancelling and joining the raw observation. */
function observeReceipt<T>(owner: ReturnType<typeof pacingOwner>, start: (signal: AbortSignal) => Promise<T>, options: { drain?: boolean; clock?: Clock; ms?: number } = {}): Promise<T> {
  return owner.observe(async signal => {
    const cancel = new AbortController();
    const raw = start(AbortSignal.any([signal, cancel.signal]));
    try {
      return await within(raw, options.ms ?? testWaitMs(5_000), options.clock, () => new Error('artifact exact receipt deadline reached'));
    } finally {
      cancel.abort(new Error('artifact observation complete'));
      await Promise.allSettled([raw]);
    }
  }, options);
}

async function fixture(t: TestContext, setup: {
  beforeStartupClose?: () => Promise<void>;
  options?: Parameters<ReturnType<typeof pacingOwner>['start']>[3];
  prepared?: (facts: { owner: ReturnType<typeof pacingOwner>; root: string; store: Store; fake: Awaited<ReturnType<typeof fakeTelegram>>; native: ReturnType<typeof fakeTelegramFixture>; clock: FakeClock }) => Promise<void>;
} = {}) {
  const owner = pacingOwner(t);
  const root = await tempProject(t);
  const clock = new FakeClock();
  const native = fakeTelegramFixture(t, { clock });
  owner.close(async () => { try { await setup.beforeStartupClose?.(); } finally { await native.close(); } }, { startupOnly: true });
  const fake = await native.start();
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Outbound files');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = owner.store(join(root, '.cland/hub.db'));
  const state = store.remotes.forMessenger('telegram');
  state.setPairing({ userId: '101', chatId: '101', guildId: null, name: 'Human' });
  const start = () => owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, clock);
  await setup.prepared?.({ owner, root, store, fake, native, clock });
  const hub = await owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, clock, setup.options);
  const ui = await connectUi(t, hub.discovery);
  const settled = async (count: number) => {
    for (let i = 0; i < count; i++) {
      await until(() => state.outbox().filter(j => j.kind === 'general' && j.state === 'sent').length >= i + 1, { what: `durable artifact send ${i + 1}` });
      await clock.advance(1000);
    }
  };
  return { root, clock, fake, hub, ui, store, state, settled, owner, start };
}

test('Telegram single 2 KB note uses header and text as a plain document caption', async t => {
  const { ui, settled, fake } = await fixture(t);
  assert.equal((await ui.request({ type: 'artifact.upload', topic: 'general', caption: 'A short note', files: [{ name: 'note.txt', mime: 'text/plain', data: Buffer.alloc(2048, 120).toString('base64') }] })).ok, true);
  await settled(1);
  const receipt = await telegramControl<{ requests: { method: string; params: Record<string, unknown> }[]; uploads: { caption: string; size: number }[] }>(fake.url, 'state');
  assert.deepEqual(receipt.body.requests.filter(r => r.method.startsWith('send')).map(r => r.method), ['sendDocument']);
  assert.equal(receipt.body.uploads[0]?.caption, 'you · message\r\nA short note');
  assert.equal(receipt.body.uploads[0]?.size, 2048);
  assert.equal(Object.hasOwn(receipt.body.requests.find(r => r.method === 'sendDocument')!.params, 'caption_entities'), false);
});

test('Telegram repeated single artifact preserves the new short caption before one sent-above reference', async t => {
  const { root, fake, settled, state } = await fixture(t);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  state.set('mute', 'true');
  const path = join(root, 'note.txt');
  await writeFile(path, 'note bytes');
  const created = await coord.call<{ artifact: { id: string } }>('artifact.create', { topic: 'general', kind: 'file', title: 'Note', path });
  state.set('mute', 'false');
  const artifacts = [created.artifact.id];
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Original caption', artifacts })).ok, true);
  await settled(1);
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'A new short caption', artifacts })).ok, true);
  await settled(2);
  const after = await telegramControl<{ uploads: { caption: string }[]; messages: { text?: string; message_id: number; reply_to_message?: { message_id: number } }[] }>(fake.url, 'state');
  assert.equal(after.body.uploads.length, 1);
  assert.equal(after.body.uploads[0]!.caption, 'coord · report\r\nOriginal caption');
  assert.equal(after.body.messages.length, 2);
  assert.equal(after.body.messages[1]!.text, `coord · report\nA new short caption\n▣ ${artifacts[0]} Note (sent above)`);
  assert.equal(after.body.messages[1]!.text!.match(/\(sent above\)/g)?.length, 1);
  assert.equal(after.body.messages[1]!.reply_to_message?.message_id, after.body.messages[0]!.message_id);
});

test('Telegram agent mixed artifacts are deduplicated across fields and later attachments reference the original', async t => {
  const { root, ui, fake, settled, state } = await fixture(t);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const topic = 'general';
  state.set('mute', 'true');
  const ids: string[] = [];
  for (const [name, bytes] of [['picture.png', 'png'], ['report.pdf', 'pdf']]) {
    const path = join(root, name!);
    await writeFile(path, bytes!);
    const created = await coord.call<{ ok: boolean; artifact: { id: string } }>('artifact.create', { topic, kind: 'file', title: name, path });
    assert.equal(created.ok, true);
    ids.push(created.artifact.id);
  }
  state.set('mute', 'false');
  const posted = await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Long text '.repeat(120), artifacts: ids });
  assert.equal(posted.ok, true, JSON.stringify(posted));
  const history = await ui.request({ type: 'topic.history', topic: 'general' });
  const message = (history.value as { messages: { artifact?: { id: string }; artifacts?: { id: string }[] }[] }).messages.at(-1)!;
  assert.equal(message.artifact?.id, ids[0]);
  assert.deepEqual(message.artifacts?.map(a => a.id), ids);
  await settled(3);
  const first = await telegramControl<{ requests: { method: string }[]; uploads: { caption: string }[]; messages: { message_id: number }[] }>(fake.url, 'state');
  assert.deepEqual(first.body.requests.filter(r => r.method.startsWith('send')).map(r => r.method), ['sendRichMessage', 'sendPhoto', 'sendDocument']);
  assert.deepEqual(first.body.uploads.map(u => u.caption), ['coord · report', 'coord · report']);
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Again', artifacts: [ids[0]!] })).ok, true);
  await settled(4);
  const later = await telegramControl<{ uploads: unknown[]; messages: { text?: string; reply_to_message?: { message_id: number } }[] }>(fake.url, 'state');
  assert.equal(later.body.uploads.length, 2);
  assert.match(later.body.messages.at(-1)!.text!, /Again/);
  assert.match(later.body.messages.at(-1)!.text!, /sent above/);
  assert.equal(later.body.messages.at(-1)?.reply_to_message?.message_id, first.body.messages[1]!.message_id);
});

test('Telegram sparse 60 MB fallback names the relative path and 12 MB PNG is a document', async t => {
  const { root, ui, fake, settled, state } = await fixture(t);
  const { open } = await import('node:fs/promises');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  state.set('mute', 'true');
  const ids: string[] = [];
  for (const [name, size] of [['large.bin', 60], ['large.png', 12]] as const) {
    const path = join(root, name);
    const file = await open(path, 'w');
    await file.truncate(size * 1024 * 1024); await file.close();
    const result = await coord.call<{ ok: boolean; artifact: { id: string } }>('artifact.create', { topic: 'general', kind: 'file', title: name, path });
    assert.equal(result.ok, true); ids.push(result.artifact.id);
  }
  state.set('mute', 'false');
  assert.equal((await coord.call<{ ok: boolean }>('send', { topic: 'general', text: 'Large files', artifacts: ids })).ok, true);
  await settled(3);
  const receipt = await telegramControl<{ messages: { text?: string }[]; uploads: { method: string; size: number }[] }>(fake.url, 'state');
  assert.deepEqual(receipt.body.uploads.map(u => [u.method, u.size]), [['sendDocument', 12 * 1024 * 1024]]);
  const line = receipt.body.messages.find(m => m.text?.includes('62914560 bytes'))?.text;
  assert.ok(line); assert.ok(line.includes(ids[0]!)); assert.match(line, /large.bin.*\.cland\/artifacts\//); assert.ok(!line.includes(root));
});

test('Telegram queued file survives hub restart once and a held upload timeout is never resent', { timeout: 10000 }, async t => {
  const { root, ui, fake, settled, state, clock, hub, owner, start } = await fixture(t);
  const upload = await ui.request({ type: 'artifact.upload', topic: 'general', caption: 'Two', files: ['one.png', 'two.txt'].map(name => ({ name, mime: 'application/octet-stream', data: 'eA==' })) });
  assert.equal(upload.ok, true);
  await until(() => state.outbox().some(j => j.state === 'sent'), { what: 'first part committed before restart' });
  assert.equal(state.outbox().filter(j => j.state === 'queued').length, 2);
  await hub.stop();
  const restarted = await start();
  await clock.advance(1000); await settled(3);
  const ui2 = await connectUi(t, restarted.discovery);
  await telegramControl(fake.url, 'fault', { method: 'sendDocument', response: 'hold', code: 503 });
  const held = observeReceipt(owner, signal => fake.waitForHeldRequest('sendDocument', signal));
  assert.equal((await ui2.request({ type: 'artifact.upload', topic: 'general', caption: 'Held', files: [{ name: 'held.txt', mime: 'text/plain', data: 'eQ==' }] })).ok, true);
  const request = await held;
  await clock.advance(35_000);
  await until(() => state.outbox().some(j => j.state === 'missed' && state.attempts(j.id).at(-1)?.outcome === 'unknown'), { what: 'durable uncertain upload' });
  await restarted.stop();
  const resumed = observeReceipt(owner, signal => fake.waitForRequest('getUpdates', undefined, signal));
  const third = await start();
  // Startup joins resume before starting polling; that poll is the completion receipt.
  await resumed;
  await third.stop();
  const receipt = await telegramControl<{ requests: { method: string; params: { caption?: string } }[]; uploads: unknown[] }>(fake.url, 'state');
  assert.equal(receipt.body.requests.filter(r => r.method === 'sendDocument' && r.params.caption?.includes('Held')).length, 1);
  assert.ok(request.id > 0);
  assert.equal(receipt.body.uploads.length, 2);
});

test('Telegram web upload has you header and Telegram-origin upload is suppressed', async t => {
  const { root, ui, fake, settled, hub, clock, owner, store } = await fixture(t);
  assert.equal((await ui.request({ type: 'artifact.upload', topic: 'general', files: [{ name: 'web.png', mime: 'image/png', data: 'eA==' }] })).ok, true);
  await settled(1);
  await hub.stop();
  const { testMessenger } = await import('./fakes/messenger.ts');
  const remote = testMessenger();
  const native = await owner.start(root, {}, clock, { hubOptions: { gatewayRemotes: [remote] } });
  const received = remote.client.waitFor(f => f.type === 'result' && f.id === 'tg-upload');
  remote.upload({ type: 'artifact.upload', topic: 'general', files: [{ name: 'telegram.png', mime: 'image/png' }], id: 'tg-upload' }, { chatId: '101', messageId: '201' }, [Buffer.from('native')]);
  assert.equal((await received).ok, true);
  // Feed the committed real hub publication to the production adapter to prove echo filtering.
  const frame = remote.client.frames.find(f => f.type === 'message' && (f.message as { via?: string }).via === 'telegram');
  assert.ok(frame);
  const { TelegramRemote } = await import('../src/remote/telegram.ts');
  const { TelegramApi } = await import('../src/remote/telegram-api.ts');
  const adapter = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock,
    { store: store.remotes.forMessenger('telegram'), files: { root, artifact: id => store.artifact(id) } });
  owner.close(() => adapter.stop());
  await adapter.receive(frame as never); await adapter.stop();
  const receipt = await telegramControl<{ uploads: { caption: string }[] }>(fake.url, 'state');
  assert.deepEqual(receipt.body.uploads.map(u => u.caption), ['you · message']);
});

test('Telegram revalidates queued artifact confinement and never uploads a replacement symlink', async t => {
  const { root, ui, fake, state, clock } = await fixture(t);
  const { unlink, symlink } = await import('node:fs/promises');
  const result = await ui.request({ type: 'artifact.upload', topic: 'general', caption: 'x'.repeat(1100), files: [{ name: 'queued.png', mime: 'image/png', data: 'eA==' }] });
  assert.equal(result.ok, true);
  await until(() => state.outbox().some(j => j.state === 'sent'), { what: 'text delivered before queued file replacement' });
  const path = (result.value as { artifacts: { path: string }[] }).artifacts[0]!.path;
  const outside = join(root, 'private.txt');
  await writeFile(outside, 'must never upload');
  await unlink(path); await symlink(outside, path);
  await clock.advance(1000);
  await until(() => state.outbox().filter(j => j.state === 'sent').length === 2, { what: 'unavailable fallback durably delivered' });
  const receipt = await telegramControl<{ uploads: unknown[]; messages: { text?: string }[] }>(fake.url, 'state');
  assert.equal(receipt.body.uploads.length, 0);
  assert.match(receipt.body.messages.at(-1)!.text!, /file unavailable/);
  assert.ok(!receipt.body.messages.at(-1)!.text!.includes(root));
});

for (const destination of ['same chat', 'new chat'] as const) test(`Telegram once-ever artifact fence survives ${destination} pairing replacement and restart`, async t => {
  const { ui, state, settled, hub, start, fake, owner } = await fixture(t);
  const first = await ui.request({ type: 'artifact.upload', topic: 'general', caption: 'Original', files: [{ name: 'once.txt', mime: 'text/plain', data: 'eA==' }] });
  assert.equal(first.ok, true);
  const id = (first.value as { artifacts: { id: string }[] }).artifacts[0]!.id;
  await settled(1); await hub.stop();
  state.setPairing({ userId: '202', chatId: destination === 'same chat' ? '101' : '202', guildId: null, name: 'Replacement' });
  const resumed = await start();
  const next = await connectUi(t, resumed.discovery);
  assert.equal((await next.request({ type: 'topic.send', topic: 'general', text: 'Later', artifacts: [id] })).ok, true);
  await settled(2); await owner.dispose();
  const result = await telegramControl<{ uploads: unknown[]; messages: { text?: string; reply_to_message?: { message_id: number } }[] }>(fake.url, 'state');
  assert.equal(result.body.uploads.length, 1);
  assert.match(result.body.messages.at(-1)!.text!, /sent above/);
  assert.equal(!!result.body.messages.at(-1)?.reply_to_message, destination === 'same chat');
});

test('Telegram artifact publication stays contiguous when a card and later General arrive mid-send', async t => {
  const { root, ui, fake, state, clock, owner } = await fixture(t);
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  await telegramControl(fake.url, 'fault', { method: 'sendRichMessage', code: 503, response: 'hold' });
  const held = observeReceipt(owner, signal => fake.waitForHeldRequest('sendRichMessage', signal));
  assert.equal((await ui.request({ type: 'artifact.upload', topic: 'general', caption: 'First', files: ['one.png', 'two.txt'].map(name => ({ name, mime: 'application/octet-stream', data: 'eA==' })) })).ok, true);
  const request = await held;
  assert.equal((await coord.call<{ ok: boolean }>('ask', { topic: 'general', question: 'Urgent card', options: ['Keep'] })).ok, true);
  assert.equal((await ui.request({ type: 'topic.send', topic: 'general', text: 'Later General' })).ok, true);
  await clock.advance(250);
  await until(() => state.outbox().length === 5, { what: 'card and later publication durably enqueued behind held first send' });
  await telegramControl(fake.url, 'release-requests', { ids: [request.id] });
  await driveTelegram(clock, state, until(() => state.outbox().every(j => j.state === 'sent'), { what: 'all publication and card delivery receipts' }));
  await owner.dispose();
  const result = await telegramControl<{ requests: { method: string }[] }>(fake.url, 'state');
  assert.deepEqual(result.body.requests.filter(r => r.method.startsWith('send')).map(r => r.method), ['sendRichMessage', 'sendPhoto', 'sendDocument', 'sendMessage', 'sendRichMessage']);
});

for (const replacement of ['leaf', 'parent'] as const) test(`Telegram upload consumes confined bytes after a ${replacement} swap at the API boundary`, async t => {
  const { root, ui, fake, state, clock, hub, store, settled, owner } = await fixture(t);
  const { rename, symlink } = await import('node:fs/promises');
  const { basename, dirname } = await import('node:path');
  const { createHash } = await import('node:crypto');
  const { TelegramApi } = await import('../src/remote/telegram-api.ts');
  const { TelegramOutbox } = await import('../src/remote/telegram-outbox.ts');
  const file = { name: 'authorized.png', mime: 'image/png', data: Buffer.from('authorized bytes').toString('base64') };
  assert.equal((await ui.request({ type: 'artifact.upload', topic: 'general', files: [file] })).ok, true);
  await settled(1); // Positive control reaches the same native fake before fault injection.
  state.set('mute', 'true');
  const next = await ui.request({ type: 'artifact.upload', topic: 'general', files: [file] });
  assert.equal(next.ok, true);
  const artifact = (next.value as { artifacts: import('../src/protocol.ts').Artifact[] }).artifacts[0]!;
  await hub.stop();
  const outside = join(root, 'outside'); await mkdir(outside);
  await writeFile(join(outside, basename(artifact.path)), 'private outside bytes');
  let swaps = 0;
  class SwappingApi extends TelegramApi {
    override async sendPhoto(params: import('../src/remote/telegram-api.ts').SendFile, options?: import('../src/remote/telegram-api.ts').TelegramRequestOptions) {
      const target = replacement === 'leaf' ? artifact.path : dirname(artifact.path);
      await rename(target, `${target}-kept`);
      await symlink(replacement === 'leaf' ? join(outside, basename(artifact.path)) : outside, target);
      swaps++;
      return super.sendPhoto(params, options);
    }
  }
  const queue = new TelegramOutbox(new SwappingApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock,
    { store: state, files: { root, artifact: id => store.artifact(id) } });
  owner.close(() => queue.stop());
  await driveTelegram(clock, state, queue.file('sendPhoto', { chat_id: '101', artifact: artifact.id, caption: 'Bound bytes' }, { kind: 'general', source: 'race' }));
  await queue.stop();
  const result = await telegramControl<{ uploads: { digest: string }[] }>(fake.url, 'state');
  assert.equal(swaps, 1);
  assert.deepEqual(result.body.uploads.map(u => u.digest), Array(2).fill(createHash('sha256').update('authorized bytes').digest('hex')));
});

for (const failure of ['omitted', 'aborted', 'omitted exact receipt'] as const) test(`Telegram artifact fixture owns native startup and observers through ${failure} setup`, async t => {
  const setupClock = new FakeClock();
  const cancellation = new AbortController();
  const ready = Promise.withResolvers<{ owner: ReturnType<typeof pacingOwner>; root: string; store: Store; fake: Awaited<ReturnType<typeof fakeTelegram>>; native: ReturnType<typeof fakeTelegramFixture>; clock: FakeClock }>();
  const receiptClock = new FakeClock();
  const readyReceipt = within(abortable(ready.promise, t.signal), testWaitMs(5_000), undefined, () => new Error('artifact preparation receipt deadline reached'));
  void readyReceipt.catch(() => {});
  let missingReceipt: Promise<unknown> | undefined;
  let closeReceipt: Promise<{ id: number }> | undefined;
  let heldReceipt: Promise<{ id: number }> | undefined;
  const starting = fixture(t, { beforeStartupClose: async () => {
    if (!heldReceipt || !closeReceipt) return;
    const facts = await readyReceipt;
    const held = await heldReceipt;
    await telegramControl(facts.fake.url, 'release-requests', { ids: [held.id] });
    await closeReceipt;
  }, options: { clock: setupClock, signal: cancellation.signal }, prepared: async facts => {
    ready.resolve(facts);
    await telegramControl(facts.fake.url, 'fault', { method: 'getMe', response: 'hold', code: 503 });
    heldReceipt = observeReceipt(facts.owner, signal => facts.fake.waitForHeldRequest('getMe', signal));
    closeReceipt = observeReceipt(facts.owner, signal => facts.fake.waitForConnectionClose('getMe', signal), { drain: true });
    // An observer for an input that never arrives must be cancelled and joined too.
    observeReceipt(facts.owner, signal => facts.fake.waitForHeldRequest('sendDocument', signal));
    if (failure === 'omitted exact receipt') {
      missingReceipt = observeReceipt(facts.owner, signal => facts.fake.waitForRequest('getMe', request => request.id === -1, signal), { clock: receiptClock, ms: 1_000 });
      void missingReceipt.catch(error => cancellation.abort(error));
    }
  } });
  void starting.catch(error => ready.reject(error));
  const incomplete = assert.rejects(starting, failure === 'omitted' ? /setup receipt deadline/ : failure === 'aborted' ? /aborted artifact setup/ : /artifact exact receipt deadline/);
  const facts = await readyReceipt;
  await until(() => !!heldReceipt, { what: 'startup native observer armed' });
  const held = await heldReceipt!;
  if (failure === 'omitted') await setupClock.advance(1000);
  else if (failure === 'aborted') cancellation.abort(new Error('aborted artifact setup'));
  else {
    const missing = assert.rejects(missingReceipt!, /artifact exact receipt deadline/);
    await receiptClock.advance(1000);
    await missing;
    assert.equal(setupClock.now().toISOString(), '2026-10-16T12:00:00.000Z', 'the exact-receipt deadline is independent of the hub setup clock');
  }
  await incomplete;
  await facts.owner.dispose();
  assert.equal((await closeReceipt!).id, held.id);
  const acquired = await within(facts.owner.serving, testWaitMs(5_000), undefined, () => new Error('artifact late acquisition receipt deadline reached'));
  await within(acquired.stopped, testWaitMs(5_000), undefined, () => new Error('artifact writer stop receipt deadline reached'));
  assert.throws(() => facts.store.remotes.forMessenger('telegram').outbox(), /not open|closed/i);
  assert.deepEqual(facts.native.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, nativeError: null });
  assert.equal(facts.owner.observations(), 0);
  assert.equal(facts.clock.pending, 0);
  assert.equal(setupClock.pending, 0);
  assert.equal(receiptClock.pending, 0);
});
