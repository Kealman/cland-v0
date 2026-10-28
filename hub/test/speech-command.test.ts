// T3: native speech-command exit, signals, process-tree cancellation and reaping in disposable roots.
import './cover-quiet.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { commandFixture as fixture } from './fakes/speech/command.ts';
import { CommandProvider } from '../src/speech/command.ts';

const input = { audio: Buffer.from([79, 103, 103, 83, 0, 255]), mime: 'audio/ogg', filename: 'voice.ogg' };

test('command receives original bytes and literal argv and returns trimmed UTF-8 text', async t => {
  const f = await fixture(t, `const parts=[]; process.stdin.on('data', b=>parts.push(b)); process.stdin.on('end',()=>process.stdout.write('  '+JSON.stringify({bytes:[...Buffer.concat(parts)], arg:process.argv[2]})+' Привет  '));`);
  const arg = 'spaces and $(echo injected)';
  const result = await f.run(new CommandProvider({ argv: [process.execPath, f.script, arg], env: f.env, cwd: f.root }));
  assert.equal(result.text, JSON.stringify({ bytes: [...input.audio], arg }) + ' Привет');
});

test('command environment excludes synthetic remote credentials and includes MIME and language', async t => {
  const f = await fixture(t, `process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write(JSON.stringify({names:Object.keys(process.env), mime:process.env.CLAND_SPEECH_MIME, language:process.env.CLAND_SPEECH_LANGUAGE})));`);
  const poison = { CLAND_TELEGRAM_TOKEN: 'fictional-bot', CLAND_DISCORD_TOKEN: 'fictional-discord', ELEVENLABS_API_KEY: 'fictional-eleven', XAI_API_KEY: 'fictional-xai', DIGITALOCEAN_TOKEN: 'fictional-do' };
  // Deliberate synthetic inputs to the production subject after fixture sealing.
  const result = JSON.parse((await f.run(new CommandProvider({ argv: [process.execPath, f.script], env: { ...f.env, ...poison }, cwd: f.root }))).text);
  for (const name of Object.keys(poison)) assert.ok(!result.names.includes(name));
  assert.equal(result.mime, 'audio/ogg'); assert.equal(result.language, '');
});

test('nonzero exit reports bounded redacted stderr; missing command is not-configured', async t => {
  const key = 'fictional-command-key';
  const f = await fixture(t, `process.stdin.resume(); process.stdin.on('end',()=>{process.stderr.write('x'.repeat(4000)+'fictional-command-key tail'); process.exitCode=3;});`);
  await assert.rejects(f.run(new CommandProvider({ argv: [process.execPath, f.script], env: f.env, cwd: f.root, redact: remoteRedactor([key]) })), error => {
    assert.ok(error instanceof SpeechError); assert.equal(error.kind, 'command-failed');
    assert.ok(!error.message.includes(key)); assert.ok(error.message.includes('[redacted] tail')); assert.ok(Buffer.byteLength(error.message) <= 2048); return true;
  });
  for (const argv of [[], [join(f.root, 'absent')]]) await assert.rejects(f.run(new CommandProvider({ argv, env: f.env, cwd: f.root })), { kind: 'not-configured' });
});
import { remoteRedactor } from '../src/remote/redact.ts';
import { SpeechError, transcribeNote } from '../src/speech/index.ts';

import { FakeClock } from './fake-clock.ts';
test('command gets the whole note deadline, escalates SIGTERM to SIGKILL and is never retried', async t => {
  const f = await fixture(t, `const fs=require('node:fs'); process.on('SIGTERM',()=>{}); fs.writeFileSync('ready',String(process.pid)); setInterval(()=>{},1000);`);
  const clock = new FakeClock();
  const ready = f.receipt('ready');
  const result = assert.rejects(f.run(new CommandProvider({ argv: [process.execPath, f.script], env: f.env, cwd: f.root }), { clock }), { kind: 'timeout' });
  const pid = await ready;
  await clock.advance(30_000);
  assert.doesNotThrow(() => process.kill(pid, 0));
  await clock.advance(60_000);
  await result;
  assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
  assert.equal(clock.pending, 0);
});

import { speechProvider, SPEECH_DATA_USE } from '../src/speech/provider.ts';
import { resolveCommand } from '../src/speech/command.ts';
import { defaultConfig } from '../src/init/config.ts';
test('provider selection distinguishes off and not-configured; command resolution checks executables', async t => {
  const f = await fixture(t, `process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('selected'));`);
  const settings = defaultConfig('speech-test').speech;
  assert.equal(speechProvider({ ...settings, provider: '' }, {}, { env: f.env }), null);
  const missing = speechProvider(settings, {}, { env: f.env });
  assert.equal(missing?.name, 'elevenlabs');
  await assert.rejects(missing!.transcribe(input), { kind: 'not-configured' });
  const command = speechProvider({ ...settings, provider: 'command', command: [process.execPath, f.script] }, {}, { env: f.env, cwd: f.root });
  assert.ok(command instanceof CommandProvider);
  assert.deepEqual(await f.run(command), { text: 'selected' });
  assert.equal(resolveCommand([process.execPath], f.env), process.execPath);
  assert.equal(resolveCommand(['node'], { PATH: dirname(process.execPath) }), process.execPath);
  assert.equal(resolveCommand([], f.env), null);
  assert.equal(resolveCommand([f.script], f.env), null);
  assert.equal(resolveCommand([f.root], f.env), null);
  assert.equal(resolveCommand(['not-a-real-command'], { PATH: f.root }), null);
  assert.match(SPEECH_DATA_USE.elevenlabs, /Improve the models for everyone/);
  assert.match(SPEECH_DATA_USE.command, /local/i);
});
import { dirname } from 'node:path';

