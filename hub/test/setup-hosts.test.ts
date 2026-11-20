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
import { prepareLoginSignIn } from '../src/host/login-signin.ts';
import type { Host } from '../src/host/host.ts';
import type { HostProvider } from '../src/host/provider/provider.ts';
import { setup } from '../src/setup/runner.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { LoginRecords } from '../src/host/logins.ts';
import { legacyRemoteHubFixture } from './fakes/legacy-remote-hub.ts';

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

test('missing pool placements remain open without effects even with yes', async () => {
  for (const yes of [false, true]) {
    const o = options(); o.interactive = false; o.yes = yes;
    o.machine.read = async path => path === 'roles.toml' ? '[implementer.launch]\nharness="codex"\npool="agents"\n[reviewer.launch]\nharness="codex"\npool="workers"\n' : '';
    o.hub!.providers = async () => { throw Error('unexpected provider read'); };
    o.hub!.configure = async () => { throw Error('unexpected configuration'); };
    o.hub!.placeRole = async () => { throw Error('unexpected placement'); };
    const lines = await hosts(o);
    assert.equal(lines.length, 2);
    assert.deepEqual(lines.map(l => [l.name, l.verdict, l.detail, l.fix]), [
      ['agent hosts', 'open', 'role implementer: pool agents is not configured', 'cland config set hosts.agents.provider digitalocean; cland hub reload OR cland role launch implementer --pool local; cland hub reload'],
      ['agent hosts', 'open', 'role reviewer: pool workers is not configured', 'cland config set hosts.workers.provider digitalocean; cland hub reload OR cland role launch reviewer --pool local; cland hub reload'],
    ]);
    const result = await setup({ ...o, noAide: true, noAccounts: true });
    assert.equal(result.code, 1);
    assert.equal(result.report.next, 'cland setup');
  }
});

test('T1831 C5 configured nonterminal pool reports image and missing harness commands without effects', async () => {
  const o = options(); o.interactive = false;
  let effects = 0;
  o.machine.addLogin = async () => { effects++; return 0; };
  o.hub!.preparePool = async () => { effects++; return []; };
  o.machine.read = async path => path === 'config.toml' ? '[hosts.agents]\nprovider="fake"\nmin_hosts=0\n' : '[implementer.launch]\nharness="codex"\npool="agents"\n';
  o.hub!.running = async () => ({ pid: 42 });
  o.hub!.hostStatus = async () => ({ pools: [], roleLogins: { implementer: false } });
  const lines = await hosts(o);
  assert.ok(lines.some(l => l.verdict === 'open' && l.fix === 'cland host prepare agents'));
  assert.ok(lines.some(l => l.verdict === 'open' && l.fix === 'cland login add codex --pool agents'));
  assert.equal(effects, 0);
});

test('T1831 C5 configured nonterminal yes retains exact commands when hub reads fail', async () => {
  const o = options(); o.interactive = false; o.yes = true;
  let effects = 0;
  o.machine.addLogin = async () => { effects++; return 0; };
  o.hub!.preparePool = async () => { effects++; return []; };
  o.machine.read = async path => path === 'config.toml' ? '[hosts.agents]\nprovider="digitalocean"\nmin_hosts=0\n' : '[implementer.launch]\nharness="codex"\npool="agents"\n';
  o.hub!.providers = async () => { throw Error('unavailable'); };
  o.hub!.hostStatus = async () => { throw Error('unavailable'); };
  const lines = await hosts(o);
  assert.ok(lines.some(l => l.verdict === 'open' && l.fix === 'cland host prepare agents'));
  assert.ok(lines.some(l => l.verdict === 'open' && l.fix === 'cland login add codex --pool agents'));
  assert.equal(effects, 0);
});

