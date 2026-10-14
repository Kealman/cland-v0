import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clandWithEnv, connectUi, startDaemon, tempProject, spawnSpoke, eventually, flushProjectLogs, pidAlive } from './harness.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import type { TestContext } from 'node:test';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { ownProcess } from './process-cleanup.ts';

const exec = promisify(execFile);
const git = async (root: string, ...args: string[]) => (await exec('git', args, { cwd: root })).stdout.trim();
async function fixture(t: TestContext, overrides: Record<string, string> = {}) {
  const root = await tempProject(t);
  const territory = await tempProject(t, 'prepare-territory-');
  await git(root, 'init', '-q', '-b', 'dev');
  await git(root, 'config', 'user.name', 'Test'); await git(root, 'config', 'user.email', 'test@example.com');
  await git(root, 'config', 'commit.gpgsign', 'false');
  await mkdir(join(root, 'nvim'));
  await writeFile(join(root, 'nvim/NVIM_VERSION'), 'v0.12.5\n');
  await writeFile(join(root, 'nvim/NVIM_SHA256SUMS'), 'bce0f56eda1f1b1db6eee8f4133d7a38813ea07933837dd1777411ca384c6875  nvim-linux-x86_64.tar.gz\n');
  await writeFile(join(root, 'package.json'), '{"name":"prepared-fixture","version":"1.0.0"}\n');
  await writeFile(join(root, 'package-lock.json'), '{"name":"prepared-fixture","version":"1.0.0","lockfileVersion":3,"packages":{"":{"name":"prepared-fixture","version":"1.0.0"}}}\n');
  await writeFile(join(root, '.gitignore'), '.cland/\n');
  await git(root, 'add', '.'); await git(root, 'commit', '-qm', 'Base');
  await git(territory, 'init', '--bare', '-q');
  await git(root, 'remote', 'add', 'origin', territory); await git(root, 'push', '-qu', 'origin', 'dev');
  const api = await fakeDigitalOcean('sentinel-prepare'); t.after(() => api.close());
  const env = { CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state'), DIGITALOCEAN_TOKEN: 'sentinel-prepare', CLAND_DIGITALOCEAN_API: api.url, CLAND_SSH_BIN: resolve('hub/test/fakes/digitalocean/ssh'), CLAND_SCP_BIN: resolve('hub/test/fakes/digitalocean/scp'), CLAND_TEST_FAKE_MACHINE_ROOT: api.stateRoot, CLAND_TEST_DROPLET_POLL_MS: '20', CLAND_TEST_DROPLET_MACHINE_MS: '2000', CLAND_TEST_DROPLET_RELEASE_MS: '500', CLAND_TEST_EXECUTOR_SWEEP_MS: '50', ...overrides };
  const { discovery } = await startDaemon(t, root, env);
  const ui = await connectUi(t, discovery);
  return { root, api, env, ui, discovery };
}

test('prepare builds a reusable snapshot, reports its key and replaces it after the committed lock changes', async t => {
  const { root, api, ui } = await fixture(t);
  const submitted = await clandWithEnv(root, {}, 'executor', 'prepare', '--report', 'general', '--json');
  assert.equal(submitted.code, 0, submitted.stderr);
  assert.equal(JSON.parse(submitted.stdout).state, 'submitted');
  const status = await eventually('snapshot is prepared', async () => {
    const result = await ui.request({ type: 'executor.status' });
    const value = result.value as { snapshot?: { image: number; key: { node: string; nvim: { tag: string }; lock: string; base: string }; freshness: string }; prepare?: { state: string } };
    return value?.snapshot && value.prepare?.state !== 'running' ? value : undefined;
  }, 15000);
  assert.equal(status.snapshot!.freshness, 'current');
  assert.equal(status.snapshot!.key.nvim.tag, 'v0.12.5');
  assert.equal(status.snapshot!.key.node, process.version);
  assert.match(status.snapshot!.key.lock, /^[a-f0-9]{64}$/);
  assert.equal(status.snapshot!.key.base, await git(root, 'rev-parse', 'HEAD'));
  assert.equal(api.images.length, 1); assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
  const builder = api.requests.find(r => r.method === 'POST' && r.path === '/v2/droplets')!.body!;
  assert.equal(builder.image, 'ubuntu-24-04-x64');
  assert.match(String(builder.user_data), /NODE_VERSION=v/); assert.doesNotMatch(String(builder.user_data), /\bacct\b|sentinel-prepare/);
  assert.deepEqual(api.images[0]!.regions, ['lon1', 'nyc1', 'sfo2']);
  const imageDir = api.imageDirs.get(status.snapshot!.image)!;
  assert.equal(await git(join(imageDir, 'home/runner/cland'), 'rev-parse', 'HEAD'), status.snapshot!.key.base);
  assert.equal(await git(join(imageDir, 'home/runner/cland'), 'remote'), '');
  assert.match(await readFile(join(imageDir, 'var/lib/cloud/scripts/per-boot/cland-runner-keys.sh'), 'utf8'), /authorized_keys/);
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: { from: string; text: string }[] };
  const notices = history.messages.filter(message => message.from === 'hub' && message.text.startsWith('snapshot prepared:'));
  assert.equal(notices.length, 1);
  assert.match(notices[0]!.text, /key .*regions .*duration .*builder lifetime .*cost /s);
  assert.ok(!JSON.stringify(history).includes('sentinel-prepare'));
  const current = await clandWithEnv(root, {}, 'executor', 'prepare', '--json');
  assert.equal(current.code, 0, current.stderr);
  await eventually('second prepare completes', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare: { state: string; result?: { state: string } } };
    return value.prepare?.state === 'done' && value.prepare.result?.state === 'current' ? true : undefined;
  });
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 1);
  await writeFile(join(root, 'nvim/NVIM_VERSION'), 'v0.12.6\n');
  const pinMoved = (await ui.request({ type: 'executor.status' })).value as { snapshot: { freshness: string } };
  assert.equal(pinMoved.snapshot.freshness, 'stale: nvim');
  await writeFile(join(root, 'nvim/NVIM_VERSION'), 'v0.12.5\n');
  await writeFile(join(root, 'package-lock.json'), (await readFile(join(root, 'package-lock.json'), 'utf8')).replaceAll('1.0.0', '1.0.1'));
  await writeFile(join(root, 'package.json'), '{"name":"prepared-fixture","version":"1.0.1"}\n');
  await git(root, 'add', 'package.json', 'package-lock.json'); await git(root, 'commit', '-qm', 'Lock moved'); await git(root, 'push', '-q', 'origin', 'dev');
  const stale = (await ui.request({ type: 'executor.status' })).value as { snapshot: { freshness: string } };
  assert.match(stale.snapshot.freshness, /stale: base\|lock/);
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  await eventually('new image replaces old snapshot', () => api.images.length === 1 && api.images[0]!.id !== status.snapshot!.image ? true : undefined, 15000);
  await flushProjectLogs(t, root);
  const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  assert.match(journal, /executor-prepared/);
  const calls = await readFile(join(api.stateRoot, 'machine-calls.jsonl'), 'utf8');
  assert.ok(!calls.includes('sentinel-prepare'));
  assert.ok(!journal.includes('sentinel-prepare'));
  assert.ok(!(await readFile(join(root, '.cland/log/hub.log'), 'utf8')).includes('sentinel-prepare'));
  assert.ok(!JSON.stringify(api.requests).includes('sentinel-prepare'));
  const scan = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await scan(path);
      else if (entry.isFile()) assert.ok(!(await readFile(path)).includes(Buffer.from('sentinel-prepare')), `token absent from ${entry.name}`);
    }
  };
  for (const directory of api.machineDirs.values()) await scan(directory);
  for (const directory of api.imageDirs.values()) await scan(directory);
});

