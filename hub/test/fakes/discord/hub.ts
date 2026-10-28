import type { TestContext } from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { discordExchangeOwner } from './exchange.ts';
import { DISCORD_TEST_TOKEN, DISCORD_IDS } from './fake-api.ts';
import { tempProject, projectHub, connectUi, until } from '../../harness.ts';
import { FakeClock } from '../../fake-clock.ts';
import { Store } from '../../../src/hub/store.ts';
import { defaultConfig, renderConfig } from '../../../src/init/config.ts';
import { DiscordRemote } from '../../../src/remote/discord.ts';
import type { RemoteStatusRow } from '../../../src/protocol.ts';

/** Register native/hub joins before acquisition; close injected storage only after drainage. */
export function discordHubFixtureOwner(t: TestContext, options: {
  clock?: FakeClock; injected?: boolean; interval?: number;
  fake?: Parameters<typeof discordExchangeOwner>[1];
} = {}) {
  const clock = options.clock ?? new FakeClock();
  const owner = discordExchangeOwner(t, { ...options.fake, clock });
  let db: Store | undefined;
  let dbClosed = false;
  const disposal: string[] = [];
  let hubReady: ReturnType<typeof projectHub> | undefined;
  const notices: string[] = [];
  const logs: Record<string, unknown>[] = [];
  const start = async () => {
    try {
      const native = await owner.start();
      native.stop(async () => { const hub = await hubReady; await hub?.stop(); if (hub) { await hub.stopped; disposal.push('hub-stopped'); } });
      native.afterDrain(() => { db?.close(); dbClosed = true; disposal.push('store-closed'); });
      const root = await native.run(() => tempProject(t));
      if (options.interval) await native.run(() => native.fake.control('configure', { interval: options.interval }));
      const config = defaultConfig('Discord native fixture'); config.remote.discord.enabled = true;
      await native.run(async () => {
        await mkdir(join(root, '.cland'), { recursive: true });
        await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
      });
      db = new Store(join(root, '.cland/hub.db'));
      const state = db.remotes.forMessenger('discord');
      state.setPairing({ userId: DISCORD_IDS.human, chatId: DISCORD_IDS.channel, guildId: DISCORD_IDS.guild, name: 'Fixture human' });
      hubReady = projectHub(t, root, { CLAND_DISCORD_API_ROOT: native.fake.url }, {
        clock, log: entry => logs.push(entry), syntheticRemoteSecrets: { 'discord.token': DISCORD_TEST_TOKEN },
        ...(options.injected ? { gatewayMessenger: () => new DiscordRemote(native.api, DISCORD_TEST_TOKEN, clock,
          { fake: true, random: () => 0.25, store: state, notice: cause => notices.push(cause) }) } : {}),
      });
      const hub = await native.run(() => hubReady!);
      const ui = await native.run(() => connectUi(t, hub.discovery, 'nvim'));
      const status = async () => ((await ui.request({ type: 'remote.status' })).value as { remotes: RemoteStatusRow[] }).remotes[1]!;
      const history = async () => ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: Array<{ text: string }> }).messages;
      await native.run(() => until(async () => (await native.fake.control('state')).gateway.identifies === 1, { timeoutMs: 2000, what: 'native Identify receipt' }));
      return { ...native, root, hub, ui, clock, state, status, history, notices, logs, close: owner.close };
    } catch (error) { await owner.close(); throw error; }
  };
  return { start, close: owner.close, listening: owner.listening, receipts: owner.receipts, pending: owner.pending, disposal, dbClosed: () => dbClosed };
}
