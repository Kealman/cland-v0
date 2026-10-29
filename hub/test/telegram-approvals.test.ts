// T2: real frames and native Telegram HTTP, with only platform and harness faked.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { join } from 'node:path';
import { access, mkdir, readFile } from 'node:fs/promises';
import { cardWebOwner } from './telegram-card-web-fixture.ts';
import { remoteApprovalHarness } from './fakes/remote-approval-harness.ts';
import { abortable, within } from '../src/executor/droplet/deadline.ts';
import { connectUi, tempProject, until } from './harness.ts';
import { TelegramRemote } from '../src/remote/telegram.ts';
import { TelegramApi, type TgMessage } from '../src/remote/telegram-api.ts';
import { fakeTelegramFixture, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { control, pairing } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { driveTelegram, pacingOwner } from './telegram-pacing-fixture.ts';
import type { Remote } from '../src/remote/gateway.ts';
import type { HubFrame, InboxApproval } from '../src/protocol.ts';

async function prepareFixture(t: TestContext, scripted?: 'codex' | 'opencode', drop?: (frame: HubFrame) => boolean, closeReceipt?: Promise<void>) {
  const web = cardWebOwner(t);
  const owner = pacingOwner(t), root = await tempProject(t), clock = new FakeClock();
  const native = fakeTelegramFixture(t, { clock });
  const nativeClosed = Promise.withResolvers<void>();
  owner.close(async () => { await native.close(); nativeClosed.resolve(); await closeReceipt; });
  const fake = await native.start();
  await mkdir(join(root, '.cland'), { recursive: true });
  const store = owner.store(join(root, '.cland/hub.db')), state = store.remotes.forMessenger('telegram');
  state.setPairing(pairing);
  const requests: Record<string, unknown>[] = [];
  const newRemote = () => {
    const remote = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: fake.url, clock }), clock, { store: state });
    owner.close(() => remote.stop());
    const gateway: Remote = { id: remote.id, via: remote.via,
      start: (send, ...args) => remote.start((frame, ingress) => { requests.push(frame); send(frame, ingress); }, ...args),
      receive: frame => drop?.(frame) ? undefined : remote.receive(frame), run: () => remote.run(), stop: () => remote.stop() };
    return { remote, gateway };
  };
  const { remote, gateway } = newRemote();
  const script = scripted ? remoteApprovalHarness(t, root, clock, scripted) : undefined;
  const initialAbort = new AbortController();
  const polled = Promise.withResolvers<void>();
  let initial: Promise<void> | undefined;
  let observing = false;
  owner.close(async () => { initialAbort.abort(); await initial?.catch(() => {}); });
  const start = (setup: { publishInitial?: boolean; signal?: AbortSignal; clock?: FakeClock } = {}) => {
    observing = true;
    // Arm before native acquisition. The same owner cancels and joins this
    // observer, including when the native initial-poll receipt is withheld.
    initial = fake.waitForPoll(initialAbort.signal).then(async () => {
      polled.resolve();
      if (setup.publishInitial === false) await abortable(new Promise<void>(() => {}), initialAbort.signal);
    }).finally(() => { observing = false; });
    void initial.catch(() => {});
    return owner.start(root, {}, clock, { receipt: initial,
      ...(setup.signal ? { signal: setup.signal } : {}), ...(setup.clock ? { clock: setup.clock } : {}),
      hubOptions: { gatewayRemotes: [gateway], ...(script ? { adapters: [script.factory] } : {}) } });
  };
  return { web, script, owner, root, clock, fake, native, nativeClosed: nativeClosed.promise,
    store, state, remote, requests, newRemote, start, polled: polled.promise, observing: () => observing };
}

async function fixture(t: TestContext, scripted?: 'codex' | 'opencode', drop?: (frame: HubFrame) => boolean) {
  const prepared = await prepareFixture(t, scripted, drop);
  const { web, script, owner, root, clock, fake, store, state, remote } = prepared;
  const hub = await prepared.start();
  const ui = await connectUi(t, hub.discovery, 'nvim');
  await ui.request({ type: 'subscribe' });
  const messages = async () => (await control<{ messages: TgMessage[] }>(fake.url, 'state')).messages;
  const approval = async (harness: 'codex' | 'opencode', command: string) => {
    const name = `${harness}-worker`;
    const launched = await ui.request({ type: 'session.launch', name, harness, role: 'implementer' });
    assert.equal(launched.ok, true, launched.error);
    const delta = ui.waitFor(f => f.type === 'approval' && (f.approval as InboxApproval).session === name && (f.approval as InboxApproval).answerIn === 'hub', 1000);
    if (script) {
      await until(script.ready, { timeoutMs: 1000, what: 'native subscription ready before raising approval' });
      script.raise(command);
    } else hub.fakes[harness]!.raiseApproval(name, { id: 'remote', kind: 'command', subject: { command }, choices: ['once', 'always', 'deny'] });
    const record = (await delta).approval as InboxApproval;
    let card: TgMessage | undefined;
    const mapped = until(async () => {
      card = (await messages()).find(message => state.message('101', String(message.message_id))?.approval === record.id);
      return !!card;
    }, { timeoutMs: 1000, what: 'accepted approval card and durable native approval map' });
    void mapped.catch(() => {});
    await clock.advance(250);
    await driveTelegram(clock, state, mapped);
    return { record, card: card! };
  };
  return { web, script, owner, root, clock, fake, store, state, remote, hub, ui, messages, approval, requests: prepared.requests, newRemote: prepared.newRemote };
}

