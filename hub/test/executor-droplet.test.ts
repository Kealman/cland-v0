import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clandWithEnv, connectUi, startDaemon, tempProject, eventually, spawnSpoke, pidAlive } from './harness.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { mkdir, readFile, writeFile, readdir, stat, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { preparedDropletFixture } from './droplet-fixture.ts';
import { createHash } from 'node:crypto';
import { flushProjectLogs } from './harness.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { ownProcess } from './process-cleanup.ts';
import type { TestContext } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

async function providerEnv(t: TestContext, api: Awaited<ReturnType<typeof fakeDigitalOcean>>, root: string, lifetimePoll = '25') {
  await preparedDropletFixture(root, api);
  const env = { DIGITALOCEAN_TOKEN: 'sentinel-lifecycle', CLAND_DIGITALOCEAN_API: api.url, CLAND_SSH_BIN: resolve('hub/test/fakes/digitalocean/ssh'), CLAND_SCP_BIN: resolve('hub/test/fakes/digitalocean/scp'), CLAND_TEST_FAKE_MACHINE_ROOT: api.stateRoot, CLAND_TEST_DROPLET_POLL_MS: lifetimePoll, CLAND_TEST_DROPLET_RELEASE_MS: '500', CLAND_TEST_DROPLET_RETRY_MS: '50' };
  for (const [key, value] of Object.entries(env)) {
    const old = process.env[key]; process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  return env;
}

test('executor status names a missing token; reap refuses without it; CLI controls respect roles', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root, { DIGITALOCEAN_TOKEN: '' });
  const ui = await connectUi(t, discovery);
  const status = await clandWithEnv(root, {}, 'executor', 'status');
  assert.equal(status.code, 0, status.stderr);
  assert.match(status.stdout, /token: absent \(DIGITALOCEAN_TOKEN\)/);
  const reap = await clandWithEnv(root, {}, 'executor', 'reap');
  assert.equal(reap.code, 1);
  assert.match(reap.stderr, /DIGITALOCEAN_TOKEN/);
  for (const [name, role] of [['coord', 'coordinator'], ['impl', 'implementer'], ['rev', 'reviewer'], ['qa-one', 'qa']] as const) {
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const spoke = await spawnSpoke({ discover: true, assignRole: false, cwd: root, name, role, sessionId: `${name}-id` });
    t.after(() => spoke.close());
    await spoke.waitForPresence([name]);
    for (const sub of ['status', 'reap']) {
      const result = await clandWithEnv(root, { CLAND_SESSION_NAME: name, CLAND_SESSION_ID: `${name}-id` }, 'executor', sub, '--json');
      if (role === 'coordinator') {
        assert.equal(result.code, sub === 'status' ? 0 : 1, result.stderr);
        assert.doesNotMatch(result.stderr, /forbidden/);
      } else {
        assert.equal(result.code, 1);
        assert.match(result.stderr, new RegExp(`forbidden.*executor\\.${sub}`));
      }
    }
  }
});

test('an acquisition deadline destroys resources and keeps no active lease', async t => {
  const root = await tempProject(t);
  const api = await fakeDigitalOcean('sentinel-lifecycle'); t.after(() => api.close());
  await providerEnv(t, api, root);
  api.faults.activeAfter = 100000;
  process.env.CLAND_TEST_DROPLET_ACQUIRE_MS = '250';
  t.after(() => { delete process.env.CLAND_TEST_DROPLET_ACQUIRE_MS; });
  const executor = new DropletExecutor(root);
  await assert.rejects(executor.acquire({ id: 'deadline' }, new Date(Date.now() + 60000).toISOString()), /deadline/);
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  assert.deepEqual(api.droplets, []);
  assert.deepEqual(api.keys, []);
  const [id] = await readdir(join(root, '.cland/run/executor/leases'));
  const lease = JSON.parse(await readFile(join(root, '.cland/run/executor/leases', id!, 'lease.json'), 'utf8'));
  assert.equal(lease.state, 'released');
});

