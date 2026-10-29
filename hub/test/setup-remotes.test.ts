// T1: setup runner and scripted prompter with sealed files and injected hub receipts; no processes or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup } from '../src/setup/runner.ts';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { scriptedPrompter } from './setup-prompter.ts';
import type { SetupOptions } from '../src/setup/types.ts';
import type { Choice } from '../src/setup/prompter.ts';
import type { SetupHub } from '../src/setup/hub.ts';
import { SPEECH_DATA_USE } from '../src/speech/provider.ts';
import { readSecretsFile } from '../src/remote/secrets.ts';
import type { InboxPairing } from '../src/protocol.ts';

function waitingPairing(code: string, messenger: 'telegram' | 'discord' = 'telegram'): InboxPairing {
  return { id: code, messenger, code, userId: code === 'ABCDEFGH' ? '101' : '202', chatId: '101', guildId: null,
    name: 'Fixture human', text: `Pair ${messenger} user? code ${code}`, command: `cland remote approve ${messenger} ${code}`,
    since: '2026-10-27T00:00:00Z', expires: '2026-10-27T01:00:00Z', layer: 'now' };
}

function pairingFixture(t: test.TestContext) {
  const f = fixture(t);
  const config = defaultConfig('Remote setup');
  config.speech.provider = '';
  config.remote.telegram.enabled = true;
  writeFileSync(f.config, renderConfig(config));
  writeFileSync(join(f.root, '.cland/secrets.toml'), '[telegram]\ntoken="123456:made_up_setup_token_abcdefghijk"\n', { mode: 0o600 });
  const approved: string[] = [];
  const client: SetupHub = {
    running: async () => ({ pid: 42 }), start: async () => { throw new Error('unexpected start'); },
    session: async () => null, launch: async () => {}, resume: async () => {}, attach: async () => '', reload: async () => {},
    remotes: async () => ({ remotes: [{ messenger: 'telegram', token: { present: true, fingerprint: 'fixture' }, pairing: null,
      connection: 'connected', reason: null, lastInbound: null, lastOutbound: null, outboxDepth: 0, mute: false, botLink: 'https://t.me/setup_fixture_bot' }] }),
    pairings: async () => [],
    approve: async (messenger, code) => { assert.equal(messenger, 'telegram'); approved.push(code); return { userId: '202', chatId: '202', guildId: null, name: 'Chosen human' }; },
  };
  return { ...f, client, approved };
}

function fixture(t: test.TestContext) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'setup-remotes-')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, '.cland'));
  const config = join(root, '.cland/config.toml');
  const settings = defaultConfig('Remote setup');
  settings.speech.provider = '';
  writeFileSync(config, renderConfig(settings));
  writeFileSync(join(root, '.cland/roles.toml'), '[aide.launch]\nharness="opencode" # the human\'s favourite, chosen in cland setup\n');
  const options: SetupOptions = {
    root, env: fixtureEnvironment(root, {}), interactive: false, yes: false, noAide: true, noAccounts: true,
    prompter: scriptedPrompter([]), machine: {
      projectExists: async () => true, requiredHarnesses: async () => [], onPath: async () => true,
      read: async path => readFileSync(join(root, '.cland', path), 'utf8'),
      write: async () => { throw new Error('unexpected machine write'); },
      run: async () => { throw new Error('unexpected child'); },
      harness: async id => ({ id, bin: id === 'opencode' ? '/fake/opencode' : null, version: [1, 0, 0], checks: [{ name: id, verdict: 'ok', detail: 'installed' }, { name: `${id} auth`, verdict: 'ok', detail: 'logged in' }] }),
    },
  };
  return { root, config, options };
}

test('untouched nonterminal Telegram is skip with exact setup commands and no writes', async t => {
  const f = fixture(t);
  const before = readFileSync(f.config, 'utf8');
  const result = await setup(f.options);
  const line = result.report.steps.find(row => row.name === 'remote telegram');
  assert.equal(line?.verdict, 'skip');
  assert.equal(line.fix, 'cland secret set telegram.token; cland config set remote.telegram.enabled true; cland hub reload');
  assert.equal(readFileSync(f.config, 'utf8'), before);
  assert.equal(existsSync(join(f.root, '.cland/secrets.toml')), false);
});

