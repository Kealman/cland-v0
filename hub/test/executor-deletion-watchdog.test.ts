// T3: detached watchdog confirms provider reads before its durable receipt, using fake API only.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from './remote-fixture.ts';
import { projectHub, eventually } from './harness.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { leaseDir, writeLease } from '../src/executor/droplet/lease.ts';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

test('watchdog receipt follows GET 404 for both droplet and key after split DELETE answers', async t => {
  const f = await fixture(t, { hub: projectHub, env: { CLAND_TEST_DROPLET_WATCHDOG_POLL_MS: '25' } });
  await f.stop();
  const executor = new DropletExecutor(f.root, undefined, () => {}, f.env);
  const lease = await executor.acquire({ id: 'watchdog-confirm' }, new Date(Date.now() + 60000).toISOString());
  const receipt = join(leaseDir(f.root, lease), 'watchdog.json');
  f.api.droplets.push({ ...f.api.droplets[0]!, id: 900 });
  f.api.keys.push({ ...f.api.keys[0]!, id: 901 });
  let dropletLists = 0, keyLists = 0;
  f.api.beforeDropletList(async () => { if (++dropletLists > 1) f.api.faults.omitDropletIds = [900]; });
  f.api.beforeKeyList(async () => { if (++keyLists > 1) f.api.faults.omitKeyIds = [901]; });
  let observedPresent = 0;
  f.api.beforeKeyRead(async () => {
    if (!f.api.keys.length) return;
    observedPresent++;
    await assert.rejects(readFile(receipt), { code: 'ENOENT' });
  });
  f.api.faults.keyDelete404Reads = 3;
  f.api.faults.dropletDelete404Reads = 3;
  lease.deadline = new Date(0).toISOString();
  await writeLease(f.root, lease);
  const confirmed = await eventually('watchdog durable confirmation receipt', async () => {
    try { return JSON.parse(await readFile(receipt, 'utf8')); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; return undefined; }
  });
  assert.ok(confirmed.confirmedAt);
  assert.ok(observedPresent > 0);
  assert.deepEqual(f.api.droplets, []);
  assert.deepEqual(f.api.keys, []);
  for (const path of [`/v2/droplets/${lease.resource}`, `/v2/account/keys/${lease.keyId}`, '/v2/droplets/900', '/v2/account/keys/901']) {
    const requests = f.api.requests.filter(r => r.path === path);
    assert.equal(requests.at(-1)?.method, 'GET');
    assert.ok(requests.filter(r => r.method === 'DELETE').length > 1);
  }
});