test('prepare is a hub-owned control reserved for the human and Coordinator', async t => {
  const root = await tempProject(t);
  const { discovery } = await startDaemon(t, root, { DIGITALOCEAN_TOKEN: '' });
  const ui = await connectUi(t, discovery);
  for (const role of ['implementer', 'reviewer', 'qa'] as const) {
    const name = `prepare-${role}`;
    assert.equal((await ui.request({ type: 'role.set', session: name, role })).ok, true);
    const spoke = await spawnSpoke({ discover: true, assignRole: false, cwd: root, name, role, sessionId: name });
    t.after(() => spoke.close());
    await spoke.waitForPresence([name]);
    const result = await clandWithEnv(root, { CLAND_SESSION_NAME: name, CLAND_SESSION_ID: name }, 'executor', 'prepare', '--json');
    assert.equal(result.code, 1);
    assert.match(result.stderr, /forbidden.*executor\.prepare/);
  }
});

test('prepare keeps its snapshot when builder deletion is unconfirmed, then the hub confirms release and cost', async t => {
  const { root, api, ui, env, discovery } = await fixture(t);
  api.faults.deleteError = 422;
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  const result = await eventually('prepare finishes despite pending builder deletion', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string; error?: string; result?: { lifetimeMs: number | null; costUsd: number | null } }; snapshot?: { image: number }; leases: { state: string }[] };
    return value.prepare && value.prepare.state !== 'running' ? value : undefined;
  }, 15000);
  assert.equal(result.prepare!.state, 'done', result.prepare!.error);
  assert.equal(result.snapshot!.image, api.images[0]!.id);
  assert.equal(result.prepare!.result!.lifetimeMs, null);
  assert.equal(result.prepare!.result!.costUsd, null);
  assert.equal(result.leases[0]!.state, 'releasing');
  const history = (await ui.request({ type: 'topic.history', topic: 'general' })).value as { messages: { text: string }[] };
  assert.match(history.messages.find(message => message.text.startsWith('snapshot prepared:'))!.text, /builder lifetime unconfirmedms; cost \$unconfirmed/);
  // The final bounded attempt can hit its deadline (status 0) after a 422.
  // Wait for this builder's provider rejection and unconfirmed release separately.
  const { records, retry } = await eventually('builder delete retry and unconfirmed release are journalled', async () => {
    await flushProjectLogs(t, root);
    const records = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    const unconfirmed = records.find(record => record.event === 'executor-release-unconfirmed' && record.id === api.droplets[0]!.id);
    if (!unconfirmed) return undefined;
    const retry = records.find(record => record.event === 'executor-release-retry' && record.lease === unconfirmed.lease && record.cause?.status === 422);
    return retry && api.requests.filter(request => request.method === 'DELETE' && /^\/v2\/droplets\/\d+$/.test(request.path)).length >= 2 ? { records, retry } : undefined;
  });
  assert.equal(retry.cause.status, 422);
  assert.equal(retry.cause.id, 'delete_failed');
  assert.match(retry.cause.message, /try later/);
  assert.ok(!records.some(record => record.event === 'executor-prepare-failed'));
  assert.ok(api.requests.filter(request => request.method === 'DELETE' && /^\/v2\/droplets\/\d+$/.test(request.path)).length >= 2);
  assert.equal((await ui.request({ type: 'hub.stop' })).ok, true);
  await eventually('hub stops with releasing lease persisted', () => !pidAlive(discovery.pid) ? true : undefined);
  const restarted = await startDaemon(t, root, env);
  const next = await connectUi(t, restarted.discovery);
  const pending = (await next.request({ type: 'executor.status' })).value as { snapshot: { image: number }; leases: { state: string }[] };
  assert.equal(pending.snapshot.image, result.snapshot!.image);
  assert.equal(pending.leases[0]!.state, 'releasing');
  api.faults.deleteError = 0;
  await eventually('hub retries releasing builder', async () => {
    const value = (await next.request({ type: 'executor.status' })).value as { leases: unknown[]; spend: { reserved: number; spent: number }; snapshot?: { image: number } };
    return value.leases.length === 0 && value.spend.reserved === 0 ? value : undefined;
  });
  assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
  assert.equal(api.images.length, 1);
  await flushProjectLogs(t, root);
  const released = (await readFile(join(root, '.cland/journal.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line)).find(record => record.event === 'executor-lease-released');
  assert.ok(released.lifetimeMs >= 0); assert.ok(released.costUsd > 0);
});

for (const failure of [409, 422, 503, 'timeout', 'key-503'] as const) {
  test(`prepare retries a transient ${failure} builder delete within its release window`, async t => {
    const { root, api, ui } = await fixture(t, { CLAND_TEST_DIGITALOCEAN_TIMEOUT_MS: '1000', CLAND_TEST_DROPLET_RELEASE_MS: '5000' });
    if (failure === 'key-503') api.faults.keyDeleteFailures = [503];
    else api.faults.deleteFailures = [failure];
    api.faults.echoToken = true;
    assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
    const result = await eventually('prepare confirms builder release after a transient failure', async () => {
      const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string; error?: string; result?: { lifetimeMs: number | null; costUsd: number | null } } };
      return value.prepare && value.prepare.state !== 'running' ? value.prepare : undefined;
    }, 15000);
    assert.equal(result.state, 'done', result.error);
    assert.notEqual(result.result!.lifetimeMs, null);
    assert.ok(result.result!.costUsd! > 0);
    assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
    assert.equal(api.images.length, 1);
    await flushProjectLogs(t, root);
    const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
    assert.ok(!journal.includes('sentinel-prepare'));
    const retry = journal.trim().split('\n').map(line => JSON.parse(line)).find(record => record.event === 'executor-release-retry');
    assert.equal(retry.cause.status, failure === 'timeout' ? 0 : failure === 'key-503' ? 503 : failure);
    assert.equal(retry.cause.id, failure === 'timeout' ? 'transport' : failure === 'key-503' ? 'key_delete_failed' : 'delete_failed');
  });
}