test('a late create after a lost response is discovered and deleted before forgetting its lease', async t => {
  const root = await tempProject(t);
  const api = await fakeDigitalOcean('sentinel-lifecycle'); t.after(() => api.close());
  await providerEnv(t, api, root);
  process.env.CLAND_TEST_DIGITALOCEAN_TIMEOUT_MS = '50';
  t.after(() => { delete process.env.CLAND_TEST_DIGITALOCEAN_TIMEOUT_MS; });
  api.faults.delayMs = 200; api.faults.delayPath = '/droplets';
  const executor = new DropletExecutor(root);
  await assert.rejects(executor.acquire({ id: 'late' }, new Date(Date.now() + 300000).toISOString()), /time bound/);
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
  const [id] = await readdir(join(root, '.cland/run/executor/leases'));
  const lease = JSON.parse(await readFile(join(root, '.cland/run/executor/leases', id!, 'lease.json'), 'utf8'));
  assert.equal(lease.state, 'released');
  assert.equal(lease.costUsd, 0.25 / 60);
});

test('an ambiguous SSH key import stays armed until the late key is discovered and deleted', async t => {
  const root = await tempProject(t);
  const api = await fakeDigitalOcean('sentinel-lifecycle'); t.after(() => api.close());
  const env = await providerEnv(t, api, root);
  process.env.CLAND_TEST_DIGITALOCEAN_TIMEOUT_MS = '100';
  process.env.CLAND_TEST_DROPLET_RELEASE_MS = '100';
  t.after(() => { delete process.env.CLAND_TEST_DIGITALOCEAN_TIMEOUT_MS; });
  let resumeImport!: () => void;
  const pendingImport = new Promise<void>(resolve => { resumeImport = resolve; });
  t.after(() => resumeImport());
  api.beforeImport(() => pendingImport);
  const executor = new DropletExecutor(root);
  await assert.rejects(executor.acquire({ id: 'late-key' }, new Date(Date.now() + 300000).toISOString()), /time bound/);
  const [id] = await readdir(join(root, '.cland/run/executor/leases'));
  const lease = JSON.parse(await readFile(join(root, '.cland/run/executor/leases', id!, 'lease.json'), 'utf8'));
  ownProcess(t, lease.watchdog.pid);
  assert.equal(lease.state, 'releasing');
  process.kill(lease.watchdog.pid, 0);
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/account/keys').length, 1);
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
  resumeImport();
  await startDaemon(t, root, { ...env, CLAND_TEST_DIGITALOCEAN_TIMEOUT_MS: '100', CLAND_TEST_DROPLET_RELEASE_MS: '100' });
  await eventually('the hub confirms the late imported key absent', async () => {
    const result = await clandWithEnv(root, {}, 'executor', 'status', '--json');
    const status = JSON.parse(result.stdout);
    return !status.leases.length && !api.keys.length ? true : undefined;
  });
  const released = JSON.parse(await readFile(join(root, '.cland/run/executor/leases', id!, 'lease.json'), 'utf8'));
  assert.equal(released.state, 'released');
  assert.equal(released.costUsd, 0);
  assert.ok(api.requests.some(r => r.method === 'DELETE' && r.path.startsWith('/v2/account/keys/')));
});

test('acquire reloads the droplet table, selects the first offered region and names invalid settings', async t => {
  const root = await tempProject(t);
  const api = await fakeDigitalOcean('sentinel-lifecycle'); t.after(() => api.close());
  await providerEnv(t, api, root);
  await mkdir(join(root, '.cland'), { recursive: true });
  const path = join(root, '.cland/config.toml');
  await symlink(root, join(root, 'alias'));
  const executor = new DropletExecutor(join(root, 'alias'));
  const first = await executor.acquire({ id: 'first-config' }, new Date(Date.now() + 300000).toISOString());
  ownProcess(t, first.watchdog!.pid); await executor.release(first);
  const expected = `cland-p-${createHash('sha256').update(`${root}\0${root.split('/').at(-1)}`).digest('hex').slice(0, 12)}`;
  assert.ok(first.tags.includes(expected), 'an alias of the project has the canonical project tag');
  api.sizes.push({ slug: 'small', available: true, price_hourly: 0.06, disk: 10, regions: ['nyc1'] });
  api.regions.find(r => r.slug === 'nyc1')!.sizes.push('small');
  await writeFile(path, '[verification]\nlifetime = "10s"\n[verification.droplet]\nsize = "small"\nregions = ["lon1", "nyc1"]\nimage = "ubuntu-24-04-x64"\n');
  const second = await executor.acquire({ id: 'second-config' }, new Date(Date.now() + 300000).toISOString());
  ownProcess(t, second.watchdog!.pid);
  assert.equal(second.size, 'small'); assert.equal(second.region, 'nyc1');
  assert.equal(Date.parse(second.deadline) - Date.parse(second.created), 10000);
  assert.equal((await executor.release(second)).costUsd, 0.001);
  for (const [source, field] of [['[verification]\nlifetime = "oops"', 'verification.lifetime'], ['[verification.droplet]\nregions = []', 'verification.droplet.regions'], ['[verification.droplet]\nsize = 12', 'verification.droplet.size']]) {
    await writeFile(path, source!);
    await assert.rejects(executor.acquire({ id: 'invalid' }, new Date(Date.now() + 300000).toISOString()), error => error instanceof Error && error.message.includes(field!));
  }
});

