// T2: setup host offers through the scripted prompter and injected hub boundary.
import './cover-quiet.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { hosts } from '../src/setup/steps/hosts.ts';
import { scriptedPrompter } from './setup-prompter.ts';
import type { SetupOptions } from '../src/setup/types.ts';
import { providerTokens } from '../src/host/provider-tokens.ts';
import { readHostPools } from '../src/host/pools.ts';
import { projectHub, tempProject, connectUi } from './harness.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeLockProcesses } from './fakes/lock-processes.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { onCleanup } from './process-cleanup.ts';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { defaultConfig, parseConfig, renderConfig } from '../src/init/config.ts';
import { setupHub } from '../src/setup/hub.ts';
import { rolesTemplate } from '../src/roles/template.ts';
import { Store } from '../src/hub/store.ts';
import { layout } from '../src/project.ts';

function options(): SetupOptions {
  return {
    root: '/unused', env: {}, interactive: true, yes: false,
    prompter: scriptedPrompter([]),
    machine: {
      read: async () => '', write: async () => { throw Error('unexpected write'); },
      run: async () => { throw Error('unexpected process'); }, projectExists: async () => true,
      requiredHarnesses: async () => [], onPath: async () => false,
      harness: async id => ({ id, bin: null, version: null, checks: [] }),
    },
    hub: {
      running: async () => null, start: async () => { throw Error('unexpected start'); },
      session: async () => null, launch: async () => {}, resume: async () => {}, attach: async () => '',
    },
  };
}

test('setup metadata filter reads the unconfigured provider without changing the old reply', () => {
  const settings = readHostPools(undefined);
  assert.deepEqual(providerTokens(settings, {}), { providers: [] });
  assert.deepEqual(providerTokens(settings, {}, 'digitalocean'), { providers: [{ provider: 'digitalocean', tokenNeeded: true, present: false, fingerprint: null }] });
});

test('C1 agent hosts offer defaults No and decline writes nothing', async () => {
  const o = options();
  o.prompter.confirm = async (question, def) => {
    assert.equal(question, 'Set up agent hosts?'); assert.equal(def, false); return false;
  };
  assert.equal((await hosts(o))[0]?.verdict, 'skip');
});

test('C2 yes skips agent hosts with and without a terminal', async () => {
  for (const interactive of [false, true]) {
    assert.equal((await hosts({ ...options(), interactive, yes: true }))[0]?.verdict, 'skip');
  }
});

test('C2 no terminal skips untouched hosts with exact pool and role commands without writes', async () => {
  const line = (await hosts({ ...options(), interactive: false }))[0]!;
  assert.equal(line.verdict, 'skip');
  assert.match(line.detail, /cland config set hosts\.agents\.provider digitalocean/);
  assert.match(line.fix!, /cland config set hosts\.agents\.provider digitalocean/);
  assert.match(line.fix!, /cland role launch implementer --pool agents/);
  assert.match(line.fix!, /cland hub reload/);
});

test('C5 missing hub token stops before roles and asks for hub environment and restart', async () => {
  const o = options();
  o.prompter = scriptedPrompter([{ kind: 'confirm', question: 'Set up agent hosts?', answer: true }]);
  const line = (await hosts(o))[0]!;
  assert.equal(line.verdict, 'open');
  assert.match(line.detail, /DIGITALOCEAN_TOKEN.*hub.*restart/i);
});

test('C3/C4 paid pool consent names defaults and only yes writes and reloads', async () => {
  for (const paid of [false, true]) {
    const o = options(), writes: [string, unknown][] = [], narration: string[] = [];
    o.machine.read = async path => path === 'roles.toml' ? '[implementer.launch]\nharness="codex"\n[reviewer.launch]\nharness="codex"\n' : '';
    o.hub!.providers = async () => ({ providers: [{ provider: 'digitalocean', present: true, fingerprint: 'abcdef123456' }] });
    o.hub!.configure = async (key, value) => { writes.push([key, value]); };
    o.hub!.placeRole = async (role, pool) => { writes.push([role, pool]); };
    o.hub!.reload = async () => { writes.push(['reload', true]); };
    o.narrate = text => { narration.push(text); };
    o.prompter = { ...scriptedPrompter([]), confirm: async (q, def) => {
      if (q === 'Set up agent hosts?') { assert.equal(def, false); return true; }
      if (q.startsWith('Place ')) return q.startsWith('Place implementer ');
      assert.match(q, /s-4vcpu-8gb.*min_hosts = 1.*declared \$0\.0714\/h.*2026-10-31/);
      assert.equal(def, false); assert.deepEqual(writes, []); return paid;
    } };
    const line = (await hosts(o))[0]!;
    assert.equal(line.verdict, paid ? 'done' : 'open');
    assert.match(narration.join(''), /abcdef123456/);
    if (!paid) assert.deepEqual(writes, []);
    else {
      assert.ok(writes.some(([key, value]) => key === 'hosts.agents.provider' && value === 'digitalocean'));
      assert.ok(writes.some(([key, value]) => key === 'hosts.agents.min_hosts' && value === 1));
      assert.deepEqual(writes.slice(-2), [['implementer', 'agents'], ['reload', true]]);
    }
  }
});