type Keyboard = { inline_keyboard: Array<Array<{ text: string; callback_data: string; style?: string }>> };

test('Telegram long outage replaces an approval with styled buttons and its later answer folds both copies', async t => {
  const f = await fixture(t);
  const { card, record } = await f.approval('codex', 'echo outage approval');
  const offline = until(() => !!f.state.get('telegram.outage'), { timeoutMs: 1000, what: 'approval outage persisted' });
  void offline.catch(() => {});
  await control(f.fake.url, 'fault', { method: 'getUpdates', code: 503, retry_after: 240 });
  await control(f.fake.url, 'release-polls', {});
  await offline;
  const caught = f.fake.waitForPoll();
  await f.clock.advance(240_000);
  await driveTelegram(f.clock, f.state, within(caught, 1000));
  const native = await f.messages();
  assert.equal(native.length, 2);
  assert.equal(f.state.messagesForApproval(record.id).length, 2);
  assert.match(native[0]!.text!, /↓ Re-sent below/);
  assert.deepEqual(native[0]!.reply_markup, { inline_keyboard: [] });
  assert.match(native[1]!.text!, /a button pressed then may have been lost; press again/);
  assert.deepEqual(native[1]!.reply_markup, card.reply_markup);
  const folded = until(async () => (await f.messages()).every(row => row.text?.includes('Approved once · human via Telegram')
    && JSON.stringify(row.reply_markup) === '{"inline_keyboard":[]}'),
  { timeoutMs: 1000, what: 'outage replacement and old approval share the durable answer outcome' });
  void folded.catch(() => {});
  const confirmed = f.fake.waitForPoll();
  const press = await control<{ update_id: number }>(f.fake.url, 'press', { chat_id: 101, message_id: native[1]!.message_id, row: 0, column: 0 });
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 1000))).params.offset, press.update_id + 1);
  await driveTelegram(f.clock, f.state, folded);
  await f.hub.stop();
  assert.equal(f.store.inboxOutcome('approval', record.id)!.via, 'telegram');
});

test('Telegram inbox resends a live approval with its styled choices and folds both copies from the new copy', async t => {
  const f = await fixture(t);
  const { card, record } = await f.approval('codex', 'echo approve copies');
  const copied = until(async () => (await f.messages()).length === 2 && f.state.messagesForApproval(record.id).length === 2,
    { timeoutMs: 1000, what: 'live approval resend has its durable approval map' });
  void copied.catch(() => {});
  const confirmed = f.fake.waitForPoll();
  const update = await control<{ update_id: number }>(f.fake.url, 'say', { text: '/inbox' });
  await driveTelegram(f.clock, f.state, copied);
  assert.equal((await within(confirmed, 1000)).params.offset, update.update_id + 1);
  const copy = (await f.messages())[1]!;
  assert.equal(copy.text, card.text);
  assert.deepEqual(copy.reply_markup, card.reply_markup);
  const outcomes = until(async () => (await f.messages()).every(message => message.text?.includes('Approved once · human via Telegram')
    && JSON.stringify(message.reply_markup) === '{"inline_keyboard":[]}'),
  { timeoutMs: 1000, what: 'both approval copies show the durable winning outcome' });
  void outcomes.catch(() => {});
  const answered = f.fake.waitForPoll();
  const press = await control<{ update_id: number }>(f.fake.url, 'press', { chat_id: 101, message_id: copy.message_id, row: 0, column: 0 });
  assert.equal((await driveTelegram(f.clock, f.state, within(answered, 1000))).params.offset, press.update_id + 1);
  await driveTelegram(f.clock, f.state, outcomes);
  await f.hub.stop();
  const messages = await f.messages();
  assert.equal(messages.length, 2);
  assert.equal(messages[0]!.text, messages[1]!.text);
  assert.equal(f.store.inboxOutcome('approval', record.id)!.via, 'telegram');
});

test('Telegram Codex approval clips a 5000-character command and offers three coloured choice rows', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const command = 'echo ' + 'x'.repeat(4995);
  const { card, record } = await f.approval('codex', command);
  assert.match(card.text!, /codex-worker asks to run.*codex/);
  assert.match(card.text!, /echo x+/);
  assert.match(card.text!, /full command in the workbench/);
  assert.ok([...card.text!].length <= 4096);
  assert.equal(card.text!.includes(command), false);
  assert.ok(card.entities!.length <= 100);
  const rows = (card.reply_markup as Keyboard).inline_keyboard;
  assert.deepEqual(rows.map(row => row.map(button => [button.text, button.style])), [
    [['Approve once', 'success']], [['Always allow', 'primary']], [['Deny', 'danger']],
  ]);
  assert.equal(new Set(rows.flat().map(button => button.callback_data)).size, 3);
  for (const button of rows.flat()) {
    assert.ok(Buffer.byteLength(button.callback_data) <= 64);
    assert.equal(button.callback_data.includes(record.id), false);
  }
});


