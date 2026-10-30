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

for (const kind of ['audio', 'video_note', 'video', 'document'] as const) test(`Telegram ${kind} transcription admission preserves caption and bytes`, async t => {
  const f = await fixture(t);
  const speech = await fakeSpeech(t, [{ body: { text: 'heard recording' } }]);
  f.owner.close(() => speech.close());
  setSecret(f.root, 'speech.elevenlabs_key', 'fictional-speech-key');
  const bytes = Buffer.from('original recording');
  const name = kind === 'video_note' ? 'video-note-1.mp4' : 'recording.mp3';
  const mime = kind === 'video_note' ? 'video/mp4' : 'audio/mpeg';
  await control(f.fake.url, 'media', { items: [{ kind, duration: 600, caption: 'sender caption',
    ...(kind === 'video_note' ? {} : { file_name: name, mime_type: mime }), content: bytes.toString('base64') }] });
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url });
  const ui = await connectUi(t, hub.discovery);
  const transcribed = kind === 'audio' || kind === 'video_note';
  await f.drive(until(() => f.state.get('media.identity:101:1') === 'completed' && (!transcribed || f.state.get('media.voice-outcome:101:1') === 'sent'), { what: 'media admission completed', timeoutMs: 2_000 }));
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.deepEqual(messages.map(m => m.text), [transcribed ? '🎤 heard recording\nsender caption' : 'sender caption']);
  assert.equal(messages[0]!.artifacts![0]!.title, name);
  assert.deepEqual(await readFile(messages[0]!.artifacts![0]!.path), bytes);
  assert.equal(speech.requests.length, transcribed ? 1 : 0);
  if (transcribed) assert.deepEqual(speech.requests[0]!.file, { bytes, mime, filename: name });
  await speech.close(); await f.clean(ui, hub);
});

for (const cap of ['duration', 'size'] as const) test(`Telegram voice refuses declared ${cap} before getFile`, async t => {
  const f = await fixture(t);
  const speech = await fakeSpeech(t);
  f.owner.close(() => speech.close());
  setSecret(f.root, 'speech.elevenlabs_key', 'fictional-speech-key');
  await control(f.fake.url, 'media', { items: [{ kind: 'voice', duration: cap === 'duration' ? 660 : 1,
    ...(cap === 'size' ? { file_size: 21 * 1024 * 1024 } : { content: Buffer.from('too much').toString('base64') }) }] });
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url });
  const ui = await connectUi(t, hub.discovery);
  await f.drive(until(() => f.state.get('media.identity:101:1') === 'completed', { what: 'refused media completed', timeoutMs: 2_000 }));
  const native = await control<{ messages: TgMessage[]; requests: Array<{ method: string }> }>(f.fake.url, 'state');
  assert.equal(native.messages.length, 1);
  if (cap === 'duration') assert.equal(native.messages[0]!.text, '🎤 a 11:00 note is over the 10-minute limit; it was not stored');
  else assert.match(native.messages[0]!.text!, /21 MB.*at most 20 MB.*not stored/);
  assert.equal(native.requests.filter(r => r.method === 'getFile').length, 0);
  assert.equal(speech.requests.length, 0);
  assert.deepEqual(((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages, []);
  await speech.close(); await f.clean(ui, hub);
});

for (const outcome of ['retry', 'unavailable', 'timeout'] as const) test(`Telegram voice ${outcome} retains the whole-note speech bounds`, async t => {
  const f = await fixture(t);
  const speech = await fakeSpeech(t, outcome === 'timeout' ? [{ delayMs: 120_000 }]
    : outcome === 'retry' ? [{ status: 429, retryAfter: '0' }, { body: { text: 'retried transcript' } }]
      : [{ status: 503, retryAfter: '0' }]);
  f.owner.close(() => speech.close());
  const sleeps: number[] = [];
  const schedule = f.clock.setTimeout.bind(f.clock);
  f.clock.setTimeout = (fn, ms) => { sleeps.push(ms); return schedule(fn, ms); };
  setSecret(f.root, 'speech.elevenlabs_key', 'fictional-speech-key');
  await control(f.fake.url, 'media', { items: [{ kind: 'voice', duration: 42, content: Buffer.from('retry audio').toString('base64') }] });
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url });
  const ui = await connectUi(t, hub.discovery);
  await until(() => speech.requests.length === 1, { what: 'first native speech request', timeoutMs: 2_000 });
  if (outcome === 'timeout') await f.clock.advance(90_000);
  else for (let retry = 1; retry <= (outcome === 'retry' ? 1 : 2); retry++) {
    await until(() => sleeps.filter(ms => ms === 0).length === retry, { what: 'Retry-After scheduled after native error', timeoutMs: 2_000 });
    await f.clock.advance(1);
    await until(() => speech.requests.length === retry + 1, { what: 'native retry received', timeoutMs: 2_000 });
  }
  await f.drive(until(() => f.state.get('media.identity:101:1') === 'completed' && f.state.get('media.voice-outcome:101:1') === 'sent', { what: 'retry outcome stored and echoed', timeoutMs: 2_000 }));
  const expected = outcome === 'retry' ? '🎤 retried transcript' : `🎤 not transcribed: ${outcome}`;
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.deepEqual(messages.map(m => m.text), [expected]);
  assert.equal(messages[0]!.artifacts!.length, 1);
  assert.equal(speech.requests.length, outcome === 'retry' ? 2 : 3);
  const native = await control<{ messages: TgMessage[] }>(f.fake.url, 'state');
  assert.equal(native.messages.length, 1); assert.ok(native.messages[0]!.text!.startsWith(expected));
  await speech.close(); await f.clean(ui, hub);
});

