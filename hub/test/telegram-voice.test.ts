// T2: Telegram voice through production frames and loopback fake platforms.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { connectUi, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { control } from './telegram-polling-fixture.ts';
import type { TopicMessage } from '../src/protocol.ts';
import type { TgMessage } from '../src/remote/telegram-api.ts';
import { voiceFixture as fixture } from './telegram-voice-fixture.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { fakeSpeech } from './fakes/speech/fake-api.ts';

test('Telegram voice keeps exact audio and echoes its transcript once', async t => {
  const f = await fixture(t);
  const speech = await fakeSpeech(t, [{ body: { text: 'привет, это тест' } }]);
  f.owner.close(() => speech.close());
  setSecret(f.root, 'speech.elevenlabs_key', 'fictional-speech-key');
  const bytes = Buffer.from([79, 103, 103, 83, 0, 255]);
  const updates = await control<import('../src/remote/telegram-api.ts').TgUpdate[]>(f.fake.url, 'media', { items: [{ kind: 'voice', duration: 42, content: bytes.toString('base64') }] });
  await control(f.fake.url, 'update', { message: updates[0]!.message });
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url, ELEVENLABS_API_KEY: 'fictional-speech-key' });
  const ui = await connectUi(t, hub.discovery);
  await f.drive(until(() => f.state.get('media.identity:101:1') === 'completed' && f.state.get('media.voice-outcome:101:1') === 'sent' && f.state.get('telegram.offset') === '3', { what: 'voice completion and duplicate confirmed', timeoutMs: 2_000 }));
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] };
  assert.equal(history.messages.length, 1);
  const message = history.messages[0]!;
  assert.equal(message.text, '🎤 привет, это тест');
  assert.equal(message.from, 'human'); assert.equal(message.via, 'telegram');
  assert.equal(message.artifacts!.length, 1);
  assert.equal(message.artifacts![0]!.title, 'voice-1.ogg');
  assert.deepEqual(await readFile(message.artifacts![0]!.path), bytes);
  assert.equal(speech.requests.length, 1);
  assert.deepEqual(speech.requests[0]!.file, { bytes, mime: 'audio/ogg', filename: 'voice-1.ogg' });
  const native = await control<{ messages: TgMessage[]; requests: Array<{ method: string; params: Record<string, unknown> }> }>(f.fake.url, 'state');
  assert.equal(native.messages.length, 1);
  assert.match(native.messages[0]!.text!, /^🎤 привет, это тест\n0:42 · download [0-9.]+ s · transcription [0-9.]+ s · elevenlabs$/);
  assert.deepEqual(native.requests.find(r => r.method === 'sendMessage')!.params.reply_parameters, { message_id: 1 });
  await speech.close();
  await f.clean(ui, hub);
});

for (const outcome of ['missing', 'off', 'quota', 'empty'] as const) test(`Telegram voice ${outcome} keeps audio with one chat line`, async t => {
  const f = await fixture(t);
  const speech = await fakeSpeech(t, [outcome === 'quota' ? { status: 402 } : { body: { text: '' } }]);
  f.owner.close(() => speech.close());
  if (outcome === 'off') {
    const config = defaultConfig('Voice off'); config.remote.telegram.enabled = true; config.speech.provider = '';
    await writeFile(join(f.root, '.cland/config.toml'), renderConfig(config));
  }
  if (outcome !== 'missing' && outcome !== 'off') setSecret(f.root, 'speech.elevenlabs_key', 'fictional-speech-key');
  const bytes = Buffer.from('fake OGG audio');
  await control(f.fake.url, 'media', { items: [{ kind: 'voice', content: bytes.toString('base64') }] });
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url,
    ELEVENLABS_API_KEY: outcome === 'missing' ? '' : 'fictional-speech-key' });
  const ui = await connectUi(t, hub.discovery);
  await f.drive(until(() => f.state.get('media.identity:101:1') === 'completed' && f.state.get('media.voice-outcome:101:1') === 'sent', { what: 'voice outcome committed', timeoutMs: 2_000 }));
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.equal(messages.length, 1);
  assert.equal(messages[0]!.text, outcome === 'quota' ? '🎤 not transcribed: quota' : outcome === 'empty' ? '🎤 nothing recognised' : '🎤 not transcribed');
  assert.deepEqual(await readFile(messages[0]!.artifacts![0]!.path), bytes);
  const native = await control<{ messages: TgMessage[] }>(f.fake.url, 'state');
  assert.equal(native.messages.length, 1);
  assert.match(native.messages[0]!.text!, outcome === 'missing' ? /cland secret set speech.elevenlabs_key/ : outcome === 'off' ? /Transcription is off/ : outcome === 'quota' ? /quota/ : /nothing recognised/);
  assert.equal(speech.requests.length, outcome === 'missing' || outcome === 'off' ? 0 : 1);
  await speech.close(); await f.clean(ui, hub);
});