test('C6 configured pool with ready placed-role logins asks nothing, even with yes', async () => {
  const o = options();
  o.machine.read = async path => path === 'config.toml' ? '[hosts.agents]\nprovider="digitalocean"\n' : '[implementer.launch]\npool="agents"\nharness="codex"\n';
  o.hub!.running = async () => ({ pid: 42 });
  o.hub!.providers = async () => ({ providers: [{ provider: 'digitalocean', present: true, fingerprint: 'abcdef123456' }] });
  o.hub!.hostStatus = async () => ({ pools: [{ name: 'agents', capacity: { codex: 1 } }], roleLogins: { implementer: true } });
  for (const yes of [false, true]) assert.equal((await hosts({ ...o, yes }))[0]?.verdict, 'ok');
});

test('C5 configured ready DigitalOcean pool still needs the hub token before ok', async () => {
  const o = options();
  o.machine.read = async path => path === 'config.toml' ? '[hosts.agents]\nprovider="digitalocean"\n' : '[implementer.launch]\npool="agents"\nharness="codex"\n';
  o.hub!.running = async () => ({ pid: 42 });
  o.hub!.hostStatus = async () => ({ pools: [{ name: 'agents', capacity: { codex: 1 } }], roleLogins: { implementer: true } });
  o.hub!.providers = async () => ({ providers: [{ provider: 'digitalocean', present: false, fingerprint: null }] });
  const line = (await hosts(o))[0]!;
  assert.equal(line.verdict, 'open');
  assert.match(line.detail, /DIGITALOCEAN_TOKEN.*hub.*restart/);
});

test('C2 existing pool nonterminal and failed-read guidance never resets settings or placed roles', async () => {
  for (const failStatus of [false, true]) {
    const o = options();
    o.interactive = false;
    o.machine.read = async path => path === 'config.toml' ? '[hosts.agents]\nprovider="fake"\nsize="custom-size"\nslots=3\nmin_hosts=0\n' : '[reviewer.launch]\npool="agents"\nharness="codex"\n';
    o.hub!.running = async () => ({ pid: 42 });
    o.hub!.hostStatus = async () => { if (failStatus) throw Error('synthetic status failure'); return { pools: [{ name: 'agents', capacity: { codex: 0 } }] }; };
    const line = (await hosts(o))[0]!;
    assert.equal(line.verdict, 'open');
    assert.equal(line.fix, 'cland setup in a terminal');
    assert.doesNotMatch(JSON.stringify(line), /config set|role launch implementer/);
  }
});

test('C6 old hub reply without role eligibility leaves readiness unknown and open', async () => {
  const o = options(); o.interactive = false;
  o.machine.read = async path => path === 'config.toml' ? '[hosts.agents]\nprovider="fake"\nmin_hosts=0\n' : '[implementer.launch]\npool="agents"\nharness="codex"\naccount="A"\n';
  o.hub!.running = async () => ({ pid: 42 });
  o.hub!.hostStatus = async () => ({ pools: [{ name: 'agents', capacity: { codex: 1 } }] });
  assert.equal((await hosts(o))[0]?.verdict, 'open');
});

