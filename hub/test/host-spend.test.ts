// T1: shared ledger accounting uses scratch state, injected identity and a fake clock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { scratchMachine, legacyLedger } from './init-machine.ts';
import { FakeClock } from './fake-clock.ts';
import { reserveHostSpend, renewHostSpend, settleHostSpend, reserveShardSpend, reserveSpend, inspectSpend, inspectHostSpend, spendPath } from '../src/executor/droplet/spend.ts';

import type { DropletLease } from '../src/executor/droplet/lease.ts';

const processes = { alive: () => true, started: () => 'fixture identity' };
const host = { project: '/fixture/project', lease: 'host-1', pool: 'agents', size: 's-4vcpu-8gb', priceHourly: 2, billingMinimumMs: 60000, created: '2026-10-16T12:00:00Z', deadline: '2026-10-16T13:00:00Z' };
const caps = { shared: 10, hosts: 5 };

test('host reservation preserves previous v1 settlements and legacy reconciliation', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock();
  const old = { project: host.project, lease: 'verify-old', run: 'verify-old', size: 'c-8', reservation: 3, cost: 3, created: host.created, deadline: host.deadline, released: host.created };
  await legacyLedger(machine, [old]);
  await mkdir(dirname(spendPath(machine.env)), { recursive: true });
  await writeFile(spendPath(machine.env), JSON.stringify({ version: 1, entries: [{ ...old, cost: 1 }] }));
  await reserveHostSpend(host, caps, machine.env, { clock, processes });
  const stored = JSON.parse(await readFile(spendPath(machine.env), 'utf8'));
  assert.equal(stored.version, 1);
  assert.equal(stored.entries.length, 2);
  assert.deepEqual(stored.entries[0], old);
  assert.equal(stored.entries[1].category, 'hosts');
  assert.equal(stored.entries[1].pool, 'agents');
  const status = await inspectHostSpend(machine.env, clock);
  assert.deepEqual(status.categories.verify, { today: 3, month: 3 });
  assert.deepEqual(status.categories.hosts, { today: 0, month: 0 });
  assert.deepEqual(status.pools.agents, { today: 0, month: 0 });
  const legacy = JSON.parse(await readFile(`${machine.home}/.cland/executor/spend.json`, 'utf8'));
  assert.deepEqual(legacy.entries, stored.entries);
});

test('host and executor admissions share the cap while hosts also obey their own cap', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock();
  await reserveShardSpend(host.project, ['verify'], 'c-8', 3, 3600000, 10, machine.env, clock, processes);
  await assert.rejects(reserveHostSpend(host, { shared: 10, hosts: 1 }, machine.env, { clock, processes }), /hosts daily spend cap/);
  await assert.rejects(reserveHostSpend(host, { shared: 4, hosts: 5 }, machine.env, { clock, processes }), /daily spend cap/);
  await reserveHostSpend(host, caps, machine.env, { clock, processes });
  await assert.rejects(reserveShardSpend(host.project, ['verify-2'], 'c-8', 1, 3600000, 5, machine.env, clock, processes), /daily spend cap/);
  await reserveHostSpend(host, caps, machine.env, { clock, processes });
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 5);
  const stored = JSON.parse(await readFile(spendPath(machine.env), 'utf8'));
  assert.equal(stored.entries.length, 2);
  assert.equal(stored.entries[0].category, 'verify');
});

test('renewal raises the held lifetime and settlement bills actual lifetime with a minimum', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock();
  await reserveHostSpend(host, caps, machine.env, { clock, processes });
  await assert.rejects(renewHostSpend(host.project, host.lease, '2026-10-16T15:00:00Z', caps, machine.env, { clock, processes }), /hosts daily spend cap/);
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 2);
  await renewHostSpend(host.project, host.lease, '2026-10-16T14:00:00Z', caps, machine.env, { clock, processes });
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 4);
  await renewHostSpend(host.project, host.lease, host.deadline, caps, machine.env, { clock, processes });
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 4);
  await settleHostSpend(host.project, host.lease, '2026-10-16T12:30:00Z', machine.env, { clock, processes });
  await settleHostSpend(host.project, host.lease, '2026-10-16T12:30:00Z', machine.env, { clock, processes });
  await assert.rejects(settleHostSpend(host.project, host.lease, '2026-10-16T12:31:00Z', machine.env, { clock, processes }), /settlement conflict/);
  await assert.rejects(renewHostSpend(host.project, host.lease, host.deadline, caps, machine.env, { clock, processes }), /settled/);
  await reserveHostSpend({ ...host, lease: 'short', billingMinimumMs: 3600000 }, caps, machine.env, { clock, processes });
  await settleHostSpend(host.project, 'short', '2026-10-16T12:00:01Z', machine.env, { clock, processes });
  const status = await inspectHostSpend(machine.env, clock);
  assert.deepEqual(status.categories.hosts, { today: 3, month: 3 });
  assert.deepEqual(status.pools.agents, { today: 3, month: 3 });
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 0);
});