test('T1831 ready logins still require a current image before ok', async () => {
  const o = options(); o.interactive = false;
  o.machine.read = async path => path === 'config.toml' ? '[hosts.agents]\nprovider="fake"\nmin_hosts=0\n' : '[implementer.launch]\nharness="codex"\npool="agents"\n';
  o.hub!.running = async () => ({ pid: 42 });
  o.hub!.hostStatus = async () => ({ pools: [], roleLogins: { implementer: true } });
  o.machine.image = async () => ({ state: 'absent' });
  assert.ok((await hosts(o)).some(l => l.verdict === 'open' && l.fix === 'cland host prepare agents'));
  o.machine.image = async () => ({ state: 'stale', changed: ['lock'] });
  assert.ok((await hosts(o)).some(l => l.verdict === 'open' && l.fix === 'cland host prepare agents'));
  o.machine.image = async () => ({ state: 'current' });
  assert.equal((await hosts(o))[0]?.verdict, 'ok');
  assert.equal((await hosts(o)).length, 1);
});

test('T1831 pre-admission refusal retains add guidance without inventing a signin name', async () => {
  const o = options();
  o.machine.read = async path => path === 'config.toml' ? '[hosts.agents]\nprovider="fake"\nmin_hosts=0\n' : '[implementer.launch]\nharness="codex"\npool="agents"\n';
  o.hub!.hostStatus = async () => ({ pools: [], roleLogins: { implementer: false } });
  o.hub!.login = async () => undefined;
  o.machine.addLogin = async () => { throw Error('refused before admission'); };
  o.prompter.confirm = async q => q.startsWith('cland login add');
  assert.equal((await hosts(o)).find(l => l.name === 'agent hosts codex login')?.fix, 'cland login add codex --pool agents');
});

test('T1831 successful pinned login refreshes eligibility before unpinned and distinct-account offers', async () => {
  const o = options(); let ready = false; const accounts: (string | undefined)[] = [];
  o.machine.read = async path => path === 'config.toml' ? '[hosts.agents]\nprovider="fake"\nmin_hosts=0\n' : '[implementer.launch]\nharness="codex"\npool="agents"\naccount="A"\n[reviewer.launch]\nharness="codex"\npool="agents"\n[qa.launch]\nharness="codex"\npool="agents"\naccount="B"\n';
  o.hub!.hostStatus = async () => ({ pools: [], roleLogins: { implementer: ready, reviewer: ready, qa: false } });
  o.hub!.login = async name => ({ name, harness: 'codex', account: name === 'codex-1' ? 'A' : 'B', kind: 'disk', provider: 'fake', region: 'lon1', state: 'ready' } as never);
  o.machine.addLogin = async (input, admitted) => { accounts.push(input.account); admitted(`codex-${accounts.length}`); ready = true; return 0; };
  o.prompter.confirm = async q => q.startsWith('cland login add');
  await hosts(o);
  assert.deepEqual(accounts, ['A', 'B']);
});

for (const action of ['image', 'login'] as const) test(`T1831 ${action} consent refuses changed paid terms before effects`, async () => {
  const o = options(); let changed = false, effects = 0;
  o.machine.read = async path => path === 'config.toml' ? `[verification.droplet]\nprepare_size="${changed && action === 'image' ? 'c-16' : 'c-8'}"\n[hosts.agents]\nprovider="digitalocean"\nregion="${changed && action === 'login' ? 'nyc1' : 'lon1'}"\nmin_hosts=0\n` : '[implementer.launch]\nharness="codex"\npool="agents"\n';
  o.hub!.providers = async () => ({ providers: [{ provider: 'digitalocean', present: true, fingerprint: 'fake' }] });
  o.hub!.hostStatus = async () => ({ pools: [], roleLogins: { implementer: false } });
  o.hub!.preparePool = async () => { effects++; return [{ pool: 'agents', state: 'prepared' }]; };
  o.machine.addLogin = async () => { effects++; return 0; };
  o.prompter.confirm = async q => {
    if (action === 'image' && q.startsWith('cland host prepare') || action === 'login' && q.startsWith('cland login add')) { changed = true; return true; }
    return false;
  };
  const lines = await hosts(o), line = lines.find(l => l.name === (action === 'image' ? 'agent hosts image' : 'agent hosts codex login'))!;
  assert.equal(effects, 0);
  assert.equal(line.verdict, 'open'); assert.match(line.detail, /changed/);
  assert.equal(line.fix, action === 'image' ? 'cland host prepare agents' : 'cland login add codex --pool agents');
});