test('a terminal Telegram offer stores a hidden token and enables it without starting a hub under no-aide', async t => {
  const f = fixture(t);
  const token = '123456:made_up_setup_token_abcdefghijk';
  const said: string[] = [];
  const script = scriptedPrompter([
    { kind: 'confirm', question: 'Set up Telegram remote now?', answer: true },
    { kind: 'secret', question: 'Telegram token:', answer: token }, { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }]);
  const result = await setup({ ...f.options, interactive: true, yes: true, narrate: text => said.push(text), prompter: {
    ...script,
    confirm: async (question, def) => { assert.equal(def, false); return script.confirm(question, def); },
    secret: async question => {
      assert.match(said.join(''), /@BotFather/);
      assert.match(said.join(''), /\/newbot/);
      return script.secret(question);
    },
  } });
  const lines = result.report.steps;
  assert.deepEqual(lines.slice(-5).map(row => row.name), ['hub', 'remote telegram', 'remote discord', 'speech', 'aide']);
  const line = lines.find(row => row.name === 'remote telegram')!;
  assert.equal(line.verdict, 'open');
  assert.match(line.fix!, /cland hub reload/);
  assert.match(line.fix!, /cland remote approve telegram <code>/);
  assert.equal(parseConfig(readFileSync(f.config, 'utf8'), 'Remote setup', {}).remote.telegram.enabled, true);
  const { readSecretsFile } = await import('../src/remote/secrets.ts');
  assert.ok(readSecretsFile(f.root)['telegram.token'] === token, 'hidden input is stored without a diagnostic containing it');
  assert.equal((said.join('') + JSON.stringify(result)).includes(token), false);
  assert.equal(script.left().length, 0, 'all scripted questions were consumed');
});

test('malformed Telegram input names the expected format and retries only the hidden question', async t => {
  const f = fixture(t);
  const bad = 'malformed-setup-token';
  const good = '123456:made_up_setup_token_abcdefghijk';
  let said = '';
  const script = scriptedPrompter([
    { kind: 'confirm', question: 'Set up Telegram remote now?', answer: true },
    { kind: 'secret', question: 'Telegram token:', answer: bad },
    { kind: 'secret', question: 'Telegram token:', answer: good }, { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }]);
  const result = await setup({ ...f.options, interactive: true, yes: true, prompter: script, narrate: text => { said += text; } });
  assert.equal(script.left().length, 0, 'all scripted questions were consumed');
  assert.ok(/\^\[1-9\].*24,.*80 characters/.test(said), 'invalid input names the Telegram format and length bound');
  const { readSecretsFile } = await import('../src/remote/secrets.ts');
  assert.ok(readSecretsFile(f.root)['telegram.token'] === good, 'only valid input is stored');
  for (const token of [bad, good]) assert.equal((said + JSON.stringify(result)).includes(token), false, 'setup output contains no secret input');
});

test('declining Telegram writes nothing and the next terminal run offers it again', async t => {
  const f = fixture(t);
  const before = readFileSync(f.config, 'utf8');
  for (let run = 0; run < 2; run++) {
    const script = scriptedPrompter([{ kind: 'confirm', question: 'Set up Telegram remote now?', answer: false }, { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }]);
    const result = await setup({ ...f.options, interactive: true, yes: true, prompter: script });
    assert.equal(result.report.steps.find(row => row.name === 'remote telegram')?.verdict, 'skip');
    assert.equal(script.left().length, 0);
    assert.equal(readFileSync(f.config, 'utf8'), before);
    assert.equal(existsSync(join(f.root, '.cland/secrets.toml')), false);
    assert.equal(existsSync(join(f.root, '.cland/.gitignore')), false);
  }
});

