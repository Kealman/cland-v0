// T2: execute the published Telegram walkthrough through sealed CLI and real gateway/fake Bot API.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, renderConfig } from '../src/init/config.ts';
import type { Inbox, RemoteStatusResult } from '../src/protocol.ts';
import type { TgMessage, TgUpdate } from '../src/remote/telegram-api.ts';
import { cland, connectUi, projectHub } from './harness.ts';
import { secretCli, secretProject } from './secrets-fixture.ts';
import { fakeTelegram, TELEGRAM_TEST_TOKEN } from './fakes/telegram/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import { control } from './telegram-polling-fixture.ts';
import { within } from '../src/executor/droplet/deadline.ts';
import { guidePath, source, telegramSteps } from '../../site/test/remote-docs-source.ts';

test('published Telegram command blocks run in order with stdin token and end paired', async t => {
  const steps = telegramSteps(source(guidePath));
  assert.ok(steps.length >= 6, 'published Telegram pairing blocks must be marked and nonempty');
  const { root } = await secretProject(t);
  await mkdir(join(root, '.cland'));
  const config = defaultConfig('Remote docs');
  config.verification.lockPath = join(root, 'suite.lock');
  await writeFile(join(root, '.cland/config.toml'), renderConfig(config));
  const clock = new FakeClock();
  const fake = await fakeTelegram(t, { clock });
  const hub = await projectHub(t, root, { CLAND_TELEGRAM_API_ROOT: fake.url }, { clock });
  const ui = await connectUi(t, hub.discovery, 'nvim');
  const captures: string[] = [];
  let code: string | undefined;
  let tokenEntered = false;
  let firstPoll: ReturnType<typeof fake.waitForPoll> | undefined;
  for (const step of steps) {
    assert.match(step, /^cland /, 'only visible cland commands belong in the executable walkthrough');
    const args = step.slice('cland '.length).split(/\s+/);
    if (step === 'cland config set remote.telegram.enabled true') {
      firstPoll = fake.waitForPoll();
      void firstPoll.catch(() => {}); // The fake's owner can abort an unused observer on a failed CLI step.
    }
    if (step.includes('<code>')) {
      assert.ok(code, 'the chat code must be read after Start, before approval');
      args[args.indexOf('<code>')] = code;
    }
    const result = args[0] === 'secret' && args[1] === 'set'
      ? await secretCli(t, root, args.slice(1), `${TELEGRAM_TEST_TOKEN}\n`)
      : await cland(root, ...args);
    captures.push(result.stdout, result.stderr);
    assert.equal(result.code, 0, `walkthrough command failed: ${step}; ${result.stderr}`);
    if (args[0] === 'secret' && args[1] === 'set') tokenEntered = true;
    if (step === 'cland remote status' && !code) {
      assert.match(result.stdout, /https:\/\/t.me\/cland_fixture_bot/);
      assert.ok(firstPoll, 'enable must precede status');
      await within(firstPoll, 1_000);
      await clock.advance(1_000);
      const confirmed = fake.waitForPoll();
      const update = await control<TgUpdate>(fake.url, 'say', { text: '/start' });
      const receipt = await within(confirmed, 1_000);
      assert.equal(receipt.params.offset, update.update_id + 1, 'Start is durably handled before the next step');
      const inbox = (await ui.request({ type: 'inbox.list' })).value as Inbox;
      const waiting = inbox.pairings?.find(row => row.messenger === 'telegram');
      assert.ok(waiting);
      assert.equal(waiting.userId, '101');
      assert.equal(waiting.name, 'Fixture human');
      const chat = await control<{ messages: TgMessage[] }>(fake.url, 'state');
      const invitation = chat.messages.find(message => message.chat.id === 101 && message.text?.includes('cland remote approve telegram '));
      assert.ok(invitation, 'the reader receives the actual code in their private chat');
      code = /cland remote approve telegram ([A-HJ-NP-Z2-9]{8})/.exec(invitation.text!)?.[1];
      assert.equal(code, waiting.code, 'the chat invitation and persisted local identity name the same code');
    }
  }
  assert.equal(tokenEntered, true, 'the page stores a made-up token through stdin');
  const status = (await ui.request({ type: 'remote.status' })).value as RemoteStatusResult;
  assert.deepEqual(status.remotes.find(row => row.messenger === 'telegram')?.pairing,
    { userId: '101', chatId: '101', guildId: null, name: 'Fixture human' });
  assert.deepEqual(((await ui.request({ type: 'inbox.list' })).value as Inbox).pairings, []);
  await hub.stop();
  for (const path of ['log/hub.log', 'journal.jsonl']) captures.push(await readFile(join(root, '.cland', path), 'utf8'));
  assert.equal(captures.some(text => text.includes(TELEGRAM_TEST_TOKEN)), false, 'command captures and drained logs contain no token');
});