test('T1831 named login lookup bounds retained inventory work and preserves unfiltered arrays', async t => {
  const root = await tempProject(t), clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  await mkdir(join(root, '.cland'), { recursive: true });
  const seed = new Store(layout(root).db);
  seed.hosts.logins.useClock(clock);
  try {
    seed.transaction(() => { for (let i = 0; i < 256; i++) {
      seed.hosts.logins.insert({ name: `old-${i}`, harness: 'codex', account: `old-${i}`, kind: 'disk', provider: 'fake', region: 'lon1', volumeId: null, snapshotIds: [], lastSignIn: null });
      seed.hosts.logins.markSignedOut(`old-${i}`, { reason: 'retained inventory fixture', host: null });
    }
    seed.hosts.logins.insert({ name: 'shared', harness: 'codex', account: 'shared', kind: 'disk', exclusive: false, provider: 'fake', region: 'lon1', volumeId: 'writer-volume', snapshotIds: [], lastSignIn: null });
    seed.hosts.logins.transition('shared', 'ready');
    seed.hosts.logins.bind('shared', { host: 'writer', role: 'writer', volumeId: 'writer-volume' });
    for (let i = 0; i < 128; i++) seed.hosts.logins.bind('shared', { host: `reader-${i}`, role: 'reader', volumeId: `reader-volume-${i}` });
    });
  } finally { seed.close(); }
  const hub = await projectHub(t, root, {}, { clock, processes, droplet: { processes } });
  const ui = await connectUi(t, hub.discovery, 'cli');
  const unfiltered = await ui.request({ type: 'login.list' });
  assert.equal(unfiltered.ok, true, unfiltered.error);
  assert.equal((unfiltered.value as unknown[]).length, 257);
  const shared = (unfiltered.value as { name: string; bindings: unknown[] }[]).find(row => row.name === 'shared')!;
  assert.equal(shared.bindings.length, 129, 'unfiltered reply preserves every actual binding');
  const all = LoginRecords.prototype.list;
  let fullScans = 0;
  t.mock.method(LoginRecords.prototype, 'list', function(this: LoginRecords) { fullScans++; return all.call(this); });
  const bindings = LoginRecords.prototype.bindings; let bindingScans = 0;
  t.mock.method(LoginRecords.prototype, 'bindings', function(this: LoginRecords, name: string) { bindingScans++; return bindings.call(this, name); });
  const get = LoginRecords.prototype.get; let lookups = 0;
  t.mock.method(LoginRecords.prototype, 'get', function(this: LoginRecords, name: string) { lookups++; return get.call(this, name); });
  const found = await ui.request({ type: 'login.list', name: 'shared' });
  assert.equal(found.ok, true, found.error);
  assert.deepEqual(found.value, [{ name: 'shared', harness: 'codex', account: 'shared', state: 'in-use', kind: 'disk', provider: 'fake', region: 'lon1' }]);
  assert.equal(Object.hasOwn((unfiltered.value as object[])[0]!, 'bindings'), true);
  const missing = await ui.request({ type: 'login.list', name: 'absent' });
  assert.equal(missing.ok, true, missing.error); assert.deepEqual(missing.value, []);
  assert.equal(fullScans, 0, 'named reads never decode retained inventory');
  assert.equal(bindingScans, 0, 'named metadata never enumerates reader bindings');
  assert.equal(lookups, 2, 'one indexed lookup per request regardless of retained row count');
});

