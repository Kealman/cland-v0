import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cland, clandWithEnv, connectUi, eventually, killDaemon, spawnSpoke, startDaemon, tempProject } from './harness.ts';
import type { HarnessProcessView } from '../src/protocol.ts';
import { copyPreparedProject } from './prepared-project.ts';

test('account list reads a scratch registry through the hub and CLI, refreshed without restart', async t => {
  const root = await tempProject(t);
  const config = join(root, 'config');
  await mkdir(join(config, 'cland'), { recursive: true });
  const registry = join(config, 'cland', 'accounts.toml');
  await writeFile(registry, '[accounts.codex-a]\nharness = "codex"\nhome = "~/scratch-codex"\n[accounts.oc-default]\nharness = "opencode"\n');
  const { discovery } = await startDaemon(t, root, { XDG_CONFIG_HOME: config });
  const ui = await connectUi(t, discovery);
  const listed = await ui.request({ type: 'account.list' });
  assert.equal(listed.ok, true, listed.error);
  const value = listed.value as { registry: string; accounts: Array<{ name: string; path: string | null; variable: string }> };
  assert.equal(value.registry, registry);
  assert.equal(value.accounts[0]?.variable, 'CODEX_HOME');
  assert.ok(value.accounts[0]?.path?.endsWith('/scratch-codex'));
  assert.equal(value.accounts[1]?.path, null);
  const text = await cland(root, 'account', 'list');
  assert.equal(text.code, 0, text.stderr);
  assert.match(text.stdout, /codex-a.*codex.*scratch-codex/);
  assert.match(text.stdout, /oc-default.*opencode.*harness default/);
  await writeFile(registry, '[accounts.next]\nharness = "codex"\n');
  const json = await cland(root, 'account', 'list', '--json');
  assert.equal(json.code, 0, json.stderr);
  assert.deepEqual(JSON.parse(json.stdout).accounts, [{ name: 'next', harness: 'codex', path: null, variable: 'CODEX_HOME', windows: [], at: null, source: null }]);
});

// Harness fixtures live entirely under the scratch project and exercise real launch frames.

async function fixture(t: import('node:test').TestContext, roles = '', prepared = false, extraEnv: (root: string) => Record<string, string> = () => ({})) {
  const root = await tempProject(t);
  if (prepared) await copyPreparedProject(root);
  const config = join(root, 'config');
  const codex = join(root, 'fake-codex');
  const opencode = join(root, 'fake-opencode');
  for (const dir of [join(root, '.cland'), join(config, 'cland'), codex, opencode, join(root, 'codex-a'), join(root, 'codex-b'), join(root, 'oc-data'), join(root, 'oc-db')]) await mkdir(dir, { recursive: true });
  await writeFile(join(root, '.cland', 'crew.toml'), '[crew.reviewer]\npolicy = "pool"\nsize = 4\n');
  if (roles) await writeFile(join(root, '.cland', 'roles.toml'), roles);
  const registry = join(config, 'cland', 'accounts.toml');
  await writeFile(registry, `[accounts.codex-a]\nharness = "codex"\nhome = ${JSON.stringify(join(root, 'codex-a'))}\n[accounts.codex-b]\nharness = "codex"\nhome = ${JSON.stringify(join(root, 'codex-b'))}\n[accounts.oc-data]\nharness = "opencode"\ndata_home = ${JSON.stringify(join(root, 'oc-data'))}\n[accounts.oc-db]\nharness = "opencode"\ndb = ${JSON.stringify(join(root, 'oc-db', 'store.db'))}\n[accounts.claude-b]\nharness = "claude-code"\n`);
  const env = { CODEX_HOME: join(root, 'codex-a'), XDG_DATA_HOME: join(root, 'oc-data'), XDG_CONFIG_HOME: config, FAKE_CODEX_HOME: codex, FAKE_OPENCODE_HOME: opencode,
    PATH: `${fileURLToPath(new URL('./fakes/codex', import.meta.url))}:${fileURLToPath(new URL('./fakes/opencode', import.meta.url))}:${process.env.PATH ?? ''}`,
    CLAND_ADAPTER_POLL_MS: '200', CLAND_INJECT_TIMEOUT_MS: '5000', ...extraEnv(root) };
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  const servers = async (harness = 'codex') => {
    const dir = join(harness === 'codex' ? codex : opencode, 'servers');
    return Promise.all((await readdir(dir).catch(() => [] as string[])).map(async file => JSON.parse(await readFile(join(dir, file), 'utf8')) as { pid: number; env: Record<string, string> }));
  };
  t.after(async () => { for (const h of ['codex', 'opencode']) for (const server of await servers(h)) await killDaemon(server.pid); });
  const launch = async (name: string, options: Record<string, unknown> = {}) => {
    const r = await ui.request({ type: 'session.launch', name, ...options }, 30000);
    assert.equal(r.ok, true, r.error);
    return (r.value as { process: HarnessProcessView }).process;
  };
  return { root, env, registry, ui, discovery, servers, launch };
}