for (const present of [false, true]) for (const enabled of [false, true]) {
  if (!present && !enabled) continue;
  test(`nonterminal Telegram token=${present} enabled=${enabled} reports only missing work without asking`, async t => {
    const f = fixture(t);
    const config = defaultConfig('Remote setup');
    config.speech.provider = '';
    config.remote.telegram.enabled = enabled;
    writeFileSync(f.config, renderConfig(config));
    if (present) writeFileSync(join(f.root, '.cland/secrets.toml'), '[telegram]\ntoken="123456:made_up_setup_token_abcdefghijk"\n', { mode: 0o600 });
    const before = readFileSync(f.config, 'utf8');
    const result = await setup(f.options);
    const line = result.report.steps.find(row => row.name === 'remote telegram')!;
    assert.equal(line.verdict, 'open');
    assert.equal(line.fix!.includes('cland secret set telegram.token'), !present);
    assert.equal(line.fix!.includes('cland config set remote.telegram.enabled true'), !enabled);
    assert.match(line.fix!, /cland hub reload/);
    if (present && enabled) assert.match(line.fix!, /cland remote approve telegram <code>/);
    assert.equal(readFileSync(f.config, 'utf8'), before);
  });
}

test('secret destination preflight refuses unsafe ignore rules before requesting a token', async t => {
  const f = fixture(t);
  writeFileSync(join(f.root, '.cland/.gitignore'), '!secrets.toml\n');
  const script = scriptedPrompter([{ kind: 'confirm', question: 'Set up Telegram remote now?', answer: true }, { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }]);
  const before = readFileSync(f.config, 'utf8');
  const result = await setup({ ...f.options, interactive: true, yes: true, prompter: script });
  assert.equal(result.report.steps.find(row => row.name === 'remote telegram')?.verdict, 'fail');
  assert.deepEqual(script.asked, ['Set up Telegram remote now?', 'Set up Discord remote now?']);
  assert.equal(existsSync(join(f.root, '.cland/secrets.toml')), false);
  assert.equal(readFileSync(f.config, 'utf8'), before);
});

test('a stored pairing without a loaded connected remote remains open for reload', async t => {
  const f = fixture(t);
  const config = defaultConfig('Remote setup');
  config.speech.provider = '';
  config.remote.telegram.enabled = true;
  writeFileSync(f.config, renderConfig(config));
  writeFileSync(join(f.root, '.cland/secrets.toml'), '[telegram]\ntoken="123456:made_up_setup_token_abcdefghijk"\n', { mode: 0o600 });
  // Frozen previous remote.status wire shape: setup adds no fields to this contract.
  const client = {
    running: async () => ({ pid: 42 }), start: async () => { throw new Error('unexpected start'); },
    session: async () => null, launch: async () => {}, resume: async () => {}, attach: async () => '',
    remotes: async () => ({ remotes: [{ messenger: 'telegram' as const,
      token: { present: false, fingerprint: null }, pairing: { userId: '12345', chatId: '12345', guildId: null, name: 'Fixture human' },
      connection: 'disabled' as const, reason: null, lastInbound: null, lastOutbound: null, outboxDepth: 0, mute: false, botLink: null,
    }] }),
  };
  const result = await setup({ ...f.options, hub: client });
  const line = result.report.steps.find(row => row.name === 'remote telegram')!;
  assert.equal(line.verdict, 'open');
  assert.equal(line.fix, 'cland hub reload');
});

