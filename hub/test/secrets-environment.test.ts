// T3: real fake-harness and generic command child environment contracts.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { accountClaude, accountFixtureEnvironment } from './account-fixture-env.ts';
import { connectUi, eventually, projectHub, tempProject } from './harness.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { launchSecretCommand, secretProject } from './secrets-fixture.ts';
import { ClaudeCodeAdapter } from '../src/adapters/claude-code.ts';
import type { HarnessProcessView } from '../src/protocol.ts';

const fakeSecrets = {
  CLAND_TELEGRAM_TOKEN: `123456:${'fake_override_'.repeat(3)}`,
  CLAND_DISCORD_TOKEN: 'fake-discord-override',
  ELEVENLABS_API_KEY: 'fake-elevenlabs-override',
  XAI_API_KEY: 'fake-xai-override',
};
const names = Object.keys(fakeSecrets);

test('generic speech stand-in command receives no remote secrets after the final overlay filter', async t => {
  const { root } = await secretProject(t);
  const command = launchSecretCommand(t, root, 'process.stdout.write(JSON.stringify(Object.keys(process.env).filter(name => /^(CLAND_(TELEGRAM_TOKEN|DISCORD_TOKEN|SPEECH_MIME|SPEECH_LANGUAGE)|ELEVENLABS_API_KEY|XAI_API_KEY)$/.test(name))))', {
    env: { ...fakeSecrets, CLAND_SPEECH_MIME: 'audio/ogg', CLAND_SPEECH_LANGUAGE: 'en' },
  });
  const result = await command.result;
  assert.equal(result.incomplete, null, `command completion: exit ${result.code}; signal ${result.signal}; ${result.stderr.slice(-500)}`);
  assert.equal(result.code, 0, 'generic command completes normally');
  const inherited = JSON.parse(result.stdout) as string[];
  for (const name of names) assert.equal(inherited.includes(name), false, name);
  assert.equal(inherited.includes('CLAND_SPEECH_MIME'), true);
  assert.equal(inherited.includes('CLAND_SPEECH_LANGUAGE'), true);
});

test('real fake harness launch and session receive none of the four remote secret overrides', async t => {
  const root = await tempProject(t);
  const fake = await accountClaude(t);
  const sealed = await accountFixtureEnvironment(fake.env);
  const hub = await projectHub(t, root, fake.env, { adapters: [(host, clock) => new ClaudeCodeAdapter(host, {
    clock, bin: fake.env.CLAND_CLAUDE_BIN!,
    // Synthetic provider inputs belong to the subject adapter, never the fixture launch builder.
    env: { ...sealed, ...fakeSecrets },
  })] });
  const ui = await connectUi(t, hub.discovery);
  const launched = await ui.request({ type: 'session.launch', harness: 'claude-code', name: 'secret-check' }, 10_000);
  assert.equal(launched.ok, true, launched.error);
  const session = (launched.value as { process: HarnessProcessView }).process;
  const receipt = await eventually('fake session environment receipt', async () => {
    try { return JSON.parse(await readFile(join(fake.home, 'jobs', `${session.harnessId}.environment`), 'utf8')) as { launch: string[]; session: string[] }; }
    catch { return undefined; }
  }, 5000);
  for (const name of names) {
    assert.equal(receipt.launch.includes(name), false, `launcher: ${name}`);
    assert.equal(receipt.session.includes(name), false, `session: ${name}`);
  }
  assert.equal((await ui.request({ type: 'session.stop', session: session.name })).ok, true);
  await hub.stop();
});


test('cancelled command with a missing close receipt retains its root until native close and output drain', { timeout: 15_000 }, async t => {
  const { root, remove } = await secretProject(t);
  const ready = Promise.withResolvers<void>();
  const stopping = Promise.withResolvers<void>();
  const partial = Promise.withResolvers<void>();
  let stoppingObserved = false;
  void stopping.promise.then(() => { stoppingObserved = true; }, () => {});
  let timer = setTimeout(() => {
    ready.reject(new Error('command readiness receipt missing'));
  }, 5000); // lint-allow-wall-clock: bound native readiness separately from cancellation, never an elapsed-time assertion
  void stopping.promise.catch(() => {});
  void partial.promise.catch(() => {});
  const watcher = watch(root, () => {
    if (existsSync(join(root, 'ready')) && readFileSync(join(root, 'ready'), 'utf8') === 'waiting for input') ready.resolve();
    if (existsSync(join(root, 'stopping')) && readFileSync(join(root, 'stopping'), 'utf8') === 'signal handled') stopping.resolve();
    if (existsSync(join(root, 'stopping-incomplete'))) partial.resolve();
  });
  let observerClosed = false;
  watcher.once('close', () => { observerClosed = true; });
  beforeDirectories(t, () => { watcher.close(); clearTimeout(timer); });
  const controller = new AbortController();
  // Observer and root's stop/drain barrier are armed before launching this held child.
  const command = launchSecretCommand(t, root, `
    const fs = require('node:fs');
    let cancelling = false;
    const publication = fs.watch('.', () => {
      if (!fs.existsSync('complete-stopping')) return;
      publication.close();
      fs.writeFileSync('stopping', 'signal handled');
    });
    process.on('SIGTERM', () => {
      if (cancelling) return;
      cancelling = true;
      fs.writeFileSync('stopping', '');
      fs.writeFileSync('stopping-incomplete', '');
    });
    process.stdin.once('data', () => process.exit(0));
    fs.writeFileSync('ready', 'waiting for input');
  `, { signal: controller.signal, env: fakeSecrets });
  let closed = false;
  let settled = false;
  void command.closed.then(() => { closed = true; });
  void command.result.then(() => { settled = true; });
  await ready.promise;
  clearTimeout(timer);
  assert.equal(readFileSync(join(root, 'ready'), 'utf8'), 'waiting for input');
  timer = setTimeout(() => {
    partial.reject(new Error('partial cancellation marker receipt missing'));
    stopping.reject(new Error('command cancellation receipt missing'));
  }, 5000); // lint-allow-wall-clock: bound cancellation receipts after readiness, never an elapsed-time assertion
  controller.abort(new Error('intentional generic command cancellation'));
  const removing = remove();
  try {
    await partial.promise;
    assert.equal(readFileSync(join(root, 'stopping'), 'utf8'), '', 'marker exists before its content is published');
    assert.equal(stoppingObserved, false, 'an empty marker is not the cancellation receipt');
    writeFileSync(join(root, 'complete-stopping'), '');
    await stopping.promise;
    assert.equal(readFileSync(join(root, 'stopping'), 'utf8'), 'signal handled');
    assert.equal(closed, false, 'a signal is not the missing native close receipt');
    assert.equal(settled, false, 'the result still waits for close/output completion');
    assert.equal(existsSync(root), true, 'beforeRemove retains the live writer root');
  } finally {
    try {
      const observerClose = once(watcher, 'close', { signal: AbortSignal.timeout(5000) });
      watcher.close();
      clearTimeout(timer);
      await observerClose;
      assert.equal(observerClosed, true, 'filesystem observer closes before child release and root removal');
    } finally {
      command.endInput('release');
      await removing;
    }
  }
  const result = await command.result;
  assert.equal(closed, true);
  assert.equal(settled, true);
  assert.equal(result.incomplete, 'ABORT_ERR');
  assert.equal(result.code, 0, 'held child exited only after explicit release');
  assert.equal(result.signal, null);
  assert.equal(existsSync(root), false, 'removal follows both native receipts');
});
