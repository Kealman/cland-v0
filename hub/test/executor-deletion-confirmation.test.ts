// T2: deletion confirmation on the fake provider; no cloud resources or native transport.
import assert from 'node:assert/strict';
import test from 'node:test';
import { eventually } from './harness.ts';
import { fixture } from './remote-fixture.ts';
import { drive } from './remote-clock.ts';
import { DropletExecutor } from '../src/executor/droplet/droplet.ts';
import { readLease, leaseDir } from '../src/executor/droplet/lease.ts';
import { spendPath } from '../src/executor/droplet/spend.ts';
import { readFile } from 'node:fs/promises';
import { fakeDigitalOcean } from './fakes/digitalocean/fake-api.ts';
import { DigitalOceanError } from '../src/executor/droplet/api.ts';
import { remoteWaits } from './remote-clock.ts';
import { FakeClock } from './fake-clock.ts';

test('DELETE 404 never confirms a droplet or key still readable by id', async t => {
  const fake = await fakeDigitalOcean('synthetic-confirmation', { machine: 'scripted', clock: new FakeClock() });
  t.after(() => fake.close());
  const key = await fake.provider.importKey('owned', 'synthetic-public-key');
  const droplet = await fake.provider.create({ name: 'owned', tags: ['cland'], size: 'c-8', region: 'lon1', image: 1, ssh_keys: [key.id] });
  fake.faults.deleteFailures = [404];
  await assert.rejects(fake.provider.deleteDroplet(droplet.id), /not confirmed/);
  fake.faults.keyDeleteFailures = [404];
  await assert.rejects(fake.provider.deleteKey(key.id), /not confirmed/);
  await fake.provider.deleteDroplet(droplet.id);
  await fake.provider.deleteKey(key.id);
  assert.deepEqual(fake.droplets, []);
  assert.deepEqual(fake.keys, []);
  // DELETE 404 plus GET 404 is the positive absence receipt too.
  await fake.provider.deleteDroplet(droplet.id);
  await fake.provider.deleteKey(key.id);
});

test('fake split answers last for the requested GET reads and slow GET respects deadline', async t => {
  const clock = new FakeClock();
  const fake = await fakeDigitalOcean('synthetic-confirmation', { machine: 'scripted', clock });
  t.after(() => fake.close());
  const key = await fake.provider.importKey('owned', 'synthetic-public-key');
  fake.faults.keyDelete404Reads = 2;
  await assert.rejects(fake.provider.deleteKey(key.id), /not confirmed/);
  assert.equal((await fake.provider.key(key.id)).id, key.id);
  await assert.rejects(fake.provider.key(key.id), e => e instanceof DigitalOceanError && e.status === 404);
  fake.images.push({ id: 42, name: 'snapshot', regions: [], size_gigabytes: 1, min_disk_size: 1, created_at: clock.now().toISOString() });
  assert.equal((await fake.provider.snapshot(42)).id, 42);
  fake.faults.getDelayMs = 100;
  fake.faults.getDelayPath = '/snapshots/42';
  await assert.rejects(remoteWaits(clock).run(fake.provider.snapshot(42, clock.now().getTime() + 10)), e => e instanceof DigitalOceanError && e.id === 'deadline');
  await clock.advance(100);
});

for (const kind of ['droplet', 'key'] as const) test(`release retains spend and attention until ${kind} GET confirms absence`, async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_DROPLET_RELEASE_MS: '100' } });
  await f.stop();
  const executor = new DropletExecutor(f.root, undefined, () => {}, f.env, undefined, f.dependencies);
  const lease = await drive(f, executor.acquire({ id: 'confirm' }, new Date(f.clock.now().getTime() + 60000).toISOString()));
  if (kind === 'droplet') f.api.faults.dropletDelete404Reads = 100;
  else f.api.faults.keyDelete404Reads = 100;
  const pending = await drive(f, executor.release(lease));
  assert.equal(pending.costUsd, null);
  const saved = await readLease(leaseDir(f.root, lease));
  assert.equal(saved.state, 'releasing');
  assert.ok(saved.attention);
  const ledger = JSON.parse(await readFile(spendPath(f.env), 'utf8'));
  assert.equal(ledger.entries.find((e: { lease: string }) => e.lease === lease.lease).cost, null);
  // Exhaust only the declared provider reads; lists cannot confirm deletion.
  for (let n = 0; n < 101; n++) {
    try { if (kind === 'droplet') await f.api.provider.droplet(lease.resource!); else await f.api.provider.key(lease.keyId!); }
    catch (e) { if (!(e instanceof DigitalOceanError) || e.status !== 404) throw e; }
  }
  const confirmed = await drive(f, executor.release(lease));
  assert.notEqual(confirmed.costUsd, null);
  assert.equal((await readLease(leaseDir(f.root, lease))).state, 'released');
  const settled = JSON.parse(await readFile(spendPath(f.env), 'utf8'));
  assert.notEqual(settled.entries.find((e: { lease: string }) => e.lease === lease.lease).cost, null);
});