test('Telegram Approve once runs the scripted Codex command and commits before callback acknowledgement', { timeout: 5000 }, async t => {
  const f = await fixture(t, 'codex');
  const { card, record } = await f.approval('codex', 'touch approved-command');
  await control(f.fake.url, 'fault', { method: 'answerCallbackQuery', code: 500, response: 'hold' });
  const acknowledging = f.fake.waitForHeldRequest('answerCallbackQuery');
  const edited = until(async () => (await f.messages()).some(message => message.message_id === card.message_id && message.text?.includes('Approved once · human via Telegram')),
    { timeoutMs: 1000, what: 'native approval outcome edit' });
  void edited.catch(() => {});
  const press = await control<{ update_id: number }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 0, column: 0 });
  const held = await within(acknowledging, 1000);
  assert.deepEqual(f.script!.commands, [{ id: 'approval', outcome: 'ran' }]);
  assert.equal(await readFile(join(f.root, 'approved-command'), 'utf8'), 'command ran');
  assert.deepEqual(f.script!.codex.responses, [{ id: 'approval', result: { decision: 'accept' } }]);
  const saved = f.store.inboxOutcome('approval', record.id)!;
  assert.deepEqual(saved, { choice: 'once', by: 'human', via: 'telegram', at: saved.at });
  assert.equal(f.state.get(`telegram.update:${press.update_id}`), null);
  const confirmed = f.fake.waitForPoll();
  await control(f.fake.url, 'release-requests', { ids: [held.id] });
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 1000))).params.offset, press.update_id + 1);
  await driveTelegram(f.clock, f.state, edited);
  const outcome = (await f.messages()).find(message => message.message_id === card.message_id)!;
  assert.equal(outcome.text, `codex-worker asks to run · codex\n\ntouch approved-command\n\nApproved once · human via Telegram · ${new Date(saved.at).toTimeString().slice(0, 5)}`);
  assert.deepEqual(outcome.reply_markup, { inline_keyboard: [] });
});


for (const choice of ['deny', 'once'] as const) for (const first of ['delivered', 'held'] as const) test(`Telegram corrects a Codex ${choice} approval after its first outcome edit is ${first}`, async t => {
  const f = await fixture(t, 'codex');
  const { card, record } = await f.approval('codex', 'touch raced-command');
  const edits = () => f.state.outbox().filter(job => job.source === record.id && job.kind === 'edit');
  if (first === 'held') await control(f.fake.url, 'fault', { method: 'editMessageText', code: 500, response: 'hold' });
  const held = first === 'held' ? f.fake.waitForHeldRequest('editMessageText') : undefined;
  const sent = first === 'delivered' ? until(() => edits().some(job => job.state === 'sent'),
    { timeoutMs: 1000, what: 'first human outcome edit durably sent' }) : undefined;
  void sent?.catch(() => {});
  assert.equal((await f.ui.request({ type: 'approval.answer', approval: record.id, choice })).ok, true);
  const blocked = held ? await driveTelegram(f.clock, f.state, within(held, 1000)) : undefined;
  if (sent) await driveTelegram(f.clock, f.state, sent);
  const corrected = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as InboxApproval).id === record.id
    && (frame.approval as InboxApproval).outcome?.via === 'harness', 1000);
  f.script!.codex.notify('serverRequest/resolved', { requestId: 'approval' });
  f.script!.codex.notify('item/completed', { turnId: 'turn-command', item: { id: 'command', type: 'commandExecution', status: choice === 'deny' ? 'completed' : 'declined', exitCode: choice === 'deny' ? 0 : null } });
  await corrected;
  await until(() => edits().some(job => (job.payload as { params: { text: string } }).params.text.includes('Answered in the harness')),
    { timeoutMs: 1000, what: 'distinct corrected outcome intent persisted' });
  if (blocked) {
    assert.equal(edits().filter(job => job.state === 'sending').length, 1);
    await control(f.fake.url, 'release-requests', { ids: [blocked.id] });
  }
  const settled = until(() => edits().filter(job => job.state === 'sent').length === 2,
    { timeoutMs: 1000, what: 'both ordered outcome edits durably sent' });
  void settled.catch(() => {});
  await driveTelegram(f.clock, f.state, settled);
  const native = (await f.messages()).find(message => message.message_id === card.message_id)!;
  assert.match(native.text!, /Answered in the harness · harness via harness/);
  assert.deepEqual(native.reply_markup, { inline_keyboard: [] });
  assert.equal(edits().length, 2);
  const http = await control<{ requests: Array<{ method: string; params: { text?: string } }> }>(f.fake.url, 'state');
  const sentTexts = http.requests.filter(request => request.method === 'editMessageText').map(request => request.params.text!);
  assert.equal(sentTexts.length, 2);
  assert.match(sentTexts[0]!, choice === 'deny' ? /Denied · human via Neovim/ : /Approved once · human via Neovim/);
  assert.match(sentTexts[1]!, /Answered in the harness/);
  assert.deepEqual(f.store.inboxOutcome('approval', record.id), ((await corrected).approval as InboxApproval).outcome);
});

