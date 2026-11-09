// T2: secret voice refusal before media acquisition; sealed speech and messenger APIs.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { voiceFixture } from './telegram-voice-fixture.ts';
import { fakeSpeech } from './fakes/speech/fake-api.ts';
import { fakeDiscordFixture, DISCORD_TEST_TOKEN, DISCORD_IDS as ids } from './fakes/discord/fake-api.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { control } from './telegram-polling-fixture.ts';
import { connectUi, until } from './harness.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import type { HubCards } from '../src/hub/hub-cards.ts';
import type { TgMessage, TgUpdate } from '../src/remote/telegram-api.ts';

for (const via of ['telegram', 'discord'] as const) for (const secret of [true, false]) test(`${via} hub card voice ${secret ? 'refuses secret input before acquisition' : 'keeps non-secret answering'}`, async t => {
  const f = await voiceFixture(t);
  const transcript = 'fake-spoken-code-1775';
  const speech = await fakeSpeech(t, [{ body: { text: transcript } }]);
  f.owner.close(() => speech.close());
  const discord = await fakeDiscordFixture(t, { clock: f.clock });
  f.owner.close(() => discord.close());
  const config = defaultConfig('Hub voice cards');
  config.remote.telegram.enabled = true; config.remote.discord.enabled = true;
  await writeFile(join(f.root, '.cland/config.toml'), renderConfig(config));
  const dc = f.store.remotes.forMessenger('discord');
  dc.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Human' });
  let cards!: HubCards, received: string | undefined;
  const hub = await f.start({ CLAND_TELEGRAM_API_ROOT: f.fake.url, CLAND_DISCORD_API_ROOT: discord.url, CLAND_ELEVENLABS_API_ROOT: speech.url }, {
    processes: fakeLockProcesses().processes, droplet: { processes: fakeLockProcesses().processes },
    syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, 'speech.elevenlabs_key': 'fictional-key' },
    registerHubCards: service => { cards = service; service.onAnswer('voice', (_, answer) => { received = answer; return 'Saved'; }); },
  });
  const ui = await connectUi(t, hub.discovery);
  const native = () => control<{ messages: TgMessage[]; requests: Array<{ method: string }> }>(f.fake.url, 'state');
  let id = '';
  const mapped = f.owner.observe(() => until(() => !!id && f.state.messagesForAsk(id).length === 1 && dc.messagesForAsk(id).length === 1, { what: 'both native hub card mappings', timeoutMs: 2000 }));
  id = cards.raise('voice', 'general', 'Paste code', [], true, null, secret);
  await f.clock.advance(250); await f.drive(mapped);
  let message = '';
  const complete = f.owner.observe(() => until(async () => {
    const lines = via === 'telegram' ? (await native()).messages.map(m => m.text ?? '') : (await discord.control('state')).messages.map(m => m.content);
    return secret ? lines.includes('Use text to answer this card') || received !== undefined
      : received === transcript && lines.some(line => line.startsWith('🎤'));
  }, { what: 'native voice refusal or completed answer/echo', timeoutMs: 2000 }));
  if (via === 'telegram') {
    const card = (await native()).messages.find(m => String(m.message_id) === f.state.messagesForAsk(id)[0]!.messageId)!;
    const updates = await control<TgUpdate[]>(f.fake.url, 'media', { items: [{ kind: 'voice', reply_to_message: card, content: Buffer.from('fake OGG').toString('base64') }] });
    message = String(updates[0]!.message!.message_id);
  } else {
    message = '90071992547422000';
    const bytes = Buffer.from('fake OGG'); await discord.control('cdn', { id: 'voice', content: bytes.toString('base64') });
    await discord.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { id: message, channel_id: ids.channel, author: { id: ids.human }, type: 19,
      message_reference: { message_id: dc.messagesForAsk(id)[0]!.messageId }, content: '', flags: 8192,
      attachments: [{ id: 'voice', filename: 'recording.ogg', content_type: 'audio/ogg', size: bytes.length, duration_secs: 2, url: `${discord.url}/cdn/voice` }] } });
  }
  await f.drive(complete);
  if (!secret) {
    assert.equal(received, transcript); assert.equal(speech.requests.length, 1);
    await hub.stop(); return;
  }
  const artifacts = await ui.request({ type: 'artifact.list' });
  await hub.stop();
  const tg = await native(), ds = await discord.control('state');
  const lines = via === 'telegram' ? tg.messages.map(m => m.text ?? '') : ds.messages.map(m => m.content);
  assert.equal(lines.includes('Use text to answer this card'), true, 'secret voice reply lacks refusal');
  assert.equal(received, undefined);
  assert.equal(speech.requests.length, 0);
  assert.equal(tg.requests.filter(r => r.method === 'getFile').length, 0);
  assert.equal((await discord.control('cdn')).requests.length, 0);
  assert.equal(f.store.ask(id)!.state, 'open');
  assert.equal(f.state.get(`telegram.voice-target:101:${message}`), null);
  assert.equal(f.state.get(`media.voice:101:${message}`), null);
  assert.equal(dc.get(`discord.voice:${ids.channel}:${message}`), null);
  assert.equal(lines.some(line => line.startsWith('🎤')), false);
  assert.deepEqual(artifacts.value, { artifacts: [] });
  assert.equal((await readFile(join(f.root, '.cland/hub.db'))).includes(Buffer.from(transcript)), false);
});