test('failed replacement releases its builder, deletes a partial image and keeps the previous snapshot', async t => {
  const { root, api, ui } = await fixture(t);
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  const first = await eventually('initial snapshot ready', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string } };
    return value.snapshot && value.prepare?.state === 'done' ? value.snapshot : undefined;
  }, 15000);
  await writeFile(join(root, 'new-base.txt'), 'new base'); await git(root, 'add', 'new-base.txt');
  await git(root, 'commit', '-qm', 'Base moved'); await git(root, 'push', '-q', 'origin', 'dev');
  const stale = (await ui.request({ type: 'executor.status' })).value as { snapshot: { freshness: string } };
  assert.equal(stale.snapshot.freshness, 'stale: base');
  for (const failure of ['snapshot', 'ssh', 'install', 'retire'] as const) {
    api.faults.failAction = failure === 'snapshot' ? 'snapshot' : '';
    api.faults.deleteSnapshot = failure === 'retire' ? first.image : 0;
    await api.setMachineFaults({ ssh: failure === 'ssh', install: failure === 'install' });
    const submission = await clandWithEnv(root, {}, 'executor', 'prepare', '--json');
    assert.equal(submission.code, 0, submission.stderr);
    const failed = await eventually(`${failure} reports failure`, async () => {
      const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string; error: string } };
      return value.prepare?.state === 'failed' ? value : undefined;
    }, 15000);
    assert.equal(failed.snapshot!.image, first.image);
    assert.equal(api.images.length, 1, `${failure}: ${failed.prepare!.error}`); assert.equal(api.images[0]!.id, first.image);
    assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
    assert.match(failed.prepare!.error, /failed|deadline|time bound/);
  }
  await flushProjectLogs(t, root);
  const journal = await readFile(join(root, '.cland/journal.jsonl'), 'utf8');
  assert.equal(journal.split('\n').filter(line => line.includes('"event":"executor-prepare-failed"')).length, 4);
});