test('Telegram Deny stops the scripted OpenCode command and a web answer edits its own card', { timeout: 5000 }, async t => {
  const f = await fixture(t, 'opencode');
  const { card, record } = await f.approval('opencode', 'touch approved-command');
  const edited = until(async () => (await f.messages()).some(message => message.message_id === card.message_id && message.text?.includes('Denied · human via Telegram')),
    { timeoutMs: 1000, what: 'OpenCode denied outcome on Telegram' });
  void edited.catch(() => {});
  const confirmed = f.fake.waitForPoll();
  const press = await control<{ update_id: number }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 2, column: 0 });
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 1000))).params.offset, press.update_id + 1);
  await driveTelegram(f.clock, f.state, edited);
  assert.deepEqual(f.script!.opencode.replies, [{ session: f.script!.opencode.session, request: 'approval', decision: 'reject' }]);
  assert.deepEqual(f.script!.commands, [{ id: 'approval', outcome: 'denied' }]);
  await assert.rejects(readFile(join(f.root, 'approved-command')), { code: 'ENOENT' });
  assert.equal(f.store.inboxOutcome('approval', record.id)!.via, 'telegram');
  assert.deepEqual((await f.messages()).find(message => message.message_id === card.message_id)!.reply_markup, { inline_keyboard: [] });
  // Another native request from this session, answered by the authenticated web edge.
  const pending = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as InboxApproval).id.endsWith(':web'), 1000);
  f.script!.opencode.ask('web', 'shell');
  const webRecord = (await pending).approval as InboxApproval;
  const mapped = until(async () => (await f.messages()).some(message => f.state.message('101', String(message.message_id))?.approval === webRecord.id),
    { timeoutMs: 1000, what: 'second approval mapped before web answer' });
  void mapped.catch(() => {});
  await f.clock.advance(250);
  await driveTelegram(f.clock, f.state, mapped);
  const web = await f.web.start(f.ui);
  const webEdited = until(async () => (await f.messages()).some(message => f.state.message('101', String(message.message_id))?.approval === webRecord.id && message.text?.includes('Approved once · human via web')),
    { timeoutMs: 1000, what: 'web approval outcome edits Telegram card' });
  void webEdited.catch(() => {});
  const answered = await web.request({ type: 'approval.answer', approval: webRecord.id, choice: 'once' });
  assert.equal(answered.ok, true, answered.error);
  await driveTelegram(f.clock, f.state, webEdited);
  assert.deepEqual(f.script!.commands, [{ id: 'approval', outcome: 'denied' }, { id: 'web', outcome: 'ran' }]);
  assert.equal(await readFile(join(f.root, 'approved-command'), 'utf8'), 'command ran');
  assert.equal(f.store.inboxOutcome('approval', webRecord.id)!.via, 'web');
});

test('Telegram drops a closed approval queued behind a flood hold before its card ever leaves', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  await control(f.fake.url, 'fault', { method: 'sendMessage', code: 429, retry_after: 60 });
  const launched = await f.ui.request({ type: 'session.launch', name: 'queued', harness: 'codex', role: 'implementer' });
  assert.equal(launched.ok, true, launched.error);
  const pending = f.ui.waitFor(frame => frame.type === 'approval' && (frame.approval as InboxApproval).session === 'queued', 1000);
  f.hub.fakes.codex!.raiseApproval('queued', { id: 'closed', kind: 'command', subject: { command: 'never sent' }, choices: ['once', 'deny'] });
  const record = (await pending).approval as InboxApproval;
  await until(() => f.state.outbox().some(job => job.source === record.id && f.state.attempts(job.id).some(attempt => attempt.outcome === 'never-left')),
    { timeoutMs: 1000, what: 'durable never-left approval send under flood hold' });
  const dropped = until(() => f.state.outbox().some(job => job.source === record.id && job.state === 'dropped'),
    { timeoutMs: 1000, what: 'closed unsent approval source is dropped' });
  void dropped.catch(() => {});
  const answered = await f.ui.request({ type: 'approval.answer', approval: record.id, choice: 'deny' });
  assert.equal(answered.ok, true, answered.error);
  await driveTelegram(f.clock, f.state, dropped);
  await f.hub.stop();
  assert.equal((await f.messages()).length, 0);
  const job = f.state.outbox().find(job => job.source === record.id)!;
  assert.deepEqual(f.state.attempts(job.id).map(attempt => attempt.outcome), ['never-left']);
});

test('Telegram refuses approval keys on ask cards and ask keys on approval cards without changing either record', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const { record, card } = await f.approval('codex', 'echo approval');
  const { inProcessSpoke } = await import('./harness.ts');
  const coord = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'coord', role: 'coordinator' });
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Ask boundary?', options: ['Continue'] });
  assert.equal(asked.ok, true);
  let askCard: TgMessage | undefined;
  const mapped = until(async () => {
    askCard = (await f.messages()).find(message => f.state.message('101', String(message.message_id))?.ask === asked.ask);
    return !!askCard;
  }, { timeoutMs: 1000, what: 'mapped ask alongside approval' });
  void mapped.catch(() => {});
  await f.clock.advance(250);
  await driveTelegram(f.clock, f.state, mapped);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: f.fake.url });
  for (const [target, wrong] of [[askCard!, card], [card, askCard!]] as const) {
    const key = (wrong.reply_markup as Keyboard).inline_keyboard[0]![0]!.callback_data;
    await api.editMessageText({ chat_id: 101, message_id: target.message_id, text: target.text!,
      reply_markup: { inline_keyboard: [[{ text: 'Wrong kind', callback_data: key }]] } }, { signal: AbortSignal.timeout(1000) });
    const acknowledged = f.fake.waitForRequest('answerCallbackQuery');
    const confirmed = f.fake.waitForPoll();
    const press = await control<{ update_id: number }>(f.fake.url, 'press', { chat_id: 101, message_id: target.message_id, row: 0, column: 0 });
    assert.equal((await within(acknowledged, 1000)).params.text, 'This button is not available');
    assert.equal((await within(confirmed, 1000)).params.offset, press.update_id + 1);
  }
  assert.equal(f.store.ask(asked.ask)!.state, 'open');
  assert.equal(f.store.inboxOutcome('approval', record.id), undefined);
  assert.deepEqual(f.hub.fakes.codex!.approvalAnswers, []);
  const inbox = (await f.ui.request({ type: 'inbox.list' })).value as { approvals: InboxApproval[] };
  assert.equal(inbox.approvals.find(row => row.id === record.id)!.state, 'pending');
});


