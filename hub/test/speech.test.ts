// T2: native fetch against a loopback provider; no hub, process or account.
import './cover-quiet.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ElevenLabsProvider } from '../src/speech/elevenlabs.ts';
import { SpeechError } from '../src/speech/index.ts';
import { speechExchange } from './fakes/speech/exchange.ts';
import { fakeSpeech } from './fakes/speech/fake-api.ts';

const input = { audio: Buffer.from([79, 103, 103, 83, 0, 255]), mime: 'audio/ogg', filename: 'voice.ogg' };
const key = 'fictional-speech-key-for-tests';
test('OGG bytes and metadata reach ElevenLabs unchanged; rus becomes ru', async t => {
  const fake = await fakeSpeech(t);
  const provider = new ElevenLabsProvider({ key, env: { CLAND_ELEVENLABS_API_ROOT: fake.url } });
  assert.deepEqual(await fake.transcribe(provider, input), { text: 'Привет', language: 'ru' });
  assert.deepEqual(fake.requests, [{ method: 'POST', path: '/v1/speech-to-text', keyPresent: true,
    fields: { model_id: 'scribe_v2', tag_audio_events: 'false' },
    file: { bytes: input.audio, mime: 'audio/ogg', filename: 'voice.ogg' } }]);
});

test('permanent provider failures are classified and never retried; missing key makes no request', async t => {
  const cases = [
    [401, 'unauthorized', 'auth'], [403, 'forbidden', 'auth'], [400, 'invalid_audio', 'bad-audio'],
    [400, 'invalid_audio_format', 'bad-audio'], [400, 'invalid_file_type', 'bad-audio'], [400, 'audio_too_short', 'bad-audio'],
    [400, 'audio_too_long', 'too-long'], [400, 'request_too_large', 'too-long'], [413, '', 'too-long'],
    [402, '', 'quota'], [400, 'insufficient_credits', 'quota'],
  ] as const;
  const fake = await fakeSpeech(t, cases.map(([status, code]) => ({ status, body: { detail: { status: code, message: `failed ${key}` } } })));
  const provider = new ElevenLabsProvider({ key, env: { CLAND_ELEVENLABS_API_ROOT: fake.url } });
  let count = 0;
  for (const [, , kind] of cases) {
    await assert.rejects(fake.transcribe(provider, input), error => {
      assert.ok(error instanceof SpeechError); assert.equal(error.kind, kind); assert.ok(!error.message.includes(key)); return true;
    });
    assert.equal(fake.requests.length, ++count);
  }
  await assert.rejects(fake.transcribe(new ElevenLabsProvider({ env: { CLAND_ELEVENLABS_API_ROOT: fake.url } }), input), { kind: 'not-configured' });
  assert.equal(fake.requests.length, cases.length);
});

import { FakeClock } from './fake-clock.ts';
import type { ClockTimer } from '../src/hub/clock.ts';
import { setImmediate as yieldIO } from 'node:timers/promises';
class ObservedClock extends FakeClock {
  sleeps: number[] = [];
  override setTimeout(callback: () => void, ms: number): ClockTimer {
    this.sleeps.push(ms);
    return super.setTimeout(callback, ms);
  }
}
async function observed(predicate: () => boolean) {
  const until = performance.now() + 2_000;
  while (!predicate() && performance.now() < until) await yieldIO();
  assert.ok(predicate(), 'bounded expected receipt missing');
}

test('Retry-After waits two seconds; persistent transient failures stop after attempt three', async t => {
  for (const status of [429, 503]) {
    const fake = await fakeSpeech(t, [{ status, retryAfter: '2' }]);
    const clock = new ObservedClock();
    const result = assert.rejects(fake.transcribe(new ElevenLabsProvider({ key, env: { CLAND_ELEVENLABS_API_ROOT: fake.url } }), input,
      { clock, random: () => 0 }), { kind: status === 429 ? 'rate-limited' : 'unavailable' });
    for (let i = 1; i <= 2; i++) {
      await observed(() => clock.sleeps.filter(ms => ms === 2_000).length === i);
      await clock.advance(2_000);
    }
    await result;
    assert.equal(fake.requests.length, 3);
  }
  const fake = await fakeSpeech(t, [{ status: 429, retryAfter: '2' }, { body: { text: 'ok' } }]);
  const clock = new ObservedClock();
  const result = fake.transcribe(new ElevenLabsProvider({ key, env: { CLAND_ELEVENLABS_API_ROOT: fake.url } }), input, { clock });
  await observed(() => clock.sleeps.includes(2_000));
  await clock.advance(1_999);
  assert.equal(fake.requests.length, 1);
  await clock.advance(1);
  assert.deepEqual(await result, { text: 'ok' });
  assert.equal(fake.requests.length, 2);
});

