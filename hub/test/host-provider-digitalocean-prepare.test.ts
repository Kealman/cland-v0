import { admissionFixture } from './host-admission-fixture.ts';
// T2: provider admission and pool image lifecycle against the scripted API/machine.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { DigitalOceanHostProvider } from '../src/host/provider/digitalocean.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { FakeClock } from './fake-clock.ts';

test('digitalocean production create names the missing host lease watchdog and spend before API access', async t => {
  const clock = new FakeClock();
  const api = await fakeDigitalOcean('pool-sentinel', { machine: 'scripted', clock });
  t.after(() => api.close());
  const provider = new DigitalOceanHostProvider({ root: api.stateRoot, env: {}, api: api.provider, clock });
  const admission=provider.createAdmission();
  assert.equal(admission.state,'refused');assert.equal(api.requests.length,0,'preflight makes no API call');
  const result = await provider.acquire({ project: 'contract', pool: 'agents', architecture: 'x86_64' });
  assert.deepEqual(result,admission,'acquire uses the same refusal policy');
  assert.equal(result.state, 'refused');
  if (result.state !== 'refused') return;
  assert.match(result.reason, /lease.*watchdog.*reservation/);
  assert.equal(api.requests.length, 0);
});

async function fixture(t: TestContext) {
  const { mkdir, writeFile, readFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  const { fixtureEnvironment } = await import('./fixture-environment.ts');
  const { scriptedMachine } = await import('./fakes/digitalocean/scripted-machine.ts');
  const { drive } = await import('./remote-clock.ts');
  const { poolImageKey } = await import('../src/host/provider/pool-image.ts');
  const clock = new FakeClock();
  const api = await fakeDigitalOcean('pool-sentinel', { machine: 'scripted', clock });
  t.after(() => api.close());
  api.account.droplet_limit = 10;
  const root = api.stateRoot;
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), 'name="contract"\n[verification]\nprepare="prepare-agent"\nprovision="setup.sh"\n[verification.droplet]\nsize="c-8"\nprepare_size="c-8"\nslots=8\nregions=["lon1"]\n[hosts]\nharnesses={codex="1.2.3"}\n[hosts.agents]\nprovider="digitalocean"\nsize="c-8"\nslots=8\nregion="fra1"\n');
  await writeFile(join(root, 'setup.sh'), 'echo provision');
  const key = await poolImageKey(root, {}, 'digitalocean');
  const machine = scriptedMachine(root, clock, key);
  const commands: { command: string; user: string }[] = [];
  const dependencies = { ...machine.dependencies, api: api.provider, machine: { ...machine.dependencies.machine,
    exec: async () => '', put: async () => {},
    result: async (_lease: unknown, command: string, _timeout: number, _signal?: AbortSignal, user = 'runner') => { commands.push({ command, user }); return { stdout: 'ok', stderr: '', code: 0 }; },
  } };
  const env = fixtureEnvironment(root, {}, { DIGITALOCEAN_TOKEN: 'pool-sentinel', CLAND_FAKE_HOST_ROOT: root, CLAND_EXECUTOR_STATE: join(root, 'executor-state') });
  const provider = new DigitalOceanHostProvider({ root, env, api: api.provider, clock, dependencies });
  await admissionFixture(t,root,env,clock).wrap(provider);
  return { root, api, clock, key, machine, provider, commands, readFile, join, drive, dependencies, env };
}