test('T1831 named lookup accepts the previous unfiltered login.list wire shape', async t => {
  const root = await tempProject(t);
  const rows = [{ name: 'other', state: 'signed-out' }, { name: 'codex-1', state: 'ready' }];
  await legacyRemoteHubFixture(t, root, { logins: () => rows }).start();
  const client = setupHub(root, {});
  assert.deepEqual(await client.login!('codex-1'), rows[1]);
  assert.equal(await client.login!('absent'), undefined);
});

for (const consent of [false, true]) test(`T1831 C1 C3 image build consent ${consent} names paid machine and defaults No`, async () => {
  const o = options(); let builds = 0;
  o.machine.read = async path => path === 'config.toml' ? '[hosts.agents]\nprovider="digitalocean"\nmin_hosts=0\n' : '[implementer.launch]\nharness="codex"\npool="agents"\n';
  o.hub!.providers = async () => ({ providers: [{ provider: 'digitalocean', present: true, fingerprint: 'fake' }] });
  o.hub!.hostStatus = async () => ({ pools: [], roleLogins: { implementer: false } });
  o.hub!.preparePool = async () => { builds++; return [{ pool: 'agents', state: 'prepared' }]; };
  o.prompter.confirm = async (q, def) => {
    assert.equal(def, false);
    assert.match(q, q.startsWith('cland host prepare') ? /paid DigitalOcean build machine c-8; declared \$0\.25\/h/ : /paid.*s-4vcpu-8gb/);
    return q.startsWith('cland host prepare') && consent;
  };
  const lines = await hosts(o);
  assert.equal(builds, consent ? 1 : 0);
  const image = lines.find(l => l.name === 'agent hosts image')!;
  assert.equal(image.verdict, consent ? 'done' : 'skip');
  assert.match(image.detail, consent ? /agents: prepared/ : /cland host prepare agents/);
  assert.equal(lines.find(l => l.name === 'agent hosts codex login')?.verdict, 'skip');
});

for (const code of [0, 1, 130]) test(`T1831 C2 C4 terminal login exit ${code} reports durable state and recovery`, async () => {
  const o = options(); let signedIn = false, runs = 0;
  o.machine.read = async path => path === 'config.toml' ? '[hosts.agents]\nprovider="fake"\nmin_hosts=0\n' : '[implementer.launch]\nharness="codex"\npool="agents"\n[reviewer.launch]\nharness="codex"\npool="agents"\n';
  o.hub!.hostStatus = async () => ({ pools: [], roleLogins: { implementer: false, reviewer: false } });
  o.hub!.login = async () => signedIn ? { name: 'codex-1', harness: 'codex', kind: 'disk', provider: 'fake', region: 'lon1', state: code === 0 ? 'ready' : 'signed-out' } as never : undefined;
  o.prompter.confirm = async (q, def) => { assert.equal(def, false); return q.startsWith('cland login add'); };
  o.machine.addLogin = async (input, admitted) => { assert.deepEqual(input, { harness: 'codex', pool: 'agents', expectedTerms: { pool: (await import('../src/host/pools.ts')).hostPoolsDocument(parseConfig(await o.machine.read('config.toml') ?? '', 'unused', {}).hosts).agents } }); admitted('codex-1'); runs++; signedIn = true; return code; };
  const lines = await hosts(o), login = lines.find(l => l.name === 'agent hosts codex login')!;
  assert.equal(runs, 1, 'shared harness needs one login');
  assert.equal(login.verdict, code === 0 ? 'done' : 'open');
  if (code === 0) assert.match(login.detail, /codex-1: ready/);
  else assert.equal(login.fix, 'cland login signin codex-1');
});

test('T1831 ready row from another region cannot confirm terminal sign-in', async () => {
  const o = options(); let ran = false;
  o.machine.read = async path => path === 'config.toml' ? '[hosts.agents]\nprovider="fake"\nmin_hosts=0\n' : '[implementer.launch]\nharness="codex"\npool="agents"\n';
  o.hub!.hostStatus = async () => ({ pools: [], roleLogins: { implementer: false } });
  o.hub!.login = async () => ran ? { name: 'codex-1', harness: 'codex', kind: 'disk', provider: 'fake', region: 'wrong', state: 'ready' } as never : undefined;
  o.machine.addLogin = async (_input, admitted) => { admitted('codex-1'); ran = true; return 0; };
  o.prompter.confirm = async q => q.startsWith('cland login add');
  assert.equal((await hosts(o)).find(l => l.name === 'agent hosts codex login')?.verdict, 'open');
});