for (const retry of [false, true]) test(`no Telegram code offers exactly one extra wait (accepted=${retry})`, async t => {
  const f = pairingFixture(t);
  let reads = 0;
  f.client.pairings = async () => { reads++; return [waitingPairing('ABCDEFGH', 'discord')]; };
  const script = scriptedPrompter([
    { kind: 'confirm', question: 'Set up Telegram remote now?', answer: true },
    { kind: 'pause', question: /press Start, then Enter/ },
    { kind: 'confirm', question: 'No waiting code. Wait once more?', answer: retry },
    ...(retry ? [{ kind: 'pause' as const, question: /press Start, then Enter/ }] : []), { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }]);
  const result = await setup({ ...f.options, interactive: true, yes: true, prompter: script, hub: f.client });
  assert.equal(script.left().length, 0);
  assert.equal(reads, retry ? 2 : 1);
  const line = result.report.steps.find(row => row.name === 'remote telegram')!;
  assert.equal(line.verdict, 'open');
  assert.match(line.detail, /https:\/\/t.me\/setup_fixture_bot/);
  assert.deepEqual(f.approved, []);
});

test('several waiting codes offer their row texts, filter the messenger and confirm the chosen identity', async t => {
  const f = pairingFixture(t);
  f.client.pairings = async () => [waitingPairing('DISCORDX', 'discord'), waitingPairing('ABCDEFGH'), waitingPairing('JKLMNPQR')];
  const script = scriptedPrompter([
    { kind: 'confirm', question: 'Set up Telegram remote now?', answer: true },
    { kind: 'pause', question: /press Start, then Enter/ },
    { kind: 'choose', question: 'Which pairing code?', answer: 'JKLMNPQR' },
    { kind: 'confirm', question: 'Pair telegram user? code JKLMNPQR', answer: true }, { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }]);
  const result = await setup({ ...f.options, interactive: true, yes: true, hub: f.client, prompter: {
    ...script, choose: async <T extends string>(question: string, choices: readonly Choice<T>[], def: T): Promise<T> => {
      assert.deepEqual(choices, ['ABCDEFGH', 'JKLMNPQR'].map(code => ({ value: code, label: waitingPairing(code).text })));
      return script.choose<T>(question, choices, def);
    },
  } });
  assert.equal(script.left().length, 0);
  assert.deepEqual(f.approved, ['JKLMNPQR']);
  const line = result.report.steps.find(row => row.name === 'remote telegram')!;
  assert.equal(line.verdict, 'done');
  assert.match(line.detail, /Chosen human \(202\)/);
});

// T1: the runner owns ordering and hidden input; no provider or platform runs.
test('setup offers speech data use before hidden input, stores privately and rechecks as ok', async t => {
  const f = fixture(t);
  writeFileSync(f.config, renderConfig(defaultConfig('Remote setup')));
  const key = 'made_up_setup_speech_key';
  let said = '';
  const script = scriptedPrompter([
    { kind: 'confirm', question: 'Set up Telegram remote now?', answer: false },
    { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }, { kind: 'confirm', question: 'Set up ElevenLabs transcription now?', answer: true },
    { kind: 'secret', question: 'ElevenLabs key:', answer: key },
  ]);
  const result = await setup({ ...f.options, interactive: true, yes: true, narrate: text => { said += text; }, prompter: {
    ...script,
    secret: async question => {
      assert.ok(said.includes(SPEECH_DATA_USE.elevenlabs), 'data use precedes hidden input');
      return script.secret(question);
    },
  } });
  assert.equal(script.left().length, 0, 'all questions consumed');
  assert.equal(result.report.steps.find(row => row.name === 'speech')?.verdict, 'done');
  assert.ok(readSecretsFile(f.root)['speech.elevenlabs_key'] === key, 'private key stored');
  assert.equal((said + JSON.stringify(result)).includes(key), false, 'no key in output');
  const again = await setup(f.options);
  assert.equal(again.report.steps.find(row => row.name === 'speech')?.verdict, 'ok');
});

