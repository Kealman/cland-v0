import { validateHostProviderDeclarations } from '../src/host/provider/declarations.ts';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import type { HostArchitecture, HostProvider } from '../src/host/provider/provider.ts';

/** Caller supplies a registration wrapper located in its .test.ts entry so
 * native test receipts and exact-name reruns identify that runnable file.
 * Factory owns isolation/cleanup; ready() advances a fixture clock or observes
 * the provider's bounded readiness receipt. No provider-specific assertions here. */
export type ProviderScenario = 'normal' | 'refused' | 'failed-acquire' | 'delayed-boot' | 'never-boot' | 'ignored-delete';
export function hostProviderContract(name: string, factory: (t: TestContext, scenario: ProviderScenario) => Promise<{
  provider: HostProvider; admissionEffects?:()=>unknown|Promise<unknown>; prepared?: boolean; ready: () => Promise<void>;
}>, register: (name: string, run: (t: TestContext) => Promise<void>) => unknown) {
  register(`${name}: provider declares sane prices, billing and capabilities`, async t => {
    const { provider } = await factory(t, 'normal');
    validateHostProviderDeclarations(provider.declarations);
  });
  register(`${name}: create admission is allowed without side effects`,async t=>{
    const fixture=await factory(t,'normal');
    assert.ok(fixture.admissionEffects,'factory supplies observable admission effects');
    const before=await fixture.admissionEffects();
    assert.deepEqual(fixture.provider.createAdmission(),{state:'allowed'});
    assert.deepEqual(await fixture.admissionEffects(),before,'admission changes no API or provider files');
  });
  register(`${name}: provider contract creates, prepares, observes and confirms release`, async t => {
    const { provider, ready, prepared } = await factory(t, 'normal');
    assert.equal(provider.transport, 'ssh');
    assert.equal((await provider.prepare()).state, prepared ? 'current' : 'prepared');
    assert.equal((await provider.prepare()).state, 'current');
    const acquired = await provider.acquire({ project: 'contract', pool: 'agents', architecture: declaredArchitecture(provider) });
    assert.equal(acquired.state, 'created');
    if (acquired.state !== 'created') return;
    const machine = acquired.machine;
    assert.ok(machine.id); assert.ok(machine.address);
    assert.equal(machine.architecture, declaredArchitecture(provider));
    assert.ok(Number.isFinite(Date.parse(machine.created)));
    await ready();
    assert.equal((await provider.status(machine)).state, 'ready');
    {const reads:Array<{resource:string;read:string}>=[];
    assert.equal((await provider.release(machine,receipt=>reads.push(receipt))).state, 'released');
    assert.deepEqual(reads.map(r=>r.resource),['machine','key']);assert.ok(reads.every(r=>r.read.length>0));}
    assert.equal((await provider.status(machine)).state, 'gone');
    {const reads:Array<{resource:string;read:string}>=[];
    assert.equal((await provider.release(machine,receipt=>reads.push(receipt))).state, 'released');
    assert.deepEqual(reads.map(r=>r.resource),['machine','key']);assert.ok(reads.every(r=>r.read.length>0));}
    assert.deepEqual(await provider.reap({ project: 'contract', pool: 'agents' }), { state: 'reaped', released: [], incomplete: [] });
  });
  register(`${name}: reap releases only the requested project and pool`, async t => {
    const { provider } = await factory(t, 'normal');
    const one = await provider.acquire({ project: 'contract', pool: 'agents', architecture: declaredArchitecture(provider) });
    const other = await provider.acquire({ project: 'other', pool: 'agents', architecture: declaredArchitecture(provider) });
    assert.equal(one.state, 'created'); assert.equal(other.state, 'created');
    if (one.state !== 'created' || other.state !== 'created') return;
    try {
      assert.deepEqual(await provider.reap({ project: 'contract', pool: 'agents' }), { state: 'reaped', released: [one.machine.id], incomplete: [] });
      assert.equal((await provider.status(one.machine)).state, 'gone');
      assert.notEqual((await provider.status(other.machine)).state, 'gone');
    } finally { await provider.release(other.machine); }
  });
  for (const scenario of ['refused', 'failed-acquire'] as const) {
    register(`${name}: ${scenario} acquire has a typed outcome`, async t => {
      const { provider } = await factory(t, scenario);
      const result = await provider.acquire({ project: 'contract', pool: 'agents', architecture: declaredArchitecture(provider) });
      assert.equal(result.state, scenario === 'refused' ? 'refused' : 'failed');
      assert.ok(result.reason);
      if (result.state === 'refused') assert.ok(Number.isFinite(Date.parse(result.retryAt)));
    });
  }
  for (const scenario of ['delayed-boot', 'never-boot', 'ignored-delete'] as const) {
    register(`${name}: ${scenario} preserves observed lifecycle outcomes`, async t => {
      const { provider, ready } = await factory(t, scenario);
      const result = await provider.acquire({ project: 'contract', pool: 'agents', architecture: declaredArchitecture(provider) });
      assert.equal(result.state, 'created');
      if (result.state !== 'created') return;
      if (scenario === 'delayed-boot') {
        assert.equal((await provider.status(result.machine)).state, 'booting');
        await ready();
        assert.equal((await provider.status(result.machine)).state, 'ready');
      } else if (scenario === 'never-boot') {
        const status = await provider.status(result.machine);
        assert.equal(status.state, 'failed');
        if (status.state === 'failed') assert.ok(status.reason);
      } else {
        assert.equal((await provider.release(result.machine)).state, 'incomplete');
        assert.notEqual((await provider.status(result.machine)).state, 'gone');
        assert.deepEqual(await provider.reap({ project: 'contract', pool: 'agents' }), { state: 'reaped', released: [], incomplete: [result.machine.id] });
      }
    });
  }

}

