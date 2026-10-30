import { within } from '../src/executor/droplet/deadline.ts';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { mkdir, writeFile, mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Store } from '../src/hub/store.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import { fakeTelegramFixture, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { fakeSpeech } from './fakes/speech/fake-api.ts';
import { beforeDirectories, ownDirectory } from './process-cleanup.ts';
import { FakeClock } from './fake-clock.ts';
import { control, pairing } from './telegram-polling-fixture.ts';
import { driveTelegram, pacingOwner } from './telegram-pacing-fixture.ts';
import { connectUi, until } from './harness.ts';
import type { TopicMessage } from '../src/protocol.ts';
import type { TgMessage } from '../src/remote/telegram-api.ts';

/** Loopback-only native inputs shared by the two actual workbench consumers. */
export async function telegramMarks(t: TestContext, options: { drainClock?: import('../src/hub/clock.ts').Clock } = {}) {
  const owner = pacingOwner(t);
  const drain = () => within(owner.dispose(), 1000, options.drainClock, () => new Error('Telegram marks drainage incomplete; root retained'));
  beforeDirectories(t, drain);
  const project = async () => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'cland-telegram-marks-')));
    return { root, remove: ownDirectory(t, root, { beforeRemove: drain }) };
  };
  let store: Store | undefined;
  const clock = new FakeClock(Date.now());
  const native = fakeTelegramFixture(t, { clock });
  owner.close(() => native.close(), { startupOnly: true });
  const fake = await native.start();
  const speech = await fakeSpeech(t, [{ body: { text: 'Native voice transcript' } }, { body: { text: '' } }, { status: 402 }, { body: { text: 'Album first transcript' } }, { status: 402 }, { body: { text: 'Surviving transcript' } }]);
  owner.close(() => speech.close());
  const prepare = async (root: string) => {
    await mkdir(join(root, '.cland'), { recursive: true });
    const config = defaultConfig('Telegram marks'); config.remote.telegram.enabled = true;
    await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
    setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
    setSecret(root, 'speech.elevenlabs_key', 'fictional-speech-key');
    store = owner.store(join(root, '.cland/hub.db'));
    store.remotes.forMessenger('telegram').setPairing(pairing);
  };
  const env = { CLAND_TELEGRAM_API_ROOT: fake.url, CLAND_ELEVENLABS_API_ROOT: speech.url };
  const exercise = async (hub: { stop: () => Promise<void>; discovery: Parameters<typeof connectUi>[1]; fakes: Awaited<ReturnType<typeof import('./harness.ts').projectHub>>['fakes'] }) => {
    const ui = await connectUi(t, hub.discovery);
    const state = store!.remotes.forMessenger('telegram');
    const drive = <T>(p: Promise<T>) => driveTelegram(clock, state, p);
    for (let i = 1; i <= 3; i++) {
      const updates = await control<import('../src/remote/telegram-api.ts').TgUpdate[]>(fake.url, 'media', { items: [{ kind: 'voice', content: Buffer.from('synthetic OGG').toString('base64') }] });
      await drive(until(() => state.get(`media.identity:101:${updates[0]!.message!.message_id}`) === 'completed', { what: 'durable native voice upload', timeoutMs: 2000 }));
    }
    await control(fake.url, 'update', { message: { message_id: 900, chat: { id: 101, type: 'private' }, from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: 'Native phone text', date: 1 } });
    await drive(until(async () => ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages.some(m => m.text === 'Native phone text'), { what: 'native text committed', timeoutMs: 2000 }));
    await control(fake.url, 'update', { message: { message_id: 901, chat: { id: 101, type: 'private' }, from: { id: 101, is_bot: false, first_name: 'Fixture human' }, text: '🎤 Typed phone text', date: 1 } });
    await drive(until(async () => ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages.some(m => m.text === '🎤 Typed phone text'), { what: 'typed marker text committed', timeoutMs: 2000 }));
    for (const [kind, caption] of [['photo', '🎤 Typed caption'], ['document', '🎤 nothing recognised']] as const) {
      const updates = await control<import('../src/remote/telegram-api.ts').TgUpdate[]>(fake.url, 'media', { items: [{ kind, caption, file_name: 'plain.txt', content: Buffer.from('synthetic attachment').toString('base64') }] });
      await drive(until(() => state.get(`media.identity:101:${updates[0]!.message!.message_id}`) === 'completed', { what: 'non-recording caption committed', timeoutMs: 2000 }));
    }
    const album = await control<import('../src/remote/telegram-api.ts').TgUpdate[]>(fake.url, 'media', { items: [
      { kind: 'audio', media_group_id: 'marks-album', duration: 10, file_name: 'not transcribed: track-1.mp3', mime_type: 'audio/mpeg', content: Buffer.from('album one').toString('base64') },
      { kind: 'audio', media_group_id: 'marks-album', duration: 10, file_name: 'track-2.mp3', mime_type: 'audio/mpeg', content: Buffer.from('album two').toString('base64') },
    ] });
    await until(() => album.every(u => state.get(`media.identity:101:${u.message!.message_id}`) === 'stored'), { what: 'album members durably admitted', timeoutMs: 2000 });
    await clock.advance(2000);
    await drive(until(() => album.every(u => state.get(`media.identity:101:${u.message!.message_id}`) === 'completed'), { what: 'native album upload committed', timeoutMs: 2000 }));
    const surviving = await control<import('../src/remote/telegram-api.ts').TgUpdate[]>(fake.url, 'media', { items: [
      { kind: 'audio', media_group_id: 'surviving-album', duration: 10, file_name: 'not transcribed: survivor.mp3', mime_type: 'audio/mpeg', content: Buffer.from('survivor').toString('base64') },
      { kind: 'audio', media_group_id: 'surviving-album', duration: 10, file_name: 'oversized.mp3', file_size: 21 * 1024 * 1024 },
    ] });
    await until(() => surviving.every(u => state.get(`media.identity:101:${u.message!.message_id}`) === 'stored'), { what: 'surviving album admitted', timeoutMs: 2000 });
    await clock.advance(2000);
    await drive(until(() => surviving.every(u => state.get(`media.identity:101:${u.message!.message_id}`) === 'completed'), { what: 'surviving album completed', timeoutMs: 2000 }));
    assert.equal(speech.requests.length, 6, 'oversized member never reaches speech');
    assert.ok((await control<{ messages: TgMessage[] }>(fake.url, 'state')).messages.some(m => m.text?.includes('oversized.mp3 is 21 MB')), 'native oversized refusal is sent');
    const launched = await ui.request({ type: 'session.launch', name: 'worker', harness: 'codex', role: 'implementer' });
    assert.equal(launched.ok, true, launched.error);
    const approval = `${(launched.value as { process: { sessionId: string } }).process.sessionId}:marks`;
    hub.fakes.codex!.raiseApproval('worker', { id: 'marks', kind: 'command', subject: { command: 'echo native marks' }, choices: ['once', 'deny'] });
    let card: TgMessage | undefined;
    await drive(until(async () => {
      card = (await control<{ messages: TgMessage[] }>(fake.url, 'state')).messages.find(m => state.message('101', String(m.message_id))?.approval === approval);
      return !!card;
    }, { what: 'native approval card mapping', timeoutMs: 2000 }));
    await control(fake.url, 'press', { chat_id: 101, message_id: card!.message_id, row: 0, column: 0 });
    await drive(until(async () => {
      const inbox = (await ui.request({ type: 'inbox.list', archive: true })).value as { archive: Array<{ id: string; outcome?: { via?: string } }> };
      return inbox.archive.some(r => r.id === approval && r.outcome?.via === 'telegram');
    }, { what: 'native approval outcome committed', timeoutMs: 2000 }));
    const messages = ((await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: TopicMessage[] }).messages;
    assert.deepEqual(messages.filter(m => m.fromKind === 'human').map(m => m.text), ['🎤 Native voice transcript', '🎤 nothing recognised', '🎤 not transcribed: quota', 'Native phone text', '🎤 Typed phone text', '🎤 Typed caption', '🎤 nothing recognised', '🎤 not transcribed: track-1.mp3\nAlbum first transcript\n\n🎤 track-2.mp3: transcription failed (quota)', '🎤 not transcribed: survivor.mp3\nSurviving transcript']);
    return { messages, approval };
  };
  const startHub = (root: string, env: Record<string, string>, options: import('./harness.ts').ProjectHubOptions = {}, setup: Parameters<typeof owner.start>[3] = {}) =>
    owner.start(root, env, clock, { ...setup, hubOptions: options });
  return { clock, prepare, env, exercise, startHub, owner, native, fake, project, get store() { return store!; } };
}
