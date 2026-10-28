// T2: production frames, native Telegram cards and loopback speech.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { connectUi, inProcessSpoke, until } from './harness.ts';
import { voiceFixture } from './telegram-voice-fixture.ts';
import { control } from './telegram-polling-fixture.ts';
import { fakeSpeech } from './fakes/speech/fake-api.ts';
import { setSecret } from '../src/remote/secrets.ts';
import type { TgMessage, TgUpdate } from '../src/remote/telegram-api.ts';
import type { TopicMessage } from '../src/protocol.ts';

for (const mode of ['free', 'other', 'decline', 'option', 'failed', 'empty', 'unmatched', 'number', 'late'] as const) test(`Telegram voice ${mode} routes the transcript and preserves the audio policy`, async t => {
  const f = await voiceFixture(t);
  const transcript = mode === 'number' ? '2.' : mode === 'option' ? 'Second.' : mode === 'empty' ? '' : 'Ship the release';
  const cannotAnswer = ['failed', 'empty', 'unmatched', 'late'].includes(mode);
  const speech = await fakeSpeech(t, [mode === 'failed' ? { status: 402 } : { body: { text: transcript } }]);
  f.owner.close(() => speech.close());
  setSecret(f.root, 'speech.elevenlabs_key', 'fictional-speech-key');
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url });
  const ui = await connectUi(t, hub.discovery);
  const coord = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const native = async () => (await control<{ messages: TgMessage[] }>(f.fake.url, 'state')).messages;
  let id = '';
  const mapped = f.owner.observe(async () => until(async () => (await native()).some(m => f.state.message('101', String(m.message_id))?.ask === id), { what: 'mapped card', timeoutMs: 2000 }));
  const ask = await coord.call<{ ask: string }>('ask', { topic: 'general', question: 'Release?', options: ['first', 'second'], free: !['option', 'number', 'unmatched'].includes(mode) });
  id = ask.ask;
  await f.clock.advance(250); await f.drive(mapped);
  const card = (await native()).find(m => f.state.message('101', String(m.message_id))?.ask === id)!;
  if (mode === 'other' || mode === 'decline') {
    const prompt = f.owner.observe(async () => until(async () => (await native()).some(m => (m.reply_markup as { force_reply?: boolean })?.force_reply), { what: 'accepted voice answer prompt', timeoutMs: 2000 }));
    await control(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: mode === 'other' ? 2 : 3, column: 0 });
    await f.drive(prompt);
  }
  if (mode === 'late') {
    const offline = f.owner.observe(async () => until(() => !!f.state.get('telegram.outage'), { what: 'late voice outage recorded', timeoutMs: 2000 }));
    await control(f.fake.url, 'fault', { method: 'getUpdates', code: 503, retry_after: 10 });
    await control(f.fake.url, 'release-polls', {}); await offline;
  }
  let messageId = 0;
  const completed = f.owner.observe(async () => until(() => f.state.get('media.voice-outcome:101:' + messageId) === 'sent', { what: 'voice answered and echo settled', timeoutMs: 2000 }));
  const updates = await control<TgUpdate[]>(f.fake.url, 'media', { items: [{ kind: 'voice', ...(mode === 'late' ? { date: Math.floor(f.clock.now().getTime() / 1000) } : {}), ...(mode === 'other' || mode === 'decline' ? {} : { reply_to_message: card }), content: Buffer.from('answer audio').toString('base64') }] });
  messageId = updates[0]!.message!.message_id;
  if (mode === 'late') await f.clock.advance(10000);
  await f.drive(completed);
  const outcome = f.store.ask(id)!.outcome!;
  if (cannotAnswer) {
    assert.equal(outcome, undefined);
    const rows = await native();
    assert.deepEqual(rows.find(m => m.message_id === card.message_id)!.reply_markup, card.reply_markup);
    assert.equal(rows.filter(m => m.message_id !== card.message_id).length, 1);
    assert.match(rows.find(m => m.message_id !== card.message_id)!.text!, mode === 'failed' ? /not transcribed: quota/ : mode === 'empty' ? /nothing recognised/ : mode === 'late' ? /Ship the release/ : /option number/);
    const history = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
    const voice = history.filter(m => m.text.startsWith('🎤'));
    assert.equal(voice.length, 1); assert.equal(voice[0]!.artifacts!.length, 1);
    assert.equal(voice[0]!.text, mode === 'failed' ? '🎤 not transcribed: quota' : mode === 'empty' ? '🎤 nothing recognised' : '🎤 Ship the release');
    assert.equal((await readFile(voice[0]!.artifacts![0]!.path)).toString(), 'answer audio');
    assert.equal(history.some(m => m.answerTo === id), false);
    await speech.close(); await f.clean(ui, hub); return;
  }
  assert.equal(outcome?.status, mode === 'decline' ? 'declined' : 'answered');
  if (outcome.status === 'declined') assert.equal(outcome.reason, transcript);
  else { assert.equal(outcome.status, 'answered'); if (outcome.status !== 'answered') throw new Error('answer missing');
    assert.equal(outcome.text, ['option', 'number'].includes(mode) ? 'second' : transcript);
    if (['option', 'number'].includes(mode)) assert.equal(outcome.option, 2);
  }
  assert.equal(outcome.via, 'telegram');
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.equal(messages.filter(m => m.text.startsWith('🎤')).length, 0);
  assert.equal(messages.filter(m => m.answerTo === id).length, 1);
  assert.deepEqual((await ui.request({ type: 'artifact.list' })).value, { artifacts: [] });
  await f.drive(until(async () => (await native()).some(m => m.message_id === card.message_id && m.text?.includes('human via Telegram')), { what: 'card outcome edit', timeoutMs: 2000 }));
  const rows = await native();
  assert.deepEqual(rows.find(m => m.message_id === card.message_id)!.reply_markup, { inline_keyboard: [] });
  assert.match(rows.find(m => m.reply_to_message?.message_id === messageId)!.text!, /[\s\S]*answered/);
  await speech.close(); await f.clean(ui, hub);
});

