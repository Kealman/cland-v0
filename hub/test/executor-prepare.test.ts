// T3: hub-process stop must cancel and drain an in-flight preparation before store closure.
// Native snapshot bytes, shell setup and key boot hooks stay here; policy is T2.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { nativeProjectHub as projectHub, clandWithEnv, connectUi, startDaemon, tempProject, eventually, flushProjectLogs, pidAlive } from './harness.ts';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import type { TestContext } from 'node:test';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { onCleanup, ownProcess } from './process-cleanup.ts';

const exec = promisify(execFile);
const git = async (root: string, ...args: string[]) => (await exec('git', args, { cwd: root })).stdout.trim();
async function fixture(t: TestContext, overrides: Record<string, string> = {}, serve: typeof projectHub | typeof startDaemon = projectHub) {
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
  const api = await fakeDigitalOcean('sentinel-prepare'); onCleanup(t, () => api.close());
  const env = { CLAND_EXECUTOR_STATE: join(root, '.cland/executor-state'), DIGITALOCEAN_TOKEN: 'sentinel-prepare', CLAND_DIGITALOCEAN_API: api.url, CLAND_SSH_BIN: resolve('hub/test/fakes/digitalocean/ssh'), CLAND_SCP_BIN: resolve('hub/test/fakes/digitalocean/scp'), CLAND_TEST_FAKE_MACHINE_ROOT: api.stateRoot, CLAND_TEST_DROPLET_POLL_MS: '20', CLAND_TEST_DROPLET_MACHINE_MS: '2000', CLAND_TEST_DROPLET_RELEASE_MS: '500', CLAND_TEST_EXECUTOR_SWEEP_MS: '50', ...overrides };
  const served = await serve(t, root, env);
  const { discovery } = served;
  const ui = await connectUi(t, discovery);
  const stop = () => 'stop' in served ? served.stop() : clandWithEnv(root, env, 'hub', 'stop');
  return { root, api, env, ui, discovery, stop };
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

test('prepared snapshots preserve the runner key hook across cloud-init clean and inject the new lease key on boot', async t => {
  const { root, api, env, ui, stop } = await fixture(t);
  assert.equal((await clandWithEnv(root, {}, 'executor', 'prepare', '--json')).code, 0);
  await eventually('image preparation completes', async () => {
    const value = (await ui.request({ type: 'executor.status' })).value as { prepare?: { state: string } };
    return value.prepare?.state === 'done' ? true : undefined;
  }, 15000);
  // Native executor assertions need the prepared image, with no concurrent hub sweep.
  await stop();
  const executor = new DropletExecutor(root, undefined, undefined, { ...process.env, ...env });
  const lease = await executor.acquire({ id: 'new-snapshot-boot' }, new Date(Date.now() + 60000).toISOString());
  ownProcess(t, lease.watchdog!.pid);
  const directory = api.machineDirs.get(lease.resource!)!;
  const calls = await readFile(join(api.stateRoot, 'machine-calls.jsonl'), 'utf8');
  assert.match(calls, /runner@203\.0\.113\.10/); assert.match(calls, /true && cat/);
  const rootKeys = await readFile(join(directory, 'root/.ssh/authorized_keys'), 'utf8');
  const runnerKeys = await readFile(join(directory, 'home/runner/.ssh/authorized_keys'), 'utf8');
  const newKey = await readFile(join(root, '.cland/run/executor/leases', lease.lease, 'key.pub'), 'utf8');
  assert.equal(runnerKeys.trim(), rootKeys.trim());
  assert.equal(runnerKeys.trim(), newKey.trim(), 'the run key replaces the removed builder key');
  assert.match(await readFile(join(directory, 'var/lib/cloud/scripts/per-boot/cland-runner-keys.sh'), 'utf8'), /authorized_keys/);
  await executor.release(lease);
  assert.deepEqual(api.droplets, []); assert.deepEqual(api.keys, []);
});

test('hub stop cancels and drains preparation before closing its store and preserves the one outcome', async t => {
  const { root, api, env, ui, discovery } = await fixture(t, undefined, startDaemon);
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
