import type { TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { discordExchangeOwner } from './fakes/discord/exchange.ts';
import { DISCORD_TEST_TOKEN, DISCORD_IDS as ids } from './fakes/discord/fake-api.ts';
import { fakeTelegramFixture, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { pairing } from './telegram-polling-fixture.ts';
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { fakeSpeech } from './fakes/speech/fake-api.ts';
import { FakeClock } from './fake-clock.ts';

export async function remotesFixture(t: TestContext) {
  const owner = pacingOwner(t);
  const clock = new FakeClock(1_793_044_800_000);
  const exchange = await discordExchangeOwner(t, { clock }).start();
  const { root } = await exchange.project();
  const tgOwner = fakeTelegramFixture(t, { clock });
  exchange.stop(() => tgOwner.close());
  owner.close(() => tgOwner.close(), { startupOnly: true });
  const tg = await tgOwner.start();
  const speech = await fakeSpeech(t, [{ body: { text: 'heard Telegram' } }, { body: { text: 'heard Discord' } }]);
  exchange.stop(() => speech.close());
  owner.close(() => speech.close(), { startupOnly: true });
  const config = defaultConfig('Integrated remotes');
  config.remote.telegram.enabled = true; config.remote.discord.enabled = true;
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const store = owner.store(join(root, '.cland/hub.db'));
  exchange.stop(owner.dispose);
  const discord = store.remotes.forMessenger('discord'), telegram = store.remotes.forMessenger('telegram');
  discord.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Human' });
  telegram.setPairing(pairing);
  const start = (setup: Parameters<typeof owner.start>[3] = {}) => owner.start(root,
    { CLAND_DISCORD_API_ROOT: exchange.fake.url, CLAND_TELEGRAM_API_ROOT: tg.url, CLAND_ELEVENLABS_API_ROOT: speech.url }, clock,
    { ...setup, hubOptions: { ...setup.hubOptions, syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, 'telegram.token': TELEGRAM_TEST_TOKEN, 'speech.elevenlabs_key': 'fictional-speech-key' } } });
  return { owner, root, clock, exchange, tgOwner, tg, speech, store, discord, telegram, start };
}