test('prepare refuses an oversized builder before create and reports one job while a CLI has exited', async t => {
  const { root, api, ui } = await fixture(t);
  api.sizes.push({ slug: 'big', available: true, price_hourly: 0.5, disk: 100, regions: ['lon1'] });
  await writeFile(join(root, '.cland/config.toml'), '[verification.droplet]\nprepare_size = "big"\n');
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  await eventually('oversized disk refuses', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string; error: string } };
    return value.prepare?.state === 'failed' && /disk exceeds/.test(value.prepare.error) ? true : undefined;
  });
  assert.equal(api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').length, 0);
  await writeFile(join(root, '.cland/config.toml'), '[verification.droplet]\nprepare_size = "c-8"\n');
  let resume!: () => void;
  const blocked = new Promise<void>(resolve => { resume = resolve; }); t.after(() => resume());
  api.beforeCreate(() => blocked);
  const submission = await clandWithEnv(root, {}, 'executor', 'prepare', '--json');
  assert.equal(submission.code, 0, submission.stderr);
  const status = (await ui.request({ type: 'executor.status' })).value as { prepare: { state: string; step: string; elapsedMs: number } };
  assert.equal(status.prepare.state, 'running'); assert.ok(status.prepare.elapsedMs >= 0);
  const second = await clandWithEnv(root, {}, 'executor', 'prepare', '--json');
  assert.equal(second.code, 1); assert.match(second.stderr, /already running/);
  resume();
  await eventually('submitted job completes after CLI exit', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string } };
    return value.prepare?.state === 'done' ? true : undefined;
  }, 15000);
});

