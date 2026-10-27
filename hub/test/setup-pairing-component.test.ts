// T2: setup's local CLI frames and scripted prompter drive the loopback fake Bot API.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { remotes } from '../src/setup/steps/remotes.ts';
import { setupHub } from '../src/setup/hub.ts';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import { setSecret } from '../src/remote/secrets.ts';
import type { SetupOptions } from '../src/setup/types.ts';
import type { TgUpdate } from '../src/remote/telegram-api.ts';
import { projectHub, tempProject } from './harness.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import { control } from './telegram-polling-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { scriptedPrompter } from './setup-prompter.ts';

async function fixture(t: test.TestContext) {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  await mkdir(join(root, '.cland'), { recursive: true });
  const config = defaultConfig('Setup pairing');
  config.remote.telegram.enabled = true;
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  setSecret(root, 'telegram.token', TELEGRAM_TEST_TOKEN);
  const initial = fake.waitForPoll();
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  await within(initial, 1_000);
  const client = setupHub(root, fixtureEnvironment(root, {}));
  const options: SetupOptions = {
    root, env: fixtureEnvironment(root, {}), interactive: true, yes: true, hub: client,
    prompter: scriptedPrompter([]), machine: {
      projectExists: async () => true, requiredHarnesses: async () => [], onPath: async () => true,
      read: async path => readFile(join(root, '.cland', path), 'utf8'),
      write: async () => { throw new Error('unexpected write'); }, run: async () => { throw new Error('unexpected child'); },
      harness: async id => ({ id, bin: null, version: null, checks: [] }),
    },
  };
  const start = async () => {
    await clock.advance(1_000);
    const confirmed = fake.waitForPoll();
    const update = await control<TgUpdate>(fake.url, 'say', { text: '/start' });
    const poll = await within(confirmed, 1_000, undefined, () => new Error('setup Start handling receipt missing'));
    assert.equal(poll.params.offset, update.update_id + 1);
  };
  return { root, hub, client, options, start };
}

test('setup confirms the fake Telegram Start identity and pairs only on yes', async t => {
  const f = await fixture(t);
  const script = scriptedPrompter([
    { kind: 'confirm', question: 'Set up Telegram remote now?', answer: true },
    { kind: 'pause', question: /https:\/\/t.me\/cland_fixture_bot.*press Start, then Enter/ },
    { kind: 'confirm', question: /^Pair Telegram user 101 \(Fixture human\)\? code [A-HJ-NP-Z2-9]{8}$/, answer: true },
  ]);
  const lines = await remotes({ ...f.options, prompter: {
    ...script,
    confirm: async (question, def) => { assert.equal(def, false, '--yes never accepts a pairing grant'); return script.confirm(question, def); },
    pause: async message => { await script.pause(message); await f.start(); },
  } });
  assert.equal(script.left().length, 0);
  assert.equal(lines[0]?.verdict, 'done');
  assert.match(lines[0]!.detail, /Fixture human \(101\)/);
  assert.deepEqual((await f.client.remotes!()).remotes[0]!.pairing,
    { userId: '101', chatId: '101', guildId: null, name: 'Fixture human' });
  const again = await remotes(f.options);
  assert.equal(again[0]?.verdict, 'ok', 'paired terminal rerun asks nothing');
  await f.hub.stop();
  const log = await readFile(join(f.root, '.cland/log/hub.log'), 'utf8');
  assert.equal((JSON.stringify(lines) + log).includes(TELEGRAM_TEST_TOKEN), false, 'no secret in reports or drained logs');
});

test('declining a waiting Telegram identity leaves it unpaired with its exact approve command', async t => {
  const f = await fixture(t);
  const script = scriptedPrompter([
    { kind: 'confirm', question: 'Set up Telegram remote now?', answer: true },
    { kind: 'pause', question: /press Start, then Enter/ },
    { kind: 'confirm', question: /^Pair Telegram user 101 \(Fixture human\)\? code /, answer: false },
  ]);
  const lines = await remotes({ ...f.options, prompter: {
    ...script,
    confirm: async (question, def) => {
      const answer = await script.confirm(question, def);
      if (question.startsWith('Pair Telegram user ')) {
        assert.equal(def, false, '--yes leaves the identity confirmation default at No');
        return def; // Enter, rather than an explicit No, with options.yes still true.
      }
      return answer;
    },
    pause: async message => { await script.pause(message); await f.start(); },
  } });
  assert.equal(script.left().length, 0);
  assert.equal(lines[0]?.verdict, 'open');
  const waiting = await f.client.pairings!();
  assert.equal(waiting.length, 1);
  assert.equal(lines[0]!.fix, waiting[0]!.command);
  assert.equal((await f.client.remotes!()).remotes[0]!.pairing, null);
});

test('nonterminal unpaired setup prints the bot link and approval command without prompting or pairing', async t => {
  const f = await fixture(t);
  const lines = await remotes({ ...f.options, interactive: false });
  assert.equal(lines[0]?.verdict, 'open');
  assert.match(lines[0]!.detail, /https:\/\/t.me\/cland_fixture_bot/);
  assert.match(lines[0]!.fix!, /cland remote approve telegram <code>/);
  assert.equal((await f.client.remotes!()).remotes[0]!.pairing, null);
});
