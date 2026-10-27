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
    { kind: 'confirm', question: 'No waiting code. Wait once more?', answer: false },
  ]);
  const code = await runSetup(['--yes', '--no-accounts'], f.root, fixtureEnvironment(f.root, {}), {
    stdinTTY: true, stdoutTTY: true, machine: f.machine, hub: f.client,
    prompter: script, write: text => { output += text; }, run: async () => 0,
  });
  assert.equal(script.left().length, 0, 'the offer and hidden input completed');
  assert.equal(code, 1, 'unpaired setup stays open');
  assert.ok(/@BotFather/.test(output), 'BotFather guidance is printed');
  assert.ok(/\/newbot/.test(output), 'bot creation command is printed');
  assert.ok(/ok +hub .*\nopen +remote telegram .*https:\/\/t.me\/setup_fixture_bot.*cland remote approve telegram <code>\ndone +aide /.test(output), 'the remote row names link/approval and sits between hub and Aide');
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
    machine: f.machine, hub: f.client, prompter: scriptedPrompter([]),
    write: text => { json += text; }, narrate: text => { output += text; },
  });
  assert.equal(json.includes(token), false, 'JSON contains no token before parsing');
  assert.equal(JSON.parse(json).steps.find((row: { name: string }) => row.name === 'remote telegram').verdict, 'ok');
  const paired = await runSetup(['--yes', '--no-accounts', '--no-aide'], f.root, fixtureEnvironment(f.root, {}), {
    stdinTTY: true, stdoutTTY: true, machine: f.machine, hub: f.client, prompter: scriptedPrompter([]),
    write: text => { output += text; },
  });
  assert.equal(paired, 0, 'a paired terminal run asks nothing');
  // Disable and remove the stored token while keeping the already-approved numeric pairing.
  await f.client.configure!('remote.telegram.enabled', false);
  await unlink(join(f.root, '.cland/secrets.toml'));
  const repeat = scriptedPrompter([
    { kind: 'confirm', question: 'Set up Telegram remote now?', answer: true },
    { kind: 'secret', question: 'Telegram token:', answer: token },
  ]);
  assert.equal(await runSetup(['--yes', '--no-accounts', '--no-aide'], f.root, fixtureEnvironment(f.root, {}), {
    stdinTTY: true, stdoutTTY: true, machine: f.machine, hub: f.client, prompter: repeat, write: text => { output += text; },
  }), 0);
  assert.ok(/done +remote telegram .*paired/.test(output), 'reconfiguration with a retained pairing completes');
  assert.equal(repeat.left().length, 0);
  await f.hub.stop();
  const log = await readFile(join(f.root, '.cland/log/hub.log'), 'utf8');
  assert.equal((output + json + log + JSON.stringify(f.logs)).includes(token), false, 'reports, narration and drained logs contain no token');
});