test('prepared snapshots preserve the runner key hook across cloud-init clean and inject the new lease key on boot', async t => {
  const { root, api, env, ui } = await fixture(t);
  for (const [key, value] of Object.entries(env)) {
    const old = process.env[key]; process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  await eventually('image preparation completes', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string } };
    return value.prepare?.state === 'done' ? true : undefined;
  }, 15000);
  const executor = new DropletExecutor(root);
  const lease = await executor.acquire({ id: 'new-snapshot-boot' }, new Date(Date.now() + 60000).toISOString());
  ownProcess(t, lease.watchdog!.pid);
  const directory = api.machineDirs.get(lease.resource!)!;
  const rootKeys = await readFile(join(directory, 'root/.ssh/authorized_keys'), 'utf8');
  const runnerKeys = await readFile(join(directory, 'home/runner/.ssh/authorized_keys'), 'utf8');
  const newKey = await readFile(join(root, '.cland/run/executor/leases', lease.lease, 'key.pub'), 'utf8');
  assert.equal(runnerKeys.trim(), rootKeys.trim());
  assert.equal(runnerKeys.trim(), newKey.trim(), 'the run key replaces the removed builder key');
  assert.match(await readFile(join(directory, 'var/lib/cloud/scripts/per-boot/cland-runner-keys.sh'), 'utf8'), /authorized_keys/);
  await executor.release(lease);
  assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
});

test('acquire needs a prepared image, uses its regions without user data and refuses unready or mismatched machines', async t => {
  const { root, api, env, ui } = await fixture(t);
  for (const [key, value] of Object.entries(env)) {
    const old = process.env[key]; process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  const executor = new DropletExecutor(root);
  const deadline = () => new Date(Date.now() + 60000).toISOString();
  await assert.rejects(executor.acquire({ id: 'unprepared' }, deadline()), /no prepared snapshot; run cland executor prepare/);
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  const snapshot = await eventually('prepared snapshot available', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string } };
    return value.snapshot && value.prepare?.state === 'done' ? value.snapshot : undefined;
  }, 15000);
  // A region preferred by current config but absent from the image cannot be used.
  await writeFile(join(root, '.cland/config.toml'), '[verification.droplet]\nregions = ["fra1", "nyc1"]\n');
  api.sizes[0]!.regions.push('fra1'); api.regions.push({ slug: 'fra1', available: true, sizes: ['c-8'] });
  const lease = await executor.acquire({ id: 'snapshot-run' }, deadline()); ownProcess(t, lease.watchdog!.pid);
  assert.equal(lease.region, 'nyc1');
  const create = api.requests.filter(r => r.method === 'POST' && r.path === '/v2/droplets').at(-1)!.body!;
  assert.equal(create.image, snapshot.image); assert.ok(!('user_data' in create));
  const calls = await readFile(join(api.stateRoot, 'machine-calls.jsonl'), 'utf8');
  assert.match(calls, /runner@203\.0\.113\.10/); assert.match(calls, /true && cat/);
  await executor.release(lease);
  await api.setMachineFaults({ marker: true });
  await assert.rejects(executor.acquire({ id: 'bad-marker' }, deadline()), /image marker mismatch/);
  assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
  await api.setMachineFaults({ marker: false, delayMs: 5000 });
  await assert.rejects(executor.acquire({ id: 'timeout' }, deadline()), /readiness deadline/);
  assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
});