function declaredArchitecture(provider: HostProvider): HostArchitecture {
  validateHostProviderDeclarations(provider.declarations);
  const architecture = provider.declarations.architectures[0];
  assert.ok(architecture);
  return architecture;
}

/** Mandatory volume cases. Provider-specific factory owns fault injection,
 * region names and advancing the snapshot window without wall-clock waits. */
export function hostProviderVolumeContract(name: string, factory: (t: TestContext, scenario: 'normal' | 'ignored-volume-delete') => Promise<{
  provider: HostProvider; region: string; otherRegion: string; snapshotRetryAt: string;
  advanceSnapshotWindow: () => Promise<void>; ready: () => Promise<void>;
}>, register: (name: string, run: (t: TestContext) => Promise<void>) => unknown, snapshotOperations = false) {
  if (snapshotOperations) register(`${name}: snapshot history, cloning and confirmed deletion`, async t => {
    const { provider, region, otherRegion, advanceSnapshotWindow } = await factory(t, 'normal');
    const v = await provider.createVolume({ project: 'contract', region, name: 'login', sizeGiB: 1 });
    assert.equal(v.state, 'created'); if (v.state !== 'created') return;
    const first = await provider.snapshotVolume(v.volume);
    assert.equal(first.state, 'snapshotted'); if (first.state !== 'snapshotted') return;
    await advanceSnapshotWindow();
    const second = await provider.snapshotVolume(v.volume);
    assert.equal(second.state, 'snapshotted'); if (second.state !== 'snapshotted') return;
    assert.deepEqual(await provider.listSnapshots(v.volume), { state: 'listed', snapshots: [first.snapshot, second.snapshot] });
    const clone = await provider.createVolume({ project: 'contract', region: otherRegion, name: 'copy', sizeGiB: 1, fromSnapshot: first.snapshot });
    assert.equal(clone.state, 'created'); if (clone.state !== 'created') return;
    assert.equal(clone.volume.region, region);
    assert.deepEqual(await provider.deleteSnapshot(first.snapshot), { state: 'deleted' });
    assert.deepEqual(await provider.listSnapshots(v.volume), { state: 'listed', snapshots: [second.snapshot] });
    assert.equal((await provider.createVolume({ project: 'contract', region, name: 'gone', sizeGiB: 1, fromSnapshot: first.snapshot })).state, 'failed');
    assert.deepEqual(await provider.deleteVolume(v.volume), { state: 'deleted' });
    assert.deepEqual(await provider.listSnapshots(v.volume), { state: 'volume-gone' });
    assert.deepEqual(await provider.getSnapshot(second.snapshot.id), { state: 'found', snapshot: second.snapshot });
    const survivor = await provider.createVolume({ project: 'contract', region: otherRegion, name: 'survivor', sizeGiB: 1, fromSnapshot: second.snapshot.id });
    assert.equal(survivor.state, 'created');
    assert.deepEqual(await provider.deleteSnapshot(second.snapshot.id), { state: 'deleted' });
    assert.equal((await provider.getSnapshot(second.snapshot.id)).state, 'failed');
  });
  register(`${name}: volumes create, list and confirm deletion`, async t => {
    const { provider, region } = await factory(t, 'normal');
    const created = await provider.createVolume({ project: 'contract', region, name: 'login', sizeGiB: 1 });
    assert.equal(created.state, 'created');
    if (created.state !== 'created') return;
    assert.ok(created.volume.id);
    assert.equal(created.volume.region, region);
    assert.equal(created.volume.sizeGiB, 1);
    assert.deepEqual(await provider.listVolumes({ project: 'contract' }), { state: 'listed', volumes: [created.volume] });
    assert.deepEqual(await provider.listVolumes({ project: 'other' }), { state: 'listed', volumes: [] });
    assert.equal((await provider.deleteVolume(created.volume)).state, 'deleted');
    assert.deepEqual(await provider.listVolumes({ project: 'contract' }), { state: 'listed', volumes: [] });
    assert.equal((await provider.deleteVolume(created.volume)).state, 'deleted');
  });
  register(`${name}: volumes enforce one attachment and region binding`, async t => {
    const { provider, region, otherRegion, ready } = await factory(t, 'normal');
    const request = { project: 'contract', pool: 'agents', architecture: declaredArchitecture(provider), region };
    const a = await provider.acquire(request), b = await provider.acquire(request);
    const c = await provider.acquire({ ...request, region: otherRegion });
    assert.equal(a.state, 'created'); assert.equal(b.state, 'created'); assert.equal(c.state, 'created');
    const v = await provider.createVolume({ project: 'contract', region, name: 'login', sizeGiB: 1 });
    assert.equal(v.state, 'created');
    if (v.state !== 'created' || a.state !== 'created' || b.state !== 'created' || c.state !== 'created') return;
    await ready();
    assert.deepEqual(await provider.attachVolume(v.volume, a.machine), { state: 'attached' });
    assert.deepEqual(await provider.attachVolume(v.volume, a.machine), { state: 'attached' });
    assert.deepEqual(await provider.attachVolume(v.volume, b.machine), { state: 'refused', reason: 'attached elsewhere' });
    assert.deepEqual(await provider.detachVolume(v.volume, b.machine), { state: 'refused', reason: 'attached elsewhere' });
    assert.deepEqual(await provider.deleteVolume(v.volume), { state: 'refused', reason: 'attached' });
    assert.deepEqual(await provider.listVolumes({ project: 'contract' }), { state: 'listed', volumes: [{ ...v.volume, attachedTo: a.machine.id }] });
    assert.deepEqual(await provider.detachVolume(v.volume, a.machine), { state: 'detached' });
    assert.deepEqual(await provider.detachVolume(v.volume, a.machine), { state: 'detached' });
    assert.deepEqual(await provider.attachVolume(v.volume, c.machine), { state: 'refused', reason: 'region mismatch' });
    assert.deepEqual(await provider.attachVolume(v.volume, b.machine), { state: 'attached' });
    assert.deepEqual(await provider.detachVolume(v.volume, b.machine), { state: 'detached' });
    assert.equal((await provider.deleteVolume(v.volume)).state, 'deleted');
  });
  register(`${name}: ignored volume deletion retains inventory`, async t => {
    const { provider, region } = await factory(t, 'ignored-volume-delete');
    const v = await provider.createVolume({ project: 'contract', region, name: 'login', sizeGiB: 1 });
    assert.equal(v.state, 'created');
    if (v.state !== 'created') return;
    assert.equal((await provider.deleteVolume(v.volume)).state, 'incomplete');
    assert.deepEqual(await provider.listVolumes({ project: 'contract' }), { state: 'listed', volumes: [v.volume] });
  });

  register(`${name}: volumes rate limit snapshots until retry time`, async t => {
    const { provider, region, snapshotRetryAt, advanceSnapshotWindow } = await factory(t, 'normal');
    const v = await provider.createVolume({ project: 'contract', region, name: 'login', sizeGiB: 1 });
    assert.equal(v.state, 'created');
    if (v.state !== 'created') return;
    const first = await provider.snapshotVolume(v.volume);
    assert.equal(first.state, 'snapshotted');
    if (first.state !== 'snapshotted') return;
    assert.ok(first.snapshot.id);
    assert.equal(first.snapshot.volumeId, v.volume.id);
    assert.ok(Number.isFinite(Date.parse(first.snapshot.created)));
    assert.deepEqual(await provider.snapshotVolume(v.volume), { state: 'refused', reason: 'rate limited', retryAt: snapshotRetryAt });
    await advanceSnapshotWindow();
    const next = await provider.snapshotVolume(v.volume);
    assert.equal(next.state, 'snapshotted');
    if (next.state === 'snapshotted') assert.notEqual(next.snapshot.id, first.snapshot.id);
  });

}