test('Telegram approval lost-result replay after component restart never runs the command twice', { timeout: 5000 }, async t => {
  const lost = Promise.withResolvers<void>();
  const f = await fixture(t, 'codex', frame => {
    if (frame.type === 'result' && frame.ok && (frame.value as { approval?: InboxApproval }).approval?.state === 'closed') {
      lost.resolve(); return true;
    }
    return false;
  });
  const { card, record } = await f.approval('codex', 'touch approved-command');
  const press = await control<{ update_id: number; callback_query: { id: string } }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 0, column: 0 });
  await within(lost.promise, 1000);
  const saved = f.store.inboxOutcome('approval', record.id)!;
  assert.equal(saved.via, 'telegram');
  assert.equal(f.state.get(`telegram.update:${press.update_id}`), null);
  assert.equal(f.state.get(`telegram.press:${press.callback_query.id}`), 'pending');
  await f.hub.stop(); f.ui.close();
  const next = new TelegramRemote(new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: f.fake.url, clock: f.clock }), f.clock, { store: f.state });
  f.owner.close(() => next.stop());
  const acknowledged = f.fake.waitForRequest('answerCallbackQuery');
  const confirmed = f.fake.waitForPoll();
  const hub = await f.owner.start(f.root, {}, f.clock, { hubOptions: { gatewayRemotes: [next] } });
  assert.equal((await driveTelegram(f.clock, f.state, within(acknowledged, 1000))).params.text, 'Already answered');
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 1000))).params.offset, press.update_id + 1);
  assert.deepEqual(f.store.inboxOutcome('approval', record.id), saved);
  assert.deepEqual(f.script!.commands, [{ id: 'approval', outcome: 'ran' }]);
  assert.deepEqual(f.script!.codex.responses, [{ id: 'approval', result: { decision: 'accept' } }]);
  await hub.stop();
});

for (const choice of ['withdrawn', 'once'] as const) test(`Telegram harness ${choice} closes every mapped approval copy`, { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const { card, record } = await f.approval('codex', 'echo ' + '🚀'.repeat(5000));
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: f.fake.url });
  const copy = await api.sendMessage({ chat_id: 101, text: card.text!, reply_markup: card.reply_markup! }, { signal: AbortSignal.timeout(1000) });
  f.state.putMessage({ ...f.state.message('101', String(card.message_id))!, messageId: String(copy.message_id) });
  const edited = until(async () => {
    const messages = await f.messages();
    return [card, copy].every(old => messages.find(message => message.message_id === old.message_id)?.text?.includes('harness via harness'));
  }, { timeoutMs: 1000, what: 'both native approval copies fold to the harness outcome' });
  void edited.catch(() => {});
  f.hub.fakes.codex!.closeApproval('codex-worker', 'remote', { choice, by: 'harness', via: 'harness', at: f.clock.now().toISOString() });
  await driveTelegram(f.clock, f.state, edited);
  const messages = await f.messages();
  for (const original of [card, copy]) {
    const outcome = messages.find(message => message.message_id === original.message_id)!;
    assert.ok(outcome.text!.includes(choice === 'withdrawn' ? 'Withdrawn · harness via harness' : 'Approved once · harness via harness'));
    assert.ok([...outcome.text!].length <= 4096);
    assert.match(outcome.text!, /full command in the workbench/);
    assert.deepEqual(outcome.reply_markup, { inline_keyboard: [] });
  }
  assert.equal(f.state.messagesForApproval(record.id).length, 2);
});

test('Telegram approval outcome keeps a long denial note bounded with actor, source and time', { timeout: 5000 }, async t => {
  const f = await fixture(t);
  const { card } = await f.approval('codex', 'echo bounded');
  const edited = until(async () => (await f.messages()).some(message => message.message_id === card.message_id && message.text?.includes('Denied: ')),
    { timeoutMs: 1000, what: 'bounded long-note outcome accepted by Telegram' });
  void edited.catch(() => {});
  f.hub.fakes.codex!.closeApproval('codex-worker', 'remote', { choice: 'deny', by: 'human', via: 'web', at: f.clock.now().toISOString(), note: '🚀'.repeat(5000) });
  await driveTelegram(f.clock, f.state, edited);
  const outcome = (await f.messages()).find(message => message.message_id === card.message_id)!;
  assert.ok([...outcome.text!].length <= 4096);
  assert.match(outcome.text!, /human via web · \d\d:\d\d$/);
  assert.match(outcome.text!, /full note in the workbench/);
  assert.deepEqual(outcome.reply_markup, { inline_keyboard: [] });
});