test('the detached watchdog survives a stopped hub; restart consumes its receipt and hides released leases', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[verification]\nlifetime = "3s"\n');
  const api = await fakeDigitalOcean('sentinel-lifecycle'); t.after(() => api.close());
  const env = await providerEnv(t, api, root);
  const started = await startDaemon(t, root, env);
  const ui = await connectUi(t, started.discovery);
  const executor = new DropletExecutor(root);
  const lease = await executor.acquire({ id: 'watchdog' }, new Date(Date.now() + 300000).toISOString());
  ownProcess(t, lease.watchdog!.pid);
  const rows = (await exec('ps', ['-ww', '-e', '-o', 'pid=,ppid=,command='])).stdout;
  assert.ok(!rows.includes('sentinel-lifecycle'));
  assert.equal((await ui.request({ type: 'hub.stop' })).ok, true);
  await eventually('hub has stopped before the watchdog deadline', () => !pidAlive(started.discovery.pid) ? true : undefined);
  const dir = join(root, '.cland/run/executor/leases', lease.lease);
  await eventually('watchdog confirms deletion without the hub', async () => {
    try { return JSON.parse(await readFile(join(dir, 'watchdog.json'), 'utf8')); } catch { return undefined; }
  }, 8000);
  assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
  const restarted = await startDaemon(t, root, env);
  const status = await clandWithEnv(root, {}, 'executor', 'status', '--json');
  assert.equal(status.code, 0, status.stderr);
  const value = JSON.parse(status.stdout);
  assert.deepEqual(value.leases, []);
  assert.equal(value.taggedDroplets, 0);
  assert.equal(value.todayCostUsd, 0.25 / 60);
  const restartedUi = await connectUi(t, restarted.discovery);
  const made = await restartedUi.request({ type: 'artifact.create', kind: 'note', title: 'Executor status', topic: 'general', content: status.stdout });
  assert.equal(made.ok, true, made.error);
  const artifactPath = (made.value as { artifact: { path: string } }).artifact.path;
  assert.ok(!(await readFile(artifactPath, 'utf8')).includes('sentinel-lifecycle'));
  await flushProjectLogs(t, root);
  const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  assert.match(journal, /executor-watchdog-fired/);
  assert.equal(JSON.parse(await readFile(join(dir, 'lease.json'), 'utf8')).state, 'released');
  const logged = [journal, await readFile(join(root, '.cland/log/hub.log'), 'utf8'), ...await Promise.all((await readdir(dir)).map(name => readFile(join(dir, name), 'utf8')))];
  assert.ok(logged.every(text => !text.includes('sentinel-lifecycle')));
});

