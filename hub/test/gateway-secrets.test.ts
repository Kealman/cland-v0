// T2: startup and gateway frame receipts; fake platform only, native journal/artifact sinks.
import './cover-quiet.ts';
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { open, readFile, stat, writeFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { connectUi, projectHub, tempProject, until } from './harness.ts';
import { testMessenger, testRemoteStates } from './fakes/messenger.ts';
import { setSecret, validateAndRegisterSecrets, type Secrets, type SecretName } from '../src/remote/secrets.ts';
import { remoteRedactor } from '../src/remote/redact.ts';
import { Journal, type JournalOpen } from '../src/hub/journal.ts';
import { Gateway } from '../src/remote/gateway.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { onCleanup, beforeDirectories } from './process-cleanup.ts';
import type { Artifact, TopicMessage } from '../src/protocol.ts';

const values: Secrets = {
  'telegram.token': `123456:${'made_up_'.repeat(4)}`,
  'discord.token': 'opaque-made-up-discord',
  'speech.elevenlabs_key': 'made-up-elevenlabs', 'speech.xai_key': 'made-up-xai',
};
const raw = Object.values(values).join(' ');
const masked = '[redacted] [redacted] [redacted] [redacted]';
function seed(root: string, credentials: Secrets = values) {
  mkdirSync(join(root, '.cland'), { recursive: true });
  for (const [name, value] of Object.entries(credentials)) setSecret(root, name as SecretName, value);
}

function ownedJournal(t: TestContext, path: string, options: { open?: JournalOpen } = {}): Journal {
  let journal: Journal | undefined;
  const close = async () => { await journal?.close(); };
  onCleanup(t, close);
  beforeDirectories(t, close);
  journal = new Journal(path, undefined, options);
  return journal;
}

test('hub refuses a malformed Telegram token before starting any messenger and releases its lock', async t => {
  const root = await tempProject(t);
  seed(root, { 'telegram.token': 'malformed-made-up-private-value' });
  const messenger = testMessenger();
  await assert.rejects(projectHub(t, root, {}, { gatewayRemotes: [messenger] }), error => {
    assert.ok((error as Error).message === 'telegram.token: invalid token format (at most 80 characters)', 'startup refusal never echoes a credential');
    return true;
  });
  assert.equal(messenger.started, false, 'provider setup has not built any URL');
  await assert.rejects(readFile(join(root, '.cland/hub.lock')), { code: 'ENOENT' });
  setSecret(root, 'telegram.token', values['telegram.token']!);
  const recovered = await projectHub(t, root, {}, { gatewayRemotes: [messenger] });
  assert.equal(messenger.started, true, 'stored malformed token can be replaced');
  await recovered.stop();
});

test('daemon registers every resolved secret before gateway status and logs are written', async t => {
  const root = await tempProject(t);
  seed(root);
  const messenger = testMessenger('broken', { startError: new Error(`failed ${raw}`) });
  const state = testRemoteStates();
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { gatewayState: state, gatewayRemotes: [messenger], log: entry => { logs.push(entry); } });
  assert.ok(state.forMessenger('broken').status().reason === `failed ${masked}`, 'persisted status is masked');
  await hub.stop();
  assert.ok(logs.some(entry => entry.event === 'remote-disabled' && entry.reason === `failed ${masked}`));
  assert.ok(Object.values(values).every(value => !JSON.stringify(logs).includes(value)), 'all captured gateway logs are masked');
});

test('gateway retains only masked cleanup errors after registered secret rotation', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const output = remoteRedactor();
  validateAndRegisterSecrets(values, output);
  validateAndRegisterSecrets({ 'discord.token': 'rotated-made-up-discord' }, output);
  const messenger = testMessenger('broken', { startError: new Error('setup failed') });
  const logs: Record<string, unknown>[] = [];
  const gateway = new Gateway(hub.dispatcher, [{ ...messenger, stop: () => {
    messenger.stop();
    throw new Error(`cleanup ${raw} rotated-made-up-discord`);
  } }], { redact: output, log: entry => { logs.push(entry); } });
  onCleanup(t, () => gateway.stop().catch(() => {}));
  await gateway.start();
  await assert.rejects(gateway.stop(), error => {
    assert.ok(error instanceof AggregateError);
    assert.ok(error.errors.length === 1 && error.errors[0].message === `cleanup ${masked} [redacted]`, 'retained shutdown error is masked');
    return true;
  });
  assert.ok(logs.some(entry => entry.event === 'remote-stop-failed' && entry.reason === `cleanup ${masked} [redacted]`));
});