for (const interruption of ['omitted', 'aborted'] as const) test(`Telegram approval fixture ${interruption} initial-poll setup drains before SQLite and root cleanup`, { timeout: 5000 }, async t => {
  const closeReceipt = Promise.withResolvers<void>();
  const f = await prepareFixture(t, undefined, undefined, closeReceipt.promise);
  const setupClock = new FakeClock(), setupAbort = new AbortController();
  const starting = f.start({ publishInitial: false, clock: setupClock, signal: setupAbort.signal });
  let joined = false;
  const failed = assert.rejects(starting, interruption === 'omitted' ? /setup receipt deadline/ : /cancel initial-poll setup/)
    .then(() => { joined = true; });
  void failed.catch(() => {});
  try {
    const hub = await within(f.owner.serving, 1000);
    await within(f.polled, 1000);
    assert.equal(f.observing(), true);
    if (interruption === 'omitted') await setupClock.advance(1000);
    else setupAbort.abort(new Error('cancel initial-poll setup'));
    await within(f.nativeClosed, 1000);
    await within(hub.stopped, 1000);
    assert.equal(joined, false, 'setup rejection must join native close ownership before closing SQLite');
    assert.equal(f.state.status().disabled, false, 'SQLite stays open until every native owner joins');
    await access(f.root);
    closeReceipt.resolve();
    await within(failed, 1000);
    await f.owner.dispose();
    assert.deepEqual(f.native.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, nativeError: null });
    assert.equal(f.observing(), false);
    assert.throws(() => f.state.outbox(), /not open|closed/i);
    assert.equal(f.clock.pending, 0);
    assert.equal(setupClock.pending, 0);
  } finally {
    closeReceipt.resolve();
    await f.owner.dispose();
  }
});


test('Telegram stale approval press after restart returns Already answered without hub frames or changing the outcome', async t => {
  const f = await fixture(t);
  const { record, card } = await f.approval('codex', 'echo stale approval');
  const folded = until(async () => (await f.messages()).some(row => row.message_id === card.message_id && row.text?.includes('Denied · human via Neovim')),
    { timeoutMs: 1000, what: 'closed approval outcome mapped before restart' });
  void folded.catch(() => {});
  assert.equal((await f.ui.request({ type: 'approval.answer', approval: record.id, choice: 'deny' })).ok, true);
  await driveTelegram(f.clock, f.state, folded);
  const outcome = f.store.inboxOutcome('approval', record.id);
  await f.hub.stop(); f.ui.close();
  const next = f.newRemote();
  const initial = f.fake.waitForPoll();
  const hub = await f.owner.start(f.root, {}, f.clock, { hubOptions: { gatewayRemotes: [next.gateway] } });
  await driveTelegram(f.clock, f.state, within(initial, 1000));
  assert.ok(card.reply_markup && 'inline_keyboard' in card.reply_markup);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: f.fake.url, clock: f.clock });
  await api.editMessageText({ chat_id: '101', message_id: card.message_id, text: card.text!, reply_markup: card.reply_markup });
  const before = f.requests.length;
  const acknowledged = f.fake.waitForRequest('answerCallbackQuery');
  const confirmed = f.fake.waitForPoll();
  const press = await control<{ update_id: number; callback_query: object }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 0, column: 0 });
  assert.equal((await within(acknowledged, 1000)).params.text, 'Already answered');
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 1000))).params.offset, press.update_id + 1);
  assert.deepEqual(f.requests.slice(before), [], 'known closed approval never reads or answers through the hub');
  assert.deepEqual(f.store.inboxOutcome('approval', record.id), outcome);
  assert.deepEqual((await f.messages()).find(row => row.message_id === card.message_id)!.reply_markup, { inline_keyboard: [] });
  const replayed = f.fake.waitForPoll();
  const replay = await control<{ update_id: number }>(f.fake.url, 'update', { callback_query: press.callback_query });
  assert.equal((await within(replayed, 1000)).params.offset, replay.update_id + 1);
  assert.deepEqual(f.requests.slice(before), []);
  await hub.stop();
  const native = await control<{ requests: Array<{ method: string }> }>(f.fake.url, 'state');
  assert.equal(native.requests.filter(row => row.method === 'answerCallbackQuery').length, 1);
});

