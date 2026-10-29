import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { mkdir, writeFile, mkdtemp, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pacingOwner } from './telegram-pacing-fixture.ts';
import { beforeDirectories, ownDirectory } from './process-cleanup.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import type { Store } from '../src/hub/store.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { connectUi, projectHub, until } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { discordExchangeOwner } from './fakes/discord/exchange.ts';
import { DISCORD_TEST_TOKEN, DISCORD_IDS as ids } from './fakes/discord/fake-api.ts';
import type { Inbox, TopicMessage } from '../src/protocol.ts';

/** Production Discord inputs shared by actual workbench consumers; owner joins before root removal. */
export async function discordWorkbench(t: TestContext) {
  const clock = new FakeClock(Date.now());
  const startup = pacingOwner(t);
  const exchange = discordExchangeOwner(t, { clock });
  startup.close(exchange.close);
  beforeDirectories(t, startup.dispose);
  const owner = await exchange.start();
  await owner.fake.control('configure', { interval: 1000000 });
  let store: Store;
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  const project = async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-discord-workbench-')));
    return { root, remove: ownDirectory(t, root, { beforeRemove: startup.dispose }) };
  };
  const wait = (predicate: () => boolean | Promise<boolean>, what: string) => startup.observe(async signal => {
    await until(async () => signal.aborted || await predicate(), { what, timeoutMs: 2000 });
    signal.throwIfAborted();
  });
  const prepare = async (root: string) => {
    await mkdir(join(root, '.cland'), { recursive: true });
    const config = defaultConfig('Discord workbench');
    config.remote.discord.enabled = true; config.speech.provider = '';
    config.verification.lockPath = join(root, 'suite.lock');
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
    setSecret(root, 'discord.token', DISCORD_TEST_TOKEN);
    store = startup.store(join(root, '.cland/hub.db'));
    store.remotes.forMessenger('discord').setPairing({ userId: ids.human, chatId: ids.channel, guildId: ids.guild, name: 'Fixture human' });
  };
  const env = { CLAND_DISCORD_API_ROOT: owner.fake.url };
  const startHub = async (root: string, env: Record<string, string>, options: import('./harness.ts').ProjectHubOptions = {}, setup: Parameters<typeof startup.start>[3] = {}) => {
    hub = await startup.start(root, env, clock, { ...setup, hubOptions: options });
    return hub;
  };
  const ready = async () => {
    const ui = await connectUi(t, hub!.discovery, 'nvim');
    await wait(async () => (await owner.fake.control('state')).gateway.identifies === 1, 'native Identify');
    await owner.fake.control('dispatch', { op: 1, d: null });
    await wait(async () => ((await ui.request({ type: 'remote.status' })).value as import('../src/protocol.ts').RemoteStatusResult).remotes[1]!.connection === 'connected', 'native READY and ACK');
    return ui;
  };
  const exercise = async () => {
    const ui = await ready();
    const state = store.remotes.forMessenger('discord');
    const send = async (message: Record<string, unknown>) => {
      await owner.fake.control('dispatch', { op: 0, t: 'MESSAGE_CREATE', d: { channel_id: ids.channel, author: { id: ids.human }, type: 0, attachments: [], ...message } });
      await until(() => state.get('discord.lastMessageId') === message.id, { what: 'native input committed', timeoutMs: 2000 });
    };
    await send({ id: '90071992547424000', content: 'Native Discord text' });
    const bytes = Buffer.from('synthetic OGG');
    await owner.fake.control('cdn', { id: 'voice', content: bytes.toString('base64') });
    await send({ id: '90071992547424001', content: '', flags: 8192, attachments: [{ id: 'voice', filename: 'recording.ogg', content_type: 'audio/ogg', size: bytes.length, duration_secs: 2, url: `${owner.fake.url}/cdn/voice` }] });
    const launched = await ui.request({ type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
    assert.equal(launched.ok, true, launched.error);
    const approval = `${(launched.value as { process: { sessionId: string } }).process.sessionId}:discord-marks`;
    await ui.request({ type: 'subscribe' });
    const raised = wait(async () => ((await ui.request({ type: 'inbox.list' })).value as Inbox).approvals.some(a => a.id === approval), 'approval published');
    void raised.catch(() => {});
    hub!.fakes.codex!.raiseApproval('worker', { id: 'discord-marks', kind: 'command', subject: { command: 'echo native Discord' }, choices: ['once', 'deny'] });
    await raised;
    await clock.advance(250);
    await until(() => state.messagesForApproval(approval).length === 1, { what: 'native card mapping', timeoutMs: 2000 });
    await owner.fake.control('interact', { message_id: state.messagesForApproval(approval)[0]!.messageId, custom_id: `approval:${approval}:once` });
    await until(async () => ((await ui.request({ type: 'inbox.list', archive: true })).value as Inbox).archive?.some(r => r.id === approval && r.outcome?.via === 'discord') === true, { what: 'native approval outcome', timeoutMs: 2000 });
    await owner.fake.control('interact', { command: 'pair', channel_id: ids.secondChannel });
    let pairing: NonNullable<Inbox['pairings']>[number] | undefined;
    await until(async () => { pairing = ((await ui.request({ type: 'inbox.list' })).value as Inbox).pairings?.find(p => p.messenger === 'discord'); return !!pairing; }, { what: 'native waiting pair code', timeoutMs: 2000 });
    await clock.advance(250);
    const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages.filter(m => m.fromKind === 'human');
    assert.deepEqual(messages.map(m => [m.text, m.via]), [['Native Discord text', 'discord'], ['🎤 not transcribed', 'discord']]);
    return { messages, approval, pairing: pairing! };
  };
  return { ...owner, clock, env, project, prepare, startHub, ready, exercise, startup, exchange, get store() { return store; } };
}