test('T1831 accepted image offer publishes the fake pool image through the setup socket client', async t => {
  const root = await tempProject(t), clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nmin_hosts=0\n');
  await writeFile(join(root, '.cland/roles.toml'), '[implementer.launch]\nharness="codex"\npool="agents"\n');
  await projectHub(t, root, { CLAND_FAKE_HOST_ROOT: root }, { clock, processes, droplet: { processes } });
  const o = options(); o.root = root; o.hub = setupHub(root, {});
  o.machine.read = async path => readFile(join(root, '.cland', path), 'utf8');
  o.prompter.confirm = async (q, def) => { assert.equal(def, false); return q.startsWith('cland host prepare'); };
  const image = (await hosts(o)).find(l => l.name === 'agent hosts image');
  assert.equal(image?.verdict, 'done'); assert.equal(image?.detail, 'agents: prepared');
  const receipt = JSON.parse(await readFile(join(root, '.cland/run/hosts/agents-image.json'), 'utf8'));
  assert.equal(receipt.key.base, 'pool');
  assert.equal((await hosts(o)).find(l => l.name === 'agent hosts image')?.detail, 'agents: current');
});

for (const size of ['c-16', 'unpriced']) test(`T1831 builder ${size} uses declared price or remains open`, async () => {
  const o = options(); let built = false;
  o.machine.read = async path => path === 'config.toml' ? `[verification.droplet]\nprepare_size="${size}"\n[hosts.agents]\nprovider="digitalocean"\nmin_hosts=0\n` : '[implementer.launch]\nharness="codex"\npool="agents"\n';
  o.hub!.providers = async () => ({ providers: [{ provider: 'digitalocean', present: true, fingerprint: 'fake' }] });
  o.hub!.hostStatus = async () => ({ pools: [], roleLogins: { implementer: false } });
  o.hub!.preparePool = async () => { built = true; return [{ pool: 'agents', state: 'current' }]; };
  o.prompter.confirm = async (q, def) => {
    assert.equal(def, false);
    if (!q.startsWith('cland host prepare')) return false;
    assert.match(q, /paid DigitalOcean build machine c-16; declared \$0\.50\/h/); return true;
  };
  const image = (await hosts(o)).find(l => l.name === 'agent hosts image')!;
  assert.equal(image.verdict, size === 'c-16' ? 'done' : 'open');
  assert.equal(built, size === 'c-16');
  if (size === 'unpriced') assert.equal(image.fix, 'cland host prepare agents');
});