test('acquire persists an armed lease before create, waits for a public IP, and release confirms both resources', async t => {
  const root = await tempProject(t);
  const api = await fakeDigitalOcean('sentinel-lifecycle');
  t.after(() => api.close());
  await providerEnv(t, api, root);
  api.beforeCreate(async () => {
    const base = join(root, '.cland/run/executor/leases');
    const [id] = await readdir(base);
    const lease = JSON.parse(await readFile(join(base, id!, 'lease.json'), 'utf8'));
    assert.equal(lease.state, 'creating');
    assert.equal(typeof lease.watchdog.pid, 'number');
    process.kill(lease.watchdog.pid, 0);
    assert.equal((await stat(join(base, id!, 'lease.json'))).mode & 0o777, 0o600);
    assert.equal((await stat(join(base, id!, 'key'))).mode & 0o777, 0o600);
    // Changing the token between create and polling proves it is read at each call.
    api.auth.token = 'sentinel-rotated'; process.env.DIGITALOCEAN_TOKEN = 'sentinel-rotated';
  });
  const executor = new DropletExecutor(root);
  const lease = await executor.acquire({ id: 'run-one' }, new Date(Date.now() + 300000).toISOString());
  ownProcess(t, lease.watchdog!.pid);
  assert.equal(lease.state, 'active');
  assert.equal(lease.address, '203.0.113.10');
  assert.equal(api.requests.filter(r => r.method === 'GET' && /^\/v2\/droplets\/\d+$/.test(r.path)).length, 3);
  api.faults.deletePolls = 2;
  api.faults.keyDeletePolls = 1;
  const released = await executor.release(lease);
  assert.deepEqual(api.droplets, []);
  assert.deepEqual(api.keys, []);
  assert.equal(lease.state, 'released');
  assert.equal(released.costUsd, 0.25 / 60);
  assert.ok(released.lifetimeMs !== null && released.lifetimeMs >= 0);
  assert.ok(!JSON.stringify(api.requests).includes('sentinel-lifecycle'));
  assert.ok(!JSON.stringify(api.requests).includes('sentinel-rotated'));
});

test('failed creates are bounded, never retried, and errors and durable state redact the token', async t => {
  const root = await tempProject(t);
  const api = await fakeDigitalOcean('sentinel-lifecycle'); t.after(() => api.close());
  await providerEnv(t, api, root);
  const executor = new DropletExecutor(root);
  for (const status of [422, 429]) {
    api.faults.create = status; api.faults.echoToken = true;
    await assert.rejects(executor.acquire({ id: `refused-${status}` }, new Date(Date.now() + 300000).toISOString()), error => {
      assert.ok(error instanceof Error);
      assert.match(error.message, new RegExp(`${status} refused`));
      assert.ok(!error.message.includes('sentinel-lifecycle'));
      return true;
    });
    assert.deepEqual(api.keys, []);
  }
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
  for (const id of await readdir(join(root, '.cland/run/executor/leases'))) {
    const text = await readFile(join(root, '.cland/run/executor/leases', id, 'lease.json'), 'utf8');
    assert.ok(!text.includes('sentinel-lifecycle'));
    assert.equal(JSON.parse(text).state, 'released');
  }
  process.env.CLAND_TEST_DIGITALOCEAN_TIMEOUT_MS = '30';
  t.after(() => { delete process.env.CLAND_TEST_DIGITALOCEAN_TIMEOUT_MS; });
  api.faults.delayMs = 100;
  await assert.rejects(executor.acquire({ id: 'slow' }, new Date(Date.now() + 300000).toISOString()), /time bound/);
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 2);
});

test('restart discovers an interrupted create by name and retries an unconfirmed release', async t => {
  const root = await tempProject(t);
  const api = await fakeDigitalOcean('sentinel-lifecycle'); t.after(() => api.close());
  const env = await providerEnv(t, api, root);
  const executor = new DropletExecutor(root);
  const lease = await executor.acquire({ id: 'interrupted' }, new Date(Date.now() + 300000).toISOString());
  ownProcess(t, lease.watchdog!.pid);
  process.kill(lease.watchdog!.pid, 'SIGTERM');
  const path = join(root, '.cland/run/executor/leases', lease.lease, 'lease.json');
  await writeFile(path, JSON.stringify({ ...lease, state: 'creating', resource: null }));
  api.faults.deleteError = 429;
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  const initial = await ui.request({ type: 'executor.status' });
  assert.equal(initial.ok, true, initial.error);
  assert.equal((initial.value as { leases: { state: string }[] }).leases[0]!.state, 'releasing');
  api.faults.deleteError = 0;
  await eventually('hub timer confirms release', async () => {
    const result = await clandWithEnv(root, {}, 'executor', 'status', '--json');
    const value = JSON.parse(result.stdout);
    return !value.leases.length && !api.droplets.length && !api.keys.length ? true : undefined;
  });
  assert.equal(JSON.parse(await readFile(path, 'utf8')).state, 'released');
});