test('completed transfers wait for snapshot regions to become visible before publishing the image', async t => {
  const { root, api, ui } = await fixture(t);
  api.faults.visibilityPolls = 4;
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  const result = await eventually('prepare finishes after transfer visibility delay', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string; error?: string }; snapshot?: { regions: string[] } };
    return value.prepare && value.prepare.state !== 'running' ? value : undefined;
  }, 15000);
  assert.equal(result.prepare!.state, 'done', result.prepare!.error);
  assert.deepEqual(result.snapshot!.regions, ['lon1', 'nyc1', 'sfo2']);
  assert.deepEqual(api.droplets, []);
});

test('a timed-out snapshot retains cleanup ownership through a late action, delayed catalogue and deletion refusal', async t => {
  const { root, api, ui, env, discovery } = await fixture(t, { CLAND_TEST_DROPLET_ACTION_MS: '1000' });
  // Admission bounds are real hub environment, not a seam inside the executor.
  api.faults.snapshotAfter = 100;
  api.faults.snapshotHiddenPolls = 4;
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  await eventually('prepare fails at its bounded action', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string } };
    return value.prepare?.state === 'failed' ? true : undefined;
  }, 10000);
  api.faults.catalogueError = 503;
  const pending = (await ui.request({ type: 'executor.status' })).value as { snapshotRecovery?: unknown[] };
  assert.ok(pending.snapshotRecovery?.length, 'an unsuccessful catalogue read cannot forget the action');
  assert.equal((await ui.request({ type: 'hub.stop' })).ok, true);
  await eventually('hub exits while catalogue is unavailable', () => !pidAlive(discovery.pid) ? true : undefined);
  const restarted = await startDaemon(t, root, env);
  const next = await connectUi(t, restarted.discovery);
  api.faults.snapshotAfter = 1;
  api.faults.catalogueError = 0;
  // Refuse deletes as soon as the late image is created.
  await eventually('late action materializes its image', () => api.images.length ? true : undefined, 10000);
  api.faults.deleteSnapshot = api.images[0]!.id;
  await eventually('deletion refusal is retried', () => api.requests.filter(r => r.method === 'DELETE' && r.path === `/v2/snapshots/${api.faults.deleteSnapshot}`).length >= 2 ? true : undefined);
  api.faults.deleteSnapshot = 0;
  await eventually('late image absence closes durable recovery', async () => {
    const value = (await next.request({ type: 'executor.status' })).value as { snapshotRecovery?: unknown[] };
    return !api.images.length && !value.snapshotRecovery?.length ? true : undefined;
  }, 10000);
  assert.deepEqual(api.droplets, []);
});

test('hub stop cancels and drains preparation before closing its store and preserves the one outcome', async t => {
  const { root, api, env, ui, discovery } = await fixture(t);
  await api.setMachineFaults({ delayMs: 5000, delayCommand: 'npm ci' });
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  await eventually('machine is installing when stop arrives', async () => {
    try { return (await readFile(join(api.stateRoot, 'machine-calls.jsonl'), 'utf8')).includes('npm ci') ? true : undefined; }
    catch { return undefined; }
  }, 10000);
  assert.equal((await ui.request({ type: 'hub.stop' })).ok, true);
  await eventually('hub drains its preparation and exits', () => !pidAlive(discovery.pid) ? true : undefined, 10000);
  const restarted = await startDaemon(t, root, env);
  const next = await connectUi(t, restarted.discovery);
  const history = (await next.request({ type: 'topic.history', topic: 'general' })).value as { messages: { text: string }[] };
  assert.equal(history.messages.filter(message => message.text.startsWith('snapshot prepare failed:')).length, 1);
  assert.deepEqual(api.droplets, []); assert.deepEqual(api.images, []);
});