for (const kind of ['audio', 'video_note'] as const) test(`Telegram ${kind} over the live duration cap stays a plain attachment`, async t => {
  const f = await fixture(t);
  const speech = await fakeSpeech(t);
  f.owner.close(() => speech.close());
  setSecret(f.root, 'speech.elevenlabs_key', 'fictional-speech-key');
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url });
  const ui = await connectUi(t, hub.discovery);
  const configPath = join(f.root, '.cland/config.toml');
  await writeFile(configPath, (await readFile(configPath, 'utf8')).replace('max_seconds = 600', 'max_seconds = 30'));
  const reloaded = await ui.request({ type: 'hub.reload' }); assert.equal(reloaded.ok, true, reloaded.error);
  await control(f.fake.url, 'media', { items: [{ kind, duration: 31, caption: 'over cap', content: Buffer.from('long recording').toString('base64') }] });
  await f.drive(until(() => f.state.get('media.identity:101:1') === 'completed', { what: 'over-cap attachment completed after reload', timeoutMs: 2_000 }));
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.deepEqual(messages.map(m => m.text), ['over cap']);
  assert.equal(messages[0]!.artifacts!.length, 1);
  assert.equal(speech.requests.length, 0);
  await speech.close(); await f.clean(ui, hub);
});


test('Telegram two-audio album transcribes both original files in labelled album order', async t => {
  const f = await fixture(t);
  const speech = await fakeSpeech(t, [{ body: { text: 'first track' } }, { body: { text: 'second track' } }]);
  f.owner.close(() => speech.close());
  setSecret(f.root, 'speech.elevenlabs_key', 'fictional-speech-key');
  await control(f.fake.url, 'media', { items: [1, 2].map(n => ({ kind: 'audio', media_group_id: 'audio-album', duration: 10,
    caption: n === 1 ? 'album caption' : '', file_name: `track-${n}.mp3`, mime_type: 'audio/mpeg', content: Buffer.from(`track ${n}`).toString('base64') })) });
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url });
  const ui = await connectUi(t, hub.discovery);
  await until(() => f.state.get('telegram.offset') === '3', { what: 'both album items durably received', timeoutMs: 2_000 });
  await f.clock.advance(2_000);
  await f.drive(until(() => f.state.get('media.identity:101:1') === 'completed' && f.state.get('media.identity:101:2') === 'completed', { what: 'whole audio album completed', timeoutMs: 2_000 }));
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.deepEqual(messages.map(m => m.text), ['🎤 track-1.mp3\nfirst track\n\n🎤 track-2.mp3\nsecond track\n\nalbum caption']);
  assert.deepEqual(messages[0]!.artifacts!.map(a => a.title), ['track-1.mp3', 'track-2.mp3']);
  assert.deepEqual(await Promise.all(messages[0]!.artifacts!.map(a => readFile(a.path))), [Buffer.from('track 1'), Buffer.from('track 2')]);
  assert.deepEqual(speech.requests.map(r => r.file), [1, 2].map(n => ({ bytes: Buffer.from(`track ${n}`), mime: 'audio/mpeg', filename: `track-${n}.mp3` })));
  await speech.close(); await f.clean(ui, hub);
});

test('Telegram audio album keeps transcribing after one file fails', async t => {
  const f = await fixture(t);
  const speech = await fakeSpeech(t, [{ status: 402 }, { body: { text: 'second track' } }]);
  f.owner.close(() => speech.close());
  setSecret(f.root, 'speech.elevenlabs_key', 'fictional-speech-key');
  await control(f.fake.url, 'media', { items: [1, 2].map(n => ({ kind: 'audio', media_group_id: 'audio-album', duration: 10,
    caption: n === 1 ? 'album caption' : '', file_name: `track-${n}.mp3`, mime_type: 'audio/mpeg', content: Buffer.from(`track ${n}`).toString('base64') })) });
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url });
  const ui = await connectUi(t, hub.discovery);
  await until(() => f.state.get('telegram.offset') === '3', { what: 'both album items durably received', timeoutMs: 2_000 });
  await f.clock.advance(2_000);
  await f.drive(until(() => f.state.get('media.identity:101:1') === 'completed' && f.state.get('media.identity:101:2') === 'completed', { what: 'whole audio album completed', timeoutMs: 2_000 }));
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.deepEqual(messages.map(m => m.text), ['🎤 track-1.mp3: transcription failed (quota)\n\n🎤 track-2.mp3\nsecond track\n\nalbum caption']);
  assert.deepEqual(messages[0]!.artifacts!.map(a => a.title), ['track-1.mp3', 'track-2.mp3']);
  assert.deepEqual(await Promise.all(messages[0]!.artifacts!.map(a => readFile(a.path))), [Buffer.from('track 1'), Buffer.from('track 2')]);
  assert.deepEqual(speech.requests.map(r => r.file), [1, 2].map(n => ({ bytes: Buffer.from(`track ${n}`), mime: 'audio/mpeg', filename: `track-${n}.mp3` })));
  await speech.close(); await f.clean(ui, hub);
});