test('restart re-arms a live creating lease with a dead watchdog', async t => {
  const root = await tempProject(t);
  const api = await fakeDigitalOcean('sentinel-lifecycle'); t.after(() => api.close());
  const env = await providerEnv(t, api, root);
  const executor = new DropletExecutor(root);
  const lease = await executor.acquire({ id: 'still-creating' }, new Date(Date.now() + 300000).toISOString());
  ownProcess(t, lease.watchdog!.pid);
  process.kill(lease.watchdog!.pid, 'SIGTERM');
  const path = join(root, '.cland/run/executor/leases', lease.lease, 'lease.json');
  await writeFile(path, JSON.stringify({ ...lease, state: 'creating' }));
  await startDaemon(t, root, env);
  const result = await clandWithEnv(root, {}, 'executor', 'status', '--json');
  assert.equal(result.code, 0, result.stderr);
  const value = JSON.parse(result.stdout);
  assert.equal(value.leases[0].watchdogAlive, true);
  const rearmed = JSON.parse(await readFile(path, 'utf8'));
  ownProcess(t, rearmed.watchdog.pid);
  assert.notEqual(rearmed.watchdog.pid, lease.watchdog!.pid);
  await flushProjectLogs(t, root);
  assert.match(await readFile(join(root, '.cland/journal.jsonl'), 'utf8'), /executor-watchdog-rearmed/);
  await executor.release(rearmed);
});

test('macOS inhibits idle sleep while the lease lives and drops the inhibitor after release', { skip: process.platform !== 'darwin' }, async t => {
  const root = await tempProject(t);
  const api = await fakeDigitalOcean('sentinel-lifecycle'); t.after(() => api.close());
  await providerEnv(t, api, root);
  const executor = new DropletExecutor(root);
  const lease = await executor.acquire({ id: 'sleep' }, new Date(Date.now() + 300000).toISOString());
  ownProcess(t, lease.watchdog!.pid);
  const rows = () => exec('ps', ['-ww', '-e', '-o', 'pid=,ppid=,command=']).then(r => r.stdout);
  const inhibitor = new RegExp(`\\bcaffeinate -i -w ${lease.watchdog!.pid}\\b`);
  await eventually('live watchdog has a caffeinate child', async () => inhibitor.test(await rows()) ? true : undefined);
  assert.ok(!(await rows()).includes('sentinel-lifecycle'));
  await executor.release(lease);
  await eventually('released lease no longer inhibits sleep', async () => !inhibitor.test(await rows()) ? true : undefined);
});

test('reap deletes project orphans and old cland droplets while preserving other resources', async t => {
  const root = await tempProject(t);
  await mkdir(join(root, '.cland'), { recursive: true });
  await writeFile(join(root, '.cland/config.toml'), '[project]\nname = "test"\n[verification]\nlifetime = "3s"\n');
  const api = await fakeDigitalOcean('sentinel-reap');
  t.after(() => api.close());
  const tag = `cland-p-${createHash('sha256').update(`${root}\0test`).digest('hex').slice(0, 12)}`;
  const base = { status: 'active', networks: { v4: [] }, created_at: new Date().toISOString() };
  api.droplets.push(
    { ...base, id: 1, name: 'orphan', tags: ['cland', tag] },
    { ...base, id: 2, name: 'old-other', tags: ['cland', 'cland-p-other'], created_at: new Date(Date.now() - 700000).toISOString() },
    { ...base, id: 3, name: 'young-other', tags: ['cland', 'cland-p-other'] },
    { ...base, id: 4, name: 'n8n', tags: ['n8n'] },
  );
  api.keys.push({ id: 10, name: 'cland-test-stray', public_key: 'public' }, { id: 11, name: 'other', public_key: 'public' });
  await startDaemon(t, root, { DIGITALOCEAN_TOKEN: 'sentinel-reap', CLAND_DIGITALOCEAN_API: api.url });
  const reap = await clandWithEnv(root, {}, 'executor', 'reap', '--json');
  assert.equal(reap.code, 0, reap.stderr);
  assert.deepEqual(api.droplets.map(d => d.id), [3, 4]);
  assert.deepEqual(api.keys.map(k => k.id), [11]);
  await flushProjectLogs(t, root);
  const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  assert.match(journal, /executor-reaped/);
  assert.ok(!journal.includes('sentinel-reap'));
});
