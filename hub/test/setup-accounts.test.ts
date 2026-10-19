// T1: accounts use scratch files, an injected identity command and fake prompter; no processes or real time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAccountsStep } from '../src/setup/steps/accounts.ts';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import type { SetupOptions } from '../src/setup/types.ts';
import { scriptedPrompter } from './setup-prompter.ts';

function fixture(t: test.TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'cland-accounts-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  let config = renderConfig(defaultConfig('accounts'));
  const options: SetupOptions = { root, env: { HOME: root }, interactive: true, yes: false, prompter: scriptedPrompter([]), machine: {
    projectExists: async () => true, requiredHarnesses: async () => [], onPath: async () => true,
    run: async () => { throw new Error('unexpected run'); },
    read: async () => config,
    write: async (_path, next, previous) => { assert.equal(previous, config); config = next; },
    harness: async id => ({ id, bin: `/tools/${id}`, version: [1, 0, 0], checks: [] }),
  } };
  return { root, options, registry: join(root, '.config/cland/accounts.toml'), config: () => config };
}

test('Enter declines a new account and the next run reports the remembered name (C2)', async t => {
  const f = fixture(t);
  mkdirSync(join(f.root, '.claude-work'));
  const output: string[] = [];
  f.options.narrate = text => output.push(text);
  let questions = 0;
  f.options.prompter = { ...scriptedPrompter([]), confirm: async (question, def) => {
    assert.equal(question, 'Write them to ~/.config/cland/accounts.toml?');
    assert.equal(def, false);
    assert.match(output.join(''), /machine-wide/);
    assert.match(output.join(''), /several accounts.*limits/);
    assert.match(output.join(''), /work@example.test.*Example Org/);
    questions++;
    return def!;
  } };
  const step = createAccountsStep({ identity: async () => 'work@example.test (Example Org)' });
  assert.equal((await step(f.options))[0]?.verdict, 'skip');
  assert.equal(existsSync(f.registry), false);
  assert.deepEqual(parseConfig(f.config(), 'accounts').setup.declinedAccounts, ['claude-work']);
  const second = (await step(f.options))[0]!;
  assert.equal(second.verdict, 'ok');
  assert.match(second.detail, /declined earlier: claude-work; add them to accounts.toml by hand to use them/);
  assert.equal(questions, 1);
});

test('only separate signed-in directories are offered and appended without identity data (C1 C3 C4)', async t => {
  const f = fixture(t);
  for (const folder of ['.claude', '.codex', '.claude-work', '.claude-logged-out', '.codex-personal', '.codex-default', '.claude-known']) mkdirSync(join(f.root, folder));
  f.options.env.CODEX_HOME = join(f.root, '.codex-default');
  mkdirSync(join(f.root, '.config/cland'), { recursive: true });
  const original = '# keep these bytes\n[accounts.existing]\nharness = "claude-code"\nconfig_dir = "~/.claude-known" # custom comment';
  writeFileSync(f.registry, original);
  const seen: string[] = [], output: string[] = [];
  f.options.narrate = text => output.push(text);
  f.options.prompter = { ...scriptedPrompter([]), confirm: async (_q, def) => { assert.equal(def, false); return true; } };
  const step = createAccountsStep({ identity: async (id, _bin, env) => {
    const path = (id === 'codex' ? env.CODEX_HOME : env.CLAUDE_CONFIG_DIR)!;
    seen.push(path);
    return path.endsWith('logged-out') ? null : 'private@example.test (Secret Org)';
  } });
  assert.equal((await step(f.options))[0]?.verdict, 'done');
  assert.deepEqual(seen, ['.claude-logged-out', '.claude-work', '.codex-personal'].map(p => join(f.root, p)));
  assert.equal(readFileSync(f.registry, 'utf8'), original + '\n\n[accounts.claude-work]\nharness = "claude-code"\nconfig_dir = "~/.claude-work"\n\n[accounts.codex-personal]\nharness = "codex"\nhome = "~/.codex-personal"\n');
  assert.doesNotMatch(readFileSync(f.registry, 'utf8'), /private@|Secret Org|config_dir = "~\/.claude"/);
  assert.match(output.join(''), /private@example.test/);
  const after = readFileSync(f.registry, 'utf8');
  f.options.prompter = scriptedPrompter([]);
  assert.equal((await step(f.options))[0]?.verdict, 'ok');
  assert.equal(readFileSync(f.registry, 'utf8'), after);
});

test('no-accounts reads nothing and nonterminal yes leaves the registry absent (C5)', async t => {
  const f = fixture(t);
  mkdirSync(join(f.root, '.claude-work'));
  const step = createAccountsStep({ identity: async () => 'work@example.test' });
  const forbidden = async (): Promise<never> => { throw new Error('must not read'); };
  assert.deepEqual(await step({ ...f.options, noAccounts: true, env: { HOME: '/not-readable' }, machine: { ...f.options.machine, read: forbidden, harness: forbidden } }),
    [{ name: 'accounts', verdict: 'skip', detail: '--no-accounts' }]);
  for (const yes of [false, true]) {
    const before = f.config();
    assert.equal((await step({ ...f.options, interactive: false, yes }))[0]?.verdict, 'open');
    assert.equal(existsSync(f.registry), false);
    assert.equal(f.config(), before);
  }
  assert.equal((await step({ ...f.options, yes: true }))[0]?.verdict, 'skip');
  assert.equal(existsSync(f.registry), false);
});

