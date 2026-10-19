// T3: installer shell processes provision fake binaries; profile logins persist across processes;
// Codex's short-lived stdio app-server drains its replies and exits on EOF. No hub starts.
// Run every self-test with a poisoned scratch-owned inherited HOME, never the human's accounts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { commandIn, scratchMachine, snapshot } from './init-machine.ts';
import { setupMachine, signIn, loginFails, calls, profileEnvironment } from './setup-machine.ts';

if (process.env.CLAND_SETUP_MACHINE_SELFTEST !== '1') {
  test('setup machine keeps inherited harness state untouched', { timeout: 30_000 }, async t => {
    const host = await scratchMachine(t, { identity: true });
    for (const path of ['.codex', '.config/cland', '.claude']) {
      await mkdir(join(host.home, path), { recursive: true });
      await writeFile(join(host.home, path, 'keep'), 'inherited account, never use\n');
    }
    await writeFile(join(host.home, '.claude.json'), '{"keep":true}\n');
    const before = await snapshot(host.home);
    Object.assign(host.env, {
      CLAND_SETUP_MACHINE_SELFTEST: '1', OPENCODE_DB: join(host.home, 'real.db'),
      DIGITALOCEAN_TOKEN: 'poison-provider', OPENAI_API_KEY: 'poison-account',
    });
    delete host.env.NODE_TEST_CONTEXT;
    const result = await commandIn(host, host.root, process.execPath, ['--test', fileURLToPath(import.meta.url)]);
    assert.equal(result.code, 0, result.stdout + result.stderr);
    for (const title of ['official installer pipelines', 'fake logins persist per profile', 'Codex stdio replies survive EOF']) assert.ok(result.stdout.includes(title), result.stdout);
    assert.deepEqual(await snapshot(host.home), before);
  });
} else {
  test('official installer pipelines install only scratch fake binaries', async t => {
    const machine = await setupMachine(t, { installed: [] });
    for (const [harness, url, shell, folder, binary] of [
      ['claude-code', 'https://claude.ai/install.sh', 'bash', '.local/bin', 'claude'],
      ['codex', 'https://chatgpt.com/codex/install.sh', 'CODEX_NON_INTERACTIVE=1 sh', '.local/bin', 'codex'],
      ['opencode', 'https://opencode.ai/v2/install', 'bash', '.opencode/bin', 'opencode'],
    ] as const) {
      assert.notEqual((await commandIn(machine, machine.project, 'sh', ['-c', `command -v ${binary}`])).code, 0);
      const result = await commandIn(machine, machine.project, 'bash', ['-o', 'pipefail', '-c', `curl -fsSL ${url} | ${shell}`]);
      assert.equal(result.code, 0, result.stderr);
      const version = await commandIn(machine, machine.project, join(machine.home, folder, binary), ['--version']);
      assert.equal(version.code, 0, version.stderr);
      assert.ok(version.stdout.trim());
      assert.ok((await calls(machine)).some(call => call.harness === 'curl' && call.args.includes(url)));
      machine.env.FAKE_INSTALL_FAILS = harness;
      const failed = await commandIn(machine, machine.project, 'bash', ['-o', 'pipefail', '-c', `curl -fsSL ${url} | ${shell}`]);
      assert.notEqual(failed.code, 0);
      delete machine.env.FAKE_INSTALL_FAILS;
    }
    const unknown = await commandIn(machine, machine.project, 'curl', ['-fsSL', 'https://example.invalid/installer']);
    assert.notEqual(unknown.code, 0, 'unknown URLs never reach the network');
    assert.equal(machine.env.DIGITALOCEAN_TOKEN, '');
    assert.equal(machine.env.OPENAI_API_KEY, undefined);
  });

  test('fake logins persist per profile and exit-zero failures remain signed out', async t => {
    const machine = await setupMachine(t);
    for (const [harness, binary, login, status] of [
      ['claude-code', 'claude', ['auth', 'login'], ['auth', 'status', '--json']],
      ['codex', 'codex', ['login'], ['login', 'status']],
      ['opencode', 'opencode', ['auth', 'login', '--standalone'], ['auth', 'list']],
    ] as const) {
      const profile = join(machine.home, 'other', harness);
      const other = { ...machine, env: profileEnvironment(machine, harness, profile) };
      const probe = async () => {
        const result = await commandIn(other, machine.project, binary, [...status]);
        if (harness === 'claude-code') return JSON.parse(result.stdout).loggedIn as boolean;
        if (harness === 'codex') return result.code === 0;
        return JSON.parse(result.stdout).some((p: { connections: unknown[] }) => p.connections.length > 0) as boolean;
      };
      assert.equal(await probe(), false);
      await loginFails(other, harness, true);
      assert.equal((await commandIn(other, machine.project, binary, [...login])).code, 0);
      assert.equal(await probe(), false);
      await loginFails(other, harness, false);
      assert.equal((await commandIn(other, machine.project, binary, [...login])).code, 0);
      assert.equal(await probe(), true);
      const base = await commandIn(machine, machine.project, binary, [...status]);
      if (harness === 'claude-code') assert.equal(JSON.parse(base.stdout).loggedIn, false);
      else if (harness === 'codex') assert.equal(base.code, 1);
      else assert.deepEqual(JSON.parse(base.stdout), []);
      await signIn(other, harness, false);
      assert.equal(await probe(), false);
    }
    await signIn(machine, 'claude-code', true);
    const claude = JSON.parse((await commandIn(machine, machine.project, 'claude', ['auth', 'status', '--json'])).stdout);
    assert.equal(claude.email, 'fake@example.test');
    assert.equal(claude.orgName, 'Fake Org');
    await signIn(machine, 'opencode', true, { connection: 'env' });
    assert.equal(JSON.parse((await commandIn(machine, machine.project, 'opencode', ['auth', 'list'])).stdout)[0].connections[0].type, 'env');
  });

  test('Codex stdio replies survive EOF and its process is reaped', async t => {
    const machine = await setupMachine(t, { installed: ['codex'] });
    await signIn(machine, 'codex', true);
    // The driver closes input immediately after sending: EOF must drain already admitted replies.
    const driver = join(machine.root, 'codex-stdio.mjs');
    await writeFile(driver, `
      import { spawn } from 'node:child_process';
      const child = spawn('codex', ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '', err = '';
      child.stdout.on('data', c => out += c);
      child.stderr.on('data', c => err += c);
      child.once('error', e => { throw e; });
      child.once('close', code => console.log(JSON.stringify({ pid: child.pid, code, out, err })));
      child.stdin.end([
        { id: 1, method: 'initialize', params: {} },
        { id: 2, method: 'account/read', params: {} },
        { id: 3, method: 'config/batchWrite', params: { edits: [{ keyPath: 'projects."/scratch/project".trust_level', value: 'trusted', mergeStrategy: 'replace' }] } },
      ].map(m => JSON.stringify(m)).join('\\n') + '\\n');
    `);
    const result = await commandIn(machine, machine.project, process.execPath, [driver]);
    assert.equal(result.code, 0, result.stderr);
    const receipt = JSON.parse(result.stdout) as { pid: number; code: number; out: string; err: string };
    assert.equal(receipt.code, 0, receipt.err);
    assert.throws(() => process.kill(receipt.pid, 0), { code: 'ESRCH' });
    const replies = receipt.out.trim().split('\n').map(line => JSON.parse(line));
    assert.equal(replies.length, 3);
    assert.equal(replies.find(r => r.id === 2).result.account.email, 'fake@example.test');
    assert.ok(replies.find(r => r.id === 3).result);
    assert.match(await readFile(join(machine.env.CODEX_HOME!, 'config.toml'), 'utf8'), /\[projects\."\/scratch\/project"\]\ntrust_level = "trusted"/);
    assert.ok((await calls(machine)).some(call => call.method === 'config/batchWrite'));
  });
}