test('digitalocean prepare builds an agent image then root provision and runner prepare, and reuses its key', async t => {
  const { root, api, key, machine, provider, commands, readFile, join, drive } = await fixture(t);
  const first = await drive(machine, provider.prepare({ pool: 'agents', key }));
  assert.equal(first.state, 'prepared', first.state === 'failed' ? first.reason : first.summary);
  const recipe = api.requests.find(r => r.method === 'POST' && r.path === '/v2/droplets')!.body!.user_data;
  assert.match(String(recipe), /@openai\/codex@1\.2\.3/);
  assert.match(commands[0]!.command, /setup.sh/); assert.equal(commands[0]!.user, 'root');
  assert.match(commands[1]!.command, /prepare-agent/); assert.equal(commands[1]!.user, 'runner');
  const snapshot = JSON.parse(await readFile(join(root, '.cland/run/hosts/agents-image.json'), 'utf8'));
  assert.equal(snapshot.image, api.images[0]!.id);
  assert.ok(snapshot.regions.includes('fra1'));
  const tags = api.requests.filter(r => r.method === 'POST' && r.path.includes('/tags/')).map(r => r.path);
  assert.ok(tags.some(path => path.includes('cland-pool-agents')));
  assert.ok(tags.some(path => path.includes('/tags/cland/')));
  const sent = api.requests.length;
  assert.equal((await drive(machine, provider.prepare({ pool: 'agents', key }))).state, 'current');
  assert.equal(api.requests.length, sent);
});


test('digitalocean create refuses a missing or stale pool image and sends provider prelude with a current one', async t => {
  const { root, api, key, machine, provider, drive } = await fixture(t);
  const request = { project: 'contract', pool: 'agents', architecture: 'x86_64' as const, region: 'fra1' };
  const missing = await provider.acquire(request);
  assert.equal(missing.state, 'refused');
  if (missing.state === 'refused') assert.match(missing.reason, /cland host prepare/);
  assert.equal(api.requests.length, 0);
  {const result=await drive(machine,provider.prepare({pool:'agents',key}));assert.equal(result.state,'prepared',JSON.stringify(result));}
  api.faults.allocateAddressEarly = true;
  const created = await provider.acquire(request);
  assert.equal(created.state, 'created');
  const body = api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').at(-1)!.body!;
  assert.equal(body.image, api.images[0]!.id);
  assert.match(String(body.user_data), /99-digitalocean-automount.rules/);
  assert.match(String(body.user_data), /runner ALL=\(root\) NOPASSWD: \/usr\/local\/sbin\/cland-auth/);
  assert.match(String(body.user_data), /cli_auth_credentials_store = "file"/);
  const { writeFile } = await import('node:fs/promises');
  await writeFile(`${root}/setup.sh`, 'echo changed');
  const count = api.requests.length;
  const stale = await provider.acquire(request);
  assert.equal(stale.state, 'refused');
  assert.equal(api.requests.length, count);
});

test('digitalocean replacement publishes before retirement and retains a split DELETE404 with live GET', async t => {
  const { root, api, key, machine, provider, drive, readFile, join, dependencies, env } = await fixture(t);
  const { writeFile } = await import('node:fs/promises');
  const { hash } = await import('../src/executor/droplet/prepare.ts');
  const { readRecoveries } = await import('../src/executor/droplet/snapshot-recovery.ts');
  assert.equal((await drive(machine, provider.prepare({ pool: 'agents', key }))).state, 'prepared');
  const previous = api.images[0]!.id;
  const path = join(root, '.cland/run/hosts/agents-image.json');
  await writeFile(join(root, 'setup.sh'), 'echo next');
  const next = { ...key, provision: hash('echo next') };
  Object.assign(key, next);
  let publicationObserved = false;
  const remove = api.provider.deleteSnapshot.bind(api.provider);
  t.mock.method(api.provider, 'deleteSnapshot', async (id: number) => {
    if (id === previous) { assert.notEqual(JSON.parse(await readFile(path, 'utf8')).image, previous); publicationObserved = true; }
    return remove(id);
  });
  // Every DELETE404 remains paired with a live by-id GET; never a deletion receipt.
  api.faults.snapshotDelete404Reads = 2;
  assert.equal((await drive(machine, provider.prepare({ pool: 'agents', key: next }))).state, 'failed');
  const current = JSON.parse(await readFile(path, 'utf8'));
  assert.notEqual(current.image, previous);
  const storage = { recordPath: path, recoveryRoot: join(root, '.cland/run/hosts/agents-recovery') };
  const records = await readRecoveries(root, storage);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.previous!.image, previous);
  assert.ok(api.requests.some(r => r.method === 'GET' && r.path === `/v2/snapshots/${previous}`));
  api.faults.snapshotDelete404Reads = 0;
  const { DropletExecutor } = await import('../src/executor/droplet/droplet.ts');
  const restarted = new DropletExecutor(root, undefined, () => {}, env, undefined, dependencies);
  try { await drive(machine, restarted.reconcile(false)); } finally { await restarted.close(); }
  assert.equal((await readRecoveries(root, storage)).length, 0, 'periodic reconciliation settles pool retirement without another prepare');
  assert.equal(publicationObserved, true);
  assert.ok(!api.images.some(i => i.id === previous));
});

