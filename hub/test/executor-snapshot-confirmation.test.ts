// T2: fake-provider snapshot deletion receipts and durable retry; no native transport.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { FakeClock } from './fake-clock.ts';
import { tempProject } from './harness.ts';
import { beforeDirectories } from './process-cleanup.ts';
import { keyHash, snapshotPath, readSnapshot, type Snapshot } from '../src/executor/droplet/prepare.ts';
import { saveRecovery, readRecoveries, recoverSnapshot, type SnapshotRecovery } from '../src/executor/droplet/snapshot-recovery.ts';
import { durableJson } from '../src/executor/droplet/lease.ts';
import { DigitalOceanError } from '../src/executor/droplet/api.ts';
import { fixture } from './remote-fixture.ts';
import { drive } from './remote-clock.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';

for (const phase of ['retire', 'cleanup'] as const) test(`${phase} retains snapshot ownership through DELETE404 GET200 and retries by id`, async t => {
  const root = await tempProject(t);
  const clock = new FakeClock();
  const api = await fakeDigitalOcean('synthetic-snapshot', { machine: 'scripted', clock });
  beforeDirectories(t, () => api.close());
  const key = { node: process.version, base: 'c'.repeat(40) };
  const snapshot = (id: number): Snapshot => ({ image: id, name: `image-${id}`, key, keyHash: keyHash(key), regions: ['lon1'], sizeGb: 1, minDiskSize: 1, created: clock.now().toISOString() });
  const previous = snapshot(41), candidate = snapshot(42);
  api.images.push(...[previous, candidate].map(s => ({ id: s.image, name: s.name, regions: s.regions, size_gigabytes: 1, min_disk_size: 1, created_at: s.created })));
  await mkdir(dirname(snapshotPath(root)), { recursive: true });
  await durableJson(snapshotPath(root), phase === 'retire' ? candidate : previous);
  const record: SnapshotRecovery = { id: 'owned', name: candidate.name, started: clock.now().toISOString(), phase, previous, candidate, requested: false, seen: [], retirement: 'submitted' };
  await saveRecovery(root, record);
  const target = phase === 'retire' ? previous.image : candidate.image;
  assert.equal((await api.provider.snapshot(target)).id, target);
  api.faults.snapshotDelete404Reads = 3;
  await assert.rejects(recoverSnapshot(root, record, undefined, {}, api.provider), /not confirmed/);
  assert.equal((await readRecoveries(root)).length, 1);
  assert.equal((await readSnapshot(root))!.image, (phase === 'retire' ? candidate : previous).image);
  // A stale empty catalogue cannot erase the persisted deletion identity.
  api.faults.omitSnapshotIds = [target];
  const provider = api.provider;
  await assert.rejects(recoverSnapshot(root, (await readRecoveries(root))[0]!, undefined, {}, provider), /not confirmed/);
  // The third DELETE still sees a live GET; the following GET receipt is absent.
  await assert.rejects(recoverSnapshot(root, (await readRecoveries(root))[0]!, undefined, {}, provider), /not confirmed/);
  assert.equal(await recoverSnapshot(root, (await readRecoveries(root))[0]!, undefined, {}, provider), true);
  assert.deepEqual(await readRecoveries(root), []);
  await assert.rejects(api.provider.snapshot(target), e => e instanceof DigitalOceanError && e.status === 404);
  assert.equal(api.requests.filter(r => r.method === 'DELETE' && r.path === `/v2/snapshots/${target}`).length, 4);
  await api.provider.deleteSnapshot(target); // DELETE404 + GET404 is confirmed too.
});

test('prepare retains retirement record when replacement DELETE404 still has live GET', async t => {
  const f = await fixture(t, { machine: 'scripted' });
  await f.stop();
  const nextKey = { ...f.key, base: 'd'.repeat(40) };
  const dependencies = { ...f.dependencies, machine: { ...f.dependencies.machine!, put: async () => {}, exec: async () => JSON.stringify(nextKey), result: async () => ({ stdout: '', stderr: '', code: 0 }) } };
  const executor = new DropletExecutor(f.root, undefined, () => {}, f.env, undefined, dependencies);
  const first = await drive(f, executor.prepare(f.key));
  f.api.faults.snapshotDelete404Reads = 100;
  await assert.rejects(drive(f, executor.prepare({ ...f.key, base: 'd'.repeat(40) })), /not confirmed/);
  const records = await readRecoveries(f.root);
  assert.equal(records.length, 1);
  assert.equal(records[0]!.previous!.image, first.snapshot.image);
  assert.notEqual((await readSnapshot(f.root))!.image, first.snapshot.image);
  assert.ok(f.api.requests.some(r => r.method === 'GET' && r.path === `/v2/snapshots/${first.snapshot.image}`));
});