test('lost successful retirement and an unavailable catalogue preserve the replacement through restart', async t => {
  const { root, api, env, ui, discovery } = await fixture(t);
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  const old = await eventually('initial image ready', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string } };
    return value.snapshot && value.prepare?.state === 'done' ? value.snapshot : undefined;
  }, 15000);
  await writeFile(join(root, 'base.txt'), 'new base'); await git(root, 'add', 'base.txt');
  await git(root, 'commit', '-qm', 'New base'); await git(root, 'push', '-q', 'origin', 'dev');
  api.faults.loseDeleteSnapshot = old.image; api.faults.failCatalogueAfterDelete = true;
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  const uncertain = await eventually('retirement retains its uncertainty', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string }; snapshotRecovery?: { phase: string }[] };
    return value.prepare?.state === 'failed' ? value : undefined;
  }, 15000);
  assert.notEqual(uncertain.snapshot!.image, old.image);
  assert.equal(api.images.length, 1); assert.equal(api.images[0]!.id, uncertain.snapshot!.image);
  assert.equal(uncertain.snapshotRecovery![0]!.phase, 'retire');
  assert.equal((await ui.request({ type: 'hub.stop' })).ok, true);
  await eventually('hub stops with a durable retirement', () => !pidAlive(discovery.pid) ? true : undefined);
  const restarted = await startDaemon(t, root, env);
  const next = await connectUi(t, restarted.discovery);
  api.faults.catalogueError = 0;
  await eventually('confirmed old absence completes publication', async () => {
    const value = (await next.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; snapshotRecovery?: unknown[] };
    return value.snapshot?.image === uncertain.snapshot!.image && !value.snapshotRecovery?.length ? true : undefined;
  }, 10000);
  assert.equal(api.images.length, 1);
  assert.ok(!api.requests.some(r => r.method === 'DELETE' && r.path === `/v2/snapshots/${uncertain.snapshot!.image}`));
});

test('a timed-out accepted retirement keeps the replacement while old is listed, then completes the late deletion', async t => {
  const { root, api, ui } = await fixture(t, { CLAND_TEST_DIGITALOCEAN_TIMEOUT_MS: '1000' });
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  const old = await eventually('old image ready', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string } };
    return value.snapshot && value.prepare?.state === 'done' ? value.snapshot : undefined;
  }, 15000);
  await writeFile(join(root, 'new.txt'), 'new'); await git(root, 'add', 'new.txt');
  await git(root, 'commit', '-qm', 'Base moved'); await git(root, 'push', '-q', 'origin', 'dev');
  let resume!: () => void; let released = false;
  const held = new Promise<void>(resolve => { resume = () => { released = true; resolve(); }; });
  t.after(() => resume());
  api.beforeSnapshotDelete(async id => { if (id === old.image && !released) await held; });
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  const pending = await eventually('the held delete times out but old remains visible', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; prepare?: { state: string }; snapshotRecovery?: unknown[] };
    return value.prepare?.state === 'failed' ? value : undefined;
  }, 15000);
  assert.ok(api.images.some(image => image.id === old.image));
  assert.notEqual(pending.snapshot!.image, old.image, 'old presence does not prove the pending delete was rejected');
  assert.ok(api.images.some(image => image.id === pending.snapshot!.image));
  assert.ok(pending.snapshotRecovery?.length);
  resume();
  await eventually('late retirement completes without deleting the replacement', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { snapshot?: { image: number }; snapshotRecovery?: unknown[] };
    return api.images.length === 1 && value.snapshot?.image === pending.snapshot!.image && !value.snapshotRecovery?.length ? true : undefined;
  }, 10000);
  assert.ok(!api.requests.some(r => r.method === 'DELETE' && r.path === `/v2/snapshots/${pending.snapshot!.image}`));
});
