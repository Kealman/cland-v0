import type { TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { projectHub, inProcessSpoke, until } from './harness.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { Store } from '../src/hub/store.ts';
import { messengerFactory } from '../src/remote/messenger.ts';
import { DiscordRemote } from '../src/remote/discord.ts';
import { remoteApprovalHarness } from './fakes/remote-approval-harness.ts';
import { remoteRedactor } from '../src/remote/redact.ts';
import { fakeTelegramFixture, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { pairing } from './telegram-polling-fixture.ts';
import { FakeClock } from './fake-clock.ts';
import { DISCORD_TEST_TOKEN, DISCORD_IDS as ids } from './fakes/discord/fake-api.ts';
import { discordExchangeOwner } from './fakes/discord/exchange.ts';

export async function discordCardsFixture(t: TestContext, holdType?: string, projectName = 'Cards fixture', onCallback?: (id: string, type: number) => void | Promise<void>, both = false, log?: import('../src/log.ts').LogFn, scripted?: 'codex' | 'opencode', origin?: string, historyLimit?: number) {
  const clock = new FakeClock();
  const exchange = await discordExchangeOwner(t, { clock, ...(origin ? { publicOrigin: origin } : {}), ...(onCallback ? { onCallback } : {}) }).start();
  const { root } = await exchange.project();
  const tgOwner = both ? fakeTelegramFixture(t, { clock }) : undefined;
  const tg = await tgOwner?.start();
  const config = defaultConfig('Commands fixture'); config.verification.lockPath = join(root, 'suite.lock'); config.remote.discord.enabled = true; config.remote.telegram.enabled = both; config.plan.approval = 'human'; if (origin) config.web.origin = origin;
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const script = scripted ? remoteApprovalHarness(t, root, clock, scripted) : undefined;
  const store = new Store(join(root, '.cland/hub.db')); exchange.afterDrain(() => store.close());
  const state = store.remotes.forMessenger('discord');
  state.setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  const telegram = store.remotes.forMessenger('telegram');
  if (both) telegram.setPairing(pairing);
  const env = { CLAND_DISCORD_API_ROOT: exchange.fake.url, ...(tg ? { CLAND_TELEGRAM_API_ROOT: tg.url } : {}) };
  const factory = messengerFactory(env, remoteRedactor(), clock, { state: store.remotes, projectName: () => projectName, webOrigin: () => origin ?? '', ...(log ? { log } : {}) });
  const frames: Array<{ frame: Record<string, unknown>; ingress?: import('../src/remote/gateway.ts').RemoteIngress }> = [];
  const held: Array<() => void> = [];
  let remote: import('../src/remote/gateway.ts').Remote;
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  exchange.stop(() => hub?.stop());
  const startHub = () => exchange.run(async () => {
    hub = await projectHub(t, root, env, { clock, ...(script ? { adapters: [script.factory] } : {}), syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN, ...(both ? { 'telegram.token': TELEGRAM_TEST_TOKEN } : {}) }, gatewayMessenger: (...args) => {
      const made = args[0] === 'discord' && historyLimit !== undefined
        ? new DiscordRemote(exchange.api, args[1], clock, { store: state, fake: true, projectName: () => projectName, ...(log ? { log } : {}), historyLimit })
        : factory(...args); if (made.id !== 'discord') return made;
      remote = made; const start = remote.start.bind(remote);
      remote.start = (send, ...rest) => start((frame, ingress, bytes) => {
        frames.push({ frame, ...(ingress ? { ingress } : {}) });
        if (frame.type === holdType) held.push(() => send(frame, ingress, bytes)); else send(frame, ingress, bytes);
      }, ...rest);
      return remote;
    } });
    if (exchange.signal.aborted) await hub.stop();
  });
  await startHub();
  const coord = await inProcessSpoke(t, { cwd: root, discover: true, name: 'coord', role: 'coordinator', sessionId: 'coord' });
  await until(async () => (await exchange.fake.control('state')).gateway.identifies === 1, { what: 'Discord READY', timeoutMs: 2000 });
  await exchange.fake.control('dispatch', { op: 1, d: null });
  await until(() => remote.status!().connected, { what: 'READY plus native heartbeat ACK', timeoutMs: 1500 });
  const command = (name: string, text?: string) => exchange.run(async () => {
    const { id } = await exchange.fake.control('interact', { command: name, ...(text === undefined ? {} : { text }) });
    await until(async () => !!(await exchange.fake.control('state')).interactions.find(row => row.id === id)?.callbacks.length,
      { what: 'native private command callback', timeoutMs: 1500 });
    return (await exchange.fake.control('state')).interactions.find(row => row.id === id)!;
  });
  return { ...exchange, root, script, store, tg, telegram, hub: hub!, restart: async (delay = 5000, down?: () => Promise<void>) => { await hub!.stop(); await down?.(); await clock.advance(delay); await startHub(); return hub!; }, clock, state, coord, command, frames, holdFrames: (type: string) => { holdType = type; }, releaseOne: () => held.shift()?.(), telegramMute: () => store.remotes.forMessenger('telegram').get('mute'), discardFrames: () => { holdType = undefined; held.splice(0); }, releaseFrames: () => { holdType = undefined; for (const send of held.splice(0)) send(); } };
}


export async function discordHistorySeed(f: Awaited<ReturnType<typeof discordCardsFixture>>) {
  await f.fake.control('configure', { interval: 1000000, sendLimit: 10000, sendWindow: 0 });
  const seed = await f.fake.control('say', { content: 'Cursor seed' });
  await f.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: seed });
  await until(() => f.state.get('discord.lastMessageId') === seed.id, { what: 'TEXT cursor committed', timeoutMs: 2000 });
  await until(() => f.state.outbox().some(j => j.source === `discord.reaction:${ids.channel}:${seed.id}:👌` && j.state === 'sent'), { what: 'seed feedback settled', timeoutMs: 2000 });
  return seed;
}