test('slow response and Retry-After beyond the note deadline report timeout', async t => {
  for (const reply of [{ delayMs: 60_000 }, { status: 429, retryAfter: '120' }]) {
    const clock = new ObservedClock();
    const fake = await fakeSpeech(t, [reply]);
    const result = assert.rejects(fake.transcribe(new ElevenLabsProvider({ key, env: { CLAND_ELEVENLABS_API_ROOT: fake.url } }), input,
      { clock, deadlineMs: 500 }), { kind: 'timeout' });
    await observed(() => fake.requests.length === 1);
    await clock.advance(500);
    await result;
    assert.equal(fake.requests.length, 1);
    assert.equal(clock.pending, 0);
  }
});

test('redirects are never followed and API override admits only loopback HTTP with a port', async t => {
  const target = await fakeSpeech(t);
  const fake = await fakeSpeech(t, [{ status: 302, location: `${target.url}/v1/speech-to-text` }]);
  await assert.rejects(fake.run(signal => new ElevenLabsProvider({ key, env: { CLAND_ELEVENLABS_API_ROOT: fake.url } }).transcribe({ ...input, signal })), { kind: 'unavailable' });
  assert.equal(fake.requests.length, 1);
  assert.equal(target.requests.length, 0);
  for (const root of ['https://example.com', 'http://example.com:123', 'http://127.0.0.1', 'https://127.0.0.1:123', 'http://user:pass@127.0.0.1:123', 'http://127.0.0.1:123/path', 'http://127.0.0.1:123/?x=1']) {
    assert.throws(() => new ElevenLabsProvider({ key, env: { CLAND_ELEVENLABS_API_ROOT: root } }), /loopback/);
  }
});

test('every SpeechError kind redacts registered keys, including arbitrary provider errors', async t => {
  const fake = speechExchange(t);
  const redact = remoteRedactor([key, 'fictional-xai-test-key']);
  for (const kind of ['not-configured', 'auth', 'bad-audio', 'too-long', 'quota', 'rate-limited', 'unavailable', 'timeout', 'command-failed'] as const) {
    const error = new SpeechError(kind, `echo ${key} fictional-xai-test-key`, undefined, redact);
    assert.equal(error.message, 'echo [redacted] [redacted]');
    await assert.rejects(fake.transcribe({ name: 'test', async transcribe() { throw error; } }, input, { redact, deadlineMs: 1 }), err => {
      assert.ok(err instanceof SpeechError); assert.ok(!err.message.includes(key)); return true;
    });
  }
});
import { remoteRedactor } from '../src/remote/redact.ts';

import { normalizeLanguage } from '../src/speech/index.ts';
test('language codes, primary subtags and English names normalize to ISO 639-1', async t => {
  for (const [raw, normalized] of [['eng', 'en'], ['EN-us', 'en'], ['English', 'en'], ['rus', 'ru'], ['Russian', 'ru'], ['deu', 'de'], ['ger', 'de'], ['German', 'de'], ['fra', 'fr'], ['French', 'fr'], ['zho', 'zh'], ['Chinese', 'zh'], ['ukr', 'uk'], ['Ukrainian', 'uk'], ['unknown', undefined]] as const) {
    assert.equal(normalizeLanguage(raw), normalized);
  }
  const fake = await fakeSpeech(t);
  await fake.run(signal => new ElevenLabsProvider({ key, model: 'custom', env: { CLAND_ELEVENLABS_API_ROOT: fake.url } }).transcribe({ ...input, languageHint: 'ENG', signal }));
  assert.equal(fake.requests[0]?.fields.language_code, 'en');
  assert.equal(fake.requests[0]?.fields.model_id, 'custom');
});