test('digitalocean prepare transfers an unchanged image after the pool region changes', async t => {
  const { root, api, key, machine, provider, drive, readFile, join } = await fixture(t);
  const { writeFile } = await import('node:fs/promises');
  assert.equal((await drive(machine, provider.prepare({ pool: 'agents', key }))).state, 'prepared');
  const previous = api.images[0]!.id;
  const executorPath = join(root, '.cland/run/executor/snapshot.json');
  await writeFile(executorPath, 'executor-pointer-must-stay-unchanged');
  const path = join(root, '.cland/config.toml');
  await writeFile(path, (await readFile(path, 'utf8')).replace('region="fra1"', 'region="ams3"'));
  const result = await drive(machine, provider.prepare({ pool: 'agents', key }));
  assert.equal(result.state, 'prepared');
  const snapshot = JSON.parse(await readFile(join(root, '.cland/run/hosts/agents-image.json'), 'utf8'));
  assert.equal(snapshot.image, previous);
  assert.ok(snapshot.regions.includes('ams3'));
  assert.equal(await readFile(executorPath, 'utf8'), 'executor-pointer-must-stay-unchanged');
  api.faults.allocateAddressEarly = true;
  assert.equal((await provider.acquire({ project: 'contract', pool: 'agents', architecture: 'x86_64', region: 'ams3' })).state, 'created');
});

test('digitalocean pool key invalidates an omitted harness default without changing executor digest', async t => {
  const { root, env } = await fixture(t);
  const { poolImageKey, samePoolImageKey } = await import('../src/host/provider/pool-image.ts');
  const { TESTED_RANGES } = await import('../src/doctor/ranges.ts');
  const { recipeDigest } = await import('../src/executor/droplet/prepare.ts');
  const before = await poolImageKey(root, env, 'digitalocean');
  const executorDigest = await recipeDigest();
  const previous = TESTED_RANGES['claude-code'].min;
  try {
    TESTED_RANGES['claude-code'].min = [previous[0], previous[1], previous[2] + 1];
    const after = await poolImageKey(root, env, 'digitalocean');
    assert.equal(samePoolImageKey(before, after), false);
    assert.notEqual(before.recipe, after.recipe);
    assert.equal(await recipeDigest(), executorDigest);
  } finally { TESTED_RANGES['claude-code'].min = previous; }
});

test('digitalocean periodic reconciliation leaves an admitted pool builder recovery owned until it joins', async t => {
  const { root, key, machine, provider, drive, dependencies, env, join } = await fixture(t);
  const { DropletExecutor } = await import('../src/executor/droplet/droplet.ts');
  const { readRecoveries } = await import('../src/executor/droplet/snapshot-recovery.ts');
  const { until, testWaitMs } = await import('./until.ts');
  const release = Promise.withResolvers<void>();
  let entered = false;
  const result = dependencies.machine.result;
  dependencies.machine.result = async (...args) => { entered = true; await release.promise; return result(...args); };
  const preparing = drive(machine, provider.prepare({ pool: 'agents', key }));
  const periodic = new DropletExecutor(root, undefined, () => {}, env, undefined, dependencies);
  try {
    await until(() => entered, { what: 'root provision command entered before periodic reconciliation', timeoutMs: testWaitMs(2000) });
    await drive(machine, periodic.reconcile(false));
    const records = await readRecoveries(root, { recordPath: join(root, '.cland/run/hosts/agents-image.json'), recoveryRoot: join(root, '.cland/run/hosts/agents-recovery') });
    assert.equal(records.length, 1);
    assert.equal(records[0]!.phase, 'build');
  } finally { release.resolve(); await preparing; await periodic.close(); }
  assert.equal((await preparing).state, 'prepared');
});