for (const code of [0, 1, 130]) test(`T1831 socket sign-in ${code} persists login outcome and reaches Aide`, async t => {
  const root = await tempProject(t), clock = new FakeClock(Date.now()), processes = fakeLockProcesses().processes;
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nmin_hosts=0\n');
  await writeFile(join(root, '.cland/roles.toml'), '[implementer.launch]\nharness="codex"\npool="agents"\n');
  const volume = { id: 'v', name: 'disk', project: root, region: 'lon1', sizeGiB: 1, created: clock.now().toISOString(), attachedTo: null };
  const host = { name: 'writer', loginDisk: async () => {}, publishFile: async () => true } as unknown as Host;
  const provider = { createVolume: async () => ({ state: 'created', volume }), attachVolume: async () => ({ state: 'attached' }), detachVolume: async () => ({ state: 'detached' }), snapshotVolume: async () => ({ state: 'snapshotted', snapshot: { id: 'snapshot', volumeId: 'v', created: clock.now().toISOString() } }) } as unknown as HostProvider;
  const hub = await projectHub(t, root, {}, { clock, processes, droplet: { processes }, prepareLogin: async o => ({ pending: await prepareLoginSignIn({ logins: o.records.logins, host, provider, machine: { id: 'm', address: 'fake', architecture: 'x86_64', created: volume.created }, project: root, tag: 'fixture', providerName: 'fake', region: 'lon1', harness: 'codex', name: 'codex-1', clock }), plan: { name: 'codex-1', host: 'writer', command: 'ssh', args: [] } }) });
  const o = options(); o.root = root; o.noAccounts = true;
  o.env = fixtureEnvironment(root, {}, {});
  for (const key of ['HOME', 'CLAUDE_CONFIG_DIR', 'CODEX_HOME']) {
    assert.ok(o.env[key] === root || o.env[key]?.startsWith(root + '/'), `${key} must stay under the disposable root`);
  }
  await mkdir(o.env.CODEX_HOME!, { recursive: true });
  await writeFile(join(o.env.CODEX_HOME!, 'config.toml'), `[projects.${JSON.stringify(root)}]\ntrust_level="trusted"\n`);
  o.harness = 'codex';
  o.machine.harness = async id => ({ id, bin: '/fake/bin', version: [1, 0, 0], checks: [{ name: id, verdict: 'ok', detail: 'fake installed' }, { name: `${id} auth`, verdict: 'ok', detail: 'fake signed in' }] });
  o.hub = setupHub(root, {});
  o.hub.session = async () => ({ status: 'running' });
  o.machine.read = async path => readFile(join(root, '.cland', path), 'utf8');
  o.prompter.confirm = async q => q.startsWith('cland login add');
  const failures: unknown[] = [];
  o.machine.addLogin = async (input, admitted) => {
    try {
    assert.deepEqual(input, { harness: 'codex', pool: 'agents', expectedTerms: { pool: (await import('../src/host/pools.ts')).hostPoolsDocument(parseConfig(await o.machine.read('config.toml') ?? '', 'unused', {}).hosts).agents } });
    const terminal = await connectUi(t, hub.discovery, 'cli');
    const plan = await terminal.request({ type: 'login.add', harness: 'codex', pool: 'agents', name: 'codex-1' });
    assert.equal(plan.ok, true, plan.error);
    admitted((plan.value as { name: string }).name);
    const receipt = await terminal.request({ type: 'login.signed-in', name: 'codex-1', code });
    if (!receipt.ok) failures.push(receipt);
    assert.equal(receipt.ok, true, receipt.error);
    return code;
    } catch (error) { failures.push(String(error)); throw error; }
  };
  const { report } = await setup(o);
  const login = report.steps.find(l => l.name === 'agent hosts codex login');
  assert.equal(login?.verdict, code === 0 ? 'done' : 'open', JSON.stringify({ report, failures, row: await o.hub.login!('codex-1') }));
  if (code !== 0) assert.equal(login?.fix, 'cland login signin codex-1');
  assert.equal(report.steps.at(-1)?.name, 'aide');
  assert.equal(report.steps.at(-1)?.verdict, 'ok');
  assert.equal((await o.hub.login!('codex-1'))?.state, code === 0 ? 'ready' : 'signed-out');
});

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

test('C5 missing hub token stops before roles and asks for the hub store and restart', async () => {
  const o = options();
  o.prompter = scriptedPrompter([{ kind: 'confirm', question: 'Set up agent hosts?', answer: true }]);
  const line = (await hosts(o))[0]!;
  assert.equal(line.verdict, 'open');
  assert.match(line.detail, /cland secret set digitalocean\.token.*restart.*hub/i);
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
      if (q.startsWith('cland host prepare') || q.startsWith('cland login add')) { assert.equal(def, false); return false; }
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
  o.machine.image = async () => ({ state: 'current' });
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
  assert.match(line.detail, /cland secret set digitalocean\.token.*restart.*hub/);
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
  o.machine.image = async () => ({ state: 'current' });
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