test('Telegram foreign approval press gets one private alert without hub frames or record changes across replay and restart', async t => {
  const f = await fixture(t);
  const { record, card } = await f.approval('opencode', 'echo foreign approval');
  const before = f.requests.length;
  const acknowledged = f.fake.waitForRequest('answerCallbackQuery');
  const confirmed = f.fake.waitForPoll();
  const press = await control<{ update_id: number; callback_query: object }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 0, column: 0, user: 'stranger' });
  assert.equal((await within(confirmed, 1000)).params.offset, press.update_id + 1);
  const native = await control<{ requests: Array<{ method: string }> }>(f.fake.url, 'state');
  assert.equal(native.requests.filter(row => row.method === 'answerCallbackQuery').length, 1, 'foreign approval must get its private refusal');
  const ack = await within(acknowledged, 1000);
  assert.equal(ack.params.text, "This card is for the project's owner");
  assert.equal(ack.params.show_alert, true);
  assert.deepEqual(f.requests.slice(before), []);
  assert.equal(f.store.inboxOutcome('approval', record.id), undefined);
  assert.deepEqual(await f.messages(), [card]);
  await f.hub.stop(); f.ui.close();
  const next = f.newRemote();
  const initial = f.fake.waitForPoll();
  const hub = await f.owner.start(f.root, {}, f.clock, { hubOptions: { gatewayRemotes: [next.gateway] } });
  await driveTelegram(f.clock, f.state, within(initial, 1000));
  const replayBefore = f.requests.length;
  const confirmedReplay = f.fake.waitForPoll();
  const replay = await control<{ update_id: number }>(f.fake.url, 'update', { callback_query: press.callback_query });
  assert.equal((await within(confirmedReplay, 1000)).params.offset, replay.update_id + 1);
  assert.deepEqual(f.requests.slice(replayBefore), []);
  assert.equal(f.store.inboxOutcome('approval', record.id), undefined);
  assert.deepEqual(await f.messages(), [card]);
  await hub.stop();
  const final = await control<{ requests: Array<{ method: string }> }>(f.fake.url, 'state');
  assert.equal(final.requests.filter(row => row.method === 'answerCallbackQuery').length, 1);
});

for (const closed of [false, true]) test(`Telegram late text and reply to ${closed ? 'a closed' : 'an open'} approval never consume another ask prompt`, async t => {
  const f = await fixture(t);
  const { record, card } = await f.approval('codex', 'echo late approval');
  if (closed) {
    const folded = until(async () => (await f.messages()).some(row => row.message_id === card.message_id && row.text?.includes('Denied · human via Neovim')),
      { timeoutMs: 1000, what: 'late approval reply target durably closed' });
    void folded.catch(() => {});
    assert.equal((await f.ui.request({ type: 'approval.answer', approval: record.id, choice: 'deny' })).ok, true);
    await driveTelegram(f.clock, f.state, folded);
  }
  const outcome = f.store.inboxOutcome('approval', record.id);
  const { inProcessSpoke } = await import('./harness.ts');
  const coord = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'coord', role: 'coordinator' });
  const asked = await coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Unrelated waiting ask?', options: ['Continue'], free: true });
  assert.equal(asked.ok, true);
  let askCard: TgMessage | undefined;
  const mapped = until(async () => {
    askCard = (await f.messages()).find(row => f.state.message('101', String(row.message_id))?.ask === asked.ask);
    return !!askCard;
  }, { timeoutMs: 1000, what: 'waiting ask card mapped beside approval' });
  void mapped.catch(() => {});
  await f.clock.advance(250);
  await driveTelegram(f.clock, f.state, mapped);
  const prompted = f.fake.waitForPoll();
  await control(f.fake.url, 'press', { chat_id: 101, message_id: askCard!.message_id, row: 1, column: 0 });
  await driveTelegram(f.clock, f.state, within(prompted, 1000, undefined, () => new Error('waiting prompt callback confirmation missing')));
  const wait = f.state.get('telegram.prompt-wait:101');
  assert.ok(wait);
  const offline = until(() => !!f.state.get('telegram.outage'), { timeoutMs: 1000, what: 'approval late-input outage recorded' });
  void offline.catch(() => {});
  await control(f.fake.url, 'fault', { method: 'getUpdates', code: 503, retry_after: 10 });
  await control(f.fake.url, 'release-polls', {});
  await offline;
  const date = Math.floor(f.clock.now().getTime() / 1000);
  await control(f.fake.url, 'update', { message: { message_id: 9910, date, chat: card.chat,
    from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: 'Late text beside approval' } });
  const input = await control<{ update_id: number }>(f.fake.url, 'update', { message: { message_id: 9911, date, chat: card.chat,
    from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: 'Late approval reply', reply_to_message: card } });
  const confirmed = f.fake.waitForPoll();
  await f.clock.advance(10000);
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 1000, undefined, () => new Error('late approval input confirmation missing')))).params.offset, input.update_id + 1);
  assert.equal(f.store.ask(asked.ask)!.state, 'open');
  assert.equal(f.state.get('telegram.prompt-wait:101'), wait);
  assert.deepEqual(f.store.inboxOutcome('approval', record.id), outcome);
  const history = (await f.ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string; answerTo?: string; via?: string }> };
  for (const text of ['Late text beside approval']) {
    const message = history.messages.find(row => row.text.startsWith(text))!;
    assert.match(message.text, /written on Telegram at.*the hub was down until/);
    assert.equal(message.answerTo, undefined);
    assert.equal(message.via, 'telegram');
  }
  assert.equal(history.messages.some(row => row.text.startsWith('Late approval reply')), false);
  assert.ok((await f.messages()).some(row => row.text === (closed ? 'This approval is already closed.' : 'Use the approval card’s buttons to answer.')));
  await f.hub.stop();
});

