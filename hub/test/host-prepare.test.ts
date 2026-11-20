import { isClientRequest } from '../src/protocol.ts';
// T2: real CLI over a projectHub socket; fake provider only, no native host.
import { parse } from 'smol-toml';
import { preservedConfig } from './config-preservation.ts';
import { defaultConfig, renderConfig, parseConfig } from '../src/init/config.ts';
import { poolSnapshotStorage, preparePools } from '../src/host/provider/pool-image.ts';
import { readHostPools } from '../src/host/transport-config.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { testWaitMs, until } from './until.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tempProject, projectHub, cland, connectUi } from './harness.ts';
import { stageCase } from './stage-case-fixture.ts';
import { ownedDatabases } from './owned-tracker.ts';

test('consenting client refuses stale prepare and login frames with no machine or login', async t => {
  const owner = stageCase(t);
  await owner.run(async step => {
  const root = await owner.wait('root setup', () => step(async () => {
    const root = await tempProject(owner.fixtures); owner.adoptRoot(root); return root;
  }));
  await owner.wait('config setup', () => step(async () => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), `# managed by cland 0.4.0\n[verification]\nlock_path=${JSON.stringify(join(root, 'suite.lock'))}\n[hosts.agents]\nprovider="fake"\nmin_hosts=0\nregion="fake-1"\n`);
  }));
  let hub: Awaited<ReturnType<typeof projectHub>> | undefined;
  const openDatabase = ownedDatabases(owner, () => hub?.stop());
  await owner.wait('hub setup', () => step(async () => {
    hub = await projectHub(owner.resources, root, { CLAND_FAKE_HOST_ROOT: root }, { openDatabase });
  }));
  const client = await owner.wait('client setup', () => step(() => connectUi(owner.resources, hub!.discovery, 'cli')));
  for (const type of ['host.prepare', 'login.add']) {
    const result = await owner.wait('stale paid admission', () => step(() => client.request({ type, pool: 'agents', harness: 'codex', expectedTerms: { pool: { provider: 'fake', region: 'old' } } })));
    assert.equal(result.ok, false);
    assert.match(String(result.error), /paid terms changed; current terms:.*fake-1/);
  }
  assert.deepEqual((await owner.wait('empty host inventory receipt', () => step(() => client.request({ type: 'host.list' })))).value, []);
  assert.deepEqual((await owner.wait('empty login inventory receipt', () => step(() => client.request({ type: 'login.list' })))).value, []);
  const before = await owner.wait('config prior-value setup', () => step(() => readFile(join(root, '.cland/config.toml'), 'utf8')));
  const stale = await owner.wait('stale config admission', () => step(() => client.request({ type: 'config.set', key: 'hosts.agents.region', value: 'fake-2', expected: { value: 'old' } })));
  assert.equal(stale.ok, false); assert.match(String(stale.error), /current value: "fake-1"/);
  assert.equal(await owner.wait('unchanged config receipt', () => step(() => readFile(join(root, '.cland/config.toml'), 'utf8'))), before);
  });
});

test('pool prepare refuses stale paid terms before creating an image', async t => {
  const owner = stageCase(t);
  await owner.run(async step => {
  const root = await owner.wait('root setup', () => step(async () => {
    const root = await tempProject(owner.fixtures); owner.adoptRoot(root); return root;
  }));
  await owner.wait('pool fixture config setup', () => step(async () => {
    await mkdir(join(root, '.cland'), { recursive: true });
    await writeFile(join(root, '.cland/config.toml'), '[hosts.agents]\nprovider="fake"\nregion="fake-1"\n');
  }));
  await owner.wait('stale pool preparation', () => step(() => assert.rejects(preparePools(root, 'agents', fixtureEnvironment(root, {}, { CLAND_FAKE_HOST_ROOT: root }), { pool: { provider: 'fake', region: 'old' } }), /paid terms changed; current terms:.*fake-1/)));
  await owner.wait('image absence receipt', () => step(() => assert.rejects(readFile(join(root, '.cland/run/hosts/agents-image.json')), { code: 'ENOENT' })));
  });
});

test('pool prepare CLI publishes an image and then reports current', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hosts]\nharnesses = { codex = "1.0.0" }\n[hosts.agents]\nprovider = "fake"\nsize = "fake"\nslots=8\nregion = "fake-1"\ntransport = "ssh"\n');
  await projectHub(t, root, { CLAND_FAKE_HOST_ROOT: root });
  const first = await cland(root, 'host', 'prepare');
  assert.equal(first.code, 0, first.stderr);
  assert.match(first.stdout, /agents: prepared/);
  const second = await cland(root, 'host', 'prepare', 'agents');
  assert.equal(second.code, 0, second.stderr);
  assert.match(second.stdout, /agents: current/);
});

for (const [part, change] of [
  ['harnesses', async (root: string, text: string) => writeFile(join(root, '.cland/config.toml'), text.replace('1.0.0', '2.0.0'))],
  ['lock', async (root: string) => writeFile(join(root, 'package-lock.json'), '{"lockfileVersion":3}')],
  ['provision', async (root: string) => writeFile(join(root, 'setup.sh'), '# changed hook\n')],
] as const) test(`pool prepare invalidates ${part} and names the changed part`, async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const text = '[verification]\nprovision = "setup.sh"\n[hosts]\nharnesses = { codex = "1.0.0" }\n[hosts.agents]\nprovider = "fake"\nsize = "fake"\nslots=8\nregion = "fake-1"\n';
  await writeFile(join(root, '.cland/config.toml'), text);
  await writeFile(join(root, 'setup.sh'), '# original hook\n');
  await projectHub(t, root, { CLAND_FAKE_HOST_ROOT: root });
  const first = await cland(root, 'host', 'prepare', 'agents');
  assert.equal(first.code, 0, first.stderr);
  await change(root, text);
  const changed = await cland(root, 'host', 'prepare', 'agents');
  assert.equal(changed.code, 0, changed.stderr);
  assert.match(changed.stdout, new RegExp(`agents: prepared; changed: ${part}\\n`));
});