test('gateway masks inbound and outbound frames while preserving message structure and long text', async t => {
  const root = await tempProject(t);
  seed(root);
  const messenger = testMessenger();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [messenger] });
  const local = await connectUi(t, hub.discovery);
  const inbound = await messenger.client.request({ type: 'topic.send', topic: 'general', text: raw });
  assert.equal(inbound.ok, true, inbound.error);
  assert.ok((inbound.value as { message: TopicMessage }).message.text === masked, 'inbound text is masked');
  const history = await local.request({ type: 'topic.history', topic: 'general' });
  assert.ok((history.value as { messages: TopicMessage[] }).messages.find(message => message.id === (inbound.value as { message: TopicMessage }).message.id)!.text === masked, 'stored inbound message is masked');
  const prefix = 'paragraph\n'.repeat(100);
  const received = messenger.client.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).text === `${prefix}${masked}`);
  const sent = await local.request({ type: 'topic.send', topic: 'general', text: `${prefix}${raw}` });
  assert.equal(sent.ok, true, sent.error);
  assert.equal(((await received).message as TopicMessage).id, (sent.value as { message: TopicMessage }).message.id);
  assert.ok(Object.values(values).every(value => !JSON.stringify(messenger.client.frames).includes(value)), 'platform receives no credential in any frame');
});

test('shared remote output API masks journal and artifact writes after rotation without truncating documents', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const local = await connectUi(t, hub.discovery);
  const output = remoteRedactor();
  validateAndRegisterSecrets(values, output);
  validateAndRegisterSecrets({ 'discord.token': 'rotated-made-up-discord' }, output);
  const journal = ownedJournal(t, join(root, '.cland/remote-fixture.jsonl'));
  journal.write(output.value({ event: 'remote-fixture', reason: `${raw} rotated-made-up-discord` }));
  await journal.close();
  const persisted = JSON.parse((await readFile(join(root, '.cland/remote-fixture.jsonl'), 'utf8')).trim()) as { reason: string };
  assert.ok(persisted.reason === `${masked} [redacted]`, 'journal retains only masked values');
  const prefix = 'paragraph\n'.repeat(100);
  const result = await local.request({ type: 'artifact.create', kind: 'note', topic: 'general', title: 'Remote output', content: output.text(`${prefix}${raw} rotated-made-up-discord`) });
  assert.equal(result.ok, true, result.error);
  const artifact = (result.value as { artifact: Artifact }).artifact;
  assert.ok(await readFile(artifact.path, 'utf8') === `${prefix}${masked} [redacted]`, 'artifact preserves document with masked values');
});

for (const opaque of ['id', 'result', 'general']) test(`gateway preserves routing or disables safely for opaque credential ${opaque}`, async t => {
  const root = await tempProject(t);
  seed(root, { 'discord.token': opaque });
  const messenger = testMessenger();
  const state = testRemoteStates();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [messenger], gatewayState: state });
  const local = await connectUi(t, hub.discovery);
  if (!state.forMessenger(messenger.id).status().disabled) {
    // The actual frame client writes through the gateway's callback; a routing
    // collision must stop admission before dispatch, never silently rewrite it.
    try { messenger.client.send({ type: 'topic.send', id: 'routing-check', topic: 'general', text: 'routing check' }); }
    catch (error) { assert.match((error as Error).message, /protocol routing/); }
  }
  await until(() => state.forMessenger(messenger.id).status().disabled || messenger.client.frames.some(frame => frame.type === 'result' && frame.id === 'routing-check' && frame.ok === true), { what: 'exact routed message or disabled gateway receipt', timeoutMs: 2000 });
  const history = await local.request({ type: 'topic.history', topic: 'general' });
  const messages = (history.value as { messages: TopicMessage[] }).messages;
  const posted = messages.find(message => message.text === 'routing check');
  assert.ok(posted?.topic === 'general' || state.forMessenger(messenger.id).status().disabled, 'request kept its route or gateway stopped safely');
  assert.ok(messenger.client.frames.every(frame => typeof frame.type === 'string' && frame.type !== '[redacted]' && !Object.hasOwn(frame, '[redacted]')), 'delivered frames retain keys and discriminators');
});

