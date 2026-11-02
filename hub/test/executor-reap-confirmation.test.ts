// T2: public reap/sweep against the scripted fake provider, no native cloud or SSH.
import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from './remote-fixture.ts';
import { drive } from './remote-clock.ts';
import { defaultConfig } from '../src/init/config.ts';
import { DropletExecutor, projectTag } from '../src/executor/droplet/droplet.ts';
import { readFile } from 'node:fs/promises';
import { spendPath } from '../src/executor/droplet/spend.ts';
import { leaseDir, readLease } from '../src/executor/droplet/lease.ts';

for (const kind of ['droplet', 'key'] as const) test(`reap reports live ${kind} GET after DELETE 404 and retries next reap with lease open`, async t => {
  const f = await fixture(t, { machine: 'scripted' });
  await f.stop();
  const executor = new DropletExecutor(f.root, undefined, () => {}, f.env, undefined, f.dependencies);
  const lease = await drive(f, executor.acquire({ id: 'reap-confirm' }, new Date(f.clock.now().getTime() + 60000).toISOString()));
  await f.clock.advance(900001);
  if (kind === 'droplet') f.api.faults.deleteFailures = [404];
  else f.api.faults.keyDeleteFailures = [404];
  const path = kind === 'droplet' ? `/v2/droplets/${lease.resource}` : `/v2/account/keys/${lease.keyId}`;
  const before = f.api.requests.length;
  const result = await drive(f, executor.reap());
  assert.match(result.summary, /unconfirmed/);
  assert.deepEqual(result.unconfirmed, { droplets: kind === 'droplet' ? [lease.resource] : [], keys: kind === 'key' ? [lease.keyId] : [] });
  assert.ok(!(kind === 'droplet' ? result.deleted : result.deletedKeys).includes(kind === 'droplet' ? lease.resource! : lease.keyId!));
  assert.notEqual((await readLease(leaseDir(f.root, lease))).state, 'released');
  const ledger = JSON.parse(await readFile(spendPath(f.env), 'utf8'));
  assert.equal(ledger.entries.find((entry: { lease: string }) => entry.lease === lease.lease).cost, null);
  assert.ok(f.api.requests.slice(before).some(r => r.method === 'GET' && r.path === path));
  const retry = await drive(f, executor.reap());
  assert.deepEqual(kind === 'droplet' ? retry.deleted : retry.deletedKeys, [kind === 'droplet' ? lease.resource : lease.keyId]);
  assert.equal(f.api.requests.slice(before).filter(r => r.method === 'DELETE' && r.path === path).length, 2);
});

for (const answer of ['gone', '404', '204']) test(`provider sweep counts only GET-confirmed deletions (DELETE=${answer})`, async t => {
  const pending = answer !== 'gone';
  const f = await fixture(t, { machine: 'scripted' });
  await f.stop();
  const events: Record<string, unknown>[] = [];
  const executor = new DropletExecutor(f.root, undefined, event => events.push(event), f.env, undefined, f.dependencies);
  const tag = projectTag(f.root, f.root.split('/').at(-1)!);
  const key = await f.api.provider.importKey(`${tag}-orphan`, 'synthetic');
  const droplet = await f.api.provider.create({ name: 'orphan', tags: ['cland', tag], size: 'c-8', region: 'lon1', image: 1, ssh_keys: [key.id] });
  if (answer === '404') { f.api.faults.deleteFailures = [404]; f.api.faults.keyDeleteFailures = [404]; }
  if (answer === '204') { f.api.faults.deletePolls = 2; f.api.faults.keyDeletePolls = 1; }
  const before = f.api.requests.length;
  await drive(f, executor.sweep());
  const receipt = events.findLast(e => e.event === 'executor-sweep');
  assert.ok(receipt);
  assert.equal(receipt.reapedDroplets, pending ? 0 : 1);
  assert.equal(receipt.reapedKeys, pending ? 0 : 1);
  assert.equal(receipt.failures, pending ? 2 : 0);
  for (const path of [`/v2/droplets/${droplet.id}`, `/v2/account/keys/${key.id}`]) {
    assert.ok(f.api.requests.slice(before).some(r => r.method === 'GET' && r.path === path));
  }
  // One discovery listing; absence is confirmed only by the individual GETs.
  assert.equal(f.api.requests.slice(before).filter(r => r.method === 'GET' && r.path.startsWith('/v2/droplets?')).length, 1);
  if (pending) {
    assert.equal(events.filter(e => e.event === 'executor-reap-unconfirmed').length, 2);
    await drive(f, executor.sweep());
    assert.equal(events.findLast(e => e.event === 'executor-sweep')?.reapedDroplets, 1);
    assert.equal(events.findLast(e => e.event === 'executor-sweep')?.reapedKeys, 1);
  }
});