test('Telegram long voice echo retains the whole transcript in bounded native parts', async t => {
  const f = await fixture(t);
  const transcript = 'a'.repeat(5000) + '🦊'.repeat(500);
  const speech = await fakeSpeech(t, [{ body: { text: transcript } }]);
  f.owner.close(() => speech.close());
  setSecret(f.root, 'speech.elevenlabs_key', 'fictional-speech-key');
  await control(f.fake.url, 'media', { items: [{ kind: 'voice', duration: 42, content: Buffer.from('long audio').toString('base64') }] });
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url });
  const ui = await connectUi(t, hub.discovery);
  await f.drive(until(() => f.state.get('media.identity:101:1') === 'completed' && f.state.get('media.voice-outcome:101:1') === 'sent', { what: 'long voice committed', timeoutMs: 2_000 }));
  const native = await control<{ messages: TgMessage[] }>(f.fake.url, 'state');
  assert.ok(native.messages.length > 1, 'long echo is split');
  assert.ok(native.messages.every(m => [...m.text!].length <= 4096));
  assert.equal(native.messages.map(m => m.text!.replace(/^🎤 · \d+\/\d+\n/, '')).join(''), transcript + '\n0:42 · download 0.0 s · transcription 0.0 s · elevenlabs');
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.deepEqual(messages.map(m => m.text), [`🎤 ${transcript}`]);
  assert.equal(messages[0]!.artifacts!.length, 1); assert.equal(speech.requests.length, 1);
  await speech.close(); await f.clean(ui, hub);
});

test('Telegram unknown voice echo cannot hold later input across restart', async t => {
  const f = await fixture(t);
  const speech = await fakeSpeech(t, [{ body: { text: 'committed voice' } }]);
  f.owner.close(() => speech.close());
  setSecret(f.root, 'speech.elevenlabs_key', 'fictional-speech-key');
  const held = f.owner.observe(signal => f.fake.waitForHeldRequest('sendMessage', signal));
  await control(f.fake.url, 'fault', { method: 'sendMessage', code: 500, response: 'hold-after-send' });
  await control(f.fake.url, 'media', { items: [{ kind: 'voice', content: Buffer.from('held audio').toString('base64') }] });
  const first = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url });
  const ui = await connectUi(t, first.discovery);
  const accepted = await f.drive(held);
  await control(f.fake.url, 'say', { text: 'after held echo' });
  await until(async () => ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages.some(m => m.text === 'after held echo'), { what: 'later input commits while echo receipt held', timeoutMs: 2_000 });
  const closed = f.owner.observe(signal => f.fake.waitForConnectionClose('sendMessage', signal), { drain: true });
  await first.stop(); assert.equal((await closed).id, accepted.id);
  const second = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url });
  const resumed = await connectUi(t, second.discovery);
  await control(f.fake.url, 'say', { text: 'after restart' });
  await f.drive(until(() => f.state.get('media.identity:101:1') === 'completed' && f.state.get('media.voice-outcome:101:1') === 'incomplete', { what: 'committed voice completed after unknown echo', timeoutMs: 2_000 }));
  await until(async () => ((await resumed.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages.some(m => m.text === 'after restart'), { what: 'post-restart text committed', timeoutMs: 2_000 });
  const messages = ((await resumed.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.deepEqual(messages.map(m => m.text), ['🎤 committed voice', 'after held echo', 'after restart']);
  assert.equal(speech.requests.length, 1);
  const native = await control<{ messages: TgMessage[] }>(f.fake.url, 'state');
  assert.deepEqual(native.messages.map(m => m.text!.split('\n')[0]), ['🎤 committed voice']);
  await speech.close(); await f.clean(resumed, second);
});