for (const waiting of [true, false]) test(`Telegram queued voice preserves ${waiting ? 'its original prompt' : 'absence of a prompt'} at admission`, async t => {
  const f = await voiceFixture(t);
  const speech = await fakeSpeech(t, [{ body: { text: 'Original answer' } }]);
  f.owner.close(() => speech.close()); setSecret(f.root, 'speech.elevenlabs_key', 'fictional-speech-key');
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url });
  const ui = await connectUi(t, hub.discovery);
  const coord = await inProcessSpoke(t, { cwd: f.root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  const native = async () => (await control<{ messages: TgMessage[] }>(f.fake.url, 'state')).messages;
  const ask = async (question: string) => {
    let id = '';
    const mapped = f.owner.observe(async () => until(async () => (await native()).some(m => f.state.message('101', String(m.message_id))?.ask === id), { what: 'mapped FIFO ask card', timeoutMs: 2000 }));
    id = (await coord.call<{ ask: string }>('ask', { topic: 'general', question, options: ['yes'], free: true })).ask;
    await f.clock.advance(250); await f.drive(mapped);
    return { id, card: (await native()).find(m => f.state.message('101', String(m.message_id))?.ask === id)! };
  };
  const prompt = async (card: TgMessage) => {
    const published = f.owner.observe(async () => until(async () => (await native()).some(m => m.reply_to_message?.message_id === card.message_id && (m.reply_markup as { force_reply?: boolean })?.force_reply), { what: 'new FIFO prompt published', timeoutMs: 2000 }));
    await control(f.fake.url, 'press', { chat_id: 101, message_id: card.message_id, row: 1, column: 0 }); await f.drive(published);
  };
  const a = await ask('Original prompt'); const b = await ask('Later prompt');
  if (waiting) await prompt(a.card);
  const held = f.owner.observe(signal => f.fake.waitForHeldRequest('getFile', signal));
  await control(f.fake.url, 'fault', { method: 'getFile', code: 500, response: 'hold' });
  await control(f.fake.url, 'media', { items: [{ kind: 'document', content: Buffer.from('preceding file').toString('base64') }] });
  const request = await f.drive(held);
  let messageId = 0;
  const admitted = f.owner.observe(async () => until(() => f.state.get(`media.identity:101:${messageId}`) === 'stored', { what: 'voice durably admitted behind held file', timeoutMs: 2000 }));
  messageId = (await control<TgUpdate[]>(f.fake.url, 'media', { items: [{ kind: 'voice', content: Buffer.from('queued voice').toString('base64') }] }))[0]!.message!.message_id;
  await f.drive(admitted);
  await prompt(b.card);
  const wait = f.state.get('telegram.prompt-wait:101');
  const completed = f.owner.observe(async () => until(() => f.state.get(`media.identity:101:${messageId}`) === 'completed' && f.state.get(`media.voice-outcome:101:${messageId}`) === 'sent', { what: 'queued voice and echo completed', timeoutMs: 2000 }));
  await control(f.fake.url, 'release-requests', { ids: [request.id] }); await f.drive(completed);
  assert.equal(f.store.ask(b.id)!.state, 'open');
  assert.equal(f.state.get('telegram.prompt-wait:101'), wait);
  if (waiting) {
    const outcome = f.store.ask(a.id)!.outcome!; assert.equal(outcome.status, 'answered');
    if (outcome.status === 'answered') assert.equal(outcome.text, 'Original answer');
  } else assert.equal(f.store.ask(a.id)!.state, 'open');
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.equal(messages.filter(m => m.text === '🎤 Original answer').length, waiting ? 0 : 1);
  assert.equal(speech.requests.length, 1);
  await speech.close(); await f.clean(ui, hub);
});
