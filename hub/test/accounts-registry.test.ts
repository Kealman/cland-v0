// T1: registry validation and process-row migration; no sockets or child harnesses.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readAccounts, namedAccount } from '../src/accounts/registry.ts';
import { ProcessTable } from '../src/adapters/processes.ts';
async function scratch(t: import('node:test').TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'account-registry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
test('malformed registries refuse named accounts without exposing values', async t => {
  const root = await scratch(t);
  await mkdir(join(root, 'cland'));
  const registryPath = join(root, 'cland/accounts.toml');
  const env = { XDG_CONFIG_HOME: root };
  const cases = [
    ['[accounts.a]\nharness = "codex"\ntoken = "secret"\n', /unknown key "token"/],
    ['[accounts.a]\nharness = "codex"\n[accounts.b]\nharness = "codex"\n', /two path-less accounts.*codex/],
    ['[accounts.a]\nharness = "opencode"\ndata_home = "/a"\ndb = "/b"\n', /at most one path/],
    ['[accounts.a]\nharness = "codex"\nhome = "relative"\n', /must be absolute/],
    ['[accounts.Bad]\nharness = "codex"\n', /invalid account name/],
    ['[accounts.a]\nharness = "codex"\nconfig_dir = "/a"\n', /unknown key "config_dir"/],
    ['[accounts.a\n', /accounts registry/],
    ['[accounts.a]\ntoken = "secret"\ninvalid = [', /invalid TOML/i],
  ] as const;
  for (const [source, pattern] of cases) {
    await writeFile(registryPath, source);
    const registry = await readAccounts(env);
    assert.throws(() => namedAccount(registry, 'a'), pattern);
    assert.match(registry.error!, pattern);
    assert.ok(!JSON.stringify(registry).includes('secret'), 'no secret values returned');
  }
 });
test('relative XDG_CONFIG_HOME falls back inside HOME and expands account paths', async t => {
  const home = await scratch(t);
  const registry = join(home, '.config/cland/accounts.toml');
  await mkdir(join(home, '.config/cland'), { recursive: true });
  const env = { HOME: home, XDG_CONFIG_HOME: 'relative' };
  assert.deepEqual(await readAccounts(env), { registry, accounts: [] });
  await writeFile(registry, '[accounts.codex]\nharness = "codex"\nhome = "~/.codex"\n');
  assert.equal((await readAccounts(env)).accounts[0]?.path, join(home, '.codex'));
});
test('an older process table migrates with a null account', async t => {
  const root = await scratch(t);
  const path = join(root, 'hub.db');
  const db = new DatabaseSync(path);
  db.exec(`create table harness_processes (name text primary key, harness text not null, role text, model text, cwd text not null, pid integer, harness_id text, session_id text not null, started_at text not null, status text not null);
    insert into harness_processes values ('old', 'codex', null, null, '/old', null, null, 'old-id', '2026-10-13T00:00:00Z', 'stopped');`);
  db.close();
  const table = new ProcessTable(path);
  try { assert.equal(table.all().find(p => p.name === 'old')?.account, null); }
  finally { table.close(); }
});