test('previous plain-function redaction injection masks structured payloads with the supplied policy', async t => {
  const root = await tempProject(t);
  const hub = await projectHub(t, root);
  const output = remoteRedactor(['made-up-custom-policy']);
  const messenger = testMessenger();
  const gateway = new Gateway(hub.dispatcher, [messenger], { redact: text => output(text) });
  onCleanup(t, () => gateway.stop());
  await gateway.start();
  const sent = await messenger.client.request({ type: 'topic.send', topic: 'general', text: 'made-up-custom-policy' });
  assert.equal(sent.ok, true, sent.error);
  assert.ok((sent.value as { message: TopicMessage }).message.text === '[redacted]', 'plain function policy masks structured payloads');
  const local = await connectUi(t, hub.discovery);
  const received = messenger.client.waitFor(frame => frame.type === 'message' && (frame.message as TopicMessage).text === 'outbound [redacted]');
  const posted = await local.request({ type: 'topic.send', topic: 'general', text: 'outbound made-up-custom-policy' });
  assert.equal(posted.ok, true, posted.error);
  assert.equal(((await received).message as TopicMessage).id, (posted.value as { message: TopicMessage }).message.id);
});

test('cancelled remote sink cleanup drains a held journal write and observes native close before removing its root', async t => {
  const hooks: Array<() => Promise<void>> = [];
  const fixture = { after: (hook: () => Promise<void>) => { hooks.push(hook); } } as unknown as TestContext;
  const release = Promise.withResolvers<void>();
  let cleaning: Promise<void> | undefined;
  // Emergency release is owned before any acquisition, even on assertion failure.
  onCleanup(t, async () => { release.resolve(); await cleaning; for (const hook of hooks) await hook(); });
  const root = await tempProject(fixture);
  const path = join(root, 'remote-held.jsonl');
  const receipts: string[] = [];
  let entered = false, captured = '';
  const journal = ownedJournal(fixture, path, { open: async path => {
    const file = await open(path, 'a+');
    return {
      stat: () => file.stat(), read: (...args) => file.read(...args),
      write: async (...args) => { entered = true; await release.promise; const result = await file.write(...args); receipts.push('write drained'); return result; },
      close: async () => { await file.close(); receipts.push('native closed'); captured = await readFile(path, 'utf8'); },
    };
  } });
  const output = remoteRedactor();
  validateAndRegisterSecrets(values, output);
  journal.write(output.value({ event: 'remote-fixture', text: raw }));
  await until(() => entered, { what: 'native append held', timeoutMs: 2000 });
  const cancellation = new AbortController();
  cancellation.signal.addEventListener('abort', () => { cleaning = (async () => { for (const hook of hooks) await hook(); })(); });
  cancellation.abort();
  // A filesystem observation while cleanup owns the held append proves retention.
  assert.ok((await stat(root)).isDirectory());
  assert.deepEqual(receipts, []);
  release.resolve();
  await cleaning;
  assert.deepEqual(receipts, ['write drained', 'native closed']);
  assert.ok(JSON.parse(captured).text === masked, 'the completed native write contains only masked values');
  await assert.rejects(stat(root), { code: 'ENOENT' });
});

test('startup and reload resolve the explicit daemon environment without changing process.env', async t => {
  const root = await tempProject(t);
  seed(root);
  const injected = `123456:${'fake_injected_'.repeat(3)}`;
  const config = defaultConfig('Injected secrets');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const observed: string[] = [];
  const remotes: ReturnType<typeof testMessenger>[] = [];
  assert.ok(process.env.CLAND_TELEGRAM_TOKEN !== injected, 'the override exists only in the explicit daemon environment');
  const hub = await projectHub(t, root, {}, {
    syntheticRemoteSecrets: { 'telegram.token': injected },
    gatewayMessenger: (via, token) => {
      observed.push(token);
      const remote = testMessenger(via, via);
      remotes.push(remote);
      return remote;
    },
  });
  const local = await connectUi(t, hub.discovery);
  assert.equal(observed.length, 1);
  assert.ok(observed[0] === injected, 'startup selects the injected override over the file');
  setSecret(root, 'telegram.token', `123456:${'fake_rotated_'.repeat(3)}`);
  setSecret(root, 'speech.xai_key', 'fake-reload-speech-key');
  const reloaded = await local.request({ type: 'hub.reload' });
  assert.equal(reloaded.ok, true, reloaded.error);
  assert.equal(observed.length, 2);
  assert.ok(observed[1] === injected, 'reload still selects the injected override over the changed file');
  assert.equal(remotes[0]!.stopped, true, 'reload result follows old messenger stop');
  assert.equal((await remotes[1]!.client.request({ type: 'hub.status' })).ok, true, 'replacement is serving before reload completes');
  assert.ok(process.env.CLAND_TELEGRAM_TOKEN !== injected, 'the process environment remains untouched');
});

