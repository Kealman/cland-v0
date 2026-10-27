// T2: needs-you notices through public frames and the sealed fake Bot API.
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, inProcessSpoke, tempProject, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { fakeTelegramFixture, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { control, pairing } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { driveTelegram, pacingOwner } from './telegram-pacing-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import type { HubFrame, Inbox, TopicMessage } from '../src/protocol.ts';
import type { TgMessage } from '../src/remote/telegram-api.ts';
import { messengerFactory } from '../src/remote/messenger.ts';
import { remoteRedactor } from '../src/remote/redact.ts';
import type { Remote } from '../src/remote/gateway.ts';

async function fixture(t: TestContext, origin?: string, drop?: (frame: HubFrame) => boolean) {
  const owner = pacingOwner(t), root = await tempProject(t), clock = new FakeClock();
  const native = fakeTelegramFixture(t, { clock, ...(origin ? { publicOrigin: origin } : {}) });
  owner.close(() => native.close(), { startupOnly: true });
  const fake = await native.start();
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Telegram notices fixture');
  config.remote.telegram.enabled = true;
  config.plan.approval = 'human';
  if (origin) config.web.origin = origin;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const store = owner.store(join(root, '.cland/hub.db')), state = store.remotes.forMessenger('telegram');
  state.setPairing(pairing);
  const polling = fake.waitForPoll();
  let nativeRemote: Remote | undefined;
  const start = (intercept?: (frame: HubFrame) => boolean) => {
    const factory = messengerFactory({ CLAND_TELEGRAM_API_ROOT: fake.url }, remoteRedactor(), clock, { state: store.remotes });
    return owner.start(root, { CLAND_TELEGRAM_API_ROOT: fake.url }, clock, { hubOptions: intercept ? {
      gatewayMessenger: (...args) => {
        const remote = factory(...args);
        nativeRemote = remote;
        return { ...remote, id: remote.id, via: remote.via, start: (...input) => remote.start(...input),
          receive: frame => intercept(frame) ? undefined : remote.receive(frame), run: () => remote.run!(), stop: () => remote.stop() };
      },
    } : {} });
  };
  const hub = await start(drop);
  await within(polling, 1000);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const request = async <T>(frame: { type: string } & Record<string, unknown>) => {
    const result = await ui.request(frame);
    assert.equal(result.ok, true, result.error);
    return result.value as T;
  };
  const messages = async () => (await control<{ messages: TgMessage[] }>(fake.url, 'state')).messages;
  const notice = async (produce: () => Promise<string>) => {
    let source: string | undefined;
    let accepted: TgMessage | undefined;
    const mapped = until(async () => {
      accepted = (await messages()).find(message => state.message('101', String(message.message_id))?.message === source);
      return !!accepted && state.outbox().some(job => job.kind === 'card' && job.source === source && job.state === 'sent');
    }, { timeoutMs: 1000, what: 'accepted notice and durable source mapping' });
    void mapped.catch(() => {});
    source = await produce();
    await clock.advance(250);
    await driveTelegram(clock, state, mapped);
    return accepted!;
  };
  const sentNotice = async (topic: string, text: string, fields: Record<string, unknown> = {}) => {
    let source = '';
    const card = await notice(async () => {
      const sent = await coord.call<{ ok: boolean }>('send', { topic, text, ...fields });
      assert.equal(sent.ok, true, JSON.stringify(sent));
      source = (await request<{ messages: TopicMessage[] }>({ type: 'topic.history', topic })).messages.at(-1)!.id;
      return source;
    });
    return { source, card };
  };
  const approval = () => notice(async () => {
    await request({ type: 'session.launch', name: 'claude-worker', harness: 'claude-code', role: 'implementer' });
    hub.fakes['claude-code']!.waitingForApproval('claude-worker', 'touch reviewed');
    const row = (await request<Inbox>({ type: 'inbox.list' })).approvals.find(row => row.session === 'claude-worker')!;
    assert.equal(row.answerIn, 'tui');
    return row.id;
  });
  const context = async (title = 'Notice epic') => {
    const epic = (await request<{ item: { id: string } }>({ type: 'task.create', kind: 'epic', title })).item.id;
    const topic = (await request<{ topic: { id: string } }>({ type: 'topic.create', title: 'Notice topic', item: epic })).topic.id;
    await request({ type: 'visibility.set', surface: 'topics', target: topic, mode: 'pin' });
    return { epic, topic };
  };
  let nextInput = 100;
  const reply = async (card: TgMessage, text: string) => {
    const message_id = ++nextInput;
    const confirmed = fake.waitForPoll();
    const update = await control<{ update_id: number }>(fake.url, 'update', { message: {
      message_id, date: 1, chat: { id: 101, type: 'private' },
      from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text, reply_to_message: card,
    } });
    assert.equal((await driveTelegram(clock, state, within(confirmed, 1000))).params.offset, update.update_id + 1);
  };
  const plan = async (epic: string) => {
    const task = (await request<{ item: { id: string } }>({ type: 'task.create', size: 'S', title: 'Planned work', parent: epic })).item.id;
    return notice(async () => {
      await request({ type: 'task.plan', item: epic, op: 'set', yaml: JSON.stringify({
        stages: [{ name: 'Build', lanes: [[task]], qa: { scope: 'none', when: 'after-stage' } }],
      }) });
      return epic;
    });
  };
  return { owner, root, clock, fake, hub, store, state, ui, coord, request, messages, sentNotice, context, reply, plan, approval, start,
    release: (frame: HubFrame) => nativeRemote!.receive(frame) };
}

test('Telegram plan, review request, item message and Claude Code approval arrive once as button-free notices', async t => {
  const f = await fixture(t);
  const { epic, topic } = await f.context();
  const plan = await f.plan(epic);
  assert.match(plan.text!, new RegExp(`^📥.*${epic}.*Notice epic`));
  assert.match(plan.text!, /plans are approved in the workbench/i);
  const { card: review } = await f.sentNotice(topic, 'Review this plan', { kind: 'request', request: 'review', subject: epic });
  assert.match(review.text!, new RegExp(`^📥.*review.*coord.*${epic}`));
  const { card: message } = await f.sentNotice(topic, 'Please read this item report');
  assert.match(message.text!, new RegExp(`^📥.*coord.*${epic}`));
  assert.match(message.text!, /Please read this item report/);
  const approval = await f.approval();
  assert.match(approval.text!, /^📥.*claude-worker/);
  assert.match(approval.text!, /touch reviewed/);
  assert.match(approval.text!, /answer in.*terminal/i);
  // Another committed inbox change republishes all four rows: no duplicate sends.
  let republished: string | undefined;
  const drained = until(() => f.state.outbox().some(job => job.source === republished && job.state === 'sent')
    && f.state.outbox().every(job => job.state === 'sent' || job.state === 'dropped'),
    { timeoutMs: 1000, what: 'all republished inbox jobs settled' });
  void drained.catch(() => {});
  const asked = await f.coord.call<{ ok: boolean; ask: string }>('ask', { topic: 'general', question: 'Republish inbox?', options: ['Keep'] });
  assert.equal(asked.ok, true);
  republished = asked.ask;
  await f.clock.advance(250);
  await driveTelegram(f.clock, f.state, drained);
  await f.hub.stop();
  for (const card of [plan, review, message, approval]) {
    assert.equal(card.reply_markup, undefined);
    assert.ok(card.entities?.length);
    assert.equal((await f.messages()).filter(copy => copy.message_id === card.message_id).length, 1);
  }
  assert.equal((await f.messages()).filter(card => card.text?.startsWith('📥')).length, 4);
});

test('Telegram item notice reply keeps its topic and source via Telegram without following ordinary agent replies', async t => {
  const f = await fixture(t);
  const { topic } = await f.context();
  const { source, card: notice } = await f.sentNotice(topic, 'Item needs your attention');
  await f.reply(notice, 'Phone reply to item');
  const history = await f.request<{ messages: TopicMessage[] }>({ type: 'topic.history', topic });
  const reply = history.messages.find(message => message.text === 'Phone reply to item')!;
  assert.equal(reply.topic, topic);
  assert.equal(reply.replyTo, source);
  assert.equal(reply.via, 'telegram');
  assert.equal(reply.fromKind, 'human');
  assert.equal((await f.request<{ messages: TopicMessage[] }>({ type: 'topic.history', topic: 'general' })).messages.some(message => message.id === reply.id), false);
  let marker: string | undefined;
  const settled = until(() => f.state.outbox().some(job => job.source === marker && job.state === 'sent'),
    { timeoutMs: 1000, what: 'later General mirror accepted and mapped' });
  void settled.catch(() => {});
  assert.equal((await f.coord.call<{ ok: boolean }>('send', { topic, to: 'coordinator', text: 'Ordinary agent answer stays here' })).ok, true);
  assert.equal((await f.coord.call<{ ok: boolean }>('send', { topic: 'general', kind: 'progress', text: 'General mirror barrier' })).ok, true);
  marker = (await f.request<{ messages: TopicMessage[] }>({ type: 'topic.history', topic: 'general' })).messages.find(message => message.text === 'General mirror barrier')!.id;
  await f.clock.advance(250);
  await driveTelegram(f.clock, f.state, settled);
  await f.hub.stop();
  const messages = await f.messages();
  assert.equal(messages.filter(message => message.text?.startsWith('📥')).length, 1);
  assert.equal(messages.some(message => message.text?.includes('Ordinary agent answer')), false);
  assert.equal(messages.some(message => message.text?.includes('Phone reply to item')), false);
});

test('Telegram long item notice stays one clipped entities message with its full source retained', async t => {
  const f = await fixture(t);
  const { topic } = await f.context();
  const text = 'word 😀 '.repeat(600);
  const { source, card } = await f.sentNotice(topic, text);
  assert.ok([...card.text!].length <= 4096);
  assert.match(card.text!, /…\nfull message in the workbench$/);
  assert.equal(card.reply_markup, undefined);
  assert.equal(f.store.message(source)!.text, text);
  await f.hub.stop();
  assert.equal((await f.messages()).filter(message => message.text?.startsWith('📥')).length, 1);
});

for (const longOrigin of [false, true]) test(`Telegram oversized plan title${longOrigin ? ' and origin' : ''} keeps the complete notice and entity spans in bounds`, async t => {
  const origin = longOrigin ? `https://${'x'.repeat(5000)}.invalid` : undefined;
  const f = await fixture(t, origin);
  const title = 'Epic 😀 ' + 'x'.repeat(4993);
  assert.equal([...title].length, 5000);
  const { epic } = await f.context(title);
  const card = await f.plan(epic);
  assert.ok([...card.text!].length <= 4096, `complete notice has ${[...card.text!].length} code points`);
  assert.match(card.text!, new RegExp(`^📥 Plan ${epic} · Epic 😀 `));
  assert.match(card.text!, /…/);
  assert.match(card.text!, /Plans are approved in the workbench/);
  assert.equal(card.reply_markup, undefined);
  assert.equal(card.entities!.find(entity => entity.type === 'bold')!.length, card.text!.split('\n')[0]!.length);
  for (const entity of card.entities!) {
    assert.ok(entity.offset >= 0);
    assert.ok(entity.length > 0);
    assert.ok(entity.offset + entity.length <= card.text!.length);
  }
  if (origin) {
    const link = card.entities!.find(entity => entity.type === 'text_link' || entity.type === 'url')!;
    assert.equal(link.url ?? card.text!.slice(link.offset, link.offset + link.length), origin);
  }
  const source = await f.request<{ item: { title: string } }>({ type: 'task.view', item: epic });
  assert.equal(source.item.title, title);
  assert.equal(f.state.message('101', String(card.message_id))!.message, epic);
  await f.hub.stop();
  assert.equal((await f.messages()).filter(message => message.text?.startsWith('📥')).length, 1);
});

test('Telegram one backlog publication sends notices oldest first across sections with stable ties', async t => {
  let publication: Extract<HubFrame, { type: 'inbox' }> | undefined;
  const f = await fixture(t, undefined, frame => {
    if (frame.type !== 'inbox') return false;
    publication = frame;
    return true;
  });
  const { epic, topic } = await f.context();
  const historyId = async () => (await f.request<{ messages: TopicMessage[] }>({ type: 'topic.history', topic })).messages.at(-1)!.id;
  assert.equal((await f.coord.call<{ ok: boolean }>('send', { topic, kind: 'request', request: 'review', subject: epic, text: 'Oldest backlog request' })).ok, true);
  const request = await historyId();
  await f.clock.advance(1000);
  assert.equal((await f.coord.call<{ ok: boolean }>('send', { topic, text: 'Second backlog message' })).ok, true);
  const message = await historyId();
  await f.clock.advance(1000);
  const second = await f.context();
  assert.ok(epic.localeCompare(second.epic) < 0, 'setup gives tied plans increasing ids');
  for (const item of [epic, second.epic]) {
    const task = (await f.request<{ item: { id: string } }>({ type: 'task.create', size: 'S', title: 'Backlog work', parent: item })).item.id;
    await f.request({ type: 'task.plan', item, op: 'set', yaml: JSON.stringify({
      stages: [{ name: 'Build', lanes: [[task]], qa: { scope: 'none', when: 'after-stage' } }],
    }) });
  }
  await f.clock.advance(1000);
  await f.request({ type: 'session.launch', name: 'claude-worker', harness: 'claude-code', role: 'implementer' });
  const published = until(() => publication?.inbox.approvals.some(row => row.session === 'claude-worker') === true,
    { timeoutMs: 1000, what: 'held single inbox publication includes the last committed approval' });
  void published.catch(() => {});
  f.hub.fakes['claude-code']!.waitingForApproval('claude-worker', 'touch reviewed');
  await f.clock.advance(250);
  await published;
  assert.equal((await f.messages()).length, 0, 'all automatic inbox frames were held before native publishing');
  const inbox = publication!.inbox;
  const approval = inbox.approvals.find(row => row.session === 'claude-worker')!.id;
  assert.equal(inbox.plans.length, 2);
  assert.equal(inbox.plans[0]!.since, inbox.plans[1]!.since, 'both plans have the same retained wait timestamp');
  const accepted = until(() => f.state.outbox().filter(job => job.kind === 'card' && job.state === 'sent').length === 5,
    { timeoutMs: 1000, what: 'all five notices from one publication have durable send receipts' });
  void accepted.catch(() => {});
  // A previous hub can publish equal-time rows in either order. Reverse just
  // those two real rows at the public frame seam to prove deterministic ties.
  const batch = { ...publication!, inbox: { ...inbox, plans: [
    inbox.plans.find(row => row.id === second.epic)!, inbox.plans.find(row => row.id === epic)!,
  ] } };
  const receiving = Promise.resolve(f.release(batch));
  await driveTelegram(f.clock, f.state, Promise.all([accepted, receiving]));
  await f.hub.stop();
  const notices = await f.messages();
  assert.equal(notices.length, 5);
  assert.deepEqual(notices.map(card => f.state.message('101', String(card.message_id))!.message), [request, message, epic, second.epic, approval]);
  for (const card of notices) {
    assert.match(card.text!, /^📥/);
    assert.equal(card.reply_markup, undefined);
  }
});

test('Telegram plan notice reply goes to General with its reference and no epic-topic reply', async t => {
  const f = await fixture(t);
  const { epic, topic } = await f.context();
  const notice = await f.plan(epic);
  await f.reply(notice, 'Please revise stage one');
  const general = await f.request<{ messages: TopicMessage[] }>({ type: 'topic.history', topic: 'general' });
  const reply = general.messages.find(message => message.via === 'telegram')!;
  assert.equal(reply.text, `re plan ${epic}: Please revise stage one`);
  assert.equal(reply.topic, 'general');
  assert.equal(reply.replyTo, undefined);
  const itemTopic = await f.request<{ messages: TopicMessage[] }>({ type: 'topic.history', topic });
  assert.equal(itemTopic.messages.some(message => message.via === 'telegram'), false);
  assert.equal((await f.request<Inbox>({ type: 'inbox.list' })).plans[0]?.id, epic);
  await f.hub.stop();
});

for (const origin of [undefined, 'https://workbench.example.invalid']) test(`Telegram plan notice ${origin ? 'links only the configured origin' : 'has no link without a configured origin'}`, async t => {
  const f = await fixture(t, origin);
  const { epic, topic } = await f.context();
  const plan = await f.plan(epic);
  if (origin) {
    assert.ok(plan.text!.includes(origin), JSON.stringify(plan));
    assert.ok(plan.entities!.some(entity => entity.type === 'url' && plan.text!.slice(entity.offset, entity.offset + entity.length) === origin));
  } else assert.equal(/https?:\/\//.test(plan.text!), false);
  // A synthetic credential URL is sent through a real human-addressed row,
  // never minted by web.link. The gateway must scrub it before native output.
  const credential = 'https://workbench.example.invalid/auth?token=synthetic-not-a-credential';
  assert.ok(credential.includes('/auth?token='), 'positive control: fixture contains a credential-shaped URL');
  const { source, card: message } = await f.sentNotice(topic, `Read the plan ${credential}`);
  assert.match(message.text!, /\[redacted\]/);
  assert.ok(f.store.message(source)!.text.includes(credential), 'positive control: source row retains the synthetic URL');
  await f.hub.stop();
  for (const notice of [plan, message]) {
    const output = JSON.stringify(notice);
    assert.equal(output.includes('synthetic-not-a-credential'), false);
    assert.equal(output.includes('/auth'), false);
    assert.equal(output.includes('token='), false);
  }
  // Fake captures redact too: inspect the producer's durable native payload,
  // independently, so fake scrubbing cannot conceal a production leak.
  for (const job of f.state.outbox().filter(job => [epic, source].includes(job.source ?? ''))) {
    const native = JSON.stringify(job.payload);
    assert.equal(native.includes('synthetic-not-a-credential'), false);
    assert.equal(native.includes('/auth'), false);
    assert.equal(native.includes('token='), false);
  }
});

test('Telegram TUI approval notice reply goes to General with the session reference', async t => {
  const f = await fixture(t);
  const notice = await f.approval();
  await f.reply(notice, 'I will check the terminal');
  const history = await f.request<{ messages: TopicMessage[] }>({ type: 'topic.history', topic: 'general' });
  const reply = history.messages.find(message => message.via === 'telegram')!;
  assert.equal(reply.text, 're approval claude-worker: I will check the terminal');
  assert.equal(reply.replyTo, undefined);
  assert.equal((await f.request<Inbox>({ type: 'inbox.list' })).approvals[0]!.state, 'pending');
  assert.deepEqual(f.hub.fakes['claude-code']!.approvalAnswers, []);
  await f.hub.stop();
});

for (const request of ['qa', 'handover'] as const) test(`Telegram ${request} notice reply targets its real source in the item topic`, async t => {
  const f = await fixture(t);
  const { epic, topic } = await f.context();
  const { source, card: notice } = await f.sentNotice(topic, `Please do ${request}`, { kind: 'request', request, subject: epic });
  assert.match(notice.text!, new RegExp(`^📥 ${request} · coord · ${epic}`));
  assert.equal(notice.reply_markup, undefined);
  await f.reply(notice, 'I will do it');
  const history = await f.request<{ messages: TopicMessage[] }>({ type: 'topic.history', topic });
  const reply = history.messages.find(message => message.via === 'telegram')!;
  assert.equal(reply.replyTo, source);
  assert.equal(reply.topic, topic);
  await f.hub.stop();
});

test('Telegram notice reply replay after commit and lost result keeps one attributed item-topic message', async t => {
  const lost = Promise.withResolvers<void>();
  const text = 'One durable reply';
  const f = await fixture(t, undefined, frame => {
    if (frame.type === 'result' && frame.ok && (frame.value as { message?: TopicMessage }).message?.text === text) {
      lost.resolve(); return true;
    }
    return false;
  });
  const { topic } = await f.context();
  const { source, card: notice } = await f.sentNotice(topic, 'Reply to this notice');
  const update = await control<{ update_id: number }>(f.fake.url, 'update', { message: {
    message_id: 99, date: 1, chat: { id: 101, type: 'private' },
    from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text, reply_to_message: notice,
  } });
  await within(lost.promise, 1000);
  const before = (await f.request<{ messages: TopicMessage[] }>({ type: 'topic.history', topic })).messages.find(message => message.text === text)!;
  assert.ok(before);
  assert.equal(f.state.get(`telegram.update:${update.update_id}`), null);
  assert.equal(f.state.get(`telegram.inbound:${before.id}`), null);
  await f.hub.stop(); f.ui.close(); await f.coord.close();
  const confirmed = f.fake.waitForPoll();
  const hub = await f.start();
  assert.equal((await driveTelegram(f.clock, f.state, within(confirmed, 1000))).params.offset, update.update_id + 1);
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const result = await ui.request({ type: 'topic.history', topic });
  assert.equal(result.ok, true, result.error);
  const messages = (result.value as { messages: TopicMessage[] }).messages.filter(message => message.text === text);
  assert.equal(messages.length, 1);
  assert.equal(messages[0]!.id, before.id);
  assert.equal(messages[0]!.replyTo, source);
  assert.equal(messages[0]!.via, 'telegram');
  assert.equal(f.state.get(`telegram.update:${update.update_id}`), '1');
  await hub.stop();
  assert.equal((await f.messages()).filter(message => message.text?.startsWith('📥')).length, 1);
});