test('pool prepare selects all configured pools and unknown pool names the choices', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[hosts.first]\nprovider="fake"\nsize="fake"\nslots=8\nregion="fake-1"\n[hosts.second]\nprovider="fake"\nsize="fake"\nslots=8\nregion="fake-1"\n');
  await projectHub(t, root, { CLAND_FAKE_HOST_ROOT: root });
  const all = await cland(root, 'host', 'prepare');
  assert.equal(all.code, 0, all.stderr);
  assert.match(all.stdout, /first: prepared/); assert.match(all.stdout, /second: prepared/);
  const unknown = await cland(root, 'host', 'prepare', 'missing');
  assert.equal(unknown.code, 1);
  assert.match(unknown.stderr, /unknown pool missing; configured pools: first, second/);
  const help = await cland(root, 'host', '--help');
  assert.equal(help.code, 0, help.stderr); assert.match(help.stdout, /host prepare \[pool\]/);
});

test('fake image build joins the configured build receipt and records its key', async t => {
  const root = await tempProject(t);
  const env = fixtureEnvironment(root, {}, { CLAND_FAKE_HOST_ROOT: root });
  let complete!: () => void;
  let started = false;
  const held = new Promise<void>(resolve => { complete = resolve; });
  let now = 0;
  const provider = new FakeHostProvider({ env, now: () => now, buildTimeMs: 250, wait: async ms => { assert.equal(ms, 250); started = true; await held; now += ms; } });
  const key = { node: 'v24.21.0', base: 'pool', harnesses: { codex: '1.0.0' } };
  const preparing = provider.prepare({ pool: 'agents', key });
  t.after(async () => { complete(); await preparing; });
  await until(() => started, { what: 'fake image build entered', timeoutMs: testWaitMs() });
  assert.equal(started, true);
  await assert.rejects(readFile(join(root, 'images/agents.json')), { code: 'ENOENT' });
  complete();
  assert.equal((await preparing).state, 'prepared');
  const record = JSON.parse(await readFile(join(root, 'images/agents.json'), 'utf8'));
  assert.deepEqual(record.key, key); assert.equal(record.buildTimeMs, 250); assert.equal(record.built, 250);
  assert.equal((await provider.prepare({ pool: 'agents', key })).state, 'current');
});

test('pool harness pins use renderer ids and exact release versions', () => {
  assert.deepEqual(readHostPools({ harnesses: { 'claude-code': '2.0.1', codex: '0.50.0', opencode: '1.2.3' } }).harnesses,
    { 'claude-code': '2.0.1', codex: '0.50.0', opencode: '1.2.3' });
  for (const harnesses of [{ claude: '2.0.1' }, { codex: 'latest' }, { codex: '^1.2.3' }, { codex: '1.2' }, { codex: '01.2.3' }]) {
    assert.throws(() => readHostPools({ harnesses }), /hosts.harnesses/);
  }
});

test('config set preserves SSH hosts and both pools before host prepare', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland/config.toml');
  const config = defaultConfig('preservation');
  config.verification.lockPath = join(root, 'suite.lock');
  const original = renderConfig(config).replace(/\[hosts\][\s\S]*?(?=\[project\])/, '') + preservedConfig;
  await writeFile(path, original);
  await writeFile(join(root, 'setup.sh'), '# fixture provision\n');
  await projectHub(t, root, { CLAND_FAKE_HOST_ROOT: root });
  const saved = await cland(root, 'config', 'set', 'verification.provision', 'setup.sh');
  assert.equal(saved.code, 0, saved.stderr);
  const expected = parse(original);
  (expected.verification as Record<string, unknown>).provision = 'setup.sh';
  assert.deepEqual(parse(await readFile(path, 'utf8')), expected);
  const prepared = await cland(root, 'host', 'prepare', 'first');
  assert.equal(prepared.code, 0, prepared.stderr);
  assert.match(prepared.stdout, /first: prepared/);
  const second = await cland(root, 'host', 'prepare', 'second');
  assert.equal(second.code, 0, second.stderr);
  assert.match(second.stdout, /second: prepared/);
});

for (const name of ['agents_1', '-agents', '', 'a'.repeat(65), 'agents.dot', 'agents\n']) test(`pool grammar refuses ${JSON.stringify(name)} at config and storage`, () => {
  const entry = { provider: 'fake', size: 'fake', region: 'fake-1' };
  assert.throws(() => readHostPools({ [name]: entry }), /letters, digits and hyphens/);
  assert.throws(() => poolSnapshotStorage('/unused', name), /letters, digits and hyphens/);
});

test('project config read refuses underscore pool before any host command', () => {
  assert.throws(() => parseConfig('[hosts.agents_1]\nprovider="fake"\nsize="fake"\nslots=8\nregion="fake-1"\n', 'fixture', {}), /letters, digits and hyphens/);
});

test('host prepare decoder shares pool grammar and preserves omitted and valid legacy frames', () => {
  assert.equal(isClientRequest({ type: 'host.prepare', id: 'prepare' }), true);
  for (const pool of ['agents', 'agents-host-x', 'A' + 'a'.repeat(63)]) {
    assert.equal(isClientRequest({ type: 'host.prepare', id: 'prepare', pool }), true, pool);
  }
  for (const pool of ['agents_1', '', '-agents', 'a'.repeat(65), 'agents\n']) {
    assert.equal(isClientRequest({ type: 'host.prepare', id: 'prepare', pool }), false, JSON.stringify(pool));
  }
});
