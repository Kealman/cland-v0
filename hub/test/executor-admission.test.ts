// T2 (tier admission flags the nvim key identifier; syntax lint qualifies T1): refusal paths use one filesystem fixture and in-process provider/host, no hub or territory.
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { keyHash } from '../src/executor/droplet/prepare.ts';
import { FakeClock } from './fake-clock.ts';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { scriptedMachine } from './fakes/digitalocean/scripted-machine.ts';

test('remote admission refusal causes retain their reason and clean up resources', async t => {
  const root = await mkdtemp(join(tmpdir(), 'cland-admission-'));
  const clock = new FakeClock();
  const api = await fakeDigitalOcean('sentinel-admission', { machine: 'scripted', clock });
  t.after(async () => { await api.close(); await rm(root, { recursive: true, force: true }); });
  const key = { node: process.version, nvim: { tag: 'v0.12.5', digest: 'a'.repeat(64) }, lock: 'b'.repeat(64), base: 'c'.repeat(40) };
  const machine = scriptedMachine(root, clock, key);
  const env = { DIGITALOCEAN_TOKEN: 'sentinel-admission', CLAND_EXECUTOR_STATE: join(root, 'state') };
  const executor = new DropletExecutor(root, undefined, undefined, env, undefined, { ...machine.dependencies, api: api.provider });
  const snapshotPath = join(root, '.cland/run/executor/snapshot.json');
  await mkdir(join(root, '.cland/run/executor'), { recursive: true });
  const snapshot = { image: 900, name: 'prepared', key, keyHash: keyHash(key), regions: ['lon1'], minDiskSize: 10 };
  const regions = structuredClone(api.regions);
  for (const [cause, reason, creates] of [
    ['token', /DIGITALOCEAN_TOKEN is required/, 0],
    ['422', /422/, 1],
    ['500', /500/, 1],
    ['snapshot', /no prepared snapshot/, 0],
    ['region', /unavailable in regions/, 0],
  ] as const) {
    await writeFile(snapshotPath, JSON.stringify(snapshot));
    env.DIGITALOCEAN_TOKEN = cause === 'token' ? '' : 'sentinel-admission';
    api.faults.create = cause === '422' || cause === '500' ? Number(cause) : 0;
    api.faults.echoToken = true;
    api.regions.splice(0, api.regions.length, ...(cause === 'region' ? [] : regions));
    if (cause === 'snapshot') await rm(snapshotPath);
    const before = api.requests.filter(request => request.method === 'POST' && request.path === '/v2/droplets').length;
    await machine.waits.run(assert.rejects(executor.acquire({ id: cause }, new Date(clock.now().getTime() + 60000).toISOString()), error => {
      assert.match(String(error), reason);
      assert.doesNotMatch(String(error), /sentinel-admission/);
      return true;
    }));
    assert.equal(api.requests.filter(request => request.method === 'POST' && request.path === '/v2/droplets').length - before, creates, cause);
    assert.deepEqual(api.droplets, [], cause);
    assert.deepEqual(api.keys, [], cause);
  }
});