for (const kind of ['droplet', 'key'] as const) test(`reap recovers hidden pending ${kind} identity across project rename and executor reload`, async t => {
  const f = await fixture(t, { machine: 'scripted' });
  await f.stop();
  const executor = new DropletExecutor(f.root, undefined, () => {}, f.env, undefined, f.dependencies);
  const tag = projectTag(f.root, f.root.split('/').at(-1)!);
  const key = await f.api.provider.importKey(`${tag}-hidden`, 'synthetic');
  const droplet = await f.api.provider.create({ name: 'hidden', tags: ['cland', tag], size: 'c-8', region: 'lon1', image: 1, ssh_keys: [key.id] });
  if (kind === 'droplet') f.api.faults.deleteFailures = [404, 404];
  else f.api.faults.keyDeleteFailures = [404, 404];
  await drive(f, executor.reap());
  f.api.faults.omitDropletIds = [droplet.id]; f.api.faults.omitKeyIds = [key.id];
  const renamed = defaultConfig('renamed-project');
  const recovered = new DropletExecutor(f.root, undefined, () => {}, f.env, () => renamed, f.dependencies);
  const second = await drive(f, recovered.reap());
  assert.deepEqual(second.unconfirmed, { droplets: kind === 'droplet' ? [droplet.id] : [], keys: kind === 'key' ? [key.id] : [] });
  const third = await drive(f, recovered.reap());
  assert.deepEqual(kind === 'droplet' ? third.deleted : third.deletedKeys, [kind === 'droplet' ? droplet.id : key.id]);
  const path = kind === 'droplet' ? `/v2/droplets/${droplet.id}` : `/v2/account/keys/${key.id}`;
  assert.equal(f.api.requests.filter(r => r.method === 'DELETE' && r.path === path).length, 3);
  assert.equal((await drive(f, recovered.reap())).unconfirmed, undefined);
});

for (const kind of ['droplet', 'key'] as const) test(`recovered pending ${kind} refuses changed provider identity`, async t => {
  const f = await fixture(t, { machine: 'scripted' });
  await f.stop();
  const executor = new DropletExecutor(f.root, undefined, () => {}, f.env, undefined, f.dependencies);
  const tag = projectTag(f.root, f.root.split('/').at(-1)!);
  const key = await f.api.provider.importKey(`${tag}-identity`, 'synthetic');
  const droplet = await f.api.provider.create({ name: 'identity', tags: ['cland', tag], size: 'c-8', region: 'lon1', image: 1, ssh_keys: [key.id] });
  if (kind === 'droplet') f.api.faults.deleteFailures = [404];
  else f.api.faults.keyDeleteFailures = [404];
  await drive(f, executor.reap());
  const target = kind === 'droplet' ? f.api.droplets[0]! : f.api.keys[0]!;
  const original = target.name;
  target.name = 'different-owner';
  f.api.faults.omitDropletIds = [droplet.id]; f.api.faults.omitKeyIds = [key.id];
  const before = f.api.requests.length;
  const recovered = new DropletExecutor(f.root, undefined, () => {}, f.env, undefined, f.dependencies);
  const result = await drive(f, recovered.reap());
  assert.ok(result.unconfirmed);
  assert.equal(f.api.requests.slice(before).filter(r => r.method === 'DELETE').length, 0);
  target.name = original;
  const confirmed = await drive(f, recovered.reap());
  assert.deepEqual(kind === 'droplet' ? confirmed.deleted : confirmed.deletedKeys, [target.id]);
});
