// T2: setup's sealed CLI/runner and real frame port with an in-process hub and fake messenger only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { runSetup } from '../src/cli/setup.ts';
import { setupHub } from '../src/setup/hub.ts';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { readSecretsFile } from '../src/remote/secrets.ts';
import type { Inbox } from '../src/protocol.ts';
import type { SetupMachine } from '../src/setup/types.ts';
import { connectUi, projectHub, tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { testMessenger } from './fakes/messenger.ts';
import { scriptedPrompter } from './setup-prompter.ts';

async function fixture(t: test.TestContext) {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'));
  const config = defaultConfig('Setup remote');
  config.speech.provider = '';
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  await writeFile(join(root, '.cland/roles.toml'), '[aide.launch]\nharness="opencode" # the human\'s favourite, chosen in cland setup\n');
  const remotes: ReturnType<typeof testMessenger>[] = [];
  const logs: Record<string, unknown>[] = [];
  const hub = await projectHub(t, root, {}, { log: entry => { logs.push(entry); }, gatewayMessenger: via => {
    assert.equal(via, 'telegram');
    const remote = testMessenger('setup-telegram');
    remotes.push(remote);
    return { ...remote, status: () => ({ connected: true, lastInbound: null, lastOutbound: null, botLink: 'https://t.me/setup_fixture_bot' }) };
  } });
  const client = setupHub(root, fixtureEnvironment(root, {}));
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const machine: SetupMachine = {
    projectExists: async () => true, requiredHarnesses: async () => ['opencode'], onPath: async () => true,
    read: async path => readFile(join(root, '.cland', path), 'utf8'),
    write: async () => { throw new Error('unexpected machine write'); }, run: async () => { throw new Error('unexpected child'); },
    harness: async id => ({ id, bin: id === 'opencode' ? '/fake/opencode' : null, version: [1, 0, 0], checks: [
      { name: id, verdict: 'ok', detail: 'installed' }, { name: `${id} auth`, verdict: 'ok', detail: 'logged in' },
    ] }),
  };
  return { root, hub, client, ui, machine, remotes, logs };
}

test('terminal setup stores a hidden Telegram token, reloads through frames and reports pairing before the Aide', async t => {
  const f = await fixture(t);
  const token = '123456:made_up_setup_token_abcdefghijk';
  let output = '';
  const script = scriptedPrompter([
    { kind: 'confirm', question: 'Set up Telegram remote now?', answer: true },
    { kind: 'secret', question: 'Telegram token:', answer: token },
    { kind: 'pause', question: /press Start, then Enter/ },
    { kind: 'confirm', question: 'No waiting code. Wait once more?', answer: false }, { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }]);
  const code = await runSetup(['--yes', '--no-accounts'], f.root, fixtureEnvironment(f.root, {}), {
    stdinTTY: true, stdoutTTY: true, machine: f.machine, hub: f.client,
    prompter: script, write: text => { output += text; }, run: async () => 0,
  });
  assert.equal(script.left().length, 0, 'the offer and hidden input completed');
  assert.equal(code, 1, 'unpaired setup stays open');
  assert.ok(/@BotFather/.test(output), 'BotFather guidance is printed');
  assert.ok(/\/newbot/.test(output), 'bot creation command is printed');
  assert.ok(/ok +hub .*\nopen +remote telegram .*https:\/\/t.me\/setup_fixture_bot.*cland remote approve telegram <code>\nskip +remote discord .*\nok +speech .*\ndone +aide /.test(output), 'the remote row names link/approval and sits between hub and Aide');
  assert.ok(readSecretsFile(f.root)['telegram.token'] === token, 'the hidden value is stored');
  assert.equal(parseConfig(await readFile(join(f.root, '.cland/config.toml'), 'utf8'), 'Setup remote', {}).remote.telegram.enabled, true);
  assert.equal(f.remotes.length, 1);
  assert.equal(f.remotes[0]!.started, true);
  assert.equal(f.logs.filter(entry => entry.event === 'config-reloaded').length, 2, 'config-set apply and explicit reload each have completion receipts');
  assert.equal((await f.client.session('aide-1'))?.status, 'running');
  const identity = { userId: '12345', chatId: '12345', guildId: null, name: 'Fixture human' };
  f.remotes[0]!.pair(identity);
  const pairingCode = ((await f.ui.request({ type: 'inbox.list' })).value as Inbox).pairings![0]!.code;
  const approved = await f.ui.request({ type: 'pairing.approve', messenger: 'telegram', code: pairingCode });
  assert.equal(approved.ok, true, JSON.stringify(approved));
  assert.deepEqual(((await f.ui.request({ type: 'inbox.list' })).value as Inbox).pairings, []);
  let json = '';
  await runSetup(['--json', '--no-accounts'], f.root, fixtureEnvironment(f.root, {}), {
    machine: f.machine, hub: f.client, prompter: scriptedPrompter([ { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }]),
    write: text => { json += text; }, narrate: text => { output += text; },
  });
  assert.equal(json.includes(token), false, 'JSON contains no token before parsing');
  assert.equal(JSON.parse(json).steps.find((row: { name: string }) => row.name === 'remote telegram').verdict, 'ok');
  const paired = await runSetup(['--yes', '--no-accounts', '--no-aide'], f.root, fixtureEnvironment(f.root, {}), {
    stdinTTY: true, stdoutTTY: true, machine: f.machine, hub: f.client, prompter: scriptedPrompter([ { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }]),
    write: text => { output += text; },
  });
  assert.equal(paired, 0, 'a paired terminal run asks nothing');
  // Disable and remove the stored token while keeping the already-approved numeric pairing.
  await f.client.configure!('remote.telegram.enabled', false);
  await unlink(join(f.root, '.cland/secrets.toml'));
  const repeat = scriptedPrompter([
    { kind: 'confirm', question: 'Set up Telegram remote now?', answer: true },
    { kind: 'secret', question: 'Telegram token:', answer: token }, { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }]);
  assert.equal(await runSetup(['--yes', '--no-accounts', '--no-aide'], f.root, fixtureEnvironment(f.root, {}), {
    stdinTTY: true, stdoutTTY: true, machine: f.machine, hub: f.client, prompter: repeat, write: text => { output += text; },
  }), 0);
  assert.ok(/done +remote telegram .*paired/.test(output), 'reconfiguration with a retained pairing completes');
  assert.equal(repeat.left().length, 0);
  await f.hub.stop();
  const log = await readFile(join(f.root, '.cland/log/hub.log'), 'utf8');
  assert.equal((output + json + log + JSON.stringify(f.logs)).includes(token), false, 'reports, narration and drained logs contain no token');
});

// T2: native Discord REST/ws and the ordinary setup runner/frame boundary.
for (const repair of [false, true, 'decline'] as const) test(`Discord setup checks application before enabling and pairs through native /cland pair (repair=${repair})`, async t => {
  const { discordExchangeOwner } = await import('./fakes/discord/exchange.ts');
  const { DISCORD_TEST_TOKEN, DISCORD_IDS: ids } = await import('./fakes/discord/fake-api.ts');
  const { until } = await import('./harness.ts');
  const { setup } = await import('../src/setup/runner.ts');
  const owner = discordExchangeOwner(t);
  const native = await owner.start();
  const { root } = await native.project();
  await native.fake.control('configure', { interval: 100 });
  const { pacingOwner } = await import('./telegram-pacing-fixture.ts');
  const { realClock } = await import('../src/hub/clock.ts');
  const setupOwner = pacingOwner(t);
  native.stop(setupOwner.dispose);
  await mkdir(join(root, '.cland'));
  const config = defaultConfig('Discord setup'); config.speech.provider = ''; config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  await writeFile(join(root, '.cland/roles.toml'), '[aide.launch]\nharness="opencode" # the human\'s favourite, chosen in cland setup\n');
  const env = fixtureEnvironment(root, {}, { CLAND_DISCORD_API_ROOT: native.fake.url });
  assert.equal(env.CLAND_DISCORD_API_ROOT, native.fake.url, 'effective API root is the owned fake');
  assert.equal(new URL(env.CLAND_DISCORD_API_ROOT).hostname, '127.0.0.1', 'synthetic token I/O is loopback only');
  await setupOwner.start(root, env, realClock);
  const client = setupHub(root, env);
  const machine: SetupMachine = {
    projectExists: async () => true, requiredHarnesses: async () => [], onPath: async () => true,
    read: async path => readFile(join(root, '.cland', path), 'utf8'),
    write: async () => { throw new Error('unexpected write'); }, run: async () => { throw new Error('unexpected child'); },
    harness: async id => ({ id, bin: id === 'opencode' ? '/fake/opencode' : null, version: [1, 0, 0], checks: [{ name: id, verdict: 'ok', detail: 'installed' }, { name: `${id} auth`, verdict: 'ok', detail: 'logged in' }] }),
  };
  if (repair) await native.fake.control('configure', { application: { bot_public: true, flags: 0, interactions_endpoint_url: 'https://unused.invalid' } });
  let output = '';
  const script = scriptedPrompter([
    { kind: 'confirm', question: 'Set up Telegram remote now?', answer: false },
    { kind: 'confirm', question: 'Set up Discord remote now?', answer: true },
    { kind: 'secret', question: 'Discord token:', answer: DISCORD_TEST_TOKEN },
    ...(repair ? [{ kind: 'confirm' as const, question: 'Re-check Discord application settings?', answer: repair !== 'decline' }] : []),
    ...(repair === 'decline' ? [] : [
      { kind: 'pause' as const, question: /run \/cland pair in the server channel, then Enter/ },
      { kind: 'confirm' as const, question: new RegExp(`Pair Discord user ${ids.human} \\(.*\\)\\? code `), answer: true },
    ]),
  ]);
  const options = { root, env, machine, hub: client, noAide: true, noAccounts: true, yes: true, interactive: true, narrate: (text: string) => { output += text; }, prompter: {
    ...script,
    secret: async (question: string) => {
      for (const text of ['Install Link', 'None', 'Public Bot', 'Message Content', 'Interactions Endpoint URL']) assert.ok(output.includes(text));
      return script.secret(question);
    },
    confirm: async (q: string, def: boolean) => {
      assert.equal(def, false);
      if (q === 'Re-check Discord application settings?') {
        assert.equal(parseConfig(await readFile(join(root, '.cland/config.toml'), 'utf8'), 'Discord setup', {}).remote.discord.enabled, false);
        for (const text of ['Turn Public Bot off.', 'Enable Message Content Intent.', 'Clear Interactions Endpoint URL.']) assert.ok(output.includes(text));
        if (repair !== 'decline') await native.fake.control('configure', { application: { bot_public: false, flags: 1 << 19, interactions_endpoint_url: null } });
      }
      return script.confirm(q, def);
    },
    pause: async (q: string) => {
      await native.run(() => until(async () => (await native.fake.control('state')).gateway.identifies === 1, { timeoutMs: 2000, what: 'Discord native Identify' }));
      const interaction = await native.fake.control('interact', {});
      await native.run(() => until(async () => (await native.fake.control('state')).interactions.some(row => row.id === interaction.id && row.callbacks.length > 0), { timeoutMs: 2000, what: 'private pairing code callback' }));
      await script.pause(q);
    },
  } };
  const result = await native.run(() => setupOwner.observe(signal => setup({ ...options, signal })));
  assert.equal(script.left().length, 0, JSON.stringify(result.report.steps));
  assert.deepEqual(result.report.steps.slice(-5).map(row => row.name), ['hub', 'remote telegram', 'remote discord', 'speech', 'aide']);
  if (repair === 'decline') {
    assert.equal(result.report.steps.find(row => row.name === 'remote discord')?.verdict, 'open');
    assert.equal(parseConfig(await readFile(join(root, '.cland/config.toml'), 'utf8'), 'Discord setup', {}).remote.discord.enabled, false);
    assert.equal((await native.fake.control('state')).gateway.identifies, 0);
    return;
  }
  assert.equal(result.report.steps.find(row => row.name === 'remote discord')?.verdict, 'done');
  assert.ok(output.includes(`client_id=${ids.application}&scope=bot&permissions=117824`));
  assert.ok(readSecretsFile(root)['discord.token'] === DISCORD_TEST_TOKEN, 'hidden token stored');
  const row = (await client.remotes!()).remotes.find(row => row.messenger === 'discord')!;
  assert.equal(row.pairing?.userId, ids.human);
  assert.equal(parseConfig(await readFile(join(root, '.cland/config.toml'), 'utf8'), 'Discord setup', {}).remote.discord.enabled, true);
  const again = await setup({ ...options, interactive: false, prompter: scriptedPrompter([]) });
  assert.equal(again.report.steps.find(row => row.name === 'remote discord')?.verdict, 'ok');
  await owner.close();
  assert.equal((output + JSON.stringify(result) + await readFile(join(root, '.cland/log/hub.log'), 'utf8')).includes(DISCORD_TEST_TOKEN), false, 'no credential in output or drained log');
});

for (const failure of ['omitted', 'aborted'] as const) test(`Discord setup fixture joins hub and native close after ${failure} setup receipt`, async t => {
  const { discordExchangeOwner } = await import('./fakes/discord/exchange.ts');
  const { pacingOwner } = await import('./telegram-pacing-fixture.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const { realClock } = await import('../src/hub/clock.ts');
  const owner = discordExchangeOwner(t);
  const native = await owner.start();
  const setupOwner = pacingOwner(t);
  native.stop(setupOwner.dispose);
  const { root, remove } = await native.project();
  const { stat } = await import('node:fs/promises');
  await mkdir(join(root, '.cland'));
  const config = defaultConfig('Discord setup cancellation'); config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const env = fixtureEnvironment(root, {}, { CLAND_DISCORD_API_ROOT: native.fake.url });
  assert.equal(env.CLAND_DISCORD_API_ROOT, native.fake.url);
  assert.equal(new URL(env.CLAND_DISCORD_API_ROOT).hostname, '127.0.0.1');
  const clock = new FakeClock();
  const abort = new AbortController();
  const closed = native.fake.waitForGatewayClose();
  const starting = setupOwner.start(root, env, realClock, { receipt: new Promise<void>(() => {}), clock, signal: abort.signal });
  const rejected = assert.rejects(starting, failure === 'omitted' ? /setup receipt deadline/ : /cancelled/);
  const hub = await native.run(() => setupOwner.serving);
  if (failure === 'omitted') await clock.advance(1000);
  else abort.abort(new Error('Discord setup cancelled'));
  await rejected;
  assert.ok((await stat(root)).isDirectory(), 'root retained before drainage');
  await native.run(() => setupOwner.dispose());
  await native.fake.closeGateway();
  await closed;
  await owner.close();
  await hub.stopped;
  assert.equal(setupOwner.observations(), 0);
  assert.equal(clock.pending, 0);
  assert.deepEqual(native.fake.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, observers: 0, held: 0 });
  assert.ok((await stat(root)).isDirectory(), 'root retained through stopped and native close receipts');
  await remove();
  await assert.rejects(stat(root), { code: 'ENOENT' });
});

test('Discord setup cancellation joins a held native application read before root cleanup', async t => {
  const { discordExchangeOwner } = await import('./fakes/discord/exchange.ts');
  const { pacingOwner } = await import('./telegram-pacing-fixture.ts');
  const { DISCORD_TEST_TOKEN } = await import('./fakes/discord/fake-api.ts');
  const { setSecret } = await import('../src/remote/secrets.ts');
  const { discord } = await import('../src/setup/steps/discord.ts');
  const owner = discordExchangeOwner(t);
  const native = await owner.start();
  const setupOwner = pacingOwner(t);
  native.stop(setupOwner.dispose);
  const { root, remove } = await native.project();
  const { stat } = await import('node:fs/promises');
  await mkdir(join(root, '.cland'));
  const config = defaultConfig('Discord held setup'); config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const env = fixtureEnvironment(root, {}, { CLAND_DISCORD_API_ROOT: native.fake.url });
  assert.equal(env.CLAND_DISCORD_API_ROOT, native.fake.url);
  assert.equal(new URL(env.CLAND_DISCORD_API_ROOT).hostname, '127.0.0.1');
  setSecret(root, 'discord.token', DISCORD_TEST_TOKEN);
  await native.fake.control('fault', { method: 'GET', response: 'hold' });
  const held = native.fake.waitForHold();
  const closed = native.fake.waitForGatewayClose();
  const work = native.run(() => setupOwner.observe(signal => discord({ root, env, signal, interactive: true, yes: true,
    prompter: scriptedPrompter([{ kind: 'confirm', question: 'Set up Discord remote now?', answer: true }]),
    machine: { projectExists: async () => true, requiredHarnesses: async () => [], onPath: async () => true,
      read: async path => readFile(join(root, '.cland', path), 'utf8'),
      write: async () => { throw new Error('unexpected write'); }, run: async () => { throw new Error('unexpected child'); },
      harness: async id => ({ id, bin: null, version: null, checks: [] }),
    },
  })));
  const rejected = assert.rejects(work, /cancelled/);
  assert.ok(await held > 0);
  assert.ok((await stat(root)).isDirectory(), 'root retained before drainage');
  await native.run(() => setupOwner.dispose());
  await rejected;
  await native.fake.closeGateway();
  await closed;
  await owner.close();
  assert.equal(parseConfig(await readFile(join(root, '.cland/config.toml'), 'utf8'), 'Discord held setup', {}).remote.discord.enabled, false);
  assert.equal(setupOwner.observations(), 0);
  assert.deepEqual(native.fake.receipts(), { listening: true, closed: true, connections: 0, handlers: 0, observers: 0, held: 0 });
  assert.ok((await stat(root)).isDirectory(), 'root retained through stopped and native close receipts');
  await remove();
  await assert.rejects(stat(root), { code: 'ENOENT' });
});