test('a malformed registry fails untouched before reading a profile', async t => {
  const f = fixture(t);
  mkdirSync(join(f.root, '.config/cland'), { recursive: true });
  const step = createAccountsStep({ identity: async () => { assert.fail('must not read a profile'); } });
  for (const original of ['[broken', '[accounts.bad]\nharness = "claude-code"\nemail = "private@example.test"\n']) {
    writeFileSync(f.registry, original);
    const line = (await step(f.options))[0]!;
    assert.equal(line.verdict, 'fail');
    assert.equal(line.fix, 'repair it by hand');
    assert.doesNotMatch(line.detail, /private@example.test/);
    assert.equal(readFileSync(f.registry, 'utf8'), original);
  }
});

test('Codex identity ends its one app-server process group on return or failure (C6)', async () => {
  const { EventEmitter } = await import('node:events');
  const { PassThrough } = await import('node:stream');
  const { readCodexIdentity } = await import('../src/setup/account-identity.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  for (const failure of [false, true]) {
    const clock = new FakeClock();
    const child = Object.assign(new EventEmitter(), { pid: 42, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
    let starts = 0, closes = 0;
    const kills: number[] = [];
    const promise = readCodexIdentity('/tools/codex', { CODEX_HOME: '/work' }, {
      clock,
      spawn: (bin, args, options) => {
        starts++;
        assert.equal(bin, '/tools/codex');
        assert.deepEqual(args, ['app-server']);
        assert.deepEqual(options, { env: { CODEX_HOME: '/work' }, detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
        return child;
      },
      connect: async () => ({ request: async (method, params) => {
        assert.equal(method, 'account/read');
        assert.deepEqual(params, { refreshToken: false });
        if (failure) throw new Error('read failed');
        return { account: { type: 'chatgpt', email: 'codex@example.test' } };
      }, close: () => { closes++; } }),
      kill: (pid, signal) => { assert.equal(signal, 'SIGKILL'); kills.push(pid); child.emit('close'); return true; },
    });
    if (failure) await assert.rejects(promise, /read failed/);
    else assert.equal(await promise, 'codex@example.test');
    assert.equal(starts, 1);
    assert.equal(closes, 1);
    assert.deepEqual(kills, [-42]);
    assert.equal(clock.pending, 0);
  }
});

test('default directories and the hub environment never become Claude entries (C1 C4)', async t => {
  const { symlinkSync } = await import('node:fs');
  const { readAccounts } = await import('../src/accounts/registry.ts');
  const f = fixture(t);
  for (const folder of ['.claude', '.codex', '.claude-work', '.claude-hub', '.codex-hub', '.opencode-work']) mkdirSync(join(f.root, folder));
  symlinkSync(join(f.root, '.claude'), join(f.root, '.claude-alias'));
  const probed: string[] = [];
  const step = createAccountsStep({ identity: async (_id, _bin, env) => { probed.push(env.CLAUDE_CONFIG_DIR ?? env.CODEX_HOME!); return 'signed in'; } });
  f.options.env = { HOME: f.root, CLAUDE_CONFIG_DIR: join(f.root, '.claude-hub'), CODEX_HOME: join(f.root, '.codex-hub') };
  f.options.prompter = { ...scriptedPrompter([]), confirm: async () => true };
  assert.equal((await step(f.options))[0]?.verdict, 'done');
  assert.deepEqual(probed, [join(f.root, '.claude-work')]);
  const registry = await readAccounts(f.options.env);
  assert.deepEqual(registry.accounts.map(a => [a.name, a.harness, a.path]), [['claude-work', 'claude-code', join(f.root, '.claude-work')]]);
  assert.match(readFileSync(f.registry, 'utf8'), /config_dir = "~\/.claude-work"/);
  assert.ok(registry.accounts.every(a => a.harness !== 'claude-code' || (a.path !== null && a.path !== join(f.root, '.claude'))));
});

test('Claude status shows email and organisation only for signed-in profiles', async () => {
  const { readClaudeIdentity } = await import('../src/setup/account-identity.ts');
  for (const loggedIn of [false, true]) {
    const who = await readClaudeIdentity('/tools/claude', { CLAUDE_CONFIG_DIR: '/work' }, async (bin, args, env) => {
      assert.equal(bin, '/tools/claude');
      assert.deepEqual(args, ['auth', 'status', '--json']);
      assert.equal(env.CLAUDE_CONFIG_DIR, '/work');
      return { code: loggedIn ? 0 : 1, stderr: '', stdout: JSON.stringify({ loggedIn, email: 'work@example.test', orgName: 'Work Org' }) };
    });
    assert.equal(who, loggedIn ? 'work@example.test — Work Org' : null);
  }
});

test('Codex identity initialization timeout still ends its process group', async () => {
  const { EventEmitter } = await import('node:events');
  const { PassThrough } = await import('node:stream');
  const { readCodexIdentity } = await import('../src/setup/account-identity.ts');
  const { FakeClock } = await import('./fake-clock.ts');
  const clock = new FakeClock();
  const child = Object.assign(new EventEmitter(), { pid: 42, stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough() });
  let killed = false;
  const promise = readCodexIdentity('/tools/codex', {}, {
    clock, spawn: () => child, connect: () => new Promise(() => {}),
    kill: (pid, signal) => { assert.equal(pid, -42); assert.equal(signal, 'SIGKILL'); killed = true; child.emit('close'); return true; },
  });
  const rejected = assert.rejects(promise, /timed out/);
  await clock.advance(15_000);
  await rejected;
  assert.equal(killed, true);
  assert.equal(clock.pending, 0);
});