test('CLI account override and role defaults select Codex, record its account and carry the home on attach', async t => {
  const f = await fixture(t, '[reviewer.launch]\nharness = "codex"\naccount = "codex-b"\n');
  const cli = await cland(f.root, 'session', 'launch', 'rev-x', '--role', 'reviewer', '--account', 'codex-a', '--json');
  assert.equal(cli.code, 0, cli.stderr);
  const launched = JSON.parse(cli.stdout).process as HarnessProcessView & { account: string };
  assert.equal(launched.account, 'codex-a');
  assert.equal((await f.servers()).find(s => s.pid === launched.pid)?.env.CODEX_HOME, join(f.root, 'codex-a'));
  assert.ok(launched.attach?.includes(`CODEX_HOME='${join(f.root, 'codex-a')}'`));
  const fromRole = await f.launch('rev-role', { role: 'reviewer' });
  assert.equal((fromRole as HarnessProcessView & { account: string }).account, 'codex-b');
  assert.equal((await f.servers()).find(s => s.pid === fromRole.pid)?.env.CODEX_HOME, join(f.root, 'codex-b'));
  const probes = (await readFile(join(f.root, 'fake-codex', 'version-probes.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(probes.map(p => p.CODEX_HOME), [join(f.root, 'codex-a'), join(f.root, 'codex-b')]);
  const listed = await cland(f.root, 'session', 'list', '--json');
  assert.equal(JSON.parse(listed.stdout).processes.find((p: { name: string }) => p.name === 'rev-x').account, 'codex-a');
  await writeFile(join(f.root, '.cland', 'roles.toml'), '[reviewer.launch]\nharness = "codex"\naccount = ""\n');
  const none = await f.launch('rev-unpinned', { role: 'reviewer' });
  assert.equal(none.account, null);
  assert.equal((await f.servers()).find(s => s.pid === none.pid)?.env.CODEX_HOME, f.env.CODEX_HOME);
  await writeFile(f.registry, `[accounts.codex-b]\nharness = "codex"\nhome = ${JSON.stringify(join(f.root, 'codex-a'))}\n`);
  const edited = await f.launch('after-registry-edit', { account: 'codex-b' });
  assert.equal(edited.account, 'codex-b');
  assert.equal((await f.servers()).find(s => s.pid === edited.pid)?.env.CODEX_HOME, join(f.root, 'codex-a'));
});

test('account refusals name the error; malformed registries leave unpinned launches working', async t => {
  const f = await fixture(t);
  const refused = async (account: unknown, pattern: RegExp, harness?: string) => {
    const r = await f.ui.request({ type: 'session.launch', name: 'refused', account, ...(harness ? { harness } : {}) });
    assert.equal(r.ok, false);
    assert.match(r.error!, pattern);
  };
  await refused('absent', /unknown account "absent" \(accounts: claude-b, codex-a, codex-b, oc-data, oc-db\)/);
  await refused('codex-a', /codex.*opencode/, 'opencode');
  await writeFile(f.registry, `[accounts.claude-b]\nharness = "claude-code"\nconfig_dir = ${JSON.stringify(join(f.root, 'missing-claude'))}\n`);
  await refused('claude-b', /missing-claude.*claude auth login/);
  await writeFile(f.registry, `[accounts.missing]\nharness = "codex"\nhome = ${JSON.stringify(join(f.root, 'never-signed-in'))}\n`);
  await refused('missing', /never-signed-in.*codex login/);
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
    await writeFile(f.registry, source);
    await refused('a', pattern);
    const r = await f.ui.request({ type: 'account.list' });
    assert.equal(r.ok, true);
    assert.match((r.value as { error: string }).error, pattern);
    assert.ok(!JSON.stringify(r.value).includes('secret'), 'no secret values returned');
  }
  const unpinned = await f.launch('unpinned', { harness: 'codex' });
  assert.equal(unpinned.account, null);
  assert.equal((await f.servers()).find(s => s.pid === unpinned.pid)?.env.CODEX_HOME, f.env.CODEX_HOME);
});

test('OpenCode data_home and db reach serve and attach; another harness ignores the role account', async t => {
  const f = await fixture(t, '[reviewer.launch]\nharness = "codex"\naccount = "codex-b"\n');
  for (const [account, variable, path] of [
    ['oc-data', 'XDG_DATA_HOME', join(f.root, 'oc-data')],
    ['oc-db', 'OPENCODE_DB', join(f.root, 'oc-db', 'store.db')],
  ]) {
    const p = await f.launch(account!, { account });
    assert.equal(p.harness, 'opencode');
    assert.equal(p.account, account);
    assert.equal((await f.servers('opencode')).find(s => s.pid === p.pid)?.env[variable!], path);
    assert.ok(p.attach?.includes(`${variable}='${path}'`));
  }
  const p = await f.launch('other-harness', { role: 'reviewer', harness: 'opencode' });
  assert.equal(p.account, null);
  assert.ok(!p.attach?.includes('CODEX_HOME'));
});

for (const harness of ['codex', 'opencode']) test(`${harness} relaunch and hub restart retain the saved account after role and registry edits`, async t => {
  const account = harness === 'codex' ? 'codex-b' : 'oc-data';
  const variable = harness === 'codex' ? 'CODEX_HOME' : 'XDG_DATA_HOME';
  const savedDir = harness === 'codex' ? 'codex-b' : 'oc-data';
  const f = await fixture(t, `[reviewer.launch]\nharness = "${harness}"\naccount = "${account}"\n`);
  const p = await f.launch('retained', { role: 'reviewer' });
  assert.equal(p.account, account);
  await writeFile(join(f.root, '.cland', 'roles.toml'), '[reviewer.launch]\nharness = "codex"\naccount = "codex-a"\n');
  await writeFile(f.registry, `[accounts.${account}]\nharness = "${harness}"\n${harness === 'codex' ? 'home' : 'data_home'} = ${JSON.stringify(join(f.root, 'codex-a'))}\n`);
  // Native relaunch must not re-resolve the edited name or role.
  const resumed = await f.ui.request({ type: 'session.resume', session: p.name, relaunch: true }, 30000);
  assert.equal(resumed.ok, true, resumed.error);
  const after = (resumed.value as { found: boolean; process: HarnessProcessView }).process;
  assert.equal((resumed.value as { found: boolean }).found, true);
  assert.equal(after.account, account);
  assert.equal(after.harnessSessionId, p.harnessSessionId);
  assert.notEqual(after.pid, p.pid);
  assert.equal((await f.servers(harness)).find(s => s.pid === after.pid)?.env[variable], join(f.root, savedDir));
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const { discovery } = await startDaemon(t, f.root, f.env);
  const ui = await connectUi(t, discovery);
  const found = await ui.request({ type: 'session.resume', session: p.name });
  assert.equal(found.ok, true, found.error);
  const restarted = found.value as { found: boolean; process: HarnessProcessView };
  assert.equal(restarted.found, true);
  assert.equal(restarted.process.account, account);
  assert.equal(restarted.process.pid, after.pid);
  assert.ok(restarted.process.attach?.includes(`${variable}='${join(f.root, savedDir)}'`));
  // A fresh native conversation also retains the row's saved account.
  assert.equal((await ui.request({ type: 'session.stop', session: p.name }, 30000)).ok, true);
  const fresh = await ui.request({ type: 'session.resume', session: p.name, fresh: true }, 30000);
  assert.equal(fresh.ok, true, fresh.error);
  const renewed = (fresh.value as { process: HarnessProcessView }).process;
  assert.equal(renewed.account, account);
  assert.equal((await f.servers(harness)).find(s => s.pid === renewed.pid)?.env[variable], join(f.root, savedDir));
});

test('launch and usage journal rows carry the account after the flush barrier; account list is open to role shells', async t => {
  const f = await fixture(t);
  assert.equal((await f.ui.request({ type: 'subscribe' })).ok, true);
  const p = await f.launch('journalled', { role: 'implementer', account: 'codex-b' });
  await f.ui.waitFor(frame => frame.type === 'session.usage' && frame.sessionId === p.sessionId);
  assert.equal((await f.ui.request({ type: 'hub.status', flushLogs: true })).ok, true);
  const records = (await readFile(join(f.root, '.cland', 'journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.equal(records.find(r => r.event === 'session-launched' && r.sessionId === p.sessionId)?.account, 'codex-b');
  assert.equal(records.find(r => r.event === 'session-usage' && r.sessionId === p.sessionId)?.account, 'codex-b');
  const read = await clandWithEnv(f.root, { CLAND_SESSION_ID: p.sessionId, CLAND_SESSION_NAME: p.name }, 'account', 'list', '--json');
  assert.equal(read.code, 0, read.stderr);
  assert.ok(JSON.parse(read.stdout).accounts.some((a: { name: string }) => a.name === 'codex-b'));
});

test('a retained Reviewer pool reuses only the same account and keeps its original directory', async t => {
  const f = await fixture(t, '[reviewer.launch]\nharness = "codex"\naccount = "codex-b"\n');
  const coord = await spawnSpoke({ cwd: f.root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const item = (await coord.call<{ item: { id: string } }>('task.create', { title: 'Review account retention', size: 'XS' })).item.id;
  const p = await f.launch('pooled', { role: 'reviewer' });
  await eventually('pool idle', async () => {
    const rows = ((await f.ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] }).processes;
    return rows.find(row => row.name === p.name)?.state === 'idle' || undefined;
  });
  await writeFile(join(f.root, '.cland', 'roles.toml'), '[reviewer.launch]\nharness = "codex"\naccount = "codex-a"\n');
  // The role now selects a different account, so this is a new member.
  const next = await f.launch('another', { role: 'reviewer', item });
  assert.notEqual(next.sessionId, p.sessionId);
  assert.equal(next.account, 'codex-a');
  await writeFile(f.registry, `[accounts.codex-b]\nharness = "codex"\nhome = ${JSON.stringify(join(f.root, 'codex-a'))}\n`);
  const reused = await f.launch('requested', { role: 'reviewer', item, account: 'codex-b' });
  assert.equal(reused.sessionId, p.sessionId);
  assert.equal(reused.account, 'codex-b');
  assert.ok(reused.attach?.includes(`CODEX_HOME='${join(f.root, 'codex-b')}'`));
  assert.equal((await f.servers()).find(s => s.pid === reused.pid)?.env.CODEX_HOME, join(f.root, 'codex-b'));
});

for (const harness of ['codex', 'opencode']) test(`${harness} retained Implementer handoff restarts in the next worktree on the saved account environment`, async t => {
  const account = harness === 'codex' ? 'codex-b' : 'oc-data';
  const variable = harness === 'codex' ? 'CODEX_HOME' : 'XDG_DATA_HOME';
  const f = await fixture(t, `[implementer.launch]\nharness = "${harness}"\naccount = "${account}"\n`, true);
  assert.equal((await f.ui.request({ type: 'crew.set', key: 'implementer.policy', value: 'pool' })).ok, true);
  assert.equal((await f.ui.request({ type: 'crew.set', key: 'implementer.keep_context', value: true })).ok, true);
  const coord = await spawnSpoke({ cwd: f.root, discover: true, name: 'coord', role: 'coordinator' });
  t.after(() => coord.close());
  await coord.waitForPresence(['coord']);
  const create = async () => (await coord.call<{ item: { id: string } }>('task.create', { title: 'Keep the account at handoff', size: 'XS', body: '## Summary\nPool fixture' })).item.id;
  const first = await create();
  const second = await create();
  const p = await f.launch('pool-impl', { role: 'implementer', item: first });
  assert.equal((await f.ui.request({ type: 'merge', item: first, override: 'Exercise account retention at the pool boundary' }, 30000)).ok, true);
  await eventually('implementer idle after merge', async () => {
    const rows = ((await f.ui.request({ type: 'session.list' })).value as { processes: HarnessProcessView[] }).processes;
    return rows.find(row => row.name === p.name)?.state === 'idle' || undefined;
  });
  await writeFile(join(f.root, '.cland', 'roles.toml'), '[implementer.launch]\nharness = "codex"\naccount = "codex-a"\n');
  await writeFile(f.registry, `[accounts.${account}]\nharness = "${harness}"\n${harness === 'codex' ? 'home' : 'data_home'} = ${JSON.stringify(join(f.root, 'codex-a'))}\n`);
  const next = await f.launch('new-name', { role: 'implementer', item: second, account });
  assert.equal(next.name, p.name);
  assert.equal(next.account, account);
  assert.notEqual(next.cwd, p.cwd);
  assert.notEqual(next.pid, p.pid);
  assert.notEqual(next.sessionId, p.sessionId);
  assert.equal(next.harnessSessionId, p.harnessSessionId);
  assert.equal((await f.servers(harness)).find(s => s.pid === next.pid)?.env[variable], join(f.root, account));
});

test('an OpenCode data account overrides an inherited database selection', async t => {
  const f = await fixture(t, '', false, root => ({ OPENCODE_DB: join(root, 'oc-db', 'inherited.db') }));
  const p = await f.launch('data-account', { account: 'oc-data' });
  const server = (await f.servers('opencode')).find(s => s.pid === p.pid)!;
  assert.equal(server.env.XDG_DATA_HOME, join(f.root, 'oc-data'));
  assert.equal(server.env.OPENCODE_DB, undefined);
  assert.ok(p.attach?.includes('env -u OPENCODE_DB'));
});

test('relative XDG_CONFIG_HOME falls back inside a scratch HOME; a missing registry lists no accounts', async t => {
  const root = await tempProject(t);
  const home = join(root, 'user');
  const registry = join(home, '.config', 'cland', 'accounts.toml');
  await mkdir(join(home, '.config', 'cland'), { recursive: true });
  const { discovery } = await startDaemon(t, root, { HOME: home, XDG_CONFIG_HOME: 'relative' });
  const ui = await connectUi(t, discovery);
  assert.deepEqual((await ui.request({ type: 'account.list' })).value, { registry, accounts: [] });
  await writeFile(registry, '[accounts.codex]\nharness = "codex"\nhome = "~/.codex"\n');
  const listed = (await ui.request({ type: 'account.list' })).value as { accounts: Array<{ path: string }> };
  assert.equal(listed.accounts[0]?.path, join(home, '.codex'));
});

test('an older process table migrates with a null account on its session list row', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const db = new DatabaseSync(join(root, '.cland', 'hub.db'));
  db.exec(`create table harness_processes (name text primary key, harness text not null, role text, model text, cwd text not null, pid integer, harness_id text, session_id text not null, started_at text not null, status text not null);
    insert into harness_processes values ('old', 'codex', null, null, '/old', null, null, 'old-id', '2026-10-13T00:00:00Z', 'stopped');`);
  db.close();
  const { discovery } = await startDaemon(t, root, { XDG_CONFIG_HOME: join(root, 'config') });
  const ui = await connectUi(t, discovery);
  const list = (await ui.request({ type: 'session.list', archived: false })).value as { processes: HarnessProcessView[] };
  // A sufficiently old stopped row may be archived by hygiene; both views preserve the null account.
  const archived = (await ui.request({ type: 'session.list', archived: true })).value as { processes: HarnessProcessView[] };
  assert.equal([...list.processes, ...archived.processes].find(p => p.name === 'old')?.account, null);
});

test('a named harness default freezes the launch directory across a changed hub environment', async t => {
  const f = await fixture(t);
  await writeFile(f.registry, '[accounts.default-codex]\nharness = "codex"\n');
  const p = await f.launch('default-account', { account: 'default-codex' });
  assert.equal(p.account, 'default-codex');
  assert.equal((await f.servers()).find(s => s.pid === p.pid)?.env.CODEX_HOME, join(f.root, 'codex-a'));
  assert.equal((await f.ui.request({ type: 'session.stop', session: p.name }, 30000)).ok, true);
  assert.equal((await cland(f.root, 'hub', 'stop')).code, 0);
  const { discovery } = await startDaemon(t, f.root, { ...f.env, CODEX_HOME: join(f.root, 'codex-b') });
  const ui = await connectUi(t, discovery);
  const r = await ui.request({ type: 'session.resume', session: p.name, relaunch: true }, 30000);
  assert.equal(r.ok, true, r.error);
  const after = (r.value as { process: HarnessProcessView }).process;
  assert.equal(after.account, 'default-codex');
  assert.equal((await f.servers()).find(s => s.pid === after.pid)?.env.CODEX_HOME, join(f.root, 'codex-a'));
});