test('stdout over 1 MiB fails, a signal fails and empty stdout succeeds', async t => {
  for (const [source, expected] of [
    [`process.stdin.resume(); process.stdin.on('end',()=>process.stdout.write('x'.repeat(1048577)));`, 'command-failed'],
    [`process.kill(process.pid,'SIGTERM');`, 'command-failed'],
    [`process.stdin.resume();`, null],
  ] as const) {
    const f = await fixture(t, source);
    const result = f.run(new CommandProvider({ argv: [process.execPath, f.script], env: f.env, cwd: f.root }));
    if (expected) await assert.rejects(result, { kind: expected }); else assert.deepEqual(await result, { text: '' });
  }
});

import { fakeSpeech } from './fakes/speech/fake-api.ts';
test('factory uses environment key override, custom model and file-key fallback without real requests', async t => {
  const fake = await fakeSpeech(t);
  const settings = { ...defaultConfig('selection').speech, model: 'test-model' };
  const fileKey = 'fictional-file-key';
  const env = { CLAND_ELEVENLABS_API_ROOT: fake.url };
  const disabled = speechProvider(settings, { 'speech.elevenlabs_key': fileKey }, { env: { ...env, ELEVENLABS_API_KEY: '' } });
  await assert.rejects(disabled!.transcribe(input), { kind: 'not-configured' });
  assert.equal(fake.requests.length, 0);
  for (const extra of [{}, { ELEVENLABS_API_KEY: 'fictional-environment-key' }]) {
    const provider = speechProvider(settings, { 'speech.elevenlabs_key': fileKey }, { env: { ...env, ...extra } });
    assert.ok(provider);
    assert.equal((await fake.transcribe(provider, input)).text, 'Привет');
  }
  assert.equal(fake.requests.length, 2);
  assert.ok(fake.requests.every(r => r.keyPresent && r.fields.model_id === 'test-model'));
});

test('deadline drains a command descendant that inherits stdout and ignores SIGTERM', async t => {
  const f = await fixture(t, `const {spawn}=require('node:child_process'); require('node:fs').writeFileSync('parent',String(process.pid)); spawn(process.execPath,['-e', "process.on('SIGTERM',()=>{}); require('node:fs').writeFileSync('descendant',String(process.pid)); setInterval(()=>{},1000)"],{stdio:'inherit'}); process.stdin.resume(); setInterval(()=>{},1000);`);
  const ready = f.receipt('descendant');
  const parentReady = f.receipt('parent');
  const clock = new FakeClock();
  const result = f.run(new CommandProvider({ argv: [process.execPath, f.script], env: f.env, cwd: f.root }), { clock });
  const settled = result.then(() => 'success', (error: unknown) => error);
  const pid = await ready;
  await clock.advance(90_000);
  const parentPid = await parentReady;
  let proven = false;
  try {
    const receipt = await bounded(settled, 1000, 'missing native close receipt');
    assert.ok(receipt instanceof SpeechError, String(receipt));
    assert.equal(receipt.kind, 'timeout');
    assert.doesNotMatch(receipt.message, /incomplete/);
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' }, 'production cancellation reaped descendant before rescue');
    assert.throws(() => process.kill(parentPid, 0), { code: 'ESRCH' }, 'production cancellation reaped command before rescue');
    proven = true;
  } finally {
    if (!proven) {
      // Failure-only rescue cannot establish either production assertion above.
      try { process.kill(-parentPid, 'SIGKILL'); } catch {}
      try { process.kill(pid, 'SIGKILL'); } catch {}
      await bounded(settled, 1000, 'failure rescue native close incomplete');
      await f.reaped(parentPid); await f.reaped(pid);
    }
  }
  await f.close();
  await assert.rejects(access(f.root), { code: 'ENOENT' });
});

import { bounded } from './fakes/speech/exchange.ts';
test('omitted and aborted readiness cancel and drain the registered owner before root removal', async t => {
  for (const mode of ['omitted', 'aborted'] as const) {
    const f = await fixture(t, `require('node:fs').writeFileSync('ready',String(process.pid)); process.on('SIGTERM',()=>{}); setInterval(()=>{},1000);`);
    const ready = f.receipt('ready');
    const controller = new AbortController();
    const missing = f.receipt('omitted', { signal: controller.signal, timeoutMs: mode === 'omitted' ? 25 : 2000 });
    const failedSetup = assert.rejects(missing, mode === 'omitted' ? /command readiness incomplete/ : { name: 'AbortError' });
    const result = assert.rejects(f.run(new CommandProvider({ argv: [process.execPath, f.script], env: f.env, cwd: f.root })), { kind: 'timeout' });
    const pid = await ready;
    if (mode === 'aborted') controller.abort();
    await failedSetup;
    assert.equal(f.close(), f.close(), 'idempotent registered disposer');
    await f.close(); await result;
    assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    await assert.rejects(access(f.root), { code: 'ENOENT' });
  }
});
