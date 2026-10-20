// T2: one fixture drives the builder release policy against an in-process provider.
// Scripted transport acknowledges provisioning; shell/image contents remain in executor-prepare.
import assert from 'node:assert/strict';
import test from 'node:test';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { DigitalOceanError } from '../src/executor/droplet/api.ts';
import { fixture } from './remote-fixture.ts';
import { drive } from './remote-clock.ts';

test('prepare retries transient builder deletion failures within its release window', async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_DROPLET_RELEASE_MS: '5000' } });
  await f.stop();
  const records: { event?: unknown; cause?: { status?: number; id?: string } }[] = [];
  const provider = f.api.provider;
  let transportTimeout = false;
  const executor = new DropletExecutor(f.root, undefined, record => records.push(record), f.env, undefined, {
    ...f.dependencies,
    api: new Proxy(provider, { get(target, property) {
      if (property === 'deleteDroplet') return async (...args: Parameters<typeof provider.deleteDroplet>) => {
        if (transportTimeout) { transportTimeout = false; throw new DigitalOceanError(0, 'transport', 'request failed or exceeded its time bound'); }
        return provider.deleteDroplet(...args);
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } }),
    machine: { ...f.dependencies.machine!, exec: async () => '', result: async () => ({ stdout: '', stderr: '', code: 0 }), put: async () => {} },
  });
  let index = 0;
  for (const failure of [409, 422, 503, 'timeout', 'key-503'] as const) {
    records.length = 0;
    if (failure === 'key-503') f.api.faults.keyDeleteFailures = [503];
    else if (failure === 'timeout') transportTimeout = true;
    else f.api.faults.deleteFailures = [failure];
    f.api.faults.echoToken = true;
    const key = { ...f.key, lock: String(++index).repeat(64) };
    const result = await drive(f, executor.prepare(key));
    assert.equal(result.state, 'prepared', String(failure));
    assert.notEqual(result.lifetimeMs, null, String(failure));
    assert.ok(result.costUsd! > 0, String(failure));
    assert.deepEqual(f.api.droplets, [], String(failure));
    assert.deepEqual(f.api.keys, [], String(failure));
    assert.equal(f.api.images.length, 1, String(failure));
    assert.ok(!JSON.stringify(records).includes('sentinel-remote-suite-token'));
    const retry = records.find(record => record.event === 'executor-release-retry');
    assert.equal(retry?.cause?.status, failure === 'timeout' ? 0 : failure === 'key-503' ? 503 : failure);
    assert.equal(retry?.cause?.id, failure === 'timeout' ? 'transport' : failure === 'key-503' ? 'key_delete_failed' : 'delete_failed');
  }
});