test('reload registers every rotated secret before constructing a replacement messenger', async t => {
  const root = await tempProject(t);
  seed(root);
  const config = defaultConfig('Reload registration');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const rotated: Secrets = {
    'telegram.token': `123456:${'fake_rotated_'.repeat(3)}`, 'discord.token': 'fake-rotated-discord',
    'speech.elevenlabs_key': 'fake-rotated-elevenlabs', 'speech.xai_key': 'fake-rotated-xai',
  };
  let constructions = 0;
  const first = testMessenger('telegram');
  const state = testRemoteStates();
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { gatewayState: state, log: entry => { logs.push(entry); }, gatewayMessenger: () => {
    if (++constructions === 1) return first;
    throw new Error(`replacement failed ${raw} ${Object.values(rotated).join(' ')}`);
  } });
  const local = await connectUi(t, hub.discovery);
  seed(root, rotated);
  const reloaded = await local.request({ type: 'hub.reload' });
  assert.equal(reloaded.ok, true, reloaded.error);
  assert.equal(constructions, 2);
  assert.equal(first.stopped, true, 'old messenger stopped before replacement');
  assert.ok(state.forMessenger('telegram').status().reason === `replacement failed ${masked} ${masked}`, 'old and rotated credentials are registered before construction failure');
  assert.ok(logs.some(entry => entry.event === 'remote-disabled' && entry.reason === `replacement failed ${masked} ${masked}`), 'replacement error is masked in its actual log receipt');
});

test('an invalid injected Telegram override is refused before the configured messenger is constructed', async t => {
  const root = await tempProject(t);
  seed(root);
  const config = defaultConfig('Injected validation');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  let constructed = false;
  await assert.rejects(projectHub(t, root, {}, {
    syntheticRemoteSecrets: { 'telegram.token': 'malformed-fake-injected-override' },
    gatewayMessenger: via => { constructed = true; return testMessenger(via, via); },
  }), error => {
    assert.ok((error as Error).message === 'telegram.token: invalid token format (at most 80 characters)', 'injected-environment diagnostic is fixed and value-free');
    return true;
  });
  assert.equal(constructed, false, 'provider construction has not built a credential-bearing URL');
  await assert.rejects(readFile(join(root, '.cland/hub.lock')), { code: 'ENOENT' });
});

test('gateway masks hub-owned endpoint metadata but still refuses a credential in an inbound routing field', async t => {
  const root = await tempProject(t);
  seed(root);
  const messenger = testMessenger();
  const state = testRemoteStates();
  const hub = await projectHub(t, root, {}, { gatewayRemotes: [messenger], gatewayState: state });
  const local = await connectUi(t, hub.discovery);
  const before = await local.request({ type: 'topic.history', topic: 'general' });
  assert.equal(before.ok, true, before.error);
  assert.throws(() => messenger.client.send({ type: 'topic.send', id: 'inbound-endpoint', topic: 'general',
    text: 'must not arrive', harnessId: `http://127.0.0.1:1234/${values['discord.token']}`, attach: 'http://127.0.0.1:1234' }), /protocol routing/);
  await until(() => state.forMessenger(messenger.id).status().disabled, { timeoutMs: 1000, what: 'inbound routing refusal disables only its remote' });
  assert.equal(state.forMessenger(messenger.id).status().reason, 'remote output would alter protocol routing');
  const after = await local.request({ type: 'topic.history', topic: 'general' });
  assert.equal((after.value as { messages: TopicMessage[] }).messages.some(message => message.text === 'must not arrive'), false);
  assert.equal((await local.request({ type: 'inbox.list' })).ok, true);
});