test('legacy providers without a retry policy retain 30-second attempts, bounded retries and cancellation', async t => {
  const fake = speechExchange(t);
  const clock = new ObservedClock();
  const signals: AbortSignal[] = [];
  const provider = { name: 'held', transcribe: ({ signal }: { signal?: AbortSignal }) => {
    signals.push(signal!); return new Promise<never>(() => {});
  } };
  const result = assert.rejects(fake.transcribe(provider, input, { clock, random: () => 0 }), { kind: 'timeout' });
  await observed(() => signals.length === 1);
  await clock.advance(30_000);
  assert.equal(signals[0]?.aborted, true);
  await clock.advance(500);
  await observed(() => signals.length === 2);
  await clock.advance(30_000);
  await clock.advance(1_000);
  await observed(() => signals.length === 3);
  await clock.advance(28_500);
  await result;
  assert.equal(signals.length, 3);
  assert.ok(signals.every(signal => signal.aborted));
  assert.equal(clock.pending, 0);
  const controller = new AbortController();
  const cancelled = assert.rejects(fake.transcribe(provider, { ...input, signal: controller.signal }, { clock }), { kind: 'timeout' });
  await observed(() => signals.length === 4);
  controller.abort(new Error(key));
  await cancelled;
  assert.equal(signals.length, 4);
});

test('a provider result observed after the deadline is timeout even before timers run', async t => {
  const fake = speechExchange(t);
  const clock = new FakeClock();
  await assert.rejects(fake.transcribe({ name: 'blocking', async transcribe() {
    clock.block(90_001); return { text: 'late' };
  } }, input, { clock }), { kind: 'timeout' });
});

test('a result observed after the attempt bound is retried within the note deadline', async t => {
  const fake = speechExchange(t);
  const clock = new ObservedClock();
  let attempts = 0;
  const result = fake.transcribe({ name: 'blocking-attempt', async transcribe() {
    attempts++;
    if (attempts === 1) clock.block(30_001);
    return { text: attempts === 1 ? 'late attempt' : 'on time' };
  } }, input, { clock, random: () => 0 });
  // The injected scheduler is the retry receipt, before advancing its backoff.
  await observed(() => clock.sleeps.includes(500));
  await clock.advance(500);
  assert.deepEqual(await result, { text: 'on time' });
  assert.equal(attempts, 2);
  assert.equal(clock.pending, 0);
});

test('fixture cleanup cancels frozen retries before native close', async t => {
  const fake = await fakeSpeech(t, [{ status: 503, retryAfter: '2' }]);
  const clock = new ObservedClock();
  const result = assert.rejects(fake.transcribe(new ElevenLabsProvider({ key, env: { CLAND_ELEVENLABS_API_ROOT: fake.url } }), input, { clock }), { kind: 'timeout' });
  await observed(() => clock.sleeps.includes(2_000));
  await fake.close();
  await result;
  assert.equal(clock.pending, 0);
  assert.equal(fake.requests.length, 1);
});

test('fixture cleanup joins an in-flight native request with frozen behavior time', async t => {
  const fake = await fakeSpeech(t, [{ delayMs: 60_000 }]);
  const clock = new FakeClock();
  const result = assert.rejects(fake.transcribe(new ElevenLabsProvider({ key, env: { CLAND_ELEVENLABS_API_ROOT: fake.url } }), input, { clock }), { kind: 'timeout' });
  await observed(() => fake.requests.length === 1);
  await fake.close();
  await result;
  assert.equal(clock.pending, 0);
  assert.equal(fake.requests.length, 1);
});

test('fixture setup is bounded when listening is missing or setup is aborted', async t => {
  await assert.rejects(fakeSpeech(t, [], { timeoutMs: 25, listen() {} }), /fake speech setup incomplete/);
  const controller = new AbortController();
  let acquired = false;
  await assert.rejects(fakeSpeech(t, [], { signal: controller.signal, listen() { acquired = true; controller.abort(); } }), { name: 'AbortError' });
  assert.equal(acquired, true);
});
