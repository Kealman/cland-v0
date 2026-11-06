// T2: filesystem provider fake; no processes, sockets or real-time waits.
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FakeHostProvider } from '../src/host/provider/fake.ts';
import { removeFixtureSockets } from '../../shared/fixture-sockets.ts';
import { fixtureEnvironment } from './fixture-environment.ts';
import { hostProviderVolumeContract } from './host-provider-contract.ts';

async function factory(t: TestContext, scenario: 'normal' | 'ignored-volume-delete') {
  const root = await mkdtemp(join(tmpdir(), 'hp-vol-'));
  t.after(async () => { await removeFixtureSockets(root); await rm(root, { recursive: true, force: true }); });
  let time = Date.parse('2026-11-06T00:00:00Z');
  const env = fixtureEnvironment(root, {}, { CLAND_FAKE_HOST_ROOT: root });
  const provider = new FakeHostProvider({ env, now: () => time, snapshotWindowMs: 1000, ignoreVolumeDelete: scenario === 'ignored-volume-delete' });
  return { provider, env, region: 'region-a', otherRegion: 'region-b', snapshotRetryAt: '2026-11-06T00:00:01.000Z',
    ready: async () => {}, advanceSnapshotWindow: async () => { time += 1000; } };
}
hostProviderVolumeContract('fake', factory, (name, run) => test(name, run));

test('mandatory volume contract rejects deletion acknowledged without removal', async t => {
  let selected: ((t: TestContext) => Promise<void>) | undefined;
  hostProviderVolumeContract('broken', async t => {
    const f = await factory(t, 'normal');
    t.mock.method(f.provider, 'deleteVolume', async () => ({ state: 'deleted' as const }));
    return f;
  }, (name, run) => { if (name.endsWith('volumes create, list and confirm deletion')) selected = run; });
  assert.ok(selected);
  await assert.rejects(selected(t), { code: 'ERR_ASSERTION' });
});


test('volume inventory, attachment and snapshot pacing survive provider recreation', async t => {
  const f = await factory(t, 'normal'), p = f.provider;
  const a = await p.acquire({ project: 'contract', pool: 'agents', architecture: 'x86_64', region: f.region });
  const v = await p.createVolume({ project: 'contract', region: f.region, name: 'login', sizeGiB: 1 });
  assert.equal(a.state, 'created'); assert.equal(v.state, 'created');
  if (a.state !== 'created' || v.state !== 'created') return;
  assert.equal((await p.attachVolume(v.volume, a.machine)).state, 'attached');
  assert.equal((await p.snapshotVolume(v.volume)).state, 'snapshotted');
  const recovered = new FakeHostProvider({ env: f.env, now: () => Date.parse('2026-11-06T00:00:00Z'), snapshotWindowMs: 1000 });
  assert.deepEqual(await recovered.listVolumes({ project: 'contract' }), { state: 'listed', volumes: [{ ...v.volume, attachedTo: a.machine.id }] });
  assert.deepEqual(await recovered.snapshotVolume(v.volume), { state: 'refused', reason: 'rate limited', retryAt: f.snapshotRetryAt });
  assert.equal((await recovered.detachVolume(v.volume, a.machine)).state, 'detached');
  assert.equal((await recovered.deleteVolume(v.volume)).state, 'deleted');
});

test('concurrent volume attachment and snapshot calls each admit one winner', async t => {
  const { provider: p, region } = await factory(t, 'normal');
  const a = await p.acquire({ project: 'contract', pool: 'agents', architecture: 'x86_64', region });
  const b = await p.acquire({ project: 'contract', pool: 'agents', architecture: 'x86_64', region });
  const v = await p.createVolume({ project: 'contract', region, name: 'login', sizeGiB: 1 });
  assert.equal(a.state, 'created'); assert.equal(b.state, 'created'); assert.equal(v.state, 'created');
  if (a.state !== 'created' || b.state !== 'created' || v.state !== 'created') return;
  assert.deepEqual((await Promise.all([p.attachVolume(v.volume, a.machine), p.attachVolume(v.volume, b.machine)])).map(r => r.state), ['attached', 'refused']);
  assert.deepEqual((await Promise.all([p.snapshotVolume(v.volume), p.snapshotVolume(v.volume)])).map(r => r.state), ['snapshotted', 'refused']);
  assert.equal((await p.deleteVolume({ ...v.volume, project: 'forged' })).state, 'incomplete');
  assert.equal((await p.snapshotVolume({ ...v.volume, region: 'forged' })).state, 'failed');
});

test('fake snapshot window rejects invalid durations', async t => {
  const f = await factory(t, 'normal');
  for (const snapshotWindowMs of [0, -1, NaN, Infinity, 0.5]) {
    assert.throws(() => new FakeHostProvider({ env: f.env, snapshotWindowMs }), /positive snapshot window/);
  }
});


test('malformed retained volume ownership and snapshot facts fail closed without writes', async t => {
  const f = await factory(t, 'normal'), p = f.provider;
  const a = await p.acquire({ project: 'contract', pool: 'agents', architecture: 'x86_64', region: f.region });
  const v = await p.createVolume({ project: 'contract', region: f.region, name: 'login', sizeGiB: 1 });
  assert.equal(a.state, 'created'); assert.equal(v.state, 'created');
  if (a.state !== 'created' || v.state !== 'created') return;
  assert.equal((await p.attachVolume(v.volume, a.machine)).state, 'attached');
  assert.equal((await p.snapshotVolume(v.volume)).state, 'snapshotted');
  const path = join(f.env.CLAND_FAKE_HOST_ROOT!, 'volumes', v.volume.id + '.json');
  const valid = JSON.parse(await readFile(path, 'utf8'));
  const patches = [
    (r: typeof valid) => { delete r.volume.attachedTo; },
    ...[false, 0, '', {}, []].map(value => (r: typeof valid) => { r.volume.attachedTo = value; }),
    (r: typeof valid) => { delete r.lastSnapshotAt; },
    (r: typeof valid) => { delete r.snapshot; },
    (r: typeof valid) => { r.lastSnapshotAt = -1; },
    (r: typeof valid) => { r.lastSnapshotAt += 1; },
    (r: typeof valid) => { r.snapshot.volumeId = 'other'; },
    (r: typeof valid) => { r.snapshot.created = 'invalid'; },
  ];
  for (const patch of patches) {
    const record = structuredClone(valid); patch(record);
    const bytes = JSON.stringify(record);
    await writeFile(path, bytes);
    assert.equal((await p.listVolumes({ project: 'contract' })).state, 'failed');
    assert.equal((await p.attachVolume(v.volume, a.machine)).state, 'failed');
    assert.equal((await p.detachVolume(v.volume, a.machine)).state, 'failed');
    assert.equal((await p.snapshotVolume(v.volume)).state, 'failed');
    assert.equal((await p.deleteVolume(v.volume)).state, 'incomplete');
    assert.equal(await readFile(path, 'utf8'), bytes);
  }
});
