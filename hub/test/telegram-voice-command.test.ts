// T3: production reload into a native speech command in a disposable fixture.
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

test('Telegram voice reload switches to the command provider', async t => {
  const f = await fixture(t);
  const config = defaultConfig('Voice reload'); config.remote.telegram.enabled = true; config.speech.provider = '';
  await writeFile(join(f.root, '.cland/config.toml'), renderConfig(config));
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const current = await readFile(join(f.root, '.cland/config.toml'), 'utf8');
  config.speech.provider = 'command';
  const script = join(f.root, 'speech.mjs');
  await writeFile(script, "let bytes = ''; for await (const chunk of process.stdin) bytes += chunk; process.stdout.write(bytes === 'original audio' ? 'command transcript' : 'wrong bytes');");
  config.speech.command = [process.execPath, script];
  await writeFile(join(f.root, '.cland/config.toml'), current.replace('provider = ""', 'provider = "command"').replace('command = []', `command = ${JSON.stringify(config.speech.command)}`));
  const reload = await ui.request({ type: 'hub.reload' }); assert.equal(reload.ok, true, reload.error);
  await control(f.fake.url, 'media', { items: [{ kind: 'voice', content: Buffer.from('original audio').toString('base64') }] });
  await f.drive(until(() => f.state.get('media.identity:101:1') === 'completed' && f.state.get('media.voice-outcome:101:1') === 'sent', { what: 'reloaded command voice completion', timeoutMs: 2_000 }));
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.equal(messages.length, 1); assert.equal(messages[0]!.text, '🎤 command transcript');
  const native = await control<{ messages: TgMessage[] }>(f.fake.url, 'state');
  assert.equal(native.messages.length, 1); assert.match(native.messages[0]!.text!, / · command$/);
  await f.clean(ui, hub);
});

for (const setup of ['empty', 'missing'] as const) test(`Telegram unconfigured command ${setup} retains audio and names command setup`, async t => {
  const f = await fixture(t);
  const config = defaultConfig('Missing command'); config.remote.telegram.enabled = true;
  config.speech.provider = 'command'; config.speech.command = setup === 'empty' ? [] : [join(f.root, 'missing-speech-command')];
  await writeFile(join(f.root, '.cland/config.toml'), renderConfig(config));
  await control(f.fake.url, 'media', { items: [{ kind: 'voice', content: Buffer.from('unconfigured command audio').toString('base64') }] });
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url });
  const ui = await connectUi(t, hub.discovery);
  await f.drive(until(() => f.state.get('media.voice-outcome:101:1') === 'sent' && f.state.get('media.identity:101:1') === 'completed', { what: 'command-not-configured outcome receipt', timeoutMs: 2_000 }));
  const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
  assert.equal(messages.length, 1); assert.equal(messages[0]!.text, '🎤 not transcribed');
  assert.equal(messages[0]!.artifacts!.length, 1);
  const native = await control<{ messages: TgMessage[] }>(f.fake.url, 'state');
  assert.equal(native.messages.length, 1);
  assert.equal(native.messages[0]!.text, 'Transcription command is unavailable; configure [speech] command, then cland hub reload');
  await f.clean(ui, hub);
});