test('Telegram uncertain stale approval outcome stays fenced while callback and later input progress across restart', async t => {
  const f = await fixture(t);
  const { record, card } = await f.approval('codex', 'echo unknown approval outcome');
  const folded = until(async () => (await f.messages()).some(row => row.message_id === card.message_id && row.text?.includes('Denied · human via Neovim')),
    { timeoutMs: 1000, what: 'original approval outcome durably folded' });
  void folded.catch(() => {});
  assert.equal((await f.ui.request({ type: 'approval.answer', approval: record.id, choice: 'deny' })).ok, true);
  await driveTelegram(f.clock, f.state, folded);
  const outcome = f.store.inboxOutcome('approval', record.id);
  assert.ok(card.reply_markup && 'inline_keyboard' in card.reply_markup);
  const api = new TelegramApi(TELEGRAM_TEST_TOKEN, { apiRoot: f.fake.url, clock: f.clock });
  await api.editMessageText({ chat_id: '101', message_id: card.message_id, text: card.text!, reply_markup: card.reply_markup });
  await control(f.fake.url, 'fault', { method: 'editMessageText', code: 400, description: 'Bad Request: message cannot be edited' });
  await control(f.fake.url, 'fault', { method: 'sendMessage', code: 500, response: 'accept-disconnect' });
  const uncertain = until(() => f.state.outbox().some(job => job.source === record.id && job.state === 'uncertain'),
    { timeoutMs: 1000, what: 'approval stale-repair fallback fenced durably' });
  void uncertain.catch(() => {});
  const confirmed = f.fake.waitForPoll();
  const press = await control<{ update_id: number; callback_query: { id: string } }>(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 0, column: 0 });
  await driveTelegram(f.clock, f.state, uncertain);
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 1000))).params.offset, press.update_id + 1);
  assert.equal(f.state.get(`telegram.press:${press.callback_query.id}`), 'Already answered');
  assert.equal(f.state.get(`telegram.outcome-incomplete:${press.callback_query.id}`), `telegram.outcome:101:${card.message_id}:press:${press.callback_query.id}`);
  const unknownId = f.state.outbox().find(job => job.source === record.id && job.state === 'uncertain')!.id;
  await f.hub.stop(); f.ui.close();
  const next = f.newRemote();
  const initial = f.fake.waitForPoll();
  const hub = await f.owner.start(f.root, {}, f.clock, { hubOptions: { gatewayRemotes: [next.gateway] } });
  await driveTelegram(f.clock, f.state, within(initial, 1000));
  const progressed = f.fake.waitForPoll();
  const input = await control<{ update_id: number }>(f.fake.url, 'say', { text: 'After uncertain approval outcome' });
  assert.equal((await driveTelegram(f.clock, f.state, within(progressed, 1000))).params.offset, input.update_id + 1);
  const ui = await connectUi(t, hub.discovery);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string; answerTo?: string }> };
  assert.deepEqual(history.messages.filter(row => row.text === 'After uncertain approval outcome').map(row => row.answerTo), [undefined]);
  assert.deepEqual(f.store.inboxOutcome('approval', record.id), outcome);
  assert.equal(f.state.outbox().find(job => job.id === unknownId)!.state, 'uncertain');
  await hub.stop();
  const native = await control<{ messages: TgMessage[]; requests: Array<{ method: string }> }>(f.fake.url, 'state');
  assert.equal(native.messages.filter(row => row.reply_to_message?.message_id === card.message_id).length, 1);
  assert.equal(native.requests.filter(row => row.method === 'answerCallbackQuery').length, 1);
});

test('Telegram uncertain approval reply note confirms its input and never retransmits across restart', async t => {
  const f = await fixture(t);
  const { record, card } = await f.approval('codex', 'echo typed approval');
  await control(f.fake.url, 'fault', { method: 'sendMessage', code: 500, response: 'accept-disconnect' });
  const unknown = until(() => f.state.outbox().some(job => job.state === 'uncertain'),
    { timeoutMs: 1000, what: 'approval reply note durably fenced' });
  void unknown.catch(() => {});
  const confirmed = within(f.fake.waitForPoll(), 1000, undefined, () => new Error('approval reply note blocked input confirmation'));
  void confirmed.catch(() => {});
  const input = await control<{ update_id: number }>(f.fake.url, 'update', { message: { message_id: 9912, date: 1, chat: card.chat,
    from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: 'once', reply_to_message: card } });
  await driveTelegram(f.clock, f.state, unknown);
  assert.equal((await driveTelegram(f.clock, f.state, confirmed)).params.offset, input.update_id + 1);
  assert.equal(f.store.inboxOutcome('approval', record.id), undefined);
  assert.equal(f.state.get('telegram.answer-note-incomplete:101:9912'), 'telegram.answer-input:101:9912:note');
  await f.hub.stop(); f.ui.close();
  const next = f.newRemote();
  const initial = f.fake.waitForPoll();
  const hub = await f.owner.start(f.root, {}, f.clock, { hubOptions: { gatewayRemotes: [next.gateway] } });
  await driveTelegram(f.clock, f.state, within(initial, 1000));
  const later = f.fake.waitForPoll();
  const last = await control<{ update_id: number }>(f.fake.url, 'say', { text: 'After unknown approval note' });
  assert.equal((await driveTelegram(f.clock, f.state, within(later, 1000))).params.offset, last.update_id + 1);
  const ui = await connectUi(t, hub.discovery);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string }> };
  assert.equal(history.messages.filter(row => row.text === 'After unknown approval note').length, 1);
  assert.equal(history.messages.some(row => row.text === 'once'), false);
  assert.equal(f.store.inboxOutcome('approval', record.id), undefined);
  assert.equal(f.state.outbox().filter(job => job.state === 'uncertain').length, 1);
  await hub.stop();
  assert.equal((await f.messages()).filter(row => row.text === 'Use the approval card’s buttons to answer.').length, 1);
});