for (const provider of ['command', '', 'elevenlabs'] as const) test(`speech provider=${provider || 'off'} nonterminal asks nothing and reports actionable state`, async t => {
  const f = fixture(t);
  const config = defaultConfig('Remote setup');
  config.speech.provider = provider;
  writeFileSync(f.config, renderConfig(config));
  const result = await setup(f.options);
  const row = result.report.steps.find(row => row.name === 'speech');
  assert.equal(row?.verdict, provider === 'elevenlabs' ? 'open' : 'ok');
  assert.equal(row?.detail, SPEECH_DATA_USE[provider]);
  assert.equal(row?.fix, provider === 'elevenlabs' ? 'cland secret set speech.elevenlabs_key' : undefined);
  if (provider !== 'elevenlabs') {
    const script = scriptedPrompter([{ kind: 'confirm', question: 'Set up Telegram remote now?', answer: false }, { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }]);
    const terminal = await setup({ ...f.options, interactive: true, yes: true, prompter: script });
    assert.equal(script.asked.length, 2, 'only the messengers were offered');
    assert.equal(terminal.report.steps.find(row => row.name === 'speech')?.verdict, 'ok');
  }
});

test('declining speech defaults to No even with yes and writes nothing', async t => {
  const f = fixture(t);
  writeFileSync(f.config, renderConfig(defaultConfig('Remote setup')));
  const script = scriptedPrompter([
    { kind: 'confirm', question: 'Set up Telegram remote now?', answer: false },
    { kind: 'confirm', question: 'Set up Discord remote now?', answer: false }, { kind: 'confirm', question: 'Set up ElevenLabs transcription now?', answer: false },
  ]);
  const result = await setup({ ...f.options, interactive: true, yes: true, prompter: {
    ...script, confirm: async (q, def) => { assert.equal(def, false); return script.confirm(q, def); },
  } });
  assert.equal(script.left().length, 0);
  assert.equal(result.report.steps.find(row => row.name === 'speech')?.verdict, 'skip');
  assert.equal(existsSync(join(f.root, '.cland/secrets.toml')), false);
});

test('untouched nonterminal Discord is skip with Discord setup commands', async t => {
  const f = fixture(t);
  const result = await setup(f.options);
  const line = result.report.steps.find(row => row.name === 'remote discord');
  assert.equal(line?.verdict, 'skip');
  assert.equal(line.fix, 'cland secret set discord.token; cland config set remote.discord.enabled true; cland hub reload');
});

for (const present of [false, true]) for (const enabled of [false, true]) test(`nonterminal Discord token=${present} enabled=${enabled} reports missing commands without writes`, async t => {
  const f = fixture(t);
  const config = defaultConfig('Remote setup'); config.speech.provider = ''; config.remote.discord.enabled = enabled;
  writeFileSync(f.config, renderConfig(config));
  if (present) writeFileSync(join(f.root, '.cland/secrets.toml'), '[discord]\ntoken="made_up_discord_setup_token"\n', { mode: 0o600 });
  const before = readFileSync(f.config, 'utf8');
  const result = await setup(f.options);
  const line = result.report.steps.find(row => row.name === 'remote discord')!;
  assert.equal(line.verdict, !present && !enabled ? 'skip' : 'open');
  assert.equal(line.fix!.includes('cland secret set discord.token'), !present);
  assert.equal(line.fix!.includes('cland config set remote.discord.enabled true'), !enabled);
  assert.match(line.fix!, /cland hub reload/);
  assert.equal(readFileSync(f.config, 'utf8'), before);
});

test('declining Discord prints skip with commands and is offered again without writes', async t => {
  const f = fixture(t);
  const before = readFileSync(f.config, 'utf8');
  for (let run = 0; run < 2; run++) {
    const script = scriptedPrompter([
      { kind: 'confirm', question: 'Set up Telegram remote now?', answer: false },
      { kind: 'confirm', question: 'Set up Discord remote now?', answer: false },
    ]);
    const result = await setup({ ...f.options, interactive: true, yes: true, prompter: script });
    const line = result.report.steps.find(row => row.name === 'remote discord')!;
    assert.equal(script.left().length, 0);
    assert.equal(line.verdict, 'skip');
    assert.match(line.fix!, /cland secret set discord.token/);
    assert.equal(readFileSync(f.config, 'utf8'), before);
    assert.equal(existsSync(join(f.root, '.cland/secrets.toml')), false);
  }
});