test('C6 role eligibility shares freeCount with account pins and preserves plain status shape', async t => {
  const root = await tempProject(t), clock = new FakeClock(Date.now());
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nregion="fake-1"\nmin_hosts=0\n');
  await writeFile(join(root, '.cland/roles.toml'), '[implementer.launch]\nharness="codex"\npool="agents"\naccount="A"\n');
  const seed = new Store(layout(root).db);
  try {
    for (const account of ['A', 'B']) {
      seed.hosts.logins.insert({ name: account.toLowerCase(), harness: 'codex', account, kind: 'disk', provider: 'fake', region: 'fake-1', volumeId: account, snapshotIds: [], lastSignIn: null });
      seed.hosts.logins.transition(account.toLowerCase(), 'ready');
    }
    seed.hosts.logins.markSignedOut('a', { reason: 'fixture signed out', host: null });
    assert.equal(seed.hosts.logins.freeCount({ harness: 'codex', provider: 'fake', region: 'fake-1', account: 'A' }), 0);
    assert.equal(seed.hosts.logins.freeCount({ harness: 'codex', provider: 'fake', region: 'fake-1', account: 'missing' }), 0);
    assert.equal(seed.hosts.logins.freeCount({ harness: 'codex', provider: 'fake', region: 'fake-1', account: 'B' }), 1);
    assert.equal(seed.hosts.logins.freeCount({ harness: 'codex', provider: 'fake', region: 'wrong-region', account: 'B' }), 0);
    assert.equal(seed.hosts.logins.freeCount({ harness: 'codex', provider: 'other', region: 'fake-1', account: 'B' }), 0);
    seed.hosts.logins.insert({ name: 'key', harness: 'opencode', account: 'K', kind: 'key', lastSignIn: null });
    seed.hosts.logins.transition('key', 'ready');
    assert.equal(seed.hosts.logins.freeCount({ harness: 'opencode', provider: 'fake', region: 'fake-1', account: 'K' }), 1);
    assert.equal(seed.hosts.logins.freeCount({ harness: 'opencode', provider: 'fake', region: 'fake-1', account: 'missing' }), 0);
    seed.hosts.logins.markSignedOut('key', { reason: 'count-only fixture; no key material', host: null });
  } finally { seed.close(); }
  const hub = await projectHub(t, root, {}, { clock, processes: fakeLockProcesses().processes });
  const ui = await connectUi(t, hub.discovery, 'cli');
  const plain = await ui.request({ type: 'host.status' });
  assert.equal(plain.ok, true, plain.error);
  assert.equal(Object.hasOwn(plain.value as object, 'roleLogins'), false);
  const scoped = await ui.request({ type: 'host.status', roleLogins: true });
  assert.equal(scoped.ok, true, scoped.error);
  assert.deepEqual((scoped.value as { roleLogins: unknown }).roleLogins, { implementer: false });
  const o = options(); o.root = root; o.interactive = false; o.hub = setupHub(root, {});
  o.machine.read = async path => readFile(join(root, '.cland', path), 'utf8');
  assert.equal((await hosts(o))[0]?.verdict, 'open', 'ready account B cannot serve role pinned to A');
  const changed = new Store(layout(root).db);
  try { const admission = changed.hosts.logins.beginSignIn('a'); changed.hosts.logins.finishSignIn('a', admission, clock.now().toISOString()); }
  finally { changed.close(); }
  assert.equal((await hosts(o))[0]?.verdict, 'ok', 'ready pinned account is accepted without questions');
});

test('C3/C5 socket setup persists pool and role through shared setters without leaking token', async t => {
  const root = await tempProject(t), clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  const token = 'cland-test-setup-hosts-sentinel';
  const api = await fakeDigitalOcean(token, { machine: 'scripted', clock, testContext: t });
  onCleanup(t, () => api.close());
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '# managed by cland\n' + renderConfig(defaultConfig('setup-hosts')));
  await writeFile(join(root, '.cland/roles.toml'), rolesTemplate(['codex']));
  const hub = await projectHub(t, root, {}, { clock, processes, droplet: { processes, api: api.provider }, syntheticProvider: { token, api: api.provider } });
  // projectHub's verification isolation serializes configuration; restore its managed mark.
  await writeFile(join(root, '.cland/config.toml'), '# managed by cland\n' + await readFile(join(root, '.cland/config.toml'), 'utf8'));
  const o = options(), narration: string[] = [];
  o.root = root; o.hub = setupHub(root, {}); o.json = true;
  const failures: string[] = [];
  for (const key of ['configure', 'placeRole', 'reload', 'providers'] as const) {
    const original = o.hub[key]!;
    // Capture the fake-only boundary failure outside setup's sanitized output.
    Object.assign(o.hub, { [key]: async (...args: never[]) => {
      try { return await (original as (...args: never[]) => Promise<unknown>)(...args); }
      catch (error) { failures.push(`${key}: ${String(error)}`); throw error; }
    } });
  }
  o.machine.read = async path => readFile(join(root, '.cland', path), 'utf8');
  o.narrate = text => { narration.push(text); };
  o.prompter.confirm = async q => q === 'Set up agent hosts?' || q.startsWith('Place implementer ') || q.startsWith('Create agents:');
  const result = await hosts(o);
  assert.equal(result[0]?.verdict, 'done', JSON.stringify({ result, failures }));
  const config = parseConfig(await o.machine.read('config.toml') ?? '', 'setup-hosts', {});
  assert.equal(config.hosts.pools.agents?.minHosts, 1);
  assert.equal(config.hosts.pools.agents?.size, 's-4vcpu-8gb');
  const ui = await connectUi(t, hub.discovery, 'cli');
  const reply = await ui.request({ type: 'role.list' });
  assert.equal(reply.ok, true, reply.error);
  const roles = reply.value as { roles: { role: string; launch: { pool: string } }[] };
  assert.equal(roles.roles.find(r => r.role === 'implementer')?.launch.pool, 'agents');
  for (const output of [JSON.stringify(result), narration.join(''), await o.machine.read('config.toml'), await o.machine.read('roles.toml')]) assert.equal(output?.includes(token), false);
});
