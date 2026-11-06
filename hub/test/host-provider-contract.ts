import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import type { HostProvider } from '../src/host/provider/provider.ts';

/** Caller supplies a registration wrapper located in its .test.ts entry so
 * native test receipts and exact-name reruns identify that runnable file.
 * Factory owns isolation/cleanup; ready() advances a fixture clock or observes
 * the provider's bounded readiness receipt. No provider-specific assertions here. */
export type ProviderScenario = 'normal' | 'refused' | 'failed-acquire' | 'delayed-boot' | 'never-boot' | 'ignored-delete';
export function hostProviderContract(name: string, factory: (t: TestContext, scenario: ProviderScenario) => Promise<{
  provider: HostProvider; ready: () => Promise<void>;
}>, register: (name: string, run: (t: TestContext) => Promise<void>) => unknown) {
  register(`${name}: provider contract creates, prepares, observes and confirms release`, async t => {
    const { provider, ready } = await factory(t, 'normal');
    assert.equal(provider.transport, 'ssh');
    assert.equal((await provider.prepare()).state, 'prepared');
    assert.equal((await provider.prepare()).state, 'current');
    const acquired = await provider.acquire({ project: 'contract', pool: 'agents', architecture: 'x86_64' });
    assert.equal(acquired.state, 'created');
    if (acquired.state !== 'created') return;
    const machine = acquired.machine;
    assert.ok(machine.id); assert.ok(machine.address);
    assert.equal(machine.architecture, 'x86_64');
    assert.ok(Number.isFinite(Date.parse(machine.created)));
    await ready();
    assert.equal((await provider.status(machine)).state, 'ready');
    assert.equal((await provider.release(machine)).state, 'released');
    assert.equal((await provider.status(machine)).state, 'gone');
    assert.equal((await provider.release(machine)).state, 'released');
    assert.deepEqual(await provider.reap({ project: 'contract', pool: 'agents' }), { state: 'reaped', released: [], incomplete: [] });
  });
  register(`${name}: reap releases only the requested project and pool`, async t => {
    const { provider } = await factory(t, 'normal');
    const one = await provider.acquire({ project: 'contract', pool: 'agents', architecture: 'arm64' });
    const other = await provider.acquire({ project: 'other', pool: 'agents', architecture: 'arm64' });
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
      const result = await provider.acquire({ project: 'contract', pool: 'agents', architecture: 'x86_64' });
      assert.equal(result.state, scenario === 'refused' ? 'refused' : 'failed');
      assert.ok(result.reason);
      if (result.state === 'refused') assert.ok(Number.isFinite(Date.parse(result.retryAt)));
    });
  }
  for (const scenario of ['delayed-boot', 'never-boot', 'ignored-delete'] as const) {
    register(`${name}: ${scenario} preserves observed lifecycle outcomes`, async t => {
      const { provider, ready } = await factory(t, scenario);
      const result = await provider.acquire({ project: 'contract', pool: 'agents', architecture: 'x86_64' });
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