test('settled UTC totals separate days, months and pools while pending costs stay excluded', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock(Date.parse('2026-11-01T12:00:00Z'));
  const dates = [
    ['oct', 'agents', '2026-10-31T10:00:00Z', '2026-10-31T11:00:00Z'],
    ['nov', 'agents', '2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z'],
    ['other', 'builders', '2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z'],
  ];
  for (const [lease, pool, created, deadline] of dates) {
    await reserveHostSpend({ ...host, lease: lease!, pool: pool!, created: created!, deadline: deadline! }, caps, machine.env, { clock, processes });
    await settleHostSpend(host.project, lease!, deadline!, machine.env, { clock, processes });
  }
  await reserveHostSpend({ ...host, lease: 'pending' }, { shared: 10, hosts: 10 }, machine.env, { clock, processes });
  assert.deepEqual((await inspectHostSpend(machine.env, clock)).categories.hosts, { today: 4, month: 4 });
  clock.block(24 * 3600000);
  const status = await inspectHostSpend(machine.env, clock);
  assert.deepEqual(status.categories.hosts, { today: 0, month: 4 });
  assert.deepEqual(status.pools.agents, { today: 0, month: 2 });
  assert.deepEqual(status.pools.builders, { today: 0, month: 2 });
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 2);
});

test('executor shard admission does not mistake a host identity for a verification run', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock();
  await reserveHostSpend({ ...host, lease: 'reserved:run' }, caps, machine.env, { clock, processes });
  await reserveShardSpend(host.project, ['reserved:run'], 'c-8', 1, 3600000, 10, machine.env, clock, processes);
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 3);
});

for (const mode of ['native', 'shard']) test(`${mode} host lease conflict refuses admission without changing durable accounting`, async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock();
  await legacyLedger(machine, []);
  await reserveHostSpend(host, caps, machine.env, { clock, processes });
  await reserveHostSpend({ ...host, lease: 'reserved:run' }, caps, machine.env, { clock, processes });
  const before = await readFile(spendPath(machine.env), 'utf8');
  const lease: DropletLease = { kind: 'droplet', provider: 'digitalocean', lease: host.lease, run: 'executor-run', name: 'fixture', tags: [], size: host.size, region: 'lon1', priceHourly: 2, keyName: 'fixture', state: 'creating', resource: null, keyId: null, created: host.created, deadline: host.deadline };
  if (mode === 'native') await assert.rejects(reserveSpend(host.project, lease, 4, machine.env, clock, undefined, processes), /spend reservation identity conflict/);
  else await assert.rejects(reserveShardSpend(host.project, ['run'], host.size, 2, 3600000, 10, machine.env, clock, processes), /spend reservation identity conflict/);
  assert.equal(await readFile(spendPath(machine.env), 'utf8'), before);
  // A locked load reconciles primary/legacy before returning the combined total.
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).reserved, 4);
  assert.equal(await readFile(spendPath(machine.env), 'utf8'), before);
});

test('offset settlement instants count in the UTC day and month and shared cap', async t => {
  const machine = await scratchMachine(t, { identity: false });
  const clock = new FakeClock(Date.parse('2026-11-01T02:00:00Z'));
  const input = { ...host, created: '2026-11-01T00:30:00Z', deadline: '2026-11-01T02:30:00Z' };
  await reserveHostSpend(input, caps, machine.env, { clock, processes });
  await settleHostSpend(host.project, host.lease, '2026-10-31T23:30:00-02:00', machine.env, { clock, processes });
  const status = await inspectHostSpend(machine.env, clock);
  assert.deepEqual(status.categories.hosts, { today: 2, month: 2 });
  assert.deepEqual(status.pools.agents, { today: 2, month: 2 });
  assert.equal((await inspectSpend(10, machine.env, clock, processes)).spent, 2);
  await assert.rejects(reserveShardSpend(host.project, ['verify'], host.size, 1, 3600000, 2, machine.env, clock, processes), /daily spend cap/);
  await settleHostSpend(host.project, host.lease, '2026-11-01T01:30:00.000Z', machine.env, { clock, processes });
  const stored = JSON.parse(await readFile(spendPath(machine.env), 'utf8'));
  assert.equal(stored.entries[0].released, '2026-11-01T01:30:00.000Z');
});

test('never-acquired receipts cancel at zero while unknown outcomes retain reservation and acquired lifetimes keep minimum',async t=>{
 const f=await scratchMachine(t,{identity:false}),clock=new FakeClock();
 const {cancelHostSpend}=await import('../src/executor/droplet/spend.ts');
 for(const kind of ['not-called','provider-refused'] as const){
  const input={...host,lease:kind};await reserveHostSpend(input,caps,f.env,{clock,processes});
  await cancelHostSpend({project:host.project,lease:kind},{kind,at:host.created},f.env,{clock,processes});
  assert.equal((await inspectSpend(10,f.env,clock,processes)).reserved,0);
  const stored=JSON.parse(await readFile(spendPath(f.env),'utf8')).entries.find((e:{lease:string})=>e.lease===kind);
  assert.equal(stored.cost,0);
 }
 await reserveHostSpend({...host,lease:'unknown'},caps,f.env,{clock,processes});
 await assert.rejects(cancelHostSpend({project:host.project,lease:'unknown'},{kind:'unknown',at:host.created} as never,f.env,{clock,processes}),/non-acquisition receipt/);
 assert.equal((await inspectSpend(10,f.env,clock,processes)).reserved,2);
 await reserveHostSpend({...host,lease:'acquired',billingMinimumMs:3600000},caps,f.env,{clock,processes});
 await settleHostSpend(host.project,'acquired','2026-10-16T12:00:01Z',f.env,{clock,processes});
 const stored=JSON.parse(await readFile(spendPath(f.env),'utf8')).entries;
 assert.equal(stored.find((e:{lease:string})=>e.lease==='acquired').cost,2);
 assert.equal(stored.find((e:{lease:string})=>e.lease==='unknown').cost,null);
});