for (const kind of ['droplet', 'key'] as const) test(`release remembers additional ${kind} ids omitted from later lists across reload`, async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_DROPLET_RELEASE_MS: '100' } });
  await f.stop();
  const executor = new DropletExecutor(f.root, undefined, () => {}, f.env, undefined, f.dependencies);
  const lease = await drive(f, executor.acquire({ id: 'multiple' }, new Date(f.clock.now().getTime() + 60000).toISOString()));
  const duplicate = kind === 'key' ? { ...f.api.keys[0]!, id: 900 } : { ...f.api.droplets[0]!, id: 900 };
  if (kind === 'key') { f.api.keys.push(duplicate as typeof f.api.keys[number]); f.api.faults.keyDelete404Reads = 100; }
  else { f.api.droplets.push(duplicate as typeof f.api.droplets[number]); f.api.faults.dropletDelete404Reads = 100; }
  let lists = 0;
  const omit = async () => { if (++lists > 1) { f.api.faults.omitDropletIds = [900]; f.api.faults.omitKeyIds = [900]; } };
  if (kind === 'key') f.api.beforeKeyList(omit); else f.api.beforeDropletList(omit);
  await drive(f, executor.release(lease));
  // Remove only the primary. The extra observed id still exists but lists omit it.
  f.api.droplets.splice(0, f.api.droplets.length, ...f.api.droplets.filter(d => d.id === 900));
  f.api.keys.splice(0, f.api.keys.length, ...f.api.keys.filter(k => k.id === 900));
  const reloaded = await readLease(leaseDir(f.root, lease));
  const pending = await drive(f, executor.release(reloaded));
  assert.equal(pending.costUsd, null);
  assert.equal((await readLease(leaseDir(f.root, lease))).state, 'releasing');
  assert.ok(f.api.requests.some(r => r.method === 'GET' && r.path === (kind === 'key' ? '/v2/account/keys/900' : '/v2/droplets/900')));
  f.api.keys.splice(0); f.api.droplets.splice(0);
  assert.notEqual((await drive(f, executor.release(reloaded))).costUsd, null);
});

test('accepted DELETE is checkpointed before held failing confirmation GET and keeps its original bound', async t => {
  const f = await fixture(t, { machine: 'scripted', env: { CLAND_TEST_DROPLET_RELEASE_MS: '100', CLAND_TEST_DROPLET_DELETE_MS: '500' } });
  await f.stop();
  const executor = new DropletExecutor(f.root, undefined, () => {}, f.env, undefined, f.dependencies);
  const lease = await drive(f, executor.acquire({ id: 'accepted' }, new Date(f.clock.now().getTime() + 60000).toISOString()));
  f.api.faults.deletePolls = 10000;
  let entered = false;
  const resume = Promise.withResolvers<void>();
  t.after(() => resume.resolve());
  let once = true;
  f.api.beforeDropletRead(async () => {
    if (!once || !f.api.requests.some(r => r.method === 'DELETE' && r.path === `/v2/droplets/${lease.resource}`)) return;
    once = false; entered = true; await resume.promise;
    throw new DigitalOceanError(503, 'held-get', 'confirmation unavailable');
  });
  const releasing = drive(f, executor.release(lease));
  let started: string | undefined;
  try { await eventually('confirmation GET entered', () => entered ? true : undefined); started = (await readLease(leaseDir(f.root, lease))).deleteStarted; assert.ok(started); }
  finally { resume.resolve(); await releasing; }
  await f.clock.advance(501);
  await drive(f, executor.release(await readLease(leaseDir(f.root, lease))));
  const saved = await readLease(leaseDir(f.root, lease));
  assert.equal(saved.deleteStarted, started);
  assert.equal(saved.attention?.reason, 'deletion-timeout');
  assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path === `/v2/droplets/${lease.resource}`).length, 1);
});
